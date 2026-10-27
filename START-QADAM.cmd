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
if not exist "%~dp0dist\index.html" (
  echo Сайт файлдары табылмады. ZIP архивін толық шығарып алыңыз.
  echo START-QADAM.cmd, dist және scripts бір буманың ішінде болуы керек.
  pause
  exit /b 1
)
set "QADAM_PORT=0"
echo Qadam Code іске қосылып жатыр...
node "%~dp0scripts\serve.mjs" --open
pause
