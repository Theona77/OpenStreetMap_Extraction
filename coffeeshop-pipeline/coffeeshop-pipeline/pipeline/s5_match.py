"""Langkah 5: cocokkan Pemkot <-> OSM.
  A. spasial  : titik geocode Pemkot dekat (<= MATCH_RADIUS_M) OSM dengan nama mirip
  B. nama saja: nama inti unik di kedua sumber & nyaris identik (untuk yang gagal geocode)
Rantai (nama sama muncul >1 kali, mis. Starbucks) hanya boleh lewat A."""
import pandas as pd, geopandas as gpd
from rapidfuzz import fuzz, process
from . import config as C, s2_osm, s4_geocode
from .util import norm_jalan

OUT = C.INTERIM / "match.csv"

def skor(a, b):
    return fuzz.token_set_ratio(a, b) if a and b else 0

def run():
    pk = s4_geocode.load()
    osm = s2_osm.load()
    osm = osm[~osm.dup_dibuang].reset_index(drop=True)
    om = osm.to_crs(C.CRS_METER)
    hasil = []

    # A. spasial
    # titik tengah kelurahan/kecamatan terlalu kasar untuk dicocokkan
    ada = pk[pd.to_numeric(pk.geo_lat, errors="coerce").notna()
             & ~pk.geo_presisi.isin(["kelurahan", "kecamatan"])]
    pts = gpd.GeoSeries(gpd.points_from_xy(ada.geo_lon.astype(float), ada.geo_lat.astype(float)),
                        index=ada.index, crs=4326).to_crs(C.CRS_METER)
    for i, p in pts.items():
        dekat = om[om.distance(p) <= C.MATCH_RADIUS_M]
        if dekat.empty:
            continue
        s = dekat.nama_inti.map(lambda n: skor(pk.at[i, "nama_inti"], n))
        j = s.idxmax()
        if s[j] >= C.MATCH_NAME_MIN:
            hasil.append((i, j, "spasial", s[j], round(dekat.distance(p)[j], 1)))

    # B. nama saja, hanya untuk nama unik di kedua sisi
    sudah_pk = {h[0] for h in hasil}
    sudah_osm = {h[1] for h in hasil}
    # "rantai" di Pemkot = nama inti yang sama muncul di lebih dari 1 jalan berbeda
    cnt_pk = pk.assign(j=pk.alamat_norm.map(norm_jalan)).groupby("nama_inti").j.nunique()
    cnt_osm = osm.nama_inti.value_counts()
    kand = osm[osm.nama_inti.map(cnt_osm) == 1]
    pilihan = dict(zip(kand.index, kand.nama_inti))
    for i, r in pk.iterrows():
        if i in sudah_pk or cnt_pk[r.nama_inti] > 1 or not r.nama_inti:
            continue
        m = process.extractOne(r.nama_inti, pilihan, scorer=fuzz.ratio,
                               score_cutoff=C.MATCH_NAME_ONLY_MIN)
        if not m or m[2] in sudah_osm:
            continue
        j = m[2]
        # kalau OSM punya nama jalan, jalannya harus cocok juga
        js = osm.at[j, "addr_street"]
        if js and skor(norm_jalan(js), norm_jalan(r.alamat_norm)) < 80:
            continue
        hasil.append((i, j, "nama", m[1], None)); sudah_osm.add(j)

    mt = pd.DataFrame(hasil, columns=["pk_idx", "osm_idx", "metode", "skor_nama", "jarak_m"])
    mt = mt.sort_values("skor_nama", ascending=False).drop_duplicates("osm_idx")  # 1 OSM : 1 Pemkot
    mt["osm_key"] = osm.loc[mt.osm_idx, "osm_key"].values
    mt.to_csv(OUT, index=False)
    print(f"[5] match: {len(mt)} pasangan ({mt.metode.value_counts().to_dict()})")

def load():
    return pd.read_csv(OUT)
