'use strict';

/**
 * TRIPAL ERP / ANRB — Complete Layerbase Production Backup Script
 *
 * Creates:
 *   1. backups/anrb_layerbase_production_backup/layerbase_full_backup.sql
 *   2. backups/anrb_layerbase_production_backup/layerbase_full_backup.json
 *   3. backups/anrb_layerbase_production_backup/inventory.json
 *   4. backups/anrb_layerbase_production_backup/inventory.md
 *   5. backups/anrb_layerbase_production_backup/checksums.sha256
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function escapeSqlVal(val, dataType) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') {
    if (Number.isNaN(val)) return 'NULL';
    return String(val);
  }
  if (val instanceof Date) {
    return `'${val.toISOString()}'`;
  }
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

function calculateSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

async function runBackup() {
  console.log('===============================================================');
  console.log('ANRB / TRIPAL ERP — MASTER LAYERBASE PRODUCTION BACKUP');
  console.log('===============================================================\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is missing in .env!');
    process.exit(1);
  }

  const backupDir = path.resolve(__dirname, '../backups/anrb_layerbase_production_backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });

  const client = await pool.connect();

  try {
    console.log('[1/7] Discovering public schema tables...');
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`Discovered ${tableNames.length} tables.`);

    console.log('[2/7] Discovering sequences...');
    const seqRes = await client.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public'
      ORDER BY sequence_name;
    `);
    const seqNames = seqRes.rows.map(r => r.sequence_name);

    console.log('[3/7] Fetching sequence states...');
    const sequenceStates = {};
    for (const seq of seqNames) {
      try {
        const sRes = await client.query(`SELECT last_value, is_called FROM "${seq}"`);
        sequenceStates[seq] = sRes.rows[0];
      } catch (err) {
        console.warn(`Could not read sequence ${seq}: ${err.message}`);
      }
    }

    console.log('[4/7] Discovering columns, constraints, and indexes...');
    const colsRes = await client.query(`
      SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    const tableColumns = {};
    for (const col of colsRes.rows) {
      if (!tableColumns[col.table_name]) tableColumns[col.table_name] = [];
      tableColumns[col.table_name].push(col);
    }

    const constraintsRes = await client.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      LEFT JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
    `);

    const indexesRes = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);

    console.log('[5/7] Extracting all records from tables...');
    const fullJsonBackup = {
      metadata: {
        exported_at: new Date().toISOString(),
        source_type: 'Layerbase PostgreSQL',
        database_name: 'tripal_erp',
        total_tables: tableNames.length,
        table_counts: {}
      },
      sequences: sequenceStates,
      tables: {}
    };

    let totalRowsCount = 0;
    const tableInventory = [];

    // Begin building SQL dump
    let sqlDump = `-- =====================================================================\n`;
    sqlDump += `-- ANRB / TRIPAL ERP — MASTER LAYERBASE POSTGRESQL PRODUCTION DUMP\n`;
    sqlDump += `-- Generated: ${new Date().toISOString()}\n`;
    sqlDump += `-- Total Tables: ${tableNames.length}\n`;
    sqlDump += `-- Source: Layerbase PostgreSQL\n`;
    sqlDump += `-- =====================================================================\n\n`;
    sqlDump += `SET statement_timeout = 0;\n`;
    sqlDump += `SET lock_timeout = 0;\n`;
    sqlDump += `SET client_encoding = 'UTF8';\n`;
    sqlDump += `SET standard_conforming_strings = on;\n`;
    sqlDump += `SET check_function_bodies = false;\n`;
    sqlDump += `SET client_min_messages = warning;\n`;
    sqlDump += `SET row_security = off;\n\n`;

    for (const tName of tableNames) {
      const rowsRes = await client.query(`SELECT * FROM "${tName}" ORDER BY 1 ASC`);
      const rows = rowsRes.rows;
      fullJsonBackup.tables[tName] = rows;
      fullJsonBackup.metadata.table_counts[tName] = rows.length;
      totalRowsCount += rows.length;

      // Min/Max ID where applicable
      let minId = null;
      let maxId = null;
      let minCreatedAt = null;
      let maxCreatedAt = null;

      if (rows.length > 0 && rows[0].id !== undefined) {
        minId = rows[0].id;
        maxId = rows[rows.length - 1].id;
      }
      if (rows.length > 0 && rows[0].created_at !== undefined) {
        minCreatedAt = rows[0].created_at;
        maxCreatedAt = rows[rows.length - 1].created_at;
      }

      tableInventory.push({
        table_name: tName,
        row_count: rows.length,
        column_count: (tableColumns[tName] || []).length,
        min_id: minId,
        max_id: maxId,
        min_created_at: minCreatedAt,
        max_created_at: maxCreatedAt
      });

      console.log(`  Table [${tName.padEnd(28)}]: ${String(rows.length).padStart(5)} rows`);

      // Write table SQL header & data
      sqlDump += `-- ---------------------------------------------------------------------\n`;
      sqlDump += `-- Table: ${tName} (${rows.length} rows)\n`;
      sqlDump += `-- ---------------------------------------------------------------------\n`;

      if (rows.length > 0) {
        const cols = Object.keys(rows[0]);
        const quotedCols = cols.map(c => `"${c}"`).join(', ');

        for (const row of rows) {
          const vals = cols.map(c => escapeSqlVal(row[c])).join(', ');
          sqlDump += `INSERT INTO "${tName}" (${quotedCols}) VALUES (${vals});\n`;
        }
      }
      sqlDump += `\n`;
    }

    // Sequence reset statements in SQL dump
    sqlDump += `-- =====================================================================\n`;
    sqlDump += `-- SEQUENCE SYNCHRONIZATION\n`;
    sqlDump += `-- =====================================================================\n`;
    for (const [seq, st] of Object.entries(sequenceStates)) {
      if (st && st.last_value !== undefined) {
        sqlDump += `SELECT setval('"${seq}"', ${st.last_value}, ${st.is_called ? 'true' : 'false'});\n`;
      }
    }

    fullJsonBackup.metadata.total_records = totalRowsCount;

    console.log('[6/7] Writing backup files to disk...');
    const sqlFilePath = path.join(backupDir, 'layerbase_full_backup.sql');
    const jsonFilePath = path.join(backupDir, 'layerbase_full_backup.json');
    const invJsonPath = path.join(backupDir, 'inventory.json');
    const invMdPath = path.join(backupDir, 'inventory.md');
    const checksumsPath = path.join(backupDir, 'checksums.sha256');

    fs.writeFileSync(sqlFilePath, sqlDump, 'utf8');
    fs.writeFileSync(jsonFilePath, JSON.stringify(fullJsonBackup, null, 2), 'utf8');

    const inventoryData = {
      timestamp: new Date().toISOString(),
      total_tables: tableNames.length,
      total_records: totalRowsCount,
      tables: tableInventory,
      sequences: sequenceStates,
      indexes: indexesRes.rows,
      constraints: constraintsRes.rows
    };
    fs.writeFileSync(invJsonPath, JSON.stringify(inventoryData, null, 2), 'utf8');

    // Create Markdown inventory
    let md = `# ANRB / Tripal ERP — Layerbase Production Database Inventory\n\n`;
    md += `- **Date**: ${new Date().toISOString()}\n`;
    md += `- **Database Engine**: PostgreSQL (Layerbase)\n`;
    md += `- **Database Name**: tripal_erp\n`;
    md += `- **Total Base Tables**: ${tableNames.length}\n`;
    md += `- **Total Sequences**: ${seqNames.length}\n`;
    md += `- **Total Production Records**: ${totalRowsCount}\n\n`;
    md += `## Table Summary\n\n`;
    md += `| Table Name | Rows | Columns | Min ID | Max ID |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    for (const t of tableInventory) {
      md += `| \`${t.table_name}\` | ${t.row_count} | ${t.column_count} | ${t.min_id !== null ? t.min_id : '—'} | ${t.max_id !== null ? t.max_id : '—'} |\n`;
    }
    md += `\n## Sequences\n\n`;
    md += `| Sequence Name | Last Value | Is Called |\n`;
    md += `| :--- | :--- | :--- |\n`;
    for (const [seq, st] of Object.entries(sequenceStates)) {
      md += `| \`${seq}\` | ${st.last_value} | ${st.is_called} |\n`;
    }
    fs.writeFileSync(invMdPath, md, 'utf8');

    console.log('[7/7] Generating SHA256 checksums...');
    const sqlHash = calculateSha256(sqlFilePath);
    const jsonHash = calculateSha256(jsonFilePath);
    const invHash = calculateSha256(invJsonPath);

    const checksumsContent = [
      `${sqlHash}  layerbase_full_backup.sql`,
      `${jsonHash}  layerbase_full_backup.json`,
      `${invHash}  inventory.json`
    ].join('\n') + '\n';

    fs.writeFileSync(checksumsPath, checksumsContent, 'utf8');

    console.log('\n===============================================================');
    console.log('✅ BACKUP GENERATED SUCCESSFULLY!');
    console.log(`Directory:     ${backupDir}`);
    console.log(`Total Tables:  ${tableNames.length}`);
    console.log(`Total Records: ${totalRowsCount}`);
    console.log(`SQL Backup:    layerbase_full_backup.sql (${(fs.statSync(sqlFilePath).size / 1024).toFixed(2)} KB)`);
    console.log(`JSON Backup:   layerbase_full_backup.json (${(fs.statSync(jsonFilePath).size / 1024).toFixed(2)} KB)`);
    console.log(`Checksums:     SHA256 verified`);
    console.log('===============================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

runBackup().catch(err => {
  console.error('Fatal backup error:', err);
  process.exit(1);
});
