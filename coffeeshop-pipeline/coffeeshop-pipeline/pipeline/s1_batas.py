"""Langkah 1: batas administrasi Kota Bandung dari OSM (relation, bukan bbox)."""
import geopandas as gpd
from . import config as C

def run():
    import osmnx as ox
    ox.settings.http_user_agent = C.USER_AGENT
    gdf = ox.geocode_to_gdf(f"R{C.BATAS_OSM_RELATION}", by_osmid=True)
    gdf[["geometry"]].assign(nama="Kota Bandung").to_file(C.BATAS_FILE, driver="GeoJSON")
    kec = ox.features_from_polygon(gdf.geometry.iat[0],
                                   {"boundary": "administrative", "admin_level": "6"})
    kec = kec[kec.geom_type.isin(["Polygon", "MultiPolygon"])].reset_index()
    kec = kec[kec.representative_point().within(gdf.geometry.iat[0])]
    kec[["name", "geometry"]].rename(columns={"name": "kecamatan"}).to_file(C.KECAMATAN_FILE, driver="GeoJSON")
    print(f"[1] {len(kec)} kecamatan -> {C.KECAMATAN_FILE.name} (Kota Bandung punya 30)")
    luas = gdf.to_crs(C.CRS_METER).area.iat[0] / 1e6
    print(f"[1] batas Kota Bandung: {luas:.1f} km² -> {C.BATAS_FILE.name}")

def load():
    if not C.BATAS_FILE.exists():
        raise SystemExit("Batas kota belum ada. Jalankan: python run.py batas")
    return gpd.read_file(C.BATAS_FILE).to_crs(4326)


def load_kecamatan():
    if not C.KECAMATAN_FILE.exists():
        return None
    k = gpd.read_file(C.KECAMATAN_FILE).to_crs(4326)
    from .util import kompak
    k["kunci"] = k.kecamatan.map(kompak)
    return k
