# Rekomendasi Lokasi Coffee Shop di Kota Bandung

Sistem rekomendasi lokasi usaha coffee shop berbasis data geospasial. Repositori ini berisi seluruh alur skripsi:

1. Mengumpulkan data coffee shop dari Open Data Kota Bandung dan OpenStreetMap.
2. Membentuk fitur spasial dengan **KDE** dan **KNN**.
3. Mengelompokkan wilayah dengan **K-Means** dan **HDBSCAN**, lalu membandingkan keduanya.
4. Menampilkan hasilnya di **website React**: peta kawasan, peringkat kecamatan sesuai kebutuhan pengusaha, perkiraan modal, laporan PDF, dan chatbot AI.

```
Data mentah ─► Ekstraksi & geocoding ─► Fitur KDE + KNN + demografi + akses ─► K-Means / HDBSCAN ─► Website
(Pemkot, OSM)   (notebook_extract_cafe)        (notebook_rekomendasi)                               (web)
```

---

## Daftar isi
- [Struktur repositori](#struktur-repositori)
- [Tech stack](#tech-stack)
- [Perubahan (changelog)](#perubahan-changelog)
- [Cara menjalankan](#cara-menjalankan)
- [Hasil utama](#hasil-utama)
- [Sumber data & lisensi](#sumber-data--lisensi)

---

## Struktur repositori

```text
ExtractingDataSkripsi/
├── notebook_extract_cafe/          TAHAP 1: dataset coffee shop
│   ├── coffeshop_extract_v2.ipynb    notebook ekstraksi utama (dipakai)
│   ├── coffeshop_extract.ipynb       versi 1 (arsip)
│   └── data/
│       ├── raw/                      CSV Disbudpar, batas kota & kecamatan
│       ├── interim/                  hasil OSM, cache geocoding, jaringan jalan, hasil pencocokan
│       └── final/                    coffeeshop_bandung.csv/.geojson (400 coffee shop), metadata,
│                                     perlu_review_koordinat.csv, sampel_validasi.csv
│
├── notebook_rekomendasi/           TAHAP 2: model rekomendasi
│   ├── rekomendasi_v2.ipynb          KDE + KNN → integrasi fitur → K-Means vs HDBSCAN → ekspor web
│   ├── scrape_harga_gofood.ipynb     tingkat harga coffee shop dari GoFood (untuk perkiraan revenue)
│   ├── requirements.txt
│   └── data/
│       ├── raw/                      potongan raster WorldPop Bandung
│       ├── interim/                  fasilitas OSM (kampus, sekolah, kantor, mall), outlet GoFood
│       └── output/                   grid fitur + cluster, tabel evaluasi, profil cluster, benchmark, gambar
│
├── web/                            TAHAP 3: website
│   ├── src/                          aplikasi React (peta, analisis, laporan, chat)
│   ├── server/                       server Node.js: proxy chatbot Gemini + penyaji hasil build
│   ├── public/data/                  data hasil notebook rekomendasi (JSON/GeoJSON)
│   └── README.md                     panduan khusus website
│
├── docs/laporan_analisa.md         draf laporan analisa sistem (kebutuhan, akurasi, fitur, pengujian)
│
├── coffeeshop-pipeline/            pipeline ekstraksi versi modul .py (arsip, digantikan notebook v2)
├── rekomendasi_coffee_shop_bandung.ipynb   baseline awal (data BBBike), digantikan rekomendasi_v2
├── lihat_cafe.py                   skrip awal: ekstrak amenity=cafe dari file .osm.pbf
└── prep_geocode_coffeeshop.py      skrip awal persiapan geocoding
```

---

## Tech stack

### Pengolahan data & machine learning (Python 3.12)

| Kebutuhan | Library |
|---|---|
| Tabel & numerik | pandas, NumPy |
| Data spasial & proyeksi (UTM 48S) | GeoPandas, Shapely, pyproj |
| Raster kepadatan penduduk | rasterio |
| Grid heksagon | H3 (Uber), resolusi 9 ≈ 0,1 km² |
| **KDE** (kepadatan) | scikit-learn `KernelDensity` (Gaussian, bandwidth 500 m) |
| **KNN** (jarak terdekat) | SciPy `cKDTree` |
| **Clustering** | scikit-learn `KMeans`, `HDBSCAN` |
| Evaluasi | scikit-learn: silhouette, Davies-Bouldin, Calinski-Harabasz, Adjusted Rand Index, ROC-AUC |
| Pencocokan nama (fuzzy) | RapidFuzz |
| Batas wilayah | OSMnx |
| Unduh data | requests (Overpass API, Nominatim, Photon, GoFood, WorldPop) |
| Visualisasi | Matplotlib |
| Lingkungan | Jupyter Notebook / VS Code |

### Website

| Bagian | Teknologi |
|---|---|
| Antarmuka | React 18, Vite 5 |
| Peta | Leaflet 1.9 + react-leaflet, tile OpenStreetMap |
| Laporan PDF | halaman cetak HTML + CSS `@media print` (Simpan sebagai PDF dari browser) |
| Chatbot | Google Gemini API (default `gemini-2.5-flash`) |
| Server | Node.js 24 (modul `http` bawaan, tanpa framework); API key disimpan di `web/.env` |
| Render jawaban AI | marked + DOMPurify |
| Pengujian | Vitest (20 uji unit) |

### Sumber data

| Data | Sumber |
|---|---|
| Daftar usaha kafe/restoran 2020–2024 | Disbudpar, Open Data Kota Bandung |
| Coffee shop, kampus, sekolah, kantor, mall, jalan | OpenStreetMap via Overpass API |
| Geocoding alamat | Nominatim & Photon (berbasis OSM) |
| Kepadatan penduduk | WorldPop Global2 R2025A, 2025, 100 m |
| Kisaran harga coffee shop | GoFood, halaman daftar publik |

---

## Perubahan (changelog)

### Tahap 1: ekstraksi coffee shop (`notebook_extract_cafe/coffeshop_extract_v2.ipynb`)

- **Cek nomor rumah saat geocoding.** Hasil berupa bangunan hanya dihitung presisi `bangunan` kalau nomor rumahnya cocok dengan alamat Pemkot. Kalau tidak cocok, presisinya diturunkan menjadi `jalan`. Sebelumnya, POI mana pun di jalan yang sama lolos.
- **Panjang jalan sebenarnya.** Presisi `jalan_pendek` sekarang diukur dari panjang seluruh jalan bernama (jaringan jalan OSM, `jalan_osm.geojson`), bukan dari satu ruas. Jalan dengan nama sama di tempat lain ditandai ambigu.
- **Penanda `mungkin_tutup`.** Coffee shop yang terakhir tercatat di data Pemkot sebelum 2023 diberi tanda. Bisa juga dibuang lewat `BUANG_MUNGKIN_TUTUP`.
- **Daftar review dipersempit.** `perlu_review_koordinat.csv` sekarang hanya berisi kategori coffee shop di dalam Kota Bandung, diurutkan per kecamatan.
- **Perbaikan teknis.**
  - Cache geocoding dibaca dengan aman lintas OS (UTF-8 / cp1252).
  - Referensi konfigurasi dirapikan.
  - Ada sel `%pip install` di awal notebook.
- **Hasil:** 400 coffee shop berkoordinat layak. Sebelumnya 695, tetapi sebagian presisinya semu.

### Tahap 2: model rekomendasi (`notebook_rekomendasi/`), baru

- **Input:**
  - Coffee shop dataset v2 sebagai kompetitor.
  - Fasilitas pendukung OSM: kampus, sekolah, perkantoran, pusat perbelanjaan.
  - Jaringan jalan.
  - Kepadatan penduduk WorldPop 2025.
- **Grid:** H3 resolusi 9, 1.599 sel.
- **Fitur:** 14 fitur per sel, terdiri dari 5 KDE, 6 KNN, 1 demografi, dan 2 aksesibilitas (jarak ke jalan utama, kerapatan jalan). Semua fitur ditransformasi log1p lalu dinormalisasi z-score.
- **Clustering:**
  - K-Means: k dipilih dari silhouette.
  - HDBSCAN: grid search 50 konfigurasi.
  - Ablation study pada 4 set fitur.
- **Evaluasi:**
  - Metrik internal.
  - Koherensi spasial.
  - Stabilitas bootstrap (ARI).
  - Validasi hold-out 5-fold.
  - Validasi temporal: coffee shop baru 2023–2024 dipakai sebagai data uji.
- **Interpretasi:** setiap cluster dilabeli kawasan *potensial*, *kompetitif*, atau *potensi rendah*.
- **Ringkasan per kecamatan** untuk peringkat dan laporan.
- **Harga pasar:** tingkat harga 301 coffee shop dari halaman daftar publik GoFood.
  - Hanya halaman yang diizinkan robots.txt.
  - Jeda 3 detik per halaman.
  - Berhenti otomatis kalau diblokir.
- **Benchmark:** waktu proses dan memori per tahap dicatat untuk analisis kebutuhan perangkat.

### Tahap 3: website (`web/`), baru

- **Peta Rekomendasi:**
  - Kawasan potensial, kompetitif, dan potensi rendah, dengan pilihan K-Means atau HDBSCAN.
  - Pewarnaan per fitur.
  - Lapisan fasilitas dan filter kecamatan.
  - Klik lokasi untuk melihat detail dan 5 titik potensial terdekat.
- **Analisis & Laporan:**
  - Pengguna mengatur target pasar, toleransi kompetisi, segmen harga, tipe usaha, penjualan per hari, dan sewa.
  - Hasilnya: peringkat 30 kecamatan beserta alasan, peta skor, dan perkiraan revenue, laba, modal awal, serta waktu balik modal.
- **Dokumen laporan PDF:** preferensi, 5 kecamatan teratas, peta, rincian modal, peringkat lengkap, metode, dan keterbatasan. Bisa ditambah ringkasan dari AI.
- **Chatbot AI (Gemini):** menjawab berdasarkan data sistem, yaitu preferensi, peringkat, asumsi biaya, dan lokasi yang diklik.
- **K-Means vs HDBSCAN:** tabel metrik, ablation, profil cluster.
- **Data & Metode:** sumber data, parameter, asumsi biaya, waktu proses, keterbatasan.

### Dokumen
- `docs/laporan_analisa.md`: draf laporan analisa, mencakup kebutuhan sistem, cara kerja, metode pengecekan akurasi, fitur, pengujian black box dan white box, serta jawaban rumusan masalah.

---

## Cara menjalankan

### Prasyarat
- Python ≥ 3.10 (diuji 3.12)
- Node.js ≥ 20 (diuji 24)
- Internet untuk menjalankan notebook pertama kali

### 1. Lingkungan Python
```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
pip install -r notebook_extract_cafe/requirements.txt -r notebook_rekomendasi/requirements.txt
```
Di VS Code, pastikan kernel notebook memakai `.venv`: klik nama kernel di kanan atas, lalu **Select Another Kernel → .venv**. Setiap notebook juga punya sel `%pip install` di bagian atas.

### 2. Notebook (urutannya penting)
1. `notebook_extract_cafe/coffeshop_extract_v2.ipynb`: menghasilkan `data/final/coffeeshop_bandung.csv`.
2. `notebook_rekomendasi/scrape_harga_gofood.ipynb`: opsional, untuk data harga.
3. `notebook_rekomendasi/rekomendasi_v2.ipynb`: menulis data website ke `web/public/data/`.

Hasil semua langkah sudah ada di repositori. Jadi website bisa langsung dijalankan tanpa menjalankan notebook.

### 3. Website
```bash
cd web
npm install
cp .env.example .env               # isi GEMINI_API_KEY (gratis: https://aistudio.google.com/apikey)
npm run dev                        # http://localhost:5173 (website + server chatbot)
npm test                           # uji unit
```
Tanpa API key, website tetap berjalan; hanya chatbot yang nonaktif. Rincian lengkap ada di [web/README.md](web/README.md).

---

## Hasil utama

| | K-Means | HDBSCAN |
|---|---|---|
| Silhouette | 0,195 | 0,125 |
| Stabilitas (ARI) | 0,886 | 0,531 |
| AUC hold-out | 0,713 | 0,576 |
| AUC validasi temporal | 0,760 | 0,651 |
| Noise | 0% | 22,6% |

- **K-Means lebih cocok untuk data grid kota.** Hasilnya 3 kawasan yang jelas di peta:
  - kompetitif: pusat kota (Coblong, Lengkong, Bandung Wetan);
  - potensial: cincin transisi;
  - potensi rendah: pinggiran.
- **HDBSCAN tidak menemukan struktur kepadatan yang jelas.** Ciri wilayah berubah bertahap dari pusat ke pinggiran.
- **98% coffee shop baru (2023–2024) muncul di kawasan potensial atau kompetitif.** Sebagian besar justru di kawasan kompetitif, sesuai pola aglomerasi.

Pembahasan lengkap ada di [docs/laporan_analisa.md](docs/laporan_analisa.md).

### Keterbatasan
- Baru 400 coffee shop yang berkoordinat cukup tepat. Sekitar 620 lainnya masih perlu review, jadi kepadatan kompetitor bisa lebih rendah dari kenyataan.
- Harga GoFood berupa rentang dari sampel outlet, bukan menu lengkap.
- Biaya dan modal adalah **asumsi awal** di `web/src/bisnis.js`. Angka ini perlu divalidasi lewat wawancara pemilik coffee shop.
- Rekomendasi menunjukkan kecocokan kawasan, bukan jaminan keuntungan. Data sewa, daya beli, dan lalu lintas pejalan kaki tidak tersedia.

---

## Sumber data & lisensi

- © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright)
- Open Data Kota Bandung, Disbudpar
- WorldPop (2025), Global2 R2025A, CC BY 4.0
- GoFood: hanya halaman publik yang diizinkan robots.txt, untuk keperluan penelitian akademik. Cache halaman mentah tidak dipublikasikan.

Lisensi kode sumber ditentukan oleh pemilik repositori.

### Skrip awal (`lihat_cafe.py`)
Skrip pertama proyek ini. Isinya mengekstrak objek `amenity=cafe` dari file `.osm.pbf` (BBBike/Geofabrik) ke `cafe_bandung.csv`:
```bash
pip install osmium pandas
python lihat_cafe.py bandung.osm.pbf
```
File `.pbf` tidak di-commit karena ukurannya besar.
