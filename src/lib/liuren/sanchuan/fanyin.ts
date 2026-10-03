// src/lib/liuren/sanchuan/fanyin.ts
//
// 役割:
//   返吟法（講座 p38〜41）。月将と占時が冲（天盤と地盤がすべて相冲）の場合。
//     賊剋あり → 無依格: 重審・元首、または比用・涉害で初伝（p39）。
//                中伝＝初伝の冲、末伝＝中伝の冲。
//     賊剋なし → 無親格（井欄射格）（p40・p41）:
//                辛未・辛丑・丁丑・己丑 … 日支の駅馬を初伝
//                丁未・己未           … 巳を初伝
//                中伝＝支上神、末伝＝干上神
//   返吟で賊剋がないのはこの6日だけ（Phase 1 の60日検算で確認）。

import {
  CHONG, YIMA, FANYIN_NO_ZEIKE_SI_DAYS, FANYIN_NO_ZEIKE_YIMA_DAYS,
} from "../constants";
import type { Branch, DecisionStep, SanchuanResult } from "../types";
import type { SanchuanContext } from "./context";
import { determined, undetermined } from "./result";
import { hasZeike, selectByZeike } from "./zeike";

export function resolveFanyin(ctx: SanchuanContext, steps: DecisionStep[]): SanchuanResult {
  steps.push({ stage: "返吟判定", detail: "月将と占時が冲（天盤と地盤がすべて相冲）→ 返吟法", source: "講座 p38" });

  if (hasZeike(ctx)) {
    const sel = selectByZeike(ctx, steps);
    if (!sel.ok) return undetermined("返吟", sel.reason, sel.steps);
    const initial = sel.initial;
    const middle = CHONG[initial];
    const final = CHONG[middle];
    steps.push({
      stage: "返吟・無依格",
      detail: `初伝 ${initial}（${sel.method}${sel.pattern ? "・" + sel.pattern : ""}）、中伝は初伝の冲 ${middle}、末伝は中伝の冲 ${final}`,
      source: "講座 p39",
    });
    return determined({
      method: "返吟", pattern: "無依格", initial, middle, final, steps, shehai: sel.shehai,
    });
  }

  const day = `${ctx.dayStem}${ctx.dayBranch}`;
  let initial: Branch;
  if (FANYIN_NO_ZEIKE_YIMA_DAYS.includes(day)) {
    initial = YIMA[ctx.dayBranch];
    steps.push({ stage: "返吟・無親格", detail: `${day}日は賊剋なし → 日支${ctx.dayBranch}の駅馬 ${initial} を初伝`, source: "講座 p40" });
  } else if (FANYIN_NO_ZEIKE_SI_DAYS.includes(day)) {
    initial = "巳";
    steps.push({ stage: "返吟・無親格", detail: `${day}日は賊剋なし → 巳を初伝`, source: "講座 p40" });
  } else {
    return undetermined("返吟", `${day}日の返吟で賊剋がない場合は講座に記載なし`, steps);
  }
  steps.push({ stage: "返吟・無親格", detail: `中伝は支上神 ${ctx.zhiUpper}、末伝は干上神 ${ctx.ganUpper}`, source: "講座 p40・p41" });
  return determined({ method: "返吟", pattern: "無親格", initial, middle: ctx.zhiUpper, final: ctx.ganUpper, steps });
}
