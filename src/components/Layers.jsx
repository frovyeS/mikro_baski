import React from 'react';
import { Type, Square, Circle, Triangle, Star, ImageIcon, QrCode, Eye, EyeOff, Lock, LockOpen, Layers as LayersIcon } from 'lucide-react';
import { LineIcon } from './Icons.jsx';
import { TYPE_LABELS } from '../lib/model.js';

export const TYPE_ICON = { text: Type, rect: Square, ellipse: Circle, triangle: Triangle, star: Star, line: LineIcon, image: ImageIcon, qr: QrCode };

export default function Layers({ objs, sel, onSelect, onFlag }) {
  const list = objs.slice().reverse();
  if (!list.length) return <div className="layers-empty"><LayersIcon size={22} strokeWidth={1.5} /><p>Henüz katman yok</p><small>Eklediğin her öğe burada listelenir.</small></div>;
  return (
    <ul className="layers" role="listbox" aria-label="Katmanlar" aria-multiselectable="true">
      {list.map((o) => {
        const I = TYPE_ICON[o.type] || Square, on = sel.includes(o.id);
        const label = o.type === 'text' ? (String(o.text).split('\n')[0] || TYPE_LABELS.text).slice(0, 40) : o.name || TYPE_LABELS[o.type];
        return (
          <li key={o.id} role="option" aria-selected={on} className={`${on ? 'on' : ''} ${o.hidden ? 'dim' : ''}`} onClick={(e) => onSelect(o.id, e.shiftKey || e.metaKey || e.ctrlKey)}>
            <span className="ico"><I size={16} strokeWidth={1.75} aria-hidden="true" /></span>
            <span className="nm">{label}<small>{TYPE_LABELS[o.type]}</small></span>
            <button type="button" className={`ibtn sm ${o.locked ? 'on' : ''}`} aria-label={o.locked ? 'Kilidi aç' : 'Kilitle'} aria-pressed={o.locked} onClick={(e) => { e.stopPropagation(); onFlag(o.id, 'locked', !o.locked); }}>{o.locked ? <Lock size={15} strokeWidth={1.75} /> : <LockOpen size={15} strokeWidth={1.75} />}</button>
            <button type="button" className={`ibtn sm ${o.hidden ? 'on' : ''}`} aria-label={o.hidden ? 'Göster' : 'Gizle'} aria-pressed={o.hidden} onClick={(e) => { e.stopPropagation(); onFlag(o.id, 'hidden', !o.hidden); }}>{o.hidden ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}</button>
          </li>
        );
      })}
    </ul>
  );
}
