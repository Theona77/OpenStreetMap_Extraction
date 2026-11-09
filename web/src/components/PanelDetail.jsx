import { useMemo } from "react";
import { KELAS, ALGORITMA, FITUR, fmt, persentil, rekomendasi, kTerdekat } from "../lib.js";

export default function PanelDetail({ titik, alg, radius, data, onPilihSel, onTutup }) {
  const { sel, kopi, meta } = data;

  // array terurut per fitur untuk menghitung persentil kota
  const terurut = useMemo(() => {
    const o = {};
    for (const f of Object.keys(FITUR)) o[f] = sel.map((s) => s[f]).sort((a, b) => a - b);
    o.skor_peluang = sel.map((s) => s.skor_peluang).sort((a, b) => a - b);
    return o;
  }, [sel]);

  if (!titik) {
    const prof = meta.profil[ALGORITMA[alg]];
    return (
      <aside className="detail">
        <h2>Ringkasan {ALGORITMA[alg]}</h2>
        <p className="catatan">Tipe kawasan ditentukan per cluster dari indeks pendukung (fasilitas + penduduk + jalan) dan indeks kompetisi (kepadatan coffee shop).</p>
        {prof.map((p) => (
          <div className="kartu" key={p.cluster} style={{ borderLeftColor: KELAS[p.kelas].warna }}>
            <b>{KELAS[p.kelas].label}</b> <span className="abu">· cluster {p.cluster}</span>
            <div>{p.n_sel} sel · {fmt(p.luas_km2, 1)} km² · {p.n_coffee_shop} coffee shop</div>
            <div className="abu">Indeks pendukung {fmt(p.z_pendukung, 2)} · kompetisi {fmt(p.z_kompetisi, 2)} · skor peluang {fmt(p.skor_peluang, 2)}</div>
            <div className="abu">Kecamatan utama: {p.kecamatan_utama}</div>
          </div>
        ))}
        {!prof.some((p) => p.kelas === "potensial") && (
          <p className="peringatan">{ALGORITMA[alg]} tidak menghasilkan cluster yang lolos syarat kawasan potensial, jadi daftar rekomendasi akan kosong. Gunakan K-Means untuk rekomendasi.</p>
        )}
      </aside>
    );
  }

  const s = titik.sel;
  if (!s) {
    return (
      <aside className="detail">
        <button className="tutup" onClick={onTutup}>×</button>
        <h2>Di luar wilayah analisis</h2>
        <p>Titik ({fmt(titik.lat, 5)}, {fmt(titik.lon, 5)}) berada di luar Kota Bandung.</p>
      </aside>
    );
  }

  const kelas = s[`kelas_${alg}`];
  const rek = rekomendasi(sel, titik.lat, titik.lon, alg, radius, 5);
  const kopiDekat = kTerdekat(kopi, titik.lat, titik.lon, 3);
  const blok = [...new Set(Object.values(FITUR).map((f) => f.blok))];

  return (
    <aside className="detail">
      <button className="tutup" onClick={onTutup}>×</button>
      <h2>Kec. {s.kecamatan}</h2>
      <div className="lencana" style={{ background: KELAS[kelas].warna, color: kelas === "rendah" || kelas === "noise" ? "#222" : "#fff" }}>
        {KELAS[kelas].label}
      </div>
      <div className="abu">{ALGORITMA[alg]} cluster {s[`cluster_${alg}`]} · sel H3 {s.h3}</div>
      <div className="abu">Hasil algoritma lain ({ALGORITMA[alg === "km" ? "hdb" : "km"]}): {KELAS[s[`kelas_${alg === "km" ? "hdb" : "km"}`]].label}</div>

      <div className="skor">
        <div><span>Indeks pendukung</span><b>{fmt(s.z_pendukung, 2)}</b></div>
        <div><span>Indeks kompetisi</span><b>{fmt(s.z_kompetisi, 2)}</b></div>
        <div><span>Skor peluang</span><b>{fmt(s.skor_peluang, 2)}</b><small>persentil {persentil(s.skor_peluang, terurut.skor_peluang)}</small></div>
      </div>

      <h3>Rekomendasi kawasan potensial dalam {fmt(radius / 1000, 1)} km</h3>
      {rek.length === 0 ? (
        <p className="catatan">Tidak ada sel kawasan potensial ({ALGORITMA[alg]}) dalam radius ini. Perbesar radius atau ganti algoritma.</p>
      ) : (
        <ol className="rek">
          {rek.map((r) => (
            <li key={r.h3} onClick={() => onPilihSel(r)}>
              <b>Kec. {r.kecamatan}</b> · {fmt(r.jarak_m / 1000, 2)} km
              <div className="abu">skor peluang {fmt(r.skor_peluang, 2)} · coffee shop terdekat {fmt(r.d_kopi_1)} m · penduduk {fmt(r.penduduk_km2)}/km²</div>
            </li>
          ))}
        </ol>
      )}

      <h3>Coffee shop terdekat</h3>
      <ul className="polos">
        {kopiDekat.map((k, i) => <li key={i}>{k.nama} <span className="abu">· {fmt(k.jarak_m)} m</span></li>)}
      </ul>

      <h3>Fitur sel</h3>
      <table className="fitur">
        <tbody>
          {blok.map((b) => [
            <tr key={b} className="blok"><td colSpan={3}>{b}</td></tr>,
            ...Object.entries(FITUR).filter(([, f]) => f.blok === b).map(([k, f]) => (
              <tr key={k}>
                <td>{f.label}</td>
                <td className="angka">{fmt(s[k], k.startsWith("kde") || k === "kerapatan_jalan" ? 1 : 0)} <small>{f.satuan}</small></td>
                <td className="angka abu" title="persentil terhadap seluruh sel kota">P{persentil(s[k], terurut[k])}</td>
              </tr>
            )),
          ])}
        </tbody>
      </table>
      <p className="catatan">P = persentil terhadap 1.599 sel kota (P90 = lebih tinggi dari 90% sel).</p>
    </aside>
  );
}
