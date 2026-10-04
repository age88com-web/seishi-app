// src/lib/liuren/interpretation/anchorResolver.ts
//
// 役割（Phase 3W）:
//   ROLE 層・DOMAIN 層から盤上の FACT へ到達する共通の窓口。BoardAnchor（Phase 3T）を、生成済みの FACT へ解決する。
//   将来の経路: assignment.source（BoardAnchor）→ resolveAnchor → FACT → constraints → relations。
//
//   解決は参照を返すだけで、盤の計算（干支・四課・三伝・十二長生・空亡・標識・生剋）はしない。返す FACT は複製しない。
//   意味は判断しない（ROLE の割り当て・DOMAIN・吉凶は持たない）。InterpretationContext には依存せず、
//   同じ盤・同じ anchor なら常に同じ FACT を返す。
//
//   anchor ごとの解決先（kind で区別する。1つの型にまとめない）:
//     dayStem   → 日干（Stem）と、その干上（standing）。日干と干上は別物で、日干には旬空・坐空を付けない
//     dayBranch → DayBranchState（Phase 3V）。制約は旬空だけが対象
//     lesson n  → FourLessonState（Phase 3U）の課全体（上神だけに置き換えない。上神は .upper で明示して使う）
//     position  → PositionActualizationState（Phase 3S）。制約と、元の状態（.source。Phase 3K・3L）の両方に届くため
//   lesson1 と standing、dayBranch と lesson3 は同じ支を含むが、別の anchor として解決する。

import type { Branch, Stem } from "../types";
import { standingPathActualizationFrom } from "./actualization";
import { dayBranchStateOf } from "./dayBranchState";
import { fourLessonsStateOf } from "./fourLessonsState";
import { relationBetween } from "./relations";
import { elementRelationOf, standingPathComparisonOf } from "./standingPathComparison";
import type { BoardAnchor } from "./roles";
import type {
  ActualizationConstraint, ComparisonPosition, DayBranchState, DayStemStandingState, ElementRelation, FourLessonState,
  FourLessonsState, InterpretationFacts, PositionActualizationState, RelationFact, StandingPathActualization, StandingPathComparison,
} from "./types";

/** 解決に使う生成済みの FACT（三伝未確定なら comparison・actualization は null） */
export interface AnchorResolutionContext {
  facts: InterpretationFacts;
  fourLessons: FourLessonsState;
  comparison: StandingPathComparison | null;
  actualization: StandingPathActualization | null;
  dayBranch: DayBranchState;
}

export interface DayStemAnchorResolution {
  kind: "dayStem";
  anchor: Extract<BoardAnchor, { kind: "dayStem" }>;
  stem: Stem;
  /** 日干の干上（一課上神）。日干そのものではない。三伝未確定なら null */
  standing: DayStemStandingState | null;
  /** 日干そのものに当てはめる制約はない */
  constraints: readonly ActualizationConstraint[];
}
export interface DayBranchAnchorResolution {
  kind: "dayBranch";
  anchor: Extract<BoardAnchor, { kind: "dayBranch" }>;
  source: DayBranchState;
  constraints: DayBranchState["constraints"];
}
export interface LessonAnchorResolution {
  kind: "lesson";
  anchor: Extract<BoardAnchor, { kind: "lesson" }>;
  source: FourLessonState;
  constraints: FourLessonState["constraints"];
}
export interface PathAnchorResolution {
  kind: "path";
  anchor: Extract<BoardAnchor, { kind: "position" }>;
  position: ComparisonPosition;
  source: PositionActualizationState;
  constraints: PositionActualizationState["constraints"];
}
export type AnchorResolution = DayStemAnchorResolution | DayBranchAnchorResolution | LessonAnchorResolution | PathAnchorResolution;

/** 生成済みの FACT をまとめる（既存の関数を呼ぶだけ。actualization は comparison から作り、参照をそろえる） */
export function anchorResolutionContextOf(facts: InterpretationFacts, monthBranch?: Branch | null): AnchorResolutionContext {
  const comparison = standingPathComparisonOf(facts, monthBranch);
  return {
    facts,
    fourLessons: fourLessonsStateOf(facts, monthBranch),
    comparison,
    actualization: comparison ? standingPathActualizationFrom(comparison) : null,
    dayBranch: dayBranchStateOf(facts, monthBranch),
  };
}

const NO_CONSTRAINTS: readonly ActualizationConstraint[] = [];

/** BoardAnchor → 生成済みの FACT。三伝未確定で位置（standing・三伝）を解決できないときは null */
export function resolveAnchor(anchor: BoardAnchor, ctx: AnchorResolutionContext): AnchorResolution | null {
  switch (anchor.kind) {
    case "dayStem":
      return { kind: "dayStem", anchor, stem: ctx.facts.basic.dayStem, standing: ctx.comparison?.standing ?? null, constraints: NO_CONSTRAINTS };
    case "dayBranch":
      return { kind: "dayBranch", anchor, source: ctx.dayBranch, constraints: ctx.dayBranch.constraints };
    case "lesson": {
      const source = ctx.fourLessons.lessons[anchor.index - 1];
      return { kind: "lesson", anchor, source, constraints: source.constraints };
    }
    case "position": {
      const source = ctx.actualization?.states.find((s) => s.position === anchor.position);
      if (!source) return null;
      return { kind: "path", anchor, position: anchor.position, source, constraints: source.constraints };
    }
  }
}

/** 関係を求めるときの anchor。四課は上神・下神のどちらを使うかを明示する（課全体を勝手に上神へ置き換えない） */
export type RelationAnchor =
  | Exclude<BoardAnchor, { kind: "lesson" }>
  | { kind: "lesson"; index: 1 | 2 | 3 | 4; part: "upper" | "lower" };

/** RelationAnchor が指す干または支（解決した FACT から読むだけ） */
function termOf(a: RelationAnchor, ctx: AnchorResolutionContext): Stem | Branch | null {
  switch (a.kind) {
    case "dayStem": return ctx.facts.basic.dayStem;
    case "dayBranch": return ctx.dayBranch.branch;
    case "lesson": {
      const l = ctx.fourLessons.lessons[a.index - 1];
      return a.part === "upper" ? l.upper.branch : l.lower;
    }
    case "position": return ctx.actualization?.states.find((s) => s.position === a.position)?.branch ?? null;
  }
}

/** 2つの anchor の五行関係（既存の relationBetween を使う。向きは a → b）。解決できなければ null */
export function relationBetweenAnchors(
  a: RelationAnchor, b: RelationAnchor, ctx: AnchorResolutionContext,
): { from: Stem | Branch; to: Stem | Branch; relation: ElementRelation; structural: RelationFact } | null {
  const from = termOf(a, ctx);
  const to = termOf(b, ctx);
  if (from === null || to === null) return null;
  const structural = relationBetween(from, to);
  return { from, to, relation: elementRelationOf(structural), structural };
}
