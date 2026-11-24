/*
 * history.js — month calendar: a ring per day (green within budget, red tip over, grey empty)
 * and a Week column with the week's total under/over. Tapping a day opens it on the Today screen.
 */

import { daySummary, dateKey, todayKey } from './store.js';
import { fmt, ringSVG, MONTHS } from './ui.js';
import { chevron } from './today.js';

export function renderHistory(el, ctx) {
  const { year, month } = ctx.historyMonth;
  const today = todayKey();
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7)); // Monday on/before the 1st
  const last = new Date(year, month + 1, 0);

  let rows = '';
  let under = 0;
  let over = 0;
  let eatenSum = 0;
  let logged = 0;
  const cursor = new Date(start);
  while (cursor <= last) {
    let cells = '';
    let weekDiff = 0;
    let weekLogged = 0;
    for (let i = 0; i < 7; i++) {
      const k = dateKey(cursor);
      const inMonth = cursor.getMonth() === month;
      const future = k > today;
      const s = daySummary(k);
      if (!future && s.hasFood) {
        weekDiff += s.left;
        weekLogged++;
        if (inMonth) {
          if (s.status === 'under') under++; else over++;
          eatenSum += s.eaten;
          logged++;
        }
      }
      cells += `
        <button class="cal-day ${inMonth ? '' : 'other'} ${k === today ? 'is-today' : ''}"
          data-day="${k}" ${future ? 'disabled' : ''}>
          <span class="cal-num">${cursor.getDate()}</span>
          ${future ? '<span class="cal-ring-space"></span>' : ringSVG(s, 34, 4.5)}
        </button>`;
      cursor.setDate(cursor.getDate() + 1);
    }
    let week = '<div class="cal-week"></div>';
    if (weekLogged) {
      const ok = weekDiff >= 0;
      week = `<div class="cal-week ${ok ? 'under' : 'over'}">
        <span class="wk-label">${ok ? 'UNDER' : 'OVER'}</span>
        <span class="wk-badge">${fmt(Math.abs(weekDiff))}</span></div>`;
    }
    rows += `<div class="cal-row">${cells}${week}</div>`;
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
    </section>
    <section class="card month-sum">
      <div class="sum-item"><div class="sum-num green">${under}</div><div class="sum-label">green days</div></div>
      <div class="sum-item"><div class="sum-num red">${over}</div><div class="sum-label">red days</div></div>
      <div class="sum-item"><div class="sum-num">${logged ? fmt(eatenSum / logged) : '—'}</div><div class="sum-label">avg. kcal a day</div></div>
    </section>
    <p class="footnote">Tap a day to see or change it.</p>
  `;

  el.querySelector('[data-act="prev"]').onclick = () => ctx.setHistoryMonth(year, month - 1);
  el.querySelector('[data-act="next"]').onclick = () => { if (!isCurrentMonth) ctx.setHistoryMonth(year, month + 1); };
  const nowBtn = el.querySelector('[data-act="now"]');
  if (nowBtn) nowBtn.onclick = () => ctx.setHistoryMonth(now.getFullYear(), now.getMonth());
  el.querySelectorAll('[data-day]').forEach((b) => {
    b.onclick = () => ctx.openDay(b.dataset.day);
  });
}
