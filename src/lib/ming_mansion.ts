// src/lib/ming_mansion.ts
// 七政四餘：命度の宿（命度宿）と命度主
// - 命度（lib/ming_degree.ts の共通命度：通常＝ASC 基準／古典＝calcMingDegreeFromSunLon）を、
//   命宮の黄経範囲の下端（branchFromLon と同じ割り付け。大限の限度計算 palaceLowLon と共通）＋命度 の黄経へ戻し、
//   既存の lonToMansionDeg で宿と宿内度を求める。宮境界表・宿境界表は新しく作らない
// - 命度主は既存の宿度主対応（getMansionDegreeLord：限度主と同じ「七政と宿度」）
// - 画面の「命度（宿度）」表示と行限ルールの判定は、どちらもこの関数の値を使う

import { palaceLowLon } from "./big_limit_degree";
import { lonToMansionDeg } from "./mansions28";
import { getMansionDegreeLord } from "./qizheng_interpretations";

export type MingMansion = {
  longitude: number;     // 命度の黄経（通常モードでは ASC の黄経と同じ位置）
  mansion: string;       // 命度宿
  degInMansion: number;  // 宿内度
  degreeLord: { groupName: string; star: string } | null; // 命度主
};

const norm360 = (x: number) => ((x % 360) + 360) % 360;

/** 命宮と命度（0〜30）から命度宿を求める。求められない場合は null */
export function mingMansionOf(mingBranch: string, mingDegree: number | null | undefined): MingMansion | null {
  if (mingDegree == null || !Number.isFinite(mingDegree)) return null;
  const low = palaceLowLon(mingBranch);
  if (low == null) return null;
  const longitude = norm360(low + mingDegree);
  const m = lonToMansionDeg(longitude);
  // 既存 lonToMansionDeg が該当宿を見つけられず保険値を返した場合は出さない（限度計算と同じ扱い）
  if (!m || ((longitude - m.startLonDeg) % 360 + 360) % 360 >= m.mansion.widthDeg + 1e-9) return null;
  return { longitude, mansion: m.mansion.label, degInMansion: m.degInMansion, degreeLord: getMansionDegreeLord(m.mansion.label) };
}

/** 画面の「命度（宿度）」表示文字列（例：奎14.57°） */
export function mingMansionText(mm: MingMansion | null): string {
  return mm ? `${mm.mansion}${mm.degInMansion.toFixed(2)}°` : "—";
}
