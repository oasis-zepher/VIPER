"""
dashboard.py — 中央多模态看板
上方：图表截图预览
下方：代码高亮区（待审计代码）
"""

from __future__ import annotations

import streamlit as st
from pathlib import Path
from typing import Any


def render_dashboard(state: dict[str, Any]) -> None:
    """
    渲染中央看板：
    - 上半部分：图表截图预览
    - 下半部分：代码高亮区
    """
    images = state.get("uploaded_images", [])
    scripts = state.get("uploaded_scripts", [])

    # ------ 图表预览区 ------
    if images:
        st.markdown(
            "<h4 style='color: #00ccff; font-family: monospace;'>"
            "🖼️ CHART PREVIEW</h4>",
            unsafe_allow_html=True,
        )

        # 使用列布局展示图表
        n_cols = min(3, len(images))
        cols = st.columns(n_cols)
        for i, img in enumerate(images):
            with cols[i % n_cols]:
                img_path = img.get("path", "")
                if img_path and Path(img_path).exists():
                    ext = Path(img_path).suffix.lower()
                    if ext == ".svg":
                        svg_content = Path(img_path).read_text(encoding="utf-8")
                        st.markdown(svg_content, unsafe_allow_html=True)
                    else:
                        st.image(
                            img_path,
                            caption=img.get("filename", ""),
                            use_container_width=True,
                        )

                    # 图表描述输入
                    desc = st.text_input(
                        "图表描述",
                        value=img.get("description", ""),
                        key=f"img_desc_{i}",
                        placeholder="如: PCA 图, p值阈值=0.05",
                    )
                    img["description"] = desc

        st.markdown("<hr style='border-color: #1a3a2a;'>", unsafe_allow_html=True)

    # ------ 代码高亮区 ------
    if scripts:
        st.markdown(
            "<h4 style='color: #00ff88; font-family: monospace;'>"
            "💻 CODE INSPECTOR</h4>",
            unsafe_allow_html=True,
        )

        # 文件选择器
        file_names = [s.get("filename", f"file_{i}") for i, s in enumerate(scripts)]
        selected_idx = st.selectbox(
            "选择文件",
            range(len(file_names)),
            format_func=lambda i: file_names[i],
            key="code_file_selector",
        )

        if selected_idx is not None and selected_idx < len(scripts):
            script = scripts[selected_idx]
            code = script.get("content", "")
            lang = script.get("language", "python")

            # 文件信息
            st.markdown(
                f"<span style='color: #888; font-size: 0.8rem;'>"
                f"📁 {script.get('filename', '')} | "
                f"{lang.upper()} | "
                f"{len(code.splitlines())} 行 | "
                f"{len(code)} 字符</span>",
                unsafe_allow_html=True,
            )

            # 代码展示
            st.code(code, language=lang, line_numbers=True)

    # ------ 空状态提示 ------
    if not images and not scripts:
        st.markdown(
            """
            <div style='text-align: center; padding: 3rem; color: #555;'>
                <p style='font-size: 3rem;'>🐍</p>
                <p style='font-family: monospace; color: #00ff88;'>
                    VIPER AUDIT DASHBOARD
                </p>
                <p style='color: #666; font-size: 0.9rem;'>
                    ← 从左侧上传脚本 / 数据 / 图表开始审计
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )


def render_audit_progress(stage: str) -> None:
    """渲染审计进度条。"""
    stages = {
        "idle": ("⚪", "等待文件", 0),
        "ingesting": ("📥", "解析文件...", 25),
        "auditing": ("🔬", "深度审计...", 50),
        "visual_check": ("👁️", "视觉对齐...", 75),
        "reporting": ("📋", "生成报告...", 90),
        "completed": ("✅", "审计完成", 100),
        "error": ("❌", "出错", 0),
    }

    info = stages.get(stage, ("❓", stage, 0))
    icon, label, progress = info

    col1, col2 = st.columns([1, 4])
    with col1:
        st.markdown(
            f"<span style='font-size: 1.5rem;'>{icon}</span>",
            unsafe_allow_html=True,
        )
    with col2:
        st.progress(progress / 100, text=f"{label}")
