import re, unicodedata

GENERIK = {"COFFEE", "COFFE", "KOFFIE", "KOPI", "CAFE", "KAFE", "SHOP", "HOUSE", "AND",
           "THE", "BANDUNG", "BDG", "BY", "CO", "ROASTERY", "ROASTER", "ROASTERS", "KEDAI",
           "SPACE", "BAR", "EATERY", "N"}

def upper_ascii(s) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s.upper()).strip()

def nama_inti(s) -> str:
    """'KOPI KENANGAN - DAGO' -> 'KENANGAN'. Dipakai untuk matching nama."""
    s = upper_ascii(s)
    s = re.split(r"\s[-|(]\s?|\s@\s", s)[0]           # buang suffix cabang
    tok = [t for t in re.split(r"[^A-Z0-9]+", s) if t and t not in GENERIK]
    return " ".join(tok) or re.sub(r"[^A-Z0-9 ]", "", s)

def norm_alamat(a) -> str:
    a = upper_ascii(a).replace(" - ", ", ")
    a = re.split(r"\s?[-,]\s?(?:KEC\.|KECAMATAN|KOTA BANDUNG|KEL\.|KELURAHAN)", a)[0]
    a = re.sub(r"^(JALAN|JLN)\b\.?", "JL.", a)
    a = re.sub(r"\bJL\b\.?\s*", "JL. ", a)
    a = re.sub(r"\bNO\b\s*\.?\s*", "NO.", a)            # "NO. 50" / "NO 50" -> "NO.50"
    m = re.match(r"^(.*?NO\.[\w\-/]+)", a)
    return re.sub(r"\s+", " ", (m.group(1) if m else a).replace(" .", ".")).strip(" ,-")

def norm_jalan(a) -> str:
    """'JL. IR. H. JUANDA NO.21' -> 'IR H JUANDA' (untuk membandingkan nama jalan)."""
    a = upper_ascii(a)
    a = re.sub(r"^(JL|JALAN|JLN)\b\.?\s*", "", a)
    a = re.split(r"\bNO\b", a)[0]
    return " ".join(re.sub(r"[^A-Z0-9 ]", " ", a).split())


GEDUNG = (r"MALL|PLAZA|\bWALK\b|SQUARE|\bITC\b|\bBEC\b|PASKAL|TRANS STUDIO|PARIS VAN JAVA|\bPVJ\b|"
          r"\bBIP\b|CITYLINK|SUMMARECON|HOTEL|APARTEMEN|APARTMENT|TOWER|GEDUNG|GRAHA|RUKO|"
          r"UNIVERSITAS|KAMPUS|STASIUN|BANDARA|\bPASAR\b|MARKET")

def kompak(s) -> str:
    return re.sub(r"[^A-Z0-9]", "", upper_ascii(s))

def parse_alamat(a) -> dict:
    """Pecah alamat Pemkot jadi komponen. Format 2022-2023:
    'JL. X NO.1, KELURAHAN, KEC. Y, KOTA BANDUNG, JAWA BARAT 40xxx'."""
    a = upper_ascii(a)
    kodepos = (re.search(r"\b(40\d{3})\b", a) or [None, ""])[1]
    seg = [t.strip(" .") for t in re.split(r",|\s-\s", a) if t.strip(" .")]
    kec = kel = gedung = ""
    jalan = next((t for t in seg if re.match(r"^(JL|JALAN|JLN|GG|GANG|KOMP|KOMPLEK|PERUM)\b", t)), "")
    for i, t in enumerate(seg):
        m = re.match(r"^(?:KEC|KECAMATAN)\b\.?\s*(.+)$", t)
        if m:
            kec = m.group(1).strip()
            if i > 0 and seg[i-1] != jalan and not re.search(r"\bNO\b|\d", seg[i-1]):
                kel = re.sub(r"^(?:KEL|KELURAHAN)\b\.?\s*", "", seg[i-1])
    for t in seg:
        if t != jalan and re.search(GEDUNG, t) and not re.match(r"^(KEC|KOTA|JAWA)", t):
            g, prev = t, None
            while g != prev:                       # buang "LT. 2", "UNIT 5", "GF" di depan
                prev = g
                g = re.sub(r"^(GF|LG|UG|LT\.?\s*\w+|LANTAI\s*\w+|UNIT\s*\S+|BLOK\s*\S+|NO\.?\s*\S+)\s*", "", g)
            gedung = g; break
    if not jalan:
        jalan = norm_alamat(a)
    return {"jalan": jalan, "kelurahan": kel, "kecamatan": kec, "kodepos": kodepos, "gedung": gedung}

def jalan_query(j) -> str:
    """'JL. IR. H. JUANDA NO.21' -> 'Jalan Ir. H. Juanda 21' (lebih dikenali Nominatim/Photon)."""
    j = re.sub(r"^(JL|JLN)\b\.?\s*", "JALAN ", upper_ascii(j))
    j = re.sub(r"^GG\b\.?\s*", "GANG ", j)
    j = re.sub(r"^(.*?\bNO\b\.?\s*[0-9][\w\-/]*).*$", r"\1", j)   # buang sisa setelah nomor
    j = re.sub(r"\bNO\b\.?\s*", "", j)
    j = re.sub(r"(\d+)\s*[-/]\s*\d+\w*", r"\1", j)     # "131-139" -> "131"
    return re.sub(r"\s+", " ", j).strip().title()
