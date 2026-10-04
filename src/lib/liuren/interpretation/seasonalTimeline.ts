// src/lib/liuren/interpretation/seasonalTimeline.ts
//
// 役割:
//   任意の五行について、月令が前後に推移したときの旺相休囚死を並べる（時令の気勢タイムライン）。
//   月令（rulingElementOfMonth。辰未戌丑＝土旺、四季寄旺十八日は扱わない）と seasonalStrengthOf（Phase 3A）を
//   そのまま使い、新しい旺衰の規則は作らない。月将は使わない。
//   進気・退気・吉凶・数値順位は持たない。空亡・墓・生剋・六親・天将・神煞による補正もしない。
//
//   月令の順: 寅→卯→辰→巳→午→未→申→酉→戌→亥→子→丑→寅（十二支順の循環。丑の次は寅）
//   API は五行（Element）単位。三伝は各伝の地支自身の五行、日干は日干の五行に当てはめる。
//   官星・財・類神など占目ごとの対象は、将来その五行を渡して使う（今回は名前を入れない）。

import { STEM_ELEMENT } from "../constants";
import { elementOf, shiftBranch } from "../relations";
import type { Branch, Element } from "../types";
import { rulingElementOfMonth, seasonalStrengthOf } from "./states";
import type {
  DayStemSeasonalTimeline, InterpretationFacts, SeasonalTimeline, SeasonalTimelinePoint,
  SeasonalTimelineTransition, TransmissionPosition, TransmissionSeasonalTimeline, Triple,
} from "./types";

/** current の月支から offset か月ずれた月令での、その五行の旺相休囚死 */
export function seasonalPointAt(element: Element, currentMonthBranch: Branch, offset: number): SeasonalTimelinePoint {
  const monthBranch = shiftBranch(currentMonthBranch, offset);
  const rulingElement = rulingElementOfMonth(monthBranch);
  return { offset, monthBranch, rulingElement, strength: seasonalStrengthOf(element, rulingElement) };
}

/** offset fromOffset 〜 toOffset の点を順に並べる */
export function seasonalPointsBetween(
  element: Element, currentMonthBranch: Branch, fromOffset: number, toOffset: number,
): SeasonalTimelinePoint[] {
  const out: SeasonalTimelinePoint[] = [];
  for (let k = fromOffset; k <= toOffset; k++) out.push(seasonalPointAt(element, currentMonthBranch, k));
  return out;
}

function transitionOf(a: SeasonalTimelinePoint, b: SeasonalTimelinePoint): SeasonalTimelineTransition {
  return {
    fromOffset: a.offset, toOffset: b.offset, fromMonthBranch: a.monthBranch, toMonthBranch: b.monthBranch,
    from: a.strength, to: b.strength, changed: a.strength !== b.strength,
  };
}

/** 五行の時令タイムライン（前月・当月・翌月・翌々月） */
export function seasonalTimelineOf(element: Element, currentMonthBranch: Branch): SeasonalTimeline {
  const points = seasonalPointsBetween(element, currentMonthBranch, -1, 2);
  const [previous, current, next, next2] = points;
  return {
    element, currentMonthBranch, points, previous, current, next, next2,
    transitions: [transitionOf(current, next), transitionOf(next, next2)],
  };
}

const POSITIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];

/** 三伝の各伝の地支自身の五行の時令タイムライン。三伝未確定なら null */
export function transmissionSeasonalTimelines(
  facts: InterpretationFacts, currentMonthBranch: Branch,
): Triple<TransmissionSeasonalTimeline> | null {
  const ts = facts.transmissions;
  if (!ts) return null;
  const at = (i: number): TransmissionSeasonalTimeline => ({
    ...seasonalTimelineOf(elementOf(ts[i].branch), currentMonthBranch),
    position: POSITIONS[i],
    branch: ts[i].branch,
  });
  return { initial: at(0), middle: at(1), final: at(2) };
}

/** 日干の五行の時令タイムライン */
export function dayStemSeasonalTimeline(facts: InterpretationFacts, currentMonthBranch: Branch): DayStemSeasonalTimeline {
  const dayStem = facts.basic.dayStem;
  return { ...seasonalTimelineOf(STEM_ELEMENT[dayStem], currentMonthBranch), dayStem };
}
