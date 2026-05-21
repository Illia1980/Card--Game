@echo off
cd /d "%~dp0"
echo Checking project...
echo.
if not exist node_modules (
  echo Installing packages first...
  npm install
)
npm run check
pause
