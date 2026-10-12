// tests/ziwei_pattern_minor_stars.manual.ts
//
// 新規諸星の格局への反映（docs/ziwei-basic-spec.md §37.5）の確認。
// 実行: npx tsx tests/ziwei_pattern_minor_stars.manual.ts
//
//   巨日同宮格（K2-11）: 三台・八座は補足（enhancementConditions・条件付き象意）で、成立条件・状態を変えない。
//                        なし／三台のみ／八座のみ／両方、三方四正の外（同宮を含む）は加会にしない。
//   桃花犯主格（K2-31）: 天喜（年支系）・沐浴（長生十二星）を星IDで参照。天喜のみ／沐浴のみ／両方／なし、既存条件との組合せ。
//                        咸池・天桃は判定できないため sourceStatus needs_review のまま（confirmed に上げない）。
//   截空: 表17の10干・1宮のまま。天刑＋廉貞: 全書 referenceOnly のまま通常の格局に出ない。
//   他の格局・力量・運命指数・新規諸星の配置は変わらない（新規星を外しても同じ結果）。

import { calculateZiweiChart, calculateChartPower, sanfangSizheng } from "../src/lib/ziwei";
import type { Branch, ZiweiChart } from "../src/lib/ziwei";
import { evaluatePatterns, CLASSICAL_REFERENCE_PATTERNS, PATTERN_RULES } from "../src/lib/ziwei/patterns";
import type { PatternResult } from "../src/lib/ziwei/patterns";
import { viewOf } from "../src/lib/ziwei/patterns/chartView";
import { calculateMinorStars, changshengOf, isForwardYinYang, findMinorStarsByName, MINOR_STARS, jiekongOf } from "../src/lib/ziwei/minorStars";
import { TABLE15_YEAR_BRANCH } from "../src/lib/ziwei/minorStars/tables";
import { buildZiweiPrintData } from "../src/lib/ziwei/print/printData";

const counts = new Map<string, { pass: number; fail: number }>();
const failures: string[] = [];
function check(category: string, label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  const c = counts.get(category) ?? { pass: 0, fail: 0 };
  if (ok) c.pass += 1;
  else {
    c.fail += 1;
    failures.push(`  [${category}] ${label}: 期待=${JSON.stringify(expected)} 実測=${JSON.stringify(actual)}`);
  }
  counts.set(category, c);
}

const BR = "子丑寅卯辰巳午未申酉戌亥".split("") as Branch[];
const SANTAI = "三台・八座が加会し、この格局の良さを補っています。";
const ONLY_SAN = "三台が加会し、この格局の良さを補っています。";
const ONLY_BA = "八座が加会し、この格局の良さを補っています。";
const ADDED = [SANTAI, ONLY_SAN, ONLY_BA];
const pat = (c: ZiweiChart, id: string) => evaluatePatterns(c).patterns.find((p) => p.id === id)!;
const area = (b: Branch) => {
  const s = sanfangSizheng(b);
  return [s.opposite, ...s.trines];
};

// ---------------------------------------------------------------------------
// ケースの盤（2.4万盤の走査で見つけた生年月日時。東経139.7°。種別は下の照合で再確認する）
// 桃花犯主格は命宮卯・酉に紫微・貪狼があると三方四正に必ず煞星があった（走査範囲で「煞星なし」は0件）
// ---------------------------------------------------------------------------

type B = [number, number, number, number, "male" | "female"];
const mk = ([y, mo, d, h, sex]: B) => calculateZiweiChart({ birth: { year: y, month: mo, day: d, hour: h, minute: 10 }, place: { name: "t", longitude: 139.7 }, sex });
type K11Case = "none" | "santai" | "bazuo" | "both";
const k11: Record<K11Case, ZiweiChart> = {
  none: mk([1930, 1, 28, 22, "male"]),
  santai: mk([1931, 2, 7, 22, "female"]),
  bazuo: mk([1931, 2, 7, 10, "female"]),
  both: mk([1930, 2, 19, 12, "male"]),
};
const k11SelfPalace: ZiweiChart | null = mk([1930, 3, 7, 2, "female"]); // 三台または八座が命宮に同宮（加会ではない）
type K31Case = "hongOnly" | "tianxiOnly" | "muyuOnly" | "tianxiMuyu" | "hongMuyu" | "none" | "mingWrong";
const k31: Record<K31Case, ZiweiChart> = {
  hongOnly: mk([1932, 2, 13, 22, "male"]),
  tianxiOnly: mk([1930, 3, 16, 12, "male"]),
  muyuOnly: mk([1931, 3, 19, 12, "male"]),
  tianxiMuyu: mk([1938, 2, 4, 22, "female"]),
  hongMuyu: mk([1930, 3, 13, 0, "female"]),
  none: mk([1930, 1, 16, 20, "male"]),
  mingWrong: mk([1990, 1, 1, 12, "male"]),
};
// 盤の種別の再確認（三方四正に実際にあるか）
for (const [key, c] of Object.entries(k11)) {
  const mc = calculateMinorStars(c);
  const ar = area(c.mingPalace);
  const s = ar.includes(mc.positions["birth_day/三台"]![0]);
  const b = ar.includes(mc.positions["birth_day/八座"]![0]);
  check("ケースの盤", `巨日 ${key}`, s && b ? "both" : s ? "santai" : b ? "bazuo" : "none", key);
}
for (const [key, c] of Object.entries(k31)) {
  if (key === "mingWrong") {
    check("ケースの盤", "桃花 mingWrong は命宮が卯・酉でない", ["卯", "酉"].includes(c.mingPalace), false);
    continue;
  }
  const mc = calculateMinorStars(c);
  const ar = area(c.mingPalace);
  const got = [
    ar.includes(c.starPositions.紅鸞星) && "hong",
    ar.includes(mc.positions["year_branch/天喜"]![0]) && "tianxi",
    ar.includes(mc.positions["changsheng/沐浴"]![0]) && "muyu",
  ].filter(Boolean).join("+");
  const exp = { hongOnly: "hong", tianxiOnly: "tianxi", muyuOnly: "muyu", tianxiMuyu: "tianxi+muyu", hongMuyu: "hong+muyu", none: "" }[key as Exclude<K31Case, "mingWrong">];
  check("ケースの盤", `桃花 ${key}`, got, exp);
}

// ---------------------------------------------------------------------------
// 巨日同宮格
// ---------------------------------------------------------------------------

const k11Rule = PATTERN_RULES.find((r) => r.id === "K2-11")!;
for (const key of ["none", "santai", "bazuo", "both"] as const) {
  const c = k11[key];
  const p = pat(c, "K2-11");
  check("巨日同宮格", `${key} 従来どおり成立`, [p.conditionMatched, p.status], [true, "confirmed"]);
  check("巨日同宮格", `${key} 成立条件は命宮・同宮の2項目のまま`, p.checks.map((x) => x.text), ["命宮が寅・申", "命宮に太陽・巨門"]);
  const applies = p.enhancementConditions.filter((e) => e.result === "applies").map((e) => e.text);
  const expApplies = { none: [], santai: ["三台が加会"], bazuo: ["八座が加会"], both: ["三台が加会", "八座が加会"] }[key];
  check("巨日同宮格", `${key} 補足`, applies, expApplies);
  const expText = { none: [], santai: [ONLY_SAN], bazuo: [ONLY_BA], both: [SANTAI] }[key];
  check("巨日同宮格", `${key} 補足の象意`, p.meanings.filter((t) => ADDED.includes(t)), expText);
  check("巨日同宮格", `${key} 従来の象意は残る`, p.meanings.filter((t) => !ADDED.includes(t)).length >= 3, true);
  // 加会の範囲は三方四正（他の格局と同じ jiahui の範囲）
  const mc = calculateMinorStars(c);
  for (const id of ["birth_day/三台", "birth_day/八座"] as const) {
    const at = mc.positions[id]![0];
    const e = p.enhancementConditions.find((x) => x.text.startsWith(id.split("/")[1]))!;
    check("巨日同宮格", `${key} ${id} は三方四正にあるときだけ加会`, e.result === "applies", area(c.mingPalace).includes(at));
  }
  // 印刷の格局欄にも補足の象意
  const pd = buildZiweiPrintData(c, { name: null, birthDate: "", birthTime: "", sex: "", place: "", lunar: "", mingPalace: "", shenPalace: "", bureau: "" });
  const pp = pd.patterns.confirmed.find((x) => x.name === "巨日同宮格");
  check("巨日同宮格", `${key} 印刷`, pp?.meanings.filter((t) => ADDED.includes(t)), expText);
  // 新規星を除いても成立・状態は同じ（補足だけ）
  const raw = k11Rule.evaluate(viewOf(c));
  check("巨日同宮格", `${key} 新規星で成立が変わらない`, [raw.matched, raw.checks.map((x) => x.result)], [true, [true, true]]);
}
{
  const c = k11SelfPalace;
  const p = pat(c, "K2-11");
  const mc = calculateMinorStars(c);
  for (const id of ["birth_day/三台", "birth_day/八座"] as const) {
    if (mc.positions[id]![0] !== c.mingPalace) continue;
    const e = p.enhancementConditions.find((x) => x.text.startsWith(id.split("/")[1]))!;
    check("巨日同宮格", `${id} が命宮に同宮（三方四正外）なら加会にしない`, e.result, "clear");
  }
}
// 不成立の盤には補足を付けない
const notK11 = calculateZiweiChart({ birth: { year: 1990, month: 1, day: 1, hour: 12, minute: 0 }, place: { name: "t", longitude: 139.7 }, sex: "male" });
const pn = pat(notK11, "K2-11");
check("巨日同宮格", "不成立なら補足なし", [pn.conditionMatched, pn.enhancementConditions.length, pn.meanings.filter((t) => ADDED.includes(t))], [false, 0, []]);

// ---------------------------------------------------------------------------
// 桃花犯主格
// ---------------------------------------------------------------------------

const k31Cases: Record<K31Case, { cond: boolean | null; status: string; found: string[] }> = {
  hongOnly: { cond: true, status: "needs_review", found: ["紅鸞"] },
  tianxiOnly: { cond: true, status: "needs_review", found: ["天喜"] },
  muyuOnly: { cond: true, status: "needs_review", found: ["沐浴"] },
  tianxiMuyu: { cond: true, status: "needs_review", found: ["天喜", "沐浴"] },
  hongMuyu: { cond: true, status: "needs_review", found: ["紅鸞", "沐浴"] },
  none: { cond: null, status: "needs_review", found: [] },
  mingWrong: { cond: false, status: "not_applicable", found: [] },
};
for (const [key, exp] of Object.entries(k31Cases) as [K31Case, (typeof k31Cases)[K31Case]][]) {
  const c = k31[key];
  const p: PatternResult = pat(c, "K2-31");
  check("桃花犯主格", `${key} 判定`, [p.conditionMatched, p.status], [exp.cond, exp.status]);
  check("桃花犯主格", `${key} sourceStatus は needs_review のまま`, p.sourceStatus, "needs_review");
  check("桃花犯主格", `${key} confirmed に入らない`, evaluatePatterns(c).confirmed.some((x) => x.id === "K2-31"), false);
  check("桃花犯主格", `${key} 既存条件（命宮・紫微貪狼・煞星）は3項目のまま`, p.checks.slice(0, 3).map((x) => x.text), ["命宮が卯・酉", "命宮に紫微・貪狼", "煞星に会う（同宮または加会。貪狼自身を除く）"]);
  if (key !== "mingWrong") {
    const last = p.checks[3];
    const names = exp.found;
    for (const n of ["紅鸞", "天喜", "沐浴"]) check("桃花犯主格", `${key} ${n}`, last.detail.includes(`${n} `) && !last.detail.startsWith("紅鸞・天喜・沐浴は加会なし"), names.includes(n));
  }
  // 象意は条件一致のときだけ（要確認の欄）
  check("桃花犯主格", `${key} 条件一致・要確認の欄`, evaluatePatterns(c).matchedNeedsReview.some((x) => x.id === "K2-31"), exp.cond === true);
}
// 天喜・沐浴の位置: 天喜は表15、沐浴は長生十二星（五行局・陽男陰女）から。名前だけで引かない
for (const c of Object.values(k31)) {
  const mc = calculateMinorStars(c);
  check("桃花犯主格", "天喜＝表15", mc.positions["year_branch/天喜"], [[...TABLE15_YEAR_BRANCH.天喜][BR.indexOf(c.yearBranch)]]);
  check("桃花犯主格", "沐浴＝長生十二星", mc.positions["changsheng/沐浴"], [changshengOf(c.bureau.name, isForwardYinYang(c.dayun.yinYang)).沐浴]);
}
check("桃花犯主格", "沐浴の星IDは長生十二星の系列", findMinorStarsByName("沐浴").map((d) => d.id), ["changsheng/沐浴"]);
check("桃花犯主格", "天喜の星IDは年支系", findMinorStarsByName("天喜").map((d) => d.id), ["year_branch/天喜"]);
check("桃花犯主格", "咸池（将前十二神）は配置しない", MINOR_STARS.find((d) => d.name === "咸池")?.implemented, false);
const k31Issue = PATTERN_RULES.find((r) => r.id === "K2-31")!.sourceIssues;
check("桃花犯主格", "資料の問題（咸池・天桃・など）は blocking のまま", k31Issue.some((i) => i.blocking), true);

// ---------------------------------------------------------------------------
// 截空・referenceOnly
// ---------------------------------------------------------------------------

const STEM_EXP: Record<string, string> = { 甲: "申", 乙: "午", 丙: "辰", 丁: "寅", 戊: "子", 己: "酉", 庚: "未", 辛: "巳", 壬: "卯", 癸: "丑" };
for (const [s, b] of Object.entries(STEM_EXP)) check("截空", `表17 ${s}`, jiekongOf(s as never), b);
for (const y of [1964, 1974, 1984, 1994, 2004]) {
  const c = calculateZiweiChart({ birth: { year: y, month: 6, day: 15, hour: 9, minute: 0 }, place: { name: "t", longitude: 139.7 }, sex: "male" });
  const mc = calculateMinorStars(c);
  check("截空", `${y}（${c.yearStem}年）は1宮`, mc.positions["other/截空"], [STEM_EXP[c.yearStem]]);
  check("截空", `${y} 盤上の截空は1つだけ`, Object.values(mc.byBranch).flat().filter((x) => x.id === "other/截空").length, 1);
}
check("截空", "sourceStatus は source_conflict のまま", MINOR_STARS.find((d) => d.id === "other/截空")?.sourceStatus, "source_conflict");

const xingLian = CLASSICAL_REFERENCE_PATTERNS.filter((p) => p.text.includes("天刑廉貞"));
check("referenceOnly", "天刑廉貞同臨身命は全書の参照データにある", xingLian.length, 1);
check("referenceOnly", "referenceOnly", xingLian.every((p) => p.referenceOnly === true), true);
check("referenceOnly", "判定条件（33格）にない", PATTERN_RULES.some((r) => xingLian.some((x) => x.id === r.id)), false);
for (const c of [...Object.values(k11), ...Object.values(k31)]) {
  const r = evaluatePatterns(c);
  check("referenceOnly", "通常の格局一覧・成立格局に天刑廉貞なし", [...r.patterns, ...r.confirmed, ...r.matchedNeedsReview].some((p) => /天刑/.test(p.name) || p.checks.some((x) => x.text.includes("天刑"))), false);
  check("referenceOnly", "格局は33件のまま", r.patterns.length, 33);
}

// ---------------------------------------------------------------------------
// 回帰: 力量・運命指数・他の格局は新規星と無関係
// ---------------------------------------------------------------------------

for (const c of [...Object.values(k11), ...Object.values(k31)]) {
  const before = JSON.stringify([c.starPositions, c.transformations, calculateChartPower(c)]);
  const r = evaluatePatterns(c);
  check("回帰", "作盤・力量・運命指数が変わらない", JSON.stringify([c.starPositions, c.transformations, calculateChartPower(c)]), before);
  check("回帰", "補足は巨日同宮格だけ", r.patterns.filter((p) => p.enhancementConditions.length > 0 && p.id !== "K2-11").length, 0);
}

let pass = 0;
let fail = 0;
for (const [cat, c] of counts) {
  pass += c.pass;
  fail += c.fail;
  console.log(`  ${c.fail === 0 ? "OK  " : "FAIL"} ${cat}: ${c.pass}/${c.pass + c.fail}`);
}
if (failures.length) console.log(failures.slice(0, 40).join("\n"));
console.log(`格局への諸星反映: ${pass} / ${pass + fail} ${fail === 0 ? "PASS" : "FAIL"}`);
if (fail) process.exit(1);
