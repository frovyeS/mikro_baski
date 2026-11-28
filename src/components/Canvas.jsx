import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Shape, Objects } from '../lib/render.jsx';
import { aabb, corners, createObject, unionBox } from '../lib/model.js';
import { PT, clamp, deg, normAngle, rad, toUnit, UNITS } from '../lib/units.js';
import { cssFontFamily, effStyle, measureText } from '../lib/fonts.js';
import Rulers from './Rulers.jsx';

export const cursorBus = { subs: new Set(), emit(x, y) { this.subs.forEach((f) => f(x, y)); } };

const HANDLES = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };
const CURSOR = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
const DRAW_TOOLS = ['rect', 'ellipse', 'triangle', 'star', 'line', 'text', 'qr'];
const MM_PX = 96 / 25.4;
const MIN = 1;

const handlesFor = (o) => (o.type === 'line' ? ['e', 'w'] : o.type === 'text' || o.type === 'qr' ? ['nw', 'ne', 'se', 'sw'] : Object.keys(HANDLES));
const lockAspect = (o, shift) => o.type === 'qr' || o.type === 'text' || (o.type === 'image' && true) || shift;

function resizeBox(o0, key, px, py, shift) {
  const [hx, hy] = HANDLES[key], a = rad(o0.rotation || 0), c = Math.cos(a), s = Math.sin(a);
  const cx = o0.x + o0.w / 2, cy = o0.y + o0.h / 2;
  const lx0 = (-hx * o0.w) / 2, ly0 = (-hy * o0.h) / 2;
  const ax = cx + lx0 * c - ly0 * s, ay = cy + lx0 * s + ly0 * c;
  const dx = px - ax, dy = py - ay, lx = dx * c + dy * s, ly = -dx * s + dy * c;
  let nw = hx ? Math.max(MIN, hx * lx) : o0.w, nh = hy ? Math.max(o0.type === 'line' ? 0 : MIN, hy * ly) : o0.h;
  const keep = hx && hy && (o0.type === 'qr' || o0.type === 'text' || o0.type === 'image' || shift);
  if (keep) { const k = Math.max(nw / o0.w, nh / o0.h); nw = o0.w * k; nh = o0.h * k; }
  if (o0.type === 'image' && hx && !hy && shift) { nh = o0.h * (nw / o0.w); }
  const ox = (hx * nw) / 2, oy = (hy * nh) / 2;
  const ncx = ax + ox * c - oy * s, ncy = ay + ox * s + oy * c;
  return { x: ncx - nw / 2, y: ncy - nh / 2, w: nw, h: nh };
}

const Canvas = forwardRef(function Canvas({ doc, objs, sel, setSel, tool, setTool, design, theme, compact, rulers, grid, snap, editId, setEditId, onFiles, onView, onCtx }, ref) {
  const wrap = useRef(null), svgRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setViewState] = useState({ z: 2, x: 0, y: 0 });
  const viewRef = useRef(view); viewRef.current = view;
  const fitted = useRef(true);
  const pts = useRef(new Map());
  const g = useRef(null);
  const lastTap = useRef({ id: null, t: 0 });
  const spaceDown = useRef(false);
  const [overlay, setOverlay] = useState({ guides: [], marquee: null, hud: null });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const objsRef = useRef(objs); objsRef.current = objs;
  const selRef = useRef(sel); selRef.current = sel;
  const docRef = useRef(doc); docRef.current = doc;

  const setView = useCallback((v) => { viewRef.current = v; setViewState(v); onView?.(v.z); }, [onView]);
  const fit = useCallback(() => {
    const d = docRef.current, pad = compact ? 20 : 64;
    const bw = d.w + 2 * d.bleed, bh = d.h + 2 * d.bleed;
    const z = clamp(Math.min((size.w - pad * 2) / bw, (size.h - pad * 2) / bh), 0.2, 80);
    setView({ z, x: size.w / 2 - (d.w / 2) * z, y: size.h / 2 - (d.h / 2) * z });
    fitted.current = true;
  }, [size.w, size.h, compact, setView]);
  const zoomAt = useCallback((z2, cx = size.w / 2, cy = size.h / 2) => {
    const v = viewRef.current, z = clamp(z2, 0.15, 120), k = z / v.z;
    fitted.current = false;
    setView({ z, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k });
  }, [size.w, size.h, setView]);
  useImperativeHandle(ref, () => ({ fit, zoomIn: () => zoomAt(viewRef.current.z * 1.25), zoomOut: () => zoomAt(viewRef.current.z / 1.25), zoomTo: (pct) => zoomAt((pct / 100) * MM_PX), reveal: (box) => {
    if (!box) return; const v = viewRef.current; const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
    const sx = cx * v.z + v.x, sy = cy * v.z + v.y; if (sx < 0 || sy < 0 || sx > size.w || sy > size.h) { fitted.current = false; setView({ ...v, x: size.w / 2 - cx * v.z, y: size.h / 2 - cy * v.z }); }
  }, el: () => svgRef.current }), [fit, zoomAt, size, setView]);

  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => { const r = wrap.current.getBoundingClientRect(); setSize({ w: Math.max(100, r.width), h: Math.max(100, r.height) }); });
    ro.observe(wrap.current); return () => ro.disconnect();
  }, []);
  useEffect(() => { if (fitted.current) fit(); }, [size.w, size.h, fit]);
  useEffect(() => { fit(); /* belge boyutu değişince */ }, [doc.w, doc.h]); // eslint-disable-line

  const toDoc = (cx, cy) => { const r = svgRef.current.getBoundingClientRect(), v = viewRef.current; return [(cx - r.left - v.x) / v.z, (cy - r.top - v.y) / v.z]; };
  const toScr = (x, y) => [x * view.z + view.x, y * view.z + view.y];

  // Tekerlek: Ctrl/⌘ + tekerlek ya da dokunmatik yüzey kıstırma = yakınlaştır; aksi halde kaydır
  useEffect(() => {
    const el = svgRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(viewRef.current.z * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.01)), e.clientX - r.left, e.clientY - r.top);
      else { fitted.current = false; const v = viewRef.current; setView({ ...v, x: v.x - (e.shiftKey ? e.deltaY : e.deltaX), y: v.y - (e.shiftKey ? 0 : e.deltaY) }); }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, setView]);

  useEffect(() => {
    const kd = (e) => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !e.repeat) { spaceDown.current = true; setSpaceHeld(true); e.preventDefault(); } };
    const ku = (e) => { if (e.code === 'Space') { spaceDown.current = false; setSpaceHeld(false); } };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  // ---------- Yardımcılar ----------
  const patch = (ids, fn) => design.live((s) => ({ ...s, objs: s.objs.map((o) => (ids.includes(o.id) ? { ...o, ...fn(o) } : o)) }));
  const gridStep = doc.unit === 'in' ? 25.4 / 4 : doc.unit === 'px' ? (25.4 / 96) * 50 : 10;

  function snapMove(bb0, dx, dy, ignore, alt) {
    const d = docRef.current, th = (compact ? 8 : 6) / viewRef.current.z;
    let guides = [];
    if (!snap || alt) return { dx, dy, guides };
    const xs = [0, d.w / 2, d.w, d.safe, d.w - d.safe], ys = [0, d.h / 2, d.h, d.safe, d.h - d.safe];
    const others = objsRef.current.filter((o) => !ignore.includes(o.id) && !o.hidden);
    for (const o of others) { const b = aabb(o); xs.push(b.x0, (b.x0 + b.x1) / 2, b.x1); ys.push(b.y0, (b.y0 + b.y1) / 2, b.y1); }
    const mine = (x0, y0, x1, y1) => ({ x: [x0, (x0 + x1) / 2, x1], y: [y0, (y0 + y1) / 2, y1] });
    const m = mine(bb0.x0 + dx, bb0.y0 + dy, bb0.x1 + dx, bb0.y1 + dy);
    let bx = null, by = null;
    for (const v of m.x) for (const t of xs) { const df = t - v; if (Math.abs(df) < th && (bx === null || Math.abs(df) < Math.abs(bx))) bx = df; }
    for (const v of m.y) for (const t of ys) { const df = t - v; if (Math.abs(df) < th && (by === null || Math.abs(df) < Math.abs(by))) by = df; }
    let ndx = dx + (bx ?? 0), ndy = dy + (by ?? 0);
    if (bx === null) { const gx = Math.round((bb0.x0 + dx) / gridStep) * gridStep; if (grid && Math.abs(gx - (bb0.x0 + dx)) < th) ndx = gx - bb0.x0; }
    if (by === null) { const gy = Math.round((bb0.y0 + dy) / gridStep) * gridStep; if (grid && Math.abs(gy - (bb0.y0 + dy)) < th) ndy = gy - bb0.y0; }
    const f = mine(bb0.x0 + ndx, bb0.y0 + ndy, bb0.x1 + ndx, bb0.y1 + ndy);
    const hit = (arr, vals) => vals.filter((v) => arr.some((t) => Math.abs(t - v) < 0.01));
    const allB = [...others.map(aabb)];
    for (const x of hit(xs, f.x)) guides.push({ a: 'x', p: x });
    for (const y of hit(ys, f.y)) guides.push({ a: 'y', p: y });
    return { dx: ndx, dy: ndy, guides, allB };
  }

  // ---------- İşaretçi olayları ----------
  const hitOf = (t) => {
    const h = t.closest?.('[data-handle]'); if (h) return { handle: h.getAttribute('data-handle') };
    const o = t.closest?.('[data-oid]'); if (o) return { oid: o.getAttribute('data-oid') };
    return {};
  };

  const onDown = (e) => {
    if (editId) return;
    svgRef.current.setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    wrap.current.focus({ preventScroll: true });
    if (pts.current.size === 2) { // kıstırma
      endGesture(true);
      const [a, b] = [...pts.current.values()], r = svgRef.current.getBoundingClientRect(), v = viewRef.current;
      g.current = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx0: (a.x + b.x) / 2 - r.left, cy0: (a.y + b.y) / 2 - r.top, v0: v };
      return;
    }
    if (pts.current.size > 2) return;
    const touch = e.pointerType === 'touch';
    const [px, py] = toDoc(e.clientX, e.clientY);
    const { handle, oid } = hitOf(e.target);
    const mod = e.shiftKey || e.metaKey || e.ctrlKey;
    const base = { sx: e.clientX, sy: e.clientY, moved: false, touch, pid: e.pointerId };

    if (e.button === 1 || tool === 'hand' || spaceDown.current) { g.current = { ...base, type: 'pan', v0: viewRef.current }; return; }

    if (handle) {
      const o = objsRef.current.find((q) => q.id === selRef.current[0]);
      if (!o) return;
      design.begin();
      if (handle === 'rot') g.current = { ...base, type: 'rotate', o0: o };
      else g.current = { ...base, type: 'resize', key: handle, o0: o };
      return;
    }

    if (DRAW_TOOLS.includes(tool)) {
      design.begin();
      const o = createObject(tool, { x: px, y: py, w: 0, h: 0 }, objsRef.current);
      g.current = { ...base, type: 'draw', id: o.id, p0: [px, py], o };
      return;
    }

    if (oid) {
      const o = objsRef.current.find((q) => q.id === oid);
      let next = selRef.current;
      let collapse = false;
      if (mod) next = next.includes(oid) ? next : [...next, oid];
      else if (!next.includes(oid)) next = [oid];
      else if (next.length > 1) collapse = true;
      if (next !== selRef.current) { selRef.current = next; setSel(next); }
      const movable = next.map((id) => objsRef.current.find((q) => q.id === id)).filter((q) => q && !q.locked);
      design.begin();
      g.current = { ...base, type: 'move', oid, mod, collapse, wasSel: selRef.current.includes(oid), start: [px, py], ids: movable.map((q) => q.id), orig: Object.fromEntries(movable.map((q) => [q.id, { x: q.x, y: q.y }])), bb0: unionBox(movable), toggleOff: mod && sel.includes(oid), kind: o?.type };
      return;
    }

    // Boş alan
    if (touch) g.current = { ...base, type: 'pan', v0: viewRef.current, tapClear: true };
    else g.current = { ...base, type: 'marquee', p0: [px, py], mod, s0: [e.clientX, e.clientY] };
  };

  const onMove = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    if (e.pointerType !== 'touch') { const [x, y] = toDoc(e.clientX, e.clientY); cursorBus.emit(x, y); }
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const G = g.current; if (!G) return;
    if (G.type === 'pinch') {
      if (pts.current.size < 2) return;
      const [a, b] = [...pts.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
      const z = clamp(G.v0.z * (d / G.d0), 0.15, 120), dxp = (G.cx0 - G.v0.x) / G.v0.z, dyp = (G.cy0 - G.v0.y) / G.v0.z;
      fitted.current = false; setView({ z, x: cx - dxp * z, y: cy - dyp * z }); return;
    }
    if (e.pointerId !== G.pid) return;
    const ddx = e.clientX - G.sx, ddy = e.clientY - G.sy;
    if (!G.moved && Math.hypot(ddx, ddy) > (G.touch ? 6 : 3)) G.moved = true;
    const z = viewRef.current.z;
    const [px, py] = toDoc(e.clientX, e.clientY);

    switch (G.type) {
      case 'pan':
        if (G.moved) { fitted.current = false; setView({ ...G.v0, x: G.v0.x + ddx, y: G.v0.y + ddy }); }
        break;
      case 'marquee': {
        if (!G.moved) break;
        const x0 = Math.min(G.p0[0], px), y0 = Math.min(G.p0[1], py), x1 = Math.max(G.p0[0], px), y1 = Math.max(G.p0[1], py);
        setOverlay((o) => ({ ...o, marquee: { x0, y0, x1, y1 } }));
        const hits = objsRef.current.filter((o) => { if (o.hidden || o.locked) return false; const b = aabb(o); return b.x1 >= x0 && b.x0 <= x1 && b.y1 >= y0 && b.y0 <= y1; }).map((o) => o.id);
        setSel(G.mod ? [...new Set([...selRef.current.filter((id) => !G.hitsPrev?.includes(id)), ...hits])] : hits);
        G.hitsPrev = hits; break;
      }
      case 'move': {
        if (!G.moved || !G.ids.length) break;
        let dx = ddx / z, dy = ddy / z;
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        const sn = snapMove(G.bb0, dx, dy, G.ids, e.altKey);
        patch(G.ids, (o) => ({ x: G.orig[o.id].x + sn.dx, y: G.orig[o.id].y + sn.dy }));
        const nb = { x: G.bb0.x0 + sn.dx, y: G.bb0.y0 + sn.dy };
        setOverlay((o) => ({ ...o, guides: sn.guides, hud: { x: nb.x + G.bb0.w / 2, y: nb.y + G.bb0.h, text: `${toUnit(nb.x, docRef.current.unit)}, ${toUnit(nb.y, docRef.current.unit)} ${docRef.current.unit}` } }));
        break;
      }
      case 'resize': {
        const o0 = G.o0, b = resizeBox(o0, G.key, px, py, e.shiftKey);
        const p = { x: b.x, y: b.y, w: b.w, h: b.h };
        if (o0.type === 'text') { const fs = clamp(Math.round(o0.fontSize * (b.w / o0.w) * 10) / 10, 1, 1000); const m = measureText({ ...o0, fontSize: fs }); p.fontSize = fs; p.w = m.w; p.h = m.h; }
        patch([o0.id], () => p);
        setOverlay((o) => ({ ...o, hud: { x: p.x + p.w / 2, y: p.y + p.h, text: o0.type === 'text' ? `${p.fontSize} pt` : `${toUnit(p.w, docRef.current.unit)} × ${toUnit(p.h, docRef.current.unit)} ${docRef.current.unit}`, rot: o0.rotation } }));
        break;
      }
      case 'rotate': {
        const o0 = G.o0, cx = o0.x + o0.w / 2, cy = o0.y + o0.h / 2;
        let a = normAngle(deg(Math.atan2(py - cy, px - cx)) + 90);
        if (e.shiftKey) a = Math.round(a / 15) * 15; else { const n = Math.round(a / 45) * 45; if (Math.abs(a - n) < 2.5) a = n; }
        a = normAngle(Math.round(a * 10) / 10);
        patch([o0.id], () => ({ rotation: a }));
        setOverlay((o) => ({ ...o, hud: { x: cx, y: Math.max(o0.y, cy) + Math.max(o0.w, o0.h) / 2 + 4, text: `${a}°` } }));
        break;
      }
      case 'draw': {
        if (!G.moved) break;
        const [x0, y0] = G.p0;
        if (G.o.type === 'line') {
          let dx = px - x0, dy = py - y0, len = Math.hypot(dx, dy), a = deg(Math.atan2(dy, dx));
          if (e.shiftKey) { a = Math.round(a / 15) * 15; }
          const rr = rad(a), ex = x0 + Math.cos(rr) * len, ey = y0 + Math.sin(rr) * len;
          const o = { ...G.o, x: (x0 + ex) / 2 - len / 2, y: (y0 + ey) / 2, w: len, h: 0, rotation: normAngle(a) };
          G.cur = o; design.live((s) => ({ ...s, objs: [...s.objs.filter((q) => q.id !== o.id), o] }));
          setOverlay((ov) => ({ ...ov, hud: { x: (x0 + ex) / 2, y: Math.max(y0, ey) + 4, text: `${toUnit(len, docRef.current.unit)} ${docRef.current.unit}` } }));
        } else if (G.o.type === 'text' || G.o.type === 'qr') {
          break;
        } else {
          let w = Math.abs(px - x0), h = Math.abs(py - y0);
          if (e.shiftKey || G.o.type === 'star') { const m = Math.max(w, h); w = h = m; }
          const o = { ...G.o, x: px < x0 ? x0 - w : x0, y: py < y0 ? y0 - h : y0, w: Math.max(w, 0.1), h: Math.max(h, 0.1) };
          G.cur = o; design.live((s) => ({ ...s, objs: [...s.objs.filter((q) => q.id !== o.id), o] }));
          setOverlay((ov) => ({ ...ov, hud: { x: o.x + o.w / 2, y: o.y + o.h, text: `${toUnit(o.w, docRef.current.unit)} × ${toUnit(o.h, docRef.current.unit)} ${docRef.current.unit}` } }));
        }
        break;
      }
      default:
    }
  };

  function endGesture(cancel = false) {
    const G = g.current; g.current = null;
    setOverlay({ guides: [], marquee: null, hud: null });
    if (!G) return;
    if (G.type === 'move' || G.type === 'resize' || G.type === 'rotate') design.end();
    if (G.type === 'draw') {
      if (cancel) { design.end(); return; }
      const d = docRef.current;
      let o = G.cur;
      if (!o || !G.moved || (o.type === 'line' ? o.w < 2 : o.w < 2 && o.h < 2) || G.o.type === 'text' || G.o.type === 'qr') {
        const [x, y] = G.p0; const base = G.o;
        const sz = { rect: [50, 30], ellipse: [36, 36], triangle: [36, 32], star: [36, 36], line: [60, 0], text: [0, 0], qr: [30, 30] }[base.type];
        const big = Math.max(d.w, d.h), k = big < 150 ? 0.6 : big > 400 ? 2.5 : 1;
        o = base.type === 'text' ? { ...base, x, y: y - 4 }
          : base.type === 'line' ? { ...base, x: x - 30 * k, y, w: 60 * k, h: 0 }
          : { ...base, x: x - (sz[0] * k) / 2, y: y - (sz[1] * k) / 2, w: sz[0] * k, h: sz[1] * k };
      }
      design.live((s) => ({ ...s, objs: [...s.objs.filter((q) => q.id !== o.id), o] }));
      design.end();
      selRef.current = [o.id]; setSel([o.id]); setTool('select');
      if (o.type === 'text') setEditId({ id: o.id, fresh: true });
      return;
    }
    if (G.type === 'marquee' && !G.moved && !G.mod) setSel([]);
    if (G.type === 'pan' && G.tapClear && !G.moved) setSel([]);
    if (G.type === 'move' && !G.moved) {
      if (G.toggleOff) setSel(selRef.current.filter((id) => id !== G.oid));
      else if (G.collapse) setSel([G.oid]);
      const now = Date.now(), o = objsRef.current.find((q) => q.id === G.oid);
      if (o && o.type === 'text' && !o.locked && lastTap.current.id === G.oid && now - lastTap.current.t < 380) { setEditId({ id: G.oid }); lastTap.current = { id: null, t: 0 }; }
      else lastTap.current = { id: G.oid, t: now };
    }
  }

  const onUp = (e) => {
    pts.current.delete(e.pointerId);
    const G = g.current;
    if (G?.type === 'pinch') { if (pts.current.size < 2) { g.current = null; } return; }
    if (G && e.pointerId === G.pid) endGesture(e.type === 'pointercancel');
  };

  const onCtxMenu = (e) => { e.preventDefault(); const { oid } = hitOf(e.target); if (oid && !selRef.current.includes(oid)) setSel([oid]); onCtx?.(e.clientX, e.clientY); };

  const onDragOver = (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
  const onDrop = (e) => { const f = [...(e.dataTransfer?.files || [])].filter((x) => x.type.startsWith('image/')); if (f.length) { e.preventDefault(); const [x, y] = toDoc(e.clientX, e.clientY); onFiles?.(f, [x, y]); } };

  // ---------- Çizim ----------
  const selObjs = sel.map((id) => objs.find((o) => o.id === id)).filter(Boolean);
  const single = selObjs.length === 1 ? selObjs[0] : null;
  const touchUI = compact;
  const hs = touchUI ? 13 : 9, hitR = touchUI ? 22 : 12;
  const editObj = editId ? objs.find((o) => o.id === editId.id) : null;
  const pageRect = { x: view.x, y: view.y, w: doc.w * view.z, h: doc.h * view.z };

  const cursor = spaceHeld || tool === 'hand' ? (g.current?.type === 'pan' ? 'grabbing' : 'grab') : DRAW_TOOLS.includes(tool) ? 'crosshair' : 'default';
  const gstep = gridStep * view.z;

  return (
    <div className="viewport" ref={wrap} tabIndex={-1} onDragOver={onDragOver} onDrop={onDrop} data-theme-surface>
      <div className="page-shadow" style={{ left: pageRect.x - doc.bleed * view.z, top: pageRect.y - doc.bleed * view.z, width: pageRect.w + 2 * doc.bleed * view.z, height: pageRect.h + 2 * doc.bleed * view.z }} />
      <svg ref={svgRef} className="vp-svg" width={size.w} height={size.h} style={{ cursor }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onContextMenu={onCtxMenu} role="application" aria-label="Tasarım tuvali">
        <defs>
          <pattern id="mb-grid" width={gstep} height={gstep} patternUnits="userSpaceOnUse" x={view.x} y={view.y}>
            <path d={`M ${gstep} 0 H 0 V ${gstep}`} fill="none" stroke="var(--grid)" strokeWidth="1" />
          </pattern>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
          <rect x={-doc.bleed} y={-doc.bleed} width={doc.w + 2 * doc.bleed} height={doc.h + 2 * doc.bleed} fill={doc.bg} />
        </g>
        {grid && gstep >= 8 && <rect x={view.x} y={view.y} width={doc.w * view.z} height={doc.h * view.z} fill="url(#mb-grid)" pointerEvents="none" />}
        <g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
          <ObjectsLayer objs={objs} hideId={editObj?.id} />
        </g>
        {/* Çalışma alanı dışı: baskıda görünmeyecek kısım soluklaştırılır */}
        <path d={`M0 0H${size.w}V${size.h}H0Z M${view.x - doc.bleed * view.z} ${view.y - doc.bleed * view.z}h${(doc.w + 2 * doc.bleed) * view.z}v${(doc.h + 2 * doc.bleed) * view.z}h${-(doc.w + 2 * doc.bleed) * view.z}Z`} fill="var(--canvas)" fillOpacity=".86" fillRule="evenodd" pointerEvents="none" />
        <g pointerEvents="none" fill="none">
          {doc.bleed > 0 && <rect x={view.x - doc.bleed * view.z} y={view.y - doc.bleed * view.z} width={(doc.w + 2 * doc.bleed) * view.z} height={(doc.h + 2 * doc.bleed) * view.z} stroke="#ff453a" strokeWidth="1" strokeOpacity=".7" />}
          <rect x={view.x} y={view.y} width={pageRect.w} height={pageRect.h} stroke="var(--trim)" strokeWidth="1" />
          {doc.safe > 0 && <rect x={view.x + doc.safe * view.z} y={view.y + doc.safe * view.z} width={Math.max(0, (doc.w - 2 * doc.safe) * view.z)} height={Math.max(0, (doc.h - 2 * doc.safe) * view.z)} stroke="#30d158" strokeWidth="1" strokeDasharray="5 4" strokeOpacity=".85" />}
        </g>

        {/* Seçim arayüzü (ekran uzayında; boyutu sabit) */}
        <g className="ui">
          {overlay.guides.map((gd, i) => gd.a === 'x'
            ? <line key={i} x1={view.x + gd.p * view.z} x2={view.x + gd.p * view.z} y1={0} y2={size.h} className="guide" />
            : <line key={i} y1={view.y + gd.p * view.z} y2={view.y + gd.p * view.z} x1={0} x2={size.w} className="guide" />)}
          {selObjs.map((o) => {
            const b = o.type === 'line' ? { ...o, y: o.y - 3 / view.z, h: 6 / view.z } : o;
            const p = corners(b).map(([x, y]) => toScr(x, y));
            return <polygon key={o.id} points={p.map((q) => q.join(',')).join(' ')} className={`selbox ${o.locked ? 'locked' : ''} ${selObjs.length > 1 ? 'multi' : ''}`} pointerEvents="none" />;
          })}
          {selObjs.length > 1 && (() => { const u = unionBox(selObjs); const [x, y] = toScr(u.x0, u.y0); return <rect x={x} y={y} width={u.w * view.z} height={u.h * view.z} className="selbox group" pointerEvents="none" />; })()}
          {single && !single.locked && !editObj && <HandleLayer o={single} view={view} hs={hs} hitR={hitR} touch={touchUI} />}
          {overlay.marquee && (() => { const m = overlay.marquee; const [x, y] = toScr(m.x0, m.y0); return <rect x={x} y={y} width={(m.x1 - m.x0) * view.z} height={(m.y1 - m.y0) * view.z} className="marquee" pointerEvents="none" />; })()}
          {overlay.hud && (() => { const [x, y] = toScr(overlay.hud.x, overlay.hud.y); const t = overlay.hud.text, w = t.length * 6.6 + 16; return <g pointerEvents="none" transform={`translate(${x} ${y + 22})`}><rect x={-w / 2} y={-11} width={w} height={22} rx="6" className="hud-bg" /><text className="hud-t" textAnchor="middle" y="4">{t}</text></g>; })()}
        </g>
      </svg>

      {rulers && !compact && <Rulers view={view} size={size} unit={doc.unit} doc={doc} />}

      {editObj && <InlineEditor key={editObj.id} o={editObj} view={view} fresh={editId.fresh} onChange={(text) => design.commit((s) => ({ ...s, objs: s.objs.map((q) => { if (q.id !== editObj.id) return q; const m = measureText({ ...q, text }); const dw = m.w - q.w; return { ...q, text, w: m.w, h: m.h, x: q.align === 'center' ? q.x - dw / 2 : q.align === 'right' ? q.x - dw : q.x }; }) }), 'text-' + editObj.id)}
        onDone={() => { const cur = objsRef.current.find((q) => q.id === editObj.id); if (cur && !String(cur.text).trim()) { design.commit((s) => ({ ...s, objs: s.objs.filter((q) => q.id !== cur.id) })); setSel([]); } setEditId(null); wrap.current?.focus({ preventScroll: true }); }} />}

      {objs.length === 0 && <div className="empty-hint"><b>Boş tuval</b><span>{compact ? 'Alttaki araçlardan birini seçip tuvale dokunun.' : 'Soldaki araçlardan birini seçip tuvale tıklayın ya da sürükleyin. Görselleri sürükleyip bırakabilir veya yapıştırabilirsiniz.'}</span></div>}
    </div>
  );
});

const ObjectsLayer = React.memo(function ObjectsLayer({ objs, hideId }) {
  return objs.filter((o) => !o.hidden && o.id !== hideId).map((o) => (
    <g key={o.id} data-oid={o.id}>
      <Shape o={o} />
      {o.type === 'line' && <line x1={o.x} y1={o.y} x2={o.x + o.w} y2={o.y} stroke="transparent" strokeWidth={Math.max(3, (o.strokeWidth || 1) * PT + 3)} transform={o.rotation ? `rotate(${o.rotation} ${o.x + o.w / 2} ${o.y})` : undefined} />}
      {o.type === 'text' && <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="transparent" transform={o.rotation ? `rotate(${o.rotation} ${o.x + o.w / 2} ${o.y + o.h / 2})` : undefined} />}
    </g>
  ));
});

function HandleLayer({ o, view, hs, hitR, touch }) {
  const a = rad(o.rotation || 0), c = Math.cos(a), s = Math.sin(a), cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  const pos = (hx, hy) => [(cx + ((hx * o.w) / 2) * c - ((hy * o.h) / 2) * s) * view.z + view.x, (cy + ((hx * o.w) / 2) * s + ((hy * o.h) / 2) * c) * view.z + view.y];
  const cur = (k) => { const [hx, hy] = HANDLES[k]; const ang = deg(Math.atan2(hy, hx)) + (o.rotation || 0); const i = (((Math.round(ang / 45) % 4) + 4) % 4); return CURSOR[i]; };
  const top = pos(0, -1), off = touch ? 34 : 26;
  const rot = [top[0] + Math.sin(a) * off, top[1] - Math.cos(a) * off];
  return (
    <g>
      {o.type !== 'line' && <line x1={top[0]} y1={top[1]} x2={rot[0]} y2={rot[1]} className="rotline" pointerEvents="none" />}
      {handlesFor(o).map((k) => { const [x, y] = pos(...HANDLES[k]); return (
        <g key={k} data-handle={k} style={{ cursor: cur(k) }}><circle cx={x} cy={y} r={hitR} fill="transparent" /><rect className="handle" x={x - hs / 2} y={y - hs / 2} width={hs} height={hs} rx="2.5" /></g>
      ); })}
      {o.type !== 'line' && <g data-handle="rot" style={{ cursor: 'grab' }}><circle cx={rot[0]} cy={rot[1]} r={hitR} fill="transparent" /><circle className="handle rot" cx={rot[0]} cy={rot[1]} r={hs / 2 + 1} /></g>}
    </g>
  );
}

function InlineEditor({ o, view, onChange, onDone, fresh }) {
  const ta = useRef(null);
  useEffect(() => { ta.current?.focus(); if (fresh) ta.current?.select(); else { const n = ta.current.value.length; ta.current.setSelectionRange(n, n); } }, []); // eslint-disable-line
  const fs = o.fontSize * PT * view.z, st = effStyle(o);
  const left = o.x * view.z + view.x, top = o.y * view.z + view.y;
  return (
    <textarea ref={ta} className="inline-edit" value={o.text} spellCheck={false} autoCapitalize="off" rows={String(o.text).split('\n').length}
      onChange={(e) => onChange(e.target.value)} onBlur={onDone}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); ta.current.blur(); } }}
      style={{ left, top, width: Math.max(o.w * view.z + fs * 0.6, 24), height: o.h * view.z + 2, fontFamily: cssFontFamily(o.fontFamily), fontSize: fs, fontWeight: st.bold ? 700 : 400, fontStyle: st.italic ? 'italic' : 'normal', lineHeight: `${o.lineHeight * fs}px`, textAlign: o.align, letterSpacing: `${(o.letterSpacing || 0) / 100}em`, color: o.fill === 'none' ? 'inherit' : o.fill, transform: `rotate(${o.rotation || 0}deg)`, transformOrigin: '0 0', translate: `0 0` }} />
  );
}

export default Canvas;
