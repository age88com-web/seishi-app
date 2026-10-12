// src/lib/ziwei/fortune/taisei.ts
//
// 太歳宮（基礎２ S41「流年の地支と同じ宮を太歳宮として判断する」）。docs/ziwei-basic-spec.md §27.3。
// 流年の年界: 入門 p.27「大限や小限で見る期間は旧暦の年次、すなわち旧暦１月１日〜12月30日までを１年次とします」・
//   p.101「大限、小限ともその切り替わりは…旧暦の１月１日」。流年法の年次は旧暦年のため、太歳の年支は
//   鑑定日の陰暦年（既存の lunarDateOf・yearGanzhi。固定UTC+8）の地支とする。基礎２ S41 自体は年界を書いていない。
// 吉凶（「吉が増強」「凶が増強」）の判定はしない。同宮・三方四正の四化を取り出すだけ。

import { lunarDateOf, yearGanzhi } from "../lunisolar";
import { sanfangSizheng } from "../sanfang";
import type { Branch, CivilDate, PalaceName, Stem, ZiweiChart } from "../types";
import type { LayeredTransformation } from "./types";

export const TAISEI_YEAR_BOUNDARY = {
  boundary: "旧暦1月1日",
  basis: "入門 p.27・p.101（流年法の年次は旧暦1月1日〜12月30日）。基礎２ S41 には年界の記載なし",
} as const;

export interface TaiseiContext {
  /** 鑑定日の陰暦年と年干支（流年） */
  lunarYear: number;
  yearStem: Stem;
  yearBranch: Branch;
  /** 太歳宮（年支と同じ支の宮） */
  branch: Branch;
  palace: PalaceName;
  sanfangSizheng: { self: Branch; opposite: Branch; trines: [Branch, Branch] };
  /** 太歳宮にある四化（生年・大限・小限の層のまま） */
  samePalaceTransformations: LayeredTransformation[];
  /** 太歳宮の三方四正（対宮・三合宮）にある四化 */
  relatedTransformations: (LayeredTransformation & { relation: "対宮" | "三合宮" })[];
  yearBoundary: typeof TAISEI_YEAR_BOUNDARY;
}

export function taiseiOf(chart: ZiweiChart, date: CivilDate, layersByBranch: Record<Branch, LayeredTransformation[]>): TaiseiContext {
  const lunarYear = lunarDateOf(date).lunarYear;
  const gz = yearGanzhi(lunarYear);
  const sf = sanfangSizheng(gz.branch);
  return {
    lunarYear,
    yearStem: gz.stem,
    yearBranch: gz.branch,
    branch: gz.branch,
    palace: chart.palaces.find((p) => p.branch === gz.branch)!.name,
    sanfangSizheng: { self: sf.self, opposite: sf.opposite, trines: sf.trines },
    samePalaceTransformations: layersByBranch[gz.branch],
    relatedTransformations: [
      ...layersByBranch[sf.opposite].map((t) => ({ ...t, relation: "対宮" as const })),
      ...sf.trines.flatMap((b) => layersByBranch[b].map((t) => ({ ...t, relation: "三合宮" as const }))),
    ],
    yearBoundary: TAISEI_YEAR_BOUNDARY,
  };
}
