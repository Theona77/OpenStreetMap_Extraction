"""Langkah 3: bersihkan & klasifikasikan data Disbudpar Kota Bandung."""
import re
import pandas as pd
from . import config as C
from .util import upper_ascii, norm_alamat, nama_inti, parse_alamat

OUT = C.INTERIM / "pemkot_cafe.csv"

def kategori(nama):
    kopi = re.search(C.KOPI, nama) is not None
    if re.search(C.NON_KOPI, nama) and not kopi:
        return "non_kopi"
    if kopi and re.search(C.HYBRID, nama):
        return "kopi_hybrid"
    if kopi:
        return "kopi_utama"
    if re.search(C.HYBRID, nama):
        return "non_kopi"            # "CAFE & RESTO" tanpa kata kopi
    return "cafe_ambigu"

def run():
    df = pd.read_csv(C.PEMKOT_CSV)
    n_raw = len(df)
    df["nama"] = df.nama_rumah_makan.map(upper_ascii)
    df = df[df.nama.str.contains(C.KOPI + "|" + C.CAFE.replace("É", "E"))
            & ~df.nama.str.contains(C.EXCLUDE)].copy()
    df["alamat_norm"] = df.alamat.map(norm_alamat)
    df["_len"] = df.alamat.str.len()
    lengkap = (df.sort_values("_len").groupby(["nama", "alamat_norm"]).alamat.last()
                 .rename("alamat_lengkap"))          # versi alamat dengan info terbanyak
    df = (df.sort_values("tahun")
            .groupby(["nama", "alamat_norm"], as_index=False)
            .agg(tahun_pertama=("tahun", "min"), tahun_terakhir=("tahun", "max"),
                 n_tahun=("tahun", "nunique"), alamat_asli=("alamat", "last"),
                 id_pemkot=("id", "first")))
    df = df.merge(lengkap, on=["nama", "alamat_norm"])
    for c in ("alamat_asli", "alamat_lengkap"):
        df[c] = df[c].str.replace(r"\s+", " ", regex=True)
    df = df.join(pd.DataFrame(df.alamat_lengkap.map(parse_alamat).tolist(), index=df.index))
    df["kategori"] = df.nama.map(kategori)
    df["nama_inti"] = df.nama.map(nama_inti)
    df.to_csv(OUT, index=False)
    print(f"[3] Pemkot: {n_raw} baris mentah -> {len(df)} tempat unik "
          f"({df.kategori.value_counts().to_dict()})")

def load():
    return pd.read_csv(OUT, keep_default_na=False)
