'use strict';
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.resolve(__dirname, '../server/index.js'), 'utf8');
const lines = code.split('\n');

console.log('=== ALL REGISTERED ROUTES IN server/index.js ===');
const routeRegex = /app\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/g;

let match;
const routes = [];
while ((match = routeRegex.exec(code)) !== null) {
  const lineNum = code.substring(0, match.index).split('\n').length;
  routes.push({ line: lineNum, method: match[1].toUpperCase(), path: match[2] });
}

routes.forEach(r => {
  console.log(`Line ${String(r.line).padStart(4)}: ${r.method.padEnd(6)} ${r.path}`);
});
