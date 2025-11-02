@echo off
echo ========================================
echo Git Configuration for GitHub
echo ========================================
echo.

echo Please enter your GitHub email address:
set /p GIT_EMAIL=
echo.
echo Please enter your name:
set /p GIT_NAME=
echo.

echo Configuring Git...
git config --global user.email "%GIT_EMAIL%"
git config --global user.name "%GIT_NAME%"

echo.
echo ✓ Git configured successfully!
echo.
echo Email: %GIT_EMAIL%
echo Name: %GIT_NAME%
echo.
echo ========================================
echo Next: Create your GitHub repository
echo ========================================
echo.
echo 1. Go to https://github.com/new
echo 2. Repository name: chem-irl
echo 3. Description: "Chem IRL - Dating app that optimizes time-to-date"
echo 4. Set to PUBLIC (required for free Vercel hosting)
echo 5. DO NOT initialize with README, .gitignore, or license
echo 6. Click "Create repository"
echo.
echo After creating the repo, come back and we'll push the code!
echo.
pause
