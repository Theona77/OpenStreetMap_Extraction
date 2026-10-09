# Cara pakai:  pip install osmium pandas
#              python lihat_cafe.py nama_file.osm.pbf
import sys, osmium, pandas as pd

pbf = sys.argv[1]
rows = []

class CafeHandler(osmium.SimpleHandler):
    def ambil(self, obj, tipe, lon, lat):
        t = dict(obj.tags)                      # semua tag OSM objek ini
        if t.get("amenity") == "cafe":           # <-- filter: hanya amenity=cafe
            rows.append({
                "osm_type": tipe, "osm_id": obj.id,
                "name": t.get("name", ""), "brand": t.get("brand", ""),
                "cuisine": t.get("cuisine", ""), "lat": lat, "lon": lon,
                "alamat": t.get("addr:street", ""), "semua_tag": t,
            })

    def node(self, n):                          # titik (cafe ditandai sebagai pin)
        self.ambil(n, "node", n.location.lon, n.location.lat)

    def way(self, w):                           # polygon (cafe digambar sebagai bangunan)
        try:
            pts = [(nd.lon, nd.lat) for nd in w.nodes]
            lon = sum(p[0] for p in pts) / len(pts)   # titik tengah kasar
            lat = sum(p[1] for p in pts) / len(pts)
        except osmium.InvalidLocationError:
            lon = lat = None
        self.ambil(w, "way", lon, lat)

    def relation(self, r):
        self.ambil(r, "relation", None, None)

CafeHandler().apply_file(pbf, locations=True)   # locations=True agar way punya koordinat
df = pd.DataFrame(rows)
print("Total amenity=cafe:", len(df))
print(df["osm_type"].value_counts())
print(df["name"].value_counts().head(15))
df.drop(columns="semua_tag").to_csv("cafe_bandung.csv", index=False)
print("Disimpan ke cafe_bandung.csv")
