const fs = require('fs');
const code = fs.readFileSync('server/index.sqlite.backup.js', 'utf8');
const regex = /db\.prepare\(\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|[a-zA-Z0-9_]+)\s*\)\.(all|get|run)\(/g;
const matches = code.match(regex) || [];
console.log('Matches found with exact SQL literal regex:', matches.length);

const handleRegex = /\b(update|insertItem|insertMov|insertOutput|insertFGMovement|getItems|getOutputs|getConsumed|getPurItems|getProdOutputs|getSaleItems)\.(run|all|get)\(/g;
const handleMatches = code.match(handleRegex) || [];
console.log('Handle matches found:', handleMatches.length);
