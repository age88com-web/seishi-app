// src/lib/qimenAiMaterials/synthesisInput.ts
//
// 役割:
//   確定資料（ConfirmedMaterials）から、AI 統合解説に渡す最小限の入力を作る。
//   既定（AI へ渡す形）で渡すもの: 盤の事実のうち宮番号・八卦、成立済み材料（section2〜4）の全件、
//   分類未確定資料の全件。
//   既定で渡さないもの: 単体象意（確定資料には残る）、宮番号・八卦以外の盤の事実、viewPath・basis などの
//   プログラム側情報、年月日時の干支・旬首・値符・値使。
//   includeSingleMeanings: true のときだけ、単体象意と盤の事実（section1 の全項目）を含める
//   （AI には渡さない。検証器の単体象意に関する検査を確かめる用途）。
//   原文は表示用（display）を渡す（AI が「」で引用する文字列と、検証で照合する文字列を一致させる）。

import type { ConfirmedHeader, ConfirmedItem, ConfirmedMaterials } from "./confirmedMaterials";

export const SYNTHESIS_SECTION_LABELS = {
  section2: "成立している吉方向の材料",
  section3: "成立している注意材料",
  section4: "吉凶表記のない、または吉凶が混在する成立材料",
  unclassified: "分類未確定資料",
} as const;

export type SynthesisSectionKey = keyof typeof SYNTHESIS_SECTION_LABELS;

/** AI へ渡す盤の事実の項目名（既定）。 */
export const SYNTHESIS_FACT_LABELS = ["宮番号", "八卦"] as const;

export interface SynthesisInputOptions {
  /** 単体象意と section1 の盤の事実を全て含める（既定 false = AI へ渡す形） */
  includeSingleMeanings?: boolean;
}

export interface SynthesisSingle {
  id: string;
  element: string;
  role: string;
  kind: string;
  fortuneLabel: string | null;
  /** 見出しごとに、元データの配列の要素を1項目ずつ持つ */
  lines: { label: string; values: string[] }[];
}

export interface SynthesisEstablished {
  id: string;
  section: SynthesisSectionKey;
  sectionLabel: string;
  header: ConfirmedHeader;
  sourceText: { label: string; text: string }[];
}

export interface QimenSynthesisInput {
  schemaVersion: 1;
  palaceNumber: number;
  /** 項目名と値（九星が2つある宮のように同じ項目名が複数あり得るため配列で持つ） */
  facts: { label: string; value: string | number | boolean }[];
  singleMeanings: SynthesisSingle[];
  established: SynthesisEstablished[];
}

function established(section: SynthesisSectionKey, items: ConfirmedItem[]): SynthesisEstablished[] {
  return items.map((it) => ({
    id: it.id,
    section,
    sectionLabel: SYNTHESIS_SECTION_LABELS[section],
    header: it.header,
    sourceText: it.sourceText.map((s) => ({ label: s.label, text: s.display })),
  }));
}

/** 確定資料から AI 統合解説用の最小入力を作る。確定資料は変更しない。 */
export function buildSynthesisInput(c: ConfirmedMaterials, options: SynthesisInputOptions = {}): QimenSynthesisInput {
  const withSingles = options.includeSingleMeanings === true;
  return {
    schemaVersion: 1,
    palaceNumber: c.palaceNumber,
    facts: c.section1.facts
      .filter((f) => withSingles || (SYNTHESIS_FACT_LABELS as readonly string[]).includes(f.label))
      .map((f) => ({ label: f.label, value: f.value })),
    singleMeanings: withSingles
      ? c.section1.singleMeanings.map((s) => ({
          id: s.id, element: s.element, role: s.role, kind: s.kind, fortuneLabel: s.fortuneLabel, lines: s.lines,
        }))
      : [],
    established: [
      ...established("section2", c.section2.items),
      ...established("section3", c.section3.items),
      ...established("section4", c.section4.items),
      ...established("unclassified", c.unclassified.items),
    ],
  };
}

/** 引用必須の ID（成立済み材料と分類未確定資料の全件）。 */
export function requiredSynthesisIds(input: QimenSynthesisInput): string[] {
  return input.established.map((e) => e.id);
}

/** 引用してよいが必須ではない ID（単体象意）。 */
export function optionalSynthesisIds(input: QimenSynthesisInput): string[] {
  return input.singleMeanings.map((s) => s.id);
}
