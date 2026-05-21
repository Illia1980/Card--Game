@echo off
cd /d "%~dp0"
echo This helper prepares and pushes the project to GitHub.
echo You must already have a GitHub repository URL.
echo Example: https://github.com/YOUR-USERNAME/durak-arcade-online.git
echo.
set /p REPO_URL=Paste your GitHub repo URL here: 
if "%REPO_URL%"=="" (
  echo No URL entered.
  pause
  exit /b
)
git init
git add .
git commit -m "Initial version of Durak Arcade Online"
git branch -M main
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git push -u origin main
pause
