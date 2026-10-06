#!/usr/bin/env python3
# tests/fixtures/gen_takujitsu_kyoushin_group1.py
#
# docs/source/擇日実例.pdf の「吉凶神煞一覧表」から、凶神第1グループ
# （小時＝月建・死神・死気＝定日・血支＝閉日）を抽出し、
# tests/fixtures/takujitsu_kyoushin_group1.json を生成する。
#
# 【凶神】欄の抽出方法（吉神グループと異なる点）:
#   これまでの吉神グループの抽出は【吉神】欄のみを対象にしていたため、
#   「【凶神】の直前までの文字列」を「header（当該行の干支+分類+十二建の
#   見出し部分）」として扱えば足りた。今回は【凶神】本文そのものを
#   正確に取り出す必要があるため、各行の見出しパターン
#   「五行1文字+分類1文字+十二建+日|目」を目印にして60行の区切り位置を
#   直接検出し、各区切りの間にある【吉神】…【凶神】…を行ごとに
#   分離する方式に切り替えた（吉神欄の文字列が次の行の見出しへ
#   はみ出す境界バグを避けるため）。

import json
import re
from pathlib import Path

from pypdf import PdfReader

SRC = Path(__file__).resolve().parents[2] / "docs/source/擇日実例.pdf"
OUT = Path(__file__).resolve().parent / "takujitsu_kyoushin_group1.json"

STEMS = "甲乙丙丁戊己庚辛壬癸"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
GANZHI60 = [STEMS[i % 10] + BRANCHES[i % 12] for i in range(60)]

MONTH_LABEL_TO_BRANCH = {
    "正月": "寅", "二月": "卯", "三月": "辰", "四月": "巳", "五月": "午", "六月": "未",
    "七月": "申", "八月": "酉", "九月": "戌", "十月": "亥", "十一月": "子", "十二月": "丑",
}

TARGET_NAMES = ["小時", "死神", "死気", "血支"]

# フォントのCIDマッピング起因の文字化けで、資料本来の表記とは異なる字が
# 抽出される既知の変種。今回の4項目については実例PDF全件照合で
# 一度も文字化けが見つからなかった（後述のテストで720/720完全一致）ため
# 変種テーブルは空。
NAME_VARIANTS: dict[str, list[str]] = {}

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
    """各行の【凶神】本文を60件返す。

    各行の見出しパターン（五行+分類+十二建+日|目）の終端位置を60件検出し、
    それぞれの終端から次の見出しの開始までを1行分のテキストとして切り出す。
    その中から【吉神】…【凶神】…を分離し、【凶神】以降を返す
    （次の行の見出しへはみ出さない）。
    """
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
                "擇日実例.pdf の日家吉凶神煞一覧表の【凶神】欄から、凶神第1グループ"
                "（小時＝月建・死神・死気＝定日・血支＝閉日）を機械的に抽出した"
                "検証専用 fixture。仕様ではない。擇日ロジックの逆算・変更には"
                "使用しないこと。"
            ),
            "extraction": (
                "pypdf でページテキストを抽出し、月見出しで12ヶ月に分割、"
                "各行冒頭の「五行+分類+十二建+日|目」という見出しパターンで"
                "60行の区切り位置を検出したうえで、各行の【凶神】欄の"
                "文字列一致を判定した。"
            ),
            "notes": [
                "生成スクリプト: tests/fixtures/gen_takujitsu_kyoushin_group1.py",
                "月建/小時/土府は実例PDFで720/720完全に同一行にのみ出現するため"
                "同一概念の別名と判断し、「小時」を採用（月建はmonthBranchと"
                "紛らわしいため使用しない）。",
                "定日/死気/官符は実例PDFで「死気」のみが720/720出現し、"
                "「定日」「官符」は一度も単独出現しないため「死気」を採用。",
                "閉日/血支/血忌は実例PDFで「血支」のみが720/720出現し、"
                "「閉日」は一度も単独出現せず、「血忌」は閉ステータスと"
                "一致しないため対象外とした。",
            ],
            "count": len(rows),
        },
        "rows": rows,
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
