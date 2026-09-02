// src/lib/shensha_engine.ts
import type { Stem, Branch } from "@/lib/shensha_tables";
import { YEAR_STEM_TO_PALACE, YEAR_BRANCH_TO_PALACE } from "@/lib/shensha_tables";

export type PalaceMap = Record<Branch, string[]>;

// ChartSVG 側（BRANCHES_B）と一致させる：B基準の十二支順
const PALACE_BRANCHES: readonly Branch[] = [
  "戌","亥","子","丑","寅","卯","辰","巳","午","未","申","酉",
] as const;

function emptyMap(): PalaceMap {
  const out = {} as PalaceMap;
  for (const br of PALACE_BRANCHES) out[br] = [];
  return out;
}

function uniq(arr: string[]) {
  const s = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const t = String(v);
    if (!t) continue;
    if (s.has(t)) continue;
    s.add(t);
    out.push(t);
  }
  return out;
}

/** 年干→各宮(十二支)に落ちる神殺一覧 */
export function getNenganPalaceShensha(yearStem: Stem): PalaceMap {
  const out = emptyMap();

  // YEAR_STEM_TO_PALACE: { shenshaName: { 甲:"寅", ... } }
  for (const shenshaName of Object.keys(YEAR_STEM_TO_PALACE)) {
    const mapByStem = YEAR_STEM_TO_PALACE[shenshaName];
    const palace = mapByStem?.[yearStem] as Branch | undefined;
    if (!palace) continue;

    // 宮(十二支)へ加える
    out[palace] = uniq(out[palace].concat([shenshaName]));
  }

  return out;
}

/** 年支→各宮(十二支)に落ちる神殺一覧 */
export function getNenshiPalaceShensha(yearBranch: Branch): PalaceMap {
  const out = emptyMap();

  // YEAR_BRANCH_TO_PALACE: { shenshaName: { 子:"申", ... } }
  for (const shenshaName of Object.keys(YEAR_BRANCH_TO_PALACE)) {
    const mapByYearBranch = YEAR_BRANCH_TO_PALACE[shenshaName];
    const palace = mapByYearBranch?.[yearBranch] as Branch | undefined;
    if (!palace) continue;

    out[palace] = uniq(out[palace].concat([shenshaName]));
  }

  return out;
}

/**
 * 年干神殺＋年支神殺などの合流（重複除去）。
 * 入力は宮が欠けていてもよい（部分マップ可）。出力は全宮そろった PalaceMap。
 */
export function mergePalaceShensha(
  a?: Partial<PalaceMap>,
  b?: Partial<PalaceMap>,
): PalaceMap {
  const out = emptyMap();

  for (const br of PALACE_BRANCHES) {
    const aa = a?.[br] ?? [];
    const bb = b?.[br] ?? [];
    out[br] = uniq(aa.concat(bb));
  }

  return out;
}