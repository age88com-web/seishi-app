#!/usr/bin/env python3
# tests/fixtures/gen_takujitsu_kichijin_group5.py
#
# docs/source/擇日実例.pdf の「吉凶神煞一覧表」から、第5グループのうち
# 区分A（実例PDFに出現する）神殺を抽出し、
# tests/fixtures/takujitsu_kichijin_group5.json を生成する。
#
# 対象: 不將・吉期・天巫・福徳・時陰・天醫・天喜・生氣・時陽
# 対象外（枝德・兵吉・大明）: 実例PDFに一度も出現しない
# （区分B、ロジック単体テストのみで検証。
#  tests/takujitsu_kichijin_group5_unit.manual.ts 参照）。
# 神在・七聖は監修判断により擇日アプリで不採用（2026-10-06。
#  src/lib/takujitsu/shinsatsu/excludedShinsatsu.ts）。
#
# 抽出方法は他グループの gen_takujitsu_kichijin*.py と同じ（月見出しで
# 12ヶ月に分割、各月60行に分割したうえで【吉神】本文の文字列一致を判定）。
# 詳細は gen_takujitsu_kichijin.py のコメントを参照。

import json
import re
from pathlib import Path

from pypdf import PdfReader

SRC = Path(__file__).resolve().parents[2] / "docs/source/擇日実例.pdf"
OUT = Path(__file__).resolve().parent / "takujitsu_kichijin_group5.json"

STEMS = "甲乙丙丁戊己庚辛壬癸"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
GANZHI60 = [STEMS[i % 10] + BRANCHES[i % 12] for i in range(60)]

MONTH_LABEL_TO_BRANCH = {
    "正月": "寅", "二月": "卯", "三月": "辰", "四月": "巳", "五月": "午", "六月": "未",
    "七月": "申", "八月": "酉", "九月": "戌", "十月": "亥", "十一月": "子", "十二月": "丑",
}

TARGET_NAMES = [
    "不將", "吉期", "天巫", "福徳", "時陰", "天醫", "天喜", "生氣", "時陽",
]

# フォントのCIDマッピング起因の文字化けで、資料本来の表記とは異なる字が
# 抽出される既知の変種（他グループと同じ判断基準。「不将」は実例PDF全体で
# 140件・「不精」8件・「不将」系の合計が擇日テキストp.10-11の月令別
# 固定リストの合計件数=150件と正確に一致することを確認済み）。
NAME_VARIANTS = {
    "不將": ["不将", "不精", "不小"],
    "天醫": ["天医", "天啓", "天腎", "天撃"],
    "生氣": ["生気"],
}


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


def extract_jitexts(seg: str):
    """各行の【吉神】本文を60件返す（他グループと同じ抽出方式）。"""
    seg = seg.replace("【青神】", "【吉神】")
    kyo_count = len(re.findall("【凶神】", seg))
    ji_count = len(re.findall("【吉神】", seg))
    if kyo_count == 60:
        pieces = re.split("【凶神】", seg)
        jitexts = []
        for i in range(60):
            piece = pieces[i] if i < len(pieces) else ""
            m = re.search(r"^(.*?)【吉神】(.*)$", piece, re.S)
            jitexts.append(m.group(2) if m else "")
        return jitexts
    elif ji_count == 60:
        ji_positions = [m.start() for m in re.finditer("【吉神】", seg)]
        jitexts = []
        for pos in ji_positions:
            end = re.search("【凶神】|【吉神】", seg[pos + 4:])
            jitexts.append(seg[pos + 4: pos + 4 + end.start()] if end else seg[pos + 4:])
        return jitexts
    else:
        raise AssertionError(f"neither anchor gives 60 rows (吉神={ji_count}, 凶神={kyo_count})")


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
        jitexts = extract_jitexts(seg)
        assert len(jitexts) == 60, f"{label}: expected 60 rows, got {len(jitexts)}"
        for i, jitext in enumerate(jitexts):
            ganzhi = GANZHI60[i]
            expected = target_names_in_text(jitext)
            rows.append({
                "monthLabel": label,
                "monthBranch": branch,
                "ganzhi": ganzhi,
                "dayStem": ganzhi[0],
                "dayBranch": ganzhi[1],
                "expectedKichijin": sorted(set(expected)),
            })

    assert len(rows) == 720

    out = {
        "_meta": {
            "source": "docs/source/擇日実例.pdf（吉凶神煞一覧表）",
            "description": (
                "擇日実例.pdf の日家吉凶神煞一覧表から、第5グループのうち"
                "実例PDFに出現する神殺（不將・吉期・天巫・福徳・時陰・"
                "天醫・天喜・生氣・時陽）を機械的に抽出した検証専用 fixture。"
                "仕様ではない。擇日ロジックの逆算・変更には使用しないこと。"
                "枝德・兵吉・大明はこの一覧表に一度も出現しない"
                "ため対象外（ロジック単体テストのみで検証）。"
                "神在・七聖は監修判断により擇日アプリで不採用。"
            ),
            "extraction": (
                "pypdf でページテキストを抽出し、月見出しで12ヶ月に分割、"
                "各月60行に分割したうえで【吉神】本文の文字列一致を判定した。"
            ),
            "notes": [
                "生成スクリプト: tests/fixtures/gen_takujitsu_kichijin_group5.py",
            ],
            "count": len(rows),
        },
        "rows": rows,
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
