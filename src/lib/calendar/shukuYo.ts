// src/lib/calendar/shukuYo.ts
//
// 役割:
//   二十八宿暦（宿値日）。基準日からの日数差を mod 28 して当日の宿を求める、
//   等分の周期概念（暦注）。
//
//   src/lib/mansions28.ts の「二十八宿」とは別概念なので混同しないこと。
//   mansions28.ts は黄経(0..360)上の実幅（不等分割）配置で、七政四餘の
//   星の宿判定に使う。一切変更しない・依存もしない。
//   本ファイルは日数の周期だけで決まる暦注であり、黄経・天体位置とは無関係。
//
// 用語の区別:
//   shukuYo（宿の七曜属性）は、二十八宿を7つずつ木→金→土→日→月→火→水で
//   循環配当したもの。現代の曜日（Gregorian の週7日）とは別概念であり、
//   本ファイルは Date の曜日を一切参照しない。
//
// 基準日（epoch）について:
//   本ファイル自身はハードコードされた基準日を持たず、呼び出し側が渡す
//   dayCount（基準日からの日数差）を受け取って計算するだけの純粋関数と
//   して実装する。基準日そのもの（現代通書実データで検証済みのアンカー）
//   は src/lib/calendar/shukuYoAnchor.ts に分離してあり、
//   calendarEngine.ts がそこから既定の epochJdn を取り出して
//   dayCount を算出する。将来アンカーが更新されても、この計算ロジック
//   （resolveShukuYo）自体は変更不要という設計。
//
// docs: 依頼メッセージ（二十八宿暦機能の追加、および宿値日アンカー確定の
//   追加依頼）に基づく実装。唯一の仕様根拠はユーザー提示の固定順序・
//   七曜配当・周期定義・アンカーであり、一般知識による補完・推測は
//   行っていない。

/** 二十八宿の固定順序（角から軫まで）。 */
export const LODGE_28 = [
  "角", "亢", "氐", "房", "心", "尾", "箕",
  "斗", "牛", "女", "虚", "危", "室", "壁",
  "奎", "婁", "胃", "昴", "畢", "觜", "参",
  "井", "鬼", "柳", "星", "張", "翼", "軫",
] as const;

export type Lodge28 = (typeof LODGE_28)[number];

/** 七曜。角(=LODGE_28[0])を木として、以降この順に循環配当する。 */
export const SEVEN_LUMINARIES = ["木", "金", "土", "日", "月", "火", "水"] as const;

export type SevenLuminary = (typeof SEVEN_LUMINARIES)[number];

/** 小周（84日）・大周（420日）。 */
const MINOR_CYCLE_DAYS = 84;
const MAJOR_CYCLE_DAYS = 420;
/** 七元は420日周期を60日ずつ7分割したもの（『協紀辨方書』七元表）。 */
const YUAN_DAYS = 60;

export type Yuan = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ShukuYoResult {
  /** 当日の宿。 */
  lodge: Lodge28;
  /** 当日の宿の七曜属性。現代の曜日とは無関係。 */
  shukuYo: SevenLuminary;
  /** LODGE_28 内のインデックス（0=角 … 27=軫）。 */
  lodgeIndex: number;
  /** 小周（84日）内の位置（0..83）。 */
  minorCycleDay: number;
  /** 大周（420日）内の位置（0..419）。 */
  majorCycleDay: number;
  /** 七元（420日周期を60日ずつ7分割、1〜7）。『協紀辨方書』七元表。 */
  yuan: Yuan;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * 基準日からの日数差（dayCount、符号つき整数）から当日の宿・七曜・
 * 周期位置を求める。
 *
 * dayCount は「対象日の暦日 JDN − 基準日の暦日 JDN」を呼び出し側が
 * 算出して渡す（本関数はその差分の mod 計算のみを行う）。
 */
export function resolveShukuYo(dayCount: number): ShukuYoResult {
  const lodgeIndex = mod(dayCount, 28);
  const majorCycleDay = mod(dayCount, MAJOR_CYCLE_DAYS);
  return {
    lodge: LODGE_28[lodgeIndex],
    shukuYo: SEVEN_LUMINARIES[lodgeIndex % 7],
    lodgeIndex,
    minorCycleDay: mod(dayCount, MINOR_CYCLE_DAYS),
    majorCycleDay,
    yuan: (Math.floor(majorCycleDay / YUAN_DAYS) + 1) as Yuan,
  };
}

/**
 * 二十八宿暦を「その日の宿」1件としてまとめた形。resolveShukuYo() の
 * 結果を並べ替えるだけで、計算は一切増やさない（依頼側の型
 * DailyTwentyEightMansion に合わせた形状の窓口）。
 */
export interface DailyTwentyEightMansion {
  index: number;
  name: Lodge28;
  shukuYo: SevenLuminary;
  cycle420: number;
  yuan: Yuan;
}

export function toDailyTwentyEightMansion(result: ShukuYoResult): DailyTwentyEightMansion {
  return {
    index: result.lodgeIndex,
    name: result.lodge,
    shukuYo: result.shukuYo,
    cycle420: result.majorCycleDay,
    yuan: result.yuan,
  };
}
