"""
project_manager.py — 生信项目脚手架 & CRUD 管理
自动初始化标准项目结构:  data/ | scripts/ | results/ | report/ | .env
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, Union

from core.file_manager import FileManager
from utils.path_utils import (
    ensure_dir,
    get_default_storage_root,
    safe_path,
    sanitize_filename,
)
from utils.logger import get_logger

logger = get_logger(__name__)

# 标准项目子目录
_SCAFFOLD_DIRS = ["data", "scripts", "results", "results/figures", "report", "logs"]


class ProjectManager:
    """管理所有用户生信项目的创建、加载、列举。"""

    def __init__(self, storage_root: Optional[Union[str, Path]] = None):
        self.storage_root = (
            safe_path(storage_root) if storage_root else get_default_storage_root()
        )
        ensure_dir(self.storage_root)
        logger.info(f"ProjectManager 初始化，存储根: {self.storage_root}")

    # ------------------------------------------------------------------
    #  创建项目
    # ------------------------------------------------------------------

    def create_project(
        self,
        name: str,
        analysis_type: str = "general",
        description: str = "",
    ) -> dict[str, Any]:
        """
        创建一个新的标准生信项目文件夹。
        返回项目元数据 dict。
        """
        safe_name = sanitize_filename(name)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        project_id = f"{timestamp}_{safe_name}"
        project_dir = ensure_dir(self.storage_root / project_id)

        # 创建子目录
        for sub in _SCAFFOLD_DIRS:
            ensure_dir(project_dir / sub)

        # 创建 .env 文件
        env_content = (
            f"# Project: {name}\n"
            f"# Created: {datetime.now().isoformat()}\n"
            f"PROJECT_ROOT={project_dir}\n"
        )
        (project_dir / ".env").write_text(env_content, encoding="utf-8")

        # 元数据
        meta = {
            "project_id": project_id,
            "name": name,
            "analysis_type": analysis_type,
            "description": description,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "status": "initialized",
            "path": str(project_dir),
            "files": [],
        }
        meta_path = project_dir / "project_meta.json"
        meta_path.write_text(
            json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        # 自动生成 README.md
        readme_content = self._generate_readme(name, analysis_type, description)
        (project_dir / "README.md").write_text(readme_content, encoding="utf-8")

        # 自动生成 environment.yml 副本
        self._generate_project_env_yml(project_dir)

        logger.info(f"项目已创建: {project_dir}")
        return meta

    # ------------------------------------------------------------------
    #  项目列表 & 加载
    # ------------------------------------------------------------------

    def list_projects(self) -> list[dict[str, Any]]:
        """列出所有项目（按时间倒序）。"""
        projects = []
        if not self.storage_root.exists():
            return projects

        for d in sorted(self.storage_root.iterdir(), reverse=True):
            if d.is_dir():
                meta_file = d / "project_meta.json"
                if meta_file.exists():
                    try:
                        meta = json.loads(meta_file.read_text(encoding="utf-8"))
                        meta["path"] = str(d)
                        projects.append(meta)
                    except Exception as e:
                        logger.warning(f"读取项目元数据失败: {meta_file} — {e}")

        return projects

    def load_project(self, project_id: str) -> Optional[dict[str, Any]]:
        """按 ID 加载项目元数据。"""
        project_dir = self.storage_root / project_id
        meta_file = project_dir / "project_meta.json"
        if not meta_file.exists():
            return None
        meta = json.loads(meta_file.read_text(encoding="utf-8"))
        meta["path"] = str(project_dir)
        return meta

    def update_project_meta(self, project_id: str, updates: dict[str, Any]) -> None:
        """更新项目元数据。"""
        meta = self.load_project(project_id)
        if meta is None:
            raise ValueError(f"项目不存在: {project_id}")
        meta.update(updates)
        meta["updated_at"] = datetime.now().isoformat()
        meta_path = self.storage_root / project_id / "project_meta.json"
        meta_path.write_text(
            json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def get_file_manager(self, project_id: str) -> FileManager:
        """获取指定项目的 FileManager 实例。"""
        project_dir = self.storage_root / project_id
        if not project_dir.exists():
            raise ValueError(f"项目目录不存在: {project_dir}")
        return FileManager(project_dir)

    # ------------------------------------------------------------------
    #  代码写入（供 Coder Agent 调用）
    # ------------------------------------------------------------------

    def write_script(
        self, project_id: str, filename: str, content: str, sub_dir: str = "scripts"
    ) -> Path:
        """向项目写入脚本文件。"""
        fm = self.get_file_manager(project_id)
        rel = Path(sub_dir) / filename
        return fm.write_text(rel, content)

    def write_data(
        self, project_id: str, filename: str, content: str, sub_dir: str = "data"
    ) -> Path:
        fm = self.get_file_manager(project_id)
        rel = Path(sub_dir) / filename
        return fm.write_text(rel, content)

    # ------------------------------------------------------------------
    #  内部辅助
    # ------------------------------------------------------------------

    @staticmethod
    def _generate_readme(name: str, analysis_type: str, description: str) -> str:
        return f"""# {name}

**分析类型**: {analysis_type}
**创建时间**: {datetime.now().strftime('%Y-%m-%d %H:%M')}

## 项目描述

{description if description else '（待填写）'}

## 目录结构

```
├── data/           # 原始数据 & 中间数据
├── scripts/        # 分析脚本（Python / R）
├── results/        # 分析结果
│   └── figures/    # 图表输出
├── report/         # 分析报告
├── logs/           # 运行日志
├── .env            # 项目环境变量
└── README.md       # 本文件
```

## 复现步骤

```bash
python scripts/main.py
```
"""

    @staticmethod
    def _generate_project_env_yml(project_dir: Path) -> None:
        """为单个项目生成轻量 environment.yml。"""
        content = """name: viper
channels:
  - conda-forge
  - bioconda
  - defaults
dependencies:
  - python=3.11
  - pandas
  - numpy
  - scikit-learn
  - xgboost
  - matplotlib
  - seaborn
  - r-base=4.3
  - r-wgcna
  - r-ggplot2
  - r-limma
  - pip:
    - rpy2
    - openpyxl
"""
        (project_dir / "environment.yml").write_text(content, encoding="utf-8")
