// src/lib/ziwei/print/palacePrintData.ts
//
// 紫微斗数の解釈印刷：1宮分の「印刷用鑑定データ」（lib/print/palacePrint.ts の PalacePrintData）。
// buildZiweiPrintData の宮データ（既存の作盤・力量・象意コンテキスト・buildRuleBasedInterpretation〔standard〕・応用編の結果）を
// 鑑定書の並びに整理するだけ。新しい文は作らない。
//   基本情報表（宮名・干支・在宮星・旺衰・四化・対宮・三合宮・運命指数・大限）
//   → 宮の基本解釈 → 星の性質 → 星×宮（テーマ別）→ 三方四正（加会）→ 四化 → 組み合わせ（同宮）→ 力量 → 応用編（命宮だけ）
// 解釈の各節はテーマ（資料の種類）で見出しに振り分ける（文の順序・文言はそのまま）。
// 重複の整理: 同じ宮の中で、まったく同じ文（前置き「また、」「一方で、」を除いて同一）が2回目以降に出たら除く
// （例: 2つの星の資料に同じ文があるとき）。別の宮の同じ文は宮固有の内容として残す。
// 運命指数は表に1回（力量の節では星の力量だけ）。空の節は出さない。

import { compactSections, type PalacePrintData, type PalacePrintSection } from "../../print/palacePrint";
import type { PrintPalaceDetail, PrintStar } from "./printData";

const STAR_PALACE_THEMES = ["性格・人物像", "能力・仕事", "財", "対人関係", "家族・親族", "健康", "容貌・態度", "短所・注意", "その他"];

const PREFIX = /^(また、|一方で、)/;
/** 文に分ける（句点を残す） */
const splitSentences = (t: string) => t.match(/[^。]+。?/g) ?? [];

/** 同じ宮の中で既出の文を除く（seen は宮ごとに共有） */
function dedupe(text: string, seen: Set<string>): string {
  const out: string[] = [];
  for (const s of splitSentences(text)) {
    const key = s.replace(PREFIX, "").replace(/。$/, "").trim();
    if (key.length > 0 && seen.has(key)) continue;
    if (key.length > 0) seen.add(key);
    out.push(s);
  }
  return out.join("");
}

const strengthLine = (stars: PrintStar[]) => stars.filter((s) => s.strength).map((s) => `${s.name}：${s.strength}`).join("　");
const huaLine = (stars: PrintStar[]) => stars.flatMap((s) => s.hua.map((h) => `${s.name}：${h.kind}`)).join("　");

export function buildZiweiPalacePrintData(p: PrintPalaceDetail): PalacePrintData {
  const opposite = p.sanfang.filter((x) => x.role === "対宮");
  const trines = p.sanfang.filter((x) => x.role !== "対宮");
  const ref = (x: PrintPalaceDetail["sanfang"][number]) => `${x.palace}（${x.branch}）${x.stars ? `：${x.stars}` : "：星なし"}`;

  const table: [string, string][] = [
    ["宮名", `${p.name}${p.isShenPalace ? "（身宮）" : ""}`],
    ["干支", `${p.stem}${p.branch}`],
    ["在宮星", p.stars.length ? p.stars.map((s) => s.name).join("・") : "なし（主星なし）"],
  ];
  const st = strengthLine(p.stars);
  if (st) table.push(["旺衰", st]);
  const hua = huaLine(p.stars);
  if (hua) table.push(["四化", hua]);
  table.push(["対宮", opposite.map(ref).join("　")], ["三合宮", trines.map(ref).join("　／　")], ["運命指数", `${p.index.toFixed(1)}　${p.grade}`], ["大限", p.dayun]);

  const seen = new Set<string>();
  const byTheme = new Map(p.interpretation.map((x) => [x.theme, x.text]));
  const one = (theme: string) => {
    const t = byTheme.get(theme);
    return t ? [{ text: dedupe(t, seen) }].filter((x) => x.text) : [];
  };

  const sections: PalacePrintSection[] = [
    { title: "宮の基本解釈", blocks: [{ paragraphs: one("この宮が表すもの") }] },
    { title: "星の性質", blocks: [{ paragraphs: one("星の性質") }] },
    {
      title: "星×宮",
      blocks: STAR_PALACE_THEMES.filter((t) => byTheme.has(t)).map((t) => ({ heading: t, paragraphs: one(t) })),
    },
    { title: "三方四正（加会）", blocks: [{ paragraphs: one("三方四正（加会）") }] },
    { title: "四化", blocks: [{ paragraphs: one("四化") }] },
    { title: "組み合わせ（同宮）", blocks: [{ paragraphs: one("星の組み合わせ（同宮）") }] },
    {
      title: "力量",
      blocks: [{ rows: p.powerItems.length ? [["星の力量", p.powerItems.map((x) => `${x.label} ${x.power}`).join("　")]] : [] }],
    },
  ];
  if (p.advanced) {
    sections.push({
      title: "応用編",
      blocks: [
        {
          heading: `紫微星：${p.advanced.ziweiBranch}宮　命宮：${p.advanced.mingBranch}宮　配置：${p.advanced.layout}`,
          paragraphs: p.advanced.paragraphs.map((t) => ({ text: dedupe(t, seen) })).filter((x) => x.text),
        },
      ],
    });
  }
  return { palaceName: p.name, titleSub: p.branch, isShenPalace: p.isShenPalace, summaryTable: table, sections: compactSections(sections) };
}
