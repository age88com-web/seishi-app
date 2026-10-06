#!/usr/bin/env python3
# tests/fixtures/gen_takujitsu_kyoushin_group3.py
#
# docs/source/擇日実例.pdf の「吉凶神煞一覧表」から、凶神第3グループ
# （月害・大煞・土符・歸忌・往亡・天賊・九焦・大時・天吏・遊禍・九空）を
# 抽出し、tests/fixtures/takujitsu_kyoushin_group3.json を生成する。
# 兵禁は実例PDFに一度も出現しないため対象外（区分B、単体テストのみ）。
#
# 抽出方法は gen_takujitsu_kyoushin_group1/2.py と同じ。

import json
import re
from pathlib import Path

from pypdf import PdfReader

SRC = Path(__file__).resolve().parents[2] / "docs/source/擇日実例.pdf"
OUT = Path(__file__).resolve().parent / "takujitsu_kyoushin_group3.json"

STEMS = "甲乙丙丁戊己庚辛壬癸"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
GANZHI60 = [STEMS[i % 10] + BRANCHES[i % 12] for i in range(60)]

MONTH_LABEL_TO_BRANCH = {
    "正月": "寅", "二月": "卯", "三月": "辰", "四月": "巳", "五月": "午", "六月": "未",
    "七月": "申", "八月": "酉", "九月": "戌", "十月": "亥", "十一月": "子", "十二月": "丑",
}

TARGET_NAMES = ["月害", "大煞", "土符", "歸忌", "往亡", "天賊", "九焦", "大時", "天吏", "遊禍", "九空"]

# フォントのCIDマッピング起因の異体字（擇日テキストの原本画像・表で確認済み）。
NAME_VARIANTS: dict[str, list[str]] = {
    "大煞": ["大殺"],
    "土符": ["士符"],
    "歸忌": ["蹄忌"],
    "九焦": ["九扻"],
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
                "擇日実例.pdf の日家吉凶神煞一覧表の【凶神】欄から、凶神第3グループ"
                "（月害・大煞・土符・歸忌・往亡・天賊・九焦・大時・天吏・遊禍・"
                "九空）を機械的に抽出した検証専用 fixture。仕様ではない。"
                "擇日ロジックの逆算・変更には使用しないこと。兵禁は実例PDFに"
                "一度も出現しないため対象外（ロジック単体テストのみで検証）。"
            ),
            "extraction": (
                "pypdf でページテキストを抽出し、月見出しで12ヶ月に分割、"
                "各行冒頭の「五行+分類+十二建+日|目」という見出しパターンで"
                "60行の区切り位置を検出したうえで、各行の【凶神】欄の"
                "文字列一致を判定した。"
            ),
            "notes": [
                "生成スクリプト: tests/fixtures/gen_takujitsu_kyoushin_group3.py",
                "大煞は実例PDFでは「大殺」（異体字）でも出現する。",
                "土符は実例PDFでは「士符」（字形類似の文字化け）でも出現する。",
                "歸忌は実例PDFでは「蹄忌」（字形類似の文字化けの可能性）でも出現する。",
                "九焦は実例PDFでは「九焦」のみが出現し「九扻」は一度も単独出現しない。",
                "往亡・歸忌・大煞にはそれぞれ1〜2件、原本画像未確認の孤立した"
                "不一致が残る（詳細は tests/takujitsu_kyoushin_group3.manual.ts "
                "の EXCLUDED_MISMATCHES を参照）。",
            ],
            "count": len(rows),
        },
        "rows": rows,
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
