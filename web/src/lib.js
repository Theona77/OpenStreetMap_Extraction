// Logika murni (tanpa React/Leaflet) supaya bisa diuji dengan `npm test`.

export const KELAS = {
  potensial: { label: "Kawasan potensial", warna: "#1a9850" },
  kompetitif: { label: "Kawasan kompetitif", warna: "#d73027" },
  rendah: { label: "Kawasan potensi rendah", warna: "#bdbdbd" },
  noise: { label: "Tidak terklasifikasi (noise)", warna: "#ffffff" },
};

export const ALGORITMA = {
  km: "K-Means",
  hdb: "HDBSCAN",
};

export const FITUR = {
  d_kopi_1: { label: "Jarak ke coffee shop terdekat", satuan: "m", blok: "KNN" },
  d_kopi_3: { label: "Rata-rata jarak 3 coffee shop terdekat", satuan: "m", blok: "KNN" },
  d_kampus: { label: "Jarak ke kampus terdekat", satuan: "m", blok: "KNN" },
  d_sekolah: { label: "Jarak ke sekolah terdekat", satuan: "m", blok: "KNN" },
  d_kantor: { label: "Jarak ke kantor terdekat", satuan: "m", blok: "KNN" },
  d_belanja: { label: "Jarak ke pusat perbelanjaan terdekat", satuan: "m", blok: "KNN" },
  kde_kopi: { label: "Kepadatan coffee shop (kompetitor)", satuan: "titik/km²", blok: "KDE" },
  kde_kampus: { label: "Kepadatan kampus", satuan: "titik/km²", blok: "KDE" },
  kde_sekolah: { label: "Kepadatan sekolah", satuan: "titik/km²", blok: "KDE" },
  kde_kantor: { label: "Kepadatan perkantoran", satuan: "titik/km²", blok: "KDE" },
  kde_belanja: { label: "Kepadatan pusat perbelanjaan", satuan: "titik/km²", blok: "KDE" },
  penduduk_km2: { label: "Kepadatan penduduk", satuan: "jiwa/km²", blok: "Demografi" },
  d_jalan_utama: { label: "Jarak ke jalan utama", satuan: "m", blok: "Aksesibilitas" },
  kerapatan_jalan: { label: "Kerapatan jalan (radius 500 m)", satuan: "km/km²", blok: "Aksesibilitas" },
};

export const FASILITAS = {
  kampus: { label: "Kampus", warna: "#6a3d9a" },
  sekolah: { label: "Sekolah", warna: "#1f78b4" },
  kantor: { label: "Perkantoran", warna: "#ff7f00" },
  belanja: { label: "Pusat perbelanjaan", warna: "#e7298a" },
};

const PALET_CLUSTER = ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d", "#666666"];
export const warnaCluster = (c) => (c === -1 ? "#ffffff" : PALET_CLUSTER[c % PALET_CLUSTER.length]);

// Palet sekuensial 5 kelas (YlOrRd)
export const PALET_SEKUENSIAL = ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"];

/** Batas kuantil (20/40/60/80%) dari sebuah array angka. */
export function batasKuantil(nilai, n = 5) {
  const s = [...nilai].filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return [];
  return Array.from({ length: n - 1 }, (_, i) => s[Math.floor(((i + 1) / n) * (s.length - 1))]);
}

export function kelasKuantil(v, batas) {
  let i = 0;
  while (i < batas.length && v > batas[i]) i++;
  return i;
}

/** Persentil (0–100) nilai v dalam array terurut. */
export function persentil(v, terurut) {
  if (!terurut.length) return null;
  let lo = 0, hi = terurut.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (terurut[mid] <= v) lo = mid + 1; else hi = mid;
  }
  return Math.round((100 * lo) / terurut.length);
}

/** Jarak haversine dalam meter. */
export function jarakM(lat1, lon1, lat2, lon2) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Sel terdekat dari sebuah titik; null kalau lebih jauh dari maksM (di luar kota). */
export function selTerdekat(sel, lat, lon, maksM = 350) {
  let best = null, dBest = Infinity;
  for (const s of sel) {
    const d = jarakM(lat, lon, s.lat, s.lon);
    if (d < dBest) { dBest = d; best = s; }
  }
  return dBest <= maksM ? best : null;
}

/**
 * Rekomendasi: sel berkelas "potensial" (menurut algoritma) dalam radius dari titik,
 * diurutkan berdasarkan skor peluang tertinggi (KNN berbasis radius, jarak haversine).
 */
export function rekomendasi(sel, lat, lon, alg, radiusM = 2000, topN = 5) {
  return sel
    .filter((s) => s[`kelas_${alg}`] === "potensial")
    .map((s) => ({ ...s, jarak_m: jarakM(lat, lon, s.lat, s.lon) }))
    .filter((s) => s.jarak_m <= radiusM)
    .sort((a, b) => b.skor_peluang - a.skor_peluang || a.jarak_m - b.jarak_m)
    .slice(0, topN);
}

/** k titik terdekat (mis. coffee shop) dari sebuah lokasi. */
export function kTerdekat(titik, lat, lon, k = 3) {
  return titik
    .map((t) => ({ ...t, jarak_m: jarakM(lat, lon, t.lat, t.lon) }))
    .sort((a, b) => a.jarak_m - b.jarak_m)
    .slice(0, k);
}

export const fmt = (v, d = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? "–" : Number(v).toLocaleString("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d });
