#!/usr/bin/env python3
# tests/fixtures/gen_takujitsu_kichijin_group2.py
#
# docs/source/擇日実例.pdf の「吉凶神煞一覧表」から、第2グループの8神殺
# （母倉・四相・時徳・王日・官日・守日・相日・民日）を抽出し、
# tests/fixtures/takujitsu_kichijin_group2.json を生成する。
#
# 抽出方法は tests/fixtures/gen_takujitsu_kichijin.py（第1グループ）と同じ。
# 詳細（縦書きレイアウトのテキスト抽出、月見出しでの分割、
# 【吉神】/【凶神】の出現数がちょうど60個の方を行区切りに使う理由）は
# そちらのコメントを参照。

import json
import re
from pathlib import Path

from pypdf import PdfReader

SRC = Path(__file__).resolve().parents[2] / "docs/source/擇日実例.pdf"
OUT = Path(__file__).resolve().parent / "takujitsu_kichijin_group2.json"

STEMS = "甲乙丙丁戊己庚辛壬癸"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
GANZHI60 = [STEMS[i % 10] + BRANCHES[i % 12] for i in range(60)]

MONTH_LABEL_TO_BRANCH = {
    "正月": "寅", "二月": "卯", "三月": "辰", "四月": "巳", "五月": "午", "六月": "未",
    "七月": "申", "八月": "酉", "九月": "戌", "十月": "亥", "十一月": "子", "十二月": "丑",
}

# 第1グループの fixture 生成で判明した既知の抽出漏れ（フォントのCIDマッピング
# 起因）。第2グループの神殺名検出には影響しないが、行の総文字列に同じ欠落が
# 残っているため一応記録だけ残す（今回の8神殺の判定には無関係）。
KNOWN_GLYPH_DROP_NOTE = "三月(辰)の丁丑日で「月徳合」の「合」が抽出時に欠落する既知の問題あり（第1グループ側で補正済み、第2グループの判定には無関係）"

TARGET_NAMES = ["母倉", "四相", "時徳", "王日", "官日", "守日", "相日", "民日"]

# 第2グループの抽出で新たに確認したフォントのCIDマッピング起因の文字化け
# （PDF原本の画像レンダリングを目視確認し、実際は正しい文字が印字されている
# ことを確認したうえで、テキスト抽出結果側だけを補正している）。
#   ・「【吉神】」の一部が「【青神】」として抽出される（例: 七月(申)甲戌日）
#     → ブラケット文字列を正規化してから行分割する。
#   ・「日」の一部が「目」として抽出される（例: 五月(午)乙巳日の「王目」、
#     三月(辰)戊辰日の「守目」、八月(酉)甲子日の「民目」など。この「日→目」
#     化けは十二建の日付ステータス欄（除目・収目・満目 等）でも同じパターンで
#     多発しており、この資料のテキスト抽出に共通する既知の問題である）
#     → 王日/官日/守日/相日/民日 の5神殺は「目」表記も同一視して検出する。
#   ・「四相」の一部が「四柏」として抽出される（例: 七月(申)壬辰日）
#     → 「四柏」も「四相」として検出する。
BRACKET_FIXES = [("【青神】", "【吉神】")]
NAME_VARIANTS = {
    "四相": ["四柏"],
    "王日": ["王目"],
    "官日": ["官目"],
    "守日": ["守目"],
    "相日": ["相目"],
    "民日": ["民目"],
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
                "expectedKichijin": sorted(expected),
            })

    assert len(rows) == 720

    out = {
        "_meta": {
            "source": "docs/source/擇日実例.pdf（吉凶神煞一覧表）",
            "description": (
                "擇日実例.pdf の日家吉凶神煞一覧表（月支ごとに60干支を網羅した"
                "対照表）から、第2グループの8神殺（母倉・四相・時徳・王日・"
                "官日・守日・相日・民日）だけを機械的に抽出した検証専用"
                " fixture。仕様ではない。擇日ロジックの逆算・変更には使用"
                "しないこと。"
            ),
            "extraction": (
                "pypdf でページテキストを抽出し、空白除去後の文字列を"
                "月見出し「◯月（始◯◯終◯◯）」で分割。各月は甲子〜癸亥の60干支を"
                "この順で1回ずつ含む対照表であるため、【吉神】/【凶神】の"
                "出現数のうち60個ちょうど検出できた方を行区切りに用いて"
                "60行に分割し、各行の【吉神】本文から母倉/四相/時徳/王日/"
                "官日/守日/相日/民日の文字列一致を判定した。"
            ),
            "notes": [
                KNOWN_GLYPH_DROP_NOTE,
                "抽出時に「【青神】」→「【吉神】」、「王目/官目/守目/相目/民目」"
                "→「王日/官日/守日/相日/民日」、「四柏」→「四相」を同一視する"
                "正規化を行った（いずれもPDF原本の画像レンダリングで正しい"
                "文字が印字されていることを目視確認済みのフォントCID"
                "マッピング起因の文字化け）。",
                "母倉について: 擇日テキスト.pdf p.7の表は辰・未・戌・丑の月令に"
                "「土王用事の後は必ず巳午となる」を反映した追加の地支（巳午）を"
                "明記しているが、この一覧表（擇日実例.pdf）の実際の掲載では"
                "辰・未・戌・丑の月令で日辰が巳・午のときに母倉が掲載されない"
                "行が複数ある。これは一次資料同士（擇日テキストと擇日実例）の"
                "内容上の不一致の可能性があり、本fixtureは擇日実例.pdfの実際の"
                "掲載をそのまま転記している（テキスト側の表の記述を優先して"
                "推測で書き換えていない）。詳細は"
                "tests/takujitsu_kichijin_group2.manual.ts の実行結果を参照。",
                "生成スクリプト: tests/fixtures/gen_takujitsu_kichijin_group2.py",
            ],
            "count": len(rows),
        },
        "rows": rows,
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
