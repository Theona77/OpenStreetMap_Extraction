"""
Prep + geocoding data coffee shop Kota Bandung.
Tahap 1 (clean): filter coffee shop, normalisasi alamat, dedup antar-tahun.
Tahap 2 (geocode): alamat -> lat/lon via Nominatim (OSM), 1 request/detik.
pip install pandas geopy
"""
import re, sys
import pandas as pd

SRC = "data_rumah_makan_restoran_cafe_di_kota_bandung.csv"
CLEAN = "coffeeshop_bandung_clean.csv"
GEO = "coffeeshop_bandung_geocoded.csv"

KOPI     = r"COFFEE|COFFE|KOFFIE|KOPI|ESPRESSO|ROAST|BREW|BARISTA"
CAFE     = r"CAFE|CAFÉ|KAFE"
INCLUDE  = KOPI + "|" + CAFE
EXCLUDE  = r"CAFETARIA|CAFETERIA|KANTIN"
# penanda tempat yang produk utamanya bukan kopi
HYBRID   = r"RESTO|RESTAURANT|EATERY|KITCHEN|DAPUR|BAKERY|BREAD|ROTI|CAKE|DONUT|TEA\b|BISTRO|DINER|GRILL"
NON_KOPI = (r"CHATIME|MIXUE|BOBA|XING FU|GONG CHA|TEGUK|ES TEH|THAI TEA|MILK TEA|"
            r"RAMEN|SUSHI|UDON|SHABU|YAKINIKU|BAKSO|SATE|AYAM|BEBEK|IGA|SEAFOOD|"
            r"SHISHA|SHISA|LOUNGE|\bBAR\b|KARAOKE|CATERING|BILLIARD|BOARD GAME")

def kategori(nama: str) -> str:
    kopi = re.search(KOPI, nama) is not None
    if re.search(NON_KOPI, nama) and not kopi:
        return "non_kopi"          # buang
    if kopi and re.search(HYBRID, nama):
        return "kopi_hybrid"       # kopi + makanan/bakery/teh
    if kopi:
        return "kopi_utama"        # jelas coffee shop
    if re.search(HYBRID, nama):
        return "non_kopi"          # "CAFE & RESTO" tanpa kata kopi
    return "cafe_ambigu"           # hanya "CAFE ...", perlu validasi

def norm_addr(a: str) -> str:
    a = re.sub(r"\s+", " ", str(a).upper()).strip()
    # buang ekor ", KEC. ..., KOTA BANDUNG, JAWA BARAT 40xxx"
    a = re.split(r"\s[-,]\s?(?:KEC\.|KECAMATAN|KOTA BANDUNG)", a)[0]
    m = re.match(r"^(.*?NO\.?\s*[\w\-/]+)", a)   # jalan + nomor
    return (m.group(1) if m else a).replace(" .", ".").strip(" ,-")

def clean():
    df = pd.read_csv(SRC)
    name = df.nama_rumah_makan.str.upper().str.strip()
    df = df[name.str.contains(INCLUDE) & ~name.str.contains(EXCLUDE)].copy()
    df["nama"] = df.nama_rumah_makan.str.upper().str.replace(r"\s+", " ", regex=True).str.strip()
    df["alamat_norm"] = df.alamat.map(norm_addr)
    df = (df.sort_values("tahun")
            .groupby(["nama", "alamat_norm"], as_index=False)
            .agg(tahun_pertama=("tahun", "min"), tahun_terakhir=("tahun", "max"),
                 n_tahun=("tahun", "nunique"), alamat_asli=("alamat", "last")))
    df["kategori"] = df.nama.map(kategori)
    print(df.kategori.value_counts().to_string())
    df.to_csv(CLEAN, index=False)
    print(f"{len(df)} coffee shop unik -> {CLEAN}")

def geocode():
    from geopy.geocoders import Nominatim
    from geopy.extra.rate_limiter import RateLimiter
    df = pd.read_csv(CLEAN)
    geo = RateLimiter(Nominatim(user_agent="skripsi-coffeeshop-bandung").geocode,
                      min_delay_seconds=1)
    # bounding box Kota Bandung supaya hasil tidak nyasar ke kota lain
    box = [(-6.97, 107.54), (-6.84, 107.74)]
    def q(row):
        r = geo(f"{row.alamat_norm}, Kota Bandung, Jawa Barat, Indonesia",
                viewbox=box, bounded=True)
        return pd.Series({"lat": r.latitude if r else None,
                          "lon": r.longitude if r else None,
                          "geo_match": r.address if r else None})
    df = df.join(df.apply(q, axis=1))
    df.to_csv(GEO, index=False)
    print(f"tergeocode: {df.lat.notna().sum()}/{len(df)} -> {GEO}")

if __name__ == "__main__":
    {"clean": clean, "geocode": geocode}[sys.argv[1] if len(sys.argv) > 1 else "clean"]()
