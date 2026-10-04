// src/lib/liuren/sanchuan/maoxing.ts
//
// 役割:
//   昴星法（講座 p24・p25）。四課に賊剋がなく、遥剋にもならず、四課がそろっている場合。
//     陽日（虎視格）: 地盤酉の上の天盤支を初伝、中伝＝支上神、末伝＝干上神
//     陰日（冬蛇掩目）: 天盤酉の下の地盤支を初伝、中伝＝干上神、末伝＝支上神

import type { DecisionStep, SanchuanResult } from "../types";
import type { SanchuanContext } from "./context";
import { determined } from "./result";

export function resolveMaoxing(ctx: SanchuanContext, steps: DecisionStep[]): SanchuanResult {
  if (ctx.yangDay) {
    const initial = ctx.plate.heavenOn["酉"];
    steps.push({
      stage: "昴星",
      detail: `陽日: 地盤酉の上神 ${initial} を初伝、中伝は支上神 ${ctx.zhiUpper}、末伝は干上神 ${ctx.ganUpper}`,
      source: "講座 p24",
    });
    return determined({ method: "昴星", pattern: "虎視格", initial, middle: ctx.zhiUpper, final: ctx.ganUpper, steps, initialOrigin: { kind: "derived", branch: initial, method: "昴星" } });
  }
  const initial = ctx.plate.earthUnder["酉"];
  steps.push({
    stage: "昴星",
    detail: `陰日: 天盤酉の下の地盤支 ${initial} を初伝、中伝は干上神 ${ctx.ganUpper}、末伝は支上神 ${ctx.zhiUpper}`,
    source: "講座 p25",
  });
  return determined({ method: "昴星", pattern: "冬蛇掩目", initial, middle: ctx.ganUpper, final: ctx.zhiUpper, steps, initialOrigin: { kind: "derived", branch: initial, method: "昴星" } });
}
