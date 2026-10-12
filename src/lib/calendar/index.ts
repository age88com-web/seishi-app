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
/** 二十八宿暦（宿値日）だけを DailyTwentyEightMansion 形状で返す便利関数 */
export { calculateDailyTwentyEightMansion } from "./calendarEngine";
/**
 * before 以前で最も近い「太陽黄経が targetLongitude に達した瞬間」（UTC）。
 * 四柱推命の立運（前後の節入り）で共通利用する（docs/shichusuimei-basic-spec.md D12）。
 * solarTerm.ts の既存関数をそのまま再 export するだけで、計算は変えない。
 */
export { findSolarTermCrossing } from "./solarTerm";

// --- 入出力型 ---
export type { CalendarInput, CalendarResult, SolarTermDef } from "./types";

// --- 定数データ ---
/** 二十四節気の定義（名称 / 節入り太陽黄経 / 節・中の別） */
export { SOLAR_TERMS } from "./types";
/** timezone 未指定時のデフォルト（"Asia/Tokyo"） */
export { DEFAULT_TIMEZONE } from "./types";

// --- 二十八宿暦（宿値日） ---
// src/lib/mansions28.ts の二十八宿（黄経ベース・七政四餘用）とは別概念。
/** 基準日からの日数差から宿・七曜・周期位置を求める（epoch は既定でアンカーを使う） */
export { resolveShukuYo, toDailyTwentyEightMansion, LODGE_28, SEVEN_LUMINARIES } from "./shukuYo";
export type { ShukuYoResult, DailyTwentyEightMansion, Lodge28, SevenLuminary, Yuan } from "./shukuYo";
/** 二十八宿暦の基準日（アンカー）設定。将来の通書更新時はここだけ差し替える。 */
export {
  SHUKU28_ANCHOR_DATE,
  SHUKU28_ANCHOR_LODGE,
  SHUKU28_ANCHOR_LODGE_INDEX,
  DEFAULT_SHUKU28_EPOCH_JDN,
} from "./shukuYoAnchor";

// --- 農暦（太陰太陽暦） ---
// calculate() は常に lunarMonth・lunarDay・isLeapMonth 等を計算して返す
// （lunisolarConfig は計算方式の設定であり、epochJdn のような
//  「計算するかどうか」のスイッチではない）。個別に呼びたい場合のために
// resolveLunisolar 本体・型も公開する。
export { resolveLunisolar } from "./lunisolar";
export type { LunisolarConfig, LunisolarResult } from "./lunisolar";
