"""1080.pdf の各局に縦書きで記された格局名ラベルを抽出し、検証専用 fixture を生成する。

出力: tests/fixtures/qimen1080_labels.json
実行: python3 tests/fixtures/gen_qimen1080_labels.py   （要 pip install pymupdf）

位置付け（重要）:
  ・本 fixture は 1080.pdf（呉煒維 制作／山道帰一 監修）の縦書き・斜め書きのラベルを、
    PDF のテキストブロックの位置情報から再構成した「検証データ」である。仕様ではない。
  ・講義資料（docs/source/奇門遁甲講義案N.pdf）および監修確定事項より下位に置く。
    食い違いがあれば講義資料・監修確定事項を優先し、本 fixture を根拠に格局ロジックを変更しない。
  ・1080.pdf の格局名の体系は講義資料と同一ではない（例: 講義の「上格」は 1080.pdf では「小格」）。

抽出方法:
  1. 各局のブロック列は qimen1080.json と同じ並び:
       題名・値符行(2) / 宮名+地盤干(16) / 八門(8) / 天盤干(9) / 八神(8) / 格局ラベル / 九星(18)
     題名から次の題名までを1局とし、[43:-18] を格局ラベル領域とする。
  2. ブロックは抽出順に、直前のブロックとの中心間距離が近く（< 15pt）、かつ並びの向きが
     変わらないものを1語に連結する（1文字ずつ配置された語と、「太|白入|熒」のように
     分割配置された語の両方に対応）。向きが変わった時点で別の語とする。
  3. 直前の語に続かない複数文字のブロック（例「宮入墓」「庚日伏干」）はそれ自体を1語とする。
  4. 再構成は経験的な処理であり、隣接するラベルが1語に連結される場合が残る。
     利用側は「ラベル文字列に格局名が含まれるか」で照合すること。
"""

import json
import math
import re
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "docs" / "source" / "1080.pdf"
OUT = ROOT / "tests" / "fixtures" / "qimen1080_labels.json"

TITLE_RE = re.compile(r"^(陽遁|陰遁).局..日..時$")
PALACE_NAMES = set("坎艮震巽離坤兌乾")
JOIN_DIST = 15.0
ANGLE_TOL = math.radians(35)


def center(b):
    return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)


def group_words(blocks):
    words = []
    cur = None  # {"text", "pts": [(x, y)], "dir": angle | None}
    for b in blocks:
        text = b[4]
        cx, cy = center(b)
        if cur:
            lx, ly = cur["pts"][-1]
            dx, dy = cx - lx, cy - ly
            near = abs(dx) < JOIN_DIST and abs(dy) < JOIN_DIST
            ang = math.atan2(dy, dx)
            same_dir = cur["dir"] is None or abs(
                (ang - cur["dir"] + math.pi) % (2 * math.pi) - math.pi
            ) < ANGLE_TOL
            if near and same_dir:
                cur["text"] += text
                cur["dir"] = ang if cur["dir"] is None else cur["dir"]
                cur["pts"].append((cx, cy))
                continue
            words.append(cur)
        if len(text) > 1:
            # 複数文字ブロックで直前の語に続かないものは、それ自体を1語とする
            words.append({"text": text, "pts": [(cx, cy)], "dir": None})
            cur = None
            continue
        cur = {"text": text, "pts": [(cx, cy)], "dir": None}
    if cur:
        words.append(cur)
    out = []
    for w in words:
        xs = [p[0] for p in w["pts"]]
        ys = [p[1] for p in w["pts"]]
        out.append({"text": w["text"], "x": round(sum(xs) / len(xs), 1), "y": round(sum(ys) / len(ys), 1)})
    return out


def main():
    doc = pymupdf.open(SRC)
    charts = []
    for page in doc:
        blocks = [
            (b[0], b[1], b[2], b[3], b[4].replace("\n", "").strip())
            for b in page.get_text("blocks")
        ]
        blocks = [b for b in blocks if b[4] and not re.fullmatch(r"\d+", b[4])]
        starts = [i for i, b in enumerate(blocks) if TITLE_RE.match(b[4])]
        for k, s in enumerate(starts):
            end = starts[k + 1] if k + 1 < len(starts) else len(blocks)
            seg = blocks[s:end]
            # 構造の検証（qimen1080.json の抽出と同じ並びであること）
            assert seg[2][4] in PALACE_NAMES, (seg[0][4], seg[2][4])
            tail = "".join(b[4] for b in seg[-18:])
            assert re.fullmatch(r"(天.){9}", tail), (seg[0][4], tail)
            ox, oy = seg[0][0], seg[0][1]  # 題名の左上を局内座標の原点にする
            labels = group_words(seg[43:-18])
            for w in labels:
                w["x"] = round(w["x"] - ox, 1)
                w["y"] = round(w["y"] - oy, 1)
            charts.append({"no": len(charts) + 1, "title": seg[0][4], "labels": labels})

    assert len(charts) == 1080, len(charts)
    out = {
        "_meta": {
            "source": "docs/source/1080.pdf （呉煒維 制作／山道帰一 監修「陰陽遁1080局 奇門遁甲格局総覧」）",
            "description": (
                "1080.pdf の縦書き格局名ラベルを位置情報から再構成した検証専用 fixture。仕様ではない。"
                "講義資料・監修確定事項より下位であり、本 fixture を根拠に格局ロジックを変更しないこと。"
            ),
            "extraction": (
                "PyMuPDF のテキストブロック。各局の [43:-18] をラベル領域とし、"
                "抽出順・近接（<15pt）・向きの一致でブロックを連結。x/y は題名左上を原点とする語の中心座標（pt）。"
            ),
            "notes": [
                "隣接ラベルが1語に連結される場合があるため、照合は「文字列に格局名を含むか」で行う。",
                "1080.pdf の格局名の体系は講義資料と同一ではない（例: 講義の上格＝1080.pdf の小格、講義の時格＝1080.pdf の時干格）。",
                "chart の並び・no は tests/fixtures/qimen1080.json と同一。",
                "生成スクリプト: tests/fixtures/gen_qimen1080_labels.py",
            ],
            "count": len(charts),
        },
        "charts": charts,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print("wrote fixture:", len(charts), "charts")


if __name__ == "__main__":
    main()
