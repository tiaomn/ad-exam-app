import fs from 'node:fs';

const endpoint = 'http://127.0.0.1:9222/json';
const targets = await fetch(endpoint).then(r => r.json());
const page = targets.find(t => t.type === 'page');
if (!page) throw new Error('No page target');

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
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'evaluation failed');
  return result.result.value;
}
async function shot(path, full = false) {
  let params = { format: 'png', fromSurface: true, captureBeyondViewport: full };
  if (full) {
    const metrics = await send('Page.getLayoutMetrics');
    const { width, height } = metrics.cssContentSize;
    params.clip = { x: 0, y: 0, width, height, scale: 1 };
  }
  const { data } = await send('Page.captureScreenshot', params);
  fs.writeFileSync(path, Buffer.from(data, 'base64'));
  console.log('wrote', path);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
  screenWidth: 390, screenHeight: 844
});
await send('Page.navigate', { url: 'http://127.0.0.1:8765/index.html' });
await new Promise(r => setTimeout(r, 1200));

console.log(await evaluate(`JSON.stringify({
  innerWidth: innerWidth,
  innerHeight: innerHeight,
  scrollWidth: document.documentElement.scrollWidth,
  appWidth: document.querySelector('.app').getBoundingClientRect().width,
  tabbar: document.querySelector('.tabbar').getBoundingClientRect().toJSON(),
  thirdStat: document.querySelectorAll('.stat-card')[2].getBoundingClientRect().toJSON(),
  thirdTab: document.querySelectorAll('.tab-btn')[2].getBoundingClientRect().toJSON()
})`));

await shot('ad-exam-app/assets/_home-390.png');
await evaluate(`document.querySelector('[data-action="start-exam"]').click()`);
await new Promise(r => setTimeout(r, 450));
await shot('ad-exam-app/assets/_exam-390.png');
console.log(await evaluate(`JSON.stringify({screen: document.querySelector('.screen.active').dataset.screen, q: document.querySelector('.q-stem')?.innerText, opts: document.querySelectorAll('.option').length})`));

ws.close();
