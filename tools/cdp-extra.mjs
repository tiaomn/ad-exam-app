import fs from 'node:fs';

const targets = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
const page = targets.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let seq = 0;
const pending = new Map();
ws.addEventListener('message', event => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval failed');
  return r.result.value;
}
async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(`ad-exam-app/assets/${name}`, Buffer.from(data, 'base64'));
  console.log('wrote', name);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 });
await ev(`(async () => {
  for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  for (const k of await caches.keys()) await caches.delete(k);
  localStorage.clear();
  location.reload();
  return true;
})()`);
await sleep(1200);

// Session resume.
await ev(`document.querySelector('[data-action="start-exam"]').click(); true`);
await sleep(400);
await ev(`document.querySelectorAll('.option')[0].click(); true`);
await sleep(400);
await ev(`saveSession(); stopTimer(); showScreen('home'); true`);
await sleep(500);
console.log('resume card', await ev(`JSON.stringify({visible:!document.querySelector('#resume-card').hidden, title:document.querySelector('#resume-title').innerText, sub:document.querySelector('#resume-sub').innerText})`));
await ev(`location.reload(); true`);
await sleep(1000);
console.log('after reload session', await ev(`JSON.stringify({visible:!document.querySelector('#resume-card').hidden, session:!!state.session, index:state.session?.index, paper:state.session?.paperIds.length})`));
await ev(`document.querySelector('#resume-card [data-action="resume-exam"]').click(); true`);
await sleep(500);
console.log('resumed', await ev(`JSON.stringify({screen:state.screen, index:state.index, total:state.paper.length, answers:Object.keys(state.answers).length})`));

// About dialog.
await ev(`showScreen('home'); document.querySelector('[data-action="about"]').click(); true`);
await sleep(350);
await shot('_about.png');
console.log('modal', await ev(`JSON.stringify({visible:!document.querySelector('#modal').hidden, title:document.querySelector('#modal-title').innerText, buttons:document.querySelectorAll('#modal-actions button').length})`));
await ev(`document.querySelector('#modal-actions .ok').click(); true`);
await sleep(300);

// Offline PWA test: wait for SW, reload once so it controls, then go offline.
await sleep(1200);
await ev(`location.reload(); true`);
await sleep(1200);
console.log('sw', await ev(`(async()=>JSON.stringify({controller:!!navigator.serviceWorker.controller, registrations:(await navigator.serviceWorker.getRegistrations()).length}))()`));
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await ev(`location.reload(); true`);
await sleep(1500);
console.log('offline', await ev(`JSON.stringify({title:document.title, screen:document.querySelector('.screen.active')?.dataset.screen, hasDb:typeof QUESTION_DB!=='undefined', total:QUESTION_DB?.length})`));
await shot('_offline.png');
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
ws.close();
