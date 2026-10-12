// tests/ziwei_fortune_context.manual.ts
//
// 鑑定日の行運コンテキスト（src/lib/ziwei/fortune/context.ts・taisei.ts・palaceMap.ts・patterns.ts）の確認。
// docs/ziwei-basic-spec.md §27。実行: npx tsx tests/ziwei_fortune_context.manual.ts
//
// 確認: 鑑定日（日付の読み・今日・行運だけ変わる・本命盤は変えない・旧正月前後の数え年／小限／太歳）・
// 大限開始前・太歳宮（年支・三方四正・同宮／三方四正の四化）・行運十二宮（大限命宮・重複欠落なし・S38「大限夫妻宮（父母宮）」）・
// 行運格局（羊陀夾忌・affectedPalaces・刑忌夾印・三奇嘉會・warning・層の保持・本命格局を変えない・小限は断定しない）・
// 基礎２ S38（丙寅・丁卯・戊辰・己巳）・S39。

import { calculateZiweiChart, lunarDateOf, sanfangSizheng, yearGanzhi } from "../src/lib/ziwei";
import type { Branch, CivilDate, ZiweiChart } from "../src/lib/ziwei";
import { evaluatePatterns } from "../src/lib/ziwei/patterns";
import {
  buildFortuneContext,
  buildFortunePalaceContext,
  fortunePalaceMap,
  parseAppraisalDate,
  todayInJapan,
} from "../src/lib/ziwei/fortune";
import type { FortuneContext } from "../src/lib/ziwei/fortune";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}
const BR = "子丑寅卯辰巳午未申酉戌亥".split("") as Branch[];
const PALACES = ["命宮", "兄弟宮", "夫妻宮", "子女宮", "財帛宮", "疾厄宮", "遷移宮", "奴僕宮", "官禄宮", "田宅宮", "福徳宮", "父母宮"];

// ---------------------------------------------------------------------------
// 1. 鑑定日
// ---------------------------------------------------------------------------
check("日付は暦日のまま（UTC でずれない）", JSON.stringify(parseAppraisalDate("2026-10-01")) === JSON.stringify({ year: 2026, month: 10, day: 1 }));
check("不正な日付は null", parseAppraisalDate("2026/10/01") === null && parseAppraisalDate("2026-13-01") === null);
check("日本の今日（UTC 9/30 16:00 → 10/1）", todayInJapan(new Date("2026-09-30T16:00:00Z")) === "2026-10-01");
check("日本の今日（UTC 9/30 14:59 → 9/30）", todayInJapan(new Date("2026-09-30T14:59:00Z")) === "2026-09-30");

const chartA = calculateZiweiChart({ birth: { year: 1955, month: 10, day: 16, hour: 15, minute: 55 }, place: "東京", sex: "female" });
{
  const before = JSON.stringify(chartA);
  const natalPatterns = JSON.stringify(evaluatePatterns(chartA));
  const f1 = buildFortuneContext(chartA, { year: 2000, month: 6, day: 1 });
  const f2 = buildFortuneContext(chartA, { year: 2020, month: 6, day: 1 });
  check("鑑定日を変えると行運が変わる", f1.kazoeAge !== f2.kazoeAge && f1.minorLimit!.palaceBranch !== f2.minorLimit!.palaceBranch);
  check("本命盤は変わらない", JSON.stringify(chartA) === before);
  check("本命格局は変わらない", JSON.stringify(evaluatePatterns(chartA)) === natalPatterns);
  check("生年四化は chart.transformations のまま", f1.natalTransformations.every((t) => chartA.transformations.some((n) => n.kind === t.kind && n.star === t.star && n.branch === t.branch)));
}
// 旧正月前後（入門 p.27: 1970/12/7 生まれは 1971/1/26 まで1歳、1/27 から2歳。1971年の旧正月は1/27）
{
  const c = calculateZiweiChart({ birth: { year: 1970, month: 12, day: 7, hour: 12, minute: 0 }, place: "東京", sex: "male" });
  const a = buildFortuneContext(c, { year: 1971, month: 1, day: 26 });
  const b = buildFortuneContext(c, { year: 1971, month: 1, day: 27 });
  check("旧正月前は数え1歳", a.kazoeAge === 1);
  check("旧正月から数え2歳", b.kazoeAge === 2);
  check("小限も旧正月で次の宮へ", a.minorLimit!.palaceBranch !== b.minorLimit!.palaceBranch);
  check("太歳も旧正月で変わる（庚戌→辛亥）", a.taisei.branch === "戌" && b.taisei.branch === "亥" && a.taisei.yearStem === "庚" && b.taisei.yearStem === "辛");
}
// 大限開始前（局数より前の数え年）
{
  const c = [chartA, ...BR.map((_, i) => calculateZiweiChart({ birth: { year: 1960 + i, month: 4, day: 10, hour: 9, minute: 0 }, place: "東京", sex: "male" }))].find((x) => x.bureau.number >= 3)!;
  const birthLunar = c.lunar.lunarYear;
  const f = buildFortuneContext(c, { year: birthLunar + 1, month: 7, day: 1 }); // 数え2歳
  check("大限開始前（局数より前）", f.kazoeAge === 2 && f.majorLimit === null && f.majorLimitStatus === "beforeFirst");
  check("大限開始前でも小限・太歳は計算", f.minorLimit !== null && !!f.taisei.branch);
}

// ---------------------------------------------------------------------------
// 2. 太歳宮
// ---------------------------------------------------------------------------
for (const d of [{ year: 2026, month: 10, day: 1 }, { year: 2026, month: 2, day: 10 }, { year: 2030, month: 1, day: 1 }] as CivilDate[]) {
  const f = buildFortuneContext(chartA, d);
  const yb = yearGanzhi(lunarDateOf(d).lunarYear).branch;
  check(`${d.year}/${d.month}/${d.day} 太歳宮＝陰暦年の年支 ${yb}`, f.taisei.branch === yb && f.taisei.yearBranch === yb);
  const sf = sanfangSizheng(yb);
  check(`${d.year}/${d.month}/${d.day} 太歳宮の三方四正`, f.taisei.sanfangSizheng.opposite === sf.opposite && f.taisei.sanfangSizheng.trines.join() === sf.trines.join());
  check(`${d.year}/${d.month}/${d.day} 太歳宮の四化（同宮）`, JSON.stringify(f.taisei.samePalaceTransformations) === JSON.stringify(f.transformationsByBranch[yb]));
  const rel = [sf.opposite, ...sf.trines].flatMap((b) => f.transformationsByBranch[b]);
  check(`${d.year}/${d.month}/${d.day} 太歳宮の三方四正の四化`, f.taisei.relatedTransformations.length === rel.length && f.taisei.relatedTransformations.every((t) => [sf.opposite, ...sf.trines].includes(t.branch)));
}
check("2026/2/10 は旧正月前（乙巳年）", buildFortuneContext(chartA, { year: 2026, month: 2, day: 10 }).taisei.yearBranch === "巳");
check("2026/10/1 は丙午年", buildFortuneContext(chartA, { year: 2026, month: 10, day: 1 }).taisei.yearBranch === "午");
check("太歳の年界の根拠を保持", buildFortuneContext(chartA, { year: 2026, month: 10, day: 1 }).taisei.yearBoundary.boundary === "旧暦1月1日");

// ---------------------------------------------------------------------------
// 3. 行運十二宮
// ---------------------------------------------------------------------------
for (const b of BR) {
  const m = fortunePalaceMap(chartA, b);
  check(`基準 ${b}: 基準宮＝命宮`, m[0].branch === b && m[0].fortunePalace === "命宮");
  check(`基準 ${b}: 12宮が重複・欠落なし`, new Set(m.map((x) => x.branch)).size === 12 && m.map((x) => x.fortunePalace).join() === PALACES.join());
}
check("基準＝本命の命宮なら本命の十二宮と同じ", fortunePalaceMap(chartA, chartA.mingPalace).every((e) => e.fortunePalace === e.natalPalace));

// ---------------------------------------------------------------------------
// 4. 基礎２ S38・S39
// ---------------------------------------------------------------------------
const S38 = calculateZiweiChart({ birth: { year: 1965, month: 1, day: 10, hour: 0, minute: 0 }, place: "東京", sex: "male" });
const S39 = calculateZiweiChart({ birth: { year: 1975, month: 3, day: 9, hour: 22, minute: 0 }, place: "東京", sex: "male" });
/** 数え年 age の頃（その陰暦年の夏）の行運 */
const at = (c: ZiweiChart, age: number): FortuneContext => buildFortuneContext(c, { year: c.lunar.lunarYear + age - 1, month: 7, day: 1 });
const pat = (f: FortuneContext, id: string) => f.majorPatterns.find((p) => p.id === id)!;

{
  // 丙寅（12〜21）
  const f = at(S38, 15);
  check("S38 丙寅: 大限", f.majorLimit!.palaceStem === "丙" && f.majorLimit!.palaceBranch === "寅" && f.majorLimit!.ageRange!.join() === "12,21");
  const ytj = pat(f, "K2-32");
  check("S38 丙寅: 羊陀夾忌（寅＝大限命宮・生年化忌 太陽）", ytj.status === "confirmed" && ytj.matchedPalaces[0].branch === "寅" && ytj.matchedPalaces[0].fortunePalace === "命宮" && ytj.transformationsUsed.some((t) => t.origin === "natal" && t.star === "太陽星"));
  check("S38 丙寅: 対宮の疾厄宮（申）は affectedPalaces", ytj.affectedPalaces.length === 1 && ytj.affectedPalaces[0].branch === "申" && ytj.affectedPalaces[0].natalPalace === "疾厄宮");
  const xj = pat(f, "K2-33");
  check("S38 丙寅: 「父母宮は刑忌夾印」（天相＝卯＝大限父母宮）", xj.status === "confirmed" && xj.matchedPalaces[0].branch === "卯" && xj.matchedPalaces[0].fortunePalace === "父母宮");
}
{
  // 丁卯（22〜31）
  const f = at(S38, 25);
  check("S38 丁卯: 大限", f.majorLimit!.palaceStem === "丁" && f.majorLimit!.palaceBranch === "卯");
  // 本文は大限の文脈（生年＋大限の層）。この鑑定日の小限の層は数えない
  const ji = f.transformationsByBranch["寅"].filter((t) => t.kind === "化忌星" && t.origin !== "minor");
  check("S38 丁卯: 父母宮（寅）に化忌2つ（生年 太陽・大限 巨門）", ji.length === 2 && ji.some((t) => t.origin === "natal" && t.star === "太陽星") && ji.some((t) => t.origin === "major" && t.star === "巨門星") && S38.palaces.find((p) => p.branch === "寅")!.name === "父母宮");
  const xj = pat(f, "K2-33");
  check("S38 丁卯: 天相の刑忌夾印（卯＝大限命宮・生年と大限の化忌）", xj.status === "confirmed" && xj.matchedPalaces[0].fortunePalace === "命宮" && xj.transformationsUsed.length === 2);
}
{
  // 戊辰（32〜41）
  const f = at(S38, 35);
  check("S38 戊辰: 大限", f.majorLimit!.palaceStem === "戊" && f.majorLimit!.palaceBranch === "辰");
  const ji = f.majorLimit!.transformations.find((t) => t.kind === "化忌星")!;
  check("S38 戊辰: 天機化忌が大限命宮（辰）", ji.star === "天機星" && ji.branch === "辰" && f.majorPalaceMap![0].branch === "辰");
  const wife = f.majorPalaceMap!.find((e) => e.fortunePalace === "夫妻宮")!;
  check("S38 戊辰: 大限夫妻宮（父母宮）＝寅", wife.branch === "寅" && wife.natalPalace === "父母宮");
}
{
  // 己巳（42〜51）
  const f = at(S38, 45);
  check("S38 己巳: 大限", f.majorLimit!.palaceStem === "己" && f.majorLimit!.palaceBranch === "巳");
  const lu = f.majorLimit!.transformations.find((t) => t.kind === "化禄星")!;
  const quan = f.majorLimit!.transformations.find((t) => t.kind === "化権星")!;
  check("S38 己巳: 武曲化禄・貪狼化権", lu.star === "武曲星" && quan.star === "貪狼星");
  const sf = sanfangSizheng("巳");
  check("S38 己巳: 化禄・化権が大限命宮の三方四正", [sf.opposite, ...sf.trines].includes(lu.branch) && [sf.opposite, ...sf.trines].includes(quan.branch));
  const sq = pat(f, "K2-19");
  check("S38 己巳: 三奇嘉會が成立（大限命宮）", sq.status === "confirmed" && sq.matchedPalaces[0].fortunePalace === "命宮");
  check("S38 己巳: 生年と大限の四化を両方保持", sq.transformationsUsed.some((t) => t.origin === "natal") && sq.transformationsUsed.some((t) => t.origin === "major"));
  check("S38 己巳: 力量が弱いのは warning（破格にしない）", sq.warningConditions.some((w) => w.text.includes("力量") && w.result === "applies") && sq.status === "confirmed");
}
// S39: 大限化忌がすべて卯（命宮・禄存）に入り羊陀夾忌
for (const [age, stem] of [[8, "己"], [18, "戊"], [28, "己"], [38, "戊"], [48, "丁"]] as const) {
  const f = at(S39, age);
  const ytj = pat(f, "K2-32");
  check(`S39 ${stem}${f.majorLimit!.palaceBranch}: 大限化忌で卯（命宮）に羊陀夾忌`, f.majorLimit!.palaceStem === stem && ytj.status === "confirmed" && ytj.matchedPalaces[0].branch === "卯" && ytj.transformationsUsed.some((t) => t.origin === "major"));
}

// ---------------------------------------------------------------------------
// 5. 小限の格局は断定しない・宮クリック用
// ---------------------------------------------------------------------------
for (let age = 1; age <= 80; age += 3) {
  const f = at(S38, age);
  for (const p of f.minorPatterns) if (p.status === "confirmed" || p.sourceStatus !== "needs_review") check(`数え${age} 小限 ${p.name} は needs_review`, false);
}
check("小限の格局は needs_review（構造のみ）", true);
{
  const f = buildFortunePalaceContext(S38, { appraisalDate: { year: 1964 + 24, month: 7, day: 1 }, majorStartAge: 22, minorAge: 25 }, "卯");
  check("宮クリック用: 丁卯の卯は大限命宮", f.isMajorMing && f.majorPalace === "命宮" && f.natalPalace === "福徳宮");
  check("宮クリック用: 成立した行運格局（刑忌夾印）を持つ", f.patterns.some((p) => p.id === "K2-33"));
  check("宮クリック用: 三方四正", f.sanfangSizheng.opposite === "酉");
}

const fail = failures.length;
console.log(`行運コンテキスト: ${pass} / ${pass + fail} PASS`);
if (fail) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
