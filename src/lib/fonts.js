import { PT } from './units.js';

// Cihazdan bağımsız, birebir aynı çıktı için yazı tipleri uygulamayla birlikte gelir.
// Latin + Latin Genişletilmiş (Türkçe karakterler dahil) alt kümeleri kullanılır.
export const FONT_FAMILIES = [
  { id: 'Inter', label: 'Inter', note: 'Modern sans', styles: ['Regular', 'Bold', 'Italic', 'BoldItalic'], file: 'Inter', fallback: 'sans-serif' },
  { id: 'Montserrat', label: 'Montserrat', note: 'Geometrik sans', styles: ['Regular', 'Bold', 'Italic', 'BoldItalic'], file: 'Montserrat', fallback: 'sans-serif' },
  { id: 'Playfair Display', label: 'Playfair Display', note: 'Zarif serif', styles: ['Regular', 'Bold', 'Italic', 'BoldItalic'], file: 'PlayfairDisplay', fallback: 'serif' },
  { id: 'Lora', label: 'Lora', note: 'Okunaklı serif', styles: ['Regular', 'Bold', 'Italic', 'BoldItalic'], file: 'Lora', fallback: 'serif' },
  { id: 'Roboto Mono', label: 'Roboto Mono', note: 'Eş aralıklı', styles: ['Regular', 'Bold', 'Italic', 'BoldItalic'], file: 'RobotoMono', fallback: 'monospace' },
  { id: 'Bebas Neue', label: 'Bebas Neue', note: 'Başlık (büyük harf)', styles: ['Regular'], file: 'BebasNeue', fallback: 'sans-serif' },
];
export const DEFAULT_FONT = 'Inter';

export const familyInfo = (id) => FONT_FAMILIES.find((f) => f.id === id) || FONT_FAMILIES[0];
export const cssFontFamily = (id) => {
  const f = familyInfo(id);
  return `'${f.id}', ${f.fallback}`;
};
// Yazı tipinin gerçekten sahip olduğu stile indirger (sahte kalın/italik üretilmez).
export function effStyle(o) {
  const f = familyInfo(o.fontFamily);
  const hasBold = f.styles.some((s) => s.startsWith('Bold'));
  const hasItalic = f.styles.some((s) => s.endsWith('Italic'));
  return { bold: !!o.bold && hasBold, italic: !!o.italic && hasItalic };
}
export const canBold = (id) => familyInfo(id).styles.some((s) => s.startsWith('Bold'));
export const canItalic = (id) => familyInfo(id).styles.some((s) => s.endsWith('Italic'));
const styleName = (bold, italic) => (bold && italic ? 'BoldItalic' : bold ? 'Bold' : italic ? 'Italic' : 'Regular');
export const fontUrl = (id, bold, italic) => {
  const f = familyInfo(id);
  let s = styleName(bold, italic);
  if (!f.styles.includes(s)) s = f.styles.includes(bold ? 'Bold' : 'Regular') ? (bold ? 'Bold' : 'Regular') : 'Regular';
  return new URL(`${import.meta.env.BASE_URL}fonts/${f.file}-${s}.ttf`, document.baseURI).href;
};

const loaded = new Map();
export function ensureFont(id, bold, italic) {
  const f = familyInfo(id);
  const b = !!bold && f.styles.some((s) => s.startsWith('Bold'));
  const i = !!italic && f.styles.some((s) => s.endsWith('Italic'));
  const key = `${f.id}|${b}|${i}`;
  if (loaded.has(key)) return loaded.get(key);
  const face = new FontFace(f.id, `url(${fontUrl(f.id, b, i)})`, { weight: b ? '700' : '400', style: i ? 'italic' : 'normal', display: 'swap' });
  const p = face.load().then((ff) => { document.fonts.add(ff); return true; }).catch(() => false);
  loaded.set(key, p);
  return p;
}

// --- Metin ölçümü (mm) ---
let ctx;
export function measureText(o) {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  const ref = 100;
  const f = familyInfo(o.fontFamily);
  const st = effStyle(o);
  ctx.font = `${st.italic ? 'italic ' : ''}${st.bold ? 700 : 400} ${ref}px '${f.id}', ${f.fallback}`;
  const lines = String(o.text ?? '').split('\n');
  const fs = (o.fontSize || 12) * PT;
  const ls = ((o.letterSpacing || 0) / 100) * fs; // em yüzdesi
  let max = 0;
  for (const ln of lines) {
    const w = (ctx.measureText(ln || ' ').width / ref) * fs + Math.max(0, ln.length) * ls;
    if (w > max) max = w;
  }
  return { w: Math.max(max, fs * 0.5), h: lines.length * fs * (o.lineHeight || 1.2) };
}

// --- Dışa aktarım için font gömme ---
const b64cache = new Map();
export async function fontBase64(id, bold, italic) {
  const url = fontUrl(id, bold, italic);
  if (b64cache.has(url)) return b64cache.get(url);
  const buf = await (await fetch(url)).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
  const res = btoa(bin);
  b64cache.set(url, res);
  return res;
}

// Belgede kullanılan benzersiz (aile, kalın, italik) kombinasyonları
export function usedFaces(objs) {
  const set = new Map();
  for (const o of objs) {
    if (o.type !== 'text' || o.hidden) continue;
    const f = familyInfo(o.fontFamily);
    const { bold, italic } = effStyle(o);
    set.set(`${f.id}|${bold}|${italic}`, { id: f.id, bold, italic });
  }
  return [...set.values()];
}
