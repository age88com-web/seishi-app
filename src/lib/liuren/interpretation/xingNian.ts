// src/lib/liuren/interpretation/xingNian.ts
//
// 役割（Phase 5N）:
//   行年（XingNianState）＝人物の数え年で決まる支（と干）。人物ごとの FACT で、起課・本命・太歳・日干とは独立に持つ。
//   ROLE・DOMAIN・吉凶は持たない。盤上の位置（上神・天将など）は、支を既存の関数（plate.heavenOn など）に渡して求める。
//   入力は人物 ID つきの XingNianInput で受け取り、InterpretationPerson・ContextBranchSource（Phase 4M・4N の確定構造）は変えない
//   （person_context・context_branch のテストが「性別・年齢・行年を持たない」「盤外の種類は本命・太歳のまま」を確かめている）。
//   IdentityLink で盤とつなぐかは、行年を使う DOMAIN（Phase 5O）で決める。
//
//   算法（確定したのは男性だけ）:
//     男性 … 一歳＝丙寅、数え年が一つ増えるごとに六十干支を順に進む（n 歳＝丙寅から n−1 進んだ干支）
//       出典: 『大六壬指南』武挙章第十四 占験四 割注「公獻用一歲起丙寅行年法，不用金口訣換旬法」（戊戌年生・丁丑年四十歳・行年在巳）、
//             『六壬心鏡』巻八 兵占門 注「行年不論長少，只以寅上起一歲」（支の起点。性別の記載なし）
//       検証: 『六壬断案２』の原文（邵先生の判断）で年齢と行年が書かれた6か所（例32・例43・例50×2・例51・例55）がすべて一致、
//             『指南』占訟章 占験五 割注「行年必在戌」（己丑年生・癸酉年）も一致。不一致は『断案２』例46「四十五、六歳…行年は子丑」の1か所
//             （原因は未確定。中国語原文が手元にない。テストに記録）
//     女性 … 起例の文が取得資料にない。『指南』仕宦章 占験三十三（母・甲子年生・壬午年「子命行年到申」）は男性と同じ算法で一致するが、
//             例が男性の算法と一致しても女性の算法の確定根拠にはしない（不明として返す）。性別が指定されない人物にも男性の算法を当てはめない
//
//   年齢: 数え年を明示的に受け取る（『断案２』の年齢は、すべて「占年の干支 − 生年の干支 ＋ 1」の数え年と合う）。
//     生年月日・占う日時から年齢を求めない。年の境界（年初か立春か、誕生日で替わるか）は資料で確定しない（『大全』鬼墓課「行年未交」は
//     誕生日で替わる可能性を示す検討材料で、確定根拠ではない）ので、
//     年齢を決めるのは呼び出し側（入力）とする。生年干支（本命）と数え年の整合も、ここでは確かめない（本命とは別の入力）。

import { BRANCHES, STEMS } from "../constants";
import type { Branch, Stem } from "../types";
import { findInterpretationPerson } from "./personContext";
import type { InterpretationContext, PersonContextId } from "./roles";

/** 行年（人物の数え年から求めた干支） */
export interface XingNianState {
  kind: "xingNian";
  stem: Stem;
  branch: Branch;
  /** 計算に使った数え年 */
  reckonedAge: number;
  /** 算法（確定した男性の算法だけ） */
  method: "maleFromBingYin";
}

/** 行年の入力（人物ごと）。性別・数え年は明示されたときだけ入れ、生年月日などから求めない */
export interface XingNianInput {
  /** InterpretationContext.persons の人物 ID */
  personId: PersonContextId;
  /** 性別（行年の算法の選択だけに使う）。分からなければ省く（男性の算法を当てはめない） */
  sex?: "male" | "female";
  /** 占う時点の数え年。年の境界は資料で確定しないので、呼び出し側が明示する。分からなければ省く */
  reckonedAge?: number;
}

/** 行年を求められない理由 */
export type XingNianUnresolvedReason =
  | "personNotFound"      // 人物 ID が persons にない
  | "sexMissing"          // 性別が指定されていない（男性の算法を当てはめない）
  | "sexUnsupported"      // 女性: 起例が資料にないので求めない
  | "reckonedAgeMissing"; // 数え年が指定されていない

const BING_YIN = 2; // 六十干支で丙寅は 3 番目（甲子＝0）

/** 男性の行年: 数え年（1 以上の整数）→ 一歳＝丙寅から順行した干支 */
export function maleXingNianOf(reckonedAge: number): XingNianState {
  if (!Number.isInteger(reckonedAge) || reckonedAge < 1) throw new Error(`数え年は 1 以上の整数で与えてください: ${reckonedAge}`);
  const i = (BING_YIN + reckonedAge - 1) % 60;
  return { kind: "xingNian", stem: STEMS[i % 10] as Stem, branch: BRANCHES[i % 12] as Branch, reckonedAge, method: "maleFromBingYin" };
}

export type XingNianResolution =
  | { status: "resolved"; personId: PersonContextId; state: XingNianState }
  | { status: "unresolved"; personId: PersonContextId; reason: XingNianUnresolvedReason };

/** 人物の行年。人物が persons にあり、性別（男）・数え年が明示されたときだけ求める（人物 ID があるだけでは求めない） */
export function xingNianOfPerson(context: InterpretationContext, input: XingNianInput): XingNianResolution {
  const personId = input.personId;
  if (!findInterpretationPerson(context, personId)) return { status: "unresolved", personId, reason: "personNotFound" };
  if (!input.sex) return { status: "unresolved", personId, reason: "sexMissing" };
  if (input.sex !== "male") return { status: "unresolved", personId, reason: "sexUnsupported" };
  if (input.reckonedAge === undefined) return { status: "unresolved", personId, reason: "reckonedAgeMissing" };
  return { status: "resolved", personId, state: maleXingNianOf(input.reckonedAge) };
}
