// src/lib/takujitsu/jika/types.ts
//
// 役割:
//   擇時（時家）720表引きモジュールの入出力型。
//
// 唯一の仕様根拠:
//   docs/source/時家吉凶.pdf（原典）。
//   docs/takujitsu_jika_720_master.md（720マス本転記・検証、PASS）。
//   docs/takujitsu_jika_shinsatsu_names_audit.md（時家神殺名称マスター、完全確定）。
//   一般的な擇時法・通書・他流派・ネット情報・日家神殺の公式による補完は禁止。
//
// 方針（重要）:
//   時家吉凶.pdf は60日干支×12時辰＝720通りを完全に網羅しており、実際に
//   使用される日干支＋時支の組み合わせは必ずこの720通りのいずれかに一致する。
//   したがって神殺ごとの発生公式を再構築せず、完成済み720表そのものを
//   原典仕様として表引きする（docs/takujitsu_jika_720_master.md 11章）。

/** 十干（文字列）。CalendarResult の各 *Stem フィールドと同じ表記。 */
export type StemLike = string;
/** 十二支（文字列）。CalendarResult の各 *Branch フィールドと同じ表記。 */
export type BranchLike = string;

/**
 * getJikaEntry() の戻り値。720表の1マスに対応する。
 * rawText と normalizedTerms の両方を常に保持する（原典確認のため rawText を欠かさない）。
 */
export interface JikaEntry {
  /** 日干支（例: "甲子"）。 */
  dayGanzhi: string;
  /** 時支（例: "子"）。 */
  hourBranch: BranchLike;
  /** 時干支（例: "甲子"）。五鼠遁の計算値であり、原本印字と全720件で一致確認済み。 */
  hourGanzhi: string;
  /** 原文表記（原典のまま。正規化名で上書きしない）。 */
  rawText: string;
  /**
   * 正規化済み神殺名（時家神殺名称マスターの正式名称・独立語・種別未特定の
   * 総称表現を含む）。「勿用」はここに含めない（isMuyo で別扱い）。
   */
  normalizedTerms: string[];
  /**
   * このマスが「勿用」（神殺ではなく「使用しないこと」を示す指示文）か否か。
   * true の場合、normalizedTerms は空配列になる。
   */
  isMuyo: boolean;
}

// ---------------------------------------------------------------------------
// 用事別吉凶判定（evaluateJikaActivity）関連の型
//
// 唯一の仕様根拠:
//   docs/takujitsu_jika_yiji_master.md（時家宜忌マスター、PASS）
//   docs/takujitsu_jika_activity_mapping_audit.md（mapping監査、完了）
//
// 重要な方針（ユーザー指示、逸脱禁止）:
//   ・判定は「原典宜忌の存在状態」であり、点数化・強弱評価ではない。
//   ・宜と忌が両方存在しても、相殺・優先順位づけは行わず「吉凶混合」を返す。
//   ・勿用（isMuyo）は判定結果とは独立したフラグとして返す。
//     「勿用なら全用事が凶」というルールは実装しない（今回のスコープ外）。
// ---------------------------------------------------------------------------

/** 宜／忌それぞれの根拠1件（UIで「なぜ」を説明できるだけの情報を保持）。 */
export interface JikaActivityEvidence {
  /** 根拠となった時家神殺（複数併記列の場合は列内の全神殺）。 */
  shinsatsu: string[];
  /** 原文用事語（時家吉凶.pdf 原文の表記そのまま）。 */
  sourceTerm: string;
  /** 109用事mappingの分類（A=直接一致／C=包含・近接対応のみが判定材料になる）。 */
  mappingClass: "A" | "C";
  /** 原文（列全体の原文。複数神殺・複数用事語で共有される）。 */
  rawText: string;
}

/** 用事語のうち、109用事へmappingされていない語1件（判定材料にはしないが保持する）。 */
export interface JikaActivityUnmapped {
  shinsatsu: string[];
  sourceTerm: string;
  mappingClass: "B" | "D" | "E" | "F";
  rawText: string;
  /** mappingしない理由（原文に忠実、推測補完はしていない）。 */
  unmappedReason?: string;
}

/** 判定結果は「原典宜忌の存在状態」の4状態のみ。強弱評価は含まない。 */
export type JikaActivityVerdict = "吉" | "凶" | "吉凶混合" | "該当なし";

/** evaluateJikaActivity() の戻り値。 */
export interface JikaActivityEvaluation {
  dayGanzhi: string;
  hourBranch: BranchLike;
  hourGanzhi: string;
  activityId: string;
  /** 該当マスの神殺のうち、この用事に対する宜の根拠（複数可）。 */
  favorable: JikaActivityEvidence[];
  /** 該当マスの神殺のうち、この用事に対する忌の根拠（複数可）。 */
  unfavorable: JikaActivityEvidence[];
  /** 該当マスの神殺のうち、この用事語には対応するがmapping対象外（B/D/E/F）の語。 */
  unmapped: JikaActivityUnmapped[];
  /** 判定結果（吉／凶／吉凶混合／該当なし）。点数・強弱ではなく存在状態。 */
  verdict: JikaActivityVerdict;
  /** 「勿用」マスか否か。verdict とは独立したフラグ（勿用→凶などの自動変換はしない）。 */
  isMuyo: boolean;
}
