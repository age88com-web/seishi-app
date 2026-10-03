// src/lib/liuren/sanchuan/bieze.ts
//
// 役割:
//   別責法（講座 p26・p27）。四課に賊剋がなく、遥剋にもならず、
//   重複する課があって三課しかない場合。
//     陽日: 日干と干合する干の寄宮支の上神を初伝（p26・p27）
//     陰日: 日支の三合局のなかで「つぎの支」を初伝（p26）
//     中伝・末伝: 陽日・陰日とも干上神（p26）
//
// 確定実装仕様（ユーザー確認済み、2026-09-25）:
//   - 干合表（甲己・乙庚・丙辛・丁壬・戊癸）。講座に表はなく、例は p27 の戊→癸のみ。
//   - 三合局は 生→旺→墓→生 と循環する（墓の次は生）。講座 p54 の表の並び順に従う。
//   - 陰日の初伝は「つぎの支」そのもの（陽日だけが「上神」と明記されているため）。
//   九宗法一覧（docs/source/九相門.jpg）も同じ内容（陽日「日干の合にあたる干の寄宮支の上神」、
//   陰日「支の三合のうち次の支」）。

import { GANHE, JIGONG, SANHE } from "../constants";
import type { Branch, DecisionStep, SanchuanResult } from "../types";
import type { SanchuanContext } from "./context";
import { determined, undetermined } from "./result";

/** 日支の三合局で、その次の支（墓の次は生へ戻る） */
function nextInSanhe(b: Branch): Branch | null {
  const group = SANHE.find((g) => g.includes(b));
  if (!group) return null;
  return group[(group.indexOf(b) + 1) % 3];
}

export function resolveBieze(ctx: SanchuanContext, steps: DecisionStep[]): SanchuanResult {
  if (!ctx.yangDay) {
    const initial = nextInSanhe(ctx.dayBranch);
    if (!initial) return undetermined("別責", `日支${ctx.dayBranch}の三合局が見つからない`, steps);
    steps.push({
      stage: "別責",
      detail: `陰日: 日支${ctx.dayBranch}の三合局で次の支 ${initial} を初伝、中伝・末伝は干上神 ${ctx.ganUpper}`,
      source: "講座 p26・p54（三合の循環は確定実装仕様）",
    });
    return determined({ method: "別責", pattern: null, initial, middle: ctx.ganUpper, final: ctx.ganUpper, steps });
  }
  const partner = GANHE[ctx.dayStem];
  const initial = ctx.plate.heavenOn[JIGONG[partner]];
  steps.push({
    stage: "別責",
    detail: `陽日: 日干${ctx.dayStem}と干合する${partner}の寄宮支${JIGONG[partner]}の上神 ${initial} を初伝、` +
      `中伝・末伝は干上神 ${ctx.ganUpper}`,
    source: ctx.dayStem === "戊" ? "講座 p26・p27" : "講座 p26（干合表は確定実装仕様）",
  });
  return determined({ method: "別責", pattern: null, initial, middle: ctx.ganUpper, final: ctx.ganUpper, steps });
}
