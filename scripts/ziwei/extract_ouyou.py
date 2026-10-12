#!/usr/bin/env python3
"""応用編リライト版（docs/source/ziwei_ouyou_rewritten.md）を、アプリ用の構造化データに変換する。

出力: src/lib/ziwei/meanings/advanced/data/ouyou.json
仕様: docs/ziwei-basic-spec.md §24

方針:
  - 本文は書き換えない。段落はそのまま、文は「。」で区切るだけ（区切った文をつなげると段落に戻る）。
  - 主キーは 紫微星の支 × 命宮の支。命宮の支は、ブロック内の並び（子→亥）で決め、見出しの支と照合する
    （通し番号は使わない。見出しの支と並びが違う項目は headingBranchMismatch として残す）。
  - 条件は、文の語句から決まった規則で抽出し、規則で決まらない文は OVERRIDES で個別に指定する。
    一般的な紫微斗数知識で条件を補わない。定義のない語（禄星・桃花の星・貴人・昼夜・補佐・助け など）は pending。
  - 「# 処理記録」以下は解釈データに入れず、sourceMeta に入れる。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "docs/source/ziwei_ouyou_rewritten.md"
OUT = ROOT / "src/lib/ziwei/meanings/advanced/data/ouyou.json"
BR = "子丑寅卯辰巳午未申酉戌亥"

text = SRC.read_text(encoding="utf-8")
body, _, meta_part = text.partition("\n# 処理記録")
sentences_of = lambda p: re.findall(r"[^。]+。?", p)

# ---------------------------------------------------------------------------
# 構造
# ---------------------------------------------------------------------------
items = []
block = None
for line in body.split("\n"):
    m = re.match(r"^## 紫微星が(.)宮にある命宮十二局", line)
    if m:
        block = m.group(1)
        continue
    m = re.match(r"^### (\d+)　(.*)$", line)
    if m:
        items.append({"sourceNumber": int(m.group(1)), "heading": m.group(2), "ziweiBranch": block, "paragraphs": [], "section": f"紫微星が{block}宮にある命宮十二局"})
        continue
    if items and line.strip() and not line.startswith("#") and not line.startswith(">"):
        items[-1]["paragraphs"].append(line.strip())

MAIN = "紫微|天機|太陽|武曲|天同|廉貞|天府|太陰|貪狼|巨門|天相|天梁|七殺|破軍"
def stars_in(s):
    return [x + "星" for x in re.findall(MAIN, s)]

# ---------------------------------------------------------------------------
# 条件（文ごと）
# ---------------------------------------------------------------------------
def C(kind, **kw):
    d = {"kind": kind}
    d.update(kw)
    return d

LUCKY_REL = {"加会": "加会", "会照": "会照", "会え": "会う", "会う": "会う", "臨め": "臨む", "補佐": "補佐", "助け": "助け", "支え": "支え"}

def auto_conditions(s):
    """文の語句から条件を抽出する。返り値: 条件の配列（空なら無条件）"""
    conds = []
    # 時期（流年）
    if re.search(r"悪い流年", s):
        conds.append(C("temporal", phrase="悪い流年", reason="流年の吉凶は出生命盤だけでは決まらない（独自の吉凶判定は作らない）"))
    # 昼夜
    if re.search(r"昼生まれ|夜生まれ", s):
        conds.append(C("pending", term="昼生まれ／夜生まれ", phrase=re.search(r"(昼|夜)生まれ", s).group(0), reason="昼夜の区切りが資料・仕様書に定義されていない"))
    # 桃花
    m = re.search(r"桃花(の星|系の星)", s)
    if m and "古典" not in s:
        conds.append(C("pending", term="桃花の星", phrase=m.group(0), reason="桃花の星の構成星が資料・仕様書に定義されていない"))
    # 禄星
    if "禄星" in s:
        conds.append(C("pending", term="禄星", phrase="禄星", reason="禄星の構成星が資料・仕様書に定義されていない"))
    # 貴人
    if "貴人" in s:
        conds.append(C("pending", term="貴人", phrase="貴人", reason="貴人の構成星が資料・仕様書に定義されていない"))
    # 吉星
    for m in re.finditer(r"吉星(?:が|と)?(多く)?(加会|会照|臨め)|吉星(?:に|の)(会え|補佐|助け|支え)", s):
        many, rel1, rel2 = m.group(1), m.group(2), m.group(3)
        rel = LUCKY_REL[rel1 or rel2]
        if many:
            conds.append(C("pending", term="吉星が多く", phrase=m.group(0), reason="「多く」の数の基準がない"))
        elif rel in ("加会", "会照", "会う"):
            conds.append(C("starGroup", group="吉星", relation=rel, negate=False, phrase=m.group(0)))
        else:
            conds.append(C("pending", term=f"吉星の{rel}", phrase=m.group(0), reason=f"「{rel}」の位置関係（同宮・加会など）が定義されていない"))
    # 凶星
    for m in re.finditer(r"凶星(?:が|に|の)?(加会|会照|会う|会え|会合|加わ)", s):
        rel = {"会え": "会う"}.get(m.group(1), m.group(1))
        if rel in ("加会", "会照", "会う"):
            conds.append(C("starGroup", group="凶星", relation=rel, negate=False, phrase=m.group(0)))
        elif rel == "加わ":
            conds.append(C("pending", term="凶星が加わる", phrase=m.group(0), reason="「加わる」の位置関係が定義されていない"))
    return conds

# 規則で決まらない文・規則の結果を置き換える文（キー: 文に含まれる資料の文言。1文にだけ一致すること）
OVERRIDES = {
    "吉星だけが集まり凶星が加会しない場合": [C("pending", term="吉星だけが集まる", phrase="吉星だけが集まり", reason="「集まる」の範囲・「だけ」の基準が定義されていない"), C("starGroup", group="凶星", relation="加会", negate=True, phrase="凶星が加会しない")],
    # 「・」は両方として読む
    "吉星が加会し、さらに化権・化禄に会えば": [C("starGroup", group="吉星", relation="加会", negate=False, phrase="吉星が加会し"), C("stars", stars=["化権星", "化禄星"], mode="all", relation="会う", phrase="化権・化禄に会えば")],
    "凶星や化忌が加わると": [C("pending", term="凶星や化忌が加わる", phrase="凶星や化忌が加わる", reason="「加わる」の位置関係が定義されていない")],
    "禄存などの吉星に会えば": [C("starGroup", group="吉星", relation="会う", negate=False, phrase="禄存などの吉星に会えば")],
    "禄存や化禄に会うことを喜び": [C("stars", stars=["禄存星", "化禄星"], mode="any", relation="会う", phrase="禄存や化禄に会う")],
    "吉星、特に化禄・禄存があれば": [C("pending", term="吉星（特に化禄・禄存）がある", phrase="吉星、特に化禄・禄存があれば", reason="「ある」の位置（命宮か三方四正か）が定義されていない")],
    # 性質の記述（条件ではない）
    "吉星の助けを喜び、凶星の会合は好まない": [],
    # 譲歩（条件ではない）
    "たとえ吉星に恵まれて": [],
    "擎羊星や火星が加会すれば": [C("stars", stars=["擎羊星", "火星"], mode="any", relation="加会", phrase="擎羊星や火星が加会すれば")],
    "火星・鈴星が加会すれば": [C("stars", stars=["火星", "鈴星"], mode="all", relation="加会", phrase="火星・鈴星が加会すれば")],
    "火星または鈴星に会えば": [C("stars", stars=["火星", "鈴星"], mode="any", relation="会う", phrase="火星または鈴星に会えば")],
    "禄星が会照し、さらに火星または鈴星を見る場合": [C("pending", term="禄星", phrase="禄星が会照し", reason="禄星の構成星が資料・仕様書に定義されていない"), C("pending", term="火星または鈴星を見る", phrase="火星または鈴星を見る", reason="「見る」の位置関係が定義されていない")],
    "太陽と太陰が命宮にある場合は": [C("stars", stars=["太陽星", "太陰星"], mode="all", relation="同宮", phrase="太陽と太陰が命宮にある場合")],
    "火星または擎羊星が同宮すれば": [C("stars", stars=["火星", "擎羊星"], mode="any", relation="同宮", phrase="火星または擎羊星が同宮すれば")],
    "禄星がなく、さらに凶星が加会すると": [C("pending", term="禄星", phrase="禄星がなく", reason="禄星の構成星が資料・仕様書に定義されていない"), C("starGroup", group="凶星", relation="加会", negate=False, phrase="凶星が加会すると")],
    "桃花の星に会うことは好まず": [C("pending", term="桃花の星", phrase="桃花の星に会う", reason="桃花の星の構成星が資料・仕様書に定義されていない")],
    "吉星と桃花の星が加会すれば": [C("starGroup", group="吉星", relation="加会", negate=False, phrase="吉星と…が加会すれば"), C("pending", term="桃花の星", phrase="桃花の星が加会", reason="桃花の星の構成星が資料・仕様書に定義されていない")],
}
# 前の文が条件付きでも、まとまりに入れない文（資料の文言。独立した記述）
NOT_FOLLOW = ["ただし男女とも早婚は凶となる"]
USED = set()

def conditions_for(s):
    hits = [k for k in OVERRIDES if k in s]
    assert len(hits) <= 1, (s, hits)
    if hits:
        USED.add(hits[0])
        return OVERRIDES[hits[0]]
    return auto_conditions(s)

# 前の文（条件付き）を受ける書き出し。自分の条件がなければ前の文と同じまとまり（conditionalBlock）にする
FOLLOW = re.compile(r"^(その場合|この条件|そうすれば|その立場|ただし|また|さらに|反対に|そのため|それでも)")

def gender_of(s):
    if "男女とも" in s:
        return "both"
    has_f = bool(re.search(r"^(女命|女性は)|女命(は|では|も)", s))
    has_m = bool(re.search(r"^(男命|男性は)|男命(は|で)", s))
    if has_f and has_m or (("男性は" in s) and ("女性は" in s)):
        return "both"
    if has_f:
        return "female"
    if has_m:
        return "male"
    return None

# 資料の見出しの訂正記録（docs/source の見出しは訂正済み。元の見出しをここに残す）
SOURCE_CORRECTIONS = {
    3: {
        "originalHeading": "命宮は卯で破軍星",
        "correctedHeading": "命宮は寅で破軍星",
        "correctedBranch": "寅",
        "reason": "12支の並び（紫微星が子宮のブロックの3番目）・紫微星が子のとき破軍は寅（既存の星配置）・次の項目も卯で重複するため（2026-10-01 ユーザー確定）",
    },
}

# 本文に出る格局・配置名と基礎２の格局（§23）の関係。リンクだけで、判定は統合しない
RELATIONS = [
    ("「桃花が主を犯す」", "K2-31", "桃花犯主格", "本文が古典の「桃花が主を犯す」に言及"),
    ("「桃花犯主格」", "K2-31", "桃花犯主格", "本文が格局名を記載"),
    ("「巨日が同宮すれば", "K2-11", "巨日同宮格", "本文が古典の巨日同宮に言及"),
    ("「機月同梁」", "K2-09", "機月同梁格", "本文が配置名を記載"),
]

out_items = []
for idx, it in enumerate(items):
    order = idx % 12
    ming = BR[order]
    head = it["heading"]
    hm = re.match(r"^命宮は(.)(?:宮)?で(.*)$", head)
    heading_branch = hm.group(1)
    rest = hm.group(2)
    no_main = rest.startswith("主星が無い")
    if no_main:
        bm = re.search(r"対宮(?:の|が)(.*?)）", rest)
        borrowed = stars_in(bm.group(1))
        displayed = []
        borrow_note = "借りる" if "借りる" in rest else "対宮が（「借りる」の記載なし）"
    else:
        displayed = stars_in(rest)
        borrowed = []
        borrow_note = None
    iid = f"OUYOU-{idx + 1:03d}"
    paras = []
    for pi, p in enumerate(it["paragraphs"]):
        ss = sentences_of(p)
        assert "".join(ss) == p
        para_gender = gender_of(ss[0]) if gender_of(ss[0]) in ("female", "male") else None
        cur_gender = para_gender
        sents = []
        for si, s in enumerate(ss):
            key = f"{it['sourceNumber']}.{pi + 1}.{si + 1}"
            g = gender_of(s)
            if g in ("female", "male"):
                gender = g
                if si == 0 or para_gender:
                    cur_gender = g
            elif g == "both":
                gender = None
                cur_gender = None
            else:
                gender = cur_gender if para_gender else None
            conds = conditions_for(s)
            sents.append({"id": f"{iid}-P{pi + 1}-S{si + 1}", "sourceKey": key, "text": s, "gender": gender, "conditions": conds})
        # 条件付きの文を受ける後続文をまとまりにする
        for si, s in enumerate(sents):
            s["blockOf"] = None
        for si in range(1, len(sents)):
            prev = sents[si - 1]
            lead = prev if prev["blockOf"] is None else next(x for x in sents if x["id"] == prev["blockOf"])
            if not sents[si]["conditions"] and lead["conditions"] and FOLLOW.match(sents[si]["text"]) and not any(x in sents[si]["text"] for x in NOT_FOLLOW):
                sents[si]["blockOf"] = lead["id"]
        paras.append({"id": f"{iid}-P{pi + 1}", "text": p, "sentences": sents})
    out_items.append({
        "id": iid,
        "ziweiBranch": it["ziweiBranch"],
        "mingBranch": ming,
        "headingBranch": heading_branch,
        "headingBranchMismatch": heading_branch != ming,
        "heading": head,
        "noMainStar": no_main,
        "displayedMainStars": displayed,
        "borrowedStars": borrowed,
        "borrowNote": borrow_note,
        "sourceSection": it["section"],
        "sourceOrder": idx + 1,
        "sourceNumber": it["sourceNumber"],
        "sourceCorrection": SOURCE_CORRECTIONS.get(it["sourceNumber"]),
        "paragraphs": paras,
        "sourceRelations": [
            {"sentenceId": x["id"], "phrase": ph, "patternId": pid, "patternName": pn, "note": note}
            for p in paras for x in p["sentences"] for (ph, pid, pn, note) in RELATIONS if ph in x["text"]
        ],
    })

meta = {
    "source": "docs/source/ziwei_ouyou_rewritten.md",
    "title": "紫微斗数推命 応用編 — リライト版",
    "note": "処理記録（本文解釈ではない）。利用者向けの解釈文には使わない",
    "processingRecord": ("# 処理記録" + meta_part).strip(),
    "numberingNote": "リライト版の番号は1〜144で正常化済み（処理記録の「47の重複」は元の原文についての記録で、現在の判定上の問題ではない）。命盤の照合は番号でなく 紫微星の支×命宮の支 で行う",
}
assert USED == set(OVERRIDES), set(OVERRIDES) - USED
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({"meta": meta, "items": out_items}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
n_s = sum(len(p["sentences"]) for i in out_items for p in i["paragraphs"])
n_c = sum(1 for i in out_items for p in i["paragraphs"] for s in p["sentences"] if s["conditions"])
n_f = sum(1 for i in out_items for p in i["paragraphs"] for s in p["sentences"] if s["blockOf"])
n_g = sum(1 for i in out_items for p in i["paragraphs"] for s in p["sentences"] if s["gender"])
print(f"items {len(out_items)} sentences {n_s} conditional {n_c} followers {n_f} gendered {n_g}", file=sys.stderr)
