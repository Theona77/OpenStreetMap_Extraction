// Uji unit (white box) untuk logika rekomendasi: `npm test`
import { describe, it, expect } from "vitest";
import { jarakM, selTerdekat, rekomendasi, batasKuantil, kelasKuantil, persentil, kTerdekat } from "./lib.js";

const sel = [
  { h3: "a", lat: -6.9, lon: 107.6, kelas_km: "potensial", skor_peluang: 0.5 },
  { h3: "b", lat: -6.91, lon: 107.6, kelas_km: "potensial", skor_peluang: 1.2 },
  { h3: "c", lat: -6.9, lon: 107.61, kelas_km: "kompetitif", skor_peluang: 2.0 },
  { h3: "d", lat: -7.0, lon: 107.6, kelas_km: "potensial", skor_peluang: 3.0 },
];

describe("jarakM", () => {
  it("0 untuk titik yang sama", () => expect(jarakM(-6.9, 107.6, -6.9, 107.6)).toBe(0));
  it("0,01° lintang ≈ 1.112 m", () => expect(jarakM(-6.9, 107.6, -6.91, 107.6)).toBeCloseTo(1112, -1));
});

describe("selTerdekat", () => {
  it("mengembalikan sel terdekat", () => expect(selTerdekat(sel, -6.9001, 107.6001).h3).toBe("a"));
  it("null jika di luar kota (lebih dari 350 m)", () => expect(selTerdekat(sel, -6.5, 107.0)).toBeNull());
});

describe("rekomendasi", () => {
  it("hanya kelas potensial, dalam radius, urut skor", () => {
    const r = rekomendasi(sel, -6.9, 107.6, "km", 2000, 5);
    expect(r.map((x) => x.h3)).toEqual(["b", "a"]); // c kompetitif, d terlalu jauh (±11 km)
  });
  it("kosong jika tidak ada sel potensial", () => expect(rekomendasi(sel, -6.9, 107.6, "hdb", 2000)).toEqual([]));
  it("membatasi jumlah hasil", () => expect(rekomendasi(sel, -6.9, 107.6, "km", 50000, 1)).toHaveLength(1));
});

describe("kuantil & persentil", () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  it("batas kuantil 5 kelas", () => expect(batasKuantil(v)).toHaveLength(4));
  it("kelas terendah & tertinggi", () => {
    const b = batasKuantil(v);
    expect(kelasKuantil(1, b)).toBe(0);
    expect(kelasKuantil(10, b)).toBe(4);
  });
  it("persentil", () => expect(persentil(5, v)).toBe(50));
});

describe("kTerdekat", () => {
  it("urut dari yang terdekat", () => expect(kTerdekat(sel, -7.0, 107.6, 2).map((x) => x.h3)).toEqual(["d", "b"]));
});
