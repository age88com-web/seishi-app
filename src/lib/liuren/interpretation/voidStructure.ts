// src/lib/liuren/interpretation/voidStructure.ts
//
// 役割:
//   空亡の構造 FACT（Phase 3M-C）。占日の旬空（dayXunVoid）と坐空（seatedOnVoid）を別々に持つ。
//     dayXunVoid   … 支そのものが占日の旬空（既存の isVoid。facts.transmissions / facts.xun.voidBranches）
//     seatedOnVoid … 支（天盤）が加わる地盤支（plate.earthUnder）が占日の旬空
//   どちらも盤面上の事実で、吉凶は判断しない。
//
//   次のものは持たない（Phase 3M-A・3M-B の監査で未確定）:
//     三伝皆空・踏脚空亡・進茹空亡の判定、旬をたどる空亡（本旬→後旬→外後旬・R4）、宜進・宜退。
//   連間（例: 甲子日 戌→申→午）では、日旬空と坐空だけでは古典の「本旬・後旬・外後旬之空」を表せない。

import type { Branch } from "../types";
import type { InterpretationFacts, TransmissionVoidStructure } from "./types";

/** 支（天盤）が加わる地盤支が占日の旬空か（坐空） */
export function isSeatedOnVoid(facts: InterpretationFacts, branch: Branch): boolean {
  return facts.xun.voidBranches.includes(facts.plate.earthUnder[branch]);
}

/** 三伝の空亡の構造。三伝未確定なら null */
export function transmissionVoidStructureOf(facts: InterpretationFacts): TransmissionVoidStructure | null {
  const ts = facts.transmissions;
  if (!ts) return null;
  const seated = ts.map((t) => isSeatedOnVoid(facts, t.branch));
  return {
    dayXunVoid: { initial: ts[0].isVoid, middle: ts[1].isVoid, final: ts[2].isVoid },
    seatedOnVoid: { initial: seated[0], middle: seated[1], final: seated[2] },
    finalIsDayXunVoid: ts[2].isVoid,
    finalIsSeatedOnVoid: seated[2],
  };
}
