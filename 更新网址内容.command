#!/bin/bash
# 重新构建可部署产物；不会自动上传，避免误操作。
cd "$(dirname "$0")" || exit 1
echo "① 构建数据…"
node tools/build.mjs || exit 1
echo ""
echo "② 内容质检…"
node tools/validate.mjs || true
echo ""
echo "③ 生成 dist/ 与单文件版…"
node tools/build-mobile.mjs || exit 1
echo ""
echo "完成。"
echo "  · 长期在线：把 dist/ 整个目录拖到 GitHub Pages / Netlify Drop / Cloudflare Pages"
echo "  · 传到平板：把 dist/拾阶-单文件.html 用 AirDrop / 微信发过去"
echo "  · 本地预览：node tools/serve.mjs"
