// src/lib/liuren/interpretation/domainResult.ts
//
// 役割（Phase 5A）:
//   DOMAIN 判断の共通の型と、ルールの評価・まとめ（他の DOMAIN にも使う部分）。
//     DomainRule … when（domain・subtype）／conditions（FACT・IDENTITY・三伝の流れから何を検出したか）／
//                  reading（どの軸の、どんな読みか・推論レベル・出典）／assess（subtype・goal に対する向き）を分ける
//     DomainReading … 1つの判断単位（検出したこと・根拠の FACT・読み・向き・推論レベル・出典）
//     DomainResult  … 読みを軸ごとに並べ、追い風と妨げを両方残し、不足 FACT と短い要約を持つ
//   点数は持たない（根拠の組合せを残す）。読み（何を示すか）と向き（今回の問いにとって追い風か妨げか）は別の項目。

import type { DomainSubtype, InterpretationDomain, InterpretationGoal } from "./roles";

/** 判断の軸 */
export type DomainAxis = "opportunity" | "support" | "obstruction" | "actualization" | "trajectory" | "timing";
/** 今回の問い（subtype・goal）にとっての向き */
export type DomainDirection = "favoring" | "hindering" | "neutral";
/** 資料の支持の強さ: 原文の判断そのもの／訳注や複数の FACT の組合せ／資料から一般化したもの */
export type DomainInferenceLevel = "direct" | "combined" | "inferred";

export interface DomainCitation {
  source: "『六壬断案２』" | "『六壬神課講座』";
  locator: string;
  layer: "原文" | "訳注" | "講座";
  quote: string;
}

/** 判断の根拠にした FACT（どの位置の、どの値か） */
export interface DomainEvidenceItem {
  fact: string;
  detail: string;
}

export interface DomainReading {
  ruleId: string;
  axis: DomainAxis;
  /** 読みの識別子（例: "officerInTransmissions"） */
  key: string;
  /** 読みの短い名前（例: "官星が三伝に出る"） */
  label: string;
  /** この盤で検出したこと（盤の値を含む文） */
  detected: string;
  evidence: readonly DomainEvidenceItem[];
  direction: DomainDirection;
  /** 向きの理由（subtype・goal による違いなど） */
  directionNote?: string;
  level: DomainInferenceLevel;
  citations: readonly DomainCitation[];
}

export interface DomainMissingFact {
  key: string;
  detail: string;
}

export interface DomainResult {
  domain: InterpretationDomain;
  subtype?: DomainSubtype;
  goal?: InterpretationGoal;
  readings: readonly DomainReading[];
  byAxis: Record<DomainAxis, readonly DomainReading[]>;
  overview: {
    /** 追い風の読み */
    favoring: readonly DomainReading[];
    /** 妨げの読み */
    hindering: readonly DomainReading[];
    /** 向きを決めない読み（参考） */
    neutral: readonly DomainReading[];
    /** 追い風と妨げが両方ある（どちらも消さない） */
    contradiction: boolean;
  };
  missing: readonly DomainMissingFact[];
  summary: string;
}

/** 宣言的なルール（conditions・assess は入力を読むだけの純粋関数） */
export interface DomainRule<I> {
  id: string;
  when: { domain: InterpretationDomain; subtypes?: readonly string[] };
  reading: { axis: DomainAxis; key: string; label: string; level: DomainInferenceLevel; citations: readonly DomainCitation[] };
  /** 検出したこと（なければ null） */
  conditions: (input: I) => { detected: string; evidence: readonly DomainEvidenceItem[] } | null;
  /** 今回の問いにとっての向き */
  assess: (input: I, subtype: string | undefined, goal: InterpretationGoal | undefined) => { direction: DomainDirection; note?: string };
}

const AXES: readonly DomainAxis[] = ["opportunity", "support", "obstruction", "actualization", "trajectory", "timing"];

/** ルールを評価して読みを並べる（when に合うルールだけ。ルールの順のまま） */
export function evaluateDomainRules<I>(
  rules: readonly DomainRule<I>[], input: I, domain: InterpretationDomain, subtype: string | undefined, goal: InterpretationGoal | undefined,
): DomainReading[] {
  const out: DomainReading[] = [];
  for (const rule of rules) {
    if (rule.when.domain !== domain) continue;
    if (rule.when.subtypes && !(subtype && rule.when.subtypes.includes(subtype))) continue;
    const hit = rule.conditions(input);
    if (!hit) continue;
    const a = rule.assess(input, subtype, goal);
    out.push({
      ruleId: rule.id, axis: rule.reading.axis, key: rule.reading.key, label: rule.reading.label,
      detected: hit.detected, evidence: hit.evidence, direction: a.direction, ...(a.note ? { directionNote: a.note } : {}),
      level: rule.reading.level, citations: rule.reading.citations,
    });
  }
  return out;
}

const AXIS_LABEL: Record<DomainAxis, string> = {
  opportunity: "機会", support: "後押し", obstruction: "妨げ", actualization: "実現性", trajectory: "流れ", timing: "時期",
};

/** 読みを軸ごとにまとめ、要約文を作る（盤の値を含む detected をそのまま使う） */
export function summarizeDomainReadings(
  domain: InterpretationDomain, subtype: DomainSubtype | undefined, goal: InterpretationGoal | undefined,
  readings: readonly DomainReading[], missing: readonly DomainMissingFact[], subject: string,
): DomainResult {
  const byAxis = Object.fromEntries(AXES.map((a) => [a, readings.filter((r) => r.axis === a)])) as Record<DomainAxis, DomainReading[]>;
  const favoring = readings.filter((r) => r.direction === "favoring");
  const hindering = readings.filter((r) => r.direction === "hindering");
  const neutral = readings.filter((r) => r.direction === "neutral");
  const lines: string[] = [];
  const join = (rs: readonly DomainReading[]) => rs.map((r) => r.detected).join("。");
  if (!readings.length) lines.push(`${subject}について、資料に根拠のある判断材料はこの盤では見つかりませんでした。`);
  for (const axis of AXES) {
    const fav = byAxis[axis].filter((r) => r.direction === "favoring");
    const hin = byAxis[axis].filter((r) => r.direction === "hindering");
    if (fav.length) lines.push(`${AXIS_LABEL[axis]}（追い風）: ${join(fav)}。`);
    if (hin.length) lines.push(`${axis === "obstruction" ? AXIS_LABEL[axis] : `${AXIS_LABEL[axis]}（妨げ）`}: ${join(hin)}。`);
  }
  if (favoring.length && hindering.length) {
    lines.push(`${subject}への追い風（${favoring.map((r) => r.label).join("・")}）と妨げ（${hindering.map((r) => r.label).join("・")}）が同時にあり、どちらか一方には決められない構造です。`);
  } else if (favoring.length) {
    lines.push(`${subject}への追い風（${favoring.map((r) => r.label).join("・")}）があり、資料に根拠のある妨げはこの盤では見つかりません。`);
  } else if (hindering.length) {
    lines.push(`${subject}を妨げる要素（${hindering.map((r) => r.label).join("・")}）があり、資料に根拠のある追い風はこの盤では見つかりません。`);
  }
  if (neutral.length) lines.push(`参考: ${neutral.map((r) => `${r.label}${r.directionNote ? `（${r.directionNote}）` : ""}`).join("・")}。`);
  if (missing.length) lines.push(`未確定: ${missing.map((m) => m.detail).join("・")}。`);
  return {
    domain, ...(subtype ? { subtype } : {}), ...(goal ? { goal } : {}),
    readings, byAxis, overview: { favoring, hindering, neutral, contradiction: favoring.length > 0 && hindering.length > 0 },
    missing, summary: lines.join("\n"),
  };
}
