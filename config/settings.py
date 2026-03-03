"""
settings.py — 全局配置中心
从 .env 文件或环境变量读取配置。
支持独立 exe 模式（VIPER_USER_DATA 环境变量）。
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# 加载 .env（优先级：用户数据目录 > 项目根目录）
_user_data = os.environ.get("VIPER_USER_DATA", "")
if _user_data:
    _env_path = Path(_user_data) / ".env"
else:
    _env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)


class Settings:
    """全局配置单例。"""

    # === LLM ===
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "gemini-2.0-flash")

    # === 项目路径 ===
    DEFAULT_PROJECT_ROOT: str = os.getenv("DEFAULT_PROJECT_ROOT", "./projects")

    # === Conda (可选，exe 模式下不需要) ===
    CONDA_ENV_NAME: str = os.getenv("CONDA_ENV_NAME", "viper")

    # === 打包模式检测 ===
    IS_FROZEN: bool = getattr(sys, "frozen", False)

    # === SSH ===
    SSH_HOST: str = os.getenv("SSH_HOST", "")
    SSH_USER: str = os.getenv("SSH_USER", "")
    SSH_KEY_PATH: str = os.getenv("SSH_KEY_PATH", "")

    # === UI ===
    STREAMLIT_PORT: int = int(os.getenv("STREAMLIT_PORT", "8501"))
    UI_LANGUAGE: str = os.getenv("UI_LANGUAGE", "zh-CN")

    # === LLM 参数 ===
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 8192

    # === 数据处理 ===
    LARGE_FILE_THRESHOLD_MB: int = 500
    PREVIEW_ROWS: int = 100

    @classmethod
    def get_llm_provider(cls) -> str:
        """返回当前使用的 LLM 提供商。"""
        model = cls.DEFAULT_MODEL.lower()
        if "gemini" in model:
            return "google"
        elif "gpt" in model or "o1" in model:
            return "openai"
        return "google"

    @classmethod
    def validate(cls) -> list[str]:
        """校验必要配置，返回错误列表。"""
        errors = []
        provider = cls.get_llm_provider()
        if provider == "google" and not cls.GOOGLE_API_KEY:
            errors.append("未设置 GOOGLE_API_KEY，请在 .env 中配置")
        elif provider == "openai" and not cls.OPENAI_API_KEY:
            errors.append("未设置 OPENAI_API_KEY，请在 .env 中配置")
        return errors
