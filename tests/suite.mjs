/* The whole app's logic, exercised. Run with: node tests/suite.mjs */

import { describe, check, eq, report, sandbox, makeCard, addDays } from './harness.mjs';

const INTERVALS = { 1: 0, 2: 2, 3: 4, 4: 8, 5: 16 };
const BOX_COUNT = 5;
const BOX1_LIMIT = 30;

/* The real scheduling functions, lifted from app.js and given a fake clock. */
const day = { now: '2026-08-17' };
const sched = sandbox(
  ['isDue', 'isNew', 'isReview', 'inBox', 'box1Load', 'grade', 'mergeStates'],
  `const INTERVALS = ${JSON.stringify(INTERVALS)};
   const BOX_COUNT = ${BOX_COUNT};
   const BOX1_LIMIT = ${BOX1_LIMIT};
   const day = ${JSON.stringify(day)};
   const dayKey = () => day.now;
   const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
   const writeNow = () => {};
   const hydrate = (x) => x;`
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
  const card = (id, last, seen, box) => makeCard({ id, lastReviewed: last, seen, box });
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
    cards: Array.from({ length: n }, (_, i) => ({ id: 'c' + i, lastReviewed: i < studied ? day.now : null })),
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


process.exit(report('Suite') ? 1 : 0);
