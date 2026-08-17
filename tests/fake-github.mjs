/* A GitHub that misbehaves on demand.

   Every sync bug that reached Reed lived in the seam between the app and
   GitHub — a dead token, a token in the payload, a 403 nobody could act on.
   None of them were reachable from the logic suite, because the logic suite
   never makes a request. This is that seam, made testable: a fake Gists API
   that can be told to fail in every way the real one does. */

export function fakeGitHub({ gists = [], failWith = null, truncateOver = 1024 * 1024 } = {}) {
  const state = {
    gists: new Map(gists.map((g) => [g.id, g])),
    calls: [],
    failWith,                 // {status, times} or a function(path, opts)
    truncateOver,
    nextId: 1,
    /* somebody else writing between our read and our write */
    onBeforePatch: null,
  };

  const stamp = (n) => new Date(Date.UTC(2026, 7, 17, 12, 0, n)).toISOString();
  let clock = 0;

  state.fetch = async (url, opts = {}) => {
    const u = String(url && url.url ? url.url : url);
    const method = opts.method || 'GET';

    /* the truncated-file follow-up fetch goes to a raw url, not the API */
    if (u.startsWith('raw:')) {
      const g = state.gists.get(u.slice(4));
      return json(200, g.content, true);
    }

    if (!u.includes('api.github.com')) throw new Error('unexpected host: ' + u);
    const path = u.replace('https://api.github.com', '');
    state.calls.push(`${method} ${path}`);

    if (state.failWith) {
      const f = typeof state.failWith === 'function'
        ? state.failWith(path, opts, state)
        : state.failWith;
      if (f && f.status) {
        if (f.times !== undefined) {
          if (f.times > 0) { f.times--; return json(f.status, { message: f.message || 'nope' }); }
        } else return json(f.status, { message: f.message || 'nope' });
      }
    }
    if (state.offline) throw new TypeError('Failed to fetch');

    if (path.startsWith('/gists?')) {
      return json(200, [...state.gists.values()].map(shape));
    }
    if (path.startsWith('/gists/')) {
      const id = path.slice('/gists/'.length);
      const g = state.gists.get(id);
      if (!g) return json(404, { message: 'Not Found' });
      if (method === 'PATCH') {
        if (state.onBeforePatch) state.onBeforePatch(state);
        const sent = JSON.parse(opts.body);
        const file = sent.files['ledger.json'];
        if (file.content.length > 10 * 1024 * 1024) {
          return json(422, { message: 'Validation Failed: file is too large' });
        }
        g.content = file.content;
        g.updated_at = stamp(++clock);
        return json(200, shape(g));
      }
      return json(200, shape(g));
    }
    if (path === '/gists' && method === 'POST') {
      const sent = JSON.parse(opts.body);
      const g = {
        id: 'gist' + state.nextId++,
        description: sent.description,
        public: sent.public,
        content: sent.files['ledger.json'].content,
        updated_at: stamp(++clock),
      };
      state.gists.set(g.id, g);
      return json(201, shape(g));
    }
    return json(404, { message: 'Not Found' });
  };

  function shape(g) {
    const truncated = g.content.length > state.truncateOver;
    return {
      id: g.id,
      description: g.description,
      public: g.public,
      updated_at: g.updated_at,
      files: {
        'ledger.json': {
          content: truncated ? g.content.slice(0, state.truncateOver) : g.content,
          truncated,
          raw_url: 'raw:' + g.id,
        },
      },
    };
  }

  function json(status, body, isText = false) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => (isText ? JSON.parse(body) : body),
      text: async () => (isText ? body : JSON.stringify(body)),
    };
  }

  /* what a second device would see */
  state.read = (id) => {
    const g = state.gists.get(id || [...state.gists.keys()][0]);
    try { return JSON.parse(g.content); } catch (_) { return null; }
  };
  state.write = (id, obj) => {
    const g = state.gists.get(id || [...state.gists.keys()][0]);
    g.content = JSON.stringify(obj);
    g.updated_at = stamp(++clock);
  };
  state.reset = () => { state.calls = []; };

  return state;
}
