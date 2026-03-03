@echo off
REM ============================================================
REM  VIPER Build System
REM  Usage: double-click build.bat
REM ============================================================

echo.
echo ============================================================
echo     VIPER Build System
echo     Building standalone .exe ...
echo ============================================================
echo.

REM --- Auto-detect Python ---
set "PYTHON_EXE="

REM Check Anaconda at the project's known location FIRST
if exist "E:\CENTER\PyPy\Anaconda\python.exe" (
    set "PYTHON_EXE=E:\CENTER\PyPy\Anaconda\python.exe"
    goto :found_python
)

REM Check common Anaconda / Python paths
for %%D in (
    "%USERPROFILE%\Anaconda3\python.exe"
    "%USERPROFILE%\miniconda3\python.exe"
    "C:\ProgramData\Anaconda3\python.exe"
    "C:\Anaconda3\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    "E:\CENTER\PyPy\Python3_13_7\python.exe"
) do (
    if exist %%D (
        set "PYTHON_EXE=%%~D"
        goto :found_python
    )
)

REM Last resort: try system PATH (but verify it actually works)
where python >nul 2>&1
if %errorlevel% equ 0 (
    python --version >nul 2>&1
    if %errorlevel% equ 0 (
        set "PYTHON_EXE=python"
        goto :found_python
    )
)

echo [ERROR] Python not found!
echo         Please install Python or set PYTHON_EXE environment variable.
echo         Searched: Anaconda, common install paths, system PATH.
pause
exit /b 1

:found_python
echo [OK] Python: %PYTHON_EXE%
%PYTHON_EXE% --version

REM --- Check PyInstaller ---
%PYTHON_EXE% -c "import PyInstaller" >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing PyInstaller ...
    %PYTHON_EXE% -m pip install "pyinstaller>=6.0"
)

REM --- Check Pillow ---
%PYTHON_EXE% -c "from PIL import Image" >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing Pillow ...
    %PYTHON_EXE% -m pip install Pillow
)

REM --- STEP 1: Install dependencies ---
echo.
echo [STEP 1/4] Installing project dependencies ...
%PYTHON_EXE% -m pip install -r requirements.txt --quiet

REM --- STEP 2: Convert icon ---
echo.
echo [STEP 2/4] Processing icon ...
if exist "assets\viper_icon.png" (
    %PYTHON_EXE% assets\convert_icon.py assets\viper_icon.png assets\viper_icon.ico
) else (
    echo [WARN] assets\viper_icon.png not found, using default icon
)

REM --- STEP 3: Clean old build ---
echo.
echo [STEP 3/4] Cleaning old build files ...
if exist "dist\VIPER" rmdir /s /q "dist\VIPER"
if exist "build\VIPER" rmdir /s /q "build\VIPER"

REM --- STEP 4: Run PyInstaller ---
echo.
echo [STEP 4/4] Running PyInstaller (this may take a few minutes) ...
echo.
%PYTHON_EXE% -m PyInstaller viper.spec --noconfirm

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed! Check error messages above.
    pause
    exit /b 1
)

REM --- Post-build ---
echo.
if exist "dist\VIPER" (
    copy /y ".env.example" "dist\VIPER\.env.example" >nul 2>&1
)

echo ============================================================
echo     Build complete!
echo     Output: dist\VIPER\
echo     Executable: dist\VIPER\VIPER.exe
echo ============================================================
echo.
pause