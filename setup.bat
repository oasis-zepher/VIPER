@echo off
REM ============================================================
REM  VIPER — 首次安装脚本
REM  只需运行一次，之后直接用 start.bat 启动
REM ============================================================

title VIPER Setup
cd /d "%~dp0"

echo.
echo  ============================================================
echo      VIPER Setup — 首次安装
echo  ============================================================
echo.

REM --- 检查 uv 是否可用 ---
where uv >nul 2>&1
if errorlevel 1 (
    echo  [步骤 1/3] 安装 uv 包管理器...
    powershell -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex"
    REM 刷新 PATH
    for /f "tokens=*" %%i in ('powershell -Command "[System.Environment]::GetEnvironmentVariable(\"Path\",\"User\")"') do set "PATH=%PATH%;%%i"
) else (
    echo  [步骤 1/3] uv 已安装，跳过。
)

REM --- 创建虚拟环境 ---
echo.
echo  [步骤 2/3] 创建 Python 3.11 虚拟环境...
uv venv .venv --python 3.11 --seed
if errorlevel 1 (
    echo  [错误] 创建虚拟环境失败！
    pause
    exit /b 1
)
echo  完成。

REM --- 安装依赖 ---
echo.
echo  [步骤 3/3] 安装依赖包（首次约需 3-8 分钟）...
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
    echo  [错误] 依赖安装失败，请检查网络连接！
    pause
    exit /b 1
)

REM --- 复制 .env 模板 ---
if not exist ".env" (
    if exist ".env.example" (
        echo.
        echo  [提示] 正在创建 .env 配置文件...
        copy ".env.example" ".env" >nul
        echo  [!] 请用记事本打开 .env 填入你的 API Key：
        echo      GOOGLE_API_KEY=你的Gemini_Key
        echo.
        notepad .env
    )
)

echo.
echo  ============================================================
echo      安装完成！
echo      运行 start.bat 启动 Viper
echo  ============================================================
echo.
pause
