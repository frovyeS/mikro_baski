import React, { useEffect, useId, useRef, useState } from 'react';
import { Ban } from 'lucide-react';
import { SWATCHES } from '../lib/model.js';

export function Section({ title, children, action }) {
  return (
    <section className="sec">
      <div className="sec-h"><h4>{title}</h4>{action}</div>
      <div className="sec-b">{children}</div>
    </section>
  );
}

export function IconBtn({ icon: I, label, onClick, active, disabled, size = 18, className = '', kbd, ...rest }) {
  return (
    <button type="button" className={`ibtn ${active ? 'on' : ''} ${className}`} onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={active === undefined ? undefined : !!active} data-tip={kbd ? `${label}  ${kbd}` : label} {...rest}>
      <I size={size} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

export function NumberField({ label, value, onChange, min, max, step = 1, suffix, digits = 2, disabled, wide }) {
  const id = useId();
  const [txt, setTxt] = useState(null);
  const shown = txt ?? (Number.isFinite(value) ? String(Math.round(value * 10 ** digits) / 10 ** digits) : '');
  const apply = (v) => { if (!Number.isFinite(v)) return; let n = v; if (min != null) n = Math.max(min, n); if (max != null) n = Math.min(max, n); onChange(n); };
  return (
    <label className={`nf ${wide ? 'wide' : ''}`} htmlFor={id}>
      {label && <span className="nf-l">{label}</span>}
      <span className="nf-w">
        <input id={id} inputMode="decimal" disabled={disabled} value={shown}
          onFocus={(e) => e.target.select()}
          onChange={(e) => { const t = e.target.value; setTxt(t); const n = parseFloat(t.replace(',', '.')); if (t.trim() !== '' && Number.isFinite(n)) apply(n); }}
          onBlur={() => setTxt(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.currentTarget.blur(); }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1); apply(Math.round(((Number(value) || 0) + d) * 1000) / 1000); setTxt(null); }
            e.stopPropagation();
          }} />
        {suffix && <em>{suffix}</em>}
      </span>
    </label>
  );
}

export function ColorField({ label, value, onChange, allowNone = false, swatches = true }) {
  const none = !value || value === 'none';
  const hex = none ? '#000000' : value;
  const [txt, setTxt] = useState(null);
  return (
    <div className="cf">
      {label && <div className="cf-l">{label}</div>}
      <div className="cf-r">
        <label className={`sw ${none ? 'none' : ''}`} style={{ '--c': hex }} title="Renk seç">
          <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label={`${label || 'Renk'} seç`} />
        </label>
        <input className="hex" spellCheck="false" value={txt ?? (none ? 'Yok' : hex.toUpperCase())} aria-label={`${label || 'Renk'} kodu`}
          onFocus={(e) => e.target.select()}
          onChange={(e) => { let t = e.target.value.trim(); setTxt(t); if (!t.startsWith('#')) t = '#' + t; if (/^#[0-9a-f]{6}$/i.test(t)) onChange(t.toLowerCase()); else if (/^#[0-9a-f]{3}$/i.test(t)) onChange('#' + t.slice(1).split('').map((c) => c + c).join('').toLowerCase()); }}
          onBlur={() => setTxt(null)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); e.stopPropagation(); }} />
        {allowNone && <button type="button" className={`ibtn sm ${none ? 'on' : ''}`} aria-label="Renk yok" aria-pressed={none} data-tip="Yok" onClick={() => onChange('none')}><Ban size={15} strokeWidth={1.75} /></button>}
      </div>
      {swatches && <div className="sws" role="group" aria-label="Hazır renkler">{SWATCHES.map((c) => <button type="button" key={c} className={`s ${!none && hex.toLowerCase() === c ? 'on' : ''}`} style={{ '--c': c }} aria-label={c} onClick={() => onChange(c)} />)}</div>}
    </div>
  );
}

export function Segmented({ value, options, onChange, label, iconOnly }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.value} role="radio" aria-checked={value === o.value} aria-label={o.label} data-tip={iconOnly ? o.label : undefined} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.icon ? <o.icon size={16} strokeWidth={1.75} aria-hidden="true" /> : null}{!iconOnly || !o.icon ? <span>{o.label}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function SelectField({ label, value, onChange, children, disabled }) {
  const id = useId();
  return (
    <label className="sf" htmlFor={id}>
      {label && <span className="nf-l">{label}</span>}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>{children}</select>
    </label>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <label className="switch">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', k, true);
    return () => { window.removeEventListener('keydown', k, true); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header><h2>{title}</h2><button type="button" className="ibtn" aria-label="Kapat" onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button></header>
        <div className="modal-b">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}
