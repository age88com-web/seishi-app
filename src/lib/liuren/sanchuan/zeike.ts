// src/lib/liuren/sanchuan/zeike.ts
//
// 役割:
//   賊剋法・比用法（講座 p10〜16・p39）で初伝を選ぶ。複数残れば涉害法へ渡す。
//
//   候補: 下賊の課があれば下賊の課だけ。なければ上剋の課（講座 p11「まず下賊より取る」）。
//         下賊を先に候補にすることは断案の実例でも確認済み（メモリ liuren-shehai-spec）。
//   1つ → 下賊なら重審、上剋なら元首（講座 p39）。
//   複数 → 比用（知一）: 日干と陰陽が同じ上神に絞る（講座 p15・p16）。
//          1つ → 初伝。2つ以上 → 陰陽が同じ候補だけで涉害法（講座 p16・p19）。
//          0 → 元の候補をすべて涉害法で比較する。
//              講座から合理的に導いた確定実装仕様（2026-09-25 ユーザー確認済み）。
//              根拠: 講座 p16 の注「知一法では判定できない場合は涉害法を用いる」、
//              p10 の涉害法「比、不比を見る」。一致候補0件の場合そのものは講座に明記なし。
//              『六壬断案2』例37（癸酉＋9、午→卯→子）とも一致することを確認済み。
//
//   講座 p16 は「二つの下賊」の例を「知一法」と呼ぶが、九宗法一覧（docs/source/九相門.jpg）は
//   「二つの下賊上を比用、二つの上剋下を知一」とし、呼び方が食い違う。
//   初伝の取り方は同じなので、法名は「比用」、格名は付けない（名称は要確認）。

import { isYang } from "../relations";
import type { DecisionStep } from "../types";
import { isZei, isKe, lessonLabel, originFromLessons } from "./context";
import type { SanchuanContext, InitialSelection } from "./context";
import { selectByShehai } from "./shehai";

/** 四課に賊剋があるか */
export function hasZeike(ctx: SanchuanContext): boolean {
  return ctx.lessons.some((l) => isZei(l) || isKe(l));
}

export function selectByZeike(ctx: SanchuanContext, steps: DecisionStep[]): InitialSelection {
  const zei = ctx.lessons.filter(isZei);
  const ke = ctx.lessons.filter(isKe);
  steps.push({
    stage: "賊剋",
    detail: `下賊: ${zei.map(lessonLabel).join("、") || "なし"} / 上剋: ${ke.map(lessonLabel).join("、") || "なし"}`,
    source: "講座 p11",
  });

  const useZei = zei.length > 0;
  const candidates = useZei ? zei : ke;
  const kind = useZei ? "下賊" : "上剋";
  const baseMethod = useZei ? "重審" : "元首";

  const uppers = new Set(candidates.map((l) => l.upper));
  if (uppers.size === 1) {
    const initial = candidates[0].upper;
    steps.push({
      stage: baseMethod,
      detail: candidates.length === 1
        ? `${kind}は1つ（${lessonLabel(candidates[0])}）→ 上神 ${initial} を初伝とする`
        : `${kind}の課は複数だが上神はすべて ${initial}（重複課）→ ${initial} を初伝とする。` +
          `このときの法名（重審・元首か比用か）は講座に記載なし`,
      source: "講座 p11・p39",
    });
    // 候補の課はすべて同じ上神（initial）。重複課なら複数のまま記録する
    return { ok: true, initial, method: baseMethod, pattern: null, steps, origin: originFromLessons(candidates, initial, baseMethod) };
  }

  // 比用（知一）
  const matched = candidates.filter((l) => isYang(l.upper) === ctx.yangDay);
  const matchedUppers = new Set(matched.map((l) => l.upper));
  steps.push({
    stage: "比用",
    detail: `${kind}が複数（${candidates.map(lessonLabel).join("、")}）。` +
      `日干${ctx.dayStem}は${ctx.yangDay ? "陽" : "陰"}、陰陽が同じ上神: ${[...matchedUppers].join("、") || "なし"}`,
    source: "講座 p15・p16",
  });
  if (matchedUppers.size === 1) {
    // 陰陽が同じ候補の課はすべて同じ上神（matchedUppers が1つ）
    return { ok: true, initial: matched[0].upper, method: "比用", pattern: null, steps, origin: originFromLessons(matched, matched[0].upper, "比用") };
  }
  if (matchedUppers.size === 0) {
    steps.push({
      stage: "比用",
      detail: "日干と陰陽が同じ候補がないため比用では決まらない → 元の候補をすべて涉害法で比較する",
      source: "講座 p16・p10 から導いた確定実装仕様",
    });
    return selectByShehai(ctx, candidates, steps);
  }
  return selectByShehai(ctx, matched, steps);
}
