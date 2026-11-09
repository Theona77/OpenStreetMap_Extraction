// Penghubung ke chatbot (server/server.js → Gemini) + penyusun konteks data.
import { marked } from "marked";
import DOMPurify from "dompurify";
import { TARGET_PASAR, TOLERANSI, TIPE_USAHA, ASUMSI_UMUM, HARGA_LEVEL } from "./bisnis.js";
import { KELAS } from "./lib.js";

export const md = (teks) => DOMPurify.sanitize(marked.parse(teks || ""));

export async function statusAI() {
  try {
    const r = await fetch("/api/status");
    return r.ok ? await r.json() : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function tanyaAI(pesan, konteks) {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pesan, konteks }),
  });
  const js = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(js.error || `HTTP ${r.status}`);
  return js.jawaban;
}

const bulat = (v, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

function ringkasFinansial(f) {
  return {
    tipe_usaha: f.tipe, harga_rata_per_transaksi: f.harga_rata, tingkat_harga: f.label_harga, sumber_harga: f.sumber_harga,
    transaksi_per_hari: f.transaksi_hari, revenue_per_bulan: Math.round(f.revenue_bulan),
    laba_kotor_per_bulan: Math.round(f.laba_kotor_bulan), biaya_operasional_per_bulan: Math.round(f.opex_bulan),
    rincian_biaya_operasional: f.rincian_opex, laba_bersih_per_bulan: Math.round(f.laba_bersih_bulan),
    modal_awal: Math.round(f.modal_awal), rincian_modal: f.rincian_modal,
    perkiraan_balik_modal_bulan: f.bep_bulan ? bulat(f.bep_bulan, 1) : "tidak balik modal pada skenario ini",
    skenario: Object.fromEntries(Object.entries(f.skenario).map(([k, s]) => [k, {
      transaksi_per_hari: s.transaksi_hari, revenue_per_bulan: Math.round(s.revenue_bulan), laba_bersih_per_bulan: Math.round(s.laba_bersih_bulan) }])),
  };
}

/** Konteks yang dikirim ke AI: preferensi, peringkat, asumsi, lokasi terpilih. Dijaga ringkas. */
export function buatKonteks({ pref, ranking, meta, kecStat, lokasi }) {
  const alg = pref.alg === "km" ? "K-Means" : "HDBSCAN";
  return {
    sistem: {
      wilayah: "Kota Bandung, 30 kecamatan, grid H3 ±0,1 km²",
      jumlah_coffee_shop_terdata: meta.jumlah.coffee_shop,
      algoritma_dipakai: alg,
      evaluasi_model: meta.evaluasi.filter((r) => r.set_fitur === meta.parameter.set_utama).map((r) => ({
        algoritma: r.algoritma, silhouette: bulat(r.silhouette, 3), noise_pct: bulat(r.noise_pct, 1),
        stabilitas_ARI: bulat(r.ARI_mean, 3), AUC_holdout: bulat(r.AUC_holdout, 3), AUC_temporal: bulat(r.AUC_temporal, 3) })),
      sumber_harga: kecStat?.sumber_harga ?? "belum ada data harga GoFood",
      rumus_skor_kecamatan: "permintaan (rata-rata berbobot z-score fitur pendukung sesuai target pasar) − λ×kompetisi (z kepadatan coffee shop) + 0,5×porsi kawasan potensial − 0,25×selisih segmen harga",
    },
    preferensi_pengguna: {
      target_pasar_bobot_0_sampai_3: Object.fromEntries(Object.entries(pref.bobot).map(([k, v]) => [TARGET_PASAR[k], v])),
      toleransi_kompetisi: `${TOLERANSI[pref.toleransi].label} (λ=${TOLERANSI[pref.toleransi].lambda})`,
      segmen_harga: pref.segmen === "pasar" ? "ikuti harga pasar kecamatan" : HARGA_LEVEL[pref.segmen].label,
      tipe_usaha: TIPE_USAHA[pref.tipe].label,
      skenario_penjualan: pref.transaksi_hari ? `${pref.transaksi_hari} transaksi/hari (diisi pengguna)` : pref.skenario,
      sewa_per_bulan: pref.sewa_bulan ?? `asumsi ${TIPE_USAHA[pref.tipe].sewa_bulan}`,
    },
    asumsi_biaya: { ...ASUMSI_UMUM, tipe_usaha: TIPE_USAHA[pref.tipe], catatan: "asumsi awal peneliti, belum divalidasi lapangan" },
    peringkat_kecamatan_top10: ranking.slice(0, 10).map((k) => ({
      peringkat: k.rank, kecamatan: k.kecamatan, skor: bulat(k.skor), alasan: k.alasan,
      indeks_permintaan: bulat(k.permintaan), indeks_kompetisi: bulat(k.kompetisi),
      persen_kawasan: Object.fromEntries(Object.entries(k[`pct_${pref.alg}`] || {}).map(([c, v]) => [KELAS[c]?.label ?? c, v])),
      coffee_shop_terdata: k.n_coffee_shop, coffee_shop_per_km2: k.kopi_per_km2, jarak_median_ke_coffee_shop_m: k.d_kopi_1_median_m,
      penduduk: k.penduduk, luas_km2: k.luas_km2,
      harga_gofood: k.harga_gofood?.n ? { outlet: k.harga_gofood.n, median_tingkat: k.harga_gofood.median_level } : "tidak ada",
      estimasi_finansial: ringkasFinansial(k.finansial),
      titik_potensial_terbaik: (k[`sel_terbaik_${pref.alg}`] || []).slice(0, 2),
    })),
    peringkat_lainnya: ranking.slice(10).map((k) => `${k.rank}. ${k.kecamatan} (skor ${bulat(k.skor)})`).join("; "),
    lokasi_dipilih_di_peta: lokasi ?? "belum ada",
  };
}
