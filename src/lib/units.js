// Tüm ölçüler dahili olarak milimetre (mm) cinsindendir.
// Yazı boyutu ve çizgi kalınlığı tipografi geleneğine uygun olarak punto (pt) olarak saklanır.
export const PT = 25.4 / 72; // 1 pt = 0.3528 mm

export const UNITS = {
  mm: { label: 'mm', mm: 1, digits: 2 },
  cm: { label: 'cm', mm: 10, digits: 3 },
  in: { label: 'in', mm: 25.4, digits: 3 },
  px: { label: 'px', mm: 25.4 / 96, digits: 1 },
};

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const round = (v, d = 2) => {
  const p = 10 ** d;
  return Math.round((Number(v) + Number.EPSILON) * p) / p;
};
export const toUnit = (mm, unit) => round(mm / (UNITS[unit]?.mm || 1), UNITS[unit]?.digits ?? 2);
export const fromUnit = (v, unit) => Number(v) * (UNITS[unit]?.mm || 1);
export const fmtLen = (mm, unit) => `${toUnit(mm, unit)} ${unit}`;
export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;
export const normAngle = (a) => {
  let r = ((a + 180) % 360 + 360) % 360 - 180;
  return r === -180 ? 180 : r;
};
export const uid = () => Math.random().toString(36).slice(2, 10);
