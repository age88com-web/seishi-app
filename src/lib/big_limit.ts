// src/lib/big_limit.ts
// 七政四余：大限（命度ベース）
// 命度 = 太陽が「十二宮位のどの位置（0-30°）」にあるか
// 命宮の支配年数 = 10 + (命度 / 3)

export type Branch =
  | "子" | "丑" | "寅" | "卯" | "辰" | "巳" | "午" | "未" | "申" | "酉" | "戌" | "亥";

const BRANCHES_B: Branch[] = ["戌","亥","子","丑","寅","卯","辰","巳","午","未","申","酉"];

// 大限順（資料どおり）
const LIMIT_ORDER_NAMES = [
  "命宮",
  "相貌宮",
  "福徳宮",
  "官禄宮",
  "遷移宮",
  "疾厄宮",
  "夫妻宮",
  "奴僕宮",
  "男女宮",
  "田宅宮",
  "兄弟宮",
  "財帛宮",
] as const;

// 各限の年数（資料どおり）
// 1限（命宮）は「命度 ÷ 3 + 10」で決まるので固定値を持たせない
const LIMIT_YEARS: (number | null)[] = [
  null,
  10,
  11,
  15,
  8,
  7,
  11,
  4.5,
  4.5,
  4.5,
  5,
  5,
];

function norm360(deg: number): number {
  const x = deg % 360;
  return x < 0 ? x + 360 : x;
}

export function calcMingDegreeFromSunLon(sunLonDeg: number): number {
  const a = norm360(sunLonDeg);
  return a % 30;
}

export function calcBigLimitStartAge(mingDegree: number): number {
  return 10 + mingDegree / 3;
}

export type BigLimitMap = Record<Branch, string>;

/** 大限1区間（数値）。startAge 以上 endAge 未満を、その宮の大限とする */
export type BigLimitSpan = {
  order: number;          // 0=第一限（命宮）… 11=第十二限
  palaceName: string;     // 大限順の宮名（命宮・相貌宮…）
  branch: Branch;
  startAge: number;
  endAge: number;
};

/** 既存の大限計算（年数・順序）をそのまま数値で返す。buildBigLimits もこれを使う */
export function buildBigLimitSpans(mingBranch: Branch, mingDegree: number): (BigLimitSpan | null)[] {
  const firstLimitYears = calcBigLimitStartAge(mingDegree);
  const spans: (BigLimitSpan | null)[] = [];
  const mingIdx = indexOfBranch(mingBranch);
  const brAt = (step: number) => BRANCHES_B[(mingIdx + step) % 12];

  let curStart = 0;
  let curEnd = firstLimitYears;
  spans.push({ order: 0, palaceName: LIMIT_ORDER_NAMES[0], branch: brAt(0), startAge: curStart, endAge: curEnd });

  for (let i = 1; i < 12; i++) {
    const yrs = LIMIT_YEARS[i];
    if (yrs == null) {
      spans.push(null);
      continue;
    }

    curStart = curEnd;
    curEnd = curEnd + yrs;
    spans.push({ order: i, palaceName: LIMIT_ORDER_NAMES[i], branch: brAt(i), startAge: curStart, endAge: curEnd });
  }
  return spans;
}

export function buildBigLimits(mingBranch: Branch, mingDegree: number): BigLimitMap {
  const spans = buildBigLimitSpans(mingBranch, mingDegree);
  const out: BigLimitMap = {} as BigLimitMap;

  const mingIdx = indexOfBranch(mingBranch);
  for (let step = 0; step < 12; step++) {
    const br = BRANCHES_B[(mingIdx + step) % 12];
    const sp = spans[step];
    out[br] = sp ? formatRange(sp.startAge, sp.endAge) : "";
  }

  return out;
}

/**
 * 指定年齢（targetAge）が入る大限。区間は startAge 以上 endAge 未満。
 * 大限の合計年数（第十二限の終わり）を超える年齢は null。
 */
export function getCurrentBigLimit(mingBranch: Branch, mingDegree: number, targetAge: number): BigLimitSpan | null {
  if (!Number.isFinite(targetAge) || targetAge < 0) return null;
  for (const sp of buildBigLimitSpans(mingBranch, mingDegree)) {
    if (sp && targetAge >= sp.startAge && targetAge < sp.endAge) return sp;
  }
  return null;
}

/** 命宮を基準にした当宮の宮名（大限順・ChartSVG の宮名と同じ並び） */
export function palaceNameOfBranch(mingBranch: Branch, branch: Branch): string {
  return LIMIT_ORDER_NAMES[(indexOfBranch(branch) - indexOfBranch(mingBranch) + 12) % 12];
}

function indexOfBranch(b: Branch): number {
  for (let i = 0; i < BRANCHES_B.length; i++) {
    if (BRANCHES_B[i] === b) return i;
  }
  return 0;
}

function formatRange(a: number, b: number): string {
  return `${formatAge(a)}–${formatAge(b)}`;
}

function formatAge(v: number): string {
  if (Math.abs(v - Math.round(v)) < 1e-9) {
    return String(Math.round(v));
  }
  const rounded = Math.round(v * 10) / 10;
  return String(rounded);
}