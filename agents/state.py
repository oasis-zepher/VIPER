"""
state.py — Viper 审计工作流共享状态 Schema
定义在各审计节点之间流转的状态数据结构。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class WorkflowStage(str, Enum):
    """审计工作流阶段状态机。"""
    IDLE = "idle"                     # 空闲，等待用户上传文件
    INGESTING = "ingesting"           # 解析上传的脚本 / 数据 / 图表
    AUDITING = "auditing"             # 深度生信审计（代码逻辑 + 统计方法）
    VISUAL_CHECK = "visual_check"     # 多模态视觉对齐（图表 vs 代码参数）
    REPORTING = "reporting"           # 生成结构化审计报告
    COMPLETED = "completed"           # 审计完成
    ERROR = "error"                   # 错误


class FindingSeverity(str, Enum):
    """审计发现分类。"""
    CRITICAL = "critical"       # 🔴 致命：逻辑漏洞、统计误用、路径冲突
    REFACTOR = "refactor"       # ✂️ 重构：Dead Code、冗余依赖、清理建议
    INTERPRET = "interpret"     # 🔍 解读：多模态科学解读、图表一致性


@dataclass
class AuditFinding:
    """单条审计发现。"""
    severity: FindingSeverity
    title: str
    description: str
    file: str = ""
    line_range: str = ""
    suggestion: str = ""
    code_snippet: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "severity": self.severity.value,
            "title": self.title,
            "description": self.description,
            "file": self.file,
            "line_range": self.line_range,
            "suggestion": self.suggestion,
            "code_snippet": self.code_snippet,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "AuditFinding":
        return cls(
            severity=FindingSeverity(d.get("severity", "interpret")),
            title=d.get("title", ""),
            description=d.get("description", ""),
            file=d.get("file", ""),
            line_range=d.get("line_range", ""),
            suggestion=d.get("suggestion", ""),
            code_snippet=d.get("code_snippet", ""),
        )


@dataclass
class AgentState:
    """
    Viper 审计工作流全局共享状态。
    在各节点（Ingester → Auditor → VisualAligner → Reporter）之间流转。
    """

    # ------ 用户输入 ------
    user_request: str = ""
    uploaded_scripts: list[dict[str, Any]] = field(default_factory=list)
    uploaded_data: list[dict[str, Any]] = field(default_factory=list)
    uploaded_images: list[dict[str, Any]] = field(default_factory=list)

    # ------ 工作流状态 ------
    stage: WorkflowStage = WorkflowStage.IDLE
    messages: list[dict[str, str]] = field(default_factory=list)

    # ------ 项目信息 ------
    project_id: str = ""
    project_path: str = ""

    # ------ Ingester 输出 ------
    code_summary: str = ""
    data_summary: str = ""
    detected_workflow: str = ""

    # ------ Auditor 输出 ------
    audit_findings: list[dict[str, Any]] = field(default_factory=list)
    audit_raw_output: str = ""

    # ------ VisualAligner 输出 ------
    visual_findings: list[dict[str, Any]] = field(default_factory=list)
    visual_raw_output: str = ""

    # ------ Reporter 输出 ------
    audit_report: str = ""
    refactor_checklist: list[str] = field(default_factory=list)

    # ------ 错误信息 ------
    error_message: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "user_request": self.user_request,
            "stage": self.stage.value,
            "project_id": self.project_id,
            "project_path": self.project_path,
            "uploaded_scripts": self.uploaded_scripts,
            "uploaded_data": self.uploaded_data,
            "uploaded_images": self.uploaded_images,
            "code_summary": self.code_summary,
            "data_summary": self.data_summary,
            "detected_workflow": self.detected_workflow,
            "audit_findings": self.audit_findings,
            "visual_findings": self.visual_findings,
            "audit_report": self.audit_report,
            "refactor_checklist": self.refactor_checklist,
            "messages": self.messages,
            "error_message": self.error_message,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AgentState":
        state = cls()
        state.user_request = data.get("user_request", "")
        state.stage = WorkflowStage(data.get("stage", "idle"))
        state.project_id = data.get("project_id", "")
        state.project_path = data.get("project_path", "")
        state.uploaded_scripts = data.get("uploaded_scripts", [])
        state.uploaded_data = data.get("uploaded_data", [])
        state.uploaded_images = data.get("uploaded_images", [])
        state.code_summary = data.get("code_summary", "")
        state.data_summary = data.get("data_summary", "")
        state.detected_workflow = data.get("detected_workflow", "")
        state.audit_findings = data.get("audit_findings", [])
        state.visual_findings = data.get("visual_findings", [])
        state.audit_report = data.get("audit_report", "")
        state.refactor_checklist = data.get("refactor_checklist", [])
        state.messages = data.get("messages", [])
        state.error_message = data.get("error_message", "")
        return state

    def add_message(self, role: str, content: str) -> None:
        self.messages.append({"role": role, "content": content})

    @property
    def all_findings(self) -> list[dict[str, Any]]:
        return self.audit_findings + self.visual_findings

    @property
    def critical_count(self) -> int:
        return sum(1 for f in self.all_findings if f.get("severity") == "critical")

    @property
    def refactor_count(self) -> int:
        return sum(1 for f in self.all_findings if f.get("severity") == "refactor")

    @property
    def interpret_count(self) -> int:
        return sum(1 for f in self.all_findings if f.get("severity") == "interpret")
