/* The seam between the app and GitHub.

   Run: node tests/sync-suite.mjs

   Every sync failure Reed actually hit lived here and none of them were
   reachable from the logic suite. These drive the real sync.js against a
   GitHub that can be told to misbehave. */

import { describe, check, eq, report, sandbox, makeCard } from './harness.mjs';
import { fakeGitHub } from './fake-github.mjs';
import * as SYNC from '../sync.js';

const TOKEN = 'ghp_' + 'x'.repeat(36);

/* sync.js calls the global fetch */
const withGitHub = async (gh, fn) => {
  const real = globalThis.fetch;
  globalThis.fetch = gh.fetch;
  try { return await fn(); } finally { globalThis.fetch = real; }
};

const ledger = (over = {}) => ({
  rev: 1, decks: [{ id: 'biz', name: 'Business' }], log: {}, daily: {}, settings: {},
  cards: [makeCard({ id: 'a' }), makeCard({ id: 'b' })],
  ...over,
});

/* ═══════════ finding or making the gist ═══════════ */
describe('Finding the gist');
{
  const gh = fakeGitHub();
  const id = await withGitHub(gh, () => SYNC.ensureGist(TOKEN, ''));
  check('a first run creates one', !!id);
  eq('and it is private', gh.gists.get(id).public, false);
  eq('and named so it can be found again', gh.gists.get(id).description, 'Learn Things Good — sync');

  const again = await withGitHub(gh, () => SYNC.ensureGist(TOKEN, id));
  eq('a known gist is reused, not duplicated', again, id);
  eq('and no second gist appears', gh.gists.size, 1);

  /* the one that bit: the gist is deleted on github while we still know its id */
  gh.gists.delete(id);
  const remade = await withGitHub(gh, () => SYNC.ensureGist(TOKEN, id));
  check('a deleted gist is replaced rather than failing for ever', !!remade && remade !== id);

  /* an existing gist from a previous install is adopted, not duplicated */
  const gh2 = fakeGitHub({ gists: [{ id: 'old', description: 'Learn Things Good — sync', public: false, content: '{}', updated_at: 'x' }] });
  const found = await withGitHub(gh2, () => SYNC.ensureGist(TOKEN, ''));
  eq('an existing gist on the account is found by name', found, 'old');
  eq('and nothing new is made', gh2.gists.size, 1);
}

/* ═══════════ every way GitHub says no ═══════════ */
describe('When GitHub refuses');
{
  const cases = [
    [401, /revoked|refused/i, 'a revoked token'],
    [403, /classic|fine-grained/i, 'a fine-grained token'],
    [429, /rate|minute/i, 'rate limiting'],
    [500, /500/, 'GitHub being down'],
    [502, /502/, 'a bad gateway'],
  ];
  for (const [status, expect, what] of cases) {
    const gh = fakeGitHub({ failWith: { status } });
    let err = null;
    await withGitHub(gh, async () => {
      try { await SYNC.ensureGist(TOKEN, ''); } catch (e) { err = e; }
    });
    check(`${what} (${status}) throws rather than pretending it worked`, !!err);
    check(`${what} explains itself`, err && expect.test(err.message), err && err.message);
    eq(`${what} carries the status so the app can act on it`, err && err.status, status);
  }

  /* offline is not a status code */
  const gh = fakeGitHub();
  gh.offline = true;
  let err = null;
  await withGitHub(gh, async () => {
    try { await SYNC.ensureGist(TOKEN, ''); } catch (e) { err = e; }
  });
  check('being offline throws too, rather than silently doing nothing', !!err);
}

/* ═══════════ reading and writing ═══════════ */
describe('Reading and writing');
{
  const gh = fakeGitHub();
  const id = await withGitHub(gh, () => SYNC.ensureGist(TOKEN, ''));

  const empty = await withGitHub(gh, () => SYNC.pull(TOKEN, id));
  eq('a brand new gist reads as nothing yet', empty.state, null);
  check('but still carries a stamp', !!empty.version);

  const mine = ledger();
  const v1 = await withGitHub(gh, () => SYNC.push(TOKEN, id, mine));
  check('pushing returns the new stamp', !!v1);

  const back = await withGitHub(gh, () => SYNC.pull(TOKEN, id));
  eq('what comes back is what went up', back.state.cards.length, 2);
  eq('and the stamp matches the push', back.version, v1);

  /* the stamp has to move, or the app cannot tell it was overwritten */
  const v2 = await withGitHub(gh, () => SYNC.push(TOKEN, id, ledger({ rev: 9 })));
  check('a second push moves the stamp', v2 !== v1, `${v1} → ${v2}`);
  const seen = await withGitHub(gh, () => SYNC.version(TOKEN, id));
  eq('and version() agrees with it', seen, v2);

  /* rubbish in the gist must not be read as a ledger */
  gh.gists.get(id).content = '{"cards": "not an array"}';
  const bad = await withGitHub(gh, () => SYNC.pull(TOKEN, id));
  eq('a gist that is not a ledger reads as nothing', bad.state, null);
  gh.gists.get(id).content = 'not json at all{{{';
  const worse = await withGitHub(gh, () => SYNC.pull(TOKEN, id));
  eq('and neither does one that is not even JSON', worse.state, null);
}

/* ═══════════ the size cliff ═══════════ */
describe('Large ledgers');
{
  const gh = fakeGitHub({ truncateOver: 1024 * 1024 });
  const id = await withGitHub(gh, () => SYNC.ensureGist(TOKEN, ''));

  /* Reed's real ledger is over a megabyte, which is where GitHub starts
     handing back a truncated file and a url instead of the content. */
  const big = ledger({
    cards: Array.from({ length: 4000 }, (_, i) =>
      makeCard({ id: 'c' + i, front: 'A reasonably long question about something '.repeat(2) + i, back: 'An answer ' + i })),
  });
  const bytes = JSON.stringify(big).length;
  check('the test ledger is genuinely over the limit', bytes > 1024 * 1024, `${(bytes / 1048576).toFixed(2)} MB`);

  await withGitHub(gh, () => SYNC.push(TOKEN, id, big));
  const back = await withGitHub(gh, () => SYNC.pull(TOKEN, id));
  check('a truncated file is still read in full', !!back.state, 'came back empty');
  eq('with every card intact', back.state && back.state.cards.length, 4000);
}

/* ═══════════ two devices racing ═══════════ */
describe('Two devices racing');
{
  const gh = fakeGitHub();
  const id = await withGitHub(gh, () => SYNC.ensureGist(TOKEN, ''));
  await withGitHub(gh, () => SYNC.push(TOKEN, id, ledger()));

  /* the app's rule: look again immediately before writing */
  const before = await withGitHub(gh, () => SYNC.version(TOKEN, id));

  /* the other device writes in the gap */
  gh.write(id, ledger({ rev: 50, cards: [makeCard({ id: 'a', seen: 5, lastReviewed: '2026-08-17' }), makeCard({ id: 'c' })] }));

  const now = await withGitHub(gh, () => SYNC.version(TOKEN, id));
  check('the stamp moving is detectable', now !== before, `${before} vs ${now}`);
}

process.exit(report('Sync') ? 1 : 0);
