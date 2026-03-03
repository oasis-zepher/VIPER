"""
file_manager.py — 跨平台文件操作管理器
使用 pathlib 确保 Windows (拯救者 R9000P) 与 macOS (MacBook) 路径完全兼容。
"""

from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, Union

from utils.path_utils import safe_path, ensure_dir, is_large_file, sanitize_filename
from utils.logger import get_logger

logger = get_logger(__name__)


class FileManager:
    """跨平台文件读写管理器。"""

    def __init__(self, base_dir: Union[str, Path]):
        self.base_dir = ensure_dir(base_dir)
        logger.info(f"FileManager 初始化，根目录: {self.base_dir}")

    # ------------------------------------------------------------------
    #  读取操作
    # ------------------------------------------------------------------

    def read_text(self, rel_path: Union[str, Path], encoding: str = "utf-8") -> str:
        """读取文本文件。"""
        full = self.base_dir / rel_path
        return full.read_text(encoding=encoding)

    def read_json(self, rel_path: Union[str, Path]) -> Any:
        """读取 JSON 文件。"""
        text = self.read_text(rel_path)
        return json.loads(text)

    def read_head(
        self,
        file_path: Union[str, Path],
        n_lines: int = 100,
        encoding: Optional[str] = None,
    ) -> list[str]:
        """
        读取文件前 n 行。用于大文件（>500 MB）的表头解析，
        绝对禁止全量加载。
        """
        p = safe_path(file_path)
        if not p.exists():
            raise FileNotFoundError(f"文件不存在: {p}")

        # 自动检测编码
        if encoding is None:
            encoding = self._detect_encoding(p)

        lines: list[str] = []
        try:
            with open(p, "r", encoding=encoding, errors="replace") as f:
                for i, line in enumerate(f):
                    if i >= n_lines:
                        break
                    lines.append(line.rstrip("\n\r"))
        except Exception as e:
            logger.error(f"读取文件头失败: {p} — {e}")
            raise

        return lines

    # ------------------------------------------------------------------
    #  写入操作
    # ------------------------------------------------------------------

    def write_text(
        self, rel_path: Union[str, Path], content: str, encoding: str = "utf-8"
    ) -> Path:
        """写入文本文件（自动创建父目录）。"""
        full = self.base_dir / rel_path
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(content, encoding=encoding)
        logger.info(f"已写入: {full}")
        return full

    def write_json(self, rel_path: Union[str, Path], data: Any, indent: int = 2) -> Path:
        """写入 JSON 文件。"""
        content = json.dumps(data, ensure_ascii=False, indent=indent, default=str)
        return self.write_text(rel_path, content)

    def copy_file(self, src: Union[str, Path], dest_rel: Union[str, Path]) -> Path:
        """将外部文件复制到项目目录。"""
        src_path = safe_path(src)
        dest_path = self.base_dir / dest_rel
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(src_path), str(dest_path))
        logger.info(f"已复制: {src_path} → {dest_path}")
        return dest_path

    # ------------------------------------------------------------------
    #  目录操作
    # ------------------------------------------------------------------

    def list_files(
        self, sub_dir: str = "", pattern: str = "*", recursive: bool = True
    ) -> list[Path]:
        """列出目录下的文件。"""
        target = self.base_dir / sub_dir if sub_dir else self.base_dir
        if not target.exists():
            return []

        if recursive:
            return sorted(f for f in target.rglob(pattern) if f.is_file())
        return sorted(f for f in target.glob(pattern) if f.is_file())

    def get_tree(self, sub_dir: str = "", max_depth: int = 3) -> str:
        """生成目录树字符串（用于 Agent 展示）。"""
        target = self.base_dir / sub_dir if sub_dir else self.base_dir
        lines: list[str] = []
        self._build_tree(target, "", 0, max_depth, lines)
        return "\n".join(lines)

    def _build_tree(
        self, path: Path, prefix: str, depth: int, max_depth: int, lines: list[str]
    ) -> None:
        if depth > max_depth:
            return

        entries = sorted(path.iterdir(), key=lambda x: (x.is_file(), x.name.lower()))
        count = len(entries)

        for i, entry in enumerate(entries):
            is_last = i == count - 1
            connector = "└── " if is_last else "├── "
            lines.append(f"{prefix}{connector}{entry.name}")

            if entry.is_dir():
                extension = "    " if is_last else "│   "
                self._build_tree(entry, prefix + extension, depth + 1, max_depth, lines)

    # ------------------------------------------------------------------
    #  辅助
    # ------------------------------------------------------------------

    @staticmethod
    def _detect_encoding(path: Path) -> str:
        """使用 chardet 检测文件编码。"""
        try:
            import chardet
            with open(path, "rb") as f:
                raw = f.read(min(path.stat().st_size, 1_000_000))
            result = chardet.detect(raw)
            enc = result.get("encoding", "utf-8") or "utf-8"
            return enc
        except ImportError:
            return "utf-8"

    def exists(self, rel_path: Union[str, Path]) -> bool:
        return (self.base_dir / rel_path).exists()

    @property
    def root(self) -> Path:
        return self.base_dir
