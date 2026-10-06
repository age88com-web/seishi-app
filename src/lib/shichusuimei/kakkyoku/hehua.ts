// src/lib/shichusuimei/kakkyoku/hehua.ts
//
// 干合と化格（KD23。仕様 §35）。
//   対象は日干と月干、日干と時干だけ（年干との干合は対象外）。
//   月支条件が最重要: 化す五行 X ごとの月支（HEHUA_MONTH_BRANCHES）に月支が入らなければ合去（hequ）。
//     A. X の三合局を構成する支 ＋ B. 本気の五行が X である支（月支本気そのものが化五行）。
//     甲己化土 … 辰・戌・丑・未（土を本気に持つ支）
//     乙庚化金 … 巳・申・酉・丑／丙辛化水 … 申・亥・子・辰／丁壬化木 … 亥・寅・卯・未／戊癸化火 … 寅・巳・午・戌
//     B の支（申・亥・寅・巳など）は補強ではなく、月支条件の成立そのものとして扱う。
//   月支条件を満たした場合だけ化格候補（hehuaCandidate）。補強があれば hehuaCandidateSupported。
//   補強＝X と比和する天干・地支だけ。干合している2干自身と月支（月支条件そのもの）は数えない。
//   X を生じる五行（印）・X の比劫＋印の党多は参考情報（references）で、補強の判定には使わない。
//   月支の地支関係（三合・三会・半合・半会・六合・冲）は優先順位で間引かず全件を事実として返す。
//   化の維持・解消は判定しない（術者判断）。行運補強（luckSupport）は原局と分けて持つ（未実装）。
// 原命式の天干・五行・通変星は書き換えない。

import { KANGO, STEM_ELEMENT } from "../data";
import type { Branch, Element, PillarKey } from "../types";
import type { NatalHehua, Pillars } from "./types";
import { BRANCH_ELEMENT, inElementOf, slotsOf } from "./common";
import { assessTouta } from "./strength";
import { branchRelationsOf } from "./innerScore";

/**
 * 化す五行ごとの原局化格の月支条件（KD23。2026-10-06 術者確定で改訂）。
 * 「化五行の三合局を構成する支」＋「化五行を本気として持つ支」。
 * SANGO（三合局）だけから生成すると本気の支（申・亥・寅・巳など）が欠けるため、確定表を明示する。
 */
export const HEHUA_MONTH_BRANCHES: Readonly<Record<Element, readonly Branch[]>> = {
  土: ["辰", "戌", "丑", "未"],
  金: ["巳", "申", "酉", "丑"],
  水: ["申", "亥", "子", "辰"],
  木: ["亥", "寅", "卯", "未"],
  火: ["寅", "巳", "午", "戌"],
};

export function assessHehua(p: Pillars): NatalHehua[] {
  const monthBranch = p.月.branch;
  const monthMainElement = BRANCH_ELEMENT[monthBranch];
  const slots = slotsOf(p);
  const targets: { key: PillarKey; position: NatalHehua["position"] }[] = [
    { key: "月", position: "日干-月干" },
    { key: "時", position: "日干-時干" },
  ];
  const base = { monthBranch, monthMainElement };
  return targets
    .filter(({ key }) => p[key] !== null)
    .map(({ key, position }): NatalHehua => {
      const a = p.日.stem;
      const b = p[key]!.stem;
      const row = KANGO.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
      if (!row) {
        return { position, stems: null, stemCombination: "none", transformElement: null, ...base, requiredMonthBranches: null, monthCondition: null, supports: [], references: [], monthRelations: [], luckSupport: null };
      }
      const x: Element = row[2];
      const required = HEHUA_MONTH_BRANCHES[x];
      const common = { position, stems: [row[0], row[1]] as NatalHehua["stems"], transformElement: x, ...base, requiredMonthBranches: required };
      if (!required.includes(monthBranch)) {
        return { ...common, stemCombination: "hequ", monthCondition: false, supports: [], references: [], monthRelations: [], luckSupport: null };
      }

      // 補強: X と比和する天干・地支。干合の2干と月支そのものは数えない
      const otherStems = slots.filter((s) => s.pillar !== "日" && s.pillar !== key);
      const otherBranches = slots.filter((s) => s.pillar !== "月");
      const inX = inElementOf(x);
      const supports: string[] = [];
      const sameStems = otherStems.filter((s) => STEM_ELEMENT[s.stem] === x);
      if (sameStems.length) supports.push(`${x}と比和する天干：${sameStems.map((s) => `${s.pillar}干${s.stem}`).join("・")}`);
      const sameBranches = otherBranches.filter((s) => BRANCH_ELEMENT[s.branch] === x);
      if (sameBranches.length) supports.push(`${x}と比和する地支：${sameBranches.map((s) => `${s.pillar}支${s.branch}`).join("・")}`);
      // 参考情報（補強の判定には使わない）
      const references: string[] = [];
      const gen = [
        ...otherStems.filter((s) => STEM_ELEMENT[s.stem] === inX).map((s) => `${s.pillar}干${s.stem}`),
        ...otherBranches.filter((s) => BRANCH_ELEMENT[s.branch] === inX).map((s) => `${s.pillar}支${s.branch}`),
      ];
      if (gen.length) references.push(`${x}を生じる${inX}：${gen.join("・")}`);
      const touta = assessTouta(p, `化す五行${x}の比劫＋印`, [x, inX]);
      if (touta.level !== "notTouta") {
        const r = touta.share;
        references.push(`${x}の比劫＋印 ${r.minPercent.toFixed(0)}〜${r.maxPercent.toFixed(0)}%（${touta.level === "touta" ? "党多" : "境界"}）`);
      }

      const monthRelations = branchRelationsOf(p, "月").map((r) => `${r.branches.join("")}${r.kind}`);
      return {
        ...common,
        stemCombination: supports.length ? "hehuaCandidateSupported" : "hehuaCandidate",
        monthCondition: true,
        supports,
        references,
        monthRelations,
        luckSupport: null,
      };
    });
}
