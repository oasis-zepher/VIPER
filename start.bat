@echo off
REM ============================================================
REM  VIPER — 一键启动脚本
REM  双击此文件即可启动 Viper，无需手动激活任何环境
REM ============================================================

title VIPER Audit Agent
cd /d "%~dp0"

REM --- 检查虚拟环境是否存在 ---
if not exist ".venv\Scripts\streamlit.exe" (
    echo.
    echo  [!] 尚未安装依赖，正在自动安装，请稍等...
    echo.
    call setup.bat
    if errorlevel 1 (
        echo.
        echo  [错误] 安装失败，请查看上方报错信息。
        pause
        exit /b 1
    )
)

REM --- 跳过 Streamlit 首次运行的邮件提示 ---
if not exist "%USERPROFILE%\.streamlit\credentials.toml" (
    mkdir "%USERPROFILE%\.streamlit" 2>nul
    echo [general] > "%USERPROFILE%\.streamlit\credentials.toml"
    echo email = "" >> "%USERPROFILE%\.streamlit\credentials.toml"
)

echo.
echo  ============================================================
echo      VIPER  Bioinformatics Audit Agent
echo  ============================================================
echo.
echo   启动中，浏览器将自动打开...
echo   如未自动打开，请手动访问：http://localhost:8501
echo.
echo   关闭此窗口即可停止 Viper
echo  ============================================================
echo.

REM --- 直接使用 .venv 内的 streamlit，无需激活环境 ---
".venv\Scripts\streamlit.exe" run app.py ^
    --server.port 8501 ^
    --server.headless false ^
    --browser.gatherUsageStats false ^
    --theme.base dark

pause
