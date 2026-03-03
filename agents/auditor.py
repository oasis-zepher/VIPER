"""
auditor.py — Auditor Agent（生信深度审计节点）
对代码进行严苛的领域特异性审查：统计方法、数据泄露、环境兼容性、冗余检测。
"""

from __future__ import annotations

import re
from typing import Any

from agents.state import WorkflowStage, FindingSeverity
from config.prompts import AUDITOR_PROMPT
from config.settings import Settings
from utils.llm_factory import build_llm
from utils.logger import get_logger

logger = get_logger(__name__)


def auditor_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    Auditor 节点：对代码进行深度生信审计。
    涵盖统计方法、WGCNA、ML、蛋白组学、环境兼容性、冗余检测。
    """
    logger.info("🔬 Auditor 节点启动")

    scripts = state.get("uploaded_scripts", [])
    code_summary = state.get("code_summary", "")
    detected_workflow = state.get("detected_workflow", "")
    data_files = state.get("uploaded_data", [])

    # 构建审计上下文
    context_parts = [
        f"## 检测到的工作流类型\n{detected_workflow}",
        f"## 代码结构摘要\n{code_summary}",
    ]

    # 完整代码（审计核心输入）
    if scripts:
        context_parts.append("## 完整代码内容（逐文件审计）")
        for s in scripts:
            filename = s.get("filename", "unknown")
            content = s.get("content", "")
            lang = s.get("language", "python")
            context_parts.append(
                f"### 📁 {filename}\n```{lang}\n{content}\n```"
            )

    # 数据上下文
    if data_files:
        context_parts.append("## 关联数据概况")
        for d in data_files:
            context_parts.append(
                f"- {d.get('filename', '?')}: Shape={d.get('shape', '?')}, "
                f"Log2={d.get('is_log2_transformed', '?')}"
            )

    # 针对检测到的工作流添加特定审查要求
    if "WGCNA" in detected_workflow:
        context_parts.append(
            "\n⚠️ **WGCNA 专项审查**：重点检查 soft power 选择、signed/unsigned 网络类型、"
            "module eigengene 计算、模块与性状关联方法。"
        )
    if "Machine Learning" in detected_workflow:
        context_parts.append(
            "\n⚠️ **ML 防泄露审查**：重点检查特征选择是否在 CV 内部、"
            "标准化是否在 split 之后、是否存在 target leakage、评估指标来源。"
        )
    if "Proteomics" in detected_workflow:
        context_parts.append(
            "\n⚠️ **蛋白组学审查**：重点检查标准化顺序（VSN/quantile）、"
            "低质量样本移除、批次效应校正（ComBat）、缺失值填补策略。"
        )

    context = "\n\n".join(context_parts)

    try:
        llm = build_llm()
        from langchain_core.messages import HumanMessage, SystemMessage

        messages = [
            SystemMessage(content=AUDITOR_PROMPT),
            HumanMessage(content=context),
        ]

        response = llm.invoke(messages)
        audit_output = response.content

        logger.info(f"Auditor 输出长度: {len(audit_output)} 字符")

        # 解析审计发现
        findings = _parse_findings(audit_output)

        # 确定下一阶段：有图表 → VisualCheck，无图表 → Reporting
        has_images = bool(state.get("uploaded_images", []))
        next_stage = (
            WorkflowStage.VISUAL_CHECK.value
            if has_images
            else WorkflowStage.REPORTING.value
        )

        return {
            **state,
            "stage": next_stage,
            "audit_findings": findings,
            "audit_raw_output": audit_output,
            "messages": state.get("messages", []) + [
                {"role": "auditor", "content": audit_output}
            ],
        }

    except Exception as e:
        logger.error(f"Auditor 节点异常: {e}", exc_info=True)
        return {
            **state,
            "stage": WorkflowStage.ERROR.value,
            "error_message": f"Auditor 节点异常: {e}",
        }


def _parse_findings(text: str) -> list[dict[str, Any]]:
    """
    从 Auditor LLM 输出中解析结构化审计发现。
    匹配 🔴 [Critical] / ✂️ [Refactor] / 🔍 [Interpret] 格式。
    """
    findings: list[dict[str, Any]] = []

    # 按标记分割
    pattern = re.compile(
        r"(🔴\s*\[Critical\]|✂️\s*\[Refactor\]|🔍\s*\[Interpret\])\s*(.+?)(?=(?:🔴\s*\[Critical\]|✂️\s*\[Refactor\]|🔍\s*\[Interpret\])|$)",
        re.DOTALL,
    )

    for match in pattern.finditer(text):
        tag = match.group(1).strip()
        body = match.group(2).strip()

        # 确定严重性
        if "Critical" in tag:
            severity = FindingSeverity.CRITICAL.value
        elif "Refactor" in tag:
            severity = FindingSeverity.REFACTOR.value
        else:
            severity = FindingSeverity.INTERPRET.value

        # 提取标题（第一行）
        lines = body.split("\n")
        title = lines[0].strip() if lines else "未命名发现"

        # 提取文件和行号
        file_match = re.search(r"文件[:\s]*(\S+)", body)
        line_match = re.search(r"行[:\s]*(L?\d+[-–]?L?\d*)", body)
        file_name = file_match.group(1) if file_match else ""
        line_range = line_match.group(1) if line_match else ""

        # 提取描述和建议
        desc_match = re.search(r"描述[:\s]*(.+?)(?=💡|$)", body, re.DOTALL)
        suggest_match = re.search(r"建议[:\s]*(.+?)(?=```|🔴|✂️|🔍|$)", body, re.DOTALL)
        desc = desc_match.group(1).strip() if desc_match else body
        suggestion = suggest_match.group(1).strip() if suggest_match else ""

        # 提取代码片段
        code_match = re.search(r"```\w*\n(.*?)```", body, re.DOTALL)
        code_snippet = code_match.group(1).strip() if code_match else ""

        findings.append({
            "severity": severity,
            "title": title,
            "description": desc,
            "file": file_name,
            "line_range": line_range,
            "suggestion": suggestion,
            "code_snippet": code_snippet,
        })

    # 如果正则未匹配到任何发现，将全文作为一条 interpret
    if not findings:
        findings.append({
            "severity": FindingSeverity.INTERPRET.value,
            "title": "审计摘要",
            "description": text,
            "file": "",
            "line_range": "",
            "suggestion": "",
            "code_snippet": "",
        })

    return findings
