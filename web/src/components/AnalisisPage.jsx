import { useState } from "react";
import { TARGET_PASAR, TOLERANSI, TIPE_USAHA, HARGA_LEVEL, ASUMSI_UMUM, PREFERENSI_AWAL, jutaan, rupiah } from "../bisnis.js";
import { KELAS, fmt } from "../lib.js";
import PetaKecamatanSVG, { LEGENDA_SKOR } from "./PetaKecamatanSVG.jsx";

export default function AnalisisPage({ data, pref, setPref, ranking, onLaporan, onTanyaAI }) {
  const [buka, setBuka] = useState(ranking[0]?.kecamatan);
  const set = (k, v) => setPref({ ...pref, [k]: v });
  const setBobot = (k, v) => setPref({ ...pref, bobot: { ...pref.bobot, [k]: v } });
  const dipilih = ranking.find((r) => r.kecamatan === buka) ?? ranking[0];
  const adaHarga = Boolean(data.kecStat?.sumber_harga);

  return (
    <div className="analisis-layout">
      <aside className="kontrol">
        <h2 className="judul-form">Preferensi usaha</h2>
        <section>
          <h3>Target pasar (bobot 0–3)</h3>
          {Object.entries(TARGET_PASAR).map(([k, label]) => (
            <div className="slider-baris" key={k}>
              <span>{label}</span>
              <input type="range" min={0} max={3} step={1} value={pref.bobot[k]} onChange={(e) => setBobot(k, +e.target.value)} />
              <b>{pref.bobot[k]}</b>
            </div>
          ))}
        </section>
        <section>
          <h3>Toleransi kompetisi</h3>
          {Object.entries(TOLERANSI).map(([k, v]) => (
            <label key={k}><input type="radio" checked={pref.toleransi === k} onChange={() => set("toleransi", k)} /> {v.label}</label>
          ))}
        </section>
        <section>
          <h3>Segmen harga</h3>
          <select value={pref.segmen} onChange={(e) => set("segmen", e.target.value === "pasar" ? "pasar" : +e.target.value)}>
            <option value="pasar">Ikuti harga pasar kecamatan{adaHarga ? " (GoFood)" : ""}</option>
            {Object.entries(HARGA_LEVEL).map(([k, v]) => <option key={k} value={k}>{v.label} per menu</option>)}
          </select>
        </section>
        <section>
          <h3>Tipe usaha</h3>
          <select value={pref.tipe} onChange={(e) => set("tipe", e.target.value)}>
            {Object.entries(TIPE_USAHA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </section>
        <section>
          <h3>Penjualan per hari</h3>
          {Object.entries(ASUMSI_UMUM.transaksi_hari).map(([k, n]) => (
            <label key={k}><input type="radio" checked={pref.transaksi_hari == null && pref.skenario === k}
              onChange={() => setPref({ ...pref, skenario: k, transaksi_hari: null })} /> {k[0].toUpperCase() + k.slice(1)} ({n} transaksi)</label>
          ))}
          <label>Isi sendiri:
            <input type="number" min={1} placeholder="transaksi/hari" value={pref.transaksi_hari ?? ""}
              onChange={(e) => set("transaksi_hari", e.target.value ? +e.target.value : null)} style={{ width: 110 }} />
          </label>
        </section>
        <section>
          <h3>Sewa tempat per bulan</h3>
          <input type="number" min={0} step={500000} placeholder={`asumsi ${TIPE_USAHA[pref.tipe].sewa_bulan.toLocaleString("id-ID")}`}
            value={pref.sewa_bulan ?? ""} onChange={(e) => set("sewa_bulan", e.target.value ? +e.target.value : null)} style={{ width: "100%" }} />
        </section>
        <section>
          <h3>Algoritma peta kawasan</h3>
          <div className="segmen">
            <button className={pref.alg === "km" ? "aktif" : ""} onClick={() => set("alg", "km")}>K-Means</button>
            <button className={pref.alg === "hdb" ? "aktif" : ""} onClick={() => set("alg", "hdb")}>HDBSCAN</button>
          </div>
        </section>
        <button className="tombol-sekunder" onClick={() => setPref(PREFERENSI_AWAL)}>Kembalikan ke awal</button>
      </aside>

      <div className="halaman analisis-isi">
        <div className="aksi">
          <button className="tombol-utama" onClick={onLaporan}>📄 Buat laporan (PDF)</button>
          <button className="tombol-sekunder" onClick={() => onTanyaAI(`Berdasarkan preferensi saya, jelaskan 3 kecamatan teratas yang paling layak ditargetkan, bandingkan kelebihan dan risikonya, serta perkiraan modal dan kapan balik modal.`)}>
            🤖 Minta analisis AI
          </button>
        </div>

        <div className="dua-kolom">
          <div>
            <h2>Peringkat kecamatan</h2>
            <p className="catatan">Skor = permintaan (sesuai target pasar) − λ×kompetisi + 0,5×porsi kawasan potensial{pref.segmen !== "pasar" ? " − 0,25×selisih segmen harga" : ""}. Klik baris untuk rincian.</p>
            <table className="data rank">
              <thead><tr><th>#</th><th>Kecamatan</th><th>Skor</th><th>Potensial</th><th>Coffee shop</th><th>Modal awal</th><th>Balik modal</th></tr></thead>
              <tbody>
                {ranking.map((r) => (
                  <tr key={r.kecamatan} className={r.kecamatan === dipilih?.kecamatan ? "sorot" : ""} onClick={() => setBuka(r.kecamatan)}>
                    <td className="angka">{r.rank}</td>
                    <td>{r.kecamatan}<div className="abu">{r.alasan}</div></td>
                    <td className="angka">{fmt(r.skor, 2)}</td>
                    <td className="angka">{fmt(r[`pct_${pref.alg}`]?.potensial ?? 0)}%</td>
                    <td className="angka">{r.n_coffee_shop}</td>
                    <td className="angka">{jutaan(r.finansial.modal_awal)}</td>
                    <td className="angka">{r.finansial.bep_bulan ? `${fmt(r.finansial.bep_bulan, 1)} bln` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h2>Peta skor</h2>
            <PetaKecamatanSVG kecamatan={data.kecamatan} ranking={ranking} />
            <div className="legenda-skor">
              <span>skor rendah</span>{LEGENDA_SKOR.map((w) => <span key={w} className="kotak" style={{ background: w }} />)}<span>tinggi</span>
            </div>
            <p className="catatan">Angka = peringkat.</p>
            {dipilih && <RincianKecamatan k={dipilih} pref={pref} onTanyaAI={onTanyaAI} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RincianKecamatan({ k, pref, onTanyaAI }) {
  const f = k.finansial;
  return (
    <div className="kartu rincian">
      <h3>#{k.rank} Kec. {k.kecamatan}</h3>
      <div className="abu">{k.alasan}</div>
      <table className="fitur">
        <tbody>
          <tr className="blok"><td colSpan={2}>Kawasan ({pref.alg === "km" ? "K-Means" : "HDBSCAN"})</td></tr>
          {Object.entries(k[`pct_${pref.alg}`] || {}).map(([c, v]) => <tr key={c}><td>{KELAS[c]?.label}</td><td className="angka">{fmt(v, 1)}%</td></tr>)}
          <tr className="blok"><td colSpan={2}>Pasar</td></tr>
          <tr><td>Coffee shop terdata</td><td className="angka">{k.n_coffee_shop} ({fmt(k.kopi_per_km2, 1)}/km²)</td></tr>
          <tr><td>Penduduk (WorldPop)</td><td className="angka">{fmt(k.penduduk)}</td></tr>
          <tr><td>Harga pasar (GoFood)</td><td className="angka">{k.harga_gofood?.n ? `${k.harga_gofood.n} outlet, median tingkat ${fmt(k.harga_gofood.median_level, 1)}` : "tidak ada data"}</td></tr>
          <tr className="blok"><td colSpan={2}>Perkiraan kasar · {f.tipe}</td></tr>
          <tr><td>Harga rata-rata</td><td className="angka">{rupiah(f.harga_rata)} <small className="abu">({f.label_harga})</small></td></tr>
          <tr><td>Penjualan</td><td className="angka">{f.transaksi_hari} transaksi/hari</td></tr>
          <tr><td>Revenue / bulan</td><td className="angka">{jutaan(f.revenue_bulan)}</td></tr>
          <tr><td>Laba kotor (− HPP {ASUMSI_UMUM.hpp_persen}%)</td><td className="angka">{jutaan(f.laba_kotor_bulan)}</td></tr>
          <tr><td>Biaya operasional / bulan</td><td className="angka">{jutaan(f.opex_bulan)}</td></tr>
          <tr><td><b>Laba bersih / bulan</b></td><td className="angka"><b>{jutaan(f.laba_bersih_bulan)}</b></td></tr>
          <tr><td><b>Modal awal</b></td><td className="angka"><b>{jutaan(f.modal_awal)}</b></td></tr>
          <tr><td>Balik modal</td><td className="angka">{f.bep_bulan ? `±${fmt(f.bep_bulan, 1)} bulan` : "tidak tercapai"}</td></tr>
        </tbody>
      </table>
      <p className="catatan">Sumber harga: {f.sumber_harga}. Biaya & modal = asumsi awal (lihat Data & Metode), bukan data lapangan.</p>
      <button className="tombol-sekunder" onClick={() => onTanyaAI(`Analisis peluang membuka coffee shop di Kecamatan ${k.kecamatan} sesuai preferensi saya: kelebihan, risiko, rincian modal, dan saran lokasi titik potensial.`)}>
        🤖 Tanya AI soal {k.kecamatan}
      </button>
    </div>
  );
}
