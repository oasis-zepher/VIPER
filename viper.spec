# -*- mode: python ; coding: utf-8 -*-
"""
viper.spec  PyInstaller spec for VIPER (CustomTkinter + onefile + noconsole)
Entry point : app.py
Build cmd   : pyinstaller viper.spec --clean
Output      : dist/VIPER.exe
"""

from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_submodules, collect_dynamic_libs

block_cipher = None

PROJECT_ROOT = Path(SPECPATH)

#  资产与配置数据 
added_datas = [
    (str(PROJECT_ROOT / "assets"), "assets"),
    (str(PROJECT_ROOT / "config"), "config"),
]

# CustomTkinter 必须打包其主题 JSON / 图像资产
added_datas += collect_data_files("customtkinter")

# tkinterdnd2 需打包原生 DLL
added_datas += collect_data_files("tkinterdnd2")
added_datas += collect_dynamic_libs("tkinterdnd2")

#  隐式导入 
hidden = [
    #  GUI 
    "customtkinter",
    "tkinterdnd2",
    #  PIL 
    "PIL", "PIL.Image", "PIL.ImageTk", "PIL.ImageDraw",
    "PIL.ImageFilter", "PIL.ImageFont",
    #  LangChain 
    "langchain",
    "langchain.chat_models",
    "langchain.schema",
    "langchain_core",
    "langchain_core.messages",
    "langchain_core.prompts",
    "langchain_core.output_parsers",
    "langchain_community",
    "langchain_google_genai",
    "langchain_openai",
    "langchain_anthropic",
    #  LangGraph 
    "langgraph",
    "langgraph.graph",
    "langgraph.checkpoint",
    "langgraph.prebuilt",
    #  LLM 提供商 
    "google.generativeai",
    "google.ai.generativelanguage",
    "anthropic",
    "openai",
    #  数据处理 
    "pandas", "pandas.core", "pandas.io",
    "numpy",
    "openpyxl", "openpyxl.styles", "openpyxl.utils",
    #  验证 / 重试 
    "pydantic", "pydantic.v1",
    "tenacity",
    #  工具库 
    "chardet",
    "dotenv", "python_dotenv",
    "jinja2",
    "tiktoken",
    "httpx", "httpcore",
    "aiohttp",
    "certifi",
    "charset_normalizer",
    "queue",
    "ctypes",
]

# 用 collect_submodules 扩展核心模块
hidden += collect_submodules("langchain_core")
hidden += collect_submodules("langgraph")
hidden += collect_submodules("google.generativeai")
hidden += collect_submodules("pydantic")

#  排除项 (减小体积) 
# 注意: tkinter 绝对不能排除 (customtkinter 依赖它)
excludes_list = [
    "streamlit",
    "IPython",
    "jupyter",
    "notebook",
    "matplotlib",
    "scipy",
    "sklearn",
    "tensorflow",
    "torch",
    "PySide6",
    "PyQt5",
    "PyQt6",
    "wx",
    "pytest",
    "black",
    "mypy",
    "pylint",
    "ruff",
    "sphinx",
    "docutils",
    "pygments",  # keep if needed by rich, else exclude
    "test",
    "unittest",
    "distutils",
]

a = Analysis(
    ["app.py"],
    pathex=[str(PROJECT_ROOT)],
    binaries=[],
    datas=added_datas,
    hiddenimports=hidden,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes_list,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="VIPER",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,           # 无 CMD 黑框
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(PROJECT_ROOT / "assets" / "viper_icon.ico"),
)
# 注意: onefile 模式无 COLLECT 块
