/* Everything that can be checked without a browser, in one command.

   Run:  node tests/check.mjs

   Three things, in the order they catch problems soonest:
     1. every module actually loads — `node --check` parses a file but will
        not notice a name declared twice, which only an import surfaces
     2. no view can show itself — the CSS mistake that once put the globe
        over the whole app
     3. the logic suite

   The interface is checked separately, in a browser, with ?sweep=1. */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ROOT = path.resolve(import.meta.dirname, '..');
let failed = 0;
const fail = (msg) => { console.log(`  ✗ ${msg}`); failed++; };
const pass = (msg) => console.log(`  ✓ ${msg}`);

/* ── 1. every module loads ──────────────────────────────────── */
console.log('\nModules');
const modules = fs.readdirSync(ROOT).filter((f) => f.endsWith('.js') && f !== 'sw.js');
/* app.js logs its own boot failure when there is no DOM. That is expected
   here and would read as a problem sitting next to a tick, so it is muted. */
const realError = console.error;
console.error = () => {};
for (const f of modules) {
  /* Getting as far as `document` means every declaration in the file was
     accepted, which is the whole point of loading it. */
  try {
    await import(pathToFileURL(path.join(ROOT, f)).href);
    pass(f);
  } catch (e) {
    if (/document is not defined|localStorage is not defined|navigator is not defined/.test(e.message)) pass(`${f} (loads; needs a browser to run)`);
    else fail(`${f} — ${e.message}`);
  }
}

console.error = realError;

/* ── 2. no view can show itself ─────────────────────────────── */
console.log('\nStylesheet');
{
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  /* An id selector outranks the `.view { display: none }` that hides every
     view, so a rule like `#view-globe { display: grid }` leaves that view on
     screen over the whole app for ever. It must be qualified with `.on`. */
  const offenders = [];
  const re = /#view-[\w-]+[^{]*\{[^}]*\}/g;
  for (const block of css.match(re) || []) {
    const head = block.slice(0, block.indexOf('{'));
    if (/display\s*:/.test(block) && !/\.on\b/.test(head)) offenders.push(head.trim());
  }
  if (offenders.length) offenders.forEach((o) => fail(`${o} sets display without .on — it will cover the app`));
  else pass('no view forces itself on screen');
}

/* ── 3. the assets are pinned to the worker version ─────────── */
console.log('\nCache');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const v = (sw.match(/VERSION\s*=\s*'[\w-]*?(\d+)'/) || [])[1];
  const tags = [...html.matchAll(/(app\.js|styles\.css)\?v=(\d+)/g)];
  if (!v) fail('sw.js has no version');
  else if (!tags.length) fail('index.html does not version its assets');
  else if (tags.some((t) => t[2] !== v)) fail(`assets pinned to ${tags.map((t) => t[2]).join('/')} but the worker is v${v} — run tools/bump-assets.mjs`);
  else pass(`assets and worker agree on v${v}`);
}

/* ── 4. the logic suite ─────────────────────────────────────── */
console.log('\nLogic');
/* suite.mjs ends the process itself, so it runs as its own step */
{
  const { spawnSync } = await import('child_process');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tests/suite.mjs')], { encoding: 'utf8' });
  process.stdout.write(r.stdout.split('\n').filter((l) => /passed|✗|^  \d+\./.test(l)).join('\n') + '\n');
  if (r.status !== 0) failed++;
}

console.log(failed ? `\n${failed} problem${failed > 1 ? 's' : ''} found.\n` : '\nAll clear. Now run the browser sweep: open the app with ?sweep=1\n');
process.exit(failed ? 1 : 0);
