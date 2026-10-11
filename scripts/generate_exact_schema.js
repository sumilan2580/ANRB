'use strict';

/**
 * Generates exact DDL script for all 33 tables from Layerbase PostgreSQL
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function generateSchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();

  try {
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map(r => r.table_name);

    let ddl = `-- =====================================================================\n`;
    ddl += `-- ANRB / TRIPAL ERP — EXACT REPLICATED PRODUCTION SCHEMA FOR NEON\n`;
    ddl += `-- Generated from Layerbase PostgreSQL: ${new Date().toISOString()}\n`;
    ddl += `-- =====================================================================\n\n`;

    // 1. Tables and Columns
    for (const tableName of tables) {
      ddl += `-- ---------------------------------------------------------------------\n`;
      ddl += `-- Table: ${tableName}\n`;
      ddl += `-- ---------------------------------------------------------------------\n`;
      ddl += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;

      const colsRes = await client.query(`
        SELECT 
          column_name,
          data_type,
          udt_name,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      const colDefs = [];
      for (const col of colsRes.rows) {
        let typeStr = col.udt_name;
        if (col.data_type === 'character varying') {
          typeStr = col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : 'VARCHAR';
        } else if (col.data_type === 'character') {
          typeStr = `CHAR(${col.character_maximum_length})`;
        } else if (col.data_type === 'numeric') {
          typeStr = col.numeric_precision ? `NUMERIC(${col.numeric_precision},${col.numeric_scale || 0})` : 'NUMERIC';
        } else if (col.data_type === 'integer') {
          typeStr = 'INTEGER';
        } else if (col.data_type === 'bigint') {
          typeStr = 'BIGINT';
        } else if (col.data_type === 'smallint') {
          typeStr = 'SMALLINT';
        } else if (col.data_type === 'text') {
          typeStr = 'TEXT';
        } else if (col.data_type === 'boolean') {
          typeStr = 'BOOLEAN';
        } else if (col.data_type === 'timestamp without time zone') {
          typeStr = 'TIMESTAMP';
        } else if (col.data_type === 'timestamp with time zone') {
          typeStr = 'TIMESTAMPTZ';
        } else if (col.data_type === 'date') {
          typeStr = 'DATE';
        } else if (col.data_type === 'json') {
          typeStr = 'JSON';
        } else if (col.data_type === 'jsonb') {
          typeStr = 'JSONB';
        }

        // Check if column default is a sequence (SERIAL)
        let defStr = '';
        if (col.column_default) {
          if (col.column_default.includes('nextval(')) {
            if (col.data_type === 'integer') {
              typeStr = 'SERIAL';
            } else if (col.data_type === 'bigint') {
              typeStr = 'BIGSERIAL';
            }
          } else {
            defStr = ` DEFAULT ${col.column_default}`;
          }
        }

        const nullStr = col.is_nullable === 'NO' ? ' NOT NULL' : '';
        colDefs.push(`    "${col.column_name}" ${typeStr}${defStr}${nullStr}`);
      }

      ddl += colDefs.join(',\n') + '\n);\n\n';
    }

    // 2. Primary Keys
    ddl += `-- =====================================================================\n`;
    ddl += `-- PRIMARY KEYS\n`;
    ddl += `-- =====================================================================\n`;
    const pkRes = await client.query(`
      SELECT tc.table_name, tc.constraint_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY tc.table_name;
    `);
    for (const pk of pkRes.rows) {
      ddl += `DO $$ BEGIN\n`;
      ddl += `  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${pk.constraint_name}') THEN\n`;
      ddl += `    ALTER TABLE "${pk.table_name}" ADD CONSTRAINT "${pk.constraint_name}" PRIMARY KEY ("${pk.column_name}");\n`;
      ddl += `  END IF;\n`;
      ddl += `END $$;\n`;
    }
    ddl += `\n`;

    // 3. Unique Constraints
    ddl += `-- =====================================================================\n`;
    ddl += `-- UNIQUE CONSTRAINTS\n`;
    ddl += `-- =====================================================================\n`;
    const uqRes = await client.query(`
      SELECT tc.table_name, tc.constraint_name, string_agg(quote_ident(kcu.column_name), ', ') AS cols
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'UNIQUE'
      GROUP BY tc.table_name, tc.constraint_name
      ORDER BY tc.table_name;
    `);
    for (const uq of uqRes.rows) {
      ddl += `DO $$ BEGIN\n`;
      ddl += `  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${uq.constraint_name}') THEN\n`;
      ddl += `    ALTER TABLE "${uq.table_name}" ADD CONSTRAINT "${uq.constraint_name}" UNIQUE (${uq.cols});\n`;
      ddl += `  END IF;\n`;
      ddl += `END $$;\n`;
    }
    ddl += `\n`;

    // 4. Check Constraints
    ddl += `-- =====================================================================\n`;
    ddl += `-- CHECK CONSTRAINTS\n`;
    ddl += `-- =====================================================================\n`;
    const checkRes = await client.query(`
      SELECT tc.table_name, tc.constraint_name, pg_get_constraintdef(c.oid) as def
      FROM information_schema.table_constraints tc
      JOIN pg_constraint c ON c.conname = tc.constraint_name
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'CHECK'
        AND tc.constraint_name NOT LIKE '%_not_null'
      ORDER BY tc.table_name;
    `);
    for (const ck of checkRes.rows) {
      ddl += `DO $$ BEGIN\n`;
      ddl += `  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${ck.constraint_name}') THEN\n`;
      ddl += `    ALTER TABLE "${ck.table_name}" ADD CONSTRAINT "${ck.constraint_name}" ${ck.def};\n`;
      ddl += `  END IF;\n`;
      ddl += `END $$;\n`;
    }
    ddl += `\n`;

    // 5. Indexes
    ddl += `-- =====================================================================\n`;
    ddl += `-- INDEXES\n`;
    ddl += `-- =====================================================================\n`;
    const idxRes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname;
    `);
    for (const idx of idxRes.rows) {
      // Convert CREATE UNIQUE INDEX or CREATE INDEX to CREATE ... IF NOT EXISTS
      let idef = idx.indexdef;
      if (!idef.includes('IF NOT EXISTS')) {
        idef = idef.replace(/CREATE (UNIQUE )?INDEX/i, (m, u) => `CREATE ${u || ''}INDEX IF NOT EXISTS`);
      }
      ddl += `${idef};\n`;
    }
    ddl += `\n`;

    // 6. Foreign Keys (Deferred until data is loaded or created as separate script)
    ddl += `-- =====================================================================\n`;
    ddl += `-- FOREIGN KEYS\n`;
    ddl += `-- =====================================================================\n`;
    const fkRes = await client.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        pg_get_constraintdef(c.oid) AS fk_def
      FROM information_schema.table_constraints tc
      JOIN pg_constraint c ON c.conname = tc.constraint_name
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name;
    `);
    for (const fk of fkRes.rows) {
      ddl += `DO $$ BEGIN\n`;
      ddl += `  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${fk.constraint_name}') THEN\n`;
      ddl += `    ALTER TABLE "${fk.table_name}" ADD CONSTRAINT "${fk.constraint_name}" ${fk.fk_def};\n`;
      ddl += `  END IF;\n`;
      ddl += `END $$;\n`;
    }

    const outPath = path.resolve(__dirname, 'neon_exact_schema.sql');
    fs.writeFileSync(outPath, ddl, 'utf8');
    console.log(`Saved exact schema to ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(2)} KB)`);
  } finally {
    client.release();
    await pool.end();
  }
}

generateSchema().catch(console.error);
