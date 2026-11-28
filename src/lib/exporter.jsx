import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Objects } from './render.jsx';
import { PT } from './units.js';
import { usedFaces, fontBase64, familyInfo } from './fonts.js';

export const safeName = (n) => (String(n || 'tasarim').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'tasarim');

export function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}

export function exportGeometry(doc, { bleed = false, marks = false } = {}) {
  const b = bleed ? doc.bleed : 0;
  const e = marks ? doc.bleed + 7 : b;
  return { b, e, vx: -e, vy: -e, vw: doc.w + 2 * e, vh: doc.h + 2 * e };
}

async function fontCss(objs) {
  const faces = usedFaces(objs);
  const parts = await Promise.all(faces.map(async (f) => {
    const b64 = await fontBase64(f.id, f.bold, f.italic);
    return `@font-face{font-family:'${f.id}';font-weight:${f.bold ? 700 : 400};font-style:${f.italic ? 'italic' : 'normal'};src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
  }));
  return parts.join('');
}

export async function buildSvg(doc, objs, { bleed = false, marks = false, embedFonts = true, size = 'mm', pxPerMm = 1 } = {}) {
  const g = exportGeometry(doc, { bleed, marks });
  const css = embedFonts ? await fontCss(objs) : '';
  const mw = 0.25 * PT * 1.0;
  const o1 = doc.bleed + 1.5, o2 = doc.bleed + 6.5, W = doc.w, H = doc.h;
  const markLines = marks ? [
    [0, -o1, 0, -o2], [-o1, 0, -o2, 0], [W, -o1, W, -o2], [W + o1, 0, W + o2, 0],
    [0, H + o1, 0, H + o2], [-o1, H, -o2, H], [W, H + o1, W, H + o2], [W + o1, H, W + o2, H],
  ] : [];
  const vb = `${g.vx} ${g.vy} ${g.vw} ${g.vh}`;
  const wAttr = size === 'px' ? Math.round(g.vw * pxPerMm) : `${g.vw}mm`;
  const hAttr = size === 'px' ? Math.round(g.vh * pxPerMm) : `${g.vh}mm`;
  const body = renderToStaticMarkup(
    <>
      <defs><clipPath id="mb-clip"><rect x={-g.b} y={-g.b} width={W + 2 * g.b} height={H + 2 * g.b} /></clipPath></defs>
      <rect x={-g.b} y={-g.b} width={W + 2 * g.b} height={H + 2 * g.b} fill={doc.bg} />
      <g clipPath="url(#mb-clip)"><Objects objs={objs} /></g>
      {markLines.map((l, i) => <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#000" strokeWidth={mw} />)}
    </>
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${wAttr}" height="${hAttr}" viewBox="${vb}">${css ? `<style>${css}</style>` : ''}${body}</svg>`;
}

export async function exportSVG(doc, objs, opts) {
  const svg = await buildSvg(doc, objs, { ...opts, embedFonts: true });
  download(`${safeName(doc.name)}.svg`, '<?xml version="1.0" encoding="UTF-8"?>\n' + svg, 'image/svg+xml;charset=utf-8');
}

const MAX_PIXELS = 16_000_000; // iOS Safari canvas sınırı
export function capDpi(doc, opts, dpi) {
  const g = exportGeometry(doc, opts);
  const px = (g.vw / 25.4) * dpi * (g.vh / 25.4) * dpi;
  return px > MAX_PIXELS ? Math.floor(dpi * Math.sqrt(MAX_PIXELS / px)) : dpi;
}

async function rasterize(doc, objs, opts, dpi) {
  const eff = capDpi(doc, opts, dpi);
  const ppm = eff / 25.4;
  const svg = await buildSvg(doc, objs, { ...opts, embedFonts: true, size: 'px', pxPerMm: ppm });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Görsel oluşturulamadı')); i.src = url; });
    const g = exportGeometry(doc, opts);
    const c = document.createElement('canvas');
    c.width = Math.round(g.vw * ppm); c.height = Math.round(g.vh * ppm);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return { canvas: c, dpi: eff, g };
  } finally { URL.revokeObjectURL(url); }
}

export async function exportPNG(doc, objs, opts, dpi = 300) {
  const { canvas, dpi: eff } = await rasterize(doc, objs, opts, dpi);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  download(`${safeName(doc.name)}.png`, blob);
  return eff;
}

export async function exportPDF(doc, objs, opts, { mode = 'vector', dpi = 300 } = {}) {
  const g = exportGeometry(doc, opts);
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: g.vw > g.vh ? 'landscape' : 'portrait', unit: 'mm', format: [g.vw, g.vh], compress: true });
  pdf.setProperties({ title: doc.name, creator: 'Mikro Baskı' });
  let eff = null;
  if (mode === 'raster') {
    const r = await rasterize(doc, objs, opts, dpi);
    eff = r.dpi;
    pdf.addImage(r.canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, g.vw, g.vh, undefined, 'FAST');
  } else {
    const { svg2pdf } = await import('svg2pdf.js');
    const faces = usedFaces(objs);
    for (const f of faces) {
      const file = `${f.id.replace(/\s/g, '')}-${f.bold ? 'B' : 'R'}${f.italic ? 'I' : ''}.ttf`;
      pdf.addFileToVFS(file, await fontBase64(f.id, f.bold, f.italic));
      pdf.addFont(file, f.id, f.bold && f.italic ? 'bolditalic' : f.bold ? 'bold' : f.italic ? 'italic' : 'normal');
    }
    const svg = await buildSvg(doc, objs, { ...opts, embedFonts: false });
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden';
    host.innerHTML = svg;
    document.body.appendChild(host);
    try {
      await svg2pdf(host.firstElementChild, pdf, { x: 0, y: 0, width: g.vw, height: g.vh });
    } finally { host.remove(); }
  }
  pdf.save(`${safeName(doc.name)}.pdf`);
  return eff;
}

export const exportProject = (doc, objs) =>
  download(`${safeName(doc.name)}.mikrobaski`, JSON.stringify({ app: 'mikro-baski', schemaVersion: 2, doc, objects: objs }, null, 1), 'application/json');

// Görsel içe aktarma: büyük fotoğrafları makul boyuta indirir (maks. 4096 px)
export function readImage(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Dosya okunamadı'));
    r.onload = () => {
      const src = r.result, img = new Image();
      img.onerror = () => reject(new Error('Görsel açılamadı'));
      img.onload = () => {
        let nw = img.naturalWidth || 300, nh = img.naturalHeight || 300;
        if (file.type === 'image/svg+xml') return resolve({ src, natW: nw, natH: nh, name: file.name });
        const max = 4096, k = Math.min(1, max / Math.max(nw, nh));
        if (k < 1 || (file.size > 3_000_000 && file.type !== 'image/png')) {
          const c = document.createElement('canvas');
          c.width = Math.round(nw * k); c.height = Math.round(nh * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          const out = file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92);
          return resolve({ src: out, natW: c.width, natH: c.height, name: file.name });
        }
        resolve({ src, natW: nw, natH: nh, name: file.name });
      };
      img.src = src;
    };
    r.readAsDataURL(file);
  });
}
