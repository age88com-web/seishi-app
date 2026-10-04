// src/lib/liuren/interpretation/directionEvidence.ts
//
// 役割:
//   進退判断に古典が使う材料を、方向のシグナルとして並べる（Phase 3N）。結論（宜進・宜退・宜守）は出さない。
//     A. 三伝の向き     … movementPattern → movementDirection（進茹・進間＝advancing、退茹・退間＝retreating、その他＝neutral）
//     B. 空亡による阻害 … 末伝の dayXunVoid・seatedOnVoid（Phase 3M-C の voidStructure）
//     C. 干上の現在地   … dayStemStandingOf（Phase 3L）
//     D. 三伝の経路     … transmissionDayStemFlowOf（Phase 3K・3M-C）
//   A〜D は1つの結論にまとめない。score は持たない。
//   季節内の進気・退気（seasonalBranchDirection）、旺相休囚死、十二長生はそれぞれ独立の FACT のまま。
//   特定の日干支・三伝配列を見分ける条件は持たない（一般の FACT だけ）。

import type { Branch } from "../types";
import { standingAndTransmissionPathOf } from "./standingPath";
import type { DirectionEvidence, InterpretationFacts, MovementDirection, MovementPattern } from "./types";

const DIRECTION_OF: Record<MovementPattern, MovementDirection> = {
  進茹: "advancing", 進間: "advancing",
  退茹: "retreating", 退間: "retreating",
  その他: "neutral",
};

/** movementPattern → 三伝の支の移動の向き */
export function movementDirectionOf(pattern: MovementPattern): MovementDirection {
  return DIRECTION_OF[pattern];
}

/** 進退判断の材料。monthBranch は月令の月支（なければ旺相休囚死は null）。三伝未確定なら null */
export function directionEvidenceOf(facts: InterpretationFacts, monthBranch?: Branch | null): DirectionEvidence | null {
  const { standing, path } = standingAndTransmissionPathOf(facts, monthBranch);
  if (!path) return null;
  return {
    movementDirection: movementDirectionOf(path.movementPattern),
    movementPattern: path.movementPattern,
    standing,
    path,
    terminal: {
      dayXunVoid: path.voidStructure.finalIsDayXunVoid,
      seatedOnVoid: path.voidStructure.finalIsSeatedOnVoid,
    },
  };
}
