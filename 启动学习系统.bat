@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   拾阶 · 高中学习与备考
echo   ────────────────────────────────
if not exist "app\data.bundle.js" (
  echo   首次运行，正在构建数据...
  node tools\build.mjs
  if errorlevel 1 (
    echo   构建失败，请确认已安装 Node.js。
    pause
    exit /b 1
  )
)
start "" http://localhost:4173/app/
node tools\serve.mjs
pause
