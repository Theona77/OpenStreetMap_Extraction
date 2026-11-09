# Laporan Analisa Sistem
## Rekomendasi Lokasi Coffee Shop di Kota Bandung Berbasis KDE, KNN, K-Means, dan HDBSCAN

> Draf. Angka di dokumen ini berasal dari eksekusi `notebook_rekomendasi/rekomendasi_v2.ipynb` tanggal 7 November 2026.
> Bagian bertanda **[ISI]** memerlukan data yang belum dikumpulkan (pengecekan manual/lapangan).

---

## 1. Kebutuhan sistem dan performa

### 1.1 Lingkungan pengujian

| Komponen | Spesifikasi |
|---|---|
| Laptop | Apple MacBook, prosesor Apple M5, RAM 24 GB |
| Sistem operasi | macOS 27 |
| Python | 3.12 (geopandas 1.2, scikit-learn 1.9, h3 4.5, rasterio 1.5) |
| Node.js | 24 (React 18.3, Vite 5.4, Leaflet 1.9) |
| Browser | Google Chrome |

### 1.2 Hasil pengukuran

Waktu dan memori dicatat otomatis per tahap oleh notebook (`data/output/benchmark.csv`).

| Skenario | Waktu | Puncak RAM |
|---|---|---|
| Jalankan pertama kali (unduh data fasilitas OSM via Overpass) | ±65 detik (53 detik untuk unduhan) | ±490 MB |
| Jalankan ulang (data sudah tersimpan) | 8,6 detik | ±480 MB |
| Tahap terberat (clustering 4 set fitur × 2 algoritma, termasuk 50 konfigurasi HDBSCAN) | 3,6 detik | – |
| Unduh WorldPop Indonesia (sekali saja) | ±2 menit, 169 MB | – |

Website:

| Komponen | Ukuran |
|---|---|
| Kode JavaScript (gzip) | ±100 KB |
| Data (grid 1.599 sel, 400 coffee shop, 1.446 fasilitas, batas kecamatan, metadata) | ±1,6 MB |
| Hasil build total (`web/dist`) | ±2,9 MB |

Semua perhitungan berat dilakukan sekali di notebook. Website hanya menampilkan hasil dan menghitung rekomendasi radius (±1.600 jarak haversine per klik) di browser, sehingga tidak membutuhkan server aplikasi atau basis data.

### 1.3 Persyaratan minimum (perkiraan)

Perkiraan di bawah diturunkan dari pengukuran di atas: puncak memori < 0,5 GB dan waktu komputasi < 10 detik di laptop uji.

| | Pipeline (notebook) | Website (pengguna) |
|---|---|---|
| Prosesor | dual-core 64-bit (Intel i3 / Ryzen 3 generasi 2018 ke atas) | perangkat apa pun yang menjalankan browser modern |
| RAM | 4 GB (proses memakai ±0,5 GB) | 2 GB |
| Penyimpanan | ±1,5 GB (lingkungan Python ±1 GB + data ±200 MB; file WorldPop penuh boleh dihapus setelah dipotong) | – |
| Perangkat lunak | Python ≥ 3.10, Jupyter, paket di `requirements.txt` | Chrome / Firefox / Edge / Safari versi terbaru |
| Jaringan | perlu internet saat pertama kali (Overpass, WorldPop) | perlu internet untuk peta dasar OSM |
| Server | – | hosting statis (GitHub Pages, Netlify, atau folder web server biasa) |

**[ISI]** Untuk membuktikan persyaratan minimum, jalankan notebook di laptop dengan spesifikasi lebih rendah (mis. RAM 8 GB, Intel i3/i5) dan catat `benchmark.csv`-nya di tabel 1.2.

---

## 2. Cara kerja sistem

```
Input data geospasial ──► Grid H3 ──► KDE ──┐
 (coffee shop, kampus,                KNN ──┼─► Integrasi & normalisasi ──► K-Means / HDBSCAN ──► Interpretasi ──► Website
  sekolah, kantor, mall,      Demografi ────┤     (log1p + z-score)                              (potensial /
  jalan, penduduk)          Aksesibilitas ──┘                                                     kompetitif /
                                                                                                    potensi rendah)
```

0. **Arsitektur.** Notebook Python menghitung semua fitur dan clustering lalu menulis file JSON. Website React menampilkan peta, memeringkat kecamatan, dan menyusun laporan di browser. Server Node.js kecil (`web/server/server.js`) meneruskan pertanyaan chatbot ke Google Gemini, sehingga API key tidak terlihat di browser.

1. **Input data geospasial.**
   - Coffee shop: 400 titik dari dataset v2 (Disbudpar Kota Bandung digabung dengan OpenStreetMap).
   - Fasilitas dari OpenStreetMap: kampus 106, sekolah 539, perkantoran 710, pusat perbelanjaan 91.
   - Jaringan jalan bernama dari OpenStreetMap.
   - Kepadatan penduduk: WorldPop 2025, resolusi 100 m.
2. **Grid kandidat.** Kota Bandung (167,6 km²) dibagi menjadi 1.599 sel heksagon H3 resolusi 9, masing-masing ±0,104 km². Setiap sel adalah satu kandidat lokasi.
3. **KDE.** Kepadatan coffee shop dan setiap jenis fasilitas dihitung dengan kernel Gaussian, bandwidth 500 m (setara jarak jalan kaki 5–7 menit). Cross-validation juga memilih 500 m. Satuan hasilnya titik per km².
4. **KNN.** Jarak dari titik tengah sel ke objek terdekat dihitung dengan cKDTree. Untuk kompetitor dihitung dua nilai: jarak ke coffee shop terdekat dan rata-rata jarak ke 3 terdekat.
5. **Demografi dan aksesibilitas.**
   - Penduduk per km² per sel.
   - Jarak ke jalan utama (trunk, primary, secondary).
   - Kerapatan jalan dalam radius 500 m.
6. **Integrasi dan normalisasi.** Keempat belas fitur ditransformasi dengan log1p (karena distribusinya menceng), lalu distandarkan menjadi z-score.
7. **Clustering.**
   - K-Means: k dipilih dari silhouette tertinggi pada rentang 3–8, hasilnya k = 3.
   - HDBSCAN: grid search 50 konfigurasi dengan aturan pemilihan bertingkat.
8. **Interpretasi.** Setiap cluster diberi label berdasarkan dua indeks:
   - Indeks pendukung: rata-rata z-score kepadatan fasilitas, penduduk, dan kerapatan jalan.
   - Indeks kompetisi: z-score kepadatan coffee shop.

   Labelnya:
   - **Potensi rendah**: indeks pendukung di bawah rata-rata kota.
   - **Potensial**: indeks pendukung ≥ rata-rata kota dan pendukung ≥ kompetisi.
   - **Kompetitif**: indeks pendukung ≥ rata-rata kota tetapi kompetisi lebih tinggi daripada pendukung.
9. **Harga pasar (GoFood).** Notebook `scrape_harga_gofood.ipynb` mengambil tingkat harga coffee shop dari halaman daftar publik GoFood. Tingkatnya: 1 = <Rp16rb, 2 = Rp16–40rb, 3 = Rp40–100rb, 4 = >Rp100rb.
   - Hanya halaman yang diizinkan `robots.txt`, dengan jeda 3 detik per halaman.
   - Halaman menu detail diproteksi captcha, jadi tidak diambil.
   - Hasilnya adalah sampel: maksimal 12 outlet per halaman daftar.
10. **Peringkat & perkiraan finansial.** Skor kecamatan = permintaan − λ×kompetisi + 0,5×porsi kawasan potensial (− 0,25×selisih segmen harga bila dipilih).
    - Permintaan adalah rata-rata berbobot z-score fitur pendukung, dengan bobot dari target pasar pengguna.
    - λ = 1 untuk "hindari kompetisi", 0,5 untuk "seimbang", 0 untuk "ikut keramaian".
    - Revenue = harga rata-rata × transaksi/hari × 30.
    - Komponen biaya (gaji, sewa, utilitas, investasi) adalah asumsi awal yang bisa diubah pengguna.
11. **Website.** Peta interaktif menampilkan jenis kawasan. Pengguna bisa mengklik sebuah lokasi, lalu sistem mencari sel kawasan potensial dalam radius yang dipilih dan mengurutkannya berdasarkan skor peluang. Ini penerapan KNN berbasis radius dengan jarak haversine.

---

## 3. Akurasi dan metode pengecekan

Pengecekan dibagi menjadi tiga lapis: (A) akurasi data masukan, (B) kualitas cluster secara internal, dan (C) kecocokan hasil dengan lokasi coffee shop sebenarnya.

### 3.1 (A) Akurasi data coffee shop

| Aspek | Metode | Status / hasil |
|---|---|---|
| Ketepatan koordinat | Setiap titik diberi tingkat presisi dan perkiraan ketidakpastian (OSM ±10 m, nomor rumah cocok ±15 m, jalan pendek ±110 m, dst.). Titik dengan presisi rendah (jalan panjang, kelurahan, kecamatan) **tidak dipakai**. | 400 titik lolos; 622 coffee shop lain belum punya koordinat yang cukup tepat (`perlu_review_koordinat.csv`) |
| Ketepatan kategori (benar coffee shop atau bukan) | **Manual**: 227 sampel acak berstrata di `sampel_validasi.csv` diberi label benar/salah dengan mengecek Google Maps / Instagram / kunjungan. Hasilnya dihitung sebagai presisi per kategori. | **[ISI]** kolom `label_manual` belum diisi |
| Ketepatan posisi terhadap lapangan | **Manual/lapangan**: ambil ±30 coffee shop acak (berstrata per sumber koordinat), catat koordinat sebenarnya (GPS ponsel atau Google Maps), hitung selisih jarak (median & persentil 90). | **[ISI]** |
| Coffee shop masih buka | Flag `mungkin_tutup` (terakhir tercatat di Pemkot sebelum 2023): 32 dari 400. | Ditandai, tetap dihitung sebagai kompetitor |

### 3.2 (B) Kualitas cluster secara internal (set fitur LENGKAP)

| Metrik | K-Means | HDBSCAN | Lebih baik |
|---|---|---|---|
| Jumlah cluster | 3 | 2 (+ noise) | – |
| Sel noise | 0% | 22,6% | K-Means |
| Silhouette (↑) | 0,195 | 0,125 | K-Means |
| Davies-Bouldin (↓) | 1,631 | 1,208 | HDBSCAN |
| Calinski-Harabasz (↑) | 595,4 | 14,1 | K-Means |
| Koherensi spasial, z (↑) | 63,0 | 7,1 | K-Means |
| Stabilitas bootstrap 80%, ARI (↑) | 0,886 | 0,531 | K-Means |

Catatan:
- Dari 50 konfigurasi HDBSCAN, **tidak ada** yang menghasilkan ≥ 3 cluster dengan noise ≤ 30%. Konfigurasi terpilih hanya membentuk satu cluster besar (1.228 sel) dan satu cluster kecil (10 sel).
- Penyebabnya, fitur sel membentuk gradasi kontinu dari pusat ke pinggiran kota, tanpa "celah kepadatan" yang dibutuhkan HDBSCAN.

### 3.3 (C) Kecocokan dengan lokasi coffee shop sebenarnya

**Uji hold-out (5-fold), otomatis.**
1. Sembunyikan 20% coffee shop.
2. Hitung ulang fitur kompetitor dari 80% sisanya, lalu cluster ulang.
3. Ukur seberapa baik cluster membedakan sel yang berisi coffee shop tersembunyi dari sel lain (AUC; 0,5 = acak).

**Validasi temporal, otomatis.**
1. Sembunyikan 63 coffee shop yang **pertama kali tercatat di Pemkot tahun 2023–2024**.
2. Bangun model hanya dari coffee shop lama.
3. Cek apakah coffee shop baru muncul di kawasan yang dinilai tinggi oleh model.

| Uji | K-Means | HDBSCAN |
|---|---|---|
| AUC hold-out 5-fold | **0,713** ± 0,038 | 0,576 ± 0,036 |
| AUC validasi temporal | **0,760** | 0,651 |
| Coffee shop baru yang jatuh di kawasan potensial + kompetitif | **98,4%** (luas kawasan itu 66,4% kota) | 3,2% (luas 6,6%) |
| Coffee shop baru yang jatuh di kawasan potensial saja | 11,3% (luas 41,9%) | 0% |

Interpretasi:
- Model K-Means mampu "meramalkan" kawasan tempat coffee shop baru muncul jauh lebih baik dari tebakan acak (AUC 0,76).
- 98% coffee shop baru berdiri di kawasan dengan indeks pendukung di atas rata-rata.
- Sebagian besar dari mereka justru memilih **kawasan kompetitif** (yang sudah padat), bukan kawasan potensial. Ini sejalan dengan teori aglomerasi: usaha sejenis cenderung berkumpul.
- Jadi label "potensial" harus dibaca sebagai "pendukung baik, kompetisi belum padat", bukan "tempat yang paling sering dipilih pengusaha". Ini temuan penting untuk bab pembahasan.

**Pengecekan manual tambahan.** **[ISI]**
- Pilih 3–5 sel teratas yang direkomendasikan di beberapa kecamatan.
- Kunjungi atau cek lewat Street View: apakah ada ruko/lahan, aktivitas pejalan kaki, kampus/kantor sesuai data?
- Catat hasilnya dalam tabel (sel, kecamatan, kondisi lapangan, sesuai/tidak).

---

## 4. Fitur aplikasi

### 4.1 Fitur utama

| No | Fitur | Keterangan |
|---|---|---|
| F1 | Peta jenis kawasan | Sel diwarnai potensial (hijau), kompetitif (merah), potensi rendah (abu-abu) |
| F2 | Pilihan algoritma | Beralih antara hasil K-Means dan HDBSCAN |
| F3 | Rekomendasi lokasi | Klik lokasi → 5 sel kawasan potensial terbaik dalam radius 0,5–5 km, diurutkan skor peluang; klik hasil untuk terbang ke sel tersebut |
| F4 | Detail lokasi | Jenis kawasan, nomor cluster, indeks pendukung/kompetisi, skor peluang, 14 nilai fitur + persentil kota, 3 coffee shop terdekat |
| F5 | Perbandingan algoritma | Tabel metrik, ablation, profil cluster, tabel kesepakatan |
| F12 | Peringkat kecamatan sesuai preferensi | Pengguna mengatur target pasar (mahasiswa, pekerja kantor, pelajar, pengunjung mall, warga, akses jalan), toleransi kompetisi, segmen harga, tipe usaha → 30 kecamatan diurutkan dengan alasan |
| F13 | Perkiraan revenue & modal kasar | Harga rata-rata dari tingkat harga GoFood per kecamatan × transaksi/hari; modal awal = investasi + sewa di muka + modal kerja; perkiraan balik modal; 3 skenario penjualan |
| F14 | Dokumen laporan (PDF) | Laporan A4: preferensi, 5 kecamatan teratas + peta skor, rincian modal & skenario, peringkat lengkap, metode, keterbatasan; opsional ringkasan eksekutif dari AI |
| F15 | Chatbot AI (Google Gemini) | Menjawab pertanyaan analisis berdasarkan data sistem (preferensi, peringkat, asumsi biaya, lokasi yang diklik); API key disimpan di server, bukan di browser |

### 4.2 Fitur pendukung

| No | Fitur |
|---|---|
| F6 | Mewarnai peta berdasarkan nomor cluster atau nilai satu fitur (14 pilihan, kelas kuantil) |
| F7 | Lapisan coffee shop, kampus, sekolah, perkantoran, pusat perbelanjaan, batas kecamatan (bisa dinyalakan/dimatikan) |
| F8 | Filter & zoom ke kecamatan, dengan ringkasan jumlah sel per jenis kawasan |
| F9 | Tautan yang bisa dibagikan (`?titik=lat,lon`, `#banding`, `#metode`) |
| F10 | Halaman Data & Metode: sumber data, parameter, waktu proses, keterbatasan |
| F11 | Tampilan responsif (laptop dan ponsel) |

Status fitur: lihat hasil pengujian di bagian 5.

---

## 5. Pengujian

### 5.1 Metode

| Metode | Apa yang diuji | Alat |
|---|---|---|
| **White box** (uji unit) | Fungsi logika di `web/src/lib.js`: jarak haversine, pencarian sel terdekat, filter & urutan rekomendasi, kuantil, persentil, k-terdekat | Vitest (`npm test`) |
| **Black box** (uji fungsional) | Setiap fitur F1–F11 dari sisi pengguna, tanpa melihat kode: masukan → keluaran yang diharapkan | Browser |
| Validasi model | Kualitas cluster dan kecocokan dengan data nyata (bagian 3) | Notebook |

Pengujian grey box tidak dipakai secara terpisah. Uji black box di bawah sudah dilengkapi pengecekan data keluaran notebook, misalnya jumlah sel di legenda dibandingkan dengan profil cluster.

### 5.2 Hasil uji white box

20 kasus uji, **20 lulus**: 11 untuk logika peta (`lib.test.js`) dan 9 untuk peringkat & finansial (`bisnis.test.js`), misalnya:
- Rumus revenue/laba/modal.
- Fallback ke harga kota bila data kecamatan < 3 outlet.
- Penalti kompetisi sesuai λ.
- BEP kosong bila rugi.

Contoh kasus uji logika peta: Contoh kasus:
- Rekomendasi hanya mengembalikan sel kelas potensial di dalam radius, urut dari skor tertinggi.
- Rekomendasi mengembalikan daftar kosong jika algoritma tidak punya kawasan potensial.
- Titik lebih dari 350 m dari sel mana pun dianggap di luar kota.

### 5.3 Hasil uji black box

| ID | Fitur | Skenario | Hasil yang diharapkan | Hasil | Status |
|---|---|---|---|---|---|
| BB-01 | F1 | Buka halaman utama | Peta Kota Bandung tampil dengan 3 warna kawasan, legenda 665/336/598 sel | Sesuai | Lulus |
| BB-02 | F3, F4 | Buka `?titik=-6.9175,107.6191` (Alun-alun) | Panel detail Kec. Sumur Bandung, kawasan kompetitif, 5 rekomendasi kawasan potensial ≤ 2 km | Sesuai (rekomendasi di Regol, Lengkong, Batununggal) | Lulus |
| BB-03 | F5 | Buka tab K-Means vs HDBSCAN | Tabel metrik, ablation, profil, kesepakatan tampil | Sesuai | Lulus |
| BB-04 | F10 | Buka tab Data & Metode | Sumber data, aturan, fitur, parameter, waktu proses tampil | Sesuai | Lulus |
| BB-05 | F11 | Buka di layar lebar ponsel | Kontrol, peta, panel tersusun vertikal | Sesuai | Lulus |
| BB-06 | F2 | Klik tombol HDBSCAN | Warna peta & legenda berubah ke hasil HDBSCAN; panel ringkasan memberi peringatan tidak ada kawasan potensial | **[ISI]** | |
| BB-07 | F3 | Klik sel di dalam kota | Penanda kuning muncul, panel detail terisi | **[ISI]** | |
| BB-08 | F3 | Klik di luar batas kota | Panel "Di luar wilayah analisis" | **[ISI]** | |
| BB-09 | F3 | Geser radius ke 0,5 km di kawasan potensi rendah | Pesan "Tidak ada sel kawasan potensial dalam radius ini" | **[ISI]** | |
| BB-10 | F3 | Klik salah satu hasil rekomendasi | Peta terbang ke sel itu, panel berganti ke sel tersebut | **[ISI]** | |
| BB-11 | F6 | Pilih "Nilai fitur" → Kepadatan penduduk | Sel diwarnai 5 kelas kuantil, legenda menampilkan rentang | **[ISI]** | |
| BB-12 | F7 | Centang Kampus | Titik ungu kampus muncul; tooltip menampilkan nama | **[ISI]** | |
| BB-13 | F8 | Pilih kecamatan Coblong | Peta zoom ke Coblong, sel lain diredupkan, legenda menghitung sel Coblong saja | **[ISI]** | |
| BB-14 | F9 | Salin URL setelah klik lokasi, buka di tab baru | Lokasi dan panel yang sama terbuka | **[ISI]** | |
| BB-15 | – | Hapus `public/data/meta.json`, buka website | Pesan galat yang jelas, bukan layar kosong | **[ISI]** | |
| BB-16 | F12 | Tab Analisis, set bobot Mahasiswa = 3, lainnya 0 | Kecamatan dengan banyak kampus (mis. Coblong) naik ke atas | **[ISI]** | |
| BB-17 | F12 | Ubah toleransi ke "Hindari kompetisi" | Kecamatan padat coffee shop turun peringkat | **[ISI]** | |
| BB-18 | F13 | Isi sewa 5.000.000 dan 120 transaksi/hari | Modal, laba, balik modal berubah sesuai rumus | **[ISI]** | |
| BB-19 | F14 | Klik "Buat laporan (PDF)" → Cetak → Simpan PDF | File PDF A4 berisi 5 bagian laporan | **[ISI]** | |
| BB-20 | F15 | Server tanpa API key, buka chat | Pesan "API key belum diisi" (bukan error kosong) | Sesuai (diuji lewat endpoint) | Lulus |
| BB-21 | F15 | API key salah | Pesan galat dari Gemini ditampilkan | Sesuai: "API key not valid" | Lulus |
| BB-22 | F15 | API key benar, tanya "Berapa modal untuk kecamatan peringkat 1?" | Jawaban memakai angka modal dari sistem + menyebut asumsi | **[ISI]** | |
| BB-23 | F15 | Tanya hal di luar topik (mis. resep masakan) | AI menolak dengan sopan | **[ISI]** | |

BB-01 sampai BB-05 dijalankan otomatis dengan Chrome headless (tangkapan layar). BB-06 sampai BB-15 memerlukan interaksi klik dan perlu dijalankan manual. Tambahkan tangkapan layar sebagai bukti.

---

## 6. Hasil dan jawaban rumusan masalah

**[ISI]** Sesuaikan nomor dan kalimat dengan rumusan masalah di proposal. Di bawah ini jawaban untuk rumusan yang umum dipakai pada topik ini.

| Rumusan masalah | Jawaban dari hasil | Terjawab? |
|---|---|---|
| Bagaimana sistem merekomendasikan kecamatan sesuai kebutuhan calon pengusaha, beserta perkiraan modalnya? | Peringkat kecamatan berbasis preferensi (F12), perkiraan revenue/modal berbasis harga pasar GoFood dan asumsi biaya (F13), dokumen laporan PDF (F14), dan chatbot Gemini yang menjelaskan hasil (F15). Akurasi perkiraan modal **belum divalidasi**: bandingkan dengan wawancara ≥ 3 pemilik coffee shop. | Sebagian, tunggu validasi |
| Bagaimana menerapkan KDE dan KNN untuk membentuk fitur spasial lokasi coffee shop? | KDE menghasilkan 5 fitur kepadatan, KNN 6 fitur jarak. Digabung dengan demografi dan aksesibilitas menjadi 14 fitur per sel. Analisis korelasi menunjukkan fitur KDE dan KNN untuk objek yang sama sangat berkorelasi (\|r\| 0,90–0,97), artinya sebagian informasinya tumpang tindih. | Ya |
| Bagaimana perbandingan kinerja K-Means dan HDBSCAN dalam mengelompokkan wilayah? | K-Means unggul pada 7 dari 8 metrik: silhouette, CH, koherensi spasial, stabilitas, AUC hold-out 0,71 vs 0,58, dan AUC temporal 0,76 vs 0,65. HDBSCAN hanya unggul pada Davies-Bouldin, yang dihitung tanpa 23% sel noise. HDBSCAN tidak cocok untuk data grid ini karena tidak ada celah kepadatan antar kelompok wilayah. | Ya |
| Kawasan mana yang potensial, kompetitif, dan berpotensi rendah? | Menurut K-Means:<br>• **Kompetitif** 35,1 km², pusat kota: Coblong, Lengkong, Bandung Wetan; 338 dari 400 coffee shop.<br>• **Potensial** 69,5 km², cincin transisi: Buahbatu, Sukasari, Kiaracondong; 57 coffee shop.<br>• **Potensi rendah** 62,5 km², pinggiran: Bandung Kulon, Arcamanik, Rancasari. | Ya |
| Bagaimana menyajikan hasil agar mudah dipakai calon pengusaha? | Website React dengan peta interaktif dan rekomendasi berbasis radius (bagian 4). | Ya, setelah BB-06 s.d. BB-15 lulus |

### Keterbatasan yang perlu disebut di laporan

1. Kompetitor hanya 400 coffee shop berkoordinat tepat. ±620 coffee shop lain belum dihitung, jadi kepadatan kompetitor di beberapa kawasan lebih rendah dari kenyataan.
2. Coffee shop di luar batas kota tidak dihitung. Akibatnya, sel di tepi kota tampak lebih sepi kompetitor.
3. Kelengkapan data OSM (kantor, sekolah) berbeda antar kawasan.
4. Tidak ada data harga sewa, daya beli, atau lalu lintas pejalan kaki. Rekomendasi menunjukkan kecocokan karakter kawasan, bukan jaminan profit.
5. Perkiraan modal & revenue memakai asumsi biaya peneliti dan sampel tingkat harga GoFood (rentang, bukan harga menu persis). Halaman menu GoFood diproteksi captcha sehingga tidak diambil.
6. Validasi temporal memakai tahun pertama tercatat di data Pemkot sebagai perkiraan tahun buka.
