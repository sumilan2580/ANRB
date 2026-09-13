const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../server/index.js');
const content = fs.readFileSync(filePath, 'utf8');

console.log('Total length:', content.length);
console.log('Total lines:', content.split('\n').length);

const routes = content.match(/app\.(get|post|put|delete|patch)\([^)]+,\s*(requireAdmin,\s*)?\((req,\s*res|req,\s*res,\s*next)\)\s*=>/g) || [];
console.log('Routes matched:', routes.length);

const prepares = content.match(/db\.prepare\(/g) || [];
console.log('db.prepare calls:', prepares.length);

const runTx = content.match(/runTransaction\(/g) || [];
console.log('runTransaction calls:', runTx.length);

const nextCode = content.match(/getNextCode\(/g) || [];
console.log('getNextCode calls:', nextCode.length);

const rmStock = content.match(/getRawMaterialStock\(/g) || [];
console.log('getRawMaterialStock calls:', rmStock.length);

const fgStock = content.match(/getFinishedGoodStock\(/g) || [];
console.log('getFinishedGoodStock calls:', fgStock.length);

const userToken = content.match(/getUserByToken\(/g) || [];
console.log('getUserByToken calls:', userToken.length);

const mgrToken = content.match(/getManagerByToken\(/g) || [];
console.log('getManagerByToken calls:', mgrToken.length);
