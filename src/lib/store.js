import { useCallback, useRef, useState } from 'react';

// Belge durumu + geri al/ileri al geçmişi.
// commit: geçmişe yazar (aynı anahtar kısa sürede birleşir: kaydırıcı, yazı yazma).
// live + begin/end: sürükleme gibi sürekli işlemler tek geçmiş adımı olur.
export function useDesign(initial) {
  const [state, setState] = useState(initial);
  const ref = useRef(state);
  const past = useRef([]), future = useRef([]), last = useRef({ key: null, t: 0 }), tx = useRef(null);
  const [, bump] = useState(0);
  const rerender = () => bump((n) => n + 1);

  const set = (next) => { ref.current = next; setState(next); };

  const commit = useCallback((fn, key) => {
    const cur = ref.current, next = fn(cur);
    if (!next || next === cur) return;
    const now = Date.now();
    if (!(key && last.current.key === key && now - last.current.t < 900)) {
      past.current.push(cur);
      if (past.current.length > 120) past.current.shift();
    }
    last.current = { key, t: now };
    future.current = [];
    set(next); rerender();
  }, []);

  const live = useCallback((fn) => { const next = fn(ref.current); if (next && next !== ref.current) set(next); }, []);
  const begin = useCallback(() => { tx.current = ref.current; }, []);
  const end = useCallback(() => {
    const s = tx.current; tx.current = null;
    if (s && s !== ref.current) { past.current.push(s); if (past.current.length > 120) past.current.shift(); future.current = []; last.current = { key: null, t: 0 }; rerender(); }
  }, []);
  const undo = useCallback(() => {
    const p = past.current.pop(); if (!p) return;
    future.current.push(ref.current); last.current = { key: null, t: 0 }; set(p); rerender();
  }, []);
  const redo = useCallback(() => {
    const n = future.current.pop(); if (!n) return;
    past.current.push(ref.current); last.current = { key: null, t: 0 }; set(n); rerender();
  }, []);
  const reset = useCallback((s) => { past.current = []; future.current = []; last.current = { key: null, t: 0 }; set(s); rerender(); }, []);

  return { state, ref, commit, live, begin, end, undo, redo, reset, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
