"""
path_utils.py — 跨系统（Windows / macOS / Linux）路径工具
使用 pathlib 确保在拯救者 R9000P (Win) 与 MacBook (macOS) 间无缝切换。
"""

from __future__ import annotations

import os
import platform
import re
from pathlib import Path
from typing import Optional, Union


def get_os_type() -> str:
    """返回当前操作系统类型: 'windows' | 'macos' | 'linux'"""
    system = platform.system().lower()
    if system == "darwin":
        return "macos"
    return system


def safe_path(path_str: Union[str, Path]) -> Path:
    """
    将任意路径字符串标准化为当前系统的 Path 对象。
    - 自动处理 Windows 反斜杠 / Unix 正斜杠
    - 展开 ~ 家目录
    - 解析相对路径为绝对路径
    """
    if isinstance(path_str, Path):
        p = path_str
    else:
        # 统一替换反斜杠
        cleaned = path_str.replace("\\", "/")
        p = Path(cleaned)

    # 展开家目录
    p = p.expanduser()

    # 如果为相对路径，基于 cwd 解析
    if not p.is_absolute():
        p = Path.cwd() / p

    return p.resolve()


def ensure_dir(path: Union[str, Path]) -> Path:
    """确保目录存在，不存在则递归创建并返回 Path 对象。"""
    p = safe_path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_project_root() -> Path:
    """返回 VIPER 项目自身的根目录。"""
    return Path(__file__).resolve().parent.parent


def get_default_storage_root() -> Path:
    """
    获取默认项目存储根目录，优先使用 Google Drive 挂载点。
    降级顺序:
      1. 环境变量 DEFAULT_PROJECT_ROOT
      2. Google Drive 默认路径（按系统判断）
      3. VIPER/projects/
    """
    from dotenv import load_dotenv
    load_dotenv()

    env_root = os.getenv("DEFAULT_PROJECT_ROOT")
    if env_root and env_root.strip():
        return ensure_dir(env_root)

    os_type = get_os_type()
    gdrive_candidates: list[Path] = []

    if os_type == "windows":
        # Google Drive for Desktop 常见挂载盘符
        for letter in ["G", "H", "D", "E"]:
            gdrive_candidates.append(Path(f"{letter}:/My Drive/VIPER_Projects"))
            gdrive_candidates.append(Path(f"{letter}:/我的云端硬盘/VIPER_Projects"))
    elif os_type == "macos":
        home = Path.home()
        gdrive_candidates.append(home / "Google Drive" / "My Drive" / "VIPER_Projects")
        gdrive_candidates.append(home / "Library" / "CloudStorage" / "GoogleDrive" / "My Drive" / "VIPER_Projects")
    else:
        # Linux
        home = Path.home()
        gdrive_candidates.append(home / "google-drive" / "VIPER_Projects")

    for candidate in gdrive_candidates:
        # 仅检查父目录（Google Drive 挂载点）是否存在
        if candidate.parent.exists():
            return ensure_dir(candidate)

    # 降级：本地 projects 目录
    return ensure_dir(get_project_root() / "projects")


def to_relative(path: Union[str, Path], base: Union[str, Path]) -> Path:
    """将绝对路径转为相对于 base 的相对路径（生成代码时使用）。"""
    p = safe_path(path)
    b = safe_path(base)
    try:
        return p.relative_to(b)
    except ValueError:
        return p


def sanitize_filename(name: str) -> str:
    """将字符串清理为安全的文件/文件夹名。"""
    # 移除非法字符
    cleaned = re.sub(r'[<>:"/\\|?*]', "_", name)
    # 去除首尾空格和句点
    cleaned = cleaned.strip(" .")
    # 限制长度
    return cleaned[:100] if cleaned else "untitled"


def is_large_file(path: Union[str, Path], threshold_mb: float = 500) -> bool:
    """判断文件是否为大文件（默认阈值 500 MB）。"""
    p = safe_path(path)
    if not p.exists():
        return False
    size_mb = p.stat().st_size / (1024 * 1024)
    return size_mb > threshold_mb


def get_cross_platform_cmd(conda_env: str, script_path: str) -> str:
    """
    生成跨平台的一键执行命令。
    """
    os_type = get_os_type()
    script = str(safe_path(script_path))

    if os_type == "windows":
        return f"conda activate {conda_env} && python \"{script}\""
    else:
        return f"source activate {conda_env} && python '{script}'"
