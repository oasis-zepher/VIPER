#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
convert_icon.py — 将 PNG 图标转换为 ICO 格式
使用方法: python convert_icon.py viper_icon.png
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("需要安装 Pillow: pip install Pillow")
    sys.exit(1)


def png_to_ico(png_path: str, ico_path: str | None = None) -> str:
    """将 PNG 转换为多尺寸 ICO 文件。"""
    src = Path(png_path)
    if not src.exists():
        raise FileNotFoundError(f"找不到: {src}")

    dst = Path(ico_path) if ico_path else src.with_suffix(".ico")

    img = Image.open(src)
    # 生成多种尺寸
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(str(dst), format="ICO", sizes=sizes)
    print(f"[OK] ICO generated: {dst}")
    return str(dst)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python convert_icon.py <input.png> [output.ico]")
        sys.exit(1)

    in_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else None
    png_to_ico(in_path, out_path)
