/* ══════════════════════════════════════════════════════════════
   Learn Things Good — Gate — background service worker.

   Holds one piece of state: whether today's cards are done. Blocks
   while they aren't, using declarativeNetRequest so the redirect
   happens before the page ever loads.

   Fails CLOSED. No status, stale status, or yesterday's status all
   mean blocked — otherwise clearing the app's data would be an
   accidental skeleton key.
   ══════════════════════════════════════════════════════════════ */

const APP_URL = 'https://reedahlstrom.github.io/studying/';

const DEFAULT_SITES = [
  'youtube.com', 'instagram.com', 'tiktok.com', 'reddit.com',
  'netflix.com', 'twitch.tv', 'x.com', 'twitter.com',
  'facebook.com', 'hulu.com', 'disneyplus.com', 'primevideo.com',
];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function getSites() {
  const { sites } = await chrome.storage.local.get('sites');
  return Array.isArray(sites) && sites.length ? sites : DEFAULT_SITES;
}

async function getStatus() {
  const { status } = await chrome.storage.local.get('status');
  return status || null;
}

/** Done only if the app said so, and said so today. */
function isOpen(status) {
  return !!(status && status.day === today() && status.done);
}

async function applyRules() {
  const status = await getStatus();
  const open = isOpen(status);
  const sites = await getSites();

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  const addRules = open ? [] : sites.map((domain, i) => ({
    id: i + 1,
    priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
    condition: { requestDomains: [domain], resourceTypes: ['main_frame'] },
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  await chrome.action.setBadgeText({ text: open ? '' : '•' });
  await chrome.action.setBadgeBackgroundColor({ color: '#b3852a' });
}

/* The app page reports its status whenever it changes. */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'ledger-status') {
    chrome.storage.local.set({ status: msg.status }).then(applyRules).then(() => sendResponse({ ok: true }));
    return true;   // async response
  }
  if (msg && msg.type === 'reapply') {   // site list changed; keep today's status
    applyRules().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg && msg.type === 'get-state') {
    (async () => sendResponse({ status: await getStatus(), open: isOpen(await getStatus()), sites: await getSites(), appUrl: APP_URL }))();
    return true;
  }
  return false;
});

/* Re-lock at the date rollover even if the browser stays open all night. */
chrome.alarms.create('rollover', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(applyRules);

chrome.runtime.onInstalled.addListener(applyRules);
chrome.runtime.onStartup.addListener(applyRules);
