#!/usr/bin/env node
/**
 * 本地静态服务器：电脑打开，平板/手机扫码或输入局域网地址即可使用。
 *
 *   node tools/serve.mjs            # 4173 端口
 *   PORT=8080 node tools/serve.mjs
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { networkInterfaces } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4173;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function safePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0].split('#')[0])).replace(/^(\.\.[\/\\])+/, '');
  return join(ROOT, clean);
}

const server = createServer(async (req, res) => {
  try {
    let p = safePath(req.url === '/' ? '/index.html' : req.url);
    let st;
    try { st = await stat(p); } catch { p = join(ROOT, 'index.html'); st = await stat(p); }
    if (st.isDirectory()) { p = join(p, 'index.html'); st = await stat(p); }
    const ext = extname(p).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const size = st.size;

    if (req.headers.range && ext === '.pdf') {
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range);
      const start = m && m[1] ? Number(m[1]) : 0;
      const end = m && m[2] ? Number(m[2]) : size - 1;
      res.writeHead(206, {
        'Content-Type': type, 'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': end - start + 1
      });
      createReadStream(p, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': type, 'Content-Length': size,
      'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache'
    });
    createReadStream(p).pipe(res);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = networkInterfaces();
  const ips = [];
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
    }
  }
  console.log('');
  console.log('  拾阶 · 高中学习与备考  已启动');
  console.log('  ' + '─'.repeat(48));
  console.log(`  电脑：  http://localhost:${PORT}/app/`);
  for (const ip of ips) console.log(`  平板：  http://${ip}:${PORT}/app/   （与电脑同一 Wi-Fi）`);
  console.log('');
  console.log('  提示：iPad / 安卓平板用浏览器打开上面的「平板」地址；');
  console.log('        iPhone / iPad 可「分享 → 添加到主屏幕」，像 App 一样使用。');
  console.log('  按 Ctrl+C 停止。');
  console.log('');
});
