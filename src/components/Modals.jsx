import React, { useMemo, useState } from 'react';
import { CircleCheck, CircleAlert, TriangleAlert, Info, FileText, FileImage, FileCode, Download, LoaderCircle } from 'lucide-react';
import { Modal, NumberField, SelectField, Segmented, Switch } from './Fields.jsx';
import { SwapIcon } from './Icons.jsx';
import { PRESETS } from '../lib/model.js';
import { UNITS, fromUnit, toUnit } from '../lib/units.js';
import { capDpi, exportGeometry } from '../lib/exporter.jsx';

const LV = { ok: CircleCheck, info: Info, warn: TriangleAlert, error: CircleAlert };

export function PreflightList({ pre, onShow }) {
  const order = { error: 0, warn: 1, ok: 2, info: 3 };
  const items = [...pre.items].sort((a, b) => order[a.level] - order[b.level] || a.id - b.id);
  return (
    <ul className="pf">
      {items.map((it) => { const I = LV[it.level]; return (
        <li key={it.id} className={it.level}>
          <I size={18} strokeWidth={1.75} aria-hidden="true" />
          <div><b>{it.title}</b><p>{it.detail}</p></div>
          {it.ids.length > 0 && <button type="button" className="btn sm" onClick={() => onShow(it.ids)}>Göster</button>}
        </li>
      ); })}
    </ul>
  );
}

export function PreflightModal({ pre, onClose, onShow }) {
  const ok = !pre.errors && !pre.warns;
  return (
    <Modal title="Baskı kontrolü" onClose={onClose} wide>
      <div className={`pf-sum ${ok ? 'ok' : pre.errors ? 'bad' : 'warn'}`}>
        {ok ? <CircleCheck size={22} strokeWidth={1.75} /> : <TriangleAlert size={22} strokeWidth={1.75} />}
        <div><b>{ok ? 'Baskıya hazır görünüyor' : `${pre.errors ? pre.errors + ' hata' : ''}${pre.errors && pre.warns ? ' · ' : ''}${pre.warns ? pre.warns + ' uyarı' : ''}`}</b>
          <span>Bu kontrol temel bir ön denetimdir; matbaa onayının yerini tutmaz.</span></div>
      </div>
      <PreflightList pre={pre} onShow={(ids) => { onShow(ids); onClose(); }} />
    </Modal>
  );
}

export function NewDocModal({ onClose, onCreate, hasWork, unit }) {
  const [sel, setSel] = useState('a4');
  const [landscape, setLand] = useState(false);
  const [cw, setCw] = useState(210), [ch, setCh] = useState(297), [u, setU] = useState(unit);
  const [bleed, setBleed] = useState(3);
  const custom = sel === 'custom';
  const p = PRESETS.find((x) => x.id === sel);
  const base = custom ? { w: fromUnit(cw, u), h: fromUnit(ch, u) } : { w: Math.min(p.w, p.h), h: Math.max(p.w, p.h) };
  const dims = custom ? base : landscape ? { w: base.h, h: base.w } : base;
  const thumb = (w, h) => { const k = 46 / Math.max(w, h); return { width: Math.max(10, w * k), height: Math.max(10, h * k) }; };
  return (
    <Modal title="Yeni belge" onClose={onClose} wide
      footer={<><span className="foot-note">{hasWork ? 'Mevcut çalışma değişir; Geri Al ile geri dönebilirsiniz.' : ''}</span><button type="button" className="btn" onClick={onClose}>Vazgeç</button><button type="button" className="btn primary" onClick={() => onCreate({ w: dims.w, h: dims.h, unit: custom ? u : unit, bleed: fromUnit(bleed, 'mm') })}>Oluştur</button></>}>
      <div className="presets" role="radiogroup" aria-label="Hazır ölçüler">
        {PRESETS.map((x) => { const d = landscape ? { w: Math.max(x.w, x.h), h: Math.min(x.w, x.h) } : { w: Math.min(x.w, x.h), h: Math.max(x.w, x.h) }; return (
          <button type="button" role="radio" aria-checked={sel === x.id} key={x.id} className={`preset ${sel === x.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
            <span className="thumb"><i style={thumb(d.w, d.h)} /></span>
            <b>{x.name}</b><small>{Math.round(x.w * 10) / 10} × {Math.round(x.h * 10) / 10} mm</small>
          </button>
        ); })}
        <button type="button" role="radio" aria-checked={custom} className={`preset ${custom ? 'on' : ''}`} onClick={() => setSel('custom')}>
          <span className="thumb"><i className="dash" style={{ width: 34, height: 34 }} /></span><b>Özel</b><small>Kendi ölçün</small>
        </button>
      </div>
      {custom ? (
        <div className="size-row">
          <NumberField label="Genişlik" suffix={u} value={cw} min={1} onChange={setCw} step={UNITS[u].mm >= 10 ? 0.1 : 1} />
          <button type="button" className="ibtn" aria-label="Genişlik ve yüksekliği değiştir" onClick={() => { setCw(ch); setCh(cw); }}><SwapIcon size={18} /></button>
          <NumberField label="Yükseklik" suffix={u} value={ch} min={1} onChange={setCh} step={UNITS[u].mm >= 10 ? 0.1 : 1} />
          <SelectField label="Birim" value={u} onChange={(nu) => { setCw(toUnit(fromUnit(cw, u), nu)); setCh(toUnit(fromUnit(ch, u), nu)); setU(nu); }}>{Object.keys(UNITS).map((k) => <option key={k}>{k}</option>)}</SelectField>
        </div>
      ) : (
        <Segmented label="Yön" value={landscape ? 'l' : 'p'} onChange={(v) => setLand(v === 'l')} options={[{ value: 'p', label: 'Dikey' }, { value: 'l', label: 'Yatay' }]} />
      )}
      <NumberField wide label="Kesim payı" suffix="mm" value={bleed} min={0} max={20} step={0.5} onChange={setBleed} />
    </Modal>
  );
}

export function ExportModal({ doc, objs, pre, onClose, onRun, onPreflight }) {
  const [fmt, setFmt] = useState('pdf');
  const [bleed, setBleed] = useState(doc.bleed > 0);
  const [marks, setMarks] = useState(false);
  const [pdfMode, setPdfMode] = useState('vector');
  const [dpi, setDpi] = useState(300);
  const [busy, setBusy] = useState(false);
  const opts = { bleed, marks };
  const g = exportGeometry(doc, opts);
  const eff = capDpi(doc, opts, dpi);
  const mm = (v) => Math.round(v * 10) / 10;
  const usesRaster = fmt === 'png' || (fmt === 'pdf' && pdfMode === 'raster');
  const run = async () => { setBusy(true); try { await onRun({ fmt, opts, pdfMode, dpi }); onClose(); } finally { setBusy(false); } };
  const bad = pre.errors + pre.warns;
  return (
    <Modal title="Dışa aktar" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Vazgeç</button><button type="button" className="btn primary" disabled={busy || !objs.length} onClick={run}>{busy ? <><LoaderCircle size={16} className="spin" strokeWidth={2} />Hazırlanıyor…</> : <><Download size={16} strokeWidth={2} />İndir</>}</button></>}>
      <div className="fmt" role="radiogroup" aria-label="Dosya biçimi">
        {[['pdf', FileText, 'PDF', 'Baskı için önerilir'], ['png', FileImage, 'PNG', 'Yüksek çözünürlüklü görsel'], ['svg', FileCode, 'SVG', 'Düzenlenebilir vektör']].map(([k, I, t, d]) => (
          <button type="button" role="radio" aria-checked={fmt === k} key={k} className={`fmt-i ${fmt === k ? 'on' : ''}`} onClick={() => setFmt(k)}><I size={22} strokeWidth={1.6} /><b>{t}</b><small>{d}</small></button>
        ))}
      </div>
      <div className="opts">
        <Switch label="Kesim payını dahil et" checked={bleed} onChange={setBleed} />
        <Switch label="Kesim işaretleri ekle" checked={marks} onChange={setMarks} />
        {fmt === 'pdf' && <Segmented label="PDF türü" value={pdfMode} onChange={setPdfMode} options={[{ value: 'vector', label: 'Vektör (keskin)' }, { value: 'raster', label: 'Görüntü' }]} />}
        {usesRaster && <Segmented label="Çözünürlük" value={String(dpi)} onChange={(v) => setDpi(Number(v))} options={[{ value: '150', label: '150 dpi' }, { value: '300', label: '300 dpi' }, { value: '600', label: '600 dpi' }]} />}
      </div>
      <div className="summary">
        <div><span>Çıktı boyutu</span><b>{mm(g.vw)} × {mm(g.vh)} mm</b></div>
        {usesRaster && <div><span>Piksel</span><b>{Math.round((g.vw / 25.4) * eff)} × {Math.round((g.vh / 25.4) * eff)} px{eff < dpi ? ` (${eff} dpi ile sınırlı)` : ''}</b></div>}
        {fmt === 'pdf' && pdfMode === 'vector' && <div><span>Yazılar</span><b>Fontlar PDF’e gömülür</b></div>}
        {fmt === 'svg' && <div><span>Yazılar</span><b>Fontlar SVG’ye gömülür</b></div>}
      </div>
      <button type="button" className={`pf-card inline ${bad ? (pre.errors ? 'bad' : 'warn') : 'ok'}`} onClick={onPreflight}>
        {bad ? <TriangleAlert size={18} strokeWidth={1.75} /> : <CircleCheck size={18} strokeWidth={1.75} />}
        <span><b>Baskı kontrolü</b><small>{bad ? `${pre.errors ? pre.errors + ' hata' : ''}${pre.errors && pre.warns ? ', ' : ''}${pre.warns ? pre.warns + ' uyarı' : ''} — ayrıntılar için dokunun` : 'Sorun bulunmadı'}</small></span>
      </button>
    </Modal>
  );
}

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = MAC ? '⌘' : 'Ctrl';
const SC = [
  ['Araçlar', [['Seç', 'V'], ['El (kaydır)', 'H veya Boşluk'], ['Metin', 'T'], ['Dikdörtgen', 'R'], ['Elips', 'O'], ['Üçgen', 'G'], ['Yıldız', 'S'], ['Çizgi', 'L'], ['QR kodu', 'Q'], ['Görsel ekle', 'I']]],
  ['Düzenleme', [['Geri al', `${MOD} Z`], ['Yinele', `${MOD} ⇧ Z`], ['Çoğalt', `${MOD} D`], ['Kopyala / Kes / Yapıştır', `${MOD} C / X / V`], ['Tümünü seç', `${MOD} A`], ['Sil', 'Delete'], ['Seçimi kaldır', 'Esc'], ['Yazıyı düzenle', 'Enter veya çift tık']]],
  ['Taşıma ve sıra', [['Hassas taşı', '← ↑ → ↓'], ['10× taşı', '⇧ + ok'], ['Eksene kilitle', '⇧ + sürükle'], ['Yakalamayı kapat', 'Alt + sürükle'], ['Bir öne / arkaya', `${MOD} ] / [`], ['En öne / en arkaya', `${MOD} ⇧ ] / [`]]],
  ['Görünüm ve dosya', [['Sığdır', `${MOD} 0`], ['Yakınlaştır / uzaklaştır', `${MOD} + / ${MOD} −`], ['Yakınlaştır (fare)', `${MOD} + tekerlek`], ['Projeyi kaydet', `${MOD} S`], ['Dışa aktar', `${MOD} E`], ['Bu pencere', '?']]],
];
export function ShortcutsModal({ onClose }) {
  return (
    <Modal title="Klavye kısayolları" onClose={onClose} wide>
      <div className="sc-grid">{SC.map(([t, rows]) => <div key={t}><h3>{t}</h3>{rows.map(([n, k]) => <div className="sc" key={n}><span>{n}</span><kbd>{k}</kbd></div>)}</div>)}</div>
    </Modal>
  );
}
