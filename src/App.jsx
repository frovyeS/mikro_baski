import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MousePointer2, Hand, Type, Square, Circle, Triangle, Star, ImagePlus, QrCode, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Download, FolderOpen, Sun, Moon, Monitor, Layers as LayersIcon, SlidersHorizontal, Copy, Trash2, Lock, LockOpen, BringToFront, SendToBack, Keyboard, Grid3x3, Ruler, Magnet, ShieldCheck, TriangleAlert, FilePlus2, Save, X, Check, ChevronDown, Settings2 } from 'lucide-react';
import Canvas, { cursorBus } from './components/Canvas.jsx';
import Inspector from './components/Inspector.jsx';
import Layers from './components/Layers.jsx';
import { ExportModal, NewDocModal, PreflightModal, ShortcutsModal, MOD } from './components/Modals.jsx';
import { IconBtn, Segmented } from './components/Fields.jsx';
import { LineIcon, Logo } from './components/Icons.jsx';
import { useDesign } from './lib/store.js';
import { aabb, createObject, defaultDoc, migrate, unionBox } from './lib/model.js';
import { clamp, toUnit, uid, UNITS } from './lib/units.js';
import { ensureFont, measureText, usedFaces } from './lib/fonts.js';
import { exportPDF, exportPNG, exportProject, exportSVG, readImage } from './lib/exporter.jsx';
import { kvGet, kvSet, legacyProject, prefGet, prefSet } from './lib/storage.js';
import { runPreflight } from './lib/preflight.js';

const MM_PX = 96 / 25.4;
const TOOLS = [
  { id: 'select', label: 'Seç', icon: MousePointer2, key: 'V' },
  { id: 'hand', label: 'El (kaydır)', icon: Hand, key: 'H' },
  { sep: true },
  { id: 'text', label: 'Metin', icon: Type, key: 'T' },
  { sep: true },
  { id: 'rect', label: 'Dikdörtgen', icon: Square, key: 'R' },
  { id: 'ellipse', label: 'Elips', icon: Circle, key: 'O' },
  { id: 'triangle', label: 'Üçgen', icon: Triangle, key: 'G' },
  { id: 'star', label: 'Yıldız', icon: Star, key: 'S' },
  { id: 'line', label: 'Çizgi', icon: LineIcon, key: 'L' },
  { sep: true },
  { id: 'image', label: 'Görsel ekle', icon: ImagePlus, key: 'I' },
  { id: 'qr', label: 'QR kodu', icon: QrCode, key: 'Q' },
];
const KEYTOOL = Object.fromEntries(TOOLS.filter((t) => t.key).map((t) => [t.key.toLowerCase(), t.id]));

function useLayout() {
  const calc = () => (window.innerWidth >= 1100 ? 'desktop' : window.innerWidth >= 720 ? 'tablet' : 'phone');
  const [m, setM] = useState(calc);
  useEffect(() => { const f = () => setM(calc()); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return m;
}

export default function App() {
  const design = useDesign({ doc: defaultDoc(), objs: [] });
  const { state, commit, live, undo, redo } = design;
  const { doc, objs } = state;
  const mode = useLayout();
  const coarse = useMemo(() => window.matchMedia?.('(pointer: coarse)').matches, []);
  const compact = mode === 'phone' || coarse;

  const [ready, setReady] = useState(false);
  const [sel, setSel] = useState([]);
  const [tool, setTool] = useState('select');
  const [editId, setEditId] = useState(null);
  const [modal, setModal] = useState(null);
  const [panel, setPanel] = useState(null); // tablet/phone: 'props' | 'layers'
  const [menu, setMenu] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [zoomPct, setZoomPct] = useState(100);
  const [saved, setSaved] = useState('saved');
  const [prefs, setPrefs] = useState(() => ({ theme: prefGet('theme', 'auto'), grid: prefGet('grid', false), snap: prefGet('snap', true), rulers: prefGet('rulers', true) }));
  const setPref = (k, v) => { setPrefs((p) => ({ ...p, [k]: v })); prefSet(k, v); };

  const canvasRef = useRef(null), fileRef = useRef(null), projRef = useRef(null), replaceRef = useRef(null), clip = useRef({ items: [], n: 0 });

  const toast = useCallback((msg, kind = 'ok') => {
    const id = uid(); setToasts((t) => [...t.slice(-2), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 5000 : 2600);
  }, []);

  // ---- Tema ----
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = prefs.theme === 'dark' || (prefs.theme === 'auto' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1c1c1e' : '#f5f5f7');
    };
    apply(); mq.addEventListener('change', apply); return () => mq.removeEventListener('change', apply);
  }, [prefs.theme]);
  useEffect(() => { document.title = `${doc.name || 'Adsız tasarım'} — Mikro Baskı`; }, [doc.name]);

  // ---- Yükleme / otomatik kayıt ----
  useEffect(() => {
    (async () => {
      try {
        let s = await kvGet('project');
        if (!s) s = legacyProject();
        if (s) { const m = migrate(s); design.reset({ doc: m.doc, objs: m.objs }); }
      } catch { /* bozuk kayıt: boş belge ile başla */ }
      setReady(true);
    })();
  }, []); // eslint-disable-line
  useEffect(() => {
    if (!ready) return;
    setSaved('saving');
    const t = setTimeout(async () => { const ok = await kvSet('project', { app: 'mikro-baski', schemaVersion: 2, doc, objects: objs }); setSaved(ok ? 'saved' : 'error'); }, 700);
    return () => clearTimeout(t);
  }, [doc, objs, ready]);

  // ---- Yazı tipleri yüklenince ölçüleri yenile ----
  const faceKey = usedFaces(objs).map((f) => `${f.id}|${f.bold}|${f.italic}`).sort().join(',');
  useEffect(() => {
    let alive = true;
    Promise.all(usedFaces(objs).map((f) => ensureFont(f.id, f.bold, f.italic))).then(() => {
      if (!alive) return;
      live((s) => ({ ...s, objs: s.objs.map((o) => { if (o.type !== 'text') return o; const m = measureText(o); return Math.abs(m.w - o.w) < 0.01 && Math.abs(m.h - o.h) < 0.01 ? o : { ...o, ...m }; }) }));
    });
    return () => { alive = false; };
  }, [faceKey, ready]); // eslint-disable-line

  // seçili olmayan (silinmiş) kimlikleri temizle
  useEffect(() => { if (sel.some((id) => !objs.some((o) => o.id === id))) setSel((s) => s.filter((id) => objs.some((o) => o.id === id))); }, [objs]); // eslint-disable-line

  const selObjs = useMemo(() => sel.map((id) => objs.find((o) => o.id === id)).filter(Boolean), [sel, objs]);
  const pre = useMemo(() => runPreflight(doc, objs), [doc, objs]);

  // ---- Eylemler ----
  const TEXTKEYS = ['text', 'fontFamily', 'fontSize', 'bold', 'italic', 'lineHeight', 'letterSpacing'];
  const patchObjs = useCallback((ids, patch, key) => commit((s) => ({
    ...s, objs: s.objs.map((o) => {
      if (!ids.includes(o.id)) return o;
      const p = typeof patch === 'function' ? patch(o) : patch;
      const n = { ...o, ...p };
      if (n.type === 'text' && TEXTKEYS.some((k) => k in p)) { const m = measureText(n); const dw = m.w - o.w; n.w = m.w; n.h = m.h; if (!('x' in p)) n.x = n.align === 'center' ? o.x - dw / 2 : n.align === 'right' ? o.x - dw : o.x; }
      return n;
    }),
  }), key ? key + ids.join() : undefined), [commit]);

  const setDoc = useCallback((p, key) => commit((s) => {
    const d = { ...s.doc, ...p };
    d.w = clamp(d.w, 1, 5000); d.h = clamp(d.h, 1, 5000); d.bleed = clamp(d.bleed, 0, 50); d.safe = clamp(d.safe, 0, Math.min(d.w, d.h) / 2 - 0.5);
    return { ...s, doc: d };
  }, key), [commit]);

  const addObjs = useCallback((list) => { commit((s) => ({ ...s, objs: [...s.objs, ...list] })); setSel(list.map((o) => o.id)); }, [commit]);

  const act = useMemo(() => ({
    patch: patchObjs, setDoc,
    resize: (o, dim, v) => {
      v = Math.max(0.1, v);
      if (o.type === 'qr' || o.type === 'image') { const k = v / (dim === 'w' ? o.w : o.h); patchObjs([o.id], { w: o.w * k, h: o.h * k }, 'size'); }
      else patchObjs([o.id], { [dim]: v }, 'size');
    },
    resetAspect: (o) => o.natW && patchObjs([o.id], { h: (o.w * o.natH) / o.natW }),
    replaceImage: (o) => { replaceRef.current = o.id; fileRef.current.dataset.mode = 'replace'; fileRef.current.click(); },
    align: (kind) => {
      const list = objs.filter((o) => sel.includes(o.id) && !o.locked); if (!list.length) return;
      const f = list.length > 1 ? unionBox(list) : { x0: 0, y0: 0, x1: doc.w, y1: doc.h };
      commit((s) => ({ ...s, objs: s.objs.map((o) => {
        if (!list.some((l) => l.id === o.id)) return o;
        const b = aabb(o); let dx = 0, dy = 0;
        if (kind === 'left') dx = f.x0 - b.x0; if (kind === 'right') dx = f.x1 - b.x1; if (kind === 'hcenter') dx = (f.x0 + f.x1) / 2 - (b.x0 + b.x1) / 2;
        if (kind === 'top') dy = f.y0 - b.y0; if (kind === 'bottom') dy = f.y1 - b.y1; if (kind === 'vcenter') dy = (f.y0 + f.y1) / 2 - (b.y0 + b.y1) / 2;
        return { ...o, x: o.x + dx, y: o.y + dy };
      }) }));
    },
    order: (kind) => commit((s) => {
      const arr = s.objs.slice(), has = (o) => sel.includes(o.id);
      if (kind === 'front') return { ...s, objs: [...arr.filter((o) => !has(o)), ...arr.filter(has)] };
      if (kind === 'back') return { ...s, objs: [...arr.filter(has), ...arr.filter((o) => !has(o))] };
      if (kind === 'forward') for (let i = arr.length - 2; i >= 0; i--) if (has(arr[i]) && !has(arr[i + 1])) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
      if (kind === 'backward') for (let i = 1; i < arr.length; i++) if (has(arr[i]) && !has(arr[i - 1])) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
      return { ...s, objs: arr };
    }),
    duplicate: () => {
      const list = objs.filter((o) => sel.includes(o.id)); if (!list.length) return;
      const copies = list.map((o) => ({ ...o, id: uid(), x: o.x + 4, y: o.y + 4, locked: false }));
      commit((s) => ({ ...s, objs: [...s.objs, ...copies] })); setSel(copies.map((c) => c.id));
    },
    remove: () => { if (!sel.length) return; commit((s) => ({ ...s, objs: s.objs.filter((o) => !sel.includes(o.id)) })); setSel([]); },
    setFlag: (flag, val) => patchObjs(sel, { [flag]: val }),
  }), [objs, sel, doc.w, doc.h, commit, patchObjs, setDoc]);

  const flagOne = (id, flag, val) => patchObjs([id], { [flag]: val });
  const selectFromLayers = (id, add) => setSel((s) => (add ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]));
  const showObjs = (ids) => { setSel(ids); const l = objs.filter((o) => ids.includes(o.id)); setTimeout(() => canvasRef.current?.reveal(unionBox(l)), 30); };

  // ---- Görsel ekleme ----
  const addImageFile = useCallback(async (file, at) => {
    try {
      const im = await readImage(file);
      const maxW = doc.w * 0.8, maxH = doc.h * 0.8, k = Math.min(maxW / im.natW, maxH / im.natH);
      const w = im.natW * k, h = im.natH * k, cx = at ? at[0] : doc.w / 2, cy = at ? at[1] : doc.h / 2;
      const o = createObject('image', { x: cx - w / 2, y: cy - h / 2, w, h, src: im.src, natW: im.natW, natH: im.natH, name: im.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Görsel' }, objs);
      addObjs([o]);
    } catch (e) { toast(e.message || 'Görsel eklenemedi', 'err'); }
  }, [doc.w, doc.h, objs, addObjs, toast]);
  const onFilePicked = async (e) => {
    const f = e.target.files?.[0]; const mode = e.target.dataset.mode; e.target.value = ''; e.target.dataset.mode = '';
    if (!f) return;
    if (mode === 'replace') {
      try { const im = await readImage(f); const id = replaceRef.current; patchObjs([id], (o) => ({ src: im.src, natW: im.natW, natH: im.natH, h: (o.w * im.natH) / im.natW })); } catch (er) { toast(er.message, 'err'); }
    } else addImageFile(f);
  };

  // ---- Dosya işlemleri ----
  const openProject = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try {
      const m = migrate(JSON.parse(await f.text()));
      commit(() => ({ doc: m.doc, objs: m.objs })); setSel([]); toast(`“${m.doc.name}” açıldı`);
    } catch { toast('Bu dosya okunamadı. Geçerli bir .mikrobaski dosyası seçin.', 'err'); }
  };
  const createDoc = (d) => { commit(() => ({ doc: { ...defaultDoc(), ...d }, objs: [] })); setSel([]); setModal(null); setTimeout(() => canvasRef.current?.fit(), 30); };
  const runExport = async ({ fmt, opts, pdfMode, dpi }) => {
    try {
      if (fmt === 'svg') await exportSVG(doc, objs, opts);
      else if (fmt === 'png') await exportPNG(doc, objs, opts, dpi);
      else await exportPDF(doc, objs, opts, { mode: pdfMode, dpi });
      toast(`${fmt.toUpperCase()} dosyası indirildi`);
    } catch (e) { console.error(e); toast('Dışa aktarma başarısız oldu. Lütfen tekrar deneyin.', 'err'); throw e; }
  };
  const saveProject = () => { exportProject(doc, objs); toast('Proje dosyası indirildi'); };

  // ---- Panolar ve klavye ----
  const copySel = () => { const l = objs.filter((o) => sel.includes(o.id)); if (l.length) { clip.current = { items: l, n: 0 }; return true; } return false; };
  const pasteClip = () => {
    const c = clip.current; if (!c.items.length) return; c.n += 1;
    const copies = c.items.map((o) => ({ ...o, id: uid(), x: o.x + 5 * c.n, y: o.y + 5 * c.n, locked: false }));
    addObjs(copies);
  };
  const latest = useRef(); latest.current = { act, sel, objs, doc, tool, undo, redo, copySel, pasteClip, saveProject, setModal, selObjs, editId };
  useEffect(() => {
    const kd = (e) => {
      const L = latest.current, t = e.target, typing = /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable;
      const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
      if (typing) return;
      if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? L.redo() : L.undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); L.redo(); return; }
      if (mod && k === 'a') { e.preventDefault(); setSel(L.objs.filter((o) => !o.hidden && !o.locked).map((o) => o.id)); return; }
      if (mod && k === 'd') { e.preventDefault(); L.act.duplicate(); return; }
      if (mod && k === 'c') { if (L.copySel()) e.preventDefault(); return; }
      if (mod && k === 'x') { if (L.copySel()) { e.preventDefault(); L.act.remove(); } return; }
      if (mod && k === 's') { e.preventDefault(); L.saveProject(); return; }
      if (mod && k === 'e') { e.preventDefault(); L.setModal('export'); return; }
      if (mod && k === '0') { e.preventDefault(); canvasRef.current?.fit(); return; }
      if (mod && (k === '=' || k === '+')) { e.preventDefault(); canvasRef.current?.zoomIn(); return; }
      if (mod && k === '-') { e.preventDefault(); canvasRef.current?.zoomOut(); return; }
      if (mod && (k === ']' || k === '[')) { e.preventDefault(); L.act.order(k === ']' ? (e.shiftKey ? 'front' : 'forward') : (e.shiftKey ? 'back' : 'backward')); return; }
      if (mod || e.altKey) return;
      if (k === 'escape') { if (L.tool !== 'select') setTool('select'); else setSel([]); return; }
      if (k === 'delete' || k === 'backspace') { if (L.sel.length) { e.preventDefault(); L.act.remove(); } return; }
      if (k === 'enter') { const o = L.selObjs[0]; if (L.selObjs.length === 1 && o.type === 'text' && !o.locked) { e.preventDefault(); setEditId({ id: o.id }); } return; }
      if (k === '?') { L.setModal('keys'); return; }
      if (k.startsWith('arrow')) {
        const list = L.objs.filter((o) => L.sel.includes(o.id) && !o.locked); if (!list.length) return; e.preventDefault();
        const d = (e.shiftKey ? 10 : 1) * (L.doc.unit === 'in' ? 0.254 : L.doc.unit === 'px' ? 0.2646 : 1) * (e.shiftKey ? 1 : 0.5);
        const dx = k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0, dy = k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0;
        L.act.patch(list.map((o) => o.id), (o) => ({ x: o.x + dx, y: o.y + dy }), 'nudge');
        return;
      }
      const tl = KEYTOOL[k];
      if (tl) { e.preventDefault(); pickTool(tl); }
    };
    const paste = (e) => {
      if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
      const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
      if (files.length) { e.preventDefault(); files.forEach((f) => addImageFile(f)); return; }
      if (clip.current.items.length) { e.preventDefault(); pasteClip(); }
    };
    window.addEventListener('keydown', kd); window.addEventListener('paste', paste);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('paste', paste); };
  }); // her render'da güncel kapanışlarla yeniden bağlanır

  function pickTool(id) {
    if (id === 'image') { fileRef.current.dataset.mode = ''; fileRef.current.click(); setTool('select'); return; }
    setTool(id); setMenu(false);
  }

  useEffect(() => { if (!menu) return; const f = (e) => { if (!e.target.closest?.('.menu-wrap')) setMenu(false); }; window.addEventListener('pointerdown', f); return () => window.removeEventListener('pointerdown', f); }, [menu]);

  const themeIcon = prefs.theme === 'dark' ? Moon : prefs.theme === 'light' ? Sun : Monitor;
  const themeLabel = { auto: 'Tema: Sistem', light: 'Tema: Açık', dark: 'Tema: Koyu' }[prefs.theme];
  const cycleTheme = () => setPref('theme', { auto: 'light', light: 'dark', dark: 'auto' }[prefs.theme]);

  const inspector = <Inspector doc={doc} sel={selObjs} act={act} prefs={prefs} setPref={setPref} pre={pre} openPreflight={() => setModal('pf')} />;
  const layersEl = <Layers objs={objs} sel={sel} onSelect={selectFromLayers} onFlag={flagOne} />;
  const preOk = !pre.errors && !pre.warns;

  if (!ready) return <div className="boot"><Logo size={44} /></div>;

  return (
    <div className={`app m-${mode}`} data-tool={tool}>
      {/* ÜST ÇUBUK */}
      <header className="top">
        <div className="top-l">
          <div className="menu-wrap">
            <button type="button" className="brand" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="Dosya menüsü">
              <Logo size={26} />{mode !== 'phone' && <><b>Mikro Baskı</b><ChevronDown size={15} strokeWidth={2} /></>}
            </button>
            {menu && (
              <div className="menu" role="menu">
                <button role="menuitem" type="button" onClick={() => { setMenu(false); setModal('new'); }}><FilePlus2 size={17} strokeWidth={1.75} />Yeni belge…</button>
                <button role="menuitem" type="button" onClick={() => { setMenu(false); projRef.current.click(); }}><FolderOpen size={17} strokeWidth={1.75} />Proje aç…</button>
                <button role="menuitem" type="button" onClick={() => { setMenu(false); saveProject(); }}><Save size={17} strokeWidth={1.75} />Projeyi kaydet<kbd>{MOD} S</kbd></button>
                <hr />
                <button role="menuitem" type="button" onClick={() => { setMenu(false); setModal('export'); }}><Download size={17} strokeWidth={1.75} />Dışa aktar…<kbd>{MOD} E</kbd></button>
                <button role="menuitem" type="button" onClick={() => { setMenu(false); setModal('pf'); }}><ShieldCheck size={17} strokeWidth={1.75} />Baskı kontrolü</button>
                <hr />
                <button role="menuitem" type="button" onClick={() => { setMenu(false); setModal('keys'); }}><Keyboard size={17} strokeWidth={1.75} />Klavye kısayolları<kbd>?</kbd></button>
              </div>
            )}
          </div>
          <input className="docname" value={doc.name} aria-label="Belge adı" spellCheck={false} onChange={(e) => setDoc({ name: e.target.value }, 'name')} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); }} />
          <span className={`save-dot ${saved}`} title={saved === 'saved' ? 'Bu cihaza otomatik kaydedildi' : saved === 'saving' ? 'Kaydediliyor…' : 'Otomatik kayıt başarısız (depolama dolu olabilir). Projeyi dosya olarak kaydedin.'}>{saved === 'saved' ? <><Check size={13} strokeWidth={2.2} /><i>Kaydedildi</i></> : saved === 'saving' ? <i>Kaydediliyor…</i> : <><TriangleAlert size={13} strokeWidth={2} /><i>Kaydedilemedi</i></>}</span>
        </div>
        <div className="top-c">
          <IconBtn icon={Undo2} label="Geri al" kbd={`${MOD} Z`} onClick={undo} disabled={!design.canUndo} />
          <IconBtn icon={Redo2} label="Yinele" kbd={`${MOD} ⇧ Z`} onClick={redo} disabled={!design.canRedo} />
          {mode !== 'phone' && <>
            <span className="vsep" />
            <IconBtn icon={ZoomOut} label="Uzaklaştır" kbd={`${MOD} −`} onClick={() => canvasRef.current?.zoomOut()} />
            <button type="button" className="zoomval" aria-label="Sığdır" data-tip="Sığdır  ⌘0" onClick={() => canvasRef.current?.fit()}>{zoomPct}%</button>
            <IconBtn icon={ZoomIn} label="Yakınlaştır" kbd={`${MOD} +`} onClick={() => canvasRef.current?.zoomIn()} />
            <IconBtn icon={Maximize2} label="Sayfaya sığdır" kbd={`${MOD} 0`} onClick={() => canvasRef.current?.fit()} />
          </>}
        </div>
        <div className="top-r">
          {mode === 'tablet' && <>
            <IconBtn icon={LayersIcon} label="Katmanlar" active={panel === 'layers'} onClick={() => setPanel(panel === 'layers' ? null : 'layers')} />
            <IconBtn icon={SlidersHorizontal} label="Özellikler" active={panel === 'props'} onClick={() => setPanel(panel === 'props' ? null : 'props')} />
          </>}
          {mode !== 'phone' && <>
            <IconBtn icon={themeIcon} label={themeLabel} onClick={cycleTheme} />
            <IconBtn icon={Keyboard} label="Klavye kısayolları" kbd="?" onClick={() => setModal('keys')} />
          </>}
          <button type="button" className="btn primary exp" onClick={() => setModal('export')} aria-label="Dışa aktar"><Download size={16} strokeWidth={2} /><span>Dışa aktar</span></button>
        </div>
      </header>

      <div className="body">
        {/* ARAÇ ÇUBUĞU (masaüstü/tablet: dikey) */}
        {mode !== 'phone' && (
          <nav className="rail" aria-label="Araçlar">
            {TOOLS.map((t, i) => t.sep ? <i key={i} className="rsep" /> : <IconBtn key={t.id} icon={t.icon} label={t.label} kbd={t.key} active={tool === t.id} onClick={() => pickTool(t.id)} size={19} />)}
          </nav>
        )}

        {mode === 'desktop' && (
          <aside className="side left" aria-label="Katmanlar">
            <div className="side-h"><b>Katmanlar</b><span>{objs.length}</span></div>
            <div className="side-b">{layersEl}</div>
          </aside>
        )}

        <main className="stage">
          <Canvas ref={canvasRef} doc={doc} objs={objs} sel={sel} setSel={setSel} tool={tool} setTool={setTool} design={design} compact={compact}
            rulers={prefs.rulers} grid={prefs.grid} snap={prefs.snap} editId={editId} setEditId={setEditId} onFiles={(fs, at) => fs.forEach((f) => addImageFile(f, at))} onView={(z) => setZoomPct(Math.round((z / MM_PX) * 100))} />

          {mode === 'phone' && (
            <div className="fab-zoom">
              <IconBtn icon={Maximize2} label="Sayfaya sığdır" onClick={() => canvasRef.current?.fit()} />
            </div>
          )}

          {/* Tablet çekmecesi */}
          {mode === 'tablet' && panel && (
            <aside className="drawer" aria-label={panel === 'layers' ? 'Katmanlar' : 'Özellikler'}>
              <div className="side-h"><b>{panel === 'layers' ? 'Katmanlar' : sel.length ? 'Özellikler' : 'Belge'}</b><button type="button" className="ibtn" aria-label="Kapat" onClick={() => setPanel(null)}><X size={18} strokeWidth={1.75} /></button></div>
              <div className="side-b">{panel === 'layers' ? layersEl : inspector}</div>
            </aside>
          )}
        </main>

        {mode === 'desktop' && (
          <aside className="side right" aria-label="Özellikler"><div className="side-b">{inspector}</div></aside>
        )}
      </div>

      {/* DURUM ÇUBUĞU */}
      {mode !== 'phone' && (
        <footer className="status">
          <Cursor unit={doc.unit} />
          <span className="st-doc">{toUnit(doc.w, doc.unit)} × {toUnit(doc.h, doc.unit)} {doc.unit}{doc.bleed > 0 ? ` · kesim payı ${toUnit(doc.bleed, doc.unit)}` : ''}</span>
          <span className="grow" />
          <IconBtn icon={Ruler} label="Cetveller" active={prefs.rulers} onClick={() => setPref('rulers', !prefs.rulers)} size={16} />
          <IconBtn icon={Grid3x3} label="Izgara" active={prefs.grid} onClick={() => setPref('grid', !prefs.grid)} size={16} />
          <IconBtn icon={Magnet} label="Akıllı kılavuzlar ve yakalama" active={prefs.snap} onClick={() => setPref('snap', !prefs.snap)} size={16} />
          <button type="button" className={`pf-badge ${preOk ? 'ok' : pre.errors ? 'bad' : 'warn'}`} onClick={() => setModal('pf')}>
            {preOk ? <ShieldCheck size={14} strokeWidth={2} /> : <TriangleAlert size={14} strokeWidth={2} />}{preOk ? 'Baskıya hazır' : `${pre.errors + pre.warns} uyarı`}
          </button>
        </footer>
      )}

      {/* TELEFON: bağlam çubuğu + araçlar + sayfa */}
      {mode === 'phone' && (
        <div className="dock">
          {selObjs.length > 0 && panel !== 'props' && (
            <div className="ctxbar" role="toolbar" aria-label="Seçili öğe">
              <IconBtn icon={Copy} label="Çoğalt" onClick={act.duplicate} />
              <IconBtn icon={BringToFront} label="Öne getir" onClick={() => act.order('forward')} />
              <IconBtn icon={SendToBack} label="Arkaya gönder" onClick={() => act.order('backward')} />
              <IconBtn icon={selObjs.every((o) => o.locked) ? Lock : LockOpen} label="Kilit" active={selObjs.every((o) => o.locked)} onClick={() => act.setFlag('locked', !selObjs.every((o) => o.locked))} />
              <IconBtn icon={Trash2} label="Sil" className="danger" onClick={act.remove} />
              <button type="button" className="btn primary sm" onClick={() => setPanel('props')}><SlidersHorizontal size={15} strokeWidth={2} />Özellikler</button>
            </div>
          )}
          {selObjs.length === 0 && (
            <div className="ctxbar panels" role="toolbar" aria-label="Paneller">
              <button type="button" className={`pbtn ${panel === 'props' ? 'on' : ''}`} onClick={() => setPanel('props')}><Settings2 size={20} strokeWidth={1.75} />Belge</button>
              <button type="button" className={`pbtn ${panel === 'layers' ? 'on' : ''}`} onClick={() => setPanel('layers')}><LayersIcon size={20} strokeWidth={1.75} />Katmanlar</button>
              <button type="button" className={`pbtn ${preOk ? '' : pre.errors ? 'bad' : 'warn'}`} onClick={() => setModal('pf')}>{preOk ? <ShieldCheck size={20} strokeWidth={1.75} /> : <TriangleAlert size={20} strokeWidth={1.75} />}Kontrol</button>
              <button type="button" className="pbtn" onClick={() => canvasRef.current?.fit()}><Maximize2 size={20} strokeWidth={1.75} />Sığdır</button>
            </div>
          )}
          <nav className="tabbar" aria-label="Araçlar">
            {TOOLS.map((t, i) => t.sep ? <i key={i} className="rsep" /> : <IconBtn key={t.id} icon={t.icon} label={t.label} active={tool === t.id} onClick={() => pickTool(t.id)} size={21} />)}
          </nav>
        </div>
      )}
      {mode === 'phone' && panel && (
        <div className="sheet-wrap">
          <div className="sheet" role="dialog" aria-label="Paneller">
            <div className="grab" aria-hidden="true" />
            <div className="side-h">
              <Segmented label="Panel" value={panel} onChange={setPanel} options={[{ value: 'props', label: sel.length ? 'Özellikler' : 'Belge' }, { value: 'layers', label: 'Katmanlar' }]} />
              <button type="button" className="ibtn" aria-label="Kapat" onClick={() => setPanel(null)}><X size={19} strokeWidth={1.75} /></button>
            </div>
            <div className="side-b">{panel === 'layers' ? layersEl : inspector}</div>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={onFilePicked} />
      <input ref={projRef} type="file" hidden accept=".mikrobaski,.json,application/json" onChange={openProject} />

      {modal === 'new' && <NewDocModal onClose={() => setModal(null)} onCreate={createDoc} hasWork={objs.length > 0} unit={doc.unit} />}
      {modal === 'export' && <ExportModal doc={doc} objs={objs} pre={pre} onClose={() => setModal(null)} onRun={runExport} onPreflight={() => setModal('pf')} />}
      {modal === 'pf' && <PreflightModal pre={pre} onClose={() => setModal(null)} onShow={showObjs} />}
      {modal === 'keys' && <ShortcutsModal onClose={() => setModal(null)} />}

      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}</div>
    </div>
  );
}

function Cursor({ unit }) {
  const [p, setP] = useState(null);
  useEffect(() => { const f = (x, y) => setP([x, y]); cursorBus.subs.add(f); return () => cursorBus.subs.delete(f); }, []);
  return <span className="st-cur">{p ? `X ${toUnit(p[0], unit)}  Y ${toUnit(p[1], unit)} ${unit}` : 'X —  Y —'}</span>;
}
