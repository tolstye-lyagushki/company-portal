@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\Tools\node\node.exe" (
    set "PATH=%USERPROFILE%\Tools\node;%PATH%"
  ) else (
    echo Node.js не найден. Установите его с https://nodejs.org/ и запустите снова.
    pause
    exit /b 1
  )
)

if not exist node_modules (
  echo Устанавливаю зависимости, это займёт около минуты...
  call npm install
  if errorlevel 1 (
    echo Не удалось установить зависимости.
    pause
    exit /b 1
  )
)

echo Портал запускается: http://127.0.0.1:5180
echo Чтобы остановить, закройте это окно.
start "" http://127.0.0.1:5180
call npm run dev
