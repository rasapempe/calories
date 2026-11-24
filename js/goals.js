/*
 * goals.js — weight goals: overall (start → goal weight), this week (Mon–Sun) and this month.
 * Calculates progress from the weight entries and draws the bars: week + month on Today, overall on Body.
 *
 * Week/month progress = last weight before the period started → latest weight in the period
 * (if there is no weight before it, the first weight inside the period is the starting point).
 */

import { getSettings, bodyEntries, todayKey, dateKey, parseKey } from './store.js';
import { fmtDec } from './ui.js';

function weekStart(k) {
  const d = parseKey(k);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateKey(d);
}

const monthStart = (k) => `${k.slice(0, 8)}01`;

function periodChange(list, from) {
  const before = list.filter((e) => e.date < from);
  const inside = list.filter((e) => e.date >= from);
  if (!inside.length) return null;
  const base = before.length ? before[before.length - 1].weight : inside[0].weight;
  return { base, now: inside[inside.length - 1].weight };
}

/** All goal numbers; `lose` is false only when the goal weight is above the starting weight. */
export function goalProgress() {
  const s = getSettings();
  const list = bodyEntries().filter((e) => typeof e.weight === 'number');
  const current = list.length ? list[list.length - 1].weight : null;
  const hasOverall = s.goalWeight != null && s.goalStartWeight != null;
  const lose = !(hasOverall && s.goalWeight > s.goalStartWeight);
  const dir = lose ? 1 : -1; // progress = dir × (start − now)
  const out = { lose, overall: null, week: null, month: null };

  if (hasOverall) {
    out.overall = {
      total: Math.abs(s.goalStartWeight - s.goalWeight),
      done: current === null ? null : dir * (s.goalStartWeight - current),
      current,
      target: s.goalWeight,
    };
  }
  const t = todayKey();
  const periods = [['week', s.weeklyKg, weekStart(t)], ['month', s.monthlyKg, monthStart(t)]];
  for (const [key, amount, from] of periods) {
    if (!amount) continue;
    const ch = periodChange(list, from);
    out[key] = ch
      ? { total: amount, done: dir * (ch.base - ch.now), change: ch.now - ch.base }
      : { total: amount, done: null, change: null };
  }
  out.any = !!(out.overall || out.week || out.month);
  return out;
}

const kg = (n) => `${fmtDec(Math.abs(n))} kg`;
const signed = (n) => `${n > 0 ? '+' : '−'}${kg(n)}`;

function bar(label, pct, reached, text, textClass = '') {
  const w = Math.max(0, Math.min(1, pct)) * 100;
  return `
    <div class="goal">
      <div class="goal-top">
        <span class="goal-label">${label}</span>
        <span class="goal-pct ${reached ? 'green' : ''}">${reached ? 'Reached' : `${Math.round(w)}%`}</span>
      </div>
      <div class="goal-bar"><div class="goal-fill ${reached ? 'done' : ''}" style="width:${w.toFixed(1)}%"></div></div>
      <div class="goal-text ${textClass}">${text}</div>
    </div>`;
}

function periodBar(label, p, verb, word) {
  if (p.done === null) return bar(label, 0, false, `Add your weight in Body to see this ${word}`, 'muted');
  if (p.done < 0 || (p.done === 0 && p.change !== 0)) {
    return bar(label, 0, false, `${signed(p.change)} this ${word}`, 'red');
  }
  const reached = p.done >= p.total - 1e-9;
  return bar(label, p.done / p.total, reached, `${kg(p.done)} of ${kg(p.total)} ${verb}`);
}

const setLink = (text) =>
  `<button class="card goals-empty" data-act="set-goals">${text} <span aria-hidden="true">›</span></button>`;

/** Weekly and monthly bars, under "Add calories" on the Today screen. */
export function shortGoalsCard(p) {
  if (!p.week && !p.month) return p.any ? '' : setLink('Set weight goals');
  const verb = p.lose ? 'lost' : 'gained';
  let html = '';
  if (p.week) html += periodBar('This week', p.week, verb, 'week');
  if (p.month) html += periodBar('This month', p.month, verb, 'month');
  return `<section class="card goals">${html}</section>`;
}

/** The long-term goal bar (start weight → goal weight), on the Body screen. */
export function overallGoalCard(p) {
  if (!p.overall) return setLink('Set a goal weight');
  const o = p.overall;
  const verb = p.lose ? 'lost' : 'gained';
  let html;
  if (o.done === null) {
    html = bar('Goal weight', 0, false, 'Add your weight to see your progress', 'muted');
  } else if (o.done < 0) {
    html = bar('Goal weight', 0, false,
      `${kg(o.current)} — ${kg(o.done)} ${p.lose ? 'above' : 'below'} your start · goal ${kg(o.target)}`, 'red');
  } else {
    const reached = o.total === 0 || o.done >= o.total - 1e-9;
    html = bar('Goal weight', o.total ? o.done / o.total : 1, reached,
      reached ? `Goal weight ${kg(o.target)} reached`
        : `${kg(o.done)} of ${kg(o.total)} ${verb} · now ${kg(o.current)}, goal ${kg(o.target)}`);
  }
  return `<section class="card goals">${html}</section>`;
}
