"""
data_parser.py — 数据文件解析器
支持 CSV / TSV / Excel / FASTQ / BAM 等生信常见格式。
大文件（>500 MB）仅读取前 100 行进行结构解析。
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any, Optional, Union

import pandas as pd

from utils.path_utils import safe_path, is_large_file
from utils.validators import validate_file_extension, is_expression_matrix, validate_log2_transformed
from utils.logger import get_logger

logger = get_logger(__name__)

# 大文件阈值 (MB)
LARGE_FILE_THRESHOLD = 500
# 预览行数
PREVIEW_ROWS = 100


class DataParser:
    """生信数据文件解析器。"""

    def parse_file(
        self,
        file_path: Union[str, Path],
        n_rows: Optional[int] = PREVIEW_ROWS,
    ) -> dict[str, Any]:
        """
        统一入口：根据扩展名分发到对应解析器。
        返回字典包含:
          - filename, extension, size_mb
          - is_large_file: bool
          - columns: list[str] | None
          - shape: (rows, cols) | None
          - preview: DataFrame.to_dict() 前 n_rows | None
          - data_report: 描述性统计或元信息字符串
          - is_expression_matrix: bool
          - is_log2_transformed: bool | None
        """
        p = safe_path(file_path)
        if not p.exists():
            raise FileNotFoundError(f"文件不存在: {p}")

        valid, ext = validate_file_extension(p.name)
        if not valid:
            raise ValueError(f"不支持的文件格式: {ext}")

        size_mb = p.stat().st_size / (1024 * 1024)
        large = size_mb > LARGE_FILE_THRESHOLD

        result: dict[str, Any] = {
            "filename": p.name,
            "extension": ext,
            "size_mb": round(size_mb, 2),
            "is_large_file": large,
            "absolute_path": str(p),
            "columns": None,
            "shape": None,
            "preview": None,
            "data_report": "",
            "is_expression_matrix": False,
            "is_log2_transformed": None,
        }

        if ext in (".csv", ".tsv", ".txt"):
            self._parse_tabular(p, ext, n_rows, large, result)
        elif ext in (".xlsx", ".xls"):
            self._parse_excel(p, n_rows, large, result)
        elif ext in (".fastq", ".fq", ".fastq.gz", ".fq.gz"):
            self._parse_fastq(p, result)
        elif ext in (".bam", ".sam"):
            self._parse_alignment(p, result)
        elif ext == ".pdf":
            self._parse_pdf(p, result)
        else:
            result["data_report"] = f"文件格式 {ext} 暂不支持详细解析，仅记录路径。"

        return result

    # ------------------------------------------------------------------
    #  表格数据 (CSV / TSV / TXT)
    # ------------------------------------------------------------------

    def _parse_tabular(
        self, path: Path, ext: str, n_rows: Optional[int], large: bool, result: dict
    ) -> None:
        sep = "\t" if ext in (".tsv", ".txt") else ","

        try:
            if large:
                logger.info(f"大文件模式: 仅读取前 {n_rows} 行 — {path.name}")
                df = pd.read_csv(path, sep=sep, nrows=n_rows, low_memory=False)
                result["data_report"] = (
                    f"⚠️ 大文件 ({result['size_mb']} MB)，仅预览前 {n_rows} 行。\n"
                )
            else:
                df = pd.read_csv(path, sep=sep, low_memory=False)

            self._fill_dataframe_info(df, result)

        except Exception as e:
            result["data_report"] = f"解析失败: {e}"
            logger.error(f"解析表格文件失败: {path} — {e}")

    # ------------------------------------------------------------------
    #  Excel
    # ------------------------------------------------------------------

    def _parse_excel(
        self, path: Path, n_rows: Optional[int], large: bool, result: dict
    ) -> None:
        try:
            if large:
                df = pd.read_excel(path, nrows=n_rows)
                result["data_report"] = (
                    f"⚠️ 大文件 ({result['size_mb']} MB)，仅预览前 {n_rows} 行。\n"
                )
            else:
                df = pd.read_excel(path)

            self._fill_dataframe_info(df, result)

        except Exception as e:
            result["data_report"] = f"解析失败: {e}"
            logger.error(f"解析 Excel 失败: {path} — {e}")

    # ------------------------------------------------------------------
    #  FASTQ (仅统计概要)
    # ------------------------------------------------------------------

    def _parse_fastq(self, path: Path, result: dict) -> None:
        try:
            count = 0
            opener = open
            import gzip

            if str(path).endswith(".gz"):
                opener = gzip.open  # type: ignore

            with opener(path, "rt") as f:  # type: ignore
                for i, line in enumerate(f):
                    if i >= 400:  # 仅扫描前 100 reads
                        break
                    if i % 4 == 0:
                        count += 1

            result["data_report"] = (
                f"FASTQ 文件，预览前 {count} 条 reads。\n"
                f"完整 read 数需运行 `wc -l` 或 `seqkit stats`。"
            )
        except Exception as e:
            result["data_report"] = f"FASTQ 解析受限: {e}"

    # ------------------------------------------------------------------
    #  BAM / SAM (仅记录路径)
    # ------------------------------------------------------------------

    def _parse_alignment(self, path: Path, result: dict) -> None:
        result["data_report"] = (
            f"比对文件 ({path.suffix.upper()})，大小 {result['size_mb']} MB。\n"
            f"需使用 samtools 进行详细解析。"
        )

    # ------------------------------------------------------------------
    #  PDF 文献
    # ------------------------------------------------------------------

    def _parse_pdf(self, path: Path, result: dict) -> None:
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(str(path))
            n_pages = len(reader.pages)
            # 提取前 3 页文本摘要
            text_preview = ""
            for i in range(min(3, n_pages)):
                page_text = reader.pages[i].extract_text() or ""
                text_preview += page_text[:1000] + "\n---\n"

            result["data_report"] = (
                f"PDF 文件，共 {n_pages} 页。\n前 3 页摘要:\n{text_preview[:3000]}"
            )
        except Exception as e:
            result["data_report"] = f"PDF 解析失败: {e}"

    # ------------------------------------------------------------------
    #  辅助方法
    # ------------------------------------------------------------------

    def _fill_dataframe_info(self, df: pd.DataFrame, result: dict) -> None:
        """从 DataFrame 提取通用统计信息。"""
        result["columns"] = list(df.columns)
        result["shape"] = df.shape
        result["preview"] = df.head(20).to_dict(orient="records")

        # 判断是否为表达矩阵
        is_expr, msg = is_expression_matrix(list(df.columns))
        result["is_expression_matrix"] = is_expr

        # 判断是否已 Log2 转化
        if is_expr:
            numeric_cols = df.select_dtypes(include="number").columns
            if len(numeric_cols) > 0:
                sample_vals = df[numeric_cols[0]].dropna().head(200).tolist()
                result["is_log2_transformed"] = validate_log2_transformed(sample_vals)

        # 描述性统计
        buf = io.StringIO()
        df.info(buf=buf, verbose=False)
        info_str = buf.getvalue()

        desc = df.describe(include="all").to_string()
        missing = df.isnull().sum()
        missing_str = missing[missing > 0].to_string() if missing.any() else "无缺失值"

        result["data_report"] += (
            f"Shape: {df.shape[0]} 行 × {df.shape[1]} 列\n\n"
            f"--- DataFrame Info ---\n{info_str}\n"
            f"--- 缺失值 ---\n{missing_str}\n\n"
            f"--- Describe ---\n{desc}\n"
        )
