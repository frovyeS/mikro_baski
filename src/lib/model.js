import { PT, uid, rad, deg, normAngle } from './units.js';
import { DEFAULT_FONT, measureText } from './fonts.js';

export const SCHEMA = 2;

export const PRESETS = [
  { id: 'a4', name: 'A4', w: 210, h: 297, group: 'Kağıt' },
  { id: 'a5', name: 'A5', w: 148, h: 210, group: 'Kağıt' },
  { id: 'a6', name: 'A6', w: 105, h: 148, group: 'Kağıt' },
  { id: 'a3', name: 'A3', w: 297, h: 420, group: 'Kağıt' },
  { id: 'letter', name: 'Letter', w: 215.9, h: 279.4, group: 'Kağıt' },
  { id: 'card', name: 'Kartvizit', w: 85, h: 55, group: 'Baskı' },
  { id: 'invite', name: 'Davetiye', w: 140, h: 100, group: 'Baskı' },
  { id: 'flyer', name: 'Broşür (DL)', w: 99, h: 210, group: 'Baskı' },
  { id: 'poster', name: 'Poster 50×70', w: 500, h: 700, group: 'Baskı' },
  { id: 'sticker', name: 'Etiket 100×100', w: 100, h: 100, group: 'Baskı' },
];

export const defaultDoc = () => ({ name: 'Adsız tasarım', w: 210, h: 297, unit: 'mm', bg: '#ffffff', bleed: 3, safe: 5 });

export const TYPE_LABELS = { text: 'Metin', rect: 'Dikdörtgen', ellipse: 'Elips', triangle: 'Üçgen', star: 'Yıldız', line: 'Çizgi', image: 'Görsel', qr: 'QR kodu' };

export function nextName(objs, type) {
  const label = TYPE_LABELS[type];
  let max = 0;
  for (const o of objs) {
    if (o.type !== type) continue;
    const m = new RegExp(`^${label} (\\d+)$`).exec(o.name || '');
    max = Math.max(max, m ? Number(m[1]) : 1);
  }
  return `${label} ${max + 1}`;
}

export const SWATCHES = ['#111111', '#ffffff', '#6e6e73', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00a6a6', '#0a84ff', '#5e5ce6', '#af52de', '#ff2d55'];

export function createObject(type, over = {}, objs = []) {
  const base = {
    id: uid(), type, name: nextName(objs, type), x: 0, y: 0, w: 40, h: 30, rotation: 0, opacity: 1, locked: false, hidden: false,
    fill: '#0a84ff', stroke: 'none', strokeWidth: 1, dash: 'solid', radius: 0,
  };
  switch (type) {
    case 'text':
      Object.assign(base, { text: 'Metin', fontFamily: DEFAULT_FONT, fontSize: 24, bold: false, italic: false, align: 'left', lineHeight: 1.2, letterSpacing: 0, fill: '#111111', stroke: 'none' });
      break;
    case 'line':
      Object.assign(base, { w: 60, h: 0, fill: 'none', stroke: '#111111', strokeWidth: 2, cap: 'round' });
      break;
    case 'qr':
      Object.assign(base, { w: 30, h: 30, text: 'https://ornek.com', fill: '#111111', qrBg: '#ffffff', ecc: 'M' });
      break;
    case 'image':
      Object.assign(base, { fill: 'none', src: '', natW: 0, natH: 0 });
      break;
    case 'star':
    case 'triangle':
    case 'ellipse':
    case 'rect':
    default:
      break;
  }
  const o = { ...base, ...over };
  if (o.type === 'text') Object.assign(o, measureText(o));
  return o;
}

// ---- Geometri ----
export function corners(o) {
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2, a = rad(o.rotation || 0), c = Math.cos(a), s = Math.sin(a);
  const hw = o.w / 2, hh = o.h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}
export function aabb(o) {
  const p = corners(o);
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
  // Çizgilerin kalınlığı da kapsama dahil
  if (o.type === 'line') {
    const t = ((o.strokeWidth || 1) * PT) / 2;
    return { x0: x0 - t, y0: y0 - t, x1: x1 + t, y1: y1 + t, x: x0 - t, y: y0 - t, w: x1 - x0 + 2 * t, h: y1 - y0 + 2 * t };
  }
  return { x0, y0, x1, y1, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
export function unionBox(list) {
  if (!list.length) return null;
  const bs = list.map(aabb);
  const x0 = Math.min(...bs.map((b) => b.x0)), y0 = Math.min(...bs.map((b) => b.y0));
  const x1 = Math.max(...bs.map((b) => b.x1)), y1 = Math.max(...bs.map((b) => b.y1));
  return { x0, y0, x1, y1, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// ---- v1 -> v2 dönüşümü (eski .mikrobaski dosyaları ve eski otomatik kayıt) ----
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Geçersiz dosya');
  const rd = raw.doc || {};
  const objects = raw.objects || raw.objs || raw.layers || [];
  if ((raw.schemaVersion || 1) >= 2) {
    const doc = { ...defaultDoc(), ...rd };
    return { doc, objs: objects.map((o) => normalizeObj(o)) };
  }
  const unit = ['mm', 'cm', 'in', 'px'].includes(rd.unit) ? rd.unit : 'mm';
  const k = { mm: 1, cm: 10, in: 25.4, px: 25.4 / 96 }[unit];
  const doc = { ...defaultDoc(), name: rd.name || 'Adsız tasarım', unit, w: (Number(rd.w) || 210) * k, h: (Number(rd.h) || 297) * k, bg: rd.bg || '#ffffff', bleed: (Number(rd.bleed) || 0) * k, safe: (Number(rd.safe) || 0) * k };
  const objs = objects.map((old) => {
    const o = { ...old };
    if (o.type === 'circle') o.type = 'ellipse';
    if (o.type === 'text') {
      o.fontSize = Math.max(4, Math.round(((old.fontSize || 18) / PT) * 10) / 10);
      o.fontFamily = DEFAULT_FONT;
      o.align = old.align === 'middle' ? 'center' : old.align === 'end' ? 'right' : 'left';
    }
    if (o.type === 'line') {
      const len = Math.hypot(old.w || 0, old.h || 0) || 60;
      const cx = old.x + (old.w || 0) / 2, cy = old.y + (old.h || 0) / 2;
      o.w = len; o.h = 0; o.x = cx - len / 2; o.y = cy;
      o.rotation = normAngle((old.rotation || 0) + deg(Math.atan2(old.h || 0, old.w || 1)));
      o.stroke = old.fill && old.fill !== 'none' ? old.fill : '#111111'; o.fill = 'none';
      o.strokeWidth = Math.max(0.25, Math.round(((old.strokeWidth || 1) / PT) * 4) / 4);
    } else if (old.strokeWidth) o.strokeWidth = Math.max(0.25, Math.round((old.strokeWidth / PT) * 4) / 4);
    if (o.type === 'qr') { o.fill = '#111111'; o.qrBg = '#ffffff'; o.ecc = 'M'; }
    return normalizeObj(o);
  });
  return { doc, objs };
}

export function normalizeObj(o) {
  const t = o.type in TYPE_LABELS ? o.type : 'rect';
  const base = createObject(t, {}, []);
  const out = { ...base, ...o, id: o.id || uid(), type: t };
  if (!out.name) out.name = TYPE_LABELS[t];
  out.stroke = out.stroke || 'none';
  out.fill = out.fill || 'none';
  if (t === 'text') Object.assign(out, measureText(out));
  return out;
}
