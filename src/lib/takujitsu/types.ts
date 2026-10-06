// src/lib/takujitsu/types.ts
//
// 役割:
//   擇日（たくじつ）モジュールの入出力型。
//   共通 CalendarEngine（src/lib/calendar/）が確定した干支だけを受け取り、
//   神殺（日家吉神・日家凶神）を判定する薄い層の型を定義する。
//   CalendarEngine 自体は一切変更しない。
//
// 唯一の仕様根拠:
//   docs/source/擇日テキスト.pdf
//   docs/source/擇日実例.pdf
//   外部資料・一般知識・推測による補完は禁止。
//
// 月令について（重要）:
//   月令は新暦の月番号ではなく、CalendarEngine が節入り時刻で確定した
//   月支（monthBranch）を使う。呼び出し側は CalendarResult.monthBranch を
//   そのまま渡すこと（暦月番号からの変換や独自の節気判定はしない）。

/** 十干（文字列）。CalendarResult の各 *Stem フィールドと同じ表記。 */
export type StemLike = string;
/** 十二支（文字列）。CalendarResult の各 *Branch フィールドと同じ表記。 */
export type BranchLike = string;

/**
 * 神殺判定の入力。CalendarResult の yearStem/yearBranch・monthStem/monthBranch・
 * dayStem/dayBranch をそのまま受け取る（新暦の月番号や日付そのものは渡さない）。
 * 今回実装の7神殺で実際に使うのは yearStem・monthBranch（月令＝月建）・
 * dayStem・dayBranch（日令＝日辰）のみで、yearBranch・monthStem は
 * 将来の神殺拡張のために型として保持しているだけの未使用フィールド。
 */
export interface ShinsatsuInput {
  /** 年干（歳徳・歳徳合の判定に使用）。 */
  yearStem: StemLike;
  /** 年支。今回実装の7神殺では未使用（将来の拡張のため保持）。 */
  yearBranch?: BranchLike;
  /** 月干。今回実装の7神殺では未使用（将来の拡張のため保持）。 */
  monthStem?: StemLike;
  /**
   * 月令（＝月建）。CalendarEngine が節入り時刻で確定した月支。
   * 新暦の月番号ではない。天徳・月徳・天徳合・月徳合の判定キー。
   */
  monthBranch: BranchLike;
  /** 日干。歳徳・歳徳合・天赦の判定に使用。 */
  dayStem: StemLike;
  /** 日令（＝日辰）。天赦の干支一致判定に使用。 */
  dayBranch: BranchLike;
  /**
   * 農暦月（1〜12）。CalendarResult.lunarMonth をそのまま渡す
   * （src/lib/calendar/lunisolar.ts、無中気置閏法）。
   * 月令＝月建（monthBranch、節入りで確定する月支）とは絶対に混同しないこと。
   * 天願・季分（吉神第6グループ）・凶神第6グループの農暦月依存項目が使用し、
   * 他の神殺グループは未使用（既存グループの判定には一切影響しない）。
   */
  lunarMonth?: number;
  /**
   * 農暦日（1〜30。朔が発生した現地暦日を1とする）。CalendarResult.lunarDay を
   * そのまま渡す。凶神第6グループの農暦日依存項目（月忌日・四不詳・龍禁など）
   * のみが使用する。monthBranch・dayBranch（干支の月令・日令）とは無関係の
   * 別概念であり、混同しないこと。
   */
  lunarDay?: number;
  /**
   * 二十八宿（宿値日）。CalendarResult.lodge28 をそのまま渡す。
   * 凶神第6グループの伏斷日・埋兒凶宿のみが使用する。
   */
  lodge28?: string;
}

/** 神殺判定の出力。今回は凶神は未実装のため常に空配列。 */
export interface ShinsatsuResult {
  kichijin: string[];
  kyojin: string[];
}
