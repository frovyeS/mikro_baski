// Otomatik kayıt: IndexedDB (büyük görseller için), yedek olarak localStorage.
const DB = 'mikro-baski', STORE = 'kv';
const open = () => new Promise((res, rej) => {
  if (!('indexedDB' in window)) return rej(new Error('no idb'));
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
export async function kvGet(key) {
  try {
    const db = await open();
    return await new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  } catch {
    try { return JSON.parse(localStorage.getItem('mikro-baski-' + key) || 'null') ?? undefined; } catch { return undefined; }
  }
}
export async function kvSet(key, val) {
  try {
    const db = await open();
    await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(val, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    return true;
  } catch {
    try { localStorage.setItem('mikro-baski-' + key, JSON.stringify(val)); return true; } catch { return false; }
  }
}
export function legacyProject() {
  try { return JSON.parse(localStorage.getItem('mikro-baski') || 'null'); } catch { return null; }
}
export const prefGet = (k, d) => { try { const v = localStorage.getItem('mb-pref-' + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
export const prefSet = (k, v) => { try { localStorage.setItem('mb-pref-' + k, JSON.stringify(v)); } catch { /* yoksay */ } };
