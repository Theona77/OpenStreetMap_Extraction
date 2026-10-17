"""Langkah 2: POI coffee shop dari OSM (Overpass atau file .osm.pbf lokal)."""
import json, re
from datetime import datetime, timezone
import pandas as pd, geopandas as gpd
from shapely.geometry import Point
from . import config as C, s1_batas
from .util import nama_inti, upper_ascii

OUT = C.INTERIM / "osm_cafe.geojson"
TAGS = ["name", "brand", "cuisine", "opening_hours", "addr:street", "addr:housenumber"]

def is_coffee(t):
    return t.get("amenity") == "cafe" or t.get("cuisine", "").split(";")[0] == "coffee_shop"

def rec(tipe, oid, tags, lon, lat):
    r = {"osm_type": tipe, "osm_id": oid, "geometry": Point(lon, lat)}
    r.update({k.replace("addr:", "addr_"): tags.get(k, "") for k in TAGS})
    r["semua_tag"] = json.dumps(dict(tags), ensure_ascii=False)
    return r

def from_overpass(batas):
    import requests
    minx, miny, maxx, maxy = batas.total_bounds
    bb = f"{miny-0.01},{minx-0.01},{maxy+0.01},{maxx+0.01}"
    q = f"""[out:json][timeout:180];
    ( nwr["amenity"="cafe"]({bb}); nwr["cuisine"~"^coffee_shop"]({bb}); );
    out center tags;"""
    r = requests.post(C.OVERPASS_URL, data={"data": q},
                      headers={"User-Agent": C.USER_AGENT}, timeout=300)
    r.raise_for_status()
    js = r.json()
    rows = []
    for e in js["elements"]:
        t = e.get("tags", {})
        if not is_coffee(t):
            continue
        lon, lat = (e["lon"], e["lat"]) if e["type"] == "node" else \
                   (e["center"]["lon"], e["center"]["lat"])
        rows.append(rec(e["type"], e["id"], t, lon, lat))
    return rows, js["osm3s"]["timestamp_osm_base"]

def from_pbf(path):
    import osmium
    from shapely import wkb
    fac, rows = osmium.geom.WKBFactory(), []
    class H(osmium.SimpleHandler):
        def node(self, n):
            if is_coffee(n.tags):
                rows.append(rec("node", n.id, n.tags, n.location.lon, n.location.lat))
        def area(self, a):
            if not is_coffee(a.tags):
                return
            try:
                g = gpd.GeoSeries([wkb.loads(fac.create_multipolygon(a), hex=True)], crs=4326)
            except Exception:
                return
            c = g.to_crs(C.CRS_METER).centroid.to_crs(4326).iat[0]
            rows.append(rec("way" if a.from_way() else "relation", a.orig_id(), a.tags, c.x, c.y))
    H().apply_file(str(path), locations=True)
    hdr = osmium.io.Reader(str(path), osmium.osm.osm_entity_bits.NOTHING).header()
    return rows, hdr.get("osmosis_replication_timestamp") or "tidak diketahui"

def flag_non_kopi(r):
    c = set(r["cuisine"].split(";")) - {""}
    if "coffee_shop" in c:
        return False
    return bool(c & C.OSM_NON_KOPI_CUISINE) or bool(re.search(C.OSM_NON_KOPI_NAMA, upper_ascii(r["name"])))

def run(source=None):
    source = source or C.OSM_SOURCE
    batas = s1_batas.load()
    rows, snap = from_overpass(batas) if source == "overpass" else from_pbf(source)
    gdf = gpd.GeoDataFrame(rows, crs=4326)
    n0 = len(gdf)
    gdf = gdf[gdf.within(batas.union_all())].copy()
    gdf["osm_key"] = gdf.osm_type + "/" + gdf.osm_id.astype(str)
    gdf["nama_inti"] = gdf["name"].map(nama_inti)
    gdf["flag_non_kopi"] = gdf.apply(flag_non_kopi, axis=1)

    # duplikat internal OSM: nama inti sama & < DUP_RADIUS_M. Simpan node, buang yang lain
    m = gdf.to_crs(C.CRS_METER)
    named = m[m.nama_inti != ""]
    p = gpd.sjoin_nearest(named, named, max_distance=C.DUP_RADIUS_M, exclusive=True)
    p = p[p.nama_inti_left == p.nama_inti_right]
    gdf["dup_dengan"] = ""
    for idx, r in p.iterrows():
        gdf.at[idx, "dup_dengan"] = r.osm_key_right
    rank = gdf.osm_type.map({"node": 0, "way": 1, "relation": 2})
    gdf["dup_dibuang"] = False
    seen = set()
    for idx in rank.sort_values().index:
        k, d = gdf.at[idx, "osm_key"], gdf.at[idx, "dup_dengan"]
        if d and d in seen:
            gdf.at[idx, "dup_dibuang"] = True
        seen.add(k)

    gdf["snapshot_osm"] = str(snap) + " "   # spasi: cegah GeoJSON mengubahnya jadi datetime
    gdf.to_file(OUT, driver="GeoJSON")
    print(f"[2] OSM ({source}): {n0} objek, {len(gdf)} di dalam Kota Bandung, "
          f"{gdf.flag_non_kopi.sum()} non-kopi, {gdf.dup_dibuang.sum()} duplikat. snapshot {snap}")

def load():
    return gpd.read_file(OUT)
