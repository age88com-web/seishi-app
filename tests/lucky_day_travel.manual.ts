// tests/lucky_day_travel.manual.ts
//
// 目的:
//   一般向け「海外旅行・観光の吉日」（src/lib/luckyDay/travelJudgment.ts・travelMonth.ts）を検証する。
//   ・旅行出発＝月破でない AND 歸忌でない AND 往亡でない AND 遠行＝good
//   ・月破・歸忌・往亡は成立で除外（吉神の併臨・resolution の結果で外さない）
//   ・凶・追加除外・未確定は状態を分けて保持
//   ・月の切替（年越し）と無料/有料の表示範囲（既存 isDateAllowedForDetail）
//   ・判定が既存エンジンの結果を書き換えないこと
//   ・研究記録（docs/takujitsu-travel-day-research.md）の年間吉日数 2025=80・2026=81・2027=89
//
// 実行:
//   npx tsx tests/lucky_day_travel.manual.ts

import { calculateTakujitsuFull, resolveShinsatsuRelations, resolveJianchu } from "../src/lib/takujitsu";
import { evaluateActivities } from "../src/lib/takujitsu/activity/evaluateActivities";
import type { ActivityEvaluation, ActivityVerdict } from "../src/lib/takujitsu/activity";
import {
  judgeTravelFromFacts,
  judgeTravelDay,
  describeTravelDay,
  describeTravelPersonal,
  travelDisplayStatus,
  travelDisplayTag,
  TRAVEL_DISPLAY_SYMBOL,
  TRAVEL_STATUS_SYMBOL,
} from "../src/lib/luckyDay/travelJudgment";
import type { PersonalTakujitsuResult } from "../src/lib/takujitsu/personal";
import { buildTravelMonth } from "../src/lib/luckyDay/travelMonth";
import { LUCKY_DAY_PURPOSE_CALENDARS } from "../src/lib/luckyDay/purposeCalendars";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(label: string, cond: boolean, detail = "") {
  if (cond) pass += 1;
  else {
    fail += 1;
    failures.push(`  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function ev(verdict: ActivityVerdict): ActivityEvaluation {
  const pos = verdict === "good" || verdict === "mixed" ? [{ sourceType: "kichijin" as const, sourceName: "テスト吉神" }] : [];
  const neg = verdict === "bad" || verdict === "mixed" ? [{ sourceType: "kyojin" as const, sourceName: "テスト凶神" }] : [];
  return { activityId: "遠行", positiveSources: pos, negativeSources: neg, verdict, hasPendingSource: false };
}
function facts(kyojin: string[], v: ActivityVerdict) {
  return judgeTravelFromFacts({ dateIso: "2026-01-01", weekday: 4, dayStem: "甲", dayBranch: "子", kyojin, evaluations: [ev(v)] });
}

// 1〜4, 6〜8
{
  const g = facts([], "good");
  check("1 遠行good・追加除外なし → ◎", g.status === "good" && TRAVEL_STATUS_SYMBOL[g.status] === "◎");
  check("1 吉の説明", describeTravelDay(g) === "旅行の出発：吉。遠行に適し、月破・歸忌・往亡にも該当しません。");
  for (const [no, n] of [["2", "月破"], ["3", "歸忌"], ["4", "往亡"]] as const) {
    const j = facts([n], "good");
    check(`${no} ${n}＋遠行good → 推奨対象外（—・${n}）`, j.status === "excluded" && j.baseVerdict === "good" && JSON.stringify(j.exclusions) === JSON.stringify([n]) && TRAVEL_STATUS_SYMBOL[j.status] === "—");
    check(`${no} ${n}の説明`, describeTravelDay(j) === `旅行の出発：推奨対象外。${n}に該当します。`);
  }
  const all = facts(["往亡", "月破", "歸忌"], "good");
  check("2-4 重なりは月破・歸忌・往亡の順で保持", JSON.stringify(all.exclusions) === '["月破","歸忌","往亡"]');
  const m = facts([], "mixed");
  check("6 遠行mixed → △", m.status === "mixed" && TRAVEL_STATUS_SYMBOL[m.status] === "△");
  const b = facts([], "bad");
  check("7 遠行bad → —（凶として区別）", b.status === "bad" && TRAVEL_STATUS_SYMBOL[b.status] === "—");
  const n = facts([], "neutral");
  check("8 遠行neutral → ？（吉凶未確定）", n.status === "undetermined" && TRAVEL_STATUS_SYMBOL[n.status] === "？");
  check("8 評価が無い場合も未確定", judgeTravelFromFacts({ dateIso: "2026-01-01", weekday: 4, dayStem: "甲", dayBranch: "子", kyojin: [], evaluations: [] }).status === "undetermined");
  check("除外は既存判定より優先（遠行mixed＋往亡 → 推奨対象外）", facts(["往亡"], "mixed").status === "excluded");
  check("除外条件以外の凶神では除外しない（長星）", facts(["長星"], "good").status === "good");
}

// 5. 吉神と併臨しても必須除外を維持（既存エンジンの resolution・評価をそのまま使う）
for (const deity of ["天徳", "月徳", "天赦", "天願"]) {
  for (const kyo of ["月破", "歸忌", "往亡"]) {
    const evaluations = evaluateActivities({
      resolution: resolveShinsatsuRelations({ kichijin: [deity], kyojin: [kyo] }),
      buildingDay: resolveJianchu({ monthBranch: "寅", dayBranch: "寅" }),
    }).evaluations;
    const j = judgeTravelFromFacts({ dateIso: "2026-01-01", weekday: 4, dayStem: "甲", dayBranch: "子", kyojin: [kyo], evaluations });
    check(`5 ${kyo}＋${deity} → 推奨対象外`, j.status === "excluded" && (j.exclusions as readonly string[]).includes(kyo), `${j.status}/${j.baseVerdict}`);
  }
}

// 実日付の全数確認（2025〜2027年）と年間吉日数
{
  const expected: Record<string, number> = { "2025": 80, "2026": 81, "2027": 89 };
  const goodByYear: Record<string, number> = { "2025": 0, "2026": 0, "2027": 0 };
  const bad: string[] = [];
  let excludedWithEngineGood = 0;
  for (let t = Date.UTC(2025, 0, 1); t <= Date.UTC(2027, 11, 31); t += 86_400_000) {
    const d = new Date(t);
    const iso = d.toISOString().slice(0, 10);
    const r = calculateTakujitsuFull({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: 12, minute: 0, timezone: "Asia/Tokyo" });
    const before = JSON.stringify(r);
    const j = judgeTravelDay(iso, d.getUTCDay(), r);
    if (JSON.stringify(r) !== before) bad.push(`${iso} エンジン結果が変化`);
    const v = r.activities.evaluations.find((e) => e.activityId === "遠行")?.verdict ?? "neutral";
    const ex = ["月破", "歸忌", "往亡"].some((n) => r.shinsatsu.kyojin.includes(n));
    if ((j.status === "good") !== (v === "good" && !ex)) bad.push(`${iso} ${j.status}`);
    if (ex && j.status !== "excluded") bad.push(`${iso} 除外日なのに ${j.status}`);
    if (j.baseVerdict !== v) bad.push(`${iso} baseVerdict`);
    if (ex && v === "good") excludedWithEngineGood++;
    if (j.status === "good") goodByYear[iso.slice(0, 4)]++;
  }
  check("実日付：判定が定義どおり・除外日に吉なし・エンジン結果不変", bad.length === 0, bad.slice(0, 5).join("／"));
  check("実日付：遠行goodを必須除外で外す日が実際にある", excludedWithEngineGood > 0, String(excludedWithEngineGood));
  for (const y of ["2025", "2026", "2027"]) {
    check(`年間吉日数 ${y} = ${expected[y]}`, goodByYear[y] === expected[y], `実測 ${goodByYear[y]}`);
  }
  console.log(`  参考：年間吉日数 2025=${goodByYear["2025"]} 2026=${goodByYear["2026"]} 2027=${goodByYear["2027"]}、遠行goodを必須除外で外した日 ${excludedWithEngineGood}日（3年）`);
}

// 9. 月切替・年越し
{
  const dec = buildTravelMonth(2025, 12, "2025-12-01", true);
  const jan = buildTravelMonth(2026, 1, "2025-12-01", true);
  check("9 12月は31日・1月は31日", dec.days.length === 31 && jan.days.length === 31);
  check("9 年越しの月末・月初", dec.days[30].dateIso === "2025-12-31" && jan.days[0].dateIso === "2026-01-01" && jan.days[0].weekday === 4);
  check("9 閏年2月", buildTravelMonth(2028, 2, "2028-02-01", true).days.length === 29);
}

// 10. 無料・有料（既存 isDateAllowedForDetail：無料＝今日〜今日+30日）
{
  const today = "2026-10-27";
  const months = [buildTravelMonth(2026, 10, today, false), buildTravelMonth(2026, 11, today, false), buildTravelMonth(2026, 12, today, false)];
  const days = months.flatMap((m) => m.days);
  const unlocked = days.filter((d) => !d.locked).map((d) => d.dateIso);
  check("10 無料：表示できるのは今日〜今日+30日の31日", unlocked.length === 31 && unlocked[0] === "2026-10-27" && unlocked.at(-1) === "2026-11-26", `${unlocked.length} ${unlocked[0]}〜${unlocked.at(-1)}`);
  check("10 無料：範囲外は locked で判定データを持たない", days.filter((d) => d.locked).every((d) => !("judgment" in d)) && months[0].hasLockedDays);
  const paid = buildTravelMonth(2025, 3, today, true);
  check("10 有料：過去月も全日表示", paid.days.every((d) => !d.locked) && !paid.hasLockedDays);
}

// 個人の忌日（既存の computePersonalResultForDay の結果を受け取るだけ。判定順：遠行 → 必須除外 → 個人の忌日）
{
  const avoid: PersonalTakujitsuResult = { status: "avoid", reasons: [{ type: "相冲", yearStem: "甲", yearBranch: "子", dayBranch: "午" }] };
  const clear: PersonalTakujitsuResult = { status: "clear", reasons: [] };
  const und: PersonalTakujitsuResult = { status: "undetermined", reasons: [] };
  const g = facts([], "good");
  check("P 未登録（null）なら一般の判定のまま", travelDisplayStatus(g, null) === "good" && travelDisplayTag(g, null) === null && describeTravelPersonal(g, null) === null);
  check("P 吉日＋個人忌日 → 推奨対象外（—・個人忌日）", travelDisplayStatus(g, avoid) === "personal_excluded" && TRAVEL_DISPLAY_SYMBOL.personal_excluded === "—" && travelDisplayTag(g, avoid) === "個人忌日");
  check("P 吉日＋該当なし → 吉日のまま", travelDisplayStatus(g, clear) === "good");
  check("P 判定できない（undetermined）では除外も繰り上げもしない", travelDisplayStatus(g, und) === "good" && travelDisplayStatus(facts([], "mixed"), und) === "mixed");
  for (const v of ["mixed", "bad", "neutral"] as const) {
    const j = facts([], v);
    check(`P 個人忌日は吉日に繰り上げない（${v}）`, travelDisplayStatus(j, clear) === j.status && travelDisplayStatus(j, avoid) === j.status);
  }
  const ex = facts(["往亡"], "good");
  check("P 必須除外の日は除外のまま、理由に個人忌日を併記", travelDisplayStatus(ex, avoid) === "excluded" && travelDisplayTag(ex, avoid) === "往亡・個人忌日");
  check("P 詳細の理由（相冲）", describeTravelPersonal(g, avoid) === "本人には避けたい日（相冲）のため、旅行の出発には推奨しません。");
  check("P 一般の判定（status）は書き換えない", g.status === "good" && ex.status === "excluded");

  // 実データ：既存の個人判定（有料会員のときだけ計算）を通した月間一覧
  const today = "2026-10-27";
  const birthA = { year: 1996, month: 10, day: 15 };
  const birthB = { year: 1980, month: 6, day: 1 };
  const months = [10, 11, 12].map((m) => [buildTravelMonth(2026, m, today, true), buildTravelMonth(2026, m, today, true, birthA), buildTravelMonth(2026, m, today, true, birthB)] as const);
  let avoidGoodA = 0, keptGoodA = 0, bad = 0;
  const avoidA: string[] = [], avoidB: string[] = [];
  for (const [base, a, b] of months) {
    base.days.forEach((d0, i) => {
      const da = a.days[i], db = b.days[i];
      if (d0.locked || da.locked || db.locked) return;
      if (d0.personal !== null) bad++; // 1. 未登録では個人判定なし
      if (JSON.stringify(d0.judgment) !== JSON.stringify(da.judgment)) bad++; // 一般の判定は生年月日で変わらない
      const st = travelDisplayStatus(da.judgment, da.personal);
      if (da.personal?.status === "avoid") avoidA.push(d0.dateIso);
      if (db.personal?.status === "avoid") avoidB.push(d0.dateIso);
      if (d0.judgment.status === "good" && da.personal?.status === "avoid") { avoidGoodA++; if (st !== "personal_excluded") bad++; }
      if (d0.judgment.status === "good" && da.personal?.status !== "avoid") { keptGoodA++; if (st !== "good") bad++; }
      if (d0.judgment.status === "excluded" && st !== "excluded") bad++; // 4. 必須除外は維持
      if (d0.judgment.status !== "good" && st === "good") bad++; // 繰り上げなし
    });
  }
  check("P 実データ：未登録は個人判定なし・一般判定不変・除外と維持が定義どおり", bad === 0, String(bad));
  check("P 2. 登録後、吉日のうち個人忌日の日が除外される", avoidGoodA > 0, String(avoidGoodA));
  check("P 3. 個人忌日以外の吉日は維持される", keptGoodA > 0, String(keptGoodA));
  check("P 5. 生年月日を変えると個人忌日の日も変わる", JSON.stringify(avoidA) !== JSON.stringify(avoidB) && avoidB.length > 0);
  const back = buildTravelMonth(2026, 11, today, true, null);
  check("P 6. 入力を解除（null）すると元の一覧に戻る", JSON.stringify(back) === JSON.stringify(months[1][0]));
  const free = buildTravelMonth(2026, 11, today, false, birthA);
  check("P 7. 無料：生年月日を送っても個人判定は計算しない・範囲外は locked",
    free.days.every((d) => d.locked || d.personal === null) && free.days.filter((d) => d.locked).every((d) => !("judgment" in d) && !("personal" in d)) && free.hasLockedDays);
  console.log(`  参考（2026年10〜12月・有料・1996-10-15）：吉日のうち個人忌日で除外 ${avoidGoodA}日、維持 ${keptGoodA}日`);
}

// 11. 新車カレンダーへの影響なし（ボタン一覧の順序と新車の項目を維持）
check("11 目的別ボタンは新車・海外旅行の順", JSON.stringify(LUCKY_DAY_PURPOSE_CALENDARS) === JSON.stringify([
  { href: "/lucky-day/car", label: "新車購入・納車吉日" },
  { href: "/lucky-day/travel", label: "海外旅行・観光吉日" },
]));

console.log("[区分B] 一般向け 海外旅行・観光の吉日");
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
