/* ══════════════════════════════════════════════════════════════
   Ledger — Leitner spaced repetition
   Single-file app logic. No dependencies, no backend.
   ══════════════════════════════════════════════════════════════ */

const STORE_KEY = 'ledger.v1';
const BOX_COUNT = 5;
/* days between reviews, indexed by box (1-5). Box 1 = every session. */
const INTERVALS = { 1: 0, 2: 2, 3: 4, 4: 8, 5: 16 };

const CATEGORIES = [
  { name: 'Market Foundations',            color: '#6ea8ff' },
  { name: 'Macro & the Economy',           color: '#a78bfa' },
  { name: 'Financial Literacy',            color: '#4ad6a0' },
  { name: 'Entrepreneurship & Validation', color: '#f5c463' },
  { name: 'Business Models & Strategy',    color: '#fb9b6a' },
  { name: 'Fundraising & Growth',          color: '#f77fa8' },
];
const catColor = (n) => (CATEGORIES.find((c) => c.name === n) || {}).color || '#8b95a8';

/* ───────────────────────── dates ───────────────────────── */
const dayKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const keyToDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const daysBetween = (aKey, bKey) => Math.round((keyToDate(bKey) - keyToDate(aKey)) / 86400000);

/* ───────────────────────── state ───────────────────────── */
const defaultState = () => ({
  cards: [],
  settings: { target: 15, theme: 'dark', requeue: false },
  streak: { count: 0, last: null },
  seeded: false,
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const s = { ...defaultState(), ...parsed };
    s.settings = { ...defaultState().settings, ...(parsed.settings || {}) };
    s.streak = { ...defaultState().streak, ...(parsed.streak || {}) };
    s.cards = Array.isArray(parsed.cards) ? parsed.cards.map(normalizeCard) : [];
    return s;
  } catch (e) {
    console.warn('Load failed, starting fresh.', e);
    return defaultState();
  }
}

function normalizeCard(c) {
  return {
    id: c.id || uid(),
    front: String(c.front || '').trim(),
    back: String(c.back || '').trim(),
    category: CATEGORIES.some((x) => x.name === c.category) ? c.category : CATEGORIES[0].name,
    box: Math.min(BOX_COUNT, Math.max(1, Number(c.box) || 1)),
    mastered: !!c.mastered,
    lastReviewed: c.lastReviewed || null,
    created: c.created || new Date().toISOString(),
    seen: Number(c.seen) || 0,
    right: Number(c.right) || 0,
  };
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save — storage is full.', 'bad'); }
  }, 60);
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

/* ───────────────────── leitner scheduling ───────────────────── */
function isDue(card, today = dayKey()) {
  if (card.mastered) return false;
  if (!card.lastReviewed) return true;
  if (card.box <= 1) return true;                       // Box 1 comes up every session
  return daysBetween(card.lastReviewed, today) >= INTERVALS[card.box];
}
function nextDueKey(card) {
  if (card.mastered) return null;
  if (!card.lastReviewed) return dayKey();
  const d = keyToDate(card.lastReviewed);
  d.setDate(d.getDate() + INTERVALS[card.box]);
  return dayKey(d);
}
function dueCards(today = dayKey()) { return state.cards.filter((c) => isDue(c, today)); }

function grade(card, correct) {
  card.seen += 1;
  card.lastReviewed = dayKey();
  if (correct) {
    card.right += 1;
    if (card.box >= BOX_COUNT) card.mastered = true;   // Box 5 + correct = mastered, retires
    else card.box += 1;
  } else {
    card.box = 1;
  }
  save();
}

/* ───────────────────────── dom utils ───────────────────────── */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2300);
}
const buzz = (ms = 12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} };

/* ───────────────────────── navigation ───────────────────────── */
const ICONS = {
  home:   '<path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  study:  '<rect x="3" y="7" width="13" height="13" rx="3"/><path d="M8 4h9a3 3 0 0 1 3 3v9"/>',
  add:    '<path d="M12 5v14M5 12h14"/>',
  browse: '<path d="M4 6h16M4 12h16M4 18h11"/>',
  more:   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a1.7 1.7 0 0 0-1.6-1H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 3 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 3.4V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 5"/>',
};
const TABS = [
  { id: 'home',   label: 'Home' },
  { id: 'study',  label: 'Study' },
  { id: 'add',    label: 'Add' },
  { id: 'browse', label: 'Cards' },
  { id: 'more',   label: 'Settings' },
];

function buildTabs() {
  const html = TABS.map((t) => `<button data-go="${t.id}" aria-label="${t.label}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[t.id]}</svg><span>${t.label}</span></button>`).join('');
  $('#mobileTabs').innerHTML = html;
  $('#desktopTabs').innerHTML = html;
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
}

let current = 'home';
function go(view, opts = {}) {
  if (view === 'study' && !opts.fromSession) startSession();
  if (current === 'study' && view !== 'study') stopSession();
  current = view;
  $$('.view').forEach((v) => v.classList.toggle('on', v.dataset.view === view));
  $$('[data-go]').forEach((b) => b.classList.toggle('on', b.dataset.go === view));
  if (location.hash.slice(1) !== view) history.replaceState(null, '', '#' + view);
  window.scrollTo({ top: 0, behavior: 'auto' });
  if (view === 'home') renderHome();
  if (view === 'browse') renderBrowse();
  if (view === 'more') renderSettings();
}

/* ───────────────────────── home ───────────────────────── */
function renderHome() {
  const today = dayKey();
  const due = dueCards(today);
  const mastered = state.cards.filter((c) => c.mastered);
  const target = state.settings.target;
  const shown = Math.min(due.length, target);

  $('#dueBig').textContent = shown;
  $('#dueWord').textContent = shown === 1 ? 'card due' : 'cards due';
  $('#greeting').textContent = greetingText();
  $('#statTotal').textContent = state.cards.length;
  $('#statMastered').textContent = mastered.length;
  $('#statStreak').textContent = liveStreak();

  const startBtn = $('#startBtn');
  if (!state.cards.length) {
    $('#heroSub').textContent = 'No cards yet. Add a few — or import a batch — to get going.';
    startBtn.querySelector('span').textContent = 'Add your first cards';
    startBtn.dataset.action = 'add';
    startBtn.disabled = false;
  } else if (!due.length) {
    const next = upcoming();
    $('#heroSub').textContent = next ? `All clear for today. Next review ${next}.` : 'All clear — every card is mastered. 🎉';
    startBtn.querySelector('span').textContent = 'Study ahead anyway';
    startBtn.dataset.action = 'ahead';
    startBtn.disabled = state.cards.every((c) => c.mastered);
  } else {
    const extra = due.length > target ? ` (${due.length} total in queue)` : '';
    $('#heroSub').textContent = `Target ${target} tonight${extra}. Tap a card to reveal, then mark it.`;
    startBtn.querySelector('span').textContent = 'Start session';
    startBtn.dataset.action = 'study';
    startBtn.disabled = false;
  }

  /* box breakdown */
  const max = Math.max(1, ...[1, 2, 3, 4, 5].map((b) => state.cards.filter((c) => !c.mastered && c.box === b).length), mastered.length);
  const rows = [1, 2, 3, 4, 5].map((b) => {
    const inBox = state.cards.filter((c) => !c.mastered && c.box === b);
    const dueN = inBox.filter((c) => isDue(c, today)).length;
    return `<div class="box-row">
      <b>Box ${b}</b>
      <div class="bar"><i style="width:${(inBox.length / max) * 100}%"></i></div>
      <span class="n ${dueN ? 'due' : ''}">${inBox.length}${dueN ? ` · ${dueN} due` : ''}</span>
    </div>`;
  });
  rows.push(`<div class="box-row b5">
      <b>Mastered</b>
      <div class="bar"><i style="width:${(mastered.length / max) * 100}%"></i></div>
      <span class="n">${mastered.length}</span>
    </div>`);
  $('#boxes').innerHTML = rows.join('');
  requestAnimationFrame(() => $$('#boxes .bar i').forEach((i) => (i.style.width = i.style.width)));

  /* categories */
  const cats = CATEGORIES.map((c) => {
    const all = state.cards.filter((x) => x.category === c.name);
    const d = all.filter((x) => isDue(x, today)).length;
    const m = all.filter((x) => x.mastered).length;
    return { ...c, total: all.length, due: d, mastered: m };
  }).filter((c) => c.total > 0);

  $('#catList').innerHTML = cats.length
    ? cats.map((c) => `<div class="cat-row">
        <span class="dot" style="background:${c.color}"></span>
        <span class="name">${esc(c.name)}</span>
        <span class="meta">${c.total} card${c.total === 1 ? '' : 's'} · ${c.due} due · ${c.mastered} mastered</span>
      </div>`).join('')
    : '<p class="hint">Categories appear here once you add cards.</p>';
}

function greetingText() {
  const h = new Date().getHours();
  if (h < 5) return 'Late night session';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Night owl';
}

function upcoming() {
  const keys = state.cards.filter((c) => !c.mastered).map(nextDueKey).filter(Boolean).sort();
  if (!keys.length) return null;
  const diff = daysBetween(dayKey(), keys[0]);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return `in ${diff} days`;
}

function liveStreak() {
  const { count, last } = state.streak;
  if (!last) return 0;
  const gap = daysBetween(last, dayKey());
  return gap <= 1 ? count : 0;
}
function bumpStreak() {
  const today = dayKey();
  const { count, last } = state.streak;
  if (last === today) return;
  state.streak = { count: last && daysBetween(last, today) === 1 ? count + 1 : 1, last: today };
  save();
}

/* ───────────────────────── session ───────────────────────── */
let session = null;

function startSession(studyAhead = false) {
  const today = dayKey();
  let pool = dueCards(today);
  if (!pool.length && studyAhead) pool = state.cards.filter((c) => !c.mastered);
  const queue = shuffle(pool).slice(0, state.settings.target);
  session = { queue, i: 0, right: 0, wrong: 0, revealed: false, requeued: new Set() };
  $('#sessionDone').hidden = true;
  $('#stage').hidden = false;
  $('#answerRow').hidden = false;
  showCard(true);
}
function stopSession() { session = null; }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function showCard(first = false) {
  if (!session) return;
  const card = session.queue[session.i];
  if (!card) return finishSession();

  const fc = $('#flashcard');
  const slot = $('#cardSlot');
  session.revealed = false;
  fc.classList.remove('flipped');
  slot.classList.remove('leave-left', 'leave-right', 'enter');
  $('#answerRow').classList.remove('on');
  $('#cardFront').textContent = card.front;
  $('#cardBack').textContent = card.back;
  $('#cardCat').textContent = card.category;
  $('#cardCat').style.background = catColor(card.category) + '24';
  $('#cardCat').style.color = catColor(card.category);
  $('#cardBox').textContent = `Box ${card.box}`;

  const total = session.queue.length;
  $('#progressText').textContent = `${session.i + 1} / ${total}`;
  $('#progressFill').style.width = `${(session.i / total) * 100}%`;

  void slot.offsetWidth;
  slot.classList.add('enter');
  if (first) fc.focus({ preventScroll: true });
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
  bumpStreak();   // studying today counts the moment you answer, not only on finish
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
    if (session.i >= session.queue.length) finishSession();
    else showCard();
  }, 330);
}

function finishSession() {
  const answered = session.right + session.wrong;
  $('#stage').hidden = true;
  $('#answerRow').hidden = true;
  const done = $('#sessionDone');
  done.hidden = false;

  const pct = answered ? Math.round((session.right / answered) * 100) : 0;
  $('#donePct').textContent = pct + '%';
  const ring = $('#doneRing');
  ring.style.strokeDashoffset = 327;
  requestAnimationFrame(() => { ring.style.strokeDashoffset = 327 - (327 * pct) / 100; });

  const stillDue = Math.max(0, dueCards().length);
  $('#doneSummary').textContent = answered
    ? `${session.right} right · ${session.wrong} missed${stillDue ? ` · ${stillDue} still due today` : ' · queue clear for today'}`
    : 'Nothing was due — enjoy the night off.';
  $('#doneAgain').hidden = stillDue === 0;
  session = null;
  save();
}

/* ───────────────────────── add ───────────────────────── */
function fillCategorySelects() {
  const opts = CATEGORIES.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  ['#fCat', '#fBulkCat', '#eCat'].forEach((s) => { $(s).innerHTML = opts; });
  $('#eBox').innerHTML = [1, 2, 3, 4, 5].map((b) => `<option value="${b}">Box ${b}</option>`).join('') + '<option value="mastered">Mastered</option>';
}

function addCard(front, back, category) {
  const card = normalizeCard({ front, back, category });
  if (!card.front || !card.back) return null;
  state.cards.unshift(card);
  save();
  return card;
}

let addedThisRun = 0;
function setupAdd() {
  const form = $('#addForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const front = $('#fFront').value.trim();
    const back = $('#fBack').value.trim();
    if (!front || !back) return toast('Front and back are both required.', 'bad');
    addCard(front, back, $('#fCat').value);
    addedThisRun++;
    $('#addedCount').textContent = `${addedThisRun} added this run`;
    $('#addedCount').classList.add('on');
    form.classList.remove('flash'); void form.offsetWidth; form.classList.add('flash');
    $('#fFront').value = ''; $('#fBack').value = '';
    $('#fFront').focus();
    buzz();
  });
  form.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); }
  });

  $('#bulkForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fallback = $('#fBulkCat').value;
    const lines = $('#fBulk').value.split('\n');
    let ok = 0, bad = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) { bad++; continue; }
      const cat = parts[2] && CATEGORIES.some((c) => c.name.toLowerCase() === parts[2].toLowerCase())
        ? CATEGORIES.find((c) => c.name.toLowerCase() === parts[2].toLowerCase()).name
        : fallback;
      addCard(parts[0], parts[1], cat);
      ok++;
    }
    $('#bulkCount').textContent = `${ok} imported${bad ? ` · ${bad} line${bad === 1 ? '' : 's'} skipped` : ''}`;
    $('#bulkCount').classList.add('on');
    if (ok) { $('#fBulk').value = ''; toast(`Imported ${ok} card${ok === 1 ? '' : 's'}.`, 'good'); buzz(20); }
    else toast('No valid lines found. Use: front | back | category', 'bad');
  });

  /* segmented control */
  const seg = $('#addModeSeg');
  const moveThumb = () => {
    const active = seg.querySelector('.seg-btn.on');
    $('#segThumb').style.width = active.offsetWidth + 'px';
    $('#segThumb').style.transform = `translateX(${active.offsetLeft - 4}px)`;
  };
  seg.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    $$('.seg-btn', seg).forEach((b) => b.classList.toggle('on', b === btn));
    const bulk = btn.dataset.mode === 'bulk';
    $('#addForm').hidden = bulk;
    $('#bulkForm').hidden = !bulk;
    moveThumb();
  });
  new ResizeObserver(moveThumb).observe(seg);
  requestAnimationFrame(moveThumb);
}

/* ───────────────────────── browse ───────────────────────── */
const filters = { q: '', cat: 'all', box: 'all' };

function setupBrowse() {
  $('#search').addEventListener('input', (e) => { filters.q = e.target.value.toLowerCase(); renderList(); });

  $('#catFilter').innerHTML = ['all', ...CATEGORIES.map((c) => c.name)]
    .map((c) => `<button class="chip ${c === 'all' ? 'on' : ''}" data-cat="${esc(c)}">${c === 'all' ? 'All categories' : esc(c)}</button>`).join('');
  $('#boxFilter').innerHTML = ['all', 1, 2, 3, 4, 5, 'due', 'mastered']
    .map((b) => `<button class="chip ${b === 'all' ? 'on' : ''}" data-box="${b}">${b === 'all' ? 'All boxes' : b === 'due' ? 'Due today' : b === 'mastered' ? 'Mastered' : 'Box ' + b}</button>`).join('');

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

function matches(card) {
  const today = dayKey();
  if (filters.cat !== 'all' && card.category !== filters.cat) return false;
  if (filters.box === 'mastered' && !card.mastered) return false;
  if (filters.box === 'due' && !isDue(card, today)) return false;
  if (!['all', 'due', 'mastered'].includes(filters.box) && (card.mastered || card.box !== Number(filters.box))) return false;
  if (filters.q && !(card.front + ' ' + card.back).toLowerCase().includes(filters.q)) return false;
  return true;
}

function renderBrowse() { renderList(); }

function renderList() {
  const today = dayKey();
  const list = state.cards.filter(matches);
  $('#browseCount').textContent = `${list.length} of ${state.cards.length}`;
  $('#browseEmpty').hidden = list.length > 0;
  $('#browseEmpty').textContent = state.cards.length ? 'No cards match these filters.' : 'No cards yet — add some from the Add tab.';
  $('#cardList').innerHTML = list.slice(0, 400).map((c, i) => {
    const due = isDue(c, today);
    const next = nextDueKey(c);
    const when = c.mastered ? 'retired' : due ? 'due now' : `next ${humanDate(next)}`;
    return `<article class="mini" data-id="${c.id}" style="animation-delay:${Math.min(i * 22, 340)}ms">
      <div class="q">${esc(c.front)}</div>
      <div class="a">${esc(c.back)}</div>
      <div class="tags">
        <span class="tag" style="color:${catColor(c.category)}">${esc(c.category)}</span>
        <span class="tag ${c.mastered ? 'mastered' : 'box'}">${c.mastered ? 'Mastered' : 'Box ' + c.box}</span>
        <span class="tag ${due && !c.mastered ? 'due' : ''}">${when}</span>
        ${c.seen ? `<span class="tag">${c.right}/${c.seen} correct</span>` : ''}
      </div>
    </article>`;
  }).join('');
  if (list.length > 400) $('#cardList').insertAdjacentHTML('beforeend', '<p class="hint" style="text-align:center;padding:12px">Showing first 400 — narrow the filters to see more.</p>');
}

function humanDate(key) {
  if (!key) return '—';
  const diff = daysBetween(dayKey(), key);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return keyToDate(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ───────────────────────── edit modal ───────────────────────── */
let editingId = null;
function openEdit(id) {
  const card = state.cards.find((c) => c.id === id);
  if (!card) return;
  editingId = id;
  $('#eFront').value = card.front;
  $('#eBack').value = card.back;
  $('#eCat').value = card.category;
  $('#eBox').value = card.mastered ? 'mastered' : String(card.box);
  $('#scrim').hidden = false;
  setTimeout(() => $('#eFront').focus(), 220);
}
function closeEdit() { $('#scrim').hidden = true; editingId = null; }

function setupModal() {
  $('#eCancel').addEventListener('click', closeEdit);
  $('#scrim').addEventListener('click', (e) => { if (e.target === $('#scrim')) closeEdit(); });
  $('#eSave').addEventListener('click', () => {
    const card = state.cards.find((c) => c.id === editingId);
    if (!card) return closeEdit();
    const front = $('#eFront').value.trim(), back = $('#eBack').value.trim();
    if (!front || !back) return toast('Front and back are both required.', 'bad');
    card.front = front; card.back = back; card.category = $('#eCat').value;
    if ($('#eBox').value === 'mastered') { card.mastered = true; card.box = BOX_COUNT; }
    else { card.mastered = false; card.box = Number($('#eBox').value); }
    save(); closeEdit(); renderList(); toast('Card updated.', 'good');
  });
  $('#eDelete').addEventListener('click', () => {
    const el = $(`.mini[data-id="${editingId}"]`);
    state.cards = state.cards.filter((c) => c.id !== editingId);
    save(); closeEdit();
    if (el) { el.classList.add('removing'); setTimeout(renderList, 340); } else renderList();
    toast('Card deleted.');
  });
  $('#cardList').addEventListener('click', (e) => {
    const el = e.target.closest('.mini');
    if (el) openEdit(el.dataset.id);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#scrim').hidden) closeEdit(); });
}

/* ───────────────────────── settings ───────────────────────── */
function renderSettings() {
  $('#targetVal').textContent = state.settings.target;
  $('#requeueSwitch').setAttribute('aria-checked', String(!!state.settings.requeue));
}

function setupSettings() {
  $('#targetUp').addEventListener('click', () => { state.settings.target = Math.min(100, state.settings.target + 5); save(); renderSettings(); });
  $('#targetDown').addEventListener('click', () => { state.settings.target = Math.max(5, state.settings.target - 5); save(); renderSettings(); });
  $('#requeueSwitch').addEventListener('click', () => { state.settings.requeue = !state.settings.requeue; save(); renderSettings(); });

  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
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
      const existing = new Set(state.cards.map((c) => c.front + '|' + c.back));
      const ids = new Set(state.cards.map((c) => c.id));
      let added = 0;
      data.cards.map(normalizeCard).forEach((c) => {
        if (existing.has(c.front + '|' + c.back)) return;
        if (ids.has(c.id)) c.id = uid();
        state.cards.push(c); ids.add(c.id); added++;
      });
      save(); toast(`Imported ${added} new card${added === 1 ? '' : 's'}.`, 'good'); renderHome();
    } catch (err) { toast('That file could not be read.', 'bad'); }
    e.target.value = '';
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Delete every card and reset progress? This cannot be undone.')) return;
    state = defaultState();
    state.seeded = true;
    save(); renderHome(); renderList(); renderSettings();
    toast('Everything cleared.');
  });
}

/* ───────────────────────── theme ───────────────────────── */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t === 'dark' ? '#0a0e14' : '#f6f7fb';
}

/* ───────────────────────── seed ───────────────────────── */
const SEED = [
  ['What does the law of demand say?', 'All else equal, as price rises, quantity demanded falls — buyers substitute away and buy less.', 'Market Foundations'],
  ['What is opportunity cost?', 'The value of the next-best alternative you gave up to make a choice. The real cost of anything is what you did not do.', 'Market Foundations'],
  ['What is a price signal?', 'A price carries information: rising prices signal scarcity or rising demand and attract new supply; falling prices signal surplus.', 'Market Foundations'],
  ['What does "thinking at the margin" mean?', 'Decide based on the added benefit vs added cost of ONE more unit — not on averages or money already spent.', 'Market Foundations'],
  ['What is market equilibrium?', 'The price where quantity supplied equals quantity demanded — no shortage, no surplus, no pressure on price to move.', 'Market Foundations'],
  ['What happens to a market when a price ceiling is set below equilibrium?', 'Quantity demanded exceeds quantity supplied — a persistent shortage, plus queuing, rationing, or black markets.', 'Market Foundations'],
  ['How do interest rates act as a price?', 'Interest is the price of money over time. Higher rates make borrowing costly and saving attractive, cooling investment and spending.', 'Market Foundations'],
  ['What is a sunk cost, and why ignore it?', 'Money or time already spent and unrecoverable. It cannot change with your decision, so only future costs and benefits should matter.', 'Market Foundations'],
  ['What is elasticity of demand?', 'How much quantity demanded responds to a price change. Elastic = buyers are price-sensitive; inelastic = they buy regardless.', 'Market Foundations'],
  ['What does "all else equal" (ceteris paribus) let you do?', 'Isolate one variable at a time so you can reason about cause and effect without every other factor moving at once.', 'Market Foundations'],
];

function seedIfEmpty() {
  if (state.seeded || state.cards.length) return;
  SEED.forEach(([f, b, c]) => addCard(f, b, c));
  state.seeded = true;
  save();
}

/* ───────────────────────── boot ───────────────────────── */
function boot() {
  applyTheme(state.settings.theme);
  buildTabs();
  fillCategorySelects();
  seedIfEmpty();
  setupAdd();
  setupBrowse();
  setupModal();
  setupSettings();

  $('#themeToggle').addEventListener('click', () => {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.settings.theme); save();
  });

  $('#startBtn').addEventListener('click', () => {
    const action = $('#startBtn').dataset.action;
    if (action === 'add') return go('add');
    if (action === 'ahead') { go('study', { fromSession: true }); startSession(true); return; }
    go('study');
  });

  /* flashcard interaction */
  const fc = $('#flashcard');
  fc.addEventListener('click', reveal);
  fc.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); } });
  $('#gotBtn').addEventListener('click', () => answer(true));
  $('#missBtn').addEventListener('click', () => answer(false));
  $('#endSession').addEventListener('click', () => go('home'));
  $('#doneHome').addEventListener('click', () => go('home'));
  $('#doneAgain').addEventListener('click', () => startSession());

  /* swipe to answer */
  let sx = 0, sy = 0, tracking = false;
  fc.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true; }, { passive: true });
  fc.addEventListener('touchend', (e) => {
    if (!tracking) return; tracking = false;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && session && session.revealed) answer(dx > 0);
  }, { passive: true });

  /* keyboard shortcuts during study */
  document.addEventListener('keydown', (e) => {
    if (current !== 'study' || !$('#scrim').hidden) return;
    const tag = document.activeElement.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    if (!session) return;
    if (!session.revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); }
    else if (session.revealed) {
      if (e.key === '1' || e.key === 'ArrowLeft') { e.preventDefault(); answer(false); }
      if (e.key === '2' || e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); answer(true); }
    }
  });

  /* topbar shadow on scroll */
  const onScroll = () => $('.topbar').classList.toggle('scrolled', window.scrollY > 6);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* refresh the day when the app is re-opened after midnight */
  document.addEventListener('visibilitychange', () => { if (!document.hidden && current === 'home') renderHome(); });

  const initial = TABS.some((t) => t.id === location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  go(initial === 'study' ? 'home' : initial);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

boot();
