# Website Peta Rekomendasi Coffee Shop Bandung

React 18 + Vite + Leaflet (react-leaflet). Situs statis: semua perhitungan berat dilakukan di
notebook `../notebook_rekomendasi/rekomendasi_v2.ipynb`, yang menulis data ke `public/data/`.
Logika rekomendasi interaktif (KNN radius, jarak haversine) berjalan di browser (`src/lib.js`).

## Menjalankan

```bash
npm install
cp .env.example .env      # lalu isi GEMINI_API_KEY (gratis: https://aistudio.google.com/apikey)
npm run dev               # website http://localhost:5173 + server chatbot (port 8787) sekaligus
npm test                  # uji unit (vitest)
npm start                 # mode produksi: build lalu server menyajikan website + chatbot di http://localhost:8787
```

Tanpa API key, website tetap berjalan; hanya chatbot dan "ringkasan AI" di laporan yang nonaktif.
`npm run dev:web` menjalankan website saja (tanpa server chatbot).

Kalau notebook dijalankan ulang, data di `public/data/` ikut diperbarui; cukup refresh browser.

## Fitur

| Halaman | Fitur |
|---|---|
| Peta Rekomendasi | pilih algoritma (K-Means / HDBSCAN); warnai sel menurut jenis kawasan, nomor cluster, atau nilai salah satu dari 14 fitur; lapisan coffee shop, kampus, sekolah, perkantoran, pusat perbelanjaan, batas kecamatan; filter kecamatan; klik lokasi → jenis kawasan, indeks, nilai fitur + persentil, 3 coffee shop terdekat, 5 sel kawasan potensial terbaik dalam radius (0,5–5 km) |
| K-Means vs HDBSCAN | tabel metrik (silhouette, DBI, CH, noise, koherensi spasial, ARI, AUC hold-out, AUC temporal), ablation set fitur, profil cluster, tabel kesepakatan |
| Analisis & Laporan | atur target pasar, toleransi kompetisi, segmen harga, tipe usaha, penjualan/hari, sewa → peringkat 30 kecamatan + alasan, peta skor, perkiraan revenue, laba, modal awal, balik modal; tombol **Buat laporan (PDF)** dan **Minta analisis AI** |
| Chatbot (semua halaman) | tombol 🤖 di kanan bawah; Gemini menjawab berdasarkan preferensi, peringkat, asumsi biaya, dan lokasi yang diklik di peta |
| Data & Metode | alur pipeline, sumber data & snapshot, aturan pelabelan kawasan, daftar fitur, parameter, waktu proses, keterbatasan |

Tautan bisa dibagikan: `?titik=-6.9175,107.6191&alg=hdb` membuka lokasi tertentu, `#banding` / `#metode` membuka tab.

## Struktur

```
src/lib.js                         logika murni (rekomendasi, jarak, kuantil) + label fitur
src/bisnis.js                      peringkat kecamatan + perkiraan revenue/modal; SEMUA ASUMSI BIAYA ada di sini
src/ai.js                          panggilan chatbot + penyusun konteks data untuk AI
server/server.js, server/prompt.js server proxy Gemini (API key di .env) + instruksi sistem chatbot
src/components/AnalisisPage.jsx    preferensi, peringkat, rincian finansial
src/components/Laporan.jsx         dokumen laporan (cetak / simpan PDF)
src/components/ChatPanel.jsx       jendela chat
src/lib.test.js                    uji unit
src/App.jsx                        memuat data, navigasi tab
src/components/PetaPage.jsx        peta & kontrol
src/components/PanelDetail.jsx     panel detail lokasi & rekomendasi
src/components/PerbandinganPage.jsx
src/components/MetodePage.jsx
public/data/                       keluaran notebook (grid.geojson, coffee_shop.json, fasilitas.json, kecamatan.geojson, kecamatan_stat.json, meta.json)
```

Peta dasar: OpenStreetMap standard tiles (wajib mencantumkan atribusi; untuk trafik besar gunakan penyedia tile sendiri).
