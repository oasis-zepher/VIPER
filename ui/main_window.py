"""
main_window.py — Viper 主三栏仪表盘 (View B)
布局: [左] 文件树 | [中] 图像/代码预览 | [右] 审计报告输出
"""

from __future__ import annotations

import queue
import base64
from io import BytesIO
from pathlib import Path
from typing import Optional, TYPE_CHECKING

import customtkinter as ctk
from tkinter import filedialog, messagebox

from core.data_parser import DataParser
from ui.audit_engine import AuditEngine

try:
    from PIL import Image, ImageTk
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

from utils.logger import get_logger

logger = get_logger(__name__)


def _extract_grade(report_text: str) -> str:
    """从报告文本中提取单字母评分 (A-F)。"""
    import re
    patterns = [
        r"审计评分[:：]\s*\*?\*?([A-F])\*?\*?",
        r"Score[:：]\s*([A-F])",
        r"Grade[:：]\s*([A-F])",
        r"\*\*([A-F])\*\*",
    ]
    for pat in patterns:
        m = re.search(pat, report_text, re.IGNORECASE)
        if m:
            return m.group(1).upper()
    return "—"

# ── 主题 ──────────────────────────────────────────────────────────────────────
BG        = "#0B0B0B"
BG2       = "#141414"
ACCENT    = "#B026FF"
ACCENT_DIM= "#7A18AD"
TEXT      = "#E0E0E0"
TEXT_DIM  = "#666666"
BORDER    = "#2A2A2A"
CRITICAL  = "#FF3B3B"
REFACTOR  = "#FF9500"
INTERPRET = "#00BFFF"
SUCCESS   = "#00FF88"

SEVERITY_COLOR = {
    "critical":   CRITICAL,
    "refactor":   REFACTOR,
    "interpret":  INTERPRET,
    # 兼容英文大写
    "CRITICAL":   CRITICAL,
    "HIGH":       "#FF6B35",
    "MEDIUM":     REFACTOR,
    "LOW":        INTERPRET,
    "INFO":       TEXT_DIM,
}

SEVERITY_ICON = {
    "critical":   "🔴",
    "refactor":   "✂️",
    "interpret":  "🔍",
    "CRITICAL":   "🔴",
    "HIGH":       "🟠",
    "MEDIUM":     "🟡",
    "LOW":        "🔵",
    "INFO":       "⚪",
}

IMG_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".tif", ".svg"}
CODE_EXTS = {".py", ".r", ".R", ".rmd", ".Rmd", ".sh", ".txt", ".csv",
             ".tsv", ".json", ".yaml", ".yml", ".env"}


class MainWindow(ctk.CTkToplevel):
    """主三栏仪表盘。"""

    def __init__(self, master: ctk.CTk) -> None:
        super().__init__(master)
        self._engine   = AuditEngine()
        self._queue: Optional[queue.Queue] = None
        self._files: list[Path] = []     # 所有上传文件
        self._active_file: Optional[Path] = None
        self._audit_running = False

        self._setup_window()
        self._build_ui()
        self.after(100, self._poll_queue)

    # ── 窗口设置 ──────────────────────────────────────────────────────────────
    def _setup_window(self) -> None:
        self.title("VIPER — Bioinformatics Audit Dashboard")
        self.geometry("1380x820")
        self.minsize(1100, 680)
        self.configure(fg_color=BG)

        self.update_idletasks()
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        x = (sw - 1380) // 2
        y = (sh - 820) // 2
        self.geometry(f"1380x820+{x}+{y}")

        icon_p = Path(__file__).parent.parent / "assets" / "viper_icon.ico"
        if icon_p.exists():
            try:
                self.iconbitmap(str(icon_p))
            except Exception:
                pass

        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # ── 整体布局 ──────────────────────────────────────────────────────────────
    def _build_ui(self) -> None:
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=0)   # 左栏固定
        self.grid_columnconfigure(1, weight=1)   # 中栏弹性
        self.grid_columnconfigure(2, weight=0)   # 右栏固定

        self._build_header()
        self._build_left_panel()
        self._build_center_panel()
        self._build_right_panel()
        self._build_statusbar()

    # ── 顶部标题栏 ────────────────────────────────────────────────────────────
    def _build_header(self) -> None:
        hdr = ctk.CTkFrame(self, fg_color=BG2, height=52,
                           corner_radius=0, border_width=0)
        hdr.grid(row=0, column=0, columnspan=3, sticky="ew")
        hdr.grid_propagate(False)
        hdr.grid_columnconfigure(1, weight=1)

        # Logo
        ctk.CTkLabel(
            hdr, text="🐍 VIPER",
            font=ctk.CTkFont(family="Consolas", size=18, weight="bold"),
            text_color=ACCENT,
        ).grid(row=0, column=0, padx=(18, 0), pady=12, sticky="w")

        ctk.CTkLabel(
            hdr, text="BIOINFORMATICS AUDIT AGENT",
            font=ctk.CTkFont(family="Consolas", size=9),
            text_color=TEXT_DIM,
        ).grid(row=0, column=1, pady=12, sticky="w", padx=(10, 0))

        # 右侧按钮组
        btn_frame = ctk.CTkFrame(hdr, fg_color="transparent")
        btn_frame.grid(row=0, column=2, padx=14, sticky="e")

        ctk.CTkButton(
            btn_frame, text="➕ Add Files",
            width=110, height=32,
            fg_color=ACCENT, hover_color=ACCENT_DIM,
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._add_files,
        ).pack(side="left", padx=(0, 8))

        self._request_entry = ctk.CTkEntry(
            btn_frame,
            placeholder_text="Describe your audit goal...",
            width=320, height=32,
            fg_color=BG, border_color=BORDER, text_color=TEXT,
            placeholder_text_color=TEXT_DIM,
            font=ctk.CTkFont(size=12),
        )
        self._request_entry.pack(side="left", padx=(0, 8))

        self._run_btn = ctk.CTkButton(
            btn_frame, text="▶  Run Audit",
            width=120, height=32,
            fg_color="#1A4A1A", hover_color="#2A6A2A",
            text_color=SUCCESS,
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._start_audit,
        )
        self._run_btn.pack(side="left", padx=(0, 4))

        self._stop_btn = ctk.CTkButton(
            btn_frame, text="⏹",
            width=36, height=32,
            fg_color="#4A1A1A", hover_color="#6A2A2A",
            text_color=CRITICAL,
            font=ctk.CTkFont(size=12),
            command=self._stop_audit,
            state="disabled",
        )
        self._stop_btn.pack(side="left")

    # ── 左栏: 文件树 ──────────────────────────────────────────────────────────
    def _build_left_panel(self) -> None:
        panel = ctk.CTkFrame(self, fg_color=BG2, width=220,
                             corner_radius=0, border_width=1,
                             border_color=BORDER)
        panel.grid(row=1, column=0, sticky="ns", padx=(0, 1))
        panel.grid_propagate(False)
        panel.grid_rowconfigure(1, weight=1)
        panel.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            panel, text="FILES",
            font=ctk.CTkFont(family="Consolas", size=10, weight="bold"),
            text_color=TEXT_DIM,
        ).grid(row=0, column=0, sticky="w", padx=12, pady=(10, 4))

        self._file_scroll = ctk.CTkScrollableFrame(
            panel, fg_color="transparent", scrollbar_button_color=BORDER,
            scrollbar_button_hover_color=ACCENT,
        )
        self._file_scroll.grid(row=1, column=0, sticky="nsew", padx=4, pady=4)
        self._file_scroll.grid_columnconfigure(0, weight=1)

        self._file_labels: dict[Path, ctk.CTkButton] = {}
        self._clear_btn = ctk.CTkButton(
            panel, text="🗑 Clear All", height=28,
            fg_color="transparent", hover_color=BORDER,
            text_color=TEXT_DIM, font=ctk.CTkFont(size=11),
            command=self._clear_files,
        )
        self._clear_btn.grid(row=2, column=0, padx=8, pady=(4, 10), sticky="ew")

    # ── 中栏: 图像+代码预览 ───────────────────────────────────────────────────
    def _build_center_panel(self) -> None:
        panel = ctk.CTkFrame(self, fg_color=BG, corner_radius=0,
                             border_width=0)
        panel.grid(row=1, column=1, sticky="nsew")
        panel.grid_rowconfigure(0, weight=2)
        panel.grid_rowconfigure(1, weight=3)
        panel.grid_columnconfigure(0, weight=1)

        # --- 图像预览区 ---
        img_frame = ctk.CTkFrame(panel, fg_color=BG2, corner_radius=8,
                                 border_width=1, border_color=BORDER)
        img_frame.grid(row=0, column=0, sticky="nsew", padx=8, pady=(8, 4))
        img_frame.grid_rowconfigure(1, weight=1)
        img_frame.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            img_frame, text="IMAGE PREVIEW",
            font=ctk.CTkFont(family="Consolas", size=9, weight="bold"),
            text_color=TEXT_DIM,
        ).grid(row=0, column=0, sticky="w", padx=10, pady=(6, 2))

        self._img_label = ctk.CTkLabel(
            img_frame, text="No image selected",
            text_color=TEXT_DIM,
            font=ctk.CTkFont(size=12),
        )
        self._img_label.grid(row=1, column=0, sticky="nsew", padx=4, pady=4)
        self._photo: Optional[ImageTk.PhotoImage] = None

        # --- 代码/数据预览区 ---
        code_frame = ctk.CTkFrame(panel, fg_color=BG2, corner_radius=8,
                                  border_width=1, border_color=BORDER)
        code_frame.grid(row=1, column=0, sticky="nsew", padx=8, pady=(4, 8))
        code_frame.grid_rowconfigure(1, weight=1)
        code_frame.grid_columnconfigure(0, weight=1)

        code_hdr = ctk.CTkFrame(code_frame, fg_color="transparent")
        code_hdr.grid(row=0, column=0, sticky="ew", padx=10, pady=(6, 2))
        code_hdr.grid_columnconfigure(0, weight=1)

        self._code_title = ctk.CTkLabel(
            code_hdr, text="CODE / DATA PREVIEW",
            font=ctk.CTkFont(family="Consolas", size=9, weight="bold"),
            text_color=TEXT_DIM,
        )
        self._code_title.grid(row=0, column=0, sticky="w")

        self._code_box = ctk.CTkTextbox(
            code_frame,
            fg_color=BG, text_color=TEXT,
            font=ctk.CTkFont(family="Consolas", size=12),
            wrap="none",
            scrollbar_button_color=BORDER,
            scrollbar_button_hover_color=ACCENT,
            border_width=0,
            state="disabled",
        )
        self._code_box.grid(row=1, column=0, sticky="nsew", padx=4, pady=(0, 4))

    # ── 右栏: 审计报告 ────────────────────────────────────────────────────────
    def _build_right_panel(self) -> None:
        panel = ctk.CTkFrame(self, fg_color=BG2, width=410,
                             corner_radius=0, border_width=1,
                             border_color=BORDER)
        panel.grid(row=1, column=2, sticky="nsew", padx=(1, 0))
        panel.grid_propagate(False)
        panel.grid_rowconfigure(1, weight=1)
        panel.grid_columnconfigure(0, weight=1)

        hdr_r = ctk.CTkFrame(panel, fg_color="transparent")
        hdr_r.grid(row=0, column=0, sticky="ew", padx=12, pady=(10, 4))
        hdr_r.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            hdr_r, text="AUDIT REPORT",
            font=ctk.CTkFont(family="Consolas", size=10, weight="bold"),
            text_color=TEXT_DIM,
        ).grid(row=0, column=0, sticky="w")

        self._grade_label = ctk.CTkLabel(
            hdr_r, text="",
            font=ctk.CTkFont(family="Consolas", size=22, weight="bold"),
            text_color=ACCENT,
        )
        self._grade_label.grid(row=0, column=1, sticky="e")

        self._report_scroll = ctk.CTkScrollableFrame(
            panel, fg_color="transparent",
            scrollbar_button_color=BORDER,
            scrollbar_button_hover_color=ACCENT,
        )
        self._report_scroll.grid(row=1, column=0, sticky="nsew", padx=6, pady=4)
        self._report_scroll.grid_columnconfigure(0, weight=1)

        # 空状态提示
        self._empty_label = ctk.CTkLabel(
            self._report_scroll,
            text="🐍\n\nUpload files and\nrun an audit to see\nfindings here.",
            text_color=TEXT_DIM,
            font=ctk.CTkFont(size=13),
            justify="center",
        )
        self._empty_label.grid(row=0, column=0, pady=80)

        # 导出按钮
        self._export_btn = ctk.CTkButton(
            panel, text="📋 Export Report", height=32,
            fg_color="transparent", hover_color=BORDER,
            text_color=TEXT_DIM, font=ctk.CTkFont(size=11),
            border_width=1, border_color=BORDER,
            command=self._export_report, state="disabled",
        )
        self._export_btn.grid(row=2, column=0, padx=10, pady=(4, 10), sticky="ew")

        self._report_text: str = ""

    # ── 底部状态栏 ────────────────────────────────────────────────────────────
    def _build_statusbar(self) -> None:
        bar = ctk.CTkFrame(self, fg_color=BG2, height=28, corner_radius=0)
        bar.grid(row=2, column=0, columnspan=3, sticky="ew")
        bar.grid_propagate(False)

        self._status_label = ctk.CTkLabel(
            bar, text="Ready",
            font=ctk.CTkFont(family="Consolas", size=10),
            text_color=TEXT_DIM,
        )
        self._status_label.pack(side="left", padx=12)

        self._progress_bar = ctk.CTkProgressBar(
            bar, width=180, height=6,
            fg_color=BORDER, progress_color=ACCENT, mode="indeterminate",
        )
        # 默认不 pack，审计时才加载

    # ── 文件管理 ──────────────────────────────────────────────────────────────
    def _add_files(self) -> None:
        paths = filedialog.askopenfilenames(
            title="Select files for audit",
            filetypes=[
                ("All supported", "*.py *.r *.R *.rmd *.Rmd *.csv *.tsv "
                 "*.xlsx *.xls *.png *.jpg *.jpeg *.tiff *.svg *.txt"),
                ("Python scripts", "*.py"),
                ("R scripts", "*.r *.R *.rmd *.Rmd"),
                ("Data files", "*.csv *.tsv *.xlsx *.xls"),
                ("Images", "*.png *.jpg *.jpeg *.tiff *.bmp *.svg"),
                ("All files", "*.*"),
            ],
        )
        for p_str in paths:
            p = Path(p_str)
            if p not in self._files:
                self._files.append(p)
                self._add_file_entry(p)
        if paths:
            self._set_status(f"{len(self._files)} file(s) loaded.")

    def _add_file_entry(self, p: Path) -> None:
        row = len(self._file_labels)
        btn = ctk.CTkButton(
            self._file_scroll,
            text=f"  {p.name}",
            anchor="w",
            height=28,
            fg_color="transparent",
            hover_color="#1E1E2E",
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
        self._set_status("File list cleared.")

    def _preview_file(self, p: Path) -> None:
        self._active_file = p
        # 高亮选中
        for fp, btn in self._file_labels.items():
            btn.configure(fg_color=ACCENT if fp == p else "transparent")

        ext = p.suffix.lower()

        if ext in IMG_EXTS and PIL_AVAILABLE:
            self._show_image(p)
        else:
            self._show_code(p)

    def _show_image(self, p: Path) -> None:
        try:
            img = Image.open(p)
            img.thumbnail((800, 320))
            self._photo = ImageTk.PhotoImage(img)
            self._img_label.configure(image=self._photo, text="")
        except Exception as e:
            self._img_label.configure(image=None, text=f"Cannot load image: {e}",
                                      text_color=CRITICAL)
        self._code_title.configure(text=f"CODE / DATA PREVIEW — {p.name}")
        self._update_code("")

    def _show_code(self, p: Path) -> None:
        self._img_label.configure(image=None, text="No image selected",
                                  text_color=TEXT_DIM)
        self._photo = None
        self._code_title.configure(text=f"CODE / DATA PREVIEW — {p.name}")
        try:
            ext = p.suffix.lower()
            if ext in {".csv", ".tsv", ".xlsx", ".xls"}:
                parsed = DataParser().parse_file(str(p))
                content = (
                    f"# File: {parsed.get('filename')}\n"
                    f"# Shape: {parsed.get('shape')}\n"
                    f"# Columns: {parsed.get('columns')}\n\n"
                    f"{parsed.get('preview', '')}"
                )
            else:
                content = p.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            content = f"[Error reading file: {e}]"
        self._update_code(content)

    def _update_code(self, text: str) -> None:
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
            messagebox.showwarning("No Files", "Please add files before running an audit.")
            return

        user_req = self._request_entry.get().strip()
        scripts = [f for f in self._files if f.suffix.lower() in {".py",".r",".R",".rmd",".Rmd"}]
        data    = [f for f in self._files if f.suffix.lower() in {".csv",".tsv",".xlsx",".xls"}]
        images  = [f for f in self._files if f.suffix.lower() in IMG_EXTS]

        self._clear_report()
        self._audit_running = True
        self._run_btn.configure(state="disabled")
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
        self._audit_running = False
        self._engine.stop()
        self._queue = None
        self._reset_audit_ui()
        self._set_status("⏹  Audit stopped.")

    def _reset_audit_ui(self) -> None:
        self._audit_running = False
        self._run_btn.configure(state="normal")
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
                    msg = self._queue.get_nowait()
                    self._handle_message(msg)
            except queue.Empty:
                pass
        self.after(100, self._poll_queue)

    def _handle_message(self, msg: dict) -> None:
        mtype = msg.get("type", "")

        if mtype == "progress":
            self._set_status(f"🔄  {msg.get('label', 'Processing...')}")

        elif mtype == "result":
            state = msg.get("state", {})
            self._display_results(state)
            self._reset_audit_ui()
            self._set_status("✅  Audit complete.")

        elif mtype == "error":
            err = msg.get("message", "Unknown error")
            self._reset_audit_ui()
            self._set_status(f"❌  {err}")
            self._append_error_card(err)

    # ── 报告渲染 ──────────────────────────────────────────────────────────────
    def _clear_report(self) -> None:
        for w in self._report_scroll.winfo_children():
            w.destroy()
        self._grade_label.configure(text="")
        self._export_btn.configure(state="disabled")
        self._report_text = ""
        self._empty_label = ctk.CTkLabel(
            self._report_scroll,
            text="🔄  Running audit...",
            text_color=TEXT_DIM,
            font=ctk.CTkFont(size=13),
        )
        self._empty_label.grid(row=0, column=0, pady=80)

    def _display_results(self, state: dict) -> None:
        for w in self._report_scroll.winfo_children():
            w.destroy()

        # 从报告文本中提取评分
        report = state.get("audit_report", "")
        grade = _extract_grade(report)
        grade_color = {
            "A": SUCCESS, "B": INTERPRET,
            "C": REFACTOR, "D": "#FF6B35",
            "E": CRITICAL, "F": CRITICAL,
        }.get(grade, TEXT)
        self._grade_label.configure(text=grade, text_color=grade_color)

        # 合并 audit + visual 发现
        findings = state.get("audit_findings", []) + state.get("visual_findings", [])
        summary  = state.get("code_summary", "")
        # report 已在上面取出

        row_idx = 0

        # 摘要卡片
        if summary:
            self._append_text_card("📋  Summary", summary, row_idx)
            row_idx += 1

        # 发现条目
        for finding in findings:
            self._append_finding_card(finding, row_idx)
            row_idx += 1

        # 完整报告折叠区
        if report:
            self._append_report_block(report, row_idx)
            row_idx += 1

        if row_idx == 0:
            ctk.CTkLabel(
                self._report_scroll,
                text="No findings returned — check agent logs.",
                text_color=TEXT_DIM, font=ctk.CTkFont(size=12),
            ).grid(row=0, column=0, pady=60)

        self._report_text = report or summary
        self._export_btn.configure(state="normal")

    def _append_text_card(self, title: str, text: str, row: int) -> None:
        card = ctk.CTkFrame(
            self._report_scroll, fg_color=BG, corner_radius=8,
            border_width=1, border_color=BORDER,
        )
        card.grid(row=row, column=0, sticky="ew", padx=4, pady=(0, 8))
        card.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            card, text=title,
            font=ctk.CTkFont(size=12, weight="bold"), text_color=TEXT,
        ).grid(row=0, column=0, sticky="w", padx=10, pady=(8, 4))

        ctk.CTkLabel(
            card, text=text, wraplength=360,
            font=ctk.CTkFont(size=11), text_color=TEXT_DIM,
            justify="left", anchor="w",
        ).grid(row=1, column=0, sticky="w", padx=10, pady=(0, 10))

    def _append_finding_card(self, finding: dict | object, row: int) -> None:
        # finding 可能是 AuditFinding dataclass 或 dict
        if hasattr(finding, "__dict__"):
            d = finding.__dict__
        elif isinstance(finding, dict):
            d = finding
        else:
            d = {}

        severity = str(d.get("severity", "interpret")).lower()
        title    = d.get("title", "Finding")
        details  = d.get("description", "") or d.get("details", "")
        location = d.get("file", "") + (f" L{d['line_range']}" if d.get("line_range") else "")
        suggest  = d.get("suggestion", "")

        color = SEVERITY_COLOR.get(severity, TEXT_DIM)
        icon  = SEVERITY_ICON.get(severity, "⚪")
        sev_display = severity.upper()

        card = ctk.CTkFrame(
            self._report_scroll, fg_color=BG, corner_radius=8,
            border_width=1, border_color=color,
        )
        card.grid(row=row, column=0, sticky="ew", padx=4, pady=(0, 6))
        card.grid_columnconfigure(0, weight=1)

        # 标题行
        hdr = ctk.CTkFrame(card, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=8, pady=(8, 2))
        hdr.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            hdr, text=f"{icon} {sev_display}",
            font=ctk.CTkFont(family="Consolas", size=10, weight="bold"),
            text_color=color,
        ).grid(row=0, column=0, sticky="w")

        if location:
            ctk.CTkLabel(
                hdr, text=location,
                font=ctk.CTkFont(family="Consolas", size=9),
                text_color=TEXT_DIM,
            ).grid(row=0, column=1, sticky="e")

        ctk.CTkLabel(
            card, text=title,
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=TEXT, wraplength=360, anchor="w", justify="left",
        ).grid(row=1, column=0, sticky="w", padx=10, pady=(2, 4))

        if details:
            ctk.CTkLabel(
                card, text=details,
                font=ctk.CTkFont(size=11), text_color=TEXT_DIM,
                wraplength=360, anchor="w", justify="left",
            ).grid(row=2, column=0, sticky="w", padx=10, pady=(0, 4))

        if suggest:
            sframe = ctk.CTkFrame(card, fg_color=BG2, corner_radius=6)
            sframe.grid(row=3, column=0, sticky="ew", padx=8, pady=(0, 8))
            sframe.grid_columnconfigure(0, weight=1)
            ctk.CTkLabel(
                sframe, text=f"💡  {suggest}",
                font=ctk.CTkFont(size=11), text_color=INTERPRET,
                wraplength=340, anchor="w", justify="left",
            ).grid(row=0, column=0, sticky="w", padx=8, pady=6)

    def _append_report_block(self, report: str, row: int) -> None:
        """可折叠的完整报告文本块。"""
        container = ctk.CTkFrame(
            self._report_scroll, fg_color=BG, corner_radius=8,
            border_width=1, border_color=BORDER,
        )
        container.grid(row=row, column=0, sticky="ew", padx=4, pady=(0, 8))
        container.grid_columnconfigure(0, weight=1)

        self._report_expanded = False
        toggle_btn = ctk.CTkButton(
            container, text="📄 Full Report  ▶",
            fg_color="transparent", hover_color=BORDER,
            text_color=TEXT_DIM, font=ctk.CTkFont(size=11),
            anchor="w",
        )
        toggle_btn.grid(row=0, column=0, sticky="ew", padx=4, pady=4)

        report_box = ctk.CTkTextbox(
            container, height=320,
            fg_color=BG2, text_color=TEXT,
            font=ctk.CTkFont(family="Consolas", size=11),
            border_width=0, state="disabled",
        )

        def _toggle():
            self._report_expanded = not self._report_expanded
            if self._report_expanded:
                report_box.configure(state="normal")
                report_box.delete("1.0", "end")
                report_box.insert("1.0", report)
                report_box.configure(state="disabled")
                report_box.grid(row=1, column=0, sticky="ew", padx=4, pady=(0, 4))
                toggle_btn.configure(text="📄 Full Report  ▼")
            else:
                report_box.grid_forget()
                toggle_btn.configure(text="📄 Full Report  ▶")

        toggle_btn.configure(command=_toggle)

    def _append_error_card(self, err: str) -> None:
        for w in self._report_scroll.winfo_children():
            w.destroy()
        card = ctk.CTkFrame(
            self._report_scroll, fg_color=BG, corner_radius=8,
            border_width=1, border_color=CRITICAL,
        )
        card.grid(row=0, column=0, sticky="ew", padx=4, pady=8)
        card.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(
            card, text=f"🔴  Audit Error\n\n{err}",
            text_color=CRITICAL, font=ctk.CTkFont(size=12),
            wraplength=360, justify="left",
        ).grid(row=0, column=0, padx=12, pady=12)

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

    # ── 工具方法 ──────────────────────────────────────────────────────────────
    def _set_status(self, msg: str) -> None:
        self._status_label.configure(text=msg)
        logger.info(msg)

    def _on_close(self) -> None:
        if self._audit_running:
            if not messagebox.askyesno("Quit", "Audit is running. Quit anyway?"):
                return
        self.destroy()
        self.master.destroy()
