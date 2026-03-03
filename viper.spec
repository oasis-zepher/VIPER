# -*- mode: python ; coding: utf-8 -*-
"""
viper.spec — PyInstaller 打包配置
用法: pyinstaller viper.spec
"""

import os
import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_submodules, copy_metadata

# 项目根目录
try:
    SPEC_DIR = os.path.dirname(os.path.abspath(SPECPATH))
except NameError:
    SPEC_DIR = os.getcwd()

# =====================================================================
#  收集依赖数据（安全方式 - 跳过无法收集的包）
# =====================================================================

def safe_collect_data(pkg, **kwargs):
    """安全收集数据文件，失败时返回空列表。"""
    try:
        return collect_data_files(pkg, **kwargs)
    except Exception:
        print(f"[WARN] Skipping data collection for {pkg}")
        return []

# Streamlit 需要打包自身的静态资源
streamlit_data = safe_collect_data("streamlit")

# 收集关键包的 dist-info 元数据
metadata_datas = []
for meta_pkg in ["streamlit", "pydantic", "pydantic_core",
                 "langchain", "langchain_core", "langchain_google_genai",
                 "langchain_openai", "langgraph", "importlib_metadata",
                 "google_generativeai", "google_ai_generativelanguage"]:
    try:
        metadata_datas += copy_metadata(meta_pkg)
    except Exception:
        print(f"[WARN] No metadata found for {meta_pkg}")

# 其他包的数据文件（可能不存在）
additional_data = []
for pkg in ["langchain", "langchain_core", "langchain_google_genai",
            "langgraph", "google.generativeai", "pydantic"]:
    additional_data += safe_collect_data(pkg)

# 隐式导入（PyInstaller 无法自动检测到的模块）
hidden_imports = [
    # Streamlit 内部
    "streamlit",
    "streamlit.runtime.scriptrunner",
    "streamlit.web.cli",
    "streamlit.web.bootstrap",
    # LangChain
    "langchain",
    "langchain_core",
    "langchain_google_genai",
    "langchain_openai",
    "langgraph",
    # 数据处理（审计分析用）
    "pandas",
    "numpy",
    # 文件处理
    "openpyxl",
    "chardet",
    "dotenv",
    "PyPDF2",
    # 其他
    "pydantic",
    "tenacity",
    "google.generativeai",
    "google.ai.generativelanguage",
    "PIL",
]

# Streamlit 隐式子模块
def safe_collect_submodules(pkg):
    try:
        return collect_submodules(pkg)
    except Exception:
        print(f"[WARN] Skipping submodule collection for {pkg}")
        return []

hidden_imports += safe_collect_submodules("streamlit")
hidden_imports += safe_collect_submodules("pydantic")

# =====================================================================
#  应用数据文件
# =====================================================================

# VIPER 自身的资源文件
viper_datas = [
    # 应用主代码
    ("app.py", "."),
    # 包目录
    ("config", "config"),
    ("agents", "agents"),
    ("core", "core"),
    ("ui", "ui"),
    ("utils", "utils"),
    ("assets", "assets"),
    # 配置文件
    (".env.example", "."),
]

all_datas = viper_datas + streamlit_data + additional_data + metadata_datas

# =====================================================================
#  图标
# =====================================================================

icon_file = os.path.join(SPEC_DIR, "assets", "viper_icon.ico")
if not os.path.exists(icon_file):
    icon_file = None  # 无图标时不报错

# =====================================================================
#  Analysis & Build
# =====================================================================

a = Analysis(
    ["launcher.py"],
    pathex=[SPEC_DIR],
    binaries=[],
    datas=all_datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # GUI toolkits (Streamlit uses its own web server)
        "tkinter", "PyQt5", "PyQt6", "PySide2", "PySide6",
        "qtpy", "sip", "sipbuild",
        # Testing / development
        "test", "unittest", "pytest", "nose", "doctest",
        "IPython", "ipykernel", "ipywidgets",
        # Jupyter / notebook
        "jupyter", "jupyter_client", "jupyter_core",
        "notebook", "nbconvert", "nbformat", "nbclient",
        # Documentation tools
        "sphinx", "docutils", "alabaster", "babel",
        # AWS / cloud (not needed)
        "botocore", "boto3", "s3transfer", "s3fs",
        # Heavy data tools not needed
        "pyarrow", "fastparquet", "dask", "distributed",
        "numba", "llvmlite",
        # Alternative viz (not used)
        "bokeh", "panel", "holoviews", "datashader", "colorcet",
        "altair", "vega",
        # Crypto / network (brought by other deps)
        "cryptography", "nacl", "paramiko",
        # Compiler / build tools
        "Cython", "meson", "mesonbuild",
        "pip", "wheel", "ensurepip",
        # XML / web scraping
        "lxml", "bs4", "scrapy", "html5lib",
        # Database
        "sqlalchemy", "sqlite3", "psycopg2",
        # Misc unused
        "xmlrpc", "curses", "lib2to3", "pydoc",
        "multiprocessing.popen_spawn_posix",
        "multiprocessing.popen_fork",
        "multiprocessing.popen_forkserver",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="VIPER",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # 保持控制台窗口用于显示服务器状态
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=icon_file,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="VIPER",
)
