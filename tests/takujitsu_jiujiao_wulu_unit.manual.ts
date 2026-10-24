// tests/takujitsu_jiujiao_wulu_unit.manual.ts
//
// 目的:
//   九扻（九焦）・無禄の宜忌と無禄の解除（2026-10-24 監修判断）を検証する。
//   ・九焦の忌は擇日テキスト凶神23）の4件（乗船渡水・修堤防＝築堤防・鋳造・種植＝栽種）だけ。
//     補垣塞穴・取魚は加えない
//   ・無禄は「諸事宜しからず」＝全用事に凶
//   ・解除能力を持つ吉神（徳合＝天徳・天徳合・月徳・月徳合・歳徳・歳徳合）が重なれば無禄は
//     解除（reduce）されるが、用事の祭祀・解除は忌のまま。母倉・三合・神在などでは解除しない
//   ・用事「解除」と凶神解除処理（resolution）は別物
//
// 実行:
//   npx tsx tests/takujitsu_jiujiao_wulu_unit.manual.ts

import {
  calculateTakujitsuFull,
  resolveJianchu,
  resolveShinsatsuRelations,
  RESOLUTION_RULES,
  DEHE_GROUP,
} from "../src/lib/takujitsu";
import { ACTIVITY_DEFINITIONS, ACTIVITY_PROFILES, getActivityProfile } from "../src/lib/takujitsu/activity";
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

const JIUJIAO_4 = ["乗船渡水", "築堤防", "鋳造", "栽種"];
const ALL_IDS = ACTIVITY_DEFINITIONS.map((d) => d.id);

function day(month: number, d: number) {
  return calculateTakujitsuFull({ year: 2026, month, day: d, hour: 12, minute: 0, timezone: "Asia/Tokyo" });
}

/** 無禄由来の忌が付いている用事id。 */
function wuluNegativeIds(evaluations: { activityId: string; negativeSources: { sourceName: string }[] }[]): string[] {
  return evaluations.filter((e) => e.negativeSources.some((s) => s.sourceName === "無禄")).map((e) => e.activityId);
}

// 1. 九焦のプロファイル
{
  const p = getActivityProfile("kyojin", "九焦")!;
  check("1. 九焦の忌は4件", p.unfavorableActivityIds.length === 4 && JIUJIAO_4.every((id) => p.unfavorableActivityIds.includes(id)),
    p.unfavorableActivityIds.join("・"));
  check("1. 九焦の宜は無い", p.favorableActivityIds.length === 0 && p.positiveMode === undefined);
  check("1. 九焦は餘事皆忌型ではない", p.negativeMode === undefined);
  for (const id of ["補垣塞穴", "取魚"]) check(`1. 九焦は ${id} を忌としない`, !p.unfavorableActivityIds.includes(id));
  for (const id of JIUJIAO_4) check(`1. ${id} は既存の正式な用事id`, ALL_IDS.includes(id));
  check("1. 九焦には解除ルールが無い", !RESOLUTION_RULES.some((r) => r.targets.includes("九焦")));
}

// 2. 無禄のプロファイル
{
  const p = getActivityProfile("kyojin", "無禄")!;
  check("2. 無禄は全用事に凶（餘事皆忌型・例外なし）", p.negativeMode === "all_except" && (p.exceptionActivityIds ?? []).length === 0);
  check("2. 無禄の宜は無い", p.favorableActivityIds.length === 0);
  check("2. 解除後も残る忌は祭祀・解除の2件",
    JSON.stringify([...(p.reducedStillUnfavorableActivityIds ?? [])].sort()) === JSON.stringify(["祭祀", "解除"].sort()));
  for (const id of ["祭祀", "解除"]) check(`2. ${id} は既存の正式な用事id`, ALL_IDS.includes(id));
  check("2. 旧実装の取り違え4件を個別列挙していない", p.unfavorableActivityIds.length === 0);
}

// 3. 無禄の解除ルール（resolution No.24）
{
  const rules = RESOLUTION_RULES.filter((r) => r.targets.includes("無禄"));
  check("3. 無禄の解除ルールは1件（No.24）", rules.length === 1 && rules[0].id === "24");
  check("3. No.24 は reduce・確定", rules[0]?.kind === "reduce" && rules[0]?.pending === false);
  check("3. No.24 の条件は徳合（6神のいずれか）",
    rules[0]?.requires.length === 1 && rules[0]?.requires[0].mode === "any" &&
    JSON.stringify([...rules[0].requires[0].names].sort()) === JSON.stringify([...DEHE_GROUP].sort()));

  const noKichi = resolveShinsatsuRelations({ kichijin: [], kyojin: ["無禄"] });
  check("3. 吉神なし → 無禄は active", noKichi.kyojin.find((e) => e.name === "無禄")?.status === "active");
  for (const k of DEHE_GROUP) {
    const r = resolveShinsatsuRelations({ kichijin: [k], kyojin: ["無禄"] });
    const e = r.kyojin.find((x) => x.name === "無禄");
    check(`3. 徳合「${k}」あり → 無禄は reduced（No.24）`, e?.status === "reduced" && e?.ruleId === "24", e?.status);
  }
  // 解除能力の無い吉神では解除しない（全吉神のどれか一つ、という条件にはしない）
  for (const k of ["母倉", "三合", "神在", "鳴吠", "守日", "玉宇", "青龍", "兵福", "天貴", "大明", "七聖", "天赦", "天願"]) {
    const r = resolveShinsatsuRelations({ kichijin: [k], kyojin: ["無禄"] });
    check(`3. 吉神「${k}」だけでは無禄は active のまま`, r.kyojin.find((x) => x.name === "無禄")?.status === "active");
  }
  // 凶神だけが重なっても解除しない
  const kyoOnly = resolveShinsatsuRelations({ kichijin: [], kyojin: ["無禄", "月破", "天賊"] });
  check("3. 凶神だけが重なっても無禄は active", kyoOnly.kyojin.find((e) => e.name === "無禄")?.status === "active");
  // 他の凶神の解除状態は変わらない
  const other = resolveShinsatsuRelations({ kichijin: ["月徳"], kyojin: ["無禄", "九焦", "月破", "天賊"] });
  for (const n of ["九焦", "月破", "天賊"]) {
    check(`3. 月徳ありでも ${n} は active のまま`, other.kyojin.find((e) => e.name === n)?.status === "active");
  }
  check("3. 解除条件は既存の any/all だけ（全吉神を条件にする特別な形は無い）",
    RESOLUTION_RULES.every((r) => r.requires.every((g) => g.mode === "any" || g.mode === "all") && r.requires.every((g) => g.names.length > 0)));
}

// 4. 用事判定（evaluateActivities）
{
  const buildingDay = resolveJianchu({ monthBranch: "寅", dayBranch: "子" });
  const active = evaluateActivities({ resolution: resolveShinsatsuRelations({ kichijin: [], kyojin: ["無禄"] }), buildingDay });
  const activeIds = wuluNegativeIds(active.evaluations);
  check("4. 解除なし：無禄の忌は全用事", activeIds.length === ALL_IDS.length, `${activeIds.length}/${ALL_IDS.length}`);

  const reduced = evaluateActivities({ resolution: resolveShinsatsuRelations({ kichijin: ["月徳"], kyojin: ["無禄"] }), buildingDay });
  const reducedIds = wuluNegativeIds(reduced.evaluations).sort();
  check("4. 月徳で解除：無禄の忌は祭祀・解除だけ残る", JSON.stringify(reducedIds) === JSON.stringify(["祭祀", "解除"].sort()), reducedIds.join("・"));
  for (const id of ["鋳造", "築堤防", "嫁娶", "修造"]) {
    const ev = reduced.evaluations.find((e) => e.activityId === id);
    check(`4. 月徳で解除：${id} に無禄の忌は付かない`, ev === undefined || !ev.negativeSources.some((s) => s.sourceName === "無禄"));
  }
  // どの徳合が重なっても、祭祀・解除は無禄の忌が残る（＝吉にならない）
  for (const k of DEHE_GROUP) {
    const ev2 = evaluateActivities({ resolution: resolveShinsatsuRelations({ kichijin: [k], kyojin: ["無禄"] }), buildingDay });
    for (const id of ["祭祀", "解除"]) {
      const ev = ev2.evaluations.find((e) => e.activityId === id);
      check(`4. ${k}が重なっても ${id} は無禄の忌が残り吉にならない`,
        ev !== undefined && ev.verdict !== "good" && ev.negativeSources.some((s) => s.sourceName === "無禄" && s.resolutionStatus === "reduced"), ev?.verdict);
    }
  }
  // 解除能力の無い吉神だけの日は、全用事に無禄の忌が残る
  const noDehe = evaluateActivities({ resolution: resolveShinsatsuRelations({ kichijin: ["母倉", "三合", "神在"], kyojin: ["無禄"] }), buildingDay });
  check("4. 母倉・三合・神在だけ：無禄の忌は全用事", wuluNegativeIds(noDehe.evaluations).length === ALL_IDS.length);
}

// 5. 実際の日付
{
  // 2025-04-05 は無禄の日。吉神は守日・玉宇・青龍・兵福・天貴・大明・七聖で、徳合は無い
  const a = calculateTakujitsuFull({ year: 2025, month: 4, day: 5, hour: 12, minute: 0, timezone: "Asia/Tokyo" });
  check("5. 2025-04-05 は無禄が成立", a.shinsatsu.kyojin.includes("無禄"));
  check("5. 2025-04-05 は徳合が成立していない", !a.shinsatsu.kichijin.some((k) => (DEHE_GROUP as readonly string[]).includes(k)), a.shinsatsu.kichijin.join("・"));
  check("5. 2025-04-05 の無禄は active（解除されない）", a.resolution.kyojin.find((x) => x.name === "無禄")?.status === "active");
  check("5. 2025-04-05 は無禄の忌が全用事", wuluNegativeIds(a.activities.evaluations).length === ALL_IDS.length);

  // 2026-11-02 は無禄の日
  const r = day(11, 2);
  check("5. 2026-11-02 は無禄が成立", r.shinsatsu.kyojin.includes("無禄"));
  const hasDehe = r.shinsatsu.kichijin.some((k) => (DEHE_GROUP as readonly string[]).includes(k));
  const st = r.resolution.kyojin.find((x) => x.name === "無禄")?.status;
  check("5. 2026-11-02 の無禄は徳合の有無どおりに解除される", st === (hasDehe ? "reduced" : "active"), `${st} 徳合=${hasDehe}`);
  for (const id of ["祭祀", "解除"]) {
    check(`5. 2026-11-02 ${id} に無禄の忌が残る`, wuluNegativeIds(r.activities.evaluations).includes(id));
  }

  // 2026-11-09 は九焦の日
  const j = day(11, 9);
  check("5. 2026-11-09 は九焦が成立", j.shinsatsu.kyojin.includes("九焦"));
  for (const id of JIUJIAO_4) {
    const ev = j.activities.evaluations.find((x) => x.activityId === id);
    check(`5. 2026-11-09 ${id} に九焦の忌が付く`, ev?.negativeSources.some((s) => s.sourceName === "九焦") === true);
  }
  for (const id of ["補垣塞穴", "取魚"]) {
    const ev = j.activities.evaluations.find((x) => x.activityId === id);
    check(`5. 2026-11-09 ${id} に九焦の忌は付かない`, ev === undefined || !ev.negativeSources.some((s) => s.sourceName === "九焦"));
  }
}

// 6. 他の神殺へ波及しない
{
  const others = ACTIVITY_PROFILES.filter((p) => p.sourceType === "kyojin" && p.negativeMode === "all_except").map((p) => p.sourceName).sort();
  const expected = ["月破", "死神", "劫殺", "災殺", "月殺", "月刑", "月厭", "四廢", "上朔", "四離", "四絶", "無禄"].sort();
  check("6. 凶神の餘事皆忌型は既存11神＋無禄だけ", JSON.stringify(others) === JSON.stringify(expected), others.join("・"));
  const withStill = ACTIVITY_PROFILES.filter((p) => (p.reducedStillUnfavorableActivityIds ?? []).length > 0).map((p) => p.sourceName).sort();
  check("6. 解除後の残存忌を持つのは小時と無禄だけ", JSON.stringify(withStill) === JSON.stringify(["小時", "無禄"].sort()), withStill.join("・"));
}

console.log("[区分B] 九扻（九焦）・無禄の宜忌と無禄の解除");
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
