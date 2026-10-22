#!/usr/bin/env node
/**
 * 构建数据仓库 → app/data.bundle.js
 *
 * 源：
 *   data/meta.json, chapters.json, sources.json, plan.json,
 *   methods.json, formulas.json, chem_equations.json, vocab.json
 *   data/kp/*.json        { block, items: [知识卡] }
 *   data/questions/*.json { block, items: [题目] }
 *
 * 产物：app/data.bundle.js —— <script> 直接加载，file:// 也能用。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const OUT = join(ROOT, 'app', 'data.bundle.js');
const TYPES = ['single', 'multi', 'judge', 'fill'];
const SUBJECTS = ['math', 'physics', 'chemistry', 'english'];

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function readJSON(p) {
  const raw = readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  try { return JSON.parse(raw); } catch (e) { throw new Error(`${basename(p)} JSON 解析失败：${e.message}`); }
}
function listJSON(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => join(dir, f));
}

const meta = readJSON(join(DATA, 'meta.json'));
const chapterFile = readJSON(join(DATA, 'chapters.json'));
const chapters = chapterFile.chapters;
const sourcesFile = existsSync(join(DATA, 'sources.json')) ? readJSON(join(DATA, 'sources.json')) : { items: [] };
const sources = sourcesFile.items;
const plan = existsSync(join(DATA, 'plan.json')) ? readJSON(join(DATA, 'plan.json')) : { items: [] };
const methods = existsSync(join(DATA, 'methods.json')) ? readJSON(join(DATA, 'methods.json')) : { items: [] };
const formulas = existsSync(join(DATA, 'formulas.json')) ? readJSON(join(DATA, 'formulas.json')) : { items: [] };
const equations = existsSync(join(DATA, 'chem_equations.json')) ? readJSON(join(DATA, 'chem_equations.json')) : { items: [] };
const vocab = existsSync(join(DATA, 'vocab.json')) ? readJSON(join(DATA, 'vocab.json')) : { items: [] };
const scenes = existsSync(join(DATA, 'scenes.json')) ? readJSON(join(DATA, 'scenes.json')) : { items: [] };

const CH = new Map(chapters.map((c) => [c.id, c]));
const sourceNames = new Set(sources.map((s) => s.file));

/* ------------------------------ 知识卡 ------------------------------ */
const kps = [];
const seenKP = new Set();
for (const file of listJSON(join(DATA, 'kp'))) {
  let obj;
  try { obj = readJSON(file); } catch (e) { fail(e.message); continue; }
  const items = Array.isArray(obj) ? obj : obj.items;
  if (!Array.isArray(items)) { fail(`${basename(file)}：缺少 items 数组`); continue; }
  for (const k of items) {
    const tag = `${basename(file)} → ${k.id || '(无 id)'}`;
    if (!k.id) { fail(`${tag}：缺 id`); continue; }
    if (seenKP.has(k.id)) { fail(`${tag}：id 重复`); continue; }
    seenKP.add(k.id);
    if (!SUBJECTS.includes(k.subject)) { fail(`${tag}：subject 非法 "${k.subject}"`); continue; }
    const ch = CH.get(k.chapter);
    if (!ch) { fail(`${tag}：chapter 非法 "${k.chapter}"`); continue; }
    if (ch.subject !== k.subject) fail(`${tag}：chapter ${k.chapter} 属于 ${ch.subject}，与 subject ${k.subject} 不一致`);
    if (!k.topic || !k.core) { fail(`${tag}：缺 topic/core`); continue; }
    if (k.source && k.source.file && !sourceNames.has(k.source.file)) warn(`${tag}：来源文件不在 sources.json 中`);
    k.star = Math.min(5, Math.max(1, Number(k.star) || 3));
    k.formulas = Array.isArray(k.formulas) ? k.formulas : [];
    k.bullets = Array.isArray(k.bullets) ? k.bullets : [];
    k.examples = Array.isArray(k.examples) ? k.examples : [];
    k.tags = Array.isArray(k.tags) ? k.tags : [];
    kps.push(k);
  }
}

/* ------------------------------- 题目 ------------------------------- */
const questions = [];
const seenQ = new Set();
for (const file of listJSON(join(DATA, 'questions'))) {
  let obj;
  try { obj = readJSON(file); } catch (e) { fail(e.message); continue; }
  const items = Array.isArray(obj) ? obj : obj.items;
  if (!Array.isArray(items)) { fail(`${basename(file)}：缺少 items 数组`); continue; }
  for (const q of items) {
    const tag = `${basename(file)} → ${q.id || '(无 id)'}`;
    if (!q.id) { fail(`${tag}：缺 id`); continue; }
    if (seenQ.has(q.id)) { fail(`${tag}：id 重复`); continue; }
    seenQ.add(q.id);
    if (!SUBJECTS.includes(q.subject)) { fail(`${tag}：subject 非法 "${q.subject}"`); continue; }
    const ch = CH.get(q.chapter);
    if (!ch) { fail(`${tag}：chapter 非法 "${q.chapter}"`); continue; }
    if (ch.subject !== q.subject) fail(`${tag}：chapter 与 subject 不一致`);
    if (!TYPES.includes(q.type)) { fail(`${tag}：type 非法 "${q.type}"`); continue; }
    if (!q.stem || !q.explain) { fail(`${tag}：缺 stem/explain`); continue; }
    if (q.type === 'fill') {
      if (!Array.isArray(q.answerText) || !q.answerText.length) { fail(`${tag}：填空缺 answerText`); continue; }
      q.options = [];
      q.answer = [];
    } else {
      if (!Array.isArray(q.options) || q.options.length < 2) { fail(`${tag}：options 不足`); continue; }
      if (q.type === 'judge') q.options = ['正确', '错误'];
      if (!Array.isArray(q.answer)) { fail(`${tag}：answer 必须是数组`); continue; }
      q.answer = q.answer.map(Number);
      if (!q.answer.length) { fail(`${tag}：answer 为空`); continue; }
      if (q.answer.some((i) => !Number.isInteger(i) || i < 0 || i >= q.options.length)) { fail(`${tag}：answer 下标越界`); continue; }
      if (q.type === 'single' && q.answer.length !== 1) { fail(`${tag}：单选必须 1 个答案`); continue; }
      if (q.type === 'multi' && q.answer.length < 2) { fail(`${tag}：多选至少 2 个答案`); continue; }
      if (q.type === 'single' && q.options.length !== 4) warn(`${tag}：单选不是 4 个选项（${q.options.length}）`);
      if (q.options.some((o) => /以上(都|均|全)(对|正确|是)|以上都不/.test(String(o)))) warn(`${tag}：选项含「以上都对」类`);
      if (new Set(q.options).size !== q.options.length) warn(`${tag}：选项有重复`);
    }
    if (q.source && q.source.file && !sourceNames.has(q.source.file)) warn(`${tag}：来源文件不在 sources.json 中`);
    q.difficulty = Math.min(3, Math.max(1, Number(q.difficulty) || 2));
    q.tags = Array.isArray(q.tags) ? q.tags : [];
    q.kp = Array.isArray(q.kp) ? q.kp : [];
    questions.push(q);
  }
}

/* --------------------------- 速查 / 单词 --------------------------- */
const seenF = new Set();
for (const f of formulas.items) {
  if (!f.id || seenF.has(f.id)) { fail(`公式 ${f.id || '(无 id)'}：id 缺失或重复`); continue; }
  seenF.add(f.id);
  if (!SUBJECTS.includes(f.subject)) fail(`公式 ${f.id}：subject 非法`);
  if (!CH.has(f.chapter)) fail(`公式 ${f.id}：chapter 非法`);
  if (!f.name || !f.expr) fail(`公式 ${f.id}：缺 name/expr`);
}
const seenE = new Set();
for (const e of equations.items) {
  if (!e.id || seenE.has(e.id)) { fail(`方程式 ${e.id || '(无 id)'}：id 缺失或重复`); continue; }
  seenE.add(e.id);
  if (!CH.has(e.chapter)) fail(`方程式 ${e.id}：chapter 非法`);
  if (!e.name || !e.equation) fail(`方程式 ${e.id}：缺 name/equation`);
}
const sceneByWord = new Map(scenes.items.map((s) => [String(s.word).toLowerCase(), s]));
const seenV = new Set();
for (const v of vocab.items) {
  if (!v.id || seenV.has(v.id)) { fail(`单词 ${v.id || '(无 id)'}：id 缺失或重复`); continue; }
  seenV.add(v.id);
  if (!CH.has(v.chapter)) fail(`单词 ${v.id}：chapter 非法`);
  if (!v.word) fail(`单词 ${v.id}：缺 word`);
  v.example = String(v.example || '').replace(/\s*\([A-Za-z][A-Za-z'\- ]*\)/g, '').replace(/\s+/g, ' ').trim();
  const sc = sceneByWord.get(String(v.word || '').toLowerCase());
  if (sc) {
    v.scene = sc.en;
    v.sceneCn = sc.cn;
    v.sceneTag = sc.tag;
    v.sceneId = sc.id;
  }
}

/* ------------------------------- 统计 ------------------------------- */
const bySubject = {};
for (const s of meta.subjects) bySubject[s.id] = { kp: 0, q: 0, chapters: 0, formulas: 0, equations: 0, vocab: 0 };
for (const c of chapters) if (bySubject[c.subject]) bySubject[c.subject].chapters++;
for (const k of kps) bySubject[k.subject].kp++;
for (const q of questions) bySubject[q.subject].q++;
for (const f of formulas.items) bySubject[f.subject] && bySubject[f.subject].formulas++;
for (const e of equations.items) { const b = bySubject[CH.get(e.chapter).subject]; if (b) b.equations++; }
for (const v of vocab.items) bySubject[v.subject || CH.get(v.chapter).subject].vocab++;

const byChapter = {};
for (const c of chapters) byChapter[c.id] = { kp: 0, q: 0 };
for (const k of kps) byChapter[k.chapter].kp++;
for (const q of questions) byChapter[q.chapter].q++;
const byType = { single: 0, multi: 0, judge: 0, fill: 0 };
for (const q of questions) byType[q.type]++;

const stats = {
  kp: kps.length, questions: questions.length,
  formulas: formulas.items.length, equations: equations.items.length,
  vocab: vocab.items.length, scenes: scenes.items.length, methods: methods.items.length,
  sources: sources.length, chapters: chapters.length,
  bySubject, byChapter, byType,
  builtAt: new Date().toISOString()
};

const payload = {
  meta, chapters, sources, plan: plan.items, methods: methods.items,
  formulas: formulas.items, equations: equations.items, vocab: vocab.items, scenes: scenes.items,
  kps, questions, stats
};

mkdirSync(join(ROOT, 'app'), { recursive: true });
const js = '/* 自动生成，请勿手改。源：data/** → 重新生成：node tools/build.mjs */\n' +
  'window.DB = ' + JSON.stringify(payload) + ';\n';
writeFileSync(OUT, js, 'utf8');

/* ------------------------------- 报告 ------------------------------- */
const line = '─'.repeat(68);
console.log(line);
console.log(`${meta.name || '拾阶'} · 数据构建`);
console.log(line);
console.log(`知识卡 ${kps.length} · 题目 ${questions.length} · 公式 ${formulas.items.length} · 方程式 ${equations.items.length} · 单词 ${vocab.items.length} · 情景 ${scenes.items.length} · 方法 ${methods.items.length}`);
console.log(`题型：单选 ${byType.single} / 多选 ${byType.multi} / 判断 ${byType.judge} / 填空 ${byType.fill}`);
{
  const sd = [0, 0, 0, 0];
  questions.filter((q) => q.type === 'single').forEach((q) => { sd[q.answer[0]] = (sd[q.answer[0]] || 0) + 1; });
  const tot = Math.max(1, byType.single);
  console.log(`单选答案分布：A ${sd[0]} / B ${sd[1]} / C ${sd[2]} / D ${sd[3]}（${sd.map((x) => Math.round(x / tot * 100) + '%').join(' / ')}）`);
}
console.log('学科分布：');
for (const s of meta.subjects) {
  const b = bySubject[s.id];
  console.log(`  ${s.name.padEnd(4)} 卡 ${String(b.kp).padStart(3)} · 题 ${String(b.q).padStart(4)} · 公式 ${String(b.formulas).padStart(3)} · 方程式 ${String(b.equations).padStart(3)} · 单词 ${String(b.vocab).padStart(3)}`);
}
console.log('章节分布：');
for (const c of chapters) {
  const b = byChapter[c.id];
  console.log(`  ${c.id.padEnd(4)} ${c.name.padEnd(12)} 卡 ${String(b.kp).padStart(3)} · 题 ${String(b.q).padStart(4)}`);
}
if (warnings.length) {
  console.log(`\n⚠ 警告 ${warnings.length} 条（不影响构建）：`);
  warnings.slice(0, 25).forEach((w) => console.log('  · ' + w));
  if (warnings.length > 25) console.log(`  … 其余 ${warnings.length - 25} 条省略`);
}
if (errors.length) {
  console.log(`\n✗ 错误 ${errors.length} 条：`);
  errors.slice(0, 60).forEach((e) => console.log('  · ' + e));
  console.log('\n产物已生成，但存在错误，请修复后重跑。');
  process.exitCode = 1;
} else {
  console.log(`\n✓ 构建完成 → app/data.bundle.js（${(js.length / 1024).toFixed(0)} KB）`);
}
