// src/lib/ziwei/meanings/advanced/conditions.ts
//
// 応用編の条件の判定。docs/ziwei-basic-spec.md §24.4。
// 星配置・四化・三方四正・吉凶星の分類は既存（作盤結果・sanfangSizheng・入門 p.15 の分類）を参照するだけ。
//
// 基準宮は命宮（144項目は命宮の配置の解釈）。関係の読み:
//   同宮 … 命宮にある
//   加会 … 命宮の三方四正（三合2宮＋対宮。§23.4 確定2）にある
//   会照 … 加会と同じ（資料の処理記録が「加会／会照」を同じ条件として扱う。基礎２ S36 も三方四正の意味で使う）
//   会う … 同宮または加会
// 吉星・凶星は入門 p.15 の分類（§23.4 確定1・4）。命宮の主星（借りる星を含む）は条件の主体なので数えない。
// 定義のない語（禄星・桃花の星・貴人・昼夜・補佐・助け・支え・臨む・加わる・見る・多く）は pending。

import type { ChartView } from "../../patterns/chartView";
import { isLucky, isMalefic } from "../../patterns/luck";
import type { MainStar } from "../../types";
import type { AdvancedCondition, AdvancedRelation, ConditionResult } from "./types";

function areaOf(v: ChartView, rel: AdvancedRelation) {
  const m = v.mingBranch;
  if (rel === "同宮") return [m];
  if (rel === "会う") return [m, ...v.sanfangSizheng(m)];
  return v.sanfangSizheng(m);
}

export function evaluateCondition(
  v: ChartView,
  c: AdvancedCondition,
  subjectStars: readonly MainStar[],
): { result: ConditionResult; detail: string } {
  if (c.kind === "pending") return { result: "pending", detail: `${c.term}: ${c.reason}` };
  if (c.kind === "temporal") return { result: "pending", detail: `${c.phrase}: ${c.reason}` };
  const area = areaOf(v, c.relation);
  if (c.kind === "starGroup") {
    const pick = c.group === "吉星" ? v.luckyIn(area, subjectStars) : v.maleficIn(area, subjectStars);
    const found = pick.length > 0;
    const ok = c.negate ? !found : found;
    const list = pick.map((x) => `${x.star.replace(/星$/, "")}（${x.branch}）`).join("・");
    return {
      result: ok ? "met" : "notMet",
      detail: `${c.group}が${c.relation}${c.negate ? "しない" : ""}（命宮${c.relation === "同宮" ? "" : "と三方四正"}、命宮の主星を除く）: ${list || "なし"}`,
    };
  }
  const hits = c.stars.map((s) => ({ s, at: area.find((b) => v.has(b, s)) ?? null }));
  const ok = c.mode === "all" ? hits.every((h) => h.at) : hits.some((h) => h.at);
  return {
    result: ok ? "met" : "notMet",
    detail: `${c.stars.join(c.mode === "all" ? "と" : "または")}が${c.relation}: ${hits.map((h) => `${h.s.replace(/星$/, "")}${h.at ? `＝${h.at}` : "なし"}`).join("・")}`,
  };
}

/** 複数の条件（すべて満たすと成立）。1つでも不成立なら不成立、それ以外で未判定が残れば未判定 */
export function combine(results: ConditionResult[]): ConditionResult {
  if (results.includes("notMet")) return "notMet";
  if (results.includes("pending")) return "pending";
  return "met";
}

export { isLucky, isMalefic };
