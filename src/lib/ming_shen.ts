// src/lib/ming_shen.ts
// 簡易実装（表示用）。必要なら流派の規則で置き換えてください。

const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"] as const;
type Branch = typeof BRANCHES[number];

function norm360(x: number) { x = x % 360; return x < 0 ? x + 360 : x; }

// hourBranchFromLocalDate() は廃止。
// 時支は共通暦エンジン CalendarEngine（src/lib/calendar/）の calculate().hourBranch を使用する。
// 命宮・身宮の計算には呼び出し側（page.tsx）が cal.hourBranch を渡す。

/**
 * 太陽黄経 → 月将（簡易：30°刻みで寅始まり）
 */
export function monthGeneralFromSunLon(sunLonDeg: number): Branch {
  const order = ["寅","卯","辰","巳","午","未","申","酉","戌","亥","子","丑"] as const;
  const lon = norm360(sunLonDeg);
  const idx = Math.floor(lon / 30) % 12;
  return order[idx] as Branch;
}

/**
 * 命宮（簡易）：月将から時支だけ進める
 * ※本来は流派規則に従って差し替え
 */
export function calcMingPalace(monthGeneral: Branch, hourBranch: string): Branch {
  const mi = BRANCHES.indexOf(monthGeneral as any);
  const hi = BRANCHES.indexOf(hourBranch as any);
  const idx = (mi + hi) % 12;
  return BRANCHES[idx] as Branch;
}

/**
 * 身宮（簡易）：月将と時支で別計算（仮）
 */
export function calcShenPalace_v2(moonPalace: Branch, hourBranch: string): Branch {
  const mi = BRANCHES.indexOf(moonPalace as any);
  const hi = BRANCHES.indexOf(hourBranch as any);
  const idx = (mi + 12 - hi) % 12;
  return BRANCHES[idx] as Branch;
}
