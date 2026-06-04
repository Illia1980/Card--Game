@echo off
cd /d "%~dp0"
echo Starting Arcade Duel NEXT LEVEL...
echo.
if not exist node_modules (
  echo Installing packages...
  npm install
)
echo.
echo Opening http://localhost:3000 ...
start http://localhost:3000
npm start
pause
