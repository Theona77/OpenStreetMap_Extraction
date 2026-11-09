import { useEffect, useMemo, useState } from "react";
import PetaPage from "./components/PetaPage.jsx";
import PerbandinganPage from "./components/PerbandinganPage.jsx";
import MetodePage from "./components/MetodePage.jsx";
import AnalisisPage from "./components/AnalisisPage.jsx";
import Laporan from "./components/Laporan.jsx";
import ChatPanel from "./components/ChatPanel.jsx";
import { PREFERENSI_AWAL, peringkat } from "./bisnis.js";
import { buatKonteks, statusAI } from "./ai.js";

const FILE = ["grid.geojson", "coffee_shop.json", "fasilitas.json", "kecamatan.geojson", "meta.json"];
const TAB = { peta: "Peta Rekomendasi", analisis: "Analisis & Laporan", banding: "K-Means vs HDBSCAN", metode: "Data & Metode" };

function bacaPref() {
  try {
    const p = JSON.parse(localStorage.getItem("preferensi") || "null");
    return p ? { ...PREFERENSI_AWAL, ...p, bobot: { ...PREFERENSI_AWAL.bobot, ...p.bobot } } : PREFERENSI_AWAL;
  } catch {
    return PREFERENSI_AWAL;
  }
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const awal = window.location.hash.slice(1);
  const [tab, setTabState] = useState(awal in TAB ? awal : awal === "laporan" ? "analisis" : "peta");
  const [pref, setPref] = useState(bacaPref);
  const [lokasi, setLokasi] = useState(null);
  const [laporan, setLaporan] = useState(awal === "laporan"); // #laporan membuka laporan langsung
  const [chatBuka, setChatBuka] = useState(false);
  const [pertanyaan, setPertanyaan] = useState(null);
  const [ai, setAi] = useState(null);

  const setTab = (t) => {
    setTabState(t);
    window.history.replaceState(null, "", t === "peta" ? window.location.pathname + window.location.search : `#${t}`);
  };

  useEffect(() => {
    const base = `${import.meta.env.BASE_URL}data/`;
    const ambil = (f) => fetch(base + f).then((r) => {
      if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
      return r.json();
    });
    Promise.all([...FILE.map(ambil), ambil("kecamatan_stat.json").catch(() => null)])
      .then(([grid, kopi, fasilitas, kecamatan, meta, kecStat]) => {
        const sel = grid.features.map((f) => f.properties);
        setData({ grid, sel, kopi, fasilitas, kecamatan, meta, kecStat });
      })
      .catch((e) => setError(e.message));
    statusAI().then(setAi);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("preferensi", JSON.stringify(pref)); } catch { /* mode privat */ }
  }, [pref]);

  const ranking = useMemo(
    () => (data?.kecStat ? peringkat(data.kecStat.kecamatan, pref, data.kecStat.harga_kota) : []),
    [data, pref],
  );
  const konteks = useMemo(
    () => (data ? buatKonteks({ pref, ranking, meta: data.meta, kecStat: data.kecStat, lokasi }) : {}),
    [data, pref, ranking, lokasi],
  );
  const tanyaAI = (q) => { setPertanyaan(q); setChatBuka(true); };
  const aiAktif = Boolean(ai?.ok && ai?.punya_api_key);

  return (
    <div className="app">
      <header className="no-print">
        <div className="judul">
          <h1>Peta Rekomendasi Lokasi Coffee Shop</h1>
          <span>Kota Bandung · KDE + KNN · K-Means vs HDBSCAN</span>
        </div>
        <nav>
          {Object.entries(TAB).map(([k, v]) => (
            <button key={k} className={tab === k ? "aktif" : ""} onClick={() => setTab(k)}>{v}</button>
          ))}
        </nav>
      </header>
      <main className="no-print">
        {error && <div className="pesan error">Gagal memuat data: {error}. Jalankan notebook <code>notebook_rekomendasi/rekomendasi_v2.ipynb</code> dulu.</div>}
        {!error && !data && <div className="pesan">Memuat data…</div>}
        {data && tab === "peta" && <PetaPage data={data} onLokasi={setLokasi} />}
        {data && tab === "analisis" && (data.kecStat
          ? <AnalisisPage data={data} pref={pref} setPref={setPref} ranking={ranking} onLaporan={() => setLaporan(true)} onTanyaAI={tanyaAI} />
          : <div className="pesan">File <code>kecamatan_stat.json</code> belum ada. Jalankan ulang <code>rekomendasi_v2.ipynb</code>.</div>)}
        {data && tab === "banding" && <PerbandinganPage meta={data.meta} />}
        {data && tab === "metode" && <MetodePage meta={data.meta} kecStat={data.kecStat} />}
      </main>
      {data && laporan && ranking.length > 0 && (
        <Laporan data={data} pref={pref} ranking={ranking} konteks={konteks} aiAktif={aiAktif} onTutup={() => setLaporan(false)} />
      )}
      {data && (
        <ChatPanel buka={chatBuka} setBuka={setChatBuka} konteks={konteks} status={ai}
          pertanyaanMasuk={pertanyaan} clearPertanyaan={() => setPertanyaan(null)} />
      )}
    </div>
  );
}
