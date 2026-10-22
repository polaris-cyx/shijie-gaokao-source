#!/usr/bin/env node
/**
 * 生成可部署产物
 *
 *   node tools/build-mobile.mjs
 *
 * 产出：
 *   dist/app/            完整 PWA（可直接部署到 GitHub Pages / Netlify / Cloudflare Pages）
 *   dist/materials/      原始 PDF（资料库链接）
 *   dist/index.html      入口跳转
 *   dist/拾阶-单文件.html  全内联单文件（传到平板也能直接打开）
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');
const DIST = join(ROOT, 'dist');
const FILES = ['index.html', 'app.css', 'app.js', 'data.bundle.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

if (!existsSync(join(APP, 'data.bundle.js'))) {
  console.error('✗ 缺少 app/data.bundle.js，请先运行: node tools/build.mjs');
  process.exit(1);
}
const read = (f) => readFileSync(join(APP, f), 'utf8');
const version = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'app'), { recursive: true });
for (const f of FILES) copyFileSync(join(APP, f), join(DIST, 'app', f));
writeFileSync(join(DIST, 'app', 'sw.js'), read('sw.js').replace('__BUILD_VERSION__', version), 'utf8');

if (existsSync(join(ROOT, 'materials'))) {
  cpSync(join(ROOT, 'materials'), join(DIST, 'materials'), { recursive: true });
}

writeFileSync(join(DIST, 'index.html'), `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>拾阶 · 高中学习与备考</title>
<meta http-equiv="refresh" content="0;url=app/">
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f5f2ea;color:#2f6f5e;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}.box{text-align:center}.mark{width:64px;height:64px;border-radius:18px;background:#2f6f5e;color:#fdf8ec;display:grid;place-items:center;font-family:"Songti SC",serif;font-size:34px;margin:0 auto 16px}a{color:#2f6f5e}</style>
</head><body><div class="box"><div class="mark">拾</div><p>正在进入学习系统…</p><p><a href="app/">如果没有自动跳转，点这里</a></p></div></body></html>`, 'utf8');

/* 单文件版 */
let html = read('index.html');
const css = read('app.css');
const js = read('app.js');
const data = read('data.bundle.js');
const safeScript = (s) => s.replace(/<\/script/gi, '<\\/script');
const put = (needle, value) => { html = html.replace(needle, () => value); };
put('<link rel="stylesheet" href="app.css">', `<style>\n${css}\n</style>`);
put('<script src="data.bundle.js"></script>', '');
put('<script src="app.js"></script>', `<script>${safeScript(data)}</script>\n<script>${safeScript(js)}</script>`);
html = html.replace(/<link rel="manifest"[^>]*>\n?/, '');
html = html.replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '');
html = html.replace(/<link rel="icon"[^>]*>\n?/, '');
const singlePath = join(DIST, '拾阶-单文件.html');
writeFileSync(singlePath, html, 'utf8');

writeFileSync(join(DIST, '.nojekyll'), '', 'utf8');
writeFileSync(join(DIST, 'robots.txt'), 'User-agent: *\nDisallow: /\n', 'utf8');
writeFileSync(join(DIST, 'README.md'), `# 拾阶 · 高中学习与备考\n\n这是可直接部署的静态站点。入口 \`index.html\`，应用在 \`app/\`，资料在 \`materials/\`。\n\n## 部署\n\n把整个 \`dist/\` 目录拖到 GitHub Pages、Netlify Drop 或 Cloudflare Pages 即可。\n\n## 单文件\n\n\`拾阶-单文件.html\` 内联了全部 CSS/JS/数据，可直接用 AirDrop / 微信传到平板，用浏览器打开。\n`, 'utf8');

const kb = (p) => (readFileSync(p).length / 1024).toFixed(0) + ' KB';
console.log('─'.repeat(62));
console.log(`✓ dist/app/                    完整 PWA（${FILES.length + 1} 个文件）`);
console.log(`✓ dist/materials/              ${existsSync(join(DIST, 'materials')) ? '原始 PDF' : '（无）'}`);
console.log(`✓ dist/index.html              入口跳转`);
console.log(`✓ dist/拾阶-单文件.html         ${kb(singlePath)}`);
console.log('');
console.log('下一步：');
console.log('  · 本地用：node tools/serve.mjs  → 打开 http://localhost:4173/app/');
console.log('  · 长期在线：把 dist/ 拖到 https://app.netlify.com/drop 或 Cloudflare Pages');
console.log('  · 传到平板：把 dist/拾阶-单文件.html 用 AirDrop/微信发过去，浏览器打开');
