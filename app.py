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


def _write_crash_log(exc: BaseException) -> None:
    """EXE 无 console 时写崩溃日志到用户目录。"""
    import traceback
    log_dir = Path.home() / ".viper"
    log_dir.mkdir(exist_ok=True)
    log_path = log_dir / "crash.log"
    with open(log_path, "w", encoding="utf-8") as f:
        traceback.print_exc(file=f)
    # 尝试弹窗提示
    try:
        import tkinter.messagebox as mb
        mb.showerror("VIPER — Crash", f"Startup failed:\n{exc}\n\nSee: {log_path}")
    except Exception:
        pass


class ViperApp:
    """
    单根窗口架构：
      - AuthWindow 本身继承 ctk.CTk，所以鉴权阶段它就是唯一的 Tk 根。
      - 鉴权完成后销毁 AuthWindow，再创建新的 ctk.CTk() 承载主窗口。
      - 直接有 Key 时跳过鉴权，直接创建 ctk.CTk() 主根。
    """

    def run(self) -> None:
        if _has_valid_key():
            self._run_main()
        else:
            # Phase-1: auth (AuthWindow IS a ctk.CTk root)
            from ui.auth_window import AuthWindow
            self._auth_win: AuthWindow | None = None

            def on_success() -> None:
                if self._auth_win is not None:
                    self._auth_win.after(200, self._auth_win.destroy)

            self._auth_win = AuthWindow(on_auth_success=on_success)
            self._auth_win.mainloop()   # blocks until auth window destroyed
            self._auth_win = None

            # Phase-2: main window (only if key now available)
            if _has_valid_key():
                self._run_main()

    def _run_main(self) -> None:
        from ui.audit_engine import AuditEngine
        from ui.main_window import MainWindow

        root = ctk.CTk()
        engine = AuditEngine()
        MainWindow(root, engine)   # packs itself fill=both; sets title/geometry/icon
        root.mainloop()


def main() -> None:
    try:
        app = ViperApp()
        app.run()
    except Exception as exc:
        _write_crash_log(exc)
        raise


if __name__ == "__main__":
    main()
