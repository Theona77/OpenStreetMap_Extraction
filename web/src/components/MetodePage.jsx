import { FITUR, fmt } from "../lib.js";
import { TIPE_USAHA, ASUMSI_UMUM, HARGA_LEVEL, rupiah } from "../bisnis.js";

const ALUR = [
  ["Input data geospasial", "Coffee shop (dataset v2), kampus, sekolah, perkantoran, pusat perbelanjaan (OSM), jaringan jalan (OSM), kepadatan penduduk (WorldPop 2025)."],
  ["Grid kandidat", "Kota Bandung dibagi menjadi sel heksagon H3 resolusi 9 (±0,1 km²); setiap sel = satu kandidat lokasi."],
  ["KDE", "Kepadatan kompetitor dan fasilitas pendukung (kernel Gaussian, bandwidth 500 m) → titik per km²."],
  ["KNN", "Jarak dari titik tengah sel ke objek terdekat (cKDTree); untuk kompetitor juga rata-rata 3 terdekat."],
  ["Integrasi & normalisasi", "Fitur KDE, KNN, demografi, aksesibilitas digabung; log1p lalu z-score (StandardScaler)."],
  ["Clustering", "K-Means (k dipilih dari silhouette) dan HDBSCAN (grid search 50 konfigurasi)."],
  ["Interpretasi & peta", "Cluster diberi label kawasan potensial / kompetitif / potensi rendah, lalu ditampilkan di website ini."],
];

export default function MetodePage({ meta, kecStat }) {
  const p = meta.parameter;
  const b = meta.benchmark;
  return (
    <div className="halaman">
      <h2>Alur pipeline</h2>
      <ol className="alur">
        {ALUR.map(([j, d]) => <li key={j}><b>{j}</b><span>{d}</span></li>)}
      </ol>

      <h2>Sumber data</h2>
      <table className="data">
        <tbody>
          {Object.entries(meta.sumber).map(([k, v]) => <tr key={k}><td>{k.replace("_", " ")}</td><td>{v}</td></tr>)}
          <tr><td>jumlah fasilitas (dalam kota)</td><td>{Object.entries(meta.jumlah.fasilitas).map(([k, v]) => `${k} ${v}`).join(" · ")}</td></tr>
          <tr><td>penduduk (WorldPop)</td><td>{fmt(meta.jumlah.penduduk_worldpop)} jiwa</td></tr>
        </tbody>
      </table>

      <h2>Aturan jenis kawasan</h2>
      <table className="data">
        <thead><tr><th>Kawasan</th><th>Syarat (rata-rata cluster)</th></tr></thead>
        <tbody>
          <tr><td>Potensi rendah</td><td>indeks pendukung &lt; 0 (di bawah rata-rata kota)</td></tr>
          <tr><td>Potensial</td><td>indeks pendukung ≥ 0 dan skor peluang (pendukung − kompetisi) ≥ 0</td></tr>
          <tr><td>Kompetitif</td><td>indeks pendukung ≥ 0 dan skor peluang &lt; 0</td></tr>
          <tr><td>Tidak terklasifikasi</td><td>sel noise HDBSCAN</td></tr>
        </tbody>
      </table>
      <p className="catatan">Indeks pendukung = rata-rata z-score {p.f_pendukung.join(", ")}. Indeks kompetisi = z-score kde_kopi.</p>

      <h2>Fitur ({p.fitur[p.set_utama].length} fitur, set {p.set_utama})</h2>
      <table className="data">
        <thead><tr><th>Kode</th><th>Blok</th><th>Arti</th><th>Satuan</th></tr></thead>
        <tbody>
          {p.fitur[p.set_utama].map((k) => (
            <tr key={k}><td><code>{k}</code></td><td>{FITUR[k]?.blok}</td><td>{FITUR[k]?.label}</td><td>{FITUR[k]?.satuan}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Parameter</h2>
      <table className="data kecil">
        <tbody>
          <tr><td>Resolusi H3</td><td>{p.h3_res} ({fmt(p.luas_sel_km2, 3)} km²/sel, {meta.jumlah.sel} sel)</td></tr>
          <tr><td>Bandwidth KDE</td><td>{p.bandwidth.dipakai_m} m (Scott {p.bandwidth.scott_m} m, cross-validation {p.bandwidth.cv_m} m)</td></tr>
          <tr><td>K-Means</td><td>{JSON.stringify(p.kmeans)}</td></tr>
          <tr><td>HDBSCAN</td><td>{JSON.stringify(p.hdbscan)} (aturan tingkat {p.hdbscan_tingkat_aturan})</td></tr>
        </tbody>
      </table>

      <h2>Waktu proses pipeline</h2>
      <p className="catatan">Diukur saat notebook dijalankan (Python {b.python}). Total {fmt(b.total_detik, 1)} detik, puncak memori {b.puncak_memori_mb} MB.</p>
      <table className="data kecil">
        <thead><tr><th>Tahap</th><th>Detik</th><th>Puncak RAM (MB)</th></tr></thead>
        <tbody>{b.tahap.map((t) => <tr key={t.tahap}><td>{t.tahap}</td><td className="angka">{fmt(t.detik, 2)}</td><td className="angka">{t.puncak_memori_mb}</td></tr>)}</tbody>
      </table>

      <h2>Perkiraan revenue & modal (asumsi)</h2>
      <p className="catatan">
        Harga rata-rata per transaksi = titik tengah tingkat harga GoFood ({Object.values(HARGA_LEVEL).map((h) => `${h.label}: ${rupiah(h.tengah)}`).join(" · ")}).
        {kecStat?.sumber_harga ? ` Data harga: ${kecStat.harga_kota?.n ?? 0} coffee shop GoFood, diambil ${kecStat.diambil_harga}.` : " Data harga GoFood belum diambil."}
        {" "}Komponen biaya di bawah adalah asumsi awal peneliti (ubah di <code>web/src/bisnis.js</code>) dan perlu divalidasi lewat wawancara pemilik coffee shop.
      </p>
      <table className="data kecil">
        <thead><tr><th>Komponen</th>{Object.values(TIPE_USAHA).map((t) => <th key={t.label}>{t.label}</th>)}</tr></thead>
        <tbody>
          <tr><td>Karyawan</td>{Object.values(TIPE_USAHA).map((t) => <td key={t.label} className="angka">{t.karyawan}</td>)}</tr>
          <tr><td>Sewa/bulan</td>{Object.values(TIPE_USAHA).map((t) => <td key={t.label} className="angka">{rupiah(t.sewa_bulan)}</td>)}</tr>
          <tr><td>Utilitas/bulan</td>{Object.values(TIPE_USAHA).map((t) => <td key={t.label} className="angka">{rupiah(t.utilitas_bulan)}</td>)}</tr>
          <tr><td>Investasi awal</td>{Object.values(TIPE_USAHA).map((t) => <td key={t.label} className="angka">{rupiah(Object.values(t.capex).reduce((a, b) => a + b, 0))}</td>)}</tr>
        </tbody>
      </table>
      <p className="catatan">Gaji {rupiah(ASUMSI_UMUM.gaji_per_karyawan)}/orang/bulan · HPP {ASUMSI_UMUM.hpp_persen}% · {ASUMSI_UMUM.hari_buka_bulan} hari buka/bulan ·
        sewa {ASUMSI_UMUM.bulan_sewa_dimuka} bulan di muka · modal kerja {ASUMSI_UMUM.bulan_modal_kerja} bulan · skenario {Object.entries(ASUMSI_UMUM.transaksi_hari).map(([k, v]) => `${k} ${v}`).join("/")} transaksi/hari.</p>

      <h2>Keterbatasan</h2>
      <ul>
        <li>Coffee shop yang koordinatnya belum tepat (±620 di daftar review) belum dihitung sebagai kompetitor, jadi kepadatan kompetitor bisa lebih rendah dari kenyataan.</li>
        <li>Coffee shop di luar batas kota tidak dihitung → sel di tepi kota tampak lebih sepi kompetitor.</li>
        <li>Kelengkapan data OSM (kantor, sekolah) bervariasi antar kawasan.</li>
        <li>Rekomendasi menunjukkan kecocokan karakter kawasan, bukan jaminan profit (harga sewa, daya beli, dan lalu lintas pejalan kaki tidak tersedia).</li>
      </ul>
      <p className="catatan">Data dibuat {meta.dibuat}. © OpenStreetMap contributors (ODbL), WorldPop (CC BY 4.0), Open Data Kota Bandung.</p>
    </div>
  );
}
