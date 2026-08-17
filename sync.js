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
      res.status === 401 ? 'That token was refused. Check it has the "gist" scope.'
      : res.status === 404 ? 'That gist could not be found on this account.'
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

export async function pull(token, gistId) {
  const g = await gh('/gists/' + gistId, token);
  const file = g.files && g.files[FILE];
  if (!file) return null;
  /* GitHub truncates large files in the gist response and hands you a URL */
  const raw = file.truncated ? await (await fetch(file.raw_url)).text() : file.content;
  try {
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.cards) ? parsed : null;
  } catch (_) { return null; }
}

export async function push(token, gistId, state) {
  await gh('/gists/' + gistId, token, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(state) } } }),
  });
}
