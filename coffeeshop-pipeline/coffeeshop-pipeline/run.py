"""Pipeline dataset coffee shop Kota Bandung.

  python run.py all                  # semua langkah, OSM via Overpass
  python run.py all --pbf file.pbf   # pakai file PBF lokal
  python run.py <langkah>            # batas | osm | pemkot | geocode | match | final | sampel | review
  python run.py geocode --limit 100  # geocode bertahap (cache otomatis, Ctrl+C aman)
  python run.py geocode --ulang-gagal
"""
import argparse
from pipeline import s1_batas, s2_osm, s3_pemkot, s4_geocode, s5_match, s6_final

ap = argparse.ArgumentParser()
ap.add_argument("langkah", choices=["all", "batas", "osm", "pemkot", "geocode", "match", "final", "sampel", "review"])
ap.add_argument("--pbf"); ap.add_argument("--limit", type=int)
ap.add_argument("--skip-geocode", action="store_true")
ap.add_argument("--ulang-gagal", action="store_true", help="geocode ulang yang sebelumnya gagal")
a = ap.parse_args()

steps = {"batas": s1_batas.run, "osm": lambda: s2_osm.run(a.pbf),
         "pemkot": s3_pemkot.run, "geocode": lambda: s4_geocode.run(a.limit, a.ulang_gagal), "review": s4_geocode.review,
         "match": s5_match.run, "final": s6_final.run, "sampel": s6_final.sampel}
urut = [k for k in steps if k not in ("sampel", "review")] if a.langkah == "all" else [a.langkah]
if a.skip_geocode and "geocode" in urut:
    urut.remove("geocode")
for s in urut:
    steps[s]()
