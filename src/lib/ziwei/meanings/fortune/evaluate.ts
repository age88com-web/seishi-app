// src/lib/ziwei/meanings/fortune/evaluate.ts
//
// 大限・小限における星曜の象意の判定。docs/ziwei-basic-spec.md §29。
// 宮の支（物理的な宮）の星について、大限・小限で共通のデータを引き、巡る宮の力量で条件付きの文を判定する。
//   巡る宮の力量 … その宮の本命盤の運命指数（calculateChartPower）。最強・強＝強い、弱・最弱＝弱い、平＝どちらでもない
//   星の力量 … 資料に数値の定義がある星だけ判定（STAR_POWER_RULES）。定義のない星は pending
// 大限・小限の宮名は buildFortunePalaceContext の majorPalaceMap・minorPalaceMap の結果を使う（再計算しない）。

import { calculateChartPower, starPowerOf } from "../../power";
import type { ChartPower } from "../../power";
import type { Branch, PlacedStar, ZiweiChart } from "../../types";
import type { FortunePalaceContext } from "../../fortune/context";
import { STAR_POWER_RULES } from "../powerCondition";
import { FORTUNE_STAR_ITEMS, fortuneStarItemOf } from "./data";
import type {
  EvaluatedFortuneLine,
  FortuneLineResult,
  FortunePalaceStarInterpretation,
  FortuneStarCondition,
  FortuneStarItem,
  FortuneStarMeaning,
} from "./types";

const short = (s: string) => s.replace(/星$/, "") || s;
const isStrong = (g: string) => g === "最強" || g === "強";
const isWeak = (g: string) => g === "弱" || g === "最弱";

function judge(
  cond: FortuneStarCondition | null,
  branch: Branch,
  power: ChartPower,
): { result: FortuneLineResult; detail: string } {
  if (!cond) return { result: "unconditional", detail: "" };
  const p = power.byBranch[branch];
  const palace = `宮の運命指数 ${p.index.toFixed(1)}（${p.grade}）`;
  if (cond.kind === "palacePowerStrong") return { result: isStrong(p.grade) ? "met" : "notMet", detail: palace };
  if (cond.kind === "palacePowerWeak") return { result: isWeak(p.grade) ? "met" : "notMet", detail: palace };
  // 星の力量の弱さ OR 巡る宮の力量の弱さ
  if (isWeak(p.grade)) return { result: "met", detail: palace };
  const rule = STAR_POWER_RULES[cond.star]?.weak;
  const v = starPowerOf(cond.star, branch);
  if (!rule || v === null) return { result: "pending", detail: `${palace}・${short(cond.star)}の力量の弱さは資料に定義がないため未判定` };
  return { result: rule.test(v) ? "met" : "notMet", detail: `${palace}・${short(cond.star)}の力量 ${v}（弱い＝${rule.label}）` };
}

/** 宮の支の星の行運星曜象意（群は1回だけ。資料の見出しの順） */
export function fortuneStarMeaningsAt(chart: ZiweiChart, branch: Branch, power: ChartPower = calculateChartPower(chart)): FortuneStarMeaning[] {
  const stars = chart.palaces.find((p) => p.branch === branch)!.stars;
  const items = new Map<string, { item: FortuneStarItem; present: PlacedStar[] }>();
  for (const s of stars) {
    const item = fortuneStarItemOf(s);
    if (!item) continue;
    const e = items.get(item.id) ?? { item, present: [] };
    e.present.push(s);
    items.set(item.id, e);
  }
  return [...items.values()]
    .sort((a, b) => a.item.sourceOrder - b.item.sourceOrder)
    .map(({ item, present }) => {
      const presentStars = item.stars.filter((s) => present.includes(s));
      return {
        item,
        presentStars,
        label: presentStars.map(short).join("・"),
        lines: item.lines.map((l): EvaluatedFortuneLine => {
          const j = judge(l.condition, branch, power);
          return { id: l.id, text: l.text, condition: l.condition, result: j.result, shown: j.result === "unconditional" || j.result === "met", detail: j.detail };
        }),
      };
    });
}

function build(
  chart: ZiweiChart,
  ctx: FortunePalaceContext,
  limitType: "major" | "minor",
  power: ChartPower,
): FortunePalaceStarInterpretation | null {
  const limit = limitType === "major" ? ctx.fortune.majorLimit : ctx.fortune.minorLimit;
  const fortunePalace = limitType === "major" ? ctx.majorPalace : ctx.minorPalace;
  if (!limit || !fortunePalace) return null;
  const ageRange: [number, number] = limitType === "major" ? limit.ageRange! : [limit.age!, limit.age!];
  const stars = chart.palaces.find((p) => p.branch === ctx.branch)!.stars;
  const p = power.byBranch[ctx.branch];
  return {
    limitType,
    branch: ctx.branch,
    natalPalace: ctx.natalPalace,
    fortunePalace,
    ageRange,
    stars,
    palacePower: { index: p.index, grade: p.grade },
    meanings: fortuneStarMeaningsAt(chart, ctx.branch, power),
    starsWithoutMeaning: stars.filter((s) => !fortuneStarItemOf(s)),
  };
}

/** 選択中の大限での、この宮（大限上の○宮）の行運星曜象意。大限がなければ null */
export function buildMajorPalaceInterpretation(
  chart: ZiweiChart,
  ctx: FortunePalaceContext,
  power: ChartPower = calculateChartPower(chart),
): FortunePalaceStarInterpretation | null {
  return build(chart, ctx, "major", power);
}

/** 選択中の小限での、この宮（小限上の○宮）の行運星曜象意。小限がなければ null */
export function buildMinorPalaceInterpretation(
  chart: ZiweiChart,
  ctx: FortunePalaceContext,
  power: ChartPower = calculateChartPower(chart),
): FortunePalaceStarInterpretation | null {
  return build(chart, ctx, "minor", power);
}

/** 宮クリック用: 大限・小限の両方 */
export function buildFortuneStarMeaningContext(chart: ZiweiChart, ctx: FortunePalaceContext) {
  const power = calculateChartPower(chart);
  return { major: buildMajorPalaceInterpretation(chart, ctx, power), minor: buildMinorPalaceInterpretation(chart, ctx, power) };
}

/** データの集計（テスト・仕様書用） */
export function fortuneStarDataCounts() {
  const lines = FORTUNE_STAR_ITEMS.flatMap((i) => i.lines);
  const by = (k: string | null) => lines.filter((l) => (l.condition?.kind ?? null) === k).length;
  return {
    items: FORTUNE_STAR_ITEMS.length,
    groups: FORTUNE_STAR_ITEMS.filter((i) => i.isGroup).length,
    stars: FORTUNE_STAR_ITEMS.flatMap((i) => i.stars).length,
    lines: lines.length,
    unconditional: by(null),
    palacePowerStrong: by("palacePowerStrong"),
    palacePowerWeak: by("palacePowerWeak"),
    starOrPalaceWeak: by("starOrPalaceWeak"),
  };
}
