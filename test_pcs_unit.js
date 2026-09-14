const http = require('http');

const body = JSON.stringify({ name: 'Test Rope PCS', category: 'Other', unit: 'PCS', minStockAlert: 500, hsnCode: '5607', gstPercent: 18 });
const opts = { hostname: 'localhost', port: 5000, path: '/api/masters/raw-materials', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };

const req = http.request(opts, res => {
  let d = '';
  res.on('data', chunk => d += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const parsed = JSON.parse(d);
    console.log('Response:', JSON.stringify(parsed, null, 2));
    if (parsed.unit === 'PCS') console.log('✅ PCS unit saved and returned correctly!');
    else console.log('❌ Unit mismatch:', parsed.unit);

    // Cleanup: delete this test record
    const del = http.request({ hostname: 'localhost', port: 5000, path: '/api/masters/raw-materials/' + parsed.id, method: 'DELETE' }, r2 => {
      let d2 = ''; r2.on('data', c => d2 += c); r2.on('end', () => { console.log('Cleanup delete:', r2.statusCode, d2); });
    });
    del.end();
  });
});
req.on('error', e => console.error('Error:', e.message));
req.write(body);
req.end();
