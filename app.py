"""
app.py — VIPER CustomTkinter 入口点
直接运行: python app.py
PyInstaller 打包兼容 --noconsole
"""

from __future__ import annotations

import sys
import os
from pathlib import Path

# ── 必须在 import customtkinter 前设置 DPI awareness (Windows) ─────────────
if sys.platform == "win32":
    try:
        from ctypes import windll
        windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass

import customtkinter as ctk

# ── 路径修复 (PyInstaller 打包后 sys._MEIPASS) ────────────────────────────────
if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys._MEIPASS)          # type: ignore[attr-defined]
    # 把项目目录加入 sys.path
    sys.path.insert(0, str(BASE_DIR))
    # 用户数据目录 (可写)
    APP_DATA = Path.home() / ".viper"
    APP_DATA.mkdir(exist_ok=True)
    os.environ.setdefault("VIPER_USER_DATA", str(APP_DATA))
else:
    BASE_DIR = Path(__file__).resolve().parent

# ── 加载 .env ─────────────────────────────────────────────────────────────────
def _load_dotenv() -> None:
    env_paths = [
        BASE_DIR / ".env",
        Path(os.environ.get("VIPER_USER_DATA", "")) / ".env",
    ]
    for ep in env_paths:
        if ep.exists():
            for line in ep.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())
            break

_load_dotenv()

# ── CustomTkinter 全局外观 ────────────────────────────────────────────────────
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("dark-blue")


def _has_valid_key() -> bool:
    """检查是否已配置至少一个 API Key。"""
    from config.settings import Settings
    key_attrs = [
        "GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
        "DEEPSEEK_API_KEY", "DASHSCOPE_API_KEY",
        "MOONSHOT_API_KEY", "ZHIPU_API_KEY",
    ]
    for attr in key_attrs:
        val = getattr(Settings, attr, "") or ""
        if len(val) >= 8:
            return True
    return False


class ViperApp:
    """应用生命周期管理器。"""

    def __init__(self) -> None:
        self._root = ctk.CTk()
        self._root.withdraw()   # 隐藏 Tk 根窗口，始终使用 Toplevel

    def run(self) -> None:
        if _has_valid_key():
            self._open_main()
        else:
            self._open_auth()
        self._root.mainloop()

    def _open_auth(self) -> None:
        from ui.auth_window import AuthWindow
        win = AuthWindow(on_auth_success=self._on_auth_success)
        win.protocol("WM_DELETE_WINDOW", self._quit)
        win.mainloop()   # 鉴权窗口独立事件循环

    def _on_auth_success(self) -> None:
        # 由 AuthWindow 在验证成功后通过 .after() 调用
        # 此时 AuthWindow 还存在 — 先销毁它，再打开主窗口
        # 我们在这里直接重启：关闭旧窗口，打开主窗口
        self._open_main()

    def _open_main(self) -> None:
        from ui.audit_engine import AuditEngine
        from ui.main_window import MainWindow
        self._engine = AuditEngine()
        self._root.deiconify()
        MainWindow(self._root, self._engine)
        self._root.protocol("WM_DELETE_WINDOW", self._quit)
        self._root.lift()
        self._root.focus_force()

    def _quit(self) -> None:
        try:
            self._root.quit()
            self._root.destroy()
        except Exception:
            pass


def main() -> None:
    app = ViperApp()
    app.run()


if __name__ == "__main__":
    main()
