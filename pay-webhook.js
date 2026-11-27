// POST /api/pay-webhook  (URL ini ditempel di Midtrans Dashboard > Settings > Payment > Notification URL)
// Memverifikasi tanda tangan Midtrans, memastikan nominal, lalu MENGAKTIFKAN / MEMPERPANJANG langganan secara otomatis.
const crypto = require('crypto');
const { getDoc, setDoc } = require('./_fb');
const DAY = 86400000;
module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  try {
    const key = process.env.MIDTRANS_SERVER_KEY; if (!key) return res.status(503).end('{}');
    const n = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const sig = crypto.createHash('sha512').update(String(n.order_id) + String(n.status_code) + String(n.gross_amount) + key).digest('hex');
    if (sig !== n.signature_key) return res.status(403).end(JSON.stringify({ error: 'signature' }));
    const ord = await getDoc('verseOrders', n.order_id);
    if (!ord) return res.status(404).end(JSON.stringify({ error: 'order' }));
    const ok = (n.transaction_status === 'settlement' || n.transaction_status === 'capture') && (!n.fraud_status || n.fraud_status === 'accept');
    if (!ok) { if (['expire', 'cancel', 'deny'].indexOf(n.transaction_status) >= 0 && ord.status === 'pending') { ord.status = n.transaction_status; await setDoc('verseOrders', n.order_id, ord); } return res.status(200).end('{}'); }
    if (ord.status === 'paid') return res.status(200).end('{}');
    if (Math.round(Number(n.gross_amount)) !== ord.amount) return res.status(400).end(JSON.stringify({ error: 'amount' }));
    const id = ord.uid + '_' + ord.artistId, old = await getDoc('verseSubs', id), now = Date.now(), base = old && old.end > now ? old.end : now;
    const doc = { uid: ord.uid, artistId: ord.artistId, groupId: old ? old.groupId || '' : '', name: old ? old.name : ord.name, amount: ord.amount, n: (old ? old.n || 0 : 0) + 1, first: old ? old.first || now : now, end: base + 30 * DAY, ts: now, last: ord.order };
    if (old && old.av) doc.av = old.av;
    await setDoc('verseSubs', id, doc);
    ord.status = 'paid'; ord.paidAt = now; await setDoc('verseOrders', n.order_id, ord);
    res.status(200).end('{}');
  } catch (e) { res.status(500).end(JSON.stringify({ error: String(e.message || e).slice(0, 200) })); }
};
