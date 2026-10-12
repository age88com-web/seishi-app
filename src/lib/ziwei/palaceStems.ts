// src/lib/ziwei/palaceStems.ts
//
// 十二宮の天干（宮干）。docs/ziwei-basic-spec.md §26.2。
// 基礎２ S37「生年干より十二宮の天干を五虎遁から求める」（五虎遁表: 甲己→丙寅、乙庚→戊寅、丙辛→庚寅、丁壬→壬寅、戊癸→甲寅、
// 寅から亥・子・丑まで1つずつ進む）。式は共通暦 src/lib/calendar/eto.ts の月干（五虎遁: 寅の干＝(年干%5)×2＋2）と同じ。
// eto.ts の式は月干支の計算の中にあり関数として公開されていないため、共通暦は変更せず、宮干はこの関数だけで求める
// （大限四化・小限四化はどちらもこの関数を使う）。

import type { Branch, Stem, ZiweiChart } from "./types";
import { STEMS, branchIndex, stemIndex } from "./data";

/** 生年干と宮の支から、その宮の天干（五虎遁） */
export function palaceStemOf(yearStem: Stem, branch: Branch): Stem {
  const tiger = (stemIndex(yearStem) % 5) * 2 + 2; // 寅の干
  const fromTiger = (branchIndex(branch) - 2 + 12) % 12; // 寅からの距離（寅0 … 子10・丑11）
  return STEMS[(tiger + fromTiger) % 10];
}

/** 命盤の十二宮（命宮〜父母宮の順）の地支と天干 */
export function palaceStemsOf(chart: ZiweiChart): { palace: ZiweiChart["palaces"][number]["name"]; branch: Branch; stem: Stem }[] {
  return chart.palaces.map((p) => ({ palace: p.name, branch: p.branch, stem: palaceStemOf(chart.yearStem, p.branch) }));
}
