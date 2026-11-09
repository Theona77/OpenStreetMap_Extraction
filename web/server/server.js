// Server kecil: (1) proxy chatbot ke Google Gemini supaya API key tidak terlihat di browser,
// (2) menyajikan hasil build website (folder dist/) untuk mode produksi.
// Jalankan: npm run server   (membaca web/.env: GEMINI_API_KEY, GEMINI_MODEL, PORT)

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SYSTEM_PROMPT } from "./prompt.js";

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const MAKS_BODY = 300_000; // byte
const MAKS_PESAN = 20;      // riwayat percakapan yang dikirim ke model

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".geojson": "application/geo+json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

function kirimJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

async function bacaBody(req) {
  let n = 0; const potong = [];
  for await (const c of req) {
    n += c.length;
    if (n > MAKS_BODY) throw Object.assign(new Error("Permintaan terlalu besar"), { code: 413 });
    potong.push(c);
  }
  return JSON.parse(Buffer.concat(potong).toString("utf-8") || "{}");
}

async function tanyaGemini(pesan, konteks) {
  const contents = pesan.slice(-MAKS_PESAN).map((p) => ({
    role: p.role === "assistant" ? "model" : "user",
    parts: [{ text: String(p.text).slice(0, 8000) }],
  }));
  // konteks data disisipkan di awal giliran pengguna terakhir
  const akhir = contents[contents.length - 1];
  akhir.parts.unshift({ text: `KONTEKS DATA (JSON, hasil sistem; gunakan hanya angka dari sini):\n${JSON.stringify(konteks ?? {})}\n\nPERTANYAAN:` });

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    }),
  });
  const js = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = js?.error?.message || `HTTP ${r.status}`;
    throw Object.assign(new Error(`Gemini: ${msg}`), { code: r.status === 429 ? 429 : 502 });
  }
  const teks = js?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!teks) throw Object.assign(new Error(`Gemini tidak memberi jawaban (${js?.candidates?.[0]?.finishReason || "tanpa alasan"})`), { code: 502 });
  return teks;
}

async function sajikanStatis(req, res) {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST)) return kirimJson(res, 403, { error: "terlarang" });
  try {
    if ((await stat(f)).isDirectory()) f = path.join(f, "index.html");
  } catch {
    f = path.join(DIST, "index.html");
  }
  try {
    const isi = await readFile(f);
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
    res.end(isi);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("dist/ belum ada. Jalankan `npm run build`, atau pakai `npm run dev` untuk pengembangan.");
  }
}

http.createServer(async (req, res) => {
  try {
    if (req.url === "/api/status") {
      return kirimJson(res, 200, { ok: true, model: MODEL, punya_api_key: Boolean(API_KEY) });
    }
    if (req.url === "/api/chat" && req.method === "POST") {
      if (!API_KEY) return kirimJson(res, 503, { error: "GEMINI_API_KEY belum diisi di web/.env" });
      const { pesan, konteks } = await bacaBody(req);
      if (!Array.isArray(pesan) || !pesan.length) return kirimJson(res, 400, { error: "pesan kosong" });
      const jawaban = await tanyaGemini(pesan, konteks);
      return kirimJson(res, 200, { jawaban, model: MODEL });
    }
    if (req.url.startsWith("/api/")) return kirimJson(res, 404, { error: "tidak ditemukan" });
    return sajikanStatis(req, res);
  } catch (e) {
    console.error(e.message);
    return kirimJson(res, e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message });
  }
}).listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}  | model ${MODEL} | API key ${API_KEY ? "ada" : "BELUM DIISI (web/.env)"}`);
});
