import React from 'react';
import { UNITS } from '../lib/units.js';

const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const R = 20;

function ticks(len, z, off, unit) {
  const pxPer = z * UNITS[unit].mm; // 1 birim = pxPer px
  const step = STEPS.find((s) => s * pxPer >= 64) || 1000;
  const minor = step / (step === 1 || step === 10 || step === 100 || step === 1000 ? 10 : step === 2 || step === 20 || step === 200 ? 4 : 5);
  const out = [];
  const start = Math.floor((-off / pxPer) / minor) * minor, end = (len - off) / pxPer;
  for (let v = start; v <= end + minor; v += minor) {
    const rv = Math.round(v / minor) * minor, major = Math.abs(rv / step - Math.round(rv / step)) < 1e-6;
    out.push({ p: rv * pxPer + off, major, label: major ? String(Math.round(rv * 1000) / 1000) : null });
  }
  return out;
}

export default function Rulers({ view, size, unit }) {
  const tx = ticks(size.w, view.z, view.x, unit), ty = ticks(size.h, view.z, view.y, unit);
  return (
    <div className="rulers" aria-hidden="true">
      <div className="corner" />
      <svg className="rul-h" width={size.w} height={R}>
        {tx.map((t, i) => <g key={i}><line x1={t.p} x2={t.p} y1={t.major ? 8 : 14} y2={R} />{t.label != null && <text x={t.p + 3} y={9}>{t.label}</text>}</g>)}
      </svg>
      <svg className="rul-v" width={R} height={size.h}>
        {ty.map((t, i) => <g key={i}><line y1={t.p} y2={t.p} x1={t.major ? 8 : 14} x2={R} />{t.label != null && <text transform={`translate(9 ${t.p - 3}) rotate(-90)`}>{t.label}</text>}</g>)}
      </svg>
    </div>
  );
}
