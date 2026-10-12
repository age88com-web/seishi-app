// src/lib/ziwei/patterns/evaluate.ts
//
// 格局判定（基礎２ 本編33格）。docs/ziwei-basic-spec.md §23.4。入口: evaluatePatterns(chart)。
// 判定順: 成立条件 → 破格条件 → 最終状態。
//   conditionMatched false                         → not_applicable
//   conditionMatched null（判定できない）           → needs_review
//   conditionMatched true かつ破格が broken         → not_applicable（破格。breakConditions に理由）
//   conditionMatched true かつ破格が undetermined   → needs_review
//   conditionMatched true かつ sourceStatus needs_review → needs_review（条件一致・要確認）
//   それ以外                                        → confirmed
// 「破格しやすい」は warningConditions に分け、状態を変えない。
// 複数の格局が成立してもすべて保持する（資料に優先順位の記載がないため順位を付けない）。

import type { Branch, ZiweiChart } from "../types";
import { viewOf } from "./chartView";
import { PATTERN_RULES } from "./data";
import sourceText from "./data/sourceText.json";
import { ALL_PATTERN_MEANING_TEXTS, resolvePatternMeaning } from "./meanings";
import type { ChartPatterns, PatternResult, PatternSourceRef, PatternStatus } from "./types";

interface SourceTextEntry {
  id: string;
  number: number;
  canonicalName: string;
  sourceName: string;
  aliases: { name: string; source: string }[];
  sourceRef: { source: string; slide: number; heading: string };
  /** 象意の条件についての注記（資料の原文は持たない） */
  meaningConditions: { note: string }[];
  /** 象意の文すべて（data/meanings.json の独自文章。条件・性別・スコープを問わない。§35・§36） */
  meaningText: string[];
}

/** 本編33格の出典・名称と、表示する象意（独自文章）。条件・象意の原文はアプリ用データに持たない（§35） */
export const PATTERN_SOURCE_TEXT = (sourceText.patterns as Omit<SourceTextEntry, "meaningText">[]).map((p) => {
  const m = ALL_PATTERN_MEANING_TEXTS[p.id];
  if (!m) throw new Error(`格局の象意（独自文章）がない: ${p.id}`);
  return { ...p, meaningText: m };
});

export interface ClassicalReferencePattern {
  id: string;
  category: string;
  sourceName: string;
  text: string;
  sourceRef: { source: string; slide: number; heading: string; note: string };
  relatedMainPattern: string | null;
  referenceOnly: true;
}
/** 全書52格（S34・S35）。referenceOnly。判定しない */
export const CLASSICAL_REFERENCE_PATTERNS = sourceText.classicalPatterns as ClassicalReferencePattern[];

/** 条件に一致した格局の象意（本命）。成立箇所が出せない格局は命宮を基準にする */
function meaningOf(id: string, v: ReturnType<typeof viewOf>, palaces: Branch[]) {
  const meaning = resolvePatternMeaning(id, v, palaces.length ? palaces : [v.mingBranch], "natal");
  return { meaning, meanings: [...meaning.base, ...meaning.conditional] };
}

export function evaluatePatterns(chart: ZiweiChart): ChartPatterns {
  const v = viewOf(chart);
  const patterns = PATTERN_SOURCE_TEXT.map((src): PatternResult => {
    const rule = PATTERN_RULES.find((r) => r.id === src.id);
    if (!rule) throw new Error(`格局の判定条件がない: ${src.id}`);
    const o = rule.evaluate(v);
    const breaks = o.breaks ?? [];
    const warnings = o.warnings ?? [];
    // 補足は成立した格局だけに付ける（成立条件・状態には使わない）
    const enhancements = o.matched === true ? (o.enhancements ?? []) : [];
    const sourceStatus = rule.sourceIssues.some((i) => i.blocking) ? "needs_review" : "verified";
    let status: PatternStatus;
    if (o.matched === false) status = "not_applicable";
    else if (o.matched === null) status = "needs_review";
    else if (breaks.some((b) => b.result === "broken")) status = "not_applicable";
    else if (breaks.some((b) => b.result === "undetermined") || sourceStatus === "needs_review") status = "needs_review";
    else status = "confirmed";
    const refs: PatternSourceRef[] = [{ source: "紫微斗数基礎２", page: `S${src.sourceRef.slide}`, heading: src.sourceRef.heading }];
    return {
      id: src.id,
      number: src.number,
      name: src.canonicalName,
      sourceName: src.sourceName,
      aliases: src.aliases,
      conditionMatched: o.matched,
      status,
      sourceStatus,
      matchedPalaces: o.palaces.map((b) => ({ branch: b, palace: v.palaceAt(b).name })),
      affectedPalaces: (o.affected ?? []).map((a) => ({ branch: a.branch, palace: v.palaceAt(a.branch).name, from: a.from, note: a.note })),
      reasons: o.matched ? o.checks.filter((c) => c.result === true).map((c) => `${c.text}: ${c.detail}`) : [],
      checks: o.checks,
      breakConditions: breaks,
      warningConditions: warnings,
      enhancementConditions: enhancements,
      sourceIssues: rule.sourceIssues,
      ...meaningOf(src.id, v, o.matched === true ? o.palaces : []),
      meaningConditions: src.meaningConditions,
      sourceRefs: refs,
    };
  });
  return {
    patterns,
    confirmed: patterns.filter((p) => p.status === "confirmed"),
    matchedNeedsReview: patterns.filter((p) => p.status === "needs_review" && p.conditionMatched === true),
    undetermined: patterns.filter((p) => p.conditionMatched === null),
    notes: [
      "対象は基礎２ 本編33格（S2〜S33）。全書52格（S34・S35）は referenceOnly で判定しない。",
      "吉星＝入門 p.15 の吉星、煞星＝入門 p.15 の凶星。三方四正・加会＝三合2宮＋対宮。廟旺＝廟・旺、落陥＝不得地・陥。",
      "複数の格局が成立してもすべて保持する（資料に優先順位の記載なし）。",
    ],
  };
}

/** 注意: 「破格しやすい」（warning）と、破格を判定できない条件。象意とは分ける */
export function patternCautions(p: PatternResult): string[] {
  return [
    ...p.warningConditions.filter((w) => w.result === "applies").map((w) => `${w.text}（${w.detail}）`),
    ...p.breakConditions.filter((b) => b.result === "undetermined").map((b) => `破格の条件を判定できません: ${b.text}（${b.detail}）`),
  ];
}
