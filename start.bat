@echo off
chcp 65001 >nul 2>&1
REM ============================================================
REM  VIPER - Bioinformatics Audit Agent  [start.bat]
REM  Double-click to launch. Closes Viper when you close this window.
REM ============================================================

title VIPER Audit Agent
cd /d "%~dp0"

REM --- Check virtual environment ---
if not exist ".venv\Scripts\streamlit.exe" (
    echo.
    echo  [!] First run detected. Running setup...
    echo.
    call setup.bat
    if errorlevel 1 (
        echo.
        echo  [ERROR] Setup failed. See messages above.
        pause
        exit /b 1
    )
)

REM --- Skip Streamlit email prompt ---
if not exist "%USERPROFILE%\.streamlit\credentials.toml" (
    mkdir "%USERPROFILE%\.streamlit" 2>nul
    echo [general] > "%USERPROFILE%\.streamlit\credentials.toml"
    echo email = "" >> "%USERPROFILE%\.streamlit\credentials.toml"
)

REM --- Kill any existing process on port 8501 ---
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8501 " 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo.
echo  ============================================================
echo      VIPER  Bioinformatics Audit Agent
echo  ============================================================
echo.
echo   Starting... Browser will open automatically.
echo   If not, visit: http://localhost:8501
echo.
echo   Close this window to stop Viper.
echo  ============================================================
echo.

REM --- Launch Streamlit directly from .venv (no activation needed) ---
".venv\Scripts\streamlit.exe" run app.py ^
    --server.port 8501 ^
    --server.headless false ^
    --browser.gatherUsageStats false ^
    --theme.base dark

pause

