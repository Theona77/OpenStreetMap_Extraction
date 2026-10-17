# Pipeline Dataset Coffee Shop Kota Bandung

Membangun dataset titik coffee shop Kota Bandung dari dua sumber terbuka:

1. **Data Rumah Makan, Restoran, Cafe di Kota Bandung** (Disbudpar Kota Bandung, Open Data Kota Bandung / Satu Data Indonesia), dipakai sebagai daftar resmi. Data ini tidak punya koordinat.
2. **OpenStreetMap**, dipakai sebagai sumber koordinat dan validasi kategori.

Tidak ada scraping Google Maps. Semua sumber legal untuk dipakai di skripsi.

## Alur

```
[1] batas    Batas Kota Bandung (relation OSM 13290062) + 30 kecamatan
[2] osm      POI amenity=cafe / cuisine=coffee_shop -> clip ke batas -> flag non-kopi -> dedup
[3] pemkot   Filter nama kopi/cafe -> normalisasi alamat -> dedup antar-tahun -> kategori
[4] geocode  Alamat Pemkot -> lat/lon, berjenjang (lihat bagian Geocoding)
[5] match    Pemkot <-> OSM: (A) spasial + nama, (B) nama unik saja
[6] final    Gabung -> pilih koordinat terbaik -> filter kategori & batas -> CSV/GeoJSON + metadata
[v] sampel   Sampel acak per kategori untuk validasi manual
```

Urutan prioritas koordinat: **OSM** (titik dipetakan langsung), lalu **Nominatim presisi bangunan**. Hasil geocode yang hanya presisi jalan atau area tidak dipakai, karena bisa meleset ratusan meter.

## Instalasi

```bash
python3 -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Buka `pipeline/config.py`, lalu ganti `USER_AGENT` dengan email kamu. Ini wajib menurut kebijakan Nominatim dan Overpass.

## Menjalankan

1. Unduh CSV dari Open Data Kota Bandung, lalu simpan sebagai
   `data/raw/data_rumah_makan_restoran_cafe_di_kota_bandung.csv`. **Catat tanggal unduh.**
2. Jalankan:

```bash
python run.py all                       # OSM via Overpass (paling sederhana)
# atau dengan file PBF lokal (bbox harus mencakup seluruh Kota Bandung!)
python run.py batas
python run.py osm --pbf data/raw/bandung.osm.pbf
python run.py pemkot
python run.py geocode                   # 1–3 jam; aman dihentikan (Ctrl+C) & dilanjutkan
python run.py match
python run.py final
python run.py sampel                    # lalu isi label_manual di sampel_validasi.csv
```

Setiap langkah bisa dijalankan ulang secara terpisah. Kalau `config.py` diubah, jalankan ulang mulai dari langkah yang terdampak saja. Contohnya, mengubah `KATEGORI_FINAL` cukup diikuti `python run.py final`.

## Geocoding data Pemkot (langkah 4)

Data Open Data tidak punya koordinat, jadi setiap tempat dicari koordinatnya secara berjenjang. Pencarian berhenti begitu ditemukan hasil yang meyakinkan:

| # | Strategi | `geo_presisi` | Masuk final? |
|---|---|---|---|
| 0 | Koreksi manual (`data/raw/koreksi_koordinat.csv`) | `manual` | ya |
| 1 | Alamat jalan+nomor (Nominatim, lalu Photon) | `bangunan` / `jalan` | bangunan: ya, jalan: tidak |
| 2 | Nama coffee shop dalam radius 400 m dari hasil #1 | `poi_dekat_alamat` | ya (paling meyakinkan) |
| 3 | Nama se-kota, khusus non-rantai dan hasil tidak ambigu | `poi` | ya |
| 4 | Nama gedung/mall dari alamat (PVJ, Istana Plaza, ...) | `gedung` | ya |
| 5 | Titik tengah kelurahan / kecamatan | `kelurahan` / `kecamatan` | tidak |

Validasi otomatis untuk setiap kandidat:

- Titik harus berada di dalam batas Kota Bandung.
- Kalau alamat menyebut kecamatan (umumnya data 2022–2023), titik harus jatuh di kecamatan itu, dengan toleransi 200 m.
- Kandidat yang ditolak dicatat di kolom `geo_ditolak`, misalnya `beda_kecamatan` atau `ambigu_2_lokasi`.

Catatan teknis:

- **Rantai** (Starbucks, Kopi Kenangan, 372 Kopi, ...) tidak pernah dicari dengan nama se-kota, karena hasilnya bisa cabang lain. Rantai hanya lewat strategi #2.
- **Waktu proses:** setiap tempat butuh 2–12 request, dan request dibatasi 1 per detik. Untuk ±1.200 tempat, perkirakan 1–3 jam. Proses aman dihentikan dengan **Ctrl+C**, karena semua request di-cache di `data/interim/geocode_cache.json`. Menjalankan `python run.py geocode` lagi akan melanjutkan dari titik terakhir.
- **Koreksi manual:** buka `data/final/perlu_review_koordinat.csv`, cek lokasinya lewat `link_osm`, lalu isi kolom `lat`/`lon`. Salin baris yang sudah diisi (kolom `id_pemkot,lat,lon,catatan`) ke `data/raw/koreksi_koordinat.csv`. Setelah itu jalankan `python run.py geocode && python run.py match && python run.py final`.
- Laporkan distribusi `geo_presisi` di skripsi. Angkanya dicetak di akhir langkah 4.

## Output (`data/final/`)

| File | Isi |
|---|---|
| `coffeeshop_bandung.csv` / `.geojson` | Dataset final untuk modelling |
| `coffeeshop_bandung_semua.csv` | Semua kandidat beserta alasan masuk/tidak (untuk audit) |
| `metadata.json` | Tanggal snapshot OSM, jumlah per sumber/kategori/sumber koordinat |
| `sampel_validasi.csv` | Sampel untuk dilabeli manual |
| `perlu_review_koordinat.csv` | Tempat yang koordinatnya belum layak, dilengkapi link peta |

Kolom penting:

- `kategori`: `kopi_utama`, `kopi_hybrid`, `cafe_ambigu`, `non_kopi`, atau `osm_cafe`.
- `sumber`: `pemkot+osm`, `pemkot`, atau `osm`.
- `sumber_koordinat`: `osm`, `geocode_<presisi>`, atau `tanpa_koordinat(...)`.
- `match_metode`: `spasial` atau `nama`.

## Keputusan metodologis (atur di `config.py`)

- `KATEGORI_FINAL` menentukan definisi operasional coffee shop. Untuk *sensitivity analysis*, jalankan sekali dengan dan sekali tanpa `kopi_hybrid`.
- `cafe_ambigu` hanya masuk final kalau cocok dengan objek OSM yang ber-`cuisine=coffee_shop`.
- `MATCH_RADIUS_M`, `MATCH_NAME_MIN`, dan `MATCH_NAME_ONLY_MIN` mengatur ambang matching. Dua ambang nama sengaja dibuat ketat supaya tidak terjadi *false match*.
- `GEOCODE_PRESISI_OK` bisa ditambah `"jalan"` kalau jumlah titik dirasa terlalu sedikit. Konsekuensinya presisi turun, dan itu perlu dilaporkan.

## Keterbatasan yang perlu ditulis di skripsi

- Klasifikasi Pemkot berbasis nama, jadi akurasinya perlu dilaporkan dari `sampel_validasi.csv`.
- Kelengkapan OSM di Indonesia terbatas. Banyak coffee shop kecil yang belum terpetakan.
- Arti kolom `tahun` di data Pemkot (tahun pencatatan vs status aktif) perlu dicek ke metadata dataset.
- Data OSM berubah setiap saat. Selalu sertakan `snapshot_osm` dari `metadata.json`.

## Lisensi & atribusi

Data OSM © OpenStreetMap contributors, berlisensi ODbL. Data Pemkot mengikuti ketentuan portal sumbernya.
