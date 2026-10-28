@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js табылмады. Node.js LTS орнатып, осы файлды қайта ашыңыз.
  echo https://nodejs.org/en/download
  pause
  exit /b 1
)
if not exist "%~dp0public\index.html" (
  echo Сайт файлдары табылмады. ZIP архивін толық шығарып алыңыз.
  echo START-QADAM.cmd, public, server, drizzle және scripts бір буманың ішінде болуы керек.
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 (
  echo Node.js 24 немесе жаңарақ нұсқасы керек. Node.js жаңартып, осы файлды қайта ашыңыз.
  pause
  exit /b 1
)
set "QADAM_PORT=0"
echo Qadam Code іске қосылып жатыр...
node "%~dp0scripts\serve.mjs" --open
pause
