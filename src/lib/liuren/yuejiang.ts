// src/lib/liuren/yuejiang.ts
//
// 役割:
//   月将（講座 p4）。太陽黄経から、直前の中気に対応する月将を返す。
//
// 講座の記述:
//   「月将とは太陽の位置であり、太陽の黄道を十二分割した地支」
//   「月将は中気から中気まで（正確には暦で確認）」
//
// 未確定（講座に記載なし）:
//   中気の境界時刻の扱い（瞬間で切り替えるか、日単位か）は講座に記載がない。
//   本実装は入力時刻の太陽黄経で判定する（中気の瞬間に切り替わる）。
//   月将が分かっている場合は、エンジン入力で月将を直接指定できる。

import { MONTH_GENERAL_BY_ZHONGQI } from "./constants";
import type { Branch } from "./types";

/** 太陽黄経（度）→ 月将と、その起点の中気 */
export function resolveMonthGeneral(sunLongitude: number): { general: Branch; zhongqi: string } {
  const lon = ((sunLongitude % 360) + 360) % 360;
  // 冬至(270°) を 0 番目とし、30° ごとに次の中気へ進む
  const index = Math.floor((((lon - 270) % 360) + 360) % 360 / 30);
  const row = MONTH_GENERAL_BY_ZHONGQI[index];
  return { general: row.general, zhongqi: row.term };
}
