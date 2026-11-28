import React from 'react';
import QRCode from 'qrcode';
import { PT } from './units.js';
import { cssFontFamily, effStyle } from './fonts.js';

const qrCache = new Map();
export function qrMatrix(text, ecc = 'M') {
  const key = ecc + '|' + text;
  if (qrCache.has(key)) return qrCache.get(key);
  let res = null;
  try {
    if (text) {
      const q = QRCode.create(String(text), { errorCorrectionLevel: ecc });
      const n = q.modules.size, d = q.modules.data;
      let path = '';
      for (let r = 0; r < n; r++) {
        let c = 0;
        while (c < n) {
          if (d[r * n + c]) { let s = c; while (c < n && d[r * n + c]) c++; path += `M${s} ${r}h${c - s}v1h-${c - s}z`; } else c++;
        }
      }
      res = { n, path };
    }
  } catch { res = null; }
  if (qrCache.size > 60) qrCache.clear();
  qrCache.set(key, res);
  return res;
}

export const starPoints = (o) => {
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2, pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (-90 + 36 * i) * Math.PI / 180, r = i % 2 ? 0.382 : 1;
    pts.push(`${(cx + (o.w / 2) * r * Math.cos(a)).toFixed(3)},${(cy + (o.h / 2) * r * Math.sin(a)).toFixed(3)}`);
  }
  return pts.join(' ');
};

function strokeProps(o) {
  if (!o.stroke || o.stroke === 'none') return { stroke: 'none' };
  const sw = Math.max(0.01, (o.strokeWidth || 1) * PT);
  const p = { stroke: o.stroke, strokeWidth: sw, strokeLinejoin: 'miter' };
  if (o.dash === 'dash') p.strokeDasharray = `${sw * 4} ${sw * 3}`;
  if (o.dash === 'dot') { p.strokeDasharray = `0 ${sw * 2.2}`; p.strokeLinecap = 'round'; }
  if (o.type === 'line' && o.dash !== 'dot') p.strokeLinecap = o.cap || 'round';
  return p;
}

export function Shape({ o }) {
  const fill = o.fill && o.fill !== 'none' ? o.fill : 'none';
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  const tr = o.rotation ? `rotate(${o.rotation} ${cx} ${cy})` : undefined;
  const common = { transform: tr, opacity: o.opacity ?? 1 };
  switch (o.type) {
    case 'rect': {
      const r = Math.min(o.radius || 0, Math.min(o.w, o.h) / 2);
      return <rect {...common} x={o.x} y={o.y} width={o.w} height={o.h} rx={r} ry={r} fill={fill} {...strokeProps(o)} />;
    }
    case 'ellipse':
      return <ellipse {...common} cx={cx} cy={cy} rx={o.w / 2} ry={o.h / 2} fill={fill} {...strokeProps(o)} />;
    case 'triangle':
      return <polygon {...common} points={`${cx},${o.y} ${o.x + o.w},${o.y + o.h} ${o.x},${o.y + o.h}`} fill={fill} {...strokeProps(o)} />;
    case 'star':
      return <polygon {...common} points={starPoints(o)} fill={fill} {...strokeProps(o)} />;
    case 'line':
      return <line {...common} x1={o.x} y1={o.y} x2={o.x + o.w} y2={o.y} {...strokeProps(o)} />;
    case 'image':
      return o.src ? <image {...common} x={o.x} y={o.y} width={o.w} height={o.h} href={o.src} preserveAspectRatio="none" /> : <rect {...common} x={o.x} y={o.y} width={o.w} height={o.h} fill="#d1d1d6" />;
    case 'qr': {
      const m = qrMatrix(o.text, o.ecc);
      const q = 2; // sessiz bölge (modül)
      return <g {...common}>
        {o.qrBg && o.qrBg !== 'none' && <rect x={o.x} y={o.y} width={o.w} height={o.h} fill={o.qrBg} />}
        {m ? <g transform={`translate(${o.x} ${o.y}) scale(${o.w / (m.n + 2 * q)} ${o.h / (m.n + 2 * q)}) translate(${q} ${q})`}><path d={m.path} fill={o.fill} shapeRendering="crispEdges" /></g>
          : <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="none" stroke="#ff3b30" strokeWidth={0.4} />}
      </g>;
    }
    case 'text': {
      const fs = (o.fontSize || 12) * PT, lh = fs * (o.lineHeight || 1.2);
      const st = effStyle(o);
      const anchor = o.align === 'center' ? 'middle' : o.align === 'right' ? 'end' : 'start';
      const tx = o.align === 'center' ? o.x + o.w / 2 : o.align === 'right' ? o.x + o.w : o.x;
      const lines = String(o.text ?? '').split('\n');
      const ls = ((o.letterSpacing || 0) / 100) * fs;
      return <text {...common} fontFamily={cssFontFamily(o.fontFamily)} fontSize={fs} fontWeight={st.bold ? 700 : 400} fontStyle={st.italic ? 'italic' : 'normal'}
        fill={fill} textAnchor={anchor} letterSpacing={ls || undefined} {...(o.stroke && o.stroke !== 'none' ? strokeProps(o) : {})} style={{ whiteSpace: 'pre' }}>
        {lines.map((t, i) => <tspan key={i} x={tx} y={o.y + (lh - fs) / 2 + fs * 0.8 + i * lh}>{t || ' '}</tspan>)}
      </text>;
    }
    default:
      return null;
  }
}

// Sayfa üzerindeki tüm nesneler (gizli olanlar hariç)
export function Objects({ objs, interactive = false }) {
  return objs.filter((o) => !o.hidden).map((o) => (
    interactive
      ? <g key={o.id} data-oid={o.id}><Shape o={o} />{o.type === 'line' && <HitLine o={o} />}</g>
      : <Shape key={o.id} o={o} />
  ));
}
function HitLine({ o }) {
  const cx = o.x + o.w / 2, cy = o.y;
  return <line x1={o.x} y1={o.y} x2={o.x + o.w} y2={o.y} stroke="transparent" strokeWidth={Math.max(3, (o.strokeWidth || 1) * PT + 2)}
    transform={o.rotation ? `rotate(${o.rotation} ${cx} ${cy})` : undefined} />;
}
