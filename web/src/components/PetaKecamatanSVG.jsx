// Peta kecamatan sederhana (SVG) untuk laporan: warna = skor kecamatan, angka = peringkat.
const PALET = ["#d73027", "#fc8d59", "#fee08b", "#d9ef8b", "#91cf60", "#1a9850"];

export default function PetaKecamatanSVG({ kecamatan, ranking, lebar = 520 }) {
  const byNama = Object.fromEntries(ranking.map((r) => [r.kecamatan, r]));
  const ring = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of kecamatan.features) for (const poly of ring(f.geometry)) for (const [x, y] of poly[0]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const kx = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
  const skala = lebar / ((maxX - minX) * kx);
  const tinggi = (maxY - minY) * skala;
  const P = ([x, y]) => [((x - minX) * kx * skala).toFixed(1), ((maxY - y) * skala).toFixed(1)];
  const skor = ranking.map((r) => r.skor);
  const lo = Math.min(...skor), hi = Math.max(...skor);
  const warna = (s) => PALET[Math.min(PALET.length - 1, Math.floor(((s - lo) / (hi - lo || 1)) * PALET.length))];

  return (
    <svg viewBox={`0 0 ${lebar} ${tinggi.toFixed(0)}`} width="100%" role="img" aria-label="Peta skor kecamatan">
      {kecamatan.features.map((f) => {
        const r = byNama[f.properties.kecamatan];
        const d = ring(f.geometry).map((poly) => poly.map((cin) => "M" + cin.map((c) => P(c).join(",")).join("L") + "Z").join("")).join("");
        return <path key={f.properties.kecamatan} d={d} fill={r ? warna(r.skor) : "#eee"} stroke="#fff" strokeWidth="1" />;
      })}
      {kecamatan.features.map((f) => {
        const r = byNama[f.properties.kecamatan];
        if (!r) return null;
        const pts = ring(f.geometry)[0][0];
        const cx = pts.reduce((a, c) => a + c[0], 0) / pts.length, cy = pts.reduce((a, c) => a + c[1], 0) / pts.length;
        const [x, y] = P([cx, cy]);
        return (
          <text key={"t" + r.kecamatan} x={x} y={y} fontSize={r.rank <= 5 ? 13 : 9} fontWeight={r.rank <= 5 ? 700 : 400}
            textAnchor="middle" dominantBaseline="middle" fill="#111" stroke="#fff" strokeWidth="2.5" paintOrder="stroke">
            {r.rank}
          </text>
        );
      })}
    </svg>
  );
}

export const LEGENDA_SKOR = PALET;
