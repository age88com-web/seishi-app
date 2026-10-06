// src/lib/shichusuimei/kakkyoku/types.ts
//
// 強弱・格局判定（補助判定）の型。
// 正本: docs/shichusuimei-kakkyoku-spec.md（§11・§17・§19・§22・§25）
// 最終判断は常に術者（finalJudgment: "requires_practitioner_judgment"）。

import type { Branch, Element, Pillar, PillarKey, Stem } from "../types";

export type Pillars = { 時: Pillar | null; 日: Pillar; 月: Pillar; 年: Pillar };

export type Tristate = "yes" | "no" | "undetermined";

// ---------------------------------------------------------------------------
// 強弱（§9・§13・§17・§22）
// ---------------------------------------------------------------------------

export interface SantokuItem {
  value: Tristate;
  /** 三得の割合（得令50・得勢30・得地20）。強さの点数ではない */
  indexPercent: 50 | 30 | 20;
  evidence: string[];
  undeterminedReason?: string;
}

/** 「弱（得地のみ）」は三得が得地だけ（20%）の弱側（KD15。旧「未分類」） */
export type StrengthClass = "過強" | "中強" | "境界" | "中弱" | "弱（得地のみ）" | "過弱";
export type StrengthLeaning = "身強寄り" | "身弱寄り" | "要術者判断";

export interface ForceRange {
  min: number;
  max: number;
}

export interface PercentRange {
  minPercent: number;
  maxPercent: number;
}

/** 強弱用の力量バランス（KD1）。内格の点数とは別体系 */
export interface ForceBalance {
  weights: { stem: 1; yearDayHourBranch: ForceRange; monthBranch: 6 };
  byElement: Record<Element, ForceRange>;
  breakdown: { position: string; element: Element; force: ForceRange }[];
}

export type ToutaLevel = "touta" | "notTouta" | "borderline";

/** 党多（KD10） */
export interface ToutaAssessment {
  target: { label: string; elements: Element[] };
  share: PercentRange;
  others: { element: Element; share: PercentRange }[];
  level: ToutaLevel;
}

export interface StrengthAssessment {
  dayMaster: { stem: Stem; element: Element };
  tokurei: SantokuItem;
  tokusei: SantokuItem;
  tokuchi: SantokuItem;
  indexPercent: number | null;
  indexRange: [number, number];
  classification: StrengthClass | null;
  classificationCandidates: StrengthClass[];
  leaning: StrengthLeaning;
  /** 日干の比劫＋印の党多（得勢の根拠） */
  touta: ToutaAssessment;
  forceBalance: ForceBalance;
  /** 日干五行の透干・通根の区分（三p34） */
  rootStrength: "最強" | "強" | "弱" | "なし";
  strengtheningFactors: string[];
  weakeningFactors: string[];
  reviewNotes: string[];
}

// ---------------------------------------------------------------------------
// 干合・化格（KD2・KD4）
// ---------------------------------------------------------------------------

/**
 * 干合の分類（KD23）。どれも自動確定ではない（最終判断は術者）。
 *   none … 干合なし（化格対象外）
 *   hequ … 干合あり・月支条件不成立（合去。原局化格候補外）
 *   hehuaCandidate … 干合あり・月支条件成立（化格候補）
 *   hehuaCandidateSupported … 月支条件成立＋補強あり（化格候補・補強あり）
 */
export type StemCombination = "none" | "hequ" | "hehuaCandidate" | "hehuaCandidateSupported";

export interface NatalHehua {
  position: "日干-月干" | "日干-時干";
  stems: [Stem, Stem] | null;
  stemCombination: StemCombination;
  transformElement: Element | null;
  monthBranch: Branch;
  monthMainElement: Element;
  /** 化す五行の月支条件（KD23）。干合なしは null */
  requiredMonthBranches: readonly Branch[] | null;
  /** 月支条件の成否。干合なしは null */
  monthCondition: boolean | null;
  /** 原局内の補強（化す五行と比和する天干・地支だけ。干合の2干と月支は数えない）。1件以上で hehuaCandidateSupported */
  supports: string[];
  /** 参考情報（化す五行を生じる五行・比劫＋印の党多）。補強の判定には使わない */
  references: string[];
  /** 月支の地支関係（三合・三会・半合・半会・六合・冲を全件。事実のみ。化の維持・解消は判定しない） */
  monthRelations: string[];
  /** 行運補強（あり／なし）。原局の月支条件・補強とは別。未実装のため常に null */
  luckSupport: boolean | null;
}

// ---------------------------------------------------------------------------
// 外格・特殊格局（§14・§15・KD9・KD11）
// ---------------------------------------------------------------------------

/**
 * confirmed_by_engine … エンジンの機械判定で成立。術者の確定ではない（KD19）。現在これを返す格はない（化格は KD23 で candidate）
 */
export type CandidateStatus = "confirmed_by_engine" | "candidate" | "provisional" | "needs_review" | "not_applicable";

export interface KakkyokuCandidate {
  name: string;
  /** 一行得気格の曲直格など、下位名称（資料の規則で機械的に決まるもの） */
  subName: string | null;
  status: CandidateStatus;
  basis: string[];
  notes: string[];
  /** 画面に出すか（成立可能性のない格は false。内部には保持） */
  uiVisible: boolean;
}

export type Route = "gaikakuCandidate" | "naikaku";

// ---------------------------------------------------------------------------
// 内格点数（KD12・KD13）
// ---------------------------------------------------------------------------

export interface BranchState {
  pillar: PillarKey;
  branch: Branch;
  relations: string[];
  transformedTo: Element | null;
  decay: number;
  notes: string[];
}

/** 内格補助の判定（比劫＋印 対 食傷＋財＋官。KD17） */
export type InnerJudgment = "身強" | "身弱" | "境界";

export interface InnerPatternScore {
  system: "inner-pattern-scoring";
  /** 比劫＋印 と 食傷＋財＋官 の比較（日干単独点ではない） */
  judgment: InnerJudgment;
  /** 日主側を助ける比劫・印の配置（短い根拠） */
  helps: string[];
  dayMaster: { stem: Stem; points: number };
  supportingSide: { elements: Element[]; points: number };
  weakeningSide: { elements: Element[]; points: number };
  byElement: Record<Element, number>;
  byStem: { pillar: PillarKey; stem: Stem; total: number; fromBranches: number; adjacent: number }[];
  branchStates: BranchState[];
  assumptions: string[];
  referenceOnly: boolean;
}

export interface KakkyokuResult {
  referenceOnly: boolean;
  strength: StrengthAssessment;
  hehua: NatalHehua[];
  candidates: KakkyokuCandidate[];
  route: Route;
  /** エンジン判定の要約（外格候補がなければ内格。外格候補が並ぶときは null で candidates を参照。1つを自動選択しない） */
  enginePattern: { name: string; status: CandidateStatus } | null;
  /** 内格補助点（KD19: 外格・化格の機械判定にかかわらず常に計算する） */
  innerScore: InnerPatternScore;
  /** 内格補助の位置づけ: 内格の経路／外格・特殊格局候補あり（内格補助点は参考） */
  innerScoreScope: "naikaku" | "withGaikakuCandidates";
  finalJudgment: "requires_practitioner_judgment";
}
