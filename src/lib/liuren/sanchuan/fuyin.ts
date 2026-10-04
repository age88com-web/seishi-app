// src/lib/liuren/sanchuan/fuyin.ts
//
// 役割:
//   伏吟法（講座 p32〜37）。月将と占時が同じ（天盤＝地盤）の場合。遥剋は取らない（p34・p35）。
//
// 初伝:
//   甲・乙・丙・戊・庚・壬・癸日は干上神（一課）、丁・己・辛日は支上神（三課）。
//   乙日・癸日は一課に剋がある（乙が辰を剋す／丑が癸を剋す）ため不虞格（p33）。
//   乙日の初伝は辰（ユーザー確認済みの確定仕様）。
//   剋のない日は、陽日＝自任格（p34）、陰日＝自信格（p35）。
// 中伝:
//   初伝の刑。初伝が自刑（辰・午・酉・亥）なら、一課・三課のうち初伝に採らなかった側
//   （「中伝顛倒日辰尋」。p36・p37 の杜傳格）。
// 末伝:
//   中伝の刑。中伝が自刑なら中伝の冲（p37）。
//   初伝・中伝が子卯の互刑になる場合も中伝の冲（卯→子→午。確定仕様、『大六壬精解』の例）。
// 課体名:
//   自任格・自信格で初伝が自刑なら杜傳格。不虞格で初伝が自刑（乙日）なら「不虞格（初伝自刑）」。
//
// 九宗法一覧（docs/source/九相門.jpg）は自信格の初伝を「干上神（一課）」と書くが、
// 講座 p35 本文と例題（辛巳日、初伝＝支上神の巳）は支上神。講座の例題を優先する。

import { XING, CHONG, FUYIN_GAN_FIRST } from "../constants";
import type { Branch, DecisionStep, SanchuanResult } from "../types";
import { isZei, isKe, lessonLabel } from "./context";
import type { SanchuanContext } from "./context";
import { determined } from "./result";

function isSelfPunish(b: Branch): boolean {
  return XING[b] === b;
}

function isZiMaoPair(a: Branch, b: Branch): boolean {
  return (a === "子" && b === "卯") || (a === "卯" && b === "子");
}

export function resolveFuyin(ctx: SanchuanContext, steps: DecisionStep[]): SanchuanResult {
  steps.push({ stage: "伏吟判定", detail: "月将と占時が同じ（天盤＝地盤）→ 伏吟法（遥剋は取らない）", source: "講座 p32・p34" });

  const keLessons = ctx.lessons.filter((l) => isZei(l) || isKe(l));
  const hasKe = keLessons.length > 0;
  const useGan = FUYIN_GAN_FIRST.includes(ctx.dayStem);

  // ---- 初伝 ----
  const initial = useGan ? ctx.ganUpper : ctx.zhiUpper;
  const other = useGan ? ctx.zhiUpper : ctx.ganUpper;
  const initialSelf = isSelfPunish(initial);
  let pattern: string;
  if (hasKe) {
    pattern = initialSelf ? "不虞格（初伝自刑）" : "不虞格";
    steps.push({
      stage: "伏吟・不虞格",
      detail: `課に剋あり（${keLessons.map(lessonLabel).join("、")}）→ 干上神 ${initial} を初伝`,
      source: ctx.dayStem === "癸" ? "講座 p33" : "講座 p33（乙日の初伝は確定実装仕様）",
    });
  } else {
    pattern = initialSelf ? "杜傳格" : useGan ? "自任格" : "自信格";
    steps.push({
      stage: `伏吟・${useGan ? "自任格" : "自信格"}`,
      detail: `課に剋なし・${useGan ? "陽日のため干上神" : "陰日のため支上神"} ${initial} を初伝`,
      source: useGan ? "講座 p34" : "講座 p35",
    });
  }

  // ---- 中伝 ----
  let middle: Branch;
  if (initialSelf) {
    middle = other;
    steps.push({
      stage: "伏吟・中伝",
      detail: `初伝 ${initial} が自刑 → 初伝に採らなかった${useGan ? "支上神" : "干上神"} ${middle} を中伝（中伝顛倒日辰尋）`,
      source: "講座 p36・p37",
    });
  } else {
    middle = XING[initial];
    steps.push({ stage: "伏吟・中伝", detail: `${initial}が刑する ${middle} を中伝`, source: "講座 p33〜35" });
  }

  // ---- 末伝 ----
  let final: Branch;
  if (isSelfPunish(middle)) {
    final = CHONG[middle];
    steps.push({ stage: "伏吟・末伝", detail: `中伝 ${middle} が自刑 → 冲の ${final} を末伝`, source: "講座 p37" });
  } else if (isZiMaoPair(initial, middle)) {
    final = CHONG[middle];
    steps.push({
      stage: "伏吟・末伝",
      detail: `初伝 ${initial}・中伝 ${middle} が子卯の互刑 → 中伝の冲 ${final} を末伝`,
      source: "確定実装仕様（『大六壬精解』の例）",
    });
  } else {
    final = XING[middle];
    steps.push({ stage: "伏吟・末伝", detail: `${middle}が刑する ${final} を末伝`, source: "講座 p33〜35" });
  }

  return determined({
    method: "伏吟", pattern, initial, middle, final, steps,
    // 規則で干上神（一課）か支上神（三課）を取った地点の記録（上神の一致からは推測しない）
    initialOrigin: useGan
      ? { kind: "ruleLesson", lesson: 1, rule: "dayStemUpper", branch: initial, method: "伏吟" }
      : { kind: "ruleLesson", lesson: 3, rule: "dayBranchUpper", branch: initial, method: "伏吟" },
  });
}
