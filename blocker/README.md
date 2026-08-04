# Ledger Gate

A Chrome/Edge extension that blocks entertainment sites until tonight's flashcards are done.

## How it works

Ledger writes a small status object to its own `localStorage` every time you answer a card:

```json
{ "day": "2026-08-03", "due": 437, "reviewed": 3, "target": 15, "remaining": 12, "done": false }
```

A content script — which runs *only* on the Ledger page — forwards that to the extension.
While `done` is false, `declarativeNetRequest` redirects the blocked domains to a
"first things first" page before they load. When you hit your nightly target, the rules
are removed and the sites work normally until midnight.

**It fails closed.** No status, a status from yesterday, or cleared app data all count as
"not done" — otherwise wiping the app's storage would be an accidental skeleton key.

## Install (one minute, one time)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and choose this `blocker` folder
4. Open Ledger once so it can report in — the badge dot clears when you're done for the day

Pin it to the toolbar to see progress at a glance.

## Blocked by default

`youtube.com` · `instagram.com` · `tiktok.com` · `reddit.com` · `netflix.com` · `twitch.tv`
· `x.com` · `twitter.com` · `facebook.com` · `hulu.com` · `disneyplus.com` · `primevideo.com`

Edit the list from the extension's popup → **Edit blocked sites**. Subdomains are covered
automatically, so `youtube.com` also catches `m.youtube.com`.

## What this does not do

- **It does not cover your phone.** A browser extension can't run on iOS. See the Screen Time
  notes in the main README.
- **It is a speed bump, not a prison.** You can disable the extension in two clicks, or open
  a different browser. That is deliberate — the point is to make the lazy path the study path.
  If you want it harder to escape, have someone else set a Chrome policy, or use a separate
  browser profile you don't administer.
- **It only sees Ledger when a Ledger tab is open.** Finishing a session updates it within a
  few seconds. If you study on your phone, the desktop extension won't know until you open
  Ledger on the desktop.

## Permissions, and why

| Permission | Why |
|---|---|
| `declarativeNetRequest` | The redirect itself. Rules are evaluated by Chrome, not by reading your traffic. |
| `storage` | Remembers your site list and the day's status. |
| `alarms` | Re-locks at the date rollover if the browser stays open overnight. |
| `host_permissions: <all_urls>` | Chrome requires host access to redirect a domain, and your block list is editable, so the set isn't known in advance. |
| Content script on `reedahlstrom.github.io/studying/*` | Reads *only* Ledger's own status key. It runs nowhere else. |

Nothing leaves your machine. There is no server and no analytics.
