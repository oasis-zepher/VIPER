"""
ingester.py — Ingester Agent（文件解析与上下文构建节点）
解析上传的脚本 / 数据 / 图表，为后续审计提供结构化上下文。
"""

from __future__ import annotations

from typing import Any

from agents.state import WorkflowStage
from config.prompts import INGESTER_PROMPT
from config.settings import Settings
from utils.logger import get_logger

logger = get_logger(__name__)


def _build_llm():
    """根据配置构建 LLM 实例。"""
    provider = Settings.get_llm_provider()
    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=Settings.DEFAULT_MODEL,
            google_api_key=Settings.GOOGLE_API_KEY,
            temperature=Settings.LLM_TEMPERATURE,
            max_output_tokens=Settings.LLM_MAX_TOKENS,
        )
    else:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=Settings.DEFAULT_MODEL,
            api_key=Settings.OPENAI_API_KEY,
            temperature=Settings.LLM_TEMPERATURE,
            max_tokens=Settings.LLM_MAX_TOKENS,
        )


def ingester_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    Ingester 节点：解析用户上传的脚本、数据和图表，
    构建结构化上下文摘要，检测工作流类型。
    """
    logger.info("📥 Ingester 节点启动")

    user_request = state.get("user_request", "")
    scripts = state.get("uploaded_scripts", [])
    data_files = state.get("uploaded_data", [])
    images = state.get("uploaded_images", [])

    # 构建上下文
    context_parts = []

    if user_request:
        context_parts.append(f"## 用户审计需求\n{user_request}")

    # 脚本内容
    if scripts:
        context_parts.append("## 待审计脚本")
        for s in scripts:
            filename = s.get("filename", "unknown")
            content = s.get("content", "")
            lang = s.get("language", "python")
            context_parts.append(
                f"### {filename} ({lang})\n"
                f"```{lang}\n{content}\n```"
            )

    # 数据文件摘要
    if data_files:
        context_parts.append("## 关联数据文件")
        for d in data_files:
            context_parts.append(
                f"### {d.get('filename', '?')}\n"
                f"- 格式: {d.get('extension', '?')}\n"
                f"- Shape: {d.get('shape', '?')}\n"
                f"- 列名: {d.get('columns', [])}\n"
                f"- 是否表达矩阵: {d.get('is_expression_matrix', '?')}\n"
                f"- Log2 转化: {d.get('is_log2_transformed', '?')}\n"
                f"- 数据摘要:\n{d.get('data_report', '')}"
            )

    # 图表描述
    if images:
        context_parts.append("## 上传的图表")
        for img in images:
            context_parts.append(
                f"### {img.get('filename', '?')}\n"
                f"- 描述: {img.get('description', '用户上传的生信图表')}"
            )

    if not scripts and not data_files and not images:
        return {
            **state,
            "stage": WorkflowStage.ERROR.value,
            "error_message": "未上传任何文件，请先上传脚本（.R, .py）或数据（.csv）进行审计。",
        }

    context = "\n\n".join(context_parts)

    try:
        llm = _build_llm()
        from langchain_core.messages import HumanMessage, SystemMessage

        messages = [
            SystemMessage(content=INGESTER_PROMPT),
            HumanMessage(content=context),
        ]

        response = llm.invoke(messages)
        ingester_output = response.content

        logger.info(f"Ingester 输出长度: {len(ingester_output)} 字符")

        # 简单检测工作流类型
        detected_workflow = _detect_workflow(scripts, ingester_output)

        return {
            **state,
            "stage": WorkflowStage.AUDITING.value,
            "code_summary": ingester_output,
            "detected_workflow": detected_workflow,
            "messages": state.get("messages", []) + [
                {"role": "ingester", "content": ingester_output}
            ],
        }

    except Exception as e:
        logger.error(f"Ingester 节点异常: {e}", exc_info=True)
        return {
            **state,
            "stage": WorkflowStage.ERROR.value,
            "error_message": f"Ingester 节点异常: {e}",
        }


def _detect_workflow(scripts: list[dict], llm_output: str) -> str:
    """基于代码内容和 LLM 输出检测分析工作流类型。"""
    all_content = llm_output.lower()
    for s in scripts:
        all_content += " " + s.get("content", "").lower()

    workflows = []
    if "wgcna" in all_content or "pickSoftThreshold" in all_content.lower():
        workflows.append("WGCNA")
    if any(kw in all_content for kw in ["randomforest", "random_forest", "svm", "xgboost", "lasso", "sklearn", "scikit"]):
        workflows.append("Machine Learning")
    if any(kw in all_content for kw in ["deseq2", "limma", "edger", "差异表达", "differential"]):
        workflows.append("Differential Expression")
    if any(kw in all_content for kw in ["蛋白组", "proteo", "vsn", "normalization"]):
        workflows.append("Proteomics")
    if any(kw in all_content for kw in ["pca", "tsne", "umap"]):
        workflows.append("Dimensionality Reduction")

    return " + ".join(workflows) if workflows else "General Bioinformatics"
