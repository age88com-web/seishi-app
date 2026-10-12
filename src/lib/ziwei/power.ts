// src/lib/ziwei/power.ts
//
// 星の力量・宮の運命指数（推羅式）。docs/ziwei-basic-spec.md §22。
// 旺衰（strength.ts）とは別の規則で、旺衰を入力に使わない（資料に旺衰→力量の換算規則がないため）。
//
// 資料:
//   - 星の力量: 入門 p.25「表13.諸星力量一覧表」＝ 基礎編 S15 の表（全372セル一致を power テストで確認）。
//     星名＋在位支 → 数値の参照だけ。四化（化禄・化権・化科・化忌）も表の行を持つ星として数える（入門 p.25）。
//     天馬・天姚・紅鸞は力量を無視する（入門 p.26）。表の空欄（禄存・擎羊・陀羅の入らない支）は値なし。
//   - 宮の運命指数: 各宮の星の力量を合計し（星のない宮は0。入門 p.34 (1)）、
//     本宮＋対宮×0.5＋三合宮×0.3＋三合宮×0.3（入門 p.34 (2)・基礎編 S15・S17）。
//   - 段階: 最強 12.0以上／強 9.0〜11.9／平 7.0〜8.9／弱 3.0〜6.9／最弱 3.0未満（入門 p.35。基礎編 S17 は「平」を「並」と表記）。
// 資料に数値のない補正（同宮で力量が強くなる・弱くなる等）、旺衰との換算、四化の追加規則は実装しない。
// 計算は 0.1 単位の整数（×10）で行い、浮動小数の誤差を出さない（0.5・0.3 倍の和は必ず 0.1 の倍数）。

import type { Branch, PalaceName, PlacedStar, StarStrength, TransformationKind, ZiweiChart } from "./types";
import { BRANCHES, branchIndex } from "./data";
import { sanfangSizheng } from "./sanfang";
import { starStrengthOf } from "./strength";

/** 力量表の行（表13の31行）。34星から天馬・天姚・紅鸞を除いたもの */
export type PowerStar = Exclude<PlacedStar, "天馬星" | "天姚星" | "紅鸞星"> | TransformationKind;

/** 入門 p.26 で力量を無視する星 */
export const POWER_IGNORED_STARS: readonly PlacedStar[] = ["天馬星", "天姚星", "紅鸞星"];

export interface PowerSourceRef {
  source: "紫微斗数入門" | "紫微斗数基礎編";
  /** 入門は印刷ページ（p.N）、基礎編はスライド番号（S N） */
  page: string;
  note: string;
}

export const POWER_SOURCE_REFS = {
  table: [
    { source: "紫微斗数入門", page: "p.25", note: "表13.諸星力量一覧表" },
    { source: "紫微斗数基礎編", page: "S15", note: "作盤11 の力量表" },
  ],
  ignored: { source: "紫微斗数入門", page: "p.26", note: "天馬・天姚・紅鸞は星の力量を無視する" },
  formula: [
    { source: "紫微斗数入門", page: "p.34", note: "運命指数の算出 (1)(2)" },
    { source: "紫微斗数基礎編", page: "S15・S17", note: "推羅式力量計算" },
  ],
  grades: [
    { source: "紫微斗数入門", page: "p.35", note: "運命指数を使う（最強・強・平・弱・最弱）" },
    { source: "紫微斗数基礎編", page: "S17", note: "最強・強・並・弱・最弱" },
  ],
} as const satisfies Record<string, PowerSourceRef | readonly PowerSourceRef[]>;

/**
 * 表の転記（子〜亥の順。null は資料の空欄）。入門・基礎編を別々に転記し、全セルを比較する（power テスト）。
 * 入門は PDF のテキスト層、基礎編は S15 の画像から読み取った値。
 */
type Row = readonly (number | null)[];
const _ = null;
export const POWER_TABLE_NYUMON: Readonly<Record<PowerStar, Row>> = {
  紫微星: [0, 6, 4, 4, 2, 4, 6, 6, 4, 4, 2, 4],
  天機星: [6, 0, 2, 4, 0, 0, 6, 0, 2, 4, 0, 0],
  太陽星: [0, 0, 4, 6, 4, 4, 4, 2, 2, 0, 0, 0],
  武曲星: [4, 6, 2, 0, 6, 0, 4, 6, 2, 0, 6, 0],
  天同星: [4, 0, 0, 0, 0, 6, 0, 0, 4, 0, 0, 6],
  廉貞星: [-2, 0, 4, -2, 0, -6, -2, 0, 4, -2, 0, -6],
  天府星: [6, 6, 6, 2, 6, 2, 4, 6, 2, 4, 6, 2],
  太陰星: [6, 6, 4, 0, 0, 0, 0, 0, 0, 4, 4, 6],
  貪狼星: [2, 4, -2, 0, 4, -6, 2, 4, -2, 0, 4, -6],
  巨門星: [2, -4, 4, 4, -6, 2, 2, -4, 4, 4, -6, 2],
  天相星: [6, 6, 6, 0, 2, 2, 6, 2, 6, 0, 2, 2],
  天梁星: [6, 4, 6, 6, 6, 0, 6, 4, 0, 2, 6, 0],
  七殺星: [2, 4, 4, 2, 4, -2, 2, 4, 4, 2, 4, -2],
  破軍星: [4, 2, 0, -6, 2, -2, 4, 2, 0, -6, 2, -2],
  文昌星: [1, 3, 0, 0, 1, 3, 0, 0, 1, 3, 0, 0],
  文曲星: [1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 0, 2],
  禄存星: [3, _, 3, 3, _, 3, 3, _, 3, 3, _, 3],
  擎羊星: [-3, 2, _, -3, 2, _, -3, 2, _, -3, 2, _],
  陀羅星: [_, 2, -3, _, 2, -3, _, 2, -3, _, 2, -3],
  火星: [-3, 0, 2, 0, -3, 0, 2, 0, -3, 0, 2, 0],
  鈴星: [-3, 0, 2, 0, -3, 0, 2, 0, -3, 0, 2, 0],
  左輔星: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  右弼星: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  天魁星: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  天鉞星: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  化禄星: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  化科星: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  化権星: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  化忌星: [-3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3],
  天空星: [-3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3],
  地劫星: [-3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3],
};
export const POWER_TABLE_KISO: Readonly<Record<PowerStar, Row>> = {
  紫微星: [0, 6, 4, 4, 2, 4, 6, 6, 4, 4, 2, 4],
  天機星: [6, 0, 2, 4, 0, 0, 6, 0, 2, 4, 0, 0],
  太陽星: [0, 0, 4, 6, 4, 4, 4, 2, 2, 0, 0, 0],
  武曲星: [4, 6, 2, 0, 6, 0, 4, 6, 2, 0, 6, 0],
  天同星: [4, 0, 0, 0, 0, 6, 0, 0, 4, 0, 0, 6],
  廉貞星: [-2, 0, 4, -2, 0, -6, -2, 0, 4, -2, 0, -6],
  天府星: [6, 6, 6, 2, 6, 2, 4, 6, 2, 4, 6, 2],
  太陰星: [6, 6, 4, 0, 0, 0, 0, 0, 0, 4, 4, 6],
  貪狼星: [2, 4, -2, 0, 4, -6, 2, 4, -2, 0, 4, -6],
  巨門星: [2, -4, 4, 4, -6, 2, 2, -4, 4, 4, -6, 2],
  天相星: [6, 6, 6, 0, 2, 2, 6, 2, 6, 0, 2, 2],
  天梁星: [6, 4, 6, 6, 6, 0, 6, 4, 0, 2, 6, 0],
  七殺星: [2, 4, 4, 2, 4, -2, 2, 4, 4, 2, 4, -2],
  破軍星: [4, 2, 0, -6, 2, -2, 4, 2, 0, -6, 2, -2],
  文昌星: [1, 3, 0, 0, 1, 3, 0, 0, 1, 3, 0, 0],
  文曲星: [1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 0, 2],
  禄存星: [3, _, 3, 3, _, 3, 3, _, 3, 3, _, 3],
  擎羊星: [-3, 2, _, -3, 2, _, -3, 2, _, -3, 2, _],
  陀羅星: [_, 2, -3, _, 2, -3, _, 2, -3, _, 2, -3],
  火星: [-3, 0, 2, 0, -3, 0, 2, 0, -3, 0, 2, 0],
  鈴星: [-3, 0, 2, 0, -3, 0, 2, 0, -3, 0, 2, 0],
  左輔星: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  右弼星: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  天魁星: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  天鉞星: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  化禄星: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  化科星: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  化権星: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  化忌星: [-3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3],
  天空星: [-3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3],
  地劫星: [-3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3],
};

/** 採用する表（入門 表13。基礎編 S15 と全セル一致） */
export const POWER_TABLE: Readonly<Record<PowerStar, Row>> = POWER_TABLE_NYUMON;
export const POWER_STARS = Object.keys(POWER_TABLE) as PowerStar[];

export function isPowerStar(s: string): s is PowerStar {
  return Object.prototype.hasOwnProperty.call(POWER_TABLE, s);
}

/** 星（四化を含む）と在位支から力量。表にない星（天馬・天姚・紅鸞）・表の空欄は null */
export function starPowerOf(star: PlacedStar | TransformationKind, branch: Branch): number | null {
  if (!isPowerStar(star)) return null;
  return POWER_TABLE[star][branchIndex(branch)] ?? null;
}

/** 運命指数の5段階（入門 p.35 の名称。基礎編 S17 は「平」を「並」と表記） */
export type PowerGrade = "最強" | "強" | "平" | "弱" | "最弱";
export const POWER_GRADES: readonly PowerGrade[] = ["最強", "強", "平", "弱", "最弱"];
/** 基礎編 S17 の表記 */
export const POWER_GRADE_KISO_LABEL: Readonly<Record<PowerGrade, string>> = { 最強: "最強", 強: "強", 平: "並", 弱: "弱", 最弱: "最弱" };

/** 0.1 単位（×10 の整数）の運命指数 → 段階 */
function gradeOfTenths(t: number): PowerGrade {
  if (t >= 120) return "最強";
  if (t >= 90) return "強";
  if (t >= 70) return "平";
  if (t >= 30) return "弱";
  return "最弱";
}
/** 運命指数（小数1桁）→ 段階 */
export function powerGradeOf(index: number): PowerGrade {
  return gradeOfTenths(Math.round(index * 10));
}

export interface StarPowerEntry {
  /** 力量表の星（四化は化禄星などの行） */
  star: PowerStar;
  /** 四化のとき、化が付いた星 */
  attachedTo?: PlacedStar;
  branch: Branch;
  /** 旺衰（§20。表示・照合用。力量の計算には使わない）。表に行がない星は null */
  strength: StarStrength | null;
  /** 表13の値 */
  basePower: number;
  /** 資料に数値のある補正だけ。現在の資料では該当なし（常に空） */
  adjustments: { reason: string; value: number; sourceRef: PowerSourceRef }[];
  finalPower: number;
  sourceRefs: readonly PowerSourceRef[];
}

export interface PalacePower {
  palace: PalaceName;
  branch: Branch;
  isShenPalace: boolean;
  stars: StarPowerEntry[];
  /** 力量を無視した星（天馬・天姚・紅鸞。入門 p.26） */
  ignoredStars: PlacedStar[];
  /** 本宮の星の力量合計（星のない宮は0） */
  sum: number;
  /** 推羅式の内訳 */
  sanfang: { opposite: { branch: Branch; sum: number }; trines: [{ branch: Branch; sum: number }, { branch: Branch; sum: number }] };
  /** 運命指数（小数1桁） */
  index: number;
  grade: PowerGrade;
  /** 計算式（例: 8 + 3×0.5 + 11×0.3 + 6×0.3 = 14.6） */
  formula: string;
}

export interface ChartPower {
  /** 命宮から父母宮の順（chart.palaces と同じ順） */
  palaces: PalacePower[];
  byBranch: Record<Branch, PalacePower>;
  notes: string[];
}

const fmt = (n: number) => (n < 0 ? `(${n})` : `${n}`);
const tenthsToString = (t: number) => (t / 10).toFixed(1);

/** 命盤の各星の力量と各宮の運命指数 */
export function calculateChartPower(chart: ZiweiChart): ChartPower {
  const starsByBranch = new Map<Branch, { entries: StarPowerEntry[]; ignored: PlacedStar[] }>();
  for (const p of chart.palaces) {
    const entries: StarPowerEntry[] = [];
    const ignored: PlacedStar[] = [];
    for (const s of p.stars) {
      if (!isPowerStar(s)) {
        ignored.push(s);
        continue;
      }
      const base = starPowerOf(s, p.branch);
      if (base === null) throw new Error(`力量表の空欄に星が入った: ${s}・${p.branch}（作盤または表の誤り）`);
      entries.push({
        star: s,
        branch: p.branch,
        strength: starStrengthOf(s, p.branch),
        basePower: base,
        adjustments: [],
        finalPower: base,
        sourceRefs: POWER_SOURCE_REFS.table,
      });
    }
    for (const t of chart.transformations.filter((x) => x.branch === p.branch)) {
      entries.push({
        star: t.kind,
        attachedTo: t.star,
        branch: p.branch,
        strength: null,
        basePower: starPowerOf(t.kind, p.branch)!,
        adjustments: [],
        finalPower: starPowerOf(t.kind, p.branch)!,
        sourceRefs: POWER_SOURCE_REFS.table,
      });
    }
    starsByBranch.set(p.branch, { entries, ignored });
  }
  const sumOf = (b: Branch) => (starsByBranch.get(b)?.entries ?? []).reduce((n, e) => n + e.finalPower, 0);

  const palaces = chart.palaces.map((p): PalacePower => {
    const sf = sanfangSizheng(p.branch);
    const self = sumOf(p.branch);
    const opp = sumOf(sf.opposite);
    const [t1, t2] = [sumOf(sf.trines[0]), sumOf(sf.trines[1])];
    const tenths = self * 10 + opp * 5 + (t1 + t2) * 3;
    return {
      palace: p.name,
      branch: p.branch,
      isShenPalace: p.isShenPalace,
      stars: starsByBranch.get(p.branch)!.entries,
      ignoredStars: starsByBranch.get(p.branch)!.ignored,
      sum: self,
      sanfang: {
        opposite: { branch: sf.opposite, sum: opp },
        trines: [
          { branch: sf.trines[0], sum: t1 },
          { branch: sf.trines[1], sum: t2 },
        ],
      },
      index: tenths / 10,
      grade: gradeOfTenths(tenths),
      formula: `${fmt(self)} + ${fmt(opp)}×0.5 + ${fmt(t1)}×0.3 + ${fmt(t2)}×0.3 = ${tenthsToString(tenths)}`,
    };
  });
  const byBranch = Object.fromEntries(palaces.map((p) => [p.branch, p])) as Record<Branch, PalacePower>;
  return {
    palaces,
    byBranch,
    notes: [
      "星の力量は表13（入門 p.25 ＝ 基礎編 S15）の参照。旺衰は計算に使わない。",
      "天馬・天姚・紅鸞は力量を無視（入門 p.26）。四化は化禄星・化権星・化科星・化忌星の行の値を、化が付いた星の宮で数える。",
      "運命指数＝本宮の合計＋対宮の合計×0.5＋三合宮の合計×0.3×2（入門 p.34・基礎編 S15/S17）。",
      "同宮・加会による力量の増減は資料に数値がないため計算しない。",
    ],
  };
}

/** 表の支の順（子〜亥） */
export const POWER_TABLE_BRANCHES: readonly Branch[] = BRANCHES;
