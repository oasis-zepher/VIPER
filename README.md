# 🐍 VIPER — Bioinformatics Audit Agent

**V**ersatile **I**ntelligent **P**ipeline for **E**xpression **R**esearch — Audit Mode

> 一个运行在 Windows 环境下的本地桌面级多模态生物信息学**审计 Agent**。
> 作为用户的「第二大脑」，对生信分析脚本、统计方法、数据质量和可视化图表进行精细化审计与科学解读。

## 🎯 核心功能

### 🔴 Critical Audit — 致命问题检测
- 逻辑漏洞、统计误用（p 值校正、多重假设检验）
- ML 数据泄露检测（特征选择 / 标准化顺序）
- 路径硬编码冲突（Windows / macOS 兼容性）
- WGCNA soft power 选择审查

### ✂️ Refactor & Prune — 冗余清理
- Dead Code 检测（未使用的函数、导入、变量）
- 冗余依赖识别
- 一键瘦身重构建议清单

### 🔍 Multi-modal Interpret — 多模态科学解读
- 图表与代码参数一致性校验（PCA、热图、火山图、ROC）
- 终端报错截图穿透定位
- 基于领域知识的科学解读

## 🏗️ 架构

```
Ingester → Auditor → VisualAligner → Reporter
(文件解析)  (深度审计)  (视觉对齐)     (报告生成)
```

### 技术栈
- **LLM**: LangGraph + Gemini / OpenAI
- **UI**: Streamlit（赛博极客暗色主题）
- **打包**: PyInstaller → 独立 .exe

## 📁 项目结构

```
Viper/
├── app.py                      # Streamlit 主入口
├── launcher.py                 # PyInstaller 封装入口
├── agents/
│   ├── state.py                # 审计工作流状态机
│   ├── graph.py                # LangGraph 审计 DAG
│   ├── ingester.py             # 文件解析节点
│   ├── auditor.py              # 深度审计节点
│   ├── visual_aligner.py       # 多模态视觉对齐节点
│   └── reporter.py             # 审计报告生成节点
├── config/
│   ├── settings.py             # 全局配置
│   └── prompts.py              # 审计提示词
├── core/
│   ├── data_parser.py          # 数据文件解析器
│   ├── file_manager.py         # 跨平台文件管理
│   ├── project_manager.py      # 项目管理
│   └── chat_history.py         # 对话历史
├── ui/
│   ├── sidebar.py              # 左侧文件树面板
│   ├── dashboard.py            # 中央多模态看板
│   └── audit_report_panel.py   # 右侧审计报告面板
├── utils/
│   ├── logger.py               # 日志
│   ├── path_utils.py           # 跨平台路径工具
│   └── validators.py           # 校验工具
├── requirements.txt
├── viper.spec                  # PyInstaller 配置
└── build.bat                   # Windows 构建脚本
```

## 🚀 使用方法

### 开发模式
```bash
pip install -r requirements.txt
streamlit run app.py --server.port 8501
```

### 构建 .exe
```bash
build.bat
```

## 📊 UI 布局

| 左侧 | 中央 | 右侧 |
|-------|------|------|
| 文件树（拖拽 .R/.py/.csv） | 图表预览 + 代码高亮 | Viper 审计报告 |

## 💡 审计输出格式

```
🔴 [Critical] 标题
📁 文件: filename | 行: L12-L35
📝 描述: 具体问题
💡 建议: 修复方案 + 代码

✂️ [Refactor] 标题
📁 文件: filename
📝 描述: 冗余原因
💡 建议: 清理方案

🔍 [Interpret] 标题
📝 解读: 科学分析
📊 证据: 图表 / 代码支撑数据
```

## 📜 License

HUST Bioinformatics · Internal Use
