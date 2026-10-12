#!/usr/bin/env python3
# scripts/ziwei/extract_meanings.py
#
# 紫微斗数の象意データを資料から抽出して JSON にする（資料由来の象意データベース）。
#   入力: docs/source/紫微斗数入門.pdf（pdftotext -raw / -layout）、docs/source/紫微斗数基礎編.pdf
#   出力: scripts/ziwei/.cache/meanings_raw/*.json（原文を含む中間データ。git 管理外。アプリ用データは build_meanings.py が作る）
# 方針（docs/ziwei-basic-spec.md §21）:
#   - 資料の文を文単位（。区切り）・箇条書き単位に分けるだけで、言い換え・要約・補完はしない
#   - sourceText は資料の文（改行・空白を除いただけ）。normalizedMeaning は見出し記号などを除いた同文
#   - 各データに出典（資料・PDFページ・資料ページ・見出し）を付け、出典ページに原文があることを検証する
# 実行: python3 scripts/ziwei/extract_meanings.py

import json
import re
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NYUMON = ROOT / "docs/source/紫微斗数入門.pdf"
KISO = ROOT / "docs/source/紫微斗数基礎編.pdf"
# 抽出結果（資料の原文を含む）。アプリ用データには直接書かない（build_meanings.py が独自文章に差し替えて src へ出力する）
OUT = Path(os.environ.get("ZIWEI_MEANINGS_RAW_OUT", ROOT / "scripts/ziwei/.cache/meanings_raw"))

SRC_N = "紫微斗数入門"
SRC_K = "紫微斗数基礎編"

MAIN = ["紫微星", "天機星", "太陽星", "武曲星", "天同星", "廉貞星", "天府星", "太陰星", "貪狼星", "巨門星", "天相星", "天梁星", "七殺星", "破軍星"]
MINOR = ["文昌星", "文曲星", "天空星", "地劫星", "火星", "鈴星", "左輔星", "右弼星", "天姚星", "天馬星", "禄存星", "擎羊星", "陀羅星", "天魁星", "天鉞星", "紅鸞星"]
TRANS = ["化禄星", "化権星", "化科星", "化忌星"]
ALL_STARS = MAIN + MINOR + TRANS  # 既存エンジンの34星（src/lib/ziwei/types.ts）
PALACES = ["命宮", "兄弟宮", "夫妻宮", "子女宮", "財帛宮", "疾厄宮", "遷移宮", "奴僕宮", "官禄宮", "田宅宮", "福徳宮", "父母宮"]

# 資料中の表記 → 既存エンジンの星名（note は表記の注記）
ALIASES = [
    ("右輔星", "右弼星", "資料の表記は「右輔星」（左輔星と並記。右弼星の誤記と読める）"),
    # 作盤エンジンの星名は擎羊星。資料の「敬羊星」「敬羊」「羊星」は別名
    ("敬羊星", "擎羊星", None),
    ("羊星", "擎羊星", "資料のテキストでは「羊星」（先頭の1字が欠けている）"),
    ("敬羊", "擎羊星", None),
    ("陀羅", "陀羅星", None),
    ("天空", "天空星", None),
    ("地劫", "地劫星", None),
    ("文昌", "文昌星", None),
    ("文曲", "文曲星", None),
    ("左輔", "左輔星", None),
    ("右弼", "右弼星", None),
    ("化禄", "化禄星", None),
    ("化権", "化権星", None),
    ("化科", "化科星", None),
    ("化忌", "化忌星", None),
    ("貧狼星", "貪狼星", "資料の表記は「貧狼星」（貪狼星の誤記と読める）"),
]

ENTRIES = {k: [] for k in ["stars", "palaces", "transformations", "starPalace", "combinations", "themes"]}
NOTES = []  # 抽出時の注記
PAGE_TEXT = {}  # (source, pdfPage) -> 空白除去済み本文（検証用）


def run(args):
    return subprocess.run(args, capture_output=True, text=True, check=True).stdout


def squash(s):
    return re.sub(r"\s+", "", s)


def pdf_pages(pdf):
    out = run(["pdfinfo", str(pdf)])
    return int(re.search(r"Pages:\s+(\d+)", out).group(1))


def raw_page(pdf, n):
    return run(["pdftotext", "-f", str(n), "-l", str(n), "-raw", str(pdf), "-"])


def doc_page_nyumon(n):
    """入門の資料ページ（ページ下の「‑ N ‑」）。-layout で最後に出る番号を採る"""
    t = run(["pdftotext", "-f", str(n), "-l", str(n), "-layout", str(NYUMON), "-"])
    nums = re.findall(r"‑\s*(\d{1,3})\s*‑", t)
    return int(nums[-1]) if nums else None


FOOTER = re.compile(r"‑\s*\d{1,3}\s*‑")


def clean_lines(text):
    lines = []
    for ln in text.splitlines():
        ln = FOOTER.sub("", ln).strip()
        ln = ln.replace("Copyright", "").strip()
        if not ln or re.search(r"Rights Reserved|Syuzan|^\(C\)", ln):
            continue
        lines.append(ln)
    return lines


def sentences(text):
    """段落テキストを文（。区切り）に分ける。改行は詰める"""
    t = squash(text)
    parts = re.findall(r"[^。]+。?", t)
    return [p for p in parts if p and p != "。"]


def detect_stars(s):
    found = []
    rest = s
    for name in sorted(ALL_STARS, key=len, reverse=True):
        # 資料の「敬羊星」は作盤エンジンの擎羊星（星名と同じ順で検出する）
        for written in [name] + (["敬羊星"] if name == "擎羊星" else []):
            if written in rest:
                found.append(name)
                rest = rest.replace(written, "＿")
    for alias, name, note in ALIASES:
        if alias in rest:
            if alias == "羊星" and "敬羊星" in s:
                continue
            if note:
                NOTES.append(f"{note}")
            found.append(name)
            rest = rest.replace(alias, "＿")
    seen = []
    for x in found:
        if x not in seen:
            seen.append(x)
    return seen


def detect_palace(s):
    for p in PALACES:
        if p in s:
            return p
    return None


def tags_for(category, text, palace=None):
    tags = []
    if category in ("basic",):
        tags.append("personality")
    if category == "career":
        tags.append("career")
    if category == "appearance":
        tags.append("appearance")
    pal_tag = {"財帛宮": "wealth", "夫妻宮": "relationship", "兄弟宮": "family", "子女宮": "family", "父母宮": "family", "疾厄宮": "health", "官禄宮": "career"}
    if palace in pal_tag:
        tags.append(pal_tag[palace])
    if re.match(r"^(短所|欠点)", text):
        tags.append("weakness")
    if re.match(r"^長所", text):
        tags.append("strength")
    if "注意" in text:
        tags.append("caution")
    return sorted(set(tags))


def ref(source, pdf_page, doc_page, section):
    return {"source": source, "pdfPage": pdf_page, "docPage": doc_page, "section": section}


def entry(kind, sid, text, r, **kw):
    t = squash(text)
    norm = re.sub(r"^[・●]", "", t)
    e = {"id": sid, "sourceText": t, "normalizedMeaning": norm, "ref": r}
    e.update({k: v for k, v in kw.items() if v is not None})
    ENTRIES[kind].append(e)
    return e


# ---------------------------------------------------------------------------
# 入門
# ---------------------------------------------------------------------------

def load_nyumon():
    pages = {}
    for n in range(1, pdf_pages(NYUMON) + 1):
        raw = raw_page(NYUMON, n)
        pages[n] = (clean_lines(raw), doc_page_nyumon(n))
        PAGE_TEXT[(SRC_N, n)] = squash(FOOTER.sub("", raw))
    return pages


STAR_TITLES = {
    "紫微星": ["紫微星"], "天機星": ["天機星"], "太陽星": ["太陽星"], "武曲星": ["武曲星"], "天同星": ["天同星"],
    "廉貞星": ["廉貞星"], "天府星": ["天府星"], "太陰星": ["太陰星"], "貪狼星": ["貪狼星"], "巨門星": ["巨門星"],
    "天相星": ["天相星"], "天梁星": ["天梁星"], "七殺星": ["七殺星"], "破軍星": ["破軍星"],
    "文昌星・文曲星": ["文昌星", "文曲星"], "左輔星・右弼星": ["左輔星", "右弼星"], "天魁星・天鉞星": ["天魁星", "天鉞星"],
    "禄存星": ["禄存星"], "敬羊星・陀羅星": ["擎羊星", "陀羅星"], "火星・鈴星": ["火星", "鈴星"],
    "天空星・地劫星": ["天空星", "地劫星"], "化曜星": TRANS, "天馬星": ["天馬星"], "天姚星": ["天姚星"], "紅鸞星": ["紅鸞星"],
}

HEADING_CAT = [
    ("イメージ", "image"), ("基本的特質", "basic"), ("容貌", "appearance"), ("能力", "career"),
    ("その他の星曜との配合", "combination"),
]


def star_chapter(pages):
    stars = None
    title = None
    palace = None
    category = "basic"
    heading = ""
    buf = []
    buf_meta = None
    count = [0]

    def flush():
        nonlocal buf, buf_meta
        if not buf or not buf_meta:
            buf = []
            return
        text = "".join(buf)
        for s in sentences(text):
            pdfp, docp, st, pal, cat, head, ttl = buf_meta
            section = f"4.諸星曜の意味と命宮における判断／{ttl}" + (f"／{head}" if head else "")
            other_pal = None
            m = re.search(r"(兄弟|夫妻|子女|財帛|疾厄|遷移|奴僕|官禄|田宅|福徳|父母)宮に(この星|[^、。]*星)が(あれば|入)", s)
            if m:
                other_pal = m.group(1) + "宮"
            count[0] += 1
            r = ref(SRC_N, pdfp, docp, section)
            eff_pal = other_pal or pal
            is_trans = all(x in TRANS for x in st)
            kind = "transformations" if is_trans else "stars"
            e = entry(kind, f"N-ST-{count[0]:04d}", s, r, stars=st, palace=eff_pal, category=cat,
                      tags=tags_for(cat, squash(s), eff_pal),
                      condition=("命宮の力量" if "力量" in s else None))
            if other_pal:
                entry("starPalace", f"N-SP-S{count[0]:04d}", s, r, stars=st, palace=other_pal, tags=tags_for("", squash(s), other_pal))
            mentioned = detect_stars(s)
            if len(set(mentioned) | set(st)) >= 2 and re.search(r"同宮|加会", s) and cat in ("combination", "basic", "career", "appearance") :
                rel = "同宮・加会" if "同宮・加会" in s else ("同宮" if "同宮" in s else "加会")
                others = [x for x in mentioned if x not in st]
                if others:
                    entry("combinations", f"N-CB-{count[0]:04d}", s, r, subjectStars=list(st), withStars=others,
                          stars=list(st) + others, relation=rel, palace=pal,
                          note=("相手の星が複数列挙されている（同時にそろう意味か、いずれかの意味かは原文による）" if len(others) > 1 else None))
        buf = []

    for n in range(37, 76):
        lines, docp = pages[n]
        for ln in lines:
            if ln in ("主星14星の意味", "副星の意味"):
                continue
            if ln in STAR_TITLES:
                flush()
                title = ln
                stars = STAR_TITLES[ln]
                palace = None
                category = "basic"
                heading = ""
                buf_meta = None
                continue
            if stars is None:
                continue
            if re.match(r"^命宮に入った", ln):
                flush()
                palace = "命宮"
                continue
            if ln.startswith("●"):
                flush()
                h = ln[1:]
                heading = h
                if title == "化曜星":
                    tstar = h.strip()
                    stars = [tstar] if tstar in TRANS else stars
                    palace = "命宮"
                    category = "basic"
                elif h.startswith("命宮に入った"):
                    palace = "命宮"
                    category = "basic"
                else:
                    category = next((c for k, c in HEADING_CAT if k in h), "basic")
                buf_meta = (n, docp, list(stars), palace, category, heading, title)
                continue
            if ln.startswith("諸星曜のイメージ"):
                flush()
                stars = None
                break
            if buf_meta is None:
                buf_meta = (n, docp, list(stars), palace, category, heading, title)
            # 命宮に持つ人は… で命宮に切り替わる（見出しのない星）
            if "を命宮に持つ" in ln and palace is None:
                flush()
                palace = "命宮"
                buf_meta = (n, docp, list(stars), palace, category, heading, title)
            if buf_meta[0] != n and buf:
                # ページをまたぐ文はそのまま続ける（出典は文の開始ページ）
                pass
            if not buf:
                buf_meta = (n, docp, list(stars), palace, category, heading, title)
            buf.append(ln)
        if stars is None and n > 70:
            break
    flush()


def twelve_palaces(pages):
    pal = None
    theme = None
    c = 0
    for n in range(29, 32):
        lines, docp = pages[n]
        text_blocks = []
        for ln in lines:
            m = re.match(r"^（(\d+)）(.+宮)$", ln)
            if m:
                text_blocks.append(("HEAD", m.group(2)))
                continue
            text_blocks.append(("TXT", ln))
        buf = []

        def flush():
            nonlocal buf, c
            for s in sentences("".join(buf)):
                if s.startswith("さて、") or s.startswith("また、ここで注意"):
                    globals()["_twelve_theme"] = True
                if globals().get("_twelve_theme"):
                    c += 1
                    entry("themes", f"N-TH-12-{c:03d}", s, ref(SRC_N, n, docp, "1.12宮が示すもの"), theme="十二宮の見方",
                          tags=tags_for("", s))
                elif pal:
                    c += 1
                    cat = "caution" if "注意" in s else "target"
                    entry("palaces", f"N-PL-{c:03d}", s, ref(SRC_N, n, docp, f"1.12宮が示すもの／{pal}"), palace=pal, category=cat,
                          tags=tags_for("", s, pal))
            buf = []

        for kind, v in text_blocks:
            if kind == "HEAD":
                flush()
                pal = v
            else:
                if v in ("１.12宮が示すもの", "12宮"):
                    continue
                if pal is None:
                    continue
                buf.append(v)
        flush()


def themes_pages(pages, rng, theme_of, prefix):
    c = 0
    for n in rng:
        lines, docp = pages[n]
        section = ""
        buf = []

        def flush():
            nonlocal buf, c
            for s in sentences("".join(buf)):
                c += 1
                entry("themes", f"{prefix}-{c:03d}", s, ref(SRC_N, n, docp, section), theme=theme_of(section), tags=tags_for("", s))
            buf = []

        for ln in lines:
            if re.match(r"^(２\.宮と宮との関係|本宮・対宮・三合宮|３\.運命指数による判断|運命指数とは|運命指数の算出|運命指数を使う|トピックス.*|７\.命盤解読のポイント|６\.流年の判断)$", ln):
                flush()
                section = ln
                continue
            if re.match(r"^(図３|本宮 |対宮 |三合宮 )", ln) and n == 32:
                pass
            buf.append(ln)
        flush()


PAL_PAGES = [("兄弟宮", 77, 78), ("夫妻宮", 79, 80), ("子女宮", 81, 82), ("財帛宮", 83, 84), ("疾厄宮", 85, 86), ("遷移宮", 87, 88),
             ("奴僕宮", 89, 90), ("官禄宮", 91, 92), ("田宅宮", 93, 94), ("福徳宮", 95, 96), ("父母宮", 97, 98)]


def parse_label(ln):
    """行頭の星ラベル（星名の並び）と、同じ行の箇条書きを分ける"""
    m = re.match(r"^([^・\s]+(?:・[^・\s]+)*)\s*(・.*)?$", ln)
    if not m:
        return None, None
    label = m.group(1)
    parts = re.split(r"・", label)
    names = []
    for p in parts:
        st = detect_stars(p)
        if len(st) != 1 or squash(p) not in [st[0], st[0][:-1], "右輔星", "敬羊星", "羊星", "敬羊", "陀羅", "天空", "地劫"]:
            return None, None
        names.append(st[0])
    return names, m.group(2)


def bbox_lines(pdf, n):
    """ページの行（座標つき）。footer は除く"""
    html = run(["pdftotext", "-f", str(n), "-l", str(n), "-bbox-layout", str(pdf), "-"])
    out = []
    for m in re.finditer(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', html, re.S):
        words = re.findall(r">([^<]+)</word>", m.group(5))
        text = " ".join(words)
        if FOOTER.fullmatch(squash(text)) or not squash(text):
            continue
        out.append({"x": float(m.group(1)), "y0": float(m.group(2)), "y1": float(m.group(4)), "words": words, "text": text})
    return out


def label_of(words):
    """行の先頭の語が星ラベルなら（星名の並び, 残りの語）"""
    names, _ = parse_label(words[0])
    if names:
        return names, words[1:]
    return None, None


def table_page(pdf, n):
    """星ラベル列＋箇条書き列の表を、縦位置で星に割り当てる。
    戻り値: (前書きの行テキスト, [(stars, bullet_text), ...])"""
    lines = bbox_lines(pdf, n)
    bullets_x = min((l["x"] for l in lines if l["words"][0].startswith("・")), default=None)
    labels, items, intro = [], [], []
    for l in lines:
        names, rest = label_of(l["words"])
        if names and (bullets_x is None or l["x"] < bullets_x - 15):
            labels.append({"stars": names, "yc": (l["y0"] + l["y1"]) / 2, "inlineLabel": bool(rest)})
            if rest:
                items.append({"y0": l["y0"], "y1": l["y1"], "text": "".join(rest), "inline": names})
            continue
        if bullets_x is not None and l["x"] >= bullets_x - 5:
            items.append({"y0": l["y0"], "y1": l["y1"], "text": "".join(l["words"]), "inline": None})
        else:
            intro.append((l["y0"], "".join(l["words"])))
    items.sort(key=lambda i: i["y0"])
    # 箇条書き（・で始まる）ごとにまとめ、続きの行をつなぐ
    bullets = []
    for it in items:
        if it["text"].startswith("・") or not bullets:
            bullets.append(dict(it))
        else:
            bullets[-1]["text"] += it["text"]
            bullets[-1]["y1"] = it["y1"]
    # 行間で枠（ブロック）に分ける
    groups = []
    for b in bullets:
        if groups and b["inline"] is None and groups[-1][-1]["inline"] is None and b["y0"] - groups[-1][-1]["y1"] < 6:
            groups[-1].append(b)
        else:
            groups.append([b])
    # 各星ラベルを、縦方向の距離が最も近い枠に割り当てる（枠の範囲内なら距離0）
    def dist(lb, g):
        lo, hi = g[0]["y0"], g[-1]["y1"]
        return 0 if lo <= lb["yc"] <= hi else min(abs(lb["yc"] - lo), abs(lb["yc"] - hi))
    table_groups = [g for g in groups if not g[0]["inline"]]
    assigned = {id(g): [] for g in table_groups}
    for lb in labels:
        if lb.get("inlineLabel"):
            continue
        if table_groups:
            g = min(table_groups, key=lambda g: dist(lb, g))
            assigned[id(g)].append(lb)
    result = []
    for g in groups:
        if g[0]["inline"]:
            stars = g[0]["inline"]
        else:
            stars = [s for lb in sorted(assigned[id(g)], key=lambda x: x["yc"]) for s in lb["stars"]]
        for b in g:
            result.append((stars, b["text"]))
    return [t for _, t in sorted(intro)], result


def palace_chapter(pages):
    c = 0
    chapter_intro = []
    for pal, a, b in PAL_PAGES:
        intro = []
        intro_ref = None
        for n in range(a, b + 1):
            _, docp = pages[n]
            pre, rows = table_page(NYUMON, n)
            for ln in pre:
                if ln == pal:
                    continue
                if ln.startswith("５.諸星曜の各宮"):
                    chapter_intro.append((n, docp, None))
                    continue
                if chapter_intro and chapter_intro[-1][2] is None or (chapter_intro and intro_ref is None and not intro and n == 77 and not ln.startswith(pal[:2])):
                    if not ln.startswith(pal[:2]) or chapter_intro[-1][2] is None:
                        chapter_intro.append((n, docp, ln))
                        if ln.startswith("ーワード"):
                            chapter_intro.append((n, docp, "END"))
                        continue
                if intro_ref is None:
                    intro_ref = (n, docp)
                intro.append(ln)
            for stars, text in rows:
                if not stars:
                    NOTES.append(f"入門 p{n} の箇条書きに星ラベルが対応しない: {text[:20]}")
                    continue
                c += 1
                entry("starPalace", f"N-SP-{c:04d}", text, ref(SRC_N, n, docp, f"5.諸星曜の各宮における判断／{pal}"),
                      stars=list(stars), palace=pal, tags=tags_for("", squash(text), pal))
        for s in sentences("".join(intro)):
            c += 1
            cat = "caution" if "注意" in s else ("strengthRule" if "力量" in s else "target")
            entry("palaces", f"N-PL-{pal}-{c:04d}", s, ref(SRC_N, intro_ref[0], intro_ref[1], f"5.諸星曜の各宮における判断／{pal}"),
                  palace=pal, category=cat, tags=tags_for("", s, pal))
    txt = "".join(x[2] for x in chapter_intro if x[2] and x[2] != "END")
    if txt:
        n, docp = chapter_intro[0][0], chapter_intro[0][1]
        for i, s in enumerate(sentences(txt), 1):
            entry("themes", f"N-TH-PAL-{i:03d}", s, ref(SRC_N, n, docp, "5.諸星曜の各宮における判断"), theme="宮別判断の考え方", tags=tags_for("", s))


def ryunen(pages):
    """6.流年の判断: 前書き・年の扱い（テーマ）と、各星曜の意味（大限・小限）"""
    c = 0
    stars = None
    mode = "theme"
    last = None
    buf = []
    buf_ref = None
    pending = []

    def flush_theme():
        nonlocal buf, c
        for s in sentences("".join(buf)):
            c += 1
            entry("themes", f"N-TH-RN-{c:03d}", s, ref(SRC_N, buf_ref[0], buf_ref[1], "6.流年の判断"), theme="流年", tags=tags_for("", s))
        buf = []

    for n in range(99, 102):
        lines, docp = pages[n]
        for ln in lines:
            if ln in ("６.流年の判断",):
                continue
            if ln.startswith("７.命盤解読のポイント"):
                flush_theme()
                return
            if ln == "流年における各星曜の意味" or ln == "流年における年の扱い":
                flush_theme()
                mode = "theme" if ln == "流年における年の扱い" else "stars"
                stars = None
                continue
            names, rest = parse_label(ln)
            if names:
                flush_theme()
                mode = "stars"
                if last is None and pending:
                    pending += names
                else:
                    pending = names
                stars = pending
                last = None
                continue
            if mode == "stars" and ln.startswith("・") and stars:
                c += 1
                last = entry("stars", f"N-ST-RN-{c:03d}", ln, ref(SRC_N, n, docp, "6.流年の判断／流年における各星曜の意味"),
                             stars=list(stars), palace=None, category="luckPeriod", tags=tags_for("", squash(ln)),
                             condition=("巡る宮の力量" if "力量" in ln else None))
                pending = []
                continue
            if mode == "stars" and last is not None and stars:
                last["sourceText"] += squash(ln)
                last["normalizedMeaning"] = re.sub(r"^・", "", last["sourceText"])
                continue
            if mode == "stars" and ln.startswith("それでは"):
                continue
            if not buf:
                buf_ref = (n, docp)
            buf.append(ln)
    flush_theme()


def points(pages):
    c = 0
    item = ""
    for n in range(102, 104):
        lines, docp = pages[n]
        buf = []
        for ln in lines:
            m = re.match(r"^([１-９1-9])\.(.+)$", ln)
            if m:
                for s in sentences("".join(buf)):
                    c += 1
                    entry("themes", f"N-TH-PT-{c:03d}", s, ref(SRC_N, n, docp, f"7.命盤解読のポイント{('／' + item) if item else ''}"),
                          theme="命盤解読のポイント", tags=tags_for("", s))
                buf = []
                item = m.group(0)
                c += 1
                entry("themes", f"N-TH-PT-{c:03d}", ln, ref(SRC_N, n, docp, "7.命盤解読のポイント"), theme="命盤解読のポイント", step=m.group(0))
                continue
            if ln.startswith("７.命盤解読のポイント") or ln.startswith("付表"):
                continue
            buf.append(ln)
        for s in sentences("".join(buf)):
            c += 1
            entry("themes", f"N-TH-PT-{c:03d}", s, ref(SRC_N, n, docp, f"7.命盤解読のポイント{('／' + item) if item else ''}"),
                  theme="命盤解読のポイント", tags=tags_for("", s))


# ---------------------------------------------------------------------------
# 基礎編（スライド。S番号＝PDFページ）
# ---------------------------------------------------------------------------

def kiso_slide(n):
    raw = raw_page(KISO, n)
    t = "".join(clean_lines(raw))
    PAGE_TEXT[(SRC_K, n)] = squash(t)
    return squash(t)


def kiso():
    # 十二宮の象意（S20〜S22）
    txt = kiso_slide(20) + "\x00" + kiso_slide(21) + "\x00" + kiso_slide(22)
    heads = ["命宮", "兄弟宮", "夫婦宮", "子女宮", "財帛宮", "疾厄宮", "遷移宮", "奴僕宮", "官禄宮", "田宅宮", "福徳宮", "父母宮", "身宮"]
    body = re.sub(r"^命盤の解釈１，十二宮の象意", "", txt)
    body = body.replace("十二宮の象意２", "").replace("十二宮の象意３", "")
    pos = []
    for h in heads:
        i = body.find(h, pos[-1][1] + 1 if pos else 0)
        pos.append((h, i))
    for k, (h, i) in enumerate(pos):
        j = pos[k + 1][1] if k + 1 < len(pos) else len(body)
        seg = body[i + len(h):j]
        slide = 20 + body[:i].count("\x00")
        seg = seg.replace("\x00", "")
        pal = "夫妻宮" if h == "夫婦宮" else h
        if h == "夫婦宮":
            NOTES.append("基礎編 S20 の見出しは「夫婦宮」（入門・エンジンは夫妻宮）")
        parts = [p for p in re.split(r"(?<=[。？])|(?<=など)(?=[^、。])", seg) if p]
        for m, p in enumerate(parts, 1):
            if h == "身宮":
                entry("palaces", f"K-PL-身宮-{m:02d}", p, ref(SRC_K, slide, None, "十二宮の象意／身宮"), palace="身宮",
                      category="target", tags=[])
            else:
                entry("palaces", f"K-PL-{pal}-{m:02d}", p, ref(SRC_K, slide, None, f"十二宮の象意／{h}"), palace=pal,
                      category="target", tags=tags_for("", p, pal))
    # 宮同士の関係（S16）・力量（S14・S15・S17・S18）
    for n, sec, th in [(14, "各星耀の廟旺利陥", "旺衰"), (15, "推羅式力量計算", "三方四正"), (16, "宮同士の関係", "三方四正"),
                       (17, "星、宮の力量による判断", "運命指数"), (18, "星、宮の力量による判断２", "運命指数")]:
        t = kiso_slide(n)
        t = re.sub(r"^作盤[０-９\d]+", "", t)
        for m, s in enumerate(re.findall(r"[^。]+。?", t), 1):
            entry("themes", f"K-TH-{n}-{m:02d}", s, ref(SRC_K, n, None, sec), theme=th, tags=tags_for("", s))
    # 大限、小限における星曜の象意（S23〜S28）
    labels = [("紫微星", ["紫微星"]), ("天機星", ["天機星"]), ("太陽星", ["太陽星"]), ("武曲星", ["武曲星"]), ("天同星", ["天同星"]),
              ("廉貞星", ["廉貞星"]), ("天府星", ["天府星"]), ("太陰星", ["太陰星"]), ("貧狼星", ["貪狼星"]), ("巨門星", ["巨門星"]),
              ("天相星", ["天相星"]), ("天梁星", ["天梁星"]), ("七殺星", ["七殺星"]), ("破軍星", ["破軍星"]),
              ("文昌、文曲星", ["文昌星", "文曲星"]), ("右弼、左輔星", ["右弼星", "左輔星"]),
              ("火星、鈴星、敬羊、陀羅星", ["火星", "鈴星", "擎羊星", "陀羅星"])]
    c = 0
    for n in range(23, 29):
        t = kiso_slide(n)
        t = re.sub(r"^大限、小限における星曜の象意[２-６]?", "", t)
        idx = []
        for lab, st in labels:
            i = t.find(lab)
            if i >= 0:
                idx.append((i, lab, st))
        idx.sort()
        for k, (i, lab, st) in enumerate(idx):
            j = idx[k + 1][0] if k + 1 < len(idx) else len(t)
            seg = t[i + len(lab):j]
            if lab == "貧狼星":
                NOTES.append("基礎編 S26 の表記は「貧狼星」（貪狼星）")
            for b in [x for x in seg.split("・") if x]:
                c += 1
                entry("stars", f"K-ST-DX-{c:03d}", "・" + b, ref(SRC_K, n, None, "大限、小限における星曜の象意"), stars=st, palace=None,
                      category="luckPeriod", tags=tags_for("", b), condition=("巡る宮の力量" if "力量" in b else None))
    # 命盤解読のポイント（S29・S30）
    c = 0
    for n in (29, 30):
        t = kiso_slide(n)
        t = re.sub(r"^命盤解読のポイント", "", t)
        for s in re.findall(r"[^。]+。?", t):
            c += 1
            entry("themes", f"K-TH-PT-{c:03d}", s, ref(SRC_K, n, None, "命盤解読のポイント"), theme="命盤解読のポイント", tags=tags_for("", s))


# ---------------------------------------------------------------------------
# 資料差異・星の収録状況
# ---------------------------------------------------------------------------

def compare():
    diffs = []
    # 大限・小限の星曜の象意: 入門「流年における各星曜の意味」 と 基礎編 S23〜S28
    def norm(s):
        return re.sub(r"[・。、\s（）()]", "", s)
    by_star = {}
    for e in ENTRIES["stars"]:
        if e.get("category") != "luckPeriod":
            continue
        key = "・".join(e["stars"])
        by_star.setdefault(key, {}).setdefault(e["ref"]["source"], []).append(e)
    for key, d in by_star.items():
        a = d.get(SRC_N, [])
        b = d.get(SRC_K, [])
        if not a or not b:
            diffs.append({"topic": f"大限・小限の星曜の象意／{key}", "status": "additional", "entryIds": [x["id"] for x in a + b],
                          "note": "片方の資料だけに記載"})
            continue
        ta = "".join(norm(x["normalizedMeaning"]) for x in a)
        tb = "".join(norm(x["normalizedMeaning"]) for x in b)
        status = "same" if ta == tb else "wording_difference"
        diffs.append({"topic": f"大限・小限の星曜の象意／{key}", "status": status, "entryIds": [x["id"] for x in a + b],
                      "note": None if status == "same" else "語尾・言い回しの違い（例: 入門「〜の暗示あり」／基礎編「〜の時期」）"})
    # 十二宮
    for p in PALACES:
        a = [e for e in ENTRIES["palaces"] if e["palace"] == p and e["ref"]["source"] == SRC_N and e["ref"]["section"].startswith("1.12宮")]
        b = [e for e in ENTRIES["palaces"] if e["palace"] == p and e["ref"]["source"] == SRC_K]
        diffs.append({"topic": f"十二宮の象意／{p}", "status": "wording_difference" if a and b else "additional",
                      "entryIds": [x["id"] for x in a + b], "note": "基礎編は入門の要約的な表記" if a and b else None})
    manual = [
        ("身宮", "needs_review", ["入門 p32（1.12宮が示すもの（13）身宮）", "基礎編 S22"],
         "入門は「命宮は先天運、身宮は後天運と言われる」「諸説については深く追及しない」。基礎編は「実はとても重要な宮」「数え年35才を過ぎた辺りから身宮の象意が現れ、命宮6：身宮4 から 4：6 に逆転する」を追加。扱いの重みが異なる"),
        ("三方四正（本宮・対宮・三合宮）", "wording_difference", ["入門 p33", "基礎編 S15・S16"],
         "定義は一致（同宮・加会の用語も一致）。入門は対宮の影響を「50〜60％」、三合宮2つで「約60％」と文章で述べ、計算式は対宮×0.5・三合宮×0.3×2。基礎編は計算式のみ"),
        ("運命指数の5段階", "wording_difference", ["入門 p35", "基礎編 S17"], "段階名が入門「平」、基礎編「並」。数値範囲は同じ"),
        ("命宮・身宮の力量と人生傾向", "additional", ["基礎編 S18"], "基礎編だけに記載（命宮・身宮が強・最強／弱・最弱の場合の人生傾向）"),
        ("命盤解読のポイント", "wording_difference", ["入門 p103〜104", "基礎編 S29・S30"], "手順の骨子は同じ。基礎編は要約的で、夫妻宮・福徳宮について「特に女性の場合は官禄宮と財帛宮と同等か、あるいはそれ以上の重要度」を明記"),
        ("大限・小限の星曜の象意", "wording_difference", ["入門 p101〜103（流年における各星曜の意味）", "基礎編 S23〜S28"],
         "項目・内容はほぼ同じ。語尾（入門「〜の暗示あり」「〜べし」／基礎編「〜の時期」「〜べき」）などの違い"),
        ("星の象意（命宮・イメージ・配合）", "additional", ["入門 p38〜76"], "基礎編には星ごとの性格・命宮の象意の記載がない（入門のみ）"),
        ("星×宮（命宮以外の11宮）", "additional", ["入門 p78〜99"], "基礎編には記載がない（入門のみ）"),
    ]
    for topic, status, refs, note in manual:
        diffs.append({"topic": topic, "status": status, "entryIds": [], "refs": refs, "note": note})
    return diffs


def star_status():
    rows = []
    for s in ALL_STARS:
        kinds = {}
        for k in ("stars", "transformations", "starPalace", "combinations"):
            n = sum(1 for e in ENTRIES[k] if s in e.get("stars", []))
            kinds[k] = n
        srcs = sorted({e["ref"]["source"] for k in ("stars", "transformations", "starPalace") for e in ENTRIES[k] if s in e.get("stars", [])})
        rows.append({"star": s, "meaningAvailable": sum(kinds.values()) > 0, "counts": kinds, "sources": srcs})
    return rows


def verify():
    bad = []
    for k, arr in ENTRIES.items():
        for e in arr:
            key = (e["ref"]["source"], e["ref"]["pdfPage"])
            body = PAGE_TEXT.get(key, "")
            probe = e["sourceText"].lstrip("・")[:20]
            nxt = PAGE_TEXT.get((key[0], key[1] + 1), "")
            if probe and probe not in body and probe not in (body + nxt):
                bad.append((k, e["id"], probe))
    return bad


def main():
    pages = load_nyumon()
    star_chapter(pages)
    twelve_palaces(pages)
    themes_pages(pages, [32], lambda s: "三方四正", "N-TH-SF")
    themes_pages(pages, [33, 34], lambda s: "運命指数", "N-TH-UN")
    themes_pages(pages, [35], lambda s: "旺衰", "N-TH-OS")
    palace_chapter(pages)
    ryunen(pages)
    points(pages)
    kiso()
    bad = verify()
    if bad:
        print("出典ページに原文が見つからない:", len(bad))
        for b in bad[:30]:
            print("  ", b)
        sys.exit(1)
    OUT.mkdir(parents=True, exist_ok=True)
    for k, arr in ENTRIES.items():
        (OUT / f"{k}.json").write_text(json.dumps(arr, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    meta = {"sourceDifferences": compare(), "starStatus": star_status(), "extractionNotes": sorted(set(NOTES))}
    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    for k, arr in ENTRIES.items():
        print(k, len(arr))


if __name__ == "__main__":
    main()
