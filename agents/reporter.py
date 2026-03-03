"""
reporter.py — Reporter Agent（审计报告生成节点）
汇总所有审计发现，生成结构化的最终审计报告。
"""

from __future__ import annotations

from typing import Any

from agents.state import WorkflowStage, FindingSeverity
from config.prompts import REPORTER_PROMPT
from config.settings import Settings
from utils.llm_factory import build_llm
from utils.logger import get_logger

logger = get_logger(__name__)


def reporter_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    Reporter 节点：汇总 Ingester + Auditor + VisualAligner 的所有发现，
    生成结构化审计报告 + 重构清单。
    """
    logger.info("📋 Reporter 节点启动")

    code_summary = state.get("code_summary", "")
    detected_workflow = state.get("detected_workflow", "")
    audit_findings = state.get("audit_findings", [])
    visual_findings = state.get("visual_findings", [])
    audit_raw = state.get("audit_raw_output", "")
    visual_raw = state.get("visual_raw_output", "")
    scripts = state.get("uploaded_scripts", [])

    all_findings = audit_findings + visual_findings

    # 统计
    critical_count = sum(1 for f in all_findings if f.get("severity") == "critical")
    refactor_count = sum(1 for f in all_findings if f.get("severity") == "refactor")
    interpret_count = sum(1 for f in all_findings if f.get("severity") == "interpret")
    total_files = len(scripts)

    # 构建上下文
    context_parts = [
        "## 审计元数据",
        f"- 审计文件数: {total_files}",
        f"- 检测到的工作流: {detected_workflow}",
        f"- Critical 发现数: {critical_count}",
        f"- Refactor 发现数: {refactor_count}",
        f"- Interpret 发现数: {interpret_count}",
        "",
        f"## 代码结构摘要\n{code_summary[:2000]}",
        "",
        f"## 代码审计原始输出\n{audit_raw}",
    ]

    if visual_raw:
        context_parts.append(f"\n## 视觉审计原始输出\n{visual_raw}")

    context_parts.append("\n## 结构化审计发现列表")
    for i, f in enumerate(all_findings):
        severity_icon = {
            "critical": "🔴",
            "refactor": "✂️",
            "interpret": "🔍",
        }.get(f.get("severity", ""), "❓")

        context_parts.append(
            f"\n### {severity_icon} 发现 #{i+1}: {f.get('title', '?')}\n"
            f"- 严重性: {f.get('severity', '?')}\n"
            f"- 文件: {f.get('file', '?')}\n"
            f"- 行号: {f.get('line_range', '?')}\n"
            f"- 描述: {f.get('description', '')[:500]}\n"
            f"- 建议: {f.get('suggestion', '')[:500]}"
        )

    context_parts.append(
        "\n请基于以上所有信息，生成结构化的最终审计报告。"
        "报告必须包含审计评分（A/B/C/D/F）和一键重构清单。"
    )

    context = "\n".join(context_parts)

    try:
        llm = build_llm()
        from langchain_core.messages import HumanMessage, SystemMessage

        messages = [
            SystemMessage(content=REPORTER_PROMPT),
            HumanMessage(content=context),
        ]

        response = llm.invoke(messages)
        report_output = response.content

        logger.info(f"Reporter 生成报告: {len(report_output)} 字符")

        # 提取重构清单
        refactor_checklist = _extract_refactor_checklist(report_output, all_findings)

        return {
            **state,
            "stage": WorkflowStage.COMPLETED.value,
            "audit_report": report_output,
            "refactor_checklist": refactor_checklist,
            "messages": state.get("messages", []) + [
                {"role": "reporter", "content": report_output}
            ],
        }

    except Exception as e:
        logger.error(f"Reporter 节点异常: {e}", exc_info=True)
        # 即使报告生成失败，也输出原始发现
        fallback_report = _generate_fallback_report(
            all_findings, total_files, detected_workflow,
            critical_count, refactor_count, interpret_count,
        )
        return {
            **state,
            "stage": WorkflowStage.COMPLETED.value,
            "audit_report": fallback_report,
            "error_message": f"Reporter LLM 异常（已使用降级报告）: {e}",
            "messages": state.get("messages", []) + [
                {"role": "reporter", "content": fallback_report}
            ],
        }


def _extract_refactor_checklist(
    report: str, findings: list[dict[str, Any]]
) -> list[str]:
    """从报告和发现中提取重构清单。"""
    checklist: list[str] = []

    for f in findings:
        if f.get("severity") == "refactor":
            title = f.get("title", "")
            suggestion = f.get("suggestion", "")
            file_name = f.get("file", "")
            item = f"[{file_name}] {title}"
            if suggestion:
                item += f" → {suggestion[:100]}"
            checklist.append(item)

    return checklist


def _generate_fallback_report(
    findings: list[dict],
    total_files: int,
    workflow: str,
    critical: int,
    refactor: int,
    interpret: int,
) -> str:
    """当 LLM 报告生成失败时，基于结构化数据生成降级报告。"""
    # 评分逻辑
    has_leakage = any(
        "泄露" in f.get("description", "") or "leakage" in f.get("description", "").lower()
        for f in findings
    )
    if has_leakage:
        grade = "F"
    elif critical > 5:
        grade = "D"
    elif critical > 2:
        grade = "C"
    elif critical > 0:
        grade = "B"
    else:
        grade = "A"

    report = f"""# 🐍 Viper 审计报告 (降级模式)

## 📊 审计概览
- 审计文件数: {total_files}
- 检测到的工作流: {workflow}
- 🔴 致命问题: {critical} 项
- ✂️ 重构建议: {refactor} 项
- 🔍 科学解读: {interpret} 项
- **审计评分: {grade}**

---
"""
    severity_order = ["critical", "refactor", "interpret"]
    section_titles = {
        "critical": "## 🔴 致命问题 (Critical)",
        "refactor": "## ✂️ 冗余清理 (Refactor)",
        "interpret": "## 🔍 科学解读 (Interpret)",
    }

    for sev in severity_order:
        group = [f for f in findings if f.get("severity") == sev]
        if group:
            report += f"\n{section_titles[sev]}\n\n"
            for i, f in enumerate(group, 1):
                report += f"### {i}. {f.get('title', '?')}\n"
                if f.get("file"):
                    report += f"📁 文件: {f['file']}"
                    if f.get("line_range"):
                        report += f" | 行: {f['line_range']}"
                    report += "\n"
                report += f"\n{f.get('description', '')}\n\n"
                if f.get("suggestion"):
                    report += f"💡 建议: {f['suggestion']}\n\n"

    report += f"\n---\n\n## ✅ 审计总结\n审计评分: **{grade}**\n"
    return report
