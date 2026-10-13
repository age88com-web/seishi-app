// src/lib/big_limit_ages.ts
// 大限パネルの「この大限で見る年齢」の選択肢：既存の大限区間（buildBigLimitSpans、startAge 以上 endAge 未満）に入る整数年齢。
// 大限計算そのものは変更しない（区間は既存のまま読むだけ）。選んだ年齢は既存の targetAge として使う。

import { buildBigLimitSpans, type Branch } from "./big_limit";

/** 当宮の大限区間に入る整数年齢（例：35.5〜50.5 → 36〜50）。区間が無ければ空 */
export function integerAgesOfBigLimit(mingBranch: string, mingDegree: number | null | undefined, branch: string): number[] {
  if (mingDegree == null || !Number.isFinite(mingDegree)) return [];
  const sp = buildBigLimitSpans(mingBranch as Branch, mingDegree).find((s) => s && s.branch === branch);
  if (!sp) return [];
  const out: number[] = [];
  for (let a = Math.ceil(sp.startAge); a < sp.endAge; a++) out.push(a);
  return out;
}
