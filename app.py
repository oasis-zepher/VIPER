#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
app.py — Viper 审计 Agent 主入口（Streamlit）
启动命令: streamlit run app.py --server.port 8501
"""

import sys
import os
import time
from pathlib import Path

# 将项目根目录加入 sys.path
_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import streamlit as st

from config.settings import Settings
from agents.graph import build_audit_graph, run_audit_pipeline
from agents.state import WorkflowStage
from ui.sidebar import render_sidebar
from ui.dashboard import render_dashboard, render_audit_progress
from ui.audit_report_panel import render_audit_report
from utils.logger import get_logger, setup_logging

setup_logging()
logger = get_logger("app")

# =====================================================================
#  页面配置 — 赛博极客暗色主题
# =====================================================================

_ICON_PATH = _ROOT / "assets" / "viper_icon.png"
_PAGE_ICON = str(_ICON_PATH) if _ICON_PATH.exists() else "🐍"

st.set_page_config(
    page_title="Viper — Bioinformatics Audit Agent",
    page_icon=_PAGE_ICON,
    layout="wide",
    initial_sidebar_state="expanded",
)

# 赛博极客暗色 CSS
st.markdown(
    """
    <style>
    /* 全局暗色背景 */
    .stApp {
        background-color: #0a0f0a;
    }

    /* 侧边栏暗色 */
    [data-testid="stSidebar"] {
        background-color: #0d1a0d;
        border-right: 1px solid #1a3a2a;
    }

    /* 主内容区 */
    .main .block-container {
        padding-top: 1.5rem;
    }

    /* 代码块样式 */
    .stCodeBlock code {
        font-size: 0.82rem;
        font-family: "Consolas", "Fira Code", monospace;
    }

    /* 绿色霓虹高亮 */
    h1, h2, h3, h4 {
        font-family: "Consolas", monospace;
    }

    /* 按钮霓虹效果 */
    .stButton > button[kind="primary"] {
        background: linear-gradient(135deg, #00ff88, #00ccff);
        color: #000;
        font-family: monospace;
        font-weight: bold;
        border: none;
    }

    .stButton > button[kind="primary"]:hover {
        background: linear-gradient(135deg, #00ccff, #00ff88);
        box-shadow: 0 0 15px rgba(0, 255, 136, 0.3);
    }

    /* 上传区域样式 */
    .uploadedFile { font-size: 0.8rem; }

    /* 选项卡 */
    .stTabs [data-baseweb="tab"] {
        font-family: monospace;
        font-size: 0.85rem;
    }

    /* Expander 样式 */
    .streamlit-expanderHeader {
        font-family: monospace;
    }

    /* 进度条绿色 */
    .stProgress > div > div > div {
        background: linear-gradient(90deg, #00ff88, #00ccff);
    }

    /* 滚动条暗色 */
    ::-webkit-scrollbar {
        width: 8px;
    }
    ::-webkit-scrollbar-track {
        background: #0a0f0a;
    }
    ::-webkit-scrollbar-thumb {
        background: #1a3a2a;
        border-radius: 4px;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


# =====================================================================
#  Session State 初始化
# =====================================================================

def init_session_state() -> None:
    """初始化 Streamlit session_state 中的全局变量。"""
    defaults = {
        # 审计工作流状态
        "audit_state": {
            "user_request": "",
            "uploaded_scripts": [],
            "uploaded_data": [],
            "uploaded_images": [],
            "stage": WorkflowStage.IDLE.value,
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
        },
        # Agent 图
        "audit_graph": None,
        # 文件缓存
        "cached_scripts": [],
        "cached_data": [],
        "cached_images": [],
    }

    for key, val in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = val


init_session_state()


# =====================================================================
#  核心对象懒加载
# =====================================================================

def get_audit_graph():
    if st.session_state["audit_graph"] is None:
        st.session_state["audit_graph"] = build_audit_graph()
    return st.session_state["audit_graph"]


# =====================================================================
#  API Key 首次设置 & 配置校验
# =====================================================================

def _get_env_file_path() -> Path:
    user_data = os.environ.get("VIPER_USER_DATA", "")
    if user_data:
        return Path(user_data) / ".env"
    return _ROOT / ".env"


def _save_api_key(provider: str, api_key: str, model: str) -> None:
    env_path = _get_env_file_path()
    env_path.parent.mkdir(parents=True, exist_ok=True)

    # 读取已有 .env，只更新相关字段
    existing: dict[str, str] = {}
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                existing[k.strip()] = v.strip()

    # provider → env key 映射
    key_map = {
        "google":    "GOOGLE_API_KEY",
        "openai":    "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "deepseek":  "DEEPSEEK_API_KEY",
        "qwen":      "DASHSCOPE_API_KEY",
        "moonshot":  "MOONSHOT_API_KEY",
        "zhipu":     "ZHIPU_API_KEY",
    }
    env_key = key_map.get(provider, "GOOGLE_API_KEY")
    existing[env_key]         = api_key
    existing["DEFAULT_MODEL"] = model
    existing["LLM_PROVIDER"]  = provider

    lines = ["# VIPER — Environment Configuration", "# Auto-generated by Viper setup", ""]
    for k, v in existing.items():
        lines.append(f"{k}={v}")
    env_path.write_text("\n".join(lines), encoding="utf-8")

    # 同步内存中的 Settings
    setattr(Settings, env_key, api_key)
    Settings.DEFAULT_MODEL = model
    Settings.LLM_PROVIDER  = provider


def render_api_key_setup() -> bool:
    """渲染首次运行的 API Key 设置界面（赛博极客风格）。"""
    st.markdown(
        """
        <div style='text-align: center; padding: 3rem 1rem 1rem;'>
            <h1 style='font-size: 4rem; margin: 0;
                background: linear-gradient(135deg, #00ff88, #00ccff);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;'>
                🐍
            </h1>
            <h2 style='margin: 0.5rem 0;
                background: linear-gradient(135deg, #00ff88, #00ccff);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                font-family: "Consolas", monospace;'>
                VIPER
            </h2>
            <p style='color: #00ff88; font-size: 0.9rem; font-family: monospace;
                letter-spacing: 3px; max-width: 600px; margin: 0.5rem auto;'>
                BIOINFORMATICS AUDIT AGENT
            </p>
            <p style='color: #555; font-size: 0.85rem; max-width: 500px; margin: 1rem auto;'>
                多模态生物信息学审计 · 脚本逻辑审查 · 统计方法校验 · 可视化图表解读
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown("---")
    st.markdown("### 🔑 API Key 配置")
    st.info(
        "输入你的 API Key 以启动 Viper 审计引擎。\n"
        "Key 仅保存在本地 `.env` 文件中，不会上传到任何服务器。"
    )

    # ── 提供商配置表 ──────────────────────────────────────────────────────────
    PROVIDERS = {
        "🟢 Google Gemini (推荐)": {
            "key":     "google",
            "models":  [
                "gemini-2.5-pro",
                "gemini-2.5-flash",
                "gemini-2.0-flash-exp",
                "gemini-2.0-flash",
            ],
            "default": "gemini-2.5-flash",
            "key_label": "Google API Key",
            "key_help":  "获取地址: https://aistudio.google.com/apikey",
            "note": "支持多模态视觉审计（图表分析），超长上下文窗口。如有更新模型可选 '自定义' 手动输入",
        },
        "🟤 OpenAI GPT / o 系列": {
            "key":     "openai",
            "models":  ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "o3", "o4-mini"],
            "default": "gpt-4.1",
            "key_label": "OpenAI API Key",
            "key_help":  "https://platform.openai.com/api-keys",
            "note": "GPT-4.1 为最新版，o3/o4-mini 为推理模型",
        },
        "🟣 Anthropic Claude": {
            "key":     "anthropic",
            "models":  [
                "claude-opus-4-5",
                "claude-sonnet-4-5",
                "claude-3-7-sonnet-20250219",
                "claude-3-5-haiku-latest",
            ],
            "default": "claude-sonnet-4-5",
            "key_label": "Anthropic API Key",
            "key_help":  "https://console.anthropic.com/settings/keys",
            "note": "需额外安装: pip install langchain-anthropic",
        },
        "🔵 DeepSeek": {
            "key":     "deepseek",
            "models":  ["deepseek-chat", "deepseek-reasoner"],
            "default": "deepseek-chat",
            "key_label": "DeepSeek API Key",
            "key_help":  "https://platform.deepseek.com/api_keys",
            "note": "deepseek-chat=V3，deepseek-reasoner=R1 推理模型",
        },
        "🟡 Qwen 通义千问": {
            "key":     "qwen",
            "models":  ["qwen-max", "qwen-plus", "qwen-turbo", "qwen-long", "qwen3-235b-a22b"],
            "default": "qwen-max",
            "key_label": "DashScope API Key",
            "key_help":  "https://dashscope.console.aliyun.com/apiKey",
            "note": "阿里云通义千问，API 兼容 OpenAI 格式",
        },
        "🥝 Kimi (Moonshot)": {
            "key":     "moonshot",
            "models":  ["moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k"],
            "default": "moonshot-v1-128k",
            "key_label": "Moonshot API Key",
            "key_help":  "https://platform.moonshot.cn/console/api-keys",
            "note": "Kimi 长文本分析尤强，128k 上下文",
        },
        "⚫ GLM 智谱 AI": {
            "key":     "zhipu",
            "models":  ["glm-4-plus", "glm-4-flash", "glm-4v-plus", "glm-z1-plus"],
            "default": "glm-4-plus",
            "key_label": "智谱 API Key",
            "key_help":  "https://open.bigmodel.cn/usercenter/apikeys",
            "note": "glm-4v-plus 支持多模态，glm-z1-plus 为推理模型",
        },
    }

    col_left, col_right = st.columns([1, 1])

    with col_left:
        provider_label = st.radio(
            "选择 LLM 提供商",
            list(PROVIDERS.keys()),
            help="带「多模态」标注的提供商支持图表视觉审计",
        )

    cfg = PROVIDERS[provider_label]

    with col_right:
        model_preset = st.selectbox(
            "选择预设模型",
            ["自定义 (手动输入)"] + cfg["models"],
            index=1 if cfg["default"] in cfg["models"] else 0,
        )
        if model_preset == "自定义 (手动输入)":
            model = st.text_input(
                "自定义模型名",
                value=cfg["default"],
                placeholder="例: gemini-3.1-pro / gpt-4.2 / deepseek-v3",
                help="填入任意该提供商支持的模型 ID，不受列表限制",
            )
        else:
            model = model_preset
        st.caption(f"💡 {cfg['note']}")

        api_key = st.text_input(
            cfg["key_label"],
            type="password",
            placeholder="sk-... / AIza... / eyJ...",
            help=cfg["key_help"],
        )

    if st.button("🐍 初始化 Viper", type="primary", use_container_width=True):
        if not api_key or len(api_key.strip()) < 8:
            st.error("请输入有效的 API Key")
            return False

        _save_api_key(cfg["key"], api_key.strip(), model)
        st.success("✅ 配置已保存！正在初始化 Viper 审计引擎...")
        time.sleep(1)
        st.rerun()

    return False


def check_config() -> bool:
    errors = Settings.validate()
    return not errors


# =====================================================================
#  审计流程驱动
# =====================================================================

def run_audit(
    scripts: list[dict],
    data_files: list[dict],
    images: list[dict],
    user_request: str,
) -> None:
    """启动 Viper 审计流水线。"""
    state = st.session_state["audit_state"]

    # 更新输入
    state["uploaded_scripts"] = scripts
    state["uploaded_data"] = data_files
    state["uploaded_images"] = images
    state["user_request"] = user_request
    state["stage"] = WorkflowStage.INGESTING.value

    # 清空旧结果
    state["audit_findings"] = []
    state["visual_findings"] = []
    state["audit_report"] = ""
    state["refactor_checklist"] = []
    state["error_message"] = ""
    state["messages"] = []

    # 逐节点执行审计流水线
    nodes = ["ingester", "auditor"]
    if images:
        nodes.append("visual_aligner")
    nodes.append("reporter")

    for node_name in nodes:
        status_labels = {
            "ingester": "📥 解析文件中...",
            "auditor": "🔬 深度审计中...",
            "visual_aligner": "👁️ 视觉对齐中...",
            "reporter": "📋 生成审计报告...",
        }

        with st.spinner(status_labels.get(node_name, "处理中...")):
            try:
                updated = run_audit_pipeline(
                    get_audit_graph(),
                    state,
                    target_node=node_name,
                )
                state.update(updated)
                st.session_state["audit_state"] = state

                # 检查是否出错
                if state.get("stage") == WorkflowStage.ERROR.value:
                    st.error(f"❌ {node_name} 执行出错: {state.get('error_message', '')}")
                    break

            except Exception as e:
                logger.error(f"审计节点 {node_name} 异常: {e}", exc_info=True)
                state["stage"] = WorkflowStage.ERROR.value
                state["error_message"] = str(e)
                st.error(f"❌ {node_name} 执行异常: {e}")
                break

    st.session_state["audit_state"] = state


# =====================================================================
#  主渲染逻辑
# =====================================================================

def main() -> None:
    """Streamlit 主渲染入口。"""

    # 首次运行: API Key 设置向导
    if not check_config():
        setup_done = render_api_key_setup()
        if not setup_done:
            return

    # ------ 左侧边栏：文件树 + 审计控制 ------
    sidebar_result = render_sidebar()

    # 合并新上传的文件到缓存
    if sidebar_result["uploaded_scripts"]:
        existing = st.session_state.get("cached_scripts", [])
        new_names = {s["filename"] for s in existing}
        for s in sidebar_result["uploaded_scripts"]:
            if s["filename"] not in new_names:
                existing.append(s)
        st.session_state["cached_scripts"] = existing

    if sidebar_result["uploaded_data"]:
        existing = st.session_state.get("cached_data", [])
        new_names = {d.get("filename", "") for d in existing}
        for d in sidebar_result["uploaded_data"]:
            if d.get("filename", "") not in new_names:
                existing.append(d)
        st.session_state["cached_data"] = existing

    if sidebar_result["uploaded_images"]:
        existing = st.session_state.get("cached_images", [])
        new_names = {i["filename"] for i in existing}
        for i in sidebar_result["uploaded_images"]:
            if i["filename"] not in new_names:
                existing.append(i)
        st.session_state["cached_images"] = existing

    # ------ 触发审计 ------
    if sidebar_result["trigger_audit"]:
        all_scripts = st.session_state.get("cached_scripts", [])
        all_data = st.session_state.get("cached_data", [])
        all_images = st.session_state.get("cached_images", [])
        user_req = sidebar_result.get("user_request", "")

        if all_scripts or all_data or all_images:
            run_audit(all_scripts, all_data, all_images, user_req)
            st.rerun()
        else:
            st.warning("请先上传文件再启动审计。")

    # ------ 主界面：两栏布局 (中央 + 右侧) ------
    state = st.session_state["audit_state"]
    current_stage = state.get("stage", WorkflowStage.IDLE.value)

    # 顶部审计状态
    if current_stage != WorkflowStage.IDLE.value:
        render_audit_progress(current_stage)
        st.markdown("---")

    # 两栏布局
    col_center, col_right = st.columns([3, 2])

    with col_center:
        # 中央看板：图表预览 + 代码高亮
        dashboard_state = {
            "uploaded_images": st.session_state.get("cached_images", []),
            "uploaded_scripts": st.session_state.get("cached_scripts", []),
        }
        render_dashboard(dashboard_state)

    with col_right:
        # 右侧：审计报告面板
        render_audit_report(state)

    # ------ 错误显示 ------
    if current_stage == WorkflowStage.ERROR.value and state.get("error_message"):
        st.error(f"❌ 错误: {state['error_message']}")

    # ------ 欢迎界面（空闲且无文件时） ------
    if (
        current_stage == WorkflowStage.IDLE.value
        and not st.session_state.get("cached_scripts")
        and not st.session_state.get("cached_data")
        and not st.session_state.get("cached_images")
    ):
        _render_welcome()


def _render_welcome() -> None:
    """渲染欢迎页面。"""
    st.markdown(
        """
        <div style='text-align: center; padding: 2rem 1rem;'>
            <h1 style='font-size: 3rem;
                background: linear-gradient(135deg, #00ff88, #00ccff);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                font-family: "Consolas", monospace;'>
                🐍 VIPER
            </h1>
            <p style='color: #00ff88; font-size: 0.85rem; font-family: monospace;
                letter-spacing: 3px;'>
                BIOINFORMATICS AUDIT AGENT
            </p>
            <p style='color: #555; font-size: 0.9rem; max-width: 700px; margin: 1.5rem auto;'>
                你的「第二大脑」——  对生信分析脚本、统计方法、数据质量和可视化图表<br>
                进行精细化审计与科学解读
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown("---")

    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown(
            """
            <div style='border: 1px solid #1a3a2a; border-radius: 8px;
                padding: 1.2rem; text-align: center;'>
                <p style='font-size: 2rem;'>🔴</p>
                <p style='color: #ff4444; font-family: monospace; font-weight: bold;'>
                    CRITICAL AUDIT
                </p>
                <p style='color: #888; font-size: 0.82rem;'>
                    逻辑漏洞 · 统计误用<br>
                    数据泄露 · 路径冲突
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with col2:
        st.markdown(
            """
            <div style='border: 1px solid #1a3a2a; border-radius: 8px;
                padding: 1.2rem; text-align: center;'>
                <p style='font-size: 2rem;'>✂️</p>
                <p style='color: #ff9900; font-family: monospace; font-weight: bold;'>
                    REFACTOR & PRUNE
                </p>
                <p style='color: #888; font-size: 0.82rem;'>
                    Dead Code · 冗余依赖<br>
                    一键瘦身优化
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with col3:
        st.markdown(
            """
            <div style='border: 1px solid #1a3a2a; border-radius: 8px;
                padding: 1.2rem; text-align: center;'>
                <p style='font-size: 2rem;'>🔍</p>
                <p style='color: #00ccff; font-family: monospace; font-weight: bold;'>
                    MULTI-MODAL INTERPRET
                </p>
                <p style='color: #888; font-size: 0.82rem;'>
                    图表视觉校验<br>
                    科学层面深度解读
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown("---")
    st.markdown(
        "<p style='text-align: center; color: #555; font-family: monospace;'>"
        "👈 从左侧上传 .py / .R / .csv / .png 文件开始审计</p>",
        unsafe_allow_html=True,
    )


# =====================================================================
#  入口
# =====================================================================

if __name__ == "__main__":
    main()
