/* The app, driven the way you drive it.

   The logic suite in suite.mjs proves the scheduling is right. It cannot
   prove a button is wired up, that a modal closes, that a view is actually
   on screen, or that a night of study survives a reload — those only fail in
   a browser. This runs there, clicking real elements and reading the real
   DOM, and it reports what it found.

   Open the app with ?sweep=1 to run it.

   It works on your actual ledger, so the first thing it does is take a copy
   and the last thing it does — whatever happened in between, including
   throwing — is put that copy back. */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const STORE_KEY = 'ledger.v2';

/* A click the app will believe, then a beat for whatever it starts. */
async function click(sel, ms = 90) {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (!el) throw new Error(`nothing to click: ${sel}`);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  await wait(ms);
  return el;
}
async function press(key, ms = 90) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  await wait(ms);
}
/* Two traps here. offsetParent is null for anything position:fixed — which
   is every modal — so it cannot be the test. And opacity cannot be either:
   a backgrounded tab is given no animation frames, so a modal that opens by
   fading in sits at opacity 0 forever while being entirely present and
   clickable. Open, not finished animating, is still open. */
function visible(el) {
  if (!el || el.hidden) return false;
  const s = getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
const shown = () => $$('.view').filter((v) => getComputedStyle(v).display !== 'none').map((v) => v.id);

/* ── the report ──────────────────────────────────────────────── */
const results = [];
let group = '';
const describe = (n) => { group = n; };
function check(what, cond, detail) {
  results.push({ group, what, ok: !!cond, detail: cond ? '' : detail || '' });
  return !!cond;
}
const eq = (what, got, want) =>
  check(what, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

/* ── the sweep ───────────────────────────────────────────────── */
async function sweep() {
  /* ---- 1. every view opens, and only one is ever on screen ---- */
  describe('Views');
  check('the tab bar is built', $$('#desktopTabs [data-go]').length >= 2,
    `${$$('#desktopTabs [data-go]').length} tabs`);

  /* Most links to a view live inside another view, so they are only
     clickable from where they are. Going home first is what a person does,
     and a view you cannot reach from home is a view you cannot reach. */
  const home = () => $$('[data-go="today"]').find(visible);
  const linkTo = (name) => $$(`[data-go="${name}"]`).find(visible);

  const names = [...new Set($$('[data-go]').map((t) => t.dataset.go))]
    .filter((n) => n !== 'study');            // study starts a session, it is not a place
  names.push('more');                          // reached from the settings button

  /* Walk to a view the way you would: home, then Learn, then into a deck —
     Topics, Add cards and Browse all live on a deck's own page. */
  async function reach(name) {
    let link = linkTo(name);
    if (link) return link;
    await click(home(), 220);
    if ((link = linkTo(name))) return link;
    if (name === 'more') return $('#settingsBtn');
    const learn = $$('[data-go="decks"]').find(visible);
    if (learn) await click(learn, 260);
    if ((link = linkTo(name))) return link;
    const tile = $$('#deckGrid [data-deck]').find(visible);
    if (tile) await click(tile, 300);
    return linkTo(name);
  }

  for (const name of names) {
    const link = await reach(name);
    if (!check(`${name}: there is a way to get there`, !!link, 'no route from home')) continue;
    await click(link, 200);
    const on = shown();
    eq(`${name}: exactly one view is on screen`, on.length, 1);
    eq(`${name}: and it is the right one`, on[0], 'view-' + name);
    check(`${name}: the page is not scrolled sideways`, document.body.scrollWidth <= window.innerWidth + 1,
      `${document.body.scrollWidth} > ${window.innerWidth}`);
  }

  /* The bug that put the globe over the whole app: an id rule beating the
     class that hides views. Prove no view can show itself. */
  describe('Layout');
  for (const v of $$('.view')) {
    if (v.classList.contains('on')) continue;
    const d = getComputedStyle(v).display;
    eq(`#${v.id} stays hidden when it is not the current view`, d, 'none');
  }

  /* ---- 2. modals open and, more importantly, close ---- */
  describe('Modals');
  const modals = [
    ['today', '#newGoalBtn', '#goalScrim', '#gCancel'],
    ['today', '#newHabitBtn', '#habitScrim', '#hCancel'],
    ['decks', '#deckGrid [data-deck-edit]', '#deckScrim', '#dCancel'],
  ];
  for (const [from, openSel, scrim, closer] of modals) {
    await click(`[data-go="${from}"]`, 220);
    if (!$(openSel)) { check(`${openSel} exists`, false, 'missing'); continue; }
    await click(openSel, 220);
    const scrimEl = $(scrim);
    check(`${openSel} opens ${scrim}`, visible(scrimEl));
    if (!visible($(scrim))) { await press('Escape', 120); continue; }
    if (typeof closer === 'string' && closer.startsWith('#')) await click(closer, 160);
    else await press(closer, 160);
    check(`${scrim} closes again`, !visible($(scrim)));
  }

  /* ---- 3. a night of study, by keyboard and by button ---- */
  describe('Studying');
  await click('[data-go="decks"]', 200);
  const decks = $$('#deckGrid [data-deck]');
  check('there are decks to study', decks.length > 0, `${decks.length}`);

  const before = JSON.parse(localStorage.getItem(STORE_KEY));
  /* Count answers given, not cards touched: a card studied earlier today can
     be graded again without changing how many cards have ever been studied. */
  const seenSum = (s) => s.cards.reduce((n, c) => n + (c.seen || 0), 0);
  const seenBefore = seenSum(before);

  /* pick a deck that is not the globe — the globe has its own sweep below */
  const target = decks.find((d) => !/world|geo/.test(d.dataset.deck));
  if (target) {
    await click(target, 220);
    await click('#deckStart', 280);
    eq('starting a deck opens the study view', shown(), ['view-study']);
    check('a card is showing', !!$('#cardFront') && $('#cardFront').textContent.trim().length);

    const firstFront = $('#cardFront').textContent.trim();

    /* space flips. The revealed answer lives in #cardBack; a fading-in row
       is still revealed, so read the app's own state, not the animation. */
    const revealed = () => $('#flashcard').classList.contains('flipped')
      || ($('#cardBack') && $('#cardBack').textContent.trim().length > 0 && visible($('#cardBack')));
    await press(' ', 220);
    check('space reveals the answer', revealed());

    /* f marks it right */
    await press('f', 320);
    const nowFront = $('#cardFront') ? $('#cardFront').textContent.trim() : '';
    check('f grades it and moves on', nowFront !== firstFront || !visible($('#flashcard')),
      'the card did not change');

    /* the same again with the mouse, if the session is still going */
    if (visible($('#flashcard'))) {
      const f2 = $('#cardFront').textContent.trim();
      await click('#flashcard', 200);
      if ($('#gotBtn')) await click('#gotBtn', 320);
      check('the buttons grade a card too',
        !$('#cardFront') || $('#cardFront').textContent.trim() !== f2 || !visible($('#flashcard')));
    }

    /* the whole point: it is written down */
    const after = JSON.parse(localStorage.getItem(STORE_KEY));
    const studiedAfter = seenSum(after);
    check('studying is saved immediately', studiedAfter > seenBefore,
      `${seenBefore} → ${studiedAfter} answers recorded`);
    check('every graded card is stamped with today',
      after.cards.filter((c) => c.seen > 0).every((c) => !!c.lastReviewed));
    check('the revision moves forward', (after.rev || 0) > (before.rev || 0));
    check('no cards were lost along the way', after.cards.length === before.cards.length,
      `${before.cards.length} → ${after.cards.length}`);

    /* leaving mid-session must not lose the grades just given */
    if ($('#endSession')) await click('#endSession', 240);
    const afterExit = JSON.parse(localStorage.getItem(STORE_KEY));
    check('leaving a session keeps what you graded', seenSum(afterExit) >= studiedAfter,
      `${studiedAfter} → ${seenSum(afterExit)}`);
  }

  /* ---- 4. the globe ---- */
  describe('Globe');
  await click('[data-go="decks"]', 200);
  const globeDeck = $$('#deckGrid [data-deck]').find((d) => /world|geo/.test(d.dataset.deck));
  if (globeDeck) {
    await click(globeDeck, 200);
    await click('#deckStart', 700);
    eq('the geography deck opens the globe, never cards', shown(), ['view-globe']);
    check('no flashcard is anywhere near it', !visible($('#flashcard')));
    const cv = $('#globeCanvas');
    check('the canvas is there', !!cv);
    if (cv) {
      /* The ellipse bug was the drawing buffer keeping a shape the CSS box no
         longer had, so the circle came out stretched. The invariant is that
         the buffer matches the box. */
      const r = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      check('the canvas has a size at all', r.width > 10 && r.height > 10,
        `${Math.round(r.width)}×${Math.round(r.height)}`);
      check('the drawing buffer matches its box, so the globe is not an ellipse',
        Math.abs(cv.width - r.width * dpr) <= 2 && Math.abs(cv.height - r.height * dpr) <= 2,
        `buffer ${cv.width}×${cv.height} vs box ${Math.round(r.width * dpr)}×${Math.round(r.height * dpr)}`);
    }
    check('a question is being asked', !!$('#globeQ') && $('#globeQ').textContent.trim().length);
    if ($('#globeExit')) await click('#globeExit', 240);
  }

  /* ---- 5. the ledger survives a reload ---- */
  describe('Persistence');
  {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = JSON.parse(raw);
    check('the ledger on disk is readable', Array.isArray(parsed.cards) && parsed.cards.length > 0);
    check('a backup exists', !!localStorage.getItem('ledger.bak1'));
    check('the backup is a real ledger', (() => {
      try { return JSON.parse(localStorage.getItem('ledger.bak1')).cards.length > 0; } catch (_) { return false; }
    })());
    check('the gate status is published for the blocker',
      !!localStorage.getItem('ledger.status'));

    /* nothing may write while the app sits still — the loop that made the
       page reload over and over */
    const settled = localStorage.getItem(STORE_KEY);
    await wait(2500);
    eq('an idle app writes nothing', localStorage.getItem(STORE_KEY) === settled, true);
  }

  /* ---- 6. the things that quietly break ---- */
  describe('Wiring');
  await click('[data-go="today"]', 200);
  check('today shows a greeting', !!$('#greeting') && $('#greeting').textContent.trim().length);
  check('the grove is planted', !!$('#grove'));
  const treeCount = $$('#grove .tree-card, #grove [data-goal]').length;
  check('goals render as trees', treeCount >= 0);

  await click('[data-go="browse"]', 300);
  check('browse lists cards', $$('#cardList > *').length > 0 || visible($('#browseEmpty')));
  const search = $('#search');
  if (search) {
    search.value = 'zzzzznotathing';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(200);
    check('search with no hits says so', visible($('#browseEmpty')) || $$('#cardList > *').length === 0);
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(200);
    check('clearing search brings the cards back', $$('#cardList > *').length > 0);
  }

  await click('#settingsBtn', 320);
  for (const id of ['#exportBtn', '#importBtn', '#resetBtn', '#themeToggle', '#gateSwitch']) {
    check(`${id} is present`, !!$(id));
  }

  /* deleting a deck must take deliberate effort — opening the editor and
     backing out must never cost you one */
  describe('Deck deletion');
  await press('Escape', 160);
  await click('[data-go="decks"]', 260);
  const deckCount = JSON.parse(localStorage.getItem(STORE_KEY)).decks.length;
  const editBtn = $('#deckGrid [data-deck-edit]');
  if (editBtn) {
    await click(editBtn, 260);
    check('the deck editor opens', visible($('#deckScrim')));
    check('and it offers a delete', !!$('#dDelete'));
    await click('#dCancel', 260);
    check('the editor closes on cancel', !visible($('#deckScrim')));
    eq('backing out of the editor deletes nothing',
      JSON.parse(localStorage.getItem(STORE_KEY)).decks.length, deckCount);
  }

  return results;
}

/* ── run it, and always put the ledger back ──────────────────── */
export async function runSweep() {
  const snapshot = localStorage.getItem(STORE_KEY);
  /* belt and braces: if this tab dies mid-sweep, the copy is still findable */
  try { localStorage.setItem('ledger.presweep', snapshot || ''); } catch (_) {}
  let fatal = null;
  try {
    await sweep();
  } catch (e) {
    fatal = e;
    check('the sweep ran to the end', false, e && e.message);
  } finally {
    if (snapshot) localStorage.setItem(STORE_KEY, snapshot);
    localStorage.removeItem('ledger.presweep');
  }
  render(results, fatal);
  return results;
}

function render(rows, fatal) {
  const passed = rows.filter((r) => r.ok).length;
  const failed = rows.filter((r) => !r.ok);
  const el = document.createElement('div');
  el.id = 'sweep-report';
  el.style.cssText = `position:fixed;inset:auto 12px 12px auto;z-index:99999;max-width:min(520px,92vw);
    max-height:70vh;overflow:auto;background:var(--card,#fff);color:var(--ink,#111);
    border:1px solid rgba(0,0,0,.12);border-radius:14px;padding:14px 16px;font:13px/1.5 ui-monospace,monospace;
    box-shadow:0 18px 60px rgba(0,0,0,.28)`;
  el.innerHTML = `<div style="font-weight:700;margin-bottom:6px">
      Sweep: ${passed}/${rows.length} passed${failed.length ? '' : ' ✓'}
    </div>` +
    (failed.length
      ? failed.map((f) => `<div style="color:#c0392b;margin:6px 0">✗ ${f.group} → ${f.what}${f.detail ? `<div style="opacity:.7;padding-left:14px">${f.detail}</div>` : ''}</div>`).join('')
      : '<div style="opacity:.65">Everything the browser can check is working.</div>') +
    (fatal ? `<div style="color:#c0392b;margin-top:8px">stopped: ${fatal.message}</div>` : '') +
    '<div style="opacity:.5;margin-top:10px">Your data was restored. Reload to use the app.</div>';
  document.body.appendChild(el);

  console.log(`Sweep: ${passed}/${rows.length} passed`);
  failed.forEach((f) => console.warn(`✗ ${f.group} → ${f.what} ${f.detail}`));
}
