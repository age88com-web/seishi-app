// src/lib/ziwei/meanings/types.ts
//
// 紫微斗数の象意データ（資料由来）の型。docs/ziwei-basic-spec.md §21・§35。
// データは scripts/ziwei/extract_meanings.py が資料（入門・基礎編）から抽出し、scripts/ziwei/build_meanings.py が
// 表示文を独自文章（資料の意味の範囲で書き直したもの）に差し替えて生成する。アプリ用データに資料の原文は持たない。
// 判定ロジックが原文から読み取っていた情報は、原文から計算した凍結メタデータ（TextMeta）として持つ。
// 作盤エンジンには接続しない。資料にない意味は持たない。

import type { Branch, PalaceName, PlacedStar, StarStrength, TransformationKind } from "../types";
import type { PalacePower } from "../power";
import type { PowerConditionEvaluation, PowerSnapshot } from "./powerCondition";

export type { PowerConditionEvaluation, PowerSnapshot };

export type MeaningSource = "紫微斗数入門" | "紫微斗数基礎編";

/** 34星（既存エンジンの星名） */
export type ZiweiStarName = PlacedStar | TransformationKind;

export interface SourceRef {
  source: MeaningSource;
  /** PDF のページ番号（基礎編はスライド番号 S と同じ） */
  pdfPage: number;
  /** 資料の印刷ページ（入門のページ下「‑ N ‑」）。基礎編は null */
  docPage: number | null;
  /** 見出し（分かる範囲） */
  section: string;
}

/** 資料から自然に分類できる場合だけ付けるタグ */
export type MeaningTag =
  | "personality" | "career" | "wealth" | "relationship" | "family" | "health"
  | "strength" | "weakness" | "caution" | "appearance";

/**
 * 原文から計算して固定した判定用の情報（build_meanings.py）。表示文を書き直しても判定・選別は変わらない。
 */
export interface TextMeta {
  /** 同じ資料・同じ原文のまとまりの代表 ID（重複整理・組み合わせとの対応・前後の文の位置） */
  textKey: string;
  /** 原文の書き出しが前の文を受ける接続語なら、その語 */
  opener: string | null;
  /** 原文が後の文へ続く（「、」「：」で終わる・後の文を予告する） */
  continuesToNext: boolean;
  /** 原文が名指ししている星 */
  mentionsStars: ZiweiStarName[];
  /** 原文が名指ししている宮 */
  mentionsPalaces: PalaceName[];
  /** 原文の文字数（空白を除く。解釈本文の文字数の目安に使う） */
  sourceLength: number;
}

export interface MeaningBase extends TextMeta {
  id: string;
  /** 表示する文（資料の意味の範囲で書き直した独自文章） */
  text: string;
  ref: SourceRef;
  tags?: MeaningTag[];
  /** 力量などの条件が文中にある場合（例: "命宮の力量"） */
  condition?: string;
  note?: string;
}

/**
 * 星の象意。category:
 *   image … 星のイメージ（擬人化） / basic … 基本的特質 / appearance … 容貌、態度
 *   career … 能力、職業特性 / combination … その他の星曜との配合 / luckPeriod … 大限・小限（流年）で巡ったときの意味
 */
export type StarMeaningCategory = "image" | "basic" | "appearance" | "career" | "combination" | "luckPeriod";

export interface StarMeaning extends MeaningBase {
  /** 資料の節の対象星（「文昌星・文曲星」のように2星まとめて書かれている節は2星） */
  stars: ZiweiStarName[];
  /** 命宮に入った場合の記述なら "命宮"。イメージ・大限小限は null */
  palace?: PalaceName | null;
  category: StarMeaningCategory;
}

/** 四化（化禄・化権・化科・化忌）の象意（入門「化曜星」は命宮に入った場合の意味） */
export type TransformationMeaning = StarMeaning;

export type PalaceMeaningCategory = "target" | "caution" | "strengthRule";

export interface PalaceMeaning extends MeaningBase {
  palace: PalaceName | "身宮";
  /** target … 何を見る宮か／caution … 判断時の注意／strengthRule … 宮の力量による一般的な見方 */
  category: PalaceMeaningCategory;
}

/** 資料に書かれている「星が○○宮に入ったとき」の意味（命宮は StarMeaning の palace: "命宮"） */
export interface StarPalaceMeaning extends MeaningBase {
  /** 資料の表で1つの枠を共有している星（例: 文昌星・文曲星） */
  stars: ZiweiStarName[];
  palace: PalaceName;
}

/** 資料に明記された星同士の組み合わせ（同宮・加会） */
export interface CombinationMeaning extends MeaningBase {
  /** 節の対象星 */
  subjectStars: ZiweiStarName[];
  /** 文中で組み合わされる星（複数列挙は note を参照） */
  withStars: ZiweiStarName[];
  stars: ZiweiStarName[];
  relation: "同宮" | "加会" | "同宮・加会";
  palace?: PalaceName | null;
}

export type ThemeName =
  | "三方四正" | "運命指数" | "旺衰" | "十二宮の見方" | "宮別判断の考え方" | "流年" | "命盤解読のポイント";

/** テーマ別の記述（画面に出さないので表示文を持たない。並び順・出典だけ） */
export interface ThemeMeaning extends Omit<MeaningBase, "text"> {
  theme: ThemeName;
  step?: string;
}

export type DifferenceStatus = "same" | "additional" | "wording_difference" | "needs_review";

export interface SourceDifference {
  topic: string;
  status: DifferenceStatus;
  entryIds: string[];
  refs?: string[];
  note: string | null;
}

export interface StarStatus {
  star: ZiweiStarName;
  meaningAvailable: boolean;
  counts: { stars: number; transformations: number; starPalace: number; combinations: number };
  sources: MeaningSource[];
}

export interface MeaningsMeta {
  sourceDifferences: SourceDifference[];
  starStatus: StarStatus[];
  extractionNotes: string[];
}

// ---------------------------------------------------------------------------
// 宮クリック時の象意コンテキスト（context.ts。docs/ziwei-basic-spec.md §21.9）
// ---------------------------------------------------------------------------

/** 資料差異（meta.json の sourceDifferences）の注記 */
export interface MeaningReview {
  status: DifferenceStatus;
  topic: string;
  note: string | null;
}

/** コンテキストに入れる象意1件。表示文・出典・凍結メタデータはデータのまま */
export interface ContextMeaning extends TextMeta {
  id: string;
  text: string;
  ref: SourceRef;
  category?: string;
  tags?: MeaningTag[];
  condition?: string;
  note?: string;
  /** この文が資料差異の対象なら、その区分（wording_difference・additional・needs_review など） */
  review?: MeaningReview;
  /** 同じ資料・同じ文が別のファイルにも収録されていた場合、まとめたほうの ID */
  mergedIds?: string[];
}

export interface ContextStarRef {
  name: PlacedStar;
  strength: StarStrength | null;
  transformations: TransformationKind[];
}

export interface ContextStar extends ContextStarRef {
  isMain: boolean;
  /** 星のイメージ・宮に依らない基本の記述 */
  baseMeanings: ContextMeaning[];
  /** この宮に入ったときの記述（命宮は入門「命宮における判断」、他の宮は星×宮） */
  palaceMeanings: ContextMeaning[];
  /** 旺衰による象意の違い。資料に記述がないため常に空（§21.6） */
  strengthMeanings: ContextMeaning[];
  /** 付いている四化そのものの象意（命宮の記述は命宮をクリックしたときだけ） */
  transformationMeanings: { kind: TransformationKind; meanings: ContextMeaning[] }[];
  /** 星×四化（この星にこの四化が付いたとき）の象意。資料に記述がないため常に空（§21.6） */
  starTransformationMeanings: ContextMeaning[];
}

export type SanfangRole = "本宮" | "対宮" | "三合";

export interface ContextPalaceSummary {
  role: SanfangRole;
  name: PalaceName;
  branch: Branch;
  stars: ContextStarRef[];
}

/** 資料に明記された組み合わせのうち、盤面の星がそろっているもの */
export interface ContextCombination {
  meaning: ContextMeaning;
  relation: CombinationMeaning["relation"];
  subjectStars: ZiweiStarName[];
  withStars: ZiweiStarName[];
  /** 盤面で見つかった節の対象星 */
  matchedSubjects: ZiweiStarName[];
  /** 資料の文の対象星のうち本宮にない星 */
  unmatchedSubjects: ZiweiStarName[];
  /** 盤面で見つかった相手の星と、その宮（本宮＝同宮、対宮・三合＝加会） */
  matchedPartners: { star: ZiweiStarName; role: SanfangRole; branch: Branch }[];
  /** 資料の文に列挙されているが盤面の該当位置にない相手の星 */
  unmatchedPartners: ZiweiStarName[];
  /**
   * full … 文に列挙された対象星・相手の星がすべて盤面の所定の位置にある。
   * partial … 一部だけ（全員そろう意味か、いずれかの意味かは原文による。成立しているとは扱わない）。
   */
  matchStatus: "full" | "partial";
  /** matchStatus === "partial" と同じ（既存の表示用） */
  partialMatch: boolean;
}

export interface PalaceMeaningContext {
  palace: { name: PalaceName; branch: Branch; isShenPalace: boolean };
  /** 宮そのものの意味（入門・基礎編） */
  palaceMeanings: ContextMeaning[];
  /** 身宮の場合だけ: 身宮の意味（資料差異 needs_review。reviewNotes 参照） */
  shenPalaceMeanings: ContextMeaning[];
  stars: ContextStar[];
  /** 同宮の組み合わせ（資料に明記されたものだけ） */
  samePalaceCombinations: ContextCombination[];
  sanfang: { self: ContextPalaceSummary; opposite: ContextPalaceSummary; trines: [ContextPalaceSummary, ContextPalaceSummary] };
  /** 三方四正の関係（加会）で資料に明記された象意だけ */
  relatedMeanings: ContextCombination[];
  /** このコンテキストに関係する資料差異（needs_review など） */
  reviewNotes: MeaningReview[];
  /** 資料に記述がないために空の項目の説明 */
  notes: string[];
  /** 収録した象意の出典（重複なし） */
  sources: SourceRef[];
  /** 力量（§22）。条件付きの文の判定に使う命宮の運命指数・盤面の星の力量と、この宮の力量の内訳 */
  power: PowerSnapshot & { palace: PalacePower };
}

// ---------------------------------------------------------------------------
// AI 入力用に選別した象意コンテキスト（aiContext.ts。docs/ziwei-basic-spec.md §21.10）
// ---------------------------------------------------------------------------

/** 選別の優先順位（小さいほど優先） */
export type AiMeaningPriority = 1 | 2 | 3 | 4 | 5 | 6;

export type AiMeaningKind =
  | "starPalace" // 優先1: 本宮の星×宮
  | "starBase" // 優先2: 本宮の星の基本象意
  | "combination" // 優先3: 本宮で完全一致した同宮の組み合わせ
  | "transformation" // 優先4: 本宮の四化の象意
  | "jiahui" // 優先5: 三方四正で完全一致した加会の組み合わせ
  | "palace"; // 優先6: 宮そのものの一般象意

/** AI 入力の詳しさ（§21.10） */
export type AiDetailLevel = "brief" | "standard" | "detailed";

/**
 * 選別ランク。A … 必ず渡す（件数上限で削らない）、B … 件数の範囲でできるだけ渡す。
 * C（参考: 一部一致・条件未判定・needs_review・同内容の重複）は referenceOnly・reviewItems・alsoIn に置く。
 */
export type AiMeaningRank = "A" | "B";

/** AI へ渡す象意1件。表示文・出典・元データ ID・凍結メタデータをそのまま持つ */
export interface AiMeaning extends TextMeta {
  id: string;
  rank: AiMeaningRank;
  /** A のうち、どの資料上の分類（カテゴリ・タグ）の代表として選んだか（星×宮のみ） */
  facet?: string;
  priority: AiMeaningPriority;
  kind: AiMeaningKind;
  /** 関係する星（星×宮・基本象意・四化・組み合わせ） */
  stars: ZiweiStarName[];
  text: string;
  ref: SourceRef;
  category?: string;
  review?: MeaningReview;
  /** 同じ内容の別収録・別資料（言い回しの違い）で、代表の1件にまとめたもの。出典を残す */
  alsoIn?: { id: string; ref: SourceRef; review?: MeaningReview }[];
  /**
   * 前後の文がないと意味が通らない文に付ける、同じ資料・同じ節の前後の文の ID（文そのものは結合しない）。
   * previous は古い順（直前の文が最後）。文の本体は keyMeanings か contextSentences にある
   */
  context?: { previous: string[]; next: string[]; reason: string };
  /** 力量の条件付きの文で、条件が成立したもの（§22.6） */
  conditionEvaluation?: PowerConditionEvaluation;
}

/** 主文に付随して AI へ渡す前後の文（件数の上限とは別枠。同じ文は1回だけ持ち、複数の主文から参照する） */
export interface AiContextSentence extends TextMeta {
  id: string;
  text: string;
  ref: SourceRef;
  /** 文中の条件（この文自体は条件を判定していない文脈として渡す） */
  condition?: string;
  review?: MeaningReview;
  /** 文中の条件の判定（§22.6）。成立しない文脈文を持つ主文は本文に入れない */
  conditionEvaluation?: PowerConditionEvaluation;
  /** この文を文脈として参照している主文の ID */
  referencedBy: string[];
}

/** AI の通常材料には入れない参考資料（成立していない・条件を判定していない） */
export interface AiReferenceMeaning {
  id: string;
  /** 参考・条件未充足（組み合わせの一部だけ一致）／参考・条件未判定（力量などの条件付きの文） */
  status: "参考・条件未充足" | "参考・条件未判定";
  reason: string;
  stars: ZiweiStarName[];
  text: string;
  ref: SourceRef;
  condition?: string;
  matchedStars?: ZiweiStarName[];
  unmatchedStars?: ZiweiStarName[];
  /** 力量の条件の判定（判定不能の理由を含む） */
  conditionEvaluation?: PowerConditionEvaluation;
}

/** 力量の条件が不成立で除外した文（§22.6） */
export interface AiConditionExcluded {
  id: string;
  text: string;
  ref: SourceRef;
  condition: string;
  reason: string;
  conditionEvaluation: PowerConditionEvaluation;
}

export interface AiCombination {
  meaning: AiMeaning;
  relation: CombinationMeaning["relation"];
  subjectStars: ZiweiStarName[];
  withStars: ZiweiStarName[];
  matchedPartners: ContextCombination["matchedPartners"];
  matchStatus: "full";
}

export interface AiReviewItem {
  topic: string;
  status: DifferenceStatus;
  note: string | null;
  /** この論点に関係する資料の文（どれかに一本化しない） */
  meanings: { id: string; text: string; ref: SourceRef }[];
}

export interface AiMeaningContext {
  palace: PalaceMeaningContext["palace"];
  detailLevel: AiDetailLevel;
  /** AI へ渡す象意（A → B、各ランクの中は優先順位順） */
  keyMeanings: AiMeaning[];
  /** 本宮の星ごとの構造情報と、その星について選んだ象意の ID */
  stars: (ContextStarRef & { isMain: boolean; selectedMeaningIds: string[] })[];
  /** 完全一致した組み合わせ（同宮・加会）だけ */
  fullMatchCombinations: AiCombination[];
  /** 三方四正4宮の構造情報（宮名・地支・星・旺衰・四化）。各星の象意は入れない */
  sanfangSizheng: PalaceMeaningContext["sanfang"];
  /** 要確認の資料差異（needs_review）。一本化しない */
  reviewItems: AiReviewItem[];
  /** AI の通常材料には入れない参考資料（術者確認用） */
  referenceOnly: AiReferenceMeaning[];
  /** 力量の条件が不成立のため除外した文（本文にも参考にも入れない） */
  conditionExcluded: AiConditionExcluded[];
  /** 主文に付随する前後の文（採用件数とは別枠）。keyMeanings にすでにある文はここに重ねない */
  contextSentences: AiContextSentence[];
  counts: {
    /** contextSentences の件数（主文に付随して追加した前後の文。selectedMeaningCount には含めない） */
    attachedContextCount: number;
    /** 前後の文を付けた主文の件数 */
    meaningsWithContextCount: number;
    /** ランク別の件数。A・B は keyMeanings、C は参考・要確認の文・同内容としてまとめた件数の合計 */
    rank: { A: number; B: number; C: number };
    /** この detailLevel の採用件数の目安（A はこれを超えても削らない） */
    targetRange: [number, number];
    /** 全件コンテキストの象意（ID の重複なし） */
    sourceMeaningCount: number;
    /** keyMeanings の件数 */
    selectedMeaningCount: number;
    /** 代表の1件にまとめた同内容の件数（alsoIn） */
    mergedCount: number;
    /** referenceOnly の件数 */
    referenceCount: number;
    /** 力量の条件の判定件数（この宮のコンテキストにある条件付きの文） */
    powerConditions: { met: number; notMet: number; undetermined: number };
    /** sourceMeaningCount − selectedMeaningCount */
    omittedCount: number;
  };
  /** 資料に記述がないため空の項目・選別の注意 */
  notes: string[];
  /** keyMeanings・fullMatchCombinations・reviewItems の出典（重複なし） */
  sources: SourceRef[];
}
