// Pembantu server: Firebase (verifikasi token + tulis Firestore lewat REST dengan service account). Tanpa dependensi.
const crypto = require('crypto');
const API_KEY = 'AIzaSyDXI2HMcgGeeP7zimGg9RhylGmGajWPXv8';
const PROJECT = 'lorevia-entertainment-b005f';
let tokCache = { t: '', exp: 0 };
const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
function sa() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT belum diisi di Vercel.');
  const j = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  j.private_key = String(j.private_key).replace(/\\n/g, '\n'); return j;
}
async function accessToken() {
  if (tokCache.t && tokCache.exp > Date.now() + 60000) return tokCache.t;
  const k = sa(), now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({ iss: k.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + claim).sign(k.private_key);
  const jwt = head + '.' + claim + '.' + b64u(sig);
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt });
  const j = await r.json(); if (!j.access_token) throw new Error('Token service account gagal: ' + JSON.stringify(j).slice(0, 160));
  tokCache = { t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 }; return tokCache.t;
}
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  const f = {}; Object.keys(v).forEach(k => { f[k] = enc(v[k]); }); return { mapValue: { fields: f } };
}
function dec(x) {
  if ('stringValue' in x) return x.stringValue; if ('integerValue' in x) return Number(x.integerValue); if ('doubleValue' in x) return x.doubleValue;
  if ('booleanValue' in x) return x.booleanValue; if ('nullValue' in x) return null;
  if ('arrayValue' in x) return (x.arrayValue.values || []).map(dec);
  if ('mapValue' in x) { const o = {}; const f = x.mapValue.fields || {}; Object.keys(f).forEach(k => { o[k] = dec(f[k]); }); return o; } return null;
}
const docUrl = (c, id) => 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/' + c + '/' + encodeURIComponent(id);
async function getDoc(c, id) {
  const r = await fetch(docUrl(c, id), { headers: { authorization: 'Bearer ' + await accessToken() } });
  if (r.status === 404) return null; const j = await r.json(); if (!j.fields) throw new Error('Baca Firestore gagal: ' + JSON.stringify(j).slice(0, 160));
  const o = {}; Object.keys(j.fields).forEach(k => { o[k] = dec(j.fields[k]); }); return o;
}
async function setDoc(c, id, data) {
  const f = {}; Object.keys(data).forEach(k => { f[k] = enc(data[k]); });
  const r = await fetch(docUrl(c, id), { method: 'PATCH', headers: { authorization: 'Bearer ' + await accessToken(), 'content-type': 'application/json' }, body: JSON.stringify({ fields: f }) });
  if (!r.ok) throw new Error('Tulis Firestore gagal: ' + (await r.text()).slice(0, 200));
}
async function verifyIdToken(idToken) {
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + API_KEY, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken }) });
  const j = await r.json(); const u = j && j.users && j.users[0]; if (!u) throw new Error('Sesi login tidak valid.');
  return { uid: u.localId, name: u.displayName || '' };
}
module.exports = { getDoc, setDoc, verifyIdToken };
