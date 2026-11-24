/*
 * body.js — the Body screen: weight and measurements, one graph each (1M / 3M / 1Y / All),
 * the list of entries, and the add/edit sheet.
 */

import {
  MEASURES, bodyEntries, saveBodyEntry, deleteBodyEntry, latestValue, todayKey, addDays, parseKey, dateKey,
} from './store.js';
import { fmtDec, fmtDate, fmtShort, openSheet, toast, readNumber } from './ui.js';

const RANGES = [
  { key: '1m', label: '1M', days: 30 },
  { key: '3m', label: '3M', days: 91 },
  { key: '1y', label: '1Y', days: 365 },
  { key: 'all', label: 'All', days: null },
];

export function renderBody(el, ctx) {
  const range = RANGES.find((r) => r.key === ctx.bodyRange) || RANGES[1];
  const today = todayKey();
  const entries = bodyEntries();
  const from = range.days ? addDays(today, -range.days) : (entries[0]?.date || today);

  const charts = MEASURES.map((m) => {
    const pts = entries
      .filter((e) => typeof e[m.key] === 'number' && e.date >= from && e.date <= today)
      .map((e) => ({ date: e.date, v: e[m.key] }));
    const latest = latestValue(m.key);
    let change = '';
    if (pts.length >= 2) {
      const d = pts[pts.length - 1].v - pts[0].v;
      const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
      change = `${sign}${fmtDec(Math.abs(d))} ${m.unit} in this period`;
    } else if (pts.length === 1) {
      change = '1 entry in this period';
    }
    return `
      <section class="card chart-card">
        <div class="chart-head">
          <div class="chart-title">${m.label}</div>
          <div class="chart-latest">${latest === null ? '' : `${fmtDec(latest)} <span class="unit">${m.unit}</span>`}</div>
        </div>
        <div class="chart-change">${change}</div>
        ${pts.length ? chartSVG(pts, from, today, range.days === null) : `<div class="chart-empty">${latest === null ? 'No entries yet' : 'No entries in this period'}</div>`}
      </section>`;
  }).join('');

  const list = [...entries].reverse();
  el.innerHTML = `
    <header class="topbar plain"><div class="topbar-title"><div class="t1">Body</div></div></header>
    <div class="seg" role="tablist">
      ${RANGES.map((r) => `<button class="${r.key === range.key ? 'on' : ''}" data-range="${r.key}">${r.label}</button>`).join('')}
    </div>
    <button class="btn-primary wide" data-act="add">+ Add measurements</button>
    ${charts}
    <h3 class="section-title">All entries</h3>
    <section class="card list">
      ${list.length ? list.map((e) => `
        <button class="row row-btn" data-edit="${e.id}">
          <span class="row-main">${fmtDate(e.date)}</span>
          <span class="row-side">${summaryLine(e)}</span>
        </button>`).join('') : '<div class="empty">No measurements yet.</div>'}
    </section>
  `;

  el.querySelectorAll('[data-range]').forEach((b) => { b.onclick = () => ctx.setBodyRange(b.dataset.range); });
  el.querySelector('[data-act="add"]').onclick = () => editSheet(null, ctx);
  el.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => editSheet(entries.find((e) => e.id === b.dataset.edit), ctx);
  });
}

function summaryLine(e) {
  const parts = [];
  for (const m of MEASURES) {
    if (typeof e[m.key] !== 'number') continue;
    parts.push(m.key === 'weight' ? `${fmtDec(e.weight)} kg` : `${m.label.toLowerCase()} ${fmtDec(e[m.key])}`);
  }
  return parts.join(' · ');
}

function editSheet(entry, ctx) {
  const today = todayKey();
  const fields = MEASURES.map((m) => {
    const val = entry && typeof entry[m.key] === 'number' ? String(entry[m.key]) : '';
    const last = latestValue(m.key);
    return `
      <label class="field">
        <span class="field-label">${m.label}</span>
        <input type="text" inputmode="decimal" data-key="${m.key}" value="${val}"
          placeholder="${last === null ? '' : fmtDec(last)}" autocomplete="off">
        <span class="field-unit">${m.unit}</span>
      </label>`;
  }).join('');

  openSheet(`
    <h2>${entry ? 'Edit measurements' : 'Add measurements'}</h2>
    <label class="field">
      <span class="field-label">Date</span>
      <input type="date" data-date value="${entry ? entry.date : today}" max="${today}">
    </label>
    ${fields}
    <p class="hint">Fill in only what you measured. Grey numbers are your last values.</p>
    <div class="sheet-actions">
      <button type="button" class="btn-secondary" data-close>Cancel</button>
      <button type="button" class="btn-primary" data-save>Save</button>
    </div>
    ${entry ? '<button type="button" class="btn-text danger" data-delete>Delete this entry</button>' : ''}
  `, (sheet, close) => {
    sheet.querySelector('[data-save]').onclick = () => {
      const date = sheet.querySelector('[data-date]').value || today;
      if (date > today) { toast('The date can’t be in the future'); return; }
      const values = {};
      for (const input of sheet.querySelectorAll('[data-key]')) {
        if (!input.value.trim()) continue;
        const n = readNumber(input.value);
        if (n === null || n <= 0 || n >= 1000) {
          toast(`Check the ${input.dataset.key} number`);
          input.focus();
          return;
        }
        values[input.dataset.key] = Math.round(n * 10) / 10;
      }
      if (!Object.keys(values).length) { toast('Fill in at least one number'); return; }
      saveBodyEntry({ id: entry?.id, date, values });
      close();
      ctx.refresh();
      toast('Saved');
    };
    const del = sheet.querySelector('[data-delete]');
    if (del) {
      del.onclick = () => {
        if (!confirm(`Delete the entry from ${fmtDate(entry.date)}?`)) return;
        deleteBodyEntry(entry.id);
        close();
        ctx.refresh();
        toast('Entry deleted');
      };
    }
  });
}

/* ---------- line chart (plain SVG, works offline) ---------- */

function chartSVG(pts, from, to, isAll) {
  const W = 340;
  const H = 150;
  const L = 40;
  const R = 12;
  const T = 12;
  const B = 24;
  const t0 = parseKey(from).getTime();
  let t1 = parseKey(to).getTime();
  if (t1 <= t0) t1 = t0 + 86400000;

  let lo = Math.min(...pts.map((p) => p.v));
  let hi = Math.max(...pts.map((p) => p.v));
  if (hi - lo < 1) { const mid = (hi + lo) / 2; lo = mid - 0.5; hi = mid + 0.5; }
  const pad = (hi - lo) * 0.15;
  lo -= pad;
  hi += pad;

  const x = (k) => L + ((parseKey(k).getTime() - t0) / (t1 - t0)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

  const grid = [hi, (hi + lo) / 2, lo].map((v) => `
    <line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="grid"/>
    <text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" class="axis" text-anchor="end">${fmtDec(v)}</text>`).join('');

  const spanDays = (t1 - t0) / 86400000;
  const withYear = isAll ? spanDays > 300 : spanDays > 200;
  const midK = dateKey(new Date((t0 + t1) / 2));
  const xLabels = `
    <text x="${L}" y="${H - 6}" class="axis" text-anchor="start">${fmtShort(from, withYear)}</text>
    <text x="${(L + W - R) / 2}" y="${H - 6}" class="axis" text-anchor="middle">${fmtShort(midK, withYear)}</text>
    <text x="${W - R}" y="${H - 6}" class="axis" text-anchor="end">${fmtShort(to, withYear)}</text>`;

  const coords = pts.map((p) => [x(p.date), y(p.v)]);
  const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c[0].toFixed(1)} ${c[1].toFixed(1)}`).join('');
  const area = coords.length > 1
    ? `<path d="${line}L${coords[coords.length - 1][0].toFixed(1)} ${H - B}L${coords[0][0].toFixed(1)} ${H - B}Z" class="area"/>`
    : '';
  const showDots = coords.length <= 45;
  const dots = coords.map((c, i) => {
    const lastOne = i === coords.length - 1;
    if (!showDots && !lastOne) return '';
    return `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${lastOne ? 4.5 : 3}" class="${lastOne ? 'dot last' : 'dot'}"/>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    ${grid}${xLabels}${area}
    <path d="${line}" class="line"/>
    ${dots}
  </svg>`;
}
