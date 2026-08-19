/* The whole app's logic, exercised. Run with: node tests/suite.mjs */

import { describe, check, eq, report, sandbox, makeCard, addDays } from './harness.mjs';

const INTERVALS = { 1: 0, 2: 2, 3: 4, 4: 8, 5: 16 };
const BOX_COUNT = 5;
const BOX1_LIMIT = 30;

/* The real scheduling functions, lifted from app.js and given a fake clock. */
const day = { now: '2026-08-17' };
const sched = sandbox(
  ['isDue', 'isNew', 'isReview', 'inBox', 'box1Load', 'grade', 'fingerprint', 'identity', 'PROGRESS', 'mergeStates'],
  `const INTERVALS = ${JSON.stringify(INTERVALS)};
   const BOX_COUNT = ${BOX_COUNT};
   const BOX1_LIMIT = ${BOX1_LIMIT};
   const day = ${JSON.stringify(day)};
   const dayKey = () => day.now;
   const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
   const writeNow = () => {};
   const hydrate = (x) => x;
   /* The sandbox gets a copy of the clock, not a reference to it, so a test
      that wants to move time has to say so through here. */
   const setDay = (d) => { day.now = d; };
   const today = () => day.now;`,
  { exports: ['setDay', 'today'] }
);

/* ═══════════ 1 · Leitner scheduling ═══════════ */
describe('Leitner');
{
  const fresh = makeCard();
  check('a never-seen card counts as new', sched.isNew(fresh));
  check('a new card is available tonight', sched.isDue(fresh, day.now));
  check('a new card is not a review', !sched.isReview(fresh, day.now));
  check('a new card is in no box yet', !sched.inBox(fresh, 1));

  const c = makeCard();
  sched.grade(c, true);
  eq('first correct answer promotes to Box 2', c.box, 2);
  eq('and stamps today', c.lastReviewed, day.now);
  check('and it is now in a box', sched.inBox(c, 2));
  check('done today is not due again today', !sched.isDue(c, day.now));

  for (const b of [2, 3, 4, 5]) {
    const card = makeCard({ box: b, lastReviewed: day.now, seen: 1 });
    const before = addDays(day.now, INTERVALS[b] - 1);
    const on = addDays(day.now, INTERVALS[b]);
    card.lastReviewed = before;
    check(`Box ${b} is not due before ${INTERVALS[b]} days`, !sched.isDue(card, addDays(before, INTERVALS[b] - 1)));
    card.lastReviewed = day.now;
    check(`Box ${b} comes due after exactly ${INTERVALS[b]} days`, sched.isDue(card, on));
  }

  const b1 = makeCard({ box: 1, lastReviewed: addDays(day.now, -1), seen: 1 });
  check('Box 1 comes back the next day', sched.isDue(b1, day.now));

  const missed = makeCard({ box: 4, lastReviewed: addDays(day.now, -9), seen: 5, right: 5 });
  sched.grade(missed, false);
  eq('a miss drops to Box 1', missed.box, 1);
  eq('and is counted as a lapse', missed.lapses, 1);

  const top = makeCard({ box: 5, seen: 9, right: 9, lastReviewed: addDays(day.now, -20) });
  sched.grade(top, true);
  check('Box 5 answered right is mastered', top.mastered);
  check('a mastered card is never due', !sched.isDue(top, addDays(day.now, 400)));

  const pool = [
    makeCard({ box: 1, lastReviewed: day.now, seen: 1 }),
    makeCard({ box: 1, lastReviewed: day.now, seen: 1 }),
    makeCard(),                                        // new: not in a box
    makeCard({ box: 2, lastReviewed: day.now, seen: 1 }),
  ];
  eq('Box 1 load counts only studied cards', sched.box1Load(pool), 2);
}

/* ═══════════ 2 · Session building ═══════════ */
describe('Session building');
{
  /* the rule the deadlock fix put in: reviews may not take the whole night */
  const build = (reviews, fresh, size) => {
    const first = [...reviews];
    if (fresh.length && first.length > size) {
      const keep = Math.min(fresh.length, Math.max(1, Math.floor(size / 3)));
      return [...first.slice(0, size - keep), ...fresh.slice(0, keep)];
    }
    return [...first, ...fresh].slice(0, size);
  };
  const r = Array.from({ length: 40 }, () => makeCard({ box: 1, seen: 1, lastReviewed: '2026-08-16' }));
  const f = Array.from({ length: 40 }, () => makeCard());
  const q = build(r, f, 15);
  eq('a full night is still the session size', q.length, 15);
  const newOnes = q.filter((c) => !c.lastReviewed).length;
  check('new material always gets a share', newOnes >= 1, `only ${newOnes} new of 15`);
  check('reviews still lead', q.slice(0, 5).every((c) => c.lastReviewed));

  const few = build(r.slice(0, 3), f, 15);
  eq('a light night fills up with new cards', few.length, 15);
}

/* ═══════════ 3 · Merging two devices ═══════════ */
describe('Merging');
{
  /* distinct fronts: cards are matched on what they say, so a test that
     gives them all the same text is testing one card four times */
  const card = (id, last, seen, box) =>
    makeCard({ id, front: 'question ' + id, lastReviewed: last, seen, box });
  const phone = {
    rev: 5,
    cards: [card('a', '2026-08-17', 3, 3), card('b', '2026-08-15', 1, 1), card('only-phone', '2026-08-17', 1, 2)],
    log: { p: { '2026-08-17': true } },
    daily: { day: '2026-08-17', count: 12, decks: { biz: 12 } },
  };
  const laptop = {
    rev: 9,
    cards: [card('a', '2026-08-15', 1, 1), card('b', '2026-08-17', 4, 4), card('only-laptop', '2026-08-17', 1, 2)],
    log: { l: { '2026-08-17': true } },
    daily: { day: '2026-08-17', count: 9, decks: { biz: 9, math: 5 } },
  };
  const m = sched.mergeStates(laptop, phone);
  const by = Object.fromEntries(m.cards.map((c) => [c.id, c]));
  eq('the later review wins on a shared card (a)', by.a.seen, 3);
  eq('the later review wins on a shared card (b)', by.b.seen, 4);
  check('a card only one device has survives', !!by['only-phone'] && !!by['only-laptop']);
  eq('no cards are duplicated', m.cards.length, 4);
  eq('day ticks from both are kept', Object.keys(m.log).sort(), ['l', 'p']);
  eq('per-deck counts take the larger', m.daily.decks.biz, 12);
  eq('a deck only one side has survives', m.daily.decks.math, 5);
  eq('the revision moves forward', m.rev, 9);

  /* merging must never be able to lose a day's work */
  const before = laptop.cards.filter((c) => c.lastReviewed === '2026-08-17').length
               + phone.cards.filter((c) => c.lastReviewed === '2026-08-17').length;
  const after = m.cards.filter((c) => c.lastReviewed === '2026-08-17').length;
  eq('every card studied today on either device is still marked done', after, 4);
  check('nothing studied was dropped', after >= Math.min(before, 4));

  /* an empty or broken other side must not wipe anything */
  const withNothing = sched.mergeStates(laptop, { rev: 99, cards: [], log: {}, daily: {} });
  eq('merging against an empty device keeps our cards', withNothing.cards.length, 3);
}

/* ═══════════ 4 · Memorising ═══════════ */
describe('Memorising');
{
  const P = await import('../passages.js');
  const text = 'It is not the critic who counts; not the man who points out how the strong man stumbles, '
    + 'or where the doer of deeds could have done them better. The credit belongs to the man who is '
    + 'actually in the arena, whose face is marred by dust and sweat and blood.';
  const lines = P.chunkText(text);
  check('a passage breaks into lines', lines.length >= 4, `got ${lines.length}`);
  check('no line is empty', lines.every((l) => l.trim().length));
  check('no line is too long to hold in one breath',
    lines.every((l) => l.split(/\s+/).length <= 20), lines.map((l) => l.split(/\s+/).length).join(','));
  eq('every word survives chunking',
    lines.join(' ').replace(/\s+/g, ' ').trim(), text.replace(/\s+/g, ' ').trim());
  eq('a short sentence stays whole', P.chunkText('It is not the critic who counts.').length, 1);
  eq('empty text makes no lines', P.chunkText('   '), []);

  const line = 'The credit belongs to the man who is actually in the arena';
  eq('level 0 is the line itself', P.fadeText(line, 0), line);
  check('level 1 hides some but not all', (() => {
    const f = P.fadeText(line, 1);
    return f.includes('_') && f !== line && f.split(' ').length === line.split(' ').length;
  })());
  check('level 2 is first letters', /^T__ /.test(P.fadeText(line, 2)));
  eq('level 3 is nothing', P.fadeText(line, 3), '');

  check('typing is graded on words, not keystrokes', P.gradeTyping(line, line).exact);
  check('case is forgiven', P.gradeTyping(line, line.toLowerCase()).exact);
  check('punctuation is forgiven', P.gradeTyping('who counts;', 'who counts').exact);
  check('a wrong word is caught', !P.gradeTyping(line, line.replace('credit', 'blame')).exact);

  /* the rung ladder, as advanceChunk runs it */
  const adv = (card, ok) => {
    if (card.stage === 0) { card.reps++; card.stage = 1; }
    else if (card.stage === 1 || card.stage === 2) { ok ? card.stage++ : card.stage = Math.max(0, card.stage - 1); }
    else if (ok) { if (card.stage === 3) { card.stage = 4; card.box = 2; } else card.box++; }
    else { card.box = 1; card.stage = 2; }
  };
  const l = makeCard({ passageId: 'p', stage: 0 });
  adv(l, true); eq('read once, then the gaps', l.stage, 1);
  adv(l, true); eq('gaps, then first letters', l.stage, 2);
  adv(l, true); eq('first letters, then the run', l.stage, 3);
  adv(l, true); eq('the run graduates it into the ladder', l.stage, 4);
  eq('and it starts at Box 2', l.box, 2);
  adv(l, false); eq('a later miss drops back to the letters rung', l.stage, 2);
}

/* ═══════════ 5 · Gate and cadence ═══════════ */
describe('Gate');
{
  const PLAN = await import('../planner.js');
  const today = '2026-08-17';                       // a Monday
  const daily = { id: 'h1', name: 'Daily', cadence: 'daily', gate: true };
  const weekly = { id: 'h2', name: 'Weekly', cadence: 'weekly', gate: true };
  const ungated = { id: 'h3', name: 'Bedtime', cadence: 'daily', gate: false };

  const none = {};
  const blockers = PLAN.gateBlockers([daily, weekly, ungated], none, today);
  check('a daily habit blocks when undone', blockers.some((h) => h.id === 'h1'));
  check('an ungated habit never blocks', !blockers.some((h) => h.id === 'h3'));

  const doneToday = { h1: { [today]: true } };
  check('a daily habit stops blocking once ticked',
    !PLAN.gateBlockers([daily], doneToday, today).some((h) => h.id === 'h1'));

  const midweek = '2026-08-19';                     // Wednesday, plenty of week left
  check('a weekly habit does not block early in the week',
    !PLAN.gateBlockers([weekly], none, midweek).some((h) => h.id === 'h2'));
  const sunday = '2026-08-23';
  check('a weekly habit blocks when the week is running out',
    PLAN.gateBlockers([weekly], none, sunday).some((h) => h.id === 'h2'));
}

/* ═══════════ 6 · The globe ═══════════ */
describe('Globe');
{
  const G = await import('../worldgeo.js');
  const { SHAPES, CENTRE, META } = G;
  eq('every outlined country has a name', Object.keys(SHAPES).filter((k) => !META[k]).length, 0);
  eq('every country has a position', Object.keys(META).filter((k) => !CENTRE[k]).length, 0);

  const inRing = (lon, lat, r) => {
    let ins = false;
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
      if (Math.abs(xi - xj) > 180) continue;
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  };
  const outside = Object.keys(SHAPES).filter((k) => !SHAPES[k].some((r) => inRing(CENTRE[k][0], CENTRE[k][1], r)));
  eq('every star lands inside its own borders', outside, []);

  const bad = Object.entries(CENTRE).filter(([, c]) =>
    !Array.isArray(c) || c.length !== 2 || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90 || Number.isNaN(c[0]));
  eq('no position is off the planet', bad.map(([k]) => k), []);

  const ringsFlat = Object.values(SHAPES).flat();
  check('all outlines are flat coordinate pairs', ringsFlat.every((r) => r.length % 2 === 0 && r.length >= 8));

  /* the projection: a point on the far side must not be drawn */
  const RAD = Math.PI / 180;
  const project = (camLon, camLat, lon, lat) => {
    const l = (lon - camLon) * RAD, p = lat * RAD, c = camLat * RAD;
    const cosc = Math.sin(c) * Math.sin(p) + Math.cos(c) * Math.cos(p) * Math.cos(l);
    return cosc < 0 ? null : [Math.cos(p) * Math.sin(l), -(Math.cos(c) * Math.sin(p) - Math.sin(c) * Math.cos(p) * Math.cos(l))];
  };
  check('the far side of the planet is hidden', project(0, 0, 180, 0) === null);
  eq('the camera centres its target', project(66, 33, 66, 33).map((n) => Math.round(n * 1e6)), [0, 0]);

  const flagOf = (code) => String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
  eq('flags derive from the country code', flagOf('FR'), '🇫🇷');
  eq('and again', flagOf('JP'), '🇯🇵');
  check('every country produces a flag', Object.keys(META).every((k) => flagOf(k).length === 4));
}

/* ═══════════ 7 · The decks ═══════════ */
describe('Content');
{
  const decks = {
    'Business & Economics': (await import('../curriculum.js')).CURRICULUM_CARDS,
    'Mental Math': (await import('../math.js')).MATH_CARDS,
    'Countries': (await import('../countries.js')).COUNTRY_CARDS,
    'Core Human Knowledge': (await import('../knowledge.js')).KNOWLEDGE_CARDS,
    'UVU Tour Guide': (await import('../uvu.js')).UVU_CARDS,
  };
  for (const [name, cards] of Object.entries(decks)) {
    check(`${name}: has cards`, cards.length > 0);
    check(`${name}: every card has a question`, cards.every((c) => c.front && c.front.trim()));
    check(`${name}: every card has an answer`, cards.every((c) => c.back && c.back.trim()));
    const fronts = cards.map((c) => c.front.trim().toLowerCase());
    const dupes = [...new Set(fronts.filter((f, i) => fronts.indexOf(f) !== i))];
    eq(`${name}: no duplicate questions`, dupes.slice(0, 3), []);
    check(`${name}: nothing answers itself`, cards.every((c) => c.front.trim().toLowerCase() !== c.back.trim().toLowerCase()));
  }

  const curric = await import('../curriculum.js');
  const ids = new Set(curric.PRINCIPLES.map((p) => p.id));
  eq('curriculum: every "builds on" points somewhere real',
    curric.PRINCIPLES.flatMap((p) => p.builds.filter((b) => !ids.has(b))), []);
  const phases = curric.PHASES.map((p) => p.id);
  eq('curriculum: the language of business comes first', curric.PHASES[0].name, 'The Language of Business');
  check('curriculum: cards follow phase order', (() => {
    const order = curric.CURRICULUM_CARDS.map((c) => curric.PHASES.findIndex((p) => p.name === c.category));
    return order.every((v, i) => i === 0 || v >= order[i - 1]);
  })());

  const know = await import('../knowledge.js');
  eq('knowledge: how to think comes first', know.PHASES[0].name, 'How to Know Things');
  eq('knowledge: every principle sits in a real phase',
    know.PRINCIPLES.filter((p) => !know.PHASES.some((x) => x.id === p.phase)).map((p) => p.id), []);

  const maths = decks['Mental Math'];
  const arithmetic = maths.filter((c) => /^\d+\s*[+×*\-]\s*\d+$/.test(c.front.trim()));
  const wrong = arithmetic.filter((c) => {
    const m = c.front.trim().match(/^(\d+)\s*([+×*\-])\s*(\d+)$/);
    const [a, op, b] = [Number(m[1]), m[2], Number(m[3])];
    const want = op === '+' ? a + b : op === '-' ? a - b : a * b;
    return String(want) !== c.back.trim();
  });
  eq('mental math: the arithmetic is right', wrong.map((c) => `${c.front} = ${c.back}`).slice(0, 5), []);
  check('mental math: there is arithmetic to check', arithmetic.length >= 50, `only ${arithmetic.length}`);
  const times = maths.filter((c) => /^\d+\s*×\s*\d+$/.test(c.front.trim()));
  check('mental math: the times tables are present', times.length >= 40, `only ${times.length}`);
}

/* ═══════════ 8 · A hundred days of study ═══════════ */
describe('A hundred days');
{
  const deck = Array.from({ length: 600 }, (_, i) => makeCard({ id: 'k' + i, seq: i, hard: i % 7 === 0 }));
  const DOSE = 15;
  let today = '2026-08-17';
  let everLost = 0, box1Peak = 0, dailyTotals = [];

  for (let d = 0; d < 100; d++) {
    day.now = today;
    const reviews = deck.filter((c) => sched.isReview(c, today));
    const room = Math.max(0, BOX1_LIMIT - sched.box1Load(deck));
    const fresh = deck.filter(sched.isNew).slice(0, room);
    const first = [...reviews];
    let queue;
    if (fresh.length && first.length > DOSE) {
      const keep = Math.min(fresh.length, Math.max(1, Math.floor(DOSE / 3)));
      queue = [...first.slice(0, DOSE - keep), ...fresh.slice(0, keep)];
    } else queue = [...first, ...fresh].slice(0, DOSE);

    for (const c of queue) sched.grade(c, !c.hard || Math.abs(Math.sin(d * 7.3 + c.seq)) > 0.35);
    dailyTotals.push(queue.length);
    box1Peak = Math.max(box1Peak, sched.box1Load(deck));
    if (deck.length !== 600) everLost++;
    today = addDays(today, 1);
  }

  eq('no card was ever lost', deck.length, 600);
  eq('no card ended in a broken state', deck.filter((c) => Number.isNaN(c.box) || c.box < 1 || c.box > 5).length, 0);
  check('Box 1 never overflowed', box1Peak <= BOX1_LIMIT, `peaked at ${box1Peak}`);
  const idle = dailyTotals.filter((n) => n === 0).length;
  eq('there was never a night with nothing to do', idle, 0);
  const mastered = deck.filter((c) => c.mastered).length;
  check('cards do reach mastery', mastered > 0, `${mastered} mastered after 100 days`);
  const seen = deck.filter((c) => c.lastReviewed).length;
  check('the deck genuinely progresses', seen > 200, `only ${seen} of 600 met`);
  check('and it is not all mastered instantly', mastered < 600);
  console.log(`   · 100 nights: ${seen} cards met, ${mastered} mastered, Box 1 peaked at ${box1Peak}`);
}

/* ═══════════ 9 · Day rollover ═══════════ */
describe('Day rollover');
{
  day.now = '2026-08-17';
  const c = makeCard();
  sched.grade(c, true);
  check('done today, not due again today', !sched.isDue(c, '2026-08-17'));
  check('a Box 2 card is not due tomorrow either', !sched.isDue(c, '2026-08-18'));
  check('but it is due in two days', sched.isDue(c, '2026-08-19'));

  const missed = makeCard({ box: 2, seen: 2, lastReviewed: '2026-08-16' });
  sched.grade(missed, false);
  check('a card missed today does not come straight back', !sched.isDue(missed, '2026-08-17'));
  check('it comes back tomorrow', sched.isDue(missed, '2026-08-18'));
}


/* ═══════════ 10 · The safety net ═══════════
   Every way the ledger has ever been lost, replayed against the code that is
   meant to stop it. */
describe('Safety net');
{
  const store = () => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
      get length() { return m.size; },
      key: (i) => [...m.keys()][i],
      _map: m,
    };
  };
  const build = (ls) => sandbox(
    ['usable', 'readSnapshot', 'weight', 'rotateBackup', 'recover', 'quarantine', 'load', 'BAK_KEYS', 'BAK_DAY'],
    `const localStorage = inject.ls;
     const STORE_KEY = 'ledger.v2';
     const LEGACY_KEY = 'ledger.v1';
     const dayKey = () => '${day.now}';
     let bootNotice = null;
     const hydrate = (x) => x;
     const defaultState = () => ({ cards: [], decks: [], fresh: true });
     const migrateV1 = (o) => ({ cards: o.cards || [], decks: [], fromV1: true });
     const notice = () => bootNotice;`,
    { inject: { ls }, exports: ['notice'] }
  );

  const ledger = (n, studied) => JSON.stringify({
    rev: 4, decks: [{ id: 'biz' }],
    cards: Array.from({ length: n }, (_, i) => ({ id: 'c' + i, front: 'q' + i, deckId: 'biz', lastReviewed: i < studied ? day.now : null })),
  });

  /* — a normal load takes a backup — */
  {
    const ls = store();
    ls.setItem('ledger.v2', ledger(900, 300));
    const net = build(ls);
    const s = net.load();
    eq('a good ledger loads unchanged', s.cards.length, 900);
    eq('a normal load says nothing', net.notice(), null);
    check('and a backup is taken on the way past', !!ls.getItem('ledger.bak1'));
    eq('the backup is the real thing', JSON.parse(ls.getItem('ledger.bak1')).cards.length, 900);
    net.load(); net.load();
    eq('but only one backup a day', ls.getItem('ledger.bak2'), null);
  }

  /* — the exact failure that lost a morning: unreadable live copy — */
  {
    const ls = store();
    ls.setItem('ledger.bak1', ledger(900, 300));
    ls.setItem('ledger.v2', '{"cards":[{"id":"c1"');       // truncated write
    const net = build(ls);
    const s = net.load();
    eq('a half-written ledger does not start you over', s.cards.length, 900);
    eq('and the studied cards come back', s.cards.filter((c) => c.lastReviewed).length, 300);
    const kept = [...ls._map.keys()].filter((k) => k.startsWith('ledger.broken.'));
    eq('the damaged copy is kept, not deleted', kept.length, 1);
    check('and you are told it happened', !!net.notice() && /backup/i.test(net.notice()),
      JSON.stringify(net.notice()));
  }

  /* — the key vanishes entirely — */
  {
    const ls = store();
    ls.setItem('ledger.bak2', ledger(900, 412));
    const net = build(ls);
    const s = net.load();
    eq('a wiped key is restored from backup', s.cards.length, 900);
    check('and a silent restore is never allowed', !!net.notice(), 'no notice');
    eq('with the work intact', s.cards.filter((c) => c.lastReviewed).length, 412);
  }

  /* — the best copy wins, not the first — */
  {
    const ls = store();
    ls.setItem('ledger.bak1', ledger(900, 10));
    ls.setItem('ledger.bak2', ledger(900, 480));
    ls.setItem('ledger.bak3', ledger(900, 200));
    const net = build(ls);
    eq('recovery picks the copy with the most work in it',
      net.recover().cards.filter((c) => c.lastReviewed).length, 480);
  }

  /* — a genuine first run must still be a first run — */
  {
    const ls = store();
    const net = build(ls);
    check('an empty browser starts fresh', net.load().fresh === true);
  }

  /* — corrupt backups must not be preferred to nothing — */
  {
    const ls = store();
    ls.setItem('ledger.bak1', 'not json at all');
    ls.setItem('ledger.bak2', JSON.stringify({ nope: true }));
    const net = build(ls);
    check('unusable backups are ignored', net.load().fresh === true);
    eq('and weighed below nothing', net.weight({ nope: true }), -1);
  }

  /* — quarantine cannot itself fill the quota — */
  {
    const ls = store();
    const net = build(ls);
    net.quarantine('one'); net.quarantine('two'); net.quarantine('three');
    eq('only the latest damaged copy is kept',
      [...ls._map.keys()].filter((k) => k.startsWith('ledger.broken.')).length, 1);
  }

  /* — the write guard — */
  {
    const w = sandbox(['writeNow'], `
      let saveTimer = null, lastBody = null, highWater = 900, resetting = false;
      let wrote = 0, warned = 0;
      const localStorage = { setItem: () => { wrote++; }, getItem: () => null };
      const STORE_KEY = 'ledger.v2';
      const publishStatus = () => {};
      const toast = () => {};
      const console = { warn: () => { warned++; } };
      let state = { cards: [], decks: [] };
      const stats = () => ({ wrote, warned, rev: state.rev, held: state.cards.length });
      const setState = (s) => { state = s; };
      const setHigh = (n) => { highWater = n; };
      const setResetting = (b) => { resetting = b; };
    `, { exports: ['stats', 'setState', 'setHigh', 'setResetting'] });
    w.writeNow();
    eq('an empty ledger is never written over a full one', w.stats().wrote, 0);
    eq('and the refusal is logged', w.stats().warned, 1);

    w.setState({ cards: [{ id: 'a' }], decks: [] });
    w.writeNow();
    eq('a real ledger writes normally', w.stats().wrote, 1);

    w.setState({ cards: [], decks: [] });
    w.setResetting(true);
    w.writeNow();
    eq('a deliberate reset is allowed through', w.stats().wrote, 2);
  }
}



/* ═══════════ 11 · Two devices ═══════════
   The phone and the laptop, studying the same deck on the same day, pushing
   and pulling through one gist in whatever order they happen to. Nothing
   either of them did may go missing. */
describe('Two devices');
{
  const wire = sandbox(['NEVER_LEAVES', 'SECRET_SHAPES', 'fingerprint', 'identity', 'PROGRESS', 'slimCard', 'fatCard', 'fromTheWire', 'forTheWire']);

  /* — the credential never leaves — */
  {
    const s = {
      cards: [], decks: [],
      settings: { syncToken: 'ghp_secret', syncGist: 'abc123', apiKey: 'sk-ant-secret', theme: 'dark', dailyTarget: 15 },
    };
    const sent = wire.forTheWire(s);
    eq('the token is stripped before pushing', sent.settings.syncToken, undefined);
    eq('and so is the gist id', sent.settings.syncGist, undefined);
    eq('and the model key, which has no business leaving either', sent.settings.apiKey, undefined);
    eq('everything else still goes', sent.settings.dailyTarget, 15);
    eq('the original is untouched', s.settings.syncToken, 'ghp_secret');
    const body = JSON.stringify(sent);
    check('no credential anywhere in the payload',
      !body.includes('ghp_secret') && !body.includes('sk-ant-secret'));
  }

  /* — the backstop: a secret hiding somewhere nobody thought to strip — */
  {
    const hidden = (where) => {
      try { wire.forTheWire(where); return 'sent'; } catch (e) { return 'refused'; }
    };
    /* A seed card's text does not go at all any more, so a secret pasted into
       one cannot leave — check the payload rather than the refusal. */
    const seedCard = {
      cards: [makeCard({ source: 'seed', front: 'my token', back: 'ghp_abcdefghij0123456789abcdefghij' })],
      decks: [], settings: {},
    };
    eq('a secret in curriculum text does not stop the sync', hidden(seedCard), 'sent');
    check('because that text never leaves at all',
      !JSON.stringify(wire.forTheWire(seedCard)).includes('ghp_abcdefghij'));

    /* one you wrote yourself does go, in full, so it must be refused */
    eq('a token in a card you wrote is refused', hidden({
      cards: [makeCard({ source: 'manual', front: 'my token', back: 'ghp_abcdefghij0123456789abcdefghij' })],
      decks: [], settings: {},
    }), 'refused');
    eq('a fine-grained token anywhere is refused', hidden({
      cards: [], decks: [], settings: { note: 'github_pat_11ABCDEFG0123456789_abcdefgh' },
    }), 'refused');
    eq('an Anthropic key anywhere is refused', hidden({
      cards: [], decks: [], settings: { scratch: 'sk-ant-api03-abcdefghijklmnop' },
    }), 'refused');
    eq('ordinary study material still goes', hidden({
      cards: [makeCard({ front: 'What is a gist?', back: 'A small GitHub paste. ghp is not a token.' })],
      decks: [], settings: { theme: 'dark' },
    }), 'sent');
  }

  /* — a pull can never hand this device someone else's credential, nor
       switch sync back on after you turned it off — */
  {
    const mine = { rev: 1, cards: [], decks: [], settings: { syncToken: '', syncGist: '', theme: 'light' } };
    const theirs = { rev: 99, cards: [], decks: [], settings: { syncToken: 'ghp_theirs', syncGist: 'zzz', apiKey: 'sk-ant-theirs', theme: 'dark' } };
    const m = sched.mergeStates(mine, theirs);
    eq('a remote token is never adopted', m.settings.syncToken, '');
    eq('nor a remote gist id', m.settings.syncGist, '');
    eq('nor a remote model key', m.settings.apiKey, '');

    /* but another tab of this same browser is not another device */
    const sameBrowser = sched.mergeStates(mine, theirs, { local: true });
    eq('a token saved in another tab of this browser is picked up',
      sameBrowser.settings.syncToken, 'ghp_theirs');
    /* and this tab's own token still wins over a stale sibling */
    const haveOne = { ...mine, settings: { ...mine.settings, syncToken: 'ghp_mine' } };
    eq('a tab that already has one keeps it',
      sched.mergeStates(haveOne, theirs, { local: true }).settings.syncToken, 'ghp_mine');
    eq('this device keeps its own settings', m.settings.theme, 'light');
  }
  {
    /* a setting only the other side has is still welcome */
    const mine = { rev: 1, cards: [], decks: [], settings: { theme: 'light' } };
    const theirs = { rev: 2, cards: [], decks: [], settings: { theme: 'dark', newThing: 7 } };
    eq('a setting this device has never seen still arrives',
      sched.mergeStates(mine, theirs).settings.newThing, 7);
  }

  /* — the real thing: a day of studying on both, interleaved — */
  {
    const DECK = 60;
    const seed = () => Array.from({ length: DECK }, (_, i) =>
      makeCard({ id: 'c' + i, front: 'question ' + i, deckId: 'biz', box: 1, seen: 0, lastReviewed: null }));

    let gist = { cards: seed(), decks: [], log: {}, daily: {}, rev: 0, settings: {} };
    const clone = (o) => JSON.parse(JSON.stringify(o));

    const device = (name) => ({ name, state: { ...clone(gist) } });
    const phone = device('phone');
    const laptop = device('laptop');

    /* push = look, merge if it moved, then write — the CAS the app does */
    const sync = (d, { pull = true } = {}) => {
      if (pull) d.state = sched.mergeStates(d.state, clone(gist));
      gist = clone(sched.mergeStates(clone(gist), d.state));
    };

    const study = (d, ids) => {
      for (const id of ids) {
        const c = d.state.cards.find((x) => x.id === id);
        sched.grade(c, true);
      }
    };

    /* phone does the first 20 on the train and pushes */
    study(phone, Array.from({ length: 20 }, (_, i) => 'c' + i));
    sync(phone);

    /* laptop had the app open from before the phone pushed — it is stale —
       and does a different 20 without pulling first */
    study(laptop, Array.from({ length: 20 }, (_, i) => 'c' + (20 + i)));
    sync(laptop);

    /* phone comes back and catches up */
    sync(phone);

    const done = gist.cards.filter((c) => c.seen > 0).length;
    eq('every card studied on either device survived', done, 40);
    eq('and the deck did not grow or shrink', gist.cards.length, DECK);
    check('every studied card is stamped', gist.cards.filter((c) => c.seen > 0).every((c) => !!c.lastReviewed));

    /* both devices now agree */
    sync(laptop);
    sync(phone);
    const seenOn = (d) => d.state.cards.filter((c) => c.seen > 0).length;
    eq('the phone sees all of it', seenOn(phone), 40);
    eq('the laptop sees all of it', seenOn(laptop), 40);

    /* the same card graded on both — the later answer wins, nothing is lost */
    const c0p = phone.state.cards.find((c) => c.id === 'c0');
    const c0l = laptop.state.cards.find((c) => c.id === 'c0');
    sched.setDay('2026-08-18');
    sched.grade(c0p, true);          // phone gets it right
    sched.grade(c0l, false);         // laptop gets it wrong, back to box 1
    sync(phone); sync(laptop); sync(phone);
    const c0 = gist.cards.find((c) => c.id === 'c0');
    check('a card graded on both devices keeps the fuller history', c0.seen >= 2, `seen ${c0.seen}`);
    eq('and is stamped for the day it was actually studied', c0.lastReviewed, '2026-08-18');
    sched.setDay('2026-08-17');
    eq('the clock is back where the other tests expect it', sched.today(), '2026-08-17');
  }

  /* — a device that has been off for a week must not undo the week — */
  {
    const old = {
      rev: 2, decks: [], log: {}, daily: {}, settings: {},
      cards: [makeCard({ id: 'a', front: 'q-a', seen: 0, lastReviewed: null, box: 1 })],
    };
    const current = {
      rev: 200, decks: [], log: {}, daily: {}, settings: {},
      cards: [makeCard({ id: 'a', front: 'q-a', seen: 9, lastReviewed: '2026-08-16', box: 4 })],
    };
    const m = sched.mergeStates(old, current);
    eq('a stale device adopts the newer work rather than erasing it', m.cards[0].seen, 9);
    eq('and does not drag the box back', m.cards[0].box, 4);
  }
}



/* ═══════════ 12 · Deleting things, on two devices ═══════════
   Deleting is a decision, and a decision has to travel. Otherwise the other
   device quietly puts it all back the next time they meet. */
describe('Deleting');
{
  const deck = (id) => ({ id, name: id });
  const withDeck = (id, n, over = {}) => ({
    rev: 1, log: {}, daily: {}, settings: {},
    decks: [deck('keep'), deck(id)],
    cards: [
      makeCard({ id: 'k1', deckId: 'keep', front: 'keeper' }),
      ...Array.from({ length: n }, (_, i) => makeCard({ id: `${id}-${i}`, deckId: id, front: `${id} q${i}` })),
    ],
    ...over,
  });

  /* — a deleted deck must not come back — */
  {
    const gone = { ...withDeck('doomed', 0), decks: [deck('keep')], removed: ['doomed'], rev: 2 };
    const stale = withDeck('doomed', 3, { rev: 9 });          // never heard about the deletion
    const m = sched.mergeStates(gone, stale);
    eq('the deleted deck stays deleted', m.decks.filter((d) => d.id === 'doomed').length, 0);
    eq('and its cards do not come back', m.cards.filter((c) => c.deckId === 'doomed').length, 0);
    eq('the deck you kept is untouched', m.decks.filter((d) => d.id === 'keep').length, 1);
    check('the decision is remembered for next time', (m.removed || []).includes('doomed'));
  }

  /* — and the other way round: the stale device learns about it — */
  {
    const gone = { ...withDeck('doomed', 0), decks: [deck('keep')], removed: ['doomed'], rev: 2 };
    const stale = withDeck('doomed', 3, { rev: 9 });
    const m = sched.mergeStates(stale, gone);                  // stale device pulls
    eq('a device that missed the deletion applies it', m.cards.filter((c) => c.deckId === 'doomed').length, 0);
    check('and remembers it', (m.removed || []).includes('doomed'));
  }

  /* — a single deleted card must not come back either — */
  {
    const mine = {
      rev: 2, decks: [deck('keep')], log: {}, daily: {}, settings: {},
      cards: [makeCard({ id: 'k1', deckId: 'keep', front: 'keeper' })],
      deletedCards: { [sched.identity({ deckId: 'keep', front: 'Doomed card' })]: '2026-08-17' },
    };
    const theirs = {
      rev: 40, decks: [deck('keep')], log: {}, daily: {}, settings: {},
      cards: [makeCard({ id: 'k1', deckId: 'keep', front: 'keeper' }), makeCard({ id: 'gone1', deckId: 'keep', front: 'Doomed card', seen: 3 })],
    };
    const m = sched.mergeStates(mine, theirs);
    eq('a deleted card stays deleted', m.cards.filter((c) => c.id === 'gone1').length, 0);
    eq('the rest of the deck is fine', m.cards.length, 1);
  }

  /* — deletions from both sides both stick — */
  {
    const a = { rev: 2, decks: [deck('keep')], cards: [], log: {}, daily: {}, settings: {}, removed: ['x'] };
    const b = { rev: 3, decks: [deck('keep')], cards: [], log: {}, daily: {}, settings: {}, removed: ['y'] };
    const m = sched.mergeStates(a, b);
    eq('both deletions survive the merge', (m.removed || []).slice().sort(), ['x', 'y']);
  }
}



/* ═══════════ 13 · Two devices that seeded on their own ═══════════
   Each device builds its own deck from the same curriculum files. If the
   cards do not come out with the same identity on both, merging them is not
   a merge — it is a duplication. */
describe('Independent seeding');
{
  const seedOn = (device) => ({
    rev: 1, decks: [{ id: 'biz' }], log: {}, daily: {}, settings: {}, removed: [], deletedCards: {},
    /* the same three curriculum cards, seeded separately on each device */
    cards: [
      makeCard({ id: device + '-1', deckId: 'biz', front: 'What is gross margin?', back: 'Revenue minus COGS' }),
      makeCard({ id: device + '-2', deckId: 'biz', front: 'What is churn?', back: 'Customers lost over a period' }),
      makeCard({ id: device + '-3', deckId: 'biz', front: 'What is CAC?', back: 'Cost to acquire a customer' }),
    ],
  });

  const phone = seedOn('p');
  const laptop = seedOn('l');
  laptop.cards[0].seen = 4; laptop.cards[0].lastReviewed = '2026-08-17'; laptop.cards[0].box = 3;

  const m = sched.mergeStates(phone, laptop);
  eq('the same card seeded on two devices is one card, not two', m.cards.length, 3);
  const margin = m.cards.filter((c) => c.front === 'What is gross margin?');
  eq('and there is exactly one of it', margin.length, 1);
  eq('carrying the progress from whichever device studied it', margin[0].seen, 4);
  eq('and its box', margin[0].box, 3);

  /* a card genuinely only one device has still arrives */
  const withExtra = sched.mergeStates(phone, {
    ...laptop,
    cards: [...laptop.cards, makeCard({ id: 'l-9', deckId: 'biz', front: 'What is ARR?', back: 'Annual recurring revenue' })],
  });
  eq('a genuinely new card still comes across', withExtra.cards.length, 4);

  /* and a ledger already duplicated by an earlier merge heals itself */
  const messy = {
    ...phone,
    cards: [...phone.cards, ...laptop.cards],      // what the old merge produced
  };
  const healed = sched.mergeStates(messy, { ...phone, cards: [] });
  eq('an already-duplicated ledger collapses back down', healed.cards.length, 3);
}



/* ═══════════ 14 · Is that even a token? ═══════════
   What got pasted in once was a line from a terminal prompt. It was stored,
   and every request afterwards died inside fetch() complaining about code
   points — accurate, and no help to anybody. */
describe('Token check');
{
  const t = sandbox(['tokenProblem']);
  const ok = (x) => t.tokenProblem(x) === null;
  const why = (x) => t.tokenProblem(x) || '';

  check('a classic token is accepted', ok('ghp_' + 'a1B2c3D4e5'.repeat(3) + 'abcdef'));
  check('an old 40-character token is still accepted', ok('a'.repeat(40)));
  check('an empty field is not an error, just not connected', ok(''));

  /* the actual paste that broke it: a shell prompt line */
  const prompt = '❯ [studying #99] git push origin main ';
  check('a terminal prompt line is refused', !ok(prompt));
  check('and says it is not a token', /not a token|spaces/i.test(why(prompt)), why(prompt));

  check('anything with a space is refused', !ok('ghp_abc def'));
  check('and says so plainly', /space/i.test(why('ghp_abc def')));

  check('a smart quote or dash is refused', !ok('ghp_abc—def'));
  check('a fine-grained token is refused', !ok('github_pat_' + 'A1b2'.repeat(20)));
  check('and names the fix', /classic/i.test(why('github_pat_' + 'A1b2'.repeat(20))));
  check('a url is refused', !ok('https://github.com/settings/tokens'));
  check('the placeholder text is refused', !ok('ghp_...'));
  check('a too-short token is refused', !ok('ghp_abc'));

  /* every message has to tell you what to do next */
  for (const bad of [prompt, 'ghp_abc def', 'ghp_...', 'https://github.com/settings/tokens']) {
    check(`the message for ${JSON.stringify(bad.slice(0, 14))} is actionable`,
      why(bad).length > 25 && /token/i.test(why(bad)), why(bad));
  }
}



/* ═══════════ 15 · Saying when the work is stranded ═══════════
   A night's work went onto a device that was not syncing and the app looked
   exactly the way it looks when everything is fine, because the warning was
   hidden in precisely the state that most needed one. */
describe('Sync health');
{
  /* relative to the real clock: syncHealth asks Date.now() how long it has
     been, so pinning a wall-clock date here just tests the calendar */
  const now = Date.now();
  const health = (settings, lastGood) => sandbox(['syncFacts', 'syncPill', 'syncHealth'], `
    const el = { hidden: null, innerHTML: '', textContent: '',
                 set innerHTML_(v) {} };
    const state = { settings: ${JSON.stringify(settings)}, cards: [], decks: [] };
    const lastGood = ${lastGood};
    const SYNC = { syncConfig: (s) => ({ on: !!(s && s.syncToken) }) };
    const pill = { hidden: null, className: '', textContent: '' };
    const facts = { hidden: null, innerHTML: '' };
    const $ = (sel) => (sel === '#syncHealth' ? el : sel === '#syncPill' ? pill : sel === '#syncFacts' ? facts : null);
    const esc = (x) => String(x);
    const dayKey = () => '2026-08-18';
    const go = () => {};
    const Date_ = Date;
    const humanTime = () => 'an hour ago';
    const result = () => ({ hidden: el.hidden, text: el.innerHTML || el.textContent });
    const pillState = () => ({ hidden: pill.hidden, kind: pill.className, text: pill.textContent });
    const factsHtml = () => facts.innerHTML;
  `, { exports: ['result', 'pillState', 'factsHtml'] });

  {
    const h = health({}, 0);
    h.syncHealth();
    const r = h.result();
    eq('a device with no sync at all is warned about', r.hidden, false);
    check('and told plainly what that means', /stays here|only/i.test(r.text), r.text);
  }
  {
    const h = health({ syncToken: 'ghp_x' }, 0);
    h.syncHealth();
    const r = h.result();
    eq('a connected device that has never finished is warned', r.hidden, false);
    check('and says never finished', /never/i.test(r.text), r.text);
  }
  {
    const h = health({ syncToken: 'ghp_x', syncedAt: new Date(now).toISOString() }, now);
    h.syncHealth();
    eq('a device that just synced is left alone', h.result().hidden, true);
  }
  {
    /* an hour ago */
    const old = now - 60 * 60 * 1000;
    const h = health({ syncToken: 'ghp_x', syncedAt: new Date(old).toISOString() }, old);
    h.syncHealth();
    const r = h.result();
    eq('a device that has gone quiet is warned', r.hidden, false);
    check('and says how long', /since/i.test(r.text), r.text);
  }
  {
    /* the warning has to be actionable, not just true */
    const h = health({}, 0);
    h.syncHealth();
    check('the warning offers a way to fix it', /Fix this/.test(h.result().text));
  }

  /* The deck screen is the one Reed was looking at both times he found this
     broken, and it showed nothing at all. */
  {
    const h = health({}, 0);
    h.syncHealth();
    const p = h.pillState();
    eq('the deck screen says when a device is not syncing', p.hidden, false);
    check('and says it loudly', /bad/.test(p.kind), p.kind);
    check('and says what to do', /tap to fix/i.test(p.text), p.text);
  }
  {
    const now = Date.now();
    const h = health({ syncToken: 'ghp_x', syncedAt: new Date(now).toISOString() }, now);
    h.syncHealth();
    const p = h.pillState();
    eq('a healthy device still shows its state, quietly', p.hidden, false);
    check('and shows it as fine', /ok/.test(p.kind), p.kind);
    check('with when it last synced', /synced/i.test(p.text), p.text);
  }

  /* Two devices that disagree have to be comparable without guesswork, and
     the shared file id is the fact that settles it. */
  {
    const h = health({ syncToken: 'ghp_x', syncGist: 'abc123' }, Date.now());
    h.syncHealth();
    const html = h.factsHtml();
    check('the facts name the shared file', /abc123/.test(html), html);
    check('and whether it is connected', /Connected/.test(html));
    check('and how much is here', /Cards here/.test(html));
    check('and what was done today', /Studied today/.test(html));
  }
  {
    const h = health({}, 0);
    h.syncHealth();
    check('an unconnected device says so in the facts too',
      /NO — work stays on this device/.test(h.factsHtml()), h.factsHtml());
  }
}



/* ═══════════ 16 · What actually goes over the wire ═══════════
   A full ledger was 1.12 MB and it was sent on every change; one session
   moved ten megabytes. Only progress travels now, and the round trip has to
   be exact — this is the path a night's work takes to the other device. */
describe('The wire');
{
  const w = sandbox(['NEVER_LEAVES', 'SECRET_SHAPES', 'fingerprint', 'identity', 'PROGRESS', 'slimCard', 'fatCard', 'fromTheWire', 'forTheWire']);

  const curriculum = (n) => Array.from({ length: n }, (_, i) => makeCard({
    id: 'c' + i, deckId: 'biz', source: 'seed',
    front: 'A reasonably long curriculum question number ' + i + ' about business',
    back: 'A reasonably long answer to question ' + i + ' with detail',
    category: 'economics', seq: i, group: 'g' + (i % 40),
  }));

  const full = { rev: 3, decks: [{ id: 'biz' }], log: {}, daily: {}, settings: {}, cards: curriculum(400) };
  full.cards[7].seen = 4; full.cards[7].right = 3; full.cards[7].box = 3; full.cards[7].lastReviewed = '2026-08-18';

  const sent = w.forTheWire(full);
  const before = JSON.stringify(full).length;
  const after = JSON.stringify(sent).length;
  check('the payload gets much smaller', after < before / 4, `${before} → ${after}`);
  check('curriculum text does not travel', !JSON.stringify(sent).includes('reasonably long curriculum question'));
  eq('every card is still accounted for', sent.cards.length, 400);

  /* the other device expands it and merges against its own copy */
  const theirs = w.fromTheWire(JSON.parse(JSON.stringify(sent)));
  const mine = { rev: 1, decks: [{ id: 'biz' }], log: {}, daily: {}, settings: {}, cards: curriculum(400) };
  const m = sched.mergeStates(mine, theirs);

  eq('no cards are lost or duplicated', m.cards.length, 400);
  const c7 = m.cards.find((c) => c.front.includes('number 7 '));
  check('the card still knows what it asks', !!c7 && /curriculum question number 7/.test(c7.front), c7 && c7.front);
  check('and still knows its answer', !!c7 && /answer to question 7/.test(c7.back));
  eq('and has picked up the progress from the other device', c7.seen, 4);
  eq('including its box', c7.box, 3);
  eq('and the day it was studied', c7.lastReviewed, '2026-08-18');
  check('untouched cards keep their text too', m.cards.every((c) => !!c.front && !!c.back));
  check('nothing is left carrying a wire key', m.cards.every((c) => !('__key' in c)));

  /* a card you wrote yourself has to travel in full — nothing can rebuild it */
  const withOwn = {
    ...full,
    cards: [...curriculum(3), makeCard({ id: 'own', deckId: 'biz', source: 'manual', front: 'My own question', back: 'My own answer' })],
  };
  const ownSent = w.forTheWire(withOwn);
  check('a card you wrote goes in full', JSON.stringify(ownSent).includes('My own answer'));
  const ownBack = w.fromTheWire(JSON.parse(JSON.stringify(ownSent)));
  const fresh = sched.mergeStates({ ...mine, cards: [] }, ownBack);
  check('and survives a device that has never seen it',
    fresh.cards.some((c) => c.front === 'My own question' && c.back === 'My own answer'));

  /* progress for a card this device has not built yet is kept, not dropped */
  const ahead = w.fromTheWire(JSON.parse(JSON.stringify(w.forTheWire({
    ...full, cards: curriculum(402).map((c, i) => (i === 401 ? { ...c, seen: 9, lastReviewed: '2026-08-18', box: 4 } : c)),
  }))));
  const behind = sched.mergeStates(mine, ahead);
  eq('cards it cannot build yet are not shown blank', behind.cards.filter((c) => !c.front).length, 0);
  const held = Object.keys(behind.orphanProgress || {}).length;
  check('their progress is held rather than thrown away', held >= 2, `held ${held}`);

  /* and lands the moment this device builds those cards */
  const apply = sandbox(['fingerprint', 'identity', 'PROGRESS', 'applyHeldProgress'], `
    const state = ${JSON.stringify({ cards: [], orphanProgress: {} })};
    const console = { info: () => {} };
    const load = (cards, orphans) => { state.cards = cards; state.orphanProgress = orphans; };
    const cards = () => state.cards;
    const leftover = () => Object.keys(state.orphanProgress).length;
  `, { exports: ['load', 'cards', 'leftover'] });

  const late = curriculum(402)[401];
  apply.load([{ ...late, seen: 0, lastReviewed: null, box: 1 }],
    { [sched.identity(late)]: { seen: 9, lastReviewed: '2026-08-18', box: 4, right: 8, mastered: false, lapses: 0, stage: 0, reps: 0 } });
  apply.applyHeldProgress();
  eq('held progress lands once the card exists', apply.cards()[0].seen, 9);
  eq('with the right box', apply.cards()[0].box, 4);
  eq('and is not held twice', apply.leftover(), 0);

  /* it must never undo newer local work */
  apply.load([{ ...late, seen: 12, lastReviewed: '2026-08-19', box: 5 }],
    { [sched.identity(late)]: { seen: 2, lastReviewed: '2026-08-17', box: 2 } });
  apply.applyHeldProgress();
  eq('and never drags newer local work backwards', apply.cards()[0].seen, 12);

  /* an older device that still sends everything must keep working */
  const oldStyle = { rev: 9, decks: [{ id: 'biz' }], log: {}, daily: {}, settings: {}, cards: curriculum(400) };
  oldStyle.cards[3].seen = 6; oldStyle.cards[3].lastReviewed = '2026-08-18'; oldStyle.cards[3].box = 4;
  const compat = sched.mergeStates(mine, w.fromTheWire(oldStyle));
  eq('a device on the old format still merges', compat.cards.length, 400);
  eq('and its work still arrives', compat.cards.find((c) => c.front.includes('number 3 ')).seen, 6);
}



/* ═══════════ 17 · Setting up the second device ═══════════
   The one step that could not be made automatic — a device with no
   credential cannot write anywhere — made into one tap instead. */
describe('Linking a device');
{
  const link = (settings, hash) => sandbox(['tokenProblem', 'CONNECT_PREFIX', 'connectLink', 'adoptConnectLink'], `
    const state = { settings: ${JSON.stringify(settings)} };
    const location = { origin: 'https://reedahlstrom.github.io', pathname: '/studying/', search: '', hash: ${JSON.stringify(hash || '')} };
    const scrubbed = [];
    const history = { replaceState: (a, b, url) => { scrubbed.push(url); location.hash = ''; } };
    const toasts = [];
    const toast = (m, k) => toasts.push(k + ': ' + m);
    const writeNow = () => {};
    const btoa = (s) => Buffer.from(s, 'binary').toString('base64');
    const atob = (s) => Buffer.from(s, 'base64').toString('binary');
    const result = () => ({ token: state.settings.syncToken, gist: state.settings.syncGist, soloOk: state.settings.soloOk, scrubbed, toasts });
  `, { exports: ['result'] });

  const TOKEN = 'ghp_' + 'a1B2c3D4e5'.repeat(3) + 'abcdef';

  {
    const l = link({ syncToken: TOKEN });
    const url = l.connectLink();
    check('a connected device can produce a link', !!url);
    check('the key rides in the fragment, which never reaches a server', url.includes('#connect='));
    check('and is not sitting in the url in plain sight', !url.includes(TOKEN));
  }
  {
    const l = link({});
    eq('a device with nothing to share offers no link', l.connectLink(), null);
  }
  {
    const encoded = Buffer.from(TOKEN, 'binary').toString('base64');
    const l = link({}, '#connect=' + encoded);
    eq('opening the link connects the device', l.adoptConnectLink(), true);
    const r = l.result();
    eq('with the key from the link', r.token, TOKEN);
    eq('and no stale gist id from before', r.gist, '');
    eq('and it will not be asked to study alone again', r.soloOk, false);
    check('the key is taken out of the address bar at once', r.scrubbed.length === 1 && !r.scrubbed[0].includes('connect'), JSON.stringify(r.scrubbed));
    check('and it says what happened', r.toasts.some((t) => /connected/i.test(t)), JSON.stringify(r.toasts));
  }
  {
    /* a mangled or truncated link must not be stored and left to fail later */
    const l = link({}, '#connect=' + Buffer.from('not a token at all', 'binary').toString('base64'));
    eq('a link carrying rubbish does not connect', l.adoptConnectLink(), false);
    eq('and stores nothing', l.result().token, undefined);
    check('but says why', l.result().toasts.some((t) => /bad:/.test(t)));
    check('and still clears the address bar', l.result().scrubbed.length === 1);
  }
  {
    const l = link({}, '#today');
    eq('an ordinary link is left alone', l.adoptConnectLink(), false);
    eq('and nothing is scrubbed', l.result().scrubbed.length, 0);
  }
}


process.exit(report('Suite') ? 1 : 0);
