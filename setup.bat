@echo off
chcp 65001 >nul 2>&1
REM ============================================================
REM  VIPER - First-time Setup [setup.bat]
REM  Run once. After that, use start.bat to launch Viper.
REM ============================================================

title VIPER Setup
cd /d "%~dp0"

echo.
echo ============================================================
echo   VIPER Setup - First-time Installation
echo ============================================================
echo.

REM --- Step 1: Check / install uv ---
where uv >nul 2>&1
if errorlevel 1 (
    echo [Step 1/3] Installing uv package manager...
    powershell -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex"
    for /f "tokens=*" %%i in ('powershell -Command "[System.Environment]::GetEnvironmentVariable(\"Path\",\"User\")"') do set "PATH=%PATH%;%%i"
) else (
    echo [Step 1/3] uv already installed. Skipping.
)

REM --- Step 2: Create virtual environment ---
echo.
echo [Step 2/3] Creating Python 3.11 virtual environment...
uv venv .venv --python 3.11 --seed
if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment.
    pause
    exit /b 1
)
echo [OK] Virtual environment created.

REM --- Step 3: Install dependencies ---
echo.
echo [Step 3/3] Installing packages (first run: ~3-8 min)...
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Package installation failed. Check network and try again.
    pause
    exit /b 1
)
echo [OK] All packages installed.

REM --- Copy .env template if missing ---
if not exist ".env" (
    if exist ".env.example" (
        echo.
        echo [INFO] Creating .env from template...
        copy ".env.example" ".env" >nul
        echo [ACTION] Opening .env in Notepad - fill in your API Key.
        notepad .env
    )
)

echo.
echo ============================================================
echo  [DONE] Setup complete! Run start.bat to launch Viper.
echo ============================================================
echo.
pause