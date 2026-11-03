import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../../input/广告设计师三级理论-全库随机抽题.html', import.meta.url), 'utf8');
const start = src.indexOf('const QUESTION_DB = [');
const end = src.indexOf('\n];', start);
if (start < 0 || end < 0) throw new Error('QUESTION_DB block not found');
const code = src.slice(start, end + 3).replace('const QUESTION_DB =', 'globalThis.DB =');
const ctx = { globalThis: null };
ctx.globalThis = ctx;
vm.runInNewContext(code, ctx);
const db = ctx.DB;

const stats = { total: db.length, s: 0, j: 0, m: 0 };
const issues = [];
const seen = new Map();
const ids = new Set();

for (const [i, q] of db.entries()) {
  stats[q.t] = (stats[q.t] || 0) + 1;
  const label = `#${i + 1} id=${q.id}`;
  if (!['s', 'j', 'm'].includes(q.t)) issues.push(`${label}: bad type ${q.t}`);
  if (!q.q || typeof q.q !== 'string') issues.push(`${label}: bad question`);
  if (!Array.isArray(q.o) || q.o.length < 2) issues.push(`${label}: bad options`);
  if (q.o.some(x => typeof x !== 'string' || !x.trim())) issues.push(`${label}: empty option`);
  if (q.t === 'm') {
    if (!Array.isArray(q.a) || q.a.length < 2) issues.push(`${label}: multi answer not array/2+`);
    if (Array.isArray(q.a) && q.a.some(x => !Number.isInteger(x) || x < 0 || x >= q.o.length)) issues.push(`${label}: multi answer out of range`);
    if (Array.isArray(q.a) && new Set(q.a).size !== q.a.length) issues.push(`${label}: duplicate answer index`);
  } else {
    if (!Number.isInteger(q.a) || q.a < 0 || q.a >= q.o.length) issues.push(`${label}: answer out of range ${q.a}`);
  }
  if (!Array.isArray(q.e) || q.e.length !== q.o.length) issues.push(`${label}: explanation count ${q.e?.length}/${q.o.length}`);
  if (q.w) issues.push(`${label}: flagged w=1`);
  if (q.o.length >= 6) issues.push(`${label}: options=${q.o.length}`);
  const text = q.q.replace(/\s+/g, '');
  if (seen.has(text)) issues.push(`${label}: duplicate of ${seen.get(text)}`);
  else seen.set(text, label);
  if (ids.has(q.id)) issues.push(`${label}: duplicate id`);
  ids.add(q.id);
  if (!/^[A-E]、/.test(q.o[0])) issues.push(`${label}: option prefix odd: ${q.o[0].slice(0,10)}`);
}

console.log(JSON.stringify({ stats, issues, optionCounts: Object.fromEntries([...new Set(db.map(q => q.o.length))].sort().map(n => [n, db.filter(q => q.o.length === n).length])) }, null, 2));
