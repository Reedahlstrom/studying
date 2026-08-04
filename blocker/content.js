/* Runs only on the Learn Things Good page. Reads the status the app publishes to
   localStorage and forwards it to the extension. Nothing else. */

const KEY = 'ledger.status';
let last = null;

function report() {
  let status = null;
  try { status = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return; }
  if (!status) return;
  const fingerprint = `${status.day}|${status.done}|${status.reviewed}|${status.due}`;
  if (fingerprint === last) return;
  last = fingerprint;
  chrome.runtime.sendMessage({ type: 'ledger-status', status }).catch(() => {});
}

report();
setInterval(report, 3000);                 // same-tab writes don't fire 'storage'
window.addEventListener('storage', report); // other tabs do
window.addEventListener('focus', report);
