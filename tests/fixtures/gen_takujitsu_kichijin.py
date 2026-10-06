#!/usr/bin/env python3
# tests/fixtures/gen_takujitsu_kichijin.py
#
# docs/source/擇日実例.pdf の「吉凶神煞一覧表」（月支ごとに60干支をすべて
# 掲載した日家吉凶の一覧）から、天徳・月徳・天徳合・月徳合・天赦の5神殺
# （歳徳・歳徳合は年干に依存するためこの一覧表には出現しない）だけを
# 抽出し、tests/fixtures/takujitsu_kichijin.json を生成する。
#
# 抽出方法:
#   pypdf でページテキストを抽出すると、縦書きレイアウトのため
#   1文字ずつ改行される。空白を除去して連結すると論理的な読み順は
#   保たれる。月見出し「◯月（始◯◯終◯◯）」で12ヶ月に分割し、
#   各月内の日はすべて甲子から癸亥までの60干支が1回ずつ、この順番で
#   出現する（＝新暦の実在の年月日ではなく、月支ごとの60干支対照表）。
#
#   各日の【吉神】内容を取り出す際、まれに「【吉神】」または
#   「【凶神】」の一方が丸ごと欠落して抽出される日がある（該当区分が
#   空のときに見出し自体を省略する組版のため）。そのため月ごとに
#   「【吉神】」と「【凶神】」の出現数を数え、60個ちょうど検出できた
#   方をその月の行区切りとして使う（両方60個の月は【凶神】を使う）。
#
# 既知の抽出上の欠落（1件、目視でPDF原本を確認して補正）:
#   三月（辰）の丁丑日は、抽出結果では「天徳合月徳四相不将益後」と
#   なり「月徳」の直後の「合」の1文字が欠落する（PDF原本のレンダリング
#   では「天徳合月徳合四相不将益後」と明確に「合」が入っている）。
#   これは埋め込みフォントの文字マッピングに起因する抽出漏れであり、
#   内容上の仕様差異ではないと判断し、本スクリプトで当該1件のみ
#   「月徳合」に補正している（他の719件は無補正）。

import json
import re
from pathlib import Path

from pypdf import PdfReader

SRC = Path(__file__).resolve().parents[2] / "docs/source/擇日実例.pdf"
OUT = Path(__file__).resolve().parent / "takujitsu_kichijin.json"

STEMS = "甲乙丙丁戊己庚辛壬癸"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
GANZHI60 = [STEMS[i % 10] + BRANCHES[i % 12] for i in range(60)]

MONTH_LABEL_TO_BRANCH = {
    "正月": "寅", "二月": "卯", "三月": "辰", "四月": "巳", "五月": "午", "六月": "未",
    "七月": "申", "八月": "酉", "九月": "戌", "十月": "亥", "十一月": "子", "十二月": "丑",
}

# 既知の抽出漏れの手動補正（月支, 干支）-> 正しい神殺名一覧（丸ごと置換）。
# 丁丑(辰月)は抽出結果が「天徳合月徳四相…」となり、本来「月徳合」であるべき
# 箇所の「合」が欠落して「月徳」単独に化けてしまう。単純追加だと「月徳」と
# 「月徳合」が両方残ってしまうため、この行だけ正しい一覧で丸ごと置き換える。
MANUAL_FIXES = {
    ("辰", "丁丑"): ["天徳合", "月徳合"],
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


def kichijin_in_text(text: str) -> list[str]:
    found = []
    if "天徳合" in text:
        found.append("天徳合")
    if "月徳合" in text:
        found.append("月徳合")
    text_wo_tdh = text.replace("天徳合", "")
    text_wo_ydh = text.replace("月徳合", "")
    if "天徳" in text_wo_tdh:
        found.append("天徳")
    if "月徳" in text_wo_ydh:
        found.append("月徳")
    if "天赦" in text:
        found.append("天赦")
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
            expected = kichijin_in_text(jitext)
            fix = MANUAL_FIXES.get((branch, ganzhi))
            manuallyFixed = False
            if fix is not None and sorted(fix) != sorted(expected):
                expected = list(fix)
                manuallyFixed = True
            row = {
                "monthLabel": label,
                "monthBranch": branch,
                "ganzhi": ganzhi,
                "dayStem": ganzhi[0],
                "dayBranch": ganzhi[1],
                "expectedKichijin": sorted(expected),
            }
            if manuallyFixed:
                row["manuallyFixed"] = True
            rows.append(row)

    assert len(rows) == 720

    out = {
        "_meta": {
            "source": "docs/source/擇日実例.pdf（吉凶神煞一覧表）",
            "description": (
                "擇日実例.pdf の日家吉凶神煞一覧表（月支ごとに60干支を網羅した"
                "対照表）から、天徳・月徳・天徳合・月徳合・天赦の5神殺だけを"
                "機械的に抽出した検証専用 fixture。仕様ではない。擇日ロジックの"
                "逆算・変更には使用しないこと。歳徳・歳徳合はこの一覧表には"
                "出現しないため対象外（年干に依存するため年を特定しないこの"
                "一覧表では判定できない）。"
            ),
            "extraction": (
                "pypdf でページテキストを抽出し、空白除去後の文字列を"
                "月見出し「◯月（始◯◯終◯◯）」で分割。各月は甲子〜癸亥の60干支を"
                "この順で1回ずつ含む対照表であるため、【吉神】/【凶神】の"
                "出現数のうち60個ちょうど検出できた方を行区切りに用いて"
                "60行に分割し、各行の【吉神】本文から天徳/月徳/天徳合/月徳合/"
                "天赦の文字列一致を判定した。"
            ),
            "notes": [
                "三月(辰)の丁丑のみ、フォントのCIDマッピング起因とみられる文字"
                "抽出漏れ（「月徳」の直後の「合」が欠落）をPDF原本の目視確認で"
                "補正した（manuallyFixed: true）。他の719件は無補正。",
                "生成スクリプト: tests/fixtures/gen_takujitsu_kichijin.py",
            ],
            "count": len(rows),
        },
        "rows": rows,
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
