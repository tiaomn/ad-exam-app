import fs from 'node:fs';

const targets = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
const page = targets.find(t => t.type === 'page');
if (!page) throw new Error('No page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let seq = 0;
const pending = new Map();
const exceptions = [];
const externalRequests = [];
ws.addEventListener('message', event => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
  if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails.text || 'exception');
  if (msg.method === 'Network.requestWillBeSent') {
    const url = msg.params.request.url;
    if (!url.startsWith('http://127.0.0.1:8765') && !url.startsWith('data:') && !url.startsWith('blob:')) externalRequests.push(url);
  }
});
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function shot(path) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path, Buffer.from(data, 'base64'));
  console.log('wrote', path);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = p => `ad-exam-app/assets/${p}`;

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 });
await send('Page.navigate', { url: 'http://127.0.0.1:8765/index.html' });
await sleep(1000);
await ev(`(async () => {
  for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  for (const k of await caches.keys()) await caches.delete(k);
  localStorage.clear();
  location.reload();
  return true;
})()`);
await sleep(1200);
await shot(out('_shot-home.png'));

// Start exam.
await ev(`document.querySelector('[data-action="start-exam"]').click(); true`);
await sleep(450);
let info = await ev(`JSON.stringify({screen: state.screen, total: state.paper.length, index: state.index})`);
console.log('start', info);
await shot(out('_shot-exam.png'));

// Answer question 1 correctly, verify auto-advance, jump back to verify selection.
const firstCorrect = await ev(`state.paper[0].a`);
await ev(`document.querySelectorAll('.option')[${Array.isArray(firstCorrect) ? firstCorrect[0] : firstCorrect}].click(); true`);
await sleep(450);
info = await ev(`JSON.stringify({index: state.index, answers: Object.keys(state.answers).length})`);
console.log('after first answer', info);
await ev(`goToQuestion(0); true`);
await sleep(300);
console.log('back', await ev(`JSON.stringify({index: state.index, selected: document.querySelectorAll('.option.selected').length})`));

// Fill paper: 78 correct, 15 wrong, 7 unanswered.
const fill = await ev(`(() => {
  state.answers = {};
  const qs = state.paper;
  qs.forEach((q, i) => {
    const a = Array.isArray(q.a) ? q.a.slice() : [q.a];
    if (i < 78) state.answers[q.id] = a;
    else if (i < 93) state.answers[q.id] = [a[0] === 0 ? (q.o.length > 1 ? 1 : 0) : 0];
  });
  state.startedAt = Date.now() - 1234000;
  state.elapsed = 1234;
  saveSession();
  return JSON.stringify({answered: Object.keys(state.answers).length, last: qs.length});
})()`);
console.log('fill', fill);
await ev(`finishExam(); true`);
await sleep(900);
console.log('result', await ev(`JSON.stringify({screen: state.screen, pct: document.querySelector('#result-pct').textContent, correct: state.result.correct, wrong: state.result.wrong, unanswered: state.result.unanswered, history: state.history.length, wrongbook: Object.keys(state.wrong).length})`));
await shot(out('_shot-result.png'));

await ev(`document.querySelector('[data-action="result-detail"]').click(); true`);
await sleep(450);
console.log('detail', await ev(`JSON.stringify({screen: state.screen, items: document.querySelectorAll('.detail-item').length, title: document.querySelector('#detail-head-title').textContent})`));
await shot(out('_shot-detail.png'));

await ev(`document.querySelector('[data-action="detail-back"]').click(); true`);
await sleep(300);
await ev(`document.querySelector('[data-action="go-home"]').click(); true`);
await sleep(500);
console.log('home stats', await ev(`JSON.stringify({exams: document.querySelector('#stat-exams').innerText, avg: document.querySelector('#stat-avg').innerText, wrong: document.querySelector('#stat-wrong').innerText, recent: document.querySelector('#recent-pct').textContent})`));
await shot(out('_shot-home-data.png'));

await ev(`document.querySelector('[data-action="go-history"]').click(); true`);
await sleep(400);
await shot(out('_shot-history.png'));
console.log('history cards', await ev(`document.querySelectorAll('.history-card').length`));

await ev(`document.querySelector('[data-action="go-wrong"]').click(); true`);
await sleep(400);
await shot(out('_shot-wrongbook.png'));
console.log('wrong cards', await ev(`document.querySelectorAll('.wrong-card').length`));

// Practice one question and screenshot immediate explanation.
await ev(`document.querySelector('[data-action="practice-wrong"]').click(); true`);
await sleep(500);
console.log('practice', await ev(`JSON.stringify({screen: state.screen, mode: state.mode, total: state.paper.length, idx: state.index})`));
const practiceCorrect = await ev(`(() => { const q = state.paper[state.index]; const a = Array.isArray(q.a) ? q.a : [q.a]; return a[0]; })()`);
await ev(`document.querySelectorAll('.option')[${practiceCorrect}].click(); true`);
await sleep(500);
console.log('practice revealed', await ev(`JSON.stringify({revealed: !!document.querySelector('.explanation'), correct: document.querySelector('.exp-head')?.innerText, remaining: Object.keys(state.wrong).length})`));
await shot(out('_shot-practice.png'));

// Finish practice and reload to verify persistence.
await ev(`finishPractice(); true`);
await sleep(600);
await shot(out('_shot-practice-result.png'));
const beforeReload = await ev(`JSON.stringify({history: state.history.length, wrong: Object.keys(state.wrong).length, session: localStorage.getItem('dinoExam.session.v1')})`);
console.log('before reload', beforeReload);
await ev(`location.reload(); true`);
await sleep(1000);
console.log('after reload', await ev(`JSON.stringify({history: state.history.length, wrong: Object.keys(state.wrong).length, screen: state.screen, exams: document.querySelector('#stat-exams').innerText})`));

console.log('exceptions', JSON.stringify(exceptions));
console.log('externalRequests', JSON.stringify([...new Set(externalRequests)]));
ws.close();
