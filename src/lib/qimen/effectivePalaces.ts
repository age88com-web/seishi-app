// src/lib/qimen/effectivePalaces.ts
//
// 役割:
//   奇門遁甲「寄宮後の有効配置」— 排盤（地盤・天盤・九星・八門・八神）の九宮データから、
//   中宮(5)の要素を寄宮先へ移した「外周8宮の有効配置」を作る。格局判定はこの有効配置を使う。
//   排盤データ（dipan.ts / tianpan.ts / jiuxing.ts 等の出力）そのものは変更しない。
//
// 監修原則（2026-10-06 確定）:
//   ・地盤は六儀三奇を割り出すための基礎配列であり、地盤原盤では中宮5に干を置く（dipan.ts のまま）。
//   ・中宮には方位が無い。地盤を基礎に割り出される天盤・九星その他の要素について、
//     方位を持つ配置・判定では中宮5を独立した宮として扱わず、所定の寄宮先へ移して扱う。
//   ・天禽が天芮と同宮するのもこの原則による。
//   寄宮先:
//     ・地盤の中宮干 → 坤二宮の寄宮干（講義 p10「中五は無位で坤二に奇宮する」、p22「坤に中宮の地盤干を寄せる」）
//     ・天盤の中宮由来の干（天禽が帯同する干） → 芮禽宮（天禽と同宮する天芮の宮）の天盤干
//       （講義 p24「中宮の天禽は坤に寄宮し天芮と同宮し芮禽と表記する」）
//   結果として、坤二宮は「本来の地盤干＋中宮から寄宮した地盤干」、芮禽宮は「本来の天盤干＋
//   中宮由来の天盤干」の複数干を持つ。
//
// 検証:
//   1080.pdf は中宮由来の天盤干を芮禽宮に描いている（1080局すべて）。
//   この有効配置の天盤は 1080.pdf の天盤表示と 1080/1080 一致する（tests/qimen_kyokaku.manual.ts）。

import type { PalaceSummary } from "./qimenEngine";
import type { DiPanStem } from "./dipan";
import type { JiuXingStar } from "./jiuxing";
import type { BaMenName } from "./bamen";
import type { BaShenName } from "./bashen";

/** 外周8宮（中宮5は含めない）。 */
export const OUTER_PALACES: readonly number[] = [1, 2, 3, 4, 6, 7, 8, 9];

/** 地盤の中宮干の寄宮先（坤二宮）。 */
export const CENTER_DIPAN_JIGONG_PALACE = 2;

export interface EffectivePalace {
  /** 地盤干（坤二宮のみ、本来の地盤干の後に中宮から寄宮した地盤干が続く）。 */
  diPanStems: DiPanStem[];
  /** 天盤干（芮禽宮のみ、本来の天盤干の後に中宮由来の天盤干が続く）。天盤未算出なら空。 */
  tianPanStems: DiPanStem[];
  jiuXing: JiuXingStar[];
  baMen: BaMenName[];
  baShen: BaShenName[];
}

export interface EffectivePalacesResult {
  /** 外周8宮（1,2,3,4,6,7,8,9）の有効配置。中宮5は持たない。 */
  palaces: Record<number, EffectivePalace>;
  /** 地盤原盤の中宮干。 */
  centerStem: DiPanStem | null;
  /** 地盤の中宮干の寄宮先（常に坤二宮）。 */
  centerDiPanPalace: number;
  /** 中宮由来の天盤干の寄宮先（芮禽宮）。九星または天盤が未算出なら null（その場合は寄宮させない）。 */
  centerTianPanPalace: number | null;
}

/**
 * 九宮の排盤データから、中宮要素を寄宮先へ移した外周8宮の有効配置を返す。
 * 入力の palaces は変更しない。
 */
export function resolveEffectivePalaces(palaces: Record<number, PalaceSummary>): EffectivePalacesResult {
  const centerStem = palaces[5]?.diPanStem ?? null;
  const centerTianPanStem = palaces[5]?.tianPanStem;
  const ruiQinPalace =
    OUTER_PALACES.find((p) => (palaces[p]?.jiuXing ?? []).includes("天禽")) ?? null;
  const centerTianPanPalace =
    centerTianPanStem !== undefined && ruiQinPalace !== null ? ruiQinPalace : null;

  const out: Record<number, EffectivePalace> = {};
  for (const p of OUTER_PALACES) {
    const src = palaces[p];
    const diPanStems: DiPanStem[] = src?.diPanStem !== undefined ? [src.diPanStem] : [];
    const tianPanStems: DiPanStem[] = src?.tianPanStem !== undefined ? [src.tianPanStem] : [];
    if (p === CENTER_DIPAN_JIGONG_PALACE && centerStem !== null) diPanStems.push(centerStem);
    if (p === centerTianPanPalace && centerTianPanStem !== undefined) tianPanStems.push(centerTianPanStem);
    out[p] = {
      diPanStems,
      tianPanStems,
      jiuXing: [...(src?.jiuXing ?? [])],
      baMen: [...(src?.baMen ?? [])],
      baShen: [...(src?.baShen ?? [])],
    };
  }

  return {
    palaces: out,
    centerStem,
    centerDiPanPalace: CENTER_DIPAN_JIGONG_PALACE,
    centerTianPanPalace,
  };
}

/**
 * 遁甲（甲を表に出さず六儀に隠す）— 格局判定に使う時干。
 * 時干が甲なら、その時干支の旬首に対応する六儀（liuyi）に置き換える（監修原則 2026-10-06）。
 */
export function concealJiaHourStem(hourStem: string, liuyi: DiPanStem): string {
  return hourStem === "甲" ? liuyi : hourStem;
}

/**
 * 遁甲（甲を表に出さず六儀に隠す）— 格局判定に使う日干。
 * 日干が甲なら戊として扱う（監修原則 2026-10-06）。
 */
export function concealJiaDayStem(dayStem: string): string {
  return dayStem === "甲" ? "戊" : dayStem;
}
