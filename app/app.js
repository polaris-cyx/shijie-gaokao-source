/* ══════════════════════════════════════════════════════════════
   拾阶 · 高中学习与备考
   纯前端、零依赖、localStorage 持久化、可离线
   ══════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const DB = window.DB || {
  meta: {}, chapters: [], kps: [], questions: [], formulas: [], equations: [],
  vocab: [], methods: [], sources: [], plan: [], stats: {}
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pad2 = (n) => String(n).padStart(2, '0');
const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const uniq = (a) => Array.from(new Set(a));
const fmtClock = (s) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;

/* ───────────────── 索引 ───────────────── */
const SUBJECTS = DB.meta.subjects || [];
const SUB = new Map(SUBJECTS.map((s) => [s.id, s]));
const CHAPTERS = DB.chapters || [];
const CH = new Map(CHAPTERS.map((c) => [c.id, c]));
const KP = new Map(DB.kps.map((k) => [k.id, k]));
const Q = new Map(DB.questions.map((q) => [q.id, q]));
const VOC = new Map(DB.vocab.map((v) => [v.id, v]));
const FORMULA = new Map(DB.formulas.map((f) => [f.id, f]));
const EQ = new Map(DB.equations.map((e) => [e.id, e]));
const METHODS = DB.methods || [];
const SOURCES = DB.sources || [];
const PLAN = DB.plan || [];
const CH_ORDER = CHAPTERS.map((c) => c.id);

const chaptersOf = (sub) => CHAPTERS.filter((c) => c.subject === sub);
const kpsOf = (chapter) => DB.kps.filter((k) => k.chapter === chapter);
const qsOf = (chapter) => DB.questions.filter((q) => q.chapter === chapter);
const subColor = (id) => (SUB.get(id) || {}).color || 'var(--brand)';
const subName = (id) => (SUB.get(id) || {}).name || id;
const chName = (id) => (CH.get(id) || {}).name || id;
const chColor = (id) => (CH.get(id) || {}).color || subColor((CH.get(id) || {}).subject);

/* ───────────────── 状态 ───────────────── */
const LS = 'shijie_gaokao_v1';
const DEF = {
  theme: 'light', view: 'today',
  prog: {}, star: {}, notes: {}, wrong: {}, knownWords: {},
  exams: [], activity: {}, chapStats: {},
  planStart: null, planDone: {}, lastCard: null,
  settings: { examDate: null, goals: null }
};
let state = JSON.parse(JSON.stringify(DEF));
function load() {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) state = Object.assign({}, DEF, JSON.parse(raw));
  } catch (e) { /* 损坏数据忽略 */ }
  state.prog = state.prog || {};
  state.star = state.star || {};
  state.notes = state.notes || {};
  state.wrong = state.wrong || {};
  state.knownWords = state.knownWords || {};
  state.exams = state.exams || [];
  state.activity = state.activity || {};
  state.chapStats = state.chapStats || {};
  state.planDone = state.planDone || {};
  state.settings = Object.assign({ examDate: null, goals: null }, state.settings || {});
  if (state.theme !== 'dark') state.theme = 'light';
  document.documentElement.setAttribute('data-theme', state.theme);
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) { /* 配额 */ }
  }, 160);
}

const ui = {
  learn: { chapter: null, subject: null, mode: 'all', queue: [], idx: 0, hide: false, revealed: false },
  quizCfg: { subjects: ['all'], chapters: ['all'], types: ['single', 'multi', 'judge', 'fill'], count: 10, wrongOnly: false },
  quiz: null,
  examCfg: { subject: 'all', count: 25, minutes: 45 },
  exam: null,
  lookup: { tab: 'formula', q: '', subject: 'all', masked: false },
  vocab: { day: null, q: '', flash: false, revealed: {} },
  search: { q: '', sel: 0, results: [] },
  timer: { left: 25 * 60, running: false, id: null, total: 25 * 60 },
  planOpen: false
};

/* ───────────────── 日期 / 学习记录 ───────────────── */
function dstr(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseDate(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return dstr(d); }
function dayDiff(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
const TODAY = dstr();
const WD = ['日', '一', '二', '三', '四', '五', '六'];
function prettyDate(s = TODAY) { const d = parseDate(s); return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 周${WD[d.getDay()]}`; }
function examDate() { return state.settings.examDate || DB.meta.examDate || '2027-06-07'; }
function daysToExam() { return dayDiff(TODAY, examDate()); }
function goals() { return Object.assign({}, DB.meta.dailyGoal || { cards: 12, quiz: 10, words: 15, minutes: 45 }, state.settings.goals || {}); }

function act(kind, n = 1) {
  const a = state.activity[TODAY] || { cards: 0, quiz: 0, words: 0, minutes: 0, exams: 0, review: 0 };
  a[kind] = (a[kind] || 0) + n;
  state.activity[TODAY] = a;
  save();
}
function todayAct() { return Object.assign({ cards: 0, quiz: 0, words: 0, minutes: 0, exams: 0, review: 0 }, state.activity[TODAY] || {}); }
function totalAct() {
  const t = { cards: 0, quiz: 0, words: 0, minutes: 0, exams: 0, review: 0 };
  Object.values(state.activity).forEach((a) => { Object.keys(t).forEach((k) => { t[k] += (a[k] || 0); }); });
  return t;
}
function streak() {
  let n = 0, d = TODAY;
  for (let i = 0; i < 400; i++) {
    const a = state.activity[d];
    const active = a && ((a.cards || 0) + (a.quiz || 0) + (a.words || 0) + (a.exams || 0) > 0);
    if (active) { n++; d = addDays(d, -1); }
    else if (i === 0) { d = addDays(d, -1); }
    else break;
  }
  return n;
}
function xp() {
  const t = totalAct();
  return t.cards * 6 + t.quiz * 8 + t.words * 2 + t.exams * 60;
}
function level() { return Math.floor(Math.sqrt(xp() / 120)) + 1; }

/* ───────────────── 卡片掌握度 / SRS ───────────────── */
const INTERVALS = [0, 1, 2, 4, 7, 15, 30];
const LEVEL_NAME = ['未学', '初识', '模糊', '熟悉', '掌握', '熟练'];
function pg(id) { return state.prog[id] || { level: 0, due: TODAY, seen: 0, last: null }; }
function levelOf(id) { return pg(id).level || 0; }
function isMastered(id) { return levelOf(id) >= 4; }
function isDue(id) { const p = pg(id); return p.level > 0 && p.due <= TODAY; }
function masterPct(list) {
  if (!list.length) return 0;
  return Math.round(list.reduce((s, k) => s + levelOf(k.id), 0) / (list.length * 5) * 100);
}
function chapterStat(chId) {
  const list = kpsOf(chId);
  return { total: list.length, mastered: list.filter((k) => isMastered(k.id)).length, pct: masterPct(list) };
}
function overall() {
  const list = DB.kps;
  return { total: list.length, mastered: list.filter((k) => isMastered(k.id)).length, pct: masterPct(list) };
}
function dueCards() { return DB.kps.filter((k) => isDue(k.id)); }
function grade(k, rating) {
  const p = pg(k.id);
  let lv = p.level || 0;
  if (rating === 0) lv = Math.max(0, lv - 1);
  else if (rating === 1) lv = Math.min(5, Math.max(1, lv));
  else lv = Math.min(5, Math.max(1, lv + 1));
  const interval = rating === 0 ? 0 : INTERVALS[Math.min(6, Math.max(1, lv))];
  state.prog[k.id] = { level: lv, due: addDays(TODAY, interval), seen: (p.seen || 0) + 1, last: TODAY };
  state.lastCard = k.id;
  act('cards', 1);
  if (p.seen) act('review', 1);
  save();
}

/* ───────────────── 数学 / 化学排版 ───────────────── */
function renderMath(src) {
  src = String(src == null ? '' : src);
  let i = 0;
  function parseSeq(stop) {
    let out = '';
    while (i < src.length) {
      if (stop && src[i] === stop) { i++; return out; }
      if (src.startsWith('--', i)) {
        const end = src.indexOf('-->', i + 2);
        if (end > 0) {
          const cond = src.slice(i + 2, end);
          i = end + 3;
          out += `<span class="rxn"><span class="cond">${esc(cond)}</span><span class="arrow">→</span></span>`;
          continue;
        }
      }
      if (src.startsWith('frac{', i)) {
        i += 4; const a = group(); const b = group();
        out += `<span class="mfrac"><span class="mnum">${a}</span><span class="mden">${b}</span></span>`;
        continue;
      }
      if (src.startsWith('sqrt{', i)) {
        i += 4; const a = group();
        out += `<span class="msqrt"><span class="radical">√</span><span class="mrad">${a}</span></span>`;
        continue;
      }
      if (src.startsWith('abs{', i)) { i += 3; out += `|${group()}|`; continue; }
      if (src.startsWith('vec{', i)) { i += 3; out += `<span class="vec">${group()}</span>`; continue; }
      if (src.startsWith('overrightarrow{', i)) { i += 13; out += `<span class="vec">${group()}</span>`; continue; }
      if (src.startsWith('overline{', i)) { i += 8; out += `<span style="text-decoration:overline">${group()}</span>`; continue; }
      if (src.startsWith('text{', i)) { i += 4; out += `<span class="mtext">${group()}</span>`; continue; }
      if (src[i] === '^' || src[i] === '_') {
        const tag = src[i] === '^' ? 'sup' : 'sub'; i++;
        const g = src[i] === '{' ? (i++, parseSeq('}')) : esc(src[i++] || '');
        out += `<${tag}>${g}</${tag}>`; continue;
      }
      if (src[i] === '{') { i++; out += parseSeq('}'); continue; }
      out += esc(src[i]); i++;
    }
    return out;
  }
  function group() {
    if (src[i] === '{') { i++; return parseSeq('}'); }
    return esc(src[i++] || '');
  }
  return `<span class="math">${parseSeq(null)}</span>`;
}
function math(src) { return renderMath(src); }
function plainText(t) {
  t = String(t == null ? '' : t);
  // 连续下划线是填空题的空位，不能当作下标解析
  if (/_{2,}/.test(t)) return esc(t).replace(/_{2,}/g, '<span class="blank"></span>');
  if (/([_^]|frac\{|sqrt\{|abs\{|vec\{|overline\{|--[^>]+-->)/.test(t)) {
    return renderMath(t).replace('class="math"', 'class="math math-inline"');
  }
  return esc(t);
}
function prose(src) {
  const parts = String(src == null ? '' : src).split('$');
  return parts.map((p, i) => i % 2 ? math(p) : plainText(p)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>')).join('');
}
function srcLink(src) {
  if (!src || !src.file) return '';
  const f = encodeURIComponent(src.file);
  const page = src.page ? `#page=${src.page}` : '';
  return `<a href="../materials/${f}${page}" target="_blank" rel="noopener">${esc(src.file.replace(/\.pdf$/, ''))}${src.page ? ` · P${src.page}` : ''}</a>`;
}

/* ───────────────── 图标 ───────────────── */
const ICONS = {
  today: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
  learn: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 5.5v15"/><path d="M8 7.5h8M8 11h5"/>',
  quiz: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  exam: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9 2h6"/>',
  wrong: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
  lookup: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  vocab: '<path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h7M8 11h5"/>',
  plan: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17M8 14h2M14 14h2M8 17.5h2"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  library: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2.5h8A1.5 1.5 0 0 1 20.5 10v8A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.1.36.32.7.6 1 .3.26.68.4 1.1.4H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.6z"/>',
  more: '<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'
};
function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`; }

/* ───────────────── 导航 ───────────────── */
const NAV = [
  { id: 'today', name: '今日', icon: 'today' },
  { id: 'learn', name: '知识卡', icon: 'learn' },
  { id: 'quiz', name: '刷题', icon: 'quiz' },
  { id: 'lookup', name: '速查', icon: 'lookup' },
  { id: 'vocab', name: '单词', icon: 'vocab' },
  { id: 'exam', name: '模拟考', icon: 'exam' },
  { id: 'wrong', name: '错题本', icon: 'wrong' },
  { id: 'plan', name: '30天计划', icon: 'plan' },
  { id: 'stats', name: '学习统计', icon: 'stats' },
  { id: 'library', name: '资料库', icon: 'library' }
];
const VIEW_TITLE = { today: '今日', learn: '知识卡', quiz: '刷题', lookup: '速查', vocab: '单词', exam: '模拟考', wrong: '错题本', plan: '30 天计划', stats: '学习统计', library: '资料库', settings: '设置' };
const VIEWS = { today: renderToday, learn: renderLearn, quiz: renderQuiz, lookup: renderLookup, vocab: renderVocab, exam: renderExam, wrong: renderWrong, plan: renderPlan, stats: renderStats, library: renderLibrary, settings: renderSettings };
const TABS = [
  { id: 'today', name: '今日', icon: 'today' },
  { id: 'learn', name: '学习', icon: 'learn' },
  { id: 'quiz', name: '刷题', icon: 'quiz' },
  { id: 'lookup', name: '速查', icon: 'lookup' },
  { id: 'more', name: '更多', icon: 'more' }
];
const MORE = [
  { id: 'vocab', name: '单词', icon: 'vocab' },
  { id: 'exam', name: '模拟考', icon: 'exam' },
  { id: 'wrong', name: '错题本', icon: 'wrong' },
  { id: 'plan', name: '计划', icon: 'plan' },
  { id: 'stats', name: '统计', icon: 'stats' },
  { id: 'library', name: '资料', icon: 'library' },
  { id: 'settings', name: '设置', icon: 'settings' }
];

function buildNav() {
  $('#nav').innerHTML = NAV.map((n) => {
    const badge = n.id === 'wrong' && Object.keys(state.wrong).length ? `<span class="nav-badge show">${Object.keys(state.wrong).length}</span>` : `<span class="nav-badge"></span>`;
    return `<button class="nav-item" data-view="${n.id}" title="${n.name}" aria-label="${n.name}">${icon(n.icon)}<span>${n.name}</span>${badge}</button>`;
  }).join('');
  $('#tabbar').innerHTML = TABS.map((t) => `<button data-view="${t.id}" data-tab="${t.id === 'more' ? '1' : ''}" title="${t.name}" aria-label="${t.name}">${icon(t.icon)}<span>${t.name}</span>${t.id === 'wrong' ? '<span class="tab-badge" id="tabWrong"></span>' : ''}</button>`).join('');
  $('#moreGrid').innerHTML = MORE.map((m) => `<button data-view="${m.id}">${icon(m.icon)}<span>${m.name}</span></button>`).join('');
}
function setActive(view) {
  $$('.nav-item').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  $$('#tabbar button').forEach((b) => {
    const isTab = TABS.some((t) => t.id === view && t.id !== 'more');
    b.classList.toggle('on', b.dataset.view === view || (b.dataset.tab == '1' && !isTab));
  });
  const wc = Object.keys(state.wrong).length;
  const tw = $('#tabWrong'); if (tw) { tw.textContent = wc; tw.style.display = wc ? 'grid' : 'none'; }
}
function go(view, opts = {}) {
  if (!VIEW_TITLE[view]) view = 'today';
  state.view = view; save();
  try { history.replaceState(null, '', '#' + view); } catch (e) {}
  if (opts.learn) Object.assign(ui.learn, opts.learn);
  setActive(view);
  $('#crumbs').innerHTML = `<b>${VIEW_TITLE[view]}</b>`;
  render();
  const v = $('#view'); if (v) v.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: 'auto' });
  closeMore();
}

function render() {
  const fn = VIEWS[state.view] || renderToday;
  $('#view').innerHTML = fn();
  bindView();
  syncRail();
}
function syncRail() {
  const o = overall();
  const rp = $('#railPct'); if (rp) rp.textContent = o.pct + '%';
  const rb = $('#railBar'); if (rb) rb.style.width = o.pct + '%';
  const rs = $('#railSub'); if (rs) rs.textContent = `${o.mastered} / ${o.total} 张卡片已掌握`;
  const sn = $('#streakN'); if (sn) sn.textContent = streak();
}

/* ───────────────── 通用 UI ───────────────── */
function toast(msg, ms = 1800) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), ms);
}
function modal(html) {
  $('#modalBox').innerHTML = html;
  $('#modal').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  $('#modal').hidden = true;
  document.body.style.overflow = '';
}
function openMore() {
  $('#moreSheet').hidden = false;
  document.body.style.overflow = 'hidden';
  $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.view === 'more'));
}
function closeMore() {
  $('#moreSheet').hidden = true;
  document.body.style.overflow = '';
  setActive(state.view);
}
function openSearch() {
  $('#searchOverlay').hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('#searchInput').focus(), 30);
  doSearch(ui.search.q);
}
function closeSearch() {
  $('#searchOverlay').hidden = true;
  document.body.style.overflow = '';
}

/* ───────────────── 今日 ───────────────── */
function greeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}
function planDay() {
  if (!state.planStart) return 1;
  return clamp(dayDiff(state.planStart, TODAY) + 1, 1, 30);
}
function planItem(day = planDay()) { return PLAN.find((p) => p.day === day) || PLAN[0]; }
function taskRow(id, label, sub, done, target, unit, actName, btnText) {
  const pct = target ? clamp(Math.round(done / target * 100), 0, 100) : 0;
  const ok = done >= target;
  return `<div class="task ${ok ? 'done' : ''}">
    <button class="task-check" data-act="task-go" data-task="${actName}">✓</button>
    <div class="task-main"><b>${label}</b><span>${sub}</span></div>
    <div class="task-bar"><div class="tb"><i style="width:${pct}%"></i></div><span>${done} / ${target} ${unit}</span></div>
    <button class="btn sm ${ok ? '' : 'primary'}" data-act="task-go" data-task="${actName}">${ok ? '继续' : btnText}</button>
  </div>`;
}
function renderToday() {
  const o = overall(), g = goals(), ta = todayAct();
  const due = dueCards().length;
  const p = planItem();
  const dleft = daysToExam();
  const lastExam = state.exams[state.exams.length - 1];
  const lastCard = state.lastCard ? KP.get(state.lastCard) : null;
  const newCount = DB.kps.filter((k) => levelOf(k.id) === 0).length;

  return `<div class="wrap">
    <div class="hero">
      <div class="eyebrow">${prettyDate()} · ${DB.meta.examLabel || '高考'}倒计时</div>
      <h1>${greeting()}，今天也走一小步。</h1>
      <p>${due ? `有 <b>${due}</b> 张卡片到了复习时间。` : '今天没有到期复习，适合往前推进新内容。'}先完成 ${g.cards} 张卡、${g.quiz} 道题、${g.words} 个单词，剩下的时间交给错题。</p>
      <div class="hero-stats">
        <div class="hero-stat"><b>${dleft}<small>天</small></b><span>距 ${DB.meta.examLabel || '高考'}</span></div>
        <div class="hero-stat"><b>${o.mastered}<small>/${o.total}</small></b><span>已掌握卡片</span></div>
        <div class="hero-stat"><b>${streak()}<small>天</small></b><span>连续学习</span></div>
        <div class="hero-stat"><b>Lv.${level()}</b><span>累计 ${xp()} 经验</span></div>
      </div>
      <div class="hero-cta">
        <button class="btn solid-white lg" data-act="task-go" data-task="learn">${due ? '▶ 开始复习' : '▶ 开始今天的学习'}</button>
        <button class="btn lg" data-act="task-go" data-task="quiz">✎ 刷 10 题</button>
        <button class="btn lg" data-act="task-go" data-task="words">A 背单词</button>
        <button class="btn lg" data-act="start-exam">⏱ 模拟考</button>
      </div>
      <div class="hero-side"><div class="ring" style="--p:${o.pct}"><span>${o.pct}%</span></div></div>
    </div>

    <div class="today-grid">
      <div class="card pad">
        <div class="row" style="margin-bottom:6px"><b style="font-family:var(--serif);font-size:16px">今日清单</b><span class="spacer"></span><span class="tiny muted">${ta.cards} 卡 · ${ta.quiz} 题 · ${ta.words} 词</span></div>
        ${taskRow('cards', '知识卡：学新 + 复习', due ? `${due} 张到期，优先清复习` : `还有 ${newCount} 张未学`, ta.cards, g.cards, '张', 'learn', '去学卡')}
        ${taskRow('quiz', '刷题：即做即看解析', `错题会自动收进错题本`, ta.quiz, g.quiz, '题', 'quiz', '去刷题')}
        ${taskRow('words', '单词：高频词滚动记忆', `${DB.vocab.length} 个词，按 30 天分组`, ta.words, g.words, '个', 'words', '去背词')}
        ${taskRow('minutes', '专注：一次只做一件事', `番茄钟 25 分钟 · <b id="focusTime" class="mono">${fmtClock(ui.timer.left)}</b>${ui.timer.running ? ' · 进行中' : ''}`, ta.minutes, g.minutes, '分钟', 'timer', ui.timer.running ? '专注中' : '开始计时')}
      </div>

      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card focus-card">
          <div class="row"><div><div class="eyebrow" style="margin-bottom:2px">第 ${planDay()} / 30 天</div><b style="font-family:var(--serif);font-size:16px">${esc(p.title)}</b></div><span class="spacer"></span><button class="chip chip-btn" data-act="open-plan">计划</button></div>
          <div class="focus-ring" style="--p:${Math.round(planDay() / 30 * 100)}"><div class="fr"><b>${planDay()}</b><span>/ 30 天</span></div></div>
          <div class="focus-meta"><div><b>${p.cards}</b><span>张卡</span></div><div><b>${p.quiz}</b><span>道题</span></div><div><b>${p.words}</b><span>个词</span></div></div>
          <p class="tiny muted" style="text-align:center;margin:12px 0 0;line-height:1.7">${esc(p.note)}</p>
          <div class="row" style="margin-top:12px;gap:6px;justify-content:center;flex-wrap:wrap">
            ${(p.focus || []).slice(0, 4).map((ch) => `<button class="chip chip-btn" data-act="open-ch" data-ch="${ch}">${esc(chName(ch))}</button>`).join('') || '<span class="tiny muted">综合复盘日</span>'}
          </div>
        </div>
        <div class="countdown">
          <div class="cd-n">${Math.max(0, dleft)}</div>
          <div class="cd-t"><b>距离 ${DB.meta.examLabel || '高考'}</b><span>${esc(examDate())} · 每天进步一点点</span></div>
        </div>
      </div>
    </div>

    <div class="section-head"><h2>四科进度</h2><span class="hint">点任一科进入章节</span><span class="spacer"></span><button class="more" data-act="open-learn">全部章节 →</button></div>
    <div class="subject-grid">
      ${SUBJECTS.map((s) => {
        const list = DB.kps.filter((k) => k.subject === s.id);
        const pct = masterPct(list);
        const mastered = list.filter((k) => isMastered(k.id)).length;
        return `<div class="subject-card" data-act="open-subject" data-sub="${s.id}" style="--sc:${s.color}">
          <div class="sc-top"><div class="sc-ico">${esc(s.short)}</div><div><h3>${esc(s.name)}</h3><div class="sc-sub">${chaptersOf(s.id).length} 章 · ${list.length} 张卡</div></div></div>
          <div class="sc-bar"><i style="width:${pct}%"></i></div>
          <div class="sc-meta"><span>${mastered}/${list.length} 掌握</span><span>${pct}%</span></div>
        </div>`;
      }).join('')}
    </div>

    <div class="today-grid" style="grid-template-columns:1fr 1fr">
      <div>
        <div class="section-head"><h2>最近在学</h2></div>
        <div class="card" style="overflow:hidden">
          ${lastCard ? `<div class="list-item" data-act="open-kp" data-id="${lastCard.id}">
            <div class="li-main"><div class="t">${esc(lastCard.topic)}</div><div class="s">${esc(subName(lastCard.subject))} · ${esc(chName(lastCard.chapter))} · ${LEVEL_NAME[levelOf(lastCard.id)]}</div></div>
            <span class="chip dot" style="color:${chColor(lastCard.chapter)}">${esc(chName(lastCard.chapter))}</span>
          </div>` : `<div class="list-item" data-act="task-go" data-task="learn"><div class="li-main"><div class="t">还没有开始，从第一张卡开始吧</div><div class="s">集合的概念与三种表示 · 数学</div></div>${icon('arrow')}</div>`}
          ${due ? `<div class="list-item" data-act="start-review"><div class="li-main"><div class="t">待复习 ${due} 张</div><div class="s">按遗忘曲线到期，先清复习再学新</div></div><span class="chip gold">复习</span></div>` : ''}
          <div class="list-item" data-act="open-weak"><div class="li-main"><div class="t">薄弱章节</div><div class="s">${weakChapters(2).map((w) => esc(chName(w.ch)) + ' ' + w.rate + '%').join(' · ') || '做几道题后生成'}</div></div>${icon('arrow')}</div>
        </div>
      </div>
      <div>
        <div class="section-head"><h2>最近模考</h2><span class="spacer"></span><button class="more" data-act="start-exam">去模考 →</button></div>
        <div class="card" style="overflow:hidden">
          ${state.exams.length ? state.exams.slice(-3).reverse().map((e, i) => `<div class="list-item" data-act="exam-detail" data-i="${state.exams.length - 1 - i}">
            <div class="li-main"><div class="t">${e.score} 分 · ${e.subjectName || '综合卷'}</div><div class="s">${new Date(e.ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} · 用时 ${fmtClock(e.used || 0)} · 答对 ${e.correct}/${e.total}</div></div>
            <span class="chip ${e.pass ? 'green' : 'red'}">${e.pass ? '达标' : '待提高'}</span>
          </div>`).join('') : `<div style="padding:26px 18px;text-align:center"><div class="tiny muted" style="line-height:1.8">还没有模考记录。<br>做一套 25 题的卷子，看看现在的位置。</div><button class="btn primary sm" data-act="start-exam" style="margin-top:12px">开始第一次模考</button></div>`}
          ${lastExam ? `<div class="list-item" data-act="open-stats"><div class="li-main"><div class="t">学习统计</div><div class="s">掌握度 ${overall().pct}% · 累计 ${totalAct().quiz} 题</div></div>${icon('arrow')}</div>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}
function weakChapters(n = 5) {
  const list = Object.entries(state.chapStats)
    .filter(([ch, v]) => v.n >= 3 && CH.has(ch))
    .map(([ch, v]) => ({ ch, rate: Math.round(v.ok / v.n * 100), n: v.n }))
    .sort((a, b) => a.rate - b.rate || b.n - a.n);
  if (list.length) return list.slice(0, n);
  return CHAPTERS.filter((c) => chapterStat(c.id).total > 0)
    .map((c) => ({ ch: c.id, rate: chapterStat(c.id).pct, n: 0 }))
    .sort((a, b) => a.rate - b.rate).slice(0, n);
}

/* ───────────────── 学习 / 知识卡 ───────────────── */
function buildQueue(mode = 'all', chapter = null, subject = null) {
  let list = DB.kps.slice();
  if (chapter) list = list.filter((k) => k.chapter === chapter);
  else if (subject) list = list.filter((k) => k.subject === subject);
  if (mode === 'due') list = list.filter((k) => isDue(k.id));
  else if (mode === 'new') list = list.filter((k) => levelOf(k.id) === 0);
  else if (mode === 'weak') list = list.filter((k) => levelOf(k.id) > 0 && levelOf(k.id) < 4);
  else if (mode === 'star') list = list.filter((k) => state.star[k.id]);
  const rank = (k) => (isDue(k.id) ? 0 : levelOf(k.id) === 0 ? 1 : levelOf(k.id) < 4 ? 2 : 3);
  list.sort((a, b) => rank(a) - rank(b) || (CH_ORDER.indexOf(a.chapter) - CH_ORDER.indexOf(b.chapter)));
  return list;
}
function startLearn(payload = {}) {
  const mode = payload.mode || ui.learn.mode || 'all';
  const chapter = payload.chapter !== undefined ? payload.chapter : ui.learn.chapter;
  const subject = chapter ? (CH.get(chapter) || {}).subject : (payload.subject !== undefined ? payload.subject : ui.learn.subject);
  const queue = buildQueue(mode, chapter, subject);
  if (!queue.length) { toast('这个条件下没有卡片，换个范围试试'); return; }
  ui.learn = { chapter, subject, mode, queue, idx: 0, hide: false, revealed: false };
  go('learn');
}
function renderLearn() {
  if (!ui.learn.queue || !ui.learn.queue.length) return renderLearnHome();
  return renderLearnCard();
}
function renderLearnHome() {
  const o = overall();
  const due = dueCards().length;
  const starN = Object.keys(state.star).length;
  return `<div class="wrap wide">
    <div class="page-head">
      <div><div class="eyebrow">Knowledge</div><h1>知识卡</h1><p>${DB.kps.length} 张卡片，覆盖数学、物理、化学、英语第一批资料。先理解，再记忆。</p></div>
      <span class="spacer"></span>
      <div class="row" style="gap:7px">
        ${ui.learn.subject ? `<button class="chip chip-btn on" data-act="open-learn">只看${esc(subName(ui.learn.subject))} ×</button>` : ''}
        <button class="chip chip-btn ${ui.learn.mode === 'all' ? 'on' : ''}" data-act="learn-mode" data-mode="all">全部</button>
        <button class="chip chip-btn ${ui.learn.mode === 'due' ? 'on' : ''}" data-act="learn-mode" data-mode="due">待复习 ${due}</button>
        <button class="chip chip-btn ${ui.learn.mode === 'new' ? 'on' : ''}" data-act="learn-mode" data-mode="new">未学</button>
        <button class="chip chip-btn ${ui.learn.mode === 'star' ? 'on' : ''}" data-act="learn-mode" data-mode="star">收藏 ${starN}</button>
      </div>
    </div>

    <div class="card pad" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">
        <div class="row" style="gap:7px"><b style="font-family:var(--serif);font-size:16px">今日建议</b><span class="chip gold">${due ? `${due} 张到期` : '复习已清'}</span></div>
        <p class="tiny muted" style="margin:5px 0 0;line-height:1.7">${due ? '先清到期卡片，再学新卡。记忆的性价比在复习，不在刷新。' : '没有到期复习，可以从「未学」开始推进。'}</p>
      </div>
      <button class="btn primary" data-act="start-review">${due ? '开始复习' : '继续学习'}</button>
      <button class="btn" data-act="start-random">随机抽一张</button>
    </div>

    ${(ui.learn.subject ? SUBJECTS.filter((s) => s.id === ui.learn.subject) : SUBJECTS).map((s) => {
      const list = DB.kps.filter((k) => k.subject === s.id);
      const pct = masterPct(list);
      return `<div class="section-head"><h2><span style="color:${s.color}">${esc(s.name)}</span></h2><span class="hint">${list.length} 张 · 掌握 ${pct}%</span><span class="spacer"></span><span class="tiny muted">${esc(s.desc)}</span></div>
      <div class="chapter-grid">
        ${chaptersOf(s.id).map((c) => {
          const st = chapterStat(c.id);
          return `<div class="chapter-card" data-act="open-ch" data-ch="${c.id}" style="--cc:${chColor(c.id)}">
            <div class="cc-top"><span class="cc-dot"></span><h3>${esc(c.name)}</h3></div>
            <div class="cc-desc">${esc(c.desc || '')}</div>
            <div class="cc-bar"><i style="width:${st.pct}%"></i></div>
            <div class="cc-meta"><span>${st.mastered}/${st.total} 掌握</span><span>${st.pct}%</span></div>
          </div>`;
        }).join('')}
      </div>`;
    }).join('')}
  </div>`;
}
function renderLearnCard() {
  const q = ui.learn.queue;
  ui.learn.idx = clamp(ui.learn.idx, 0, q.length - 1);
  const k = q[ui.learn.idx];
  if (!k) return renderLearnHome();
  const p = pg(k.id), lv = p.level || 0, c = CH.get(k.chapter) || {}, sub = SUB.get(k.subject) || {};
  const idx = ui.learn.idx + 1;
  const flashed = ui.learn.hide;

  return `<div class="wrap">
    <div class="learn-toolbar">
      <button class="btn sm ghost" data-act="learn-back">← 章节</button>
      <span class="chip solid" style="background:${subColor(k.subject)}">${esc(subName(k.subject))}</span>
      <span class="chip dot" style="color:${chColor(k.chapter)}">${esc(c.name || k.chapter)}</span>
      <span class="chip">${LEVEL_NAME[lv]}</span>
      <div class="spacer"></div>
      <button class="chip chip-btn ${flashed ? 'on' : ''}" data-act="toggle-hide">${flashed ? '✓ 遮住答案' : '遮住答案'}</button>
      <button class="chip chip-btn" data-act="star-kp">${state.star[k.id] ? '★ 已收藏' : '☆ 收藏'}</button>
      <div class="learn-progress"><div class="lp-track"><i style="width:${idx / q.length * 100}%"></i></div><span>${idx}/${q.length}</span></div>
    </div>

    <div class="card kp-card ${flashed && !ui.learn.revealed ? 'kp-flash' : 'revealed'}" style="--cc:${chColor(k.chapter)}">
      <div class="kp-top">
        <span class="chip" style="background:${colorMix(chColor(k.chapter), 12)};color:${chColor(k.chapter)}">${esc(c.name || '')}</span>
        <span class="chip dot" title="重要度">${'★'.repeat(k.star || 3)}${'☆'.repeat(5 - (k.star || 3))}</span>
        ${(k.tags || []).slice(0, 3).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}
        <div class="spacer"></div>
        <span class="tiny muted">${esc(k.id)}</span>
      </div>
      <h2 class="kp-topic">${esc(k.topic)}</h2>
      ${flashed && !ui.learn.revealed ? `<button class="flash-hint" data-act="reveal-kp">答案已遮住，先在心里回忆，点这里显示 <kbd>空格</kbd></button>` : ''}
      <div class="kp-core">${prose(k.core)}</div>
      ${k.detail ? `<div class="kp-detail">${prose(k.detail)}</div>` : ''}

      ${(k.formulas || []).length ? `<div class="kp-sec"><div class="kp-sec-t">公式 / 关键表达</div>
        <div class="formula-box">${k.formulas.map((f, i) => `<div class="formula-line"><span class="fl-i">${pad2(i + 1)}</span><div class="fl-body">${math(f)}</div></div>`).join('')}</div></div>` : ''}

      ${(k.bullets || []).length ? `<div class="kp-sec"><div class="kp-sec-t">要点</div><ul class="dots">${k.bullets.map((b) => `<li>${prose(b)}</li>`).join('')}</ul></div>` : ''}

      ${(k.examples || []).length ? `<div class="kp-sec"><div class="kp-sec-t">例题</div>
        ${k.examples.map((ex) => `<div class="example"><div class="ex-q">${prose(ex.q)}</div><div class="ex-a">${prose(ex.a)}</div></div>`).join('')}</div>` : ''}

      ${k.mnemonic ? `<div class="mnemo"><b>口诀</b><span>${esc(k.mnemonic)}</span></div>` : ''}
      ${k.trap ? `<div class="trap-box">${prose(k.trap)}</div>` : ''}
      <div class="cite">来源：${srcLink(k.source)} <span class="muted">·</span> 上次学习 ${p.last ? esc(p.last) : '—'}</div>

      <div class="note-box">
        <label>我的笔记（只保存在本机）</label>
        <textarea id="kpNote" placeholder="写下你的理解、易错点、老师讲过的例子…">${esc(state.notes[k.id] || '')}</textarea>
      </div>

      <div class="rate-bar">
        <button class="rate-btn forgot ${lv === 0 ? 'on' : ''}" data-act="rate" data-r="0">忘了 <kbd>1</kbd></button>
        <button class="rate-btn fuzzy ${lv <= 2 ? 'on' : ''}" data-act="rate" data-r="1">模糊 <kbd>2</kbd></button>
        <button class="rate-btn ${lv >= 3 ? 'on' : ''}" data-act="rate" data-r="2">掌握 <kbd>3</kbd></button>
      </div>
      <div class="cite" style="justify-content:center">下次复习：${esc(p.due || '—')} · 已学习 ${p.seen || 0} 次</div>
    </div>

    <div class="learn-nav">
      <button class="btn" data-act="prev-kp" ${ui.learn.idx === 0 ? 'disabled' : ''}>← 上一张</button>
      <button class="btn ghost sm" data-act="quiz-chapter">本章刷题</button>
      <span class="spacer"></span>
      <button class="btn primary" data-act="next-kp">${idx < q.length ? '下一张 →' : '完成本轮 →'}</button>
    </div>
  </div>`;
}
function colorMix(hex, pct) {
  if (!hex || !hex.startsWith('#')) return 'var(--surface-2)';
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${pct / 100})`;
}

/* ───────────────── 速查 ───────────────── */
function renderLookup() {
  const t = ui.lookup.tab;
  return `<div class="wrap wide">
    <div class="page-head">
      <div><div class="eyebrow">Quick Reference</div><h1>速查</h1><p>公式、化学方程式、解题方法。考前十分钟，只看这一页。</p></div>
      <span class="spacer"></span>
      <button class="btn" data-act="toggle-mask">${ui.lookup.masked ? '✓ 遮罩自测中' : '遮罩自测'}</button>
    </div>
    <div class="lookup-tabs">
      <button class="${t === 'formula' ? 'on' : ''}" data-act="lookup-tab" data-tab="formula">公式与结论 · ${DB.formulas.length}</button>
      <button class="${t === 'equation' ? 'on' : ''}" data-act="lookup-tab" data-tab="equation">化学方程式 · ${DB.equations.length}</button>
      <button class="${t === 'method' ? 'on' : ''}" data-act="lookup-tab" data-tab="method">方法卡 · ${METHODS.length}</button>
    </div>
    <div class="lookup-bar">
      <div class="lookup-search">${icon('search')}<input id="lookupQ" placeholder="搜索名称、公式或关键词…" value="${esc(ui.lookup.q)}"></div>
      ${t === 'formula' ? `<div class="row" style="gap:5px">
        <button class="chip chip-btn ${ui.lookup.subject === 'all' ? 'on' : ''}" data-act="lookup-sub" data-sub="all">全部</button>
        <button class="chip chip-btn ${ui.lookup.subject === 'math' ? 'on' : ''}" data-act="lookup-sub" data-sub="math">数学</button>
        <button class="chip chip-btn ${ui.lookup.subject === 'physics' ? 'on' : ''}" data-act="lookup-sub" data-sub="physics">物理</button>
      </div>` : ''}
    </div>
    ${t === 'formula' ? renderFormulaGrid() : t === 'equation' ? renderEquationTable() : renderMethodGrid()}
  </div>`;
}
function lookupFilter(list, textFields) {
  const q = ui.lookup.q.toLowerCase().trim();
  let r = list;
  if (ui.lookup.tab === 'formula' && ui.lookup.subject !== 'all') r = r.filter((x) => x.subject === ui.lookup.subject);
  if (q) r = r.filter((x) => textFields.map((f) => String(x[f] || '')).join(' ').toLowerCase().includes(q));
  return r;
}
function renderFormulaGrid() {
  const list = lookupFilter(DB.formulas, ['name', 'expr', 'note', 'tags']);
  if (!list.length) return `<div class="empty"><div class="ico">∅</div><h3>没有匹配的公式</h3><p>换个关键词试试。</p></div>`;
  return `<div class="formula-grid">${list.map((f) => `<div class="f-card ${ui.lookup.masked ? 'masked' : ''}" data-act="reveal-f" style="--sc:${subColor(f.subject)}">
    <button class="f-copy" data-act="copy-f" data-id="${f.id}" title="复制">⧉</button>
    <div class="f-head"><span class="chip" style="background:${colorMix(subColor(f.subject), 12)};color:${subColor(f.subject)}">${esc(subName(f.subject))}</span><span class="f-name">${esc(f.name)}</span></div>
    <div class="f-expr">${math(f.expr)}</div>
    <div class="f-note">${prose(f.note || '')}</div>
  </div>`).join('')}</div>`;
}
function renderEquationTable() {
  const list = lookupFilter(DB.equations, ['name', 'equation', 'note', 'section']);
  if (!list.length) return `<div class="empty"><div class="ico">∅</div><h3>没有匹配的方程式</h3><p>换个关键词试试。</p></div>`;
  const bySec = {};
  list.forEach((e) => { (bySec[e.section] = bySec[e.section] || []).push(e); });
  return Object.entries(bySec).map(([sec, items]) => `<div class="section-head"><h2>${esc(sec)}</h2><span class="hint">${items.length} 条</span></div>
    <div class="card eq-wrap" style="overflow:hidden"><table class="eq-table">
      <thead><tr><th style="width:120px">反应</th><th>方程式</th><th>现象 / 条件</th></tr></thead>
      <tbody>${items.map((e) => `<tr>
        <td><div class="eq-name">${esc(e.name)}</div><div class="eq-sec">${esc(chName(e.chapter))}</div></td>
        <td class="eq-formula">${math(e.equation)}</td>
        <td class="eq-note">${esc(e.note || '')}</td>
      </tr>`).join('')}</tbody>
    </table></div>`).join('');
}
function renderMethodGrid() {
  const list = lookupFilter(METHODS, ['title', 'when', 'example', 'steps']);
  if (!list.length) return `<div class="empty"><div class="ico">∅</div><h3>没有匹配的方法</h3></div>`;
  return `<div class="method-grid">${list.map((m, i) => `<div class="method-card">
    <div class="mc-n">方法 ${String(i + 1).padStart(2, '0')} · ${esc(chName(m.chapter))}</div>
    <h3>${esc(m.title)}</h3>
    <div class="mc-when"><b>什么时候用：</b>${esc(m.when)}</div>
    <ol class="mc-steps">${(m.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    <div class="mc-ex">${prose(m.example)}</div>
    ${m.trap ? `<div class="mc-trap">⚠ ${esc(m.trap)}</div>` : ''}
  </div>`).join('')}</div>`;
}

/* ───────────────── 单词 ───────────────── */
function renderVocab() {
  if (ui.vocab.day) return renderVocabDay();
  const known = Object.keys(state.knownWords).length;
  return `<div class="wrap wide">
    <div class="page-head">
      <div><div class="eyebrow">Vocabulary · 30 Days</div><h1>单词</h1><p>${DB.vocab.length} 个核心高频词，按资料里的 30 天主题分组。先认词，再放进句子里。</p></div>
      <span class="spacer"></span>
      <div class="row" style="gap:6px"><span class="chip green">已掌握 ${known}</span><button class="btn sm" data-act="vocab-flash-all">${ui.vocab.flash ? '关闭闪卡' : '闪卡模式'}</button></div>
    </div>
    <div class="lookup-bar"><div class="lookup-search">${icon('search')}<input id="vocabQ" placeholder="搜索单词或中文释义…" value="${esc(ui.vocab.q)}"></div><span class="tiny muted">${known} / ${DB.vocab.length} 已掌握</span></div>
    ${ui.vocab.q ? renderVocabSearch() : `<div class="vocab-day-grid">${Array.from({ length: 30 }, (_, i) => i + 1).map((d) => {
      const words = DB.vocab.filter((v) => v.day === d);
      const kn = words.filter((v) => state.knownWords[v.id]).length;
      const theme = (words[0] || {}).theme || '';
      return `<div class="day-card" data-act="vocab-day" data-day="${d}">
        <div class="dc-n">Day ${d}</div>
        <div class="dc-t">${esc(theme)}</div>
        <div class="dc-m"><span>${words.length} 词</span><span>${kn} 已会</span></div>
        <div class="dc-bar"><i style="width:${words.length ? kn / words.length * 100 : 0}%"></i></div>
      </div>`;
    }).join('')}</div>`}
  </div>`;
}
function vocabCard(v) {
  const known = !!state.knownWords[v.id];
  const hidden = ui.vocab.flash && !ui.vocab.revealed[v.id];
  return `<div class="vocab-card ${known ? 'known' : ''}" data-act="word-click" data-id="${v.id}">
    <div class="vc-actions"><button data-act="speak" data-id="${v.id}" title="朗读">🔊</button><button data-act="word-known" data-id="${v.id}" title="标记掌握">${known ? '↺' : '✓'}</button></div>
    <div><span class="vc-word">${esc(v.word)}</span>${v.pos ? `<span class="vc-pos">${esc(v.pos)}</span>` : ''}</div>
    <div class="vc-cn" style="${hidden ? 'filter:blur(5px);cursor:pointer' : ''}">${hidden ? '点击查看释义' : esc(v.cn || '')}</div>
    ${v.example ? `<div class="vc-ex" style="${hidden ? 'filter:blur(4px)' : ''}">${esc(v.example)}</div>` : ''}
    ${v.related ? `<div class="vc-rel">相关形式：<b>${esc(v.related)}</b></div>` : ''}
  </div>`;
}
function renderVocabSearch() {
  const q = ui.vocab.q.toLowerCase();
  const list = DB.vocab.filter((v) => (v.word + v.cn + v.theme + (v.related || '')).toLowerCase().includes(q));
  if (!list.length) return `<div class="empty"><div class="ico">A</div><h3>没有找到这个单词</h3><p>试试只输入前几个字母。</p></div>`;
  return `<div class="vocab-list">${list.slice(0, 80).map(vocabCard).join('')}</div>`;
}
function renderVocabDay() {
  const d = ui.vocab.day;
  const list = DB.vocab.filter((v) => v.day === d);
  const known = list.filter((v) => state.knownWords[v.id]).length;
  return `<div class="wrap wide">
    <div class="page-head">
      <div><div class="eyebrow">Day ${d} / 30</div><h1>${esc((list[0] || {}).theme || '词汇')}</h1><p>${list.length} 个词 · 已掌握 ${known}</p></div>
      <span class="spacer"></span>
      <button class="btn" data-act="vocab-back">← 全部天数</button>
      <button class="btn ${ui.vocab.flash ? 'primary' : ''}" data-act="vocab-flash">${ui.vocab.flash ? '闪卡中' : '闪卡模式'}</button>
    </div>
    <div class="vocab-list">${list.map(vocabCard).join('')}</div>
    <div class="row" style="justify-content:center;margin-top:22px">
      <button class="btn" data-act="vocab-day" data-day="${Math.max(1, d - 1)}" ${d === 1 ? 'disabled' : ''}>← Day ${d - 1}</button>
      <button class="btn primary" data-act="vocab-day" data-day="${Math.min(30, d + 1)}" ${d === 30 ? 'disabled' : ''}>Day ${d + 1} →</button>
    </div>
  </div>`;
}

/* ───────────────── 刷题 ───────────────── */
const TYPE_NAME = { single: '单选', multi: '多选', judge: '判断', fill: '填空' };
function renderQuiz() {
  if (ui.quiz && ui.quiz.phase === 'run') return renderQuizRun();
  if (ui.quiz && ui.quiz.phase === 'done') return renderQuizDone();
  return renderQuizSetup();
}
function renderQuizSetup() {
  const pool = buildQuizPool(false);
  const wrongN = Object.keys(state.wrong).length;
  const subjects = ['all', ...SUBJECTS.map((s) => s.id)];
  const chapters = ui.quizCfg.subjects.includes('all') ? CHAPTERS : CHAPTERS.filter((c) => ui.quizCfg.subjects.includes(c.subject));
  return `<div class="wrap">
    <div class="card setup-card">
      <div class="eyebrow">Practice</div>
      <h2>刷题</h2>
      <p class="tiny muted">选范围，开始。答错自动进错题本；填空支持同义表达，判错时可以自评更正。</p>

      <div class="setup-block"><div class="sb-title">学科</div><div class="row wrap" style="gap:6px">
        ${subjects.map((s) => `<button class="chip chip-btn ${ui.quizCfg.subjects.includes(s) ? 'on' : ''}" data-act="quiz-sub" data-sub="${s}">${s === 'all' ? '全部学科' : esc(subName(s))}</button>`).join('')}
      </div></div>

      <div class="setup-block"><div class="sb-title">章节（可多选）</div><div class="row wrap" style="gap:6px">
        <button class="chip chip-btn ${ui.quizCfg.chapters.includes('all') ? 'on' : ''}" data-act="quiz-ch" data-ch="all">全部章节</button>
        ${chapters.map((c) => `<button class="chip chip-btn ${ui.quizCfg.chapters.includes(c.id) ? 'on' : ''}" data-act="quiz-ch" data-ch="${c.id}">${esc(c.short || c.name)} <span style="opacity:.55">${qsOf(c.id).length}</span></button>`).join('')}
      </div></div>

      <div class="setup-block"><div class="sb-title">题型</div><div class="row wrap" style="gap:6px">
        ${Object.keys(TYPE_NAME).map((t) => `<button class="chip chip-btn ${ui.quizCfg.types.includes(t) ? 'on' : ''}" data-act="quiz-type" data-t="${t}">${TYPE_NAME[t]} <span style="opacity:.55">${DB.questions.filter((q) => q.type === t).length}</span></button>`).join('')}
      </div></div>

      <div class="setup-block"><div class="sb-title">题量</div><div class="row wrap" style="gap:6px">
        ${[10, 20, 30, 0].map((n) => `<button class="chip chip-btn ${ui.quizCfg.count === n ? 'on' : ''}" data-act="quiz-count" data-n="${n}">${n === 0 ? '全部' : n + ' 题'}</button>`).join('')}
        <span style="width:12px"></span>
        <button class="chip chip-btn ${ui.quizCfg.wrongOnly ? 'on' : ''}" data-act="quiz-wrongonly">只做错题 ${wrongN}</button>
      </div></div>

      <div class="setup-actions">
        <button class="btn primary lg" data-act="quiz-start" ${pool.length ? '' : 'disabled'}>开始刷题</button>
        <span class="tiny muted">按当前条件将出 <b>${pool.length}</b> 题</span>
      </div>
    </div>
    <div class="section-head"><h2>薄弱章节</h2><span class="hint">正确率最低的章节，优先补</span></div>
    <div class="card" style="overflow:hidden">
      ${weakChapters(5).map((w) => `<div class="list-item" data-act="open-ch" data-ch="${w.ch}">
        <span class="chip solid" style="background:${chColor(w.ch)}">${esc(chName(w.ch))}</span>
        <div class="li-main"><div class="t">${w.n ? `最近正确率 ${w.rate}%` : `掌握度 ${w.rate}%`}</div><div class="s">${esc((CH.get(w.ch) || {}).desc || '')}</div></div>
        ${icon('arrow')}
      </div>`).join('') || '<div class="empty"><div class="ico">✓</div><h3>还没有数据</h3><p>做几道题后这里会显示薄弱章节。</p></div>'}
    </div>
  </div>`;
}
function buildQuizPool(doShuffle = true) {
  let pool = DB.questions.slice();
  if (ui.quizCfg.wrongOnly) { const w = new Set(Object.keys(state.wrong)); pool = pool.filter((q) => w.has(q.id)); }
  if (!ui.quizCfg.subjects.includes('all')) { const s = new Set(ui.quizCfg.subjects); pool = pool.filter((q) => s.has(q.subject)); }
  if (!ui.quizCfg.chapters.includes('all')) { const s = new Set(ui.quizCfg.chapters); pool = pool.filter((q) => s.has(q.chapter)); }
  const ts = new Set(ui.quizCfg.types); pool = pool.filter((q) => ts.has(q.type));
  if (doShuffle) pool = shuffle(pool);
  if (ui.quizCfg.count > 0) pool = pool.slice(0, ui.quizCfg.count);
  return pool;
}
function startQuiz(list, label) {
  if (!list.length) { toast('这个条件下没有题目，换个范围试试'); return; }
  ui.quiz = { phase: 'run', list, i: 0, ans: new Array(list.length).fill(null), judged: new Array(list.length).fill(false), right: 0, label, ts: Date.now() };
  go('quiz');
}
function renderQuizRun() {
  const s = ui.quiz, q = s.list[s.i];
  const sel = s.ans[s.i], judged = s.judged[s.i];
  const multi = q.type === 'multi';
  const correct = q.answer || [];
  return `<div class="wrap">
    <div class="quiz-head">
      <span class="chip solid" style="background:${subColor(q.subject)}">${esc(subName(q.subject))}</span>
      <span class="chip dot" style="color:${chColor(q.chapter)}">${esc(chName(q.chapter))}</span>
      <span class="q-type ${q.type}">${TYPE_NAME[q.type]}</span>
      <div class="q-progress-track"><i style="width:${(s.i + 1) / s.list.length * 100}%"></i></div>
      <span class="q-counter">${s.i + 1} / ${s.list.length} · 正确 ${s.right}</span>
      <button class="btn sm ghost" data-act="quiz-exit">退出</button>
    </div>
    <div class="card q-card">
      <div class="q-stem">${prose(q.stem)}</div>
      ${q.type === 'fill' ? `<div class="row" style="gap:9px;flex-wrap:wrap">
        <input class="fill-input" id="fillInput" placeholder="输入答案，回车提交" autocomplete="off" autocapitalize="off" spellcheck="false" ${judged ? 'disabled' : ''} value="${judged ? esc((sel || []).join('')) : ''}">
        ${!judged ? `<button class="btn primary" data-act="submit-fill">提交</button>` : ''}
      </div>` : `<div class="q-opts">
        ${(q.options || []).map((o, oi) => {
          let cls = 'opt';
          if (!judged && sel && sel.includes(oi)) cls += ' sel';
          if (judged) {
            cls += ' locked';
            if (correct.includes(oi)) cls += ' right';
            else if (sel && sel.includes(oi)) cls += ' wrong';
          }
          return `<div class="${cls}" data-act="pick" data-i="${oi}"><span class="ok">${String.fromCharCode(65 + oi)}</span><span>${prose(o)}</span></div>`;
        }).join('')}
      </div>`}
      ${judged ? `<div class="explain">
        <div class="verdict ${sel && sameSet(sel, correct) ? 'ok' : 'no'}">${sel && sameSet(sel, correct) ? '✓ 正确' : '✗ 错误'}<span class="muted" style="font-weight:400;font-size:11.5px">正确答案：${q.type === 'fill' ? esc((q.answerText || []).join(' / ')) : correct.map((i) => String.fromCharCode(65 + i)).join('')}</span></div>
        <div>${prose(q.explain)}</div>
        <div class="src">${srcLink(q.source)}${q.tags ? ' · ' + esc(q.tags.slice(0, 2).join(' / ')) : ''}</div>
        ${q.type === 'fill' && sel && !sameSet(sel, correct) ? `<div style="margin-top:10px"><button class="btn sm" data-act="self-correct">我写的是同义表达，算对</button></div>` : ''}
      </div>` : ''}
      <div class="q-actions">
        ${!judged ? `${multi ? '<button class="btn primary" data-act="submit-multi">提交答案</button>' : ''}<span class="tiny muted">${multi ? '多选题：选全后提交' : q.type === 'fill' ? '填空：注意词形变化和拼写' : '点击选项直接判定'}</span>` : `<button class="btn primary" data-act="next-q">${s.i + 1 < s.list.length ? '下一题 →' : '看结果 →'}</button>`}
        <div class="spacer"></div>
        <button class="btn ghost sm" data-act="prev-q" ${s.i === 0 ? 'disabled' : ''}>← 上一题</button>
      </div>
    </div>
  </div>`;
}
function sameSet(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  const x = a.slice().sort(), y = b.slice().sort();
  return x.every((v, i) => v === y[i]);
}
function isCorrect(q, ans) {
  if (!q) return false;
  if (q.type === 'fill') return (q.answerText || []).map(normalizeAns).includes(normalizeAns((ans || [''])[0]));
  return sameSet(ans, q.answer);
}
function renderQuizDone() {
  const s = ui.quiz;
  const total = s.list.length;
  const pct = Math.round(s.right / total * 100);
  const wrongs = s.list.filter((q, i) => !isCorrect(q, s.ans[i]));
  return `<div class="wrap">
    <div class="card pad">
      <div class="result-score"><div class="big ${pct >= 80 ? 'pass' : pct >= 60 ? '' : 'fail'}">${pct}%</div>
        <div class="lbl">${total} 题，答对 ${s.right} 题，用时 ${fmtClock(Math.round((Date.now() - s.ts) / 1000))}</div></div>
      <div class="res-grid">
        <div class="res-item"><b>${s.right}</b><span>答对</span></div>
        <div class="res-item"><b style="color:var(--red)">${total - s.right}</b><span>答错</span></div>
        <div class="res-item"><b>${wrongs.length}</b><span>进错题本</span></div>
        <div class="res-item"><b>${Object.keys(state.wrong).length}</b><span>错题本总数</span></div>
      </div>
      <div class="row" style="margin-top:20px;justify-content:center;gap:9px;flex-wrap:wrap">
        <button class="btn primary" data-act="quiz-again">再来一轮</button>
        <button class="btn" data-act="quiz-back">重选范围</button>
        ${wrongs.length ? `<button class="btn danger" data-act="quiz-redo-wrong">只重做这 ${wrongs.length} 道</button>` : ''}
      </div>
    </div>
    <div class="section-head"><h2>逐题回顾</h2></div>
    <div class="card" style="overflow:hidden">
      ${s.list.map((q, i) => {
        const ok = isCorrect(q, s.ans[i]);
        const yours = q.type === 'fill' ? esc((s.ans[i] || [''])[0] || '未答') : ((s.ans[i] || []).map((x) => String.fromCharCode(65 + x)).join('') || '未答');
        return `<div class="list-item" data-act="rev-q" data-i="${i}">
          <span style="width:22px;height:22px;border-radius:6px;display:grid;place-items:center;font-size:11px;font-weight:700;flex:0 0 22px;background:${ok ? 'var(--green-soft)' : 'var(--red-soft)'};color:${ok ? 'var(--green)' : 'var(--red)'}">${ok ? '✓' : '✗'}</span>
          <div class="li-main"><div class="t">${esc(q.stem.slice(0, 60))}${q.stem.length > 60 ? '…' : ''}</div>
          <div class="s">你的答案 ${yours} ｜ 正确 ${q.type === 'fill' ? esc((q.answerText || []).join(' / ')) : q.answer.map((x) => String.fromCharCode(65 + x)).join('')}</div></div>
          <span class="q-type ${q.type}">${TYPE_NAME[q.type]}</span>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}
function pickOption(i) {
  const s = ui.quiz; if (!s) return;
  const q = s.list[s.i];
  if (s.judged[s.i]) return;
  if (q.type === 'multi') {
    let cur = s.ans[s.i] || [];
    cur = cur.includes(i) ? cur.filter((x) => x !== i) : cur.concat(i).sort((a, b) => a - b);
    s.ans[s.i] = cur; render();
  } else {
    s.ans[s.i] = [i]; judgeCurrent();
  }
}
function normalizeAns(t) {
  return String(t || '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.。,，;；!！?？]$/, '');
}
function submitFill() {
  const s = ui.quiz; if (!s) return;
  const el = $('#fillInput'); if (!el) return;
  const v = el.value.trim();
  if (!v) { toast('先输入答案'); return; }
  s.ans[s.i] = [v]; judgeCurrent();
}
function judgeCurrent() {
  const s = ui.quiz; if (!s) return;
  const q = s.list[s.i];
  if (s.judged[s.i]) return;
  const sel = s.ans[s.i];
  if (!sel || !sel.length) { toast('先作答'); return; }
  s.judged[s.i] = true;
  let ok;
  if (q.type === 'fill') {
    const accepted = (q.answerText || []).map(normalizeAns);
    ok = accepted.includes(normalizeAns(sel[0]));
  } else ok = sameSet(sel, q.answer);
  q._ok = ok;
  if (ok) {
    s.right++; act('quiz', 1); bumpChap(q.chapter, true);
    if (state.wrong[q.id]) { state.wrong[q.id].ok = (state.wrong[q.id].ok || 0) + 1; }
  } else {
    act('quiz', 1); bumpChap(q.chapter, false);
    state.wrong[q.id] = { n: (state.wrong[q.id]?.n || 0) + 1, ts: Date.now() };
  }
  save(); render();
}
function bumpChap(ch, ok) {
  if (!ch) return;
  const c = state.chapStats[ch] || { n: 0, ok: 0 };
  c.n++; if (ok) c.ok++;
  state.chapStats[ch] = c;
}

/* ───────────────── 模拟考 ───────────────── */
function renderExam() {
  if (ui.exam && ui.exam.phase === 'run') return renderExamRun();
  if (ui.exam && ui.exam.phase === 'done') return renderExamDone();
  return renderExamSetup();
}
function renderExamSetup() {
  const cfg = ui.examCfg;
  const pool = examPool(cfg.subject).length;
  return `<div class="wrap">
    <div class="card setup-card">
      <div class="eyebrow">Mock Exam</div>
      <h2>模拟考</h2>
      <p class="tiny muted">${cfg.minutes} 分钟 · 满分 100 分 · 60 分达标。交卷后给出逐题解析、学科命中率和薄弱章节。</p>
      <div class="setup-block"><div class="sb-title">科目</div><div class="row wrap" style="gap:6px">
        ${['all', ...SUBJECTS.map((s) => s.id)].map((s) => `<button class="chip chip-btn ${cfg.subject === s ? 'on' : ''}" data-act="exam-sub" data-sub="${s}">${s === 'all' ? '综合卷' : esc(subName(s))}</button>`).join('')}
      </div></div>
      <div class="setup-block"><div class="sb-title">题量与时长</div><div class="row wrap" style="gap:6px">
        ${[15, 25, 40].map((n) => `<button class="chip chip-btn ${cfg.count === n ? 'on' : ''}" data-act="exam-count" data-n="${n}">${n} 题</button>`).join('')}
        ${[30, 45, 60].map((m) => `<button class="chip chip-btn ${cfg.minutes === m ? 'on' : ''}" data-act="exam-min" data-m="${m}">${m} 分钟</button>`).join('')}
      </div></div>
      <div class="setup-actions">
        <button class="btn primary lg" data-act="exam-start" ${pool ? '' : 'disabled'}>开始考试</button>
        <span class="tiny muted">题库可用 <b>${pool}</b> 题，随机组卷</span>
      </div>
    </div>
    <div class="section-head"><h2>考试记录</h2></div>
    <div class="card" style="overflow:hidden">
      ${state.exams.length ? state.exams.slice().reverse().map((e, i) => `<div class="list-item" data-act="exam-detail" data-i="${state.exams.length - 1 - i}">
        <div class="li-main"><div class="t">${e.score} 分 · ${esc(e.subjectName || '综合卷')}</div><div class="s">${new Date(e.ts).toLocaleString('zh-CN')} · 用时 ${fmtClock(e.used || 0)} · 答对 ${e.correct}/${e.total}</div></div>
        <span class="chip ${e.pass ? 'green' : 'red'}">${e.pass ? '达标' : '未达标'}</span>
      </div>`).join('') : `<div class="empty"><div class="ico">⏱</div><h3>还没有考试记录</h3><p>第一次模考不用追求分数，先看清位置。</p></div>`}
    </div>
  </div>`;
}
function examPool(subject) {
  return DB.questions.filter((q) => subject === 'all' || q.subject === subject);
}
function buildExamPaper(subject, count) {
  let pool = examPool(subject);
  // 按章节轮转，避免整卷集中在一章
  const byCh = new Map();
  pool.forEach((q) => { if (!byCh.has(q.chapter)) byCh.set(q.chapter, []); byCh.get(q.chapter).push(q); });
  byCh.forEach((v) => shuffle(v));
  const keys = shuffle(Array.from(byCh.keys()));
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 2000) {
    let added = false;
    for (const k of keys) {
      const arr = byCh.get(k);
      if (arr && arr.length) { out.push(arr.pop()); added = true; }
      if (out.length >= count) break;
    }
    if (!added) break;
  }
  return out;
}
function startExam() {
  const cfg = ui.examCfg;
  const paper = buildExamPaper(cfg.subject, Math.min(cfg.count, examPool(cfg.subject).length));
  if (!paper.length) { toast('题库为空'); return; }
  ui.exam = {
    phase: 'run', paper, i: 0, left: cfg.minutes * 60, timed: true,
    ans: new Array(paper.length).fill(null), flags: new Set(), ts: Date.now(), startAt: Date.now(), timer: null,
    subject: cfg.subject, subjectName: cfg.subject === 'all' ? '综合卷' : subName(cfg.subject)
  };
  go('exam');
  clearInterval(ui.exam.timer);
  ui.exam.timer = setInterval(() => {
    if (!ui.exam || ui.exam.phase !== 'run') { clearInterval(ui.exam.timer); return; }
    ui.exam.left--;
    const t = $('#examTimer');
    if (t) { t.textContent = fmtClock(Math.max(0, ui.exam.left)); t.classList.toggle('warn', ui.exam.left < 300); }
    if (ui.exam.left <= 0) { clearInterval(ui.exam.timer); toast('时间到，自动交卷'); submitExam(true); }
  }, 1000);
}
function renderExamRun() {
  const s = ui.exam, q = s.paper[s.i], sel = s.ans[s.i];
  const multi = q.type === 'multi';
  return `<div class="wrap">
    <div class="quiz-head">
      <span class="exam-timer" id="examTimer">${fmtClock(Math.max(0, s.left))}</span>
      <span class="q-type ${q.type}">${TYPE_NAME[q.type]}</span>
      <span class="chip solid" style="background:${subColor(q.subject)}">${esc(subName(q.subject))}</span>
      <div class="q-progress-track"><i style="width:${(s.i + 1) / s.paper.length * 100}%"></i></div>
      <span class="q-counter">${s.i + 1} / ${s.paper.length}</span>
      <button class="btn sm" data-act="exam-submit">交卷</button>
    </div>
    <div class="card q-card">
      <div class="row" style="justify-content:space-between;margin-bottom:5px"><span class="tiny muted">本卷第 ${s.i + 1} 题 · 每题 ${(100 / s.paper.length).toFixed(1)} 分</span>
        <button class="btn sm ghost" data-act="exam-flag">${s.flags.has(s.i) ? '⚑ 已标记' : '⚐ 标记'}</button></div>
      <div class="q-stem">${prose(q.stem)}</div>
      ${q.type === 'fill' ? `<input class="fill-input" id="examFill" placeholder="输入答案" value="${sel ? esc(sel[0]) : ''}" autocomplete="off" autocapitalize="off" spellcheck="false">
        <div class="tiny muted" style="margin-top:6px">填空答案按完全匹配计分。</div>` : `<div class="q-opts">
        ${(q.options || []).map((o, oi) => `<div class="opt ${sel && sel.includes(oi) ? 'sel' : ''}" data-act="exam-pick" data-i="${oi}"><span class="ok">${String.fromCharCode(65 + oi)}</span><span>${prose(o)}</span></div>`).join('')}
      </div>`}
      <div class="q-actions">
        <button class="btn" data-act="exam-prev" ${s.i === 0 ? 'disabled' : ''}>← 上一题</button>
        <button class="btn primary" data-act="exam-next">${s.i + 1 < s.paper.length ? '下一题 →' : '交卷'}</button>
        ${multi ? '<span class="tiny muted">多选题：选完自动记录</span>' : ''}
        <div class="spacer"></div>
        <button class="btn ghost sm" data-act="exam-panel">答题卡</button>
      </div>
    </div>
    <div class="card pad" style="margin-top:16px" id="examSheet">
      <div class="row" style="margin-bottom:10px"><b style="font-size:13px">答题卡</b><div class="spacer"></div><span class="tiny muted">${s.ans.filter((x) => x && x.length).length} / ${s.paper.length} 已答</span></div>
      <div class="sheet-grid-nums">${s.paper.map((x, i) => `<div class="sheet-i ${s.ans[i] && s.ans[i].length ? 'ans' : ''} ${s.flags.has(i) ? 'flag' : ''} ${i === s.i ? 'cur' : ''}" data-act="exam-jump" data-i="${i}">${i + 1}</div>`).join('')}</div>
    </div>
  </div>`;
}
function examPick(i) {
  const s = ui.exam; if (!s) return;
  const q = s.paper[s.i];
  if (q.type === 'multi') {
    let cur = s.ans[s.i] || [];
    cur = cur.includes(i) ? cur.filter((x) => x !== i) : cur.concat(i).sort((a, b) => a - b);
    s.ans[s.i] = cur;
  } else s.ans[s.i] = [i];
  render();
}
function saveExamFill() {
  const s = ui.exam; if (!s) return;
  const el = $('#examFill');
  if (el) s.ans[s.i] = el.value.trim() ? [el.value.trim()] : null;
}
function submitExam(silent) {
  const s = ui.exam; if (!s) return;
  if (!silent) {
    const un = s.ans.filter((x) => !x || !x.length).length;
    if (!confirm(un ? `还有 ${un} 题未作答，确定交卷？` : '确定交卷？')) return;
  }
  clearInterval(s.timer);
  let correct = 0;
  s.paper.forEach((q, i) => {
    let ok;
    if (q.type === 'fill') ok = (q.answerText || []).map(normalizeAns).includes(normalizeAns((s.ans[i] || [''])[0]));
    else ok = sameSet(s.ans[i], q.answer);
    q._ok = ok;
    if (ok) correct++;
    else { state.wrong[q.id] = { n: (state.wrong[q.id]?.n || 0) + 1, ts: Date.now() }; bumpChap(q.chapter, false); }
    if (ok) bumpChap(q.chapter, true);
  });
  const score = Math.round(correct / s.paper.length * 100);
  s.phase = 'done'; s.correct = correct; s.total = s.paper.length; s.score = score;
  s.pass = score >= 60; s.used = Math.round((Date.now() - s.startAt) / 1000);
  state.exams.push({ ts: Date.now(), score, pass: s.pass, used: s.used, correct, total: s.paper.length, subject: s.subject, subjectName: s.subjectName, detail: s.paper.map((q, i) => ({ id: q.id, ok: !!q._ok })) });
  if (state.exams.length > 50) state.exams = state.exams.slice(-50);
  act('exams', 1);
  save(); render();
}
function renderExamDone() {
  const s = ui.exam;
  const bySub = {};
  s.paper.forEach((q, i) => {
    const b = bySub[q.subject] = bySub[q.subject] || { n: 0, ok: 0 };
    b.n++; if (q._ok) b.ok++;
  });
  const byCh = {};
  s.paper.forEach((q, i) => {
    const b = byCh[q.chapter] = byCh[q.chapter] || { n: 0, ok: 0 };
    b.n++; if (q._ok) b.ok++;
  });
  const weak = Object.entries(byCh).map(([ch, v]) => ({ ch, ...v, rate: Math.round(v.ok / v.n * 100) })).sort((a, b) => a.rate - b.rate).slice(0, 4);
  return `<div class="wrap">
    <div class="card pad">
      <div class="result-score"><div class="big ${s.pass ? 'pass' : 'fail'}">${s.score}</div>
        <div class="lbl">${s.pass ? '✓ 达到 60 分达标线' : `差 ${60 - s.score} 分达标`} · 用时 ${fmtClock(s.used)} · 答对 ${s.correct}/${s.total}</div></div>
      <div class="res-grid">
        ${Object.entries(bySub).map(([sub, v]) => `<div class="res-item"><b style="color:${subColor(sub)}">${Math.round(v.ok / v.n * 100)}%</b><span>${esc(subName(sub))}命中</span></div>`).join('')}
        <div class="res-item"><b>${s.total}</b><span>本卷题量</span></div>
      </div>
      <div class="row" style="margin-top:20px;justify-content:center;gap:9px;flex-wrap:wrap">
        <button class="btn primary" data-act="exam-retry">再考一次</button>
        <button class="btn" data-act="quiz-wrong-now">复盘错题</button>
        <button class="btn ghost" data-act="open-stats">看统计</button>
      </div>
    </div>
    <div class="section-head"><h2>薄弱章节</h2><span class="hint">按本卷命中率排序</span></div>
    <div class="card pad">
      ${weak.map((w) => `<div style="margin-bottom:12px">
        <div class="row" style="justify-content:space-between;font-size:12.5px;margin-bottom:4px"><span><span class="chip dot" style="color:${chColor(w.ch)}">${esc(chName(w.ch))}</span></span><span class="muted">${w.ok}/${w.n} · ${w.rate}%</span></div>
        <div class="bar"><i style="width:${w.rate}%;background:${w.rate < 60 ? 'var(--red)' : 'var(--green)'}"></i></div>
      </div>`).join('')}
      <button class="btn sm" data-act="open-ch" data-ch="${weak[0]?.ch || 'M01'}">去补 ${esc(chName(weak[0]?.ch || 'M01'))}</button>
    </div>
    <div class="section-head"><h2>逐题解析</h2></div>
    <div class="card" style="overflow:hidden">
      ${s.paper.map((q, i) => `<div style="border-bottom:1px solid var(--line-2);padding:14px 17px">
        <div class="row" style="align-items:flex-start;gap:9px">
          <span style="width:22px;height:22px;border-radius:6px;display:grid;place-items:center;font-size:11px;font-weight:700;flex:0 0 22px;margin-top:2px;background:${q._ok ? 'var(--green-soft)' : 'var(--red-soft)'};color:${q._ok ? 'var(--green)' : 'var(--red)'}">${q._ok ? '✓' : '✗'}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:550;margin-bottom:4px">${i + 1}. ${prose(q.stem)}</div>
            <div class="tiny muted" style="margin-bottom:4px">你的答案 <b style="color:${q._ok ? 'var(--green)' : 'var(--red)'}">${q.type === 'fill' ? esc((s.ans[i] || [''])[0] || '未答') : (s.ans[i] || []).map((x) => String.fromCharCode(65 + x)).join('') || '未答'}</b> ｜ 正确 <b style="color:var(--green)">${q.type === 'fill' ? esc((q.answerText || []).join(' / ')) : q.answer.map((x) => String.fromCharCode(65 + x)).join('')}</b></div>
            <div class="tiny" style="color:var(--ink-2);line-height:1.7">${prose(q.explain)}</div>
            <div class="tiny muted" style="margin-top:4px;font-family:var(--mono)">${esc((q.source || {}).file || '')}</div>
          </div>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}
function confirmSubmit() {
  saveExamFill();
  submitExam(false);
}

/* ───────────────── 错题本 ───────────────── */
function renderWrong() {
  const ids = Object.keys(state.wrong).filter((id) => Q.has(id));
  if (!ids.length) return `<div class="wrap"><div class="empty"><div class="ico">✓</div><h3>错题本是空的</h3><p>去刷题或模考，答错的题会自动收进来。</p><button class="btn primary" data-act="task-go" data-task="quiz" style="margin-top:14px">去刷题</button></div></div>`;
  const list = ids.map((id) => Q.get(id));
  const bySub = {};
  list.forEach((q) => { bySub[q.subject] = (bySub[q.subject] || 0) + 1; });
  return `<div class="wrap">
    <div class="page-head"><div><div class="eyebrow">Mistakes</div><h1>错题本</h1><p>${list.length} 道题 · ${Object.entries(bySub).map(([s, n]) => `${subName(s)} ${n}`).join(' · ')}</p></div>
      <span class="spacer"></span>
      <button class="btn primary" data-act="wrong-practice">重做全部</button>
      <button class="btn danger" data-act="wrong-clear">清空</button>
    </div>
    <div class="card" style="overflow:hidden">
      ${list.map((q, i) => `<div class="wrong-item">
        <div class="wrong-no">${i + 1}</div>
        <div class="wrong-body">
          <div class="q">${prose(q.stem)}</div>
          <div class="a">正确：${q.type === 'fill' ? esc((q.answerText || []).join(' / ')) : q.answer.map((x) => String.fromCharCode(65 + x)).join('')} · 错过 ${state.wrong[q.id]?.n || 1} 次 · ${esc(chName(q.chapter))}</div>
        </div>
        <div class="wrong-actions">
          <button class="icon-btn" data-act="open-q" data-id="${q.id}" title="看解析">${icon('lookup')}</button>
          <button class="icon-btn" data-act="wrong-remove" data-id="${q.id}" title="移出">×</button>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

/* ───────────────── 计划 ───────────────── */
function renderPlan() {
  const cur = planDay();
  return `<div class="wrap">
    <div class="page-head"><div><div class="eyebrow">30-Day Plan</div><h1>30 天计划</h1><p>第一轮：把第一批资料完整走一遍。每天只安排 45–60 分钟，重点是不断线。</p></div>
      <span class="spacer"></span>
      ${state.planStart ? `<button class="btn" data-act="plan-reset">重新开始</button>` : `<button class="btn primary" data-act="plan-start">从今天开始</button>`}
    </div>
    <div class="card pad" style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
      <div style="flex:1;min-width:220px"><div class="row"><b style="font-family:var(--serif);font-size:16px">${state.planStart ? `第 ${cur} 天` : '计划尚未开始'}</b><span class="chip gold">${state.planStart ? `${Math.max(0, 30 - cur)} 天后完成` : '点击开始'}</span></div>
        <p class="tiny muted" style="margin:5px 0 0">${state.planStart ? `开始于 ${esc(state.planStart)}，今天是第 ${cur} 天。完成一项就打勾，不必追求完美。` : '开始后，今日页会自动显示当天任务。'}</p></div>
      <div class="bar" style="width:180px"><i style="width:${Math.round(Object.keys(state.planDone).length / 30 * 100)}%"></i></div>
      <span class="tiny muted">${Object.keys(state.planDone).length} / 30 完成</span>
    </div>
    <div class="section-head"><h2>每日安排</h2><span class="hint">点右侧圆圈打勾</span></div>
    <div class="card" style="overflow:hidden"><div class="plan-list">
      ${PLAN.map((p) => {
        const done = !!state.planDone[p.day], isCur = p.day === cur && state.planStart;
        return `<div class="plan-row ${done ? 'done' : ''} ${isCur ? 'cur' : ''}">
          <div class="plan-idx">${done ? '✓' : p.day}</div>
          <div class="plan-body">
            <div class="pr-title">${esc(p.title)} ${isCur ? '<span class="chip green" style="margin-left:6px">今天</span>' : ''}</div>
            <div class="pr-note">${esc(p.note)}</div>
            <div class="pr-tags">${(p.focus || []).map((ch) => `<span class="chip" data-act="open-ch" data-ch="${ch}" style="cursor:pointer">${esc(chName(ch))}</span>`).join('')}<span class="chip">${p.cards} 卡 · ${p.quiz} 题 · ${p.words} 词 · ${p.minutes} 分钟</span></div>
          </div>
          <button class="plan-check" data-act="plan-toggle" data-day="${p.day}">✓</button>
        </div>`;
      }).join('')}
    </div></div>
  </div>`;
}

/* ───────────────── 统计 ───────────────── */
function renderStats() {
  const o = overall(), t = totalAct();
  const accN = Object.values(state.chapStats).reduce((s, c) => s + c.n, 0);
  const accOk = Object.values(state.chapStats).reduce((s, c) => s + c.ok, 0);
  const acc = accN ? Math.round(accOk / accN * 100) : 0;
  const days = [];
  for (let i = 97; i >= 0; i--) {
    const d = addDays(TODAY, -i);
    const a = state.activity[d] || {};
    const v = (a.cards || 0) + (a.quiz || 0) + (a.words || 0);
    days.push({ d, v });
  }
  const max = Math.max(1, ...days.map((x) => x.v));
  const activeDates = Object.keys(state.activity).filter((d) => { const a = state.activity[d] || {}; return (a.cards || 0) + (a.quiz || 0) + (a.words || 0) + (a.exams || 0) > 0; }).sort();
  let longest = 0, run = 0;
  activeDates.forEach((d, i) => { run = i > 0 && dayDiff(activeDates[i - 1], d) === 1 ? run + 1 : 1; longest = Math.max(longest, run); });
  return `<div class="wrap wide">
    <div class="page-head"><div><div class="eyebrow">Progress</div><h1>学习统计</h1><p>所有数据只存在这台设备的浏览器里，不上传。</p></div></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="k">掌握卡片</div><div class="v">${o.mastered}<small> / ${o.total}</small></div><div class="s">总体掌握度 ${o.pct}%</div></div>
      <div class="stat-card"><div class="k">累计刷题</div><div class="v">${t.quiz}<small> 题</small></div><div class="s">章节正确率 ${acc}%</div></div>
      <div class="stat-card"><div class="k">已会单词</div><div class="v">${Object.keys(state.knownWords).length}<small> / ${DB.vocab.length}</small></div><div class="s">累计背词 ${t.words} 次</div></div>
      <div class="stat-card"><div class="k">连续学习</div><div class="v">${streak()}<small> 天</small></div><div class="s">Lv.${level()} · ${xp()} 经验</div></div>
    </div>

    <div class="section-head"><h2>最近 14 周</h2><span class="hint">颜色越深，当天学习量越大</span></div>
    <div class="card pad">
      <div class="hm-wrap">
        <div>
      <div class="heatmap">${days.map((x) => {
        const l = x.v === 0 ? '' : x.v < max * 0.25 ? 'l1' : x.v < max * 0.5 ? 'l2' : x.v < max * 0.75 ? 'l3' : 'l4';
        return `<div class="hm-cell ${l}" title="${x.d} · ${x.v} 次学习"></div>`;
      }).join('')}</div>
      <div class="hm-legend"><span>少</span><i style="background:var(--bg-2)"></i><i style="background:color-mix(in srgb,var(--brand) 22%,var(--bg-2))"></i><i style="background:color-mix(in srgb,var(--brand) 42%,var(--bg-2))"></i><i style="background:color-mix(in srgb,var(--brand) 66%,var(--bg-2))"></i><i style="background:var(--brand)"></i><span>多</span></div>
        </div>
        <div class="hm-side">
          <div><b>${activeDates.length}</b><span>学习天数</span></div>
          <div><b>${t.cards + t.quiz + t.words}</b><span>总学习动作</span></div>
          <div><b>${longest}</b><span>最长连续</span></div>
        </div>
      </div>
    </div>

    <div class="section-head"><h2>学科掌握度</h2></div>
    <div class="card pad">
      ${SUBJECTS.map((s) => {
        const list = DB.kps.filter((k) => k.subject === s.id), pct = masterPct(list);
        return `<div style="margin-bottom:15px"><div class="row" style="justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span><b>${esc(s.name)}</b> <span class="muted tiny">${list.length} 张卡</span></span><span class="muted">${pct}%</span></div><div class="bar"><i style="width:${pct}%;background:${s.color}"></i></div></div>`;
      }).join('')}
    </div>

    <div class="section-head"><h2>章节正确率</h2><span class="hint">低于 60% 的优先复习</span></div>
    <div class="card" style="overflow:hidden">
      ${Object.entries(state.chapStats).filter(([ch]) => CH.has(ch)).sort((a, b) => (a[1].ok / a[1].n) - (b[1].ok / b[1].n)).map(([ch, v]) => `<div class="list-item" data-act="open-ch" data-ch="${ch}">
        <span class="chip dot" style="color:${chColor(ch)}">${esc(chName(ch))}</span>
        <div class="li-main"><div class="bar" style="max-width:190px"><i style="width:${Math.round(v.ok / v.n * 100)}%;background:${v.ok / v.n < .6 ? 'var(--red)' : 'var(--green)'}"></i></div></div>
        <span class="tiny muted">${v.ok}/${v.n} · ${Math.round(v.ok / v.n * 100)}%</span>
      </div>`).join('') || '<div class="empty"><div class="ico">◔</div><h3>还没有答题数据</h3><p>刷几道题后这里会按章节显示正确率。</p></div>'}
    </div>
  </div>`;
}

/* ───────────────── 资料库 ───────────────── */
function renderLibrary() {
  return `<div class="wrap wide">
    <div class="page-head"><div><div class="eyebrow">Sources</div><h1>资料库</h1><p>第一批 ${SOURCES.length} 份原始资料。系统里的每张卡、每道题都能回到这些页面。</p></div>
      <span class="spacer"></span><span class="chip">${DB.stats.kp || DB.kps.length} 张卡 · ${DB.questions.length} 道题 · ${DB.formulas.length + DB.equations.length} 条速查</span>
    </div>
    <div class="source-grid">
      ${SOURCES.map((s) => {
        const kpN = DB.kps.filter((k) => k.source && k.source.file === s.file).length;
        const qN = DB.questions.filter((q) => q.source && q.source.file === s.file).length;
        return `<div class="source-card">
          <div class="src-top"><div class="src-ico">PDF</div><div><h3>${esc(s.title)}</h3><div class="src-sub">${esc(subName(s.subject))} · ${s.pages} 页</div></div></div>
          <p>${esc(s.note)}</p>
          <div class="src-foot"><span>${kpN ? kpN + ' 张卡' : '配套资料'}</span><span>·</span><span>${qN ? qN + ' 道题' : '原文参考'}</span><a class="btn sm" href="../materials/${encodeURIComponent(s.file)}" target="_blank" rel="noopener">打开 PDF</a></div>
        </div>`;
      }).join('')}
    </div>
    <div class="card pad" style="margin-top:18px">
      <div class="row" style="align-items:flex-start;gap:12px"><div style="font-size:22px">📌</div><div>
        <b style="font-size:13px">关于资料与版权</b>
        <p class="tiny muted" style="margin:4px 0 0;line-height:1.8">这些 PDF 是学习资料，只在本机/本仓库内使用，不对外分发。系统内的题目与卡片为学习目的重新整理，解析中标注了来源页码；如与原文冲突，以原文为准。</p>
      </div></div>
    </div>
  </div>`;
}

/* ───────────────── 设置 ───────────────── */
function renderSettings() {
  return `<div class="wrap">
    <div class="page-head"><div><div class="eyebrow">Settings</div><h1>设置</h1><p>没有账号，没有登录。所有记录都在本机浏览器里。</p></div></div>
    <div class="card pad">
      <div class="settings-group">
        <div class="settings-row"><div class="sr-main"><b>外观</b><span>浅色 / 深色，跟随你的学习环境</span></div>
          <div class="seg"><button class="${state.theme === 'light' ? 'on' : ''}" data-act="theme-light">浅色</button><button class="${state.theme === 'dark' ? 'on' : ''}" data-act="theme-dark">深色</button></div></div>
        <div class="settings-row"><div class="sr-main"><b>高考日期</b><span>今日页倒计时使用这个日期</span></div>
          <input type="date" id="examDateInput" value="${esc(examDate())}"></div>
        <div class="settings-row"><div class="sr-main"><b>每日目标</b><span>卡片 / 题目 / 单词 / 分钟</span></div>
          <div class="row" style="gap:6px">
            <input type="number" id="goalCards" min="1" max="99" value="${goals().cards}" style="width:64px" title="卡片">
            <input type="number" id="goalQuiz" min="1" max="99" value="${goals().quiz}" style="width:64px" title="题目">
            <input type="number" id="goalWords" min="1" max="99" value="${goals().words}" style="width:64px" title="单词">
            <input type="number" id="goalMinutes" min="5" max="300" value="${goals().minutes}" style="width:72px" title="分钟">
          </div></div>
      </div>
      <div class="row" style="margin-top:8px"><button class="btn primary" data-act="save-settings">保存设置</button><span class="tiny muted">改动会立即生效</span></div>
    </div>

    <div class="section-head"><h2>数据</h2></div>
    <div class="card pad">
      <div class="settings-row"><div class="sr-main"><b>导出学习记录</b><span>JSON 文件，可备份或换设备导入</span></div><button class="btn" data-act="export-data">导出</button></div>
      <div class="settings-row"><div class="sr-main"><b>导入学习记录</b><span>会覆盖当前设备的记录</span></div><label class="btn" style="cursor:pointer">选择文件<input type="file" id="importFile" accept="application/json,.json" hidden></label></div>
      <div class="settings-row"><div class="sr-main"><b>清空全部记录</b><span>进度、错题、笔记、统计都会删除</span></div><button class="btn danger" data-act="reset-all">清空</button></div>
    </div>

    <div class="section-head"><h2>关于</h2></div>
    <div class="card pad">
      <p class="tiny muted" style="line-height:1.9;margin:0">拾阶 · 高中学习与备考 v${esc(DB.meta.version || '1.0.0')}<br>
      内容来自 ${SOURCES.length} 份第一批资料：数学背记手册与默写版、基本不等式 12 种方法、集合与不等式解析、物理第一章、化学方程式大全、英语高频词汇 30 天。<br>
      纯静态页面，无登录、无网络请求、无上传。用「添加到主屏幕」可以像 App 一样打开。</p>
    </div>
  </div>`;
}

/* ───────────────── 搜索 ───────────────── */
function doSearch(q) {
  ui.search.q = q;
  const term = String(q || '').trim().toLowerCase();
  const res = [];
  if (term) {
    DB.kps.forEach((k) => { if ((k.topic + k.core + (k.detail || '') + (k.tags || []).join('')).toLowerCase().includes(term)) res.push({ type: 'card', t: k.topic, s: `${subName(k.subject)} · ${chName(k.chapter)}`, id: k.id }); });
    DB.formulas.forEach((f) => { if ((f.name + f.expr + (f.note || '')).toLowerCase().includes(term)) res.push({ type: 'formula', t: f.name, s: f.expr, id: f.id }); });
    DB.equations.forEach((e) => { if ((e.name + e.equation + (e.note || '')).toLowerCase().includes(term)) res.push({ type: 'equation', t: e.name, s: e.equation, id: e.id }); });
    DB.vocab.forEach((v) => { if ((v.word + v.cn + (v.related || '') + v.theme).toLowerCase().includes(term)) res.push({ type: 'word', t: v.word, s: `${v.cn || ''} · Day${v.day}`, id: v.id }); });
    DB.questions.forEach((q) => { if ((q.stem + (q.explain || '')).toLowerCase().includes(term)) res.push({ type: 'question', t: q.stem.slice(0, 58), s: `${subName(q.subject)} · ${TYPE_NAME[q.type]} · ${chName(q.chapter)}`, id: q.id }); });
  }
  ui.search.results = res.slice(0, 80);
  const box = $('#searchResults');
  if (!box) return;
  if (!term) { box.innerHTML = `<div class="search-empty">输入关键词开始搜索</div>`; return; }
  if (!res.length) { box.innerHTML = `<div class="search-empty">没有找到「${esc(q)}」相关内容</div>`; return; }
  const groups = { card: '知识卡', formula: '公式', equation: '化学方程式', word: '单词', question: '题目' };
  const iconTxt = { card: '卡', formula: '式', equation: '化', word: 'A', question: '题' };
  let html = '', last = '';
  ui.search.results.forEach((r, i) => {
    if (r.type !== last) { html += `<div class="sr-group">${groups[r.type]}</div>`; last = r.type; }
    html += `<div class="sr-item ${i === ui.search.sel ? 'on' : ''}" data-act="search-open" data-i="${i}"><div class="sr-ico">${iconTxt[r.type]}</div><div class="sr-main"><div class="sr-t">${esc(r.t)}</div><div class="sr-s">${(r.type === 'formula' || r.type === 'equation') ? prose(r.s) : esc(r.s)}</div></div></div>`;
  });
  box.innerHTML = html;
}
function openSearchResult(i) {
  const r = ui.search.results[i]; if (!r) return;
  closeSearch();
  if (r.type === 'card') { openKP(r.id); }
  else if (r.type === 'formula') { const f = FORMULA.get(r.id); if (f) modal(`<h2>${esc(f.name)}</h2><div class="formula-box" style="margin-bottom:12px"><div class="formula-line"><div class="fl-body">${math(f.expr)}</div></div></div><p class="tiny muted" style="line-height:1.8">${esc(f.note || '')}</p><div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn" data-close-modal>关闭</button></div>`); }
  else if (r.type === 'equation') { ui.lookup.tab = 'equation'; ui.lookup.q = ''; go('lookup'); }
  else if (r.type === 'word') { ui.vocab.q = ''; ui.vocab.day = DB.vocab.find((v) => v.id === r.id)?.day || null; go('vocab'); }
  else if (r.type === 'question') { openQuestion(Q.get(r.id)); }
}

/* ───────────────── 弹层内容 ───────────────── */
function openKP(id) {
  const k = KP.get(id); if (!k) return;
  ui.learn = { chapter: k.chapter, subject: k.subject, mode: 'all', queue: [k], idx: 0, hide: false, revealed: false };
  go('learn');
}
function openQuestion(q) {
  if (!q) return;
  modal(`<h2>${TYPE_NAME[q.type]} · ${esc(chName(q.chapter))}</h2>
    <div style="font-size:15px;line-height:1.85;margin-bottom:14px">${prose(q.stem)}</div>
    ${q.type !== 'fill' ? `<div style="display:flex;flex-direction:column;gap:7px">${(q.options || []).map((o, i) => `<div class="opt ${q.answer.includes(i) ? 'right' : ''}" style="pointer-events:none"><span class="ok">${String.fromCharCode(65 + i)}</span><span>${prose(o)}</span></div>`).join('')}</div>` : `<div class="explain" style="margin-top:0"><b>答案：${esc((q.answerText || []).join(' / '))}</b></div>`}
    <div class="explain"><div>${prose(q.explain)}</div><div class="src">${srcLink(q.source)}</div></div>
    <div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn" data-close-modal>关闭</button></div>`);
}
function showExamDetail(i) {
  const e = state.exams[i]; if (!e) return;
  modal(`<h2>模考详情</h2>
    <div class="result-score"><div class="big ${e.pass ? 'pass' : 'fail'}" style="font-size:48px">${e.score}</div>
    <div class="lbl">${new Date(e.ts).toLocaleString('zh-CN')} · ${esc(e.subjectName || '综合卷')} · 用时 ${fmtClock(e.used || 0)} · 答对 ${e.correct}/${e.total}</div></div>
    <div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn" data-close-modal>关闭</button></div>`);
}
function showHelp() {
  modal(`<h2>使用说明与快捷键</h2>
    <div class="tiny" style="line-height:2;color:var(--ink-2)">
      <b>每天怎么用</b><br>今日页从上往下：清复习 → 学新卡 → 刷 10 题 → 背 15 个词。完成后去错题本清一遍。<br><br>
      <b>知识卡</b><br>1 / 2 / 3 分别标记「忘了 / 模糊 / 掌握」，系统按遗忘曲线安排下次复习。← → 翻卡，空格遮住/显示答案。<br><br>
      <b>速查</b><br>公式和方程式支持「遮罩自测」，点卡片显示答案。<br><br>
      <b>模考</b><br>综合卷跨四科组卷；交卷后看学科命中率和薄弱章节。<br><br>
      <b>数据</b><br>进度只存本机。设置里可以导出/导入 JSON 备份。<br><br>
      快捷键：<kbd>/</kbd> 搜索 · <kbd>?</kbd> 帮助 · <kbd>T</kbd> 主题 · <kbd>Esc</kbd> 关闭
    </div>
    <div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn primary" data-close-modal>知道了</button></div>`);
}

/* ───────────────── 事件绑定 ───────────────── */
function bindView() {
  const v = $('#view');
  if (!v) return;
  v.onclick = (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const fn = ACT[t.dataset.act];
    if (fn) { e.preventDefault(); e.stopPropagation(); fn(t, e); }
  };
  const note = $('#kpNote');
  if (note) {
    note.oninput = () => {
      const k = ui.learn.queue[ui.learn.idx]; if (!k) return;
      state.notes[k.id] = note.value; save();
    };
  }
  const lq = $('#lookupQ');
  if (lq) lq.oninput = () => { ui.lookup.q = lq.value; const p = lq.selectionStart; render(); const el = $('#lookupQ'); if (el) { el.focus(); try { el.setSelectionRange(p, p); } catch (e) {} } };
  const vq = $('#vocabQ');
  if (vq) vq.oninput = () => { ui.vocab.q = vq.value; const p = vq.selectionStart; render(); const el = $('#vocabQ'); if (el) { el.focus(); try { el.setSelectionRange(p, p); } catch (e) {} } };
  const fi = $('#fillInput');
  if (fi) fi.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submitFill(); } };
  const ef = $('#examFill');
  if (ef) ef.oninput = () => { saveExamFill(); };
  const ed = $('#examDateInput'); if (ed) ed.onchange = () => { state.settings.examDate = ed.value; save(); toast('高考日期已更新'); };
  const imp = $('#importFile'); if (imp) imp.onchange = importData;
}

const ACT = {
  /* 导航 / 全局 */
  theme: () => toggleTheme(),
  'theme-light': () => { state.theme = 'light'; document.documentElement.setAttribute('data-theme', 'light'); save(); render(); },
  'theme-dark': () => { state.theme = 'dark'; document.documentElement.setAttribute('data-theme', 'dark'); save(); render(); },
  settings: () => go('settings'),
  search: () => openSearch(),
  'search-open': (t) => openSearchResult(Number(t.dataset.i)),
  help: () => showHelp(),

  /* 今日 */
  'task-go': (t) => {
    const task = t.dataset.task;
    if (task === 'learn') { startLearn({ mode: dueCards().length ? 'due' : 'all' }); }
    else if (task === 'quiz') { ui.quiz = null; go('quiz'); }
    else if (task === 'words') { ui.vocab.day = null; go('vocab'); }
    else if (task === 'timer') { startTimer(); }
  },
  'start-review': () => startLearn({ mode: 'due' }),
  'open-learn': () => { ui.learn.subject = null; ui.learn.queue = []; go('learn'); },
  'open-subject': (t) => { ui.learn.mode = 'all'; ui.learn.subject = t.dataset.sub; ui.learn.queue = []; go('learn'); },
  'open-ch': (t) => startLearn({ chapter: t.dataset.ch, mode: 'all' }),
  'start-random': () => {
    const list = DB.kps; if (!list.length) return;
    const k = list[Math.floor(Math.random() * list.length)]; openKP(k.id);
  },
  'open-kp': (t) => openKP(t.dataset.id),
  'open-plan': () => go('plan'),
  'open-stats': () => go('stats'),
  'start-exam': () => go('exam'),
  'open-weak': () => { ui.learn.queue = []; ui.learn.mode = 'weak'; go('learn'); },
  'exam-detail': (t) => showExamDetail(Number(t.dataset.i)),

  /* 学习 */
  'learn-mode': (t) => { ui.learn.mode = t.dataset.mode; ui.learn.queue = []; render(); },
  'learn-back': () => { ui.learn.queue = []; go('learn'); },
  'toggle-hide': () => { ui.learn.hide = !ui.learn.hide; ui.learn.revealed = false; render(); },
  'reveal-kp': () => { ui.learn.revealed = true; render(); },
  rate: (t) => {
    const k = ui.learn.queue[ui.learn.idx]; if (!k) return;
    grade(k, Number(t.dataset.r));
    if (ui.learn.idx + 1 < ui.learn.queue.length) { ui.learn.idx++; ui.learn.revealed = false; render(); }
    else { toast('本轮完成 🎉'); ui.learn.queue = []; go('learn'); }
  },
  'next-kp': () => {
    if (ui.learn.idx + 1 < ui.learn.queue.length) { ui.learn.idx++; ui.learn.revealed = false; render(); }
    else { toast('本轮完成 🎉'); ui.learn.queue = []; go('learn'); }
  },
  'prev-kp': () => { if (ui.learn.idx > 0) { ui.learn.idx--; ui.learn.revealed = false; render(); } },
  'star-kp': () => { const k = ui.learn.queue[ui.learn.idx]; if (!k) return; state.star[k.id] = !state.star[k.id]; if (!state.star[k.id]) delete state.star[k.id]; save(); render(); },
  'quiz-chapter': () => { const k = ui.learn.queue[ui.learn.idx]; if (!k) return; ui.quizCfg.subjects = [k.subject]; ui.quizCfg.chapters = [k.chapter]; ui.quizCfg.wrongOnly = false; ui.quizCfg.count = 10; ui.quizCfg.types = ['single', 'multi', 'judge', 'fill']; startQuiz(buildQuizPool(), '本章刷题'); },

  /* 速查 */
  'lookup-tab': (t) => { ui.lookup.tab = t.dataset.tab; ui.lookup.q = ''; render(); },
  'lookup-sub': (t) => { ui.lookup.subject = t.dataset.sub; render(); },
  'toggle-mask': () => { ui.lookup.masked = !ui.lookup.masked; render(); },
  'reveal-f': (t) => { if (!ui.lookup.masked) return; t.classList.toggle('rev'); },
  'copy-f': (t, e) => {
    e.stopPropagation();
    const f = FORMULA.get(t.dataset.id); if (!f) return;
    copy(f.expr.replace(/\$\$/g, '')).then(() => { t.textContent = '✓'; setTimeout(() => { t.textContent = '⧉'; }, 1200); });
  },

  /* 单词 */
  'vocab-day': (t) => { ui.vocab.day = Number(t.dataset.day); ui.vocab.q = ''; ui.vocab.revealed = {}; render(); },
  'vocab-back': () => { ui.vocab.day = null; render(); },
  'vocab-flash': () => { ui.vocab.flash = !ui.vocab.flash; ui.vocab.revealed = {}; render(); },
  'vocab-flash-all': () => { ui.vocab.flash = !ui.vocab.flash; ui.vocab.revealed = {}; render(); },
  'word-click': (t) => {
    const id = t.dataset.id;
    if (ui.vocab.flash) { ui.vocab.revealed[id] = !ui.vocab.revealed[id]; render(); return; }
    const v = VOC.get(id); if (!v) return;
    modal(`<h2>${esc(v.word)}${v.pos ? ` <span class="vc-pos" style="vertical-align:4px">${esc(v.pos)}</span>` : ''}</h2>
      <p style="font-size:16px;margin:0 0 12px">${esc(v.cn || '')}</p>
      ${v.example ? `<div class="explain" style="margin-top:0"><b>例句</b><br>${esc(v.example)}</div>` : ''}
      ${v.related ? `<p class="small" style="margin-top:10px">相关形式：<b>${esc(v.related)}</b></p>` : ''}
      ${v.explain ? `<p class="tiny muted" style="line-height:1.8;margin-top:8px">${esc(v.explain)}</p>` : ''}
      <div class="row" style="margin-top:16px;justify-content:flex-end;gap:8px">
        <button class="btn" data-act="speak" data-id="${v.id}">🔊 朗读</button>
        <button class="btn primary" data-act="word-known" data-id="${v.id}">${state.knownWords[v.id] ? '取消已掌握' : '标记已掌握'}</button>
      </div>`);
  },
  'word-known': (t, e) => {
    e.stopPropagation();
    const id = t.dataset.id;
    if (state.knownWords[id]) delete state.knownWords[id];
    else { state.knownWords[id] = TODAY; act('words', 1); }
    save(); render();
  },
  speak: (t, e) => {
    e.stopPropagation();
    const v = VOC.get(t.dataset.id); if (!v) return;
    if (!('speechSynthesis' in window)) { toast('这个浏览器不支持朗读'); return; }
    const u = new SpeechSynthesisUtterance(v.word); u.lang = 'en-US'; u.rate = .9;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  },

  /* 刷题 */
  'quiz-sub': (t) => {
    const s = t.dataset.sub;
    if (s === 'all') ui.quizCfg.subjects = ['all'];
    else {
      ui.quizCfg.subjects = ui.quizCfg.subjects.filter((x) => x !== 'all');
      const i = ui.quizCfg.subjects.indexOf(s);
      if (i >= 0) ui.quizCfg.subjects.splice(i, 1); else ui.quizCfg.subjects.push(s);
      if (!ui.quizCfg.subjects.length) ui.quizCfg.subjects = ['all'];
    }
    ui.quizCfg.chapters = ['all']; render();
  },
  'quiz-ch': (t) => {
    const ch = t.dataset.ch;
    if (ch === 'all') ui.quizCfg.chapters = ['all'];
    else {
      ui.quizCfg.chapters = ui.quizCfg.chapters.filter((x) => x !== 'all');
      const i = ui.quizCfg.chapters.indexOf(ch);
      if (i >= 0) ui.quizCfg.chapters.splice(i, 1); else ui.quizCfg.chapters.push(ch);
      if (!ui.quizCfg.chapters.length) ui.quizCfg.chapters = ['all'];
    }
    render();
  },
  'quiz-type': (t) => {
    const ty = t.dataset.t; const i = ui.quizCfg.types.indexOf(ty);
    if (i >= 0) ui.quizCfg.types.splice(i, 1); else ui.quizCfg.types.push(ty);
    if (!ui.quizCfg.types.length) ui.quizCfg.types = ['single'];
    render();
  },
  'quiz-count': (t) => { ui.quizCfg.count = Number(t.dataset.n); render(); },
  'quiz-wrongonly': () => { ui.quizCfg.wrongOnly = !ui.quizCfg.wrongOnly; render(); },
  'quiz-start': () => startQuiz(buildQuizPool(), '自由刷题'),
  pick: (t) => pickOption(Number(t.dataset.i)),
  'submit-fill': () => submitFill(),
  'submit-multi': () => judgeCurrent(),
  'next-q': () => { const s = ui.quiz; if (s.i + 1 < s.list.length) { s.i++; render(); } else { s.phase = 'done'; render(); } },
  'prev-q': () => { const s = ui.quiz; if (s.i > 0) { s.i--; render(); } },
  'quiz-exit': () => { ui.quiz = null; go('quiz'); },
  'quiz-again': () => { const s = ui.quiz; startQuiz(shuffle(s.list), s.label); },
  'quiz-back': () => { ui.quiz = null; go('quiz'); },
  'quiz-redo-wrong': () => { const s = ui.quiz; const w = s.list.filter((q, i) => !isCorrect(q, s.ans[i])); startQuiz(w, '错题重做'); },
  'quiz-wrong-now': () => { const list = Object.keys(state.wrong).map((id) => Q.get(id)).filter(Boolean); if (!list.length) { toast('错题本是空的'); return; } startQuiz(shuffle(list).slice(0, 20), '错题本'); },
  'self-correct': () => {
    const s = ui.quiz; if (!s) return;
    const i = s.i, q = s.list[i];
    if (!s.judged[i]) return;
    s.right++;
    const cs = state.chapStats[q.chapter];
    if (cs) { cs.n = Math.max(0, cs.n - 1); }
    bumpChap(q.chapter, true);
    if (state.wrong[q.id]) { state.wrong[q.id].ok = (state.wrong[q.id].ok || 0) + 1; if (state.wrong[q.id].n <= 1) delete state.wrong[q.id]; }
    save(); render();
  },
  'rev-q': (t) => { const s = ui.quiz; openQuestion(s.list[Number(t.dataset.i)]); },

  /* 模考 */
  'exam-sub': (t) => { ui.examCfg.subject = t.dataset.sub; render(); },
  'exam-count': (t) => { ui.examCfg.count = Number(t.dataset.n); render(); },
  'exam-min': (t) => { ui.examCfg.minutes = Number(t.dataset.m); render(); },
  'exam-start': () => startExam(),
  'exam-pick': (t) => examPick(Number(t.dataset.i)),
  'exam-prev': () => { saveExamFill(); if (ui.exam.i > 0) { ui.exam.i--; render(); } },
  'exam-next': () => { saveExamFill(); if (ui.exam.i + 1 < ui.exam.paper.length) { ui.exam.i++; render(); } else confirmSubmit(); },
  'exam-jump': (t) => { saveExamFill(); ui.exam.i = Number(t.dataset.i); render(); },
  'exam-flag': () => { const s = ui.exam; s.flags.has(s.i) ? s.flags.delete(s.i) : s.flags.add(s.i); render(); },
  'exam-panel': () => { const el = $('#examSheet'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  'exam-submit': () => confirmSubmit(),
  'exam-retry': () => { ui.exam = null; go('exam'); },

  /* 错题 */
  'wrong-practice': () => { const list = Object.keys(state.wrong).map((id) => Q.get(id)).filter(Boolean); startQuiz(shuffle(list), '错题本'); },
  'wrong-clear': () => { if (confirm('确定清空错题本？')) { state.wrong = {}; save(); render(); } },
  'wrong-remove': (t) => { delete state.wrong[t.dataset.id]; save(); render(); },
  'open-q': (t) => openQuestion(Q.get(t.dataset.id)),

  /* 计划 */
  'plan-start': () => { state.planStart = TODAY; save(); render(); toast('计划已开始，今日页会显示当天任务'); },
  'plan-reset': () => { if (confirm('重新开始 30 天计划？已完成记录会保留。')) { state.planStart = TODAY; save(); render(); } },
  'plan-toggle': (t) => { const d = Number(t.dataset.day); state.planDone[d] = !state.planDone[d]; if (!state.planDone[d]) delete state.planDone[d]; save(); render(); },

  /* 设置 */
  'save-settings': () => {
    const g = goals();
    const cards = Number($('#goalCards')?.value) || g.cards;
    const quiz = Number($('#goalQuiz')?.value) || g.quiz;
    const words = Number($('#goalWords')?.value) || g.words;
    const minutes = Number($('#goalMinutes')?.value) || g.minutes;
    state.settings.goals = { cards, quiz, words, minutes };
    const ed = $('#examDateInput');
    if (ed && ed.value) state.settings.examDate = ed.value;
    save(); toast('设置已保存'); render();
  },
  'export-data': () => exportData(),
  'reset-all': () => { if (confirm('确定清空全部学习记录？这个操作不可撤销。')) { localStorage.removeItem(LS); location.reload(); } },
  'open-settings': () => go('settings')
};

function qCorrect(q) {
  if (!q) return;
  act('quiz', 0);
  if (state.wrong[q.id]) { state.wrong[q.id].ok = (state.wrong[q.id].ok || 0) + 1; }
  save();
}

/* ───────────────── 数据导入导出 / 主题 / 计时 ───────────────── */
function copy(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  ta.remove(); return Promise.resolve();
}
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `拾阶学习记录-${TODAY}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('已导出学习记录');
}
function importData(e) {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!data || typeof data !== 'object' || !data.prog) throw new Error('bad');
      state = Object.assign({}, DEF, data);
      save();
      toast('导入成功，正在刷新…');
      setTimeout(() => location.reload(), 600);
    } catch (err) { alert('文件格式不正确，请选择本系统导出的 JSON。'); }
  };
  r.readAsText(file);
}
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  save(); render();
}
function startTimer() {
  if (ui.timer.running) { toast('计时进行中，专注当下'); return; }
  ui.timer.running = true; ui.timer.left = ui.timer.total;
  clearInterval(ui.timer.id);
  ui.timer.id = setInterval(() => {
    ui.timer.left--;
    const el = $('#focusTime'); if (el) el.textContent = fmtClock(Math.max(0, ui.timer.left));
    const bar = $('#focusBar'); if (bar) bar.style.width = (1 - ui.timer.left / ui.timer.total) * 100 + '%';
    if (ui.timer.left <= 0) {
      clearInterval(ui.timer.id); ui.timer.running = false;
      act('minutes', 25); save();
      toast('25 分钟完成，已记入今日专注时长 🎉', 2600);
      if (state.view === 'today') render();
    }
  }, 1000);
  if (state.view === 'today') render();
}

/* ───────────────── 全局事件 ───────────────── */
document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-view]');
  if (nav) {
    e.preventDefault();
    if (nav.dataset.view === 'more') { openMore(); return; }
    if (nav.dataset.view === 'learn') { ui.learn.subject = null; ui.learn.queue = []; }
    go(nav.dataset.view); return;
  }
  const actEl = e.target.closest('[data-act]');
  if (actEl && !e.target.closest('#view')) {
    const fn = ACT[actEl.dataset.act];
    if (fn) { e.preventDefault(); fn(actEl, e); return; }
  }
  const closeSheet = e.target.closest('[data-close-sheet]');
  if (closeSheet) { closeMore(); return; }
  const closeModalEl = e.target.closest('[data-close-modal]');
  if (closeModalEl) { closeModal(); return; }
  if (e.target.closest('#searchClose')) { closeSearch(); return; }
});
$('#modal').addEventListener('click', (e) => { if (e.target.dataset.closeModal !== undefined || e.target.closest('[data-close-modal]')) closeModal(); });
$('#searchOverlay').addEventListener('click', (e) => { if (e.target.id === 'searchOverlay') closeSearch(); });
$('#moreSheet').addEventListener('click', (e) => { if (e.target.dataset.closeSheet !== undefined) closeMore(); });
$('#searchInput').addEventListener('input', (e) => { ui.search.sel = 0; doSearch(e.target.value); });
$('#searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); ui.search.sel = Math.min(ui.search.results.length - 1, ui.search.sel + 1); doSearch(ui.search.q); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); ui.search.sel = Math.max(0, ui.search.sel - 1); doSearch(ui.search.q); }
  else if (e.key === 'Enter') { e.preventDefault(); openSearchResult(ui.search.sel); }
  else if (e.key === 'Escape') closeSearch();
});
$('#btnMenu')?.addEventListener('click', () => openMore());

document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable || tag === 'select';
  if (e.key === 'Escape') {
    closeModal(); closeMore(); closeSearch();
    if (typing) e.target.blur();
    return;
  }
  if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) { e.preventDefault(); openSearch(); return; }
  if (!typing && e.key === '?') { e.preventDefault(); showHelp(); return; }
  if (!typing && e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey) { toggleTheme(); return; }
  if (state.view === 'learn' && ui.learn.queue.length && !typing) {
    if (e.key === 'ArrowRight') { e.preventDefault(); ACT['next-kp'](); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); ACT['prev-kp'](); }
    else if (e.key === '1') { ACT.rate({ dataset: { r: '0' } }); }
    else if (e.key === '2') { ACT.rate({ dataset: { r: '1' } }); }
    else if (e.key === '3') { ACT.rate({ dataset: { r: '2' } }); }
    else if (e.key === ' ') { e.preventDefault(); const k = ui.learn.queue[ui.learn.idx]; if (k) { ui.learn.hide = true; ui.learn.revealed = !ui.learn.revealed; render(); } }
  }
});

window.addEventListener('hashchange', () => {
  const h = decodeURIComponent((location.hash || '').replace(/^#/, ''));
  if (VIEW_TITLE[h] && h !== state.view) go(h);
});

window.addEventListener('online', () => toast('已联网'));
window.addEventListener('offline', () => toast('离线了，进度仍会保存在本机'));

/* ───────────────── 启动 ───────────────── */
function init() {
  load();
  const hash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
  const initial = VIEW_TITLE[hash] ? hash : 'today';
  state.view = initial;
  buildNav();
  setActive(initial);
  $('#crumbs').innerHTML = `<b>${VIEW_TITLE[initial]}</b>`;
  $('#streakN').textContent = streak();
  render();
  if (hash.startsWith('learn/')) {
    const ch = hash.split('/')[1];
    if (CH.has(ch)) startLearn({ chapter: ch });
  }
  setTimeout(() => {
    $('#app').hidden = false;
    $('#boot').classList.add('gone');
    setTimeout(() => { const b = $('#boot'); if (b) b.style.display = 'none'; }, 500);
  }, 260);
  // 本地开发/局域网 http 不注册 Service Worker，避免旧缓存遮住新改动；
  // 部署到 https（GitHub Pages / Cloudflare Pages 等）后才会启用离线缓存。
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
init();

})();
