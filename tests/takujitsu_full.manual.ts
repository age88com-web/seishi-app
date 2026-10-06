// tests/takujitsu_full.manual.ts
//
// 目的:
//   擇日UI統合 wrapper（src/lib/takujitsu/full.ts の calculateTakujitsuFull）の
//   疎通テスト。CalendarEngine → calculateTakujitsu → evaluateActivities まで
//   1回の呼び出しで UI が必要な形の結果を返すことを確認する。
//   ロジックは既存モジュールのものをそのまま使う（wrapper は薄い統合層）。
//
// 実行:
//   npx tsx tests/takujitsu_full.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import { calculateTakujitsuFull } from "../src/lib/takujitsu";
import { ACTIVITY_BY_ID } from "../src/lib/takujitsu/activity";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(label: string, cond: boolean) {
  if (cond) pass += 1;
  else {
    fail += 1;
    failures.push(`  ${label}`);
  }
}

// -----------------------------------------------------------------------
// 1. 代表日で一括計算できる（暦→神殺→resolution→十二建除→二十八宿→用途判定）
// -----------------------------------------------------------------------
{
  const r = calculateTakujitsuFull({ year: 2024, month: 6, day: 15, hour: 12, minute: 0, timezone: "Asia/Tokyo" });

  check("1. calendar が返る（干支・節気）", !!r.calendar.dayStem && !!r.calendar.solarTerm);
  check("1. buildingDay（十二建除）が返る", !!r.buildingDay.name && !!r.buildingDay.reading);
  check("1. shuku28（二十八宿）が返る", !!r.shuku28 && !!r.shuku28.lodge && !!r.shuku28.shukuYo);
  check("1. resolution.kichijin / kyojin が配列で返る", Array.isArray(r.resolution.kichijin) && Array.isArray(r.resolution.kyojin));
  check("1. resolution 各 entry が name/status を持つ", r.resolution.kyojin.every((e) => !!e.name && !!e.status));
  check("1. shinsatsu（raw occurrence）が保持されている", Array.isArray(r.shinsatsu.kichijin) && Array.isArray(r.shinsatsu.kyojin));
  check("1. activities.evaluations が返る", Array.isArray(r.activities.evaluations) && r.activities.evaluations.length > 0);
  check("1. activities.suppressions / unresolvedRestrictions が配列", Array.isArray(r.activities.suppressions) && Array.isArray(r.activities.unresolvedRestrictions));
}

// -----------------------------------------------------------------------
// 2. 用途結果が UI で使える形（verdict・source・ActivityDefinition対応）
// -----------------------------------------------------------------------
{
  const r = calculateTakujitsuFull({ year: 2024, month: 6, day: 15, hour: 12, minute: 0 });
  const ev = r.activities.evaluations;

  check("2. verdict が good/bad/mixed/neutral のいずれか", ev.every((e) => ["good", "bad", "mixed", "neutral"].includes(e.verdict)));
  check("2. good は positiveSources のみ非空", ev.filter((e) => e.verdict === "good").every((e) => e.positiveSources.length > 0 && e.negativeSources.length === 0));
  check("2. bad は negativeSources のみ非空", ev.filter((e) => e.verdict === "bad").every((e) => e.negativeSources.length > 0 && e.positiveSources.length === 0));
  check("2. mixed は両方非空", ev.filter((e) => e.verdict === "mixed").every((e) => e.positiveSources.length > 0 && e.negativeSources.length > 0));
  check("2. 全 activityId が ActivityDefinition に存在する", ev.every((e) => !!ACTIVITY_BY_ID[e.activityId]));
  check("2. source が sourceType/sourceName を持つ", ev.every((e) => [...e.positiveSources, ...e.negativeSources].every((s) => !!s.sourceType && !!s.sourceName)));
  check("2. sourceType は kichijin/kyojin/jianchu/shuku28 のいずれか", ev.every((e) => [...e.positiveSources, ...e.negativeSources].every((s) => ["kichijin", "kyojin", "jianchu", "shuku28"].includes(s.sourceType))));
}

// -----------------------------------------------------------------------
// 3. 十二建除・二十八宿が「通常 source」として用途判定に現れる
// -----------------------------------------------------------------------
{
  const r = calculateTakujitsuFull({ year: 2024, month: 6, day: 15, hour: 12, minute: 0 });
  const allSources = r.activities.evaluations.flatMap((e) => [...e.positiveSources, ...e.negativeSources]);
  check("3. jianchu 由来 source が用途判定に現れる", allSources.some((s) => s.sourceType === "jianchu"));
  check("3. shuku28 由来 source が用途判定に現れる", allSources.some((s) => s.sourceType === "shuku28"));
}

// -----------------------------------------------------------------------
// 4. 月破日は徳神 positive 抑制の suppression が返る
//    （2024-01-20 = 月破＋天願。evaluate 単体テストと同じ現象を wrapper 経由で確認）
// -----------------------------------------------------------------------
{
  const r = calculateTakujitsuFull({ year: 2024, month: 1, day: 20, hour: 12, minute: 0, timezone: "Asia/Tokyo" });
  check("4. 月破が resolution.kyojin にある", r.resolution.kyojin.some((e) => e.name === "月破"));
  check("4. suppressions が1件以上返る", r.activities.suppressions.length > 0);
  const supp = r.activities.suppressions[0];
  check("4. suppression が suppressedByName=月破 と reason を持つ", supp?.suppressedByName === "月破" && !!supp?.reason && supp.activityIds.length > 0);
}

// -----------------------------------------------------------------------
// 5. 同一入力なら同一結果（純粋関数・副作用なし）
// -----------------------------------------------------------------------
{
  const a = calculateTakujitsuFull({ year: 2025, month: 3, day: 3, hour: 9, minute: 30 });
  const b = calculateTakujitsuFull({ year: 2025, month: 3, day: 3, hour: 9, minute: 30 });
  check("5. calendar が一致", JSON.stringify(a.calendar) === JSON.stringify(b.calendar));
  check("5. activities.evaluations が一致", JSON.stringify(a.activities.evaluations) === JSON.stringify(b.activities.evaluations));
}

console.log("[UI統合] calculateTakujitsuFull 疎通テスト");
console.log(`完全一致: ${pass} / ${pass + fail}`);
console.log(`不一致:   ${fail} / ${pass + fail}\n`);
if (fail > 0) {
  for (const f of failures) console.log(f);
  console.log(`\n${fail} 件 FAIL`);
  process.exit(1);
}
console.log(`${pass} / ${pass + fail} PASS`);
process.exit(0);
