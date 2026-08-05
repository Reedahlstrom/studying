const $ = (s) => document.querySelector(s);
chrome.runtime.sendMessage({ type: 'get-state' }, (state) => {
  const s = state && state.status;
  const open = state && state.open;
  $('#state').classList.toggle('open', !!open);
  $('#label').textContent = open ? 'Unlocked for today' : 'Locked';
  if (s) {
    const pct = Math.min(100, Math.round((s.reviewed / Math.max(1, s.target)) * 100));
    $('#bar').style.width = pct + '%';
    const blockers = Array.isArray(s.blockers) ? s.blockers : [];
    $('#sub').textContent = open
      ? `${s.reviewed} reviewed today.`
      : blockers.length ? `Waiting on: ${blockers.join(', ')}`
      : `${s.reviewed}/${s.target} done · ${s.remaining} to go`;
  } else {
    $('#sub').textContent = 'No report yet — open Learn Things Good once.';
  }
  const url = (state && state.appUrl) || 'https://reedahlstrom.github.io/studying/';
  $('#go').addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url }); });
  $('#opts').addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
});
