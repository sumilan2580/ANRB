'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function checkHash(file, expected) {
  const content = fs.readFileSync(file);
  const actual = crypto.createHash('sha256').update(content).digest('hex');
  return { match: actual === expected, actual };
}

async function verifyBackup() {
  const backupDir = path.resolve(__dirname, '../backups/anrb_layerbase_production_backup');
  const checksumFile = path.join(backupDir, 'checksums.sha256');

  if (!fs.existsSync(checksumFile)) {
    throw new Error('checksums.sha256 missing!');
  }

  const lines = fs.readFileSync(checksumFile, 'utf8').trim().split('\n');
  console.log('Verifying SHA256 checksums...');
  for (const line of lines) {
    const [expectedHash, fileName] = line.trim().split(/\s+/);
    const targetFile = path.join(backupDir, fileName);
    const result = checkHash(targetFile, expectedHash);
    if (!result.match) {
      throw new Error(`Checksum mismatch for ${fileName}! Expected ${expectedHash}, got ${result.actual}`);
    }
    console.log(`  ✅ ${fileName}: Checksum OK`);
  }

  console.log('\nVerifying JSON backup readability & structure...');
  const jsonFile = path.join(backupDir, 'layerbase_full_backup.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

  const tables = Object.keys(jsonData.tables);
  console.log(`  JSON tables: ${tables.length}`);
  console.log(`  Total records in metadata: ${jsonData.metadata.total_records}`);

  let counted = 0;
  for (const t of tables) {
    counted += jsonData.tables[t].length;
  }
  if (counted !== jsonData.metadata.total_records) {
    throw new Error(`Row count mismatch in JSON backup: metadata=${jsonData.metadata.total_records}, counted=${counted}`);
  }
  console.log(`  ✅ All ${tables.length} tables and ${counted} records in JSON parsed cleanly.`);

  console.log('\nVerifying SQL backup readability...');
  const sqlFile = path.join(backupDir, 'layerbase_full_backup.sql');
  const sqlStats = fs.statSync(sqlFile);
  if (sqlStats.size < 1000) {
    throw new Error(`SQL backup file is suspiciously small: ${sqlStats.size} bytes`);
  }
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');
  const insertCount = (sqlContent.match(/INSERT INTO/g) || []).length;
  console.log(`  SQL statements: size=${(sqlStats.size / 1024).toFixed(2)} KB, total INSERT statements=${insertCount}`);
  if (insertCount !== counted) {
    throw new Error(`SQL insert count (${insertCount}) != counted records (${counted})!`);
  }
  console.log(`  ✅ SQL backup has exact matching ${insertCount} INSERT statements.`);

  console.log('\n===============================================================');
  console.log('✅ BACKUP INTEGRITY VERIFICATION: PASSED (100% HEALTHY)');
  console.log('===============================================================');
}

verifyBackup().catch(err => {
  console.error('❌ Backup verification failed:', err.message);
  process.exit(1);
});
