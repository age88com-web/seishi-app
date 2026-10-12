// src/lib/ziwei/minorStars/place.ts
//
// 新規諸星の配置（本命盤のみ）。既存の作盤結果（ZiweiChart）から読むだけで、ZiweiChart は変更しない。
// 表のある星は tables.ts の転記表を引き、表11（日系）・表13（博士）・表15 天寿は資料の規則文どおりに数える。
// 大限・小限での再配置はしない（資料に行運の諸星の規則がないため）。

import type { Branch, Stem, ZiweiChart } from "../types";
import { BRANCHES, PALACE_NAMES, branchAt, branchIndex, stemIndex } from "../data";
import { IMPLEMENTED_MINOR_STARS, minorStarDef } from "./master";
import type { MinorStarChart, MinorStarId, MinorStarPlacement } from "./types";
import {
  TABLE9_HOUR,
  TABLE10_MONTH,
  TABLE11_DAY_RULES,
  TABLE12_YEAR_STEM,
  TABLE13_BOSHI_ORDER,
  TABLE15_TIANCAI_PALACE,
  TABLE15_YEAR_BRANCH,
  TABLE16_CHANGSHENG,
  TABLE16_CHANGSHENG_ORDER,
  TABLE17_JIEKONG,
  TABLE18_XUNKONG,
  TABLE19,
  TABLE20_MINGZHU,
  TABLE21_SHENZHU,
} from "./tables";

const cell = (row: string, i: number): Branch => {
  const b = [...row][i];
  if (b === undefined) throw new RangeError(`諸星表: 列 ${i} がありません`);
  return b as Branch;
};

/** 表9 時系（台輔・封誥）。 */
export function hourMinorStarsOf(hourBranch: Branch): { 台輔: Branch; 封誥: Branch } {
  const h = branchIndex(hourBranch);
  return { 台輔: cell(TABLE9_HOUR.台輔, h), 封誥: cell(TABLE9_HOUR.封誥, h) };
}

/** 表10 月系（天刑・解神・天巫・天月・陰煞）。生月は閏月のみなし後の月（既存の月系と同じ）。 */
export function monthMinorStarsOf(birthMonth: number): Record<"天刑" | "解神" | "天巫" | "天月" | "陰煞", Branch> {
  if (birthMonth < 1 || birthMonth > 12) throw new RangeError(`月系諸星: 生月 ${birthMonth}`);
  const m = birthMonth - 1;
  return {
    天刑: cell(TABLE10_MONTH.天刑, m),
    解神: cell(TABLE10_MONTH.解神, m),
    天巫: cell(TABLE10_MONTH.天巫, m),
    天月: cell(TABLE10_MONTH.天月, m),
    陰煞: cell(TABLE10_MONTH.陰煞, m),
  };
}

/**
 * 表11 日系。基準の星（左輔・右弼・文昌・文曲）の宮を「初一」として、陰暦生日まで数える。
 * 恩光・天貴は「数到本日生再退後一歩」なので、数えた宮から1つ戻る。
 */
export function dayMinorStarsOf(
  birthDay: number,
  base: { 左輔: Branch; 右弼: Branch; 文昌: Branch; 文曲: Branch },
): Record<"三台" | "八座" | "恩光" | "天貴", Branch> {
  if (birthDay < 1 || birthDay > 30) throw new RangeError(`日系諸星: 陰暦生日 ${birthDay}`);
  const count = (star: keyof typeof TABLE11_DAY_RULES): Branch => {
    const r = TABLE11_DAY_RULES[star];
    const start = branchIndex(base[r.from]);
    return branchAt(start + r.direction * (birthDay - 1) - r.direction * r.stepBack);
  };
  return { 三台: count("三台"), 八座: count("八座"), 恩光: count("恩光"), 天貴: count("天貴") };
}

/** 表12 年干系（天官・天福）。 */
export function stemMinorStarsOf(yearStem: Stem): { 天官: Branch; 天福: Branch } {
  const i = stemIndex(yearStem);
  return { 天官: cell(TABLE12_YEAR_STEM.天官, i), 天福: cell(TABLE12_YEAR_STEM.天福, i) };
}

const YEAR_BRANCH_TABLE_STARS = ["天哭", "天虚", "竜池", "鳳閣", "天喜", "孤辰", "寡宿", "蜚廉", "破砕"] as const;
const TABLE_NAME_TO_CANONICAL: Readonly<Record<string, string>> = { 竜池: "龍池", 破砕: "破碎" };

/** 表15 年支系（紅鸞は既存のため除く）。天才は命宮から数えた宮名、天寿は身宮から子を起して年支まで順行。 */
export function branchMinorStarsOf(yearBranch: Branch, mingPalace: Branch, shenPalace: Branch): Record<string, Branch> {
  const y = branchIndex(yearBranch);
  const out: Record<string, Branch> = {};
  for (const t of YEAR_BRANCH_TABLE_STARS) out[TABLE_NAME_TO_CANONICAL[t] ?? t] = cell(TABLE15_YEAR_BRANCH[t], y);
  // 天才: 表の宮名を、命宮から逆行に並ぶ十二宮（§5）の地支に直す
  const palaceName = TABLE15_TIANCAI_PALACE[y];
  const k = PALACE_NAMES.indexOf(palaceName as (typeof PALACE_NAMES)[number]);
  if (k < 0) throw new Error(`天才: 宮名 ${palaceName}`);
  out.天才 = branchAt(branchIndex(mingPalace) - k);
  // 天寿: 身宮を子として順行し、生年支まで数えた宮
  out.天寿 = branchAt(branchIndex(shenPalace) + y);
  return out;
}

/** 表19 天傷・天使（命宮支から）。 */
export function shangShiOf(mingPalace: Branch): { 天傷: Branch; 天使: Branch } {
  const m = branchIndex(mingPalace);
  return { 天傷: cell(TABLE19.天傷, m), 天使: cell(TABLE19.天使, m) };
}

/** 表17 截空（年干から1宮）。 */
export function jiekongOf(yearStem: Stem): Branch {
  const row = TABLE17_JIEKONG.find(([s]) => s === yearStem);
  if (!row) throw new Error(`截空: 年干 ${yearStem}`);
  return row[1] as Branch;
}

/** 表18 旬空（年干支から2宮）。年干と年支の陰陽が合わない組は表にないためエラー。 */
export function xunkongOf(yearStem: Stem, yearBranch: Branch): [Branch, Branch] {
  const i = stemIndex(yearStem);
  for (const [pair, row] of Object.entries(TABLE18_XUNKONG)) {
    if ([...row][i] === yearBranch) return [...pair] as [Branch, Branch];
  }
  throw new Error(`旬空: 年干支 ${yearStem}${yearBranch} が表18にありません`);
}

/** 陽男陰女＝順行（true）、陰男陽女＝逆行（false）。表14 十干所属表の陰陽と性別。 */
export function isForwardYinYang(yinYang: ZiweiChart["dayun"]["yinYang"]): boolean {
  return yinYang === "陽男" || yinYang === "陰女";
}

/** 表16 五行長生十二星（五行局と陽男陰女／陰男陽女）。紫微斗数の表で独立に引く（七政四餘の長生とは共有しない）。 */
export function changshengOf(bureauName: string, forward: boolean): Record<string, Branch> {
  const row = TABLE16_CHANGSHENG[`${bureauName}/${forward ? "順" : "逆"}`];
  if (!row) throw new Error(`長生十二星: ${bureauName}`);
  const out: Record<string, Branch> = {};
  TABLE16_CHANGSHENG_ORDER.forEach((n, i) => (out[n] = cell(row, i)));
  return out;
}

/** 表13 生年博士十二星。禄存の宮に博士を置き、陽男陰女は順行、陰男陽女は逆行。 */
export function boshiOf(lucun: Branch, forward: boolean): Record<string, Branch> {
  const s = branchIndex(lucun);
  const out: Record<string, Branch> = {};
  TABLE13_BOSHI_ORDER.forEach((n, i) => (out[n === "青竜" ? "青龍" : n] = branchAt(s + (forward ? i : -i))));
  return out;
}

/** 表20 命主・表21 身主（星盤には置かない付記情報）。 */
export function mingShenZhuOf(mingPalace: Branch, yearBranch: Branch): { mingZhu: string; shenZhu: string } {
  return { mingZhu: TABLE20_MINGZHU[branchIndex(mingPalace)], shenZhu: TABLE21_SHENZHU[branchIndex(yearBranch)] };
}

/** 本命盤の新規諸星をすべて配置する。 */
export function calculateMinorStars(chart: ZiweiChart): MinorStarChart {
  const sp = chart.starPositions;
  const forward = isForwardYinYang(chart.dayun.yinYang);
  const positions: Partial<Record<MinorStarId, Branch[]>> = {};
  const put = (family: string, values: Record<string, Branch | Branch[]>) => {
    for (const [name, b] of Object.entries(values)) {
      const id = `${family}/${name}` as MinorStarId;
      minorStarDef(id); // マスターにない名前はここで止める
      positions[id] = Array.isArray(b) ? b : [b];
    }
  };
  put("birth_hour", hourMinorStarsOf(chart.hourBranch));
  put("birth_month", monthMinorStarsOf(chart.birthMonth));
  put("birth_day", dayMinorStarsOf(chart.birthDay, { 左輔: sp.左輔星, 右弼: sp.右弼星, 文昌: sp.文昌星, 文曲: sp.文曲星 }));
  put("year_stem", stemMinorStarsOf(chart.yearStem));
  put("year_branch", branchMinorStarsOf(chart.yearBranch, chart.mingPalace, chart.shenPalace));
  put("ming_shen", shangShiOf(chart.mingPalace));
  put("other", { 截空: jiekongOf(chart.yearStem), 旬空: xunkongOf(chart.yearStem, chart.yearBranch) });
  put("changsheng", changshengOf(chart.bureau.name, forward));
  put("boshi", boshiOf(sp.禄存星, forward));

  const byBranch = Object.fromEntries(BRANCHES.map((b) => [b, [] as MinorStarPlacement[]])) as Record<Branch, MinorStarPlacement[]>;
  for (const d of IMPLEMENTED_MINOR_STARS) {
    const bs = positions[d.id];
    if (!bs) throw new Error(`諸星 ${d.id} が配置されていません`);
    for (const b of bs) byBranch[b].push({ id: d.id, name: d.name, family: d.family, tier: d.tier, branches: bs });
  }
  return { positions, byBranch, ...mingShenZhuOf(chart.mingPalace, chart.yearBranch) };
}

