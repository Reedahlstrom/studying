/* A place to run the app's logic without a browser.

   app.js is one module that also touches the DOM, so the pieces worth testing
   are lifted out of its source and evaluated on their own with whatever they
   depend on injected. It is less tidy than importing them, and it has the one
   property that matters: it tests the code that actually ships, not a copy of
   it that can drift. */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
export const source = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

/* Pull a top-level `function name(...)` out of app.js by brace matching. */
export function lift(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`no function ${name} in app.js`);

  /* Step over the parameter list first. A destructured parameter — say
     `function writeNow({ silent = false } = {})` — puts braces before the
     body, and matching from the first brace found grabs the wrong ones. */
  let i = source.indexOf('(', start);
  let parens = 0;
  for (; i < source.length; i++) {
    if (source[i] === '(') parens++;
    else if (source[i] === ')' && --parens === 0) { i++; break; }
  }

  let depth = 0;
  i = source.indexOf('{', i);
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) break;
  }
  return source.slice(start, i + 1);
}

/* Pull a top-level `const name = ...;` (single line or arrow function). */
export function liftConst(name) {
  const re = new RegExp(`^const ${name} = .*?;$`, 'ms');
  const m = source.match(re);
  if (!m) throw new Error(`no const ${name} in app.js`);
  return m[0];
}

/* Build a sandbox containing the named pieces plus any extra source.

   opts.inject  — values reachable inside as `inject.<name>` (a fake
                  localStorage, a clock, anything the real code reaches for).
   opts.exports — extra locals defined in `extra` to hand back, so a test can
                  poke at the sandbox's own state rather than guess at it. */
export function sandbox(names, extra = '', opts = {}) {
  const parts = names.map((n) => (source.includes(`function ${n}(`) ? lift(n) : liftConst(n)));
  const out = [...names, ...(opts.exports || [])];
  const body = `${extra}\n${parts.join('\n')}\nreturn { ${out.join(', ')} };`;
  return new Function('inject', body)(opts.inject || {});
}

/* ── assertions ─────────────────────────────────────────────── */
let passed = 0;
const failures = [];
let group = '';

export const describe = (name) => { group = name; };
export function check(what, cond, detail) {
  if (cond) { passed++; return true; }
  failures.push(`${group} → ${what}${detail ? `\n      ${detail}` : ''}`);
  return false;
}
export const eq = (what, got, want) =>
  check(what, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

export function report(label) {
  const total = passed + failures.length;
  console.log(`\n${label}: ${passed}/${total} passed`);
  if (failures.length) {
    console.log('\nFAILURES');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
  return failures.length;
}

/* ── a fake day, so time-dependent behaviour is testable ────── */
export const dayKeyOf = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const addDays = (key, n) => {
  const d = new Date(key + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return dayKeyOf(d);
};

/* A card as the app stores one. */
export const makeCard = (over = {}) => ({
  id: 'c' + Math.random().toString(36).slice(2, 9),
  deckId: 'deck', front: 'front', back: 'back', category: '', principle: null,
  box: 1, mastered: false, lastReviewed: null, created: '2026-01-01T00:00:00Z',
  seen: 0, right: 0, source: 'seed', seq: null, group: null,
  passageId: null, intro: null, order: null, stage: 0, reps: 0, lapses: 0,
  ...over,
});
