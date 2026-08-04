const DEFAULTS = ['youtube.com','instagram.com','tiktok.com','reddit.com','netflix.com','twitch.tv','x.com','twitter.com','facebook.com','hulu.com','disneyplus.com','primevideo.com'];
const box = document.querySelector('#sites');
chrome.storage.local.get('sites').then(({ sites }) => {
  box.value = (Array.isArray(sites) && sites.length ? sites : DEFAULTS).join('\n');
});
document.querySelector('#save').addEventListener('click', async () => {
  const sites = box.value.split('\n').map(s => s.trim().replace(/^https?:\/\//,'').replace(/\/.*$/,'')).filter(Boolean);
  await chrome.storage.local.set({ sites });
  await chrome.runtime.sendMessage({ type: 'reapply' }).catch(()=>{});
  const el = document.querySelector('#saved'); el.classList.add('on'); setTimeout(()=>el.classList.remove('on'), 1600);
});
