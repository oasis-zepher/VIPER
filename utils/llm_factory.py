"""
llm_factory.py — 统一 LLM 构建工厂
支持: Google Gemini · OpenAI · Anthropic Claude · DeepSeek · Qwen · Kimi · GLM
"""

from __future__ import annotations

from typing import Any
from config.settings import Settings
from utils.logger import get_logger

logger = get_logger(__name__)


# ── OpenAI-compatible providers (base_url only differs) ──────────────────────
_OPENAI_COMPATIBLE = {
    "deepseek": {
        "base_url": "https://api.deepseek.com",
        "api_key_attr": "DEEPSEEK_API_KEY",
    },
    "qwen": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "api_key_attr": "DASHSCOPE_API_KEY",
    },
    "moonshot": {
        "base_url": "https://api.moonshot.cn/v1",
        "api_key_attr": "MOONSHOT_API_KEY",
    },
    "zhipu": {
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "api_key_attr": "ZHIPU_API_KEY",
    },
}


def build_llm(temperature: float | None = None, max_tokens: int | None = None) -> Any:
    """
    根据 Settings.DEFAULT_MODEL 和 Settings.LLM_PROVIDER 构建对应的 LangChain LLM。

    参数:
        temperature: 覆盖默认温度（默认从 Settings.LLM_TEMPERATURE）
        max_tokens:  覆盖默认最大令牌数（默认从 Settings.LLM_MAX_TOKENS）

    返回:
        LangChain Chat 模型实例
    """
    temp = temperature if temperature is not None else Settings.LLM_TEMPERATURE
    maxt = max_tokens if max_tokens is not None else Settings.LLM_MAX_TOKENS
    model = Settings.DEFAULT_MODEL
    provider = Settings.get_llm_provider()

    logger.info(f"🤖 Building LLM  provider={provider}  model={model}")

    # ── Google Gemini ─────────────────────────────────────────────────────────
    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=Settings.GOOGLE_API_KEY,
            temperature=temp,
            max_output_tokens=maxt,
        )

    # ── OpenAI ────────────────────────────────────────────────────────────────
    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            api_key=Settings.OPENAI_API_KEY,
            temperature=temp,
            max_tokens=maxt,
        )

    # ── Anthropic Claude ──────────────────────────────────────────────────────
    if provider == "anthropic":
        try:
            from langchain_anthropic import ChatAnthropic
        except ImportError:
            raise ImportError(
                "langchain-anthropic is not installed. "
                "Run: .venv\\Scripts\\python.exe -m pip install langchain-anthropic"
            )
        return ChatAnthropic(
            model=model,
            api_key=Settings.ANTHROPIC_API_KEY,
            temperature=temp,
            max_tokens=maxt,
        )

    # ── OpenAI-compatible (DeepSeek / Qwen / Kimi / GLM) ─────────────────────
    if provider in _OPENAI_COMPATIBLE:
        from langchain_openai import ChatOpenAI
        cfg = _OPENAI_COMPATIBLE[provider]
        api_key = getattr(Settings, cfg["api_key_attr"], "")
        return ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url=cfg["base_url"],
            temperature=temp,
            max_tokens=maxt,
        )

    # ── Fallback ──────────────────────────────────────────────────────────────
    raise ValueError(
        f"Unknown LLM provider: '{provider}'. "
        f"Valid: google, openai, anthropic, deepseek, qwen, moonshot, zhipu"
    )


def build_vision_llm(temperature: float | None = None, max_tokens: int | None = None) -> Any:
    """
    构建支持视觉（图像输入）的 LLM 实例。
    仅 Google Gemini 和 OpenAI GPT-4o/4.1 系列支持多模态视觉输入。
    其他 provider 自动降级为纯文本模式。
    """
    provider = Settings.get_llm_provider()
    model = Settings.DEFAULT_MODEL

    VISION_SUPPORTED = {"google", "openai", "anthropic"}
    if provider not in VISION_SUPPORTED:
        logger.warning(
            f"⚠️  Provider '{provider}' does not support vision. "
            f"Visual alignment will run in text-only mode."
        )

    return build_llm(temperature=temperature, max_tokens=max_tokens)
