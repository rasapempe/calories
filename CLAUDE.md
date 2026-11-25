# CLAUDE.md — Calories app

Personal calorie, steps, weight and measurements tracker for an iPhone. The owner does not code:
explain in plain words and keep answers short.

**What it is:** an installable web app (PWA), plain HTML/CSS/JS, no build step, no libraries.
Hosted free on GitHub Pages: https://rasapempe.github.io/calories/ (pushing to `main` publishes).
Installed on the phone from Chrome via Share → Add to Home Screen; always opened from that icon.

**Files:** `index.html`, `styles.css` (always dark), `js/app.js` (tabs, state), `js/store.js`
(all data + calculations), `js/today.js`, `js/history.js`, `js/body.js` (graphs), `js/settings.js`
(goal, step base, weight goals, backup), `js/goals.js` (weight goal bars), `sw.js` (offline), `manifest.webmanifest`, `icons/`.

## Rules

- **Never lose the owner's data.** It lives only on the phone (localStorage key `calorie-tracker-data`).
  Never rename or drop stored fields; for a format change bump `SCHEMA` in `store.js` and add a
  conversion step to `migrate()`. Suggest an Export backup before big changes.
- **Bump `VERSION` in `sw.js` on every change**, and add any new file to its `FILES` list,
  otherwise the phone keeps the old copy.
- Test before pushing: serve the folder (`python3 -m http.server`) and drive it in a 402×874
  phone-sized browser (Playwright); check the console has no errors.
- Pull, commit and push in one go; never force-push. Commits use the GitHub no-reply email
  (repo-local git config), never a personal address — the repo is public.

## How it calculates

- Budget for a day = that day's goal + step calories. Goal and step base are frozen per day
  (changing Settings affects today onward, not earlier days).
- Step calories = max(0, steps − base) × weight kg × 0.0005, weight = latest entry on or before
  that day (70 kg until one exists).
- Day color: green if eaten ≤ budget, red if over, grey if no food entered.
- Sleep: minutes stored on the day you woke up (`day.sleep`), typed in one field ("7.30" = 7 h 30 min,
  "7.5" = 7½ h); adding again replaces it. Colors against that day's sleep goal: green ≥ goal, yellow
  < goal, orange < goal − 1 h, red < goal − 2 h (with the 8 h default: 8 / 7 / 6 h), in History, Today
  and the Body sleep bars.
- Intermittent fasting: yes/no per day (`day.fast`), no hours.
- History calendar: outer ring calories, middle ring sleep, small inner purple ring on fasting days.
- Weight goals: overall = start weight → goal weight; week (Mon–Sun) / month = last weight before the
  period → latest weight in it, against the weekly/monthly kg. Losing unless goal > start.
