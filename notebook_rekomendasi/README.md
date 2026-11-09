# Pipeline rekomendasi lokasi (v2)

`rekomendasi_v2.ipynb`: KDE + KNN + demografi + aksesibilitas → K-Means vs HDBSCAN → data website.

Input: `../notebook_extract_cafe/data/final/coffeeshop_bandung.csv` (jalankan notebook ekstraksi v2 dulu),
batas kota/kecamatan dan jaringan jalan dari notebook yang sama, fasilitas OSM (Overpass, diunduh sekali ke
`data/interim/osm_fasilitas.geojson`), dan WorldPop 2025 (diunduh sekali, dipotong ke `data/raw/worldpop_bandung_2025.tif`;
file Indonesia penuh `idn_pop_*.tif` ±170 MB boleh dihapus setelah itu).

Keluaran: `data/output/` (grid fitur + label, tabel evaluasi, profil cluster, benchmark, gambar) dan `../web/public/data/`.

```bash
pip install -r requirements.txt
jupyter lab rekomendasi_v2.ipynb   # Run All; ±1 menit pertama kali, ±10 detik berikutnya
```
