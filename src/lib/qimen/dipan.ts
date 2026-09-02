// src/lib/qimen/dipan.ts
//
// 役割:
//   奇門遁甲「地盤」— 局数(1〜9)と陽遁/陰遁だけから、
//   九宮それぞれに配置される地盤天干（六儀三奇）を求める。
//   天盤・九星・八門・八神・格局判定は行わない。
//
// 仕様の出典:
//   講義テキストの【六儀三奇の並び】【洛書九宮】【開始位置】【陽遁】【陰遁】のみ。
//   それ以外の理論は追加しない。1080局からの逆算は行わない。

import type { Dun } from "./dingju";

export type { Dun };

/**
 * 洛書九宮（講義テキスト記載の配置）。
 * 飛泊（順方向/逆方向）の計算自体は洛書後天数（1〜9）の数の並びで行うため、
 * この座標データは配置計算には使わない。将来の天盤・描画フェーズ用の参照として保持する。
 */
export const LUOSHU_GRID: readonly (readonly number[])[] = [
  [4, 9, 2],
  [3, 5, 7],
  [8, 1, 6],
];

/**
 * 六儀三奇の配置順（講義テキストの講義図の具体例どおり）。
 * 陽遁・陰遁とも、この並び順のまま洛書後天数を進む（三奇だけ逆方向にする、等の別処理はしない）。
 */
const PLACEMENT_ORDER = ["戊", "己", "庚", "辛", "壬", "癸", "丁", "丙", "乙"] as const;

export type DiPanStem = (typeof PLACEMENT_ORDER)[number];

export interface DiPanInput {
  dun: Dun;
  ju: number;
}

export type DiPanResult = Record<number, DiPanStem>;

function mod9(n: number): number {
  return ((n - 1) % 9 + 9) % 9 + 1;
}

/**
 * 局数(1〜9)と陽遁/陰遁から、九宮それぞれの地盤天干を求める。
 * 天盤・九星・八門・八神・格局判定は行わない。
 */
export function resolveDiPan(input: DiPanInput): DiPanResult {
  const { dun, ju } = input;

  if (!Number.isInteger(ju) || ju < 1 || ju > 9) {
    throw new Error(`局数は1〜9の整数である必要があります: ${ju}`);
  }

  // 陽遁は順方向(+1)、陰遁は逆方向(-1)に、戊→己→庚→辛→壬→癸→丁→丙→乙の順で進む。
  const direction = dun === "陽遁" ? 1 : dun === "陰遁" ? -1 : null;
  if (direction === null) {
    throw new Error(`未知の遁です: ${dun}`);
  }

  const result: DiPanResult = {};
  for (let i = 0; i < PLACEMENT_ORDER.length; i += 1) {
    const palace = mod9(ju + i * direction);
    result[palace] = PLACEMENT_ORDER[i];
  }

  return result;
}
