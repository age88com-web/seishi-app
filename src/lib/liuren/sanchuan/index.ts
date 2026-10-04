// src/lib/liuren/sanchuan/index.ts
//
// 役割:
//   三伝（九宗法）の判定順序。講座と Phase 1 の30例検証で確定した順序をそのまま実装する。
//
//   1. 月将＝占時（差分0）      → 伏吟法
//   2. 月将と占時が冲（差分6）  → 返吟法
//   3. 四課に賊剋あり          → 賊剋法（重審・元首）→ 比用法 → 涉害法
//   4. 賊剋なし・八専日        → 八専法（遥剋より優先。講座 E15・E17）
//   5. 賊剋なし・遥剋あり      → 遥剋法（蒿矢格・弾射格）
//   6. 重複を除いた課の数が 4  → 昴星法
//                          3  → 別責法
//
//   伏吟・返吟を最初に見る根拠: 講座 p33（不虞格）・p39（無依格）は賊剋があっても
//   伏吟・返吟の規則で三伝を出し、p34 は「遥剋をとらずに伏吟法」とする。

import type { Stem, Branch, FourLessons, HeavenEarthPlate, DecisionStep, SanchuanResult } from "../types";
import { makeContext } from "./context";
import { hasZeike, selectByZeike } from "./zeike";
import { determined, undetermined, upperChain } from "./result";
import { resolveFuyin } from "./fuyin";
import { resolveFanyin } from "./fanyin";
import { isBazhuanDay, resolveBazhuan } from "./bazhuan";
import { yaokeCandidates, resolveYaoke } from "./yaoke";
import { resolveMaoxing } from "./maoxing";
import { resolveBieze } from "./bieze";

export { shehaiPath } from "./shehai";

export function resolveSanchuan(
  dayStem: Stem, dayBranch: Branch, lessons: FourLessons, plate: HeavenEarthPlate,
): SanchuanResult {
  const ctx = makeContext(dayStem, dayBranch, lessons, plate);
  const steps: DecisionStep[] = [];

  if (plate.offset === 0) return resolveFuyin(ctx, steps);
  if (plate.offset === 6) return resolveFanyin(ctx, steps);

  if (hasZeike(ctx)) {
    const sel = selectByZeike(ctx, steps);
    if (!sel.ok) return undetermined(sel.method, sel.reason, sel.steps);
    const { middle, final } = upperChain(ctx, sel.initial);
    steps.push({ stage: "中伝・末伝", detail: `初伝 ${sel.initial} の上神 ${middle} を中伝、その上神 ${final} を末伝`, source: "講座 p11" });
    return determined({
      method: sel.method, pattern: sel.pattern, initial: sel.initial, middle, final,
      steps, shehai: sel.shehai, initialOrigin: sel.origin,
    });
  }
  steps.push({ stage: "賊剋", detail: "四課に賊剋なし", source: "講座 p11" });

  if (isBazhuanDay(ctx)) {
    steps.push({ stage: "八専判定", detail: `日干${dayStem}の寄宮支と日支が同じ八専日（遥剋より優先）`, source: "講座 p28・E15・E17" });
    return resolveBazhuan(ctx, steps);
  }

  const yaoke = yaokeCandidates(ctx);
  if (yaoke) return resolveYaoke(ctx, yaoke, steps);
  steps.push({ stage: "遥剋", detail: "日干と上神の相剋なし", source: "講座 p24" });

  const distinct = new Set(lessons.map((l) => `${l.upper}/${l.lowerBranch}`)).size;
  if (distinct === 4) return resolveMaoxing(ctx, steps);
  if (distinct === 3) {
    steps.push({ stage: "別責判定", detail: "重複する課があり三課しかない", source: "講座 p26" });
    return resolveBieze(ctx, steps);
  }
  return undetermined("八専", `八専日以外で課が${distinct}つしかない場合は講座に記載なし`, steps);
}
