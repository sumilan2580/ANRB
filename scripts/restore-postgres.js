'use strict';

/**
 * TRIPAL ERP — PostgreSQL Restore Script
 *
 * Usage:
 *   npm run restore -- [backup_file_path]
 *   (or) node scripts/restore-postgres.js [backup_file_path]
 *
 * If no file path is specified, the script automatically restores from the
 * most recent backup in `backups/postgres/`.
 */

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const MIGRATION_TABLES = [
  { name: 'users',                    hasSerial: true  },
  { name: 'managers',                 hasSerial: true  },
  { name: 'raw_materials',            hasSerial: true  },
  { name: 'suppliers',                hasSerial: true  },
  { name: 'customers',                hasSerial: true  },
  { name: 'machines',                 hasSerial: true  },
  { name: 'shifts',                   hasSerial: true  },
  { name: 'finished_products',        hasSerial: true  },
  { name: 'production_orders',        hasSerial: true  },
  { name: 'consumption_batches',      hasSerial: true  },
  { name: 'consumption_batch_items',  hasSerial: true  },
  { name: 'raw_material_purchases',   hasSerial: true  },
  { name: 'purchase_items',           hasSerial: true  },
  { name: 'raw_material_movements',   hasSerial: true  },
  { name: 'production_batches',       hasSerial: true  },
  { name: 'production_outputs',       hasSerial: true  },
  { name: 'finished_goods_movements', hasSerial: true  },
  { name: 'sales',                    hasSerial: true  },
  { name: 'sales_items',              hasSerial: true  },
  { name: 'wastage_records',          hasSerial: true  },
  { name: 'payments',                 hasSerial: true  },
  { name: 'stock_adjustments',        hasSerial: true  },
  { name: 'audit_logs',               hasSerial: true  },
  { name: 'settings',                 hasSerial: false }
];

async function runRestore() {
  console.log('===============================================================');
  console.log('TRIPAL ERP — Layerbase PostgreSQL Disaster Recovery Restore');
  console.log('===============================================================\n');

  // Find target backup file
  let targetFile = process.argv[2];
  if (!targetFile) {
    const backupDir = path.resolve(__dirname, '../backups/postgres');
    if (!fs.existsSync(backupDir)) {
      console.error('❌ No backups directory found at:', backupDir);
      process.exit(1);
    }
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort();
    if (files.length === 0) {
      console.error('❌ No backup files found in:', backupDir);
      process.exit(1);
    }
    targetFile = path.join(backupDir, files[files.length - 1]);
    console.log(`[Restore] Using most recent backup file: ${path.basename(targetFile)}`);
  }

  if (!fs.existsSync(targetFile)) {
    console.error('❌ Backup file not found at:', targetFile);
    process.exit(1);
  }

  const rawData = fs.readFileSync(targetFile, 'utf8');
  const backup = JSON.parse(rawData);

  console.log(`[Restore] Loaded backup created on: ${backup.metadata?.timestamp || 'Unknown'}`);

  // Connect to PostgreSQL
  const connectionString = process.env.DATABASE_URL;
  const host = process.env.PGHOST;
  const port = parseInt(process.env.PGPORT || '5432', 10);
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const isSsl = process.env.PGSSL !== 'false' && process.env.PGSSL !== '0';

  if (!connectionString && (!host || !user || !database)) {
    console.error('❌ Layerbase PostgreSQL credentials missing in .env');
    process.exit(1);
  }

  const poolConfig = connectionString
    ? { connectionString, ssl: isSsl ? { rejectUnauthorized: false } : false }
    : { host, port, database, user, password, ssl: isSsl ? { rejectUnauthorized: false } : false };

  const pool = new Pool(poolConfig);
  const client = await pool.connect();

  try {
    // Apply schema first if needed
    const schemaSqlPath = path.resolve(__dirname, 'postgres-schema.sql');
    if (fs.existsSync(schemaSqlPath)) {
      console.log('[Restore] Ensuring schema is present...');
      await client.query(fs.readFileSync(schemaSqlPath, 'utf8'));
    }

    let restoredCount = 0;

    for (const tableConfig of MIGRATION_TABLES) {
      const tableName = tableConfig.name;
      const rows = backup.tables ? backup.tables[tableName] : null;

      if (!rows || rows.length === 0) {
        console.log(`  Table [${tableName}]: No rows to restore`);
        continue;
      }

      await client.query('BEGIN');
      try {
        const columns = Object.keys(rows[0]);
        const colList = columns.join(', ');

        for (const row of rows) {
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const values = columns.map(c => row[c]);

          let insertSql;
          if (tableName === 'settings') {
            insertSql = `
              INSERT INTO ${tableName} (${colList})
              VALUES (${placeholders})
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
            `;
          } else {
            insertSql = `
              INSERT INTO ${tableName} (${colList})
              VALUES (${placeholders})
              ON CONFLICT (id) DO UPDATE SET
              ${columns.filter(c => c !== 'id').map(c => `${c} = EXCLUDED.${c}`).join(', ')}
            `;
          }

          await client.query(insertSql, values);
          restoredCount++;
        }

        if (tableConfig.hasSerial) {
          await client.query(`
            SELECT setval(
              pg_get_serial_sequence('${tableName}', 'id'),
              COALESCE((SELECT MAX(id) FROM ${tableName}), 1)
            )
          `);
        }

        await client.query('COMMIT');
        console.log(`  Table [${tableName}]: ${rows.length} rows restored & sequence updated`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Error restoring table ${tableName}:`, err.message);
        throw err;
      }
    }

    console.log('\n===============================================================');
    console.log(`✅ RESTORE COMPLETED SUCCESSFULLY! (${restoredCount} total records restored)`);
    console.log('===============================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

runRestore().catch(err => {
  console.error('Fatal restore error:', err.message);
  process.exit(1);
});
