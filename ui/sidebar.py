"""
sidebar.py — 左侧文件树面板
支持拖拽上传 .R, .py, .csv 数据文件和 .png/.jpg 图表截图。
赛博极客暗色风格。
"""

from __future__ import annotations

import streamlit as st
from pathlib import Path
from typing import Any

from config.settings import Settings
from core.data_parser import DataParser
from utils.path_utils import safe_path, is_large_file
from utils.logger import get_logger

logger = get_logger(__name__)

# 支持的脚本扩展名
SCRIPT_EXTENSIONS = {".py", ".r", ".rmd"}
# 支持的数据扩展名
DATA_EXTENSIONS = {".csv", ".tsv", ".txt", ".xlsx", ".xls"}
# 支持的图表扩展名
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".svg", ".webp"}


def render_sidebar() -> dict[str, Any]:
    """
    渲染左侧文件树边栏。

    Returns:
        dict: {
            "uploaded_scripts": [...],
            "uploaded_data": [...],
            "uploaded_images": [...],
            "user_request": str,
            "trigger_audit": bool,
            "settings_changed": bool,
        }
    """
    result: dict[str, Any] = {
        "uploaded_scripts": [],
        "uploaded_data": [],
        "uploaded_images": [],
        "user_request": "",
        "trigger_audit": False,
        "settings_changed": False,
    }

    with st.sidebar:
        # ------ Logo & Title ------
        st.markdown(
            """
            <div style='text-align: center; padding: 1rem 0;'>
                <h1 style='font-size: 2rem; margin: 0;
                    background: linear-gradient(135deg, #00ff88, #00ccff);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    font-family: "Consolas", monospace;'>
                    🐍 VIPER
                </h1>
                <p style='color: #00ff88; font-size: 0.75rem; margin: 0.3rem 0 0 0;
                    font-family: "Consolas", monospace; letter-spacing: 2px;'>
                    BIOINFORMATICS AUDIT AGENT
                </p>
            </div>
            <hr style='margin: 0.5rem 0; border-color: #1a3a2a;'>
            """,
            unsafe_allow_html=True,
        )

        # ------ 文件上传区域 ------
        st.markdown(
            "<p style='color: #00ff88; font-size: 0.9rem; font-family: monospace;'>"
            "📂 FILE TREE</p>",
            unsafe_allow_html=True,
        )

        # Tab 切换上传方式
        tab_upload, tab_path = st.tabs(["📁 拖拽上传", "📂 路径挂载"])

        with tab_upload:
            uploaded_files = st.file_uploader(
                "拖拽脚本 / 数据 / 图表",
                type=[
                    "py", "r", "rmd",
                    "csv", "tsv", "txt", "xlsx", "xls",
                    "png", "jpg", "jpeg", "bmp", "svg", "webp",
                ],
                accept_multiple_files=True,
                help="支持: .py, .R, .Rmd 脚本 | .csv, .xlsx 数据 | .png, .jpg 图表",
                key="file_uploader",
            )

            if uploaded_files:
                result = _process_uploaded_files(uploaded_files, result)

        with tab_path:
            st.info("💡 输入本地文件绝对路径（如 E:\\\\data\\\\script.py）")
            file_path_input = st.text_input(
                "文件路径",
                placeholder=r"E:\data\script.py",
                key="path_input",
            )
            if st.button("📂 加载", key="load_path_btn"):
                if file_path_input.strip():
                    result = _process_file_path(file_path_input.strip(), result)

        st.markdown("<hr style='border-color: #1a3a2a;'>", unsafe_allow_html=True)

        # ------ 已加载文件树展示 ------
        _render_file_tree(result)

        st.markdown("<hr style='border-color: #1a3a2a;'>", unsafe_allow_html=True)

        # ------ 审计请求输入 ------
        st.markdown(
            "<p style='color: #00ff88; font-size: 0.9rem; font-family: monospace;'>"
            "🎯 AUDIT REQUEST</p>",
            unsafe_allow_html=True,
        )

        user_request = st.text_area(
            "审计指令（可选）",
            placeholder="如: 重点检查 ML 模型是否存在数据泄露、WGCNA soft power 选择是否合理",
            height=100,
            key="audit_request",
        )
        result["user_request"] = user_request

        # ------ 启动审计按钮 ------
        has_files = bool(
            st.session_state.get("cached_scripts", [])
            or st.session_state.get("cached_data", [])
            or st.session_state.get("cached_images", [])
            or result["uploaded_scripts"]
            or result["uploaded_data"]
            or result["uploaded_images"]
        )

        if st.button(
            "🐍 启动 Viper 审计",
            type="primary",
            use_container_width=True,
            disabled=not has_files,
            key="start_audit",
        ):
            result["trigger_audit"] = True

        st.markdown("<hr style='border-color: #1a3a2a;'>", unsafe_allow_html=True)

        # ------ 设置 ------
        with st.expander("⚙️ 设置"):
            st.text_input(
                "LLM Model",
                value=Settings.DEFAULT_MODEL,
                key="settings_model",
                help="gemini-2.0-flash / gemini-2.0-pro / gpt-4o",
            )
            st.number_input(
                "LLM Temperature",
                value=Settings.LLM_TEMPERATURE,
                min_value=0.0,
                max_value=1.0,
                step=0.1,
                key="settings_temp",
            )
            if st.button("💾 保存设置"):
                Settings.DEFAULT_MODEL = st.session_state.get(
                    "settings_model", Settings.DEFAULT_MODEL
                )
                Settings.LLM_TEMPERATURE = st.session_state.get(
                    "settings_temp", Settings.LLM_TEMPERATURE
                )
                result["settings_changed"] = True
                st.success("✅ 设置已保存")

        # ------ 底部版本信息 ------
        st.markdown(
            """
            <div style='position: fixed; bottom: 1rem; left: 1rem;
                color: #2a5a3a; font-size: 0.7rem; font-family: monospace;'>
                VIPER v2.0 // AUDIT MODE<br>
                Powered by LangGraph + Gemini
            </div>
            """,
            unsafe_allow_html=True,
        )

    return result


def _process_uploaded_files(
    uploaded_files: list, result: dict[str, Any]
) -> dict[str, Any]:
    """处理拖拽上传的文件，分类为脚本/数据/图表。"""
    parser = DataParser()
    tmp_dir = Path("./tmp_uploads")
    tmp_dir.mkdir(exist_ok=True)

    for f in uploaded_files:
        ext = Path(f.name).suffix.lower()
        tmp_path = tmp_dir / f.name

        # 写入临时文件
        with open(tmp_path, "wb") as fp:
            fp.write(f.getbuffer())

        if ext in SCRIPT_EXTENSIONS:
            # 脚本文件 — 读取内容
            try:
                content = tmp_path.read_text(encoding="utf-8", errors="replace")
                lang = "r" if ext in (".r", ".rmd") else "python"
                result["uploaded_scripts"].append({
                    "filename": f.name,
                    "path": str(tmp_path),
                    "extension": ext,
                    "content": content,
                    "language": lang,
                })
            except Exception as e:
                st.error(f"读取 {f.name} 失败: {e}")

        elif ext in DATA_EXTENSIONS:
            # 数据文件 — 解析
            try:
                info = parser.parse_file(tmp_path)
                result["uploaded_data"].append(info)
            except Exception as e:
                st.error(f"解析 {f.name} 失败: {e}")

        elif ext in IMAGE_EXTENSIONS:
            # 图表文件
            result["uploaded_images"].append({
                "filename": f.name,
                "path": str(tmp_path),
                "description": "",
            })

    return result


def _process_file_path(file_path: str, result: dict[str, Any]) -> dict[str, Any]:
    """处理通过路径加载的文件。"""
    try:
        p = safe_path(file_path)
        if not p.exists():
            st.error(f"文件不存在: {p}")
            return result

        ext = p.suffix.lower()
        if ext in SCRIPT_EXTENSIONS:
            content = p.read_text(encoding="utf-8", errors="replace")
            lang = "r" if ext in (".r", ".rmd") else "python"
            result["uploaded_scripts"].append({
                "filename": p.name,
                "path": str(p),
                "extension": ext,
                "content": content,
                "language": lang,
            })
            st.success(f"✅ 已加载脚本: {p.name}")

        elif ext in DATA_EXTENSIONS:
            parser = DataParser()
            info = parser.parse_file(p, n_rows=100 if is_large_file(p) else None)
            result["uploaded_data"].append(info)
            st.success(f"✅ 已加载数据: {p.name}")

        elif ext in IMAGE_EXTENSIONS:
            result["uploaded_images"].append({
                "filename": p.name,
                "path": str(p),
                "description": "",
            })
            st.success(f"✅ 已加载图表: {p.name}")

        else:
            st.warning(f"不支持的文件格式: {ext}")

    except Exception as e:
        st.error(f"加载失败: {e}")

    return result


def _render_file_tree(result: dict[str, Any]) -> None:
    """渲染已加载的文件树。"""
    scripts = (
        st.session_state.get("cached_scripts", []) + result["uploaded_scripts"]
    )
    data_files = (
        st.session_state.get("cached_data", []) + result["uploaded_data"]
    )
    images = (
        st.session_state.get("cached_images", []) + result["uploaded_images"]
    )

    if not scripts and not data_files and not images:
        st.markdown(
            "<p style='color: #555; font-size: 0.8rem; text-align: center;'>"
            "📭 暂无文件<br>拖拽 .py / .R / .csv / .png 到上方区域</p>",
            unsafe_allow_html=True,
        )
        return

    # 脚本
    if scripts:
        st.markdown(
            "<span style='color: #00ccff; font-size: 0.8rem;'>📜 脚本</span>",
            unsafe_allow_html=True,
        )
        for s in scripts:
            lang_icon = "🐍" if s.get("language") == "python" else "📊"
            st.markdown(
                f"<span style='color: #aaa; font-size: 0.78rem;'>"
                f"  {lang_icon} {s['filename']}</span>",
                unsafe_allow_html=True,
            )

    # 数据
    if data_files:
        st.markdown(
            "<span style='color: #ff9900; font-size: 0.8rem;'>📊 数据</span>",
            unsafe_allow_html=True,
        )
        for d in data_files:
            shape = d.get("shape", "?")
            st.markdown(
                f"<span style='color: #aaa; font-size: 0.78rem;'>"
                f"  📄 {d.get('filename', '?')} ({shape})</span>",
                unsafe_allow_html=True,
            )

    # 图表
    if images:
        st.markdown(
            "<span style='color: #ff44aa; font-size: 0.8rem;'>🖼️ 图表</span>",
            unsafe_allow_html=True,
        )
        for img in images:
            st.markdown(
                f"<span style='color: #aaa; font-size: 0.78rem;'>"
                f"  🎨 {img.get('filename', '?')}</span>",
                unsafe_allow_html=True,
            )
