# CLAUDE.md — Calories app

Personal calorie, steps, weight and measurements tracker for an iPhone. The owner does not code:
explain in plain words and keep answers short.

**What it is:** an installable web app (PWA), plain HTML/CSS/JS, no build step, no libraries.
Hosted free on GitHub Pages: https://rasapempe.github.io/calories/ (pushing to `main` publishes).
Installed on the phone from Chrome via Share → Add to Home Screen; always opened from that icon.

**Files:** `index.html`, `styles.css` (always dark), `js/app.js` (tabs, state), `js/store.js`
(all data + calculations), `js/today.js`, `js/history.js`, `js/body.js` (graphs), `js/settings.js`
(goal, step base, backup), `sw.js` (offline), `manifest.webmanifest`, `icons/`.

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
