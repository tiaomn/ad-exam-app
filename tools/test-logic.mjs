import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeElement(id = '') {
  const el = {
    id,
    dataset: {},
    style: { setProperty() {} },
    classList: {
      _v: new Set(),
      add(...xs) { xs.forEach(x => this._v.add(x)); },
      remove(...xs) { xs.forEach(x => this._v.delete(x)); },
      toggle(x, force) { if (force === undefined) force = !this._v.has(x); force ? this._v.add(x) : this._v.delete(x); return force; },
      contains(x) { return this._v.has(x); }
    },
    children: [],
    hidden: false,
    disabled: false,
    textContent: '',
    innerHTML: '',
    className: '',
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {},
    focus() {},
    closest() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  return el;
}

const elements = new Map();
const body = makeElement('body');
const document = {
  body,
  querySelector(sel) {
    if (!elements.has(sel)) elements.set(sel, makeElement(sel));
    return elements.get(sel);
  },
  querySelectorAll() { return []; },
  addEventListener() {},
  createElement() { return makeElement(); }
};

const store = new Map();
const localStorage = {
  getItem(k) { return store.has(k) ? store.get(k) : null; },
  setItem(k, v) { store.set(k, String(v)); },
  removeItem(k) { store.delete(k); },
  get length() { return store.size; }
};

const context = {
  console,
  document,
  localStorage,
  navigator: {},
  location: { protocol: 'file:' },
  window: { scrollTo() {}, Capacitor: null },
  setTimeout() { return 0; },
  clearTimeout() {},
  setInterval() { return 0; },
  clearInterval() {},
  requestAnimationFrame(fn) { fn(); },
  Blob,
  Math,
  Date,
  JSON,
  String,
  Number,
  Array,
  Object,
  Map,
  Set,
  parseInt,
  isNaN,
  Promise
};
context.globalThis = context;
vm.createContext(context);

const tests = [];
function check(name, condition, detail = '') {
  tests.push({ name, ok: Boolean(condition), detail });
  if (!condition) console.error(`FAIL: ${name} ${detail}`);
  else console.log(`ok  ${name}`);
}

vm.runInContext(script + `
globalThis.__api = {
  QUESTION_DB, state, startExam, finishExam, sameAnswer, renderHistory,
  openRecord, startPractice, revealPractice
};`, context);
const api = context.__api;

check('题库总数 580', api.QUESTION_DB.length === 580, String(api.QUESTION_DB.length));
check('单选 376', api.QUESTION_DB.filter(q => q.t === 's').length === 376);
check('判断 98', api.QUESTION_DB.filter(q => q.t === 'j').length === 98);
check('多选 106', api.QUESTION_DB.filter(q => q.t === 'm').length === 106);
check('首页初始化', api.state.screen === 'home');

api.startExam();
check('组卷 100 题', api.state.paper.length === 100, String(api.state.paper.length));
check('组卷题型 67/17/16', (() => {
  const c = { s: 0, j: 0, m: 0 };
  api.state.paper.forEach(q => c[q.t]++);
  return c.s === 67 && c.j === 17 && c.m === 16;
})());

for (const q of api.state.paper) {
  const a = Array.isArray(q.a) ? q.a : [q.a];
  api.state.answers[q.id] = a.slice();
}
api.finishExam();
check('全对成绩 100', api.state.history[0].correct === 100, JSON.stringify(api.state.history[0]));
check('全对错题本为空', Object.keys(api.state.wrong).length === 0);
check('交卷后成绩保存', JSON.parse(store.get('dinoExam.history.v1')).length === 1);

api.startExam();
const wrongPaper = api.state.paper;
let wrongCount = 0;
for (let i = 0; i < wrongPaper.length; i++) {
  const q = wrongPaper[i];
  if (i < 12) {
    const a = Array.isArray(q.a) ? q.a : [q.a];
    // deliberately choose a different answer when possible
    api.state.answers[q.id] = [a[0] === 0 ? (q.o.length > 1 ? 1 : 0) : 0];
    if (!api.sameAnswer(q, api.state.answers[q.id])) wrongCount++;
  } else {
    api.state.answers[q.id] = (Array.isArray(q.a) ? q.a : [q.a]).slice();
  }
}
api.finishExam();
const rec2 = api.state.history[0];
check('错题会进入错题本', Object.keys(api.state.wrong).length === wrongCount, `${Object.keys(api.state.wrong).length}/${wrongCount}`);
check('错题记录数量正确', rec2.wrong + rec2.unanswered === wrongCount, JSON.stringify({ wrong: rec2.wrong, unanswered: rec2.unanswered, wrongCount }));

api.renderHistory();
api.openRecord(rec2);
check('历史详情可渲染', api.state.screen === 'detail');

const beforePractice = Object.keys(api.state.wrong).length;
api.startPractice();
check('错题练习启动', api.state.mode === 'practice' && api.state.paper.length > 0);
const q0 = api.state.paper[0];
api.state.answers[q0.id] = (Array.isArray(q0.a) ? q0.a : [q0.a]).slice();
api.revealPractice(q0);
check('练习答对后移出错题本', Object.keys(api.state.wrong).length === beforePractice - 1, `${Object.keys(api.state.wrong).length}/${beforePractice}`);

// Reload with the same storage to verify persistence.
const context2 = { ...context };
context2.localStorage = localStorage;
context2.document = document;
context2.window = { scrollTo() {}, Capacitor: null };
context2.globalThis = context2;
vm.createContext(context2);
vm.runInContext(script + '\nglobalThis.__api={state};', context2);
check('重载后历史保留', context2.__api.state.history.length === 2, String(context2.__api.state.history.length));
check('重载后错题保留', Object.keys(context2.__api.state.wrong).length === beforePractice - 1);

const failed = tests.filter(t => !t.ok);
console.log(`\n${tests.length - failed.length}/${tests.length} passed`);
if (failed.length) process.exit(1);
