/*
 * ui.js — shared screen helpers: number/date formatting, the calorie ring, bottom sheets, toasts.
 */

import { parseKey } from './store.js';

export const fmt = (n) => Math.round(n).toLocaleString('en-US');

export function fmtDec(n) {
  return (Math.round(n * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

/** "Tue, Nov 24" */
export function fmtDay(k) {
  const d = parseKey(k);
  return `${WD[d.getDay()]}, ${MO[d.getMonth()]} ${d.getDate()}`;
}

/** "Nov 24, 2026" */
export function fmtDate(k) {
  const d = parseKey(k);
  return `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "Nov 24" or "Nov '25" style short label for chart axes */
export function fmtShort(k, withYear) {
  const d = parseKey(k);
  return withYear ? `${MO[d.getMonth()]} ’${String(d.getFullYear()).slice(2)}` : `${MO[d.getMonth()]} ${d.getDate()}`;
}

export function fmtTime(t) {
  const d = new Date(t);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Reads a typed number; accepts "68,4" as well as "68.4". Returns null if empty/invalid. */
export function readNumber(str) {
  const s = String(str ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* ---------- calorie ring ---------- */

const ARC = 280;      // degrees of the ring; the gap sits at the bottom
const START = 220;    // 0° = top, clockwise

function point(c, r, deg) {
  const a = (deg * Math.PI) / 180;
  return [c + r * Math.sin(a), c - r * Math.cos(a)];
}

function arcPath(c, r, from, sweep) {
  const [x0, y0] = point(c, r, from);
  const [x1, y1] = point(c, r, from + sweep);
  const large = sweep > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * Ring for a day: green = eaten within budget, red tip = how far over. Grey only = nothing logged.
 * s = daySummary(); size and stroke in px.
 */
export function ringSVG(s, size, stroke) {
  const c = size / 2;
  const r = (size - stroke) / 2;
  const track = `<path d="${arcPath(c, r, START, ARC)}" class="ring-track" stroke-width="${stroke}"/>`;
  let fill = '';
  if (s.hasFood) {
    const budget = Math.max(s.budget, 1);
    if (s.eaten <= budget) {
      const sweep = (ARC * s.eaten) / budget;
      if (sweep > 0.5) fill = `<path d="${arcPath(c, r, START, sweep)}" class="ring-green" stroke-width="${stroke}"/>`;
    } else {
      const green = (ARC * budget) / s.eaten;
      fill = `<path d="${arcPath(c, r, START, ARC)}" class="ring-red" stroke-width="${stroke}"/>`
        + (green > 0.5 ? `<path d="${arcPath(c, r, START, green)}" class="ring-green" stroke-width="${stroke}"/>` : '');
    }
  }
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${track}${fill}</svg>`;
}

/* ---------- bottom sheet ---------- */

let openSheetEl = null;

/** Opens a bottom sheet with the given inner HTML; mount(el, close) wires it up. */
export function openSheet(html, mount) {
  closeSheet();
  const root = document.getElementById('sheet-root');
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog">${html}</div>`;
  root.appendChild(wrap);
  openSheetEl = wrap;
  requestAnimationFrame(() => wrap.classList.add('open'));
  wrap.querySelector('.sheet-backdrop').addEventListener('click', closeSheet);
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeSheet));
  if (mount) mount(wrap.querySelector('.sheet'), closeSheet);
}

export function closeSheet() {
  if (!openSheetEl) return;
  const el = openSheetEl;
  openSheetEl = null;
  if (document.activeElement) document.activeElement.blur();
  el.classList.remove('open');
  setTimeout(() => el.remove(), 250);
}

/* ---------- toast ---------- */

let toastTimer = null;

/** Short message at the bottom; optional action button (e.g. Undo). */
export function toast(msg, action, onAction) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${msg}</span>${action ? `<button type="button">${action}</button>` : ''}`;
  el.hidden = false;
  el.classList.add('show');
  if (action) {
    el.querySelector('button').addEventListener('click', () => { hideToast(); onAction(); }, { once: true });
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 5000 : 2000);
}

function hideToast() {
  const el = document.getElementById('toast');
  el.classList.remove('show');
  setTimeout(() => { if (!el.classList.contains('show')) el.hidden = true; }, 250);
}
