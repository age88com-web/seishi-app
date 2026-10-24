// tests/takujitsu_p2_batch_unit.manual.ts
//
// 目的:
//   擇日アプリ全体監査 P2 の監修回答（2026-10-24）で変更した解除・増悪条件を検証する。
//   ・Q5 往亡：徳合・赦願で尚忌（No.14 を往亡にも適用）
//   ・Q6 地嚢：徳合かつ赦願で尚忌（No.12 を地嚢にも適用）
//   ・Q7 死気：徳合で軽減、求醫療病だけ残る（No.25）
//   ・Q8 八専：天願で解除、徳合では解除しない（No.26）
//   ・Q9 五墓：月徳で解除（午月・子月だけ＝五墓と月徳が重なる月と同じ、No.15）
//   ・Q10 九空：六合・小時（月建）・徳合で解除（No.19 確定）
//   ・Q11 血支：歳徳・歳徳合・月徳・月徳合・赦願で解除（No.7 確定）
//   ・Q13 大時・天吏：軽減後も開市・立券交易・交易を残す
//   月解釈（Q1〜Q4）・地嚢八風の表（Q14）・上朔（Q15）・氣往亡（Q16）・満日天狗・血忌（Q17）・
//   死神・月忌日（Q12）は現状維持のため対象外。
//
// 実行:
//   npx tsx tests/takujitsu_p2_batch_unit.manual.ts

import {
  calculateTakujitsuFull,
  resolveKichijin,
  resolveKyoushinGroup4,
  resolveShinsatsuRelations,
  resolveJianchu,
  RESOLUTION_RULES,
  DEHE_GROUP,
} from "../src/lib/takujitsu";
import { evaluateActivities } from "../src/lib/takujitsu/activity/evaluateActivities";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function status(kichijin: string[], kyojin: string[], target: string): string | undefined {
  return resolveShinsatsuRelations({ kichijin, kyojin }).kyojin.find((e) => e.name === target)?.status;
}
function negIds(kichijin: string[], kyojin: string[], source: string): string[] {
  const ev = evaluateActivities({
    resolution: resolveShinsatsuRelations({ kichijin, kyojin }),
    buildingDay: resolveJianchu({ monthBranch: "寅", dayBranch: "寅" }),
  });
  return ev.evaluations.filter((e) => e.negativeSources.some((s) => s.sourceName === source)).map((e) => e.activityId).sort();
}
function day(year: number, month: number, d: number) {
  return calculateTakujitsuFull({ year, month, day: d, hour: 12, minute: 0, timezone: "Asia/Tokyo" });
}
function realStatus(year: number, month: number, d: number, target: string): string | undefined {
  return day(year, month, d).resolution.kyojin.find((e) => e.name === target)?.status;
}
const noPending = (id: string) => RESOLUTION_RULES.find((r) => r.id === id)?.pending === false;

// Q5 往亡
{
  check("Q5 No.14 の対象に往亡", RESOLUTION_RULES.find((r) => r.id === "14")?.targets.includes("往亡") === true);
  check("Q5 往亡＋天徳 → aggravated", status(["天徳"], ["往亡"], "往亡") === "aggravated");
  check("Q5 往亡＋天願 → aggravated", status(["天願"], ["往亡"], "往亡") === "aggravated");
  check("Q5 往亡のみ → active", status([], ["往亡"], "往亡") === "active");
  check("Q5 2026-11-17（往亡＋天徳）は aggravated", realStatus(2026, 11, 17, "往亡") === "aggravated");
}

// Q6 地嚢
{
  check("Q6 No.12 の対象に地嚢", RESOLUTION_RULES.find((r) => r.id === "12")?.targets.includes("地嚢") === true);
  check("Q6 地嚢＋天徳＋天赦 → aggravated", status(["天徳", "天赦"], ["地嚢"], "地嚢") === "aggravated");
  check("Q6 地嚢＋天徳だけ → active（AND）", status(["天徳"], ["地嚢"], "地嚢") === "active");
}

// Q7 死気
{
  check("Q7 No.25 は確定・reduce・徳合", noPending("25") && RESOLUTION_RULES.find((r) => r.id === "25")?.kind === "reduce");
  for (const k of DEHE_GROUP) check(`Q7 死気＋${k} → reduced`, status([k], ["死気"], "死気") === "reduced");
  check("Q7 死気＋天赦 → active（徳合ではない）", status(["天赦"], ["死気"], "死気") === "active");
  check("Q7 軽減後は求醫療病だけ残る", JSON.stringify(negIds(["月徳"], ["死気"], "死気")) === JSON.stringify(["求醫療病"]));
  check("Q7 軽減なしでは建築系・祝い事も忌", negIds([], ["死気"], "死気").includes("建築") && negIds([], ["死気"], "死気").includes("祝賀"));
  check("Q7 2026-11-13（死気＋歳徳合）は reduced", realStatus(2026, 11, 13, "死気") === "reduced");
  check("Q7 2026-11-25（死気・徳合なし）は active", realStatus(2026, 11, 25, "死気") === "active");
}

// Q8 八専
{
  check("Q8 No.26 は確定・cancel・天願", noPending("26") && RESOLUTION_RULES.find((r) => r.id === "26")?.kind === "cancel");
  check("Q8 八専＋天願 → cancelled", status(["天願"], ["八専"], "八専") === "cancelled");
  for (const k of DEHE_GROUP) check(`Q8 八専＋${k} → active（猶忌）`, status([k], ["八専"], "八専") === "active");
  check("Q8 八専＋天赦 → active", status(["天赦"], ["八専"], "八専") === "active");
}

// Q9 五墓
{
  check("Q9 No.15 は確定・cancel・月徳", noPending("15") && RESOLUTION_RULES.find((r) => r.id === "15")?.kind === "cancel");
  check("Q9 五墓＋月徳 → cancelled", status(["月徳"], ["五墓"], "五墓") === "cancelled");
  check("Q9 五墓＋天徳 → active", status(["天徳"], ["五墓"], "五墓") === "active");
  // 五墓の日に月徳が重なるのは午月・子月だけ（本文「午月と子月に月徳に遭えば忌まない」と同じになる）
  const STEMS = "甲乙丙丁戊己庚辛壬癸";
  const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
  const overlapMonths = new Set<string>();
  for (const mb of BRANCHES) {
    for (let i = 0; i < 60; i += 1) {
      const input = { yearStem: "甲", monthBranch: mb, dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12] };
      if (resolveKyoushinGroup4(input).kyojin.includes("五墓") && resolveKichijin(input).kichijin.includes("月徳")) overlapMonths.add(mb);
    }
  }
  check("Q9 五墓と月徳が重なるのは午月・子月だけ", JSON.stringify([...overlapMonths].sort()) === JSON.stringify(["午", "子"].sort()), [...overlapMonths].join("・"));
}

// Q10 九空
{
  check("Q10 No.19 は確定", noPending("19"));
  for (const k of ["六合", "天徳", "月徳合", "歳徳"]) check(`Q10 九空＋${k} → cancelled`, status([k], ["九空"], "九空") === "cancelled");
  check("Q10 九空＋小時（月建） → cancelled", status([], ["九空", "小時"], "九空") === "cancelled");
  check("Q10 九空＋天赦 → active", status(["天赦"], ["九空"], "九空") === "active");
  check("Q10 2026-11-11（九空＋月徳合）は cancelled", realStatus(2026, 11, 11, "九空") === "cancelled");
}

// Q11 血支
{
  check("Q11 No.7 は確定", noPending("7"));
  for (const k of ["歳徳", "歳徳合", "月徳", "月徳合", "天赦", "天願"]) check(`Q11 血支＋${k} → cancelled`, status([k], ["血支"], "血支") === "cancelled");
  for (const k of ["天徳", "天徳合", "六合"]) check(`Q11 血支＋${k} → active（列挙外）`, status([k], ["血支"], "血支") === "active");
  check("Q11 2026-10-01（血支＋天赦）は cancelled", realStatus(2026, 10, 1, "血支") === "cancelled");
}

// Q13 大時・天吏
{
  for (const n of ["大時", "天吏"]) {
    check(`Q13 ${n}＋天徳 → reduced`, status(["天徳"], [n], n) === "reduced");
    check(`Q13 ${n} 軽減後は開市・立券交易・交易だけ残る`, JSON.stringify(negIds(["天徳"], [n], n)) === JSON.stringify(["交易", "立券交易", "開市"].sort()));
  }
  const r = day(2026, 11, 22); // 大時＋天徳合
  check("Q13 2026-11-22（大時＋天徳合）は reduced で開市に大時の忌", r.resolution.kyojin.find((e) => e.name === "大時")?.status === "reduced" &&
    r.activities.evaluations.find((e) => e.activityId === "開市")?.negativeSources.some((s) => s.sourceName === "大時") === true);
}

check("保留ルールは残っていない（Q12 死神・月忌日はルール化していない）", RESOLUTION_RULES.every((r) => r.pending === false));

console.log("[区分B] 擇日 全体監査 P2（監修回答の解除・増悪条件）");
console.log(`完全一致: ${pass} / ${pass + fail}`);
console.log(`不一致:   ${fail} / ${pass + fail}`);

if (fail > 0) {
  console.log("\n--- 不一致明細 ---");
  for (const f of failures) console.log(f);
  console.log(`\n${fail} 件 FAIL`);
  process.exit(1);
}

console.log(`\n${pass} / ${pass + fail} PASS`);
process.exit(0);
