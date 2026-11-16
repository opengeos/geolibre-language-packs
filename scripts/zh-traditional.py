"""Derive the Traditional Chinese translation memories from the Simplified one.

Usage (needs ``pip install opencc``)::

    python scripts/zh-traditional.py            # writes zh-TW, zh-HK and zh-MO
    node scripts/build.mjs zh-TW && node scripts/build.mjs zh-HK && node scripts/build.mjs zh-MO
    node scripts/reindex.mjs

``translations/zh.json`` is the source. Taiwan uses OpenCC's ``s2twp`` config
(Taiwan characters and phrasing) plus the term fixes below. Hong Kong uses
``s2hk`` (Hong Kong characters, Hong Kong vocabulary), and Macau, which follows
Hong Kong conventions and has no OpenCC config of its own, gets the same text.
All three switch “…” quotes to 「…」. GeoLibre's bundled zh-TW/zh-HK/zh-MO
interface catalogs are generated the same way, so the two stay consistent.
"""

import json
import re
import sys
from pathlib import Path

import opencc

TRANSLATIONS = Path(__file__).resolve().parent.parent / "translations"

# (locale, OpenCC config). Macau reuses the Hong Kong conversion.
TARGETS = [("zh-TW", "s2twp"), ("zh-HK", "s2hk"), ("zh-MO", "s2hk")]

# Taiwan software and GIS terms that s2twp leaves in mainland form or gets
# wrong. Applied in order, so a specific phrase must come before the shorter
# term it contains (本地時間 before 本地), and a later pair can undo an earlier
# one where the general rule misfires (暗物件 back to 暗物體, "dark object").
TAIWAN_TERMS = [
    ("例項", "實例"),
    ("計算機", "電腦"),
    ("訪問順序", "造訪順序"),
    ("訪問", "存取"),
    ("憑據", "憑證"),
    ("數據", "資料"),
    ("菜單", "選單"),
    ("質量", "品質"),
    ("響應", "回應"),
    ("示例", "範例"),
    ("運行", "執行"),
    ("瓦片", "圖磚"),
    ("令牌", "權杖"),
    ("型別", "類型"),
    ("許可權", "權限"),
    ("IP 地址", "IP 位址"),
    ("文本框", "文字方塊"),
    ("幫助文本", "說明文字"),
    ("文本", "文字"),
    ("搜索", "搜尋"),
    ("本地時間", "當地時間"),
    ("本地日期", "當地日期"),
    ("本地", "本機"),
    ("隸屬函式", "隸屬函數"),
    ("核函式", "核函數"),
    ("變異函式", "變異函數"),
    ("保存", "儲存"),
    ("憑證程序", "憑證程式"),
    ("置信度", "信賴度"),
    ("檢測", "偵測"),
    ("物體", "物件"),
    ("暗物件", "暗物體"),
    ("項目", "專案"),
]

# 通過 means "via" (透過 in Taiwan) except where it means "passed".
VIA = re.compile(r"通過(?!篩選|驗證|測試|檢查)")


def taiwan_terms(text):
    """Apply the Taiwan term fixes to text already converted by s2twp.

    Args:
        text: A Traditional Chinese string produced by OpenCC ``s2twp``.

    Returns:
        The string with Taiwan software and GIS terminology.
    """
    if text == "幫助":  # the Help menu reads 說明 in Taiwan software
        return "說明"
    for simplified_form, taiwan_form in TAIWAN_TERMS:
        text = text.replace(simplified_form, taiwan_form)
    return VIA.sub("透過", text)


def corner_quotes(text):
    """Replace curly quotes with the corner brackets used in Traditional Chinese.

    Args:
        text: The string to rewrite.

    Returns:
        The string with “…” as 「…」 and ‘…’ as 『…』.
    """
    text = re.sub(r"“([^“”]*)”", r"「\1」", text)
    return re.sub(r"‘([^‘’]*)’", r"『\1』", text)


def convert_memory(memory, config):
    """Convert every translation in a memory, keeping its English keys and order.

    Args:
        memory: The Simplified Chinese memory, ``{english: translation}``.
        config: The OpenCC config name, such as ``s2twp`` or ``s2hk``.

    Returns:
        A new memory with Traditional Chinese translations.
    """
    converter = opencc.OpenCC(config)
    out = {}
    for english, simplified in memory.items():
        text = converter.convert(simplified)
        if config == "s2twp":
            text = taiwan_terms(text)
        out[english] = corner_quotes(text)
    return out


def main():
    """Write the Traditional Chinese memories next to ``translations/zh.json``."""
    memory = json.loads((TRANSLATIONS / "zh.json").read_text(encoding="utf-8"))
    for locale, config in TARGETS:
        converted = convert_memory(memory, config)
        path = TRANSLATIONS / f"{locale}.json"
        path.write_text(json.dumps(converted, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{path.relative_to(TRANSLATIONS.parent)}: {len(converted)} strings ({config})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
