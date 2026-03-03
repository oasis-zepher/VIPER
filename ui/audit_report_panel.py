"""
audit_report_panel.py — 右侧审计报告面板
分类显示：🔴 致命错误 | ✂️ 冗余清理 | 🔍 科学解读
赛博极客风格深色主题。
"""

from __future__ import annotations

import streamlit as st
from typing import Any


def render_audit_report(state: dict[str, Any]) -> None:
    """
    渲染右侧审计报告面板。
    分三个类别展示审计发现，并提供一键重构清单。
    """
    audit_report = state.get("audit_report", "")
    audit_findings = state.get("audit_findings", [])
    visual_findings = state.get("visual_findings", [])
    refactor_checklist = state.get("refactor_checklist", [])
    stage = state.get("stage", "idle")

    # 标题
    st.markdown(
        "<h4 style='color: #ff4444; font-family: monospace;'>"
        "🐍 VIPER AUDIT REPORT</h4>",
        unsafe_allow_html=True,
    )

    if stage != "completed" and not audit_findings:
        st.markdown(
            """
            <div style='text-align: center; padding: 2rem; color: #555;'>
                <p style='font-size: 2rem;'>📋</p>
                <p style='font-family: monospace; color: #444; font-size: 0.85rem;'>
                    审计报告将在这里显示<br>
                    上传文件并启动审计后生成
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )
        return

    all_findings = audit_findings + visual_findings

    # ------ 统计摘要 ------
    critical = [f for f in all_findings if f.get("severity") == "critical"]
    refactor = [f for f in all_findings if f.get("severity") == "refactor"]
    interpret = [f for f in all_findings if f.get("severity") == "interpret"]

    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown(
            f"""
            <div style='background: rgba(255,0,0,0.1); border: 1px solid #ff4444;
                border-radius: 8px; padding: 0.8rem; text-align: center;'>
                <span style='font-size: 1.5rem;'>🔴</span><br>
                <span style='color: #ff4444; font-size: 1.8rem; font-weight: bold;'>
                    {len(critical)}
                </span><br>
                <span style='color: #ff6666; font-size: 0.75rem;'>CRITICAL</span>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with col2:
        st.markdown(
            f"""
            <div style='background: rgba(255,165,0,0.1); border: 1px solid #ff9900;
                border-radius: 8px; padding: 0.8rem; text-align: center;'>
                <span style='font-size: 1.5rem;'>✂️</span><br>
                <span style='color: #ff9900; font-size: 1.8rem; font-weight: bold;'>
                    {len(refactor)}
                </span><br>
                <span style='color: #ffaa33; font-size: 0.75rem;'>REFACTOR</span>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with col3:
        st.markdown(
            f"""
            <div style='background: rgba(0,200,255,0.1); border: 1px solid #00ccff;
                border-radius: 8px; padding: 0.8rem; text-align: center;'>
                <span style='font-size: 1.5rem;'>🔍</span><br>
                <span style='color: #00ccff; font-size: 1.8rem; font-weight: bold;'>
                    {len(interpret)}
                </span><br>
                <span style='color: #33ddff; font-size: 0.75rem;'>INTERPRET</span>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown("<hr style='border-color: #1a3a2a;'>", unsafe_allow_html=True)

    # ------ 分类展示审计发现 ------

    # 🔴 Critical
    if critical:
        with st.expander(f"🔴 致命问题 ({len(critical)})", expanded=True):
            for i, f in enumerate(critical):
                _render_finding_card(f, i, "critical")

    # ✂️ Refactor
    if refactor:
        with st.expander(f"✂️ 冗余清理 ({len(refactor)})", expanded=True):
            for i, f in enumerate(refactor):
                _render_finding_card(f, i, "refactor")

    # 🔍 Interpret
    if interpret:
        with st.expander(f"🔍 科学解读 ({len(interpret)})", expanded=True):
            for i, f in enumerate(interpret):
                _render_finding_card(f, i, "interpret")

    # ------ 一键重构清单 ------
    if refactor_checklist:
        st.markdown("<hr style='border-color: #1a3a2a;'>", unsafe_allow_html=True)
        st.markdown(
            "<h5 style='color: #ff9900; font-family: monospace;'>"
            "✂️ 一键瘦身清单</h5>",
            unsafe_allow_html=True,
        )
        for item in refactor_checklist:
            st.markdown(f"- {item}")

    # ------ 完整报告下载 ------
    if audit_report:
        st.markdown("<hr style='border-color: #1a3a2a;'>", unsafe_allow_html=True)

        with st.expander("📄 查看完整审计报告", expanded=False):
            st.markdown(audit_report)

        st.download_button(
            "📥 下载审计报告 (.md)",
            data=audit_report,
            file_name="viper_audit_report.md",
            mime="text/markdown",
            use_container_width=True,
        )


def _render_finding_card(finding: dict[str, Any], index: int, severity: str) -> None:
    """渲染单条审计发现卡片。"""
    colors = {
        "critical": ("#ff4444", "rgba(255,0,0,0.05)"),
        "refactor": ("#ff9900", "rgba(255,165,0,0.05)"),
        "interpret": ("#00ccff", "rgba(0,200,255,0.05)"),
    }
    text_color, bg_color = colors.get(severity, ("#888", "rgba(128,128,128,0.05)"))

    title = finding.get("title", "未知问题")
    desc = finding.get("description", "")
    file_name = finding.get("file", "")
    line_range = finding.get("line_range", "")
    suggestion = finding.get("suggestion", "")
    code_snippet = finding.get("code_snippet", "")

    # 位置信息
    location = ""
    if file_name:
        location = f"📁 {file_name}"
        if line_range:
            location += f" | 行 {line_range}"

    st.markdown(
        f"""
        <div style='background: {bg_color}; border-left: 3px solid {text_color};
            padding: 0.8rem; margin: 0.5rem 0; border-radius: 4px;'>
            <p style='color: {text_color}; font-weight: bold; margin: 0 0 0.3rem 0;
                font-size: 0.9rem;'>
                {title}
            </p>
            {"<p style='color: #888; font-size: 0.75rem; margin: 0 0 0.3rem 0;'>" + location + "</p>" if location else ""}
            <p style='color: #ccc; font-size: 0.82rem; margin: 0;'>
                {desc[:500]}
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if suggestion:
        st.markdown(
            f"<p style='color: #aaa; font-size: 0.8rem; margin: 0.3rem 0;'>"
            f"💡 {suggestion[:300]}</p>",
            unsafe_allow_html=True,
        )

    if code_snippet:
        # 判断语言
        lang = "python"
        if file_name and any(file_name.lower().endswith(e) for e in (".r", ".rmd")):
            lang = "r"
        st.code(code_snippet[:1000], language=lang)
