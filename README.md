# Ledger — Spaced Repetition Flashcards

A small, offline-first PWA for studying **business, economics, and entrepreneurship**
with the **Leitner box system**. No accounts, no backend, no build step — just static
files on GitHub Pages.

**Live:** https://reedahlstrom.github.io/studying/

---

## The mechanic

Cards live in 5 boxes. New cards start in Box 1.

| Box | Reviewed | On correct | On miss |
|-----|----------|-----------|---------|
| 1 | every session | → Box 2 | stays in Box 1 |
| 2 | every 2 days | → Box 3 | → Box 1 |
| 3 | every 4 days | → Box 4 | → Box 1 |
| 4 | every 8 days | → Box 5 | → Box 1 |
| 5 | every 16 days | **mastered** (retires) | → Box 1 |

A session pulls only the cards that are due today and caps the queue at your nightly
target (default 15). Mastered cards leave rotation but stay visible under
**Cards → Mastered**.

## Using it

- **Home** — cards due today, totals, day streak, per-box and per-category breakdown.
- **Study** — one card at a time. Tap/click (or `Space`) to reveal, then *Got it* / *Missed it*.
  On a phone, swipe right = got it, swipe left = missed it. On a keyboard: `1`/`←` miss, `2`/`→` got it.
- **Add** — *One at a time* keeps the form open so you can rip through a Sunday batch (`⌘↵` submits).
  *Bulk paste* takes one card per line:
  ```
  front | back | category
  What is opportunity cost? | The next-best alternative given up. | Market Foundations
  ```
  Category is optional; unknown or missing categories fall back to the dropdown below the box.
  Blank lines and `#` comments are skipped.
- **Cards** — search, filter by category / box / due / mastered, tap any card to edit,
  move it between boxes, or delete it.
- **Settings** — nightly target, "missed cards return this session", JSON export/import, reset.

### Categories

1. Market Foundations
2. Macro & the Economy
3. Financial Literacy
4. Entrepreneurship & Validation
5. Business Models & Strategy
6. Fundraising & Growth

## Install on your phone

Open the live URL in Safari → Share → **Add to Home Screen**. It launches full-screen and
works offline. On desktop Chrome/Edge, use the install icon in the address bar.

## Data

Everything is stored in `localStorage` under the key `ledger.v1`, in that browser only.
It is not synced between your phone and computer. Use **Settings → Export JSON** to back up
and **Import JSON** to merge a backup into another device (imports de-duplicate by front+back).

## Development

No toolchain. Edit the files and serve the folder:

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

| File | What it holds |
|------|---------------|
| `index.html` | markup for all five views |
| `styles.css` | design tokens, dark/light themes, animations |
| `app.js` | state, Leitner scheduling, rendering, session loop |
| `sw.js` | offline cache (bump `VERSION` when shipping changes) |
| `manifest.webmanifest`, `icons/` | PWA install metadata |

Deploying = pushing to `main` with GitHub Pages serving the repo root.
