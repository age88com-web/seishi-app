// src/lib/liuren/interpretation/relations.ts
//
// 役割:
//   2つの干支の構造関係（生・剋・比和・冲・刑）を返す。吉凶・強弱の判断はしない。
//   五行・刑・冲の表は起課エンジン（constants.ts・relations.ts）のものだけを使い、新しい表は作らない。
//
//   生・剋・比和 … 干・支どちらにも使える（五行で見る。elementOf・controls・ELEMENT_GENERATES）
//   冲・刑       … 支どうしのときだけ（CHONG・XING）
//
// 刑について:
//   XING は1支に1支を対応させた表（講座 p32・p52。伏吟の中末伝で使うもの）をそのまま引く。
//   自刑（辰・午・酉・亥）は from と to が同じ支のとき punishes と punishedBy の両方になる。
//   三刑がそろうかどうかの判定はしない。
//
// 未実装（古典ルール確認後に追加する）: 六合・破・害・墓・十二長生・旺衰・三合局の成立。

import { CHONG, XING, ELEMENT_GENERATES } from "../constants";
import { controls, elementOf, isStem } from "../relations";
import type { Stem, Branch } from "../types";
import type { RelationFact, StructuralRelation } from "./types";

export function relationBetween(from: Stem | Branch, to: Stem | Branch): RelationFact {
  const relations: StructuralRelation[] = [];
  const ef = elementOf(from);
  const et = elementOf(to);

  if (ELEMENT_GENERATES[ef] === et) relations.push("generates");
  if (ELEMENT_GENERATES[et] === ef) relations.push("generatedBy");
  if (controls(from, to)) relations.push("overcomes");
  if (controls(to, from)) relations.push("overcomeBy");
  if (ef === et) relations.push("sameElement");

  if (!isStem(from) && !isStem(to)) {
    const a = from as Branch;
    const b = to as Branch;
    if (CHONG[a] === b) relations.push("clashes");
    if (XING[a] === b) relations.push("punishes");
    if (XING[b] === a) relations.push("punishedBy");
  }

  return { from, to, relations };
}
