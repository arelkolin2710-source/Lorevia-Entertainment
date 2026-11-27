// POST /api/pay-create  {idToken, artistId}  -> membuat tagihan QRIS di Midtrans; langganan diaktifkan OTOMATIS oleh /api/pay-webhook saat pembayaran terdeteksi.
const { getDoc, setDoc, verifyIdToken } = require('./_fb');
const PRICE = 10000;
module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end(JSON.stringify({ error: 'POST saja' }));
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) return res.status(503).end(JSON.stringify({ error: 'gateway', message: 'Pembayaran otomatis belum diaktifkan oleh admin (MIDTRANS_SERVER_KEY belum diisi).' }));
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const artistId = String(b.artistId || '').slice(0, 80); if (!artistId) throw new Error('artistId kosong');
    const u = await verifyIdToken(String(b.idToken || ''));
    const order = ('LV' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase();
    const prod = process.env.MIDTRANS_PRODUCTION === '1';
    const r = await fetch((prod ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com') + '/v2/charge', {
      method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', authorization: 'Basic ' + Buffer.from(key + ':').toString('base64') },
      body: JSON.stringify({ payment_type: 'qris', transaction_details: { order_id: order, gross_amount: PRICE }, qris: { acquirer: 'gopay' }, item_details: [{ id: artistId, price: PRICE, quantity: 1, name: 'Langganan chat & call 30 hari' }], custom_expiry: { expiry_duration: 15, unit: 'minute' } })
    });
    const j = await r.json();
    if (!j.qr_string) throw new Error('Midtrans: ' + (j.status_message || JSON.stringify(j).slice(0, 140)));
    await setDoc('verseOrders', order, { order, uid: u.uid, name: u.name.slice(0, 60), artistId, amount: PRICE, status: 'pending', ts: Date.now() });
    res.status(200).end(JSON.stringify({ order, qr: j.qr_string, expires: Date.now() + 15 * 60000 }));
  } catch (e) { res.status(500).end(JSON.stringify({ error: 'fail', message: String(e.message || e).slice(0, 200) })); }
};
