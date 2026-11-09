// Peringkat kecamatan sesuai preferensi + perkiraan revenue & modal kasar.
// SEMUA angka biaya di file ini adalah ASUMSI AWAL peneliti, bukan data lapangan.
// Validasi lewat wawancara pemilik coffee shop / survei harga, lalu ubah di sini (atau langsung di form website).

// ---------------------------------------------------------------- harga
// Tingkat harga GoFood -> titik tengah rentang (Rp per menu/transaksi)
export const HARGA_LEVEL = {
  1: { label: "< Rp16rb", tengah: 13000 },
  2: { label: "Rp16–40rb", tengah: 28000 },
  3: { label: "Rp40–100rb", tengah: 70000 },
  4: { label: "> Rp100rb", tengah: 125000 },
};

// ---------------------------------------------------------------- tipe usaha (asumsi)
export const TIPE_USAHA = {
  kios: {
    label: "Kios / grab-and-go (tanpa kursi)",
    karyawan: 2, sewa_bulan: 3_000_000, utilitas_bulan: 1_500_000,
    capex: { peralatan_kopi: 25_000_000, renovasi_interior: 10_000_000, furnitur: 5_000_000, izin_dan_lainnya: 3_000_000, stok_awal: 5_000_000 },
  },
  kedai: {
    label: "Kedai kecil (±20 kursi)",
    karyawan: 4, sewa_bulan: 8_000_000, utilitas_bulan: 3_000_000,
    capex: { peralatan_kopi: 60_000_000, renovasi_interior: 60_000_000, furnitur: 30_000_000, izin_dan_lainnya: 5_000_000, stok_awal: 10_000_000 },
  },
  kafe: {
    label: "Kafe (±50 kursi)",
    karyawan: 8, sewa_bulan: 20_000_000, utilitas_bulan: 7_000_000,
    capex: { peralatan_kopi: 120_000_000, renovasi_interior: 200_000_000, furnitur: 80_000_000, izin_dan_lainnya: 10_000_000, stok_awal: 20_000_000 },
  },
};

export const ASUMSI_UMUM = {
  gaji_per_karyawan: 4_500_000, // ±UMK Kota Bandung 2025 (Rp4.482.914); perbarui sesuai UMK terbaru
  hpp_persen: 35,               // harga pokok (bahan) sebagai % harga jual
  hari_buka_bulan: 30,
  bulan_sewa_dimuka: 12,        // sewa ruko/kios di Indonesia umumnya dibayar tahunan di muka
  bulan_modal_kerja: 3,         // cadangan biaya operasional
  transaksi_hari: { rendah: 40, sedang: 80, tinggi: 150 },
};

// ---------------------------------------------------------------- preferensi -> peringkat
export const TARGET_PASAR = {
  kde_kampus: "Mahasiswa (dekat kampus)",
  kde_kantor: "Pekerja kantoran",
  kde_sekolah: "Pelajar & orang tua (sekolah)",
  kde_belanja: "Pengunjung pusat perbelanjaan",
  penduduk_km2: "Warga sekitar (permukiman padat)",
  kerapatan_jalan: "Aksesibilitas jalan",
};

export const TOLERANSI = {
  rendah: { label: "Hindari kompetisi", lambda: 1.0 },
  sedang: { label: "Seimbang", lambda: 0.5 },
  tinggi: { label: "Tidak masalah ramai (ikut keramaian)", lambda: 0.0 },
};

export const PREFERENSI_AWAL = {
  bobot: { kde_kampus: 2, kde_kantor: 2, kde_sekolah: 1, kde_belanja: 1, penduduk_km2: 1, kerapatan_jalan: 1 },
  toleransi: "sedang",
  segmen: "pasar",       // "pasar" (ikuti harga kecamatan) | 1 | 2 | 3 | 4
  tipe: "kedai",
  skenario: "sedang",
  sewa_bulan: null,      // null = pakai asumsi tipe usaha
  transaksi_hari: null,  // null = pakai skenario
  alg: "km",
};

/**
 * Skor kecamatan = permintaan − λ·kompetisi + 0,5·porsi_potensial − 0,25·|selisih segmen harga|
 * permintaan = rata-rata berbobot z-score fitur pendukung (bobot dari target pasar pengguna).
 */
export function skorKecamatan(k, pref) {
  const bobot = Object.entries(pref.bobot).filter(([, w]) => w > 0);
  const totalW = bobot.reduce((a, [, w]) => a + w, 0) || 1;
  const permintaan = bobot.reduce((a, [f, w]) => a + w * (k.z[f] ?? 0), 0) / totalW;
  const lambda = TOLERANSI[pref.toleransi].lambda;
  const kompetisi = k.z.kde_kopi ?? 0;
  const porsiPotensial = (k[`pct_${pref.alg}`]?.potensial ?? 0) / 100;
  const levelPasar = k.harga_gofood?.n >= 3 ? k.harga_gofood.median_level : null;
  const selisihSegmen = pref.segmen !== "pasar" && levelPasar ? Math.abs(Number(pref.segmen) - levelPasar) : 0;
  const skor = permintaan - lambda * kompetisi + 0.5 * porsiPotensial - 0.25 * selisihSegmen;
  return { skor, permintaan, kompetisi, porsiPotensial, selisihSegmen };
}

export function alasan(k, s, pref) {
  const out = [];
  const top = Object.entries(pref.bobot).filter(([, w]) => w > 0)
    .map(([f]) => [f, k.z[f] ?? 0]).sort((a, b) => b[1] - a[1]);
  const kuat = top.filter(([, z]) => z > 0.3).slice(0, 2).map(([f]) => TARGET_PASAR[f].split(" (")[0].toLowerCase());
  if (kuat.length) out.push(`kuat untuk ${kuat.join(" & ")}`);
  if (s.porsiPotensial >= 0.4) out.push(`${Math.round(100 * s.porsiPotensial)}% wilayahnya kawasan potensial`);
  if (s.kompetisi > 0.7) out.push(`kompetisi tinggi (${k.n_coffee_shop} coffee shop)`);
  else if (s.kompetisi < -0.3) out.push(`kompetisi rendah (${k.n_coffee_shop} coffee shop)`);
  if (s.permintaan < 0) out.push("faktor pendukung di bawah rata-rata kota");
  return out.join("; ");
}

export function peringkat(kecamatan, pref, hargaKota) {
  return kecamatan
    .map((k) => {
      const s = skorKecamatan(k, pref);
      return { ...k, ...s, alasan: alasan(k, s, pref), finansial: estimasi(k, pref, hargaKota) };
    })
    .sort((a, b) => b.skor - a.skor)
    .map((k, i) => ({ ...k, rank: i + 1 }));
}

// ---------------------------------------------------------------- perkiraan finansial
export function levelHarga(k, pref, hargaKota) {
  if (pref.segmen !== "pasar") return { level: Number(pref.segmen), sumber: "segmen pilihan pengguna" };
  if (k?.harga_gofood?.n >= 3) return { level: Math.round(k.harga_gofood.median_level), sumber: `median ${k.harga_gofood.n} coffee shop GoFood di kecamatan ini` };
  if (hargaKota?.n) return { level: Math.round(hargaKota.median_level), sumber: `median coffee shop GoFood se-kota (data kecamatan < 3 outlet)` };
  return { level: 2, sumber: "asumsi (data harga belum tersedia)" };
}

export function estimasi(k, pref, hargaKota) {
  const t = TIPE_USAHA[pref.tipe];
  const A = ASUMSI_UMUM;
  const { level, sumber } = levelHarga(k, pref, hargaKota);
  const harga = HARGA_LEVEL[level].tengah;
  const skenario = (n) => {
    const revenue = harga * n * A.hari_buka_bulan;
    const labaKotor = revenue * (1 - A.hpp_persen / 100);
    return { transaksi_hari: n, revenue_bulan: revenue, laba_kotor_bulan: labaKotor };
  };
  const sewa = pref.sewa_bulan ?? t.sewa_bulan;
  const opex = t.karyawan * A.gaji_per_karyawan + sewa + t.utilitas_bulan;
  const capex = Object.values(t.capex).reduce((a, b) => a + b, 0);
  const modal = capex + sewa * A.bulan_sewa_dimuka + opex * A.bulan_modal_kerja;
  const nUtama = pref.transaksi_hari ?? A.transaksi_hari[pref.skenario];
  const utama = skenario(nUtama);
  const labaBersih = utama.laba_kotor_bulan - opex;
  return {
    level_harga: level, label_harga: HARGA_LEVEL[level].label, harga_rata: harga, sumber_harga: sumber,
    tipe: t.label, transaksi_hari: nUtama,
    revenue_bulan: utama.revenue_bulan, laba_kotor_bulan: utama.laba_kotor_bulan,
    opex_bulan: opex, rincian_opex: { gaji: t.karyawan * A.gaji_per_karyawan, sewa, utilitas: t.utilitas_bulan },
    laba_bersih_bulan: labaBersih,
    modal_awal: modal, rincian_modal: { ...t.capex, sewa_dimuka: sewa * A.bulan_sewa_dimuka, modal_kerja: opex * A.bulan_modal_kerja },
    bep_bulan: labaBersih > 0 ? modal / labaBersih : null,
    skenario: Object.fromEntries(Object.entries(A.transaksi_hari).map(([nm, n]) => {
      const s = skenario(n);
      return [nm, { ...s, laba_bersih_bulan: s.laba_kotor_bulan - opex }];
    })),
  };
}

export const rupiah = (v) =>
  v == null || !Number.isFinite(v) ? "–" : "Rp" + Math.round(v).toLocaleString("id-ID");
export const jutaan = (v) =>
  v == null || !Number.isFinite(v) ? "–" : `Rp${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
