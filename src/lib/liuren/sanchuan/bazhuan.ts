// src/lib/liuren/sanchuan/bazhuan.ts
//
// 役割:
//   八専法（講座 p28〜31）。四課に賊剋がなく、日干の寄宮支と日支が同じ日
//   （甲寅・丁未・己未・庚申・癸丑）で二課しかない場合。
//     陽日: 一課の上神から起点を含めて3つ先（＝2つ進んだ支）を初伝
//     陰日: 四課の上神から起点を含めて3つ後ろ（＝2つ戻った支）を初伝
//     中伝・末伝: 干上神
//     三伝がすべて同じ支になれば独足格（p31）
//
// 遥剋との優先順位:
//   講座 E15（甲寅、遥剋候補 申）・E17（己未、遥剋候補 亥）はどちらも八専を採っている。
//   よって八専日は遥剋より八専を優先する（講座30例の検証で確定）。

import { JIGONG } from "../constants";
import { shiftBranch } from "../relations";
import type { DecisionStep, SanchuanResult } from "../types";
import type { SanchuanContext } from "./context";
import { determined } from "./result";

export function isBazhuanDay(ctx: SanchuanContext): boolean {
  return JIGONG[ctx.dayStem] === ctx.dayBranch;
}

export function resolveBazhuan(ctx: SanchuanContext, steps: DecisionStep[]): SanchuanResult {
  const initial = ctx.yangDay
    ? shiftBranch(ctx.lessons[0].upper, 2)
    : shiftBranch(ctx.lessons[3].upper, -2);
  const middle = ctx.ganUpper;
  const final = ctx.ganUpper;
  const pattern = initial === middle ? "独足格" : null;
  steps.push({
    stage: "八専",
    detail: (ctx.yangDay
      ? `陽日: 一課上神 ${ctx.lessons[0].upper} から起点を含めて3つ先の ${initial} を初伝`
      : `陰日: 四課上神 ${ctx.lessons[3].upper} から起点を含めて3つ後ろの ${initial} を初伝`) +
      `、中伝・末伝は干上神 ${ctx.ganUpper}${pattern ? "（三伝が同じ支のため独足格）" : ""}`,
    source: ctx.yangDay ? "講座 p28・p29" : pattern ? "講座 p28・p31" : "講座 p28・p30",
  });
  return determined({ method: "八専", pattern, initial, middle, final, steps, initialOrigin: { kind: "derived", branch: initial, method: "八専" } });
}
