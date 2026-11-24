/*
 * app.js — starts the app: tab bar, which screen is shown, which day/month, offline support.
 */

import { todayKey, setSaveErrorHandler } from './store.js';
import { toast, closeSheet } from './ui.js';
import { renderToday } from './today.js';
import { renderHistory } from './history.js';
import { renderBody } from './body.js';
import { renderSettings } from './settings.js';

const view = document.getElementById('view');
const now = new Date();

const state = {
  tab: 'today',
  date: todayKey(),
  followToday: true, // the Today screen moves on to the new day after midnight
  historyMonth: { year: now.getFullYear(), month: now.getMonth() },
  bodyRange: '3m',
};

const ctx = {
  get date() { return state.date; },
  get historyMonth() { return state.historyMonth; },
  get bodyRange() { return state.bodyRange; },
  refresh: render,
  goTab: (tab) => showTab(tab),
  currentDay() {
    if (state.followToday && state.date !== todayKey()) state.date = todayKey();
    return state.date;
  },
  setDate(k) {
    state.date = k;
    state.followToday = k === todayKey();
    render();
  },
  openDay(k) {
    state.date = k;
    state.followToday = k === todayKey();
    showTab('today');
  },
  setHistoryMonth(year, month) {
    const d = new Date(year, month, 1);
    state.historyMonth = { year: d.getFullYear(), month: d.getMonth() };
    render();
  },
  setBodyRange(r) {
    state.bodyRange = r;
    render();
  },
};

const screens = { today: renderToday, history: renderHistory, body: renderBody, settings: renderSettings };

function render() {
  if (state.followToday) state.date = todayKey();
  const y = window.scrollY;
  screens[state.tab](view, ctx);
  window.scrollTo(0, y);
}

function showTab(tab) {
  closeSheet();
  if (tab === 'today' && state.tab === 'today' && !state.followToday) {
    state.date = todayKey(); // tapping Today again jumps back to today
    state.followToday = true;
  }
  if (tab === 'history' && state.tab !== 'history' && state.tab === 'today') {
    const d = new Date(state.date.replace(/-/g, '/'));
    state.historyMonth = { year: d.getFullYear(), month: d.getMonth() };
  }
  state.tab = tab;
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  screens[tab](view, ctx);
  window.scrollTo(0, 0);
}

document.querySelectorAll('.tabbar button').forEach((b) => {
  b.addEventListener('click', () => showTab(b.dataset.tab));
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});

setSaveErrorHandler(() => toast('Could not save — phone storage is full'));

showTab('today');

// Ask the phone to keep this app's data even when storage runs low.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// Offline support. When a new version is published, it is downloaded in the background and the
// app reloads itself once; saved data is not touched by this.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
