/* ══════════════════════════════════════════════════════════════
   Learn Things Good — spaced repetition across decks.
   No dependencies, no backend. State lives in localStorage.
   ══════════════════════════════════════════════════════════════ */
import { PHASES, PRINCIPLES, CURRICULUM_CARDS } from './curriculum.js';

const STORE_KEY = 'ledger.v2';
const LEGACY_KEY = 'ledger.v1';
const BOX_COUNT = 5;
const INTERVALS = { 1: 0, 2: 2, 3: 4, 4: 8, 5: 16 };
const CURRICULUM_DECK = 'deck-business';
const SEED_VERSION = 3;   // bump whenever curriculum.js gains cards, or installs never see them

const DECK_COLORS = ['#6d8340', '#3f7d78', '#8a5a9e', '#b06a35', '#3f6ba8', '#a8496a', '#7a7f45', '#4a7f4f'];

/* ───────────────────────── dates ───────────────────────── */
const dayKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const keyToDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((keyToDate(b) - keyToDate(a)) / 86400000);

/* ───────────────────────── state ───────────────────────── */
const defaultState = () => ({
  decks: [], cards: [], activeDeck: null,
  settings: { target: 15, theme: 'light', requeue: false, apiKey: '' },
  streak: { count: 0, last: null },
  daily: { day: null, count: 0 },
  seedVersion: 0,
});

/* ── the gate ──────────────────────────────────────────────────
   Published to localStorage on every save so the companion browser
   extension can tell whether tonight's cards are done. The extension
   reads it; nothing here depends on the extension existing.        */
const STATUS_KEY = 'ledger.status';

function todayCount() {
  const d = state.daily || {};
  return d.day === dayKey() ? d.count : 0;
}

function publishStatus() {
  const today = dayKey();
  const due = state.cards.filter((c) => isDue(c, today)).length;
  const reviewed = todayCount();
  const target = state.settings.target;
  try {
    localStorage.setItem(STATUS_KEY, JSON.stringify({
      day: today,
      due,
      reviewed,
      target,
      remaining: Math.max(0, Math.min(due, target - reviewed)),
      done: due === 0 || reviewed >= target,
      updated: new Date().toISOString(),
    }));
  } catch (_) { /* storage full — the gate simply stays shut */ }
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return hydrate(JSON.parse(raw));
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return migrateV1(JSON.parse(legacy));
    return defaultState();
  } catch (e) {
    console.warn('Load failed; starting fresh.', e);
    return defaultState();
  }
}

function hydrate(parsed) {
  const s = { ...defaultState(), ...parsed };
  s.settings = { ...defaultState().settings, ...(parsed.settings || {}) };
  s.streak = { ...defaultState().streak, ...(parsed.streak || {}) };
  s.decks = Array.isArray(parsed.decks) ? parsed.decks : [];
  s.cards = Array.isArray(parsed.cards) ? parsed.cards.map(normalizeCard) : [];
  return s;
}

/* v1 had a single flat pile of business cards. Everything it held becomes the curriculum deck. */
function migrateV1(old) {
  const s = defaultState();
  s.settings = { ...s.settings, ...(old.settings || {}), theme: 'light' };
  s.streak = old.streak || s.streak;
  s.cards = (old.cards || []).map((c) => normalizeCard({ ...c, deckId: CURRICULUM_DECK }));
  return s;
}

function normalizeCard(c) {
  return {
    id: c.id || uid(),
    deckId: c.deckId || CURRICULUM_DECK,
    front: String(c.front || '').trim(),
    back: String(c.back || '').trim(),
    category: (c.category || '').trim(),
    principle: c.principle || null,
    box: Math.min(BOX_COUNT, Math.max(1, Number(c.box) || 1)),
    mastered: !!c.mastered,
    lastReviewed: c.lastReviewed || null,
    created: c.created || new Date().toISOString(),
    seen: Number(c.seen) || 0,
    right: Number(c.right) || 0,
    source: c.source || 'manual',
  };
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); publishStatus(); }
    catch (e) { toast('Could not save — storage is full.', 'bad'); }
  }, 60);
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

/* ───────────────────── leitner scheduling ───────────────────── */
function isDue(card, today = dayKey()) {
  if (card.mastered) return false;
  if (!card.lastReviewed) return true;
  if (card.box <= 1) return true;                      // Box 1 comes up every session
  return daysBetween(card.lastReviewed, today) >= INTERVALS[card.box];
}
function nextDueKey(card) {
  if (card.mastered) return null;
  if (!card.lastReviewed) return dayKey();
  const d = keyToDate(card.lastReviewed);
  d.setDate(d.getDate() + INTERVALS[card.box]);
  return dayKey(d);
}
function grade(card, correct) {
  card.seen += 1;
  card.lastReviewed = dayKey();
  if (correct) {
    card.right += 1;
    if (card.box >= BOX_COUNT) card.mastered = true;   // Box 5 + correct = retired
    else card.box += 1;
  } else card.box = 1;
  save();
}

/* ───────────────────────── helpers ───────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const deckCards = (id = state.activeDeck) => state.cards.filter((c) => c.deckId === id);
const activeDeck = () => state.decks.find((d) => d.id === state.activeDeck) || null;
const isCurriculum = (deck) => deck && deck.kind === 'curriculum';

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2400);
}
const buzz = (ms = 12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} };
const busy = (on, text = 'Thinking…') => { $('#busyText').textContent = text; $('#busy').hidden = !on; };
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ───────────────────────── navigation ───────────────────────── */
const ICONS = {
  decks:  '<path d="M4 7h16v13H4z"/><path d="M7 4h13v13"/>',
  path:   '<path d="M12 21V9"/><path d="M12 12c0-3 2.4-5.5 6-6 0 3.6-2.2 6-6 6z"/><path d="M12 16c0-2.4-1.9-4.4-4.8-4.8 0 2.9 1.8 4.8 4.8 4.8z"/>',
  study:  '<rect x="3" y="7" width="13" height="13" rx="3"/><path d="M8 4h9a3 3 0 0 1 3 3v9"/>',
  add:    '<path d="M12 5v14M5 12h14"/>',
  browse: '<path d="M4 6h16M4 12h16M4 18h11"/>',
};
const TABS = [
  { id: 'decks', label: 'Decks' },
  { id: 'path', label: 'Path' },
  { id: 'study', label: 'Study' },
  { id: 'add', label: 'Add' },
  { id: 'browse', label: 'Cards' },
];
const TAB_FOR_VIEW = { deck: 'decks', more: null };

function buildTabs() {
  const html = TABS.map((t) => `<button data-go="${t.id}" aria-label="${t.label}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[t.id]}</svg><span>${t.label}</span></button>`).join('');
  $('#mobileTabs').innerHTML = html;
  $('#desktopTabs').innerHTML = html;
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
}

let current = 'decks';
function go(view, opts = {}) {
  const needsDeck = ['deck', 'path', 'study', 'add', 'browse'].includes(view);
  if (needsDeck && !activeDeck()) view = 'decks';
  if (view === 'study' && !opts.keepSession) startSession(opts.filter || null);
  if (current === 'study' && view !== 'study') session = null;

  current = view;
  $$('.view').forEach((v) => v.classList.toggle('on', v.dataset.view === view));
  const tab = view in TAB_FOR_VIEW ? TAB_FOR_VIEW[view] : view;
  $$('[data-go]').forEach((b) => b.classList.toggle('on', b.dataset.go === tab));
  if (location.hash.slice(1) !== view) history.replaceState(null, '', '#' + view);
  window.scrollTo({ top: 0, behavior: 'auto' });

  const deck = activeDeck();
  $('#deckPill').hidden = !deck || view === 'decks';
  if (deck) { $('#deckPillName').textContent = deck.name; $('#deckPillDot').style.background = deck.color; }

  if (view === 'decks') renderDecks();
  if (view === 'deck') renderDeck();
  if (view === 'path') renderPath();
  if (view === 'add') renderAdd();
  if (view === 'browse') renderBrowse();
  if (view === 'more') renderSettings();
}

function openDeck(id) { state.activeDeck = id; save(); go('deck'); }

/* ───────────────────────── decks view ───────────────────────── */
function renderDecks() {
  const today = dayKey();
  const dueAll = state.cards.filter((c) => isDue(c, today));
  $('#dueBig').textContent = dueAll.length;
  $('#dueWord').textContent = dueAll.length === 1 ? 'card due' : 'cards due';
  $('#greeting').textContent = greetingText();
  $('#heroSub').textContent = state.decks.length > 1 ? `across ${state.decks.length} decks` : 'ready when you are';

  /* gate status — mirrors what the blocker extension sees */
  const reviewed = todayCount(), target = state.settings.target;
  const done = dueAll.length === 0 || reviewed >= target;
  const gate = $('#gate');
  gate.hidden = false;
  gate.classList.toggle('open', done);
  $('#gateText').textContent = done
    ? `Done for today — ${reviewed} reviewed. The gate is open.`
    : `${Math.max(0, Math.min(dueAll.length, target - reviewed))} more to unlock today · ${reviewed}/${target}`;

  $('#deckGrid').innerHTML = state.decks.map((d, i) => {
    const cards = deckCards(d.id);
    const due = cards.filter((c) => isDue(c, today)).length;
    const mastered = cards.filter((c) => c.mastered).length;
    const pct = cards.length ? Math.round((mastered / cards.length) * 100) : 0;
    return `<button class="deck-card" data-deck="${d.id}" style="--dc:${d.color};animation-delay:${i * 45}ms">
      <div class="deck-top">
        <span class="deck-name">${esc(d.name)}</span>
        <span class="deck-due ${due ? '' : 'zero'}">${due ? due + ' due' : 'clear'}</span>
      </div>
      <div class="deck-meta">${isCurriculum(d) ? '<span class="deck-tag">curriculum</span> · ' : ''}${cards.length} card${cards.length === 1 ? '' : 's'} · ${mastered} mastered · ${pct}%</div>
      <div class="deck-bar"><i style="width:${pct}%;background:linear-gradient(90deg,${d.color},${d.color}bb)"></i></div>
    </button>`;
  }).join('') + `<button class="new-deck" id="newDeckBtn" style="animation-delay:${state.decks.length * 45}ms">
      <span class="plus"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span>
      <span><strong>New deck</strong><em>A class, a language, anything</em></span>
    </button>`;
  $$('#deckGrid [data-deck]').forEach((b) => b.addEventListener('click', () => openDeck(b.dataset.deck)));
  $('#newDeckBtn').addEventListener('click', () => openDeckSheet(null));
}

function greetingText() {
  const h = new Date().getHours();
  if (h < 5) return 'Late night session';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Night owl';
}

/* ───────────────────────── deck view ───────────────────────── */
function renderDeck() {
  const deck = activeDeck(); if (!deck) return;
  const today = dayKey();
  const cards = deckCards(deck.id);
  const due = cards.filter((c) => isDue(c, today));
  const mastered = cards.filter((c) => c.mastered);
  const target = state.settings.target;

  $('#deckKindLabel').textContent = isCurriculum(deck) ? 'Guided curriculum' : 'Deck';
  $('#deckTitle').textContent = deck.name;
  $('#statTotal').textContent = cards.length;
  $('#statMastered').textContent = mastered.length;
  $('#statStreak').textContent = liveStreak();
  $('#quickPathLabel').textContent = isCurriculum(deck) ? 'The path' : 'Topics';

  const btn = $('#deckStart');
  if (!cards.length) {
    $('#deckSub').textContent = 'Empty deck. Add cards, paste a list, or make some from your notes.';
    btn.querySelector('span').textContent = 'Add cards';
    btn.dataset.action = 'add'; btn.disabled = false;
  } else if (!due.length) {
    const next = upcoming(cards);
    $('#deckSub').textContent = next ? `Nothing due. Next review ${next}.` : 'Every card is mastered. 🎉';
    btn.querySelector('span').textContent = 'Study ahead anyway';
    btn.dataset.action = 'ahead';
    btn.disabled = cards.every((c) => c.mastered);
  } else {
    const extra = due.length > target ? ` of ${due.length} due` : '';
    $('#deckSub').textContent = `${Math.min(due.length, target)} card${Math.min(due.length, target) === 1 ? '' : 's'}${extra} waiting tonight.`;
    btn.querySelector('span').textContent = 'Start session';
    btn.dataset.action = 'study'; btn.disabled = false;
  }

  const max = Math.max(1, ...[1, 2, 3, 4, 5].map((b) => cards.filter((c) => !c.mastered && c.box === b).length), mastered.length);
  const rows = [1, 2, 3, 4, 5].map((b) => {
    const inBox = cards.filter((c) => !c.mastered && c.box === b);
    const dueN = inBox.filter((c) => isDue(c, today)).length;
    return `<div class="box-row"><b>Box ${b}</b>
      <div class="bar"><i style="width:${(inBox.length / max) * 100}%"></i></div>
      <span class="n ${dueN ? 'due' : ''}">${inBox.length}${dueN ? ` · ${dueN} due` : ''}</span></div>`;
  });
  rows.push(`<div class="box-row done"><b>Mastered</b>
      <div class="bar"><i style="width:${(mastered.length / max) * 100}%"></i></div>
      <span class="n">${mastered.length}</span></div>`);
  $('#boxes').innerHTML = rows.join('');

  const groups = new Map();
  cards.forEach((c) => {
    const k = c.category || 'Untagged';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  });
  $('#topicHead').textContent = isCurriculum(deck) ? 'By phase' : 'By topic';
  $('#catList').innerHTML = groups.size
    ? [...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([name, list]) => `<div class="cat-row">
        <span class="dot" style="background:${deck.color}"></span>
        <span class="name">${esc(name)}</span>
        <span class="meta">${list.length} · ${list.filter((c) => isDue(c, today)).length} due · ${list.filter((c) => c.mastered).length} mastered</span>
      </div>`).join('')
    : '<p class="hint">Topics appear here once cards are tagged.</p>';
}

function upcoming(cards) {
  const keys = cards.filter((c) => !c.mastered).map(nextDueKey).filter(Boolean).sort();
  if (!keys.length) return null;
  const diff = daysBetween(dayKey(), keys[0]);
  return diff <= 0 ? 'today' : diff === 1 ? 'tomorrow' : `in ${diff} days`;
}
function liveStreak() {
  const { count, last } = state.streak;
  if (!last) return 0;
  return daysBetween(last, dayKey()) <= 1 ? count : 0;
}
function bumpStreak() {
  const today = dayKey();
  const { count, last } = state.streak;
  if (last === today) return;
  state.streak = { count: last && daysBetween(last, today) === 1 ? count + 1 : 1, last: today };
  save();
}

/* ───────────────────────── the path ───────────────────────── */
function renderPath() {
  const deck = activeDeck(); if (!deck) return;
  const cards = deckCards(deck.id);
  const today = dayKey();

  if (!isCurriculum(deck)) {
    $('#pathTitle').textContent = 'Topics';
    $('#pathLede').textContent = 'How this deck breaks down. Tap a topic to study just those cards.';
    const groups = new Map();
    cards.forEach((c) => { const k = c.category || 'Untagged'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); });
    const mastered = cards.filter((c) => c.mastered).length;
    $('#pathProgress').textContent = cards.length ? Math.round((mastered / cards.length) * 100) + '%' : '0%';
    $('#tree').innerHTML = groups.size ? [...groups.entries()].map(([name, list], i) => {
      const m = list.filter((c) => c.mastered).length;
      const due = list.filter((c) => isDue(c, today)).length;
      const pct = Math.round((m / list.length) * 100);
      return `<button class="node ${pct === 100 ? 'done' : m ? 'solid' : list.some((c) => c.seen) ? 'started' : ''}" data-topic="${esc(name)}" style="animation-delay:${i * 40}ms">
        <span class="bead">${pct === 100 ? '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>' : pct + '%'}</span>
        <span>
          <span class="node-title">${esc(name)} ${due ? '<span class="due-dot"></span>' : ''}</span>
          <span class="node-foot"><span class="node-bar"><i style="width:${pct}%"></i></span>
          <span class="node-count">${m}/${list.length} mastered${due ? ` · ${due} due` : ''}</span></span>
        </span></button>`;
    }).join('') : '<p class="empty">No cards yet. Add some and they will group here by topic.</p>';
    $$('#tree [data-topic]').forEach((b) => b.addEventListener('click', () => {
      go('study', { filter: { type: 'category', value: b.dataset.topic } });
    }));
    return;
  }

  $('#pathTitle').textContent = 'The path';
  $('#pathLede').textContent = 'Every idea stands on the ones before it. Tap a node to study just that piece.';
  const masteredAll = cards.filter((c) => c.mastered).length;
  $('#pathProgress').textContent = cards.length ? Math.round((masteredAll / cards.length) * 100) + '%' : '0%';

  let html = '';
  for (const phase of PHASES) {
    const nodes = PRINCIPLES.filter((p) => p.phase === phase.id);
    const phaseCards = cards.filter((c) => nodes.some((n) => n.id === c.principle));
    const pPct = phaseCards.length ? Math.round((phaseCards.filter((c) => c.mastered).length / phaseCards.length) * 100) : 0;
    html += `<div class="phase-head"><h2>${esc(phase.name)}</h2><span class="blurb">${esc(phase.blurb)}</span><span class="pct">${pPct}%</span></div>`;
    html += nodes.map((n, i) => {
      const own = cards.filter((c) => c.principle === n.id);
      const m = own.filter((c) => c.mastered).length;
      const seen = own.filter((c) => c.seen).length;
      const due = own.filter((c) => isDue(c, today)).length;
      const pct = own.length ? Math.round((m / own.length) * 100) : 0;
      const cls = pct === 100 ? 'done' : m ? 'solid' : seen ? 'started' : '';
      const builds = n.builds.map((b) => (PRINCIPLES.find((x) => x.id === b) || {}).title).filter(Boolean);
      return `<button class="node ${cls}" data-node="${n.id}" style="animation-delay:${i * 40}ms">
        <span class="bead">${pct === 100 ? '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>' : pct ? pct + '%' : ''}</span>
        <span>
          <span class="node-title">${esc(n.title)} ${due ? '<span class="due-dot"></span>' : ''}</span>
          <span class="node-idea">${esc(n.idea)}</span>
          ${builds.length ? `<span class="builds">${builds.map((b) => `<span class="b">${esc(b)}</span>`).join('')}</span>` : ''}
          <span class="node-foot"><span class="node-bar"><i style="width:${pct}%"></i></span>
          <span class="node-count">${m}/${own.length} mastered${due ? ` · ${due} due` : ''}</span></span>
        </span></button>`;
    }).join('');
  }
  $('#tree').innerHTML = html;
  $$('#tree [data-node]').forEach((b) => b.addEventListener('click', () => openNode(b.dataset.node)));
}

/* ───────────────────────── principle sheet ───────────────────────── */
let openNodeId = null;
function openNode(id) {
  const n = PRINCIPLES.find((p) => p.id === id); if (!n) return;
  openNodeId = id;
  const phase = PHASES.find((p) => p.id === n.phase);
  const own = deckCards().filter((c) => c.principle === id);
  const m = own.filter((c) => c.mastered).length;
  const due = own.filter((c) => isDue(c)).length;
  const pct = own.length ? Math.round((m / own.length) * 100) : 0;
  $('#nodePhase').textContent = phase.name;
  $('#nodeTitle').textContent = n.title;
  $('#nodeIdea').textContent = n.idea;
  const builds = n.builds.map((b) => (PRINCIPLES.find((x) => x.id === b) || {}).title).filter(Boolean);
  const feeds = PRINCIPLES.filter((p) => p.builds.includes(id)).map((p) => p.title);
  $('#nodeMeta').innerHTML = [
    ...builds.map((b) => `<span class="b">builds on ${esc(b)}</span>`),
    ...feeds.map((f) => `<span class="b">leads to ${esc(f)}</span>`),
  ].join('') || '<span class="b">starting point</span>';
  $('#nodeBar').style.width = pct + '%';
  $('#nodeStats').textContent = `${own.length} cards · ${m} mastered · ${due} due today`;
  $('#nodeStudy').disabled = own.length === 0;
  $('#nodeScrim').hidden = false;
}
const closeNode = () => { $('#nodeScrim').hidden = true; };

/* ───────────────────────── session ───────────────────────── */
let session = null;

function startSession(filter = null, studyAhead = false) {
  const deck = activeDeck(); if (!deck) return;
  const today = dayKey();
  let pool = deckCards(deck.id);
  if (filter && filter.type === 'principle') pool = pool.filter((c) => c.principle === filter.value);
  if (filter && filter.type === 'category') pool = pool.filter((c) => (c.category || 'Untagged') === filter.value);

  let due = pool.filter((c) => isDue(c, today));
  if (!due.length && (studyAhead || filter)) due = pool.filter((c) => !c.mastered);

  const queue = shuffle(due).slice(0, state.settings.target);
  session = { queue, i: 0, right: 0, wrong: 0, revealed: false, requeued: new Set(), filter };
  $('#sessionDone').hidden = true;
  $('#stage').hidden = false;
  $('#answerRow').hidden = false;
  showCard();
}

function showCard() {
  if (!session) return;
  const card = session.queue[session.i];
  if (!card) return finishSession();
  const fc = $('#flashcard'), slot = $('#cardSlot');
  session.revealed = false;
  fc.classList.remove('flipped');
  slot.classList.remove('leave-left', 'leave-right', 'enter');
  $('#answerRow').classList.remove('on');
  $('#cardFront').textContent = card.front;
  $('#cardBack').textContent = card.back;
  const label = card.category || (activeDeck() || {}).name || '';
  $('#cardCat').textContent = label;
  $('#cardCat').hidden = !label;
  $('#cardBox').textContent = `Box ${card.box}`;
  const total = session.queue.length;
  $('#progressText').textContent = `${session.i + 1} / ${total}`;
  $('#progressFill').style.width = `${(session.i / total) * 100}%`;
  void slot.offsetWidth;
  slot.classList.add('enter');
}

function reveal() {
  if (!session || session.revealed) return;
  session.revealed = true;
  $('#flashcard').classList.add('flipped');
  $('#answerRow').classList.add('on');
  buzz(8);
}

function answer(correct) {
  if (!session || !session.revealed) return;
  const card = session.queue[session.i];
  grade(card, correct);
  correct ? session.right++ : session.wrong++;
  bumpStreak();
  const today = dayKey();
  state.daily = state.daily && state.daily.day === today
    ? { day: today, count: state.daily.count + 1 }
    : { day: today, count: 1 };
  buzz(correct ? 10 : 22);
  if (!correct && state.settings.requeue && !session.requeued.has(card.id)) {
    session.requeued.add(card.id);
    session.queue.push(card);
  }
  $('#flashcard').classList.remove('flipped');
  $('#cardSlot').classList.add(correct ? 'leave-right' : 'leave-left');
  $('#answerRow').classList.remove('on');
  setTimeout(() => {
    session.i++;
    $('#progressFill').style.width = `${(session.i / session.queue.length) * 100}%`;
    session.i >= session.queue.length ? finishSession() : showCard();
  }, 320);
}

function finishSession() {
  const answered = session.right + session.wrong;
  $('#stage').hidden = true;
  $('#answerRow').hidden = true;
  $('#sessionDone').hidden = false;
  const pct = answered ? Math.round((session.right / answered) * 100) : 0;
  $('#donePct').textContent = pct + '%';
  const ring = $('#doneRing');
  ring.style.strokeDashoffset = 327;
  requestAnimationFrame(() => { ring.style.strokeDashoffset = 327 - (327 * pct) / 100; });
  const stillDue = deckCards().filter((c) => isDue(c)).length;
  $('#doneSummary').textContent = answered
    ? `${session.right} right · ${session.wrong} missed${stillDue ? ` · ${stillDue} still due in this deck` : ' · deck clear for today'}`
    : 'Nothing was due here — enjoy the night off.';
  $('#doneAgain').hidden = stillDue === 0;
  session = null;
  save();
}

/* ───────────────────────── adding cards ───────────────────────── */
function addCard({ front, back, category = '', principle = null, source = 'manual', deckId = state.activeDeck }) {
  const card = normalizeCard({ front, back, category, principle, source, deckId });
  if (!card.front || !card.back) return null;
  state.cards.unshift(card);
  return card;
}

function existingFronts(deckId = state.activeDeck) {
  return new Set(deckCards(deckId).map((c) => c.front.trim().toLowerCase()));
}

/* front | back | topic  ·  front - back  ·  front: back  ·  front <tab> back */
function parseLines(text) {
  const out = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    let parts = null;
    if (line.includes('|')) parts = line.split('|');
    else if (line.includes('\t')) parts = line.split('\t');
    else if (/\s[–—-]\s/.test(line)) parts = line.split(/\s[–—-]\s/);
    else if (/:\s/.test(line)) { const i = line.indexOf(':'); parts = [line.slice(0, i), line.slice(i + 1)]; }
    if (!parts || parts.length < 2) { out.push({ bad: line }); continue; }
    const [front, back, topic] = parts.map((p) => p.trim());
    if (!front || !back) { out.push({ bad: line }); continue; }
    out.push({ front, back, topic: topic || '' });
  }
  return out;
}

let addedThisRun = 0;

/* ───────────────────── local card generation ───────────────────── */
const STOP = new Set('the a an and or of to in on for is are was were it its that this with as at by from you your they their what how why when which not but if than then more most less least one two into about over under can could should would do does did have has had be been being any all each per only just very much many'.split(' '));

function keyWord(text) {
  const words = text.replace(/[^\w\s'-]/g, ' ').split(/\s+/).filter((w) => w.length > 4 && !STOP.has(w.toLowerCase()));
  return words.sort((a, b) => b.length - a.length)[0] || null;
}

function localGenerate(deck, scope, count) {
  const seen = existingFronts(deck.id);
  const out = [];
  const push = (front, back, category, principle) => {
    const k = front.trim().toLowerCase();
    if (!front || !back || seen.has(k) || out.some((o) => o.front.toLowerCase() === k)) return;
    seen.add(k);
    out.push({ front, back, category: category || '', principle: principle || null, source: 'local' });
  };

  if (isCurriculum(deck)) {
    let nodes = PRINCIPLES;
    if (scope && scope !== 'all') {
      const focus = PRINCIPLES.filter((p) => p.id === scope || p.phase === scope);
      /* one principle rarely yields ten new angles — widen to its neighbours in the tree */
      const near = PRINCIPLES.filter((p) => focus.some((f) => f.builds.includes(p.id) || p.builds.includes(f.id) || p.phase === f.phase));
      nodes = [...focus, ...near.filter((n) => !focus.includes(n))];
    }
    for (const n of shuffle(nodes)) {
      const phase = PHASES.find((p) => p.id === n.phase);
      const cat = phase.name;
      const own = deckCards(deck.id).filter((c) => c.principle === n.id);

      push(`In one line: why does "${n.title.toLowerCase()}" matter?`, n.idea, cat, n.id);
      const kw = keyWord(n.idea);
      if (kw) push(`Fill the blank — ${n.title}: "${n.idea.replace(new RegExp(kw, 'i'), '____')}"`, kw, cat, n.id);
      for (const b of n.builds) {
        const parent = PRINCIPLES.find((p) => p.id === b);
        if (parent) push(`How does "${n.title.toLowerCase()}" build on "${parent.title.toLowerCase()}"?`, `${parent.idea} That is what makes this work: ${n.idea}`, cat, n.id);
      }
      const sibling = PRINCIPLES.filter((p) => p.phase === n.phase && p.id !== n.id)[0];
      if (sibling) push(`What is the difference between "${n.title.toLowerCase()}" and "${sibling.title.toLowerCase()}"?`, `${n.title}: ${n.idea} — ${sibling.title}: ${sibling.idea}`, cat, n.id);
      for (const c of shuffle(own).slice(0, 3)) push(`Which idea is this describing? "${c.back}"`, `${n.title}. (Original question: ${c.front})`, cat, n.id);
      if (out.length >= count) break;
    }
  } else {
    const pool = scope && scope !== 'all' ? deckCards(deck.id).filter((c) => (c.category || 'Untagged') === scope) : deckCards(deck.id);
    for (const c of shuffle(pool)) {
      push(`Which term is this? "${c.back}"`, c.front, c.category, null);
      const kw = keyWord(c.back);
      if (kw) push(`Fill the blank: "${c.back.replace(new RegExp(kw, 'i'), '____')}"`, kw, c.category, null);
      if (out.length >= count) break;
    }
  }
  return out.slice(0, count);
}

/* ───────────────────── Claude generation ───────────────────── */
const STYLE = `House style for every card:
- The answer's first sentence is under 15 words and uses plain, everyday language.
- At most two short sentences total. No preamble, no "it refers to".
- One idea per card. If it needs "and", it is probably two cards.
- Questions are specific enough to have one right answer.
Do not include internal or system XML tags in your response.`;

async function callClaude(prompt, maxTokens = 8000) {
  const key = (state.settings.apiKey || '').trim();
  if (!key) throw new Error('no-key');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-5',
      max_tokens: maxTokens,
      // Thinking is on by default on Opus 5 and shares the max_tokens budget.
      // Card writing does not need it, and turning it off keeps the wait short.
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('bad-key');
    if (res.status === 429) throw new Error('rate-limit');
    throw new Error(`api-${res.status}: ${body.slice(0, 160)}`);
  }
  const data = await res.json();
  return (data.content || []).map((b) => b.text || '').join('');
}

function parseCardJSON(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('no-json');
  const arr = JSON.parse(text.slice(start, end + 1));
  return arr
    .filter((c) => c && typeof c.front === 'string' && typeof c.back === 'string')
    .map((c) => ({ front: c.front.trim(), back: c.back.trim(), category: (c.topic || '').trim(), source: 'ai' }))
    .filter((c) => c.front && c.back);
}

async function aiGenerate(deck, scope, count) {
  const avoid = deckCards(deck.id).slice(0, 120).map((c) => '- ' + c.front).join('\n');
  let context;
  let principle = null;
  if (isCurriculum(deck) && scope && scope !== 'all' && PRINCIPLES.some((p) => p.id === scope)) {
    const n = PRINCIPLES.find((p) => p.id === scope);
    principle = n.id;
    const phase = PHASES.find((p) => p.id === n.phase);
    const parents = n.builds.map((b) => PRINCIPLES.find((p) => p.id === b)).filter(Boolean);
    context = `Subject: ${phase.name}.
Principle: "${n.title}" — ${n.idea}
${parents.length ? `It builds on: ${parents.map((p) => `"${p.title}" (${p.idea})`).join('; ')}` : 'This is a starting principle.'}
Write cards that deepen this principle: applied scenarios, common confusions, and the numbers or rules of thumb a student should recall.`;
  } else {
    const sample = shuffle(deckCards(deck.id)).slice(0, 12).map((c) => `Q: ${c.front}\nA: ${c.back}`).join('\n');
    context = `Deck: "${deck.name}".
${sample ? `Existing cards, for subject matter and level:\n${sample}` : 'The deck is empty; infer the subject from its name.'}
Write cards that fill gaps and extend the same subject at the same level.`;
  }

  const prompt = `You write flashcards for a spaced-repetition app.

${context}

${STYLE}

Do NOT duplicate any of these existing questions:
${avoid || '(none yet)'}

Return ONLY a JSON array of exactly ${count} objects, each {"front": "...", "back": "...", "topic": "..."}. No markdown fence, no commentary.`;

  const text = await callClaude(prompt);
  return parseCardJSON(text).map((c) => ({ ...c, principle }));
}

async function aiFromNotes(deck, notes, count, category) {
  const prompt = `Turn these study notes into flashcards for a spaced-repetition app.

NOTES:
"""
${notes.slice(0, 24000)}
"""

${STYLE}

Cover the testable ideas — definitions, distinctions, causes and effects, formulas, and dates or numbers worth recalling. Skip filler and admin details. If the notes name topics or sections, put the relevant one in "topic".

Return ONLY a JSON array of up to ${count} objects, each {"front": "...", "back": "...", "topic": "..."}. No markdown fence, no commentary.`;
  const text = await callClaude(prompt, 16000);
  return parseCardJSON(text).map((c) => ({ ...c, category: c.category || category || '' }));
}

function apiError(e) {
  const m = String(e.message || e);
  if (m === 'no-key') return 'Add a Claude API key in Settings first.';
  if (m === 'bad-key') return 'That API key was rejected. Check it in Settings.';
  if (m === 'rate-limit') return 'Anthropic is rate-limiting. Wait a moment and retry.';
  if (m === 'no-json') return 'Claude replied in an unexpected shape. Try again.';
  if (m.includes('Failed to fetch')) return 'Network call blocked. Check your connection.';
  return 'Generation failed: ' + m;
}

/* ───────────────────────── review queue ───────────────────────── */
let pending = [];
function openReview(cards, title = 'Review new cards') {
  if (!cards.length) return toast('Nothing new came back.', 'bad');
  const seen = existingFronts();
  pending = cards
    .filter((c) => !seen.has(c.front.trim().toLowerCase()))
    .map((c) => ({ ...c, keep: true }));
  if (!pending.length) return toast('Everything generated was already in the deck.', 'bad');
  $('#reviewTitle').textContent = title;
  renderReview();
  $('#reviewScrim').hidden = false;
}
function renderReview() {
  $('#reviewList').innerHTML = pending.map((c, i) => `<div class="rev ${c.keep ? 'on' : 'off'}" data-i="${i}">
    <div class="q">${esc(c.front)}</div>
    <button class="toggle" aria-label="Keep or discard"><svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg></button>
    <div class="a">${esc(c.back)}</div>
  </div>`).join('');
  $('#reviewCount').textContent = `${pending.filter((c) => c.keep).length} of ${pending.length} kept`;
  $$('#reviewList .rev').forEach((el) => el.addEventListener('click', () => {
    const c = pending[+el.dataset.i];
    c.keep = !c.keep;
    el.classList.toggle('on', c.keep); el.classList.toggle('off', !c.keep);
    $('#reviewCount').textContent = `${pending.filter((x) => x.keep).length} of ${pending.length} kept`;
  }));
}

/* ───────────────────────── add view ───────────────────────── */
function renderAdd() {
  const deck = activeDeck(); if (!deck) return;
  $('#addDeckName').textContent = deck.name;
  const topics = [...new Set(deckCards(deck.id).map((c) => c.category).filter(Boolean))];
  $('#topicList').innerHTML = topics.map((t) => `<option value="${esc(t)}">`).join('');

  const sel = $('#fGenScope');
  if (isCurriculum(deck)) {
    sel.innerHTML = '<option value="all">Anywhere in the curriculum</option>' +
      PHASES.map((ph) => `<optgroup label="${esc(ph.name)}">` +
        PRINCIPLES.filter((p) => p.phase === ph.id).map((p) => `<option value="${p.id}">${esc(p.title)}</option>`).join('') +
        '</optgroup>').join('');
    $('#genLede').textContent = 'Build more cards on any principle in the path — grounded in what it stands on.';
  } else {
    sel.innerHTML = '<option value="all">The whole deck</option>' + topics.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    $('#genLede').textContent = 'Build more cards from what is already in this deck.';
  }
  updateKeyGates();
  requestAnimationFrame(() => { moveThumb($('#addModeSeg'), $('#segThumb')); moveThumb($('#genEngineSeg'), $('#genThumb')); });
}

function updateKeyGates() {
  const hasKey = !!(state.settings.apiKey || '').trim();
  $$('.keyless').forEach((el) => { el.hidden = hasKey; });
  $('#notesBtn').disabled = !hasKey;
  const aiBtn = $('#genEngineSeg [data-engine="ai"]');
  aiBtn.disabled = !hasKey;
  aiBtn.title = hasKey ? '' : 'Add a Claude API key in Settings';
  if (!hasKey && genEngine === 'ai') setEngine('local');
}

function moveThumb(seg, thumb) {
  const active = seg.querySelector('.seg-btn.on');
  if (!active) return;
  thumb.style.width = active.offsetWidth + 'px';
  thumb.style.transform = `translateX(${active.offsetLeft - (seg.classList.contains('small') ? 3 : 4)}px)`;
}

let genEngine = 'local';
function setEngine(e) {
  genEngine = e;
  $$('#genEngineSeg .seg-btn').forEach((b) => b.classList.toggle('on', b.dataset.engine === e));
  moveThumb($('#genEngineSeg'), $('#genThumb'));
  $('#genHint').textContent = e === 'local'
    ? 'Offline mode remixes your existing cards into new angles — reversals, fill-in-the-blanks, and questions that connect two ideas. No key needed.'
    : 'Claude writes genuinely new cards for the focus you picked, grounded in the cards already there. You review each one before it is added.';
}

function setupAdd() {
  const form = $('#addForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const front = $('#fFront').value.trim(), back = $('#fBack').value.trim();
    if (!front || !back) return toast('Front and back are both required.', 'bad');
    addCard({ front, back, category: $('#fCat').value.trim() });
    save(); addedThisRun++;
    $('#addedCount').textContent = `${addedThisRun} added`;
    $('#addedCount').classList.add('on');
    form.classList.remove('flash'); void form.offsetWidth; form.classList.add('flash');
    $('#fFront').value = ''; $('#fBack').value = ''; $('#fFront').focus();
    buzz();
  });
  form.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); } });

  $('#pastePreview').addEventListener('click', () => {
    const parsed = parseLines($('#fPaste').value);
    const ok = parsed.filter((p) => !p.bad);
    if (!ok.length) return toast('No readable lines found yet.', 'bad');
    openReview(ok.map((p) => ({ front: p.front, back: p.back, category: p.topic || $('#fPasteCat').value.trim(), source: 'paste' })), 'Preview import');
  });

  $('#pasteForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const parsed = parseLines($('#fPaste').value);
    const good = parsed.filter((p) => !p.bad);
    const bad = parsed.length - good.length;
    if (!good.length) return toast('No readable lines. Try "term | definition".', 'bad');
    const cat = $('#fPasteCat').value.trim();
    const reverse = $('#pasteReverse').checked;
    let n = 0;
    for (const p of good) {
      if (addCard({ front: p.front, back: p.back, category: p.topic || cat, source: 'paste' })) n++;
      if (reverse && addCard({ front: p.back, back: p.front, category: p.topic || cat, source: 'paste' })) n++;
    }
    save();
    $('#pasteCount').textContent = `${n} imported${bad ? ` · ${bad} line${bad === 1 ? '' : 's'} skipped` : ''}`;
    $('#pasteCount').classList.add('on');
    $('#fPaste').value = '';
    toast(`Imported ${n} card${n === 1 ? '' : 's'}.`, 'good');
    buzz(20);
  });

  $('#notesForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const notes = $('#fNotes').value.trim();
    if (notes.length < 60) return toast('Paste a bit more text to work with.', 'bad');
    busy(true, 'Reading your notes…');
    try {
      const cards = await aiFromNotes(activeDeck(), notes, +$('#fNotesCount').value, $('#fNotesCat').value.trim());
      openReview(cards, 'Cards from your notes');
    } catch (err) { toast(apiError(err), 'bad'); }
    finally { busy(false); }
  });

  $('#genForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const deck = activeDeck();
    const scope = $('#fGenScope').value;
    const count = +$('#fGenCount').value;
    if (genEngine === 'local') {
      const cards = localGenerate(deck, scope, count);
      if (!cards.length) return toast('Nothing new to remix here yet — add a few cards first.', 'bad');
      openReview(cards, 'Generated cards');
    } else {
      busy(true, 'Writing cards…');
      try { openReview(await aiGenerate(deck, scope, count), 'Generated cards'); }
      catch (err) { toast(apiError(err), 'bad'); }
      finally { busy(false); }
    }
  });

  const seg = $('#addModeSeg');
  seg.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn'); if (!btn) return;
    $$('.seg-btn', seg).forEach((b) => b.classList.toggle('on', b === btn));
    const mode = btn.dataset.mode;
    $('#addForm').hidden = mode !== 'one';
    $('#pasteForm').hidden = mode !== 'paste';
    $('#notesForm').hidden = mode !== 'notes';
    $('#genForm').hidden = mode !== 'gen';
    moveThumb(seg, $('#segThumb'));
    if (mode === 'gen') moveThumb($('#genEngineSeg'), $('#genThumb'));
  });
  $('#genEngineSeg').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn'); if (!btn || btn.disabled) return;
    setEngine(btn.dataset.engine);
  });
  new ResizeObserver(() => moveThumb(seg, $('#segThumb'))).observe(seg);

  $('#reviewNone').addEventListener('click', () => { pending = []; $('#reviewScrim').hidden = true; });
  $('#reviewAdd').addEventListener('click', () => {
    const keep = pending.filter((c) => c.keep);
    keep.forEach((c) => addCard({ front: c.front, back: c.back, category: c.category, principle: c.principle, source: c.source || 'ai' }));
    save();
    $('#reviewScrim').hidden = true;
    pending = [];
    toast(`Added ${keep.length} card${keep.length === 1 ? '' : 's'}.`, 'good');
    buzz(20);
    renderAdd();
  });
}

/* ───────────────────────── browse ───────────────────────── */
const filters = { q: '', cat: 'all', box: 'all' };

function renderBrowse() {
  const deck = activeDeck(); if (!deck) return;
  const topics = [...new Set(deckCards(deck.id).map((c) => c.category).filter(Boolean))];
  if (filters.cat !== 'all' && !topics.includes(filters.cat)) filters.cat = 'all';
  $('#catFilter').innerHTML = ['all', ...topics]
    .map((c) => `<button class="chip ${c === filters.cat ? 'on' : ''}" data-cat="${esc(c)}">${c === 'all' ? 'All topics' : esc(c)}</button>`).join('');
  $('#boxFilter').innerHTML = ['all', 1, 2, 3, 4, 5, 'due', 'mastered']
    .map((b) => `<button class="chip ${String(b) === String(filters.box) ? 'on' : ''}" data-box="${b}">${b === 'all' ? 'All boxes' : b === 'due' ? 'Due today' : b === 'mastered' ? 'Mastered' : 'Box ' + b}</button>`).join('');
  renderList();
}

function matches(card) {
  const today = dayKey();
  if (filters.cat !== 'all' && (card.category || '') !== filters.cat) return false;
  if (filters.box === 'mastered' && !card.mastered) return false;
  if (filters.box === 'due' && !isDue(card, today)) return false;
  if (!['all', 'due', 'mastered'].includes(filters.box) && (card.mastered || card.box !== Number(filters.box))) return false;
  if (filters.q && !(card.front + ' ' + card.back).toLowerCase().includes(filters.q)) return false;
  return true;
}

function renderList() {
  const today = dayKey();
  const all = deckCards();
  const list = all.filter(matches);
  $('#browseCount').textContent = `${list.length} of ${all.length}`;
  $('#browseEmpty').hidden = list.length > 0;
  $('#browseEmpty').textContent = all.length ? 'No cards match these filters.' : 'No cards in this deck yet.';
  $('#cardList').innerHTML = list.slice(0, 400).map((c, i) => {
    const due = isDue(c, today);
    const when = c.mastered ? 'retired' : due ? 'due now' : `next ${humanDate(nextDueKey(c))}`;
    return `<article class="mini" data-id="${c.id}" style="animation-delay:${Math.min(i * 20, 320)}ms">
      <div class="q">${esc(c.front)}</div>
      <div class="a">${esc(c.back)}</div>
      <div class="tags">
        ${c.category ? `<span class="tag">${esc(c.category)}</span>` : ''}
        <span class="tag ${c.mastered ? 'mastered' : 'box'}">${c.mastered ? 'Mastered' : 'Box ' + c.box}</span>
        <span class="tag ${due && !c.mastered ? 'due' : ''}">${when}</span>
        ${c.seen ? `<span class="tag">${c.right}/${c.seen}</span>` : ''}
      </div></article>`;
  }).join('');
  if (list.length > 400) $('#cardList').insertAdjacentHTML('beforeend', '<p class="hint" style="text-align:center;padding:12px">Showing the first 400 — narrow the filters to see more.</p>');
}

function humanDate(key) {
  if (!key) return '—';
  const diff = daysBetween(dayKey(), key);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return keyToDate(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function setupBrowse() {
  $('#search').addEventListener('input', (e) => { filters.q = e.target.value.toLowerCase(); renderList(); });
  $('#catFilter').addEventListener('click', (e) => {
    const c = e.target.closest('[data-cat]'); if (!c) return;
    filters.cat = c.dataset.cat;
    $$('#catFilter .chip').forEach((b) => b.classList.toggle('on', b === c));
    renderList();
  });
  $('#boxFilter').addEventListener('click', (e) => {
    const c = e.target.closest('[data-box]'); if (!c) return;
    filters.box = c.dataset.box;
    $$('#boxFilter .chip').forEach((b) => b.classList.toggle('on', b === c));
    renderList();
  });
}

/* ───────────────────────── edit sheet ───────────────────────── */
let editingId = null;
function openEdit(id) {
  const card = state.cards.find((c) => c.id === id); if (!card) return;
  editingId = id;
  $('#eFront').value = card.front;
  $('#eBack').value = card.back;
  $('#eCat').value = card.category || '';
  $('#eBox').innerHTML = [1, 2, 3, 4, 5].map((b) => `<option value="${b}">Box ${b}</option>`).join('') + '<option value="mastered">Mastered</option>';
  $('#eBox').value = card.mastered ? 'mastered' : String(card.box);
  $('#scrim').hidden = false;
  setTimeout(() => $('#eFront').focus(), 200);
}
const closeEdit = () => { $('#scrim').hidden = true; editingId = null; };

function setupModals() {
  $('#eCancel').addEventListener('click', closeEdit);
  $('#scrim').addEventListener('click', (e) => { if (e.target === $('#scrim')) closeEdit(); });
  $('#eSave').addEventListener('click', () => {
    const card = state.cards.find((c) => c.id === editingId); if (!card) return closeEdit();
    const front = $('#eFront').value.trim(), back = $('#eBack').value.trim();
    if (!front || !back) return toast('Front and back are both required.', 'bad');
    card.front = front; card.back = back; card.category = $('#eCat').value.trim();
    if ($('#eBox').value === 'mastered') { card.mastered = true; card.box = BOX_COUNT; }
    else { card.mastered = false; card.box = Number($('#eBox').value); }
    save(); closeEdit(); renderBrowse(); toast('Card updated.', 'good');
  });
  $('#eDelete').addEventListener('click', () => {
    const el = $(`.mini[data-id="${editingId}"]`);
    state.cards = state.cards.filter((c) => c.id !== editingId);
    save(); closeEdit();
    if (el) { el.classList.add('removing'); setTimeout(renderBrowse, 330); } else renderBrowse();
    toast('Card deleted.');
  });
  $('#cardList').addEventListener('click', (e) => {
    const el = e.target.closest('.mini'); if (el) openEdit(el.dataset.id);
  });

  /* deck sheet */
  $('#dCancel').addEventListener('click', () => { $('#deckScrim').hidden = true; });
  $('#deckScrim').addEventListener('click', (e) => { if (e.target === $('#deckScrim')) $('#deckScrim').hidden = true; });
  $('#dSave').addEventListener('click', () => {
    const name = $('#dName').value.trim();
    if (!name) return toast('Give the deck a name.', 'bad');
    const color = $('#dSwatches .swatch.on')?.dataset.color || DECK_COLORS[0];
    if (editingDeck) {
      const d = state.decks.find((x) => x.id === editingDeck);
      if (d) { d.name = name; d.color = color; }
    } else {
      const id = 'deck-' + uid().slice(0, 8);
      state.decks.push({ id, name, color, kind: 'plain', created: new Date().toISOString() });
      state.activeDeck = id;
    }
    save(); $('#deckScrim').hidden = true;
    editingDeck ? go(current === 'decks' ? 'decks' : 'deck') : go('deck');
    toast(editingDeck ? 'Deck updated.' : 'Deck created.', 'good');
  });
  $('#dDelete').addEventListener('click', () => {
    const d = state.decks.find((x) => x.id === editingDeck); if (!d) return;
    const n = deckCards(d.id).length;
    if (!confirm(`Delete "${d.name}" and its ${n} card${n === 1 ? '' : 's'}? This cannot be undone.`)) return;
    state.cards = state.cards.filter((c) => c.deckId !== d.id);
    state.decks = state.decks.filter((x) => x.id !== d.id);
    if (state.activeDeck === d.id) state.activeDeck = state.decks[0]?.id || null;
    save(); $('#deckScrim').hidden = true; go('decks');
    toast('Deck deleted.');
  });

  /* node sheet */
  $('#nodeClose').addEventListener('click', closeNode);
  $('#nodeScrim').addEventListener('click', (e) => { if (e.target === $('#nodeScrim')) closeNode(); });
  $('#nodeStudy').addEventListener('click', () => { closeNode(); go('study', { filter: { type: 'principle', value: openNodeId } }); });
  $('#nodeGenerate').addEventListener('click', () => {
    closeNode(); go('add');
    $('#addModeSeg [data-mode="gen"]').click();
    $('#fGenScope').value = openNodeId;
  });

  $('#reviewScrim').addEventListener('click', (e) => { if (e.target === $('#reviewScrim')) { pending = []; $('#reviewScrim').hidden = true; } });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    ['#scrim', '#deckScrim', '#nodeScrim', '#reviewScrim'].forEach((s) => { if (!$(s).hidden) $(s).hidden = true; });
  });
}

let editingDeck = null;
function openDeckSheet(deckId = null) {
  editingDeck = deckId;
  const d = deckId ? state.decks.find((x) => x.id === deckId) : null;
  $('#deckModalTitle').textContent = d ? 'Edit deck' : 'New deck';
  $('#dName').value = d ? d.name : '';
  $('#dDelete').hidden = !d || isCurriculum(d);
  $('#dSwatches').innerHTML = DECK_COLORS.map((c) => `<button class="swatch ${(d ? d.color : DECK_COLORS[state.decks.length % DECK_COLORS.length]) === c ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="colour"></button>`).join('');
  $$('#dSwatches .swatch').forEach((s) => s.addEventListener('click', () => {
    $$('#dSwatches .swatch').forEach((x) => x.classList.toggle('on', x === s));
  }));
  $('#deckScrim').hidden = false;
  setTimeout(() => $('#dName').focus(), 200);
}

/* ───────────────────────── settings ───────────────────────── */
function renderSettings() {
  $('#targetVal').textContent = state.settings.target;
  $('#requeueSwitch').setAttribute('aria-checked', String(!!state.settings.requeue));
  const key = state.settings.apiKey || '';
  $('#apiKey').value = key;
  $('#keyState').textContent = key ? 'Key saved on this device' : 'No key — offline generation still works';
  $('#keyState').className = 'key-state' + (key ? ' ok' : '');
}

function setupSettings() {
  $('#targetUp').addEventListener('click', () => { state.settings.target = Math.min(100, state.settings.target + 5); save(); renderSettings(); });
  $('#targetDown').addEventListener('click', () => { state.settings.target = Math.max(5, state.settings.target - 5); save(); renderSettings(); });
  $('#requeueSwitch').addEventListener('click', () => { state.settings.requeue = !state.settings.requeue; save(); renderSettings(); });

  $('#keyPeek').addEventListener('click', () => {
    const f = $('#apiKey');
    f.type = f.type === 'password' ? 'text' : 'password';
  });
  $('#keySave').addEventListener('click', () => {
    state.settings.apiKey = $('#apiKey').value.trim();
    save(); renderSettings(); updateKeyGates();
    toast(state.settings.apiKey ? 'Key saved on this device.' : 'Key cleared.', 'good');
  });
  $('#keyClear').addEventListener('click', () => {
    state.settings.apiKey = ''; $('#apiKey').value = '';
    save(); renderSettings(); updateKeyGates(); toast('Key removed.');
  });
  $('#keyTest').addEventListener('click', async () => {
    state.settings.apiKey = $('#apiKey').value.trim(); save();
    if (!state.settings.apiKey) return toast('Paste a key first.', 'bad');
    busy(true, 'Checking the key…');
    try {
      await callClaude('Reply with the single word: ready', 64);
      $('#keyState').textContent = 'Key works ✓'; $('#keyState').className = 'key-state ok';
      toast('Key works.', 'good'); updateKeyGates();
    } catch (err) {
      $('#keyState').textContent = apiError(err); $('#keyState').className = 'key-state bad';
      toast(apiError(err), 'bad');
    } finally { busy(false); }
  });

  $('#exportBtn').addEventListener('click', () => {
    const copy = { ...state, settings: { ...state.settings, apiKey: '' } };   // never export the key
    const blob = new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ledger-backup-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup downloaded.', 'good');
  });
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.cards)) throw new Error('bad shape');
      (data.decks || []).forEach((d) => { if (!state.decks.some((x) => x.id === d.id)) state.decks.push(d); });
      const existing = new Set(state.cards.map((c) => c.deckId + '|' + c.front));
      const ids = new Set(state.cards.map((c) => c.id));
      let added = 0;
      data.cards.map(normalizeCard).forEach((c) => {
        if (existing.has(c.deckId + '|' + c.front)) return;
        if (ids.has(c.id)) c.id = uid();
        state.cards.push(c); ids.add(c.id); added++;
      });
      save(); toast(`Imported ${added} new card${added === 1 ? '' : 's'}.`, 'good'); go('decks');
    } catch (err) { toast('That file could not be read.', 'bad'); }
    e.target.value = '';
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Delete every deck and card, and reset all progress? This cannot be undone.')) return;
    const key = state.settings.apiKey;
    state = defaultState();
    state.settings.apiKey = key;
    seed(); save(); go('decks'); toast('Everything cleared.');
  });
}

/* ───────────────────────── theme ───────────────────────── */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t === 'dark' ? '#14170f' : '#fbfbf6';
}

/* ───────────────────────── seed ───────────────────────── */
function seed() {
  let deck = state.decks.find((d) => d.id === CURRICULUM_DECK);
  if (!deck) {
    deck = { id: CURRICULUM_DECK, name: 'Business & Economics', color: DECK_COLORS[0], kind: 'curriculum', created: new Date().toISOString() };
    state.decks.unshift(deck);
  }
  if (state.seedVersion < SEED_VERSION) {
    const have = existingFronts(CURRICULUM_DECK);
    let added = 0;
    /* push in curriculum order so the deck reads top-down */
    for (const c of [...CURRICULUM_CARDS].reverse()) {
      if (have.has(c.front.trim().toLowerCase())) continue;
      addCard({ ...c, deckId: CURRICULUM_DECK, source: 'seed' });
      have.add(c.front.trim().toLowerCase());
      added++;
    }
    /* tag any pre-existing card that matches a curriculum front */
    const byFront = new Map(CURRICULUM_CARDS.map((c) => [c.front.trim().toLowerCase(), c]));
    deckCards(CURRICULUM_DECK).forEach((c) => {
      if (c.principle) return;
      const match = byFront.get(c.front.trim().toLowerCase());
      if (match) { c.principle = match.principle; c.category = match.category; }
    });
    state.seedVersion = SEED_VERSION;
    if (added) console.info(`Learn Things Good: added ${added} curriculum cards.`);
  }
  if (!state.activeDeck) state.activeDeck = null;
  save();
}

/* ───────────────────────── boot ───────────────────────── */
function boot() {
  applyTheme(state.settings.theme);
  buildTabs();
  seed();
  publishStatus();
  setupAdd();
  setupBrowse();
  setupModals();
  setupSettings();
  setEngine('local');

  $('#themeToggle').addEventListener('click', () => {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.settings.theme); save();
  });
  $('#settingsBtn').addEventListener('click', () => go('more'));
  $('#brandBtn').addEventListener('click', () => go('decks'));
  $('#deckPill').addEventListener('click', () => go('decks'));
  $('#deckTitle').addEventListener('click', () => openDeckSheet(state.activeDeck));
  $$('.quick[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));

  $('#deckStart').addEventListener('click', () => {
    const action = $('#deckStart').dataset.action;
    if (action === 'add') return go('add');
    if (action === 'ahead') { go('study', { keepSession: true }); startSession(null, true); return; }
    go('study');
  });

  const fc = $('#flashcard');
  fc.addEventListener('click', reveal);
  fc.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); } });
  $('#gotBtn').addEventListener('click', () => answer(true));
  $('#missBtn').addEventListener('click', () => answer(false));
  $('#endSession').addEventListener('click', () => go('deck'));
  $('#doneHome').addEventListener('click', () => go('deck'));
  $('#doneAgain').addEventListener('click', () => startSession(session ? session.filter : null));

  let sx = 0, sy = 0, tracking = false;
  fc.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true; }, { passive: true });
  fc.addEventListener('touchend', (e) => {
    if (!tracking) return; tracking = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && session && session.revealed) answer(dx > 0);
  }, { passive: true });

  document.addEventListener('keydown', (e) => {
    if (current !== 'study' || !session) return;
    if (['#scrim', '#deckScrim', '#nodeScrim', '#reviewScrim'].some((s) => !$(s).hidden)) return;
    const tag = document.activeElement.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    if (!session.revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); }
    else if (session.revealed) {
      if (e.key === '1' || e.key === 'ArrowLeft') { e.preventDefault(); answer(false); }
      if (e.key === '2' || e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); answer(true); }
    }
  });

  const onScroll = () => $('.topbar').classList.toggle('scrolled', window.scrollY > 6);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && current === 'decks') renderDecks(); });

  const hash = location.hash.slice(1);
  go(['decks', 'more'].includes(hash) ? hash : 'decks');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

boot();
