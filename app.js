/* ══════════════════════════════════════════════════════════════
   Learn Things Good — spaced repetition across decks.
   No dependencies, no backend. State lives in localStorage.
   ══════════════════════════════════════════════════════════════ */
import { PHASES, PRINCIPLES, CURRICULUM_CARDS } from './curriculum.js';
import { MATH_CARDS } from './math.js';
import { COUNTRY_CARDS, LEADER_CARDS, LEADER_STAMP } from './countries.js';
/* Leaders belong with the country, not in a deck of their own — the globe asks
   about a place and everything true of it. One card each, and it asks who runs
   the country: the head of government where that differs from the head of
   state, since that is the person actually governing. */
const LEADER_ONE = (() => {
  const rank = (front) => (/^Who leads/.test(front) ? 0 : /^Head of government/.test(front) ? 1 : 2);
  const best = {};
  for (const c of LEADER_CARDS) {
    if (!c.group) continue;
    if (!best[c.group] || rank(c.front) < rank(best[c.group].front)) best[c.group] = c;
  }
  return Object.entries(best).map(([code, c]) => ({
    ...c,
    /* named from the country list, not by unpicking the old question — that
       produced "Who leads state of Afghanistan?" */
    front: `Who leads ${META[code] ? META[code].n : code}?`,
  }));
})();
import { UVU_CARDS } from './uvu.js';
import * as SYNC from './sync.js';
import { Globe, META, CENTRE } from './globe.js';
import { AMBITION, chunkText, firstLetters, fadeText, gradeTyping, estimateAll, wordsIn } from './passages.js';
import * as PLAN from './planner.js';
import { CADENCE, perWeekOf, requiredToday, availableToday, gateBlockers, gateOpen, didOn, stats as habitStats, goalProgress } from './planner.js';

const STORE_KEY = 'ledger.v2';
const LEGACY_KEY = 'ledger.v1';
const BOX_COUNT = 5;
const INTERVALS = { 1: 0, 2: 2, 3: 4, 4: 8, 5: 16 };
/* Box 1 is the every-day box, so it only works while it stays small. Feeding
   new cards into a backed-up Box 1 is exactly how a deck stops being a Leitner
   system and becomes a pile: 455 cards all "due" every night, none of them
   ever getting the spaced repetition that is the entire point. New cards wait
   in a pool outside the boxes until Box 1 has room for them. */
const BOX1_LIMIT = 30;
const CURRICULUM_DECK = 'deck-business';
const MATH_DECK = 'deck-math';
const WORLD_DECK = 'deck-world';
const LEADERS_DECK = 'deck-leaders';
const KNOWLEDGE_DECK = 'deck-knowledge';
const UVU_DECK = 'deck-uvu';
const SEED_VERSION = 11;   // bump whenever curriculum.js gains cards, or installs never see them

const DECK_COLORS = ['#6d8340', '#3f7d78', '#8a5a9e', '#b06a35', '#3f6ba8', '#a8496a', '#7a7f45', '#4a7f4f'];

/* ───────────────────────── dates ───────────────────────── */
const dayKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const keyToDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((keyToDate(b) - keyToDate(a)) / 86400000);
const shiftDay = (k, n) => { const d = keyToDate(k); d.setDate(d.getDate() + n); return dayKey(d); };

/* ───────────────────────── state ───────────────────────── */
const defaultState = () => ({
  decks: [], cards: [], passages: [], activeDeck: null,
  habits: [], goals: [], log: {}, planted: [], removed: [], deletedCards: {},
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

/* null = gate on · 'off' = gate off entirely · a day key = paused for that day */
function gatePaused() {
  const p = state.settings && state.settings.gatePause;
  if (!p) return false;
  if (p === 'off') return true;
  return p === dayKey();          // a day-pause expires on its own overnight
}
function setGatePause(v) {
  state.settings.gatePause = v;
  save(); writeNow();             // unlock immediately, not after the debounce
  if (current === 'today') renderToday();
  if (current === 'more') renderSettings();
}

function publishStatus() {
  const today = dayKey();
  syncLinkedHabits();
  const habits = (state.habits || []).filter((h) => !h.archived);
  const blockers = gateBlockers(habits, state.log || {}, today);

  /* With no gate habits at all, fall back to the flashcard target so the
     blocker keeps working for anyone who has not set habits up yet. */
  const anyGate = habits.some((h) => h.gate);
  /* What is genuinely waiting tonight across every deck: reviews owed plus the
     new cards Box 1 has room for. The old count was the whole unstudied deck. */
  const due = state.decks.reduce((n, d) => n + deckLeftTonight(d, today), 0);
  const reviewed = todayCount();
  const target = state.settings.target;
  /* A gate you cannot open from the inside is a lock, not a habit. Pausing
     reports the day as done, which is all the blocker asks about. */
  const paused = gatePaused();
  const done = paused ? true : anyGate ? blockers.length === 0 : (due === 0 || reviewed >= target);

  try {
    localStorage.setItem(STATUS_KEY, JSON.stringify({
      day: today,
      due, reviewed, target,
      remaining: paused ? 0 : anyGate ? blockers.length : Math.max(0, Math.min(due, target - reviewed)),
      blockers: paused ? [] : blockers.map((h) => h.name),
      done, paused,
      updated: new Date().toISOString(),
    }));
  } catch (_) { /* storage full — the gate simply stays shut */ }
}

/* ───────────────────────── the safety net ─────────────────────────

   Everything you have ever studied lives in one localStorage key. A few
   things can empty it: a write interrupted half way, a browser reclaiming
   space, a bug in here. Those will happen again. What must never happen
   again is the app answering any of them by quietly starting over — that is
   what turns a recoverable glitch into a morning's work gone.

   So: keep a few dated copies, never write an empty ledger over a full one,
   and if the live copy is ever unreadable, set it aside rather than discard
   it. Losing data should take deliberate effort. */

const BAK_KEYS = ['ledger.bak1', 'ledger.bak2', 'ledger.bak3'];
const BAK_DAY = 'ledger.bakday';
let bootNotice = null;         // shown once the UI exists to show it

const usable = (s) => !!s && Array.isArray(s.cards) && Array.isArray(s.decks);

function readSnapshot(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return usable(parsed) ? parsed : null;
  } catch (_) { return null; }
}

/* How much work a copy represents — what we would be sorry to lose. Cards you
   have actually studied outweigh everything else, because they are the only
   part that cannot be rebuilt from the curriculum. */
function weight(s) {
  if (!usable(s)) return -1;
  const studied = s.cards.filter((c) => c.lastReviewed).length;
  return studied * 10000 + s.cards.length + (s.rev || 0);
}

/* One copy a day, three days deep. Enough to walk back past a bad morning
   without spending much of the storage budget. */
function rotateBackup(raw, force = false) {
  try {
    if (!force && localStorage.getItem(BAK_DAY) === dayKey() && localStorage.getItem(BAK_KEYS[0])) return;
    for (let i = BAK_KEYS.length - 1; i > 0; i--) {
      const prev = localStorage.getItem(BAK_KEYS[i - 1]);
      if (prev) localStorage.setItem(BAK_KEYS[i], prev);
    }
    localStorage.setItem(BAK_KEYS[0], raw);
    localStorage.setItem(BAK_DAY, dayKey());
  } catch (_) { /* out of room: the live copy matters more than its backup */ }
}

/* The best of whatever survived. */
function recover() {
  const found = BAK_KEYS.map(readSnapshot).filter(Boolean);
  if (!found.length) return null;
  return found.sort((a, b) => weight(b) - weight(a))[0];
}

/* Unreadable data is kept, not deleted — it may still be recoverable by hand,
   and it is the only evidence of what went wrong. Only the latest is kept, so
   this can never be what fills the quota. */
function quarantine(raw) {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('ledger.broken.')) localStorage.removeItem(k);
    localStorage.setItem('ledger.broken.' + Date.now(), raw);
  } catch (_) { /* nothing to be done */ }
}

function load() {
  let raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch (_) { /* storage blocked */ }

  if (raw) {
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) { /* handled below */ }
    if (usable(parsed)) { rotateBackup(raw); return hydrate(parsed); }
    quarantine(raw);
    const back = recover();
    if (back) {
      bootNotice = 'That save was damaged — restored your last backup.';
      return hydrate(back);
    }
    bootNotice = 'That save could not be read. Nothing was deleted.';
    return defaultState();
  }

  /* The key is gone but our own backups are not. That is a wipe, not a first
     run, and starting fresh would be exactly the wrong answer. */
  const back = recover();
  if (back) {
    bootNotice = 'Your data went missing — restored from backup.';
    return hydrate(back);
  }
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return migrateV1(JSON.parse(legacy));
  } catch (_) { /* nothing worth keeping */ }
  return defaultState();
}

let highWater = 0;      // the most cards we have ever held in this session
let resetting = false;  // the one legitimate way to end up holding nothing
let state = load();
highWater = state.cards.length;   // so an emptying bug is caught on its first write

/* Another tab wrote. Taking its copy wholesale destroys whatever you have just
   done in this one — grade a card, and an older tab's save would replace the
   card with its own version before yours reached storage. Progress is merged
   instead, per card, keeping whichever side actually did more work. */
/* What makes two cards the same card, on two devices that have never agreed
   on an id. Used by the merge and by tombstones, so a deletion on one device
   is recognised on the other. */
/* A short, stable fingerprint of the identity rather than the identity
   itself. Spelling it out would put the whole question back on the wire,
   which is the thing the slimming exists to avoid. Two independent 32-bit
   hashes, so a collision between two cards is not something that happens. */
function fingerprint(str) {
  let a = 0x811c9dc5, b = 5381;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    a = Math.imul((a ^ c) >>> 0, 16777619) >>> 0;
    b = (Math.imul(b, 33) ^ c) >>> 0;
  }
  return a.toString(36) + b.toString(36);
}

const identity = (c) =>
  !c ? 'id:none'
  : c.__key ? c.__key                                      // arrived slimmed, already keyed
  : c.front ? fingerprint(`${c.deckId}\u0000${String(c.front).trim().toLowerCase()}`)
  : `id:${c.id}`;

/* `local` means the other copy is another tab of this same browser, not
   another device. That distinction matters for credentials: a token must
   never arrive from a gist, but a token saved in one tab has to be visible to
   the tab sitting next to it — otherwise whichever tab renders next writes
   its empty copy back over it. */
function mergeStates(mine, theirs, { local = false } = {}) {
  const out = (theirs.rev || 0) > (mine.rev || 0) ? { ...theirs } : { ...mine };

  /* Cards are matched on what they are, not on their id.

     Each device builds its decks from the same curriculum files but hands out
     a fresh random id to every card it creates. Two devices that seeded on
     their own therefore share no ids at all, and matching by id turns a merge
     into a duplication — every card twice, progress on neither. What is
     actually stable across devices is the deck a card is in and the question
     on its face, so that is the identity. */
  const rank = (c) => [c.lastReviewed || '', c.seen || 0, c.box || 0];
  const better = (a, b) => {
    const ra = rank(a), rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] > rb[i] ? a : b;
    /* Nothing to choose between them, so choose the same one on both devices.
       Picking "mine" on each side would leave them disagreeing about the id
       for ever, and every sync would rewrite the gist to say so. */
    return (a.id || '') <= (b.id || '') ? a : b;
  };

  const byKey = new Map();
  for (const c of theirs.cards) byKey.set(identity(c), c);

  /* Content from whichever copy has it, progress from whichever is further
     ahead. They are not always the same copy: a card arriving from another
     device carries only progress, because the question it asks came from the
     curriculum and is already here. Swapping the whole object would blank the
     card. */
  const combine = (a, b) => {
    const win = better(a, b);
    const base = a.front ? a : (b.front ? b : a);
    const out = { ...base };
    for (const k of PROGRESS) out[k] = win[k];
    /* both sides pick the same id, or they disagree for ever and every sync
       rewrites the gist to say so */
    const ids = [a.id, b.id].filter(Boolean).sort();
    out.id = ids[0] || base.id;
    delete out.__key;
    return out;
  };

  const merged = [];
  const taken = new Set();
  for (const c of mine.cards) {
    const k = identity(c);
    if (taken.has(k)) continue;          // a ledger already duplicated by an older merge
    taken.add(k);
    const t = byKey.get(k);
    byKey.delete(k);
    merged.push(t ? combine(c, t) : c);
  }

  /* Cards only the other side has. One with no text is a seed card this
     device has not built yet — its progress is held until it appears, rather
     than dropped or shown as a blank card. */
  const orphans = { ...(mine.orphanProgress || {}) };
  for (const left of byKey.values()) {
    const k = identity(left);
    if (taken.has(k)) continue;
    taken.add(k);
    if (!left.front) {
      orphans[k] = Object.fromEntries(PROGRESS.map((f) => [f, left[f]]));
      continue;
    }
    merged.push(left);
  }
  out.orphanProgress = orphans;

  /* Deleting is a decision, and a decision has to travel. Merging is
     otherwise pure union, so the device that never heard about a deletion
     hands everything back on the next sync and the delete button appears not
     to work. Both sides' decisions are kept, and applied to both sides. */
  const gone = new Set([...(mine.removed || []), ...(theirs.removed || [])]);
  const goneCards = { ...(theirs.deletedCards || {}), ...(mine.deletedCards || {}) };
  out.removed = [...gone];
  out.deletedCards = goneCards;
  out.cards = merged.filter((c) => !gone.has(c.deckId) && !goneCards[identity(c)]);
  out.decks = [...(out.decks || [])].filter((d) => !gone.has(d.id));

  /* a tick is a tick: union the day logs */
  out.log = { ...(theirs.log || {}) };
  for (const [habit, days] of Object.entries(mine.log || {})) {
    out.log[habit] = { ...(out.log[habit] || {}), ...days };
  }

  /* today's tallies: take the larger count per deck for the same day */
  const md = mine.daily || {}, td = theirs.daily || {};
  if (md.day && md.day === td.day) {
    const decks = { ...(td.decks || {}) };
    for (const [k, v] of Object.entries(md.decks || {})) decks[k] = Math.max(v, decks[k] || 0);
    out.daily = { day: md.day, count: Math.max(md.count || 0, td.count || 0), decks };
  } else out.daily = (md.day || '') > (td.day || '') ? md : td;

  /* Settings belong to the device, not to the ledger. Two reasons, and both
     of them bit before this line existed: the whole state object is what gets
     pushed, so a remote copy carries the other device's sync credential and
     would hand it to this one; and turning sync off here would be silently
     undone by the next pull. A setting the other side has and this one has
     never heard of is still welcome — this device just always wins on its
     own. */
  out.settings = { ...(theirs.settings || {}), ...(mine.settings || {}) };
  /* Credentials are this device's alone, in both directions: they are never
     pushed (see forTheWire) and a remote copy is never adopted. */
  for (const k of ['syncToken', 'syncGist', 'apiKey']) {
    const ours = (mine.settings || {})[k] || '';
    out.settings[k] = ours || (local ? (theirs.settings || {})[k] || '' : '');
  }

  out.rev = Math.max(mine.rev || 0, theirs.rev || 0);
  return out;
}

/* What actually leaves this device.

   The credential must never be written into the thing it protects. Anyone
   holding the gist already holds the token, so it buys nothing, and it means
   revoking a device is not enough — the token would still be sitting in the
   payload. Stripped here rather than at the call site so there is exactly one
   place to get it wrong. */
const NEVER_LEAVES = ['syncToken', 'syncGist', 'apiKey'];

/* Anything shaped like a credential, wherever it turns up.

   Stripping the fields we know about is not a guarantee — it is a promise to
   remember. This once shipped pushing the whole state object, token included,
   and GitHub revoked the token for us. So the last thing before anything
   leaves is a look at the actual bytes: if a secret is in there, the push does
   not happen, whatever field it is hiding in. */
const SECRET_SHAPES = [
  /ghp_[A-Za-z0-9]{16,}/,           // GitHub classic
  /github_pat_[A-Za-z0-9_]{20,}/,   // GitHub fine-grained
  /gho_[A-Za-z0-9]{16,}/,           // GitHub OAuth
  /sk-ant-[A-Za-z0-9-]{16,}/,       // Anthropic
];

/* Which fields are progress rather than content. Progress is the only part
   of a seed card that is worth sending: the question, the answer, the
   category and the ordering all came from the curriculum files, are identical
   on every device, and cost about 400 bytes a card to repeat. */
const PROGRESS = ['box', 'mastered', 'lastReviewed', 'seen', 'right', 'lapses', 'stage', 'reps'];

/* Progress that arrived for a card this device could not yet build — a deck
   the other device had seeded first. Held by fingerprint until the card
   appears, so being a version behind costs you nothing. */
function applyHeldProgress() {
  const held = state.orphanProgress;
  if (!held || !Object.keys(held).length) return;
  let landed = 0;
  for (const card of state.cards) {
    const p = held[identity(card)];
    if (!p) continue;
    /* only forward: never undo something this device did later */
    if ((p.lastReviewed || '') > (card.lastReviewed || '') || (p.seen || 0) > (card.seen || 0)) {
      for (const f of PROGRESS) if (p[f] !== undefined) card[f] = p[f];
    }
    delete held[identity(card)];
    landed++;
  }
  if (landed) console.info(`Sync: applied progress for ${landed} cards that arrived early.`);
}

/* A seed card on the wire: its identity, and what you have done with it.
   Reed's ledger is 1.12 MB sent in full, and it is sent on every change — a
   single session moved ten megabytes. The same ledger as progress is about a
   seventh of that. */
const slimCard = (c) => ({
  k: identity(c), d: c.deckId,
  b: c.box, s: c.seen, r: c.right, l: c.lastReviewed,
  m: c.mastered ? 1 : 0, x: c.lapses || 0, g: c.stage || 0, p: c.reps || 0,
});
const fatCard = (row) => ({
  __key: row.k, deckId: row.d, front: null, back: null,
  box: row.b, seen: row.s, right: row.r, lastReviewed: row.l,
  mastered: !!row.m, lapses: row.x || 0, stage: row.g || 0, reps: row.p || 0,
});

/* Undo the slimming. Cards the curriculum can rebuild come back as progress
   with no text; the merge knows to take content from the local copy. */
function fromTheWire(remote) {
  if (!remote || remote.wire !== 2) return remote;          // an older device, sending everything
  return { ...remote, cards: (remote.cards || []).map((row) => (row.k ? fatCard(row) : row)) };
}

function forTheWire(s) {
  const settings = { ...(s.settings || {}) };
  for (const k of NEVER_LEAVES) delete settings[k];
  const out = {
    ...s,
    settings,
    wire: 2,
    /* Only cards the curriculum can rebuild are slimmed. Anything you wrote
       yourself goes in full, because nothing else knows what it says. */
    cards: (s.cards || []).map((c) => (c.source === 'seed' && c.front ? slimCard(c) : c)),
  };

  const body = JSON.stringify(out);
  for (const shape of SECRET_SHAPES) {
    if (shape.test(body)) {
      throw new Error('Refusing to sync: something that looks like a token is in the data. Nothing was sent.');
    }
  }
  return out;
}

let pendingMerge = null;
function adoptExternalWrite(raw) {
  try {
    const incoming = JSON.parse(raw);
    if (!incoming || !Array.isArray(incoming.cards)) return;
    if ((incoming.rev || 0) === (state.rev || 0)) return;      // our own write coming back
    /* Never swap the state out from under a running session. Merging rebuilds
       every card object, and the session is holding references to the old
       ones — grade one after that and the change lands on an orphan that
       nothing will ever save. It waits until the session is over. */
    if (session || gsession) { pendingMerge = raw; return; }
    state = hydrate(mergeStates(state, incoming, { local: true }));
    lastBody = JSON.stringify(state);      // we are in step with storage now
    groveSig = null;
    if (current === 'today') renderToday();
    else if (current === 'decks') renderDecks();
    else if (current === 'deck') renderDeck();
  } catch (_) { /* a half-written value: the next write will settle it */ }
}

function hydrate(parsed) {
  const s = { ...defaultState(), ...parsed };
  s.settings = { ...defaultState().settings, ...(parsed.settings || {}) };
  s.streak = { ...defaultState().streak, ...(parsed.streak || {}) };
  s.decks = Array.isArray(parsed.decks) ? parsed.decks : [];
  s.cards = Array.isArray(parsed.cards) ? parsed.cards.map(normalizeCard) : [];
  s.passages = Array.isArray(parsed.passages) ? parsed.passages : [];
  s.habits = Array.isArray(parsed.habits) ? parsed.habits : [];
  s.goals = Array.isArray(parsed.goals) ? parsed.goals : [];
  s.log = parsed.log && typeof parsed.log === 'object' ? parsed.log : {};
  s.removed = Array.isArray(parsed.removed) ? parsed.removed : [];
  /* Tombstones. Pruned after six months: by then every device has long since
     applied the deletion, and keeping them for ever would grow without end. */
  const cutoff = shiftDay(dayKey(), -180);
  const tombs = parsed.deletedCards && typeof parsed.deletedCards === 'object' ? parsed.deletedCards : {};
  s.deletedCards = Object.fromEntries(Object.entries(tombs).filter(([, when]) => String(when) >= cutoff));
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
    seq: Number.isFinite(c.seq) ? c.seq : null,   // position in a designed curriculum
    /* cards about the same thing (one country, one principle) share a group,
       so they can be kept near each other without sitting back to back */
    group: c.group || null,
    /* passage chunks only — null on ordinary cards */
    passageId: c.passageId || null,
    order: c.passageId ? Number(c.order) || 0 : null,
    stage: c.passageId ? Number(c.stage) || 0 : null,
    reps: c.passageId ? Number(c.reps) || 0 : 0,
    intro: c.passageId ? (c.intro || null) : null,
  };
}

let saveTimer = null;
let lastBody = null;
/* `silent` means "this write is bookkeeping, not work". Syncing stamps the
   ledger with the time it last succeeded, and if that stamp counts as a
   change then every push schedules the next one and the app talks to GitHub
   for ever. Only real changes are worth telling the other device about. */
function writeNow({ silent = false } = {}) {
  clearTimeout(saveTimer);
  saveTimer = null;
  /* Nothing changed, nothing to write. Without this, any unconditional save in
     a render path can bounce between two open tabs forever: each write wakes
     the other, which renders, which writes. */
  const body = JSON.stringify(state);
  if (body === lastBody) return;

  /* A write is the only way data is lost, so this is the place to stop it.
     If we are holding nothing and we were holding something a moment ago,
     the bug is upstream and this write is the damage — drop it. */
  const held = (state.cards || []).length;
  if (held === 0 && highWater > 0 && !resetting) {
    console.warn(`Refused to save an empty ledger over ${highWater} cards.`);
    return;
  }
  highWater = Math.max(highWater, held);
  lastBody = body;
  /* Stamp every write. A second tab of this app, opened hours ago, holds an
     old copy of everything in memory — and the moment it renders anything it
     saves, writing its stale copy over a morning's work. The stamp lets a tab
     notice it has been overtaken. */
  state.rev = (state.rev || 0) + 1;
  state.savedAt = new Date().toISOString();
  try {
    const out = JSON.stringify(state);
    localStorage.setItem(STORE_KEY, out);
    lastBody = out;                     // exactly what is on disk
    publishStatus();
    /* Anything worth writing down is worth the other device knowing about.
       syncAfterWork debounces, so a burst of grading is still one push. */
    if (!silent) syncAfterWork();
  } catch (e) { toast('Could not save — storage is full.', 'bad'); }
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 60);
}
/* Writes are debounced, so backgrounding the app in that window used to drop
   the last thing you did — on a phone that is one tick, then a swipe away. */
function flushSave() { if (saveTimer) writeNow(); }
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

/* ───────────────────── leitner scheduling ───────────────────── */
/* A card you have never met is not overdue — it is simply next. Counting the
   whole untouched deck as "due" turned a fresh 572-card curriculum into a
   572-card debt on day one. */
const isNew = (card) => !card.lastReviewed && !card.mastered;
const isReview = (card, today = dayKey()) => isDue(card, today) && !isNew(card);
/* A card is in a box only once you have actually studied it. Until then it is
   in the pool, waiting its turn — it is not a Box 1 card and it is not owed. */
const inBox = (card, b) => !card.mastered && !!card.lastReviewed && card.box === b;
const box1Load = (cards) => cards.filter((c) => inBox(c, 1)).length;
const byOrder = (a, b) => (a.seq ?? 1e9) - (b.seq ?? 1e9) || String(a.created).localeCompare(String(b.created));

/* Some decks are a designed sequence — the language of business before the
   theory, addition before the times tables. A list of countries is not: its
   alphabetical order carries no meaning and makes every night guessable. */
/* A deck marked ordered was designed as a sequence and is served in it. A list
   of countries has no sequence worth keeping, so it is shuffled. */
const isOrdered = (deck) => !!deck.ordered || isCurriculum(deck);

/* Cards about the same thing arrive together — capital, flag, where, leader.
   Served in that order you answer the second and third from the first, which
   teaches nothing. Keep a group inside one window, but scatter it within. */
function intake(cards, deck, window = 24) {
  const groups = new Map();
  for (const c of cards) {
    const k = c.group || c.id;                 // ungrouped cards stand alone
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  let order = [...groups.values()];
  order = isOrdered(deck)
    ? order.sort((a, b) => byOrder(a[0], b[0]))   // designed decks keep their sequence
    : shuffle(order);                             // a country list has no sequence
  const flat = order.flat();
  /* shuffle inside a sliding window: near where it belongs, never in a
     predictable order, and a group's own cards no longer sit back to back */
  const out = [];
  for (let i = 0; i < flat.length; i += window) out.push(...shuffle(flat.slice(i, i + window)));
  return out;
}

/* What tonight actually consists of for a deck: the reviews you owe, plus as
   many new cards as Box 1 can take. Everything that displays a number goes
   through here, so the deck page, the Goals seed and the session itself can
   never disagree about what is waiting. */
function tonight(deck, today = dayKey(), pool = null) {
  const all = deckCards(deck.id);
  const from = pool || all;
  const reviews = from.filter((c) => isReview(c, today));
  const room = Math.max(0, BOX1_LIMIT - box1Load(all));
  const unseen = from.filter(isNew);
  /* Only the count is needed by the displays that call this on every save;
     the order is settled once, when a session actually starts. */
  return { reviews, unseen, room, fresh: unseen.slice(0, room), waiting: unseen.length };
}

function isDue(card, today = dayKey()) {
  if (card.mastered) return false;
  if (card.passageId && !card.intro) return false;   // not introduced yet — waits its turn
  if (!card.lastReviewed) return true;
  /* Box 1 means every day, not every session. Without this a card you missed
     came straight back the same evening, forever. */
  if (card.lastReviewed === today) return false;
  if (card.box <= 1) return true;
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
  } else {
    card.box = 1;
    card.lapses = (card.lapses || 0) + 1;   // how many times it has knocked you back
  }
  /* Straight to disk. An answer is the one thing in this app that must never
     be lost, and a debounce is a window in which it can be — by a reload, a
     closed tab, or another tab saving over it. */
  writeNow();
}

/* ───────────────────────── helpers ───────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
/* Bind without letting one missing element take every listener after it down
   with it — that is how the entire seed and goal editor went dead once. */
function on(sel, ev, fn) {
  const el = $(sel);
  if (!el) { console.warn(`[bind] ${sel} is missing — ${ev} not wired`); return null; }
  el.addEventListener(ev, fn);
  return el;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const deckCards = (id = state.activeDeck) => state.cards.filter((c) => c.deckId === id);
const activeDeck = () => state.decks.find((d) => d.id === state.activeDeck) || null;
const isCurriculum = (deck) => deck && deck.kind === 'curriculum';
const isText = (deck) => deck && deck.kind === 'text';

/* ══════════════════════════════════════════════════════════════
   Habits — the daily list. Kaizen: something small every day.
   ══════════════════════════════════════════════════════════════ */
const liveHabits = () => (state.habits || []).filter((h) => !h.archived);
const habitById = (id) => (state.habits || []).find((h) => h.id === id);

function markHabit(id, on = true, day = dayKey()) {
  state.log = state.log || {};
  state.log[id] = state.log[id] || {};
  if (on) state.log[id][day] = true; else delete state.log[id][day];
  save();
}

/* Linked habits check themselves off from work the app can actually see —
   no self-reporting where the truth is already known. */
/* Count today's work from the cards themselves rather than a side counter.
   The counter only started existing recently, so anything studied before it
   shipped was invisible — and a counter can drift, while the cards cannot. */
function reviewedInDeckToday(deckId, day = dayKey()) {
  const fromCards = state.cards.filter((c) => c.deckId === deckId && c.lastReviewed === day).length;
  const counter = (state.daily && state.daily.day === day && state.daily.decks && state.daily.decks[deckId]) || 0;
  return Math.max(fromCards, counter);
}

function syncLinkedHabits() {
  const today = dayKey();
  let changed = false;
  for (const h of liveHabits()) {
    if (!h.deckId) continue;
    const done = reviewedInDeckToday(h.deckId, today);
    if (done >= (h.amount || 1) && !didOn(state.log || {}, h.id, today)) {
      state.log = state.log || {};
      state.log[h.id] = state.log[h.id] || {};
      state.log[h.id][today] = true;
      changed = true;
    }
  }
  return changed;
}

/* ── passages ───────────────────────────────────────────────────
   A chunk of text is a card with a different ritual: read it, recall
   it from first letters, then type it. After that it rides the same
   Leitner boxes as everything else.
   Stages: 0 read · 1 first letters · 2 type it · 3 learned (review). */
/* A line is learned by having the text taken away from you a bit at a time,
   and the last rung runs it on from the lines before it — the joints between
   lines are where a passage actually falls apart. */
const STAGE_LABEL = ['Read it', 'Fill the gaps', 'From the first letters', 'Say it in the run', 'Say it in the run'];
const STAGE_PROGRESS = [0, 0.25, 0.5, 0.75, 0.75];
/* how many lines before it to run into the new one */
const CHAIN_WINDOW = 4;
const passagesIn = (deckId) => (state.passages || []).filter((p) => p.deckId === deckId);
const chunksOf = (passageId) => state.cards.filter((c) => c.passageId === passageId)
  .sort((a, b) => a.order - b.order);

function addPassage(deck, title, text, ambitionId) {
  const pieces = chunkText(text);
  if (!pieces.length) return null;
  const passage = {
    id: 'p-' + uid().slice(0, 8),
    deckId: deck.id,
    title: title.trim() || 'Untitled passage',
    ambition: ambitionId,
    words: wordsIn(text),
    created: new Date().toISOString(),
  };
  state.passages = state.passages || [];
  state.passages.push(passage);
  pieces.forEach((t, i) => {
    state.cards.push(normalizeCard({
      deckId: deck.id, front: t, back: t, category: passage.title,
      passageId: passage.id, order: i, stage: 0, reps: 0,
      intro: null, source: 'passage',
    }));
  });
  introduceChunks(deck);   // today's lines are available immediately, not after a navigation
  save();
  return passage;
}

/* A chunk is only in play once it has been introduced on some day. */
function introduceChunks(deck) {
  const today = dayKey();
  let released = false;
  let budget = 0;
  for (const p of passagesIn(deck.id)) budget = Math.max(budget, (AMBITION[p.ambition] || AMBITION.normal).wordsPerDay);
  for (const p of passagesIn(deck.id)) {
    const perDay = (AMBITION[p.ambition] || AMBITION.normal).wordsPerDay;
    const lines = chunksOf(p.id);
    /* each passage gets its own budget, so a second passage is not starved by the first */
    let spent = lines.filter((c) => c.intro === today).reduce((t, c) => t + wordsIn(c.front), 0);
    for (const c of lines) {
      if (c.intro) continue;
      const cost = wordsIn(c.front);
      /* stop before overshooting the promised pace — but always release one line,
         otherwise a passage whose first line exceeds the budget never starts */
      if (spent > 0 && spent + cost > perDay) break;
      c.intro = today;
      spent += cost;
      released = true;
    }
  }
  /* Only when something actually changed. This ran on every render and saved
     unconditionally, which with two tabs open became a loop: each save woke
     the other tab, which rendered, which saved. */
  if (released) save();
}

/* Release today's lines for every text deck. Idempotent, so it is safe to call
   from anywhere that is about to count what is due. */
function releaseDailyLines() {
  for (const d of state.decks) if (isText(d)) introduceChunks(d);
}

/* Grading a chunk: advance the ritual, then hand it to the Leitner boxes. */
function advanceChunk(card, ok) {
  card.seen += 1;
  if (card.stage === 0) {                       // read it once, then recall
    card.reps = (card.reps || 0) + 1;
    card.stage = 1;
  } else if (card.stage === 1 || card.stage === 2) {   // gaps, then first letters
    if (ok) card.stage += 1; else card.stage = Math.max(0, card.stage - 1);
  } else {                                      // stage 3+ — say it in the run
    if (ok) {
      card.right += 1;
      card.lastReviewed = dayKey();
      if (card.stage === 3) { card.stage = 4; card.box = 2; }   // learned; enters the ladder
      else if (card.box >= BOX_COUNT) card.mastered = true;
      else card.box += 1;
    } else {
      card.box = 1;
      card.lastReviewed = null;                 // missed means due again tonight
      card.stage = 2;                           // back to the first-letter rung
    }
  }
  writeNow();
}

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
  today:  '<path d="M12 21V10"/><path d="M12 13c0-3.4 2.7-6.2 6.6-6.7 0 4-2.5 6.7-6.6 6.7z"/><path d="M12 17.5c0-2.7-2.1-4.9-5.3-5.3 0 3.2 2 5.3 5.3 5.3z"/>',
  decks:  '<path d="M4 7h16v13H4z"/><path d="M7 4h13v13"/>',
  path:   '<path d="M12 21V9"/><path d="M12 12c0-3 2.4-5.5 6-6 0 3.6-2.2 6-6 6z"/><path d="M12 16c0-2.4-1.9-4.4-4.8-4.8 0 2.9 1.8 4.8 4.8 4.8z"/>',
  study:  '<rect x="3" y="7" width="13" height="13" rx="3"/><path d="M8 4h9a3 3 0 0 1 3 3v9"/>',
  add:    '<path d="M12 5v14M5 12h14"/>',
  browse: '<path d="M4 6h16M4 12h16M4 18h11"/>',
};
const TABS = [
  { id: 'today', label: 'Goals' },
  { id: 'decks', label: 'Learn' },
];
/* the deck world lives under Learn */
const TAB_FOR_VIEW = { deck: 'decks', path: 'decks', study: 'decks', add: 'decks', browse: 'decks', more: null };

function buildTabs() {
  const html = TABS.map((t) => `<button data-go="${t.id}" aria-label="${t.label}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[t.id]}</svg><span>${t.label}</span></button>`).join('');
  $('#mobileTabs').innerHTML = html;
  $('#desktopTabs').innerHTML = html;
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
}

let current = 'decks';
function go(view, opts = {}) {
  const needsDeck = ['deck', 'path', 'study', 'add', 'browse', 'globe'].includes(view);
  if (needsDeck && !activeDeck()) view = 'decks';
  /* This deck has no card view. Every route into studying it — the deck page,
     the quick row, a seed on the Goals page, a topic, a direct hash — arrives
     at the globe instead. Guarding only the deck button left the other doors
     open, and a flashcard asking "which country's capital is Majuro?" is the
     exact thing the globe exists to replace. */
  if (view === 'study' && activeDeck() && activeDeck().id === WORLD_DECK) {
    startGlobe();
    return;
  }
  if (view === 'study' && !opts.keepSession) startSession(opts.filter || null);
  if (current === 'study' && view !== 'study') { session = null; drainPendingRemote(); }
  if (current === 'globe' && view !== 'globe') { gsession = null; if (globe) globe.stop(); drainPendingRemote(); }

  current = view;
  $$('.view').forEach((v) => v.classList.toggle('on', v.dataset.view === view));
  const tab = view in TAB_FOR_VIEW ? TAB_FOR_VIEW[view] : view;
  $$('[data-go]').forEach((b) => b.classList.toggle('on', b.dataset.go === tab));
  if (location.hash.slice(1) !== view) history.replaceState(null, '', '#' + view);
  window.scrollTo({ top: 0, behavior: 'auto' });

  const deck = activeDeck();
  const deckContext = ['deck', 'path', 'study', 'add', 'browse'].includes(view);
  $('#deckPill').hidden = !deck || !deckContext;
  if (deck) { $('#deckPillName').textContent = deck.name; $('#deckPillDot').style.background = deck.color; }

  if (view === 'today') renderToday();
  if (view === 'decks') renderDecks();
  if (view === 'deck') renderDeck();
  if (view === 'path') renderPath();
  if (view === 'add') renderAdd();
  if (view === 'browse') renderBrowse();
  if (view === 'more') renderSettings();
}

function openDeck(id) { state.activeDeck = id; save(); go('deck'); }

/* ───────────────────────── today ───────────────────────── */
const weekDots = (h) => {
  const st = habitStats(h, state.log || {}, dayKey(), 7);
  return `<span class="dots">${st.days.map((d) => `<i class="${d.done ? 'on' : ''}"></i>`).join('')}</span>`;
};

function habitRow(h, state_) {
  const today = dayKey();
  const done = didOn(state.log || {}, h.id, today);
  const st = habitStats(h, state.log || {}, today, 7);
  const deck = h.deckId ? state.decks.find((d) => d.id === h.deckId) : null;
  return `<div class="habit ${done ? 'done' : ''} ${h.gate ? 'gated' : ''}" data-habit="${h.id}">
    <button class="tick" data-tick="${h.id}" aria-label="${done ? 'Undo' : 'Mark done'}">
      <svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>
    </button>
    <div class="habit-main" data-act="${h.id}" role="button" tabindex="0">
      <div class="habit-name">${esc(h.name)}${h.gate ? '<span class="gate-tag">gate</span>' : ''}</div>
      ${h.floor && !done ? `<div class="habit-floor">floor: ${esc(h.floor)}</div>` : ''}
      <div class="habit-meta">${weekDots(h)}<span>${st.thisWeek}/${st.target} this week</span>${st.streak > 1 ? `<span>· ${st.streak} day run</span>` : ''}</div>
    </div>
    ${deck ? `<span class="habit-go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg></span>` : ''}
    <button class="habit-edit" data-edit="${h.id}" aria-label="Edit ${esc(h.name)}">
      <svg viewBox="0 0 24 24"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/></svg></button>
  </div>`;
}

function seedRow(h, log, today) {
  const done = didOn(log, h.id, today);
  const deck = h.deckId ? state.decks.find((d) => d.id === h.deckId) : null;
  const need = requiredToday(h, log, today);
  return `<div class="seed ${done ? 'done' : ''}" data-act="${h.id}">
    <span class="tick"><svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg></span>
    <span class="seed-body">
      <span class="seed-name">${esc(h.name)}${h.gate && need ? '<i class="gate-tag">first</i>' : ''}</span>
      ${deck ? `<span class="seed-floor">${(() => {
          const did = reviewedInDeckToday(deck.id);
          /* A passage's nightly dose is measured in words and a missed line
             comes straight back, so any line target is a fiction — it drifted
             from "0 of 5" to "6 of 8" while you worked. Report the work done;
             the row ticks itself when the night is finished. */
          if (isText(deck)) return `${did} line${did === 1 ? '' : 's'} today`;
          const want = h.amount || 1;
          /* "18 of 15" read like a bug. Past the target it is just a total. */
          return did >= want
            ? `${did} card${did === 1 ? '' : 's'} today`
            : `${did} of ${want} cards today`;
        })()}</span>`
             : (h.floor && !done ? `<span class="seed-floor">floor: ${esc(h.floor)}</span>` : '')}
    </span>
    ${deck ? '<span class="seed-go"><svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg></span>' : ''}
    <button class="seed-edit" data-edit="${h.id}" aria-label="Edit">
      <svg viewBox="0 0 24 24"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/></svg></button>
  </div>`;
}

/* the last 30 days for a whole goal: a day counts if any of its seeds was done */
function goalStrip(seeds, log, today) {
  const cells = [];
  for (let i = 29; i >= 0; i--) {
    const k = PLAN.addDays(today, -i);
    cells.push(`<i class="${seeds.some((h) => didOn(log, h.id, k)) ? 'on' : ''}" title="${k}"></i>`);
  }
  return `<div class="strip">${cells.join('')}</div>`;
}

function treeTended(g, t) {
  const tended = t.idle === null ? 'Not started'
    : t.idle === 0 ? 'Tended today' : t.idle === 1 ? 'Tended yesterday'
    : `Untended ${t.idle} days`;
  return `${tended}${t.sessions ? ` · ${t.sessions} session${t.sessions === 1 ? '' : 's'}` : ''}${g.targetDate ? ` · aiming for ${humanDate(g.targetDate)}` : ''}`;
}

/* Ticking one seed used to rebuild the whole grove, so every tree remounted:
   growth animations replayed and the page jumped under your thumb. When the
   shape of the grove hasn't changed, patch the parts that actually moved and
   leave the DOM — and its animations — alone. */
let groveSig = null;
let bootDay = dayKey();
function groveSignature(goals, habits) {
  return goals.map((g) => g.id + '>' + habits.filter((h) => h.goalId === g.id).map((h) => h.id).join(',')).join('|')
    + '#' + habits.filter((h) => !h.goalId).map((h) => h.id).join(',');
}
function patchGrove(goals, habits, log, today) {
  goals.forEach((g) => {
    const card = $(`#grove [data-tree="${g.id}"]`); if (!card) return;
    const seeds = habits.filter((h) => h.goalId === g.id);
    const t = { ...treeState(g), kind: g.tree || 'oak' };
    card.classList.toggle('tended', !!(seeds.length && seeds.every((h) => didOn(log, h.id, today))));
    card.classList.toggle('fading', t.health < 0.5);
    const holder = card.querySelector('.goal-tree');
    /* Only redraw the tree when it genuinely grew — that is the one moment
       the animation is worth playing. */
    if (holder && Number(holder.dataset.stage) !== t.stage) {
      holder.dataset.stage = t.stage;
      holder.innerHTML = treeSVG(t);
      holder.classList.remove('grew'); void holder.offsetWidth; holder.classList.add('grew');
    } else if (holder) {
      const svg = holder.firstElementChild;
      if (svg) svg.style.setProperty('--health', t.health);
    }
    const name = card.querySelector('.tree-name');
    if (name && name.textContent !== g.name) name.textContent = g.name;
    const why = card.querySelector('.tree-why');
    if (why && why.textContent !== (g.why || '')) why.textContent = g.why || '';
    const tended = card.querySelector('.tree-tended');
    if (tended) { tended.textContent = treeTended(g, t); tended.classList.toggle('warn', t.idle >= 2); }
    const strip = card.querySelector('.strip');
    if (strip) strip.outerHTML = goalStrip(seeds, log, today);
  });
  habits.forEach((h) => {
    const row = $(`#grove .seed[data-act="${h.id}"]`); if (!row) return;
    const done = didOn(log, h.id, today);
    row.classList.toggle('done', done);
    const fresh = document.createElement('div');
    fresh.innerHTML = seedRow(h, log, today);
    const body = fresh.querySelector('.seed-body');
    const cur = row.querySelector('.seed-body');
    if (body && cur && body.innerHTML !== cur.innerHTML) cur.innerHTML = body.innerHTML;
  });
}

function renderToday() {
  const today = dayKey();
  syncLinkedHabits();
  releaseDailyLines();
  const habits = liveHabits();
  const log = state.log || {};

  $('#todayGreeting').textContent = greetingText();
  const blockers = gateBlockers(habits, log, today);
  const doneCount = habits.filter((h) => didOn(log, h.id, today)).length;

  $('#todayLine').textContent = !habits.length ? 'Plant something'
    : blockers.length ? `${blockers.length} thing${blockers.length === 1 ? '' : 's'} before the good stuff`
    : doneCount ? 'Go chud it out today, you earned it'
    : 'Nothing owed today';
  $('#todayLine').classList.toggle('done', habits.length > 0 && !blockers.length && doneCount > 0);

  renderHarvest(habits.length > 0 && !blockers.length);

  const paused = gatePaused();
  const gate = $('#gate');
  gate.hidden = !habits.some((h) => h.gate);
  gate.classList.toggle('open', paused || !blockers.length);
  $('#gateText').textContent = paused
    ? (state.settings.gatePause === 'off' ? 'The gate is off.' : 'Paused for today.')
    : blockers.length
      ? `${blockers.map((h) => h.name).join(', ')} — then the gate opens`
      : 'The gate is open.';
  /* Offered right next to the lock, because that is where you are standing
     when you need it. */
  const pauseBtn = $('#gatePauseBtn');
  pauseBtn.hidden = gate.hidden;
  pauseBtn.textContent = paused ? 'Turn the gate back on' : 'Pause the gate';
  pauseBtn.classList.toggle('on', paused);

  const goals = state.goals || [];
  const sig = groveSignature(goals, habits);
  if (sig === groveSig && $('#grove').children.length) {
    patchGrove(goals, habits, log, today);
    renderDeckSuggestions(habits);
    return;
  }
  groveSig = sig;

  const cards = goals.map((g) => {
    const seeds = habits.filter((h) => h.goalId === g.id);
    const t = { ...treeState(g), kind: g.tree || 'oak' };
    const allDone = seeds.length && seeds.every((h) => didOn(log, h.id, today));
    return `<article class="tree-card ${allDone ? 'tended' : ''} ${t.health < 0.5 ? 'fading' : ''}" data-tree="${g.id}">
      <div class="tree-top" data-goal="${g.id}">
        <div class="goal-tree" data-stage="${t.stage}">${treeSVG(t)}</div>
        <div class="tree-meta">
          <h2 class="tree-name">${esc(g.name)}</h2>
          ${g.why ? `<p class="tree-why">${esc(g.why)}</p>` : ''}
          <p class="tree-tended ${t.idle >= 2 ? 'warn' : ''}">${treeTended(g, t)}</p>
          ${goalStrip(seeds, log, today)}
        </div>
      </div>
      <div class="seed-list">${seeds.length
        ? seeds.map((h) => seedRow(h, log, today)).join('')
        : '<p class="seed-empty">No seeds yet — plant one below and point it here.</p>'}</div>
    </article>`;
  });

  const loose = habits.filter((h) => !h.goalId);
  if (loose.length) cards.push(`<article class="tree-card loose">
      <div class="tree-top"><div class="tree-meta"><h2 class="tree-name">On their own</h2>
      <p class="tree-tended">Not pointed at a goal</p></div></div>
      <div class="seed-list">${loose.map((h) => seedRow(h, log, today)).join('')}</div>
    </article>`);

  cards.push(`<div class="grove-actions">
      <button class="new-deck" id="newHabitBtn">
        <span class="plus"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span>
        <span><strong>Plant a seed</strong><em>Small · Every day · End-goal focused · Done or not done</em></span>
      </button>
      <button class="new-deck" id="newGoalBtn">
        <span class="plus"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span>
        <span><strong>New goal</strong><em>Another tree to grow</em></span>
      </button>
    </div>`);

  $('#grove').innerHTML = cards.join('');

  /* tap the row to do it; the pencil edits; the tree header edits the goal */
  const act = (id) => {
    const h = habitById(id); if (!h) return;
    if (h.deckId) { state.activeDeck = h.deckId; save(); cameFrom = 'today'; go('study'); return; }
    markHabit(id, !didOn(state.log || {}, id, dayKey()));
    buzz(12); renderToday();
  };
  $$('#grove [data-act]').forEach((el) => el.addEventListener('click', (e) => {
    if (e.target.closest('[data-edit]')) return;
    act(el.dataset.act);
  }));
  $$('#grove [data-edit]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation(); openHabitSheet(b.dataset.edit);
  }));
  $$('#grove [data-goal]').forEach((el) => el.addEventListener('click', () => openGoalSheet(el.dataset.goal)));
  $('#newHabitBtn').addEventListener('click', () => openHabitSheet(null));
  $('#newGoalBtn').addEventListener('click', () => openGoalSheet(null));

  renderDeckSuggestions(habits);
}

function renderDeckSuggestions(habits) {
  const unlinked = state.decks.filter((d) => deckCards(d.id).length && !habits.some((h) => h.deckId === d.id));
  $('#suggest').hidden = !unlinked.length;
  $('#suggestRow').innerHTML = unlinked.map((d) => `<button class="sugg" data-seed-deck="${d.id}">
      <span class="sugg-plus">+</span>
      <span><b>${esc(d.name)}</b><em>${isText(d) ? 'a few lines a night' : `${deckDaily(d)} cards a day`}</em></span>
    </button>`).join('');
  $$('#suggestRow [data-seed-deck]').forEach((b) => b.addEventListener('click', () => {
    const deck = state.decks.find((d) => d.id === b.dataset.seedDeck);
    if (!deck) return;
    state.habits = state.habits || [];
    state.habits.push({
      id: 'h-' + uid().slice(0, 8), created: new Date().toISOString(),
      name: deck.name, floor: isText(deck) ? 'one line' : '5 cards',
      cadence: 'daily', goalId: (state.goals || [])[0]?.id || null, deckId: deck.id,
      amount: deckDaily(deck), gate: true,
    });
    save(); buzz(14); renderToday();
    toast(`${deck.name} added.`, 'good');
  }));
}

/* ── the goal tree ─────────────────────────────────────────────
   Grows with the work put in, greys when left untended. It never
   shrinks: you did those sessions, and losing them to a missed week
   would be a lie. Colour comes back the day you tend it again. */
const TREE_STEPS = [0, 3, 8, 16, 30, 55, 90];

function treeState(goal) {
  const mine = liveHabits().filter((h) => h.goalId === goal.id);
  const log = state.log || {};
  let last = null, sessions = 0;
  for (const h of mine) {
    for (const day of Object.keys(log[h.id] || {})) {
      sessions++;
      if (!last || day > last) last = day;
    }
  }
  const idle = last ? Math.max(0, daysBetween(last, dayKey())) : null;
  let stage = 0;
  TREE_STEPS.forEach((t, i) => { if (sessions >= t) stage = i; });
  /* full colour for a day off; fading from there; bare after a week */
  const health = idle === null ? 0.35
    : idle <= 1 ? 1 : idle === 2 ? 0.72 : idle === 3 ? 0.55
    : idle === 4 ? 0.4 : idle <= 6 ? 0.25 : 0;
  return { stage, sessions, idle, health, seeds: mine.length };
}

const CANOPY = [[0, -8, 21], [-19, 3, 16], [19, 3, 16], [-11, -21, 14],
                [12, -21, 14], [0, 16, 15], [-27, -8, 12], [27, -8, 12]];

/* Three species, because a grove of identical trees is a chart. Each grows the
   same way — taller trunk, fuller crown, greyer when neglected — but reads as
   its own thing at a glance, which is what makes a goal recognisable. */
const TREE_KINDS = [
  { id: 'oak',  name: 'Broadleaf', hint: 'Slow, broad, stubborn' },
  { id: 'pine', name: 'Pine',      hint: 'Upright and evergreen' },
  { id: 'palm', name: 'Palm',      hint: 'Leans into the weather' },
];

function treeSVG({ stage, health, kind = 'oak' }) {
  const trunkTop = 128 - (32 + stage * 9);
  const parts = [];
  const leaf = (d, delay) => `<path class="tree-leaf-sm" style="animation-delay:${delay}ms" d="${d}"/>`;

  if (kind === 'pine') {
    /* stacked skirts, widest at the bottom, one more tier per stage */
    const tiers = Math.max(1, Math.min(5, stage + 1));
    for (let i = 0; i < tiers; i++) {
      const y = trunkTop + 6 + i * ((128 - trunkTop) / (tiers + 1.1));
      const w = 15 + i * 8.5;
      parts.push(`<path class="tree-leaf" style="animation-delay:${560 + i * 90}ms"
        d="M60,${y - 22} L${60 + w},${y + 8} L${60 + w * 0.55},${y + 8} L60,${y - 4} L${60 - w * 0.55},${y + 8} L${60 - w},${y + 8} Z"/>`);
    }
    return svgWrap(health, `<path class="tree-trunk" d="M60,132 V${trunkTop + 4}"/>${parts.join('')}`);
  }

  if (kind === 'palm') {
    /* a leaning trunk and a crown of fronds, more of them as it grows */
    const fronds = Math.max(2, Math.min(7, stage + 2));
    for (let i = 0; i < fronds; i++) {
      const a = (-Math.PI * 0.92) + (i / (fronds - 1)) * Math.PI * 0.84;
      const len = 30 + (stage * 1.6);
      const ex = 64 + Math.cos(a) * len, ey = trunkTop + Math.sin(a) * len * 0.62;
      const cx = 64 + Math.cos(a) * len * 0.5, cy = trunkTop + Math.sin(a) * len * 0.9 - 8;
      parts.push(`<path class="tree-frond" style="animation-delay:${560 + i * 70}ms"
        d="M64,${trunkTop} Q${cx},${cy} ${ex},${ey} Q${cx},${cy + 7} 64,${trunkTop} Z"/>`);
    }
    return svgWrap(health, `<path class="tree-trunk" d="M56,132 C58,110 60,${trunkTop + 22} 64,${trunkTop}"/>${parts.join('')}`);
  }

  /* the broadleaf: the original */
  const blobs = stage === 0 ? 0 : Math.min(CANOPY.length, stage + 1);
  if (stage >= 2) {
    parts.push(`<path class="tree-branch" style="animation-delay:520ms" d="M60,${trunkTop + 34} C50,${trunkTop + 28} 42,${trunkTop + 22} 38,${trunkTop + 14}"/>`);
    parts.push(`<path class="tree-branch" style="animation-delay:600ms" d="M60,${trunkTop + 42} C70,${trunkTop + 36} 78,${trunkTop + 30} 82,${trunkTop + 22}"/>`);
  }
  for (let i = 0; i < blobs; i++) {
    const [dx, dy, r] = CANOPY[i];
    parts.push(`<circle class="tree-leaf" style="animation-delay:${640 + i * 80}ms" cx="${60 + dx}" cy="${trunkTop + dy}" r="${r}"/>`);
  }
  if (stage === 0) {   /* just planted */
    parts.push(leaf(`M60,${trunkTop} C48,${trunkTop - 7} 42,${trunkTop - 1} 42,${trunkTop + 7} C51,${trunkTop + 8} 57,${trunkTop + 4} 60,${trunkTop}`, 520));
    parts.push(leaf(`M60,${trunkTop} C72,${trunkTop - 7} 78,${trunkTop - 1} 78,${trunkTop + 7} C69,${trunkTop + 8} 63,${trunkTop + 4} 60,${trunkTop}`, 600));
  }
  return svgWrap(health, `<path class="tree-trunk" d="M60,132 C60,112 58,${trunkTop + 26} 60,${trunkTop}"/>${parts.join('')}`);
}

function svgWrap(health, inner) {
  return `<svg viewBox="0 0 120 140" style="--health:${health}" aria-hidden="true">
    <path class="ground" d="M22,132 H98"/>
    ${inner}
  </svg>`;
}


/* ── progress, now shown inside a goal ─────────────────────────── */
function progressCard(h) {
  const st = habitStats(h, state.log || {}, dayKey(), 30);
  return `<div class="prog">
    <div class="prog-head">
      <span class="prog-name">${esc(h.name)}</span>
      <span class="prog-rate">${st.done} of the last 30 days</span>
    </div>
    ${h.floor ? `<p class="prog-goal">floor: ${esc(h.floor)}</p>` : ''}
    <div class="grid30">${st.days.map((d) => `<i class="${d.done ? 'on' : ''}" title="${d.key}"></i>`).join('')}</div>
    <div class="prog-foot">
      <span><b>${st.thisWeek}/${st.target}</b> this week</span>
      <span><b>${st.streak}</b> day run</span>
      <span><b>${st.best}</b> best run</span>
    </div>
  </div>`;
}


/* ───────────────────────── decks view ───────────────────────── */
/* What this deck still owes tonight. Each deck keeps its own pace and its own
   count — a global target split across decks made mental math ask for fifteen
   when it was built for ten, and let one deck eat another's quota. */
function deckLeftTonight(d, today) {
  if (isText(d)) {
    const due = deckCards(d.id).filter((c) => isDue(c, today)).length;
    return Math.max(0, Math.min(due, sessionSize(d) - reviewedInDeckToday(d.id, today)));
  }
  const { reviews, fresh } = tonight(d, today);
  const waiting = reviews.length + fresh.length;
  return Math.max(0, Math.min(waiting, sessionSize(d) - reviewedInDeckToday(d.id, today)));
}
function renderDecks() {
  syncPill();
  const today = dayKey();
  releaseDailyLines();
  const dueAll = state.cards.filter((c) => isDue(c, today));
  /* only tonight's slice — the full backlog is discouraging and not actionable */
  const leftTonight = state.decks.reduce((n, d) => n + deckLeftTonight(d, today), 0);
  const finished = leftTonight === 0;

  $('.due-count').classList.toggle('done', finished);
  $('#dueBig').textContent = finished ? '' : leftTonight;
  $('#dueWord').textContent = finished
    ? 'All caught up'
    : leftTonight === 1 ? 'card due today' : 'cards due today';
  $('#greeting').textContent = greetingText();
  $('#heroSub').textContent = state.decks.length > 1 ? `across ${state.decks.length} decks` : 'ready when you are';

  /* The gate and the harvest live on Goals and are computed from habits.
     This view used to write to both — invisible from here, and it clobbered
     what Goals had worked out. One owner per element. */

  $('#deckGrid').innerHTML = state.decks.map((d, i) => {
    const cards = deckCards(d.id);
    const dueTonight = deckLeftTonight(d, today);    // tonight's slice, not the backlog
    const mastered = cards.filter((c) => c.mastered).length;
    const pct = cards.length ? Math.round((mastered / cards.length) * 100) : 0;
    const didHere = (state.daily && state.daily.day === today && state.daily.decks && state.daily.decks[d.id]) || 0;
    const unit = isText(d) ? 'line' : 'card';
    const settled = !dueTonight && didHere > 0;          // worked it, and nothing left
    const badge = settled
      ? '<span class="deck-due done"><svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>Done</span>'
      : `<span class="deck-due ${dueTonight ? '' : 'zero'}">${dueTonight ? dueTonight + ' due' : 'clear'}</span>`;
    /* on a day you did the work, what you did beats a mastery percentage */
    const meta = settled
      ? `${didHere} ${unit}${didHere === 1 ? '' : 's'} today${mastered ? ` · ${mastered} mastered` : ''}`
      : dueTonight
        ? `${dueTonight} ${unit}${dueTonight === 1 ? '' : 's'} to go${mastered ? ` · ${mastered} mastered` : ''}`
        : cards.length ? `nothing due${mastered ? ` · ${mastered} mastered` : ''}` : 'empty';
    /* a div, not a button, so the settings control can live inside it — a
       button inside a button is invalid and swallows the inner click */
    return `<div class="deck-card ${settled ? 'settled' : ''}" data-deck="${d.id}" role="button" tabindex="0"
        style="--dc:${d.color};animation-delay:${i * 45}ms">
      <div class="deck-top">
        <span class="deck-name">${esc(d.name)}</span>
        ${badge}
        <button class="deck-edit" data-deck-edit="${d.id}" aria-label="${esc(d.name)} settings">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
        </button>
      </div>
      <div class="deck-meta">${isCurriculum(d) ? '<span class="deck-tag">curriculum</span> · ' : ''}${meta}</div>
      <div class="deck-bar"><i style="width:${pct}%;background:linear-gradient(90deg,${d.color},${d.color}bb)"></i></div>
    </div>`;
  }).join('') + `<button class="new-deck" id="newDeckBtn" style="animation-delay:${state.decks.length * 45}ms">
      <span class="plus"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span>
      <span><strong>New deck</strong><em>A class, a language, anything</em></span>
    </button>`;
  $$('#deckGrid [data-deck]').forEach((b) => {
    b.addEventListener('click', (e) => { if (e.target.closest('[data-deck-edit]')) return; openDeck(b.dataset.deck); });
    /* it stopped being a real button, so give the keyboard its behaviour back */
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDeck(b.dataset.deck); }
    });
  });
  $$('#deckGrid [data-deck-edit]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation(); openDeckSheet(b.dataset.deckEdit);
  }));
  $('#newDeckBtn').addEventListener('click', () => openDeckSheet(null));
}

/* ── the day's reward ──────────────────────────────────────────
   Closure, not confetti. The plant is the only thing that grows, and it
   grows with the streak — so the reward is the arc, not the dopamine. */
function plantSVG(streak) {
  const leaves = Math.min(10, Math.max(1, Math.ceil(streak / 2)));
  const bud = streak >= 21;
  /* the plant only grows as tall as it has leaves — no bare stalk */
  const pairs = Math.ceil(leaves / 2);
  const rows = [];
  for (let r = 0; r < pairs; r++) rows.push(104 - r * 17);
  const topY = rows[rows.length - 1] - (bud ? 16 : 10);

  const parts = [];
  for (let i = 0; i < leaves; i++) {
    const y = rows[Math.floor(i / 2)];
    const left = i % 2 === 0;
    const scale = 1 - Math.floor(i / 2) * 0.09;              // smaller toward the tip
    const w = 26 * scale, h = 11 * scale;
    const d = left
      ? `M50,${y} C${50 - w * 0.55},${y - h} ${50 - w},${y - h * 0.35} ${50 - w},${y + h * 0.5} C${50 - w * 0.5},${y + h} ${50 - w * 0.2},${y + h * 0.6} 50,${y}`
      : `M50,${y} C${50 + w * 0.55},${y - h} ${50 + w},${y - h * 0.35} ${50 + w},${y + h * 0.5} C${50 + w * 0.5},${y + h} ${50 + w * 0.2},${y + h * 0.6} 50,${y}`;
    parts.push(`<path class="leaf" style="animation-delay:${380 + i * 90}ms" d="${d}"/>`);
  }
  return `<svg viewBox="0 0 100 125" aria-hidden="true">
    <path class="stem" d="M50,120 C50,104 48,90 50,74 C52,58 50,${topY + 12} 50,${topY}"/>
    ${parts.join('')}
    ${bud ? `<circle class="bud" style="animation-delay:${380 + leaves * 90}ms" cx="50" cy="${topY - 6}" r="8"/>` : ''}
  </svg>`;
}

function renderHarvest(finished) {
  const box = $('#harvest');
  const today = dayKey();
  const perDeck = (state.daily && state.daily.day === today && state.daily.decks) || {};
  let cardsDone = 0, linesDone = 0;
  for (const [id, n] of Object.entries(perDeck)) {
    const deck = state.decks.find((d) => d.id === id);
    if (!deck) continue;
    isText(deck) ? (linesDone += n) : (cardsDone += n);
  }
  /* Seeds that aren't decks — guitar, journaling — are real work too. A day
     spent on those used to report as nothing done. */
  const log = state.log || {};
  const seedsDone = liveHabits().filter((h) => !h.deckId && didOn(log, h.id, today)).length;

  /* a reward for a day you did nothing would be hollow */
  if (!finished || cardsDone + linesDone + seedsDone === 0) { box.hidden = true; return; }

  const streak = liveStreak();
  box.hidden = false;
  $('#plant').innerHTML = plantSVG(streak);
  $('#harvestDay').textContent = streak > 1 ? `${streak} days in a row` : 'Day one';

  const bits = [];
  if (cardsDone) bits.push(`${cardsDone} card${cardsDone === 1 ? '' : 's'}`);
  if (linesDone) bits.push(`${linesDone} line${linesDone === 1 ? '' : 's'}`);
  if (seedsDone) bits.push(`${seedsDone} seed${seedsDone === 1 ? '' : 's'}`);
  $('#harvestLine').textContent = bits.join(' · ') + ' today';

  /* direction: what today actually bought you */
  const promoted = state.cards.filter((c) => c.lastReviewed === today && c.box > 1 && !c.mastered).length;
  const mastered = state.cards.filter((c) => c.mastered && c.lastReviewed === today).length;
  const next = upcoming(state.cards);
  const note = [];
  if (promoted) note.push(`${promoted} moved up a box`);
  if (mastered) note.push(`${mastered} retired for good`);
  if (next && next !== 'today') note.push(`next review ${next}`);
  $('#harvestNote').textContent = note.join(' · ');

  box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
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
  if (isText(deck)) introduceChunks(deck);
  const cards = deckCards(deck.id);
  const mastered = cards.filter((c) => c.mastered);
  const plan = tonight(deck, today);
  const left = deckLeftTonight(deck, today);

  $('#deckKindLabel').textContent = isCurriculum(deck) ? 'Guided curriculum' : 'Deck';
  $('#deckTitle').textContent = deck.name;
  $('#statTotal').textContent = cards.length;
  $('#statMastered').textContent = mastered.length;
  $('#statStreak').textContent = liveStreak();
  $('#quickPathLabel').textContent = isCurriculum(deck) ? 'The path' : 'Topics';

  /* Start session is the globe for this deck, so a second button offering the
     same thing was just noise. The quick row keeps a way back to plain cards. */
  $('#globeLaunch').hidden = true;
  const studyQuick = $('.quick[data-go="study"]');
  if (studyQuick) {
    studyQuick.hidden = deck.id === WORLD_DECK;      // no card entrance at all
    studyQuick.querySelector('span').textContent = 'Study';
  }
  $('.quick-row').classList.toggle('three', deck.id === WORLD_DECK);

  const btn = $('#deckStart');
  if (!cards.length) {
    $('#deckSub').textContent = isText(deck)
      ? 'Nothing to memorize yet. Paste a passage and it will be broken into lines.'
      : 'Empty deck. Add cards, paste a list, or make some from your notes.';
    btn.querySelector('span').textContent = isText(deck) ? 'Paste a passage' : 'Add cards';
    btn.dataset.action = 'add'; btn.disabled = false;
  } else if (!left) {
    const next = upcoming(cards);
    const held = !isText(deck) && plan.waiting && !plan.room;
    const didToday = reviewedInDeckToday(deck.id, today);
    /* "Nothing due. Next review today." was the old message here — finishing
       the night's dose is not the same as having nothing left. */
    $('#deckSub').textContent = held
      ? `Box 1 is full — clear those before anything new. ${plan.waiting} cards are waiting their turn.`
      : didToday ? `Done for tonight — ${didToday} card${didToday === 1 ? '' : 's'}.${next && next !== 'today' ? ` Next review ${next}.` : ''}`
      : next && next !== 'today' ? `Nothing due. Next review ${next}.`
      : cards.every((c) => c.mastered) ? 'Every card is mastered. 🎉'
      : 'Nothing due tonight.';
    btn.querySelector('span').textContent = 'Study ahead anyway';
    btn.dataset.action = 'ahead';
    btn.disabled = cards.every((c) => c.mastered);
  } else {
    const unit = isText(deck) ? 'line' : 'card';
    /* Say what tonight is made of. "15 due" over a deck of 465 read as a debt;
       "8 reviews · 7 new" says what you are actually about to do. */
    const bits = [];
    if (!isText(deck)) {
      const r = Math.min(plan.reviews.length, left);
      const n = Math.max(0, left - r);
      if (r) bits.push(`${r} review${r === 1 ? '' : 's'}`);
      if (n) bits.push(`${n} new`);
    }
    $('#deckSub').textContent = bits.length
      ? `Tonight: ${bits.join(' · ')}.`
      : `${left} ${unit}${left === 1 ? '' : 's'} due today.`;
    btn.querySelector('span').textContent = deck.id === WORLD_DECK ? 'Spin the globe' : 'Start session';
    btn.dataset.action = 'study'; btn.disabled = false;
  }

  /* The boxes hold cards you have actually studied. Everything else is still
     in the pool, and gets its own row — dumping it into Box 1 was what made a
     465-card deck look like 455 cards owed every night. */
  const boxed = [1, 2, 3, 4, 5].map((b) => cards.filter((c) => inBox(c, b)));
  const waiting = cards.filter(isNew).length;
  const max = Math.max(1, ...boxed.map((l) => l.length), mastered.length);
  const rows = boxed.map((list, i) => {
    const b = i + 1;
    const dueN = list.filter((c) => isReview(c, today)).length;
    const every = b === 1 ? 'every day' : `every ${INTERVALS[b]} days`;
    return `<div class="box-row"><b>Box ${b}</b>
      <div class="bar"><i style="width:${(list.length / max) * 100}%"></i></div>
      <span class="n ${dueN ? 'due' : ''}">${list.length}${dueN ? ` · ${dueN} due` : ''}<em class="every">${every}</em></span></div>`;
  });
  rows.push(`<div class="box-row done"><b>Mastered</b>
      <div class="bar"><i style="width:${(mastered.length / max) * 100}%"></i></div>
      <span class="n">${mastered.length}</span></div>`);
  const leeches = cards.filter((c) => (c.lapses || 0) >= 4 && !c.mastered);
  if (leeches.length) {
    rows.push(`<div class="box-row leech"><b>Fighting you</b>
      <div class="bar"></div>
      <span class="n">${leeches.length}<em class="every">missed 4+ times — worth rewording</em></span></div>`);
  }
  if (waiting) {
    const room = Math.max(0, BOX1_LIMIT - boxed[0].length);
    rows.push(`<div class="box-row pool"><b>Not started</b>
      <div class="bar"></div>
      <span class="n">${waiting}<em class="every">${room ? `${Math.min(room, waiting)} can start tonight` : 'Box 1 is full — clear it first'}</em></span></div>`);
  }
  $('#boxes').innerHTML = rows.join('');

  const groups = new Map();
  cards.forEach((c) => {
    const k = c.category || 'Untagged';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  });
  $('#topicHead').textContent = isCurriculum(deck) ? 'By phase' : 'By topic';
  $('#catList').innerHTML = groups.size
    /* If a deck was designed in an order, show its topics in that order —
       sorting by size buried "How to Know Things" under whichever phase
       happened to be largest. */
    ? [...groups.entries()].sort((a, b) => (cards.some((c) => c.seq != null)
        ? Math.min(...a[1].map((c) => c.seq ?? 1e9)) - Math.min(...b[1].map((c) => c.seq ?? 1e9))
        : b[1].length - a[1].length)).map(([name, list]) => `<div class="cat-row">
        <span class="dot" style="background:${deck.color}"></span>
        <span class="name">${esc(name)}</span>
        <span class="meta">${list.length} cards · ${list.filter((c) => c.mastered).length} mastered${list.filter((c) => isReview(c, today)).length ? ` · ${list.filter((c) => isReview(c, today)).length} to review` : ''}</span>
      </div>`).join('')
    : '<p class="hint">Topics appear here once cards are tagged.</p>';
}

function upcoming(cards) {
  const live = cards.filter((c) => !c.mastered && (!c.passageId || c.intro));
  const keys = live.map(nextDueKey).filter(Boolean).sort();
  if (!keys.length && cards.some((c) => c.passageId && !c.intro)) return 'tomorrow';   // more lines release then
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
      const due = list.filter((c) => isReview(c, today)).length;
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
      const due = own.filter((c) => isReview(c, today)).length;
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
  const due = own.filter((c) => isReview(c)).length;
  const fresh = own.filter(isNew).length;
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
  $('#nodeStats').textContent = [
    `${own.length} cards`,
    `${m} mastered`,
    due ? `${due} to review` : fresh === own.length ? 'not started yet' : null,
  ].filter(Boolean).join(' · ');
  $('#nodeStudy').disabled = own.length === 0;
  $('#nodeScrim').hidden = false;
}
const closeNode = () => { $('#nodeScrim').hidden = true; };

/* ───────────────────────── session ───────────────────────── */
let session = null;

let cameFrom = 'deck';
/* if you committed to 10 a day for this deck, a session is 10 — not the global target */
/* What a deck asks for in a night, before any habit overrides it. A deck can
   carry its own pace (mental math wants ten, not fifteen); otherwise the
   global target applies. */
function deckDaily(deck) {
  if (!deck) return state.settings.target;
  if (isText(deck)) return 1;
  return deck.daily || state.settings.target;
}
/* A passage's nightly dose is set in words by introduceChunks, not in lines,
   so a text deck serves every line it released. Capping it at the habit's
   "a line a day" made the deck promise 1 and the session serve 3. */
function sessionSize(deck) {
  if (isText(deck)) return deckCards(deck.id).filter((c) => isDue(c, dayKey())).length || 1;
  const h = liveHabits().find((x) => x.deckId === deck.id && x.amount > 0);
  return h ? h.amount : deckDaily(deck);
}
function startSession(filter = null, studyAhead = false) {
  const deck = activeDeck(); if (!deck) return;
  const today = dayKey();
  let pool = deckCards(deck.id);
  if (filter && filter.type === 'principle') pool = pool.filter((c) => c.principle === filter.value);
  if (filter && filter.type === 'category') pool = pool.filter((c) => (c.category || 'Untagged') === filter.value);

  if (isText(deck)) introduceChunks(deck);

  /* Reviews are owed; new cards are a choice. Box 2+ cards scheduled for
     tonight come first, then Box 1 (the every-day box), and only then does
     new material fill what is left — and only while Box 1 has room. */
  const plan = tonight(deck, today, pool);
  const reviews = plan.reviews;
  let fresh = intake(plan.unseen, deck).slice(0, plan.room);
  const overdueBy = (c) => daysBetween(c.lastReviewed, today) - INTERVALS[c.box];
  const scheduled = reviews.filter((c) => c.box >= 2).sort((a, b) => overdueBy(b) - overdueBy(a));
  const lapsed = shuffle(reviews.filter((c) => c.box === 1));

  /* Studying a topic on purpose, or asking to go ahead, overrides the pacing —
     it is a deliberate act, not the nightly dose. */
  if (studyAhead || filter) {
    const seen = new Set([...scheduled, ...lapsed, ...fresh].map((c) => c.id));
    const extra = pool.filter((c) => !c.mastered && !seen.has(c.id) && (!c.passageId || c.intro));
    fresh = [...fresh, ...intake(extra, deck)];
  }

  /* Reviews come first, but they cannot have the whole night. Ten cards stuck
     in Box 1 were filling every session, so no new card appeared for days and
     the deck looked frozen — same cards, no progress, no end. New material
     keeps at least a third of the session whenever there is any. */
  const size = sessionSize(deck);
  const reviewsFirst = [...scheduled, ...lapsed];
  let due;
  if (fresh.length && reviewsFirst.length > size) {
    const keepForNew = Math.min(fresh.length, Math.max(1, Math.floor(size / 3)));
    due = [...reviewsFirst.slice(0, size - keepForNew), ...fresh.slice(0, keepForNew)];
  } else {
    due = [...reviewsFirst, ...fresh];
  }
  const queue = isText(deck)
    ? pool.filter((c) => isDue(c, today))
        .sort((a, b) => (a.passageId === b.passageId ? a.order - b.order : String(a.passageId).localeCompare(String(b.passageId))))
    : due.slice(0, size);
  session = { queue: isText(deck) ? queue : queue, i: 0, right: 0, wrong: 0, revealed: false, requeued: new Set(), filter, text: isText(deck) };
  $('#sessionDone').hidden = true;
  $('#stage').hidden = session.text;
  $('#answerRow').hidden = session.text;
  $('#memorize').hidden = !session.text;
  session.text ? showChunk() : showCard();
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
  /* A flag card is about the flag, so show it at a size you can actually
     read. The pair of regional-indicator letters is the whole picture. */
  const flagMatch = card.front.match(/^(\p{RI}\p{RI})\s+(.*)$/u);
  if (flagMatch) {
    $('#cardFront').innerHTML = `<span class="big-flag">${esc(flagMatch[1])}</span>${esc(flagMatch[2])}`;
  } else {
    $('#cardFront').textContent = card.front;
  }
  $('#cardBack').textContent = card.back;
  const label = card.category || (activeDeck() || {}).name || '';
  $('#cardCat').textContent = label;
  $('#cardCat').hidden = !label;
  $('#backCard').hidden = !canStepBack();
  $('#cardBox').hidden = false;
  $('#cardBox').textContent = `Box ${card.box}`;
  $('.tap-hint').textContent = hasKeyboard() ? 'tap or press space' : 'tap to reveal';
  const total = session.queue.length;
  $('#progressText').textContent = `${session.i + 1} / ${total}`;
  $('#progressFill').style.width = `${(session.i / total) * 100}%`;
  void slot.offsetWidth;
  slot.classList.add('enter');
}

/* ── the memorize loop ─────────────────────────────────────────── */
function showChunk() {
  if (!session) return;
  const card = session.queue[session.i];
  if (!card) return finishSession();
  const passage = (state.passages || []).find((p) => p.id === card.passageId);
  const stage = card.stage;

  /* A line still being learned has no box yet — showing "Box 1" made the
     ladder look like it had already failed you. */
  $('#cardBox').hidden = card.stage < 4;   // no box until it has entered the ladder
  $('#cardBox').textContent = `Box ${card.box}`;

  $('#backCard').hidden = !canStepBack();
  const lineNo = (card.order ?? 0) + 1;
  const lineCount = passage ? chunksOf(passage.id).length : 0;
  $('#memPassage').textContent = passage
    ? `${passage.title} · line ${lineNo}${lineCount ? ` of ${lineCount}` : ''}`
    : 'Passage';
  $('#memStage').textContent = STAGE_LABEL[stage];
  $('#memDiff').hidden = true;
  $('#memDiff').innerHTML = '';
  const input = $('#memInput');
  input.value = '';

  /* The counter used to sit on the line number while you climbed three rungs
     of the same line — four screens, no movement. Count the rungs too. */
  const total = session.queue.length;
  const climbed = session.i + (STAGE_PROGRESS[stage] ?? 0);
  $('#progressText').textContent = `${session.i + 1} / ${total}`;
  $('#progressFill').style.width = `${(climbed / total) * 100}%`;

  const text = $('#memText');
  const all = passage ? chunksOf(passage.id) : [];
  const idx = all.findIndex((x) => x.id === card.id);
  const lead = $('#memLead');
  lead.hidden = true; lead.innerHTML = '';
  input.hidden = true;
  session.peeked = false;

  if (stage === 0) {
    text.hidden = false; text.className = 'mem-text'; text.textContent = card.front;
    $('#memActions').innerHTML = '<button class="btn primary" data-mem="read">I have read it</button>';
  } else if (stage === 1 || stage === 2) {
    /* the text is taken away a bit at a time rather than all at once */
    text.hidden = false; text.className = 'mem-text cue'; text.textContent = fadeText(card.front, stage);
    $('#memActions').innerHTML =
      '<button class="btn miss" data-mem="missed"><span>Missed it</span></button>' +
      '<button class="btn primary" data-mem="reveal">Say it, then check</button>';
  } else {
    /* the run: the lines before it, then this one from nothing. The joints
       between lines are where a passage falls apart, so they get rehearsed
       every single time rather than never. */
    const from = Math.max(0, idx - CHAIN_WINDOW);
    const run = all.slice(from, idx);
    lead.hidden = !run.length;
    lead.innerHTML = run.map((c) => `<span class="run-line">${esc(firstLetters(c.front))}</span>`).join('');
    text.hidden = false; text.className = 'mem-text cue blank';
    text.textContent = run.length ? '… and then?' : 'Say the opening line.';
    $('#memActions').innerHTML =
      '<button class="btn miss" data-mem="missed"><span>Missed it</span></button>' +
      '<button class="btn primary" data-mem="reveal">Say it, then check</button>';
  }
  if (stage < 2) { text.classList.remove('lead-in'); }
  /* You were learning line 7 having never seen the piece whole. The context
     is collapsed by default so it can't be used as a crutch. */
  const peekBtn = $('#memPeekBtn');
  peekBtn.hidden = !(stage === 1 || stage === 2);
  peekBtn.textContent = 'Show me the line';
  const ctx = $('#memContext'), ctxBtn = $('#memContextBtn');
  ctx.hidden = true;
  ctxBtn.textContent = 'Show the whole passage';
  ctxBtn.hidden = !passage;
  if (passage) {
    ctx.innerHTML = chunksOf(passage.id).map((c) => {
      const state = c.mastered ? 'done' : c.id === card.id ? 'here' : c.intro ? 'seen' : 'later';
      return `<span class="ctx-line ${state}">${esc(c.front)}</span>`;
    }).join(' ');
  }

  $('#memorize').classList.remove('enter'); void $('#memorize').offsetWidth; $('#memorize').classList.add('enter');
}

function memAction(what) {
  if (!session) return;
  const card = session.queue[session.i];
  if (!card) return;


  if (what === 'peek') {
    /* a peek you cannot take back is just the answer */
    const t = $('#memText');
    const cued = t.classList.contains('cue');        // currently showing the letters
    t.classList.toggle('cue', !cued);
    t.textContent = cued ? card.front : firstLetters(card.front);
    const btn = $('#memPeekBtn');
    if (btn) btn.textContent = cued ? 'Hide the line' : 'Show me the line';
    return;
  }
  if (what === 'hint') { $('#memDiff').hidden = false; $('#memDiff').innerHTML = `<span class="cue-inline">${esc(firstLetters(card.front))}</span>`; return; }

  if (what === 'check') {
    /* Checking an empty box used to count as a miss and knock the line back a
       rung. Nothing typed is not a wrong answer. */
    if (!$('#memInput').value.trim()) {
      toast('Type what you remember first.', 'bad');
      $('#memInput').focus();
      return;
    }
    const result = gradeTyping(card.front, $('#memInput').value);
    $('#memDiff').hidden = false;
    $('#memDiff').innerHTML = result.marks.map((m) => `<span class="${m.ok ? 'ok' : 'no'}">${esc(m.word)}</span>`).join(' ');
    if (result.exact) {
      toast('Word perfect.', 'good'); buzz(14);
      snapshotStep(card);
      advanceChunk(card, true); session.right++;
      setTimeout(nextChunk, 900);
    } else {
      toast(`${result.wrong} word${result.wrong === 1 ? '' : 's'} off.`, 'bad'); buzz(24);
      /* Show the line itself. The marked-up diff alone left you guessing at
         what you were meant to have written. */
      $('#memDiff').insertAdjacentHTML('beforeend',
        `<p class="mem-truth"><span>the line was</span>${esc(card.front)}</p>`);
      snapshotStep(card);
      advanceChunk(card, false); session.wrong++;
      $('#memActions').innerHTML = '<button class="btn primary" data-mem="continue">Got it — keep going</button>';
      $('#backCard').hidden = !canStepBack();   // the miss itself is undoable
    }
    return;
  }

  if (what === 'read') { snapshotStep(card); advanceChunk(card, true); return showChunk(); }

  /* Say it out loud, then see the line and mark yourself. Speaking is how you
     will actually deliver it, and it keeps a session to a couple of minutes
     instead of typing every word. */
  if (what === 'reveal') {
    $('#memLead').hidden = true;
    const t = $('#memText');
    t.className = 'mem-text shown';
    t.textContent = card.front;
    $('#memActions').innerHTML =
      '<button class="btn miss" data-mem="missed"><span>Missed it</span></button>' +
      '<button class="btn got" data-mem="had"><span>I had it</span></button>';
    return;
  }
  if (what === 'missed' && !$('#memText').classList.contains('shown')) {
    /* Missing it is when you most need to see the line. Show it, then move on
       — one tap to record the miss, not two. */
    $('#memLead').hidden = true;
    const t = $('#memText');
    t.className = 'mem-text shown';
    t.textContent = card.front;
    $('#memActions').innerHTML =
      '<button class="btn primary" data-mem="missed">Got it — keep going</button>';
    return;
  }
  if (what === 'had' || what === 'missed') {
    const ok = what === 'had';
    snapshotStep(card);
    advanceChunk(card, ok);
    ok ? session.right++ : session.wrong++;
    buzz(ok ? 12 : 22);
    /* A line still climbing comes back later in the same session rather than
       immediately: spacing inside the session is the point, and showing the
       same line four times in a row is what made this feel like a treadmill. */
    if (card.stage < 4 && !session.requeued.has(card.id + ':' + card.stage)) {
      session.requeued.add(card.id + ':' + card.stage);
      session.queue.push(card);
    }
    return nextChunk();
  }

  /* typing stays available for anyone who wants the strict version */
  if (what === 'type') {
    const input = $('#memInput');
    input.hidden = false; input.value = '';
    input.placeholder = 'Type the line…';
    $('#memActions').innerHTML =
      '<button class="btn ghost" data-mem="hint">Hint</button>' +
      '<button class="btn primary" data-mem="check">Check</button>';
    setTimeout(() => input.focus(), 60);
    return;
  }
  if (what === 'continue') return nextChunk();
}

function nextChunk() {
  bumpDaily();          // one line = one unit of tonight's work, however many rungs it took
  session.i++;
  $('#progressFill').style.width = `${(session.i / session.queue.length) * 100}%`;
  session.i >= session.queue.length ? finishSession() : showChunk();
}

/* Undo for the last step. Snapshot everything a grade touches — the card, the
   session counters, the day's tallies — so going back really goes back rather
   than leaving a promotion behind. */
function snapshotStep(card) {
  if (!session) return;
  session.history = session.history || [];
  session.history.push({
    i: session.i,
    card: { ...card },
    right: session.right, wrong: session.wrong,
    queueLen: session.queue.length,
    requeued: [...(session.requeued || [])],
    daily: JSON.parse(JSON.stringify(state.daily || {})),
    streak: { ...(state.streak || {}) },
  });
  if (session.history.length > 40) session.history.shift();
}
function stepBack() {
  if (!session || !session.history || !session.history.length) return;
  const h = session.history.pop();
  const live = state.cards.find((c) => c.id === h.card.id);
  if (live) Object.assign(live, h.card);
  /* a missed card may have been pushed back onto the queue — undo that too */
  if (session.queue.length > h.queueLen) session.queue.length = h.queueLen;
  session.requeued = new Set(h.requeued);
  session.i = h.i;
  session.right = h.right; session.wrong = h.wrong;
  state.daily = h.daily; state.streak = h.streak;
  session.revealed = false;
  save();
  $('#sessionDone').hidden = true;
  buzz(8);
  session.text ? showChunk() : showCard();
}
const canStepBack = () => !!(session && session.history && session.history.length);

function bumpDaily(deckId = state.activeDeck) {
  bumpStreak();
  const today = dayKey();
  const base = state.daily && state.daily.day === today ? state.daily : { day: today, count: 0, decks: {} };
  base.decks = base.decks || {};
  base.count += 1;
  if (deckId) base.decks[deckId] = (base.decks[deckId] || 0) + 1;
  state.daily = base;
  writeNow();
}

/* First tap reveals; every tap after that flips between question and answer.
   `revealed` stays true once set — you have seen it, so the grading buttons
   remain live even while you are looking at the question again. */
/* Only mention keys on something that has them. */
const hasKeyboard = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

function reveal() {
  if (!session) return;
  const fc = $('#flashcard'), slot = $('#cardSlot');
  /* A card on its way out is not yours to tap. Without this, a quick second
     tap landed on the outgoing card during its 320ms exit. */
  if (slot.classList.contains('leave-left') || slot.classList.contains('leave-right')) return;
  if (!session.revealed) {
    session.revealed = true;
    fc.classList.add('flipped');
    $('.tap-hint').textContent = hasKeyboard() ? 'space to flip back' : 'tap to flip back';
    buzz(8);
  } else {
    fc.classList.toggle('flipped');
    buzz(5);
  }
  /* Derive the buttons from whether the answer has been seen, never from a
     class that can drift out of step. A flip-back used to strand the session
     showing the answer with no way to grade it. */
  $('#answerRow').classList.toggle('on', session.revealed);
}

function answer(correct) {
  if (!session || !session.revealed) return;
  /* Two fast taps on "Got it" used to grade one card twice — the second
     landed while the first was still animating out. */
  const slot = $('#cardSlot');
  if (slot.classList.contains('leave-left') || slot.classList.contains('leave-right')) return;
  const card = session.queue[session.i];
  snapshotStep(card);
  grade(card, correct);
  correct ? session.right++ : session.wrong++;
  bumpDaily();
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

/* Anything another tab sent while you were mid-session is folded in now. */
function applyPendingMerge() {
  if (!pendingMerge || session || gsession) return;
  const raw = pendingMerge;
  pendingMerge = null;
  adoptExternalWrite(raw);
}

function finishSession() {
  const answered = session.right + session.wrong;
  $('#stage').hidden = true;
  $('#answerRow').hidden = true;
  $('#memorize').hidden = true;
  $('#sessionDone').hidden = false;
  const pct = answered ? Math.round((session.right / answered) * 100) : 0;
  $('#donePct').textContent = pct + '%';
  const ring = $('#doneRing');
  ring.style.strokeDashoffset = 327;
  requestAnimationFrame(() => { ring.style.strokeDashoffset = 327 - (327 * pct) / 100; });
  /* "Still waiting" used to count every untouched card in the deck — 455 of
     them — which reads as a debt when it is really just the deck's future.
     Only cards you have actually met and owe a review can be behind. */
  const owed = deckCards().filter((c) => isDue(c) && c.lastReviewed).length;
  /* what the work bought you, and where it goes next — direction beats a score */
  const touched = (session.queue || []).filter((c) => c.lastReviewed === dayKey());
  const moved = touched.filter((c) => c.box > 1 && !c.mastered).length;
  const retired = touched.filter((c) => c.mastered).length;
  const next = upcoming(deckCards());
  const parts = [];
  if (!answered) parts.push('Nothing was due here — enjoy the night off');
  else {
    parts.push(`${session.right} right, ${session.wrong} missed`);
    if (moved) parts.push(`${moved} moved up a box`);
    if (retired) parts.push(`${retired} retired for good`);
    if (owed) parts.push(`${owed} review${owed === 1 ? '' : 's'} still waiting`);
    else if (next && next !== 'today') parts.push(`next review ${next}`);
  }
  $('#doneSummary').textContent = parts.join(' · ');
  /* Finishing the night is the win. Going again is allowed but never the
     default, and it is labelled for what it is. */
  const again = $('#doneAgain');
  again.hidden = false;
  again.textContent = owed ? 'Clear the rest' : 'Study ahead';
  again.classList.toggle('quiet', owed === 0);
  session = null;
  writeNow();
  applyPendingMerge();
  drainPendingRemote();
  syncAfterWork();

  /* Finishing is the moment you decide the night is handled, so it is the
     moment to be honest about whether the work has actually left. Reported
     here as well as on Today, because this is the screen you are looking at. */
  reportWhereTheWorkIs();
}

function reportWhereTheWorkIs() {
  const el = $('#doneSync');
  if (!el) return;
  const cfg = SYNC.syncConfig(state.settings);
  if (!cfg.on) {
    el.hidden = false;
    el.className = 'done-sync bad';
    el.textContent = 'Saved on this device only — it will not reach your phone.';
    return;
  }
  el.hidden = false;
  el.className = 'done-sync';
  el.textContent = 'Saving to your other devices…';
  /* Tell the truth once the push has had time to land. */
  const started = state.settings.syncedAt;
  setTimeout(() => {
    const moved = state.settings.syncedAt !== started;
    el.className = 'done-sync ' + (moved ? 'ok' : 'bad');
    el.textContent = moved
      ? 'Safely on your other devices.'
      : 'Not synced yet — leave this open a moment, or check Settings.';
  }, 6000);
}

/* ───────────────────────── adding cards ───────────────────────── */
/* Named destructuring silently dropped fields the caller passed — `seq` went
   missing and new cards came out unordered. Take the whole object. */
function addCard(fields) {
  const card = normalizeCard({ category: '', principle: null, source: 'manual', deckId: state.activeDeck, ...fields });
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

  /* text decks take passages, not cards — swap the whole form set */
  const textDeck = isText(deck);
  $('#addModeSeg').hidden = textDeck;
  $('#memForm').hidden = !textDeck;
  if (textDeck) {
    ['#addForm', '#pasteForm', '#notesForm', '#genForm'].forEach((s) => { $(s).hidden = true; });
    return;
  }
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

  /* ── memorize form: live estimate, pick your pace ── */
  let chosenAmbition = 'normal';
  const refreshEstimate = () => {
    const text = $('#mText').value;
    const words = wordsIn(text);
    const box = $('#mEstimate');
    if (words < 5) { box.hidden = true; $('#mCreate').disabled = true; return; }
    box.hidden = false; $('#mCreate').disabled = false;
    const options = estimateAll(text);
    const chunks = options[0].chunks;
    box.innerHTML = `<p class="est-head">${words} words · ${chunks} line${chunks === 1 ? '' : 's'} to learn. How hard do you want to push?</p>
      <div class="est-row">${options.map((o) => `
        <button type="button" class="est ${o.id === chosenAmbition ? 'on' : ''}" data-amb="${o.id}">
          <strong>${o.label}</strong>
          <span class="est-days">${o.daysToLearn} day${o.daysToLearn === 1 ? '' : 's'}</span>
          <span class="est-sub">to know it · ${o.minutesPerDay} min/night</span>
          <span class="est-sub dim">mastered in ${o.daysToMaster} days</span>
        </button>`).join('')}</div>
      <p class="hint">Estimates, not promises — based on ${options[0].perDay}–${options[2].perDay} new words a night plus reviews. The mastered date includes the full box ladder after the last line is learned.</p>`;
    $$('#mEstimate .est').forEach((b) => b.addEventListener('click', () => { chosenAmbition = b.dataset.amb; refreshEstimate(); }));
  };
  $('#mText').addEventListener('input', refreshEstimate);

  $('#memForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const deck = activeDeck();
    const text = $('#mText').value.trim();
    if (wordsIn(text) < 5) return toast('Paste a bit more text.', 'bad');
    const p = addPassage(deck, $('#mTitle').value, text, chosenAmbition);
    if (!p) return toast('Could not read that text.', 'bad');
    const n = chunksOf(p.id).length;
    $('#mCount').textContent = `${p.title} · ${n} lines`;
    $('#mCount').classList.add('on');
    $('#mTitle').value = ''; $('#mText').value = '';
    refreshEstimate();
    toast(`Added "${p.title}" — ${n} lines to learn.`, 'good');
    buzz(20);
    /* Adding a passage used to leave you on an empty form with no idea what
       happened next. Land on the deck, where tonight's lines are waiting. */
    go('deck');
  });

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
  /* "New" is its own filter now that unstudied cards sit outside the boxes */
  const LABEL = { all: 'All', new: 'Not started', due: 'Due today', mastered: 'Mastered' };
  $('#boxFilter').innerHTML = ['all', 'new', 1, 2, 3, 4, 5, 'due', 'mastered']
    .map((b) => `<button class="chip ${String(b) === String(filters.box) ? 'on' : ''}" data-box="${b}">${LABEL[b] || 'Box ' + b}</button>`).join('');
  renderList();
}

function matches(card) {
  const today = dayKey();
  if (filters.cat !== 'all' && (card.category || '') !== filters.cat) return false;
  if (filters.box === 'mastered' && !card.mastered) return false;
  if (filters.box === 'due' && !isReview(card, today)) return false;
  if (filters.box === 'new' && !isNew(card)) return false;
  if (!['all', 'new', 'due', 'mastered'].includes(filters.box) && !inBox(card, Number(filters.box))) return false;
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
    const due = isReview(c, today);
    const when = c.mastered ? 'retired' : isNew(c) ? 'not started' : due ? 'due now' : `next ${humanDate(nextDueKey(c))}`;
    return `<article class="mini" data-id="${c.id}" style="animation-delay:${Math.min(i * 20, 320)}ms">
      <div class="q">${esc(c.front)}</div>
      <div class="a">${esc(c.back)}</div>
      <div class="tags">
        ${c.category ? `<span class="tag">${esc(c.category)}</span>` : ''}
        <span class="tag ${c.mastered ? 'mastered' : 'box'}">${c.mastered ? 'Mastered' : 'Box ' + c.box}</span>
        <span class="tag ${due && !c.mastered && !isNew(c) ? 'due' : ''}">${when}</span>
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
  /* A goal aimed at next year read as a bare "Jun 1", which looks like weeks
     away rather than ten months. */
  const d = keyToDate(key);
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
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
    /* Remember it, or the other device hands it straight back. */
    const doomed = state.cards.find((c) => c.id === editingId) || { id: editingId };
    state.deletedCards = { ...(state.deletedCards || {}), [identity(doomed)]: dayKey() };
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
  $('#dKindSeg').addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn'); if (!b) return;
    $$('#dKindSeg .seg-btn').forEach((x) => x.classList.toggle('on', x === b));
    moveThumb($('#dKindSeg'), $('#dKindThumb'));
  });
  $('#dSave').addEventListener('click', () => {
    const name = $('#dName').value.trim();
    if (!name) return toast('Give the deck a name.', 'bad');
    const color = $('#dSwatches .swatch.on')?.dataset.color || DECK_COLORS[0];
    const kind = $('#dKindSeg .seg-btn.on')?.dataset.kind || 'plain';
    if (editingDeck) {
      const d = state.decks.find((x) => x.id === editingDeck);
      if (d) { d.name = name; d.color = color; }
    } else {
      const id = 'deck-' + uid().slice(0, 8);
      state.decks.push({ id, name, color, kind, created: new Date().toISOString() });
      state.activeDeck = id;
    }
    save(); $('#deckScrim').hidden = true;
    editingDeck ? go(current === 'decks' ? 'decks' : 'deck') : go('deck');
    toast(editingDeck ? 'Deck updated.' : 'Deck created.', 'good');
  });
  /* Start the deck again from the beginning without losing the cards. Useful
     when the plan behind a deck has changed and its boxes no longer reflect
     the order you want to learn in. */
  $('#dReset').addEventListener('click', () => {
    const d = state.decks.find((x) => x.id === editingDeck); if (!d) return;
    const cards = deckCards(d.id);
    const touched = cards.filter((c) => c.seen || c.lastReviewed).length;
    const btn = $('#dReset');
    if (btn.dataset.armed !== d.id) {
      btn.dataset.armed = d.id;
      btn.textContent = `Reset ${touched} card${touched === 1 ? '' : 's'} to the start`;
      btn.classList.add('armed');
      setTimeout(() => { if (btn.dataset.armed === d.id) resetDeleteBtn(); }, 5000);
      return;
    }
    cards.forEach((c) => {
      c.box = 1; c.mastered = false; c.lastReviewed = null;
      c.seen = 0; c.right = 0;
      if (c.passageId) { c.stage = 0; c.reps = 0; }     // a passage starts from reading again
    });
    if (state.daily && state.daily.decks) delete state.daily.decks[d.id];
    resetDeleteBtn();
    save(); $('#deckScrim').hidden = true;
    go(current === 'decks' ? 'decks' : 'deck');
    toast(`${d.name} is back at the start.`, 'good');
  });
  $('#dDelete').addEventListener('click', () => {
    const d = state.decks.find((x) => x.id === editingDeck); if (!d) return;
    const n = deckCards(d.id).length;
    const btn = $('#dDelete');
    /* Two taps, in the sheet. A browser confirm() is easy to dismiss by
       reflex on a phone and cannot say what is about to be lost. */
    if (btn.dataset.armed !== d.id) {
      btn.dataset.armed = d.id;
      btn.textContent = `Delete ${n} card${n === 1 ? '' : 's'} for good`;
      btn.classList.add('armed');
      setTimeout(() => { if (btn.dataset.armed === d.id) resetDeleteBtn(); }, 5000);
      return;
    }
    resetDeleteBtn();
    state.cards = state.cards.filter((c) => c.deckId !== d.id);
    state.passages = (state.passages || []).filter((x) => x.deckId !== d.id);
    state.decks = state.decks.filter((x) => x.id !== d.id);
    /* A built-in deck would otherwise be recreated on the next load, so
       deleting it would look broken. Remember the decision. */
    state.removed = [...new Set([...(state.removed || []), d.id])];
    state.habits = (state.habits || []).filter((h) => h.deckId !== d.id);
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
    ['#scrim', '#deckScrim', '#nodeScrim', '#reviewScrim', '#habitScrim', '#goalScrim'].forEach((s) => { if (!$(s).hidden) $(s).hidden = true; });
  });
}

/* ── habit + goal sheets ───────────────────────────────────────── */
let editingHabit = null;
function openHabitSheet(id = null) {
  editingHabit = id;
  const h = id ? habitById(id) : null;
  $('#habitTitle').textContent = h ? 'Edit seed' : 'Plant a seed';
  $('#hName').value = h ? h.name : '';
  $('#hFloor').value = h ? (h.floor || '') : '';
  $('#hCadence').innerHTML = Object.values(CADENCE).map((c) => `<option value="${c.id}">${c.label}</option>`).join('');
  $('#hCadence').value = h ? h.cadence : 'daily';
  $('#hGoal').innerHTML = '<option value="">On its own</option>' +
    (state.goals || []).map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('');
  $('#hGoal').value = h ? (h.goalId || '') : '';
  $('#hLink').innerHTML = '<option value="">Not linked — I tick it myself</option>' +
    state.decks.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
  $('#hLink').value = h ? (h.deckId || '') : '';
  $('#hAmount').value = h ? (h.amount || 15) : 15;
  $('#hAmountField').hidden = !$('#hLink').value;
  $('#hGate').setAttribute('aria-checked', String(h ? !!h.gate : false));
  $('#hDelete').hidden = !h;
  $('#habitScrim').hidden = false;
  setTimeout(() => $('#hName').focus(), 200);
}
const closeHabitSheet = () => { $('#habitScrim').hidden = true; editingHabit = null; };

let editingGoal = null;
function renderTreePicker(current) {
  $('#gTree').innerHTML = TREE_KINDS.map((k) => `
    <button type="button" class="tree-pick ${k.id === current ? 'on' : ''}" data-tree="${k.id}" title="${esc(k.hint)}">
      <span class="tree-pick-art">${treeSVG({ stage: 4, health: 1, kind: k.id })}</span>
      <span class="tree-pick-name">${esc(k.name)}</span>
    </button>`).join('');
  $$('#gTree .tree-pick').forEach((b) => b.addEventListener('click', () => {
    $$('#gTree .tree-pick').forEach((x) => x.classList.toggle('on', x === b));
  }));
}

function openGoalSheet(id = null) {
  editingGoal = id;
  const g = id ? (state.goals || []).find((x) => x.id === id) : null;
  $('#goalTitle').textContent = g ? 'Edit goal' : 'New goal';
  $('#gName').value = g ? g.name : '';
  $('#gWhy').value = g ? (g.why || '') : '';
  $('#gDate').value = g ? (g.targetDate || '') : '';
  renderTreePicker(g ? (g.tree || 'oak') : 'oak');
  $('#gDelete').hidden = !g;
  $('#goalScrim').hidden = false;
  setTimeout(() => $('#gName').focus(), 200);
}
const closeGoalSheet = () => { $('#goalScrim').hidden = true; editingGoal = null; };

function setupPlanner() {
  /* #newHabitBtn and #newGoalBtn are drawn by the grove, so they do not exist
     yet at boot. Binding them here threw, and because every listener in this
     function sat behind that one line, the whole seed and goal editor was
     never wired: no save, no delete, not even cancel. They bind per render. */
  on('#gatePauseBtn', 'click', () => {
    if (gatePaused()) { setGatePause(null); toast('Gate back on.'); return; }
    setGatePause(dayKey());
    toast('Gate paused for today. It comes back tomorrow.', 'good');
  });
  on('#hCancel', 'click', closeHabitSheet);
  on('#gCancel', 'click', closeGoalSheet);
  on('#habitScrim', 'click', (e) => { if (e.target === $('#habitScrim')) closeHabitSheet(); });
  on('#goalScrim', 'click', (e) => { if (e.target === $('#goalScrim')) closeGoalSheet(); });
  $('#hGate').addEventListener('click', () => {
    const on = $('#hGate').getAttribute('aria-checked') !== 'true';
    $('#hGate').setAttribute('aria-checked', String(on));
    /* a habit you do at bedtime would hold the gate shut all day */
    $('#hGateHint').textContent = on
      ? 'Blocks YouTube and Instagram until it is done — so keep this for things you can do early.'
      : 'Tracked, but never blocks anything.';
  });
  $('#hLink').addEventListener('change', () => { $('#hAmountField').hidden = !$('#hLink').value; });

  $('#hSave').addEventListener('click', () => {
    const name = $('#hName').value.trim();
    if (!name) return toast('Give the seed a name.', 'bad');
    const fields = {
      name,
      floor: $('#hFloor').value.trim(),
      cadence: $('#hCadence').value,
      goalId: $('#hGoal').value || null,
      deckId: $('#hLink').value || null,
      amount: Math.max(1, Number($('#hAmount').value) || 1),
      gate: $('#hGate').getAttribute('aria-checked') === 'true',
    };
    state.habits = state.habits || [];
    if (editingHabit) Object.assign(habitById(editingHabit), fields);
    else state.habits.push({ id: 'h-' + uid().slice(0, 8), created: new Date().toISOString(), ...fields });
    /* an edit can change anything on the card, so rebuild rather than patch */
    groveSig = null;
    save(); closeHabitSheet(); renderToday();
    toast(editingHabit ? 'Seed updated.' : 'Seed planted.', 'good');
  });
  $('#hDelete').addEventListener('click', () => {
    if (!confirm('Delete this seed? Its history goes too.')) return;
    state.habits = (state.habits || []).filter((h) => h.id !== editingHabit);
    if (state.log) delete state.log[editingHabit];
    groveSig = null;
    save(); closeHabitSheet(); renderToday(); toast('Seed removed.');
  });

  $('#gSave').addEventListener('click', () => {
    const name = $('#gName').value.trim();
    if (!name) return toast('Give the goal a name.', 'bad');
    const fields = {
      name, why: $('#gWhy').value.trim(), targetDate: $('#gDate').value || null,
      tree: ($('#gTree .tree-pick.on') || {}).dataset?.tree || 'oak',
    };
    state.goals = state.goals || [];
    if (editingGoal) Object.assign(state.goals.find((g) => g.id === editingGoal), fields);
    else state.goals.push({ id: 'g-' + uid().slice(0, 8), created: new Date().toISOString(), ...fields });
    groveSig = null;
    save(); closeGoalSheet();
    renderToday();
    toast(editingGoal ? 'Goal updated.' : 'Goal added.', 'good');
  });
  $('#gDelete').addEventListener('click', () => {
    if (!confirm('Delete this goal? Its seeds stay, just unlinked.')) return;
    state.goals = (state.goals || []).filter((g) => g.id !== editingGoal);
    (state.habits || []).forEach((h) => { if (h.goalId === editingGoal) h.goalId = null; });
    groveSig = null;
    save(); closeGoalSheet(); go('today'); toast('Goal deleted.');
  });
}

let editingDeck = null;
function resetDeleteBtn() {
  const btn = $('#dDelete');
  delete btn.dataset.armed;
  btn.textContent = 'Delete deck';
  btn.classList.remove('armed');
  const r = $('#dReset');
  delete r.dataset.armed;
  r.textContent = 'Reset progress';
  r.classList.remove('armed');
}
function openDeckSheet(deckId = null) {
  resetDeleteBtn();
  editingDeck = deckId;
  const d = deckId ? state.decks.find((x) => x.id === deckId) : null;
  $('#deckModalTitle').textContent = d ? 'Edit deck' : 'New deck';
  $('#dName').value = d ? d.name : '';
  $('#dDelete').hidden = !d;
  $('#dReset').hidden = !d || !deckCards(deckId).some((c) => c.seen || c.lastReviewed);
  $('#dKindField').hidden = !!d;                      // kind is fixed once cards exist
  $$('#dKindSeg .seg-btn').forEach((b) => b.classList.toggle('on', b.dataset.kind === 'plain'));
  requestAnimationFrame(() => moveThumb($('#dKindSeg'), $('#dKindThumb')));
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
  const off = state.settings.gatePause === 'off';
  $('#gateSwitch').setAttribute('aria-checked', String(!off));
  $('#gateStateHint').textContent = off
    ? 'Off. Nothing is blocked, whatever is left undone.'
    : state.settings.gatePause === dayKey()
      ? 'Paused for today. It comes back tomorrow.'
      : "Blocks the entertainment sites until today's seeds are done.";
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
  $('#gateSwitch').addEventListener('click', () => {
    const off = state.settings.gatePause === 'off';
    setGatePause(off ? null : 'off');
    toast(off ? 'Gate back on.' : 'Gate off. Nothing is blocked.');
  });

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
      state.passages = state.passages || [];
      (data.passages || []).forEach((p) => { if (!state.passages.some((x) => x.id === p.id)) state.passages.push(p); });
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
    /* Take a copy first: a mis-tap here should still be walkable-back. */
    try { rotateBackup(localStorage.getItem(STORE_KEY) || '', true); } catch (_) {}
    const key = state.settings.apiKey;
    resetting = true;
    state = defaultState();
    state.settings.apiKey = key;
    highWater = 0;
    seed();
    writeNow();
    resetting = false;
    go('decks'); toast('Everything cleared.');
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
  const removed = new Set(state.removed || []);
  let math = state.decks.find((d) => d.id === MATH_DECK);
  if (!math && !removed.has(MATH_DECK)) {
    math = { id: MATH_DECK, name: 'Mental Math', color: DECK_COLORS[4], kind: 'plain', created: new Date().toISOString() };
    state.decks.push(math);
  }
  /* Built for ten a night — arithmetic sticks by repetition, not volume. */
  if (math && !math.daily) math.daily = 10;
  if (math) math.ordered = true;                 // arithmetic builds on itself

  let world = state.decks.find((d) => d.id === WORLD_DECK);
  if (!world && !removed.has(WORLD_DECK)) {
    world = { id: WORLD_DECK, name: 'Countries of the World', color: DECK_COLORS[2], kind: 'plain', created: new Date().toISOString() };
    state.decks.push(world);
  }
  if (world && !world.daily) world.daily = 20;
  let uvu = state.decks.find((d) => d.id === UVU_DECK);
  if (!uvu && !removed.has(UVU_DECK)) {
    uvu = { id: UVU_DECK, name: 'UVU Tour Guide', color: DECK_COLORS[5] || DECK_COLORS[0], kind: 'plain', created: new Date().toISOString() };
    state.decks.push(uvu);
  }
  /* An exam with a date on it: bigger nightly dose, and in the guide's order
     so a section can be drilled whole. */
  if (uvu && !uvu.daily) uvu.daily = 20;
  if (uvu) uvu.ordered = true;

  /* The separate leaders deck is retired: its questions are asked on the globe
     alongside the country they belong to. Cards that were studied keep their
     progress — they move into the countries deck rather than being dropped. */
  const oldLeaders = state.decks.find((d) => d.id === LEADERS_DECK);
  if (oldLeaders) {
    const keep = new Set(LEADER_ONE.map((c) => c.group));
    state.cards.forEach((c) => {
      if (c.deckId !== LEADERS_DECK) return;
      if (keep.has(c.group) && /^(Who leads|Head of government of)/.test(c.front)) {
        c.deckId = WORLD_DECK;
        c.front = `Who leads ${META[c.group] ? META[c.group].n : c.front.replace(/^.*? of /, '').replace(/\?$/, '')}?`;
      } else c.deckId = '__drop';
    });
    state.cards = state.cards.filter((c) => c.deckId !== '__drop');
    state.decks = state.decks.filter((d) => d.id !== LEADERS_DECK);
    state.habits = (state.habits || []).filter((h) => h.deckId !== LEADERS_DECK);
    state.removed = [...new Set([...(state.removed || []), LEADERS_DECK])];
  }

  /* Core Human Knowledge is retired at Reed's request — a deck you are not
     glad to see is a deck you will not do, and a deck you will not do makes
     every other deck feel like a chore. Recorded in `removed` so it does not
     come back on the next load, and so the decision reaches the other device
     rather than being undone by it. */
  if (!state.removed.includes(KNOWLEDGE_DECK)) {
    state.cards = state.cards.filter((c) => c.deckId !== KNOWLEDGE_DECK);
    state.decks = state.decks.filter((d) => d.id !== KNOWLEDGE_DECK);
    state.habits = (state.habits || []).filter((h) => h.deckId !== KNOWLEDGE_DECK);
    state.passages = (state.passages || []).filter((p) => p.deckId !== KNOWLEDGE_DECK);
    state.removed = [...new Set([...state.removed, KNOWLEDGE_DECK])];
  }

  if (state.seedVersion < SEED_VERSION) {
    const mathHave = existingFronts(MATH_DECK);
    [...MATH_CARDS].reverse().forEach((c, revIdx) => {
      const key = c.front.trim().toLowerCase();
      if (mathHave.has(key)) return;
      addCard({ ...c, deckId: MATH_DECK, source: 'seed', seq: MATH_CARDS.length - 1 - revIdx });
      mathHave.add(key);
    });

    for (const [deckId, list] of [[WORLD_DECK, [...COUNTRY_CARDS, ...LEADER_ONE]], [UVU_DECK, UVU_CARDS]]) {
      if (removed.has(deckId)) continue;
      const seen = existingFronts(deckId);
      [...list].reverse().forEach((c, revIdx) => {
        const key = c.front.trim().toLowerCase();
        if (seen.has(key)) return;
        addCard({ ...c, deckId, source: 'seed', seq: list.length - 1 - revIdx });
        seen.add(key);
      });
      /* Cards seeded before groups existed have none, so they would each be
         scattered alone. Backfill from the current set. */
      const byFrontKey = new Map(list.map((c) => [c.front.trim().toLowerCase(), c]));
      deckCards(deckId).forEach((c) => {
        if (c.group) return;
        const match = byFrontKey.get(c.front.trim().toLowerCase());
        if (match && match.group) c.group = match.group;
      });
    }

    const have = existingFronts(CURRICULUM_DECK);
    let added = 0;
    /* push in curriculum order so the deck reads top-down */
    const total = CURRICULUM_CARDS.length;
    [...CURRICULUM_CARDS].reverse().forEach((c, revIdx) => {
      if (have.has(c.front.trim().toLowerCase())) return;
      addCard({ ...c, deckId: CURRICULUM_DECK, source: 'seed', seq: total - 1 - revIdx });
      have.add(c.front.trim().toLowerCase());
      added++;
    });
    /* Re-tag everything against the current curriculum: order, phase, principle.
       The curriculum was reordered, so a card's old position is meaningless. */
    const byFront = new Map(CURRICULUM_CARDS.map((c, i) => [c.front.trim().toLowerCase(), { ...c, i }]));
    deckCards(CURRICULUM_DECK).forEach((c) => {
      const match = byFront.get(c.front.trim().toLowerCase());
      if (match) { c.seq = match.i; c.principle = match.principle; c.category = match.category; }
    });

    /* Cards from a previous curriculum that no longer exist are retired, even
       if you studied them. Keeping them "so progress is not lost" was worse
       than losing it: they stayed in their Leitner boxes, and reviews are
       served before new material, so a replaced curriculum kept pushing its
       old strategy cards in front of the language of business you had
       deliberately put first. A card that is no longer in the plan should not
       be on tonight's list. */
    const before = state.cards.length;
    state.cards = state.cards.filter((c) => {
      if (c.deckId !== CURRICULUM_DECK || c.source !== 'seed') return true;
      return byFront.has(c.front.trim().toLowerCase());
    });
    const pruned = before - state.cards.length;
    if (pruned) console.info(`Curriculum: retired ${pruned} cards that are no longer in the curriculum.`);
    state.seedVersion = SEED_VERSION;
    if (added) console.info(`Learn Things Good: added ${added} curriculum cards.`);
  }

  /* Work another device did on cards this one had not built yet. It was held
     rather than dropped when it arrived; now that the cards exist, it lands. */
  applyHeldProgress();

  /* A seeded deck with no seed on the Goals page is a deck you never find.
     Plant one the first time the deck appears — but never re-plant one you
     deliberately deleted, and never touch a habit you have already tuned. */
  state.habits = state.habits || [];
  state.planted = state.planted || [];
  /* The world decks are offered on the Goals page rather than planted for you —
     they would otherwise add thirty cards a night to the gate uninvited. */
  [math, deck].filter(Boolean).forEach((d) => {
    if (!d || state.planted.includes(d.id)) return;
    state.planted.push(d.id);
    if (state.habits.some((h) => h.deckId === d.id)) return;
    state.habits.push({
      id: 'h-' + uid().slice(0, 8), created: new Date().toISOString(),
      name: d.name, floor: d.id === MATH_DECK ? '3 cards' : '5 cards',
      cadence: 'daily', goalId: (state.goals || [])[0]?.id || null, deckId: d.id,
      amount: deckDaily(d), gate: true,
    });
  });
  if (!state.activeDeck) state.activeDeck = null;
  /* Written at once, not on the debounce. Seeding migrates decks and cards,
     and a migration that only lands when you happen to tap something is a
     migration that silently un-applies itself every reload. */
  writeNow();
}

/* ───────────────────────── boot ───────────────────────── */
/* A single missing element used to take the whole app down with it —
   nothing rendered, no view active, no error visible. Wrap the wiring. */
/* A setup pass that throws leaves a whole feature unbound — no buttons, no
   handlers, no sign anything is wrong. That is how sync sat broken behind a
   console line nobody reads. Now it says so on screen, because a feature that
   quietly does not exist is worse than one that visibly fails. */
const setupFailures = [];
function safely(label, fn) {
  try { fn(); } catch (e) {
    console.error(`[setup] ${label} failed:`, e);
    setupFailures.push(label.replace(/^setup/, '').toLowerCase());
  }
}

function boot() {
  /* Register before anything that can throw. This used to sit at the end of
     boot, so a setup error stopped the worker updating and a broken build
     could persist across reloads. */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  applyTheme(state.settings.theme);
  buildTabs();
  seed();
  releaseDailyLines();
  publishStatus();
  safely('setupAdd', setupAdd);
  safely('setupBrowse', setupBrowse);
  safely('setupModals', setupModals);
  safely('setupPlanner', setupPlanner);
  safely('setupGlobe', setupGlobe);
  safely('setupSettings', setupSettings);
  safely('setupSync', setupSync);
  setEngine('local');
  /* Say so out loud if the ledger had to be rescued — silence is how a
     restore turns into a second, quieter loss. */
  if (setupFailures.length) {
    setTimeout(() => toast(`Part of the app failed to start: ${setupFailures.join(', ')}. Reload, and tell Claude.`, 'bad'), 900);
  }
  if (bootNotice) {
    const notice = bootNotice;        // read it now: the timer fires long after
    bootNotice = null;
    setTimeout(() => toast(notice, 'bad'), 400);
  }

  /* ?sweep=1 drives the whole interface and reports what it found. It takes a
     copy of your ledger first and puts it back after. */
  if (/[?&]sweep=1/.test(location.search)) {
    import('./tests/ui-sweep.js')
      .then((m) => setTimeout(() => m.runSweep(), 700))
      .catch((e) => console.warn('sweep did not load', e));
  }

  $('#themeToggle').addEventListener('click', () => {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.settings.theme); save();
  });
  $('#settingsBtn').addEventListener('click', () => go('more'));
  $('#brandBtn').addEventListener('click', () => go('today'));
  $('#deckPill').addEventListener('click', () => go('decks'));
  $('#deckTitle').addEventListener('click', () => openDeckSheet(state.activeDeck));
  $$('.quick[data-go]').forEach((b) => b.addEventListener('click', () => { cameFrom = 'deck'; go(b.dataset.go); }));

  $('#deckStart').addEventListener('click', async () => {
    /* Never let a night's work land on a device that is not syncing without
       having said so. Asked once, then remembered. */
    if (!(await agreedToStudyAlone())) return;
    /* Catch up before handing over a card. Studying a deck this device has
       not heard about yet is how you end up doing the same night twice. */
    await caughtUp();
    /* For the countries deck, studying is the globe. Reading "Peru — South
       America" teaches a sentence; finding Peru teaches the map. */
    const d = activeDeck();
    /* studying ahead is the globe too — go() catches the rest */
    if (d && d.id === WORLD_DECK && $('#deckStart').dataset.action === 'ahead') { startGlobe(); return; }
    cameFrom = 'deck';
    const action = $('#deckStart').dataset.action;
    if (action === 'add') return go('add');
    if (action === 'ahead') { go('study', { keepSession: true }); startSession(null, true); return; }
    go('study');
  });

  $('#memActions').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mem]'); if (b) memAction(b.dataset.mem);
  });
  $('#memInput').addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); memAction('check'); }
  });
  $('#memPeekBtn').addEventListener('click', () => memAction('peek'));
  $('#memContextBtn').addEventListener('click', () => {
    const ctx = $('#memContext');
    ctx.hidden = !ctx.hidden;
    $('#memContextBtn').textContent = ctx.hidden ? 'Show the whole passage' : 'Hide the passage';
  });

  const fc = $('#flashcard');
  fc.addEventListener('click', reveal);
  fc.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); } });
  $('#gotBtn').addEventListener('click', () => answer(true));
  $('#missBtn').addEventListener('click', () => answer(false));
  /* go back where you came from, not always to the deck page */
  $('#backCard').addEventListener('click', stepBack);
  $('#endSession').addEventListener('click', () => { go(cameFrom); applyPendingMerge(); });
  $('#doneHome').addEventListener('click', () => go(cameFrom));
  /* session is cleared by the time this fires, so the old `session.filter`
     read was always null — and without studyAhead the call quietly did
     nothing once the night's work was finished. */
  $('#doneAgain').addEventListener('click', () => startSession(null, true));

  let sx = 0, sy = 0, tracking = false;
  fc.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true; }, { passive: true });
  fc.addEventListener('touchend', (e) => {
    if (!tracking) return; tracking = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && session && session.revealed) answer(dx > 0);
  }, { passive: true });

  document.addEventListener('keydown', (e) => {
    if (current !== 'study' || !session || session.text) return;
    if (['#scrim', '#deckScrim', '#nodeScrim', '#reviewScrim'].some((s) => !$(s).hidden)) return;
    const tag = document.activeElement.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    /* The card's own handler fires first when it has focus; without this the
       same keypress revealed the card and then immediately graded it. */
    if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;

    const k = e.key.toLowerCase();
    /* space flips, both ways — it never grades, so a stray press cannot mark
       a card you have not read */
    if (k === ' ' || k === 'enter') { e.preventDefault(); reveal(); return; }
    if (k === 'backspace' || k === 'z') { e.preventDefault(); stepBack(); return; }
    if (!session.revealed) return;
    if (k === 'backspace' || k === 'z') { e.preventDefault(); stepBack(); return; }
    if (k === 'd' || k === '1' || k === 'arrowleft') { e.preventDefault(); answer(false); }
    if (k === 'f' || k === '2' || k === 'arrowright') { e.preventDefault(); answer(true); }
  });

  const onScroll = () => $('.topbar').classList.toggle('scrolled', window.scrollY > 6);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { flushSave(); return; }
    /* A phone sits backgrounded overnight; coming back after midnight has to
       roll the day over, not show yesterday's list. */
    if (bootDay !== dayKey()) { bootDay = dayKey(); groveSig = null; }
    if (current === 'today') renderToday();
    if (current === 'decks') renderDecks();
  });
  addEventListener('pagehide', flushSave);
  /* Fires in every *other* tab when one of them saves. */
  addEventListener('storage', (e) => {
    if (e.key === STORE_KEY && e.newValue) adoptExternalWrite(e.newValue);
  });
  /* Coming back to a tab that has been sitting: check whether another tab has
     moved on before this one renders and saves anything. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) adoptExternalWrite(raw);
  });

  const hash = location.hash.slice(1);
  go(['today', 'decks', 'more'].includes(hash) ? hash : 'today');

}

/* ───────────────────────── the globe ─────────────────────────
   A visual way through the same deck. The countries it asks about are chosen
   by the same Leitner state as the cards, and answering grades the card — so
   an evening on the globe counts, rather than being a separate toy with its
   own forgotten progress. */
let globe = null;
let gsession = null;

/* Every card in the countries deck, asked on the globe.

   The deck has four kinds — where a country is, its capital, the reverse of
   its capital, and its flag. All four are questions about a place, so all four
   are better asked while looking at the place. The globe is the deck's study
   mode, not a side attraction. */
const globeKind = (c) => {
  if (c.front.startsWith('Where is ')) return 'where';
  if (c.front.startsWith('Capital of ')) return 'capital';
  if (c.front.startsWith("Which country's capital is ")) return 'capital';
  if (/Which (country|territory) is this\?$/.test(c.front)) return 'flag';
  if (/^(Who leads|Head of government of)/.test(c.front)) return 'leader';
  return null;
};
/* One country at a time, and everything about it before moving on: where it
   is, its capital, its flag, who runs it. Four passes at the same place beats
   four unrelated places. */
const GLOBE_ORDER = ['where', 'capital', 'flag', 'leader'];

const PACES = {
  calm:   { label: 'Calm',   fly: 2300, hold: 1900, miss: 2900, spin: 0.012 },
  normal: { label: 'Steady', fly: 1400, hold: 1100, miss: 1900, spin: 0.022 },
  brisk:  { label: 'Brisk',  fly: 800,  hold: 650,  miss: 1200, spin: 0.04 },
  manual: { label: 'Manual', fly: 1100, hold: null, miss: null, spin: 0 },
};
const pace = () => PACES[state.settings.globePace] || PACES.normal;

function globeRound() {
  const world = state.decks.find((d) => d.id === WORLD_DECK);
  if (!world) return [];
  const today = dayKey();
  const dose = sessionSize(world);
  const wanted = Math.max(1, Math.round(dose / GLOBE_ORDER.length));

  /* gather every card the globe can ask, grouped by country */
  const byCode = {};
  for (const c of deckCards(WORLD_DECK)) {
    const kind = globeKind(c);
    if (!kind || c.mastered || !c.group || !CENTRE[c.group] || !META[c.group]) continue;
    const slot = (byCode[c.group] = byCode[c.group] || {});
    if (!slot[kind]) slot[kind] = c;
  }
  const codes = Object.keys(byCode);
  const owed = (code) => Object.values(byCode[code]).filter((c) => isReview(c, today)).length;
  const due = shuffle(codes.filter((k) => owed(k) > 0)).sort((a, b) => owed(b) - owed(a));
  const fresh = shuffle(codes.filter((k) => owed(k) === 0));
  const keepForNew = Math.min(fresh.length, Math.max(1, Math.floor(wanted / 3)));
  const picked = due.length >= wanted
    ? [...due.slice(0, wanted - keepForNew), ...fresh.slice(0, keepForNew)]
    : [...due, ...fresh].slice(0, wanted);

  const queue = [];
  for (const code of picked) {
    for (const kind of GLOBE_ORDER) {
      const card = byCode[code][kind];
      if (card) queue.push({ code, card, kind });
    }
  }
  return queue;
}

/* the flag, from the ISO code — the same derivation the cards use */
const flagFor = (code) => String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));

/* One clean city name. The cards spell out every seat — "Mbabane
   (administrative) · Lobamba (legislative)" — and an option in that shape
   announces itself as the odd one out before you have read it. */
const capitalLabel = (text) => String(text || '').split(' · ')[0].replace(/\s*\([^)]*\)/g, '').trim();
/* the person, not the office: "President – Lula" reduces to "Lula" */
const leaderLabel = (text) => String(text || '').split(/\s[–—]\s/).pop().trim();

function cardFor(code, kind) {
  const want = { capital: `Capital of ${META[code].n}?`, leader: null };
  const pool = deckCards(WORLD_DECK);
  if (kind === 'capital') return pool.find((c) => c.front === want.capital);
  if (kind === 'leader') return pool.find((c) => c.group === code && globeKind(c) === 'leader');
  return null;
}
const capitalOf = (code) => { const c = cardFor(code, 'capital'); return c ? capitalLabel(c.back) : null; };
const leaderOf  = (code) => { const c = cardFor(code, 'leader');  return c ? leaderLabel(c.back)  : null; };

function globeQuestion(step) {
  const { card, code, kind } = step;
  if (kind === 'capital') return { prompt: 'What is its capital?', right: capitalLabel(card.back), pool: 'capital' };
  if (kind === 'flag')    return { prompt: 'Which flag is its own?', right: flagFor(code), pool: 'flag' };
  if (kind === 'leader')  return { prompt: 'Who leads it?', right: leaderLabel(card.back), pool: 'leader' };
  return { prompt: 'Which one is starred?', right: META[code].n, pool: 'name' };
}
function startGlobe() {
  console.log('[globe] startGlobe');
  const picked = globeRound();
  if (!picked.length) { toast('Nothing waiting on the globe tonight.', 'bad'); return; }
  /* Each round carries a token. Timers scheduled by the last round keep
     running after you leave, and without this they advance the next one —
     a question silently skipped. */
  gsession = { queue: picked, i: 0, right: 0, answered: false, at: null, token: Symbol('round') };
  go('globe');
  $('#globePace').textContent = pace().label;
  /* setTimeout, not requestAnimationFrame: frames do not fire while the tab is
     unpainted, and setup must not depend on being watched. */
  setTimeout(() => {
    if (!globe) {
      globe = new Globe($('#globeCanvas'), {});
      addEventListener('resize', () => globe && globe.resize());
      /* The canvas box changes whenever the answers below it reflow, and a
         buffer sized for the old box gets stretched into an ellipse. Watch the
         element itself rather than the window. */
      if (window.ResizeObserver) {
        new ResizeObserver(() => { if (globe) { globe.resize(); globe.draw(); } })
          .observe($('#globeCanvas'));
      }
      $('#globeCanvas').addEventListener('pointerdown', (e) => {
        if (!gsession || gsession.answered) return;
        const r = $('#globeCanvas').getBoundingClientRect();
        globe.dragging = { x: e.clientX, y: e.clientY, lon: globe.lon, lat: globe.lat, moved: false };
      });
      addEventListener('pointermove', (e) => {
        if (!globe || !globe.dragging) return;
        const d = globe.dragging;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
        globe.lon = d.lon - dx * 0.32;
        globe.lat = Math.max(-80, Math.min(80, d.lat + dy * 0.32));
      });
      addEventListener('pointerup', () => { if (globe) globe.dragging = null; });
    }
    globe.spin = pace().spin;
    globe.hold = false;
    globe.resize();
    globe.draw();          // one frame immediately, so it is never blank
    globe.start();
    nextGlobe();
  }, 0);
}

async function nextGlobe() {
  if (!gsession) return;
  const token = gsession.token;
  const step = gsession.queue[gsession.i];
  $('#globeDone').hidden = true;
  $('#globeOptions').hidden = false;
  document.querySelector('.globe-name')?.remove();
  if (!step) return finishGlobe();

  const { code } = step;
  const arriving = code !== gsession.at;      // same country: no need to fly again
  gsession.answered = false;
  globe.revealed = false;
  $('#globeCount').textContent = `${gsession.i + 1} / ${gsession.queue.length}`;
  $('#globeFill').style.width = `${(gsession.i / gsession.queue.length) * 100}%`;
  $('#globeScore').textContent = gsession.right;
  $('#globeRegion').textContent = META[code].r;

  if (arriving) {
    globe.marked = null;
    globe.dim = false;
    $('#globeVeil').classList.remove('on');
    await globe.flyTo(code, { ms: pace().fly });
    if (!gsession || gsession.token !== token || gsession.queue[gsession.i] !== step) return;
    gsession.at = code;
  }
  globe.marked = code;
  globe.dim = true;
  globe.hold = true;                 // stop drifting: the star must stay put
  $('#globeVeil').classList.add('on');
  renderGlobeOptions(step);
}

function renderGlobeOptions(step) {
  const { code } = step;
  const { prompt, right, pool } = globeQuestion(step);
  $('#globeQ').textContent = prompt;
  const region = META[code].r;
  /* wrong answers from the same region, because "is it Togo or Benin" is the
     question worth asking, and "is it Togo or Iceland" is not */
  const others = Object.keys(META).filter((k) => k !== code && CENTRE[k]);
  const near = shuffle(others.filter((k) => META[k].r === region));
  const far = shuffle(others.filter((k) => META[k].r !== region));
  const label = (k) => (pool === 'flag' ? flagFor(k) : pool === 'capital' ? capitalOf(k)
    : pool === 'leader' ? leaderOf(k) : META[k].n);
  const wrong = [];
  for (const k of [...near, ...far]) {
    const v = label(k);
    if (!v || v === right || wrong.includes(v)) continue;
    wrong.push(v);
    if (wrong.length === 3) break;
  }
  const options = shuffle([right, ...wrong]);
  $('#globeOptions').className = 'globe-options' + (pool === 'flag' ? ' flags' : '');
  $('#globeOptions').innerHTML = options
    .map((n) => `<button class="globe-opt" data-name="${esc(n)}">${esc(n)}</button>`).join('');
  $$('#globeOptions .globe-opt').forEach((b) =>
    b.addEventListener('click', () => answerGlobe(step, b.dataset.name === right, b, right)));
}

function answerGlobe(step, correct, btn, right) {
  if (!gsession || gsession.answered) return;
  gsession.answered = true;
  const { code, card } = step;
  globe.revealed = true;
  globe.dim = false;

  $$('#globeOptions .globe-opt').forEach((b) => {
    b.disabled = true;
    if (b.dataset.name === right) b.classList.add('right');
    else if (b === btn) b.classList.add('wrong');
    else b.classList.add('faded');
  });
  /* always name the country, whatever was being asked, so the place and the
     fact land together */
  const label = META[code].n + (right === META[code].n ? '' : ' — ' + right);
  $('.globe-stage').insertAdjacentHTML('beforeend', `<div class="globe-name">${esc(label)}</div>`);

  grade(card, correct);
  bumpDaily(card.deckId);
  if (correct) { gsession.right++; buzz(12); } else buzz(24);
  $('#globeScore').textContent = gsession.right;

  const p = pace();
  const wait = correct ? p.hold : p.miss;
  if (wait === null) { showAdvanceHint(); return; }   // manual: wait for a nudge
  const token = gsession.token;
  gsession.timer = setTimeout(() => {
    if (!gsession || gsession.token !== token) return;
    advanceGlobe();
  }, wait);
}

/* space, enter, or a tap on the planet moves it along — and cuts short a
   pause you have already finished reading */
function advanceGlobe() {
  if (!gsession) return;
  clearTimeout(gsession.timer);
  document.querySelector('.globe-advance')?.remove();
  if (!gsession.answered) return;
  gsession.i++;
  nextGlobe();
}
function showAdvanceHint() {
  document.querySelector('.globe-advance')?.remove();
  $('.globe-ask').insertAdjacentHTML('beforeend',
    '<p class="globe-advance">space for the next one</p>');
}

function finishGlobe() {
  const total = gsession.queue.length;
  const pct = Math.round((gsession.right / total) * 100);
  $('#globeOptions').hidden = true;
  $('#globeVeil').classList.remove('on');
  gsession.at = null;
  globe.marked = null; globe.dim = false; globe.revealed = false;
  globe.hold = false;                // the round is over — let it turn again
  globe.animate({ lon: globe.lon, lat: globe.lat, zoom: globe.zoom },
                { lon: globe.lon, lat: -12, zoom: 1 }, 900);
  $('#globeCount').textContent = `${total} / ${total}`;
  $('#globeFill').style.width = '100%';
  $('#globeRegion').textContent = '';
  $('#globeQ').textContent = '';
  $('#globeDoneScore').textContent = `${gsession.right} of ${total}`;
  $('#globeDoneSub').textContent = pct === 100 ? 'Every one. The map is going in.'
    : pct >= 70 ? 'Good round — the misses come back sooner.'
    : 'The ones you missed are back in Box 1, which is where they should be.';
  $('#globeDone').hidden = false;
  save();
}

function exitGlobe() {
  gsession = null;
  applyPendingMerge();
  syncAfterWork();
  if (globe) globe.stop();
  go('deck');
}

/* ───────────────────────── sync ─────────────────────────
   Pull, merge, push. Never replace: the copy that did more work on a card
   wins, and ticks from both devices are kept. */
let syncing = false;
let remoteVersion = null;      // the stamp the gist carried when we last looked
let retryTimer = null;
let retryAttempt = 0;
/* GitHub has said no to this key. Stops the automatic attempts without
   throwing the key away — see the catch in runSync. */
let credentialRejected = false;
let firstPull = null;          // resolves once this device has caught up
let lastGood = 0;              // when a sync last actually worked

function syncState(text, kind) {
  const el = $('#syncState');
  if (el) { el.textContent = text; el.className = 'key-state' + (kind ? ' ' + kind : ''); }
}

/* Pushing is always safe. Pulling is not — merging rebuilds every card object
   and a running session is holding references to the old ones, so a merge
   mid-session lands grades on orphans that nothing will save. During a
   session we push what we have and catch up afterwards. */
async function runSync({ quiet = false, pushOnly = false } = {}) {
  const cfg = SYNC.syncConfig(state.settings);
  if (!cfg.on || syncing) return;
  /* A key GitHub has already refused is not worth asking about every minute.
     Anything you do on purpose still gets a fresh try. */
  if (credentialRejected && quiet) return;
  credentialRejected = false;
  const canMerge = !session && !gsession && !pushOnly;
  syncing = true;
  if (!quiet) syncState('Syncing…');

  try {
    const gist = await SYNC.ensureGist(cfg.token, cfg.gist);
    if (gist !== state.settings.syncGist) { state.settings.syncGist = gist; }

    if (canMerge) {
      const { state: theirs, version } = await SYNC.pull(cfg.token, gist);
      remoteVersion = version;
      if (theirs) adoptRemote(fromTheWire(theirs));
    }

    /* Look again right before writing. If the other device wrote while we
       were working, take its work in first — never flatten it. */
    /* What we are going to send. Usually this device's state — but when the
       other device wrote while we were mid-session we cannot adopt its copy
       (the session is holding card objects that a merge would replace), and
       we must not send ours over the top of its work either. So the merge
       happens for the wire only: the payload carries both, and the live state
       catches up when the session ends. */
    let payload = state;
    let pushed = false;

    for (let attempt = 0; attempt < 4; attempt++) {
      const now = await SYNC.version(cfg.token, gist);
      if (now && remoteVersion && now !== remoteVersion) {
        const { state: theirs, version } = await SYNC.pull(cfg.token, gist);
        remoteVersion = version;
        const incoming = theirs && fromTheWire(theirs);
        if (incoming) {
          if (canMerge) { adoptRemote(incoming); payload = state; }
          else {
            pendingRemote = pendingRemote ? mergeStates(pendingRemote, incoming) : incoming;
            payload = mergeStates(state, incoming);
          }
        }
        continue;
      }
      writeNow({ silent: true });
      remoteVersion = await SYNC.push(cfg.token, gist, forTheWire(payload));
      pushed = true;
      break;
    }

    /* Falling out of that loop without writing used to be reported as a
       successful sync. It is the worst possible outcome: the work is still
       only here, and the app has just said it is safe. */
    if (!pushed) throw new Error('Could not save — another device kept changing the file. Trying again shortly.');

    state.settings.syncedAt = new Date().toISOString();
    lastGood = Date.now();
    credentialRejected = false;
    retryAttempt = 0;
    clearTimeout(retryTimer);
    writeNow({ silent: true });
    syncState('Synced just now', 'ok');
    syncHealth();
  } catch (e) {
    /* GitHub refusing the key is not permission to throw it away.

       This used to delete it, on the reasoning that a dead credential should
       not sit there failing for ever. The effect was that a single refusal —
       an outage, a hiccup, a format this code has not heard of — wiped the
       setup and sent you back through the whole procedure. Setting up again is
       far more expensive than a failed request, so the key stays. What stops
       is the automatic retrying, so a genuinely dead key is not hammered every
       minute; opening the app again, or pressing Sync now, tries afresh. */
    if (e.status === 401 || e.status === 403) {
      credentialRejected = true;
      const why = e.status === 403
        ? 'GitHub refused this key — a classic token with the "gist" scope is the one that works.'
        : 'GitHub refused this key. It may have been revoked. Replace it below, or press Sync now to try again.';
      syncState(why, 'bad');
      if (!quiet) toast(why, 'bad');
    } else {
      syncState(e.message || 'Sync failed', 'bad');
      if (!quiet) toast(e.message || 'Sync failed.', 'bad');
      /* Work that has not left the device is the whole problem, so a failure
         schedules its own retry rather than waiting for you to do something. */
      clearTimeout(retryTimer);
      retryAttempt = Math.min(retryAttempt + 1, 5);
      retryTimer = setTimeout(() => runSync({ quiet: true }), 2000 * 2 ** (retryAttempt - 1));
    }
    syncHealth();
  } finally {
    syncing = false;
    if (dirtyDuringSync) { dirtyDuringSync = false; syncAfterWork(); }
  }
}

/* Work that arrived while a session was running, applied once it is over. */
let pendingRemote = null;
function adoptRemote(theirs) {
  state = hydrate(mergeStates(state, theirs));
  highWater = Math.max(highWater, state.cards.length);
  groveSig = null;
  if (current === 'today') renderToday();
  else if (current === 'decks') renderDecks();
  else if (current === 'deck') renderDeck();
}
function drainPendingRemote() {
  if (!pendingRemote || session || gsession) return;
  const theirs = pendingRemote;
  pendingRemote = null;
  adoptRemote(theirs);
  writeNow();
}

/* Every change pushes. Debounced so a burst of grading is one write, and
   floored so a long session cannot hammer the API. */
let syncSoon = null;
let lastPush = 0;
let dirtyDuringSync = false;
function syncAfterWork() {
  if (!SYNC.syncConfig(state.settings).on) return;
  /* Syncing writes the ledger too — it stamps syncedAt. Without this, every
     push would schedule the next one and the app would talk to GitHub for
     ever. Anything you change mid-sync is remembered and pushed after. */
  if (syncing) { dirtyDuringSync = true; return; }
  clearTimeout(syncSoon);
  const since = Date.now() - lastPush;
  const delay = Math.max(3000, 8000 - since);
  syncSoon = setTimeout(() => {
    lastPush = Date.now();
    runSync({ quiet: true, pushOnly: !!(session || gsession) });
  }, delay);
}

/* Say so when it stops working. A sync that has quietly failed for an hour is
   the whole problem this exists to solve, and Settings is not where anyone
   would look. */
/* The state that most deserves a warning used to be the one state that
   showed none: this said nothing at all when sync was switched off. A night's
   work went onto a device that was not syncing, and the app looked exactly
   the way it looks when everything is fine. Off is the loudest case now, not
   the quiet one. */
function syncHealth() {
  syncPill();
  syncFacts();
  const el = $('#syncHealth');
  if (!el) return;
  const cfg = SYNC.syncConfig(state.settings);

  let message = null;
  if (!cfg.on) {
    message = 'This device is not syncing. Anything you study here stays here.';
  } else if (!lastGood && !state.settings.syncedAt) {
    message = 'This device has never finished a sync — your work is only here.';
  } else {
    const at = lastGood || Date.parse(state.settings.syncedAt || 0);
    if (at && Date.now() - at > 15 * 60 * 1000) {
      message = `Not synced since ${humanTime(new Date(at).toISOString())} — your work is only on this device.`;
    }
  }

  el.hidden = !message;
  if (!message) return;
  el.innerHTML = `<span>${message}</span><button class="sync-fix" id="syncFix">Fix this</button>`;
  const fix = $('#syncFix');
  if (fix) fix.addEventListener('click', () => { go('more'); setTimeout(() => { const f = $('#syncToken'); if (f) f.focus(); }, 250); });
}

/* Wait for the first catch-up before handing over a card, so you are never
   studying yesterday's picture of the deck. It gives up quickly: being a few
   seconds stale is a nuisance, being unable to start is worse. */
async function caughtUp(ms = 2500) {
  if (!SYNC.syncConfig(state.settings).on || !firstPull) return;
  await Promise.race([firstPull, new Promise((r) => setTimeout(r, ms))]);
}

/* Is this even a token?

   What actually got pasted here once was a line from a terminal prompt. It
   was stored, and every request then died inside fetch() with "String
   contains non ISO-8859-1 code point" — true, and no use to anyone. A token
   has a known shape, so say which part is wrong before spending a request on
   it. */
function tokenProblem(t) {
  if (!t) return null;
  if (/\s/.test(t)) return 'That has spaces in it — paste just the token, with nothing around it.';
  if (/[^\x21-\x7e]/.test(t)) return 'That is not a token — it contains characters a token cannot. Copy just the token itself.';
  if (t.startsWith('github_pat_')) return 'That is a fine-grained token, which cannot use gists. Generate a classic one with the "gist" scope.';
  if (/^[0-9a-f]{40}$/.test(t)) return null;                 // the old format, still valid
  if (!/^gh[pousr]_[A-Za-z0-9]{20,}$/.test(t)) return 'That does not look like a GitHub token. A classic one starts with ghp_ and is about 40 characters.';
  return null;
}

/* Everything needed to tell why two devices disagree, in plain words. The
   gist id is the one that matters most: two devices pointing at different
   gists will each work perfectly and never meet. */
function syncFacts() {
  const row = $('#linkRow');
  if (row) row.hidden = !SYNC.syncConfig(state.settings).on;
  const el = $('#syncFacts');
  if (!el) return;
  const cfg = SYNC.syncConfig(state.settings);
  const at = lastGood || Date.parse(state.settings.syncedAt || 0) || 0;
  const studiedToday = state.cards.filter((c) => c.lastReviewed === dayKey()).length;
  const rows = [
    ['Connected', cfg.on ? 'yes' : 'NO — work stays on this device'],
    ['Shared file', state.settings.syncGist || '—'],
    ['Last synced', at ? humanTime(new Date(at).toISOString()) : 'never'],
    ['Cards here', String(state.cards.length)],
    ['Studied today', String(studiedToday)],
    ['Decks', state.decks.map((d) => d.name).join(', ') || '—'],
  ];
  el.hidden = false;
  el.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(String(v))}</dd>`).join('');
}

/* One line, always on the deck screen, saying whether what you are about to
   do will leave this device. Green and quiet when it is fine; loud when it is
   not. Both screenshots of the problem were of this screen, and neither
   showed a thing. */
function syncPill() {
  const el = $('#syncPill');
  if (!el) return;
  const cfg = SYNC.syncConfig(state.settings);
  const at = lastGood || Date.parse(state.settings.syncedAt || 0) || 0;

  if (!cfg.on) {
    el.hidden = false;
    el.className = 'sync-pill bad';
    el.textContent = 'Not syncing — this device only. Tap to fix.';
  } else if (!at) {
    el.hidden = false;
    el.className = 'sync-pill bad';
    el.textContent = 'Never finished a sync. Tap to fix.';
  } else if (Date.now() - at > 15 * 60 * 1000) {
    el.hidden = false;
    el.className = 'sync-pill bad';
    el.textContent = `Last synced ${humanTime(new Date(at).toISOString())}. Tap to retry.`;
  } else {
    el.hidden = false;
    el.className = 'sync-pill ok';
    el.textContent = `Synced ${humanTime(new Date(at).toISOString())}`;
  }
}

/* Resolves true when it is fine to start studying: either this device syncs,
   or you have said out loud that you know it does not. */
function agreedToStudyAlone() {
  if (SYNC.syncConfig(state.settings).on || state.settings.soloOk) return Promise.resolve(true);
  return new Promise((resolve) => {
    const scrim = $('#soloScrim');
    if (!scrim) return resolve(true);          // never block on a missing dialog
    scrim.hidden = false;
    const done = (answer) => {
      scrim.hidden = true;
      $('#soloConnect').removeEventListener('click', connect);
      $('#soloAnyway').removeEventListener('click', anyway);
      resolve(answer);
    };
    const connect = () => {
      done(false);
      go('more');
      setTimeout(() => { const f = $('#syncToken'); if (f) f.focus(); }, 250);
    };
    const anyway = () => {
      state.settings.soloOk = true;            // asked once per device, not every night
      writeNow();
      done(true);
    };
    $('#soloConnect').addEventListener('click', connect);
    $('#soloAnyway').addEventListener('click', anyway);
  });
}

/* Setting up the second device.

   Everything else about sync is now automatic, and this was the one step left
   that could not be: a device with no credential cannot write anywhere. So
   make it one tap instead of a procedure — the connected device produces a
   link, and opening it anywhere else finishes the job.

   The credential rides in the fragment, which browsers never send to a
   server, and the app takes it out of the address bar the instant it has it
   so it does not sit in history. It is still a key in a link: it is for
   sending to yourself, not to anyone else, and the button says so. */
const CONNECT_PREFIX = '#connect=';

function connectLink() {
  const token = state.settings.syncToken;
  if (!token) return null;
  const base = location.origin + location.pathname;
  return base + CONNECT_PREFIX + btoa(token);
}

function adoptConnectLink() {
  if (!location.hash.startsWith(CONNECT_PREFIX)) return false;
  let token = '';
  try { token = atob(location.hash.slice(CONNECT_PREFIX.length)); } catch (_) { token = ''; }
  /* out of the address bar before anything else can happen to it */
  history.replaceState(null, '', location.pathname + location.search);

  const problem = tokenProblem(token);
  if (!token || problem) {
    toast(problem || 'That link did not carry a working key.', 'bad');
    return false;
  }
  state.settings.syncToken = token;
  state.settings.syncGist = '';
  state.settings.soloOk = false;
  writeNow();
  toast('Connected. Catching up with your other device…', 'good');
  return true;
}

function setupSync() {
  const cfg = SYNC.syncConfig(state.settings);
  $('#syncToken').value = cfg.token;
  syncState(cfg.on ? (state.settings.syncedAt ? 'Last synced ' + humanTime(state.settings.syncedAt) : 'Connected') : 'Not connected — this device only');
  on('#syncSave', 'click', async () => {
    const token = $('#syncToken').value.trim();
    if (!token) {
      state.settings.syncToken = '';
      writeNow();
      syncState('Not connected — this device only');
      return;
    }
    /* Say it before spending a round trip on a key that cannot work — but
       keep what was typed, so it can be looked at and corrected rather than
       vanishing the moment it is wrong. */
    const problem = tokenProblem(token);
    if (problem) {
      syncState(problem + ' It has been kept, so you can correct it.', 'bad');
      state.settings.syncToken = token;
      writeNow();
      credentialRejected = true;
      return;
    }
    state.settings.syncToken = token;
    state.settings.syncGist = '';
    state.settings.soloOk = false;
    writeNow();
    await runSync();
  });
  on('#syncNow', 'click', () => runSync());
  on('#syncLink', 'click', async () => {
    const link = connectLink();
    if (!link) { toast('Connect this device first.', 'bad'); return; }
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied. Open it on your other device — it contains your key, so send it only to yourself.', 'good');
    } catch (_) {
      /* clipboard refused: show it so it can be copied by hand */
      const f = $('#syncToken');
      if (f) { f.type = 'text'; f.value = link; f.select(); }
      toast('Copy the link in the box above, then open it on your other device.');
    }
  });
  on('#syncPill', 'click', () => {
    if (SYNC.syncConfig(state.settings).on) { runSync(); return; }
    go('more');
    setTimeout(() => { const f = $('#syncToken'); if (f) f.focus(); }, 250);
  });
  on('#syncClear', 'click', () => {
    state.settings.syncToken = ''; state.settings.syncGist = ''; state.settings.syncedAt = null;
    $('#syncToken').value = '';
    writeNow();
    syncState('Not connected — this device only');
    syncHealth();
    toast('Sync turned off on this device.');
  });

  /* How this device starts up: linked from another device, holding junk from
     before the token check existed, or already connected. Written as one
     choice so that none of them can skip what comes after — an early return
     here is exactly how the whole sync pane went dead once before. */
  if (adoptConnectLink()) {
    $('#syncToken').value = state.settings.syncToken;
    firstPull = runSync();
  } else {
    /* Something is stored that does not look like a key. Say what is wrong
       with it and leave it alone: this check knows the token formats that
       existed when it was written, and GitHub has changed them before. A
       pattern from today is not a good enough reason to delete something that
       might be working tomorrow — it is only a good enough reason not to
       spend a request on it, and to say so. */
    const stored = tokenProblem(cfg.token);
    if (stored) {
      syncState(stored, 'bad');
      credentialRejected = true;
    } else if (cfg.on) {
      firstPull = runSync({ quiet: true });
    }
  }

  /* whenever you come back to it */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    drainPendingRemote();
    runSync({ quiet: true });
  });
  /* and the moment the network comes back, because that is when a failed
     push is waiting to be retried */
  window.addEventListener('online', () => runSync({ quiet: true }));
  /* a slow heartbeat, so two devices left open still converge */
  setInterval(() => {
    if (document.hidden || session || gsession) return;
    runSync({ quiet: true });
  }, 60000);
  setInterval(syncHealth, 60000);
  syncHealth();
}

/* Declared, not assigned to a const. setupSync runs during boot and reads
   this, and a const further down the file is in its dead zone at that point —
   which killed the whole sync setup the moment a token existed to display a
   time for. A declaration has no such window. */
function humanTime(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  return mins < 1 ? 'just now' : mins < 60 ? mins + ' min ago'
    : mins < 1440 ? Math.round(mins / 60) + 'h ago' : Math.round(mins / 1440) + 'd ago';
}

function setupGlobe() {
  on('#globeLaunch', 'click', startGlobe);
  on('#globeExit', 'click', exitGlobe);
  on('#globePace', 'click', () => {
    const order = ['calm', 'normal', 'brisk', 'manual'];
    const next = order[(order.indexOf(state.settings.globePace || 'normal') + 1) % order.length];
    state.settings.globePace = next;
    save();
    $('#globePace').textContent = PACES[next].label;
    if (globe) globe.spin = PACES[next].spin;
    toast(next === 'manual' ? 'Manual — space moves it on.' : `${PACES[next].label} pace.`);
  });
  /* space and enter move it along, wherever the focus happens to be */
  document.addEventListener('keydown', (e) => {
    if (current !== 'globe' || !gsession) return;
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advanceGlobe(); }
    if (e.key === 'Escape') { e.preventDefault(); exitGlobe(); }
    /* 1-4 pick an answer without reaching for the mouse */
    const n = Number(e.key);
    if (n >= 1 && n <= 4) {
      const b = document.querySelectorAll('.globe-opt')[n - 1];
      if (b && !b.disabled) { e.preventDefault(); b.click(); }
    }
  });
  on('#globeBack', 'click', exitGlobe);
  on('#globeAgain', 'click', () => startGlobe());
}

/* Last line of defence: if boot dies anyway, say so and offer a way out
   instead of leaving a white screen with no explanation. */
try {
  boot();
} catch (err) {
  console.error('boot failed:', err);
  document.body.insertAdjacentHTML('afterbegin', `
    <div class="boot-fail">
      <h1>Something broke on start-up</h1>
      <p>Your data is safe — this is a display problem, not a data one.</p>
      <pre>${String(err && err.message || err).replace(/[<>&]/g, '')}</pre>
      <button id="bootReload">Reload a fresh copy</button>
    </div>`);
  document.getElementById('bootReload').addEventListener('click', async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) { /* best effort */ }
    location.reload();
  });
}
