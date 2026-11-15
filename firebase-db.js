// Database Lorevia di Firebase Firestore.
//
// Cara kerja singkat:
//  - Data situs (appData) tetap dipakai persis seperti sebelumnya oleh semua halaman.
//  - Saat halaman dibuka, data dimuat dari Firestore. Setiap kali kode memanggil saveAppData(),
//    perubahan (dokumen baru / berubah / dihapus) otomatis dikirim ke Firestore.
//  - Setiap item daftar (member, produk, video, dst.) = satu dokumen di koleksi bernama sama.
//    Pengaturan umum (nama generasi, buka/tutup pendaftaran, dst.) = dokumen settings/main.
//  - File besar (foto, video, audio) tetap diunggah ke Google Drive lewat Apps Script (api.js);
//    Firestore hanya menyimpan link-nya, karena batas satu dokumen Firestore adalah 1 MiB.
//  - Kalau Firestore tidak bisa dihubungi, situs tetap jalan memakai cache di browser.

(function () {
    const SDK_BASE = 'https://www.gstatic.com/firebasejs/13.3.0/';

    const firebaseConfig = {
        apiKey: "AIzaSyDXI2HMcgGeeP7zimGg9RhylGmGajWPXv8",
        authDomain: "lorevia-entertainment-b005f.firebaseapp.com",
        projectId: "lorevia-entertainment-b005f",
        storageBucket: "lorevia-entertainment-b005f.firebasestorage.app",
        messagingSenderId: "141614178577",
        appId: "1:141614178577:web:98c108507304e8315d2cb0",
        measurementId: "G-6LQZS4Q3YW"
    };

    // Koleksi berisi daftar item. Nama koleksi = nama kunci di appData.
    const ARRAY_KEYS = [
        'announcements', 'achievements', 'adminStructure', 'members', 'managementList',
        'traineeSubmissions', 'managementSubmissions', 'guestBoxes', 'products', 'orders',
        'promos', 'videoPlaylists', 'audioPlaylists', 'videos', 'audios', 'forms', 'slotUsage'
    ];
    // Pengaturan umum, disimpan di satu dokumen settings/main.
    const SETTING_KEYS = ['genLabel', 'registrationOpen', 'resultsAnnounceDate'];

    // Data pendaftar & pesanan hanya dimuat di halaman yang memerlukannya
    // (hemat kuota baca Firestore, dan tidak diunduh ke setiap pengunjung).
    const PAGE_ONLY = {
        traineeSubmissions: ['cek-hasil', 'admin-dashboard'],
        managementSubmissions: ['cek-hasil', 'admin-dashboard'],
        orders: ['admin-dashboard']
    };

    const MAX_DATA_URI = 850000;   // data-URI di atas ini (karakter) tidak ikut disimpan ke Firestore (batas dokumen 1 MiB)
    const DEBOUNCE_MS = 200;

    const status = window.loreviaDbStatus = { ready: false, ok: false, error: null };
    const route = window.PAGE_ROUTE || 'beranda';

    let db = null, fs = null;
    const baseline = {};            // key -> Map(docId -> json) kondisi terakhir yang ada di Firestore
    let settingsBaseline = null;
    const loaded = new Set();       // koleksi yang sudah dimuat di halaman ini
    const orderMemo = {};           // key -> { docId: _order } untuk koleksi yang tidak dimuat
    let timer = null;
    let chain = Promise.resolve(true);

    // ---------- util ----------
    function strip(v, limit) {
        if (typeof v === 'string') return (v.indexOf('data:') === 0 && v.length > limit) ? '' : v;
        if (Array.isArray(v)) return v.map(x => strip(x, limit));
        if (v && typeof v === 'object') {
            const o = {};
            Object.keys(v).forEach(k => { if (v[k] !== undefined) o[k] = strip(v[k], limit); });
            return o;
        }
        return v;
    }
    window.loreviaStrip = v => strip(v, 100000);   // untuk cache localStorage (kuota kecil)

    function prepare(item) {
        let d = strip(item, MAX_DATA_URI);
        if (JSON.stringify(d).length > 900000) d = strip(item, 100000);
        return d;
    }

    function ensureId(item) {
        if (item.id === undefined || item.id === null || item.id === '') {
            item.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        }
        return String(item.id).replace(/\//g, '_');
    }

    function wantsCollection(key) {
        const pages = PAGE_ONLY[key];
        return !pages || pages.indexOf(route) !== -1;
    }

    function snapshotCollection(key, treatAsLoaded) {
        const arr = Array.isArray(appData[key]) ? appData[key] : [];
        const isLoaded = treatAsLoaded || loaded.has(key);
        const memo = orderMemo[key] || (orderMemo[key] = {});
        const out = new Map();
        arr.forEach((item, i) => {
            if (!item || typeof item !== 'object') return;
            const id = ensureId(item);
            const data = prepare(item);
            delete data._order;
            if (isLoaded) {
                data._order = i;
            } else {
                if (memo[id] === undefined) memo[id] = Date.now() + i;
                data._order = memo[id];
            }
            out.set(id, { json: JSON.stringify(data), data: data });
        });
        return out;
    }

    function settingsSnapshot() {
        const s = {};
        SETTING_KEYS.forEach(k => { if (appData[k] !== undefined) s[k] = appData[k]; });
        const data = prepare(s);
        return { json: JSON.stringify(data), data: data };
    }

    // ---------- tulis ke Firestore ----------
    async function syncNow(treatAllLoaded) {
        if (!status.ok) return false;
        try {
            const ops = [];   // { type, ref, data, apply }
            ARRAY_KEYS.forEach(key => {
                const base = baseline[key] || (baseline[key] = new Map());
                const cur = snapshotCollection(key, treatAllLoaded);
                cur.forEach((v, id) => {
                    const old = base.get(id);
                    if (old !== v.json) {
                        ops.push({ kind: 'set', ref: fs.doc(db, key, id), data: v.data,
                                   done: () => base.set(id, v.json) });
                    }
                });
                if (treatAllLoaded || loaded.has(key)) {
                    base.forEach((_, id) => {
                        if (!cur.has(id)) {
                            ops.push({ kind: 'delete', ref: fs.doc(db, key, id),
                                       done: () => base.delete(id) });
                        }
                    });
                }
            });
            const s = settingsSnapshot();
            if (s.json !== settingsBaseline) {
                ops.push({ kind: 'set', ref: fs.doc(db, 'settings', 'main'), data: s.data,
                           done: () => { settingsBaseline = s.json; } });
            }
            for (let i = 0; i < ops.length; i += 400) {
                const part = ops.slice(i, i + 400);
                const batch = fs.writeBatch(db);
                part.forEach(op => op.kind === 'set' ? batch.set(op.ref, op.data) : batch.delete(op.ref));
                await batch.commit();
                part.forEach(op => op.done());
            }
            return true;
        } catch (err) {
            status.error = err && (err.code || err.message) || String(err);
            console.error('[Lorevia DB] gagal menyimpan ke Firestore:', err);
            return false;
        }
    }

    // Jadwalkan penyimpanan (dipanggil dari saveAppData)
    window.loreviaDbSchedule = function () {
        if (!status.ok) return;
        clearTimeout(timer);
        timer = setTimeout(() => { chain = chain.then(() => syncNow(false)); }, DEBOUNCE_MS);
    };

    // Simpan sekarang juga. Mengembalikan Promise<boolean> (true = sudah tersimpan di database).
    window.loreviaDbFlush = function () {
        clearTimeout(timer);
        if (!status.ok) return Promise.resolve(false);
        chain = chain.then(() => syncNow(false));
        return chain;
    };

    // Opsional (lewat console browser): masukkan data lama dari localStorage browser ini
    // ke Firestore tanpa menimpa item yang sudah ada.
    window.loreviaDbImportLocal = async function () {
        if (!status.ok) { console.warn('Database belum terhubung.'); return false; }
        let local;
        try { local = JSON.parse(localStorage.getItem('lorevia_app_data') || 'null'); } catch (e) { local = null; }
        if (!local) { console.warn('Tidak ada data lama di browser ini.'); return false; }
        let added = 0;
        ARRAY_KEYS.forEach(key => {
            if (!wantsCollection(key) && !loaded.has(key)) return;
            const have = new Set((appData[key] || []).map(x => String(x && x.id)));
            (local[key] || []).forEach(item => {
                if (item && !have.has(String(item.id))) { appData[key].push(item); added++; }
            });
        });
        saveAppData();
        const ok = await window.loreviaDbFlush();
        console.log('[Lorevia DB] impor selesai, item ditambahkan:', added, 'tersimpan:', ok);
        return ok;
    };

    // ---------- baca dari Firestore ----------
    async function loadAll() {
        const sSnap = await fs.getDoc(fs.doc(db, 'settings', 'main'));
        const keys = ARRAY_KEYS.filter(wantsCollection);
        const snaps = await Promise.all(keys.map(k => fs.getDocs(fs.collection(db, k))));

        if (!sSnap.exists()) {
            // Pertama kali dipakai: database masih kosong -> isi dengan data yang ada
            // (cache browser kalau ada, kalau tidak data awal bawaan situs).
            status.ok = true;
            ARRAY_KEYS.forEach(k => { baseline[k] = new Map(); });
            settingsBaseline = null;
            const okSeed = await syncNow(true);
            if (!okSeed) status.ok = false;
            ARRAY_KEYS.forEach(k => { if (wantsCollection(k)) loaded.add(k); });
            return;
        }

        const s = sSnap.data() || {};
        SETTING_KEYS.forEach(k => { if (s[k] !== undefined) appData[k] = s[k]; });

        keys.forEach((key, i) => {
            const rows = [];
            snaps[i].forEach(d => { rows.push(d.data()); });
            rows.sort((a, b) => (a._order || 0) - (b._order || 0));
            rows.forEach(r => { delete r._order; });
            appData[key] = rows;
            loaded.add(key);
        });
        ARRAY_KEYS.forEach(k => { if (!loaded.has(k)) appData[k] = []; });

        if (typeof normalizeAppData === 'function') normalizeAppData();

        // Baseline = apa yang sekarang ada di Firestore (dihitung dengan fungsi yang sama
        // dengan penyimpanan, supaya hanya perubahan nyata yang dikirim).
        ARRAY_KEYS.forEach(k => { baseline[k] = loaded.has(k) ? snapshotCollection(k, false) : new Map(); });
        // snapshotCollection mengubah baseline jadi {json,data}; ambil json-nya saja
        ARRAY_KEYS.forEach(k => {
            const m = new Map();
            baseline[k].forEach((v, id) => m.set(id, v.json));
            baseline[k] = m;
        });
        settingsBaseline = settingsSnapshot().json;
        status.ok = true;
    }

    async function init() {
        try {
            const appMod = await import(SDK_BASE + 'firebase-app.js');
            fs = await import(SDK_BASE + 'firebase-firestore.js');
            const app = appMod.initializeApp(firebaseConfig);
            db = fs.getFirestore(app);
            try {
                const an = await import(SDK_BASE + 'firebase-analytics.js');
                an.getAnalytics(app);
            } catch (e) { /* analytics opsional */ }
            await loadAll();
            if (status.ok && typeof saveAppData === 'function') saveAppData(); // perbarui cache
        } catch (err) {
            status.ok = false;
            status.error = err && (err.code || err.message) || String(err);
            console.error('[Lorevia DB] tidak bisa terhubung ke Firestore, memakai cache browser:', err);
        }
        status.ready = true;
    }

    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && status.ok) window.loreviaDbFlush();
    });
    window.addEventListener('pagehide', () => { if (status.ok) window.loreviaDbFlush(); });

    window.loreviaDbReady = init();
})();
