// src/lib/kakkyoku_engine.ts
/* =====================================================
 * KAKKYOKU ENGINE BASELINE
 * - このファイルが唯一の基準（以後、別ファイル参照で実装しない）
 * - 追記は「追記専用」コメント直上に add(...) だけ行う
 * - helper( idxOf / lonOf / stepPalace / isKyo / isKo / isGong / isJia 等 ) を新規定義しない
 * - 既存helperが無い場合は「追加せず停止」し、このファイルの不足を先に修正する
 * ===================================================== */
import type { Branch } from "@/lib/shensha_tables";

import { lonToMansionDeg } from "@/lib/mansions28";
import { normalizeStarKey } from "@/lib/star_key";
import type { BodyPoint } from "@/lib/types";
import { JOREI_BY_MONTH_BRANCH } from "@/lib/jorei_shitsugai";
import { KOKU_MAP, type Star as KokuStar, type Palace as KokuPalace } from "@/lib/koku_rei_eiki";
import { SHITTEN_MAP, type Star as ShittenStar } from "@/lib/shitten";


type StarKey = string;

const LON_OFFSET_DEG = 150; // ← ここを 30刻みで調整する（例: 30, 60, -30 など）
const DEBUG_KAKKYOKU = false; // trueでデバッグログを出す

export const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi;

export const getLon = (ctx: any, starKey: StarKey): number | null => {
  const v = ctx?.lonByStarKey?.[starKey];
  return Number.isFinite(v) ? Number(v) : null;
};

export const getPal = (ctx: any, starKey: StarKey): string | null => {
  const v = ctx?.palaceByStarKey?.[starKey];
  return v ? String(v) : null;
};


export const BRANCH_ORDER_B = ["戌","亥","子","丑","寅","卯","辰","巳","午","未","申","酉"];

export const isAdjacent = (a: string, b: string) => {
  const ia = BRANCH_ORDER_B.indexOf(a);
  const ib = BRANCH_ORDER_B.indexOf(b);
  if (ia < 0 || ib < 0) return false;
  const d = Math.abs(ia - ib);
  return d === 1 || d === BRANCH_ORDER_B.length - 1;
};

export const PALACE_MAIN_STAR: Record<string, StarKey> = {
  "子":"土","丑":"土","寅":"木","卯":"火","辰":"金","巳":"水",
  "午":"日","未":"月","申":"水","酉":"金","戌":"火","亥":"木",
};

export const mingMainStarKey = (ctx: any): StarKey | null => {
  const ming = ctx?.mingBranch ? String(ctx.mingBranch) : null;
  if (!ming) return null;
  return PALACE_MAIN_STAR[ming] ?? null;
};

function palaceFromLon(lonDeg: number) {
  const lon = ((lonDeg % 360) + 360) % 360;

  if (lon >= 240 && lon < 270) return "寅" as any;
  if (lon >= 210 && lon < 240) return "卯" as any;
  if (lon >= 180 && lon < 210) return "辰" as any;
  if (lon >= 150 && lon < 180) return "巳" as any;
  if (lon >= 120 && lon < 150) return "午" as any;
  if (lon >= 90  && lon < 120) return "未" as any;
  if (lon >= 60  && lon < 90 ) return "申" as any;
  if (lon >= 30  && lon < 60 ) return "酉" as any;
  if (lon >= 0   && lon < 30 ) return "戌" as any;
  if (lon >= 330 && lon < 360) return "亥" as any;
  if (lon >= 300 && lon < 330) return "子" as any;
  if (lon >= 270 && lon < 300) return "丑" as any;

  return "" as any;
}



export type Sex = "M" | "F";

export type KakkyokuResult = {
  name: string;
  luck: "吉" | "凶";
  why?: string;
};

export type KakkyokuContext = {
  sex: Sex;
  isDayBirth: boolean;
  monthBranch?: Branch;
  mingBranch?: Branch;
  /** 身宮の十二支。buildKakkyokuContext がセット済み（型定義がこれまで欠けていた）。 */
  shenBranch?: Branch;
  shenShaByPalace?: Record<Branch, string[]>;
  bodies: Array<{
    key: string;
    label: string;
    lon: number;
    palace: Branch;
    mansion?: string;
  }>;
};

function norm360(x: number) {
  return ((x % 360) + 360) % 360;
}

const angDist = (a: number, b: number) => {
  const d = Math.abs(norm360(a) - norm360(b));
  return Math.min(d, 360 - d);
};

export function isKaiGou(lonA: number, lonB: number) {
  return angDist(lonA, lonB) <= 10;
}

export function isKouKai(lonA: number, lonB: number) {
  const d = angDist(lonA, lonB);
  return d >= 110 && d <= 130;
}

const STAR_KEY_ALIASES: Record<string, string[]> = {
  "太陽": ["太陽", "日"],
  "日": ["日", "太陽"],
  "太陰": ["太陰", "月"],
  "月": ["月", "太陰"],
  "水星": ["水星", "水"],
  "水": ["水", "水星"],
  "金星": ["金星", "金"],
  "金": ["金", "金星"],
  "火星": ["火星", "火"],
  "火": ["火", "火星"],
  "木星": ["木星", "木"],
  "木": ["木", "木星"],
  "土星": ["土星", "土"],
  "土": ["土", "土星"],
  "羅劫": ["羅劫", "羅喉"],
  "羅喉": ["羅喉", "羅劫"],
  "計都": ["計都"],
  "月孛": ["月孛"],
  "紫炁": ["紫炁", "紫気"],
  "紫気": ["紫気", "紫炁"],
  "羅": ["羅","羅劫","羅喉"],
  "計": ["計","計都"],
  "孛": ["孛","月孛"],
  "炁": ["炁","紫炁","紫気","紫気","紫炁"],
};

function findOne(ctx: any, key: string) {
  const bodies = (ctx?.bodies ?? []) as any[];
  const keys = STAR_KEY_ALIASES[key] ?? [key];

  for (const k of keys) {
    // bodies 側の key は normalizeStarKey() 済みなので、こちらも正規化して照合する
    const nk = normalizeStarKey(k);

    const hit =
      bodies.find((b) => b?.key === nk) ??
      bodies.find((b) => b?.label === k) ??
      bodies.find((b) => String(b?.label ?? "").includes(k));

    if (hit) return hit;
  }
  return undefined;
}

function inPalace(ctx: KakkyokuContext, starKey: string, palace: Branch) {
  const b = findOne(ctx, starKey);
  return !!b && String((b as any).palace) === String(palace);
}

function inAnyPalace(ctx: KakkyokuContext, starKey: string, pals?: Branch[]) {
  if (!Array.isArray(pals) || pals.length === 0) return false;
  return pals.some((p) => inPalace(ctx, starKey, p));
}

function samePalace(ctx: KakkyokuContext, a: string, b: string) {
  const A = findOne(ctx, a);
  const B = findOne(ctx, b);
  return !!A && !!B && String((A as any).palace) === String((B as any).palace);
}

function allSamePalace(ctx: KakkyokuContext, stars: string[]) {
  const pts = stars.map((s) => findOne(ctx, s)).filter(Boolean) as any[];
  if (pts.length !== stars.length) return false;
  return pts.every((p) => String(p.palace) === String(pts[0].palace));
}

function rahuKetuZiWu(ctx: KakkyokuContext) {
  return (
    (inPalace(ctx, "羅劫", "子" as any) && inPalace(ctx, "計都", "午" as any)) ||
    (inPalace(ctx, "羅劫", "午" as any) && inPalace(ctx, "計都", "子" as any))
  );
}


export function buildKakkyokuContext(args: {
  bodies: BodyPoint[];
  sex: Sex;
  isDayBirth: boolean;
  monthBranch?: Branch;
  mingBranch?: Branch;
  shenBranch?: Branch;
  shenShaByPalace?: Record<Branch, string[]>;
}): KakkyokuContext {

const bodies = (args.bodies ?? []).map((b: any, i: number) => {
    const raw = Number(b?.lonDeg);

  // ★デバッグ用キー
  const dbgKey = String(b?.key ?? b?.name ?? i);

  // ★盤面表示基準：raw を 0..360 正規化した値（反転・オフセット禁止）
  const lonBoard = norm360(raw);

    const palace = palaceFromLon(lonBoard) as Branch;

    // ★二十八宿も「盤面角度 lonBoard」で取る
    const m = lonToMansionDeg(lonBoard) as any;
    const mansion = m?.mansion?.label ? String(m.mansion.label) : undefined;

    const label = String(b?.label ?? "").trim();
    const key = normalizeStarKey(label);

    return { key, label, lon: lonBoard, palace, mansion,lonDegRaw: raw,
    lonDegBoard: lonBoard };
  });

  return {
    sex: args.sex,
    isDayBirth: args.isDayBirth,
    monthBranch: args.monthBranch,
    mingBranch: args.mingBranch,
    shenShaByPalace: args.shenShaByPalace,
    shenBranch: args.shenBranch,
    bodies,
  };
}

export function evalKakkyoku(ctx: KakkyokuContext) {
  const bodies = ctx.bodies; 
  const good: KakkyokuResult[] = [];
  const bad: KakkyokuResult[] = [];
  
  const push = (r: KakkyokuResult) => {
    if (r.luck === "吉") {
  good.push(r);
} else {
  bad.push(r);
}
  }; 

    // ===== ここから追加（push の直後）=====

  type Rule = {
    name: string;
    luck: "吉" | "凶";
    when: () => boolean;
    why?: string;
  };

  const RULES: Rule[] = [];

  const add = (name: string, luck: "吉" | "凶", when: () => boolean, why?: string) => {
    // 同名ルールは重複登録しない（React key 重複・表示重複防止）
    if (RULES.some(r => r.name === name)) return;
    RULES.push({ name, luck, when, why });
  };

  // 宮（十二支）チェックの薄いラッパ（引数事故防止）
  const inP = (star: string, pal: Branch) => inPalace(ctx, star, pal);
  const inAny = (star: string, pals: Branch[]) => inAnyPalace(ctx, star, pals);
  const sameP = (a: string, b: string) => samePalace(ctx, a, b);
  const allSameP = (stars: string[]) => allSamePalace(ctx, stars);

  // =====================================================
  // 互換ヘルパ（未定義事故の防止）
  // =====================================================
  const palaceOf = (k: string): Branch | null => {
    const b: any = findOne(ctx, k as any);
    return b?.palace ? (String(b.palace) as any) : null;
  };
  const lonOf = (k: string): number | null => {
    const b: any = findOne(ctx, k as any);
    const v = b?.lon;
    return Number.isFinite(v) ? Number(v) : null;
  };

  // 宮の順序（あなたの盤面定義に合わせて固定）
  const BR = BRANCH_ORDER_B as unknown as Branch[];

  const idxOf = (p: Branch) => BR.indexOf(p as any);

  // 宮同士の距離（BR の順序で 0..11）
  // 例：子→午 は 6
  const step = (from: Branch, to: Branch): number => {
    const i1 = idxOf(from);
    const i2 = idxOf(to);
    if (i1 < 0 || i2 < 0) return -1;
    return (i2 - i1 + 12) % 12;
  };

  const stepPalace = (p: Branch, step: number): Branch => {
    const i = idxOf(p);
    if (i < 0) return p;
    return BR[(i + step + 12) % 12] as Branch;
  };

  // 夾：ターゲット宮の両隣（±1）を2星が挟む
  const isKyo = (k1: string, k2: string, target: Branch): boolean => {
    const p1 = palaceOf(k1);
    const p2 = palaceOf(k2);
    if (!p1 || !p2) return false;
    const left2 = stepPalace(target, -1);
    const right2 = stepPalace(target, +2);
    return (p1 === left2 && p2 === right2) || (p2 === left2 && p1 === right2);
  };

// 拱（三合）：target と k1/k2 の宮が同一三合（3宮セット）を構成する
// ＝ target の属する三合グループ内に p1 と p2 が含まれる（p1,p2 は target と別宮）
const isKo = (k1: string, k2: string, target: Branch): boolean => {
  const p1 = palaceOf(k1);
  const p2 = palaceOf(k2);
  if (!p1 || !p2) return false;
  if (p1 === p2) return false;          // 同一宮2星は「拱」にならない前提（必要なら外す）
  if (p1 === target || p2 === target) return false; // target同宮は拱ではなく同宮扱い

  // 三合グループ判定（TRINE_GROUPS を既存のまま使用）
  const group = (TRINE_GROUPS as readonly Branch[][]).find(g => g.includes(target));
  if (!group) return false;

  // 同じ三合内で、target以外の2宮にそれぞれ入っていること
  const others = group.filter(b => b !== target);
  return (
    (p1 === others[0] && p2 === others[1]) ||
    (p1 === others[1] && p2 === others[0])
  );
};

  // 既存ルール互換（古い呼び名）
  // 夾=両隣を挟む / 拱=三合（target含む三合の残り2宮に各1星）
  const isJia = (target: Branch, k1: string, k2: string) => isKyo(k1, k2, target);
  const isGong = (target: Branch, k1: string, k2: string) => isKo(k1, k2, target);

  
  // 十一曜（七政＋四餘）
const ELEVEN = ["日","月","水","金","火","木","土","炁","孛","羅","計"] as const;

// 十一曜拱（三合）：target 宮と同三合の「残り2宮」に
// それぞれ十一曜が1つ以上入っていれば成立（= 1星ずつ）
//
// 例：申がtargetなら三合は {申,子,辰} → 子に1星以上 & 辰に1星以上 で成立
const isElevenGong = (target: Branch): boolean => {
  // target を含む三合の3宮を取得（例：{申,子,辰}）
  const tri = (TRINE_GROUPS as any).find((g: Branch[]) => g.includes(target)) as Branch[] | undefined;
  if (!tri) return false;

  // 残り2宮
  const others = tri.filter(p => p !== target) as Branch[];
  if (others.length !== 2) return false;
  const [p1, p2] = others;

  let has1 = false;
  let has2 = false;

  for (const k of ELEVEN) {
    const p = palaceOf(k);
    if (!p) continue;
    if (p === p1) has1 = true;
    if (p === p2) has2 = true;
    if (has1 && has2) return true; // 両方に最低1つずつ必要
  }
  return false;
};

  // 入垣（= 七政入垣と同じ定義）
  const isRuYuan = (k: string): boolean => {
    const p = palaceOf(k);
    if (!p) return false;
    if (k === "日") return p === ("午" as any);
    if (k === "月") return p === ("未" as any);
    const map: Record<string, Branch[]> = {
      "木": ["寅", "亥"] as any,
      "火": ["卯", "戌"] as any,
      "土": ["子", "丑"] as any,
      "金": ["辰", "酉"] as any,
      "水": ["巳", "申"] as any,
    };
    const ys = map[k];
    return !!ys && ys.includes(p);
  };

  // 廟/旺（まだ無ければ false：kakkyoku2 用）
  const isMiao = (k: string): boolean => {
    const b: any = findOne(ctx, k as any);
    return !!(
      b?.miao ||
      b?.isMiao ||
      b?.dignity === "廟" ||
      b?.dignity === "miao" ||
      b?.dignity === "廟旺" ||
      b?.dignity === "miao_wang"
    );
  };
  const isWang = (k: string): boolean => {
    const b: any = findOne(ctx, k as any);
    return !!(
      b?.wang ||
      b?.isWang ||
      b?.dignity === "旺" ||
      b?.dignity === "wang" ||
      b?.dignity === "廟旺" ||
      b?.dignity === "miao_wang"
    );
  };

  // =====================================================
  // 朔・上弦・望・下弦（盤上の黄経差で判定）
  //  - 朔：0° / 上弦：90° / 望：180° / 下弦：270°
  // =====================================================
  const angDiff = (a: number, b: number) => ((a - b) % 360 + 360) % 360; // 0..360
  const nearAngle = (a: number | null, b: number | null, target: number, tol = 3) => {
    if (a == null || b == null) return false;
    const d = angDiff(a, b);
    const e = Math.min(Math.abs(d - target), 360 - Math.abs(d - target));
    return e <= tol;
  };

  const sunLon = () => lonOf("日");
  const moonLon = () => lonOf("月");

  const isNewMoon = () => nearAngle(moonLon(), sunLon(), 0, 3);     // 朔
  const isFirstQ = () => nearAngle(moonLon(), sunLon(), 90, 3);     // 上弦
  const isFullMoon = () => nearAngle(moonLon(), sunLon(), 180, 3);  // 望
  const isLastQ = () => nearAngle(moonLon(), sunLon(), 270, 3);     // 下弦

// =====================================================
// 対神（180°反対宮）/ 三方（三合）/ 先後（度数順） ヘルパ
// =====================================================

// 12宮の並びは、あなたの盤面定義に合わせること（既にあるならそれを使う）
const BR_ORDER: Branch[] = ([
  "戌","亥","子","丑","寅","卯","辰","巳","午","未","申","酉",
] as any);

// ① 対神（反対宮=180°）
// 例：子↔午、卯↔酉…（12宮なので +6）
const oppositePalace = (pal: Branch): Branch | null => {
  const i = idxOf(pal);
  if (i < 0) return null;
  return BR_ORDER[(i + 6) % 12] as Branch;
};

// 「A が B の対神（反対宮）にいるか」
const isOpposite = (aPal: Branch, bPal: Branch) => {
  const opp = oppositePalace(aPal);
  return !!opp && opp === bPal;
};

// ② 三方（三合）
// 例：申子辰 / 寅午戌 / 巳酉丑 / 亥卯未
const TRINE_GROUPS: Branch[][] = ([
  ["申","子","辰"],
  ["寅","午","戌"],
  ["巳","酉","丑"],
  ["亥","卯","未"],
] as any);

const trineOf = (pal: Branch): Branch[] | null => {
  const g = TRINE_GROUPS.find(x => x.includes(pal));
  return g ?? null;
};

// 「同じ三合か」
const isSameTrine = (a: Branch, b: Branch) => {
  const ga = trineOf(a);
  return !!ga && ga.includes(b);
};

// 「ターゲット宮の三合（三方）を返す」
const threeDirections = (target: Branch): Branch[] | null => trineOf(target);

const isBefore = (aKey: string, bKey: string): boolean => {
  const a = lonOf(aKey);
  const b = lonOf(bKey);
  if (a == null || b == null) return false;
  return a < b;
};

const sortKeysByLon = (keys: string[]): string[] => {
  return [...keys].sort((ka, kb) => {
    const a = lonOf(ka);
    const b = lonOf(kb);
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return a - b;
  });
};

const toKokuStar = (starKey: string): KokuStar | null => {
  // kakkyoku側の星キー → koku_rei_eiki.ts の Star へ寄せる
  // ※ここは「今のプロジェクトで使っている starKey 表記」に合わせて最小限
  switch (starKey) {
    case "木":
    case "木星":
      return "木星";
    case "火":
    case "火星":
      return "火星";
    case "土":
    case "土星":
      return "土星";
    case "金":
    case "金星":
      return "金星";
    case "水":
    case "水星":
      return "水星";
    case "炁":
    case "氣":
    case "紫炁":
      return "紫炁";
    case "孛":
    case "月孛":
      return "月孛";
    case "羅":
    case "羅劫":
      return "羅劫";
    case "計":
    case "計都":
      return "計都";
    default:
      return null;
  }
};

const kokuHas = (starKey: string, type: "受尅" | "失令" | "泄気"): boolean => {
  const ks = toKokuStar(starKey);
  if (!ks) return false;

  const pal = palaceOf(starKey as any);
  if (!pal) return false;

  const list = (KOKU_MAP as any)[ks]?.[pal as KokuPalace] ?? [];
  return Array.isArray(list) && list.includes(type);
};

const isUke = (starKey: string): boolean => kokuHas(starKey, "受尅");
const isShitsurei = (starKey: string): boolean => kokuHas(starKey, "失令");
const isXieqi = (starKey: string): boolean => kokuHas(starKey, "泄気");

const toShittenStar = (starKey: string): ShittenStar | null => {
  // kakkyoku側の星キー → shitten.ts の Star へ寄せる
  switch (starKey) {
    case "日":
    case "太陽":
      return "日";
    case "月":
      return "月";
    case "水":
    case "水星":
      return "水";
    case "金":
    case "金星":
      return "金";
    case "火":
    case "火星":
      return "火";
    case "木":
    case "木星":
      return "木";
    case "土":
    case "土星":
      return "土";
    case "炁":
    case "氣":
    case "紫炁":
      return "紫炁";
    case "孛":
    case "月孛":
      return "月孛";
    case "羅":
    case "羅劫":
      return "羅劫";
    case "計":
    case "計都":
      return "計都";
    default:
      return null;
  }
};

const isShitten = (starKey: string): boolean => {
  const s = toShittenStar(starKey);
  if (!s) return false;

  const b: any = findOne(ctx, starKey as any);
  const mansion = String(b?.mansion ?? "");
  if (!mansion) return false;

  return SHITTEN_MAP[s].includes(mansion);
};
  
  // evalKakkyoku(ctx) の中：helper 群の近くに追加

const isSevenGov = (starKey: string): boolean => {
  // 七政：日/月/木/火/土/金/水
  const k = String(starKey);
  return k === "日" || k === "太陽" || k === "月"
      || k === "木" || k === "火" || k === "土" || k === "金" || k === "水"
      || k === "木星" || k === "火星" || k === "土星" || k === "金星" || k === "水星";
};

const isXianJi = (starKey: string): boolean => {
  if (!ctx.mingBranch) return false;
  if (!isSevenGov(starKey)) return false;
  const sib = palaceByOffsetFromMing(PAL_OFF.兄弟);
  if (!sib) return false;
  const pal = palaceOf(starKey as any);
  return !!pal && pal === sib;
};

const elementOfStar = (starKey: string): "木" | "火" | "土" | "金" | "水" | null => {
  const s = String(starKey);

  // 七政：太陽=火、太陰(月)=土、金星=金、水星=水、火星=火、土星=土、木星=木
  if (s === "日" || s === "太陽") return "火";
  if (s === "月" || s === "太陰") return "土";

  if (s === "木" || s === "木星") return "木";
  if (s === "火" || s === "火星") return "火";
  if (s === "土" || s === "土星") return "土";
  if (s === "金" || s === "金星") return "金";
  if (s === "水" || s === "水星") return "水";

  return null; // 四余などは乗令対象外
};

const isChengLing = (starKey: string): boolean => {
  const mb = ctx?.monthBranch ? String(ctx.monthBranch) : "";
  if (!mb) return false;

  const need = (JOREI_BY_MONTH_BRANCH as any)[mb] as ("木" | "火" | "土" | "金" | "水" | undefined);
  if (!need) return false;

  const e = elementOfStar(starKey);
  return !!e && e === need;
};
  
 // 失垣（2列対応・確定版）
const hasShitsugai = (starKey: string): boolean => {
  const pal = palaceOf(starKey as any);
  if (!pal) return false;

  const key = String(starKey);

  const map: Record<string, string[]> = {
    太陽: ["未"],
    日: ["未"],
    月: ["午"],
    太陰: ["午"],

    木: ["丑", "子"],
    木星: ["丑", "子"],

    火: ["酉", "辰"],
    火星: ["酉", "辰"],

    土: ["申", "巳"],
    土星: ["申", "巳"],

    金: ["亥", "寅"],
    金星: ["亥", "寅"],

    水: ["戌", "卯"],
    水星: ["戌", "卯"],

    炁: ["丑", "子"],
    氣: ["丑", "子"],
    紫炁: ["丑", "子"],

    孛: ["戌", "卯"],
    月孛: ["戌", "卯"],

    羅: ["酉", "辰"],
    羅劫: ["酉", "辰"],

    計: ["申", "巳"],
    計都: ["申", "巳"],
  };

  const list = map[key];
  return Array.isArray(list) && list.includes(String(pal));
};
  
  // ---------------
// 宿（mansion）判定ヘルパ
// ---------------
function inMansion(ctx: KakkyokuContext, starKey: string, mansions: string[]) {
  const b = findOne(ctx, starKey);
  if (!b) return false;
  const m = String((b as any).mansion ?? "");
  return mansions.includes(m);
}

// ---------------
// kakkyoku1.txt（凶：宿判定）
// 「月躔月度」太陽が 心/張/危/畢 に入る
// 「日躔日宿」「月躔日宿」月が 星/虚/房/昴 に入る
// ---------------
if (inMansion(ctx, "日", ["心","張","危","畢"])) {
  push({ name: "日躔月度", luck: "凶", why: "日 in 心/張/危/畢" });
}
if (inMansion(ctx, "月", ["星","虚","房","昴"])) {
  push({ name: "月躔日宿", luck: "凶", why: "月 in 星/虚/房/昴" });
}

// ---------------
// kakkyoku1.txt（吉：升殿）
// ---------------
if (inMansion(ctx, "木", ["女","胃","柳","氐"])) {
  push({ name: "木星升殿", luck: "吉", why: "木 in 女/胃/柳/氐" });
}
if (inMansion(ctx, "土", ["角","斗","奎","井"])) {
  push({ name: "土星升殿", luck: "吉", why: "土 in 角/斗/奎/井" });
}
if (inMansion(ctx, "水", ["箕","壁","参","軫"])) {
  push({ name: "水星升殿", luck: "吉", why: "水 in 箕/壁/参/軫" });
}
if (inMansion(ctx, "金", ["亢","牛","妻","鬼"])) {
  push({ name: "金星升殿", luck: "吉", why: "金 in 亢/牛/妻/鬼" });
}
if (inMansion(ctx, "火", ["尾","室","壁","觜","翼"])) {
  push({ name: "火星升殿", luck: "吉", why: "火 in 尾/室/壁/觜/翼" });
}

  
// ---- kakkyoku1（吉：単純条件）----
// ---- 格局（STEP1：単純条件のみ。宮/宿/同宮）----
add("日居日位", "吉", () => inP("日","午" as any), "日 in 午");
add("月入月垣", "吉", () => inP("月","未" as any), "月 in 未");
add("日至日躔", "吉", () => inMansion(ctx,"日",["星","虚","房","昴"]), "日 in 星/虚/房/昴");
add("月升月殿", "吉", () => inMansion(ctx,"月",["張","危","畢","星"]), "月 in 張/危/畢/星");
add("日東月西", "吉", () => inAny("日",["寅","卯","辰"] as any) && inAny("月",["申","酉","戌"] as any), "日 in 寅卯辰 & 月 in 申酉戌");
add("日南月北", "吉", () => inAny("日",["巳","午","未"] as any) && inAny("月",["亥","子","丑"] as any), "日 in 巳午未 & 月 in 亥子丑");
add("日月居垣", "吉", () => inP("日","午" as any) && inP("月","未" as any), "日 in 午 & 月 in 未");
add("日月升殿", "吉", () => inMansion(ctx,"日",["星","虚","房","昴"]) && inMansion(ctx,"月",["張","危","畢","星"]), "日:星/虚/房/昴 & 月:張/危/畢/星");
add("日居月位", "凶", () => inP("日","未" as any), "日 in 未");
add("月到日宮", "凶", () => inP("月","午" as any), "月 in 午");
add("日北月南", "凶", () => inAny("日",["亥","子","丑"] as any) && inAny("月",["巳","午","未"] as any), "日 in 亥子丑 & 月 in 巳午未");
add("日西月東", "凶", () => inAny("日",["申","酉","戌"] as any) && inAny("月",["寅","卯","辰"] as any), "日 in 申酉戌 & 月 in 寅卯辰");
add("金木共躔", "凶", () => samePalace(ctx,"金","木"), "金と木が同宮");
add("土水相激", "凶", () => samePalace(ctx,"土","水"), "土と水が同宮");
add("陰陽得地", "吉", () => inAny("日",["辰","巳"] as any) && inAny("月",["戌","亥"] as any), "日 in 辰/巳 & 月 in 戌/亥");
add("日月失所", "凶", () => inAny("日",["戌","亥"] as any) && inAny("月",["辰","巳"] as any), "日 in 戌/亥 & 月 in 辰/巳");
add("歳星居垣", "吉", () => inAny("木",["寅","亥"] as any), "木 in 寅/亥");
add("熒惑居垣", "吉", () => inAny("火",["卯","戌"] as any), "火 in 卯/戌");
add("鎮星居垣", "吉", () => inAny("土",["子","丑"] as any), "土 in 子/丑");
add("太白居垣", "吉", () => inAny("金",["辰","酉"] as any), "金 in 辰/酉");
add("辰星居垣", "吉", () => inAny("水",["巳","申"] as any), "水 in 巳/申");
add("木星升殿", "吉", () => inMansion(ctx,"木",["女","胃","柳","氐"]), "木 in 女/胃/柳/氐");
add("土星升殿", "吉", () => inMansion(ctx,"土",["角","斗","奎","井"]), "土 in 角/斗/奎/井");
add("水星升殿", "吉", () => inMansion(ctx,"水",["箕","壁","参","軫"]), "水 in 箕/壁/参/軫");
add("金星升殿", "吉", () => inMansion(ctx,"金",["亢","牛","妻","鬼"]), "金 in 亢/牛/妻/鬼");
add("火星升殿", "吉", () => inMansion(ctx,"火",["尾","室","壁","觜","翼"]), "火 in 尾/室/壁/觜/翼");
add("木入金郷", "凶", () => inAny("木",["辰","酉"] as any), "木 in 辰/酉");
add("火居水地", "凶", () => inAny("火",["巳","申"] as any), "火 in 巳/申");
add("土在木宮", "凶", () => inAny("土",["寅","亥"] as any), "土 in 寅/亥");
add("金乗火位", "凶", () => inAny("金",["卯","戌"] as any), "金 in 卯/戌");
add("水居土室", "凶", () => inAny("水",["子","丑"] as any), "水 in 子/丑");
add("火到金郷", "凶", () => inAny("火",["辰","酉"] as any), "火 in 辰/酉");
add("土居水地", "凶", () => inAny("土",["巳","申"] as any), "土 in 巳/申");
add("金在木宮", "凶", () => inAny("金",["寅","亥"] as any), "金 in 寅/亥");
add("水乗火位", "凶", () => inAny("水",["卯","戌"] as any), "水 in 卯/戌");
add("木入土室", "凶", () => inAny("木",["子","丑"] as any), "木 in 子/丑");
add("水火同歩", "凶", () => samePalace(ctx,"水","火"), "水と火が同宮");
add("木土相尅", "凶", () => samePalace(ctx,"木","土"), "木と土が同宮");
add("火金交戦", "凶", () => samePalace(ctx,"火","金"), "火と金が同宮");


  
add("羅計中分", "吉", () => inP("羅", "午" as any) && inP("計", "子" as any), "羅=午 計=子");
add("出乾入巽", "吉", () => inP("羅", "亥" as any) && inP("計", "巳" as any), "羅=亥 計=巳");
add("一星跳垣", "吉", () => inAny("羅", ["寅", "卯"] as any), "羅=寅/卯");

// 首尾陰陽居四正：羅・計・日・月 が四正（子午卯酉）に入る
add(
  "首尾陰陽居四正",
  "吉",
  () => ["羅", "計", "日", "月"].every((k) => inAny(k, ["子", "午", "卯", "酉"] as any)),
  "羅/計/日/月 ∈ 子午卯酉"
);

// 追加：日月の宮だけ（盤面基準）

add("日居日位", "吉", () => inP("日", "午" as any), "日=午");
add("月入月垣", "吉", () => inP("月", "未" as any), "月=未");

add(
  "日東月西",
  "吉",
  () => inAny("日", ["寅","卯","辰"] as any) && inAny("月", ["申","酉","戌"] as any),
  "日=寅卯辰 & 月=申酉戌"
);

add(
  "日南月北",
  "吉",
  () => inAny("日", ["巳","午","未"] as any) && inAny("月", ["亥","子","丑"] as any),
  "日=巳午未 & 月=亥子丑"
);

add("日月居垣", "吉", () => inP("日", "午" as any) && inP("月", "未" as any), "日=午 & 月=未");

// 追加：日月の宮だけ（盤面基準）

add("日居日位", "吉", () => inP("日", "午" as any), "日=午");
add("月入月垣", "吉", () => inP("月", "未" as any), "月=未");

add(
  "日東月西",
  "吉",
  () => inAny("日", ["寅","卯","辰"] as any) && inAny("月", ["申","酉","戌"] as any),
  "日=寅卯辰 & 月=申酉戌"
);

add(
  "日南月北",
  "吉",
  () => inAny("日", ["巳","午","未"] as any) && inAny("月", ["亥","子","丑"] as any),
  "日=巳午未 & 月=亥子丑"
);

add("日月居垣", "吉", () => inP("日", "午" as any) && inP("月", "未" as any), "日=午 & 月=未");

add("計孛同宮", "凶", () => samePalace(ctx,"計","孛"), "計と孛が同宮");
add("水計相刑", "凶", () => samePalace(ctx,"水","計"), "水と計が同宮");
add("土孛混雑", "凶", () => samePalace(ctx,"土","孛"), "土と孛が同宮");
add("金羅同尅", "凶", () => samePalace(ctx,"金","羅"), "金と羅が同宮");
add("火孛共戦", "凶", () => samePalace(ctx,"火","孛"), "火と孛が同宮");
add("四餘独歩", "吉", () => {
  const shi = ["炁","孛","羅","計"] as const;
  const ps = shi.map(k => findOne(ctx, k as any)?.palace).filter(Boolean) as any[];
  if (ps.length !== 4) return false;
  // 四餘が全て別宮
  if (new Set(ps).size !== 4) return false;
  // 七政と同宮がない
  const seven = ["日","月","水","金","火","木","土"] as const;
  for (const s of seven) {
    const p = findOne(ctx, s as any)?.palace;
    if (p && ps.includes(p)) return false;
  }

  return true;
},
  "四餘（炁・孛・羅・計）がそれぞれ別宮にあり、かつ各宮に七政（日月水金火木土）が同宮しない"
);


// 羅計欄載：昼→羅=辰/巳、夜→計=未/申
add(
  "羅計欄載",
  "吉",
  () => {
    if (ctx.isDayBirth) return inAny("羅", ["辰", "巳"] as any);
    return inAny("計", ["未", "申"] as any);
  },
  "昼:羅=辰/巳 or 夜:計=未/申"
);



// 水火既済：水=子 火=午 かつ 命宮が子/午（命宮が無ければ不成立）
add(
  "水火既済",
  "吉",
  () =>
    !!ctx.mingBranch &&
    inP("水", "子" as any) &&
    inP("火", "午" as any) &&
    (ctx.mingBranch === ("子" as any) || ctx.mingBranch === ("午" as any)),
  "水=子 火=午 & 命宮=子/午"
);

// 水火相射：水=午 & 火=子  OR  (水=卯/戌 & 火=巳/申)
add(
  "水火相射",
  "凶",
  () =>
    (inP("水", "午" as any) && inP("火", "子" as any)) ||
    (inAny("水", ["卯", "戌"] as any) && inAny("火", ["巳", "申"] as any)),
  "水午火子 or 水卯戌&火巳申"
);

// 日月聯輝：日/月/水/金/火/木/土 が全て同宮
add(
  "日月聯輝",
  "吉",
  () => {
    const keys = ["日","月","水","金","火","木","土"] as const;
    const ps = keys.map(k => findOne(ctx, k as any)?.palace).filter(Boolean) as any[];
    if (ps.length !== keys.length) return false;
    return new Set(ps).size === 1;
  },
  "七政が全て同宮"
);

// ---- 追加（既存一覧に無いものだけ：廟/旺を使用）----

// 廟 or 旺 判定（既存の実装形に依存しない保険）
const _isMiaoOrWang = (k: any) => {
  const b: any = findOne(ctx, k);
  if (!b) return false;

  // よくある持ち方を全部拾う（どれか1つでも true ならOK）
  return !!(
    b.miao ||
    b.wang ||
    b.isMiao ||
    b.isWang ||
    b.dignity === "廟" ||
    b.dignity === "旺" ||
    b.dignity === "廟旺" ||
    b.dignity === "miao" ||
    b.dignity === "wang" ||
    b.dignity === "miao_wang"
  );
};

// 木羅会舎：月支=亥/子/寅/卯 ＆ 木と羅が同宮 ＆（木が廟or旺）
add(
  "木羅会舎",
  "吉",
  () =>
    !!ctx.monthBranch &&
    (["亥", "子", "寅", "卯"] as any[]).includes(ctx.monthBranch as any) &&
    samePalace(ctx, "木", "羅") &&
    _isMiaoOrWang("木"),
  "月支=亥子寅卯 & 木=羅(同宮) & 木が廟/旺"
);

// 火炁職権：火と炁が同宮 ＆（火が廟or旺）
add(
  "火炁職権",
  "吉",
  () => samePalace(ctx, "火", "炁") && _isMiaoOrWang("火"),
  "火=炁(同宮) & 火が廟/旺"
);

// 木孛符印：月支≠子 ＆ 木と孛が同宮 ＆（木が廟or旺）
add(
  "木孛符印",
  "吉",
  () =>
    !!ctx.monthBranch &&
    (ctx.monthBranch as any) !== ("子" as any) &&
    samePalace(ctx, "木", "孛") &&
    _isMiaoOrWang("木"),
  "月支≠子 & 木=孛(同宮) & 木が廟/旺"
);
// =====================================================
// STEP B：身宮（身主／命主）系
// =====================================================

// KakkyokuContext には shenLordKey / mingLordKey / shenBranch が入っている前提。
// もし未設定なら buildKakkyokuContext 側でセットする（既存の十二宮主星表を使用）。
const getShenLordKey = (): string | null => (ctx as any).shenLordKey ?? null;
const getMingLordKey = (): string | null => (ctx as any).mingLordKey ?? null;

const getShenBranch = (): Branch | null => (ctx as any).shenBranch ?? null;

// 身主/命主が入るべき「垣」（入垣）定義（七政の既存入垣と同じ）
const isInYuan = (k: string): boolean => {
  const p = palaceOf(k);
  if (!p) return false;
  // 日/月は既に STEP1 にあるので、身主が日月の場合も一応許容
  if (k === "日") return p === ("午" as any);
  if (k === "月") return p === ("未" as any);

  const map: Record<string, Branch[]> = {
    "木": ["寅","亥"] as any,
    "火": ["卯","戌"] as any,
    "土": ["子","丑"] as any,
    "金": ["辰","酉"] as any,
    "水": ["巳","申"] as any,
  };
  const ys = map[k];
  return !!ys && ys.includes(p);
};

// 命宮起点で各宮ターゲット（順行）
const palaceByOffsetFromMing = (off: number): Branch | null => {
    if (!ctx.mingBranch) return null;
    // あなたの盤面定義（BRANCH_ORDER_B）では、命宮=子のとき「1宮進む」は 亥 方向。
    // つまりオフセットは -off（逆回り）で取る。
    return stepPalace(ctx.mingBranch, -off);
  };

const PAL_OFF = {
  命宮: 0,
  財帛: 1,
  兄弟: 2,
  田宅: 3,
  男女: 4,
  奴僕: 5,
  妻妾: 6,
  疾厄: 7,
  遷移: 8,
  官禄: 9,
  福徳: 10,
  相貌: 11,
} as const;

// 宮に神殺があるか（無ければ false）
const hasShenSha = (pal: Branch | null, name: string): boolean => {
  if (!pal) return false;
  const m = (ctx as any).shenShaByPalace as Record<string, string[]> | undefined;
  return !!m && Array.isArray(m[pal]) && m[pal].includes(name);
};

// 身主の所在宮（＝身主がいる十二支宮）
const shenLordPalace = (): Branch | null => {
  const k = getShenLordKey();
  if (!k) return null;
  return palaceOf(k) as any;
};

// 身星升殿：身宮主が昇殿する
add(
  "身星升殿",
  "吉",
  () => {
    const k = getShenLordKey();
    if (!k) return false;
    return isShengDian(k);
  },
  "身主が升殿"
);

// 身星入垣：身宮主が入垣する
add(
  "身星入垣",
  "吉",
  () => {
    const k = getShenLordKey();
    if (!k) return false;
    return isInYuan(k);
  },
  "身主が入垣"
);

// 身居財帛：身宮主が財帛宮に入る
add(
  "身居財帛",
  "吉",
  () => {
    if (!ctx.shenBranch) return false;
    const k = PALACE_MAIN_STAR[String(ctx.shenBranch)];
    if (!k) return false;
    const target = palaceByOffsetFromMing(PAL_OFF.財帛);
    return !!target && palaceOf(k) === target;
  },
  "身主が財帛宮"
);

// 身居田宅：身宮主が田宅宮に入る
add(
  "身居田宅",
  "吉",
  () => {
    const k = getShenLordKey();
    if (!k) return false;
    const target = palaceByOffsetFromMing(PAL_OFF.田宅);
    return !!target && palaceOf(k) === target;
  },
  "身主が田宅宮"
);


// 身宮清吉：身宮主が旺となる
add(
  "身宮清吉",
  "吉",
  () => {
    const k = getShenLordKey();
    if (!k) return false;
    return isWang(k);
  },
  "身主が旺"
);

// 身居妻妾：身宮主が夫妻宮（妻妾宮）に入る（女性は表示名を「就居夫位」）
add(
  (ctx.sex === "F" ? "就居夫位" : "身居妻妾") as any,
  "吉",
  () => {
    const k = getShenLordKey();
    if (!k) return false;
    const target = palaceByOffsetFromMing(PAL_OFF.妻妾);
    return !!target && palaceOf(k) === target;
  },
  "身主が妻妾宮"
);

// 身居官禄：身宮主が官禄宮に入る
add(
  "身居官禄",
  "吉",
  () => {
    const k = getShenLordKey();
    if (!k) return false;
    const target = palaceByOffsetFromMing(PAL_OFF.官禄);
    return !!target && palaceOf(k) === target;
  },
  "身主が官禄宮"
);

// 身坐崇勲：身主の所在宮 または 身宮 に「崇勲」
add(
  "身坐崇勲",
  "吉",
  () => {
    const pal1 = shenLordPalace();
    const pal2 = getShenBranch();
    return hasShenSha(pal1, "崇勲") || hasShenSha(pal2, "崇勲");
  },
  "身主所在宮/身宮に崇勲"
);

// 身星坐貴：身主の所在宮 または 身宮 に「貴人」
add(
  "身星坐貴",
  "吉",
  () => {
    const pal1 = shenLordPalace();
    const pal2 = getShenBranch();
    return hasShenSha(pal1, "貴人") || hasShenSha(pal2, "貴人");
  },
  "身主所在宮/身宮に貴人"
);

// 身臨卦気：身主の所在宮 または 身宮 に「卦気」
add(
  "身臨卦気",
  "吉",
  () => {
    const pal1 = shenLordPalace();
    const pal2 = getShenBranch();
    return hasShenSha(pal1, "卦気") || hasShenSha(pal2, "卦気");
  },
  "身主所在宮/身宮に卦気"
);

// 身居斗杓：身主の所在宮 または 身宮 に「斗杓」
add(
  "身居斗杓",
  "吉",
  () => {
    const pal1 = shenLordPalace();
    const pal2 = getShenBranch();
    return hasShenSha(pal1, "斗杓") || hasShenSha(pal2, "斗杓");
  },
  "身主所在宮/身宮に斗杓"
);

// 身坐長生：身主の所在宮 または 身宮 が「長生」
// ※「長生」は神殺として入っている想定。別名の場合はテーブル側に合わせて文字列を変更。
add(
  "身坐長生",
  "吉",
  () => {
    const pal1 = shenLordPalace();
    const pal2 = getShenBranch();
    return hasShenSha(pal1, "長生") || hasShenSha(pal2, "長生");
  },
  "身主所在宮/身宮が長生"
);

// =====================================================
// STEP C：命宮系（命主ベース）※アップ資料の順番通り（実装できる範囲）
// =====================================================

// 升殿判定（五行星のみ：kakkyoku1の「升殿」定義を流用）
const isShengDian = (k: any): boolean => {
  switch (k) {
    case "木": return inMansion(ctx, "木", ["女","胃","柳","氐"]);
    case "土": return inMansion(ctx, "土", ["角","斗","奎","井"]);
    case "水": return inMansion(ctx, "水", ["箕","壁","参","軫"]);
    case "金": return inMansion(ctx, "金", ["亢","牛","妻","鬼"]);
    case "火": return inMansion(ctx, "火", ["尾","室","壁","觜","翼"]);
    default: return false;
  }
};

// 命主キー（ctx.mingLordKey が無い場合は不成立）
const getMingLord = (): any | null => {
  const k = getMingLordKey();
  return k ? k : null;
};

// 「命主得経」：命宮主が昇殿する
add(
  "命主得経",
  "吉",
  () => {
    const lord = getMingLord();
    return !!ctx.mingBranch && !!lord && isShengDian(lord);
  },
  "命主が升殿"
);

// 「命主居垣」：命宮主が入垣する
add(
  "命主居垣",
  "吉",
  () => {
    const lord = getMingLord();
    return !!ctx.mingBranch && !!lord && isInYuan(lord);
  },
  "命主が入垣"
);

// 旧版格局「命主居財帛／命主居田宅／命主居妻妾」を削除。
//   現行APIによる等価版（命臨財帛／命臨田宅／命臨妻位）が別名で既に稼働中のため。

// 「命主清吉」：命宮主が旺となる
add(
  "命主清吉",
  "吉",
  () => {
    const lord = getMingLord();
    return !!ctx.mingBranch && !!lord && isWang(lord);
  },
  "命主が旺"
);

// 旧版格局「命主居官禄」を削除。現行APIによる等価版「命臨官禄」が既に稼働中のため。

// 「命坐崇勲」：命宮 or 命主の宮に 崇勲
add(
  "命坐崇勲",
  "吉",
  () => {
    if (!ctx.mingBranch) return false;
    const lord = getMingLord();
    const lordPal = lord ? palaceOf(lord) : undefined;
    return hasShenSha(ctx.mingBranch, "崇勲") || (!!lordPal && hasShenSha(lordPal, "崇勲"));
  },
  "命宮または命主の宮に崇勲"
);

// 「命坐貴人」：命宮 or 命主の宮に 貴人
add(
  "命坐貴人",
  "吉",
  () => {
    if (!ctx.mingBranch) return false;
    const lord = getMingLord();
    const lordPal = lord ? palaceOf(lord) : undefined;
    return hasShenSha(ctx.mingBranch, "貴人") || (!!lordPal && hasShenSha(lordPal, "貴人"));
  },
  "命宮または命主の宮に貴人"
);

// 「命坐斗杓」：命宮 or 命主の宮に 斗杓
add(
  "命坐斗杓",
  "吉",
  () => {
    if (!ctx.mingBranch) return false;
    const lord = getMingLord();
    const lordPal = lord ? palaceOf(lord) : undefined;
    return hasShenSha(ctx.mingBranch, "斗杓") || (!!lordPal && hasShenSha(lordPal, "斗杓"));
  },
  "命宮または命主の宮に斗杓"
);

// 「命坐長生」：命宮 or 命主の宮に 長生
add(
  "命坐長生",
  "吉",
  () => {
    if (!ctx.mingBranch) return false;
    const lord = getMingLord();
    const lordPal = lord ? palaceOf(lord) : undefined;
    return hasShenSha(ctx.mingBranch, "長生") || (!!lordPal && hasShenSha(lordPal, "長生"));
  },
  "命宮または命主の宮が長生"
);
  // （ELEVEN は上で定義済みを使用）
  const allInPal = (pal: Branch) => ELEVEN.every(k => palaceOf(k as any) === pal);
  const allInEither = (a: Branch, b: Branch) =>
    ELEVEN.every(k => {
      const p = palaceOf(k as any);
      return p === a || p === b;
    });

  const gongPals = (target: Branch) => ({ left: stepPalace(target, -2), right: stepPalace(target, +2) });
  const jiaPals  = (target: Branch) => ({ left: stepPalace(target, -1), right: stepPalace(target, +1) });

  const palByOffFromMing = (off: number): Branch | null => (ctx.mingBranch ? stepPalace(ctx.mingBranch as any, off) : null);

  const PAL_OFF2 = {
    財帛: 1,
    相貌: 2,
    福徳: 3,
    官禄: 4,
    田宅: 5,
    妻妾: 6,
    男女: 7,
    兄弟: 11,
  } as const;

  const findPalsHasAnyShen = (names: string[]): Branch[] => {
    const m = ctx.shenShaByPalace ?? ({} as any);
    const out: Branch[] = [];
    for (const p of BR) {
      const arr = (m as any)[p] ?? [];
      if (Array.isArray(arr) && names.some(n => arr.includes(n))) out.push(p as any);
    }
    return out;
  };

  // --- 吉 ---
  add(
    "祥雲捧月",
    "吉",
    () =>
      !!ctx.monthBranch &&
      !(["亥","子"] as any[]).includes(ctx.monthBranch as any) &&
      !ctx.isDayBirth &&
      isFullMoon() &&
      sameP("月","孛"),
    "月支≠亥子 & 夜生 & 望 & 月=孛"
  );

  // 「太乙抱蟾」同条件（テキスト上は別名として掲載）
  add(
    "太乙抱蟾",
    "吉",
    () =>
      !!ctx.monthBranch &&
      !(["亥","子"] as any[]).includes(ctx.monthBranch as any) &&
      !ctx.isDayBirth &&
      isFullMoon() &&
      sameP("月","孛"),
    "月支≠亥子 & 夜生 & 望 & 月=孛"
  );

  add(
    "羅月交輝",
    "吉",
    () =>
      !!ctx.monthBranch &&
      (["亥","子"] as any[]).includes(ctx.monthBranch as any) &&
      !ctx.isDayBirth &&
      isNewMoon() &&
      sameP("月","羅"),
    "月支=亥子 & 夜生 & 朔 & 月=羅"
  );

  // 左気宇＝上弦（90°）として実装
  add(
    "首星捧日",
    "吉",
    () =>
      !!ctx.monthBranch &&
      (["亥","子"] as any[]).includes(ctx.monthBranch as any) &&
      !ctx.isDayBirth &&
      isFirstQ() &&
      (() => {
        const pS = palaceOf("日");
        const pR = palaceOf("羅");
        if (!pS || !pR) return false;
        // 「同宮＋二支」＝ 日が羅の±2
        return pS === stepPalace(pR, +2) || pS === stepPalace(pR, -2);
      })(),
    "月支=亥子 & 夜生 & 上弦 & 日が羅の±2"
  );

  add(
    "金計動垣",
    "吉",
    () =>
      !!ctx.monthBranch &&
      !(["亥","子"] as any[]).includes(ctx.monthBranch as any) &&
      sameP("金","計") &&
      (isMiao("金") || isWang("金")),
    "月支≠亥子 & 金=計 & 金が廟/旺"
  );

  add(
    "土羅相会",
    "吉",
    () =>
      !!ctx.monthBranch &&
      (["巳","午"] as any[]).includes(ctx.monthBranch as any) &&
      sameP("土","羅") &&
      (isMiao("土") || isWang("土")),
    "月支=巳午 & 土=羅 & 土が廟/旺"
  );

  // 「学星」＝孛（ユーザー確定）
  add(
    "火羅計孛守四雑",
    "吉",
    () => inP("火","亥" as any) && inP("羅","申" as any) && inP("計","寅" as any) && inP("孛","巳" as any),
    "火=亥 羅=申 計=寅 孛=巳"
  );

  add(
    "金水従陽",
    "吉",
    () => ctx.isDayBirth && isMiao("日") && (isMiao("金") || isWang("金")) && (isMiao("水") || isWang("水")) && sameP("金","日") && sameP("水","日"),
    "昼生 & 日が廟 & 金水が廟/旺で日と同宮"
  );

  add(
    "火金侍月",
    "吉",
    () => !ctx.isDayBirth && isMiao("月") && (isMiao("火") || isWang("火")) && (isMiao("金") || isWang("金")) && sameP("火","月") && sameP("金","月"),
    "夜生 & 月が廟 & 火金が廟/旺で月と同宮"
  );

  add(
    "五曜環陽",
    "吉",
    () => {
      const ps = (["木","火","土","金","水"] as const).map(k => palaceOf(k as any)).filter(Boolean) as Branch[];
      if (ps.length !== 5) return false;
      if (new Set(ps).size !== 5) return false; // 単独で別々
      return inAny("日", ["辰","巳"] as any);
    },
    "五曜が別宮 & 日=辰/巳"
  );

  add(
    "四餘捧月",
    "吉",
    () => {
      const ps = (["炁","孛","羅","計"] as const).map(k => palaceOf(k as any)).filter(Boolean) as Branch[];
      if (ps.length !== 4) return false;
      if (new Set(ps).size !== 4) return false; // 単独で別々
      return inAny("月", ["戌","亥"] as any);
    },
    "四餘が別宮 & 月=戌/亥"
  );

  add(
    "五曜随陽",
    "吉",
    () => ctx.isDayBirth && allSameP(["日","木","火","金","水"]),
    "昼生 & 日/木/火/金/水 が同宮"
  );

  add(
    "五星随月",
    "吉",
    () => !ctx.isDayBirth && allSameP(["月","木","火","土","金","水"]),
    "夜生 & 月+五曜が同宮"
  );

  add(
    "三台合格",
    "吉",
    () => inAny("日", ["午","巳","卯"] as any) && sameP("日","金") && sameP("日","水"),
    "日=午/巳/卯 かつ 日=金=水(同宮)"
  );

  // 五曜連珠：相生順に連続＝（木→火→土→金→水）が隣接で並ぶ
  add(
    "五曜連珠",
    "吉",
    () => {
      const ks = ["木","火","土","金","水"] as const;
      const ps = ks.map(k => palaceOf(k as any)).filter(Boolean) as Branch[];
      if (ps.length !== ks.length) return false;
      // 連続（隣接）を BR 順で判定
      const idx = ps.map(p => idxOf(p));
      if (idx.some(i => i < 0)) return false;
      // 同宮は禁止
      if (new Set(idx).size !== idx.length) return false;
      // 木→火→土→金→水 が全て +1（循環はしない）
      for (let i=0;i<idx.length-1;i++){
        if (((idx[i+1]-idx[i]+12)%12) !== 1) return false;
      }
      return true;
    },
    "五曜が相生順に隣接"
  );

  // 二星合壁：日月同宮 +（入垣/升殿/廟/旺/喜/楽 のどれか）※データ構造が不明なので 廟/旺/入垣/升殿 を拾える範囲で判定
  add(
    "二星合壁",
    "吉",
    () => {
      if (!sameP("日","月")) return false;
      const ok =
        isRuYuan("日") || isRuYuan("月") ||
        isMiao("日") || isMiao("月") ||
        isWang("日") || isWang("月");
      return ok;
    },
    "日月同宮 & (入垣/廟/旺 等)"
  );

  add(
    "衆曜拱南",
    "吉",
    () => !!ctx.mingBranch && inAny("計", ["巳","午","未"] as any) && palaceOf("計") === ctx.mingBranch,
    "計=巳午未 かつ 計が命宮"
  );

  add(
    "群星朝北",
    "吉",
    () => !!ctx.mingBranch && inAny("羅", ["子","丑"] as any) && palaceOf("羅") === ctx.mingBranch,
    "羅=子丑 かつ 羅が命宮"
  );

  add(
    "居三隔三",
    "吉",
    () => {
      const bro = palByOffFromMing(PAL_OFF2.兄弟);
      if (!bro) return false;
      if (!inP("炁", bro as any)) return false;
      return isRuYuan("炁") || isRuYuan("紫炁") || isRuYuan("紫気");
    },
    "兄弟宮に紫炁 & 入垣/升殿相当"
  );

  add(
    "守一空一",
    "吉",
    () => !!ctx.mingBranch && inP("炁", ctx.mingBranch as any) && (isMiao("炁") || isWang("炁")),
    "命宮に紫炁 & 廟/旺"
  );

  add(
    "文武両班",
    "吉",
    () => {
      const sevenOK = (["日","月","水","金","火","木","土"] as const).every(k => inAny(k as any, ["寅","卯","辰"] as any));
      const fourOK  = (["炁","孛","羅","計"] as const).every(k => inAny(k as any, ["申","酉","戌"] as any));
      return sevenOK && fourOK;
    },
    "七政=寅卯辰 & 四餘=申酉戌"
  );

  add(
    "君臣慶会",
    "吉",
    () => inP("日","午" as any) && inP("月","未" as any) && (!!ctx.mingBranch && (ctx.mingBranch === ("午" as any) || ctx.mingBranch === ("未" as any))),
    "日=午 月=未 & (午/未 が命宮)"
  );

  add(
    "載天覆地",
    "吉",
    () => !!ctx.mingBranch && ctx.mingBranch === ("亥" as any) && inAny("月", ["申","巳"] as any),
    "命=亥 & 月=申/巳"
  );

  add(
    "出乾入坤",
    "吉",
    () =>
      !!ctx.mingBranch &&
      ctx.mingBranch === ("亥" as any) &&
      inP("月","亥" as any) &&
      inP("火","戌" as any) &&
      inP("金","酉" as any) &&
      inP("日","申" as any),
    "命=亥 & 月=亥 & 火=戌 金=酉 日=申"
  );

  add(
    "天地開名",
    "吉",
    () =>
      inP("水","申" as any) &&
      inP("木","亥" as any) &&
      !!ctx.mingBranch &&
      (ctx.mingBranch === ("申" as any) || ctx.mingBranch === ("亥" as any)) &&
      rahuKetuZiWu(ctx),
    "水=申 木=亥 & 命=申/亥 & 羅計=子午"
  );

  add(
    "山沢通気",
    "吉",
    () => inP("木","寅" as any) && inP("金","酉" as any) && !!ctx.mingBranch && (ctx.mingBranch === ("酉" as any) || ctx.mingBranch === ("寅" as any)),
    "木=寅 金=酉 & 命=酉/寅"
  );

  add(
    "風雷鼓舞",
    "吉",
    () => inP("水","巳" as any) && inP("火","卯" as any) && !!ctx.mingBranch && ctx.mingBranch === ("辰" as any),
    "水=巳 火=卯 & 命=辰"
  );
  

  // --- 凶 ---
  add(
    "火羅犯日",
    "凶",
    () => ctx.isDayBirth && sameP("日","火") && sameP("日","羅"),
    "昼生 & 日=火=羅"
  );

  add(
    "土計掩月",
    "凶",
    () => !ctx.isDayBirth && sameP("月","土") && sameP("月","計"),
    "夜生 & 月=土=計"
  );

  add(
    "四餘侵陽",
    "凶",
    () => ["炁","孛","羅","計"].every(k => sameP("日", k)),
    "四餘が全て日と同宮"
  );

  // 失垣/受尅 が未定義のため：当面は「五星が全て失所（木入金郷等）」の既存凶判定が多発するケースを保留
  add(
    "五星失次",
    "凶",
    () => false,
    "（保留）失垣/受尅 の定義が未実装"
  );

  // 木蔽陽光：昼生 & 木=炁（紫炁） ※逆吉条件は未実装
  add(
    "木蔽陽光",
    "凶",
    () => ctx.isDayBirth && sameP("木","炁"),
    "昼生 & 木=紫炁"
  );

  // 月員火焔：夜生 &（上弦後〜下弦前）＝望側（90..270）& 月=火=羅
  add(
    "月員火焔",
    "凶",
    () => {
      if (ctx.isDayBirth) return false;
      const s = sunLon(); const m = moonLon();
      if (s == null || m == null) return false;
      const d = angDiff(m, s); // 0..360
      const inWindow = d > 90 && d < 270; // 上弦後〜下弦前
      return inWindow && sameP("月","火") && sameP("月","羅");
    },
    "夜生 & (上弦後〜下弦前) & 月=火=羅"
  );

  // 孛羅交戦：命=亥 & 孛=羅
  add(
    "孛羅交戦",
    "凶",
    () => !!ctx.mingBranch && ctx.mingBranch === ("亥" as any) && sameP("孛","羅"),
    "命=亥 & 孛=羅"
  );

  add(
    "乾坤否塞",
    "凶",
    () =>
      (!!ctx.mingBranch &&
        ((ctx.mingBranch === ("亥" as any) && inP("金","亥" as any) && inP("羅","亥" as any)) ||
         (ctx.mingBranch === ("申" as any) && inP("土","申" as any) && inP("計","申" as any)))),
    "命=亥 かつ 金羅同宮 / または 命=申 かつ 土計同宮"
  );

  add(
    "風雷相薄",
    "凶",
    () => inP("水","卯" as any) && inP("火","巳" as any) && !!ctx.mingBranch && ctx.mingBranch === ("辰" as any),
    "水=卯 火=巳 & 命=辰"
  );

  add(
    "山沢沈埋",
    "凶",
    () => !!ctx.mingBranch && ctx.mingBranch === ("寅" as any) && inP("木","酉" as any),
    "命=寅 & 木=酉"
  );
  
// 七政入垣：七政（日月＋五星）が入垣
add(
  "七政入垣",
  "吉",
  () => (["日","月","水","金","火","木","土"] as const).every(k => isInYuan(k)),
  "七政が入垣"
);

// =====================================================
// kakkyoku3（A）：同宮・対宮・配置系
// =====================================================

// 日月聯輝：七政（太陽・月・木火土金水）が同宮
add(
  "日月聯輝",
  "吉",
  () => allSameP(["日","月","木","火","土","金","水"]),
  "七政同宮"
);
  
// =====================================================
// kakkyoku3（B）：三方・会局・拱（純配置）
// =====================================================

// 日月拱命：日と月が命宮と三合を成す
add(
  "日月拱命",
  "吉",
  () => {
    const mb = ctx.mingBranch;
    if (!mb) return false;

    const tri = TRINE_GROUPS.find(g => g.includes(mb));
    if (!tri) return false;

    const others = tri.filter(p => p !== mb);
    if (others.length !== 2) return false;

    const pSun  = palaceOf("日");
    const pMoon = palaceOf("月");
    if (!pSun || !pMoon) return false;

    return (
      (pSun === others[0] && pMoon === others[1]) ||
      (pSun === others[1] && pMoon === others[0])
    );
  },
  "日月が命宮と三合を成す"
);

// 日月夾命：日月が命宮を夾
add(
  "日月夾命",
  "吉",
  () => {
    if (!ctx.mingBranch) return false;
    return isJia(ctx.mingBranch, "日", "月");
  },
  "日月が命宮を夾"
);

/* =====================================================
 * kakkyoku1 追加分（指示の9件）
 *  - 既存 helper をそのまま使う前提：
 *    BR, idxOf, stepPalace, palaceOf, lonOf, isKyo, isKo, inP, inAny, sameP, allSameP,
 *    inMansion, isMiao, isWang, angDiff, sunLon(), moonLon(), isKouKai/isKaiGou など
 *  - ここでは helper/定義は追加しない（add(...) だけ）
 * ===================================================== */

/* ---------------------------
 * 日月 夾/拱：個別名（命宮起点）
 *  ※オフセットは「子が命宮なら兄弟=亥、田宅=戌、男女=酉…」の逆回り系
 *    → 命宮から見て：
 *       兄弟 = -1
 *       相貌 = -2
 *       遷移 = -6
 *       疾厄 = -7
 *  ※対象宮を日月が「夾」=isKyo("日","月",target)
 *            「拱」=isKo ("日","月",target)
 * --------------------------- */

// 日月夾疾厄：疾厄宮を日月が夾
add(
  "日月夾疾厄",
  "凶",
  () => {
    if (!ctx.mingBranch) return false;
    const target = stepPalace(ctx.mingBranch as any, -7);
    return isKyo("日", "月", target as any);
  },
  "疾厄宮（命-7）を日月が夾"
);

// 日月夾遷移：遷移宮を日月が夾
add(
  "日月夾遷移",
  "凶",
  () => {
    if (!ctx.mingBranch) return false;
    const target = stepPalace(ctx.mingBranch as any, -6);
    return isKyo("日", "月", target as any);
  },
  "遷移宮（命-6）を日月が夾"
);

// 日月夾兄弟：兄弟宮を日月が夾
add(
  "日月夾兄弟",
  "凶",
  () => {
    if (!ctx.mingBranch) return false;
    const target = stepPalace(ctx.mingBranch as any, -1);
    return isKyo("日", "月", target as any);
  },
  "兄弟宮（命-1）を日月が夾"
);

// 日月夾相貌：相貌宮を日月が夾
add(
  "日月夾相貌",
  "凶",
  () => {
    if (!ctx.mingBranch) return false;
    const target = stepPalace(ctx.mingBranch as any, -2);
    return isKyo("日", "月", target as any);
  },
  "相貌宮（命-2）を日月が夾"
);

// 日月拱相貌：相貌宮（命-2）と日月が三合を成す
add(
  "日月拱相貌",
  "凶",
  () => {
    if (!ctx.mingBranch) return false;

    // 相貌宮（あなたの既存定義：命-2）
    const target = stepPalace(ctx.mingBranch as any, -2) as Branch;

    // target を含む三合（例：{申,子,辰}）を取る
    const tri = TRINE_GROUPS.find((g) => g.includes(target));
    if (!tri) return false;

    // 残り2宮
    const others = tri.filter((p) => p !== target);
    if (others.length !== 2) return false;

    const pSun = palaceOf("日");
    const pMoon = palaceOf("月");
    if (!pSun || !pMoon) return false;

    // 残り2宮に日月が1つずつ
    return (
      (pSun === others[0] && pMoon === others[1]) ||
      (pSun === others[1] && pMoon === others[0])
    );
  },
  "相貌宮（命-2）と日月が三合を成す"
);

/* ---------------------------
 * 勾陳鎮殿
 *  月支が 辰/戌/丑/未 で、土星と太陽が同宮
 * --------------------------- */
add(
  "勾陳鎮殿",
  "吉",
  () =>
    !!ctx.monthBranch &&
    (["辰", "戌", "丑", "未"] as any[]).includes(ctx.monthBranch as any) &&
    sameP("土", "日"),
  "月支=辰戌丑未 & 土=日(同宮)"
);

/* ---------------------------
 * 五星系（木火土金水）
 *  - 五星循環：木火土金水が相生順で「輪」になる（宮が全て異なり、相隣が一定ステップ）
 *  - 五星聚会：五星が命宮
 *  - 五星入廟：五星すべて廟
 *  - 五星入垣：五星すべて入垣（入垣＝居垣：木寅/亥 火卯/戌 土子/丑 金辰/酉 水巳/申）
 * --------------------------- */

const FIVE = ["木", "火", "土", "金", "水"] as const;

// 五星循環
add(
  "五星循環",
  "吉",
  () => {
    const ps = FIVE.map(k => palaceOf(k)).filter(Boolean) as any[];
    if (ps.length !== FIVE.length) return false;
    if (new Set(ps).size !== ps.length) return false;

    // 並び順は BR（盤面定義）で評価
    const stepDiff = (a: any, b: any): number | null => {
      const ia = idxOf(a);
      const ib = idxOf(b);
      if (ia < 0 || ib < 0) return null;
      const d = (ib - ia + 12) % 12;
      return d === 0 ? null : d;
    };

    const d0 = stepDiff(ps[0], ps[1]);
    if (!d0) return false;

    for (let i = 0; i < ps.length - 1; i++) {
      if (stepDiff(ps[i], ps[i + 1]) !== d0) return false;
    }
    return stepDiff(ps[ps.length - 1], ps[0]) === d0;
  },
  "木火土金水が一定間隔で輪（五星循環）"
);

// 五星聚会：命宮に五星
add(
  "五星聚会",
  "吉",
  () => {
    if (!ctx.mingBranch) return false;
    return FIVE.every(k => palaceOf(k) === (ctx.mingBranch as any));
  },
  "五星が命宮に聚会"
);

// 五星入廟：五星すべて廟
add(
  "五星入廟",
  "吉",
  () => FIVE.every(k => isMiao(k as any)),
  "五星がすべて廟"
);

// 五星入垣：五星すべて入垣（居垣）
add(
  "五星入垣",
  "吉",
  () => {
    const inYuan = (k: any): boolean => {
      const p = palaceOf(k);
      if (!p) return false;
      if (k === "木") return (["寅","亥"] as any[]).includes(p);
      if (k === "火") return (["卯","戌"] as any[]).includes(p);
      if (k === "土") return (["子","丑"] as any[]).includes(p);
      if (k === "金") return (["辰","酉"] as any[]).includes(p);
      if (k === "水") return (["巳","申"] as any[]).includes(p);
      return false;
    };
    return FIVE.every(k => inYuan(k as any));
  },
  "五星がすべて入垣（居垣）"
);

// =====================================================
// jyunikyuteikaku1 追加（実装できる範囲）
//  - 身主系：未実装「身居帝旺」
//  - 命主系：資料名（命臨〜 等）を“別名ルール”として追加
// =====================================================

// ---- 身主系：身居帝旺（身主の所在宮 または 身宮 が「帝旺」）----
// ※「帝旺」は神殺として入っている想定（last_base3 の「長生」等と同じ方式）
add(
  "身居帝旺",
  "吉",
  () => {
    const pal1 = shenLordPalace();   // 身主がいる宮
    const pal2 = getShenBranch();    // 身宮
    return hasShenSha(pal1, "帝旺") || hasShenSha(pal2, "帝旺");
  },
  "身主所在宮/身宮が帝旺"
);

// ---- 命主系（資料：命臨〜 / 命主乗旺 / 玉堂 / 禄勲 / 駅馬 / 帝旺）----

add("命臨財帛", "吉", () => {
  const mingLord = lordOfOff(PAL_OFF.命宮);

  console.log("mingBranch", ctx.mingBranch);
  console.log("mingLord", mingLord);
  console.log("mingLord palace", mingLord ? palaceOf(mingLord) : null);
  console.log("財帛宮", palaceByOffsetFromMing(PAL_OFF.財帛));

  const palZ = palaceByOffsetFromMing(PAL_OFF.財帛);
  return !!mingLord && palaceOf(mingLord) === palZ;
});

// 命臨田宅：命主が田宅宮にある（既存：命主居田宅 と同義の別名）
add(
  "命臨田宅",
  "吉",
  () => {
    const lord = getMingLordKey();
    if (!ctx.mingBranch || !lord) return false;
    const target = palaceByOffsetFromMing(PAL_OFF.田宅);
    return !!target && palaceOf(lord) === target;
  },
  "命主が田宅宮"
);

// 命臨子位：命主が男女宮にある（資料の「子位」= 男女宮）
add(
  "命臨子位",
  "吉",
  () => {
    const lord = getMingLordKey();
    if (!ctx.mingBranch || !lord) return false;
    const target = palaceByOffsetFromMing(PAL_OFF.男女);
    return !!target && palaceOf(lord) === target;
  },
  "命主が男女宮"
);

// 命臨妻位：命主が夫妻（妻妾）宮にある（女性は表示名を命臨夫位）
add(
  (ctx.sex === "F" ? "命臨夫位" : "命臨妻位") as any,
  "吉",
  () => {
    const lord = getMingLordKey();
    if (!ctx.mingBranch || !lord) return false;
    const target = palaceByOffsetFromMing(PAL_OFF.妻妾);
    return !!target && palaceOf(lord) === target;
  },
  "命主が夫妻宮"
);

// 命臨官禄：命主が官禄宮にある（既存：命主居官禄 と同義の別名）
add(
  "命臨官禄",
  "吉",
  () => {
    const lord = getMingLordKey();
    if (!ctx.mingBranch || !lord) return false;
    const target = palaceByOffsetFromMing(PAL_OFF.官禄);
    return !!target && palaceOf(lord) === target;
  },
  "命主が官禄宮"
);

// 命臨福徳：命主が福徳宮にある（last_base3 は未実装）
add(
  "命臨福徳",
  "吉",
  () => {
    const lord = getMingLordKey();
    if (!ctx.mingBranch || !lord) return false;
    const target = palaceByOffsetFromMing(PAL_OFF.福徳);
    return !!target && palaceOf(lord) === target;
  },
  "命主が福徳宮"
);


// =====================================================
// MORIA 実例検証用（判田例など）で必要な格局：追加/修正
//  - 宮の順（PAL_OFF）は中心リング表示に合わせている
// =====================================================

// 金水相涵：金星と水星が同宮し、生月支が亥月・子月でない
add(
  "金水相涵",
  "吉",
  () => {
    const mb = ctx?.monthBranch ? String(ctx.monthBranch) : "";
    if (!mb) return false;
    if (mb === "亥" || mb === "子") return false;
    return sameP("金", "水");
  },
  "金水同宮 かつ 生月≠亥/子"
);

// 金水相生：金星と水星が同宮（相生の最小定義）
add("金水相生", "吉", () => sameP("金", "水"), "金水同宮");

// 日月合壁：日月が同宮 / 対神（180°） / 三方（三合）で成立
add(
  "日月合壁",
  "吉",
  () => {
    const ps = palaceOf("日");
    const pm = palaceOf("月");
    if (!ps || !pm) return false;
    if (ps === pm) return true;
    if (isOpposite(ps as any, pm as any)) return true;
    if (isSameTrine(ps as any, pm as any)) return true;
    return false;
  },
  "同宮/対神/三方"
);

// 大月当斗：月が斗宿に入る
add("大月当斗", "吉", () => inMansion(ctx, "月", ["斗"]), "月 in 斗");

// 計居龍尾：計都が尾宿に入り、かつ 命宮が寅（命度=寅側の尾宿運用）
// ※命度（度数）を ctx に持っていないため、現状の最小実装。
//   命度が ctx に追加されたら「命度も尾宿」を厳密化する。
add(
  "計居龍尾",
  "吉",
  () => {
    if (!ctx.mingBranch) return false;
    if (String(ctx.mingBranch) !== "寅") return false;
    return inMansion(ctx, "計", ["尾"]);
  },
  "計 in 尾 かつ 命宮=寅（暫定）"
);

add("身居男女", "吉", () => {
  if (!ctx.shenBranch) return false;

  // 身宮主（身宮の主星）
  const shenLord = PALACE_MAIN_STAR[String(ctx.shenBranch)];
  if (!shenLord) return false;

  // 男女宮
  const target = palaceByOffsetFromMing(PAL_OFF.男女);

  // 身宮主が男女宮にあるか
  return !!target && palaceOf(shenLord) === target;
}, "身宮主が男女宮");

// 財星守児（財見守児）：財帛主（財帛宮の主星）が男女宮にある
add(
  "財星守児",
  "吉",
  () => {
    if (!ctx.mingBranch) return false;
    const caibo = palaceByOffsetFromMing(PAL_OFF.財帛);
    const child = palaceByOffsetFromMing(PAL_OFF.男女);
    if (!caibo || !child) return false;
    const lord = PALACE_MAIN_STAR[String(caibo)];
    return !!lord && palaceOf(lord) === child;
  },
  "財帛主が男女宮"
);

// 福主児宮：福徳主（福徳宮の主星）が男女宮にある
add(
  "福主児宮",
  "吉",
  () => {
    if (!ctx.mingBranch) return false;
    const fuku = palaceByOffsetFromMing(PAL_OFF.福徳);
    const child = palaceByOffsetFromMing(PAL_OFF.男女);
    if (!fuku || !child) return false;
    const lord = PALACE_MAIN_STAR[String(fuku)];
    return !!lord && palaceOf(lord) === child;
  },
  "福徳主が男女宮"
);

// 田主夫宮（田守妻宮/田守夫宮）：田宅主が夫妻宮にある（表示名は性別で切替）
add(
  (ctx.sex === "M" ? "田主妻宮" : "田主夫宮") as any,
  "吉",
  () => {
    const lord = lordOfOff(PAL_OFF.田宅);
    const couple = palaceByOffsetFromMing(PAL_OFF.妻妾);
    return !!lord && palaceOf(lord) === couple;
  }
);
 

// 嗣守妻宮（女性の場合は「嗣守夫宮」）：男女主（男女宮の主星）が夫妻宮にある
//   秀山確認: 男→「嗣守妻宮」／女→「嗣守夫宮」。他の性別切替格局（F ? 夫 : 妻）と同じ向きに統一。
add(
  (ctx.sex === "F" ? "嗣守夫宮" : "嗣守妻宮") as any,
  "吉",
  () => {
    if (!ctx.mingBranch) return false;
    const child = palaceByOffsetFromMing(PAL_OFF.男女);
    const couple = palaceByOffsetFromMing(PAL_OFF.妻妾);
    if (!child || !couple) return false;
    const lord = PALACE_MAIN_STAR[String(child)];
    return !!lord && palaceOf(lord) === couple;
  },
  "男女主が夫妻宮"
);

// 命主乗旺：命主が旺（既存：命主清吉 と同義の別名）
add(
  "命主乗旺",
  "吉",
  () => {
    const lord = getMingLord();
    return !!ctx.mingBranch && !!lord && isWang(lord);
  },
  "命主が旺"
);

// 命坐玉堂：命主の宮 または 命宮 に「玉堂」
add(
  "命坐玉堂",
  "吉",
  () => {
    if (!ctx.mingBranch) return false;
    const lord = getMingLordKey();
    const lordPal = lord ? palaceOf(lord) : null;
    return hasShenSha(ctx.mingBranch, "玉堂") || (!!lordPal && hasShenSha(lordPal, "玉堂"));
  },
  "命宮または命主の宮に玉堂"
);

// 命臨帝旺：命主の宮 または 命宮 が「帝旺」
add(
  "命臨帝旺",
  "吉",
  () => {
    if (!ctx.mingBranch) return false;
    const lord = getMingLordKey();
    const lordPal = lord ? palaceOf(lord) : null;
    return hasShenSha(ctx.mingBranch, "帝旺") || (!!lordPal && hasShenSha(lordPal, "帝旺"));
  },
  "命宮または命主の宮が帝旺"
);

// 命坐禄勲：命主の宮 または 命宮 に「禄勲」
// ※資料の表記「命坐祟𤏩」= 内容は「禄勲」なので、ルール名は安全側で「命坐禄勲」に統一
add(
  "命坐禄勲",
  "吉",
  () => {
    if (!ctx.mingBranch) return false;
    const lord = getMingLordKey();
    const lordPal = lord ? palaceOf(lord) : null;
    return hasShenSha(ctx.mingBranch, "禄勲") || (!!lordPal && hasShenSha(lordPal, "禄勲"));
  },
  "命宮または命主の宮に禄勲"
);

// 命安馬地：命主の宮 または 命宮 に「駅馬」
/* DISABLED: duplicate add('命安馬地')
add("命安馬地", "吉", () => {
  if (!ctx.mingBranch) return false;

  const mingLord = lordOfOff(PAL_OFF.命宮);
  if (!mingLord) return false;

  const pal = palaceOf(mingLord);
  if (!pal) return false;

  return hasShenSha(pal, "駅馬");
}, "命主の宮に駅馬");
*/

// =====================================================
// jyunikyuteikaku1.txt 後半（各宮主）を add(...) で追加
// ※各宮主 = 対象宮（十二支）の主星キー（PALACE_MAIN_STAR[宮]）
// =====================================================

// ---------- 田宅主（田星） ----------
add("田星入垣", "吉", () => {
  if (!ctx.mingBranch) return false;
  const pal = palaceByOffsetFromMing(PAL_OFF.田宅);
  if (!pal) return false;
  const k = PALACE_MAIN_STAR[String(pal)] ?? null;
  return !!k && isInYuan(k);
}, "田宅主が入垣");

add("田主守命", "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.命宮);
  if (!palM) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === (ctx.mingBranch as any);
}, "田宅主が命宮");

add("田星財垣", "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.田宅);
  const palT = palaceByOffsetFromMing(PAL_OFF.財帛);
  if (!palM || !palT) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === palT;
}, "田宅主が財帛宮");

add("田居田位", "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.田宅);
  if (!palM) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === palM;
}, "田宅主が田宅宮");

add("田居児位", "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.田宅);
  const palT = palaceByOffsetFromMing(PAL_OFF.男女);
  if (!palM || !palT) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === palT;
}, "田宅主が男女宮");

add((ctx.sex === "F" ? "田守夫宮" : "田守妻宮") as any, "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.田宅);
  const palT = palaceByOffsetFromMing(PAL_OFF.妻妾);
  if (!palM || !palT) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === palT;
}, "田宅主が夫妻宮");

add("田入官禄", "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.田宅);
  const palT = palaceByOffsetFromMing(PAL_OFF.官禄);
  if (!palM || !palT) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === palT;
}, "田宅主が官禄宮");

add("田入福宮", "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.田宅);
  const palT = palaceByOffsetFromMing(PAL_OFF.福徳);
  if (!palM || !palT) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === palT;
}, "田宅主が福徳宮");

add("田星乗令", "吉", () => {
  if (!ctx.mingBranch) return false;
  const pal = palaceByOffsetFromMing(PAL_OFF.田宅);
  if (!pal) return false;
  const k = PALACE_MAIN_STAR[String(pal)] ?? null;
  return !!k && isChengLing(k);
}, "田宅主が旺（=乗令）");


// ---------- 財帛主（財星） ----------
add("財星升殿", "吉", () => {
  if (!ctx.mingBranch) return false;
  const pal = palaceByOffsetFromMing(PAL_OFF.財帛);
  if (!pal) return false;
  const k = PALACE_MAIN_STAR[String(pal)] ?? null;
  return !!k && isShengDian(k);
}, "財帛主が升殿");

add("財星入垣", "吉", () => {
  if (!ctx.mingBranch) return false;
  const pal = palaceByOffsetFromMing(PAL_OFF.財帛);
  if (!pal) return false;
  const k = PALACE_MAIN_STAR[String(pal)] ?? null;
  return !!k && isInYuan(k);
}, "財帛主が入垣");

add("財入田垣", "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.財帛);
  const palT = palaceByOffsetFromMing(PAL_OFF.田宅);
  if (!palM || !palT) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === palT;
}, "財帛主が田宅宮");

add("財見守児", "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.財帛);
  const palT = palaceByOffsetFromMing(PAL_OFF.男女);
  if (!palM || !palT) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === palT;
}, "財帛主が男女宮");

add((ctx.sex === "F" ? "財主夫宮" : "財主妻宮") as any, "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.財帛);
  const palT = palaceByOffsetFromMing(PAL_OFF.妻妾);
  if (!palM || !palT) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === palT;
}, "財帛主が夫妻宮");

add("財居官禄", "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.財帛);
  const palT = palaceByOffsetFromMing(PAL_OFF.官禄);
  if (!palM || !palT) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === palT;
}, "財帛主が官禄宮");

add("財入福宮", "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.財帛);
  const palT = palaceByOffsetFromMing(PAL_OFF.福徳);
  if (!palM || !palT) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === palT;
}, "財帛主が福徳宮");

add("財星秉令", "吉", () => {
  if (!ctx.mingBranch) return false;
  const pal = palaceByOffsetFromMing(PAL_OFF.財帛);
  if (!pal) return false;
  const k = PALACE_MAIN_STAR[String(pal)] ?? null;
  return !!k && isChengLing(k);
}, "財帛主が旺（=秉令）");


// ---------- 官禄主（官星/禄） ----------
add("官星升殿", "吉", () => {
  if (!ctx.mingBranch) return false;
  const pal = palaceByOffsetFromMing(PAL_OFF.官禄);
  if (!pal) return false;
  const k = PALACE_MAIN_STAR[String(pal)] ?? null;
  return !!k && isShengDian(k);
}, "官禄主が升殿");

add("官星入垣", "吉", () => {
  if (!ctx.mingBranch) return false;
  const pal = palaceByOffsetFromMing(PAL_OFF.官禄);
  if (!pal) return false;
  const k = PALACE_MAIN_STAR[String(pal)] ?? null;
  return !!k && isInYuan(k);
}, "官禄主が入垣");

add("禄守財宮", "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.官禄);
  const palT = palaceByOffsetFromMing(PAL_OFF.財帛);
  if (!palM || !palT) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === palT;
}, "官禄主が財帛宮");

add("禄守児宮", "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.官禄);
  const palT = palaceByOffsetFromMing(PAL_OFF.男女);
  if (!palM || !palT) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === palT;
}, "官禄主が男女宮");

add((ctx.sex === "F" ? "禄守夫宮" : "禄守妻宮") as any, "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.官禄);
  const palT = palaceByOffsetFromMing(PAL_OFF.妻妾);
  if (!palM || !palT) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === palT;
}, "官禄主が夫妻宮");

add("禄居福位", "吉", () => {
  if (!ctx.mingBranch) return false;
  const palM = palaceByOffsetFromMing(PAL_OFF.官禄);
  const palT = palaceByOffsetFromMing(PAL_OFF.福徳);
  if (!palM || !palT) return false;
  const k = PALACE_MAIN_STAR[String(palM)] ?? null;
  return !!k && palaceOf(k) === palT;
}, "官禄主が福徳宮");

add("官曜居官", "吉", () => {
  if (!ctx.mingBranch) return false;
  const pal = palaceByOffsetFromMing(PAL_OFF.官禄);
  if (!pal) return false;
  const k = PALACE_MAIN_STAR[String(pal)] ?? null;
  return !!k && palaceOf(k) === pal;
}, "官禄主が官禄宮");

add("官星秉令", "吉", () => {
  if (!ctx.mingBranch) return false;
  const pal = palaceByOffsetFromMing(PAL_OFF.官禄);
  if (!pal) return false;
  const k = PALACE_MAIN_STAR[String(pal)] ?? null;
  return !!k && isChengLing(k);
}, "官禄主が旺（=秉令）");

add("禄居斗杓", "吉", () => {
  if (!ctx.mingBranch) return false;
  const pal = palaceByOffsetFromMing(PAL_OFF.官禄);
  return !!pal && hasShenSha(pal, "斗杓");
}, "官禄宮に斗杓");


// ---------- 福徳主（福星） ----------
add("福星升殿", "吉", () => {
  if (!ctx.mingBranch) return false;
  const pal = palaceByOffsetFromMing(PAL_OFF.福徳);
  if (!pal) return false;
  const k = PALACE_MAIN_STAR[String(pal)] ?? null;
  return !!k && isShengDian(k);
}, "福徳主が升殿");

add("福星居垣", "吉", () => {
  if (!ctx.mingBranch) return false;
  const pal = palaceByOffsetFromMing(PAL_OFF.福徳);
  if (!pal) return false;
  const k = PALACE_MAIN_STAR[String(pal)] ?? null;
  return !!k && isInYuan(k);
}, "福徳主が入垣");

add("福限秉令", "吉", () => {
  if (!ctx.mingBranch) return false;
  const pal = palaceByOffsetFromMing(PAL_OFF.福徳);
  if (!pal) return false;
  const k = PALACE_MAIN_STAR[String(pal)] ?? null;
  return !!k && isChengLing(k);
}, "福徳主が旺（=秉令）");

// =====================================================
// jyunikyuteikaku2（凶格＋互格）
// 依存：palaceByOffsetFromMing / PAL_OFF / PALACE_MAIN_STAR / palaceOf / hasShenSha
// 依存（既に追加済みのはず）：isUke / isShitsurei / isXieqi / isShitten / isXianJi
// 依存（失垣判定）：SHITSUGAI_MAP（または isShitsugai）
// =====================================================

// ---- 共通小物 ----
const lordOfOff = (off: number): string | null => {
  const pal = palaceByOffsetFromMing(off as any);
  if (!pal) return null;
  const k = (PALACE_MAIN_STAR as any)[String(pal)];
  return k ? String(k) : null;
};

const palOfOff = (off: number): any => palaceByOffsetFromMing(off as any);

const lordInOff = (offLord: number, offTarget: number): boolean => {
  const lord = lordOfOff(offLord);
  const targetPal = palOfOff(offTarget);
  if (!lord || !targetPal) return false;
  const lp = palaceOf(lord as any);
  return !!lp && lp === targetPal;
};

const shenshaInPalOrSameWithLord = (off: number, lordStar: string | null, names: string[]): boolean => {
  const pal = palOfOff(off);
  if (!pal) return false;

  const palHit = names.some(n => hasShenSha(pal, n));
  if (palHit) return true;

  if (!lordStar) return false;
  const lp = palaceOf(lordStar as any);
  return !!lp && names.some(n => hasShenSha(lp, n));
};

// =====================================================
// 凶格（財）
// =====================================================
add(
  "財主逢空",
  "凶",
  () => {
    const z = lordOfOff(PAL_OFF.財帛);
    return shenshaInPalOrSameWithLord(PAL_OFF.財帛, z, ["空亡", "天空"]);
  },
  "財帛主が空亡/天空と同宮 or 財帛宮に空亡/天空"
);

add(
  "財星坐耗",
  "凶",
  () => {
    const z = lordOfOff(PAL_OFF.財帛);
    return shenshaInPalOrSameWithLord(PAL_OFF.財帛, z, ["小耗", "大耗", "地耗", "天耗"]);
  },
  "財帛主が四耗と同宮 or 財帛宮に四耗"
);

add("財入兄弟", "凶", () => lordInOff(PAL_OFF.財帛, PAL_OFF.兄弟), "財帛主が兄弟宮");
add("財入奴宮", "凶", () => lordInOff(PAL_OFF.財帛, PAL_OFF.奴僕), "財帛主が奴僕宮");
add("財臨疾厄", "凶", () => lordInOff(PAL_OFF.財帛, PAL_OFF.疾厄), "財帛主が疾厄宮");
add("財入遷移", "凶", () => lordInOff(PAL_OFF.財帛, PAL_OFF.遷移), "財帛主が遷移宮");
add("財居相貌", "凶", () => lordInOff(PAL_OFF.財帛, PAL_OFF.相貌), "財帛主が相貌宮");

add(
  "劫空守財",
  "凶",
  () => {
    const z = lordOfOff(PAL_OFF.財帛);
    return shenshaInPalOrSameWithLord(PAL_OFF.財帛, z, ["劫殺", "空亡", "天空"]);
  },
  "財帛主が劫殺/空亡/天空と同宮 or 財帛宮に劫殺/空亡/天空"
);

add(
  "耗破守財",
  "凶",
  () => {
    const z = lordOfOff(PAL_OFF.財帛);
    return shenshaInPalOrSameWithLord(PAL_OFF.財帛, z, ["小耗", "大耗", "地耗", "天耗", "的殺", "破砕"]);
  },
  "財帛主が四耗/的殺(破砕)と同宮 or 財帛宮にそれら"
);

// =====================================================
// 凶格（官禄／禄）
// =====================================================
add("禄主失次", "凶", () => { const z = lordOfOff(PAL_OFF.官禄); return !!z && isShitten(z); }, "官禄主が失躔");
add("禄主失垣", "凶", () => {
  const z = lordOfOff(PAL_OFF.官禄);
  return !!z && hasShitsugai(z);
}, "官禄主が失垣");
add("禄主受尅", "凶", () => { const z = lordOfOff(PAL_OFF.官禄); return !!z && isUke(z); }, "官禄主が受尅");
add("官星失令", "凶", () => { const z = lordOfOff(PAL_OFF.官禄); return !!z && isShitsurei(z); }, "官禄主が失令");

add(
  "禄主逢空",
  "凶",
  () => {
    const z = lordOfOff(PAL_OFF.官禄);
    return shenshaInPalOrSameWithLord(PAL_OFF.官禄, z, ["空亡", "天空"]);
  },
  "官禄主が空亡/天空と同宮 or 官禄宮に空亡/天空"
);

add("官星泄気", "凶", () => { const z = lordOfOff(PAL_OFF.官禄); return !!z && isXieqi(z); }, "官禄主が泄気");

// ---- 五行（宮主同士の相克）----
const elementOfPalaceLord = (off: number): "木" | "火" | "土" | "金" | "水" | null => {
  const pal = palaceByOffsetFromMing(off as any);
  if (!pal) return null;

  const k = (PALACE_MAIN_STAR as any)[String(pal)];
  if (!k) return null;

  const s = String(k);

  // 七政：太陽=火、太陰(月)=土、五行星はそのまま
  if (s === "日" || s === "太陽") return "火";
  if (s === "月" || s === "太陰") return "土";
  if (s === "木" || s === "木星") return "木";
  if (s === "火" || s === "火星") return "火";
  if (s === "土" || s === "土星") return "土";
  if (s === "金" || s === "金星") return "金";
  if (s === "水" || s === "水星") return "水";

  // 四余など（宮主には通常来ない想定だが保険）
  return null;
};

const overcomes = (a: "木" | "火" | "土" | "金" | "水", b: "木" | "火" | "土" | "金" | "水"): boolean => {
  // 木剋土、火剋金、土剋水、金剋木、水剋火
  return (
    (a === "木" && b === "土") ||
    (a === "火" && b === "金") ||
    (a === "土" && b === "水") ||
    (a === "金" && b === "木") ||
    (a === "水" && b === "火")
  );
};

// 「宮禄尅命」：官禄宮主が命宮主を剋す
add(
  "宮禄尅命",
  "凶",
  () => {
    const eLu = elementOfPalaceLord(PAL_OFF.官禄);
    const eMing = elementOfPalaceLord(PAL_OFF.命宮);
    if (!eLu || !eMing) return false;
    return overcomes(eLu, eMing);
  },
  "官禄宮主が命宮主を剋す（木剋土/火剋金/土剋水/金剋木/水剋火）"
);

add("禄居閑極", "凶", () => { const z = lordOfOff(PAL_OFF.官禄); return !!z && isXianJi(z); }, "官禄主が閑極（兄弟宮・七政のみ）");
add("禄陥奴宮", "凶", () => lordInOff(PAL_OFF.官禄, PAL_OFF.奴僕), "官禄主が奴僕宮");
add("禄入疾厄", "凶", () => lordInOff(PAL_OFF.官禄, PAL_OFF.疾厄), "官禄主が疾厄宮");
add("禄守遷移", "凶", () => lordInOff(PAL_OFF.官禄, PAL_OFF.遷移), "官禄主が遷移宮");
add("禄居相貌", "凶", () => lordInOff(PAL_OFF.官禄, PAL_OFF.相貌), "官禄主が相貌宮");

add(
  "十位逢羅",
  "凶",
  () => {
    const z = lordOfOff(PAL_OFF.官禄);
    const pal = palOfOff(PAL_OFF.官禄);
    if (!pal || !z) return false;

    // 羅劫（星キーは「羅」を前提）
    const raPal = palaceOf("羅" as any);
    const zPal  = palaceOf(z as any);
    if (raPal && zPal && raPal === zPal) return true;
    return raPal === pal;
  },
  "羅が官禄主と同宮 or 羅が官禄宮"
);

add(
  "雄破禄宮",
  "凶",
  () => {
    const z = lordOfOff(PAL_OFF.官禄);
    return shenshaInPalOrSameWithLord(PAL_OFF.官禄, z, ["天雄", "的殺", "破砕"]);
  },
  "天雄/的殺(破砕)が官禄主と同宮 or 官禄宮にある"
);

// =====================================================
// 凶格（福）
// =====================================================
add("福星失経", "凶", () => { const f = lordOfOff(PAL_OFF.福徳); return !!f && isShitten(f); }, "福徳主が失躔");
add("福元失垣", "凶", () => {
  const f = lordOfOff(PAL_OFF.福徳);
  return !!f && hasShitsugai(f);
}, "福徳主が失垣");
add("福主受尅", "凶", () => { const f = lordOfOff(PAL_OFF.福徳); return !!f && isUke(f); }, "福徳主が受尅");
add("福主失令", "凶", () => { const f = lordOfOff(PAL_OFF.福徳); return !!f && isShitsurei(f); }, "福徳主が失令");

add(
  "福主逢空",
  "凶",
  () => {
    const f = lordOfOff(PAL_OFF.福徳);
    return shenshaInPalOrSameWithLord(PAL_OFF.福徳, f, ["空亡", "天空"]);
  },
  "福徳主が空亡/天空と同宮 or 福徳宮に空亡/天空"
);

add("福元泄气", "凶", () => { const f = lordOfOff(PAL_OFF.福徳); return !!f && isXieqi(f); }, "福徳主が泄気");
add("福入閑宮", "凶", () => { const f = lordOfOff(PAL_OFF.福徳); return !!f && isXianJi(f); }, "福徳主が閑極（兄弟宮・七政のみ）");
add("福閑奴宮", "凶", () => lordInOff(PAL_OFF.福徳, PAL_OFF.奴僕), "福徳主が奴僕宮");

// 「福居厄地」＝文言は「失厄宮」だが文脈上は疾厄宮として実装
add("福居厄地", "凶", () => lordInOff(PAL_OFF.福徳, PAL_OFF.疾厄), "福徳主が疾厄宮");
add("福居相貌", "凶", () => lordInOff(PAL_OFF.福徳, PAL_OFF.相貌), "福徳主が相貌宮");

add(
  "福宮坐刃",
  "凶",
  () => {
    const f = lordOfOff(PAL_OFF.福徳);
    return shenshaInPalOrSameWithLord(PAL_OFF.福徳, f, ["陽刃", "陰刃", "飛刃"]);
  },
  "陽刃/陰刃/飛刃が福徳主と同宮 or 福徳宮にある"
);

// =====================================================
// 凶格（妻／夫妻）
// =====================================================
add("妻星失躔", "凶", () => { const s = lordOfOff(PAL_OFF.妻妾); return !!s && isShitten(s); }, "夫妻主が失躔");
add("妻星失垣", "凶", () => { const s = lordOfOff(PAL_OFF.妻妾); return !!s && hasShitsugai(s); }, "夫妻主が失垣");
add("妻星被尅", "凶", () => { const s = lordOfOff(PAL_OFF.妻妾); return !!s && isUke(s); }, "夫妻主が受尅");
add("妻元泄气", "凶", () => { const s = lordOfOff(PAL_OFF.妻妾); return !!s && isXieqi(s); }, "夫妻主が泄気");

add(
  "妻主逢空",
  "凶",
  () => {
    const s = lordOfOff(PAL_OFF.妻妾);
    return shenshaInPalOrSameWithLord(PAL_OFF.妻妾, s, ["空亡", "天空"]);
  },
  "夫妻主が空亡/天空と同宮 or 夫妻宮に空亡/天空"
);

add("妻入閑宮", "凶", () => { const s = lordOfOff(PAL_OFF.妻妾); return !!s && isXianJi(s); }, "夫妻主が閑極（兄弟宮・七政のみ）");
add("妻陥奴宮", "凶", () => lordInOff(PAL_OFF.妻妾, PAL_OFF.奴僕), "夫妻主が奴僕宮");
add("妻臨疾厄", "凶", () => lordInOff(PAL_OFF.妻妾, PAL_OFF.疾厄), "夫妻主が疾厄宮");
add("妻居遷移", "凶", () => lordInOff(PAL_OFF.妻妾, PAL_OFF.遷移), "夫妻主が遷移宮");
add("妻居貌位", "凶", () => lordInOff(PAL_OFF.妻妾, PAL_OFF.相貌), "夫妻主が相貌宮");

add(
  "地雌戦室",
  "凶",
  () => {
    const s = lordOfOff(PAL_OFF.妻妾);
    return shenshaInPalOrSameWithLord(PAL_OFF.妻妾, s, ["地雌"]);
  },
  "地雌が夫妻主と同宮 or 夫妻宮にある"
);

add(
  "陽刃臨妻",
  "凶",
  () => {
    const s = lordOfOff(PAL_OFF.妻妾);
    return shenshaInPalOrSameWithLord(PAL_OFF.妻妾, s, ["陽刃"]);
  },
  "陽刃が夫妻主と同宮 or 夫妻宮にある"
);

// =====================================================
// 凶格（嗣／男女）
// =====================================================
add("子星失経", "凶", () => { const c = lordOfOff(PAL_OFF.男女); return !!c && isShitten(c); }, "男女主が失躔");
add("嗣主失垣", "凶", () => {
  const c = lordOfOff(PAL_OFF.男女);
  return !!c && hasShitsugai(c);
}, "男女主が失垣");
add("子星受尅", "凶", () => { const c = lordOfOff(PAL_OFF.男女); return !!c && isUke(c); }, "男女主が受尅");
add("嗣星失令", "凶", () => { const c = lordOfOff(PAL_OFF.男女); return !!c && isShitsurei(c); }, "男女主が失令");
add("嗣星泄气", "凶", () => { const c = lordOfOff(PAL_OFF.男女); return !!c && isXieqi(c); }, "男女主が泄気");

add(
  "嗣星逢空",
  "凶",
  () => {
    const c = lordOfOff(PAL_OFF.男女);
    return shenshaInPalOrSameWithLord(PAL_OFF.男女, c, ["空亡", "天空"]);
  },
  "男女主が空亡/天空と同宮 or 男女宮に空亡/天空"
);

// =====================================================
// 互格（吉）：諸星互垣（A主がB宮、B主がA宮）
// =====================================================

const OFF_BY_KEY: Record<string, number> = {
  命: PAL_OFF.命宮,
  財: PAL_OFF.財帛,
  田: PAL_OFF.田宅,
  嗣: PAL_OFF.男女,
  妻: PAL_OFF.妻妾,
  官: PAL_OFF.官禄,
  福: PAL_OFF.福徳,
  禄: PAL_OFF.官禄, // 禄＝官禄
};

const isMutual = (aKey: string, bKey: string): boolean => {
  const a = OFF_BY_KEY[aKey];
  const b = OFF_BY_KEY[bKey];
  if (a == null || b == null) return false;
  return lordInOff(a, b) && lordInOff(b, a);
};

const addMutual = (name: string, a: string, b: string) => {
  add(name, "吉", () => isMutual(a, b), `${a}主が${b}宮 & ${b}主が${a}宮`);
};

// 互垣リスト（原文列挙）
addMutual("命財互垣", "命", "財");
addMutual("命田互垣", "命", "田");
addMutual("命嗣互垣", "命", "嗣");
addMutual("命妻互垣", "命", "妻");
addMutual("命官互垣", "命", "官");
addMutual("命福互垣", "命", "福");
addMutual("財嗣互垣", "財", "嗣");
addMutual("妻財互垣", "妻", "財");
addMutual("財禄互垣", "財", "禄");
addMutual("財福互垣", "財", "福");
addMutual("田財互垣", "田", "財");
addMutual("田嗣互垣", "田", "嗣");
addMutual("田妻互垣", "田", "妻");
addMutual("田禄互垣", "田", "禄");
addMutual("福田互垣", "福", "田");
addMutual("嗣禄互垣", "嗣", "禄");
addMutual("妻嗣互垣", "妻", "嗣");
addMutual("妻禄互垣", "妻", "禄");
addMutual("妻福互垣", "妻", "福");
addMutual("福嗣互垣", "福", "嗣");
addMutual("官福互垣", "官", "福");

const fukuLord = lordOfOff(PAL_OFF.福徳);

add("福主財宮", "吉", () => {
  if (!ctx.mingBranch) return false;
  const fukuLord = lordOfOff(PAL_OFF.福徳);
  const palZ = palaceByOffsetFromMing(PAL_OFF.財帛);
  if (!fukuLord || !palZ) return false;
  return palaceOf(fukuLord) === palZ;
}, "福徳主が財帛宮に入る");

add("福居田宅", "吉", () => {
  if (!ctx.mingBranch) return false;
  const fukuLord = lordOfOff(PAL_OFF.福徳);
  const palD = palaceByOffsetFromMing(PAL_OFF.田宅);
  if (!fukuLord || !palD) return false;
  return palaceOf(fukuLord) === palD;
}, "福徳主が田宅宮に入る");

add("福主児宮", "吉", () => {
  if (!ctx.mingBranch) return false;
  const fukuLord = lordOfOff(PAL_OFF.福徳);
  const palN = palaceByOffsetFromMing(PAL_OFF.男女);
  if (!fukuLord || !palN) return false;
  return palaceOf(fukuLord) === palN;
}, "福徳主が男女宮に入る");

add(ctx.sex === "F" ? "福守夫宮" : "福守妻妾", "吉", () => {
  if (!ctx.mingBranch) return false;
  const fukuLord = lordOfOff(PAL_OFF.福徳);
  const palF = palaceByOffsetFromMing(PAL_OFF.妻妾);
  if (!fukuLord || !palF) return false;
  return palaceOf(fukuLord) === palF;
}, "福徳主が夫妻宮に入る（女性は福守夫宮）");

add("福星守福", "吉", () => {
  if (!ctx.mingBranch) return false;
  const fukuLord = lordOfOff(PAL_OFF.福徳);
  const palF = palaceByOffsetFromMing(PAL_OFF.福徳);
  if (!fukuLord || !palF) return false;
  return palaceOf(fukuLord) === palF;
}, "福徳主が福徳宮に入る");

add("福入禄宮", "吉", () => {
  if (!ctx.mingBranch) return false;
  const fukuLord = lordOfOff(PAL_OFF.福徳);
  const palK = palaceByOffsetFromMing(PAL_OFF.官禄);
  if (!fukuLord || !palK) return false;
  return palaceOf(fukuLord) === palK;
}, "福徳主が官禄宮に入る");

add(ctx.sex === "F" ? "嗣守夫宮" : "嗣守妻宮", "吉", () => {
  if (!ctx.mingBranch) return false;

  const ziLord = lordOfOff(PAL_OFF.男女);
  const palF = palaceByOffsetFromMing(PAL_OFF.妻妾);

  if (!ziLord || !palF) return false;

  return palaceOf(ziLord) === palF;
}, "男女主が夫妻宮に入る");

add("官星秉令", "吉", () => {
  if (!ctx.mingBranch) return false;

  const guanLord = lordOfOff(PAL_OFF.官禄);
  if (!guanLord) return false;

  return isChengLing(guanLord);
}, "官禄主が乗令");
add("命臨卦気", "吉", () => {
  if (!ctx.mingBranch) return false;

  const mingLord = lordOfOff(PAL_OFF.命宮);
  if (!mingLord) return false;

  const pal = palaceOf(mingLord);
  if (!pal) return false;

  return hasShenSha(pal, "卦気");
}, "命主の宮に卦気");
add("命安馬地", "吉", () => {
  if (!ctx.mingBranch) return false;

  const mingLord = lordOfOff(PAL_OFF.命宮);
  if (!mingLord) return false;

  const pal = palaceOf(mingLord);
  if (!pal) return false;

  return hasShenSha(pal, "駅馬");
}, "命主の宮に駅馬");

// =====================================================
// 新規の格局の貼り付けはここまで
// =====================================================

for (const r of RULES) {
  try {
    if (r.when()) push({ name: r.name, luck: r.luck });
  } catch (e) {
    console.error("[kakkyoku rule error]", r.name, e);
    push({ name: "（rule error）", luck: "凶" });
  }
}
  
  return {
    good: good.map((r) => r.name),
    bad: bad.map((r) => r.name),
  };

// ② 三方（三合）
// 例：申子辰 / 寅午戌 / 巳酉丑 / 亥卯未
// (TRINE_GROUPS moved to top)

}