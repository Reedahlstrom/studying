const $ = (s) => document.querySelector(s);

chrome.runtime.sendMessage({ type: 'get-state' }, (state) => {
  const appUrl = (state && state.appUrl) || 'https://reedahlstrom.github.io/studying/';
  $('#go').href = appUrl;
  $('#go').addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: appUrl }); });

  const s = state && state.status;
  if (!s) {
    $('#sub').textContent = 'No study record found for today.';
    $('#count').textContent = '?';
    $('#unit').textContent = 'open Learn Things Good so it can report in';
    return;
  }
  const remaining = typeof s.remaining === 'number' ? s.remaining : Math.max(0, s.target - s.reviewed);
  $('#count').textContent = remaining;
  $('#unit').textContent = remaining === 1 ? 'card to go' : 'cards to go';
  $('#sub').textContent = s.reviewed > 0
    ? `${s.reviewed} done tonight. Not finished.`
    : "Tonight's cards aren't done yet.";
});
