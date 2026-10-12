#!/usr/bin/env python3
"""大限・小限における星曜の象意を、行運用の独立データに変換する。

入力: scripts/ziwei/.cache/meanings_raw/stars.json（原文を含む中間データ。条件の判定と対応付けに使う）
      src/lib/ziwei/meanings/data/stars.json（表示する独自文章。build_meanings.py §35）
  K-ST-DX-001〜048 … 基礎編「大限、小限における星曜の象意」１〜６（正本）
  N-ST-RN-022〜074 … 入門「流年における各星曜の意味」（大限・小限の記述。同じ内容の別表記として対応付けだけ持つ）
出力: src/lib/ziwei/meanings/fortune/data/fortuneStars.json
仕様: docs/ziwei-basic-spec.md §29

方針:
  - 大限・小限で共通の1データ（資料が「大限、小限における」として1つにまとめているため）。
  - 表示する文は、象意データの独自文章（K-ST-DX の text。資料の意味の範囲で書き直したもの）を使う。
    原文（基礎編・入門）はアプリ用データに持たない（sourceId・parallelId だけ残す。§35）。
    基礎編スライド自体の欠字・誤字（学間・気分 揚する）は、条件の判定に影響しないことだけ確かめる。
  - 群（文昌・文曲／右弼・左輔／火星・鈴星・擎羊・陀羅）は基礎編の見出しが「文昌、文曲星」のように1つなので、
    群の全員に共通の文として1項目にする（盤面では群で1回だけ表示）。
  - 条件は文頭の語句だけで決める:
      「（巡る）宮の力量（が）強ければ」 → palacePowerStrong
      「（巡る）宮の力量（が）弱ければ」「巡る宮の力量弱くても」 → palacePowerWeak
      「太陰星の力量弱いか巡る宮の力量弱ければ」 → starOrPalaceWeak（星の力量の弱さは宮の力量に読み替えない）
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts/ziwei/.cache/meanings_raw/stars.json"
APP = ROOT / "src/lib/ziwei/meanings/data/stars.json"
OUT = ROOT / "src/lib/ziwei/meanings/fortune/data/fortuneStars.json"

# 資料の星名の揺れ → 作盤エンジンの星名
STAR_NAME_ALIASES = {
    "貧狼星": "貪狼星",  # 基礎編のテキスト抽出の誤り（スライドは貪狼星）
    "貧狼": "貪狼星",
    "右輔星": "右弼星",  # 入門 p.102 の誤植（右弼・左輔の群）
    "敬羊星": "擎羊星",  # 資料の表記（作盤エンジンの星名は擎羊星）
    "敬羊": "擎羊星",
    "擎羊": "擎羊星",
    "陀羅": "陀羅星",
    "鈴星": "鈴星",
    "火星": "火星",
}

# 基礎編の見出しの順（スライド１〜６）。群は見出しのまま
GROUPS = [
    ("紫微星", ["紫微星"]),
    ("天機星", ["天機星"]),
    ("太陽星", ["太陽星"]),
    ("武曲星", ["武曲星"]),
    ("天同星", ["天同星"]),
    ("廉貞星", ["廉貞星"]),
    ("天府星", ["天府星"]),
    ("太陰星", ["太陰星"]),
    ("貪狼星", ["貪狼星"]),
    ("巨門星", ["巨門星"]),
    ("天相星", ["天相星"]),
    ("天梁星", ["天梁星"]),
    ("七殺星", ["七殺星"]),
    ("破軍星", ["破軍星"]),
    ("文昌、文曲星", ["文昌星", "文曲星"]),
    ("右弼、左輔星", ["右弼星", "左輔星"]),
    ("火星、鈴星、敬羊、陀羅星", ["火星", "鈴星", "擎羊星", "陀羅星"]),
]
GROUP_IDS = {
    "文昌、文曲星": "文昌文曲",
    "右弼、左輔星": "左輔右弼",
    "火星、鈴星、敬羊、陀羅星": "火鈴羊陀",
}

# 基礎編スライド自体の欠字・誤字（入門の同じ文で確認できるものだけ）
CORRECTIONS = {
    "K-ST-DX-005": [("学間", "学問", "スライドの誤字。入門の同じ文は「学問」")],
    "K-ST-DX-040": [("気分揚する", "気分昂揚する", "スライドの欠字（「気分 揚する」）。入門の同じ文は「気分昂揚する」")],
}


def condition_of(text: str):
    if text.startswith("太陰星の力量弱いか巡る宮の力量弱ければ"):
        return {"kind": "starOrPalaceWeak", "star": "太陰星", "phrase": "太陰星の力量弱いか巡る宮の力量弱ければ"}
    m = re.match(r"^((?:巡る)?宮の力量(?:が)?(強ければ|弱ければ|弱くても))", text)
    if not m:
        return None
    kind = "palacePowerStrong" if m.group(2) == "強ければ" else "palacePowerWeak"
    return {"kind": kind, "phrase": m.group(1)}


def norm_stars(stars):
    return [STAR_NAME_ALIASES.get(s, s) for s in stars]


def main():
    entries = json.loads(SRC.read_text(encoding="utf-8"))
    app_text = {e["id"]: e["text"] for e in json.loads(APP.read_text(encoding="utf-8"))}
    kiso = [e for e in entries if e["id"].startswith("K-ST-DX-")]
    nyumon = [e for e in entries if re.match(r"N-ST-RN-0(2[2-9]|3[0-39]|[4-6]\d|7[0-4])$", e["id"])]
    assert len(kiso) == 48, len(kiso)
    assert len(nyumon) == 48, len(nyumon)

    # 入門の文は星（群）ごとの並びで基礎編と1対1に対応する
    def by_group(es):
        out = {}
        for e in sorted(es, key=lambda x: x["id"]):
            out.setdefault(tuple(sorted(norm_stars(e["stars"]))), []).append(e)
        return out

    k_by, n_by = by_group(kiso), by_group(nyumon)
    used_corr = set()
    items = []
    for order, (heading, stars) in enumerate(GROUPS, start=1):
        key = tuple(sorted(stars))
        ks, ns = k_by.pop(key), n_by.pop(key)
        assert len(ks) == len(ns), (heading, len(ks), len(ns))
        gid = GROUP_IDS.get(heading, stars[0].replace("星", ""))
        lines = []
        for i, (k, n) in enumerate(zip(ks, ns), start=1):
            # 基礎編の抽出文には濁点が結合文字（は＋゛）のものがあるので NFC にそろえる（文字は変えない）
            original = unicodedata.normalize("NFC", k["sourceText"]).lstrip("・").strip()
            text = original
            for before, after, reason in CORRECTIONS.get(k["id"], []):
                assert before in text, (k["id"], before)
                text = text.replace(before, after)
                used_corr.add(k["id"])
            cond = condition_of(text)
            ntext = unicodedata.normalize("NFC", n["sourceText"]).lstrip("・").strip()
            ncond = condition_of(ntext)
            # 条件の種類は2資料で一致すること（文言の違いは条件に影響しない）
            assert (cond or {}).get("kind") == (ncond or {}).get("kind"), (k["id"], n["id"])
            lines.append(
                {
                    "id": f"FS-{gid}-{i}",
                    "text": app_text[k["id"]],
                    "condition": cond,
                    "sourceId": k["id"],
                    "parallelId": n["id"],
                }
            )
        items.append(
            {
                "id": f"FS-{gid}",
                "heading": heading,
                "stars": stars,
                "isGroup": len(stars) > 1,
                "sourceOrder": order,
                "lines": lines,
            }
        )
    assert not k_by and not n_by, (k_by.keys(), n_by.keys())
    assert used_corr == set(CORRECTIONS), used_corr

    out = {
        "meta": {
            "title": "大限、小限における星曜の象意",
            "source": "紫微斗数基礎編",
            "parallelSource": "紫微斗数入門（流年における各星曜の意味）",
            "appliesTo": ["major", "minor"],
            "starNameAliases": STAR_NAME_ALIASES,
        },
        "items": items,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    n_lines = sum(len(i["lines"]) for i in items)
    n_cond = sum(1 for i in items for l in i["lines"] if l["condition"])
    print(f"items={len(items)} lines={n_lines} conditional={n_cond} -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
