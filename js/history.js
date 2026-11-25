/*
 * history.js — month calendar with a Calories | Sleep switch.
 * Calories: a ring per day (green within budget, red tip over, grey empty), Week column under/over.
 * Sleep: a ring per night filled by sleep ÷ goal (green reached, red short) with the hours inside,
 * Week column = average sleep. Tapping a day opens it on the Today screen.
 */

import { daySummary, sleepOn, dateKey, todayKey } from './store.js';
import { fmt, ringSVG, sleepRingSVG, fmtSleepShort, fmtSleep, MONTHS } from './ui.js';
import { chevron } from './today.js';

export function renderHistory(el, ctx) {
  const { year, month } = ctx.historyMonth;
  const sleepMode = ctx.historyMode === 'sleep';
  const today = todayKey();
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7)); // Monday on/before the 1st
  const last = new Date(year, month + 1, 0);

  const m = { good: 0, bad: 0, sum: 0, n: 0 }; // month totals for the summary card
  let rows = '';
  const cursor = new Date(start);
  while (cursor <= last) {
    let cells = '';
    let wSum = 0;
    let wN = 0;
    let wGoal = 0;
    for (let i = 0; i < 7; i++) {
      const k = dateKey(cursor);
      const inMonth = cursor.getMonth() === month;
      const future = k > today;
      let ring = '<span class="cal-ring-space"></span>';
      if (!future && sleepMode) {
        const sl = sleepOn(k);
        ring = sleepRingSVG(sl, 34, 4.5);
        if (sl.min !== null) {
          wSum += sl.min; wN++; wGoal += sl.goal;
          if (inMonth) { if (sl.status === 'good') m.good++; else m.bad++; m.sum += sl.min; m.n++; }
        }
      } else if (!future) {
        const s = daySummary(k);
        ring = ringSVG(s, 34, 4.5);
        if (s.hasFood) {
          wSum += s.left; wN++;
          if (inMonth) { if (s.status === 'under') m.good++; else m.bad++; m.sum += s.eaten; m.n++; }
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
    rows += `<div class="cal-row">${cells}${weekCell(sleepMode, wSum, wN, wGoal)}</div>`;
  }

  const summary = sleepMode
    ? `<div class="sum-item"><div class="sum-num green">${m.good}</div><div class="sum-label">nights on goal</div></div>
       <div class="sum-item"><div class="sum-num red">${m.bad}</div><div class="sum-label">short nights</div></div>
       <div class="sum-item"><div class="sum-num">${m.n ? fmtSleepShort(m.sum / m.n) : '—'}</div><div class="sum-label">avg. a night</div></div>`
    : `<div class="sum-item"><div class="sum-num green">${m.good}</div><div class="sum-label">green days</div></div>
       <div class="sum-item"><div class="sum-num red">${m.bad}</div><div class="sum-label">red days</div></div>
       <div class="sum-item"><div class="sum-num">${m.n ? fmt(m.sum / m.n) : '—'}</div><div class="sum-label">avg. kcal a day</div></div>`;

  el.innerHTML = `
    <header class="topbar">
      <button class="icon-btn" data-act="prev" aria-label="Previous month">${chevron('left')}</button>
      <div class="topbar-title"><div class="t1">${MONTHS[month]}</div><div class="t2">${year}</div></div>
      <button class="icon-btn" data-act="next" aria-label="Next month" ${isCurrentMonth ? 'disabled' : ''}>${chevron('right')}</button>
    </header>
    <div class="seg seg-2" role="tablist">
      <button class="${sleepMode ? '' : 'on'}" data-mode="calories">Calories</button>
      <button class="${sleepMode ? 'on' : ''}" data-mode="sleep">Sleep</button>
    </div>
    ${isCurrentMonth ? '' : '<button class="pill" data-act="now">Back to this month</button>'}
    <section class="card cal">
      <div class="cal-row cal-head">
        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span><span>Week</span>
      </div>
      ${rows}
    </section>
    <section class="card month-sum">${summary}</section>
    <p class="footnote">${sleepMode ? 'Sleep counts for the morning you woke up. ' : ''}Tap a day to see or change it.</p>
  `;

  el.querySelector('[data-act="prev"]').onclick = () => ctx.setHistoryMonth(year, month - 1);
  el.querySelector('[data-act="next"]').onclick = () => { if (!isCurrentMonth) ctx.setHistoryMonth(year, month + 1); };
  const nowBtn = el.querySelector('[data-act="now"]');
  if (nowBtn) nowBtn.onclick = () => ctx.setHistoryMonth(now.getFullYear(), now.getMonth());
  el.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => ctx.setHistoryMode(b.dataset.mode); });
  el.querySelectorAll('[data-day]').forEach((b) => {
    b.onclick = () => ctx.openDay(b.dataset.day);
  });
}

function weekCell(sleepMode, sum, n, goalSum) {
  if (!n) return '<div class="cal-week"></div>';
  if (sleepMode) {
    const avg = sum / n;
    const ok = avg >= goalSum / n;
    return `<div class="cal-week ${ok ? 'under' : 'over'}" title="${fmtSleep(avg)}">
      <span class="wk-label">AVG</span><span class="wk-badge">${fmtSleepShort(avg)}</span></div>`;
  }
  const ok = sum >= 0;
  return `<div class="cal-week ${ok ? 'under' : 'over'}">
    <span class="wk-label">${ok ? 'UNDER' : 'OVER'}</span>
    <span class="wk-badge">${fmt(Math.abs(sum))}</span></div>`;
}
