/* Version the asset URLs in index.html to match the service worker.
   index.html is served no-cache by GitHub Pages, but styles.css and app.js are
   cached for ten minutes — so a deploy could leave someone running the new
   markup against the old CSS, which is how a full-screen globe ended up over
   the whole app for anyone who reloaded too soon. A changing query ends that. */
import fs from 'fs';
const sw = fs.readFileSync('sw.js', 'utf8');
const v = (sw.match(/ledger-v(\d+)/) || [])[1];
if (!v) { console.error('no version in sw.js'); process.exit(1); }
let html = fs.readFileSync('index.html', 'utf8');
html = html
  .replace(/href="styles\.css(\?v=\d+)?"/, `href="styles.css?v=${v}"`)
  .replace(/src="app\.js(\?v=\d+)?"/, `src="app.js?v=${v}"`);
fs.writeFileSync('index.html', html);
console.log('assets pinned to v' + v);
