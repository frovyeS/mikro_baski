import React from 'react';

// Uygulama logosu: baskı kesim işaretleri + kaydırılmış sayfa
export function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <rect x="9" y="9" width="14" height="14" rx="1.5" fill="#fff" />
      <path d="M5.5 9H9M9 5.5V9M26.5 23H23M23 26.5V23M23 5.5V9M26.5 9H23M9 26.5V23M5.5 23H9" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12.5 19.5l2.2-5.5 2.2 3.2 1.4-1.8 1.7 4.1z" fill="var(--accent)" />
    </svg>
  );
}

const base = (p) => ({ width: p.size ?? 18, height: p.size ?? 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth ?? 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true });
export const LineIcon = (p) => <svg {...base(p)}><path d="M5 19L19 5" /><circle cx="5" cy="19" r="1.2" fill="currentColor" stroke="none" /><circle cx="19" cy="5" r="1.2" fill="currentColor" stroke="none" /></svg>;
export const CropMarksIcon = (p) => <svg {...base(p)}><path d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14" /></svg>;
export const SwapIcon = (p) => <svg {...base(p)}><path d="M7 4l-3 3 3 3M4 7h11a4 4 0 014 4M17 20l3-3-3-3M20 17H9a4 4 0 01-4-4" /></svg>;
export const BleedIcon = (p) => <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="1.5" strokeDasharray="3 2.5" /><rect x="7" y="7" width="10" height="10" rx="1" /></svg>;
