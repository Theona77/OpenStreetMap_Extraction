// Uji unit (white box) peringkat kecamatan & perkiraan finansial: `npm test`
import { describe, it, expect } from "vitest";
import { peringkat, estimasi, skorKecamatan, PREFERENSI_AWAL, TIPE_USAHA, ASUMSI_UMUM, HARGA_LEVEL } from "./bisnis.js";

const z0 = { kde_kampus: 0, kde_kantor: 0, kde_sekolah: 0, kde_belanja: 0, penduduk_km2: 0, kerapatan_jalan: 0, kde_kopi: 0 };
const kec = (nama, z, extra = {}) => ({ kecamatan: nama, n_coffee_shop: 5, z: { ...z0, ...z }, pct_km: { potensial: 0 }, harga_gofood: { n: 0 }, ...extra });

describe("skorKecamatan", () => {
  it("kampus tinggi menang kalau target mahasiswa", () => {
    const pref = { ...PREFERENSI_AWAL, bobot: { ...PREFERENSI_AWAL.bobot, kde_kampus: 3, kde_kantor: 0, kde_sekolah: 0, kde_belanja: 0, penduduk_km2: 0, kerapatan_jalan: 0 } };
    const r = peringkat([kec("A", { kde_kantor: 2 }), kec("B", { kde_kampus: 2 })], pref);
    expect(r[0].kecamatan).toBe("B");
  });
  it("toleransi rendah menghukum kompetisi, toleransi tinggi tidak", () => {
    const k = kec("A", { kde_kampus: 1, kde_kopi: 2 });
    const rendah = skorKecamatan(k, { ...PREFERENSI_AWAL, toleransi: "rendah" }).skor;
    const tinggi = skorKecamatan(k, { ...PREFERENSI_AWAL, toleransi: "tinggi" }).skor;
    expect(tinggi - rendah).toBeCloseTo(2, 5);
  });
  it("porsi kawasan potensial menambah skor 0,5 × porsi", () => {
    const a = skorKecamatan(kec("A", {}), PREFERENSI_AWAL).skor;
    const b = skorKecamatan(kec("B", {}, { pct_km: { potensial: 100 } }), PREFERENSI_AWAL).skor;
    expect(b - a).toBeCloseTo(0.5, 5);
  });
  it("peringkat berurutan 1..n", () => {
    const r = peringkat([kec("A", {}), kec("B", { kde_kampus: 1 }), kec("C", { kde_kampus: -1 })], PREFERENSI_AWAL);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3]);
  });
});

describe("estimasi", () => {
  const A = ASUMSI_UMUM;
  it("rumus revenue, laba, modal sesuai asumsi", () => {
    const pref = { ...PREFERENSI_AWAL, tipe: "kios", segmen: 2, skenario: "sedang" };
    const f = estimasi(kec("A", {}), pref, null);
    const t = TIPE_USAHA.kios;
    const revenue = HARGA_LEVEL[2].tengah * A.transaksi_hari.sedang * A.hari_buka_bulan;
    const opex = t.karyawan * A.gaji_per_karyawan + t.sewa_bulan + t.utilitas_bulan;
    expect(f.revenue_bulan).toBe(revenue);
    expect(f.opex_bulan).toBe(opex);
    expect(f.laba_bersih_bulan).toBeCloseTo(revenue * (1 - A.hpp_persen / 100) - opex, 5);
    const capex = Object.values(t.capex).reduce((a, b) => a + b, 0);
    expect(f.modal_awal).toBe(capex + t.sewa_bulan * A.bulan_sewa_dimuka + opex * A.bulan_modal_kerja);
  });
  it("memakai harga pasar kecamatan bila ≥ 3 outlet GoFood", () => {
    const f = estimasi(kec("A", {}, { harga_gofood: { n: 5, median_level: 3 } }), PREFERENSI_AWAL, { n: 100, median_level: 2 });
    expect(f.level_harga).toBe(3);
  });
  it("jatuh ke median kota bila data kecamatan < 3 outlet", () => {
    const f = estimasi(kec("A", {}, { harga_gofood: { n: 1, median_level: 4 } }), PREFERENSI_AWAL, { n: 100, median_level: 2 });
    expect(f.level_harga).toBe(2);
  });
  it("BEP null bila laba bersih ≤ 0", () => {
    const f = estimasi(kec("A", {}), { ...PREFERENSI_AWAL, tipe: "kafe", segmen: 1, transaksi_hari: 10 }, null);
    expect(f.laba_bersih_bulan).toBeLessThan(0);
    expect(f.bep_bulan).toBeNull();
  });
  it("sewa isian pengguna menggantikan asumsi", () => {
    const f = estimasi(kec("A", {}), { ...PREFERENSI_AWAL, sewa_bulan: 1_000_000 }, null);
    expect(f.rincian_opex.sewa).toBe(1_000_000);
  });
});
