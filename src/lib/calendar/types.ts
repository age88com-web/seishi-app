// src/lib/calendar/types.ts
//
// 役割:
//   共通暦エンジン CalendarEngine の入出力型と、二十四節気の定義データ。
//   本ファイルが型の唯一の基準。calendar 配下の他ファイルはここを参照する。
//
// 実装方針:
//   - 排盤に関する型は持たない（暦情報のみ）。
//   - timezone のデフォルトは "Asia/Tokyo"（calendarEngine 側で補完）。
//
// docs: 02_共通暦エンジン要件 / 03_共通暦エンジン設計 / 05_CalendarEngine_API

/** calculate() の入力 */
export interface CalendarInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;

  second?: number;
  /** IANA タイムゾーン名。未指定時は "Asia/Tokyo" */
  timezone?: string;

  longitude?: number;
  latitude?: number;

  /**
   * 二十八宿暦（宿値日）の基準日（JDN）。未指定時は
   * src/lib/calendar/shukuYoAnchor.ts の検証済みアンカー
   * （2025-12-21＝虚）を既定値として使う。別の通書の検証結果に
   * 差し替えたい場合など、呼び出し側で上書きしたいときだけ指定する。
   */
  epochJdn?: number;

  /**
   * 農暦（太陰太陽暦）の暦法設定。未指定時は "定気"（実視黄経）で計算する。
   * epochJdn と異なり、未指定でも常に計算される（「計算するかどうか」ではなく
   * 「どう計算するか」の設定）。型は src/lib/calendar/lunisolar.ts の
   * LunisolarConfig と構造的に同じものをここでは import せず直接記述する
   * （本ファイルは calendar 配下の他モジュールに依存しない方針のため）。
   */
  lunisolarConfig?: { method?: "定気" };
}

/** calculate() の出力（docs/03 と docs/05 を統合した最終仕様） */
export interface CalendarResult {
  /** 入力日時を UTC に正規化した ISO 8601 文字列 */
  utc: string;
  julianDay: number;
  deltaT: number;

  sunLongitude: number;
  /** 対象時刻が属する節気の名称 */
  solarTerm: string;
  /** solarTerm の節入り日時（UTC の ISO 8601 文字列） */
  solarTermDateTime: string;

  yearStem: string;
  yearBranch: string;

  monthStem: string;
  monthBranch: string;

  dayStem: string;
  dayBranch: string;

  hourStem: string;
  hourBranch: string;

  /**
   * 二十八宿暦（宿値日）。常に算出される（input.epochJdn 未指定時は
   * shukuYoAnchor.ts の検証済みアンカーを使う）。
   * src/lib/mansions28.ts の二十八宿（黄経ベース・七政四餘用）とは別概念。
   * 現代の曜日（Gregorian の週7日）とは無関係。
   */
  lodge28?: string;
  /** 当日の宿の七曜属性（木金土日月火水）。現代の曜日とは別概念。 */
  shukuYo?: string;
  /** LODGE_28 内のインデックス（0=角 … 27=軫）。 */
  lodgeIndex?: number;
  /** 小周（84日）内の位置（0..83）。 */
  minorCycleDay?: number;
  /** 大周（420日）内の位置（0..419）。 */
  majorCycleDay?: number;
  /** 七元（420日周期を60日ずつ7分割、1〜7）。『協紀辨方書』七元表。 */
  yuan?: number;

  /**
   * 農暦（太陰太陽暦）。月境界＝朔、月番号は中気の有無で確定する
   * （無中気置閏法）。src/lib/calendar/lunisolar.ts 参照。
   * lunarYear は今回未実装（非破壊で後日追加予定）。
   */
  lunarMonth?: number;
  /** 閏月かどうか。 */
  isLeapMonth?: boolean;
  /** 農暦日（1〜30）。朔が発生した現地暦日（timezone基準）を1とする。 */
  lunarDay?: number;
  /** 対象の暦日を含む月の朔の瞬間（UTC の ISO 8601 文字列）。朔の当日で朔より前の時刻なら対象時刻より後になる。 */
  newMoonTime?: string;
  /** 次の朔の瞬間（UTC の ISO 8601 文字列）。 */
  nextNewMoonTime?: string;
}

/**
 * 二十四節気。
 * name: 節気名 / longitude: 節入りとなる太陽黄経（度） / kind: 節 or 中気
 * 節入り判定は固定日付を使わず、太陽黄経がこの角度に達した時刻で行う（docs/02）。
 */
export interface SolarTermDef {
  name: string;
  longitude: number;
  kind: "節" | "中";
}

export const SOLAR_TERMS: readonly SolarTermDef[] = [
  { name: "立春", longitude: 315, kind: "節" },
  { name: "雨水", longitude: 330, kind: "中" },
  { name: "啓蟄", longitude: 345, kind: "節" },
  { name: "春分", longitude: 0, kind: "中" },
  { name: "清明", longitude: 15, kind: "節" },
  { name: "穀雨", longitude: 30, kind: "中" },
  { name: "立夏", longitude: 45, kind: "節" },
  { name: "小満", longitude: 60, kind: "中" },
  { name: "芒種", longitude: 75, kind: "節" },
  { name: "夏至", longitude: 90, kind: "中" },
  { name: "小暑", longitude: 105, kind: "節" },
  { name: "大暑", longitude: 120, kind: "中" },
  { name: "立秋", longitude: 135, kind: "節" },
  { name: "処暑", longitude: 150, kind: "中" },
  { name: "白露", longitude: 165, kind: "節" },
  { name: "秋分", longitude: 180, kind: "中" },
  { name: "寒露", longitude: 195, kind: "節" },
  { name: "霜降", longitude: 210, kind: "中" },
  { name: "立冬", longitude: 225, kind: "節" },
  { name: "小雪", longitude: 240, kind: "中" },
  { name: "大雪", longitude: 255, kind: "節" },
  { name: "冬至", longitude: 270, kind: "中" },
  { name: "小寒", longitude: 285, kind: "節" },
  { name: "大寒", longitude: 300, kind: "中" },
] as const;

/** timezone 未指定時のデフォルト */
export const DEFAULT_TIMEZONE = "Asia/Tokyo";
