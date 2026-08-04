import { DEFAULT_SITES } from './defaults.js';

const box = document.querySelector('#sites');
const flash = (msg) => {
  const el = document.querySelector('#saved');
  el.textContent = msg; el.classList.add('on');
  setTimeout(() => el.classList.remove('on'), 1800);
};

chrome.storage.local.get('sites').then(({ sites }) => {
  box.value = (Array.isArray(sites) && sites.length ? sites : DEFAULT_SITES).join('\n');
});

const clean = (text) => text.split('\n')
  .map((s) => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
  .filter(Boolean);

document.querySelector('#save').addEventListener('click', async () => {
  const sites = [...new Set(clean(box.value))];
  box.value = sites.join('\n');
  await chrome.storage.local.set({ sites });
  await chrome.runtime.sendMessage({ type: 'reapply' }).catch(() => {});
  flash('Saved');
});

/* Merge in any defaults the list is missing, without dropping your own additions. */
document.querySelector('#restore').addEventListener('click', async () => {
  const current = clean(box.value);
  const added = DEFAULT_SITES.filter((d) => !current.includes(d));
  const sites = [...new Set([...current, ...added])];
  box.value = sites.join('\n');
  await chrome.storage.local.set({ sites });
  await chrome.runtime.sendMessage({ type: 'reapply' }).catch(() => {});
  flash(added.length ? `Added ${added.length}` : 'Already complete');
});
