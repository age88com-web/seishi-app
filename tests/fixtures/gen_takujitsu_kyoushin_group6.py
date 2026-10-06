#!/usr/bin/env python3
# tests/fixtures/gen_takujitsu_kyoushin_group6.py
#
# 凶神第6グループのうち monthBranch＋dayBranch だけで決まる4項目
# （月厭・厭對・受死日・刀砧日）を、docs/source/擇日実例.pdf の
# 「吉凶神煞一覧表」から抽出し、tests/fixtures/takujitsu_kyoushin_group6.json
# を生成する。
# それ以外の第6グループ項目（yearStem/yearBranch・lunarMonth・lunarDay・
# 二十八宿を使うもの）は、実例.pdfが月令＋日辰だけの抽象参照表で実際の
# 年月日を持たないため対象外（区分B、単体テストのみで検証）。
#
# 抽出方法は gen_takujitsu_kyoushin_group1〜4.py と同じ。

import json
import re
from pathlib import Path

from pypdf import PdfReader

SRC = Path(__file__).resolve().parents[2] / "docs/source/擇日実例.pdf"
OUT = Path(__file__).resolve().parent / "takujitsu_kyoushin_group6.json"

STEMS = "甲乙丙丁戊己庚辛壬癸"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
GANZHI60 = [STEMS[i % 10] + BRANCHES[i % 12] for i in range(60)]

MONTH_LABEL_TO_BRANCH = {
    "正月": "寅", "二月": "卯", "三月": "辰", "四月": "巳", "五月": "午", "六月": "未",
    "七月": "申", "八月": "酉", "九月": "戌", "十月": "亥", "十一月": "子", "十二月": "丑",
}

TARGET_NAMES = ["月厭", "厭對", "受死日", "刀砧日"]

# フォントのCIDマッピング起因の異体字・本文併記の別名（原本画像・本文で確認済み）。
NAME_VARIANTS: dict[str, list[str]] = {
    "月厭": ["地火"],
    "厭對": ["招搖"],
}

ROW_HEADER_PAT = re.compile(r"[金木水火土].[建除滿满満平定執破危成收収開関閉滞][日目]")


def load_segments():
    reader = PdfReader(str(SRC))
    raw = "".join((p.extract_text() or "") for p in reader.pages)
    full = re.sub(r"[\s　]+", "", raw)
    headers = list(re.finditer(
        r"([正一二三四五六七八九十]{1,3}月)（始([^終]{1,4})終([^）]{1,4})）", full,
    ))
    segments = []
    for i, m in enumerate(headers):
        label = m.group(1)
        start = m.end()
        end = headers[i + 1].start() if i + 1 < len(headers) else len(full)
        segments.append((label, MONTH_LABEL_TO_BRANCH[label], full[start:end]))
    return segments


def extract_kyotexts(seg: str) -> list[str]:
    matches = list(ROW_HEADER_PAT.finditer(seg))
    assert len(matches) >= 60, f"only {len(matches)} row headers found"
    matches = matches[:60]

    kyotexts = []
    for i in range(60):
        start = matches[i].end()
        end = matches[i + 1].start() if i + 1 < 60 else len(seg)
        rowtext = seg[start:end]
        m = re.search(r"【凶神】(.*)$", rowtext, re.S)
        kyotexts.append(m.group(1) if m else "")
    return kyotexts


def target_names_in_text(text: str) -> list[str]:
    found = []
    for name in TARGET_NAMES:
        variants = [name, *NAME_VARIANTS.get(name, [])]
        if any(v in text for v in variants):
            found.append(name)
    return found


def main():
    segments = load_segments()
    assert len(segments) == 12, f"expected 12 months, got {len(segments)}"

    rows = []
    for label, branch, seg in segments:
        kyotexts = extract_kyotexts(seg)
        assert len(kyotexts) == 60, f"{label}: expected 60 rows, got {len(kyotexts)}"
        for i, kyotext in enumerate(kyotexts):
            ganzhi = GANZHI60[i]
            expected = target_names_in_text(kyotext)
            rows.append({
                "monthLabel": label,
                "monthBranch": branch,
                "ganzhi": ganzhi,
                "dayStem": ganzhi[0],
                "dayBranch": ganzhi[1],
                "expectedKyojin": sorted(set(expected)),
            })

    assert len(rows) == 720

    out = {
        "_meta": {
            "source": "docs/source/擇日実例.pdf（吉凶神煞一覧表・【凶神】欄）",
            "description": (
                "擇日実例.pdf の日家吉凶神煞一覧表の【凶神】欄から、凶神第6グループの"
                "うち monthBranch＋dayBranch だけで決まる4項目（月厭・厭對・受死日・"
                "刀砧日）を機械的に抽出した検証専用 fixture。仕様ではない。"
                "擇日ロジックの逆算・変更には使用しないこと。"
            ),
            "extraction": (
                "pypdf でページテキストを抽出し、月見出しで12ヶ月に分割、"
                "各行冒頭の「五行+分類+十二建+日|目」という見出しパターンで"
                "60行の区切り位置を検出したうえで、各行の【凶神】欄の"
                "文字列一致を判定した。"
            ),
            "notes": [
                "生成スクリプト: tests/fixtures/gen_takujitsu_kyoushin_group6.py",
                "月厭は実例PDFでは本文併記の別名「地火」でも出現する。",
                "厭對は実例PDFでは本文併記の別名「招搖」でも出現する。",
            ],
            "count": len(rows),
        },
        "rows": rows,
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
