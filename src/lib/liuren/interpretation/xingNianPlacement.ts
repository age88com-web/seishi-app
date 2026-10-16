// src/lib/liuren/interpretation/xingNianPlacement.ts
//
// 役割（Phase 5O）:
//   人物の行年（xingNian.ts）が盤のどこにあるか（XingNianPlacement）。吉凶・ROLE・DOMAIN の判断は持たない。
//   原典の「行年」は、規則ごとに見る位置が違うので、位置を一つに決めず別々の項目として持つ:
//     地盤の行年 … 行年の支を地盤の位置として見る。その上に加わる天盤の支＝行年上神（「行年上」「行年上所得之神」）と、その天将
//     天盤の行年 … 行年の支を天盤の支として見る。それが加わる地盤（「行年加孟」「行年臨…」の「加」）と、それに乗る天将（「行年に乗る」）
//     課伝      … 行年の支・行年上神が四課上神・三伝のどこにあるか（「年臨三四」「行年上所得之神…入三傳」）
//     空        … 行年の支が旬空か・天盤の行年が坐空か（地盤が旬空）・行年上神が旬空か（別々に持つ）
//   人物との対応: InterpretationContext.xingNianInputs から人物 ID の入力を探し、xingNianOfPerson（男性で数え年が明示されたときだけ）で求める。
//   入力がない・同じ人物の入力が重複・女性・性別なし・数え年なしは、理由つきで求めない。人物があるだけでは求めない。
//   IdentityLink（Phase 4O）・InterpretationPerson・ContextBranchSource は変えず、行年専用の参照結果としてここに持つ。

import type { Branch, HeavenlyGeneral } from "../types";
import type { InterpretationContext, PersonContextId } from "./roles";
import type { InterpretationFacts, TransmissionPosition } from "./types";
import { xingNianOfPerson } from "./xingNian";
import type { XingNianState, XingNianUnresolvedReason } from "./xingNian";

export interface XingNianPlacement {
  personId: PersonContextId;
  state: XingNianState;
  /** 行年の支 */
  branch: Branch;
  /** 行年の支そのものが占日の旬空か */
  isVoid: boolean;
  // ---- 地盤の行年（その上に加わる天盤の支） ----
  /** 行年上神（地盤の行年の上に加わる天盤の支。plate.heavenOn） */
  upper: Branch;
  /** 行年上神に乗る天将 */
  upperGeneral: HeavenlyGeneral;
  /** 行年上神が占日の旬空か */
  upperIsVoid: boolean;
  /** 行年上神を上神とする四課（1＝干上・3＝支上） */
  upperLessons: readonly (1 | 2 | 3 | 4)[];
  /** 行年上神である三伝の位置（三伝未確定なら空） */
  upperTransmissions: readonly TransmissionPosition[];
  // ---- 天盤の行年（それが加わる地盤） ----
  /** 天盤の行年の支が加わる地盤（plate.earthUnder） */
  skyEarth: Branch;
  /** 天盤の行年の支に乗る天将 */
  skyGeneral: HeavenlyGeneral;
  /** 天盤の行年の支が坐空か（加わる地盤が旬空） */
  skySeatedOnVoid: boolean;
  /** 行年の支を上神とする四課 */
  lessons: readonly (1 | 2 | 3 | 4)[];
  /** 行年の支である三伝の位置 */
  transmissions: readonly TransmissionPosition[];
}

const POS: readonly TransmissionPosition[] = ["initial", "middle", "final"];

/** 行年の盤上の位置（行年は求め済み） */
export function xingNianPlacementOf(facts: InterpretationFacts, personId: PersonContextId, state: XingNianState): XingNianPlacement {
  const v = facts.xun.voidBranches, b = state.branch, up = facts.plate.heavenOn[b];
  const lessonsOf = (x: Branch) => facts.lessons.filter((l) => l.upper === x).map((l) => l.index);
  const transOf = (x: Branch) => (facts.transmissions ? POS.filter((_, i) => facts.transmissions![i].branch === x) : []);
  return {
    personId, state, branch: b, isVoid: v.includes(b),
    upper: up, upperGeneral: facts.generals.generalOn[up], upperIsVoid: v.includes(up), upperLessons: lessonsOf(up), upperTransmissions: transOf(up),
    skyEarth: facts.plate.earthUnder[b], skyGeneral: facts.generals.generalOn[b], skySeatedOnVoid: v.includes(facts.plate.earthUnder[b]),
    lessons: lessonsOf(b), transmissions: transOf(b),
  };
}

/** 行年の位置を求めない理由 */
export type XingNianPlacementReason = XingNianUnresolvedReason | "personIdMissing" | "inputMissing" | "duplicateInput";

export type XingNianPlacementResolution =
  | { status: "resolved"; placement: XingNianPlacement }
  | { status: "unresolved"; personId: PersonContextId | null; reason: XingNianPlacementReason };

/** DOMAIN が指定した人物（行人・病人・財を求める人など）の行年の位置。人物 ID がない・入力がないときは求めない */
export function resolveXingNianPlacement(facts: InterpretationFacts, context: InterpretationContext, personId: PersonContextId | undefined): XingNianPlacementResolution {
  if (personId === undefined) return { status: "unresolved", personId: null, reason: "personIdMissing" };
  const inputs = (context.xingNianInputs ?? []).filter((x) => x.personId === personId);
  if (inputs.length === 0) return { status: "unresolved", personId, reason: "inputMissing" };
  if (inputs.length > 1) return { status: "unresolved", personId, reason: "duplicateInput" };
  const r = xingNianOfPerson(context, inputs[0]);
  return r.status === "resolved" ? { status: "resolved", placement: xingNianPlacementOf(facts, personId, r.state) } : { status: "unresolved", personId, reason: r.reason };
}

/** 求めない理由の日本語（DOMAIN の不足に書く） */
export const XING_NIAN_REASON_TEXT: Record<XingNianPlacementReason, string> = {
  personIdMissing: "対象の人物 ID が指定されていない",
  inputMissing: "対象の人物の行年の入力（性別・数え年）がない",
  duplicateInput: "対象の人物の行年の入力が重複している",
  personNotFound: "対象の人物が persons にない",
  sexMissing: "性別が指定されていない（男性の算法を当てはめない）",
  sexUnsupported: "女性の行年は起例が資料にないので求めない",
  reckonedAgeMissing: "数え年が指定されていない（生年から推測しない）",
};
