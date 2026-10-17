"""Langkah 6: gabungkan jadi dataset final + laporan + metadata."""
import json
from datetime import datetime, timezone
import pandas as pd, geopandas as gpd
from . import config as C, s1_batas, s2_osm, s4_geocode, s5_match

def run():
    pk = s4_geocode.load()
    osm = s2_osm.load()
    osm = osm[~osm.dup_dibuang].reset_index(drop=True)
    mt = s5_match.load()
    batas = s1_batas.load().union_all()

    osm_ll = osm.assign(lon=osm.geometry.x, lat=osm.geometry.y)
    pk = pk.merge(mt[["pk_idx", "osm_idx", "metode", "skor_nama"]],
                  left_index=True, right_on="pk_idx", how="left").set_index("pk_idx", drop=False)

    rows = []
    for _, r in pk.iterrows():
        o = osm_ll.loc[int(r.osm_idx)] if pd.notna(r.osm_idx) else None
        kat = r.kategori
        # cafe_ambigu naik kelas kalau OSM-nya jelas coffee shop
        if kat == "cafe_ambigu" and o is not None and "coffee_shop" in o.cuisine:
            kat = "kopi_utama"
        if o is not None and o.flag_non_kopi:
            kat = "non_kopi"
        if o is not None:
            lat, lon, src = o.lat, o.lon, "osm"
        elif r.geo_presisi in C.GEOCODE_PRESISI_OK:
            lat, lon, src = float(r.geo_lat), float(r.geo_lon), f"geocode_{r.geo_presisi}"
        else:
            lat = lon = None; src = f"tanpa_koordinat({r.geo_presisi})"
        rows.append(dict(nama=r.nama, alamat=r.alamat_asli, kategori=kat,
                         sumber="pemkot+osm" if o is not None else "pemkot",
                         id_pemkot=r.id_pemkot, osm_key=o.osm_key if o is not None else "",
                         match_metode=r.metode if o is not None else "",
                         tahun_pertama=r.tahun_pertama, tahun_terakhir=r.tahun_terakhir,
                         cuisine_osm=o.cuisine if o is not None else "",
                         lat=lat, lon=lon, sumber_koordinat=src,
                         geo_presisi=r.geo_presisi, geo_metode=r.geo_metode))

    # OSM yang tidak ada di Pemkot
    terpakai = set(mt.osm_idx)
    for j, o in osm_ll.iterrows():
        if j in terpakai:
            continue
        rows.append(dict(nama=o["name"] or "(tanpa nama)", alamat=o.addr_street,
                         kategori="non_kopi" if o.flag_non_kopi else "osm_cafe",
                         sumber="osm", id_pemkot=None, osm_key=o.osm_key, match_metode="",
                         tahun_pertama=None, tahun_terakhir=None, cuisine_osm=o.cuisine,
                         lat=o.lat, lon=o.lon, sumber_koordinat="osm",
                         geo_presisi="", geo_metode=""))

    df = pd.DataFrame(rows)
    ada = df.lat.notna()
    g = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df.lon, df.lat), crs=4326)
    df["di_kota_bandung"] = False
    df.loc[ada, "di_kota_bandung"] = g[ada].within(batas)
    df["masuk_final"] = (df.kategori.isin(C.KATEGORI_FINAL)
                         & df.di_kota_bandung & (df.nama != "(tanpa nama)"))

    df.to_csv(C.FINAL / "coffeeshop_bandung_semua.csv", index=False)   # untuk audit
    fin = gpd.GeoDataFrame(df[df.masuk_final], geometry=gpd.points_from_xy(
        df[df.masuk_final].lon, df[df.masuk_final].lat), crs=4326)
    fin.to_file(C.FINAL / "coffeeshop_bandung.geojson", driver="GeoJSON")
    fin.drop(columns="geometry").to_csv(C.FINAL / "coffeeshop_bandung.csv", index=False)

    meta = {
        "dibuat": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "snapshot_osm": str(osm.snapshot_osm.iat[0]) if len(osm) else None,
        "sumber": ["Disbudpar Kota Bandung (Open Data Kota Bandung)", "© OpenStreetMap contributors (ODbL)"],
        "kategori_final": sorted(C.KATEGORI_FINAL),
        "jumlah": {
            "total_kandidat": len(df), "final": int(df.masuk_final.sum()),
            "per_sumber_final": df[df.masuk_final].sumber.value_counts().to_dict(),
            "per_kategori_semua": df.kategori.value_counts().to_dict(),
            "sumber_koordinat_semua": df.sumber_koordinat.value_counts().to_dict(),
        },
    }
    (C.FINAL / "metadata.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    print(f"[6] final: {meta['jumlah']['final']} coffee shop -> data/final/coffeeshop_bandung.(csv|geojson)")
    print(json.dumps(meta["jumlah"], indent=2, ensure_ascii=False))


def sampel(n=30, seed=42):
    """Sampel acak per kategori untuk validasi manual (isi kolom label_manual)."""
    df = pd.read_csv(C.FINAL / "coffeeshop_bandung_semua.csv")
    s = pd.concat([g.sample(min(n, len(g)), random_state=seed)
                   for _, g in df.groupby("kategori")])
    s = s[["kategori", "nama", "alamat", "sumber", "cuisine_osm", "lat", "lon"]].assign(
        label_manual="", catatan="")
    out = C.FINAL / "sampel_validasi.csv"
    s.to_csv(out, index=False)
    print(f"[v] {len(s)} baris -> {out.name}. Label: coffee_shop / bukan, lalu hitung akurasi per kategori.")
