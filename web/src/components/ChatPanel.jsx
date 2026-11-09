import { useEffect, useRef, useState } from "react";
import { md, tanyaAI } from "../ai.js";

const SARAN = [
  "Kecamatan mana yang paling cocok untuk coffee shop target mahasiswa dengan modal di bawah Rp150 juta?",
  "Berapa perkiraan modal dan kapan balik modal untuk kecamatan peringkat 1?",
  "Bandingkan kecamatan peringkat 1 dan 2. Mana yang risikonya lebih kecil?",
  "Apa yang harus saya cek di lapangan sebelum memilih lokasi?",
];

export default function ChatPanel({ buka, setBuka, konteks, status, pertanyaanMasuk, clearPertanyaan }) {
  const [pesan, setPesan] = useState([]);
  const [input, setInput] = useState("");
  const [memuat, setMemuat] = useState(false);
  const bawah = useRef(null);

  const kirim = async (teks) => {
    const t = (teks ?? input).trim();
    if (!t || memuat) return;
    const riwayat = [...pesan, { role: "user", text: t }];
    setPesan(riwayat); setInput(""); setMemuat(true);
    try {
      const jawaban = await tanyaAI(riwayat, konteks);
      setPesan([...riwayat, { role: "assistant", text: jawaban }]);
    } catch (e) {
      setPesan([...riwayat, { role: "assistant", text: `⚠️ ${e.message}`, galat: true }]);
    } finally {
      setMemuat(false);
    }
  };

  // pertanyaan dari tombol "Tanya AI" di halaman lain
  useEffect(() => {
    if (pertanyaanMasuk) { setBuka(true); kirim(pertanyaanMasuk); clearPertanyaan(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pertanyaanMasuk]);

  useEffect(() => { bawah.current?.scrollIntoView({ behavior: "smooth" }); }, [pesan, memuat]);

  if (!buka) {
    return <button className="chat-fab no-print" onClick={() => setBuka(true)}>🤖 Tanya AI</button>;
  }

  return (
    <div className="chat-panel no-print">
      <div className="chat-kepala">
        <b>Asisten analisis lokasi</b>
        <span className="abu">{status?.ok ? (status.punya_api_key ? `Gemini · ${status.model}` : "API key belum diisi") : "server belum aktif"}</span>
        <button onClick={() => setPesan([])} title="Percakapan baru">↺</button>
        <button onClick={() => setBuka(false)} title="Tutup">×</button>
      </div>
      <div className="chat-isi">
        {!status?.ok && (
          <div className="peringatan">Server chatbot belum berjalan. Jalankan <code>npm run dev</code> (web + server), dan isi <code>GEMINI_API_KEY</code> di <code>web/.env</code>.</div>
        )}
        {status?.ok && !status.punya_api_key && (
          <div className="peringatan">Isi <code>GEMINI_API_KEY</code> di <code>web/.env</code> (gratis di aistudio.google.com/apikey), lalu jalankan ulang server.</div>
        )}
        {pesan.length === 0 && (
          <div className="chat-saran">
            <p className="catatan">AI menjawab berdasarkan preferensi di halaman Analisis, peringkat kecamatan, asumsi biaya, dan lokasi yang kamu klik di peta.</p>
            {SARAN.map((s) => <button key={s} onClick={() => kirim(s)}>{s}</button>)}
          </div>
        )}
        {pesan.map((p, i) => (
          <div key={i} className={`chat-bubble ${p.role} ${p.galat ? "galat" : ""}`}>
            {p.role === "assistant" ? <div className="md" dangerouslySetInnerHTML={{ __html: md(p.text) }} /> : p.text}
          </div>
        ))}
        {memuat && <div className="chat-bubble assistant abu">Menganalisis…</div>}
        <div ref={bawah} />
      </div>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); kirim(); }}>
        <textarea rows={2} value={input} placeholder="Tanya soal lokasi, modal, kompetitor…" onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); kirim(); } }} />
        <button type="submit" disabled={memuat || !input.trim()}>Kirim</button>
      </form>
      <div className="catatan chat-kaki">Jawaban AI bisa keliru. Angka modal adalah perkiraan kasar berbasis asumsi.</div>
    </div>
  );
}
