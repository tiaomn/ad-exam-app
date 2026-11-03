import fs from 'node:fs';

const width = Number(process.argv[2] || 390);
const height = Number(process.argv[3] || 844);
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
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true, screenWidth: width, screenHeight: height });
await ev(`(async () => {
  for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  for (const k of await caches.keys()) await caches.delete(k);
  localStorage.clear();
  location.reload();
  return true;
})()`);
await new Promise(r => setTimeout(r, 1200));
console.log(await ev(`JSON.stringify({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,app:document.querySelector('.app').getBoundingClientRect().width,hero:document.querySelector('.hero').getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth})`));
await shot(`_layout-${width}.png`);
await ev(`document.querySelector('[data-action="start-exam"]').click(); true`);
await new Promise(r => setTimeout(r, 450));
await ev(`document.querySelector('[data-action="open-sheet"]').click(); true`);
await new Promise(r => setTimeout(r, 450));
await shot(`_sheet-${width}.png`);
console.log(await ev(`JSON.stringify({sheet:document.querySelector('#sheet-wrap').getBoundingClientRect().toJSON(), panel:document.querySelector('.sheet').getBoundingClientRect().toJSON(), cells:document.querySelectorAll('.answer-cell').length, gridCols:getComputedStyle(document.querySelector('.answer-grid')).gridTemplateColumns})`));
ws.close();
