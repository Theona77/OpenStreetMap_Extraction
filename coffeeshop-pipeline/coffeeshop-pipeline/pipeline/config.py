"""Semua parameter pipeline di satu tempat. Ubah di sini, jangan di modul lain."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW, INTERIM, FINAL = ROOT / "data/raw", ROOT / "data/interim", ROOT / "data/final"
for d in (RAW, INTERIM, FINAL):
    d.mkdir(parents=True, exist_ok=True)

# ---- Sumber data -----------------------------------------------------------
# CSV Disbudpar Kota Bandung (Open Data Kota Bandung / Satu Data Indonesia),
# diunduh manual lalu ditaruh di data/raw/.
PEMKOT_CSV = RAW / "data_rumah_makan_restoran_cafe_di_kota_bandung.csv"

# Relation OSM batas administrasi Kota Bandung (admin_level=5)
BATAS_OSM_RELATION = 13290062
BATAS_FILE = RAW / "batas_kota_bandung.geojson"
KECAMATAN_FILE = RAW / "kecamatan_kota_bandung.geojson"
KOREKSI_FILE = RAW / "koreksi_koordinat.csv"   # opsional: id_pemkot,lat,lon,catatan

# Sumber POI OSM: "overpass" (unduh langsung) atau path ke file .osm.pbf lokal
OSM_SOURCE = "overpass"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

USER_AGENT = "skripsi-coffeeshop-bandung (novellina.e@gmail.com)"
CRS_METER = 32748          # UTM zone 48S

# ---- Klasifikasi nama (data Pemkot) ----------------------------------------
KOPI = r"COFFEE|COFFE|KOFFIE|KOPI|ESPRESSO|ROASTERY|ROASTER|\bBREW|BARISTA"
CAFE = r"CAFE|CAFÉ|KAFE"
EXCLUDE = r"CAFETARIA|CAFETERIA|KANTIN"
HYBRID = r"RESTO|RESTAURANT|EATERY|KITCHEN|DAPUR|BAKERY|BREAD|ROTI|CAKE|DONUT|\bTEA\b|BISTRO|DINER"
NON_KOPI = (r"CHATIME|MIXUE|BOBA|XING FU|GONG CHA|TEGUK|ES TEH|THAI TEA|MILK TEA|"
            r"RAMEN|SUSHI|UDON|SHABU|YAKINIKU|BAKSO|SATE|AYAM|BEBEK|\bIGA\b|SEAFOOD|GRILL|"
            r"STEAK|SHISHA|SHISA|LOUNGE|\bBAR\b|KARAOKE|CATERING|BILLIARD")

# ---- Klasifikasi OSM -------------------------------------------------------
OSM_NON_KOPI_CUISINE = {"bubble_tea", "ice_cream", "tea", "juice", "donut"}
OSM_NON_KOPI_NAMA = r"CHATIME|MIXUE|XING FU|KOI TH|GONG CHA|HAUS|ES TEH|TEGUK|BOBA"

# ---- Matching --------------------------------------------------------------
MATCH_RADIUS_M = 300       # Pemkot (hasil geocode) ke OSM: maksimal jarak
MATCH_NAME_MIN = 85        # skor kemiripan nama (0-100) untuk match spasial
MATCH_NAME_ONLY_MIN = 95   # nama unik tanpa koordinat: harus nyaris identik
DUP_RADIUS_M = 30          # duplikat di dalam OSM (pin + bangunan)

# ---- Dataset final ---------------------------------------------------------
KATEGORI_FINAL = {"kopi_utama", "kopi_hybrid", "osm_cafe"}  # osm_cafe = hanya ada di OSM
# hapus "kopi_hybrid" untuk definisi ketat (sensitivity analysis)
# ---- Geocoding -------------------------------------------------------------
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
PHOTON_URL = "https://photon.komoot.io/api/"
GEOCODE_JEDA_DETIK = 1.1          # kebijakan Nominatim: maks 1 request/detik
POI_RADIUS_M = 400                # cari nama coffee shop di sekitar hasil alamat
POI_NAMA_MIN = 80                 # kemiripan nama hasil POI vs nama Pemkot
POI_KOTA_MAX_DARI_ALAMAT_M = 1500 # POI hasil cari se-kota tidak boleh jauh dari alamatnya
# urutan kualitas, terbaik dulu
PRESISI_URUT = ["manual", "poi_dekat_alamat", "poi", "bangunan", "gedung", "jalan", "kelurahan", "kecamatan"]
GEOCODE_PRESISI_OK = {"manual", "poi_dekat_alamat", "poi", "bangunan", "gedung"}  # "jalan" terlalu kasar
