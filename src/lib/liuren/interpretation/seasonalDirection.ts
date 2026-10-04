// src/lib/liuren/interpretation/seasonalDirection.ts
//
// 役割:
//   季節内の進気・退気（同じ季節・同じ五行に属する二支の順行／逆行）を、支→支の関係だけで判定する中立 FACT。
//   ユーザー指定 2026-10-04。対象は次の8組だけ:
//     advancing  … 寅→卯（春・木）・巳→午（夏・火）・申→酉（秋・金）・亥→子（冬・水）
//     retreating … 卯→寅・午→巳・酉→申・子→亥
//   それ以外（土支 辰未戌丑を含む・同支を含む）は none。none に吉凶・強弱の意味はない。
//
//   次のものは使わず、混ぜない（別の FACT として独立に持つ）:
//     movementPattern（進茹・退茹・進間・退間）、十二長生（growthStage・growthPhase）、
//     旺相休囚死（seasonalStrength・seasonalTimeline）、月支、宜進・宜退。
//   三伝は初→中・中→末の各区間を直接判定する（movementPattern から推測しない）。

import type { Branch, Element } from "../types";
import type {
  InterpretationFacts, SeasonalBranchDirectionFact, SeasonName, TransmissionSeasonalDirection,
} from "./types";

/** 季節内の二支（前の支→後の支が advancing。逆が retreating） */
const SEASON_PAIRS: readonly { first: Branch; second: Branch; element: Element; season: SeasonName }[] = [
  { first: "寅", second: "卯", element: "木", season: "spring" },
  { first: "巳", second: "午", element: "火", season: "summer" },
  { first: "申", second: "酉", element: "金", season: "autumn" },
  { first: "亥", second: "子", element: "水", season: "winter" },
];

/** 支→支の季節内の向き（月支・旺衰・十二長生に依らない） */
export function seasonalBranchDirectionBetween(from: Branch, to: Branch): SeasonalBranchDirectionFact {
  for (const p of SEASON_PAIRS) {
    if (from === p.first && to === p.second) return { from, to, direction: "advancing", element: p.element, season: p.season };
    if (from === p.second && to === p.first) return { from, to, direction: "retreating", element: p.element, season: p.season };
  }
  return { from, to, direction: "none", element: null, season: null };
}

/** 三伝の初→中・中→末の季節内の向き。三伝未確定なら null */
export function transmissionSeasonalDirection(facts: InterpretationFacts): TransmissionSeasonalDirection | null {
  const ts = facts.transmissions;
  if (!ts) return null;
  return {
    initialToMiddle: seasonalBranchDirectionBetween(ts[0].branch, ts[1].branch),
    middleToFinal: seasonalBranchDirectionBetween(ts[1].branch, ts[2].branch),
  };
}
