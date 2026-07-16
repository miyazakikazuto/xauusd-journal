# 📓 Trading Journal XAUUSD

PWA single-page trading journal untuk XAUUSD & forex. Catat, evaluasi, disiplin.

**Live:** https://miyazakikazuto.github.io/xauusd-journal/

---

## Fitur

- **Input Trade** — form entry dengan auto-kalkulasi pips & P/L berdasarkan tipe akun (USD/USDCent/IDR)
- **Riwayat Trade** — tabel 16 kolom + filter (pair/hasil/sesi/cari) + 8 stat card
- **Multi Profile** — ganti akun Real/Demo, rename, hapus
- **Cloud Sync** — Firebase Firestore + Email/Password auth (opsional, bisa skip)
- **PWA** — install ke home screen, Service Worker Network First, auto-reload
- **Backup & Restore** — export/import JSON semua data + profile
- **Dark Theme** — GitHub-dark inspired, responsive mobile

## Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Language | Vanilla JS (single HTML file) |
| Database | localStorage + Firebase Firestore |
| Auth | Firebase Auth (Email/Password atau Anonymous) |
| PWA | manifest.json + sw.js (Network First) |
| Hosting | GitHub Pages |

## Cara Pakai

1. Buka https://miyazakikazuto.github.io/xauusd-journal/ atau jalankan `index.html` lokal
2. Buat akun (nama + mode Real/Demo + tipe USD/USDCent/IDR)
3. Mulai catat trade — isi form, simpan
4. Cek statistik & riwayat di tab Riwayat

Opsional: daftar/login via email untuk sinkronisasi cloud antar perangkat.

## Development

```bash
# Repo ini — single file
edit index.html
git add index.html && git commit -m "pesan" && git push origin main
# GitHub Pages auto-deploy
```

Service Worker cache version diubah manual di `sw.js` (line `CACHE_NAME = 'xauusd-journal-v3'`). Bump versi setiap deploy agar SW lama ter-update.

## Struktur File

```
xauusd-journal/
├── index.html       — seluruh aplikasi (HTML + CSS + JS)
├── sw.js            — Service Worker
├── manifest.json    — PWA manifest
├── icon.svg         — App icon 512x512 SVG
└── README.md        — file ini
```
