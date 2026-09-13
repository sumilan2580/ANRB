'use strict';
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.resolve(__dirname, '../server/index.js'), 'utf8');

console.log('=== TRIPAL ERP - SQL SYNTAX & FUNCTION SCAN ===');

// Check for common SQLite-specific functions and patterns
const patterns = [
  { name: "datetime('now')", regex: /datetime\s*\(\s*['"]now['"]/gi },
  { name: "strftime", regex: /strftime\s*\(/gi },
  { name: "group_concat", regex: /group_concat\s*\(/gi },
  { name: "last_insert_rowid", regex: /last_insert_rowid/gi },
  { name: "rowid", regex: /\browid\b/gi },
  { name: "iif(", regex: /\biif\s*\(/gi },
  { name: "instr(", regex: /\binstr\s*\(/gi },
  { name: "INSERT OR REPLACE", regex: /INSERT\s+OR\s+REPLACE/gi },
  { name: "INSERT OR IGNORE", regex: /INSERT\s+OR\s+IGNORE/gi },
  { name: "PRAGMA", regex: /PRAGMA/gi },
  { name: "COLLATE NOCASE", regex: /COLLATE\s+NOCASE/gi },
  { name: "boolean integer comparison (e.g. is_active = 1 or true)", regex: /=\s*true\b|=\s*false\b/gi },
  { name: "CURRENT_TIMESTAMP with interval", regex: /CURRENT_TIMESTAMP\s*,\s*['"][+-]/gi }
];

let totalHits = 0;
for (const p of patterns) {
  const matches = [...code.matchAll(p.regex)];
  if (matches.length > 0) {
    console.log(`[FOUND] ${p.name}: ${matches.length} occurrence(s)`);
    matches.slice(0, 5).forEach(m => {
      const lineNum = code.substring(0, m.index).split('\n').length;
      const snippet = code.substring(Math.max(0, m.index - 40), Math.min(code.length, m.index + 60)).replace(/\r?\n/g, ' ');
      console.log(`   Line ${lineNum}: ...${snippet}...`);
    });
    totalHits += matches.length;
  } else {
    console.log(`[OK] ${p.name}: 0 occurrences`);
  }
}

console.log(`\nTotal SQLite-specific pattern hits: ${totalHits}`);
