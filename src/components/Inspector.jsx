import React from 'react';
import { AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Copy, Trash2, Lock, LockOpen, Eye, EyeOff, BringToFront, SendToBack, ArrowUp, ArrowDown, ImagePlus, ShieldCheck, TriangleAlert, Grid3x3, Magnet, Ruler } from 'lucide-react';
import { ColorField, IconBtn, NumberField, Section, Segmented, SelectField, Switch } from './Fields.jsx';
import { SwapIcon } from './Icons.jsx';
import { PRESETS, TYPE_LABELS } from '../lib/model.js';
import { UNITS, fromUnit, toUnit } from '../lib/units.js';
import { FONT_FAMILIES, canBold, canItalic } from '../lib/fonts.js';

export default function Inspector({ doc, sel, act, prefs, setPref, pre, openPreflight }) {
  if (!sel.length) return <DocPanel doc={doc} act={act} prefs={prefs} setPref={setPref} pre={pre} openPreflight={openPreflight} />;
  const multi = sel.length > 1, o = sel[0], u = doc.unit;
  const ids = sel.map((s) => s.id);
  const P = (p, key) => act.patch(ids, p, key);
  const isShape = ['rect', 'ellipse', 'triangle', 'star'].includes(o.type);
  const allLocked = sel.every((s) => s.locked), allHidden = sel.every((s) => s.hidden);
  const op = Math.round((multi ? sel.reduce((a, s) => a + (s.opacity ?? 1), 0) / sel.length : o.opacity ?? 1) * 100);

  return (
    <div className="insp">
      <div className="insp-title">
        <b>{multi ? `${sel.length} öğe seçili` : (o.name || TYPE_LABELS[o.type])}</b>
        {!multi && <span>{TYPE_LABELS[o.type]}</span>}
      </div>

      <Section title={multi ? 'Hizala (seçime göre)' : 'Hizala (sayfaya göre)'}>
        <div className="aligns">
          <IconBtn icon={AlignStartVertical} label="Sola hizala" onClick={() => act.align('left')} />
          <IconBtn icon={AlignCenterVertical} label="Yatay ortala" onClick={() => act.align('hcenter')} />
          <IconBtn icon={AlignEndVertical} label="Sağa hizala" onClick={() => act.align('right')} />
          <i />
          <IconBtn icon={AlignStartHorizontal} label="Üste hizala" onClick={() => act.align('top')} />
          <IconBtn icon={AlignCenterHorizontal} label="Dikey ortala" onClick={() => act.align('vcenter')} />
          <IconBtn icon={AlignEndHorizontal} label="Alta hizala" onClick={() => act.align('bottom')} />
        </div>
      </Section>

      {!multi && (
        <Section title="Konum ve boyut">
          <div className="grid2">
            <NumberField label="X" suffix={u} value={toUnit(o.x, u)} onChange={(v) => P({ x: fromUnit(v, u) }, 'x')} step={UNITS[u].mm >= 10 ? 0.1 : 1} />
            <NumberField label="Y" suffix={u} value={toUnit(o.y, u)} onChange={(v) => P({ y: fromUnit(v, u) }, 'y')} step={UNITS[u].mm >= 10 ? 0.1 : 1} />
            <NumberField label={o.type === 'line' ? 'Uzunluk' : 'Genişlik'} suffix={u} min={0.01} value={toUnit(o.w, u)} disabled={o.type === 'text'}
              onChange={(v) => act.resize(o, 'w', fromUnit(v, u))} step={UNITS[u].mm >= 10 ? 0.1 : 1} />
            {o.type !== 'line' && <NumberField label="Yükseklik" suffix={u} min={0.01} value={toUnit(o.h, u)} disabled={o.type === 'text'} onChange={(v) => act.resize(o, 'h', fromUnit(v, u))} step={UNITS[u].mm >= 10 ? 0.1 : 1} />}
            <NumberField label={o.type === 'line' ? 'Açı' : 'Döndürme'} suffix="°" min={-180} max={180} value={o.rotation || 0} onChange={(v) => P({ rotation: v }, 'rot')} digits={1} />
          </div>
        </Section>
      )}

      <Section title="Görünüm">
        <div className="slider-row">
          <label htmlFor="opac">Opaklık</label>
          <input id="opac" type="range" min="0" max="100" value={op} onChange={(e) => P({ opacity: Number(e.target.value) / 100 }, 'op')} style={{ '--p': `${op}%` }} />
          <output>{op}%</output>
        </div>
        {!multi && o.type === 'rect' && <NumberField wide label="Köşe yuvarlama" suffix={u} min={0} value={toUnit(o.radius || 0, u)} onChange={(v) => P({ radius: fromUnit(v, u) }, 'rad')} />}
      </Section>

      {!multi && (isShape || o.type === 'text') && (
        <Section title={o.type === 'text' ? 'Yazı rengi' : 'Dolgu'}>
          <ColorField value={o.fill} allowNone={o.type !== 'text'} onChange={(v) => P({ fill: v }, 'fill')} />
        </Section>
      )}

      {!multi && (isShape || o.type === 'line') && (
        <Section title={o.type === 'line' ? 'Çizgi' : 'Kenarlık'}>
          <ColorField value={o.stroke} allowNone={o.type !== 'line'} onChange={(v) => P({ stroke: v }, 'stroke')} swatches={o.type === 'line'} />
          {o.stroke !== 'none' && <>
            <NumberField wide label="Kalınlık" suffix="pt" min={0.1} max={200} step={0.25} value={o.strokeWidth} onChange={(v) => P({ strokeWidth: v }, 'sw')} />
            <Segmented label="Çizgi stili" value={o.dash || 'solid'} onChange={(v) => P({ dash: v })} options={[{ value: 'solid', label: 'Düz' }, { value: 'dash', label: 'Kesikli' }, { value: 'dot', label: 'Noktalı' }]} />
            {o.type === 'line' && <Segmented label="Uç şekli" value={o.cap || 'round'} onChange={(v) => P({ cap: v })} options={[{ value: 'round', label: 'Yuvarlak uç' }, { value: 'butt', label: 'Düz uç' }]} />}
          </>}
        </Section>
      )}

      {!multi && o.type === 'text' && (
        <Section title="Metin">
          <textarea className="ta" rows={3} value={o.text} aria-label="Metin içeriği" onChange={(e) => P({ text: e.target.value }, 'txt')} onKeyDown={(e) => e.stopPropagation()} />
          <SelectField label="Yazı tipi" value={o.fontFamily} onChange={(v) => P({ fontFamily: v })}>
            {FONT_FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.label} — {f.note}</option>)}
          </SelectField>
          <div className="row">
            <NumberField label="Boyut" suffix="pt" min={1} max={1000} value={o.fontSize} step={1} digits={1} onChange={(v) => P({ fontSize: v }, 'fs')} />
            <div className="toggles">
              <IconBtn icon={Bold} label="Kalın" active={!!o.bold && canBold(o.fontFamily)} disabled={!canBold(o.fontFamily)} onClick={() => P({ bold: !o.bold })} />
              <IconBtn icon={Italic} label="İtalik" active={!!o.italic && canItalic(o.fontFamily)} disabled={!canItalic(o.fontFamily)} onClick={() => P({ italic: !o.italic })} />
            </div>
          </div>
          <Segmented iconOnly label="Metin hizası" value={o.align} onChange={(v) => P({ align: v })} options={[{ value: 'left', label: 'Sola', icon: AlignLeft }, { value: 'center', label: 'Ortaya', icon: AlignCenter }, { value: 'right', label: 'Sağa', icon: AlignRight }]} />
          <div className="grid2">
            <NumberField label="Satır aralığı" min={0.5} max={4} step={0.05} value={o.lineHeight} onChange={(v) => P({ lineHeight: v }, 'lh')} />
            <NumberField label="Harf aralığı" suffix="%" min={-20} max={200} step={1} value={o.letterSpacing || 0} onChange={(v) => P({ letterSpacing: v }, 'ls')} />
          </div>
        </Section>
      )}

      {!multi && o.type === 'qr' && (
        <Section title="QR kodu">
          <textarea className="ta" rows={3} value={o.text} placeholder="https://" aria-label="QR içeriği" onChange={(e) => P({ text: e.target.value }, 'qr')} onKeyDown={(e) => e.stopPropagation()} />
          <ColorField label="Kod rengi" value={o.fill} onChange={(v) => P({ fill: v }, 'fill')} swatches={false} />
          <ColorField label="Zemin" value={o.qrBg} allowNone onChange={(v) => P({ qrBg: v }, 'bg')} swatches={false} />
          <Segmented label="Hata düzeltme" value={o.ecc || 'M'} onChange={(v) => P({ ecc: v })} options={[{ value: 'L', label: 'Düşük' }, { value: 'M', label: 'Orta' }, { value: 'Q', label: 'Yüksek' }, { value: 'H', label: 'En yüksek' }]} />
        </Section>
      )}

      {!multi && o.type === 'image' && (
        <Section title="Görsel">
          <div className="kv"><span>Kaynak boyutu</span><b>{o.natW} × {o.natH} px</b></div>
          {o.natW > 0 && !String(o.src).startsWith('data:image/svg') && (() => { const dpi = Math.round(o.natW / (o.w / 25.4)); const lv = dpi < 150 ? 'bad' : dpi < 300 ? 'mid' : 'ok'; return <div className="kv"><span>Etkin çözünürlük</span><b className={`dpi ${lv}`}>{dpi} dpi</b></div>; })()}
          <div className="row2">
            <button type="button" className="btn" onClick={() => act.resetAspect(o)}>Orijinal oran</button>
            <button type="button" className="btn" onClick={() => act.replaceImage(o)}><ImagePlus size={16} strokeWidth={1.75} />Değiştir</button>
          </div>
        </Section>
      )}

      <Section title="Sıralama ve eylemler">
        <div className="actions">
          <IconBtn icon={BringToFront} label="En öne getir" onClick={() => act.order('front')} kbd="⌘⇧]" />
          <IconBtn icon={ArrowUp} label="Bir öne" onClick={() => act.order('forward')} kbd="⌘]" />
          <IconBtn icon={ArrowDown} label="Bir arkaya" onClick={() => act.order('backward')} kbd="⌘[" />
          <IconBtn icon={SendToBack} label="En arkaya gönder" onClick={() => act.order('back')} kbd="⌘⇧[" />
        </div>
        <div className="actions">
          <IconBtn icon={Copy} label="Çoğalt" onClick={act.duplicate} kbd="⌘D" />
          <IconBtn icon={allLocked ? Lock : LockOpen} label={allLocked ? 'Kilidi aç' : 'Kilitle'} active={allLocked} onClick={() => act.setFlag('locked', !allLocked)} />
          <IconBtn icon={allHidden ? EyeOff : Eye} label={allHidden ? 'Göster' : 'Gizle'} active={allHidden} onClick={() => act.setFlag('hidden', !allHidden)} />
          <IconBtn icon={Trash2} label="Sil" className="danger" onClick={act.remove} kbd="⌫" />
        </div>
      </Section>
    </div>
  );
}

function DocPanel({ doc, act, prefs, setPref, pre, openPreflight }) {
  const u = doc.unit;
  const preset = PRESETS.find((p) => (Math.abs(p.w - doc.w) < 0.05 && Math.abs(p.h - doc.h) < 0.05) || (Math.abs(p.w - doc.h) < 0.05 && Math.abs(p.h - doc.w) < 0.05));
  const step = UNITS[u].mm >= 10 ? 0.1 : 1;
  const ok = !pre.errors && !pre.warns;
  return (
    <div className="insp">
      <div className="insp-title"><b>Belge</b><span>Hiçbir öğe seçili değil</span></div>
      <Section title="Boyut">
        <SelectField label="Hazır ölçü" value={preset?.id || 'custom'} onChange={(v) => { const p = PRESETS.find((x) => x.id === v); if (p) act.setDoc(doc.w > doc.h ? { w: Math.max(p.w, p.h), h: Math.min(p.w, p.h) } : { w: Math.min(p.w, p.h), h: Math.max(p.w, p.h) }); }}>
          {!preset && <option value="custom">Özel ölçü</option>}
          {['Kağıt', 'Baskı'].map((g) => <optgroup key={g} label={g}>{PRESETS.filter((p) => p.group === g).map((p) => <option key={p.id} value={p.id}>{p.name} — {p.w} × {p.h} mm</option>)}</optgroup>)}
        </SelectField>
        <div className="size-row">
          <NumberField label="Genişlik" suffix={u} min={1} value={toUnit(doc.w, u)} step={step} onChange={(v) => act.setDoc({ w: fromUnit(v, u) }, 'dw')} />
          <button type="button" className="ibtn" aria-label="Yönü değiştir (dikey/yatay)" data-tip="Yönü değiştir" onClick={() => act.setDoc({ w: doc.h, h: doc.w })}><SwapIcon size={18} /></button>
          <NumberField label="Yükseklik" suffix={u} min={1} value={toUnit(doc.h, u)} step={step} onChange={(v) => act.setDoc({ h: fromUnit(v, u) }, 'dh')} />
        </div>
        <SelectField label="Birim" value={u} onChange={(v) => act.setDoc({ unit: v })}>
          {Object.entries({ mm: 'Milimetre (mm)', cm: 'Santimetre (cm)', in: 'İnç (in)', px: 'Piksel (px, 96 ppi)' }).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
      </Section>
      <Section title="Baskı payları">
        <div className="grid2">
          <NumberField label="Kesim payı" suffix={u} min={0} value={toUnit(doc.bleed, u)} step={step} onChange={(v) => act.setDoc({ bleed: fromUnit(v, u) }, 'bl')} />
          <NumberField label="Güvenli alan" suffix={u} min={0} value={toUnit(doc.safe, u)} step={step} onChange={(v) => act.setDoc({ safe: fromUnit(v, u) }, 'sf')} />
        </div>
        <p className="hint">Kesim payı (bleed): kenara taşan renk ve görsellerin uzatılacağı alan. Güvenli alan: metin ve QR için kesimden içeri bırakılan boşluk.</p>
      </Section>
      <Section title="Arka plan"><ColorField value={doc.bg} onChange={(v) => act.setDoc({ bg: v }, 'bg')} /></Section>
      <Section title="Görünüm">
        <Switch label="Cetveller" checked={prefs.rulers} onChange={(v) => setPref('rulers', v)} />
        <Switch label="Izgara" checked={prefs.grid} onChange={(v) => setPref('grid', v)} />
        <Switch label="Akıllı kılavuzlar ve yakalama" checked={prefs.snap} onChange={(v) => setPref('snap', v)} />
      </Section>
      <button type="button" className={`pf-card ${ok ? 'ok' : pre.errors ? 'bad' : 'warn'}`} onClick={openPreflight}>
        {ok ? <ShieldCheck size={20} strokeWidth={1.75} /> : <TriangleAlert size={20} strokeWidth={1.75} />}
        <span><b>Baskı kontrolü</b><small>{ok ? 'Sorun bulunmadı' : `${pre.errors ? pre.errors + ' hata' : ''}${pre.errors && pre.warns ? ', ' : ''}${pre.warns ? pre.warns + ' uyarı' : ''}`}</small></span>
      </button>
    </div>
  );
}
