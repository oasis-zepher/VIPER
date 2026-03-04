# VIPER — Project Status & Handoff Document

> **用途**：新对话开始时，直接让 AI 读取本文件，即可还原完整项目背景。  
> **最后更新**：2026-03-04  
> **GitHub**：https://github.com/oasis-zepher/VIPER  （branch: `main`，last commit: `ab922ab`）

---

## 1. 项目简介

**VIPER** = **V**isual **I**nspection & **P**ipeline **E**valuation **R**eporter  
定位：**生物信息学代码审计代理（Bioinformatics Audit Agent）**

用户上传 Python/R 脚本、数据文件（CSV/Excel）、图片，系统通过多 LLM + LangGraph 流水线自动审计代码质量、数据处理逻辑、可视化一致性，输出分级报告（A–F 评分 + Critical/Refactor/Interpret 三级问题列表）。

### 技术栈

| 层 | 技术 |
|---|---|
| GUI | `customtkinter 5.2.2` + `tkinterdnd2`（拖拽） |
| 图像 | `Pillow`（PIL） |
| Agent 框架 | `LangGraph` + `LangChain` |
| LLM 支持 | Google Gemini / OpenAI GPT / Anthropic Claude / DeepSeek / Qwen / Kimi / GLM |
| 数据解析 | `pandas`、`openpyxl` |
| 打包 | `PyInstaller 6.19.0`，onedir 模式 |
| Python 环境 | `.venv`，Python 3.11.14，包管理器 `uv` |
| 项目根 | `e:\CENTER\Agent\Viper\` |

---

## 2. 项目结构

```
Viper/
├── app.py                  ← 入口点（两阶段启动：Auth → Main）
├── viper.spec              ← PyInstaller onedir spec
├── requirements.txt
├── environment.yml
├── .env                    ← API Keys（不进 git）
│
├── agents/                 ← LangGraph 节点
│   ├── graph.py            ← DAG 定义
│   ├── state.py            ← WorkflowStage 枚举 + 状态 schema
│   ├── ingester.py         ← 节点1：解析脚本/数据/图片
│   ├── auditor.py          ← 节点2：代码审计
│   ├── visual_aligner.py   ← 节点3：图表一致性检查（可选）
│   └── reporter.py         ← 节点4：生成 A-F 评分报告
│
├── config/
│   ├── settings.py         ← 全局配置（从 .env 读取）
│   └── prompts.py          ← LLM 提示词
│
├── core/
│   ├── data_parser.py      ← CSV/Excel 解析
│   ├── file_manager.py
│   ├── project_manager.py
│   └── chat_history.py
│
├── ui/
│   ├── app.py              ← （与根 app.py 不同）旧文件，已弃用
│   ├── auth_window.py      ← API Key 配置窗口（ctk.CTk 根窗口）
│   ├── main_window.py      ← 主界面（ctk.CTkFrame，四面板）
│   └── audit_engine.py     ← 后台线程 + Queue 桥接 LangGraph
│
├── utils/
│   ├── logger.py
│   ├── path_utils.py
│   └── validators.py
│
├── templates/              ← Jinja2 模板（R/Python 代码生成辅助）
├── assets/
│   └── viper_icon.ico
└── dist/
    └── VIPER/
        └── VIPER.exe       ← 当前可用的 onedir EXE（23 MB）
```

---

## 3. LangGraph 审计流水线

```
用户输入（脚本 + 数据文件 + 图片 + 指令）
        │
        ▼
  ┌─────────────┐
  │  Ingester   │  解析所有文件，构建 state dict
  └──────┬──────┘
         │  成功 → Auditor；失败 → END
         ▼
  ┌─────────────┐
  │   Auditor   │  LLM 审计代码逻辑、统计方法、命名规范
  └──────┬──────┘
         │  有图表 → VisualAligner；无图表 → Reporter
         ▼
  ┌──────────────────┐       ┌──────────────┐
  │  VisualAligner   │──────►│   Reporter   │  生成 A-F 评分 + 问题列表
  │ (图表一致性检查)  │       └──────┬───────┘
  └──────────────────┘              │
                                    ▼
                                   END  → Queue → UI
```

**state dict 关键字段**：
- `scripts`：`list[dict]` — `{filename, path, language, content}`
- `data_files`：`list[dict]` — 解析后的 DataFrame 摘要
- `images`：`list[dict]` — `{filename, base64, mime}`
- `user_request`：用户指令文本
- `audit_findings`：`list[Finding]` — 代码问题
- `visual_findings`：`list[Finding]` — 图表问题
- `audit_report`：完整 Markdown 报告文本
- `code_summary`：代码摘要
- `stage`：`WorkflowStage` 枚举值

---

## 4. UI 架构

### 启动流程（app.py）

```
main()
  └── ViperApp.run()
        ├── 有 API Key → _run_main()  →  ctk.CTk() + MainWindow + mainloop()
        └── 无 API Key → AuthWindow (ctk.CTk 根).mainloop()
                          └── 验证成功后 destroy()
                              └── _run_main()  →  ctk.CTk() + MainWindow + mainloop()
```

**关键设计决策**：`AuthWindow` 继承 `ctk.CTk`（它本身是 Tk 根），`MainWindow` 继承 `ctk.CTkFrame`（挂载到外部传入的 `ctk.CTk()` 上）。同一进程中任何时刻只有一个 Tk 根。

### 主窗口四面板（main_window.py）

```
┌────────────────────────────────────────────────────────────────────────┐
│  VIPER  ·  Bioinformatics Audit System                    [Header 48px]│
├──────────┬──────────────────────────┬───────────────────────────────────┤
│  AUDIT   │    IMAGE VIEWER          │   CODE / DATA PREVIEW             │
│ HISTORY  │  (拖拽区 _Dropzone)       │   (_code_box，只读 Consolas)       │
│          │                          ├───────────────────────────────────┤
│ [时间戳] │                          │   AUDIT REPORT                    │
│ [文件名] ├──────────────────────────┤   [Grade 标签 A-F]                │
│          │    COMMAND HUB           │   [🔴Critical / ✂️Refactor / 🔍]  │
│ LOADED   │  📎挂载 📄粘贴 🖼️图片    │   (_ReportBox 富文本)             │
│  FILES   │  [_cmd_box 多行输入]     │   [Export] [🗑]                   │
│  [列表]  │  [🚀 RUN AUDIT]          │                                   │
└──────────┴──────────────────────────┴───────────────────────────────────┘
│  Ready.                                              [Stop]  [StatusBar]│
└────────────────────────────────────────────────────────────────────────┘
```

**布局实现**：`tk.PanedWindow`（水平）+ 两个内嵌 `tk.PanedWindow`（垂直），sash 可拖拽调整。

**主要组件类**：
- `_HistoryEntry(ts, title, state)` — 历史记录数据类
- `_Dropzone(tk.Frame)` — 霓虹紫虚线拖拽区（Canvas 自绘）
- `_ReportBox(ctk.CTkTextbox)` — 带语义颜色 tag 的富文本框，支持基础 Markdown
- `MainWindow(ctk.CTkFrame)` — 主窗口，982 行

**主题色**：
```python
BG="#0B0B0B"  ACCENT="#B026FF"  CRITICAL="#FF3B3B"
REFACTOR="#FF9500"  INTERPRET="#00BFFF"  SUCCESS="#00FF88"
```

### audit_engine.py — 后台线程桥接

```python
engine = AuditEngine()
q = engine.start_audit(scripts, data_files, images, user_request)
# 主线程每 100ms poll q:
# {"type": "progress", "label": "..."}
# {"type": "result",   "state": {...}}
# {"type": "error",    "message": "..."}
```

---

## 5. API Key 管理

- **存储位置**：`~/.viper/.env`（用户数据目录，EXE 打包后可写）或项目根 `.env`
- **支持提供商**：Google Gemini / OpenAI / Anthropic Claude / DeepSeek / Qwen（DashScope） / Kimi（Moonshot） / GLM（智谱）
- **鉴权逻辑**：`_has_valid_key()` 检查任意 Key 长度 ≥ 8 即视为有效
- **Auth 界面**：`ui/auth_window.py`，带下拉提供商选择、模型选择、Key 输入验证、保存到 `.env`

---

## 6. PyInstaller 打包

```
# spec 文件：viper.spec
模式：onedir（不是 onefile，启动无解压等待）
入口：app.py
图标：assets/viper_icon.ico
控制台：False（console=False）
输出：dist/VIPER/VIPER.exe   ← 实际启动文件

# 构建命令：
pyinstaller viper.spec --clean -y

# 崩溃日志（EXE 无 console 时）：
~/.viper/crash.log
```

**hiddenimports 中的重要项**（已在 spec 声明）：
`langchain`, `langchain_core`, `langgraph`, `langchain_google_genai`, `langchain_openai`, `langchain_anthropic`, `PIL`, `customtkinter`, `tkinterdnd2`, `pandas`, `openpyxl`, `pydantic`, `jinja2`, `tiktoken`

**已知构建 WARNING（不影响运行）**：
- `langchain.schema`、`langchain_community`、`python_dotenv` hidden import not found（实际功能正常）

---

## 7. 当前完成状态

### 已完成 ✅

| 模块 | 状态 |
|---|---|
| LangGraph DAG（4节点流水线） | ✅ 完成 |
| 多 LLM 支持（7家提供商） | ✅ 完成 |
| `ui/auth_window.py`（API Key 配置） | ✅ 完成 |
| `ui/main_window.py`（四面板布局） | ✅ 完成（982行） |
| `ui/audit_engine.py`（后台线程+Queue） | ✅ 完成 |
| `app.py`（单根窗口两阶段启动） | ✅ 完成 |
| PyInstaller onedir 打包 | ✅ 完成，EXE 23MB |
| EXE 运行测试（无闪退） | ✅ 通过 |
| GitHub 推送 | ✅ `ab922ab` |
| 崩溃日志机制 | ✅ `~/.viper/crash.log` |

### 待完成 / 已知问题 ⚠️

| 项目 | 说明 |
|---|---|
| 历史记录持久化 | `_load_history()` 目前是 `pass`，未实现 JSON 存储 |
| 粘贴代码功能 | `_paste_code()` 写到 `~/.viper_paste.py`，临时方案 |
| R 脚本执行环境 | 未集成本地 R 运行环境检测 |
| 导出格式 | 目前只支持 `.md`，未支持 PDF |
| 单元测试 | 无测试覆盖 |
| 深色/浅色主题切换 | 硬编码深色 |

---

## 8. 关键 Bug 修复历史

| Commit | 问题 | 修复 |
|---|---|---|
| `b24446f` | `email` 模块被排除导致 `importlib.metadata` 崩溃 | 从 excludes 移除 |
| `8e0d26c` | main_window.py 编码损坏（UTF-8 被 GBK 读取） | 整体重写 982 行 |
| `af76528` | `MainWindow.__init__()` missing argument 'engine' | app.py 传入 AuditEngine |
| `ab922ab` | EXE 双 Tk 根崩溃（AuthWindow IS ctk.CTk vs self._root） | 单根两阶段架构 |

---

## 9. 继续开发指引

### 环境激活

```powershell
cd e:\CENTER\Agent\Viper
.venv\Scripts\Activate.ps1   # 或直接用 uv run
```

### 运行（不打包）

```powershell
.venv\Scripts\python.exe app.py
```

### 重建 EXE

```powershell
# 先关闭旧 EXE 进程，再：
Get-Process VIPER -EA SilentlyContinue | Stop-Process -Force
Remove-Item -Recurse -Force dist\VIPER -EA SilentlyContinue
.venv\Scripts\pyinstaller.exe viper.spec --clean -y
# 输出：dist\VIPER\VIPER.exe
```

### 调试 EXE 崩溃

```powershell
# 崩溃日志位置：
Get-Content "$env:USERPROFILE\.viper\crash.log"
```

### Git 工作流

```powershell
git add -A
git commit -m "feat/fix/refactor: ..."
git push origin main
```

---

## 10. 下一步建议

优先级排序：

1. **功能**：实现历史记录持久化（JSON 写入 `~/.viper/history.json`，启动时 `_load_history()` 读取）
2. **体验**：`_paste_code()` 改为弹出 `CTkToplevel` 文本框让用户直接粘贴，而非写临时文件
3. **健壮性**：加入 `agents/` 各节点的错误重试（`tenacity`，已在依赖中）
4. **测试**：为 `audit_engine.py` 和各 agent 节点编写 `pytest` 单元测试
5. **打包**：考虑自动构建流程（GitHub Actions → release artifact）
