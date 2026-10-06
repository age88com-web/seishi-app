// src/lib/shichusuimei/daiunDetail.ts
//
// 大運1本ごとの詳細。計算は既存の部品をそのまま使う（新しい表は作らない）。
//   天干の通変星・蔵干と通変星 … pillarDetail（日干基準。蔵干は p114 の記載順のまま）
//   神煞 … judgeShinsatsu の大運分（luckIndex）
//   命式との干支関係 … detectLuckRelations（存在検出のみ）

import type { Daiun, DaiunDetail, Meishiki, ShinsatsuHit } from "./types";
import { pillarDetail } from "./zokan";
import { detectLuckRelations } from "./relations";

export function daiunDetails(meishiki: Meishiki, daiun: Daiun, shinsatsu: ShinsatsuHit[]): DaiunDetail[] {
  const dayStem = meishiki.pillars.日.stem;
  return daiun.periods.map(({ index, pillar }) => {
    const d = pillarDetail(pillar, dayStem, false);
    return {
      index,
      pillar,
      stemTsuhen: d.stemTsuhen,
      zokan: d.zokan,
      zokanRoles: d.zokanRoles,
      shinsatsu: shinsatsu.filter((h) => h.position.kind === "luck" && h.position.luckIndex === index),
      relations: detectLuckRelations(meishiki.pillars, pillar),
    };
  });
}
