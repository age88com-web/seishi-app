// src/lib/liuren/interpretation/identityLinkFacts.ts
//
// 役割（Phase 4S）:
//   IdentityLink（Phase 4R）のつながり先の位置にある既存の中立 FACT を参照する。IdentityLink 自体は変えない。
//   新しい計算・判断はしない（既存の状態をそのまま指す）。
//     位置の FACT（link.anchor を基準に resolveAnchor の結果から取る）:
//       dayBranch    → DayBranchState（Phase 3V。日干関係・六親・十二長生・旺衰・標識・旬空。坐空・天将はない）
//       lesson upper → FourLessonState（Phase 3U）と、その上神の DayStemStandingState（旬空・坐空・標識・十二長生など）
//       lesson lower → FourLessonState だけ（下神は地盤の位置なので、天盤側の状態・天将はない）
//       standing・三伝 → PositionActualizationState（Phase 3S。元の DayStemStandingState・TransmissionDayStemState を含む）
//     支だけで決まる FACT（link.branch）: DerivedBranchDayStemState（Phase 4K。日干関係・六親）
//     天将: 天盤支の位置（四課上神・干上・三伝）だけ Phase 4B。地盤側の位置（日支・四課下神）は null
//   驛馬は「つながり先の驛馬」として扱わない（本命 → yimaOf は別の系統）。有効・無効・吉凶・ROLE・DOMAIN は持たない。

import type { AnchorResolutionContext } from "./anchorResolver";
import { resolveAnchor } from "./anchorResolver";
import { derivedBranchDayStemStateOf } from "./derivedBranchDayStem";
import { heavenlyGeneralStateOf } from "./heavenlyGeneralState";
import type { IdentityLink } from "./identityLink";
import type {
  DayBranchState, DayStemStandingState, DerivedBranchDayStemState, FourLessonState, HeavenlyGeneralPositionState, PositionActualizationState,
} from "./types";

/** つながり先の位置の既存 FACT（位置の種類ごと） */
export type IdentityLinkPositionFacts =
  | { kind: "dayBranch"; state: DayBranchState }
  | { kind: "lessonUpper"; lesson: FourLessonState; state: DayStemStandingState }
  | { kind: "lessonLower"; lesson: FourLessonState }
  | { kind: "path"; state: PositionActualizationState };

export interface IdentityLinkFacts {
  /** 元のつながり（出典・派生・位置） */
  link: IdentityLink;
  /** つながり先の位置の既存 FACT */
  position: IdentityLinkPositionFacts;
  /** つながり先の支と日干の関係（Phase 4K） */
  dayStemRelation: DerivedBranchDayStemState;
  /** つながり先が天盤支の位置ならその天将（Phase 4B）。地盤側の位置は null */
  heavenlyGeneral: HeavenlyGeneralPositionState | null;
}

/** つながり先の既存 FACT。位置が解決できなければ null（三伝未確定のときの干上・三伝） */
export function resolveIdentityLinkFacts(ctx: AnchorResolutionContext, link: IdentityLink): IdentityLinkFacts | null {
  const a = link.anchor;
  const r = resolveAnchor(a.kind === "lesson" ? { kind: "lesson", index: a.index } : a, ctx);
  if (!r) return null;
  let position: IdentityLinkPositionFacts;
  switch (r.kind) {
    case "dayStem": return null; // 日干は IdentityLink の位置に含まれない
    case "dayBranch": position = { kind: "dayBranch", state: r.source }; break;
    case "path": position = { kind: "path", state: r.source }; break;
    case "lesson":
      position = a.kind === "lesson" && a.part === "lower"
        ? { kind: "lessonLower", lesson: r.source }
        : { kind: "lessonUpper", lesson: r.source, state: r.source.upper };
      break;
  }
  const skyPosition = position.kind === "lessonUpper" || position.kind === "path";
  return {
    link,
    position,
    dayStemRelation: derivedBranchDayStemStateOf(ctx.facts, link.branch),
    heavenlyGeneral: skyPosition ? heavenlyGeneralStateOf(ctx.facts, link.branch) : null,
  };
}
