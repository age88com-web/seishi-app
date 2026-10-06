#!/usr/bin/env python3
# tests/fixtures/gen_takujitsu_kichijin_group3.py
#
# docs/source/擇日実例.pdf の「吉凶神煞一覧表」から、第3グループの5神殺
# （三合・六合・五合・鳴吠・鳴吠對）を抽出し、
# tests/fixtures/takujitsu_kichijin_group3.json を生成する。
#
# 抽出方法は tests/fixtures/gen_takujitsu_kichijin.py（第1グループ）・
# gen_takujitsu_kichijin_group2.py（第2グループ）と同じ。詳細（縦書き
# レイアウトのテキスト抽出、月見出しでの分割、【吉神】/【凶神】の出現数が
# ちょうど60個の方を行区切りに使う理由、既知のフォントCID文字化けの正規化）
# はそちらのコメントを参照。

import json
import re
from pathlib import Path

from pypdf import PdfReader

SRC = Path(__file__).resolve().parents[2] / "docs/source/擇日実例.pdf"
OUT = Path(__file__).resolve().parent / "takujitsu_kichijin_group3.json"

STEMS = "甲乙丙丁戊己庚辛壬癸"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
GANZHI60 = [STEMS[i % 10] + BRANCHES[i % 12] for i in range(60)]

MONTH_LABEL_TO_BRANCH = {
    "正月": "寅", "二月": "卯", "三月": "辰", "四月": "巳", "五月": "午", "六月": "未",
    "七月": "申", "八月": "酉", "九月": "戌", "十月": "亥", "十一月": "子", "十二月": "丑",
}

# 第1・第2グループの fixture 生成で確認済みのフォントCIDマッピング起因の
# 文字化け。第3グループの神殺名検出には直接関与しないが、行分割の安定のため
# 同じブラケット正規化を適用する。
BRACKET_FIXES = [("【青神】", "【吉神】")]

TARGET_NAMES = ["三合", "六合", "五合", "鳴吠", "鳴吠對"]


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


def extract_jitexts(seg: str) -> list[str]:
    for bad, good in BRACKET_FIXES:
        seg = seg.replace(bad, good)
    kyo_count = len(re.findall("【凶神】", seg))
    ji_count = len(re.findall("【吉神】", seg))
    if kyo_count == 60:
        pieces = re.split("【凶神】", seg)
        out = []
        for i in range(60):
            piece = pieces[i] if i < len(pieces) else ""
            m = re.search(r"【吉神】(.*)$", piece, re.S)
            out.append(m.group(1) if m else "")
        return out
    if ji_count == 60:
        return re.findall(r"【吉神】(.*?)(?=【凶神】|【吉神】|$)", seg, re.S)
    raise AssertionError(f"neither anchor gives 60 rows (吉神={ji_count}, 凶神={kyo_count})")


def target_names_in_text(text: str) -> list[str]:
    found = []
    # 「鳴吠對」は「鳴吠」を部分文字列として含むため、鳴吠對を先に判定し、
    # その分を除いた残りで「鳴吠」の有無を見る（第1グループの
    # 天徳/天徳合と同じ考え方）。
    if "鳴吠對" in text:
        found.append("鳴吠對")
    text_wo_mingfeidui = text.replace("鳴吠對", "")
    if "鳴吠" in text_wo_mingfeidui:
        found.append("鳴吠")
    if "三合" in text:
        found.append("三合")
    if "六合" in text:
        found.append("六合")
    if "五合" in text:
        found.append("五合")
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
                "expectedKichijin": sorted(expected, key=lambda n: TARGET_NAMES.index(n)),
            })

    assert len(rows) == 720

    out = {
        "_meta": {
            "source": "docs/source/擇日実例.pdf（吉凶神煞一覧表）",
            "description": (
                "擇日実例.pdf の日家吉凶神煞一覧表（月支ごとに60干支を網羅した"
                "対照表）から、第3グループの5神殺（三合・六合・五合・鳴吠・"
                "鳴吠對）だけを機械的に抽出した検証専用 fixture。仕様ではない。"
                "擇日ロジックの逆算・変更には使用しないこと。"
            ),
            "extraction": (
                "pypdf でページテキストを抽出し、空白除去後の文字列を"
                "月見出し「◯月（始◯◯終◯◯）」で分割。各月は甲子〜癸亥の60干支を"
                "この順で1回ずつ含む対照表であるため、【吉神】/【凶神】の"
                "出現数のうち60個ちょうど検出できた方を行区切りに用いて"
                "60行に分割し、各行の【吉神】本文から三合/六合/五合/鳴吠/"
                "鳴吠對の文字列一致を判定した。「鳴吠對」は「鳴吠」を部分"
                "文字列に含むため、鳴吠對を先に判定してから残りで鳴吠の"
                "有無を見ている。"
            ),
            "notes": [
                "擇日実例.pdfの原本画像を目視確認のうえ判明した、擇日テキスト"
                "p.9-11の表と実例PDFの掲載内容との相違（推測でロジックを"
                "合わせず、そのまま転記している）:",
                "  ・三月(辰)戊寅: 擇日テキストp.9の三合表では辰の三合会局は"
                "申子辰のため寅日は対象外だが、実例PDFにはこの1行だけ「三合」"
                "が掲載されている（同じ行で第2グループの王日も欠落しており、"
                "実例PDF内のこの1行だけの孤立した不整合と判断）。",
                "  ・三月(辰)癸卯、十二月(丑)庚寅: 擇日テキストp.11の表では"
                "鳴吠對日だが、実例PDFの原本画像では「鳴吠封」と印字されて"
                "いる（「封」は擇日テキストに無い文字で、CIDマッピングの"
                "文字化けではなく実際にそう印字されていることを画像で確認"
                "済み）。",
                "  ・七月(申)乙卯、十月(亥)丙子: 擇日テキストp.11の表では"
                "鳴吠對日だが、実例PDFの原本画像では「對」が付かない単独の"
                "「鳴吠」と印字されている（画像で確認済み）。",
                "  ・九月(戌)丁卯: 擇日テキストp.11の表では鳴吠對日だが、"
                "実例PDFの原本画像では「吠」が抜けた「鳴對」と印字されて"
                "いる（画像で確認済み）。",
                "生成スクリプト: tests/fixtures/gen_takujitsu_kichijin_group3.py",
            ],
            "count": len(rows),
        },
        "rows": rows,
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
