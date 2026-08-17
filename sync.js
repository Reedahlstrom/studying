/* Sync between your devices.

   Everything lives in one private GitHub gist. Each device pulls before it
   pushes and the two copies are merged rather than one replacing the other —
   the same merge the app already uses between two open tabs, so studying on
   the phone and then on the laptop adds up instead of one erasing the other.

   A gist because it needs no server, no account beyond the GitHub you already
   have, and the token stays on your device. */

const API = 'https://api.github.com';
const FILE = 'ledger.json';

export function syncConfig(settings) {
  return {
    token: (settings && settings.syncToken) || '',
    gist: (settings && settings.syncGist) || '',
    on: !!(settings && settings.syncToken),
  };
}

async function gh(path, token, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(
      res.status === 401 ? 'That token was refused — it was revoked, or it never had the "gist" scope.'
      /* The one everybody hits. GitHub's token page now leads with
         fine-grained tokens, and fine-grained tokens cannot touch the Gists
         API at all — no permission you can tick changes it. The answer is
         always the same, so say it rather than reporting the number. */
      : res.status === 403 ? 'GitHub refused that token. Fine-grained tokens cannot use gists — you need a classic token with the "gist" scope.'
      : res.status === 404 ? 'That gist could not be found on this account.'
      : res.status === 429 ? 'GitHub is rate-limiting this token. Try again in a minute.'
      : `GitHub said ${res.status}.`
    );
    err.status = res.status;
    err.detail = detail.slice(0, 200);
    throw err;
  }
  return res.json();
}

/* Find the gist this app has used before, or make one. Stored by id in
   settings so it is found instantly next time. */
export async function ensureGist(token, known) {
  if (known) {
    try {
      await gh('/gists/' + known, token);
      return known;
    } catch (e) { if (e.status !== 404) throw e; }
  }
  const mine = await gh('/gists?per_page=100', token);
  const found = mine.find((g) => g.description === 'Learn Things Good — sync' && g.files && g.files[FILE]);
  if (found) return found.id;
  const made = await gh('/gists', token, {
    method: 'POST',
    body: JSON.stringify({
      description: 'Learn Things Good — sync',
      public: false,
      files: { [FILE]: { content: '{}' } },
    }),
  });
  return made.id;
}

/* Pull returns the ledger and the stamp it came with.

   The stamp is what makes two devices safe. A gist has no conditional write,
   so the best available is to look again immediately before pushing: if the
   stamp moved, the other device wrote while we were thinking, and we merge
   its work in rather than flattening it. That leaves a window of about one
   round trip — small, and it closes on the next tick because every change
   pushes. Without it the window is however long you had the app open. */
export async function pull(token, gistId) {
  const g = await gh('/gists/' + gistId, token);
  const file = g.files && g.files[FILE];
  if (!file) return { state: null, version: g.updated_at || null };
  /* GitHub truncates large files in the gist response and hands you a URL */
  const raw = file.truncated ? await (await fetch(file.raw_url)).text() : file.content;
  try {
    const parsed = JSON.parse(raw);
    return {
      state: parsed && Array.isArray(parsed.cards) ? parsed : null,
      version: g.updated_at || null,
    };
  } catch (_) { return { state: null, version: g.updated_at || null }; }
}

/* Just the stamp — cheap enough to check on every push. */
export async function version(token, gistId) {
  const g = await gh('/gists/' + gistId, token);
  return g.updated_at || null;
}

export async function push(token, gistId, state) {
  const g = await gh('/gists/' + gistId, token, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(state) } } }),
  });
  return g.updated_at || null;
}
