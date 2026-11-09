import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, useMapEvents, useMap } from "react-leaflet";
import {
  KELAS, ALGORITMA, FITUR, FASILITAS, PALET_SEKUENSIAL, warnaCluster,
  batasKuantil, kelasKuantil, selTerdekat, fmt,
} from "../lib.js";
import PanelDetail from "./PanelDetail.jsx";

const PUSAT = [-6.917, 107.619];

function KlikPeta({ onKlik }) {
  useMapEvents({ click: (e) => onKlik(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Terbang({ target }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([target.lat, target.lon], target.zoom ?? 15, { duration: 0.6 });
  }, [map, target]);
  return null;
}

export default function PetaPage({ data, onLokasi }) {
  const { grid, sel, kopi, fasilitas, kecamatan, meta } = data;
  // ?titik=lat,lon&alg=hdb → buka langsung lokasi tertentu (bisa dibagikan sebagai tautan)
  const url = new URLSearchParams(window.location.search);
  const [alg, setAlg] = useState(url.get("alg") === "hdb" ? "hdb" : "km");
  const [mode, setMode] = useState("kelas"); // kelas | cluster | fitur
  const [fitur, setFitur] = useState("kde_kopi");
  const [layer, setLayer] = useState({ kopi: true, kecamatan: true, kampus: false, sekolah: false, kantor: false, belanja: false });
  const [kecFilter, setKecFilter] = useState("");
  const [radius, setRadius] = useState(2000);
  const [titik, setTitik] = useState(() => {
    const [lat, lon] = (url.get("titik") || "").split(",").map(Number);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, sel: selTerdekat(sel, lat, lon) } : null;
  }); // {lat, lon, sel}

  useEffect(() => {
    const q = new URLSearchParams();
    if (titik) q.set("titik", `${titik.lat.toFixed(5)},${titik.lon.toFixed(5)}`);
    if (alg !== "km") q.set("alg", alg);
    const qs = q.toString();
    window.history.replaceState(null, "", (qs ? `?${qs}` : window.location.pathname) + window.location.hash);
  }, [titik, alg]);

  // ringkasan lokasi terpilih untuk konteks chatbot
  useEffect(() => {
    if (!onLokasi) return;
    const s = titik?.sel;
    onLokasi(s ? {
      lat: +titik.lat.toFixed(5), lon: +titik.lon.toFixed(5), kecamatan: s.kecamatan,
      jenis_kawasan_kmeans: s.kelas_km, jenis_kawasan_hdbscan: s.kelas_hdb,
      indeks_pendukung: s.z_pendukung, indeks_kompetisi: s.z_kompetisi, skor_peluang: s.skor_peluang,
      coffee_shop_di_sel: s.n_coffee_shop, jarak_coffee_shop_terdekat_m: s.d_kopi_1, jarak_kampus_m: s.d_kampus,
      jarak_kantor_m: s.d_kantor, jarak_belanja_m: s.d_belanja, penduduk_per_km2: s.penduduk_km2, jarak_jalan_utama_m: s.d_jalan_utama,
    } : null);
  }, [titik, onLokasi]);
  const [terbang, setTerbang] = useState(null);

  const batas = useMemo(() => batasKuantil(sel.map((s) => s[fitur])), [sel, fitur]);
  const daftarKec = useMemo(() => [...new Set(sel.map((s) => s.kecamatan))].sort(), [sel]);

  const ringkas = useMemo(() => {
    const n = {};
    for (const s of sel) {
      if (kecFilter && s.kecamatan !== kecFilter) continue;
      const k = s[`kelas_${alg}`];
      n[k] = (n[k] || 0) + 1;
    }
    return n;
  }, [sel, alg, kecFilter]);

  const style = (f) => {
    const p = f.properties;
    const redup = kecFilter && p.kecamatan !== kecFilter;
    const dipilih = titik?.sel?.h3 === p.h3;
    let fill;
    if (mode === "kelas") fill = KELAS[p[`kelas_${alg}`]].warna;
    else if (mode === "cluster") fill = warnaCluster(p[`cluster_${alg}`]);
    else fill = PALET_SEKUENSIAL[kelasKuantil(p[fitur], batas)];
    return {
      fillColor: fill,
      fillOpacity: redup ? 0.12 : p[`kelas_${alg}`] === "noise" && mode !== "fitur" ? 0.15 : 0.62,
      color: dipilih ? "#000" : "#ffffff",
      weight: dipilih ? 2.5 : 0.3,
    };
  };

  const pilihTitik = (lat, lon) => {
    const s = selTerdekat(sel, lat, lon);
    setTitik({ lat, lon, sel: s });
  };

  const pilihSel = (s) => {
    setTitik({ lat: s.lat, lon: s.lon, sel: s });
    setTerbang({ lat: s.lat, lon: s.lon, zoom: 15, t: Date.now() });
  };

  const gantiKec = (k) => {
    setKecFilter(k);
    if (!k) return setTerbang({ lat: PUSAT[0], lon: PUSAT[1], zoom: 12, t: Date.now() });
    const s = sel.filter((x) => x.kecamatan === k);
    const lat = s.reduce((a, x) => a + x.lat, 0) / s.length;
    const lon = s.reduce((a, x) => a + x.lon, 0) / s.length;
    setTerbang({ lat, lon, zoom: 14, t: Date.now() });
  };

  // key memaksa GeoJSON digambar ulang ketika gaya berubah
  const kunciGrid = [alg, mode, fitur, kecFilter, titik?.sel?.h3].join("|");
  const totalRingkas = Object.values(ringkas).reduce((a, b) => a + b, 0);

  return (
    <div className="peta-layout">
      <aside className="kontrol">
        <section>
          <h3>Algoritma clustering</h3>
          <div className="segmen">
            {Object.entries(ALGORITMA).map(([k, v]) => (
              <button key={k} className={alg === k ? "aktif" : ""} onClick={() => setAlg(k)}>{v}</button>
            ))}
          </div>
        </section>

        <section>
          <h3>Warna sel</h3>
          <label><input type="radio" checked={mode === "kelas"} onChange={() => setMode("kelas")} /> Jenis kawasan</label>
          <label><input type="radio" checked={mode === "cluster"} onChange={() => setMode("cluster")} /> Nomor cluster</label>
          <label><input type="radio" checked={mode === "fitur"} onChange={() => setMode("fitur")} /> Nilai fitur</label>
          {mode === "fitur" && (
            <select value={fitur} onChange={(e) => setFitur(e.target.value)}>
              {Object.entries(FITUR).map(([k, v]) => <option key={k} value={k}>[{v.blok}] {v.label}</option>)}
            </select>
          )}
        </section>

        <section>
          <h3>Legenda</h3>
          {mode === "kelas" && Object.entries(KELAS).filter(([k]) => ringkas[k] || !kecFilter && sel.some((s) => s[`kelas_${alg}`] === k)).map(([k, v]) => (
            <div className="legenda" key={k}>
              <span className="kotak" style={{ background: v.warna }} />
              <span>{v.label}: <b>{ringkas[k] ?? 0}</b> sel ({fmt((100 * (ringkas[k] ?? 0)) / (totalRingkas || 1))}%)</span>
            </div>
          ))}
          {mode === "cluster" && meta.profil[ALGORITMA[alg]].map((p) => (
            <div className="legenda" key={p.cluster}>
              <span className="kotak" style={{ background: warnaCluster(p.cluster) }} />
              Cluster {p.cluster} → {KELAS[p.kelas].label} ({p.n_sel} sel)
            </div>
          ))}
          {mode === "fitur" && (
            <>
              <div className="catatan">{FITUR[fitur].label} ({FITUR[fitur].satuan}), kelas kuantil:</div>
              {PALET_SEKUENSIAL.map((w, i) => (
                <div className="legenda" key={w}>
                  <span className="kotak" style={{ background: w }} />
                  {i === 0 ? `≤ ${fmt(batas[0], 1)}` : i === PALET_SEKUENSIAL.length - 1 ? `> ${fmt(batas[i - 1], 1)}` : `${fmt(batas[i - 1], 1)} – ${fmt(batas[i], 1)}`}
                </div>
              ))}
            </>
          )}
          {mode !== "fitur" && <div className="legenda"><span className="titik" style={{ background: "#3b2314" }} /> Coffee shop ({kopi.length})</div>}
        </section>

        <section>
          <h3>Lapisan</h3>
          <label><input type="checkbox" checked={layer.kopi} onChange={(e) => setLayer({ ...layer, kopi: e.target.checked })} /> Coffee shop</label>
          {Object.entries(FASILITAS).map(([k, v]) => (
            <label key={k}>
              <input type="checkbox" checked={layer[k]} onChange={(e) => setLayer({ ...layer, [k]: e.target.checked })} />
              <span className="titik" style={{ background: v.warna }} /> {v.label} ({fasilitas.filter((f) => f.kategori === k).length})
            </label>
          ))}
          <label><input type="checkbox" checked={layer.kecamatan} onChange={(e) => setLayer({ ...layer, kecamatan: e.target.checked })} /> Batas kecamatan</label>
        </section>

        <section>
          <h3>Kecamatan</h3>
          <select value={kecFilter} onChange={(e) => gantiKec(e.target.value)}>
            <option value="">Seluruh Kota Bandung</option>
            {daftarKec.map((k) => <option key={k}>{k}</option>)}
          </select>
        </section>

        <section>
          <h3>Radius pencarian rekomendasi: {fmt(radius / 1000, 1)} km</h3>
          <input type="range" min={500} max={5000} step={250} value={radius} onChange={(e) => setRadius(+e.target.value)} />
        </section>
      </aside>

      <div className="peta">
        <MapContainer center={titik ? [titik.lat, titik.lon] : PUSAT} zoom={titik ? 14 : 12} preferCanvas style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" className="peta-dasar"
          />
          {/* klik sel ditangani oleh KlikPeta (sel terdekat dari titik klik = sel yang diklik) */}
          <GeoJSON key={kunciGrid} data={grid} style={style} />
          {layer.kecamatan && <GeoJSON data={kecamatan} interactive={false} style={{ color: "#333", weight: 0.8, fill: false }} />}
          {Object.keys(FASILITAS).filter((k) => layer[k]).flatMap((k) =>
            fasilitas.filter((f) => f.kategori === k).map((f, i) => (
              <CircleMarker key={`${k}${i}`} center={[f.lat, f.lon]} radius={3}
                pathOptions={{ color: FASILITAS[k].warna, fillColor: FASILITAS[k].warna, fillOpacity: 0.9, weight: 1 }}>
                <Tooltip>{FASILITAS[k].label}: {f.nama || "(tanpa nama)"}</Tooltip>
              </CircleMarker>
            )))}
          {layer.kopi && kopi.map((k, i) => (
            <CircleMarker key={`k${i}`} center={[k.lat, k.lon]} radius={3}
              pathOptions={{ color: "#fff", weight: 0.8, fillColor: "#3b2314", fillOpacity: 1 }}>
              <Tooltip>
                <b>{k.nama}</b><br />{k.kategori} · sumber {k.sumber}{k.mungkin_tutup ? " · mungkin tutup" : ""}
              </Tooltip>
            </CircleMarker>
          ))}
          {titik && (
            <CircleMarker center={[titik.lat, titik.lon]} radius={7} pathOptions={{ color: "#000", weight: 2, fillColor: "#ffd400", fillOpacity: 1 }} />
          )}
          <KlikPeta onKlik={(lat, lon) => pilihTitik(lat, lon)} />
          {terbang && <Terbang key={terbang.t} target={terbang} />}
        </MapContainer>
        {!titik && <div className="petunjuk">Klik sel atau titik mana pun di peta untuk melihat detail dan rekomendasi lokasi di sekitarnya.</div>}
      </div>

      <PanelDetail titik={titik} alg={alg} radius={radius} data={data} onPilihSel={pilihSel} onTutup={() => setTitik(null)} />
    </div>
  );
}
