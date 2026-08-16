// scratch/test-bin-receipt.js
const http = require('http');

function req(method, path, data, cookie) {
  return new Promise((resolve, reject) => {
    const bodyStr = data ? JSON.stringify(data) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    if (cookie) headers['Cookie'] = cookie;

    const r = http.request({ hostname: 'localhost', port: 3000, path, method, headers }, (res) => {
      let text = '';
      res.on('data', chunk => text += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(text), rawCookie: res.headers['set-cookie'] });
        } catch {
          resolve({ status: res.statusCode, body: text, rawCookie: res.headers['set-cookie'] });
        }
      });
    });
    r.on('error', reject);
    if (data) r.write(bodyStr);
    r.end();
  });
}

async function debug() {
  const adminLogin = await req('POST', '/api/auth/login', { email: 'superadmin@enmar.bd', password: 'SuperAdmin123!' });
  const adminCookie = (adminLogin.rawCookie && adminLogin.rawCookie[0]) ? adminLogin.rawCookie[0].split(';')[0] : '';

  console.log('1. Testing product creation & deletion into bin...');
  const newProd = await req('POST', '/api/admin/products', {
    name: 'Bin Test Apples',
    farm: 'Rajshahi Orchard',
    price: 250,
    unit: 'kg',
    cat: 'Fruits',
    tag: 'Test'
  }, adminCookie);
  console.log('Product created:', newProd.status, newProd.body);

  const delRes = await req('DELETE', `/api/admin/products/${newProd.body.id}`, null, adminCookie);
  console.log('Delete product response:', delRes.status, delRes.body);

  const binRes = await req('GET', '/api/admin/bin', null, adminCookie);
  console.log('Bin response:', binRes.status, binRes.body);

  console.log('\n2. Testing order & receipt...');
  const orders = await req('GET', '/api/admin/orders', null, adminCookie);
  if (orders.body && orders.body.length) {
    const lastOrder = orders.body[0];
    console.log('Last order from admin:', lastOrder.id, 'items:', lastOrder.items);
    const receipt = await req('GET', `/api/orders/${lastOrder.id}/receipt`, null, adminCookie);
    console.log('Receipt response:', receipt.status, 'order items:', receipt.body && receipt.body.order && receipt.body.order.items);
  }
}

debug().catch(console.error);
