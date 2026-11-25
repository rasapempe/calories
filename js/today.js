/*
 * today.js — the Today screen for one day: budget ring, add calories, add sleep, intermittent
 * fasting (yes/no), steps, list of entries. Also used for earlier days (opened from History or
 * with the arrows).
 */

import {
  daySummary, foodList, addFood, removeFood, undoRemoveFood, setSteps, todayKey, addDays,
  weightOn, stepCalories, DEFAULT_WEIGHT, sleepOn, setSleep, fastOn, setFast,
} from './store.js';
import {
  fmt, fmtDay, fmtTime, ringSVG, openSheet, toast, readNumber, fmtDec, fmtSleep, formatSleepDigits, sleepFromDigits,
} from './ui.js';
import { goalProgress, shortGoalsCard } from './goals.js';

function title(k) {
  const t = todayKey();
  if (k === t) return 'Today';
  if (k === addDays(t, -1)) return 'Yesterday';
  return fmtDay(k).split(',')[0];
}

export function renderToday(el, ctx) {
  const k = ctx.date;
  const isToday = k === todayKey();
  const s = daySummary(k);
  const food = foodList(k).reverse();
  const over = s.left < 0;
  const sl = sleepOn(k);
  const fasted = fastOn(k);

  const budgetNote = s.burned > 0
    ? `<span class="muted">goal ${fmt(s.goal)} + steps ${fmt(s.burned)}</span>`
    : `<span class="muted">daily goal</span>`;

  let stepsSub = 'tap to add';
  if (s.steps !== null) stepsSub = s.burned > 0 ? `+${fmt(s.burned)} kcal` : `under ${fmt(s.base)}`;

  el.innerHTML = `
    <header class="topbar">
      <button class="icon-btn" data-act="prev" aria-label="Previous day">${chevron('left')}</button>
      <div class="topbar-title">
        <div class="t1">${title(k)}</div>
        <div class="t2">${fmtDay(k)}</div>
      </div>
      <button class="icon-btn" data-act="next" aria-label="Next day" ${isToday ? 'disabled' : ''}>${chevron('right')}</button>
    </header>
    ${isToday ? '' : '<button class="pill" data-act="today">Back to today</button>'}

    <section class="card summary">
      <div class="budget-line">Budget <b>${fmt(s.budget)}</b> ${budgetNote}</div>
      <div class="ring-row">
        <div class="stat">
          <div class="stat-label">Eaten</div>
          <div class="stat-num">${fmt(s.eaten)}</div>
          <div class="stat-sub">${food.length === 1 ? '1 entry' : `${food.length} entries`}</div>
        </div>
        <div class="ring-box">
          ${ringSVG({ ...s, hasFood: s.eaten > 0 }, 168, 14)}
          <div class="ring-center">
            <div class="ring-num ${over ? 'red' : 'green'}">${fmt(Math.abs(s.left))}</div>
            <div class="ring-label">${over ? 'over' : 'left'}</div>
          </div>
        </div>
        <button class="stat stat-btn" data-act="steps">
          <div class="stat-label">Steps</div>
          <div class="stat-num">${s.steps === null ? '—' : fmt(s.steps)}</div>
          <div class="stat-sub ${s.steps === null ? 'accent' : ''}">${stepsSub}</div>
        </button>
      </div>
    </section>

    <form class="card add-form" autocomplete="off">
      <input id="kcal" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="Add calories" aria-label="Calories">
      <button type="submit" class="btn-primary">Add</button>
    </form>

    <form class="card add-form sleep-form" autocomplete="off">
      <input id="sleep-in" type="text" inputmode="numeric" placeholder="Add sleep" aria-label="Sleep, hours and minutes">
      <button type="submit" class="btn-primary btn-green">Add</button>
    </form>

    <div class="card add-form fast-form">
      <div class="fake-input ${fasted ? 'on' : ''}">${fasted ? `${checkIcon()} Intermittent fasting` : 'Intermittent fasting'}</div>
      <button type="button" class="${fasted ? 'btn-secondary' : 'btn-primary btn-purple'}" data-act="fast">${fasted ? 'Remove' : 'Add'}</button>
    </div>

    ${isToday ? shortGoalsCard(goalProgress()) : ''}

    <section class="card list">
      ${food.length ? food.map((f) => `
        <div class="row">
          <span class="row-main">${fmt(f.kcal)} <span class="unit">kcal</span></span>
          <span class="row-side">${fmtTime(f.t)}</span>
          <button class="row-del" data-del="${f.id}" aria-label="Delete ${f.kcal} kcal">${xIcon()}</button>
        </div>`).join('') : `<div class="empty">Nothing added ${isToday ? 'yet today' : 'for this day'}.</div>`}
    </section>

    ${sl.min === null ? '' : `
      <section class="card entry-status">
        <span class="${sl.band}">${moonIcon()}</span>
        <span class="entry-text">${isToday ? 'Last night' : 'The night before'}
          <b class="${sl.band}">${fmtSleep(sl.min)}</b> · goal ${fmtSleep(sl.goal)}</span>
        <button type="button" class="row-del" data-act="sleep-del" aria-label="Remove sleep">${xIcon()}</button>
      </section>`}
  `;

  el.querySelector('[data-act="prev"]').onclick = () => ctx.setDate(addDays(k, -1));
  el.querySelector('[data-act="next"]').onclick = () => { if (!isToday) ctx.setDate(addDays(k, 1)); };
  const back = el.querySelector('[data-act="today"]');
  if (back) back.onclick = () => ctx.setDate(todayKey());
  el.querySelector('[data-act="steps"]').onclick = () => stepsSheet(k, s, ctx);
  const setGoals = el.querySelector('[data-act="set-goals"]');
  if (setGoals) setGoals.onclick = () => ctx.goTab('settings');

  const form = el.querySelector('.add-form');
  const input = el.querySelector('#kcal');
  form.onsubmit = (e) => {
    e.preventDefault();
    const n = readNumber(input.value);
    if (n === null || n < 1 || n > 20000 || !Number.isInteger(n)) {
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 400);
      toast('Type the calories as a whole number');
      return;
    }
    const day = ctx.currentDay(); // follows midnight if the app stayed open
    addFood(day, n);
    ctx.refresh();
    toast(`Added ${fmt(n)} kcal`);
    const fresh = document.getElementById('kcal');
    if (fresh) fresh.focus();
  };

  // Sleep: one number per night; adding again replaces it (Undo brings the old one back).
  const sleepForm = el.querySelector('.sleep-form');
  const sleepIn = el.querySelector('#sleep-in');
  // Digits only; the colon appears after the first digit ("730" → 7:30, "1030" → 10:30).
  let sleepDigits = '';
  sleepIn.addEventListener('input', (e) => {
    let d = sleepIn.value.replace(/\D/g, '').slice(0, 4);
    // Backspace right after the automatic colon removes the digit before it too.
    if ((e.inputType || '').startsWith('delete') && d === sleepDigits) d = d.slice(0, -1);
    sleepDigits = d;
    sleepIn.value = formatSleepDigits(d);
  });
  sleepForm.onsubmit = (e) => {
    e.preventDefault();
    const min = sleepFromDigits(sleepIn.value.replace(/\D/g, '').slice(0, 4));
    if (min === null || min < 1 || min > 1440) {
      sleepIn.classList.add('shake');
      setTimeout(() => sleepIn.classList.remove('shake'), 400);
      toast('Type hours and minutes, like 730 for 7:30');
      return;
    }
    const day = ctx.currentDay();
    const before = sleepOn(day).min;
    setSleep(day, min);
    if (document.activeElement) document.activeElement.blur();
    ctx.refresh();
    const undo = () => { setSleep(day, before); ctx.refresh(); };
    if (before === null) toast(`Sleep saved: ${fmtSleep(min)}`, 'Undo', undo);
    else toast(`Sleep changed to ${fmtSleep(min)}`, 'Undo', undo);
  };
  const sleepDel = el.querySelector('[data-act="sleep-del"]');
  if (sleepDel) {
    sleepDel.onclick = () => {
      const before = sl.min;
      setSleep(k, null);
      ctx.refresh();
      toast('Sleep removed', 'Undo', () => { setSleep(k, before); ctx.refresh(); });
    };
  }

  el.querySelector('[data-act="fast"]').onclick = () => {
    const day = fasted ? k : ctx.currentDay();
    setFast(day, !fasted);
    ctx.refresh();
    toast(fasted ? 'Fasting removed' : 'Fasting marked', 'Undo', () => { setFast(day, fasted); ctx.refresh(); });
  };

  el.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => {
      const u = removeFood(k, b.dataset.del);
      ctx.refresh();
      if (u) toast(`Deleted ${fmt(u.entry.kcal)} kcal`, 'Undo', () => { undoRemoveFood(u); ctx.refresh(); });
    };
  });
}

function stepsSheet(k, s, ctx) {
  const weight = weightOn(k);
  openSheet(`
    <h2>Steps</h2>
    <p class="muted">${fmtDay(k)} — copy the number from the Health app</p>
    <input id="steps-input" class="big-input" type="text" inputmode="numeric" pattern="[0-9]*"
      placeholder="Steps" value="${s.steps ?? ''}" autocomplete="off">
    <p class="hint" id="steps-hint"></p>
    <div class="sheet-actions">
      <button type="button" class="btn-secondary" data-close>Cancel</button>
      <button type="button" class="btn-primary" data-save>Save</button>
    </div>
    ${s.steps !== null ? '<button type="button" class="btn-text danger" data-clear>Remove steps</button>' : ''}
  `, (sheet, close) => {
    const input = sheet.querySelector('#steps-input');
    const hint = sheet.querySelector('#steps-hint');
    const weightText = weight === null
      ? `Using ${DEFAULT_WEIGHT} kg until you add your weight in Body.`
      : `Based on your weight, ${fmtDec(weight)} kg.`;
    const update = () => {
      const n = readNumber(input.value) ?? 0;
      const kcal = stepCalories(n, s.base, weight);
      hint.innerHTML = `Only steps above <b>${fmt(s.base)}</b> count.<br>`
        + `${n > s.base ? `${fmt(n - s.base)} extra steps ≈ <b>${fmt(kcal)} kcal</b> added to your budget.<br>` : ''}`
        + weightText;
    };
    update();
    input.addEventListener('input', update);
    setTimeout(() => input.focus(), 50);
    const saveIt = () => {
      const n = readNumber(input.value);
      if (n === null) { setSteps(k, null); close(); ctx.refresh(); return; }
      if (n < 0 || n > 200000 || !Number.isInteger(n)) { toast('Type the steps as a whole number'); return; }
      setSteps(k, n);
      close();
      ctx.refresh();
      toast('Steps saved');
    };
    sheet.querySelector('[data-save]').onclick = saveIt;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveIt(); });
    const clear = sheet.querySelector('[data-clear]');
    if (clear) clear.onclick = () => { setSteps(k, null); close(); ctx.refresh(); toast('Steps removed'); };
  });
}

function moonIcon() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor"/></svg>';
}

function checkIcon() {
  return '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

export function chevron(dir) {
  const d = dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7';
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function xIcon() {
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
}
