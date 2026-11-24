/*
 * settings.js — daily calorie goal, step base number, and backup export/import.
 */

import {
  getSettings, setSettings, exportText, markBackedUp, lastBackup, parseBackup, replaceAll,
  todayKey, dateKey, latestValue, DEFAULT_WEIGHT, KCAL_PER_STEP_PER_KG,
} from './store.js';
import { fmt, fmtDec, fmtDate, toast, readNumber } from './ui.js';

export const APP_VERSION = '1.2';

export function renderSettings(el, ctx) {
  const s = getSettings();
  const lb = lastBackup();
  const latest = latestValue('weight');
  const per1000 = Math.round(1000 * DEFAULT_WEIGHT * KCAL_PER_STEP_PER_KG);

  el.innerHTML = `
    <header class="topbar plain"><div class="topbar-title"><div class="t1">Settings</div></div></header>

    <form class="card form" data-form="goals" autocomplete="off">
      <label class="field">
        <span class="field-label">Daily calorie goal</span>
        <input type="text" inputmode="numeric" pattern="[0-9]*" name="goal" value="${s.goal}">
        <span class="field-unit">kcal</span>
      </label>
      <label class="field">
        <span class="field-label">Steps that don’t count</span>
        <input type="text" inputmode="numeric" pattern="[0-9]*" name="stepBase" value="${s.stepBase}">
        <span class="field-unit">steps</span>
      </label>
      <p class="hint">Only steps above this number add calories to your budget. Every 1,000 extra
        steps ≈ ${per1000} kcal at ${DEFAULT_WEIGHT} kg (the app uses your latest weight).
        Changes apply from today; earlier days keep their goal.</p>
      <button type="submit" class="btn-primary wide">Save</button>
    </form>

    <h3 class="section-title">Weight goals</h3>
    <form class="card form" data-form="weight" autocomplete="off">
      ${weightField('Goal weight', 'goalWeight', s.goalWeight, '')}
      ${weightField('Starting weight', 'goalStartWeight', s.goalStartWeight, latest === null ? '' : fmtDec(latest))}
      ${weightField('Each week', 'weeklyKg', s.weeklyKg, '')}
      ${weightField('Each month', 'monthlyKg', s.monthlyKg, '')}
      <p class="hint">“Each week” (Monday–Sunday) and “Each month” are how much you want to lose
        — or gain, if your goal is above your starting weight. Leave a field empty to hide its bar.
        An empty starting weight is filled in with your latest weight.</p>
      <button type="submit" class="btn-primary wide">Save</button>
    </form>

    <h3 class="section-title">Backup</h3>
    <section class="card">
      <p class="hint top">Your data is stored only on this phone. Export a backup now and then and
        save it to iCloud Drive (“Save to Files”).</p>
      <p class="backup-when">Last backup: <b>${lb ? fmtDate(dateKey(new Date(lb))) : 'never'}</b></p>
      <div class="sheet-actions">
        <button type="button" class="btn-secondary" data-act="import">Import backup</button>
        <button type="button" class="btn-primary" data-act="export">Export backup</button>
      </div>
      <input type="file" accept="application/json,.json,text/plain" data-file hidden>
    </section>

    <p class="footnote">Calories · version ${APP_VERSION}</p>
  `;

  el.querySelector('[data-form="goals"]').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    const goal = readNumber(f.goal.value);
    const stepBase = readNumber(f.stepBase.value);
    if (goal === null || goal < 500 || goal > 10000 || !Number.isInteger(goal)) {
      toast('Goal: a whole number between 500 and 10,000'); return;
    }
    if (stepBase === null || stepBase < 0 || stepBase > 50000 || !Number.isInteger(stepBase)) {
      toast('Steps: a whole number between 0 and 50,000'); return;
    }
    setSettings({ goal, stepBase });
    document.activeElement?.blur();
    toast(`Saved: ${fmt(goal)} kcal, ${fmt(stepBase)} steps`);
  };

  el.querySelector('[data-form="weight"]').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    const read = (name, min, max, label) => {
      const raw = f[name].value.trim();
      if (!raw) return { v: null };
      const n = readNumber(raw);
      if (n === null || n < min || n > max) { toast(`${label}: a number between ${min} and ${max}`); return null; }
      return { v: Math.round(n * 10) / 10 };
    };
    const goalW = read('goalWeight', 20, 400, 'Goal weight');
    const startW = read('goalStartWeight', 20, 400, 'Starting weight');
    const weekly = read('weeklyKg', 0.1, 5, 'Each week');
    const monthly = read('monthlyKg', 0.1, 20, 'Each month');
    if (!goalW || !startW || !weekly || !monthly) return;

    let start = startW.v;
    if (goalW.v !== null && start === null) start = latest;
    if (goalW.v !== null && start === null) { toast('Add your starting weight'); return; }
    if (goalW.v === null) start = null;
    const startDate = start === null ? null : (start === s.goalStartWeight && s.goalStartDate) || todayKey();

    setSettings({
      goalWeight: goalW.v, goalStartWeight: start, goalStartDate: startDate,
      weeklyKg: weekly.v, monthlyKg: monthly.v,
    });
    document.activeElement?.blur();
    ctx.refresh();
    toast('Weight goals saved');
  };

  el.querySelector('[data-act="export"]').onclick = () => exportBackup(ctx);
  const file = el.querySelector('[data-file]');
  el.querySelector('[data-act="import"]').onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files[0];
    file.value = '';
    if (!f) return;
    try {
      const b = parseBackup(await f.text());
      const when = b.exported ? ` from ${fmtDate(dateKey(new Date(b.exported)))}` : '';
      const ok = confirm(`Backup${when}: ${b.days} days, ${b.entries} measurement entries.\n\n`
        + 'This REPLACES everything in the app now with the backup. Continue?');
      if (!ok) return;
      replaceAll(b.data);
      ctx.refresh();
      toast('Backup restored');
    } catch (err) {
      toast(err.message || 'Could not read this file');
    }
  };
}

function weightField(label, name, value, placeholder) {
  return `
      <label class="field">
        <span class="field-label">${label}</span>
        <input type="text" inputmode="decimal" name="${name}" value="${value ?? ''}" placeholder="${placeholder}">
        <span class="field-unit">kg</span>
      </label>`;
}

async function exportBackup(ctx) {
  const text = exportText();
  const name = `calories-backup-${todayKey()}.json`;
  const candidates = [
    new File([text], name, { type: 'application/json' }),
    new File([text], name, { type: 'text/plain' }),
  ];
  const file = candidates.find((f) => navigator.canShare && navigator.canShare({ files: [f] }));
  if (file) {
    try {
      await navigator.share({ files: [file], title: name });
      markBackedUp();
      ctx.refresh();
      toast('Backup exported');
    } catch (err) {
      if (err && err.name !== 'AbortError') toast('Export failed, please try again');
    }
    return;
  }
  // Fallback: plain download (computers, older phones).
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  markBackedUp();
  ctx.refresh();
  toast('Backup downloaded');
}
