// src/lib/ziwei/palaces.ts
//
// §3 命宮・§4 身宮・§5 十二宮配置。
// 規則式は仕様書のもの（表3・表4と全セル一致を tests/ziwei_phase1.manual.ts で確認）。

import type { Branch, PalaceName } from "./types";
import { PALACE_NAMES, branchAt, branchIndex } from "./data";

/** 生時支（補正済み時刻）。境界ちょうどから次の支（旧U6）。23:00 → 子、01:00 → 丑 … */
export function hourBranchOf(secondsOfDay: number): Branch {
  return branchAt(Math.floor((secondsOfDay + 3600) / 7200));
}

/** §3 命宮支 = 寅 + (生月−1) − 生時支 */
export function mingPalaceOf(birthMonth: number, hourBranch: Branch): Branch {
  return branchAt(2 + (birthMonth - 1) - branchIndex(hourBranch));
}

/** §4 身宮支 = 寅 + (生月−1) + 生時支 */
export function shenPalaceOf(birthMonth: number, hourBranch: Branch): Branch {
  return branchAt(2 + (birthMonth - 1) + branchIndex(hourBranch));
}

/** §5 十二宮: 命宮から逆行に 兄弟→夫妻→…→父母。命宮から順に12件。 */
export function arrangePalaces(mingPalace: Branch): { name: PalaceName; branch: Branch }[] {
  const m = branchIndex(mingPalace);
  return PALACE_NAMES.map((name, k) => ({ name, branch: branchAt(m - k) }));
}
