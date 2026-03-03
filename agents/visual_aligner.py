"""
visual_aligner.py — VisualAligner Agent（多模态视觉对齐节点）
视觉校验：图表 vs 代码参数一致性检查，报错截图穿透。
"""

from __future__ import annotations

import base64
import re
from pathlib import Path
from typing import Any

from agents.state import WorkflowStage, FindingSeverity
from config.prompts import VISUAL_ALIGNER_PROMPT
from config.settings import Settings
from utils.llm_factory import build_vision_llm
from utils.logger import get_logger

logger = get_logger(__name__)


def _encode_image_base64(image_path: str) -> str | None:
    """将图片编码为 base64 字符串。"""
    try:
        p = Path(image_path)
        if not p.exists():
            return None
        data = p.read_bytes()
        return base64.b64encode(data).decode("utf-8")
    except Exception as e:
        logger.error(f"图片编码失败: {image_path} — {e}")
        return None


def _get_image_mime(path: str) -> str:
    """获取图片 MIME 类型。"""
    ext = Path(path).suffix.lower()
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
    }.get(ext, "image/png")


def visual_aligner_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    VisualAligner 节点：
    1. 将图表截图与代码参数交叉验证
    2. 识别终端报错截图并定位代码行
    3. 评估图表质量（期刊投稿标准）
    """
    logger.info("👁️ VisualAligner 节点启动")

    images = state.get("uploaded_images", [])
    scripts = state.get("uploaded_scripts", [])
    audit_raw = state.get("audit_raw_output", "")

    if not images:
        logger.info("无图表上传，跳过视觉对齐")
        return {
            **state,
            "stage": WorkflowStage.REPORTING.value,
            "visual_raw_output": "🔍 未检测到图表文件，跳过视觉审计。",
            "messages": state.get("messages", []) + [
                {"role": "visual_aligner", "content": "🔍 未检测到图表文件，跳过视觉审计。"}
            ],
        }

    # 构建上下文
    context_parts = [
        "## 视觉审计任务",
        f"共上传 {len(images)} 张图表，请逐一进行视觉校验。",
    ]

    # 关联代码
    if scripts:
        context_parts.append("## 关联代码")
        for s in scripts:
            context_parts.append(
                f"### {s.get('filename', '?')}\n"
                f"```{s.get('language', 'python')}\n"
                f"{s.get('content', '')[:5000]}\n```"
            )

    # 审计发现摘要（供视觉对齐参考）
    if audit_raw:
        context_parts.append(
            f"## 代码审计发现摘要\n{audit_raw[:3000]}"
        )

    # 图表信息
    context_parts.append("## 上传的图表")
    for img in images:
        context_parts.append(
            f"### {img.get('filename', '?')}\n"
            f"- 路径: {img.get('path', '')}\n"
            f"- 用户描述: {img.get('description', '无描述')}"
        )

    context = "\n\n".join(context_parts)

    try:
        llm = build_vision_llm()
        from langchain_core.messages import HumanMessage, SystemMessage

        # 构建消息（尝试包含图片）
        content_blocks: list[Any] = [{"type": "text", "text": context}]

        for img in images:
            img_path = img.get("path", "")
            if img_path:
                b64 = _encode_image_base64(img_path)
                if b64:
                    mime = _get_image_mime(img_path)
                    content_blocks.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime};base64,{b64}",
                        },
                    })

        messages = [
            SystemMessage(content=VISUAL_ALIGNER_PROMPT),
            HumanMessage(content=content_blocks),
        ]

        response = llm.invoke(messages)
        visual_output = response.content

        logger.info(f"VisualAligner 输出长度: {len(visual_output)} 字符")

        # 解析视觉审计发现
        visual_findings = _parse_visual_findings(visual_output)

        return {
            **state,
            "stage": WorkflowStage.REPORTING.value,
            "visual_findings": visual_findings,
            "visual_raw_output": visual_output,
            "messages": state.get("messages", []) + [
                {"role": "visual_aligner", "content": visual_output}
            ],
        }

    except Exception as e:
        logger.error(f"VisualAligner 节点异常: {e}", exc_info=True)
        # 视觉对齐失败不阻塞工作流，继续到报告阶段
        return {
            **state,
            "stage": WorkflowStage.REPORTING.value,
            "visual_raw_output": f"⚠️ 视觉审计异常: {e}",
            "messages": state.get("messages", []) + [
                {"role": "visual_aligner", "content": f"⚠️ 视觉审计异常: {e}"}
            ],
        }


def _parse_visual_findings(text: str) -> list[dict[str, Any]]:
    """解析视觉审计输出中的发现。"""
    findings: list[dict[str, Any]] = []

    pattern = re.compile(
        r"(🔴\s*\[Critical\]|✂️\s*\[Refactor\]|🔍\s*\[Interpret\])\s*(.+?)(?=(?:🔴\s*\[Critical\]|✂️\s*\[Refactor\]|🔍\s*\[Interpret\])|$)",
        re.DOTALL,
    )

    for match in pattern.finditer(text):
        tag = match.group(1).strip()
        body = match.group(2).strip()

        if "Critical" in tag:
            severity = FindingSeverity.CRITICAL.value
        elif "Refactor" in tag:
            severity = FindingSeverity.REFACTOR.value
        else:
            severity = FindingSeverity.INTERPRET.value

        lines = body.split("\n")
        title = lines[0].strip() if lines else "视觉发现"

        findings.append({
            "severity": severity,
            "title": title,
            "description": body,
            "file": "",
            "line_range": "",
            "suggestion": "",
            "code_snippet": "",
        })

    if not findings and "跳过" not in text:
        findings.append({
            "severity": FindingSeverity.INTERPRET.value,
            "title": "视觉审计摘要",
            "description": text,
            "file": "",
            "line_range": "",
            "suggestion": "",
            "code_snippet": "",
        })

    return findings
