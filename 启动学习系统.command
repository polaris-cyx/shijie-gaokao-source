#!/bin/bash
# 拾阶 · 高中学习与备考 —— Mac 一键启动
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nodejs/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "没有找到 Node.js。请先安装 Node.js（https://nodejs.org），或用浏览器直接打开 index.html。"
  read -r -p "按回车退出…"
  exit 1
fi

if [ ! -f app/data.bundle.js ]; then
  echo "首次运行，正在构建数据…"
  node tools/build.mjs || { read -r -p "构建失败，按回车退出…"; exit 1; }
fi

# 端口被占用时换一个
PORT="${PORT:-4173}"
while lsof -i ":$PORT" >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done
export PORT

(sleep 1; open "http://localhost:$PORT/app/" 2>/dev/null) &
echo ""
echo "拾阶 · 高中学习与备考"
echo "────────────────────────────────"
echo "电脑：http://localhost:$PORT/app/"
echo "平板：见下方局域网地址（同一 Wi-Fi）"
echo ""
echo "关闭窗口或按 Ctrl+C 停止。"
echo ""
node tools/serve.mjs
