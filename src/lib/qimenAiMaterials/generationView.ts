// src/lib/qimenAiMaterials/generationView.ts
//
// 役割:
//   完全版の AI 入力データ（QimenAiInput）から、文章生成 AI に見せてよい材料だけを
//   固定規則で選び出したビューを作る。完全版は監査・追跡用としてそのまま残し、変更しない。
//   ID は完全版と同じものを使い、番号を振り直さない。本文は完全版の値をそのまま使う
//   （要約・短縮・言い換え・吉凶の変更をしない。単体象意・剋應・格局を1つの吉凶にまとめない）。
//
// 含めるもの:
//   chartFacts / singleMeanings / kokuo / palaceKaku / wholeChartKaku / fuYinFanYin（linked のみ。
//   完全版の fuYinFanYin は linked だけを持つ）
// 含めないもの（完全版には残る）:
//   excluded（gate_notes・unlinked の伏吟反吟・取得しなかった項目）、referenceTables（旺衰表）、
//   unknownScopeKaku（scope を既存判定から決められない格）、rubyLinesRemoved、notes、
//   details（本文から抽出した付属項目）、出典情報（source・sources・materialPath・origin・
//   sourceTradition・単体象意の sourcePage）
//
// 格局の象意:
//   判定コードの象意文（judgeMeaning）と象意DB（meaningDb）は、64格中16格で表記や文の有無が
//   異なる（例: 五不遇時は象意DB側だけに2文多い）。どちらかを選ぶと判断が入るため両方渡す。
//
// 追跡:
//   ビューの各項目の id で完全版の同じ id の項目を引けば、source・materialPath を辿れる
//   （findQimenAiItem）。

import type { QimenAiInput } from "./types";

export interface GenerationFact {
  id: string;
  label: string;
  value: string | number | boolean;
}

export interface GenerationSingleMeaning {
  id: string;
  role: string;
  element: string;
  kind: string;
  /** 完全版の content から sourcePage だけを除いたもの（他の値はそのまま） */
  content: unknown;
}

export interface GenerationKokuo {
  id: string;
  kokuoType: string;
  key: Record<string, string>;
  name: string | null;
  mode: "静應" | "動應" | null;
  fortuneRaw: string | null;
  /** 完全版の body（ルビ行除去済み）そのまま */
  body: string;
}

export interface GenerationKaku {
  id: string;
  category: "吉格" | "凶格";
  name: string;
  scope: "palace" | "whole_chart";
  palaces: number[];
  detail: string | null;
  judgeMeaning: string;
  meaningDb: string[] | null;
}

export interface GenerationFuYinFanYin {
  id: string;
  kind: "伏吟" | "反吟";
  judgeName: string;
  judgeDetail: string;
  linkedSubtypes: { name: string; description: string[] }[];
  fortuneHeading: string;
  fortuneText: string[];
}

export interface QimenGenerationView {
  schemaVersion: 1;
  palaceNumber: number;
  chartFacts: GenerationFact[];
  singleMeanings: GenerationSingleMeaning[];
  kokuo: GenerationKokuo[];
  palaceKaku: GenerationKaku[];
  wholeChartKaku: GenerationKaku[];
  fuYinFanYin: GenerationFuYinFanYin[];
}

/** 単体象意の content から出典ページ（sourcePage）だけを除く。 */
function withoutSourcePage(content: unknown): unknown {
  if (content === null || typeof content !== "object" || Array.isArray(content)) return content;
  const rest: Record<string, unknown> = { ...(content as Record<string, unknown>) };
  delete rest.sourcePage;
  return rest;
}

function kakuView(k: QimenAiInput["palaceKaku"][number], scope: "palace" | "whole_chart"): GenerationKaku {
  return {
    id: k.id,
    category: k.category,
    name: k.name,
    scope,
    palaces: k.palaces,
    detail: k.detail,
    judgeMeaning: k.judgeMeaning,
    meaningDb: k.meaningDb,
  };
}

/** 完全版の AI 入力データから文章生成用ビューを作る。完全版は変更しない。 */
export function buildQimenGenerationView(full: QimenAiInput): QimenGenerationView {
  return {
    schemaVersion: 1,
    palaceNumber: full.palaceNumber,
    chartFacts: full.chartFacts.map((f) => ({ id: f.id, label: f.label, value: f.value })),
    singleMeanings: full.singleMeanings.map((s) => ({
      id: s.id,
      role: s.role,
      element: s.element,
      kind: s.kind,
      content: withoutSourcePage(s.content),
    })),
    kokuo: full.kokuo.map((k) => ({
      id: k.id,
      kokuoType: k.kokuoType,
      key: k.key,
      name: k.name,
      mode: k.mode,
      fortuneRaw: k.fortuneRaw,
      body: k.body,
    })),
    palaceKaku: full.palaceKaku.map((k) => kakuView(k, "palace")),
    wholeChartKaku: full.wholeChartKaku.map((k) => kakuView(k, "whole_chart")),
    fuYinFanYin: full.fuYinFanYin.map((f) => ({
      id: f.id,
      kind: f.kind,
      judgeName: f.judgeName,
      judgeDetail: f.judgeDetail,
      linkedSubtypes: f.linkedSubtypes,
      fortuneHeading: f.fortuneHeading,
      fortuneText: f.fortuneText,
    })),
  };
}

type FullItem =
  | QimenAiInput["chartFacts"][number]
  | QimenAiInput["singleMeanings"][number]
  | QimenAiInput["kokuo"][number]
  | QimenAiInput["palaceKaku"][number]
  | QimenAiInput["fuYinFanYin"][number]
  | QimenAiInput["referenceTables"][number]
  | QimenAiInput["excluded"][number];

/** ID から完全版の項目（source・materialPath を含む）を引く。見つからなければ undefined。 */
export function findQimenAiItem(full: QimenAiInput, id: string): FullItem | undefined {
  const lists: FullItem[][] = [
    full.chartFacts, full.singleMeanings, full.kokuo, full.palaceKaku, full.wholeChartKaku,
    full.unknownScopeKaku, full.fuYinFanYin, full.referenceTables, full.excluded,
  ];
  for (const list of lists) {
    const hit = list.find((x) => x.id === id);
    if (hit) return hit;
  }
  return undefined;
}
