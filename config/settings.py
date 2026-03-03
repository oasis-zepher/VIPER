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

    # === LLM API Keys ===
    GOOGLE_API_KEY: str       = os.getenv("GOOGLE_API_KEY", "")       # Gemini
    OPENAI_API_KEY: str       = os.getenv("OPENAI_API_KEY", "")       # GPT / o 系列
    ANTHROPIC_API_KEY: str    = os.getenv("ANTHROPIC_API_KEY", "")    # Claude
    DEEPSEEK_API_KEY: str     = os.getenv("DEEPSEEK_API_KEY", "")     # DeepSeek
    DASHSCOPE_API_KEY: str    = os.getenv("DASHSCOPE_API_KEY", "")    # Qwen（通义千问）
    MOONSHOT_API_KEY: str     = os.getenv("MOONSHOT_API_KEY", "")     # Kimi
    ZHIPU_API_KEY: str        = os.getenv("ZHIPU_API_KEY", "")        # GLM（智谱）

    # === 默认模型 ===
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "gemini-2.5-flash")
    LLM_PROVIDER: str  = os.getenv("LLM_PROVIDER", "")   # 强制覆盖 provider（可选）

    # === 项目路径 ===
    DEFAULT_PROJECT_ROOT: str = os.getenv("DEFAULT_PROJECT_ROOT", "./projects")

    # === 打包模式检测 ===
    IS_FROZEN: bool = getattr(sys, "frozen", False)

    # === SSH ===
    SSH_HOST: str     = os.getenv("SSH_HOST", "")
    SSH_USER: str     = os.getenv("SSH_USER", "")
    SSH_KEY_PATH: str = os.getenv("SSH_KEY_PATH", "")

    # === UI ===
    STREAMLIT_PORT: int = int(os.getenv("STREAMLIT_PORT", "8501"))
    UI_LANGUAGE: str    = os.getenv("UI_LANGUAGE", "zh-CN")

    # === LLM 参数 ===
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int    = 8192

    # === 数据处理 ===
    LARGE_FILE_THRESHOLD_MB: int = 500
    PREVIEW_ROWS: int            = 100

    # ── Provider → (API-key attr, model prefix hints) ────────────────────────
    _PROVIDER_HINTS: dict = {
        "google":    ["gemini"],
        "openai":    ["gpt", "o1", "o3", "o4"],
        "anthropic": ["claude"],
        "deepseek":  ["deepseek"],
        "qwen":      ["qwen"],
        "moonshot":  ["moonshot"],
        "zhipu":     ["glm"],
    }

    @classmethod
    def get_llm_provider(cls) -> str:
        """自动检测 LLM 提供商（可被 LLM_PROVIDER 环境变量强制覆盖）。"""
        if cls.LLM_PROVIDER:
            return cls.LLM_PROVIDER.lower()
        model = cls.DEFAULT_MODEL.lower()
        for provider, hints in cls._PROVIDER_HINTS.items():
            if any(h in model for h in hints):
                return provider
        return "google"

    @classmethod
    def validate(cls) -> list[str]:
        """校验必要配置，返回错误列表。"""
        errors = []
        provider = cls.get_llm_provider()
        key_map = {
            "google":    ("GOOGLE_API_KEY",    cls.GOOGLE_API_KEY),
            "openai":    ("OPENAI_API_KEY",    cls.OPENAI_API_KEY),
            "anthropic": ("ANTHROPIC_API_KEY", cls.ANTHROPIC_API_KEY),
            "deepseek":  ("DEEPSEEK_API_KEY",  cls.DEEPSEEK_API_KEY),
            "qwen":      ("DASHSCOPE_API_KEY", cls.DASHSCOPE_API_KEY),
            "moonshot":  ("MOONSHOT_API_KEY",  cls.MOONSHOT_API_KEY),
            "zhipu":     ("ZHIPU_API_KEY",     cls.ZHIPU_API_KEY),
        }
        if provider in key_map:
            env_name, val = key_map[provider]
            if not val:
                errors.append(f"未设置 {env_name}，请在 .env 中配置或在界面输入")
        return errors
