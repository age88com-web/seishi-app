// src/lib/calendar/shukuYoAnchor.ts
//
// 役割:
//   二十八宿暦（宿値日）の基準日（アンカー）設定。
//   『協紀辨方書』系の通書実データで検証済みの値をこのファイル1つに分離する。
//   将来、別の通書で検証結果が更新された場合はこのファイルの値だけを
//   差し替えればよく、shukuYo.ts・calendarEngine.ts のロジック本体
//   （mod 28 / mod 84 / mod 420 の計算そのもの）は書き換えない。
//
// 検証根拠（現代通書の実データ、2026-09-09時点で確認済み）:
//   2026-02-17（旧暦正月一日） → 室
//   2025-01-29（旧暦正月一日） → 参
//   2024-02-10（旧暦正月一日） → 氐
//   上記いずれも、2025-12-21 を基準日・虚を基準宿として一日一宿で
//   計算するとすべて一致する。
//
//   重要: 「旧暦初一だから宿が決まる」のではない。宿値日は旧暦月
//   （lunisolar.ts の lunarMonth）とは独立した連続日周期であり、
//   上記の旧暦正月一日はあくまで検証に使った実データの日付にすぎない。
//
//   七元（420日周期）についても、この基準日は『協紀辨方書』七元表の
//   「一元甲子」に相当することを確認済み（一元甲子起虚／二元甲子起奎／
//   三元甲子起畢／四元甲子起鬼／五元甲子起翼／六元甲子起氐／
//   七元甲子起箕）。
//
// 日境界について:
//   基準日の JDN は日干支と同じ civilJdn（子初23:00ルール）で算出する。
//   civilJdn の hour 引数は「23時以降なら日付を繰り上げる」判定にのみ
//   使われ、23時未満であれば結果は変わらないため、ここでは正午(12時)を
//   渡す。

import { civilJdn } from "./eto";
import { LODGE_28 } from "./shukuYo";
import type { Lodge28 } from "./shukuYo";

/** 基準日（暦日、年月日）。 */
export const SHUKU28_ANCHOR_DATE = { year: 2025, month: 12, day: 21 } as const;

/** 基準日の宿。 */
export const SHUKU28_ANCHOR_LODGE: Lodge28 = "虚";

/** 基準日の宿の LODGE_28 内インデックス（0=角 … 27=軫）。 */
export const SHUKU28_ANCHOR_LODGE_INDEX: number = LODGE_28.indexOf(SHUKU28_ANCHOR_LODGE);

/**
 * 二十八宿暦の既定の基準日（epochJdn）。
 *
 * resolveShukuYo(dayCount) は「dayCount=0 のとき角(index0)」という規約の
 * 純粋関数（無変更）。dayCount は呼び出し側が
 *   dayCount = 対象日の civilJdn − epochJdn
 * として求める。基準日自身を civilJdn で代入すると
 *   dayCount = 基準日のcivilJdn − epochJdn
 * が「基準宿のインデックス」と等しくなるように、
 *   epochJdn = 基準日のcivilJdn − 基準宿のインデックス
 * として既定値を定義する。
 */
export const DEFAULT_SHUKU28_EPOCH_JDN: number =
  civilJdn(
    SHUKU28_ANCHOR_DATE.year,
    SHUKU28_ANCHOR_DATE.month,
    SHUKU28_ANCHOR_DATE.day,
    12,
  ) - SHUKU28_ANCHOR_LODGE_INDEX;
