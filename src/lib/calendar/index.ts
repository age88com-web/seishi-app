// src/lib/calendar/index.ts
//
// 役割:
//   共通暦エンジン CalendarEngine の公開窓口（唯一のエントリポイント）。
//   各術数（七政四餘 / 奇門遁甲 / 擇日 / 六壬神課）は本ファイルからのみ import する。
//   内部モジュール（julian / solarTerm / eto / calendarEngine）へ直接依存させない。
//
// 公開方針:
//   - 暦情報の取得に必要なものだけを再 export する。
//   - 排盤・干支の内部計算関数（toJulian / resolveSolarTerm / resolveGanzhi）は非公開。
//
// docs: 03_共通暦エンジン設計 / 05_CalendarEngine_API

// --- 関数 ---
/** 入力日時から共通暦情報を計算して返す CalendarEngine の基本関数 */
export { calculate } from "./calendarEngine";

// --- 入出力型 ---
export type { CalendarInput, CalendarResult, SolarTermDef } from "./types";

// --- 定数データ ---
/** 二十四節気の定義（名称 / 節入り太陽黄経 / 節・中の別） */
export { SOLAR_TERMS } from "./types";
/** timezone 未指定時のデフォルト（"Asia/Tokyo"） */
export { DEFAULT_TIMEZONE } from "./types";
