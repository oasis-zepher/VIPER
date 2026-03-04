@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
REM ============================================================
REM  VIPER - Bioinformatics Audit Agent [start.bat]
REM  Double-click to launch. No manual env activation required.
REM ============================================================

title VIPER Audit Agent
cd /d "%~dp0"

REM --- Check virtual environment ---
if not exist ".venv\Scripts\streamlit.exe" (
    echo.
    echo [INFO] First run detected. Running setup...
    echo.
    call setup.bat
    if errorlevel 1 (
        echo.
        echo [ERROR] Setup failed. See logs above.
        pause
        exit /b 1
    )
)

REM --- Skip Streamlit onboarding email prompt ---
if not exist "%USERPROFILE%\.streamlit\credentials.toml" (
    mkdir "%USERPROFILE%\.streamlit" 2>nul
    echo [general] > "%USERPROFILE%\.streamlit\credentials.toml"
    echo email = "" >> "%USERPROFILE%\.streamlit\credentials.toml"
)

REM --- Pick a free port (start from 8501) ---
set "PORT=8501"
:check_port
netstat -ano | findstr /R /C:":!PORT! .*LISTENING" >nul 2>&1
if not errorlevel 1 (
    set /a PORT+=1
    if !PORT! GTR 8600 (
        echo [ERROR] No free port found in range 8501-8600.
        pause
        exit /b 1
    )
    goto check_port
)

echo.
echo ============================================================
echo   VIPER Bioinformatics Audit Agent
echo ============================================================
echo [INFO] Starting on port !PORT!
echo [INFO] Open in browser: http://localhost:!PORT!
echo [INFO] Close this window to stop Viper.
echo ============================================================
echo.

REM --- Launch Streamlit directly from .venv (no activation needed) ---
".venv\Scripts\streamlit.exe" run app.py ^
    --server.port !PORT! ^
    --server.headless false ^
    --browser.gatherUsageStats false ^
    --theme.base dark

pause

