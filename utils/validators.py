"""
validators.py — 输入校验工具
用于校验用户上传的数据文件、脚本文件、图表及参数合法性等。
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

SUPPORTED_DATA_EXTENSIONS = {
    ".csv", ".tsv", ".txt", ".xlsx", ".xls",
    ".fastq", ".fq", ".fastq.gz", ".fq.gz",
    ".bam", ".sam", ".vcf", ".bed", ".gff", ".gtf",
}

SUPPORTED_SCRIPT_EXTENSIONS = {
    ".py", ".r", ".rmd",
}

SUPPORTED_IMAGE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".bmp", ".svg", ".webp",
}

SUPPORTED_DOC_EXTENSIONS = {".pdf"}

MAX_INLINE_SIZE_MB = 500


def validate_file_extension(filename: str) -> tuple[bool, str]:
    """检查文件扩展名是否受支持（数据、脚本、图表、文档）。"""
    p = Path(filename)
    suffixes = "".join(p.suffixes).lower()

    all_supported = (
        SUPPORTED_DATA_EXTENSIONS
        | SUPPORTED_SCRIPT_EXTENSIONS
        | SUPPORTED_IMAGE_EXTENSIONS
        | SUPPORTED_DOC_EXTENSIONS
    )

    for ext in all_supported:
        if suffixes.endswith(ext):
            return True, ext

    return False, suffixes


def is_expression_matrix(columns: list[str]) -> tuple[bool, str]:
    """
    简单启发式判断是否为表达矩阵：
    - 第一列通常为 Gene / Protein ID
    - 其余列为样本名（数值型）
    """
    if len(columns) < 2:
        return False, "列数不足，至少需要 ID 列 + 1 个样本列"

    id_col = columns[0].lower()
    id_keywords = ["gene", "protein", "id", "symbol", "accession", "name", "uniprot", "ensembl"]

    has_id = any(kw in id_col for kw in id_keywords)
    if not has_id:
        return False, f"首列 '{columns[0]}' 不像常见的 ID 列（预期包含 gene/protein/id 等关键词）"

    return True, "OK"


def validate_soft_power(value) -> tuple[bool, str]:
    """校验 WGCNA soft power 参数。"""
    try:
        val = int(value)
        if 1 <= val <= 30:
            return True, "OK"
        return False, f"Soft power {val} 超出合理范围 [1, 30]"
    except (ValueError, TypeError):
        return False, f"Soft power 必须为整数，收到: {value}"


def validate_pvalue_threshold(value) -> tuple[bool, str]:
    """校验 p-value 阈值。"""
    try:
        val = float(value)
        if 0 < val <= 1:
            return True, "OK"
        return False, f"p-value 阈值 {val} 应在 (0, 1] 范围内"
    except (ValueError, TypeError):
        return False, f"p-value 阈值必须为数值，收到: {value}"


def validate_log2_transformed(sample_values: list[float]) -> bool:
    """
    启发式判断数据是否已做 Log2 转化。
    如果大部分值 < 30 且存在负值，大概率已转化。
    """
    if not sample_values:
        return False

    max_val = max(sample_values)
    min_val = min(sample_values)

    # 未转化的表达量通常 >> 30
    if max_val > 50:
        return False

    # Log2 值通常范围 [-5, 25]
    if min_val < 0 and max_val < 30:
        return True

    # 中等范围也可能已转化
    if max_val < 25:
        return True

    return False
