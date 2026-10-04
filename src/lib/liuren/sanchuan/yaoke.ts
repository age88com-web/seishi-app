// src/lib/liuren/sanchuan/yaoke.ts
//
// 役割:
//   遥剋法（講座 p22・p23）。四課に賊剋がないとき。
//     上神が日干を剋すもの → 蒿矢格
//     なければ日干が剋す上神 → 弾射格
//     複数あれば日干と陰陽が同じものを初伝とする（p22）
//   一課の上神と日干の関係は一課そのものの賊剋なので、ここに来る時点で必ず相剋はない。
//
// 根拠レベル:
//   遥剋の中伝・末伝は講座に記載がない（E10・E11 は初伝のみ掲載）。
//   賊剋法と同じ「初伝の上神→中伝、中伝の上神→末伝」で出すが、これは参考値
//   （middleFinalEvidence = "reference"）であり、講座で検証済みではない。

import { controls, isYang } from "../relations";
import type { Branch, DecisionStep, SanchuanResult } from "../types";
import type { SanchuanContext } from "./context";
import { determined, undetermined, upperChain } from "./result";
import { originFromLessons } from "./context";

/** 遥剋が成立するか（候補となる上神があるか） */
export function yaokeCandidates(ctx: SanchuanContext): { kind: "蒿矢格" | "弾射格"; uppers: Branch[] } | null {
  const uppers = [...new Set(ctx.lessons.map((l) => l.upper))];
  const hurtDay = uppers.filter((u) => controls(u, ctx.dayStem));
  if (hurtDay.length) return { kind: "蒿矢格", uppers: hurtDay };
  const hurtByDay = uppers.filter((u) => controls(ctx.dayStem, u));
  if (hurtByDay.length) return { kind: "弾射格", uppers: hurtByDay };
  return null;
}

export function resolveYaoke(
  ctx: SanchuanContext,
  found: { kind: "蒿矢格" | "弾射格"; uppers: Branch[] },
  steps: DecisionStep[],
): SanchuanResult {
  let initial: Branch;
  if (found.uppers.length === 1) {
    initial = found.uppers[0];
  } else {
    const matched = found.uppers.filter((u) => isYang(u) === ctx.yangDay);
    if (matched.length !== 1) {
      steps.push({ stage: "遥剋", detail: `候補 ${found.uppers.join("、")} から陰陽で一意に決まらない` });
      return undetermined("遥剋", "遥剋の候補が陰陽でも一意に決まらない。この場合の処理は講座に記載なし", steps);
    }
    initial = matched[0];
  }
  steps.push({
    stage: "遥剋",
    detail: found.kind === "蒿矢格"
      ? `日干${ctx.dayStem}を剋す上神 ${found.uppers.join("、")} → ${initial} を初伝とする`
      : `日干${ctx.dayStem}を剋す上神はなく、日干が剋す上神 ${found.uppers.join("、")} → ${initial} を初伝とする`,
    source: found.kind === "蒿矢格" ? "講座 p22" : "講座 p23",
  });
  steps.push({
    stage: "遥剋",
    detail: "中伝・末伝は講座に記載がないため、賊剋法と同じ方法で出した参考値",
  });
  const { middle, final } = upperChain(ctx, initial);
  return determined({
    method: "遥剋", pattern: found.kind, initial, middle, final,
    middleFinalEvidence: "reference", steps,
    // 遥剋の候補は四課の上神（yaokeCandidates）。選んだ上神をもつ課をそのまま記録する（同じ上神の課は同じ条件を満たす）
    initialOrigin: originFromLessons(ctx.lessons.filter((l) => l.upper === initial), initial, "遥剋"),
  });
}
