"""
graph.py — Viper 审计工作流 LangGraph DAG 定义
构建 Ingester → Auditor → VisualAligner → Reporter 审计流水线。
"""

from __future__ import annotations

from typing import Any

from langgraph.graph import StateGraph, END

from agents.state import WorkflowStage
from agents.ingester import ingester_node
from agents.auditor import auditor_node
from agents.visual_aligner import visual_aligner_node
from agents.reporter import reporter_node
from utils.logger import get_logger

logger = get_logger(__name__)


def _route_after_ingester(state: dict[str, Any]) -> str:
    """Ingester 后路由：解析成功 → Auditor；失败 → 结束。"""
    stage = state.get("stage", "")
    if stage == WorkflowStage.ERROR.value:
        return "end"
    return "auditor"


def _route_after_auditor(state: dict[str, Any]) -> str:
    """Auditor 后路由：有图表 → VisualAligner；无图表 → Reporter。"""
    stage = state.get("stage", "")
    if stage == WorkflowStage.ERROR.value:
        return "end"
    if stage == WorkflowStage.VISUAL_CHECK.value:
        return "visual_aligner"
    return "reporter"


def _route_after_visual_aligner(state: dict[str, Any]) -> str:
    """VisualAligner 后路由：总是进入 Reporter。"""
    stage = state.get("stage", "")
    if stage == WorkflowStage.ERROR.value:
        return "end"
    return "reporter"


def _route_after_reporter(state: dict[str, Any]) -> str:
    """Reporter 后路由：总是结束。"""
    return "end"


def build_audit_graph():
    """
    构建 Viper 审计工作流图。

    流程:
      start → ingester → auditor → [visual_aligner | reporter]
      visual_aligner → reporter → end

    所有节点线性执行，无需用户交互中断。
    审计结果一次性生成并展示。
    """
    graph = StateGraph(dict)

    # 注册节点
    graph.add_node("ingester", ingester_node)
    graph.add_node("auditor", auditor_node)
    graph.add_node("visual_aligner", visual_aligner_node)
    graph.add_node("reporter", reporter_node)

    # 入口
    graph.set_entry_point("ingester")

    # 条件边
    graph.add_conditional_edges(
        "ingester",
        _route_after_ingester,
        {
            "auditor": "auditor",
            "end": END,
        },
    )

    graph.add_conditional_edges(
        "auditor",
        _route_after_auditor,
        {
            "visual_aligner": "visual_aligner",
            "reporter": "reporter",
            "end": END,
        },
    )

    graph.add_conditional_edges(
        "visual_aligner",
        _route_after_visual_aligner,
        {
            "reporter": "reporter",
            "end": END,
        },
    )

    graph.add_conditional_edges(
        "reporter",
        _route_after_reporter,
        {
            "end": END,
        },
    )

    return graph.compile()


def run_audit_pipeline(
    compiled_graph,
    state: dict[str, Any],
    target_node: str | None = None,
) -> dict[str, Any]:
    """
    执行审计流水线。

    Args:
        compiled_graph: 编译后的 LangGraph 图
        state: 当前状态字典
        target_node: 可选，直接跳转到指定节点

    Returns:
        更新后的状态字典
    """
    try:
        if target_node:
            node_funcs = {
                "ingester": ingester_node,
                "auditor": auditor_node,
                "visual_aligner": visual_aligner_node,
                "reporter": reporter_node,
            }
            if target_node in node_funcs:
                return node_funcs[target_node](state)

        # 通过图执行完整的审计流水线
        result = compiled_graph.invoke(state)
        return result

    except Exception as e:
        logger.error(f"审计流水线执行异常: {e}")
        return {
            **state,
            "stage": WorkflowStage.ERROR.value,
            "error_message": f"审计流水线异常: {e}",
        }
