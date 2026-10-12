#!/usr/bin/env python3
"""紫微斗数の象意データ（アプリ用）を作る。docs/ziwei-basic-spec.md §35。

流れ:
  1. extract_meanings.py が資料から抽出した中間データ（原文を含む。scripts/ziwei/.cache/meanings_raw。git 管理外）を読む
  2. 原文から、判定ロジックが使っていた情報を「凍結メタデータ」として各データに付ける
       textKey         … 同じ資料・同じ原文のまとまり（重複整理・組み合わせとの対応・前後文の位置に使う）
       opener          … 原文の書き出しが前の文を受ける接続語なら、その語（前文依存の判定・「また、」の付与に使う）
       continuesToNext … 原文が後の文へ続く（「、」「：」で終わる・後の文を予告する）
       mentionsStars   … 原文が名指ししている星（「○○星については、」の付与に使う）
       mentionsPalaces … 原文が名指ししている宮（「○○宮は、」の付与に使う）
       sourceLength    … 原文の文字数（空白を除く。解釈本文の文字数の目安〔B の選別〕に使う）
  3. 表示する文章 text を独自文章（scripts/ziwei/rewrites/meanings.json）に差し替え、原文（sourceText・normalizedMeaning）を除く
  4. src/lib/ziwei/meanings/data/*.json へ出力（themes は画面に出さないので文章を持たない）

独自文章は、同じ原文（normalizedMeaning）のデータ群の代表 ID（stars → transformations → palaces → starPalace →
combinations の順で最初の ID）をキーにする。原文の複製はアプリ用データにもこのリポジトリの管理ファイルにも残さない。

実行:
  python3 scripts/ziwei/build_meanings.py            # 抽出からやり直す
  python3 scripts/ziwei/build_meanings.py --no-extract  # 中間データを再利用
  python3 scripts/ziwei/build_meanings.py --worklist    # 未作成の独自文章の一覧を .cache に書く（原文つき・作業用）
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "scripts/ziwei/.cache/meanings_raw"
OUT = ROOT / "src/lib/ziwei/meanings/data"
REWRITES = Path(os.environ.get("ZIWEI_REWRITES", ROOT / "scripts/ziwei/rewrites/meanings.json"))
WORKLIST = ROOT / "scripts/ziwei/.cache/meanings_worklist.json"

TEXT_FILES = ["stars", "transformations", "palaces", "starPalace", "combinations"]
# sentenceContext.ts の資料の並び（前後の文の位置）と同じ順。原文の同一判定（textKey）もこの順で最初の ID
ORDERED = ["stars", "transformations", "palaces", "starPalace", "themes", "combinations"]

# sentenceContext.ts PREVIOUS_DEPENDENT_OPENERS・ruleInterpretation.ts CONNECTIVE_OPENERS と同じ
OPENERS = ["いずれにせよ", "また", "そのため", "したがって", "しかし", "この場合", "このように", "前述のように", "これにより",
           "一方で", "さらに", "ただし", "と言っても", "ですから", "それゆえ", "そこで", "なお", "とはいえ", "ところが", "そして"]
NEXT_ENDING = re.compile(r"[、：:]$")
NEXT_ANNOUNCE = re.compile(r"(次のよう|以下のよう|次のとおり|次の通り|以下のとおり|以下の通り)")

STARS = ["紫微星", "天機星", "太陽星", "武曲星", "天同星", "廉貞星", "天府星", "太陰星", "貪狼星", "巨門星", "天相星", "天梁星",
         "七殺星", "破軍星", "文昌星", "文曲星", "天空星", "地劫星", "火星", "鈴星", "左輔星", "右弼星", "天姚星", "天馬星",
         "禄存星", "擎羊星", "陀羅星", "天魁星", "天鉞星", "紅鸞星", "化禄星", "化権星", "化科星", "化忌星"]
PALACES = ["命宮", "兄弟宮", "夫妻宮", "子女宮", "財帛宮", "疾厄宮", "遷移宮", "奴僕宮", "官禄宮", "田宅宮", "福徳宮", "父母宮"]


def mentions_star(t: str, star: str) -> bool:
    # ruleInterpretation.ts namesStar と同じ（「羊星」「敬羊星」も擎羊星の名指し）
    return star in t or (star == "擎羊星" and "羊星" in t)


def load_raw():
    return {k: json.loads((RAW / f"{k}.json").read_text(encoding="utf-8")) for k in ORDERED + ["meta"]}


def representatives(raw):
    """同じ原文（normalizedMeaning）の代表 ID（独自文章のキー）"""
    rep = {}
    for k in TEXT_FILES:
        for e in raw[k]:
            rep.setdefault(e["normalizedMeaning"], e["id"])
    return rep


def main():
    args = set(sys.argv[1:])
    if "--no-extract" not in args:
        env = {**os.environ, "ZIWEI_MEANINGS_RAW_OUT": str(RAW)}
        subprocess.run([sys.executable, str(ROOT / "scripts/ziwei/extract_meanings.py")], check=True, env=env, stdout=subprocess.DEVNULL)
    raw = load_raw()
    rep = representatives(raw)
    rewrites = json.loads(REWRITES.read_text(encoding="utf-8")) if REWRITES.exists() else {}

    if "--worklist" in args:
        todo = [{"id": rid, "text": t, "files": sorted({k for k in TEXT_FILES for e in raw[k] if e["normalizedMeaning"] == t})}
                for t, rid in rep.items() if rid not in rewrites]
        WORKLIST.write_text(json.dumps(todo, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"未作成 {len(todo)} / {len(rep)} → {WORKLIST.relative_to(ROOT)}")
        return

    missing = [rid for rid in rep.values() if rid not in rewrites]
    unused = [rid for rid in rewrites if rid not in set(rep.values())]
    if missing or unused:
        print(f"独自文章の過不足: 未作成 {len(missing)}・不要 {len(unused)}", missing[:10], unused[:10])
        sys.exit(1)

    text_key = {}
    for k in ORDERED:
        for e in raw[k]:
            text_key.setdefault(f'{e["ref"]["source"]}|{e["sourceText"]}', e["id"])

    for k in ORDERED:
        out = []
        for e in raw[k]:
            nm = e["normalizedMeaning"]
            frozen = {
                "textKey": text_key[f'{e["ref"]["source"]}|{e["sourceText"]}'],
                "opener": next((w for w in OPENERS if nm.startswith(w)), None),
                "continuesToNext": bool(NEXT_ENDING.search(e["sourceText"]) or NEXT_ANNOUNCE.search(e["sourceText"])),
                "mentionsStars": [s for s in STARS if mentions_star(nm, s)],
                "mentionsPalaces": [p for p in PALACES if p in nm],
                "sourceLength": len(re.sub(r"\s", "", nm)),
            }
            rest = {x: v for x, v in e.items() if x not in ("id", "sourceText", "normalizedMeaning")}
            item = {"id": e["id"]}
            if k != "themes":
                item["text"] = rewrites[rep[nm]]
            item.update(rest)
            item.update(frozen)
            out.append(item)
        (OUT / f"{k}.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (OUT / "meta.json").write_text(json.dumps(raw["meta"], ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"代表 {len(rep)} 文・独自文章 {len(rewrites)} → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
