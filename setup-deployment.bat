@echo off
echo ========================================
echo Chem IRL - GitHub + Vercel Setup
echo ========================================
echo.

echo Step 1: Checking Git installation...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Git is not installed!
    echo Please install Git from https://git-scm.com/download/win
    echo Then run this script again.
    pause
    exit /b 1
)
echo ✓ Git is installed

echo.
echo Step 2: Initializing Git repository...
git init
if %errorlevel% neq 0 (
    echo ERROR: Failed to initialize git repository
    pause
    exit /b 1
)
echo ✓ Git repository initialized

echo.
echo Step 3: Adding files to git...
git add .
if %errorlevel% neq 0 (
    echo ERROR: Failed to add files
    pause
    exit /b 1
)
echo ✓ Files added to git

echo.
echo Step 4: Creating initial commit...
git commit -m "Initial commit: Chem IRL MVP with Next.js, Supabase, Stripe"
if %errorlevel% neq 0 (
    echo ERROR: Failed to create commit
    pause
    exit /b 1
)
echo ✓ Initial commit created

echo.
echo ========================================
echo NEXT STEPS:
echo ========================================
echo.
echo 1. Create a GitHub repository:
echo    - Go to https://github.com/new
echo    - Repository name: chem-irl
echo    - Make it PUBLIC
echo    - Don't initialize with README
echo.
echo 2. Add remote origin:
echo    git remote add origin https://github.com/YOUR_USERNAME/chem-irl.git
echo.
echo 3. Push to GitHub:
echo    git branch -M main
echo    git push -u origin main
echo.
echo 4. Deploy to Vercel:
echo    - Go to https://vercel.com
echo    - Sign up with GitHub
echo    - Import chem-irl repository
echo    - Root Directory: web
echo    - Deploy!
echo.
echo 5. Add custom domain:
echo    - In Vercel: Project Settings → Domains
echo    - Add chemirl.app and www.chemirl.app
echo    - Follow DNS instructions
echo.
echo ========================================
echo Setup complete! Follow the steps above.
echo ========================================
pause



