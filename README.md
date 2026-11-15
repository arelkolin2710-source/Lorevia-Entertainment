# Lorevia Entertainment — multi-halaman + database Firebase

## Database (Firebase Firestore)

Project: `lorevia-entertainment-b005f`. Konfigurasi ada di `assets/js/firebase-db.js`.

**Setup satu kali di Firebase Console:**
1. Build → Firestore Database → *Create database* (pilih lokasi, mis. `asia-southeast2` Jakarta).
2. Tab *Rules* → tempel isi file `firestore.rules` → *Publish*.
3. Buka situs sekali. Database kosong otomatis terisi data awal (dan data dari cache browser
   itu kalau ada). Setelah itu semua perubahan admin & kiriman pengunjung tersimpan di Firestore.

**Struktur data**
- Satu item = satu dokumen di koleksi bernama sama: `announcements`, `achievements`, `adminStructure`,
  `members`, `managementList`, `traineeSubmissions`, `managementSubmissions`, `guestBoxes`, `products`,
  `orders`, `promos`, `videoPlaylists`, `audioPlaylists`, `videos`, `audios`.
- Pengaturan umum (nama generasi, buka/tutup pendaftaran, tanggal pengumuman hasil) ada di `settings/main`.
- Urutan item disimpan di field `_order`.
- Data pendaftar (`traineeSubmissions`, `managementSubmissions`) dan `orders` hanya dimuat di halaman
  yang memerlukannya (cek-hasil / dasbor admin).
- Foto, video, dan audio tetap diunggah ke Google Drive lewat Apps Script (`assets/js/api.js`);
  Firestore hanya menyimpan link-nya (batas 1 MiB per dokumen).
- Kalau Firestore tidak terjangkau, situs memakai cache browser, dan dasbor admin menampilkan peringatan merah.
- Memindahkan data lama dari localStorage browser tertentu: buka situs di browser itu, buka Console, jalankan
  `loreviaDbImportLocal()`.

## Form pendaftaran yang bisa diatur admin

Dasbor Admin → tab **Form Pendaftaran**, terpisah untuk Trainee dan management:
- **Divisi**: diketik manual, masing-masing punya **slot** (0 = tanpa batas). Divisi penuh tidak bisa dipilih;
  pendaftar yang ditolak tidak memakai slot.
- **Kolom**: teks singkat, paragraf, tanggal, angka, pilihan (dropdown), kotak centang (banyak opsi atau satu
  persetujuan), dan unggah file (pilih jenis: gambar/audio/video/PDF). Tiap kolom bisa **wajib** atau **opsional**,
  diurutkan, diberi keterangan, dan dibatasi hanya tampil untuk divisi tertentu.
- Kolom Nama Panjang, Nama Panggung, Tanggal Lahir, dan Divisi adalah kolom sistem (dipakai Cek Hasil), tidak bisa dihapus.
- File unggahan disimpan langsung di Firestore, jadi kecil: maks. 480 KB per file (gambar otomatis diperkecil).
- Tersimpan di koleksi `forms` (format) dan `slotUsage` (pemakaian slot).

## Akses admin (tanpa sandi)

Buka `situs.com/#loreviaadmin` → langsung masuk dasbor admin. Tombol "Keluar Admin" mengakhiri sesi.
`admin-dashboard.html` yang dibuka tanpa alamat itu diarahkan ke beranda.
Siapa pun yang tahu alamat ini bisa mengubah data situs.

## Ikon

Semua emoji diganti ikon SVG dari sprite `assets/icons/sprite.svg` (Material Design Icons).
`assets/js/icons.js` mengubah emoji yang muncul dari JavaScript menjadi ikon juga. Ikon baru: tambahkan
`<symbol>` di sprite dan pasangannya di `MAP` pada `icons.js`.

## Halaman & berkas bersama

Satu file HTML per halaman (`index.html`, `gen-members.html`, `pendaftaran-trainee.html`, ... `admin-dashboard.html`).
- `assets/css/theme.css`, `style.css` — CSS.
- `assets/js/images.js` — gambar base64 (logo, poster, QR).
- `assets/js/data.js` — data awal + cache `appData`.
- `assets/js/firebase-db.js` — sinkronisasi Firestore.
- `assets/js/core.js` — fungsi bersama (tema, navigasi, keranjang, playlist, handler admin).
- `assets/js/pages/<halaman>.js` — `renderView()` per halaman.

Buka lewat hosting atau server lokal (`python3 -m http.server`), bukan langsung dari file.
