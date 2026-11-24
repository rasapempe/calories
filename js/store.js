/*
 * store.js — all app data: load/save on the phone, calculations, backup.
 *
 * Data lives in localStorage under one key, as one JSON object:
 *   { schema, settings: {goal, stepBase}, days: {"YYYY-MM-DD": day}, body: [entry], lastBackup }
 *   day   = { food: [{id, kcal, t}], steps: number|null, goal, stepBase }  (goal/base frozen per day)
 *   entry = { id, date: "YYYY-MM-DD", t, weight?, waist?, hips?, chest?, arm?, thigh? }
 *
 * RULE: never drop or rename stored fields. When the format must change, bump SCHEMA and add a
 * step to migrate() that converts old data, so updates never lose anything.
 */

const KEY = 'calorie-tracker-data';
const SCHEMA = 1;

export const DEFAULT_SETTINGS = { goal: 1450, stepBase: 3000 };
export const DEFAULT_WEIGHT = 70;          // kg, used for step calories until a weight is entered
export const KCAL_PER_STEP_PER_KG = 0.0005; // ≈ 35 kcal per 1,000 steps at 70 kg

export const MEASURES = [
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'waist', label: 'Waist', unit: 'cm' },
  { key: 'hips', label: 'Hips', unit: 'cm' },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'arm', label: 'Arm', unit: 'cm' },
  { key: 'thigh', label: 'Thigh', unit: 'cm' },
];

let data = load();

function blank() {
  return { schema: SCHEMA, settings: { ...DEFAULT_SETTINGS }, days: {}, body: [], lastBackup: null };
}

function migrate(d) {
  const out = { ...blank(), ...d };
  out.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}) };
  out.days = d.days && typeof d.days === 'object' ? d.days : {};
  out.body = Array.isArray(d.body) ? d.body : [];
  for (const k of Object.keys(out.days)) {
    const day = out.days[k];
    if (!Array.isArray(day.food)) day.food = [];
    if (day.steps === undefined) day.steps = null;
  }
  // Future format changes go here, e.g. if (out.schema < 2) { ...convert...; out.schema = 2; }
  if (!out.schema || out.schema < SCHEMA) out.schema = SCHEMA;
  return out;
}

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    return migrate(JSON.parse(raw));
  } catch (e) {
    // Never throw away unreadable data: park it under another key before starting fresh.
    try { if (raw) localStorage.setItem(KEY + '-unreadable-' + Date.now(), raw); } catch (_) { /* full */ }
    return blank();
  }
}

let onSaveError = () => {};
export function setSaveErrorHandler(fn) { onSaveError = fn; }

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    onSaveError(e);
  }
}

/* ---------- dates (always local time, never UTC) ---------- */

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(k, n) {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export const todayKey = () => dateKey();

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- settings ---------- */

export function getSettings() { return { ...data.settings }; }

export function setSettings(patch) {
  data.settings = { ...data.settings, ...patch };
  // Today follows the new settings; earlier days keep the goal they had.
  const today = data.days[todayKey()];
  if (today) { today.goal = data.settings.goal; today.stepBase = data.settings.stepBase; }
  save();
}

/* ---------- food and steps ---------- */

function ensureDay(k) {
  if (!data.days[k]) {
    data.days[k] = { food: [], steps: null, goal: data.settings.goal, stepBase: data.settings.stepBase };
  }
  return data.days[k];
}

function dropIfEmpty(k) {
  const day = data.days[k];
  if (day && day.food.length === 0 && (day.steps === null || day.steps === undefined)) delete data.days[k];
}

export function foodList(k) {
  const day = data.days[k];
  return day ? [...day.food] : [];
}

export function addFood(k, kcal) {
  ensureDay(k).food.push({ id: uid(), kcal, t: Date.now() });
  save();
}

/** Removes one food entry; returns what is needed to undo it. */
export function removeFood(k, id) {
  const day = data.days[k];
  if (!day) return null;
  const index = day.food.findIndex((f) => f.id === id);
  if (index < 0) return null;
  const [entry] = day.food.splice(index, 1);
  const snapshot = { goal: day.goal, stepBase: day.stepBase };
  dropIfEmpty(k);
  save();
  return { k, entry, index, snapshot };
}

export function undoRemoveFood(u) {
  if (!u) return;
  const existed = !!data.days[u.k];
  const day = ensureDay(u.k);
  if (!existed) Object.assign(day, u.snapshot);
  day.food.splice(Math.min(u.index, day.food.length), 0, u.entry);
  save();
}

export function setSteps(k, steps) {
  const day = ensureDay(k);
  day.steps = steps;
  dropIfEmpty(k);
  save();
}

/** Latest weight on or before day k; if none, the first weight ever entered; else null. */
export function weightOn(k) {
  const withWeight = sortedBody().filter((e) => typeof e.weight === 'number');
  if (!withWeight.length) return null;
  let best = null;
  for (const e of withWeight) { if (e.date <= k) best = e; }
  return (best || withWeight[0]).weight;
}

export function stepCalories(steps, base, weight) {
  const extra = Math.max(0, (steps || 0) - (base || 0));
  return Math.round(extra * (weight ?? DEFAULT_WEIGHT) * KCAL_PER_STEP_PER_KG);
}

export function daySummary(k) {
  const day = data.days[k];
  const goal = day?.goal ?? data.settings.goal;
  const base = day?.stepBase ?? data.settings.stepBase;
  const eaten = day ? day.food.reduce((s, f) => s + f.kcal, 0) : 0;
  const steps = day?.steps ?? null;
  const weight = weightOn(k);
  const burned = stepCalories(steps, base, weight);
  const budget = goal + burned;
  const hasFood = !!day && day.food.length > 0;
  let status = 'empty';
  if (hasFood) status = eaten <= budget ? 'under' : 'over';
  return { goal, base, eaten, steps, burned, budget, left: budget - eaten, hasFood, status, weightKnown: weight !== null };
}

/* ---------- body measurements ---------- */

function sortedBody() {
  return [...data.body].sort((a, b) => (a.date === b.date ? a.t - b.t : a.date < b.date ? -1 : 1));
}

export function bodyEntries() { return sortedBody(); }

export function latestValue(key) {
  const list = sortedBody().filter((e) => typeof e[key] === 'number');
  return list.length ? list[list.length - 1][key] : null;
}

/**
 * Saves an entry (values = {weight: 68.2, ...}, only filled fields). One entry per date:
 * if another entry already has this date, the new values are merged into it.
 */
export function saveBodyEntry({ id, date, values }) {
  const clean = {};
  for (const m of MEASURES) if (typeof values[m.key] === 'number') clean[m.key] = values[m.key];
  const other = data.body.find((e) => e.date === date && e.id !== id);
  if (id) {
    const idx = data.body.findIndex((e) => e.id === id);
    if (other) {
      Object.assign(other, clean);
      if (idx >= 0) data.body.splice(idx, 1);
    } else if (idx >= 0) {
      const old = data.body[idx];
      data.body[idx] = { id: old.id, t: old.t, date, ...clean };
    }
  } else if (other) {
    Object.assign(other, clean);
  } else {
    data.body.push({ id: uid(), date, t: Date.now(), ...clean });
  }
  save();
}

export function deleteBodyEntry(id) {
  data.body = data.body.filter((e) => e.id !== id);
  save();
}

/* ---------- backup ---------- */

export function lastBackup() { return data.lastBackup; }

export function exportText() {
  return JSON.stringify({ app: 'calorie-tracker', exported: new Date().toISOString(), data }, null, 1);
}

export function markBackedUp() {
  data.lastBackup = Date.now();
  save();
}

/** Reads a backup file's text; returns {data, summary} or throws a readable Error. */
export function parseBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { throw new Error('This file is not a backup from this app.'); }
  const d = obj && obj.data ? obj.data : obj;
  if (!d || typeof d !== 'object' || (!d.days && !d.body)) {
    throw new Error('This file is not a backup from this app.');
  }
  const migrated = migrate(d);
  return {
    data: migrated,
    exported: obj.exported || null,
    days: Object.keys(migrated.days).length,
    entries: migrated.body.length,
  };
}

export function replaceAll(newData) {
  try { localStorage.setItem(KEY + '-before-import', JSON.stringify(data)); } catch (_) { /* full */ }
  data = migrate(newData);
  save();
}
