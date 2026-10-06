#!/usr/bin/env python3
# tests/fixtures/gen_takujitsu_kichijin_group4.py
#
# docs/source/擇日実例.pdf の「吉凶神煞一覧表」から、第4グループのうち
# 区分A（実例PDFに出現する）神殺を抽出し、
# tests/fixtures/takujitsu_kichijin_group4.json を生成する。
#
# 対象: 月恩・寶日・義日・専日・要安・玉宇・金堂・啓安・普護・福生・聖心・
#       益後・續世・五富・天倉・陽徳・陰徳・六儀・驛馬・天馬・青龍・明堂・
#       金匱・寶光・玉堂・司命・解神・臨日・兵福
# 対象外（天瑞・天福・天貴・催官）: 実例PDFに一度も出現しない（区分B、
# ロジック単体テストのみで検証。tests/takujitsu_kichijin_group4_unit.manual.ts参照）。
#
# 抽出方法は他グループの gen_takujitsu_kichijin*.py と同じ。詳細は
# gen_takujitsu_kichijin.py のコメントを参照。
#
# 寶日・義日・専日について:
#   各行の十二建ステータス欄の直前にある1文字の分類（例:「金義」「土伐」）が
#   まさにこの寶義制専伐日の分類であることが判明したため、この文字を
#   直接読み取って判定する（【吉神】欄の文字列検索ではない）。

import json
import re
from pathlib import Path

from pypdf import PdfReader

SRC = Path(__file__).resolve().parents[2] / "docs/source/擇日実例.pdf"
OUT = Path(__file__).resolve().parent / "takujitsu_kichijin_group4.json"

STEMS = "甲乙丙丁戊己庚辛壬癸"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
GANZHI60 = [STEMS[i % 10] + BRANCHES[i % 12] for i in range(60)]

MONTH_LABEL_TO_BRANCH = {
    "正月": "寅", "二月": "卯", "三月": "辰", "四月": "巳", "五月": "午", "六月": "未",
    "七月": "申", "八月": "酉", "九月": "戌", "十月": "亥", "十一月": "子", "十二月": "丑",
}

BRACKET_FIXES = [("【青神】", "【吉神】")]

TARGET_NAMES = [
    "月恩", "要安", "玉宇", "金堂", "啓安", "普護", "福生", "聖心", "益後", "續世",
    "五富", "天倉", "陽徳", "陰徳", "六儀", "驛馬", "天馬",
    "青龍", "明堂", "金匱", "寶光", "玉堂", "司命", "解神", "臨日",
]
# 寶日/義日/専日/兵福は【吉神】欄の文字列検索ではなく別ロジックで判定するため
# TARGET_NAMES から除く（下記参照）。

# フォントのCIDマッピング起因の文字化けで、資料本来の表記とは異なる字が
# 抽出される既知の変種（PDF原本の画像を目視確認し、実際は正しい文字が
# 印字されていることを確認済み）。「啓安」は実例PDF全体で0件・「敬安」が
# 60件（＝全件）と、置換ではなく完全に一方向の表記になっている。
NAME_VARIANTS = {
    "啓安": ["敬安"],
    "續世": ["績世"],
    "司命": ["司令"],
    "玉宇": ["王宇", "玉字"],
    "驛馬": ["辟馬"],
    "寶光": ["賓光"],
    "金匱": ["金庫"],
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


def extract_rows(seg: str):
    """各行の (day_header, 吉神本文) を60件返す。

    day_header は当該行の「干支+五行+分類+十二建+日」相当の先頭部分。
    寶義制専伐日の分類文字はここから読み取る（【吉神】欄の文字列検索とは
    別ロジック。干支の一部が「未→末」等に文字化けする既知の問題があるため、
    分類文字の抽出は「五行1文字の直後の1文字」というローカルなパターンに
    留め、干支全体の完全一致は要求しない）。
    """
    seg = seg.replace("【青神】", "【吉神】")

    kyo_count = len(re.findall("【凶神】", seg))
    ji_count = len(re.findall("【吉神】", seg))
    if kyo_count == 60:
        pieces = re.split("【凶神】", seg)
        headers = []
        jitexts = []
        for i in range(60):
            piece = pieces[i] if i < len(pieces) else ""
            m = re.search(r"^(.*?)【吉神】(.*)$", piece, re.S)
            if m:
                headers.append(m.group(1))
                jitexts.append(m.group(2))
            else:
                headers.append(piece)
                jitexts.append("")
    elif ji_count == 60:
        # 各行の【吉神】直前のテキスト（前の行の【凶神】本文込み）と、
        # 【吉神】以降の本文を別々に取り出す。
        ji_positions = [m.start() for m in re.finditer("【吉神】", seg)]
        headers = []
        jitexts = []
        for i, pos in enumerate(ji_positions):
            prev_end = ji_positions[i - 1] if i > 0 else 0
            headers.append(seg[prev_end:pos])
            end = re.search("【凶神】|【吉神】", seg[pos + 4:])
            jitexts.append(seg[pos + 4: pos + 4 + end.start()] if end else seg[pos + 4:])
    else:
        raise AssertionError(f"neither anchor gives 60 rows (吉神={ji_count}, 凶神={kyo_count})")

    # 分類文字: 各 header の末尾付近にある「五行1文字の直後の1文字」。
    # header は「(前行の凶神本文)干支五行分類十二建日|目」の形なので、
    # 末尾から「[建除滿满平定執破危成收開閉][日目]」を除いた直前の1文字を見る。
    # 「賓」「貨」「賛」は「寶」の、「事」は「専」のフォント文字化け（擇日テキスト
    # p.9-10の表を4倍ズーム画像で確認し、寶日・義日・専日の固定60干支リストは
    # 既存コードと完全一致。実例PDF側の「賓」「貨」「賛」全出現が壬寅・癸卯・
    # 丁丑・丙辰（いずれも表上は寶日）に限られることも確認済みで、内容差では
    # なく文字化けと判断）。
    tail_pat = re.compile(r"[金木水火土]([義伐専事寶賓貨賛制])[建除滿满満平定執破危成收収開関閉滞][日目]$")
    classes = []
    for h in headers:
        m = tail_pat.search(h)
        classes.append(m.group(1) if m else None)

    return jitexts, classes


def target_names_in_text(text: str) -> list[str]:
    found = []
    for name in TARGET_NAMES:
        variants = [name, *NAME_VARIANTS.get(name, [])]
        if any(v in text for v in variants):
            found.append(name)
    return found


CLASS_TO_NAME = {
    "寶": "寶日", "賓": "寶日", "貨": "寶日", "賛": "寶日",
    "義": "義日",
    "専": "専日", "事": "専日",
}  # 制・伐は凶のため対象外


def main():
    segments = load_segments()
    assert len(segments) == 12, f"expected 12 months, got {len(segments)}"

    rows = []
    missing_class = 0
    for label, branch, seg in segments:
        jitexts, classes = extract_rows(seg)
        assert len(jitexts) == 60, f"{label}: expected 60 rows, got {len(jitexts)}"
        assert len(classes) == 60, f"{label}: expected 60 classes, got {len(classes)}"
        for i, jitext in enumerate(jitexts):
            ganzhi = GANZHI60[i]
            expected = target_names_in_text(jitext)
            cls_name = CLASS_TO_NAME.get(classes[i]) if classes[i] else None
            if cls_name:
                expected.append(cls_name)
            elif classes[i] is None:
                missing_class += 1
            # 兵福: 月建と日辰の地支が一致する日
            if ganzhi[1] == branch:
                expected.append("兵福")
            rows.append({
                "monthLabel": label,
                "monthBranch": branch,
                "ganzhi": ganzhi,
                "dayStem": ganzhi[0],
                "dayBranch": ganzhi[1],
                "expectedKichijin": sorted(set(expected)),
            })

    assert len(rows) == 720
    if missing_class:
        print(f"NOTE: 分類文字(寶義制専伐)を抽出できなかった行が{missing_class}件ありました"
              f"（文字化け等。寶日/義日/専日の判定対象からは自然に除外される）")

    out = {
        "_meta": {
            "source": "docs/source/擇日実例.pdf（吉凶神煞一覧表）",
            "description": (
                "擇日実例.pdf の日家吉凶神煞一覧表から、第4グループのうち"
                "実例PDFに出現する神殺（月恩・寶日・義日・専日・要安〜續世・"
                "五富・天倉・陽徳・陰徳・六儀・驛馬・天馬・青龍・明堂・金匱・"
                "寶光・玉堂・司命・解神・臨日・兵福）を機械的に抽出した"
                "検証専用 fixture。仕様ではない。擇日ロジックの逆算・変更には"
                "使用しないこと。天瑞・天福・天貴・催官はこの一覧表に一度も"
                "出現しないため対象外（ロジック単体テストのみで検証）。"
            ),
            "extraction": (
                "pypdf でページテキストを抽出し、月見出しで12ヶ月に分割、"
                "各月60行に分割したうえで【吉神】本文の文字列一致を判定した。"
                "寶日・義日・専日は【吉神】欄ではなく、各行冒頭の"
                "「干支+五行+分類1文字(義/伐/専/寶/制)+十二建+日」という"
                "共通パターンから分類1文字を直接読み取って判定した"
                "（制日・伐日は凶のため対象外）。兵福は月建と日辰の地支が"
                "一致するかで判定した（表を持たないシンプルな規則のため）。"
            ),
            "notes": [
                "生成スクリプト: tests/fixtures/gen_takujitsu_kichijin_group4.py",
            ],
            "count": len(rows),
        },
        "rows": rows,
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
