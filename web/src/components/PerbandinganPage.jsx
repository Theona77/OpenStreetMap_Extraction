import { KELAS, fmt } from "../lib.js";

// arah: 1 = makin besar makin baik, -1 = makin kecil makin baik, 0 = informasi
const METRIK = [
  ["n_cluster", "Jumlah cluster", 0, 0],
  ["noise_pct", "Noise (% sel)", -1, 1],
  ["silhouette", "Silhouette", 1, 3],
  ["davies_bouldin", "Davies-Bouldin", -1, 3],
  ["calinski_harabasz", "Calinski-Harabasz", 1, 1],
  ["z_spasial", "Koherensi spasial (z)", 1, 1],
  ["ARI_mean", "Stabilitas bootstrap (ARI)", 1, 3],
  ["AUC_holdout", "AUC hold-out 5-fold", 1, 3],
  ["AUC_temporal", "AUC validasi temporal", 1, 3],
];

function Pemenang({ a, b, arah }) {
  if (!arah || a == null || b == null) return null;
  return (arah > 0 ? a > b : a < b) ? "◀" : a === b ? "=" : "▶";
}

export default function PerbandinganPage({ meta }) {
  const ev = meta.evaluasi;
  const utama = meta.parameter.set_utama;
  const km = ev.find((r) => r.set_fitur === utama && r.algoritma === "K-Means");
  const hdb = ev.find((r) => r.set_fitur === utama && r.algoritma === "HDBSCAN");
  const sets = [...new Set(ev.map((r) => r.set_fitur))];
  const kesepakatan = meta.kesepakatan;
  const kolomHdb = Object.keys(kesepakatan[0]).filter((k) => k !== "K-Means");

  return (
    <div className="halaman">
      <h2>Perbandingan K-Means vs HDBSCAN (set fitur {utama})</h2>
      <p className="catatan">Metrik internal untuk HDBSCAN dihitung tanpa sel noise. AUC: 0,5 = setara tebakan acak, 1 = sempurna.</p>
      <table className="data">
        <thead><tr><th>Metrik</th><th>K-Means</th><th></th><th>HDBSCAN</th></tr></thead>
        <tbody>
          <tr><td>Parameter</td><td>{km.parameter}</td><td></td><td>{hdb.parameter}</td></tr>
          {METRIK.map(([k, l, arah, d]) => (
            <tr key={k}>
              <td>{l}{arah ? <span className="abu"> ({arah > 0 ? "↑" : "↓"} lebih baik)</span> : null}</td>
              <td className="angka">{fmt(km[k], d)}</td>
              <td className="tengah"><Pemenang a={km[k]} b={hdb[k]} arah={arah} /></td>
              <td className="angka">{fmt(hdb[k], d)}</td>
            </tr>
          ))}
          <tr>
            <td>Coffee shop baru (2023–2024) di kawasan potensial + kompetitif</td>
            <td className="angka">{fmt(km.pct_baru_di_potensial_kompetitif, 1)}% <span className="abu">(luas {fmt(km.pct_luas_potensial_kompetitif, 1)}%)</span></td><td></td>
            <td className="angka">{fmt(hdb.pct_baru_di_potensial_kompetitif, 1)}% <span className="abu">(luas {fmt(hdb.pct_luas_potensial_kompetitif, 1)}%)</span></td>
          </tr>
        </tbody>
      </table>

      <h2>Ablation: pengaruh blok fitur</h2>
      <table className="data">
        <thead>
          <tr><th>Set fitur</th><th>Algoritma</th><th>Cluster</th><th>Noise %</th><th>Silhouette</th><th>DBI</th><th>z spasial</th><th>ARI</th></tr>
        </thead>
        <tbody>
          {sets.flatMap((s) => ev.filter((r) => r.set_fitur === s).map((r) => (
            <tr key={s + r.algoritma} className={s === utama ? "sorot" : ""}>
              <td>{s}</td><td>{r.algoritma}</td>
              <td className="angka">{r.n_cluster}</td><td className="angka">{fmt(r.noise_pct, 1)}</td>
              <td className="angka">{fmt(r.silhouette, 3)}</td><td className="angka">{fmt(r.davies_bouldin, 3)}</td>
              <td className="angka">{fmt(r.z_spasial, 1)}</td><td className="angka">{fmt(r.ARI_mean, 3)}</td>
            </tr>
          )))}
        </tbody>
      </table>

      <h2>Profil cluster</h2>
      {Object.entries(meta.profil).map(([alg, prof]) => (
        <div key={alg}>
          <h3>{alg}</h3>
          <table className="data">
            <thead>
              <tr><th>Cluster</th><th>Kawasan</th><th>Sel</th><th>km²</th><th>Coffee shop</th><th>Jarak kopi terdekat (m)</th>
                <th>Penduduk/km²</th><th>Ind. pendukung</th><th>Ind. kompetisi</th><th>Skor peluang</th><th>Kecamatan utama</th></tr>
            </thead>
            <tbody>
              {prof.map((p) => (
                <tr key={p.cluster}>
                  <td className="angka">{p.cluster}</td>
                  <td><span className="kotak" style={{ background: KELAS[p.kelas].warna }} /> {KELAS[p.kelas].label}</td>
                  <td className="angka">{p.n_sel}</td><td className="angka">{fmt(p.luas_km2, 1)}</td>
                  <td className="angka">{p.n_coffee_shop}</td><td className="angka">{fmt(p.d_kopi_1_median_m)}</td>
                  <td className="angka">{fmt(p.penduduk_km2_median)}</td>
                  <td className="angka">{fmt(p.z_pendukung, 2)}</td><td className="angka">{fmt(p.z_kompetisi, 2)}</td>
                  <td className="angka">{fmt(p.skor_peluang, 2)}</td><td>{p.kecamatan_utama}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <h2>Kesepakatan jenis kawasan (jumlah sel)</h2>
      <table className="data kecil">
        <thead><tr><th>K-Means ↓ / HDBSCAN →</th>{kolomHdb.map((k) => <th key={k}>{KELAS[k]?.label ?? k}</th>)}</tr></thead>
        <tbody>
          {kesepakatan.map((r) => (
            <tr key={r["K-Means"]}><td>{KELAS[r["K-Means"]]?.label}</td>{kolomHdb.map((k) => <td className="angka" key={k}>{r[k]}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
