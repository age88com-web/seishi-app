// src/lib/ziwei/patterns/meanings.ts
//
// 格局の象意（data/meanings.json）を、成立した格局ごとに出し分ける。docs/ziwei-basic-spec.md §36。
//   base        … 無条件で表示（gender があれば出生の性別が一致するときだけ）
//   conditional … when の条件が命盤で成立したときだけ表示
//   pending     … 自動判定できない条件（表示しない。内部で保持）
//   scope       … natal（本命の格局。既定）／major（大限の格局。S38 の大限の記述）／any（どちらでも）
// 成立条件・成立根拠・破格・注意（warning）は持たない（data.ts・evaluate.ts）。宮名を本文に差し込まない。
// 条件の判定は格局の判定と同じ窓口（chartView）を使い、基準宮が複数あるときはどれか1つで成立すれば表示する。

import type { Branch, MainStar, PalaceName, Sex, Stem } from "../types";
import { MAIN_STARS } from "../data";
import type { AnyStar, ChartView } from "./chartView";
import meaningData from "./data/meanings.json";
import type { MinorStarId } from "../minorStars/types";

export type MeaningScope = "natal" | "major" | "any";

export type MeaningCondition =
  | { all: MeaningCondition[] }
  | { any: MeaningCondition[] }
  /** 星がすべて基準宮で会う（同宮または加会） */
  | { meet: AnyStar[]; negate?: boolean }
  /** 星がすべて基準宮の三方四正に加会 */
  | { jiahui: AnyStar[]; negate?: boolean }
  /** 新規諸星（星ID）がすべて基準宮の三方四正に加会（§37.5。本命盤のみ） */
  | { minorJiahui: MinorStarId[]; negate?: boolean }
  /** 吉星（入門 p.15）が会う／加会する（exclude の星を除く） */
  | { lucky: "meet" | "jiahui"; exclude?: AnyStar[]; negate?: boolean }
  /** 煞星（入門 p.15 の凶星）が会う／加会する（exclude の星を除く） */
  | { malefic: "meet" | "jiahui"; exclude?: AnyStar[]; negate?: boolean }
  | { mingBranch: Branch[] }
  | { mingHas: AnyStar[] }
  | { yearStem: Stem[] }
  /** 化禄と禄存が命宮と遷移宮に一つずつ（双禄朝垣） */
  | { luInMingQianyi: true }
  /** 基準宮（天馬）の対宮の禄存星の宮に主星がない（禄馬交馳） */
  | { lucunAlone: true }
  /** 行運: 成立した宮・影響が及ぶ宮に本命のこの宮が含まれる */
  | { touchesNatalPalace: PalaceName }
  /** 行運: 成立した宮が行運のこの宮 */
  | { fortunePalace: PalaceName };

export interface PatternMeaningItem {
  kind: "base" | "conditional" | "pending";
  text: string;
  gender?: Sex;
  scope?: MeaningScope;
  when?: MeaningCondition;
  pendingReason?: string;
}

export interface PatternMeaningEntry {
  /** ok … 象意あり／source_insufficient … 資料に成立条件しかない（33格すべて ok） */
  meaningStatus: "ok" | "source_insufficient";
  items: PatternMeaningItem[];
}

export const PATTERN_MEANINGS = (meaningData as { patterns: Record<string, PatternMeaningEntry> }).patterns;

/** 表示する象意と、判定できず保留した象意 */
export interface ResolvedPatternMeaning {
  meaningStatus: PatternMeaningEntry["meaningStatus"];
  /** 無条件の象意（性別一致を含む） */
  base: string[];
  /** 条件が成立した象意 */
  conditional: string[];
  /** 自動判定できない条件の象意（表示しない） */
  pending: { text: string; reason: string }[];
}

/** 行運の格局で使う情報（本命の格局では null） */
export interface FortuneMeaningContext {
  /** 成立した宮・影響が及ぶ宮の本命の宮名 */
  natalPalaces: PalaceName[];
  /** 成立した宮の行運の宮名 */
  fortunePalaces: PalaceName[];
}

const MAIN_SET = new Set<string>(MAIN_STARS as readonly MainStar[]);

function test(c: MeaningCondition, v: ChartView, b: Branch, f: FortuneMeaningContext | null): boolean {
  const neg = (x: boolean, n?: boolean) => (n ? !x : x);
  if ("all" in c) return c.all.every((x) => test(x, v, b, f));
  if ("any" in c) return c.any.some((x) => test(x, v, b, f));
  if ("meet" in c) return neg(c.meet.every((s) => v.meets(b, s) !== null), c.negate);
  if ("jiahui" in c) return neg(c.jiahui.every((s) => v.jiahui(b, s) !== null), c.negate);
  if ("minorJiahui" in c) return neg(c.minorJiahui.every((id) => v.minorJiahui(b, id) !== null), c.negate);
  if ("lucky" in c) {
    const area = c.lucky === "meet" ? [b, ...v.sanfangSizheng(b)] : v.sanfangSizheng(b);
    return neg(v.luckyIn(area, c.exclude ?? []).length > 0, c.negate);
  }
  if ("malefic" in c) {
    const area = c.malefic === "meet" ? [b, ...v.sanfangSizheng(b)] : v.sanfangSizheng(b);
    return neg(v.maleficIn(area, c.exclude ?? []).length > 0, c.negate);
  }
  if ("mingBranch" in c) return c.mingBranch.includes(v.mingBranch);
  if ("mingHas" in c) return c.mingHas.every((s) => v.has(v.mingBranch, s));
  if ("yearStem" in c) return c.yearStem.includes(v.chart.yearStem);
  if ("luInMingQianyi" in c) {
    const ming = v.mingBranch;
    const qian = v.branchOfPalace("遷移宮");
    const lu = v.huaOf("化禄星").branch;
    const cun = v.posOf("禄存星");
    return (lu === ming && cun === qian) || (lu === qian && cun === ming);
  }
  if ("lucunAlone" in c) {
    const cun = v.posOf("禄存星");
    return cun === v.opposite(b) && !v.palaceAt(cun).stars.some((s) => MAIN_SET.has(s));
  }
  if ("touchesNatalPalace" in c) return !!f && f.natalPalaces.includes(c.touchesNatalPalace);
  if ("fortunePalace" in c) return !!f && f.fortunePalaces.includes(c.fortunePalace);
  return false;
}

/**
 * 成立した格局の象意を出し分ける。
 * @param palaces 基準宮（matchedPalaces）。どれか1つで条件が成立すれば表示
 * @param scope   natal（本命）／major（大限）／minor（小限。行運専用の記述は大限のものなので any だけ）
 */
export function resolvePatternMeaning(
  id: string,
  v: ChartView,
  palaces: Branch[],
  scope: "natal" | "major" | "minor",
  fortune: FortuneMeaningContext | null = null,
): ResolvedPatternMeaning {
  const entry = PATTERN_MEANINGS[id];
  if (!entry) throw new Error(`格局の象意データがない: ${id}`);
  const inScope = (s: MeaningScope = "natal") => s === "any" || s === scope;
  const sexOk = (g?: Sex) => !g || g === v.chart.sex;
  const res: ResolvedPatternMeaning = { meaningStatus: entry.meaningStatus, base: [], conditional: [], pending: [] };
  for (const it of entry.items) {
    if (!inScope(it.scope) || !sexOk(it.gender)) continue;
    if (it.kind === "base") res.base.push(it.text);
    else if (it.kind === "pending") res.pending.push({ text: it.text, reason: it.pendingReason ?? "" });
    else if (it.when && palaces.some((b) => test(it.when!, v, b, fortune))) res.conditional.push(it.text);
  }
  return res;
}

/** すべての象意の文（検査用。条件・性別・スコープを問わない） */
export const ALL_PATTERN_MEANING_TEXTS: Record<string, string[]> = Object.fromEntries(
  Object.entries(PATTERN_MEANINGS).map(([id, e]) => [id, e.items.map((i) => i.text)]),
);
