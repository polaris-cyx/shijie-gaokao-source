#!/usr/bin/env node
/**
 * 内容质检：先构建，再检查覆盖率、题目质量、答案分布、重复题干。
 *
 *   node tools/validate.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const read = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const list = (dir) => existsSync(join(DATA, dir)) ? readdirSync(join(DATA, dir)).filter((f) => f.endsWith('.json')).map((f) => read(join(DATA, dir, f))) : [];

console.log('▸ 先运行构建自检…\n');
try { execFileSync(process.execPath, [join(ROOT, 'tools', 'build.mjs')], { stdio: 'inherit' }); }
catch (e) { console.log('\n构建失败，先修复错误。'); process.exit(1); }

const meta = read(join(DATA, 'meta.json'));
const chapters = read(join(DATA, 'chapters.json')).chapters;
const kps = list('kp').flatMap((o) => o.items || []);
const qs = list('questions').flatMap((o) => o.items || []);
const formulas = read(join(DATA, 'formulas.json')).items;
const equations = read(join(DATA, 'chem_equations.json')).items;
const vocab = read(join(DATA, 'vocab.json')).items;
const sources = read(join(DATA, 'sources.json')).items;

const issues = [];
const notes = [];
const fail = (m) => issues.push(m);

/* 覆盖率 */
const chapterIds = new Set(chapters.map((c) => c.id));
for (const c of chapters) {
  const k = kps.filter((x) => x.chapter === c.id).length;
  const q = qs.filter((x) => x.chapter === c.id).length;
  if (k === 0) fail(`${c.id} ${c.name}：没有知识卡`);
  else if (k < 3) notes.push(`${c.id} ${c.name}：知识卡仅 ${k} 张`);
  if (q === 0) fail(`${c.id} ${c.name}：没有题目`);
  else if (q < 10) notes.push(`${c.id} ${c.name}：题目仅 ${q} 道`);
}
for (const k of kps) if (!chapterIds.has(k.chapter)) fail(`知识卡 ${k.id}：章节 ${k.chapter} 不存在`);
for (const q of qs) if (!chapterIds.has(q.chapter)) fail(`题目 ${q.id}：章节 ${q.chapter} 不存在`);

/* 题型 */
const byType = {};
qs.forEach((q) => { byType[q.type] = (byType[q.type] || 0) + 1; });
for (const t of ['single', 'multi', 'judge', 'fill']) if (!byType[t]) fail(`没有 ${t} 类型题目`);
notes.push(`题型：单选 ${byType.single || 0} / 多选 ${byType.multi || 0} / 判断 ${byType.judge || 0} / 填空 ${byType.fill || 0}`);

/* 单选答案分布 */
const sd = [0, 0, 0, 0];
qs.filter((q) => q.type === 'single').forEach((q) => { if (q.answer) sd[q.answer[0]] = (sd[q.answer[0]] || 0) + 1; });
const totalSingle = Math.max(1, byType.single || 1);
const skew = sd.map((x) => x / totalSingle);
if (Math.max(...skew) > 0.4) fail(`单选答案分布偏斜：${skew.map((x) => Math.round(x * 100) + '%').join(' / ')}`);
notes.push(`单选答案分布：${sd.map((x) => Math.round(x / totalSingle * 100) + '%').join(' / ')}`);

/* 重复题干 */
const seen = new Map();
qs.forEach((q) => {
  const key = String(q.stem).replace(/\s+/g, '').slice(0, 60);
  if (seen.has(key)) notes.push(`题干疑似重复：${q.id} 与 ${seen.get(key)}`);
  else seen.set(key, q.id);
});

/* 质量抽查 */
for (const q of qs) {
  if (!q.explain || q.explain.length < 12) fail(`${q.id}：解析过短`);
  if (q.type === 'single' && q.options && q.options.length !== 4) fail(`${q.id}：单选选项不是 4 个`);
  if (q.type === 'multi' && q.answer && q.answer.length < 2) fail(`${q.id}：多选答案少于 2 个`);
  if (q.type === 'fill' && (!q.answerText || !q.answerText.length)) fail(`${q.id}：填空无答案`);
  if (q.options && q.options.some((o) => /以上(都|均|全)(对|正确|是)|以上都不/.test(String(o)))) fail(`${q.id}：含「以上都对」类选项`);
}
const shorts = qs.filter((q) => q.stem && q.stem.length < 6);
if (shorts.length) notes.push(`${shorts.length} 道题题干短于 6 字`);

/* 数据覆盖 */
notes.push(`知识卡 ${kps.length} · 题目 ${qs.length} · 公式 ${formulas.length} · 方程式 ${equations.length} · 单词 ${vocab.length}`);
notes.push(`来源 PDF ${sources.length} 份；有卡片的来源 ${new Set(kps.map((k) => k.source?.file)).size} 份`);

/* 章节均衡 */
const withKp = chapters.filter((c) => kps.some((k) => k.chapter === c.id)).length;
notes.push(`章节覆盖：${withKp} / ${chapters.length}`);
for (const s of meta.subjects) {
  const sk = kps.filter((k) => k.subject === s.id).length;
  const sq = qs.filter((q) => q.subject === s.id).length;
  notes.push(`  ${s.name}：卡 ${sk} · 题 ${sq}`);
}

console.log('\n' + '─'.repeat(64));
console.log('内容质检报告');
console.log('─'.repeat(64));
notes.forEach((n) => console.log('  · ' + n));
if (issues.length) {
  console.log(`\n✗ 发现 ${issues.length} 个问题：`);
  issues.slice(0, 40).forEach((x) => console.log('  · ' + x));
  process.exitCode = 1;
} else {
  console.log('\n✓ 质检通过：没有阻断性问题。');
}
