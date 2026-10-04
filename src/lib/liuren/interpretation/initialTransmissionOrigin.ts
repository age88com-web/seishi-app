// src/lib/liuren/interpretation/initialTransmissionOrigin.ts
//
// 役割（Phase 3Z）:
//   起課エンジンが初伝を決めた地点で記録した発用元（sanchuan.initialOrigin）を、解釈層から参照する。
//   値は起課結果をそのまま返すだけで、四課と初伝の支の一致から復元・推測はしない。
//   BoardAnchor（Phase 3T）への変換:
//     uniqueLesson・ruleLesson → その課の anchor 1つ
//     ambiguousLessons         → 候補の課の anchor をすべて（どれかに決めない）
//     derived                  → 四課の anchor を持たない（空）
//   発用元の課と初伝は、支が同じでも別の anchor のまま（初伝は { kind: "position", position: "initial" }）。

import type { InitialTransmissionOrigin } from "../types";
import type { BoardAnchor } from "./roles";
import type { InterpretationFacts } from "./types";

/** 起課結果の発用元（三伝未確定なら null） */
export function initialOriginOf(facts: InterpretationFacts): InitialTransmissionOrigin | null {
  return facts.sanchuan.status === "determined" ? facts.sanchuan.initialOrigin : null;
}

/** 発用元の課の anchor（ambiguousLessons は候補をすべて、derived は空） */
export function originLessonAnchors(origin: InitialTransmissionOrigin): BoardAnchor[] {
  switch (origin.kind) {
    case "uniqueLesson":
    case "ruleLesson":
      return [{ kind: "lesson", index: origin.lesson }];
    case "ambiguousLessons":
      return origin.lessons.map((index) => ({ kind: "lesson", index }));
    case "derived":
      return [];
  }
}
