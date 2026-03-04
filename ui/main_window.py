"""
main_window.py - Viper Professional Quad-Panel Layout

Four zones:
  1. Left:         Audit History    - scrollable list of past sessions
  2. Center-Top:   Image Viewer     - multi-modal image display / dropzone
  3. Center-Bot:   Command Hub      - attach buttons + multiline input + RUN AUDIT
  4. Right:        Code & Result    - code preview (top) + audit report (bottom)
"""

from __future__ import annotations

import queue
import re
import sys
import tkinter as tk
from datetime import datetime
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

# ── Theme colours ──────────────────────────────────────────────────────────────
BG          = "#0B0B0B"
PANEL       = "#151515"
PANEL_LIGHT = "#1A1A1A"
PANEL_MID   = "#131313"
HDR_BG      = "#111111"
ACCENT      = "#B026FF"
ACCENT_DIM  = "#7A18AD"
ACCENT_GLOW = "#C040FF"
TEXT        = "#E0E0E0"
TEXT_DIM    = "#555555"
TEXT_MID    = "#888888"
BORDER      = "#252525"
BORDER_ACT  = "#3A3A3A"
CRITICAL    = "#FF3B3B"
REFACTOR    = "#FF9500"
INTERPRET   = "#00BFFF"
SUCCESS     = "#00FF88"

SEVERITY_COLOR = {"critical": CRITICAL, "refactor": REFACTOR, "interpret": INTERPRET}
SEVERITY_ICON  = {"critical": "\U0001f534", "refactor": "\u2702\ufe0f", "interpret": "\U0001f50d"}

IMG_EXTS  = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".tif"}
CODE_EXTS = {".py", ".r", ".R", ".rmd", ".Rmd", ".sh",
             ".txt", ".csv", ".tsv", ".json", ".yaml", ".yml"}


def _extract_grade(text: str) -> str:
    for pat in [
        r"(?:Score|Grade|Overall)[::\s]*\*?\*?([A-F])\*?\*?",
        r"\*\*([A-F])\*\*",
    ]:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1).upper()
    return "-"


def _set_sash_cursor(pane: tk.PanedWindow) -> None:
    orient = pane.cget("orient")
    cur = "sb_h_double_arrow" if orient == tk.HORIZONTAL else "sb_v_double_arrow"
    pane.configure(cursor=cur)


# ── History entry ──────────────────────────────────────────────────────────────

class _HistoryEntry:
    def __init__(self, ts: str, title: str, state: dict):
        self.ts    = ts
        self.title = title
        self.state = state


# ── Dropzone ───────────────────────────────────────────────────────────────────

class _Dropzone(tk.Frame):
    """
    Neon-dashed drag-drop zone drawn with tk.Canvas.
    Supports tkinterdnd2 when available.
    """

    def __init__(self, master, hint_text: str, on_drop_files, **kw):
        super().__init__(master, bg=PANEL, **kw)
        self._on_drop = on_drop_files
        self._hint    = hint_text
        self._hover   = False

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
            cw = max(self._canvas.winfo_width(),  1)
            ch = max(self._canvas.winfo_height(), 1)
            self._canvas.create_image(cw // 2, ch // 2,
                                      image=self._photo_ref, anchor="center")
            return
        w   = max(self._canvas.winfo_width(),  300)
        h   = max(self._canvas.winfo_height(), 120)
        clr = ACCENT_GLOW if self._hover else ACCENT
        pad = 10
        self._canvas.create_rectangle(
            pad, pad, w - pad, h - pad,
            outline=clr, width=2, dash=(6, 4),
        )
        lines = self._hint.split("\n")
        y0    = h // 2 - len(lines) * 11
        for i, line in enumerate(lines):
            sz  = 14 if i == 0 else 10
            c   = clr if i == 0 else TEXT_DIM
            self._canvas.create_text(
                w // 2, y0 + i * 22,
                text=line, fill=c,
                font=("Consolas", sz), anchor="center",
            )

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

    def set_image(self, photo: "ImageTk.PhotoImage") -> None:
        self._photo_ref = photo
        self._redraw()

    def restore_hint(self) -> None:
        self._photo_ref = None
        self._hover     = False
        self._redraw()


# ── Rich-text report box ───────────────────────────────────────────────────────

class _ReportBox(ctk.CTkTextbox):
    """
    CTkTextbox with semantic colour tags for audit findings.
    Supports basic Markdown heading/bold pass.
    """

    def __init__(self, master, **kw):
        kw.setdefault("font",         ctk.CTkFont(family="Consolas", size=12))
        kw.setdefault("fg_color",     PANEL_MID)
        kw.setdefault("text_color",   TEXT)
        kw.setdefault("border_color", BORDER)
        kw.setdefault("border_width", 1)
        kw.setdefault("wrap",         "word")
        super().__init__(master, **kw)
        self._setup_tags()

    def _setup_tags(self) -> None:
        t = self._textbox
        t.tag_configure("h1",        foreground=ACCENT,    font=("Consolas", 14, "bold"))
        t.tag_configure("h2",        foreground=TEXT,      font=("Consolas", 12, "bold"))
        t.tag_configure("bold",      font=("Consolas", 12, "bold"))
        t.tag_configure("code",      foreground=INTERPRET, font=("Courier New", 11))
        t.tag_configure("critical",  foreground=CRITICAL)
        t.tag_configure("refactor",  foreground=REFACTOR)
        t.tag_configure("interpret", foreground=INTERPRET)
        t.tag_configure("success",   foreground=SUCCESS)
        t.tag_configure("dim",       foreground=TEXT_DIM)
        t.tag_configure("normal",    foreground=TEXT)

    def _ins(self, text: str, tag: str = "normal") -> None:
        self._textbox.insert("end", text, tag)

    def _append_markdown(self, md: str) -> None:
        for line in md.splitlines():
            if line.startswith("### "):
                self._ins(line[4:] + "\n", "h2")
            elif line.startswith("## "):
                self._ins(line[3:] + "\n", "h1")
            elif line.startswith("# "):
                self._ins(line[2:] + "\n", "h1")
            else:
                parts = re.split(r"\*\*(.+?)\*\*", line)
                for k, part in enumerate(parts):
                    tag = "bold" if k % 2 == 1 else "normal"
                    self._ins(part, tag)
                self._ins("\n")


# ── Main window ────────────────────────────────────────────────────────────────

class MainWindow(ctk.CTkFrame):
    """
    Professional quad-panel audit dashboard.
    """

    def __init__(self, master: ctk.CTk, engine: AuditEngine):
        super().__init__(master, fg_color=BG)
        self.pack(fill="both", expand=True)

        self._engine:        AuditEngine  = engine
        self._files:         list[Path]   = []
        self._file_labels:   dict[Path, ctk.CTkButton] = {}
        self._active_file:   Optional[Path] = None
        self._photo:         Optional["ImageTk.PhotoImage"] = None
        self._queue:         Optional[queue.Queue] = None
        self._audit_running: bool = False
        self._report_text:   str  = ""
        self._history:       list[_HistoryEntry] = []
        self._history_btns:  list[ctk.CTkButton] = []

        self._setup_window()
        self._build_ui()
        self.after(100, self._poll_queue)

    # ── Window chrome ──────────────────────────────────────────────────────────

    def _setup_window(self) -> None:
        root = self.master
        root.title("VIPER \u2014 Bioinformatics Audit System")
        root.geometry("1480x880")
        root.minsize(1100, 700)
        root.configure(bg=BG)
        if hasattr(sys, "_MEIPASS"):
            ico = Path(sys._MEIPASS) / "assets" / "viper_icon.ico"
        else:
            ico = Path(__file__).parent.parent / "assets" / "viper_icon.ico"
        if ico.exists():
            try:
                root.iconbitmap(str(ico))
            except Exception:
                pass
        root.protocol("WM_DELETE_WINDOW", self._on_close)

    # ── UI assembly ────────────────────────────────────────────────────────────

    def _build_ui(self) -> None:
        self._build_header()
        self._build_statusbar()
        self._build_paned_layout()
        self._build_panel_history()
        self._build_panel_image()
        self._build_panel_command_hub()
        self._build_panel_code_report()

    # ── Header ─────────────────────────────────────────────────────────────────

    def _build_header(self) -> None:
        hdr = ctk.CTkFrame(self, fg_color=HDR_BG, corner_radius=0, height=48)
        hdr.pack(fill="x", side="top")
        hdr.pack_propagate(False)

        ctk.CTkLabel(
            hdr, text="VIPER",
            font=ctk.CTkFont(family="Consolas", size=20, weight="bold"),
            text_color=ACCENT,
        ).pack(side="left", padx=20, pady=8)

        ctk.CTkLabel(
            hdr, text="Bioinformatics Audit System",
            font=ctk.CTkFont(family="Consolas", size=11),
            text_color=TEXT_DIM,
        ).pack(side="left", padx=0, pady=8)

    # ── Status bar ─────────────────────────────────────────────────────────────

    def _build_statusbar(self) -> None:
        bar = ctk.CTkFrame(self, fg_color=HDR_BG, corner_radius=0, height=28)
        bar.pack(fill="x", side="bottom")
        bar.pack_propagate(False)

        self._status_label = ctk.CTkLabel(
            bar, text="Ready.",
            font=ctk.CTkFont(family="Consolas", size=10),
            text_color=TEXT_DIM,
        )
        self._status_label.pack(side="left", padx=12)

        self._progress_bar = ctk.CTkProgressBar(bar, width=120, height=6,
                                                 mode="indeterminate",
                                                 progress_color=ACCENT)
        # packed on demand

        self._stop_btn = ctk.CTkButton(
            bar, text="Stop", width=54, height=20,
            fg_color="transparent", hover_color=BORDER_ACT,
            border_width=1, border_color=BORDER,
            text_color=TEXT_DIM,
            font=ctk.CTkFont(family="Consolas", size=10),
            state="disabled",
            command=self._stop_audit,
        )
        self._stop_btn.pack(side="right", padx=8)

    # ── 4-zone paned layout ────────────────────────────────────────────────────

    def _build_paned_layout(self) -> None:
        self._hpane = tk.PanedWindow(
            self, orient=tk.HORIZONTAL,
            bg=BORDER, sashwidth=5, sashpad=0, relief="flat",
        )
        self._hpane.pack(fill="both", expand=True)
        _set_sash_cursor(self._hpane)

        # Left: history
        self._hist_frame = ctk.CTkFrame(self._hpane, fg_color=PANEL,
                                         corner_radius=0, width=210)
        self._hpane.add(self._hist_frame, width=210, minsize=120)

        # Center: [img | cmd]
        self._vpane = tk.PanedWindow(
            self._hpane, orient=tk.VERTICAL,
            bg=BORDER, sashwidth=5, sashpad=0, relief="flat",
        )
        _set_sash_cursor(self._vpane)
        self._hpane.add(self._vpane, minsize=280)

        self._img_frame = ctk.CTkFrame(self._vpane, fg_color=PANEL,
                                        corner_radius=0, height=280)
        self._vpane.add(self._img_frame, height=280, minsize=120)

        self._cmd_frame = ctk.CTkFrame(self._vpane, fg_color=PANEL_MID,
                                        corner_radius=0)
        self._vpane.add(self._cmd_frame, minsize=140)

        # Right: [code | report]
        self._rpane = tk.PanedWindow(
            self._hpane, orient=tk.VERTICAL,
            bg=BORDER, sashwidth=5, sashpad=0, relief="flat",
        )
        _set_sash_cursor(self._rpane)
        self._hpane.add(self._rpane, minsize=340)

        self._code_frame = ctk.CTkFrame(self._rpane, fg_color=PANEL,
                                         corner_radius=0, height=260)
        self._rpane.add(self._code_frame, height=260, minsize=100)

        self._report_frame = ctk.CTkFrame(self._rpane, fg_color=PANEL_MID,
                                           corner_radius=0)
        self._rpane.add(self._report_frame, minsize=200)

    # ── Panel 1: History (left) ────────────────────────────────────────────────

    def _build_panel_history(self) -> None:
        f = self._hist_frame
        f.grid_rowconfigure(1, weight=1)
        f.grid_rowconfigure(3, weight=1)
        f.grid_columnconfigure(0, weight=1)

        hdr = ctk.CTkFrame(f, fg_color=HDR_BG, corner_radius=0, height=30)
        hdr.grid(row=0, column=0, sticky="ew")
        hdr.grid_propagate(False)
        ctk.CTkLabel(hdr, text="AUDIT HISTORY",
                     font=ctk.CTkFont(family="Consolas", size=9, weight="bold"),
                     text_color=TEXT_DIM).pack(side="left", padx=8, pady=6)
        ctk.CTkButton(hdr, text="Clear", width=40, height=20,
                      fg_color="transparent", hover_color=BORDER_ACT,
                      border_width=1, border_color=BORDER, text_color=TEXT_DIM,
                      font=ctk.CTkFont(family="Consolas", size=9),
                      command=self._clear_history).pack(side="right", padx=6)

        self._history_scroll = ctk.CTkScrollableFrame(f, fg_color=PANEL,
                                                       corner_radius=0)
        self._history_scroll.grid(row=1, column=0, sticky="nsew")
        self._history_scroll.grid_columnconfigure(0, weight=1)

        self._hist_placeholder = ctk.CTkLabel(
            self._history_scroll,
            text="No history yet.",
            font=ctk.CTkFont(family="Consolas", size=10),
            text_color=TEXT_DIM,
        )
        self._hist_placeholder.grid(row=0, column=0, pady=20)

        fhdr = ctk.CTkFrame(f, fg_color=HDR_BG, corner_radius=0, height=30)
        fhdr.grid(row=2, column=0, sticky="ew")
        fhdr.grid_propagate(False)
        ctk.CTkLabel(fhdr, text="LOADED FILES",
                     font=ctk.CTkFont(family="Consolas", size=9, weight="bold"),
                     text_color=TEXT_DIM).pack(side="left", padx=8, pady=6)
        ctk.CTkButton(fhdr, text="Clear", width=40, height=20,
                      fg_color="transparent", hover_color=BORDER_ACT,
                      border_width=1, border_color=BORDER, text_color=TEXT_DIM,
                      font=ctk.CTkFont(family="Consolas", size=9),
                      command=self._clear_files).pack(side="right", padx=6)

        self._file_scroll = ctk.CTkScrollableFrame(f, fg_color=PANEL,
                                                    corner_radius=0, height=150)
        self._file_scroll.grid(row=3, column=0, sticky="nsew")
        self._file_scroll.grid_columnconfigure(0, weight=1)

    def _add_history_entry(self, entry: _HistoryEntry) -> None:
        if self._hist_placeholder.winfo_ismapped():
            self._hist_placeholder.grid_forget()
        row = len(self._history_btns)
        btn = ctk.CTkButton(
            self._history_scroll,
            text=f"{entry.ts}\n{entry.title[:24]}",
            anchor="w", height=40,
            fg_color=PANEL_LIGHT, hover_color=BORDER_ACT,
            text_color=TEXT_MID,
            font=ctk.CTkFont(family="Consolas", size=10),
            command=lambda e=entry: self._display_results(e.state),
        )
        btn.grid(row=row, column=0, sticky="ew", pady=2, padx=4)
        self._history_btns.append(btn)

    def _load_history(self) -> None:
        pass  # future: load JSON from disk

    def _clear_history(self) -> None:
        self._history.clear()
        for w in self._history_btns:
            w.destroy()
        self._history_btns.clear()
        self._hist_placeholder.grid(row=0, column=0, pady=20)

    # ── Panel 2: Image Viewer (center top) ────────────────────────────────────

    def _build_panel_image(self) -> None:
        f = self._img_frame
        f.grid_rowconfigure(1, weight=1)
        f.grid_columnconfigure(0, weight=1)

        hdr = ctk.CTkFrame(f, fg_color=HDR_BG, corner_radius=0, height=30)
        hdr.grid(row=0, column=0, sticky="ew")
        hdr.grid_propagate(False)
        ctk.CTkLabel(hdr, text="IMAGE VIEWER",
                     font=ctk.CTkFont(family="Consolas", size=9, weight="bold"),
                     text_color=TEXT_DIM).pack(side="left", padx=8, pady=6)
        self._img_name = ctk.CTkLabel(
            hdr, text="",
            font=ctk.CTkFont(family="Consolas", size=9),
            text_color=TEXT_MID)
        self._img_name.pack(side="right", padx=8)

        hint = "Drop image here\n.png  .jpg  .tiff  .bmp"
        self._image_dz = _Dropzone(f, hint_text=hint,
                                   on_drop_files=self._handle_dropped_files)
        self._image_dz.grid(row=1, column=0, sticky="nsew", padx=4, pady=4)

    # ── Panel 3: Command Hub (center bottom) ───────────────────────────────────

    def _build_panel_command_hub(self) -> None:
        f = self._cmd_frame
        f.grid_rowconfigure(2, weight=1)
        f.grid_columnconfigure(0, weight=1)

        hdr = ctk.CTkFrame(f, fg_color=HDR_BG, corner_radius=0, height=30)
        hdr.grid(row=0, column=0, columnspan=2, sticky="ew")
        hdr.grid_propagate(False)
        ctk.CTkLabel(hdr, text="COMMAND HUB",
                     font=ctk.CTkFont(family="Consolas", size=9, weight="bold"),
                     text_color=TEXT_DIM).pack(side="left", padx=8, pady=6)

        attach_row = ctk.CTkFrame(f, fg_color="transparent")
        attach_row.grid(row=1, column=0, columnspan=2, sticky="ew",
                        padx=8, pady=(6, 2))

        _btn_kw = dict(height=28, fg_color=PANEL_LIGHT, hover_color=BORDER_ACT,
                       border_width=1, border_color=BORDER, text_color=TEXT_MID,
                       font=ctk.CTkFont(family="Consolas", size=10))

        ctk.CTkButton(attach_row, text="\U0001f4ce  Attach File",
                      command=self._attach_file, **_btn_kw).pack(
                          side="left", padx=(0, 4))
        ctk.CTkButton(attach_row, text="\U0001f4c4  Paste Code",
                      command=self._paste_code, **_btn_kw).pack(
                          side="left", padx=(0, 4))
        ctk.CTkButton(attach_row, text="\U0001f5bc\ufe0f  Attach Image",
                      command=self._attach_image, **_btn_kw).pack(side="left")

        _PLACEHOLDER = "Describe what to audit, or leave blank for full analysis..."
        self._cmd_box = ctk.CTkTextbox(
            f, height=80,
            fg_color=PANEL, text_color=TEXT_DIM,
            border_color=BORDER, border_width=1,
            font=ctk.CTkFont(family="Consolas", size=11),
        )
        self._cmd_box.grid(row=2, column=0, sticky="nsew", padx=8, pady=4)
        self._cmd_box.insert("1.0", _PLACEHOLDER)
        self._cmd_box.bind("<FocusIn>",
                           lambda e: self._cmd_focus_in(_PLACEHOLDER))
        self._cmd_box.bind("<FocusOut>",
                           lambda e: self._cmd_focus_out(_PLACEHOLDER))

        self._run_btn = ctk.CTkButton(
            f, text="\U0001f680\nRUN\nAUDIT",
            width=108, height=80,
            fg_color=ACCENT, hover_color=ACCENT_DIM,
            text_color="white",
            font=ctk.CTkFont(family="Consolas", size=11, weight="bold"),
            corner_radius=6,
            command=self._start_audit,
        )
        self._run_btn.grid(row=2, column=1, sticky="ns", padx=(0, 8), pady=4)

        bot = ctk.CTkFrame(f, fg_color="transparent")
        bot.grid(row=3, column=0, columnspan=2, sticky="ew",
                 padx=8, pady=(0, 6))
        ctk.CTkButton(bot, text="\u2795  Add Files",
                      height=26, fg_color=PANEL_LIGHT,
                      hover_color=BORDER_ACT, border_width=1,
                      border_color=BORDER, text_color=TEXT_MID,
                      font=ctk.CTkFont(family="Consolas", size=10),
                      command=self._add_files).pack(side="left")

    def _cmd_focus_in(self, placeholder: str) -> None:
        cur = self._cmd_box.get("1.0", "end").strip()
        if cur == placeholder:
            self._cmd_box.delete("1.0", "end")
            self._cmd_box.configure(text_color=TEXT)

    def _cmd_focus_out(self, placeholder: str) -> None:
        cur = self._cmd_box.get("1.0", "end").strip()
        if not cur:
            self._cmd_box.insert("1.0", placeholder)
            self._cmd_box.configure(text_color=TEXT_DIM)

    def _get_cmd_text(self) -> str:
        placeholder = "Describe what to audit, or leave blank for full analysis..."
        raw = self._cmd_box.get("1.0", "end").strip()
        return "" if raw == placeholder else raw

    def _attach_file(self) -> None:
        paths = filedialog.askopenfilenames(
            title="Attach files",
            filetypes=[
                ("All supported",
                 "*.py *.r *.R *.rmd *.Rmd *.csv *.tsv *.xlsx *.xls "
                 "*.png *.jpg *.jpeg *.tiff *.bmp"),
                ("All files", "*.*"),
            ],
        )
        self._handle_dropped_files(list(paths))

    def _paste_code(self) -> None:
        try:
            code = self.clipboard_get()
        except tk.TclError:
            return
        tmp = Path.home() / ".viper_paste.py"
        tmp.write_text(code, encoding="utf-8")
        self._handle_dropped_files([str(tmp)])

    def _attach_image(self) -> None:
        paths = filedialog.askopenfilenames(
            title="Attach image",
            filetypes=[
                ("Images", "*.png *.jpg *.jpeg *.tiff *.bmp *.gif"),
                ("All files", "*.*"),
            ],
        )
        self._handle_dropped_files(list(paths))

    # ── Panel 4: Code + Report (right) ────────────────────────────────────────

    def _build_panel_code_report(self) -> None:
        self._build_right_code()
        self._build_right_report()

    def _build_right_code(self) -> None:
        f = self._code_frame
        f.grid_rowconfigure(1, weight=1)
        f.grid_columnconfigure(0, weight=1)

        hdr = ctk.CTkFrame(f, fg_color=HDR_BG, corner_radius=0, height=30)
        hdr.grid(row=0, column=0, sticky="ew")
        hdr.grid_propagate(False)
        ctk.CTkLabel(hdr, text="CODE / DATA PREVIEW",
                     font=ctk.CTkFont(family="Consolas", size=9, weight="bold"),
                     text_color=TEXT_DIM).pack(side="left", padx=8, pady=6)
        self._code_title_lbl = ctk.CTkLabel(
            hdr, text="",
            font=ctk.CTkFont(family="Consolas", size=9),
            text_color=TEXT_MID)
        self._code_title_lbl.pack(side="right", padx=8)

        self._code_box = ctk.CTkTextbox(
            f,
            fg_color=PANEL_MID, text_color=TEXT_MID,
            border_color=BORDER, border_width=0,
            font=ctk.CTkFont(family="Consolas", size=11),
            wrap="none", state="disabled",
        )
        self._code_box.grid(row=1, column=0, sticky="nsew")

    def _build_right_report(self) -> None:
        f = self._report_frame
        f.grid_rowconfigure(2, weight=1)
        f.grid_columnconfigure(0, weight=1)

        hdr = ctk.CTkFrame(f, fg_color=HDR_BG, corner_radius=0, height=30)
        hdr.grid(row=0, column=0, sticky="ew")
        hdr.grid_propagate(False)
        ctk.CTkLabel(hdr, text="AUDIT REPORT",
                     font=ctk.CTkFont(family="Consolas", size=9, weight="bold"),
                     text_color=TEXT_DIM).pack(side="left", padx=8, pady=6)

        self._grade_lbl = ctk.CTkLabel(
            hdr, text="",
            font=ctk.CTkFont(family="Consolas", size=16, weight="bold"),
            text_color=ACCENT)
        self._grade_lbl.pack(side="right", padx=12)

        leg = ctk.CTkFrame(f, fg_color=PANEL_MID, corner_radius=0, height=22)
        leg.grid(row=1, column=0, sticky="ew")
        leg.grid_propagate(False)
        for ico, clr, lbl in [
            ("\U0001f534", CRITICAL,  "Critical"),
            ("\u2702\ufe0f",  REFACTOR,  "Refactor"),
            ("\U0001f50d", INTERPRET, "Interpret"),
        ]:
            ctk.CTkLabel(leg, text=f"{ico} {lbl}",
                         font=ctk.CTkFont(family="Consolas", size=9),
                         text_color=clr).pack(side="left", padx=10, pady=3)

        self._report_box = _ReportBox(f, state="disabled")
        self._report_box.grid(row=2, column=0, sticky="nsew")

        bot = ctk.CTkFrame(f, fg_color=HDR_BG, corner_radius=0, height=36)
        bot.grid(row=3, column=0, sticky="ew")
        bot.grid_propagate(False)
        bot.columnconfigure(0, weight=1)

        self._export_btn = ctk.CTkButton(
            bot, text="Export Report",
            height=28, fg_color=PANEL_LIGHT,
            hover_color=BORDER_ACT, border_width=1,
            border_color=BORDER, text_color=TEXT_MID,
            font=ctk.CTkFont(family="Consolas", size=10),
            state="disabled",
            command=self._export_report,
        )
        self._export_btn.pack(side="left", fill="x", expand=True,
                              padx=(6, 4), pady=4)

        ctk.CTkButton(
            bot, text="\U0001f5d1", width=30, height=28,
            fg_color="transparent", hover_color=BORDER_ACT,
            border_width=1, border_color=BORDER, text_color=TEXT_DIM,
            command=lambda: self._show_placeholder(
                "\U0001f40d  Report cleared."),
        ).pack(side="right", padx=(0, 6), pady=4)

        self._show_placeholder(
            "\U0001f40d  Upload files and press  RUN AUDIT.")

    # ── File management ────────────────────────────────────────────────────────

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
            self._set_status(f"{len(self._files)} file(s) loaded.")
            self._preview_file(added[0])

    def _add_file_entry(self, p: Path) -> None:
        ext  = p.suffix.lower()
        icon = ("\U0001f5bc " if ext in IMG_EXTS else
                "\U0001f4ca " if ext in {".csv", ".tsv", ".xlsx", ".xls"}
                else "\U0001f4c4 ")
        row  = len(self._file_labels)
        btn  = ctk.CTkButton(
            self._file_scroll,
            text=f"{icon}{p.name}",
            anchor="w", height=26,
            fg_color="transparent", hover_color=PANEL_LIGHT,
            text_color=TEXT, font=ctk.CTkFont(family="Consolas", size=11),
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
        self._image_dz.restore_hint()
        self._img_name.configure(text="")
        self._update_code("", "")
        self._set_status("File list cleared.")

    def _preview_file(self, p: Path) -> None:
        self._active_file = p
        for fp, btn in self._file_labels.items():
            btn.configure(
                fg_color=ACCENT    if fp == p else "transparent",
                text_color="white" if fp == p else TEXT,
            )
        if p.suffix.lower() in IMG_EXTS and PIL_AVAILABLE:
            self._show_image(p)
        else:
            self._show_code(p)

    def _show_image(self, p: Path) -> None:
        try:
            img = Image.open(p)
            dw  = max(self._image_dz.winfo_width(),  400)
            dh  = max(self._image_dz.winfo_height(), 200)
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

    # ── Audit flow ─────────────────────────────────────────────────────────────

    def _start_audit(self) -> None:
        if self._audit_running:
            return
        if not self._files:
            messagebox.showwarning("No Files",
                                   "Please add or drop files before auditing.")
            return

        user_req = self._get_cmd_text()
        scripts  = [f for f in self._files
                    if f.suffix.lower() in {".py", ".r", ".R", ".rmd", ".Rmd"}]
        data     = [f for f in self._files
                    if f.suffix.lower() in {".csv", ".tsv", ".xlsx", ".xls"}]
        images   = [f for f in self._files if f.suffix.lower() in IMG_EXTS]

        self._clear_report_start()
        self._audit_running = True
        self._run_btn.configure(state="disabled",
                                text="\u23f3\nRunning\n...",
                                fg_color=ACCENT_DIM)
        self._stop_btn.configure(state="normal")
        self._progress_bar.pack(side="right", padx=12)
        self._progress_bar.start()
        self._set_status("\U0001f504  Auditing...")

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
        self._set_status("\u23f9  Audit stopped.")

    def _reset_audit_ui(self) -> None:
        self._audit_running = False
        self._run_btn.configure(state="normal",
                                text="\U0001f680\nRUN\nAUDIT",
                                fg_color=ACCENT)
        self._stop_btn.configure(state="disabled")
        try:
            self._progress_bar.stop()
            self._progress_bar.pack_forget()
        except Exception:
            pass

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
            self._set_status(f"\U0001f504  {msg.get('label', 'Processing...')}")
        elif t == "result":
            state = msg.get("state", {})
            self._display_results(state)
            self._save_to_history(state)
            self._reset_audit_ui()
            self._set_status("\u2705  Audit complete.")
        elif t == "error":
            err = msg.get("message", "Unknown error")
            self._reset_audit_ui()
            self._set_status(f"\u274c  {err}")
            self._report_box.configure(state="normal")
            self._report_box._textbox.delete("1.0", "end")
            self._report_box._ins(
                f"\U0001f534  Audit Error\n\n{err}\n", "critical")
            self._report_box.configure(state="disabled")

    # ── Report rendering ───────────────────────────────────────────────────────

    def _show_placeholder(self, text: str) -> None:
        self._report_box.configure(state="normal")
        self._report_box._textbox.delete("1.0", "end")
        self._report_box._ins(text, "dim")
        self._report_box.configure(state="disabled")

    def _clear_report_start(self) -> None:
        self._grade_lbl.configure(text="")
        self._export_btn.configure(state="disabled")
        self._report_text = ""
        self._show_placeholder("\U0001f504  Running audit...")

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
        self._grade_lbl.configure(text=grade, text_color=grade_fg)

        self._report_box.configure(state="normal")
        self._report_box._textbox.delete("1.0", "end")
        rb = self._report_box

        if summary:
            rb._ins("\U0001f4cb  Code Summary\n", "h2")
            rb._ins(summary[:800] + "\n\n")

        if findings:
            rb._ins("-" * 44 + "\n", "dim")
            rb._ins("FINDINGS\n\n", "h2")
            for fnd in findings:
                d   = (fnd.__dict__ if hasattr(fnd, "__dict__")
                       else fnd if isinstance(fnd, dict) else {})
                sev = str(d.get("severity", "interpret")).lower()
                tag = sev if sev in SEVERITY_COLOR else "interpret"
                ico = SEVERITY_ICON.get(sev, "\u26aa")
                rb._ins(
                    f"{ico} [{sev.upper()}]  {d.get('title', 'Finding')}\n",
                    tag)
                if d.get("file"):
                    rb._ins(f"  \U0001f4c1 {d['file']}", "dim")
                    if d.get("line_range"):
                        rb._ins(f"  L{d['line_range']}", "dim")
                    rb._ins("\n")
                if d.get("description"):
                    rb._ins(f"  {d['description']}\n")
                if d.get("suggestion"):
                    rb._ins(f"  \U0001f4a1 {d['suggestion']}\n", "interpret")
                rb._ins("\n")

        if report:
            rb._ins("-" * 44 + "\n", "dim")
            rb._ins("FULL REPORT\n\n", "h2")
            rb._append_markdown(report)

        self._report_box.configure(state="disabled")
        self._report_text = report or summary
        self._export_btn.configure(state="normal")

    def _save_to_history(self, state: dict) -> None:
        ts    = datetime.now().strftime("%m-%d  %H:%M")
        files = [f.name for f in self._files]
        title = ", ".join(files[:2]) if files else "Audit"
        entry = _HistoryEntry(ts=ts, title=title, state=state)
        self._history.append(entry)
        self._add_history_entry(entry)

    # ── Utils ──────────────────────────────────────────────────────────────────

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
            self._set_status(
                f"Report exported \u2192 {Path(path).name}")

    def _set_status(self, msg: str) -> None:
        self._status_label.configure(text=msg)
        logger.info(msg)

    def _on_close(self) -> None:
        if self._audit_running:
            if not messagebox.askyesno(
                    "Quit", "Audit is still running. Quit anyway?"):
                return
        self.master.destroy()
