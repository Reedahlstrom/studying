/* A real HTTP GitHub-Gists stand-in, so two browsers can actually meet.

   Two tabs of one origin share localStorage, so they are one device however
   you squint. `localhost` and `127.0.0.1` are different origins with separate
   storage — two genuine devices — but then they need somewhere shared to sync
   through, and a fake fetch inside one page cannot be it. This is that shared
   place.

   Run: node tests/gist-server.mjs        (listens on 8900)
   Then in each tab, point api.github.com at it. */

import http from 'http';

const PORT = 8900;
const gists = new Map();
let nextId = 1;
let clock = 0;
const stamp = () => new Date(Date.UTC(2026, 7, 18, 12, 0, ++clock)).toISOString();

const shape = (g) => ({
  id: g.id,
  description: g.description,
  public: g.public,
  updated_at: g.updated_at,
  files: { 'ledger.json': { content: g.content, truncated: false, raw_url: `http://localhost:${PORT}/raw/${g.id}` } },
});

const send = (res, status, body) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  });
  res.end(JSON.stringify(body));
};

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;

    if (path.startsWith('/raw/')) {
      const g = gists.get(path.slice(5));
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
      return res.end(g ? g.content : '');
    }
    if (path === '/gists' && req.method === 'GET') {
      return send(res, 200, [...gists.values()].map(shape));
    }
    if (path === '/gists' && req.method === 'POST') {
      const sent = JSON.parse(body);
      const g = {
        id: 'gist' + nextId++,
        description: sent.description,
        public: sent.public,
        content: sent.files['ledger.json'].content,
        updated_at: stamp(),
      };
      gists.set(g.id, g);
      console.log(`created ${g.id}`);
      return send(res, 201, shape(g));
    }
    if (path.startsWith('/gists/')) {
      const id = path.slice('/gists/'.length);
      const g = gists.get(id);
      if (!g) return send(res, 404, { message: 'Not Found' });
      if (req.method === 'PATCH') {
        g.content = JSON.parse(body).files['ledger.json'].content;
        g.updated_at = stamp();
        console.log(`wrote ${id}: ${(g.content.length / 1024).toFixed(0)} KB`);
        return send(res, 200, shape(g));
      }
      return send(res, 200, shape(g));
    }
    /* a way for the test to look at what is actually stored */
    if (path === '/_peek') {
      const g = [...gists.values()][0];
      if (!g) return send(res, 200, { empty: true });
      const l = JSON.parse(g.content);
      return send(res, 200, {
        id: g.id,
        cards: (l.cards || []).length,
        wire: l.wire,
        kb: Math.round(g.content.length / 1024),
        studiedToday: (l.cards || []).filter((c) => {
          const d = c.l || c.lastReviewed;
          return d && d === new Date().toISOString().slice(0, 10);
        }).length,
        decks: (l.decks || []).map((d) => d.name),
      });
    }
    return send(res, 404, { message: 'Not Found' });
  });
}).listen(PORT, () => console.log(`fake github on ${PORT}`));
