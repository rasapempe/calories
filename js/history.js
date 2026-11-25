/*
 * history.js — month calendar showing calories and sleep together.
 * Each day: outer ring = calories (green within budget, red tip over, grey empty),
 * inner ring = sleep (filled by sleep ÷ goal; green reached, red short, grey not entered).
 * Week column: calories under/over + average sleep. Tapping a day opens it on the Today screen.
 */

import { daySummary, sleepOn, dateKey, todayKey } from './store.js';
import { fmt, dayRingsSVG, fmtSleepShort, MONTHS } from './ui.js';
import { chevron } from './today.js';

const MOON = '<svg viewBox="0 0 24 24" width="9" height="9" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor"/></svg>';

export function renderHistory(el, ctx) {
  const { year, month } = ctx.historyMonth;
  const today = todayKey();
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7)); // Monday on/before the 1st
  const last = new Date(year, month + 1, 0);

  // month totals for the summary card
  const cal = { good: 0, bad: 0, sum: 0, n: 0 };
  const slp = { good: 0, bad: 0, sum: 0, n: 0 };
  let rows = '';
  const cursor = new Date(start);
  while (cursor <= last) {
    let cells = '';
    const wk = { left: 0, calN: 0, sleep: 0, goal: 0, sleepN: 0 };
    for (let i = 0; i < 7; i++) {
      const k = dateKey(cursor);
      const inMonth = cursor.getMonth() === month;
      const future = k > today;
      let ring = '<span class="cal-ring-space"></span>';
      if (!future) {
        const s = daySummary(k);
        const sl = sleepOn(k);
        ring = dayRingsSVG(s, sl, 38);
        if (s.hasFood) {
          wk.left += s.left; wk.calN++;
          if (inMonth) { if (s.status === 'under') cal.good++; else cal.bad++; cal.sum += s.eaten; cal.n++; }
        }
        if (sl.min !== null) {
          wk.sleep += sl.min; wk.goal += sl.goal; wk.sleepN++;
          if (inMonth) { if (sl.status === 'good') slp.good++; else slp.bad++; slp.sum += sl.min; slp.n++; }
        }
      }
      cells += `
        <button class="cal-day ${inMonth ? '' : 'other'} ${k === today ? 'is-today' : ''}"
          data-day="${k}" ${future ? 'disabled' : ''}>
          <span class="cal-num">${cursor.getDate()}</span>
          ${ring}
        </button>`;
      cursor.setDate(cursor.getDate() + 1);
    }
    rows += `<div class="cal-row">${cells}${weekCell(wk)}</div>`;
  }

  el.innerHTML = `
    <header class="topbar">
      <button class="icon-btn" data-act="prev" aria-label="Previous month">${chevron('left')}</button>
      <div class="topbar-title"><div class="t1">${MONTHS[month]}</div><div class="t2">${year}</div></div>
      <button class="icon-btn" data-act="next" aria-label="Next month" ${isCurrentMonth ? 'disabled' : ''}>${chevron('right')}</button>
    </header>
    ${isCurrentMonth ? '' : '<button class="pill" data-act="now">Back to this month</button>'}
    <section class="card cal">
      <div class="cal-row cal-head">
        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span><span>Week</span>
      </div>
      ${rows}
      <div class="cal-legend">Outer ring: calories · Inner ring: sleep</div>
    </section>
    <section class="card month-sum">
      <div class="sum-title">Calories</div>
      <div class="sum-item"><div class="sum-num green">${cal.good}</div><div class="sum-label">green days</div></div>
      <div class="sum-item"><div class="sum-num red">${cal.bad}</div><div class="sum-label">red days</div></div>
      <div class="sum-item"><div class="sum-num">${cal.n ? fmt(cal.sum / cal.n) : '—'}</div><div class="sum-label">avg. kcal a day</div></div>
      <div class="sum-title">Sleep</div>
      <div class="sum-item"><div class="sum-num green">${slp.good}</div><div class="sum-label">nights on goal</div></div>
      <div class="sum-item"><div class="sum-num red">${slp.bad}</div><div class="sum-label">short nights</div></div>
      <div class="sum-item"><div class="sum-num">${slp.n ? fmtSleepShort(slp.sum / slp.n) : '—'}</div><div class="sum-label">avg. a night</div></div>
    </section>
    <p class="footnote">Sleep counts for the morning you woke up. Tap a day to see or change it.</p>
  `;

  el.querySelector('[data-act="prev"]').onclick = () => ctx.setHistoryMonth(year, month - 1);
  el.querySelector('[data-act="next"]').onclick = () => { if (!isCurrentMonth) ctx.setHistoryMonth(year, month + 1); };
  const nowBtn = el.querySelector('[data-act="now"]');
  if (nowBtn) nowBtn.onclick = () => ctx.setHistoryMonth(now.getFullYear(), now.getMonth());
  el.querySelectorAll('[data-day]').forEach((b) => {
    b.onclick = () => ctx.openDay(b.dataset.day);
  });
}

function weekCell(wk) {
  let html = '';
  if (wk.calN) {
    const ok = wk.left >= 0;
    html += `<span class="wk-label ${ok ? 'green' : 'red'}">${ok ? 'UNDER' : 'OVER'}</span>
      <span class="wk-badge ${ok ? 'under' : 'over'}">${fmt(Math.abs(wk.left))}</span>`;
  }
  if (wk.sleepN) {
    const avg = wk.sleep / wk.sleepN;
    const ok = avg >= wk.goal / wk.sleepN;
    html += `<span class="wk-sleep ${ok ? 'green' : 'red'}">${MOON}${fmtSleepShort(avg)}</span>`;
  }
  return `<div class="cal-week">${html}</div>`;
}
