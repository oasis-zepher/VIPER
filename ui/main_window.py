"""
main_window.py — Viper 主三栏仪表盘 (UX Overhaul v2)

改进:
  1. tk.PanedWindow 拖拽分割线 — 左/中/右 & 中顶(图像)/中底(代码)可自由拖拽
  2. _Dropzone — 霓虹紫虚线边框 + 悬停发光 + tkinterdnd2 原生拖拽
  3. Command Bar — 代码区下方多行输入框 + 醒目 RUN AUDIT 按钮，顶栏只保留 Add Files
  4. 视觉层次 — BG=#0B0B0B / PANEL=#151515 / PANEL_LIGHT=#1A1A1A / 强调色仅关键交互
  5. _ReportBox — CTkTextbox + tk.Text tag 语义着色 (critical 红 / refactor 橙 / 代码等宽)
"""

from __future__ import annotations

import queue
import re
import sys
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox
from typing import Optional

import customtkinter as ctk

from core.data_parser import DataParser
from ui.audit_engine import AuditEngine

try:
    from PIL import Image, ImageTk
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import tkinterdnd2 as dnd
    DND_AVAILABLE = True
except ImportError:
    DND_AVAILABLE = False

from utils.logger import get_logger

logger = get_logger(__name__)

# ── 主题色 ────────────────────────────────────────────────────────────────────
BG          = "#0B0B0B"   # 最深背景
PANEL       = "#151515"   # 面板背景
PANEL_LIGHT = "#1A1A1A"   # 控件容器
HDR_BG      = "#111111"   # 顶栏 / 状态栏
ACCENT      = "#B026FF"   # 霓虹紫
ACCENT_DIM  = "#7A18AD"
ACCENT_GLOW = "#C040FF"   # 拖拽悬停
TEXT        = "#E0E0E0"
TEXT_DIM    = "#555555"
TEXT_MID    = "#999999"
BORDER      = "#252525"
BORDER_ACT  = "#3A3A3A"
CRITICAL    = "#FF3B3B"
REFACTOR    = "#FF9500"
INTERPRET   = "#00BFFF"
SUCCESS     = "#00FF88"

SEVERITY_COLOR = {
    "critical":  CRITICAL,
    "refactor":  REFACTOR,
    "interpret": INTERPRET,
}
SEVERITY_ICON = {
    "critical":  "🔴",
    "refactor":  "✂️",
    "interpret": "🔍",
}

IMG_EXTS  = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".tif"}
CODE_EXTS = {".py", ".r", ".R", ".rmd", ".Rmd", ".sh",
             ".txt", ".csv", ".tsv", ".json", ".yaml", ".yml"}


def _extract_grade(text: str) -> str:
    for pat in [
        r"审计评分[:：]\s*\*?\*?([A-F])\*?\*?",
        r"(?:Score|Grade)[:：]\s*([A-F])\b",
        r"\*\*([A-F])\*\*",
    ]:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1).upper()
    return "—"


def _set_sash_cursor(pane: tk.PanedWindow) -> None:
    orient = pane.cget("orient")
    cur = "sb_h_double_arrow" if orient == tk.HORIZONTAL else "sb_v_double_arrow"
    pane.configure(cursor=cur)


# ─────────────────────────────────────────────────────────────────────────────
# 拖放区控件
# ─────────────────────────────────────────────────────────────────────────────

class _Dropzone(tk.Frame):
    """
    霓虹紫虚线边框的拖放区。
    • 用 tk.Canvas 绘制虚线矩形（CTkFrame 不支持 dash 边框）。
    • 拖拽文件进入时边框变 ACCENT_GLOW。
    • 调用 set_image() 显示图片，restore_hint() 恢复提示。
    """

    def __init__(self, master, hint_text: str, on_drop_files, **kw):
        super().__init__(master, bg=PANEL, **kw)
        self._on_drop  = on_drop_files
        self._hint     = hint_text
        self._hover    = False

        self._canvas = tk.Canvas(self, bg=PANEL, highlightthickness=0)
        self._canvas.pack(fill="both", expand=True)
        self._canvas.bind("<Configure>", lambda _: self._redraw())

        if DND_AVAILABLE:
            try:
                self._canvas.drop_target_register(dnd.DND_FILES)
                self._canvas.dnd_bind("<<DropEnter>>", self._on_enter)
                self._canvas.dnd_bind("<<DropLeave>>", self._on_leave)
                self._canvas.dnd_bind("<<Drop>>",      self._on_file_drop)
            except Exception:
                pass

        self._photo_ref: Optional["ImageTk.PhotoImage"] = None

    def _redraw(self) -> None:
        self._canvas.delete("all")
        if self._photo_ref:
            # 图片模式
            cw = max(self._canvas.winfo_width(),  1)
            ch = max(self._canvas.winfo_height(), 1)
            self._canvas.create_image(cw // 2, ch // 2,
                                      image=self._photo_ref, anchor="center")
            return
        # 文字/提示模式
        w = max(self._canvas.winfo_width(),  300)
        h = max(self._canvas.winfo_height(), 120)
        color = ACCENT_GLOW if self._hover else ACCENT
        pad = 10
        self._canvas.create_rectangle(
            pad, pad, w - pad, h - pad,
            outline=color, width=2, dash=(6, 4),
        )
        lines = self._hint.split("\n")
        y0    = h // 2 - len(lines) * 11
        for i, line in enumerate(lines):
            sz  = 14 if i == 0 else 10
            clr = color if i == 0 else TEXT_DIM
            self._canvas.create_text(
                w // 2, y0 + i * 22,
                text=line, fill=clr,
                font=("Consolas", sz), anchor="center",
            )

    # ── 拖拽事件 ─────────────────────────────────────────────────────────────
    def _on_enter(self, _=None) -> None:
        self._hover = True
        self._redraw()

    def _on_leave(self, _=None) -> None:
        self._hover = False
        self._redraw()

    def _on_file_drop(self, event) -> None:
        self._hover = False
        self._redraw()
        raw   = event.data
        paths: list[str] = []
        for m in re.finditer(r"\{([^}]+)\}|(\S+)", raw):
            paths.append(m.group(1) or m.group(2))
        if paths:
            self._on_drop(paths)

    # ── 显示控制 ─────────────────────────────────────────────────────────────
    def set_image(self, photo: "ImageTk.PhotoImage") -> None:
        self._photo_ref = photo
        self._redraw()

    def restore_hint(self) -> None:
        self._photo_ref = None
        self._hover     = False
        self._redraw()


# ─────────────────────────────────────────────────────────────────────────────
# 富文本报告框
# ─────────────────────────────────────────────────────────────────────────────

class _ReportBox(ctk.CTkTextbox):
    """
    基于 CTkTextbox (tk.Text) tag 的语义着色报告框。
    支持 Markdown 标题/粗体/代码块，以及严重性关键词自动上色。
    """

    def __init__(self, master, **kw):
        kw.setdefault("fg_color",     PANEL_LIGHT)
        kw.setdefault("text_color",   TEXT)
        kw.setdefault("font",         ctk.CTkFont(family="Consolas", size=12))
        kw.setdefault("border_width", 0)
        kw.setdefault("wrap",         "word")
        super().__init__(master, **kw)

        tb = self._textbox
        tb.tag_configure("h1",        foreground=ACCENT,
                         font=("Consolas", 15, "bold"))
        tb.tag_configure("h2",        foreground=TEXT,
                         font=("Consolas", 13, "bold"))
        tb.tag_configure("h3",        foreground=TEXT_MID,
                         font=("Consolas", 11, "bold"))
        tb.tag_configure("bold",      font=("Consolas", 12, "bold"))
        tb.tag_configure("code",      foreground="#C8E6C9", background="#141F14",
                         font=("Consolas", 11))
        tb.tag_configure("critical",  foreground=CRITICAL,
                         font=("Consolas", 12, "bold"))
        tb.tag_configure("refactor",  foreground=REFACTOR,
                         font=("Consolas", 12, "bold"))
        tb.tag_configure("interpret", foreground=INTERPRET,
                         font=("Consolas", 12, "bold"))
        tb.tag_configure("grade",     foreground=ACCENT,
                         font=("Consolas", 20, "bold"))
        tb.tag_configure("dim",       foreground=TEXT_DIM)
        tb.tag_configure("success",   foreground=SUCCESS,
                         font=("Consolas", 12, "bold"))

    # ── 内部插入辅助 ─────────────────────────────────────────────────────────
    def _ins(self, text: str, *tags) -> None:
        tb = self._textbox
        start = tb.index("end-1c")
        tb.insert("end", text)
        for tag in tags:
            if tag:
                tb.tag_add(tag, start, "end-1c")

    def _ins_bold_line(self, line: str) -> None:
        for part in re.split(r"(\*\*[^*]+\*\*)", line):
            if part.startswith("**") and part.endswith("**"):
                self._ins(part[2:-2], "bold")
            else:
                self._ins(part)

    def _ins_grade_line(self, line: str) -> None:
        m = re.search(r"\b([A-F])\b", line)
        if m:
            self._ins(line[:m.start()])
            self._ins(m.group(1), "grade")
            self._ins(line[m.end():])
        else:
            self._ins(line)

    # ── 公共 API ─────────────────────────────────────────────────────────────
    def render_markdown(self, text: str) -> None:
        """清空并渲染 Markdown (需在 state=normal 下调用)。"""
        self._textbox.delete("1.0", "end")
        self._append_markdown(text)

    def _append_markdown(self, text: str) -> None:
        """追加渲染（在已有内容末尾继续写）。"""
        in_code = False
        buf: list[str] = []

        for raw in text.splitlines(keepends=True):
            line = raw.rstrip("\n")

            if line.startswith("```"):
                if in_code:
                    self._ins("\n".join(buf) + "\n", "code")
                    buf   = []
                    in_code = False
                else:
                    in_code = True
                continue

            if in_code:
                buf.append(line)
                continue

            if   line.startswith("### "):
                self._ins(line[4:] + "\n", "h3")
            elif line.startswith("## "):
                self._ins(line[3:] + "\n", "h2")
            elif line.startswith("# "):
                self._ins(line[2:] + "\n", "h1")
            elif re.search(r"\[Critical\]|\bCRITICAL\b|🔴", line, re.I):
                self._ins(line + "\n", "critical")
            elif re.search(r"\[Refactor\]|\bREFACTOR\b|✂", line, re.I):
                self._ins(line + "\n", "refactor")
            elif re.search(r"\[Interpret\]|\bINTERPRET\b|🔍", line, re.I):
                self._ins(line + "\n", "interpret")
            elif re.search(r"审计评分|Grade[:：]|Score[:：]", line):
                self._ins_grade_line(line + "\n")
            elif "**" in line:
                self._ins_bold_line(line + "\n")
            elif re.match(r"^---+$", line.strip()):
                self._ins("─" * 44 + "\n", "dim")
            else:
                self._ins(line + "\n")

        if buf:
            self._ins("\n".join(buf) + "\n", "code")


# ─────────────────────────────────────────────────────────────────────────────
# 主窗口
# ─────────────────────────────────────────────────────────────────────────────

class MainWindow(ctk.CTkToplevel):
    """Viper 主三栏仪表盘 (UX Overhaul v2)。"""

    def __init__(self, master: ctk.CTk) -> None:
        super().__init__(master)
        self._engine        = AuditEngine()
        self._queue: Optional[queue.Queue] = None
        self._files: list[Path] = []
        self._active_file: Optional[Path] = None
        self._audit_running = False
        self._photo: Optional["ImageTk.PhotoImage"] = None
        self._report_text   = ""

        self._setup_window()
        self._build_ui()
        self.after(100, self._poll_queue)

    # ── 窗口 ──────────────────────────────────────────────────────────────────
    def _setup_window(self) -> None:
        self.title("VIPER — Bioinformatics Audit Dashboard")
        self.geometry("1440x860")
        self.minsize(1100, 700)
        self.configure(fg_color=BG)
        self.update_idletasks()
        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        self.geometry(f"1440x860+{max(0,(sw-1440)//2)}+{max(0,(sh-860)//2)}")
        _base = Path(sys._MEIPASS) if getattr(sys, "frozen", False) else Path(__file__).parent.parent  # type: ignore[attr-defined]
        icon_p = _base / "assets" / "viper_icon.ico"
        if icon_p.exists():
            try:
                self.iconbitmap(str(icon_p))
            except Exception:
                pass
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # ── 顶部标题栏 ────────────────────────────────────────────────────────────
    def _build_header(self) -> None:
        hdr = tk.Frame(self, bg=HDR_BG, height=50)
        hdr.pack(side="top", fill="x")
        hdr.pack_propagate(False)

        tk.Label(hdr, text="🐍  VIPER", bg=HDR_BG, fg=ACCENT,
                 font=("Consolas", 17, "bold")).pack(side="left", padx=(18, 6), pady=10)
        tk.Label(hdr, text="BIOINFORMATICS AUDIT AGENT", bg=HDR_BG, fg=TEXT_DIM,
                 font=("Consolas", 8)).pack(side="left", pady=10)

        right = tk.Frame(hdr, bg=HDR_BG)
        right.pack(side="right", padx=14, pady=8)

        ctk.CTkButton(
            right, text="➕  Add Files",
            width=120, height=32,
            fg_color=PANEL_LIGHT, hover_color=BORDER_ACT,
            border_width=1, border_color=BORDER_ACT,
            text_color=TEXT, font=ctk.CTkFont(size=12),
            command=self._add_files,
        ).pack(side="left", padx=(0, 8))

        self._stop_btn = ctk.CTkButton(
            right, text="⏹  Stop",
            width=90, height=32,
            fg_color="#3A1010", hover_color="#5A1A1A",
            border_width=1, border_color=CRITICAL,
            text_color=CRITICAL, font=ctk.CTkFont(size=12),
            command=self._stop_audit, state="disabled",
        )
        self._stop_btn.pack(side="left")

    # ── 状态栏 ────────────────────────────────────────────────────────────────
    def _build_statusbar(self) -> None:
        bar = tk.Frame(self, bg=HDR_BG, height=26)
        bar.pack(side="bottom", fill="x")
        bar.pack_propagate(False)
        self._status_label = tk.Label(
            bar, text="Ready — drop files or click ➕ Add Files",
            bg=HDR_BG, fg=TEXT_DIM, font=("Consolas", 9),
        )
        self._status_label.pack(side="left", padx=12)
        self._progress_bar = ctk.CTkProgressBar(
            bar, width=160, height=4,
            fg_color=BORDER, progress_color=ACCENT, mode="indeterminate",
        )

    # ── PanedWindow 三栏布局 ──────────────────────────────────────────────────
    def _build_paned_layout(self) -> None:
        self._hpane = tk.PanedWindow(
            self, orient=tk.HORIZONTAL,
            bg=BG, sashwidth=5, sashrelief="flat", bd=0, showhandle=False,
        )
        self._hpane.pack(fill="both", expand=True)
        _set_sash_cursor(self._hpane)

        # 左栏
        self._left_frame = tk.Frame(self._hpane, bg=PANEL, width=220)
        self._hpane.add(self._left_frame, minsize=160, width=220)

        # 中栏 (容器)
        center_outer = tk.Frame(self._hpane, bg=BG)
        self._hpane.add(center_outer, minsize=420, stretch="always")

        # 中栏内部垂直 PanedWindow
        self._vpane = tk.PanedWindow(
            center_outer, orient=tk.VERTICAL,
            bg=BG, sashwidth=5, sashrelief="flat", bd=0, showhandle=False,
        )
        self._vpane.pack(fill="both", expand=True)
        _set_sash_cursor(self._vpane)

        self._img_frame  = tk.Frame(self._vpane, bg=PANEL, height=260)
        self._vpane.add(self._img_frame,  minsize=100, height=260)

        self._code_frame = tk.Frame(self._vpane, bg=PANEL)
        self._vpane.add(self._code_frame, minsize=180, stretch="always")

        # 右栏
        self._right_frame = tk.Frame(self._hpane, bg=PANEL, width=420)
        self._hpane.add(self._right_frame, minsize=320, width=420)

    # ── 左栏内容 ──────────────────────────────────────────────────────────────
    def _build_left(self) -> None:
        f = self._left_frame
        f.columnconfigure(0, weight=1)
        f.rowconfigure(1, weight=1)

        top = tk.Frame(f, bg=PANEL)
        top.grid(row=0, column=0, sticky="ew", padx=10, pady=(10, 2))
        tk.Label(top, text="FILES", bg=PANEL, fg=TEXT_DIM,
                 font=("Consolas", 8, "bold")).pack(side="left")

        # 文件列表 + Dropzone 共用同一格，用 grid raise 模拟切换
        cell = tk.Frame(f, bg=PANEL)
        cell.grid(row=1, column=0, sticky="nsew", padx=4, pady=4)
        cell.columnconfigure(0, weight=1)
        cell.rowconfigure(0, weight=1)

        self._left_dz = _Dropzone(
            cell,
            hint_text="📄  Drop .R / .py or data here",
            on_drop_files=self._handle_dropped_files,
        )
        self._left_dz.grid(row=0, column=0, sticky="nsew")

        self._file_scroll = ctk.CTkScrollableFrame(
            cell, fg_color=PANEL,
            scrollbar_button_color=BORDER,
            scrollbar_button_hover_color=ACCENT,
        )
        self._file_labels: dict[Path, ctk.CTkButton] = {}
        # 初始不显示，有文件后 raise

        ctk.CTkButton(
            f, text="🗑  Clear All", height=26,
            fg_color="transparent", hover_color=BORDER_ACT,
            text_color=TEXT_DIM, font=ctk.CTkFont(size=10),
            command=self._clear_files,
        ).grid(row=2, column=0, padx=8, pady=(2, 8), sticky="ew")

    # ── 中顶: Image Dropzone ──────────────────────────────────────────────────
    def _build_image_zone(self) -> None:
        f = self._img_frame
        f.columnconfigure(0, weight=1)
        f.rowconfigure(1, weight=1)

        top = tk.Frame(f, bg=PANEL)
        top.grid(row=0, column=0, sticky="ew", padx=10, pady=(6, 0))
        tk.Label(top, text="IMAGE PREVIEW", bg=PANEL, fg=TEXT_DIM,
                 font=("Consolas", 8, "bold")).pack(side="left")
        self._img_name = tk.Label(top, text="", bg=PANEL, fg=TEXT_DIM,
                                  font=("Consolas", 8))
        self._img_name.pack(side="right")

        self._image_dz = _Dropzone(
            f,
            hint_text=(
                "📥  Drag & Drop your Heatmap / PCA image here\n"
                ".png  .jpg  .tiff  .bmp"
            ),
            on_drop_files=self._handle_dropped_files,
        )
        self._image_dz.grid(row=1, column=0, sticky="nsew", padx=6, pady=(2, 6))

    # ── 中底: 代码区 + Command Bar ───────────────────────────────────────────
    def _build_code_zone(self) -> None:
        f = self._code_frame
        f.columnconfigure(0, weight=1)
        f.rowconfigure(1, weight=1)
        f.rowconfigure(2, weight=0)

        top = tk.Frame(f, bg=PANEL)
        top.grid(row=0, column=0, sticky="ew", padx=10, pady=(6, 0))
        tk.Label(top, text="CODE / DATA PREVIEW", bg=PANEL, fg=TEXT_DIM,
                 font=("Consolas", 8, "bold")).pack(side="left")
        self._code_title_lbl = tk.Label(top, text="", bg=PANEL, fg=TEXT_DIM,
                                        font=("Consolas", 8))
        self._code_title_lbl.pack(side="right")

        self._code_box = ctk.CTkTextbox(
            f,
            fg_color=PANEL_LIGHT, text_color=TEXT,
            font=ctk.CTkFont(family="Consolas", size=12),
            wrap="none",
            scrollbar_button_color=BORDER,
            scrollbar_button_hover_color=ACCENT,
            border_width=0, state="disabled",
        )
        self._code_box.grid(row=1, column=0, sticky="nsew", padx=6, pady=(2, 0))

        # ── Command Bar ────────────────────────────────────────────────────
        cmd = tk.Frame(f, bg=HDR_BG)
        cmd.grid(row=2, column=0, sticky="ew")

        tk.Frame(cmd, bg=BORDER, height=1).pack(side="top", fill="x")

        inner = tk.Frame(cmd, bg=HDR_BG)
        inner.pack(side="top", fill="x", padx=8, pady=8)

        self._cmd_box = ctk.CTkTextbox(
            inner,
            height=72,
            fg_color=PANEL_LIGHT,
            text_color=TEXT,
            font=ctk.CTkFont(size=12),
            border_width=1,
            border_color=BORDER,
            scrollbar_button_color=BORDER,
            scrollbar_button_hover_color=ACCENT,
            wrap="word",
        )
        self._cmd_box.pack(side="left", fill="x", expand=True, padx=(0, 8))
        # 插入占位提示（CTkTextbox 无 placeholder，手动做）
        self._cmd_placeholder = "Describe your audit goal, paste error logs, or ask..."
        self._cmd_box.insert("1.0", self._cmd_placeholder)
        self._cmd_box._textbox.configure(fg=TEXT_DIM)
        self._cmd_box._textbox.bind("<FocusIn>",  self._cmd_focus_in)
        self._cmd_box._textbox.bind("<FocusOut>", self._cmd_focus_out)

        self._run_btn = ctk.CTkButton(
            inner,
            text="🚀\nRUN AUDIT",
            width=120, height=72,
            fg_color=ACCENT, hover_color=ACCENT_DIM,
            text_color="white",
            font=ctk.CTkFont(family="Consolas", size=12, weight="bold"),
            corner_radius=8,
            command=self._start_audit,
        )
        self._run_btn.pack(side="right")

    # ── Command Bar 占位符逻辑 ────────────────────────────────────────────────
    def _cmd_focus_in(self, _=None) -> None:
        if self._cmd_box.get("1.0", "end").strip() == self._cmd_placeholder:
            self._cmd_box.configure(state="normal")
            self._cmd_box.delete("1.0", "end")
            self._cmd_box._textbox.configure(fg=TEXT)

    def _cmd_focus_out(self, _=None) -> None:
        if not self._cmd_box.get("1.0", "end").strip():
            self._cmd_box.insert("1.0", self._cmd_placeholder)
            self._cmd_box._textbox.configure(fg=TEXT_DIM)

    def _get_cmd_text(self) -> str:
        t = self._cmd_box.get("1.0", "end").strip()
        return "" if t == self._cmd_placeholder else t

    # ── 右栏: 审计报告 ────────────────────────────────────────────────────────
    def _build_right(self) -> None:
        f = self._right_frame
        f.columnconfigure(0, weight=1)
        f.rowconfigure(1, weight=1)

        top = tk.Frame(f, bg=PANEL)
        top.grid(row=0, column=0, sticky="ew", padx=12, pady=(10, 4))
        tk.Label(top, text="AUDIT REPORT", bg=PANEL, fg=TEXT_DIM,
                 font=("Consolas", 9, "bold")).pack(side="left")
        self._grade_lbl = tk.Label(top, text="", bg=PANEL, fg=ACCENT,
                                   font=("Consolas", 22, "bold"))
        self._grade_lbl.pack(side="right")

        self._report_box = _ReportBox(
            f,
            scrollbar_button_color=BORDER,
            scrollbar_button_hover_color=ACCENT,
        )
        self._report_box.grid(row=1, column=0, sticky="nsew", padx=6, pady=4)
        self._show_placeholder("🐍\n\nUpload files and\nrun an audit to\nsee findings here.")

        bot = tk.Frame(f, bg=PANEL)
        bot.grid(row=2, column=0, sticky="ew", padx=8, pady=(2, 8))
        self._export_btn = ctk.CTkButton(
            bot, text="📋  Export Report", height=30,
            fg_color="transparent", hover_color=BORDER_ACT,
            border_width=1, border_color=BORDER,
            text_color=TEXT_DIM, font=ctk.CTkFont(size=11),
            command=self._export_report, state="disabled",
        )
        self._export_btn.pack(side="left", fill="x", expand=True, padx=(0, 4))
        ctk.CTkButton(
            bot, text="🗑", width=30, height=30,
            fg_color="transparent", hover_color=BORDER_ACT,
            border_width=1, border_color=BORDER,
            text_color=TEXT_DIM,
            command=lambda: self._show_placeholder("🐍  Report cleared."),
        ).pack(side="right")

    # ── 统一入口 ──────────────────────────────────────────────────────────────
    def _build_ui(self) -> None:
        self._build_header()
        self._build_statusbar()
        self._build_paned_layout()
        self._build_left()
        self._build_image_zone()
        self._build_code_zone()
        self._build_right()

    # ── 文件管理 ──────────────────────────────────────────────────────────────
    def _add_files(self) -> None:
        paths = filedialog.askopenfilenames(
            title="Select files for audit",
            filetypes=[
                ("All supported",
                 "*.py *.r *.R *.rmd *.Rmd *.csv *.tsv *.xlsx *.xls "
                 "*.png *.jpg *.jpeg *.tiff *.bmp *.txt"),
                ("Python scripts", "*.py"),
                ("R scripts",      "*.r *.R *.rmd *.Rmd"),
                ("Data files",     "*.csv *.tsv *.xlsx *.xls"),
                ("Images",         "*.png *.jpg *.jpeg *.tiff *.bmp"),
                ("All files",      "*.*"),
            ],
        )
        self._handle_dropped_files(list(paths))

    def _handle_dropped_files(self, paths: list[str]) -> None:
        added = []
        for ps in paths:
            p = Path(ps.strip())
            if p.exists() and p not in self._files:
                self._files.append(p)
                self._add_file_entry(p)
                added.append(p)
        if added:
            self._refresh_list_visibility()
            self._set_status(f"{len(self._files)} file(s) loaded.")
            self._preview_file(added[0])

    def _refresh_list_visibility(self) -> None:
        """有文件时将 CTkScrollableFrame 叠加在 Dropzone 上方。"""
        if self._files:
            self._file_scroll.place(in_=self._left_dz.master,
                                    relx=0, rely=0, relwidth=1, relheight=1)
        else:
            self._file_scroll.place_forget()

    def _add_file_entry(self, p: Path) -> None:
        ext  = p.suffix.lower()
        icon = ("🖼 " if ext in IMG_EXTS else
                "📊 " if ext in {".csv",".tsv",".xlsx",".xls"} else
                "📄 ")
        row  = len(self._file_labels)
        btn  = ctk.CTkButton(
            self._file_scroll,
            text=f"{icon}{p.name}",
            anchor="w", height=28,
            fg_color="transparent", hover_color=PANEL_LIGHT,
            text_color=TEXT,
            font=ctk.CTkFont(family="Consolas", size=11),
            command=lambda path=p: self._preview_file(path),
        )
        btn.grid(row=row, column=0, sticky="ew", pady=1, padx=2)
        self._file_labels[p] = btn

    def _clear_files(self) -> None:
        self._files.clear()
        for w in self._file_scroll.winfo_children():
            w.destroy()
        self._file_labels.clear()
        self._active_file = None
        self._refresh_list_visibility()
        self._image_dz.restore_hint()
        self._img_name.configure(text="")
        self._update_code("", "")
        self._set_status("File list cleared.")

    def _preview_file(self, p: Path) -> None:
        self._active_file = p
        for fp, btn in self._file_labels.items():
            btn.configure(
                fg_color=ACCENT      if fp == p else "transparent",
                text_color="white"   if fp == p else TEXT,
            )
        if p.suffix.lower() in IMG_EXTS and PIL_AVAILABLE:
            self._show_image(p)
        else:
            self._show_code(p)

    def _show_image(self, p: Path) -> None:
        try:
            img = Image.open(p)
            dw  = max(self._image_dz.winfo_width(),  400)
            dh  = max(self._image_dz.winfo_height(), 240)
            img.thumbnail((dw - 20, dh - 20))
            self._photo = ImageTk.PhotoImage(img)
            self._image_dz.set_image(self._photo)
            self._img_name.configure(text=p.name)
        except Exception as e:
            self._image_dz.restore_hint()
            self._set_status(f"Cannot load image: {e}")
        self._update_code("", "")

    def _show_code(self, p: Path) -> None:
        self._image_dz.restore_hint()
        self._img_name.configure(text="")
        self._photo = None
        try:
            ext = p.suffix.lower()
            if ext in {".csv", ".tsv", ".xlsx", ".xls"}:
                parsed  = DataParser().parse_file(str(p))
                content = (
                    f"# File  : {parsed.get('filename')}\n"
                    f"# Shape : {parsed.get('shape')}\n"
                    f"# Cols  : {parsed.get('columns')}\n\n"
                    f"{parsed.get('preview', '')}"
                )
            else:
                content = p.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            content = f"[Error reading file: {e}]"
        self._update_code(content, p.name)

    def _update_code(self, text: str, filename: str = "") -> None:
        self._code_title_lbl.configure(text=filename)
        self._code_box.configure(state="normal")
        self._code_box.delete("1.0", "end")
        if text:
            self._code_box.insert("1.0", text)
        self._code_box.configure(state="disabled")

    # ── 审计流程 ──────────────────────────────────────────────────────────────
    def _start_audit(self) -> None:
        if self._audit_running:
            return
        if not self._files:
            messagebox.showwarning("No Files",
                                   "Please add or drop files before auditing.")
            return

        user_req = self._get_cmd_text()
        scripts  = [f for f in self._files
                    if f.suffix.lower() in {".py",".r",".R",".rmd",".Rmd"}]
        data     = [f for f in self._files
                    if f.suffix.lower() in {".csv",".tsv",".xlsx",".xls"}]
        images   = [f for f in self._files
                    if f.suffix.lower() in IMG_EXTS]

        self._clear_report_start()
        self._audit_running = True
        self._run_btn.configure(state="disabled", text="⏳  Running...",
                                fg_color=ACCENT_DIM)
        self._stop_btn.configure(state="normal")
        self._progress_bar.pack(side="right", padx=12)
        self._progress_bar.start()
        self._set_status("🔄  Auditing...")

        self._queue = self._engine.start_audit(
            scripts=[str(f) for f in scripts],
            data_files=[str(f) for f in data],
            images=[str(f) for f in images],
            user_request=user_req or "Perform a comprehensive bioinformatics audit.",
        )

    def _stop_audit(self) -> None:
        self._engine.stop()
        self._queue = None
        self._reset_audit_ui()
        self._set_status("⏹  Audit stopped.")

    def _reset_audit_ui(self) -> None:
        self._audit_running = False
        self._run_btn.configure(state="normal", text="🚀\nRUN AUDIT",
                                fg_color=ACCENT)
        self._stop_btn.configure(state="disabled")
        try:
            self._progress_bar.stop()
            self._progress_bar.pack_forget()
        except Exception:
            pass

    # ── Queue 轮询 ────────────────────────────────────────────────────────────
    def _poll_queue(self) -> None:
        if self._queue is not None:
            try:
                while True:
                    self._handle_message(self._queue.get_nowait())
            except queue.Empty:
                pass
        self.after(100, self._poll_queue)

    def _handle_message(self, msg: dict) -> None:
        t = msg.get("type", "")
        if t == "progress":
            self._set_status(f"🔄  {msg.get('label', 'Processing...')}")
        elif t == "result":
            self._display_results(msg.get("state", {}))
            self._reset_audit_ui()
            self._set_status("✅  Audit complete.")
        elif t == "error":
            err = msg.get("message", "Unknown error")
            self._reset_audit_ui()
            self._set_status(f"❌  {err}")
            self._report_box.configure(state="normal")
            self._report_box._textbox.delete("1.0", "end")
            self._report_box._ins(f"🔴  Audit Error\n\n{err}\n", "critical")
            self._report_box.configure(state="disabled")

    # ── 报告渲染 ──────────────────────────────────────────────────────────────
    def _show_placeholder(self, text: str) -> None:
        self._report_box.configure(state="normal")
        self._report_box._textbox.delete("1.0", "end")
        self._report_box._ins(text, "dim")
        self._report_box.configure(state="disabled")

    def _clear_report_start(self) -> None:
        self._grade_lbl.configure(text="")
        self._export_btn.configure(state="disabled")
        self._report_text = ""
        self._show_placeholder("🔄  Running audit...")

    def _display_results(self, state: dict) -> None:
        report   = state.get("audit_report", "")
        findings = (state.get("audit_findings", []) +
                    state.get("visual_findings", []))
        summary  = state.get("code_summary", "")

        grade    = _extract_grade(report)
        grade_fg = {
            "A": SUCCESS, "B": INTERPRET, "C": REFACTOR,
            "D": "#FF6B35", "E": CRITICAL, "F": CRITICAL,
        }.get(grade, TEXT)
        self._grade_lbl.configure(text=grade, fg=grade_fg)

        self._report_box.configure(state="normal")
        self._report_box._textbox.delete("1.0", "end")
        rb = self._report_box

        # 代码摘要
        if summary:
            rb._ins("📋  Code Summary\n", "h2")
            rb._ins(summary[:800] + "\n\n")

        # 结构化发现
        if findings:
            rb._ins("─" * 44 + "\n", "dim")
            rb._ins("FINDINGS\n\n", "h2")
            for f in findings:
                d   = (f.__dict__ if hasattr(f, "__dict__")
                       else f if isinstance(f, dict) else {})
                sev = str(d.get("severity", "interpret")).lower()
                tag = sev if sev in SEVERITY_COLOR else "interpret"
                ico = SEVERITY_ICON.get(sev, "⚪")
                rb._ins(f"{ico} [{sev.upper()}]  {d.get('title','Finding')}\n", tag)
                if d.get("file"):
                    rb._ins(f"  📁 {d['file']}", "dim")
                    if d.get("line_range"):
                        rb._ins(f"  L{d['line_range']}", "dim")
                    rb._ins("\n")
                if d.get("description"):
                    rb._ins(f"  {d['description']}\n")
                if d.get("suggestion"):
                    rb._ins(f"  💡 {d['suggestion']}\n", "interpret")
                rb._ins("\n")

        # 完整 Markdown 报告
        if report:
            rb._ins("─" * 44 + "\n", "dim")
            rb._ins("FULL REPORT\n\n", "h2")
            rb._append_markdown(report)

        self._report_box.configure(state="disabled")
        self._report_text = report or summary
        self._export_btn.configure(state="normal")

    # ── 导出 ──────────────────────────────────────────────────────────────────
    def _export_report(self) -> None:
        if not self._report_text:
            return
        path = filedialog.asksaveasfilename(
            defaultextension=".md",
            filetypes=[("Markdown", "*.md"), ("Text", "*.txt")],
            title="Export Audit Report",
        )
        if path:
            Path(path).write_text(self._report_text, encoding="utf-8")
            self._set_status(f"Report exported → {Path(path).name}")

    # ── 工具 ──────────────────────────────────────────────────────────────────
    def _set_status(self, msg: str) -> None:
        self._status_label.configure(text=msg)
        logger.info(msg)

    def _on_close(self) -> None:
        if self._audit_running:
            if not messagebox.askyesno("Quit", "Audit is still running. Quit anyway?"):
                return
        self.destroy()
        self.master.destroy()
