"""
chat_history.py — 会话历史持久化
每个项目独立保存 chat_history.json，支持断点续接。
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, Union

from utils.path_utils import safe_path, ensure_dir
from utils.logger import get_logger

logger = get_logger(__name__)

HISTORY_FILENAME = "chat_history.json"


class ChatHistoryManager:
    """管理单个项目的对话历史。"""

    def __init__(self, project_dir: Union[str, Path]):
        self.project_dir = safe_path(project_dir)
        self.history_file = self.project_dir / HISTORY_FILENAME
        self._history: list[dict[str, Any]] = []
        self._load()

    # ------------------------------------------------------------------
    #  加载 & 保存
    # ------------------------------------------------------------------

    def _load(self) -> None:
        """从磁盘加载历史。"""
        if self.history_file.exists():
            try:
                raw = self.history_file.read_text(encoding="utf-8")
                self._history = json.loads(raw)
                logger.info(f"加载 {len(self._history)} 条历史记录")
            except Exception as e:
                logger.warning(f"加载历史失败，将重置: {e}")
                self._history = []
        else:
            self._history = []

    def _save(self) -> None:
        """持久化到磁盘。"""
        ensure_dir(self.project_dir)
        self.history_file.write_text(
            json.dumps(self._history, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )

    # ------------------------------------------------------------------
    #  CRUD
    # ------------------------------------------------------------------

    def add_message(
        self,
        role: str,
        content: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        添加一条消息。
        role: 'user' | 'assistant' | 'system' | 'reflector' | 'planner' | 'coder' | 'executor'
        """
        msg = {
            "id": len(self._history) + 1,
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {},
        }
        self._history.append(msg)
        self._save()
        return msg

    def get_messages(
        self,
        last_n: Optional[int] = None,
        role_filter: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """获取消息列表。"""
        msgs = self._history
        if role_filter:
            msgs = [m for m in msgs if m["role"] == role_filter]
        if last_n:
            msgs = msgs[-last_n:]
        return msgs

    def get_langchain_messages(self, last_n: Optional[int] = None) -> list[tuple[str, str]]:
        """
        转为 LangChain 格式 (role, content) 元组列表。
        仅保留 user / assistant 角色。
        """
        msgs = self.get_messages(last_n=last_n)
        result = []
        for m in msgs:
            role = m["role"]
            if role in ("user", "assistant"):
                result.append((role, m["content"]))
            elif role in ("reflector", "planner", "coder", "executor"):
                result.append(("assistant", f"[{role.upper()}] {m['content']}"))
        return result

    def clear(self) -> None:
        """清空历史。"""
        self._history = []
        self._save()

    @property
    def message_count(self) -> int:
        return len(self._history)

    @property
    def last_message(self) -> Optional[dict[str, Any]]:
        return self._history[-1] if self._history else None
