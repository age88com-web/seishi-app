// tests/lucky_day_doyo_recommendation.manual.ts
//
// 目的:
//   一般向け /lucky-day の土用推薦除外（src/lib/luckyDay/doyoRecommendation.ts）を検証する。
//   ・対象用事（建築・土地・住宅工事系＋作灶、安吟は対象外）
//   ・土用にかかる日だけ「適したこと」「適した日」から外し、凶へは移さないこと
//   ・擇日エンジン（プロ向けと共通）の判定は変わらないこと
//
// 実行:
//   npx tsx tests/lucky_day_doyo_recommendation.manual.ts

import { calculateTakujitsuFull, resolveDoyoDayStatus, searchTakujitsuDays } from "../src/lib/takujitsu";
import { ACTIVITY_BY_ID } from "../src/lib/takujitsu/activity";
import {
  LUCKY_DAY_DOYO_EXCLUDED_ACTIVITY_IDS,
  LUCKY_DAY_DOYO_NOTICE,
  isDoyoDayFromKyojin,
  isDoyoRecommendationExcluded,
  splitDoyoRecommendedDays,
  splitDoyoRecommendedIds,
} from "../src/lib/luckyDay/doyoRecommendation";

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

function day(month: number, d: number) {
  return calculateTakujitsuFull({ year: 2026, month, day: d, hour: 12, minute: 0, timezone: "Asia/Tokyo" });
}

function goodIds(r: ReturnType<typeof day>): string[] {
  return r.activities.evaluations.filter((e) => e.verdict === "good").map((e) => e.activityId);
}

// 1. 対象用事
{
  const ids = LUCKY_DAY_DOYO_EXCLUDED_ACTIVITY_IDS;
  check("1. 対象用事は30件（重複なし）", ids.length === 30 && new Set(ids).size === 30, String(ids.length));
  check("1. 対象用事はすべて ActivityDefinition に実在する", ids.every((id) => ACTIVITY_BY_ID[id] !== undefined));
  for (const id of ["作灶", "起基定硬", "上梁", "安門", "修宅日", "作厠", "修造動土", "修造", "動土", "建築"]) {
    check(`1. ${id} は対象`, isDoyoRecommendationExcluded(id));
  }
  for (const id of ["移徒", "入宅", "搬入", "伐木", "安吟"]) {
    check(`1. ${id} は対象外`, !isDoyoRecommendationExcluded(id));
  }
  check("1. 注意文は「一部」と書く", LUCKY_DAY_DOYO_NOTICE === "土用期間中のため、建築・工事関係の一部はおすすめから除外しています。");
}

// 2. 2026-10-24（秋土用中）の「適したこと」
{
  const r = day(10, 24);
  check("2. 10/24 は土用にかかる日", isDoyoDayFromKyojin(r.shinsatsu.kyojin));
  const good = goodIds(r);
  const { kept, excluded } = splitDoyoRecommendedIds(good, true);
  check("2. 10/24 は除外が1件以上ある（注意文を出す）", excluded.length > 0, String(excluded.length));
  check("2. 10/24 の「適したこと」に対象用事が1件も残らない", kept.every((id) => !isDoyoRecommendationExcluded(id)));
  // 作灶・上梁・安門はエンジン上は吉のまま（表示フィルターだけで外す）。
  // 起基定硬・修宅日・作厠は 2026-10-24 の土王用事の実務展開で、エンジン上も土王用事の忌になった。
  for (const id of ["作灶", "上梁", "安門"]) {
    check(`2. 10/24 ${id} はエンジン上は吉のまま（判定は変えない）`, good.includes(id));
  }
  for (const id of ["起基定硬", "修宅日", "作厠"]) {
    const ev = r.activities.evaluations.find((e) => e.activityId === id);
    check(`2. 10/24 ${id} はエンジン上も土王用事の忌（吉ではない）`, !good.includes(id) && ev?.negativeSources.some((s) => s.sourceName === "土王用事") === true);
  }
  for (const id of ["作灶", "起基定硬", "上梁", "安門", "修宅日", "作厠"]) {
    check(`2. 10/24 ${id} は「適したこと」に残らない`, !kept.includes(id));
  }
  for (const id of ["移徒", "入宅", "搬入", "伐木", "安吟"]) {
    check(`2. 10/24 ${id} は吉で、土用推薦フィルターでは除外されない`, good.includes(id) && kept.includes(id));
  }
  // 凶へ移さない：除外した用事の verdict はエンジンのまま good
  check("2. 除外した用事のエンジン判定はすべて good のまま",
    excluded.every((id) => r.activities.evaluations.find((e) => e.activityId === id)?.verdict === "good"));
  console.log(`  10/24 推薦除外（エンジン上は吉）: ${excluded.length}件 ${excluded.join("・")}`);
}

// 3. 土用でない日は除外しない
{
  const r = day(10, 19);
  check("3. 10/19 は土用にかからない", !isDoyoDayFromKyojin(r.shinsatsu.kyojin));
  const good = goodIds(r);
  const { kept, excluded } = splitDoyoRecommendedIds(good, isDoyoDayFromKyojin(r.shinsatsu.kyojin));
  check("3. 10/19 は何も除外しない", excluded.length === 0 && kept.length === good.length);
}

// 4. 土用入り日・土用明け日も対象（日単位で一部でも土用）
{
  check("4. 10/20（土用入り日）は土用にかかる日", isDoyoDayFromKyojin(day(10, 20).shinsatsu.kyojin));
  check("4. 11/07（土用明け日）は土用にかかる日", isDoyoDayFromKyojin(day(11, 7).shinsatsu.kyojin));
  check("4. 11/08 は土用にかからない", !isDoyoDayFromKyojin(day(11, 8).shinsatsu.kyojin));
}

// 5. 目的から吉日を探す
{
  const search = (activityId: string) => searchTakujitsuDays({ activityId, from: "2026-10-10", to: "2026-11-20", timezone: "Asia/Tokyo" });
  const doyoDates = new Set<string>();
  for (const d of search("作灶").days) {
    if (resolveDoyoDayStatus({ year: d.year, month: d.month, day: d.day, hour: 12, minute: 0, timezone: "Asia/Tokyo" }).kind !== "土用外") {
      doyoDates.add(`${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`);
    }
  }
  check("5. 検索期間の土用日は 10/20〜11/07 の19日", doyoDates.size === 19 && doyoDates.has("2026-10-20") && doyoDates.has("2026-11-07"), String(doyoDates.size));

  const jizo = search("作灶");
  const good = jizo.days.filter((d) => d.verdict === "good");
  const { kept, excludedCount } = splitDoyoRecommendedDays(good, "作灶", doyoDates);
  const iso = (d: { year: number; month: number; day: number }) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
  check("5. 作灶：土用の吉日を「適した日」から外す", excludedCount > 0 && kept.every((d) => !doyoDates.has(iso(d))), String(excludedCount));
  check("5. 作灶：外した日数＋残した日数＝元の吉日数", kept.length + excludedCount === good.length);
  check("5. 作灶：外した日のエンジン判定は good のまま（凶へ移さない）",
    good.filter((d) => doyoDates.has(iso(d))).every((d) => d.verdict === "good"));

  const move = search("移徒");
  const moveGood = move.days.filter((d) => d.verdict === "good");
  const moveSplit = splitDoyoRecommendedDays(moveGood, "移徒", doyoDates);
  check("5. 移徒：対象外なので土用中の吉日も外さない", moveSplit.excludedCount === 0 && moveSplit.kept.length === moveGood.length);

  const angin = search("安吟");
  const anginSplit = splitDoyoRecommendedDays(angin.days.filter((d) => d.verdict === "good"), "安吟", doyoDates);
  check("5. 安吟：対象外なので土用中の吉日も外さない", anginSplit.excludedCount === 0);
}

console.log("[一般向け] 土用推薦除外 doyoRecommendation");
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
