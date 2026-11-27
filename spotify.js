// Fungsi server Vercel: membaca judul, nama artis/pencipta, dan sampul dari link Spotify (tanpa kunci API).
// Dipanggil oleh Lorevia Verse: /api/spotify?type=track&id=XXXX
const TYPES = ['track', 'album', 'playlist', 'episode', 'show', 'artist'];
function meta(html, prop) {
    const m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]*content=["\']([^"\']*)["\']', 'i'))
        || html.match(new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + prop + '["\']', 'i'));
    return m ? m[1].replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '';
}
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const type = String((req.query && req.query.type) || ''), id = String((req.query && req.query.id) || '');
    if (TYPES.indexOf(type) < 0 || !/^[A-Za-z0-9]{10,32}$/.test(id)) { res.status(400).json({ error: 'bad_request' }); return; }
    try {
        const r = await fetch('https://open.spotify.com/' + type + '/' + id, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9' } });
        const html = await r.text();
        const title = meta(html, 'og:title'), desc = meta(html, 'og:description'), cover = meta(html, 'og:image');
        const parts = desc.split(/\s*[·•]\s*/).filter(Boolean);
        let artist = '';
        if (type === 'track' || type === 'album') artist = parts[0] || '';
        else if (type === 'playlist') artist = (parts.find(x => /^by /i.test(x)) || parts[1] || '').replace(/^by /i, '');
        else if (type === 'episode' || type === 'show') artist = parts[0] || '';
        else if (type === 'artist') artist = title;
        if (!title) { res.status(404).json({ error: 'not_found' }); return; }
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
        res.status(200).json({ type, id, title, artist, cover });
    } catch (e) { res.status(502).json({ error: 'fetch_failed' }); }
};
