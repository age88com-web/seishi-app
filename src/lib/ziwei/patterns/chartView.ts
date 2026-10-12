// src/lib/ziwei/patterns/chartView.ts
//
// 格局判定用に、作盤結果（ZiweiChart）を参照するための読み取り専用の窓口。
// 星配置・四化・宮・三方四正（sanfangSizheng）・旺衰（starStrengthOf）・宮の力量（calculateChartPower）は
// 既存の計算結果を参照するだけで、同じ計算をここでは行わない。
//
// 用語（docs/ziwei-basic-spec.md §23.4 確定仕様）:
//   三方四正 … 三合宮2宮＋対宮1宮（sanfangSizheng の trines と opposite。本宮を含まない）
//   加会     … 対宮または三合宮にあること（基礎編 S16）。三方四正と同じ3宮
//   同宮     … 同じ宮にあること
//   会う     … 同宮または加会（本宮と三方四正の4宮のどこか）。格局本文の「会う」「会する」「あう」の読み
//   新規諸星 … calculateMinorStars の結果を星ID（系列/星名）で引く（minorJiahui）。名前だけでは引かない（同名異系列があるため）。
//              格局で使うのは資料に書かれた格局の補足・条件だけ（§37.5。巨日同宮格の三台・八座、桃花犯主格の天喜・沐浴）

import { calculateChartPower } from "../power";
import type { ChartPower, PowerGrade } from "../power";
import { sanfangSizheng } from "../sanfang";
import { starStrengthOf } from "../strength";
import type { Branch, Palace, PalaceName, PlacedStar, StarStrength, TransformationKind, ZiweiChart } from "../types";
import { isLucky, isMalefic } from "./luck";
import { calculateMinorStars } from "../minorStars/place";
import type { MinorStarChart, MinorStarId } from "../minorStars/types";

export type AnyStar = PlacedStar | TransformationKind;

export interface ChartView {
  chart: ZiweiChart;
  power: ChartPower;
  mingBranch: Branch;
  shenBranch: Branch;
  palaceAt(b: Branch): Palace;
  branchOfPalace(name: PalaceName): Branch;
  /** 宮の星（配置30星＋その宮にある四化） */
  starsAt(b: Branch): AnyStar[];
  has(b: Branch, s: AnyStar): boolean;
  /** 配置星の宮 */
  posOf(s: PlacedStar): Branch;
  /** 四化の付いた星と宮 */
  huaOf(k: TransformationKind): { star: PlacedStar; branch: Branch };
  opposite(b: Branch): Branch;
  trines(b: Branch): [Branch, Branch];
  /** 三方四正＝三合2宮＋対宮（本宮を含まない） */
  sanfangSizheng(b: Branch): Branch[];
  /** 本宮＋三合2宮（「三方」を本宮を含む三宮として読む格局用） */
  sanfangWithSelf(b: Branch): Branch[];
  /** 加会（三方四正の3宮）にある */
  jiahui(b: Branch, s: AnyStar): Branch | null;
  /** 会う（同宮または加会） */
  meets(b: Branch, s: AnyStar): Branch | null;
  strengthOf(s: PlacedStar): StarStrength | null;
  gradeOf(b: Branch): PowerGrade;
  luckyIn(bs: readonly Branch[], exclude?: readonly AnyStar[]): { star: AnyStar; branch: Branch }[];
  maleficIn(bs: readonly Branch[], exclude?: readonly AnyStar[]): { star: AnyStar; branch: Branch }[];
  /** 新規諸星（本命盤のみ。§37） */
  minor: MinorStarChart;
  /** 新規諸星が基準宮に加会（三方四正の3宮。jiahui と同じ範囲）する宮。星IDで引く */
  minorJiahui(b: Branch, id: MinorStarId): Branch | null;
  label(b: Branch): string;
}

export function viewOf(chart: ZiweiChart): ChartView {
  const byBranch = new Map(chart.palaces.map((p) => [p.branch, p]));
  const power = calculateChartPower(chart);
  const starsAt = (b: Branch): AnyStar[] => [
    ...byBranch.get(b)!.stars,
    ...chart.transformations.filter((t) => t.branch === b).map((t) => t.kind),
  ];
  const sf = (b: Branch) => {
    const s = sanfangSizheng(b);
    return { opposite: s.opposite, trines: s.trines };
  };
  const collect = (pred: (s: AnyStar) => boolean) => (bs: readonly Branch[], exclude: readonly AnyStar[] = []) =>
    bs.flatMap((b) => starsAt(b).filter((s) => pred(s) && !exclude.includes(s)).map((star) => ({ star, branch: b })));
  const minor = calculateMinorStars(chart);
  const minorPos = (id: MinorStarId): Branch[] => {
    const bs = minor.positions[id];
    if (!bs) throw new Error(`格局: 新規諸星 ${id} が配置されていない`);
    return bs;
  };
  const v: ChartView = {
    chart,
    power,
    mingBranch: chart.mingPalace,
    shenBranch: chart.shenPalace,
    palaceAt: (b) => byBranch.get(b)!,
    branchOfPalace: (name) => chart.palaces.find((p) => p.name === name)!.branch,
    starsAt,
    has: (b, s) => starsAt(b).includes(s),
    posOf: (s) => chart.starPositions[s],
    huaOf: (k) => {
      const t = chart.transformations.find((x) => x.kind === k)!;
      return { star: t.star, branch: t.branch };
    },
    opposite: (b) => sf(b).opposite,
    trines: (b) => sf(b).trines,
    sanfangSizheng: (b) => [sf(b).opposite, ...sf(b).trines],
    sanfangWithSelf: (b) => [b, ...sf(b).trines],
    jiahui: (b, s) => [sf(b).opposite, ...sf(b).trines].find((x) => starsAt(x).includes(s)) ?? null,
    meets: (b, s) => [b, sf(b).opposite, ...sf(b).trines].find((x) => starsAt(x).includes(s)) ?? null,
    strengthOf: (s) => starStrengthOf(s, chart.starPositions[s]),
    gradeOf: (b) => power.byBranch[b].grade,
    luckyIn: collect(isLucky),
    maleficIn: collect(isMalefic),
    label: (b) => `${byBranch.get(b)!.name}（${b}）`,
    minor,
    minorJiahui: (b, id) => [sf(b).opposite, ...sf(b).trines].find((x) => minorPos(id).includes(x)) ?? null,
  };
  return v;
}

export const BRANCHES_ALL: readonly Branch[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
