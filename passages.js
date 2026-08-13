/* ══════════════════════════════════════════════════════════════
   Passages — memorizing text verbatim.

   Pure logic only: splitting text into memorable chunks, rendering
   first-letter cues, grading what you typed, and estimating how long
   a passage will take. No DOM, no storage — so it can be tested.
   ══════════════════════════════════════════════════════════════ */

/* ── how long this takes, roughly ──────────────────────────────
   Numbers are deliberately conservative and stated as estimates.
   New material is slow; review is fast. */
const SEC_PER_WORD_NEW = 12;      // first pass to typing it correctly
const SEC_PER_WORD_REVIEW = 2.5;  // a later review of learned text
const REVIEWS_PER_CHUNK = 5;      // box 1 → mastered

export const AMBITION = {
  steady:    { id: 'steady',    label: 'Steady',    wordsPerDay: 15, blurb: 'A few lines a night' },
  normal:    { id: 'normal',    label: 'Normal',    wordsPerDay: 30, blurb: 'The usual pace' },
  ambitious: { id: 'ambitious', label: 'Ambitious', wordsPerDay: 60, blurb: 'Push it' },
};

export const wordsIn = (text) => (String(text).trim().match(/\S+/g) || []).length;

/* ── chunking ──────────────────────────────────────────────────
   Break on sentences first, then on clause punctuation if a sentence
   runs long. Never split mid-clause — a chunk you cannot say in one
   breath is a chunk you cannot memorize. */
export function chunkText(text, targetWords = 12) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [clean];
  const pieces = [];
  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;
    if (wordsIn(s) <= targetWords * 1.6) { pieces.push(s); continue; }
    // long sentence: split on clause boundaries, keeping the punctuation
    const clauses = s.match(/[^,;:—–]+[,;:—–]?/g) || [s];
    let buf = '';
    for (const c of clauses) {
      const candidate = (buf ? buf + ' ' : '') + c.trim();
      if (buf && wordsIn(candidate) > targetWords * 1.4) { pieces.push(buf.trim()); buf = c.trim(); }
      else buf = candidate;
    }
    if (buf.trim()) pieces.push(buf.trim());
  }

  /* merge pieces that are too short to be worth their own card */
  const chunks = [];
  let buf = '';
  for (const p of pieces) {
    const candidate = (buf ? buf + ' ' : '') + p;
    if (buf && wordsIn(candidate) > targetWords * 1.35) { chunks.push(buf); buf = p; }
    else buf = candidate;
  }
  if (buf) chunks.push(buf);
  return chunks;
}

/* ── first-letter cue ──────────────────────────────────────────
   "The quick brown fox." → "T q b f."  Punctuation and numbers stay,
   because they are part of what you are memorizing. */
export function firstLetters(text) {
  return String(text).replace(/\s+/g, ' ').trim().split(' ').map((word) => {
    const m = word.match(/^(\W*)(\w)(\w*)(\W*)$/);
    if (!m) return word;
    const [, lead, first, rest, tail] = m;
    return /^\d+$/.test(first + rest) ? lead + first + rest + tail : lead + first + '_'.repeat(Math.min(rest.length, 3)) + tail;
  }).join(' ');
}

/* ── grading what you typed ────────────────────────────────────
   Case, punctuation and stray whitespace are forgiven; words are not. */
const normalise = (s) => String(s).toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[^\w\s']/g, ' ').replace(/\s+/g, ' ').trim();

export function gradeTyping(expected, typed) {
  const want = normalise(expected).split(' ').filter(Boolean);
  const got = normalise(typed).split(' ').filter(Boolean);

  /* word-level alignment: walk both, allowing an insertion or deletion */
  const marks = [];
  let i = 0, j = 0, wrong = 0;
  while (i < want.length || j < got.length) {
    if (i < want.length && j < got.length && want[i] === got[j]) { marks.push({ word: want[i], ok: true }); i++; j++; continue; }
    wrong++;
    if (j + 1 < got.length && want[i] === got[j + 1]) { j++; continue; }                    // you added a word
    if (i + 1 < want.length && want[i + 1] === got[j]) { marks.push({ word: want[i], ok: false }); i++; continue; } // you missed one
    if (i < want.length) marks.push({ word: want[i], ok: false });
    i++; j++;
  }
  const accuracy = want.length ? Math.max(0, (want.length - wrong) / want.length) : 1;
  return { exact: wrong === 0, wrong, accuracy, marks, expectedWords: want.length };
}

/* ── the estimate ──────────────────────────────────────────────
   Returned in plain units so the UI can phrase it. */
export function estimate(text, ambitionId = 'normal') {
  const total = wordsIn(text);
  const chunks = chunkText(text);
  const perDay = (AMBITION[ambitionId] || AMBITION.normal).wordsPerDay;

  const daysToLearn = Math.max(1, Math.ceil(total / perDay));
  const daysToMaster = daysToLearn + 30;             // the box ladder needs 2+4+8+16 days after the last chunk

  /* steady-state nightly load: today's new words, plus reviews of everything
     already learned (each chunk comes back ~5 times before it retires) */
  const reviewWordsPerDay = Math.min(total, perDay * REVIEWS_PER_CHUNK);
  const secs = Math.min(perDay, total) * SEC_PER_WORD_NEW + reviewWordsPerDay * SEC_PER_WORD_REVIEW;
  const minutesPerDay = Math.max(1, Math.round(secs / 60));

  return {
    words: total,
    chunks: chunks.length,
    perDay,
    daysToLearn,
    daysToMaster,
    minutesPerDay,
    totalHours: +((total * SEC_PER_WORD_NEW + total * REVIEWS_PER_CHUNK * SEC_PER_WORD_REVIEW) / 3600).toFixed(1),
  };
}

export function estimateAll(text) {
  return Object.values(AMBITION).map((a) => ({ ...a, ...estimate(text, a.id) }));
}

/* Progressive fading. Going straight from the whole line to first letters is a
   cliff; removing the text gradually is what the memorisation research
   actually describes. Level 0 is the line, 3 is nothing at all.
   Punctuation stays throughout — it is the shape of the sentence. */
export function fadeText(text, level) {
  if (level <= 0) return String(text);
  if (level >= 3) return '';
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
  if (level === 2) return firstLetters(text);
  /* level 1 — blank every other word worth blanking. Picking by absolute
     position left short lines untouched: "It is not the critic who counts"
     came back whole, which is not a gap to fill. */
  let n = 0;
  return words.map((w) => {
    const core = w.replace(/[^A-Za-z0-9']/g, '');
    if (core.length <= 2) return w;                 // the, a, of carry nothing
    return (n++ % 2 === 1) ? w.replace(/[A-Za-z0-9']/g, '_') : w;
  }).join(' ');
}
