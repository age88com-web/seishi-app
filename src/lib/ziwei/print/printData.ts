// src/lib/ziwei/print/printData.ts
//
// /ziwei の印刷用データ。docs/ziwei-basic-spec.md §25。
// 既存の関数（作盤結果・calculateChartPower・evaluatePatterns・getAdvancedInterpretation・
// buildPalaceMeaningContext＋buildRuleBasedInterpretation〔standard〕）の結果を、印刷の並びに集めるだけ。
// 印刷用の独自判定・再計算はしない。利用者向けの文字列に内部ID・資料名・ページを入れない（データは各エンジンに保持）。

import { calculateChartPower } from "../power";
import type { ChartPower } from "../power";
import { STRENGTH_SHORT } from "../strength";
import { MAIN_STARS } from "../data";
import type {
  Branch,
  PalaceName,
  PlacedStar,
  TransformationKind,
  ZiweiChart,
} from "../types";
import { evaluatePatterns, patternCautions } from "../patterns";
import type { PatternResult } from "../patterns";
import { getAdvancedInterpretation } from "../meanings/advanced";
import { buildPalaceMeaningContext } from "../meanings";
import { buildRuleBasedInterpretation } from "../meanings/ruleInterpretation";
import { palaceStemOf } from "../palaceStems";
import { calculateMinorStars } from "../minorStars";

export interface PrintHeader {
  /** 氏名（入力がある場合だけ） */
  name: string | null;
  birthDate: string;
  birthTime: string;
  sex: string;
  /** 出生地（入力の地名と、作盤に使った表2の地点） */
  place: string;
  lunar: string;
  mingPalace: string;
  shenPalace: string;
  bureau: string;
}

export interface PrintStar {
  name: string;
  /** 旺衰の1字（表にない星は null） */
  strength: string | null;
  /** 星の力量（天馬・天姚・紅鸞は null） */
  power: number | null;
  /** 付いている四化（化禄 など）と、その力量 */
  hua: { kind: string; power: number }[];
  isMain: boolean;
}

export interface PrintBoardPalace {
  branch: Branch;
  name: PalaceName;
  isShenPalace: boolean;
  mains: PrintStar[];
  subs: PrintStar[];
  /** 新規諸星（§37）の雑曜（乙級）。星名だけ */
  minors: string[];
  /** 新規諸星の十二神等（丙級）。星名だけ */
  cycles: string[];
  index: number;
  grade: string;
  dayun: string;
}

export interface PrintPattern {
  name: string;
  /** 成立 ／ 条件一致・要確認 */
  label: "成立" | "条件一致・要確認";
  palaces: string;
  reasons: string[];
  affected: { palace: string; note: string }[];
  warnings: string[];
  meanings: string[];
}

export interface PrintPalaceDetail {
  name: PalaceName;
  branch: Branch;
  isShenPalace: boolean;
  stars: PrintStar[];
  index: number;
  grade: string;
  /** 応用編（命宮だけ） */
  advanced: {
    ziweiBranch: Branch;
    mingBranch: Branch;
    layout: string;
    paragraphs: string[];
  } | null;
  /** 解釈（buildRuleBasedInterpretation の standard） */
  interpretation: { theme: string; text: string }[];
  /** 宮の天干（既存 palaceStemOf）と大限の年齢 */
  stem: string;
  dayun: string;
  /** 三方四正（buildPalaceMeaningContext の sanfang。対宮・三合宮とその星） */
  sanfang: { role: string; palace: string; branch: Branch; stars: string }[];
  /** 力量の内訳（画面の「星の力量・運命指数」と同じ。四化は付いた星を添える） */
  powerItems: { label: string; power: number }[];
}

export interface ZiweiPrintData {
  header: PrintHeader;
  board: PrintBoardPalace[];
  /** 表20 命主・表21 身主 */
  masters: { mingZhu: string; shenZhu: string };
  patterns: { confirmed: PrintPattern[]; review: PrintPattern[] };
  palaces: PrintPalaceDetail[];
}

const MAIN_SET = new Set<string>(MAIN_STARS);
const short = (s: string) => s.replace(/星$/, "");

function starsOf(chart: ZiweiChart, power: ChartPower, b: Branch): PrintStar[] {
  const pp = power.byBranch[b];
  const palace = chart.palaces.find((p) => p.branch === b)!;
  return palace.stars.map((s: PlacedStar) => {
    const e = pp.stars.find((x) => x.star === s && !x.attachedTo);
    return {
      name: s,
      strength: e?.strength ? STRENGTH_SHORT[e.strength] : null,
      power: e ? e.finalPower : null,
      hua: chart.transformations
        .filter((t) => t.star === s)
        .map((t: { kind: TransformationKind }) => ({
          kind: short(t.kind),
          power: pp.stars.find((x) => x.star === t.kind && x.attachedTo === s)!
            .finalPower,
        })),
      isMain: MAIN_SET.has(s),
    };
  });
}

function printPattern(
  p: PatternResult,
  label: PrintPattern["label"],
): PrintPattern {
  return {
    name: p.name,
    label,
    palaces: p.matchedPalaces
      .map((m) => `${m.palace}（${m.branch}）`)
      .join("・"),
    reasons: p.reasons,
    affected: p.affectedPalaces.map((a) => ({
      palace: `${a.palace}（${a.branch}）`,
      note: a.note,
    })),
    warnings: patternCautions(p),
    meanings: p.meanings,
  };
}

export function buildZiweiPrintData(
  chart: ZiweiChart,
  header: PrintHeader,
): ZiweiPrintData {
  const power = calculateChartPower(chart);
  const patterns = evaluatePatterns(chart);
  const advanced = getAdvancedInterpretation(chart);
  const minor = calculateMinorStars(chart);

  const board = chart.palaces.map((p): PrintBoardPalace => {
    const stars = starsOf(chart, power, p.branch);
    const pp = power.byBranch[p.branch];
    return {
      branch: p.branch,
      name: p.name,
      isShenPalace: p.isShenPalace,
      mains: stars.filter((s) => s.isMain),
      subs: stars.filter((s) => !s.isMain),
      minors: minor.byBranch[p.branch].filter((m) => m.tier === "minor").map((m) => m.name),
      cycles: minor.byBranch[p.branch].filter((m) => m.tier === "cycle").map((m) => m.name),
      index: pp.index,
      grade: pp.grade,
      dayun: `${p.dayun.startAge}–${p.dayun.endAge}`,
    };
  });

  // 命盤の宮順（命宮 → 兄弟宮 → … → 父母宮。chart.palaces の順）
  const palaces = chart.palaces.map((p): PrintPalaceDetail => {
    const ctx = buildPalaceMeaningContext(chart, p.branch);
    const r = buildRuleBasedInterpretation(ctx, { detailLevel: "standard" });
    const pp = power.byBranch[p.branch];
    const it = advanced.item;
    const sf = ctx.sanfang;
    return {
      name: p.name,
      branch: p.branch,
      isShenPalace: p.isShenPalace,
      stars: starsOf(chart, power, p.branch),
      index: pp.index,
      grade: pp.grade,
      advanced:
        p.name === "命宮"
          ? {
              ziweiBranch: it.ziweiBranch,
              mingBranch: it.mingBranch,
              layout: it.noMainStar
                ? `主星なし（対宮の${it.borrowedStars.join("・")}を借りる）`
                : it.displayedMainStars.join("・"),
              paragraphs: advanced.paragraphs.map((x) => x.text),
            }
          : null,
      interpretation: r.sections
        .filter((s) => s.text !== "")
        .map((s) => ({ theme: s.theme, text: s.text })),
      stem: palaceStemOf(chart.yearStem, p.branch),
      dayun: `${p.dayun.startAge}〜${p.dayun.endAge}歳`,
      sanfang: [sf.opposite, ...sf.trines].map((x) => ({
        role: x.role === "対宮" ? "対宮" : "三合宮",
        palace: x.name,
        branch: x.branch,
        stars: x.stars
          .map((st) => `${st.name}${st.strength ? `（${STRENGTH_SHORT[st.strength]}）` : ""}${st.transformations.map((k) => `［${k}］`).join("")}`)
          .join("　"),
      })),
      powerItems: ctx.power.palace.stars.map((st) => ({
        label: st.attachedTo ? `${short(st.star)}（${short(st.attachedTo)}）` : st.star,
        power: st.finalPower,
      })),
    };
  });

  return {
    header,
    board,
    masters: { mingZhu: minor.mingZhu, shenZhu: minor.shenZhu },
    patterns: {
      confirmed: patterns.confirmed.map((p) => printPattern(p, "成立")),
      review: patterns.matchedNeedsReview.map((p) =>
        printPattern(p, "条件一致・要確認"),
      ),
    },
    palaces,
  };
}
