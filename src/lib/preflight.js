import { PT, fmtLen } from './units.js';
import { aabb } from './model.js';
import { qrMatrix } from './render.jsx';
import { effStyle, familyInfo } from './fonts.js';

const lum = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 1;
  const v = parseInt(m[1], 16), c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const l1 = lum(a), l2 = lum(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };

// level: error > warn > info > ok
export function runPreflight(doc, all) {
  const objs = all.filter((o) => !o.hidden);
  const items = [];
  const { w: W, h: H, bleed, safe, unit } = doc;
  const add = (level, title, detail, ids = []) => items.push({ id: items.length, level, title, detail, ids });
  const nm = (o) => o.name || o.type;

  add('info', 'Belge ölçüsü', `${fmtLen(W, unit)} × ${fmtLen(H, unit)} · kesim payı ${fmtLen(bleed, unit)} · güvenli alan ${fmtLen(safe, unit)}`);

  if (!objs.length) { add('warn', 'Belge boş', 'Henüz hiçbir öğe eklenmedi.'); }

  // Sınır kontrolleri
  const out = [], cut = [], edge = [];
  for (const o of objs) {
    const b = aabb(o);
    if (b.x1 < -bleed || b.y1 < -bleed || b.x0 > W + bleed || b.y0 > H + bleed) { out.push(o); continue; }
    if (b.x0 < -bleed - 0.01 || b.y0 < -bleed - 0.01 || b.x1 > W + bleed + 0.01 || b.y1 > H + bleed + 0.01) cut.push(o);
    const fills = o.type === 'image' || ((o.type === 'rect' || o.type === 'ellipse' || o.type === 'triangle' || o.type === 'star') && o.fill && o.fill !== 'none');
    if (fills && bleed > 0 && !o.rotation) {
      const t = 0.6;
      if ((Math.abs(b.x0) <= t && b.x0 > -bleed + 0.01) || (Math.abs(b.y0) <= t && b.y0 > -bleed + 0.01) || (Math.abs(b.x1 - W) <= t && b.x1 < W + bleed - 0.01) || (Math.abs(b.y1 - H) <= t && b.y1 < H + bleed - 0.01)) edge.push(o);
    }
  }
  if (out.length) add('error', 'Sayfa dışında öğe', `${out.length} öğe sayfanın ve kesim payının tamamen dışında; çıktıda görünmez.`, out.map((o) => o.id));
  if (cut.length) add('warn', 'Kesim payını aşan öğe', `${cut.length} öğe kesim payının ötesine taşıyor; fazlası kırpılır.`, cut.map((o) => o.id));
  if (!out.length && !cut.length) add('ok', 'Tüm öğeler çalışma alanı içinde', 'Sayfa dışına taşan öğe yok.');
  if (edge.length) add('warn', 'Kenara dayalı öğe kesim payına uzamıyor', `${edge.length} öğe sayfa kenarına dayalı ama kesim payına kadar uzatılmamış; kesimde beyaz çizgi kalabilir.`, edge.map((o) => o.id));

  // Güvenli alan (metin & QR)
  const unsafe = objs.filter((o) => (o.type === 'text' || o.type === 'qr') && (() => { const b = aabb(o); return b.x0 < safe - 0.01 || b.y0 < safe - 0.01 || b.x1 > W - safe + 0.01 || b.y1 > H - safe + 0.01; })());
  if (unsafe.length) add('warn', 'Güvenli alan dışında metin/QR', `${unsafe.length} öğe ${fmtLen(safe, unit)} güvenli alanın dışına çıkıyor; kesimde kırpılma riski var.`, unsafe.map((o) => o.id));
  else add('ok', 'Metin ve QR güvenli alanda', `Tüm metin ve QR kodları ${fmtLen(safe, unit)} güvenli alan içinde.`);

  // Görsel çözünürlüğü
  const imgs = objs.filter((o) => o.type === 'image' && o.natW && !String(o.src).startsWith('data:image/svg'));
  const low = [], mid = [];
  for (const o of imgs) { const dpi = o.natW / (o.w / 25.4); if (dpi < 150) low.push(o); else if (dpi < 300) mid.push(o); }
  if (low.length) add('error', 'Düşük çözünürlüklü görsel', `${low.length} görselin etkin çözünürlüğü 150 dpi altında: ${low.map((o) => `${nm(o)} (${Math.round(o.natW / (o.w / 25.4))} dpi)`).join(', ')}.`, low.map((o) => o.id));
  if (mid.length) add('warn', 'Görsel çözünürlüğü sınırda', `${mid.length} görsel 300 dpi altında: ${mid.map((o) => `${nm(o)} (${Math.round(o.natW / (o.w / 25.4))} dpi)`).join(', ')}.`, mid.map((o) => o.id));
  if (imgs.length && !low.length && !mid.length) add('ok', 'Görseller baskı çözünürlüğünde', 'Tüm görseller en az 300 dpi.');

  // Yazı
  const texts = objs.filter((o) => o.type === 'text');
  const empty = texts.filter((o) => !String(o.text || '').trim());
  if (empty.length) add('warn', 'Boş metin kutusu', `${empty.length} metin kutusu boş.`, empty.map((o) => o.id));
  const tiny = texts.filter((o) => o.fontSize < 6 && String(o.text || '').trim());
  if (tiny.length) add(tiny.some((o) => o.fontSize < 4) ? 'error' : 'warn', 'Çok küçük yazı', `${tiny.length} metin 6 pt altında; baskıda okunmayabilir.`, tiny.map((o) => o.id));
  else if (texts.length) add('ok', 'Yazı boyutları uygun', 'Tüm metinler en az 6 pt.');
  const poorContrast = texts.filter((o) => String(o.text || '').trim() && o.fill !== 'none' && contrast(o.fill, doc.bg) < 2 && !objs.some((s) => s !== o && ['rect', 'ellipse', 'triangle', 'star', 'image'].includes(s.type)));
  if (poorContrast.length) add('warn', 'Düşük kontrastlı metin', `${poorContrast.length} metin arka planla yeterince kontrast oluşturmuyor.`, poorContrast.map((o) => o.id));
  const emulated = texts.filter((o) => { const f = familyInfo(o.fontFamily); const st = effStyle(o); return (o.bold && !st.bold) || (o.italic && !st.italic) || !f; });
  if (emulated.length) add('info', 'Yazı tipi stili mevcut değil', `${emulated.length} metinde seçilen kalın/italik stil bu yazı tipinde bulunmuyor; normal stil kullanılır.`, emulated.map((o) => o.id));

  // İnce çizgi
  const thin = objs.filter((o) => o.stroke && o.stroke !== 'none' && o.strokeWidth < 0.25 && o.type !== 'text');
  if (thin.length) add('warn', 'Çok ince çizgi', `${thin.length} çizgi 0,25 pt altında; baskıda silik çıkabilir.`, thin.map((o) => o.id));

  // QR
  const qrs = objs.filter((o) => o.type === 'qr');
  const bad = qrs.filter((o) => !qrMatrix(o.text, o.ecc));
  if (bad.length) add('error', 'QR kodu oluşturulamadı', 'Metin boş ya da QR için fazla uzun.', bad.map((o) => o.id));
  const small = qrs.filter((o) => Math.min(o.w, o.h) < 15 && !bad.includes(o));
  if (small.length) add('warn', 'Küçük QR kodu', 'QR kodları baskıda en az 15 mm olmalı; okunabilirlik düşebilir.', small.map((o) => o.id));
  const lowc = qrs.filter((o) => contrast(o.fill, o.qrBg && o.qrBg !== 'none' ? o.qrBg : doc.bg) < 3);
  if (lowc.length) add('error', 'QR kontrastı yetersiz', 'QR rengi ile zemini arasında yeterli kontrast yok; okunmayabilir.', lowc.map((o) => o.id));
  if (qrs.length && !bad.length && !small.length && !lowc.length) add('ok', 'QR kodları okunabilir görünüyor', 'Boyut ve kontrast uygun. Basımdan önce telefonla test edin.');

  const hid = all.length - objs.length;
  if (hid) add('info', 'Gizli katmanlar', `${hid} gizli katman dışa aktarmaya dahil edilmez.`);
  add('info', 'Renk modu', 'Tasarım RGB’dir. CMYK dönüşümünü matbaa veya yazıcı profili yapar; renkler ekrandakinden farklı görünebilir.');

  const errors = items.filter((i) => i.level === 'error').length, warns = items.filter((i) => i.level === 'warn').length;
  return { items, errors, warns };
}
