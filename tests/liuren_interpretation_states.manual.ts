// tests/liuren_interpretation_states.manual.ts
//
// 六壬神課 解釈エンジンの基礎状態（src/lib/liuren/interpretation/states.ts）のテスト。
// 実行: npx tsx tests/liuren_interpretation_states.manual.ts
//
//   1. 十二長生（五行生墓法。『六壬粹言』五行十干生墓第四）: 木火土金水 × 12支（土は火に従う）
//   2. 十干の陰陽で配置が変わらない（甲乙・丙丁・戊己・庚辛・壬癸が同じ。陰干逆行でない）
//   3. 旺相休囚死: 春（木旺）・夏（火旺）・秋（金旺）・冬（水旺）・四季月（土旺）
//   4. 月令: 12支すべて確定（辰未戌丑＝土）。月将ではなく calendar.monthBranch から取る
//   5. 五行墓庫: 木＝未・火＝戌・土＝戌・金＝丑・水＝辰
//   6. 墓の分離: 五行墓庫は kind="elementTomb" のオブジェクトで、十二長生の段階（文字列）と混同しない

import {
  seasonalStrengthOf, rulingElementOfMonth, elementTombOf, growthStageOf, growthStageOfStem, GROWTH_STAGES,
} from "../src/lib/liuren/interpretation/states";
import { calculateLiurenAt } from "../src/lib/liuren";
import type { Element, Branch, Stem } from "../src/lib/liuren";
import type { GrowthStage, SeasonalStrength } from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

const ELEMENTS: readonly Element[] = ["木", "火", "土", "金", "水"];

// ---- 1. 十二長生（依頼の表をそのまま書き写した期待値） ----
const S = (s: string) => s.split(" ") as GrowthStage[];
const ORDER12 = "長生 沐浴 冠帯 臨官 帝旺 衰 病 死 墓 絶 胎 養";
const TABLE: Record<Element, { branches: string; stages: GrowthStage[] }> = {
  木: { branches: "亥子丑寅卯辰巳午未申酉戌", stages: S(ORDER12) },
  火: { branches: "寅卯辰巳午未申酉戌亥子丑", stages: S(ORDER12) },
  土: { branches: "寅卯辰巳午未申酉戌亥子丑", stages: S(ORDER12) },
  金: { branches: "巳午未申酉戌亥子丑寅卯辰", stages: S(ORDER12) },
  水: { branches: "申酉戌亥子丑寅卯辰巳午未", stages: S(ORDER12) },
};
for (const el of ELEMENTS) {
  const { branches, stages } = TABLE[el];
  [...branches].forEach((b, k) => {
    const got = growthStageOf(el, b as Branch);
    check(`十二長生 ${el} ${b}＝${stages[k]}`, got === stages[k], got);
  });
}
// 依頼で特に指定された4地点
const KEY: [Element, Branch, GrowthStage][] = [
  ["木", "亥", "長生"], ["木", "卯", "帝旺"], ["木", "未", "墓"], ["木", "申", "絶"],
  ["火", "寅", "長生"], ["火", "午", "帝旺"], ["火", "戌", "墓"], ["火", "亥", "絶"],
  ["土", "寅", "長生"], ["土", "午", "帝旺"], ["土", "戌", "墓"], ["土", "亥", "絶"],
  ["金", "巳", "長生"], ["金", "酉", "帝旺"], ["金", "丑", "墓"], ["金", "寅", "絶"],
  ["水", "申", "長生"], ["水", "子", "帝旺"], ["水", "辰", "墓"], ["水", "巳", "絶"],
];
for (const [el, b, st] of KEY) check(`指定地点 ${el}${b}＝${st}`, growthStageOf(el, b) === st, growthStageOf(el, b));
// 土は火と全12支で同じ
check("土＝火（12支すべて）", TABLE.土.branches.split("").every((b) =>
  growthStageOf("土", b as Branch) === growthStageOf("火", b as Branch)));

// ---- 2. 十干の陰陽で変わらない（陰干逆行でない） ----
const PAIRS: [Stem, Stem][] = [["甲", "乙"], ["丙", "丁"], ["戊", "己"], ["庚", "辛"], ["壬", "癸"]];
const ALL_BRANCHES = [..."子丑寅卯辰巳午未申酉戌亥"] as Branch[];
for (const [yang, yin] of PAIRS) {
  const a = ALL_BRANCHES.map((b) => growthStageOfStem(yang, b));
  const b = ALL_BRANCHES.map((x) => growthStageOfStem(yin, x));
  check(`${yang}と${yin}が同じ配置`, a.join() === b.join(), `${a.join("")} / ${b.join("")}`);
}
check("壬申＝長生", growthStageOfStem("壬", "申") === "長生");
check("癸申＝長生", growthStageOfStem("癸", "申") === "長生");
check("甲未＝墓", growthStageOfStem("甲", "未") === "墓");
check("乙未＝墓", growthStageOfStem("乙", "未") === "墓");
// 陰干逆行（十干法）なら 乙＝午長生・丁＝酉長生・己＝酉長生・辛＝子長生・癸＝卯長生 になる。そうなっていないこと
const YIN_REVERSE_START: [Stem, Branch, GrowthStage][] = [
  ["乙", "午", "死"], ["丁", "酉", "死"], ["己", "酉", "死"], ["辛", "子", "死"], ["癸", "卯", "死"],
];
for (const [s, b, st] of YIN_REVERSE_START) {
  const got = growthStageOfStem(s, b);
  check(`陰干逆行でない ${s}${b}＝${st}（長生ではない）`, got === st && got !== "長生", got);
}
check("十二長生の段階は12種・重複なし", new Set(GROWTH_STAGES).size === 12 && GROWTH_STAGES.join(" ") === ORDER12);

// ---- 3. 旺相休囚死 ----
const SEASONS: [string, Element, Record<Element, SeasonalStrength>][] = [
  ["春", "木", { 木: "旺", 火: "相", 水: "休", 金: "囚", 土: "死" }],
  ["夏", "火", { 火: "旺", 土: "相", 木: "休", 水: "囚", 金: "死" }],
  ["秋", "金", { 金: "旺", 水: "相", 土: "休", 火: "囚", 木: "死" }],
  ["冬", "水", { 水: "旺", 木: "相", 金: "休", 土: "囚", 火: "死" }],
  ["四季", "土", { 土: "旺", 金: "相", 火: "休", 木: "囚", 水: "死" }],
];
for (const [season, ruling, expected] of SEASONS) {
  for (const [target, state] of Object.entries(expected) as [Element, SeasonalStrength][]) {
    const got = seasonalStrengthOf(target, ruling);
    check(`${season}（${ruling}旺）${target}`, got === state, `${got} / ${state}`);
  }
}

// ---- 4. 月令（12支すべて確定） ----
const MONTHS: [Branch, Element][] = [
  ["寅", "木"], ["卯", "木"], ["辰", "土"],
  ["巳", "火"], ["午", "火"], ["未", "土"],
  ["申", "金"], ["酉", "金"], ["戌", "土"],
  ["亥", "水"], ["子", "水"], ["丑", "土"],
];
for (const [m, el] of MONTHS) check(`月令 ${m}月＝${el}`, rulingElementOfMonth(m) === el, rulingElementOfMonth(m));
// 四季月（辰未戌丑）は 土旺・金相・火休・木囚・水死
for (const m of ["辰", "未", "戌", "丑"] as Branch[]) {
  const ruling = rulingElementOfMonth(m);
  const got = ELEMENTS.map((t) => `${t}${seasonalStrengthOf(t, ruling)}`).join("");
  check(`${m}月 土旺`, got === "木囚火休土旺金相水死", got);
}
// 月令は月将ではなく calendar.monthBranch から取る。
// 2026/3/1 12:00 は立春後・啓蟄前で月支＝寅（木旺）、月将は雨水後で亥（亥なら水になる）
{
  const r = calculateLiurenAt({ year: 2026, month: 3, day: 1, hour: 12, minute: 0, timezone: "Asia/Tokyo" });
  const month = r.calendar.monthBranch as Branch;
  check("2026/3/1 月支＝寅・月将＝亥", month === "寅" && r.chart.input.monthGeneral === "亥",
    `月支${month} 月将${r.chart.input.monthGeneral}`);
  check("月令は月支から（木）で、月将の五行（水）ではない",
    rulingElementOfMonth(month) === "木" && rulingElementOfMonth(r.chart.input.monthGeneral) !== rulingElementOfMonth(month));
}

// ---- 5. 五行墓庫 ----
const TOMBS: [Element, Branch][] = [["木", "未"], ["火", "戌"], ["土", "戌"], ["金", "丑"], ["水", "辰"]];
for (const [el, b] of TOMBS) {
  const t = elementTombOf(el);
  check(`墓庫 ${el}＝${b}`, t.kind === "elementTomb" && t.element === el && t.branch === b, JSON.stringify(t));
}

// ---- 6. 墓の分離 ----
for (const el of ELEMENTS) {
  const t = elementTombOf(el) as unknown;
  check(`墓庫 ${el} は kind=elementTomb のオブジェクト`,
    typeof t === "object" && t !== null && (t as { kind: string }).kind === "elementTomb");
  check(`墓庫 ${el} は十二長生の段階ではない`, !GROWTH_STAGES.includes(t as GrowthStage));
  // 十二長生の墓は段階名（文字列）で、墓庫の支と同じ支に当たる（別の値として持つ）
  const stage = growthStageOf(el, elementTombOf(el).branch);
  check(`十二長生 ${el} の墓庫の支＝"墓"（文字列）`, stage === "墓" && typeof stage === "string");
}

console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
