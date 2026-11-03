import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const localSource = path.join(root, 'input', '广告设计师三级理论-全库随机抽题.html');
const source = fs.existsSync(localSource)
  ? localSource
  : path.resolve(root, '..', 'input', '广告设计师三级理论-全库随机抽题.html');
const src = fs.readFileSync(source, 'utf8');
const start = src.indexOf('const QUESTION_DB = [');
const end = src.indexOf('\n];', start);
if (start < 0 || end < 0) throw new Error('QUESTION_DB block not found');

const code = src.slice(start, end + 3).replace('const QUESTION_DB =', 'globalThis.DB =');
const ctx = {};
ctx.globalThis = ctx;
vm.runInNewContext(code, ctx);

const clean = ctx.DB.map((q) => ({
  id: q.id,
  t: q.t,
  q: q.q,
  o: q.o,
  a: q.a,
  e: q.e,
  ...(q.w ? { w: 1 } : {}),
}));

fs.mkdirSync(path.join(root, 'src'), { recursive: true });
fs.writeFileSync(path.join(root, 'src', 'questions.json'), JSON.stringify(clean, null, 2) + '\n', 'utf8');
console.log(`Wrote ${clean.length} questions to src/questions.json`);
