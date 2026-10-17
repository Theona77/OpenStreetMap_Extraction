"""Langkah 4: koordinat untuk data Pemkot (yang tidak punya lat/lon).

Strategi berjenjang per tempat, semua berbasis data OSM (legal & gratis):

  0. koreksi manual          data/raw/koreksi_koordinat.csv (selalu menang)
  1. alamat                  Nominatim, lalu Photon      -> presisi 'bangunan' / 'jalan'
  2. nama di sekitar alamat  cari nama coffee shop dalam radius POI_RADIUS_M dari hasil 1
                                                         -> 'poi_dekat_alamat' (paling meyakinkan)
  3. nama se-kota            hanya untuk nama yang BUKAN rantai -> 'poi'
  4. gedung/mall             "PARIS VAN JAVA", "ISTANA PLAZA" -> 'gedung'
  5. kelurahan / kecamatan   titik tengah wilayah (hanya cadangan, tidak masuk final)

Setiap kandidat divalidasi: harus di dalam Kota Bandung, dan kalau alamat menyebut
kecamatan, titiknya harus jatuh di kecamatan itu. Semua request di-cache, jadi
proses bisa dihentikan (Ctrl+C) dan dilanjutkan kapan saja.
"""
import json, math, time
import pandas as pd
from shapely.geometry import Point
from rapidfuzz import fuzz
from . import config as C, s1_batas, s3_pemkot
from .util import jalan_query, kompak, nama_inti, norm_jalan, upper_ascii

CACHE = C.INTERIM / "geocode_cache.json"
OUT = C.INTERIM / "pemkot_geocoded.csv"
RANK = {p: i for i, p in enumerate(C.PRESISI_URUT)}
POI_CLASS = {"amenity", "shop", "tourism", "leisure"}
KOLOM = ["geo_lat", "geo_lon", "geo_presisi", "geo_metode", "geo_label", "geo_skor_nama",
         "geo_n_kandidat", "geo_selisih_m", "geo_ditolak"]


# --------------------------------------------------------------------------- HTTP
class Geocoder:
    def __init__(self, bbox):
        import requests
        self.s = requests.Session()
        self.s.headers["User-Agent"] = C.USER_AGENT
        self.bbox = bbox                                   # minx, miny, maxx, maxy
        self.cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
        self.n_baru = 0
        self.gagal_beruntun = 0

    def simpan(self):
        CACHE.write_text(json.dumps(self.cache, ensure_ascii=False))

    def _get(self, url, params, key):
        if key in self.cache:
            return self.cache[key]
        if self.gagal_beruntun >= 5:
            raise RuntimeError("5x gagal berturut-turut: cek internet atau rate limit")
        time.sleep(C.GEOCODE_JEDA_DETIK)
        try:
            r = self.s.get(url, params=params, timeout=20)
            r.raise_for_status()
            js = r.json()
            self.gagal_beruntun = 0
        except Exception as e:
            self.gagal_beruntun += 1
            print(f"   ! {type(e).__name__} untuk {key[:70]}")
            return None                                    # tidak di-cache, dicoba lagi lain kali
        self.cache[key] = js
        self.n_baru += 1
        if self.n_baru % 25 == 0:
            self.simpan()
        return js

    def nominatim(self, q, box=None):
        minx, miny, maxx, maxy = box or self.bbox
        p = {"q": q, "format": "jsonv2", "limit": 5, "countrycodes": "id",
             "viewbox": f"{minx},{maxy},{maxx},{miny}", "bounded": 1}
        js = self._get(C.NOMINATIM_URL, p, f"N|{q}|{box}") or []
        return [dict(lat=float(h["lat"]), lon=float(h["lon"]),
                     cls=h.get("category", h.get("class", "")), typ=h.get("type", ""),
                     addrtype=h.get("addresstype", ""), name=h.get("name", ""),
                     label=h.get("display_name", ""), src="nominatim") for h in js]

    def photon(self, q, box=None):
        minx, miny, maxx, maxy = box or self.bbox
        p = {"q": q, "limit": 5, "bbox": f"{minx},{miny},{maxx},{maxy}"}
        js = self._get(C.PHOTON_URL, p, f"P|{q}|{box}") or {}
        out = []
        for f in js.get("features", []):
            pr, (lon, lat) = f["properties"], f["geometry"]["coordinates"]
            out.append(dict(lat=lat, lon=lon, cls=pr.get("osm_key", ""), typ=pr.get("osm_value", ""),
                            addrtype=pr.get("type", ""), name=pr.get("name", ""),
                            label=", ".join(str(pr[k]) for k in ("name", "street", "housenumber",
                                                                 "district") if pr.get(k)),
                            src="photon", housenumber=pr.get("housenumber", "")))
        return out


# --------------------------------------------------------------------------- helper
def jarak_m(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 2 * 6371000 * math.asin(math.sqrt(h))

def box_sekitar(lat, lon, r_m):
    dlat = r_m / 111_320
    dlon = r_m / (111_320 * math.cos(math.radians(lat)))
    return (lon - dlon, lat - dlat, lon + dlon, lat + dlat)

def presisi_alamat(h, punya_nomor):
    if (h["cls"] in {"building", "place"} and h["typ"] in {"house", "yes", "building"}) \
       or h["addrtype"] in {"building", "house"} or (h.get("housenumber") and punya_nomor):
        return "bangunan"
    if h["cls"] == "highway" or h["addrtype"] in {"road", "street"}:
        return "jalan"
    if h["cls"] in POI_CLASS:
        return "bangunan"                 # alamat jatuh tepat di sebuah POI
    return None

def cocok_nama(h, inti):
    if h["cls"] not in POI_CLASS or not h["name"]:
        return 0
    return fuzz.token_set_ratio(inti, nama_inti(h["name"]))


class Validator:
    def __init__(self, batas, kec):
        self.batas, self.kec = batas, kec

    def ok(self, lat, lon, kecamatan):
        p = Point(lon, lat)
        if not self.batas.contains(p):
            return False, "di_luar_kota"
        if self.kec is not None and kecamatan:
            k = self.kec[self.kec.kunci == kompak(kecamatan)]
            if len(k) and not k.geometry.iat[0].buffer(0.002).contains(p):   # toleransi ±200 m
                return False, "beda_kecamatan"
        return True, ""


# --------------------------------------------------------------------------- inti
def geocode_satu(r, g, v, rantai):
    kandidat, ditolak = [], []

    def tambah(h, presisi, metode, skor=None):
        ok, alasan = v.ok(h["lat"], h["lon"], r.kecamatan)
        if not ok:
            ditolak.append(f"{metode}:{alasan}")
            return False
        kandidat.append(dict(lat=h["lat"], lon=h["lon"], presisi=presisi, metode=metode,
                             label=h["label"], skor_nama=skor))
        return True

    def ada(*presisi):
        return any(k["presisi"] in presisi for k in kandidat)

    inti = r.nama_inti
    nama_q = upper_ascii(r.nama).title()
    punya_nomor = any(ch.isdigit() for ch in r.jalan)
    jq = jalan_query(r.jalan)
    wilayah = ", ".join(x.title() for x in (r.kelurahan, r.kecamatan) if x)

    # 1. alamat: dengan kelurahan/kecamatan dulu, lalu tanpa; Nominatim lalu Photon
    queries = [f"{jq}, {wilayah}, Kota Bandung"] if wilayah else []
    queries.append(f"{jq}, Kota Bandung")
    for q in queries:
        for fn in (g.nominatim, g.photon):
            for h in fn(q):
                pr = presisi_alamat(h, punya_nomor)
                # nama jalan hasil harus memang jalan yang dimaksud
                if pr and fuzz.partial_ratio(norm_jalan(r.jalan), upper_ascii(h["label"])) >= 80:
                    if tambah(h, pr, f"alamat_{h['src']}"):
                        break
            if ada("bangunan"):
                break
        if kandidat:
            break
    alamat_pt = None
    if kandidat:
        b = min(kandidat, key=lambda k: RANK[k["presisi"]])
        alamat_pt = (b["lat"], b["lon"])

    # 2. nama di sekitar alamat (kunci untuk rantai seperti Starbucks/Kopi Kenangan)
    if alamat_pt and inti:
        box = box_sekitar(*alamat_pt, C.POI_RADIUS_M)
        for fn in (g.nominatim, g.photon):
            hits = sorted(fn(nama_q, box), key=lambda h: -cocok_nama(h, inti))
            if hits and cocok_nama(hits[0], inti) >= C.POI_NAMA_MIN:
                if tambah(hits[0], "poi_dekat_alamat", f"nama_dekat_{hits[0]['src']}",
                          cocok_nama(hits[0], inti)):
                    break

    # 3. nama se-kota, hanya untuk yang bukan rantai dan hasilnya tidak ambigu
    if not ada("poi_dekat_alamat") and inti and not rantai:
        for fn in (g.nominatim, g.photon):
            hits = [h for h in fn(f"{nama_q}, Bandung") if cocok_nama(h, inti) >= max(C.POI_NAMA_MIN, 90)]
            lokasi = {(round(h["lat"], 3), round(h["lon"], 3)) for h in hits}
            if len(lokasi) == 1:
                h = hits[0]
                if alamat_pt and jarak_m(alamat_pt, (h["lat"], h["lon"])) > C.POI_KOTA_MAX_DARI_ALAMAT_M:
                    ditolak.append("nama_kota:jauh_dari_alamat")
                elif tambah(h, "poi", f"nama_kota_{h['src']}", cocok_nama(h, inti)):
                    break
            elif len(lokasi) > 1:
                ditolak.append(f"nama_kota:ambigu_{len(lokasi)}_lokasi")

    # 4. gedung / mall
    if r.gedung and not ada("poi_dekat_alamat", "poi", "bangunan"):
        for fn in (g.nominatim, g.photon):
            hits = [h for h in fn(f"{r.gedung.title()}, Bandung")
                    if fuzz.token_set_ratio(kompak(r.gedung), kompak(h["name"])) >= 85]
            if hits and tambah(hits[0], "gedung", f"gedung_{hits[0]['src']}"):
                break

    # 5. wilayah (cadangan, tidak masuk dataset final)
    if not kandidat:
        for lvl, nm in (("kelurahan", r.kelurahan), ("kecamatan", r.kecamatan)):
            if nm:
                hits = g.nominatim(f"{nm.title()}, Kota Bandung")
                if hits and tambah(hits[0], lvl, f"wilayah_{lvl}"):
                    break

    if not kandidat:
        return dict(zip(KOLOM, [None, None, "gagal", "", "", None, 0, None, ";".join(ditolak)]))
    kandidat.sort(key=lambda k: RANK[k["presisi"]])
    b = kandidat[0]
    # jarak kandidat terbaik ke kandidat kedua: indikator konsistensi antar-metode
    sel = round(jarak_m((b["lat"], b["lon"]), (kandidat[1]["lat"], kandidat[1]["lon"])), 1) \
        if len(kandidat) > 1 else None
    return dict(geo_lat=round(b["lat"], 7), geo_lon=round(b["lon"], 7), geo_presisi=b["presisi"],
                geo_metode=b["metode"], geo_label=b["label"], geo_skor_nama=b["skor_nama"],
                geo_n_kandidat=len(kandidat), geo_selisih_m=sel, geo_ditolak=";".join(ditolak))


def run(limit=None, ulang_gagal=False):
    df = s3_pemkot.load()
    batas = s1_batas.load()
    v = Validator(batas.union_all(), s1_batas.load_kecamatan())
    if v.kec is None:
        print("   (kecamatan_kota_bandung.geojson tidak ada: validasi kecamatan dilewati)")
    g = Geocoder(tuple(batas.total_bounds))

    # rantai = nama inti yang sama (atau jadi awalan nama lain, mis. "372" & "372 DAGO")
    # muncul di >1 jalan berbeda
    jl = df.jalan.map(norm_jalan)
    def n_jalan(inti):
        if not inti:
            return 1
        m = (df.nama_inti == inti) | df.nama_inti.str.startswith(inti + " ")
        return jl[m].nunique()
    df["rantai"] = df.nama_inti.map({n: n_jalan(n) for n in df.nama_inti.unique()}) > 1

    selesai = {}
    if OUT.exists():
        lama = pd.read_csv(OUT, keep_default_na=False)
        lewati = {"", "belum"} | ({"gagal"} if ulang_gagal else set())
        selesai = {r["id_pemkot"]: r for _, r in lama.iterrows() if r["geo_presisi"] not in lewati}

    koreksi = {}
    if C.KOREKSI_FILE.exists():
        koreksi = {r.id_pemkot: r for r in pd.read_csv(C.KOREKSI_FILE).itertuples()}

    todo = [i for i, r in df.iterrows() if r.id_pemkot not in selesai and r.id_pemkot not in koreksi]
    todo = todo[:limit] if limit else todo
    print(f"[4] geocode: {len(df)} tempat | {len(selesai)} sudah | {len(koreksi)} koreksi manual | "
          f"{len(todo)} diproses sekarang")

    hasil = {}
    try:
        for n, i in enumerate(todo, 1):
            hasil[i] = geocode_satu(df.loc[i], g, v, df.at[i, "rantai"])
            if n % 20 == 0:
                print(f"   {n}/{len(todo)}  ({g.n_baru} request baru)")
    except (KeyboardInterrupt, RuntimeError) as e:
        print(f"   berhenti: {e or 'Ctrl+C'}. Progres tersimpan; jalankan lagi untuk melanjutkan.")
    finally:
        g.simpan()

    rows = []
    for i, r in df.iterrows():
        if r.id_pemkot in koreksi:
            k = koreksi[r.id_pemkot]
            rows.append(dict(zip(KOLOM, [k.lat, k.lon, "manual", "koreksi_manual",
                                         getattr(k, "catatan", ""), None, 1, None, ""])))
        elif i in hasil:
            rows.append(hasil[i])
        elif r.id_pemkot in selesai:
            rows.append({c: selesai[r.id_pemkot][c] for c in KOLOM})
        else:
            rows.append(dict(zip(KOLOM, [None, None, "belum", "", "", None, 0, None, ""])))
    df = pd.concat([df.reset_index(drop=True), pd.DataFrame(rows)], axis=1)
    df.to_csv(OUT, index=False)

    vc = df.geo_presisi.value_counts()
    print("[4] presisi:", {p: int(vc[p]) for p in C.PRESISI_URUT + ["gagal", "belum"] if p in vc})
    layak = df.geo_presisi.isin(C.GEOCODE_PRESISI_OK).sum()
    print(f"    layak dipakai {sorted(C.GEOCODE_PRESISI_OK)}: {layak}/{len(df)}")
    review()


def review():
    """Daftar tempat yang perlu dicek manual + link peta OSM, untuk mengisi koreksi_koordinat.csv."""
    df = pd.read_csv(OUT, keep_default_na=False)
    df = df[df.kategori.isin(C.KATEGORI_FINAL | {"cafe_ambigu"})]
    perlu = df[~df.geo_presisi.isin(C.GEOCODE_PRESISI_OK)].copy()

    def link(r):
        if r.geo_lat not in ("", None):
            return f"https://www.openstreetmap.org/?mlat={r.geo_lat}&mlon={r.geo_lon}#map=18/{r.geo_lat}/{r.geo_lon}"
        return "https://www.openstreetmap.org/search?query=" + str(r.alamat_lengkap).replace(" ", "+")
    perlu["link_osm"] = perlu.apply(link, axis=1)
    perlu["lat"] = ""; perlu["lon"] = ""; perlu["catatan"] = ""
    out = C.FINAL / "perlu_review_koordinat.csv"
    perlu[["id_pemkot", "nama", "alamat_lengkap", "kategori", "geo_presisi", "geo_label",
           "geo_ditolak", "link_osm", "lat", "lon", "catatan"]].to_csv(out, index=False)
    print(f"    {len(perlu)} tempat perlu dicek manual -> data/final/{out.name}")


def load():
    if OUT.exists():
        return pd.read_csv(OUT, keep_default_na=False)
    df = s3_pemkot.load()
    return df.assign(**{c: None for c in KOLOM}, geo_presisi="belum")
