import { useState } from "react";
import { TARGET_PASAR, TOLERANSI, TIPE_USAHA, HARGA_LEVEL, ASUMSI_UMUM, jutaan, rupiah } from "../bisnis.js";
import { KELAS, fmt } from "../lib.js";
import { md, tanyaAI } from "../ai.js";
import PetaKecamatanSVG, { LEGENDA_SKOR } from "./PetaKecamatanSVG.jsx";

const NAMA_RINCIAN = {
  peralatan_kopi: "Peralatan kopi", renovasi_interior: "Renovasi & interior", furnitur: "Furnitur",
  izin_dan_lainnya: "Perizinan & lain-lain", stok_awal: "Stok bahan awal", sewa_dimuka: "Sewa dibayar di muka", modal_kerja: "Modal kerja",
};

export default function Laporan({ data, pref, ranking, konteks, aiAktif, onTutup }) {
  const [catatanAI, setCatatanAI] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const top = ranking.slice(0, 5);
  const alg = pref.alg === "km" ? "K-Means" : "HDBSCAN";
  const ev = data.meta.evaluasi.find((r) => r.set_fitur === data.meta.parameter.set_utama && r.algoritma === alg);
  const tgl = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const buatRingkasanAI = async () => {
    setMemuat(true); setGalat("");
    try {
      setCatatanAI(await tanyaAI([{ role: "user", text:
        "Tulis ringkasan eksekutif untuk laporan rekomendasi lokasi ini (maks. 250 kata): kecamatan yang paling disarankan dan alasannya, " +
        "perbandingan singkat 3 teratas, perkiraan modal & balik modal, risiko utama, dan langkah validasi lapangan yang disarankan. " +
        "Tanpa judul, langsung isi." }], konteks));
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMemuat(false);
    }
  };

  return (
    <div className="laporan-overlay">
      <div className="laporan-aksi no-print">
        <button className="tombol-utama" onClick={() => window.print()}>🖨️ Cetak / Simpan sebagai PDF</button>
        <button className="tombol-sekunder" onClick={buatRingkasanAI} disabled={!aiAktif || memuat}
          title={aiAktif ? "" : "Server chatbot belum aktif / API key belum diisi"}>
          {memuat ? "Menulis ringkasan…" : catatanAI ? "🤖 Tulis ulang ringkasan AI" : "🤖 Tambahkan ringkasan AI"}
        </button>
        <button className="tombol-sekunder" onClick={onTutup}>Tutup</button>
        {galat && <span className="galat">{galat}</span>}
        <span className="catatan">Di dialog cetak pilih "Save as PDF / Simpan sebagai PDF".</span>
      </div>

      <article className="laporan-cetak">
        <header className="laporan-kop">
          <h1>Laporan Rekomendasi Lokasi Coffee Shop</h1>
          <div>Kota Bandung · dibuat {tgl} · sistem rekomendasi berbasis KDE, KNN, dan {alg}</div>
        </header>

        <section>
          <h2>1. Preferensi pengguna</h2>
          <table className="data">
            <tbody>
              <tr><td>Target pasar (bobot 0–3)</td><td>{Object.entries(pref.bobot).filter(([, w]) => w > 0).map(([k, w]) => `${TARGET_PASAR[k]} (${w})`).join(", ") || "–"}</td></tr>
              <tr><td>Toleransi kompetisi</td><td>{TOLERANSI[pref.toleransi].label}</td></tr>
              <tr><td>Segmen harga</td><td>{pref.segmen === "pasar" ? "Mengikuti harga pasar kecamatan" : HARGA_LEVEL[pref.segmen].label}</td></tr>
              <tr><td>Tipe usaha</td><td>{TIPE_USAHA[pref.tipe].label}</td></tr>
              <tr><td>Penjualan</td><td>{pref.transaksi_hari ?? ASUMSI_UMUM.transaksi_hari[pref.skenario]} transaksi/hari</td></tr>
              <tr><td>Sewa</td><td>{rupiah(pref.sewa_bulan ?? TIPE_USAHA[pref.tipe].sewa_bulan)}/bulan{pref.sewa_bulan == null ? " (asumsi)" : ""}</td></tr>
            </tbody>
          </table>
        </section>

        {catatanAI && (
          <section>
            <h2>Ringkasan eksekutif (dibuat AI, perlu ditinjau)</h2>
            <div className="md" dangerouslySetInnerHTML={{ __html: md(catatanAI) }} />
          </section>
        )}

        <section>
          <h2>2. Kecamatan yang direkomendasikan</h2>
          <div className="dua-kolom">
            <ol className="top5">
              {top.map((k) => (
                <li key={k.kecamatan}>
                  <b>Kec. {k.kecamatan}</b> (skor {fmt(k.skor, 2)})
                  <div>{k.alasan}</div>
                  <div className="abu">
                    Kawasan potensial {fmt(k[`pct_${pref.alg}`]?.potensial ?? 0)}% · {k.n_coffee_shop} coffee shop terdata ·
                    modal ±{jutaan(k.finansial.modal_awal)} · balik modal {k.finansial.bep_bulan ? `±${fmt(k.finansial.bep_bulan, 1)} bulan` : "tidak tercapai"}
                  </div>
                  {k[`sel_terbaik_${pref.alg}`]?.length > 0 && (
                    <div className="abu">Titik potensial terbaik: {k[`sel_terbaik_${pref.alg}`].slice(0, 2).map((s) => `${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}`).join(" · ")}</div>
                  )}
                </li>
              ))}
            </ol>
            <div>
              <PetaKecamatanSVG kecamatan={data.kecamatan} ranking={ranking} lebar={420} />
              <div className="legenda-skor"><span>skor rendah</span>{LEGENDA_SKOR.map((w) => <span key={w} className="kotak" style={{ background: w }} />)}<span>tinggi</span></div>
            </div>
          </div>
        </section>

        <section className="putus">
          <h2>3. Perkiraan finansial kasar: {top[0]?.kecamatan}</h2>
          <FinansialTabel f={top[0]?.finansial} />
          <p className="catatan">Revenue = harga rata-rata × transaksi/hari × {ASUMSI_UMUM.hari_buka_bulan} hari. Harga: {top[0]?.finansial.sumber_harga}.
            Laba bersih = revenue × (1 − HPP {ASUMSI_UMUM.hpp_persen}%) − biaya operasional. Modal awal = investasi + sewa {ASUMSI_UMUM.bulan_sewa_dimuka} bulan di muka + modal kerja {ASUMSI_UMUM.bulan_modal_kerja} bulan.
            Komponen biaya adalah asumsi awal peneliti dan perlu divalidasi dengan pemilik coffee shop.</p>
        </section>

        <section>
          <h2>4. Peringkat seluruh kecamatan</h2>
          <table className="data kecil-font">
            <thead><tr><th>#</th><th>Kecamatan</th><th>Skor</th><th>Permintaan</th><th>Kompetisi</th><th>Potensial</th><th>Kompetitif</th><th>Coffee shop</th><th>Harga pasar</th><th>Laba bersih/bln</th></tr></thead>
            <tbody>
              {ranking.map((k) => (
                <tr key={k.kecamatan}>
                  <td>{k.rank}</td><td>{k.kecamatan}</td><td className="angka">{fmt(k.skor, 2)}</td>
                  <td className="angka">{fmt(k.permintaan, 2)}</td><td className="angka">{fmt(k.kompetisi, 2)}</td>
                  <td className="angka">{fmt(k[`pct_${pref.alg}`]?.potensial ?? 0)}%</td><td className="angka">{fmt(k[`pct_${pref.alg}`]?.kompetitif ?? 0)}%</td>
                  <td className="angka">{k.n_coffee_shop}</td><td>{k.finansial.label_harga}</td><td className="angka">{jutaan(k.finansial.laba_bersih_bulan)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>5. Metode & keandalan</h2>
          <ul>
            <li>Kota dibagi menjadi {data.meta.jumlah.sel} sel heksagon (±0,1 km²). Setiap sel memiliki 14 fitur: kepadatan (KDE) dan jarak terdekat (KNN) ke coffee shop, kampus, sekolah, kantor, pusat perbelanjaan; kepadatan penduduk; aksesibilitas jalan.</li>
            <li>Sel dikelompokkan dengan {alg}; tiap cluster dilabeli {Object.values(KELAS).slice(0, 3).map((k) => k.label.toLowerCase()).join(", ")}.</li>
            {ev && <li>Keandalan {alg}: stabilitas ARI {fmt(ev.ARI_mean, 2)}, AUC hold-out {fmt(ev.AUC_holdout, 2)}, AUC validasi temporal {fmt(ev.AUC_temporal, 2)} (0,5 = acak, 1 = sempurna).</li>}
            <li>Data: {Object.values(data.meta.sumber).join("; ")}{data.kecStat?.sumber_harga ? `; harga: ${data.kecStat.sumber_harga}` : ""}.</li>
          </ul>
          <h3>Keterbatasan</h3>
          <ul>
            <li>Hanya {data.meta.jumlah.coffee_shop} coffee shop berkoordinat tepat yang dihitung sebagai kompetitor; jumlah sebenarnya lebih banyak.</li>
            <li>Data harga GoFood adalah sampel (hanya outlet yang tampil di halaman daftar) dan berupa rentang harga, bukan menu lengkap.</li>
            <li>Tidak ada data harga sewa, daya beli, dan lalu lintas pejalan kaki. Rekomendasi menunjukkan kecocokan kawasan, bukan jaminan keuntungan. Lakukan survei lapangan sebelum memutuskan.</li>
          </ul>
        </section>
      </article>
    </div>
  );
}

export function FinansialTabel({ f }) {
  if (!f) return null;
  return (
    <div className="dua-kolom">
      <table className="data">
        <thead><tr><th>Modal awal</th><th className="angka">Rupiah</th></tr></thead>
        <tbody>
          {Object.entries(f.rincian_modal).map(([k, v]) => <tr key={k}><td>{NAMA_RINCIAN[k] ?? k}</td><td className="angka">{rupiah(v)}</td></tr>)}
          <tr><td><b>Total</b></td><td className="angka"><b>{rupiah(f.modal_awal)}</b></td></tr>
        </tbody>
      </table>
      <table className="data">
        <thead><tr><th>Skenario</th><th className="angka">Transaksi/hari</th><th className="angka">Revenue/bln</th><th className="angka">Laba bersih/bln</th></tr></thead>
        <tbody>
          {Object.entries(f.skenario).map(([k, s]) => (
            <tr key={k}><td>{k}</td><td className="angka">{s.transaksi_hari}</td><td className="angka">{jutaan(s.revenue_bulan)}</td><td className="angka">{jutaan(s.laba_bersih_bulan)}</td></tr>
          ))}
          <tr><td colSpan={3}>Biaya operasional/bulan (gaji {jutaan(f.rincian_opex.gaji)}, sewa {jutaan(f.rincian_opex.sewa)}, utilitas {jutaan(f.rincian_opex.utilitas)})</td><td className="angka">{jutaan(f.opex_bulan)}</td></tr>
          <tr><td colSpan={3}>Harga rata-rata per transaksi ({f.label_harga})</td><td className="angka">{rupiah(f.harga_rata)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
