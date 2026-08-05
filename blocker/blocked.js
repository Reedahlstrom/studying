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
  const blockers = Array.isArray(s.blockers) ? s.blockers : [];
  if (blockers.length) {
    /* name what is actually blocking — "2 cards to go" was a lie when the
       2 were habits, not cards */
    $('#count').textContent = blockers.length;
    $('#unit').textContent = blockers.join(' · ');
    $('#sub').textContent = blockers.length === 1 ? 'One thing left before this opens.' : 'Still to do before this opens:';
  } else {
    const remaining = Math.max(0, s.target - s.reviewed);
    $('#count').textContent = remaining;
    $('#unit').textContent = remaining === 1 ? 'card to go' : 'cards to go';
    $('#sub').textContent = s.reviewed > 0
      ? `${s.reviewed} done tonight. Not finished.`
      : "Tonight's cards aren't done yet.";
  }
});
