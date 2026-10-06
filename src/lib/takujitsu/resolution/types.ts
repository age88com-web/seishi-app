// src/lib/takujitsu/resolution/types.ts
//
// 役割:
//   擇日「神殺解除・相殺・増悪」レイヤーの入出力型。
//   occurrence detection（吉神Group1〜6・凶神Group1〜6が返す
//   ShinsatsuResult＝「その神殺が成立しているか」）とは完全に分離した、
//   別レイヤーの型を定義する。
//
// 唯一の仕様根拠:
//   docs/source/擇日テキスト.pdf
//   docs/takujitsu_resolution_rules.md（解除・相殺・増悪ルール台帳）
//   docs/takujitsu_decisions.md（徳合／赦願／六合の正式定義）
//
// 設計原則（重要）:
//   ・raw の ShinsatsuResult（kichijin/kyojin の文字列配列）は一切変更しない。
//     凶神が解除されても raw.kyojin からは削除しない。
//   ・本レイヤーは raw を受け取り、各神殺名に active/cancelled/reduced/
//     aggravated/pending のいずれかの状態を付与した別データを返すだけ。
//   ・複数のルールが同じ神殺に競合する結果（例：解除ルールと増悪ルールが
//     両方成立）を生んだ場合、本文に優先順位の記載がない限り
//     勝手に優先順位を作らず、状態を pending とする
//     （docs/takujitsu_resolution_rules.md「優先順位」節）。

import type { ShinsatsuResult } from "../types";

/**
 * 個々の神殺（吉神・凶神とも）に付与される解決後の状態。
 *   active     : 変化なし（対象ルールが存在しない、またはすべて条件不成立）
 *   cancelled  : 解除された（凶意が消える）
 *   reduced    : 凶性軽減（完全には消えないが一部緩和。本文が解除と明確に
 *                書き分けている場合のみ使う。単なる「解除」「忌まない」を
 *                reduced に格下げしない）
 *   aggravated : 増悪（凶意がさらに強まる）
 *   pending    : 複数の確定ルールが競合し一意に決められない場合、または
 *                本文からall/anyの条件が確定していないルールにのみ
 *                合致し確定した効力を適用できない場合
 */
export type ResolutionStatus = "active" | "cancelled" | "reduced" | "aggravated" | "pending";

/** ルールが持つ効力の種類。ResolutionStatus とは別に持つ理由は、
 *  同じ kind が複数ルールから同時成立しても矛盾ではない（例：cancel×2）が、
 *  異なる kind が競合したときだけ pending にする、という判定に使うため。 */
export type RelationKind = "cancel" | "reduce" | "aggravate";

/**
 * ルールの発動条件を構成する1グループ。
 * mode "any" ＝ names のいずれか1つが raw（kichijin+kyojin）に存在すれば
 * 成立、"all" ＝ names 全部が存在して初めて成立。
 */
export interface RequiresGroup {
  readonly names: readonly string[];
  readonly mode: "any" | "all";
}

/**
 * 解除・相殺・増悪ルール1件（docs/takujitsu_resolution_rules.md の
 * 「ルールNo.」と1対1対応する）。
 */
export interface ResolutionRule {
  /** docs/takujitsu_resolution_rules.md の「ルールNo.」と対応するID。 */
  readonly id: string;
  /** 対象となる神殺名（複数可。例：四撃〜五虚の6項目）。 */
  readonly targets: readonly string[];
  /** 発動条件のグループ（複数可）。 */
  readonly requires: readonly RequiresGroup[];
  /** requires の複数グループを結合する方法。"all"＝全グループ成立、"any"＝いずれか1グループ成立。 */
  readonly combine: "all" | "any";
  /** このルールが成立した場合の効力の種類。 */
  readonly kind: RelationKind;
  /**
   * true の間は、条件が成立していても実際の状態変化（cancelled/reduced/
   * aggravated への遷移）を発生させない。本文からOR/ANDや適用範囲が
   * 一義的に確定していないルール（docs/takujitsu_resolution_rules.md で
   * 「pending」に分類したもの）に立てる。pending でも条件評価自体は行い、
   * 一致した場合は appliedRules に記録する（効力は適用しないが、
   * 追跡可能にするため）。
   */
  readonly pending: boolean;
  /** docs/takujitsu_resolution_rules.md 上の根拠ページ（トレーサビリティ用）。 */
  readonly page: string;
  /** 人が読める補足（適用条件の要約、保留理由、用途限定の注記など）。 */
  readonly note?: string;
}

/** 1神殺に対して条件が成立した1ルールの記録。 */
export interface AppliedRuleRecord {
  readonly ruleId: string;
  readonly kind: RelationKind;
  /** そのルール自体が pending だったか（true なら効力は適用されていない）。 */
  readonly pending: boolean;
  readonly note?: string;
}

/** 1神殺（吉神・凶神とも）の解決結果。 */
export interface ResolvedShinsatsuEntry {
  readonly name: string;
  readonly status: ResolutionStatus;
  /** 単一の確定ルールだけで状態が決まった場合、そのルールID。複数該当時や
   *  対象ルールが無い場合は undefined（appliedRules を参照する）。 */
  readonly ruleId?: string;
  /** 人が読める理由（例："徳合(天徳)により解除"）。UI表示・デバッグ用。 */
  readonly reason?: string;
  /** 用途限定の凶性残存など、追加の注記。 */
  readonly note?: string;
  /**
   * 条件が成立した全ルールの記録（pending なルールの「該当したが未適用」の
   * 記録も含む）。1件も無ければ undefined（対象ルールが無い、またはすべて
   * 条件不成立で active になったことを意味する）。
   */
  readonly appliedRules?: readonly AppliedRuleRecord[];
}

/**
 * occurrence detection の結果（raw）と、解決後の吉神・凶神一覧をまとめた
 * 出力。raw は入力そのまま（変更しない）。
 */
export interface ResolvedShinsatsuResult {
  readonly raw: ShinsatsuResult;
  readonly kichijin: readonly ResolvedShinsatsuEntry[];
  readonly kyojin: readonly ResolvedShinsatsuEntry[];
}
