"""
audit_engine.py — 后台工作线程
将 LangGraph 审计流水线在独立线程中运行，通过队列向 UI 线程传递进度和结果。
UI 永不卡死。
"""

from __future__ import annotations

import base64
import queue
import threading
from pathlib import Path
from typing import Any

from agents.graph import build_audit_graph, run_audit_pipeline
from agents.state import WorkflowStage
from core.data_parser import DataParser
from utils.logger import get_logger

logger = get_logger(__name__)


# ── 消息类型常量 ─────────────────────────────────────────────────────────────
MSG_PROGRESS = "progress"   # {"type": "progress", "stage": str, "label": str}
MSG_RESULT   = "result"     # {"type": "result",   "state": dict}
MSG_ERROR    = "error"      # {"type": "error",    "message": str}

_LANG_MAP = {
    ".py": "python", ".r": "r", ".R": "r",
    ".rmd": "rmd", ".Rmd": "rmd", ".sh": "bash",
    ".txt": "text", ".sql": "sql",
}


def _load_scripts(paths: list[str]) -> list[dict]:
    result = []
    for p_str in paths:
        p = Path(p_str)
        lang = _LANG_MAP.get(p.suffix, "text")
        try:
            content = p.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            content = f"[Error reading file: {e}]"
        result.append({
            "filename": p.name,
            "path": str(p),
            "language": lang,
            "content": content,
        })
    return result


def _load_data(paths: list[str]) -> list[dict]:
    parser = DataParser()
    result = []
    for p_str in paths:
        p = Path(p_str)
        try:
            parsed = parser.parse_file(p_str)
            result.append(parsed)
        except Exception as e:
            result.append({
                "filename": p.name,
                "extension": p.suffix,
                "error": str(e),
            })
    return result


def _load_images(paths: list[str]) -> list[dict]:
    result = []
    for p_str in paths:
        p = Path(p_str)
        try:
            raw = p.read_bytes()
            b64 = base64.b64encode(raw).decode()
            ext = p.suffix.lower().lstrip(".")
            mime = f"image/{ext}" if ext not in ("jpg",) else "image/jpeg"
            result.append({
                "filename": p.name,
                "path": str(p),
                "mime_type": mime,
                "base64": b64,
                "description": f"User uploaded image: {p.name}",
            })
        except Exception as e:
            result.append({
                "filename": p.name,
                "description": f"[Error loading: {e}]",
            })
    return result


class AuditEngine:
    """
    Viper 审计引擎。

    用法:
        engine = AuditEngine()
        q = engine.start_audit(scripts, data_files, images, user_request)
        # 轮询 q 获取 MSG_PROGRESS / MSG_RESULT / MSG_ERROR 消息
    """

    def __init__(self) -> None:
        self._graph = None          # 懒加载，首次审计时构建
        self._thread: threading.Thread | None = None
        self._q: queue.Queue = queue.Queue()
        self._stop_event = threading.Event()

    def _ensure_graph(self) -> None:
        if self._graph is None:
            logger.info("构建 LangGraph 审计图...")
            self._graph = build_audit_graph()

    def start_audit(
        self,
        scripts: list[str],
        data_files: list[str],
        images: list[str],
        user_request: str,
    ) -> queue.Queue:
        """
        启动后台审计线程。
        接受文件路径字符串列表，自动读取内容并转换为 ingester 所需格式。
        返回消息队列，调用方通过 .after(100, poll_fn) 轮询。
        """
        self._stop_event.clear()
        self._q = queue.Queue()

        script_dicts = _load_scripts(scripts)
        data_dicts   = _load_data(data_files)
        image_dicts  = _load_images(images)

        initial_state: dict[str, Any] = {
            "user_request":    user_request,
            "uploaded_scripts": script_dicts,
            "uploaded_data":    data_dicts,
            "uploaded_images":  image_dicts,
            "stage":           WorkflowStage.INGESTING.value,
            "messages":        [],
            "project_id":      "",
            "project_path":    "",
            "code_summary":    "",
            "data_summary":    "",
            "detected_workflow": "",
            "audit_findings":  [],
            "audit_raw_output": "",
            "visual_findings": [],
            "visual_raw_output": "",
            "audit_report":    "",
            "refactor_checklist": [],
            "error_message":   "",
        }

        self._thread = threading.Thread(
            target=self._run_pipeline,
            args=(initial_state,),
            daemon=True,
        )
        self._thread.start()
        return self._q

    def stop(self) -> None:
        self._stop_event.set()

    def _run_pipeline(self, state: dict[str, Any]) -> None:
        """在独立线程中逐节点执行审计流水线。"""
        try:
            self._ensure_graph()

            nodes = [
                ("ingester",      "📥 Parsing & understanding files..."),
                ("auditor",       "🔬 Deep audit in progress..."),
                ("reporter",      "📋 Generating report..."),
            ]
            # 若有图片则插入 visual_aligner
            if state.get("uploaded_images"):
                nodes.insert(2, ("visual_aligner", "👁  Visual alignment check..."))

            for node_name, label in nodes:
                if self._stop_event.is_set():
                    return

                self._q.put({
                    "type":  MSG_PROGRESS,
                    "stage": node_name,
                    "label": label,
                })

                updated = run_audit_pipeline(
                    self._graph,
                    state,
                    target_node=node_name,
                )
                state.update(updated)

                if state.get("stage") == WorkflowStage.ERROR.value:
                    self._q.put({
                        "type":    MSG_ERROR,
                        "message": state.get("error_message", f"{node_name} failed"),
                    })
                    return

            self._q.put({"type": MSG_RESULT, "state": state})

        except Exception as exc:
            logger.error(f"AuditEngine pipeline error: {exc}", exc_info=True)
            self._q.put({"type": MSG_ERROR, "message": str(exc)})



# ── 消息类型常量 ─────────────────────────────────────────────────────────────
MSG_PROGRESS = "progress"   # {"type": "progress", "stage": str, "label": str}
MSG_RESULT   = "result"     # {"type": "result",   "state": dict}
MSG_ERROR    = "error"      # {"type": "error",    "message": str}


class AuditEngine:
    """
    Viper 审计引擎。

    用法:
        engine = AuditEngine()
        engine.start_audit(scripts, data_files, images, user_request,
                           on_message=callback)

    callback 在 UI 的 after() 轮询器中被调用（UI 线程安全）。
    """

    def __init__(self) -> None:
        self._graph = None          # 懒加载，首次审计时构建
        self._thread: threading.Thread | None = None
        self._q: queue.Queue = queue.Queue()

    def _ensure_graph(self) -> None:
        if self._graph is None:
            logger.info("构建 LangGraph 审计图...")
            self._graph = build_audit_graph()

    def start_audit(
        self,
        scripts: list[dict],
        data_files: list[dict],
        images: list[dict],
        user_request: str,
    ) -> queue.Queue:
        """
        启动后台审计线程。
        返回消息队列，调用方通过轮询队列获取进度和结果。
        """
        self._q = queue.Queue()

        initial_state: dict[str, Any] = {
            "user_request": user_request,
            "uploaded_scripts": scripts,
            "uploaded_data": data_files,
            "uploaded_images": images,
            "stage": WorkflowStage.INGESTING.value,
            "messages": [],
            "project_id": "",
            "project_path": "",
            "code_summary": "",
            "data_summary": "",
            "detected_workflow": "",
            "audit_findings": [],
            "audit_raw_output": "",
            "visual_findings": [],
            "visual_raw_output": "",
            "audit_report": "",
            "refactor_checklist": [],
            "error_message": "",
        }

        self._thread = threading.Thread(
            target=self._run_pipeline,
            args=(initial_state,),
            daemon=True,
        )
        self._thread.start()
        return self._q

    def _run_pipeline(self, state: dict[str, Any]) -> None:
        """在独立线程中逐节点执行审计流水线。"""
        try:
            self._ensure_graph()

            nodes = [
                ("ingester",      "📥 Parsing files..."),
                ("auditor",       "🔬 Deep audit in progress..."),
                ("reporter",      "📋 Generating report..."),
            ]
            # 若有图片则插入 visual_aligner
            if state.get("uploaded_images"):
                nodes.insert(2, ("visual_aligner", "👁  Visual alignment check..."))

            for node_name, label in nodes:
                self._q.put({
                    "type":  MSG_PROGRESS,
                    "stage": node_name,
                    "label": label,
                })

                updated = run_audit_pipeline(
                    self._graph,
                    state,
                    target_node=node_name,
                )
                state.update(updated)

                if state.get("stage") == WorkflowStage.ERROR.value:
                    self._q.put({
                        "type":    MSG_ERROR,
                        "message": state.get("error_message", f"{node_name} failed"),
                    })
                    return

            self._q.put({"type": MSG_RESULT, "state": state})

        except Exception as exc:
            logger.error(f"AuditEngine pipeline error: {exc}", exc_info=True)
            self._q.put({"type": MSG_ERROR, "message": str(exc)})
