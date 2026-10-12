// src/lib/qimenAiMaterials/judgmentDisplay.ts
//
// 役割:
//   AI を使わず、既存の確定データだけから「成立している判断材料」の表示用構造を組み立てる。
//   鑑定の確定部分であり、要約・分類のやり直し・言い換え・判断は一切しない。
//   AI の統合解説とは完全に独立しており、AI の成否はこの構造に影響しない。
//
// 入力（読むだけ。どれも変更しない）:
//   plan       … QimenGenerationPlan（区分と、伏吟反吟の資料の対応格局 basis）
//   confirmed  … ConfirmedMaterials（確定情報と原文。buildConfirmedMaterials(plan) の結果）
//   full       … QimenAiInput（完全版。出典情報を ID で引くために使う）
//
// 振り分け（既存の値だけで決める。名称や本文は読まない）:
//   favorable          吉となる材料            … section2 の材料
//   cautionPalace      注意する材料（この宮）  … section3 のうち kind が palaceKaku（scope「この宮」）または kokuo
//   cautionWholeChart  注意する材料（盤全体）  … section3 のうち kind が wholeChartKaku（scope「盤全体」）
//   unclassifiedKokuo  吉凶を分類していない剋應 … section4 の材料（Plan の設計上、剋應だけ）
//   関連資料           … kind が fuYinFanYin の資料は、確定情報の linkedKaku.id が指す格局の子（related）に置く。
//                         linkedKaku が無い資料（Plan の unclassified）や、指す格局がこの構造に無い資料は、
//                         推測でつながず unlinked に理由付きで残す。
//
// 剋應を「この宮」に置く根拠:
//   剋應の確定情報に scope 欄は無いが、剋應はその宮の天盤干・地盤干・八門・八卦名と、値符星がその宮に
//   あるときの時支から、宮ごとに検索された結果（qimen/kokuo の resolveKokuoForPalace）である。
//   その根拠を placementBasis に記録する。
//
// Plan の設計上起こらない組み合わせ（section4 に剋應以外、区分に想定外の kind など）が来た場合は、
// 黙って振り分けずに例外を投げる。

import { findQimenAiItem } from "./generationView";
import type { MaterialSource } from "@/lib/qimenMaterials";
import type {
  ConfirmedItem,
  ConfirmedKakuMeaning,
  ConfirmedMaterials,
  ConfirmedSourceText,
} from "./confirmedMaterials";
import type { KokuoFortuneClass } from "./fortuneClass";
import type { QimenGenerationPlan } from "./generationPlan";
import type { QimenAiInput } from "./types";

export const JUDGMENT_GROUP_TITLES = {
  favorable: "吉となる材料",
  cautionPalace: "注意する材料（この宮）",
  cautionWholeChart: "注意する材料（盤全体）",
  unclassifiedKokuo: "吉凶を分類していない剋應",
} as const;

export type JudgmentGroupKey = keyof typeof JUDGMENT_GROUP_TITLES;

/** 振り分けの根拠（どの既存の値で決めたか）。 */
export type JudgmentPlacementBasis =
  | "section2"
  | "section3・palaceKaku（scope: この宮）"
  | "section3・kokuo（宮ごとの剋應検索の結果）"
  | "section3・wholeChartKaku（scope: 盤全体）"
  | "section4"
  | "linkedKaku（関連資料）";

export interface JudgmentItem {
  /** 内部 ID（利用者向けには出さない。追跡・検証用） */
  id: string;
  kind: ConfirmedItem["kind"];
  /** Plan 上の区分 */
  section: "section2" | "section3" | "section4" | "unclassified";
  /** 表示用の見出し（name。name が無い剋應は combination と mode を並べたもの。既存の値だけで作る） */
  label: string;
  type: string;
  name: string | null;
  /** 剋應の吉凶表記（null は「吉凶表記なし」）／格局は吉格・凶格 */
  fortune: string | null;
  /** 区分から決まる吉凶分類（section2=favorable／section3=caution／section4=unclassified。unclassified の資料は null） */
  fortuneClass: KokuoFortuneClass | null;
  scope: "この宮" | "盤全体" | null;
  detail: string | null;
  mode: "静應" | "動應" | null;
  combination: string | null;
  /** 伏吟反吟の資料のみ: 判定側の内訳 */
  judgeDetail: string | null;
  linkedKaku: { id: string; name: string; category: "吉格" | "凶格" } | null;
  /** 確定資料の原文（raw と表示用 display。そのまま） */
  sourceText: ConfirmedSourceText[];
  /** 格局のみ: 2つの象意の扱い（確定資料のまま） */
  kakuMeaning: ConfirmedKakuMeaning | null;
  /** 出典（完全版の AI 入力から ID で引いたもの） */
  sources: MaterialSource[];
  placementBasis: JudgmentPlacementBasis;
  /** この材料に linkedKaku で結び付いた関連資料 */
  related: JudgmentItem[];
}

export interface JudgmentGroup {
  title: string;
  items: JudgmentItem[];
}

export interface QimenJudgmentDisplay {
  schemaVersion: 1;
  palaceNumber: number;
  groups: Record<JudgmentGroupKey, JudgmentGroup>;
  /** 関連資料の親子関係の一覧（追跡用） */
  relations: { parentId: string; childId: string; basis: "linkedKaku" }[];
  /** どこにもつながなかった関連資料と理由 */
  unlinked: { item: JudgmentItem; reason: string }[];
}

const SECTION_CLASS: Record<JudgmentItem["section"], KokuoFortuneClass | null> = {
  section2: "favorable",
  section3: "caution",
  section4: "unclassified",
  unclassified: null,
};

function sourcesOf(full: QimenAiInput, id: string): MaterialSource[] {
  const hit = findQimenAiItem(full, id) as { source?: MaterialSource | null; sources?: MaterialSource[] } | undefined;
  if (!hit) throw new Error(`完全版の AI 入力に ID がありません: ${id}`);
  if (Array.isArray(hit.sources)) return hit.sources;
  return hit.source ? [hit.source] : [];
}

function toItem(
  c: ConfirmedItem,
  section: JudgmentItem["section"],
  placementBasis: JudgmentPlacementBasis,
  full: QimenAiInput,
): JudgmentItem {
  const h = c.header;
  const fortune = c.kind === "kokuo" ? h.fortune ?? null : h.category ?? null;
  const label = h.name ?? [h.combination, h.mode].filter((x): x is string => !!x).join("　");
  return {
    id: c.id,
    kind: c.kind,
    section,
    label: label || h.type,
    type: h.type,
    name: h.name,
    fortune,
    fortuneClass: SECTION_CLASS[section],
    scope: h.scope ?? null,
    detail: h.detail ?? null,
    mode: h.mode ?? null,
    combination: h.combination ?? null,
    judgeDetail: h.judgeDetail ?? null,
    linkedKaku: h.linkedKaku ?? null,
    sourceText: c.sourceText,
    kakuMeaning: c.kakuMeaning ?? null,
    sources: sourcesOf(full, c.id),
    placementBasis,
    related: [],
  };
}

/** 既存の確定データだけから、成立している判断材料の表示用構造を作る。入力は変更しない。 */
export function buildJudgmentDisplay(input: {
  plan: QimenGenerationPlan;
  confirmed: ConfirmedMaterials;
  full: QimenAiInput;
}): QimenJudgmentDisplay {
  const { plan, confirmed, full } = input;
  const groups: Record<JudgmentGroupKey, JudgmentGroup> = {
    favorable: { title: JUDGMENT_GROUP_TITLES.favorable, items: [] },
    cautionPalace: { title: JUDGMENT_GROUP_TITLES.cautionPalace, items: [] },
    cautionWholeChart: { title: JUDGMENT_GROUP_TITLES.cautionWholeChart, items: [] },
    unclassifiedKokuo: { title: JUDGMENT_GROUP_TITLES.unclassifiedKokuo, items: [] },
  };
  const relatedCandidates: JudgmentItem[] = [];
  const unlinked: QimenJudgmentDisplay["unlinked"] = [];

  // Plan と確定資料の区分が一致していることを前提とする（食い違えば例外）。
  const sections = ["section2", "section3", "section4"] as const;
  for (const s of sections) {
    const planIds = plan[s].items.map((p) => p.item.id);
    const confIds = confirmed[s].items.map((c) => c.id);
    if (planIds.join(",") !== confIds.join(",")) throw new Error(`Plan と確定資料の ${s} が一致しません`);
  }

  for (const c of confirmed.section2.items) {
    if (c.kind === "fuYinFanYin") relatedCandidates.push(toItem(c, "section2", "linkedKaku（関連資料）", full));
    else groups.favorable.items.push(toItem(c, "section2", "section2", full));
  }
  for (const c of confirmed.section3.items) {
    if (c.kind === "fuYinFanYin") relatedCandidates.push(toItem(c, "section3", "linkedKaku（関連資料）", full));
    else if (c.kind === "palaceKaku") groups.cautionPalace.items.push(toItem(c, "section3", "section3・palaceKaku（scope: この宮）", full));
    else if (c.kind === "kokuo") groups.cautionPalace.items.push(toItem(c, "section3", "section3・kokuo（宮ごとの剋應検索の結果）", full));
    else if (c.kind === "wholeChartKaku") groups.cautionWholeChart.items.push(toItem(c, "section3", "section3・wholeChartKaku（scope: 盤全体）", full));
    else throw new Error(`section3 に想定外の種類があります: ${c.id}`);
  }
  for (const c of confirmed.section4.items) {
    if (c.kind !== "kokuo") throw new Error(`section4 に剋應以外の材料があります: ${c.id}`);
    groups.unclassifiedKokuo.items.push(toItem(c, "section4", "section4", full));
  }
  for (const c of confirmed.unclassified.items) {
    const item = toItem(c, "unclassified", "linkedKaku（関連資料）", full);
    unlinked.push({
      item,
      reason: c.header.unclassifiedReason ?? "Plan で対応格局が確定しなかった資料のため、推測でつながない。",
    });
  }

  // 関連資料を linkedKaku.id の親へ付ける
  const parents = new Map<string, JudgmentItem>();
  for (const g of Object.values(groups)) for (const it of g.items) parents.set(it.id, it);
  const relations: QimenJudgmentDisplay["relations"] = [];
  for (const child of relatedCandidates) {
    const parent = child.linkedKaku ? parents.get(child.linkedKaku.id) : undefined;
    if (!child.linkedKaku) {
      unlinked.push({ item: child, reason: "linkedKaku が無いため、推測でつながない。" });
    } else if (!parent) {
      unlinked.push({ item: child, reason: `linkedKaku が指す格局（${child.linkedKaku.id}）がこの構造に無いため、推測でつながない。` });
    } else {
      parent.related.push(child);
      relations.push({ parentId: parent.id, childId: child.id, basis: "linkedKaku" });
    }
  }

  return { schemaVersion: 1, palaceNumber: confirmed.palaceNumber, groups, relations, unlinked };
}
