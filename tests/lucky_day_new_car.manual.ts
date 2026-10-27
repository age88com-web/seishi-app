// tests/lucky_day_new_car.manual.ts
//
// 目的:
//   一般向け「新車購入・納車の吉日」（src/lib/luckyDay/newCarJudgment.ts・newCarMonth.ts）を検証する。
//   ・買車＝月破でない AND 長星でない AND 短星でない AND 立券交易＝good
//   ・交車＝月破でない AND 出行＝good（長星・短星は除外しない）
//   ・月破は吉神と併臨しても除外。凶・追加除外・未確定は状態を分けて保持
//   ・月の切替（月末・月初・閏年）と無料/有料の表示範囲（既存 isDateAllowedForDetail）
//   ・判定が既存エンジンの結果を書き換えないこと
//
// 実行:
//   npx tsx tests/lucky_day_new_car.manual.ts

import { calculateTakujitsuFull, resolveShinsatsuRelations, resolveJianchu } from "../src/lib/takujitsu";
import { evaluateActivities } from "../src/lib/takujitsu/activity/evaluateActivities";
import type { ActivityEvaluation, ActivityVerdict } from "../src/lib/takujitsu/activity";
import {
  judgeNewCarFromFacts,
  judgeNewCarDay,
  describeNewCarDay,
  NEW_CAR_STATUS_SYMBOL,
} from "../src/lib/luckyDay/newCarJudgment";
import { buildNewCarMonth, daysInMonthOf, shiftYearMonth, isValidNewCarYearMonth } from "../src/lib/luckyDay/newCarMonth";

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

function ev(activityId: string, verdict: ActivityVerdict): ActivityEvaluation {
  const pos = verdict === "good" || verdict === "mixed" ? [{ sourceType: "kichijin" as const, sourceName: "テスト吉神" }] : [];
  const neg = verdict === "bad" || verdict === "mixed" ? [{ sourceType: "kyojin" as const, sourceName: "テスト凶神" }] : [];
  return { activityId, positiveSources: pos, negativeSources: neg, verdict, hasPendingSource: false };
}
function facts(kyojin: string[], buy: ActivityVerdict, delivery: ActivityVerdict) {
  return judgeNewCarFromFacts({
    dateIso: "2026-01-01",
    weekday: 4,
    dayStem: "甲",
    dayBranch: "子",
    kyojin,
    evaluations: [ev("立券交易", buy), ev("出行", delivery)],
  });
}

// 1〜2. 月破＋good → 推奨対象外
{
  const j = facts(["月破"], "good", "good");
  check("1 月破＋立券交易good → 買車は月破で推奨対象外", j.buy.status === "excluded_geppa" && j.buy.baseVerdict === "good", j.buy.status);
  check("2 月破＋出行good → 交車は月破で推奨対象外", j.delivery.status === "excluded_geppa" && j.delivery.baseVerdict === "good", j.delivery.status);
  check("1-2 月破の日は ともに吉 にしない", !j.bothGood);
  check("1-2 月破の説明は1文", JSON.stringify(describeNewCarDay(j)) === JSON.stringify(["新車購入・納車：推奨対象外。月破に該当します。"]));
  check("1-2 月破の記号は ◎ ではない", NEW_CAR_STATUS_SYMBOL[j.buy.status] === "—" && NEW_CAR_STATUS_SYMBOL[j.delivery.status] === "—");
}

// 3. 月破＋徳神（既存エンジンの resolution・評価をそのまま使う）
for (const deity of ["天徳", "月徳", "天赦", "歳徳"]) {
  const evaluations = evaluateActivities({
    resolution: resolveShinsatsuRelations({ kichijin: [deity], kyojin: ["月破"] }),
    buildingDay: resolveJianchu({ monthBranch: "寅", dayBranch: "寅" }),
  }).evaluations;
  const j = judgeNewCarFromFacts({ dateIso: "2026-01-01", weekday: 4, dayStem: "甲", dayBranch: "子", kyojin: ["月破"], evaluations });
  check(`3 月破＋${deity} → 買車・交車とも月破で推奨対象外`, j.buy.status === "excluded_geppa" && j.delivery.status === "excluded_geppa", `${j.buy.status}/${j.delivery.status}`);
}

// 4〜6. 長星・短星
{
  const a = facts(["長星"], "good", "good");
  check("4 長星＋月破なし＋立券交易good → 買車は推奨対象外", a.buy.status === "excluded_star" && JSON.stringify(a.buy.exclusions) === '["長星"]');
  check("4 長星の説明", describeNewCarDay(a)[0] === "新車購入：推奨対象外。長星が成立しています。");
  const b = facts(["短星"], "good", "good");
  check("5 短星＋月破なし＋立券交易good → 買車は推奨対象外", b.buy.status === "excluded_star" && JSON.stringify(b.buy.exclusions) === '["短星"]');
  check("6 長星＋月破なし → 交車は出行good のまま吉", a.delivery.status === "good" && a.delivery.exclusions.length === 0);
  check("6 短星＋月破なし → 交車は出行good のまま吉", b.delivery.status === "good");
  for (const v of ["mixed", "bad", "neutral"] as const) {
    const c = facts(["長星", "短星"], "good", v);
    check(`6 長星・短星＋出行${v} → 交車は既存判定のまま`, c.delivery.status === (v === "neutral" ? "undetermined" : v), c.delivery.status);
  }
  const m = facts(["長星"], "mixed", "good");
  check("4 長星は立券交易mixedより優先（追加除外として保持）", m.buy.status === "excluded_star" && m.buy.baseVerdict === "mixed");
  const g = facts(["月破", "長星"], "good", "good");
  check("優先順位：月破は長星より優先", g.buy.status === "excluded_geppa" && g.buy.exclusions.includes("長星"));
}

// 7〜10
{
  const j = facts([], "good", "good");
  check("7 両用事good＋追加除外なし → 両方吉", j.buy.status === "good" && j.delivery.status === "good" && j.bothGood);
  check("7 吉の説明", describeNewCarDay(j)[0] === "新車購入：吉。立券交易に適し、月破・長星・短星にも該当しません。" && describeNewCarDay(j)[1] === "納車：吉。出行に適し、月破に該当しません。");
  const k = facts([], "mixed", "good");
  check("8 立券交易mixed → 買車を吉にしない（△）", k.buy.status === "mixed" && NEW_CAR_STATUS_SYMBOL[k.buy.status] === "△" && !k.bothGood);
  const l = facts([], "good", "bad");
  check("9 出行bad → 交車を吉にしない", l.delivery.status === "bad" && NEW_CAR_STATUS_SYMBOL[l.delivery.status] === "—" && !l.bothGood);
  const n = facts([], "neutral", "neutral");
  check("10 neutral → 吉凶未確定（？）で凶と区別", n.buy.status === "undetermined" && n.delivery.status === "undetermined" && NEW_CAR_STATUS_SYMBOL.undetermined === "？");
  const none = judgeNewCarFromFacts({ dateIso: "2026-01-01", weekday: 4, dayStem: "甲", dayBranch: "子", kyojin: [], evaluations: [] });
  check("10 評価が無い用事も未確定", none.buy.status === "undetermined" && none.buy.baseVerdict === "neutral");
}

// 実日付の全数確認（2025〜2027年）：月破の日に吉が出ない・定義どおり・エンジン結果を書き換えない
{
  let days = 0, geppaDays = 0, starDays = 0, buyGood = 0, delGood = 0, both = 0, geppaWithEngineGood = 0, starWithBuyGood = 0;
  const bad: string[] = [];
  for (let t = Date.UTC(2025, 0, 1); t <= Date.UTC(2027, 11, 31); t += 86_400_000) {
    const d = new Date(t);
    const iso = d.toISOString().slice(0, 10);
    const r = calculateTakujitsuFull({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: 12, minute: 0, timezone: "Asia/Tokyo" });
    const before = JSON.stringify(r);
    const j = judgeNewCarDay(iso, d.getUTCDay(), r);
    if (JSON.stringify(r) !== before) bad.push(`${iso} エンジン結果が変化`);
    const v = (id: string) => r.activities.evaluations.find((e) => e.activityId === id)?.verdict ?? "neutral";
    const geppa = r.shinsatsu.kyojin.includes("月破");
    const star = r.shinsatsu.kyojin.includes("長星") || r.shinsatsu.kyojin.includes("短星");
    days++;
    if (geppa) geppaDays++;
    if (star) starDays++;
    if (geppa && (v("立券交易") === "good" || v("出行") === "good")) geppaWithEngineGood++;
    if (!geppa && star && v("立券交易") === "good") starWithBuyGood++;
    if (geppa && (j.buy.status === "good" || j.delivery.status === "good")) bad.push(`${iso} 月破の日に吉`);
    const expBuy = !geppa && !star && v("立券交易") === "good";
    const expDel = !geppa && v("出行") === "good";
    if ((j.buy.status === "good") !== expBuy) bad.push(`${iso} 買車 ${j.buy.status}`);
    if ((j.delivery.status === "good") !== expDel) bad.push(`${iso} 交車 ${j.delivery.status}`);
    if (!geppa && j.delivery.exclusions.length > 0) bad.push(`${iso} 交車に月破以外の除外`);
    if (j.bothGood !== (expBuy && expDel)) bad.push(`${iso} ともに吉`);
    if (j.buy.baseVerdict !== v("立券交易") || j.delivery.baseVerdict !== v("出行")) bad.push(`${iso} baseVerdict`);
    if (j.buy.status === "good") buyGood++;
    if (j.delivery.status === "good") delGood++;
    if (j.bothGood) both++;
  }
  check("実日付：判定が定義どおり・月破の日に吉なし・エンジン結果不変", bad.length === 0, bad.slice(0, 5).join("／"));
  check("実日付：月破の日が存在する", geppaDays > 0, String(geppaDays));
  check("実日付：長星・短星の日が存在する", starDays > 0, String(starDays));
  console.log(`  参考（2025〜2027年 ${days}日）：月破 ${geppaDays}日（うちエンジンで立券交易/出行good ${geppaWithEngineGood}日）、長星・短星 ${starDays}日（うち月破なし・立券交易good ${starWithBuyGood}日）、買車吉 ${buyGood}日、交車吉 ${delGood}日、ともに吉 ${both}日`);
}

// 根拠表示：六黄道・六黒道の追従分を直接の根拠と分ける（判定・件数は変えない）
{
  const evaluations = evaluateActivities({
    resolution: resolveShinsatsuRelations({ kichijin: ["寶光", "天徳"], kyojin: ["白虎", "天吏"] }),
    buildingDay: resolveJianchu({ monthBranch: "寅", dayBranch: "寅" }),
  }).evaluations;
  const j = judgeNewCarFromFacts({ dateIso: "2026-01-01", weekday: 4, dayStem: "甲", dayBranch: "子", kyojin: ["白虎", "天吏"], evaluations });
  check("根拠 寶光は宜の直接根拠に入らず、天徳に追従と表示",
    !j.buy.positiveSources.some((s) => s.name === "寶光") && j.buy.positiveFollowers.some((f) => f.name === "寶光" && f.follows.includes("天徳")),
    JSON.stringify(j.buy.positiveFollowers));
  check("根拠 白虎は忌の直接根拠に入らず、天吏に追従と表示",
    !j.buy.negativeSources.some((s) => s.name === "白虎") && j.buy.negativeFollowers.some((f) => f.name === "白虎" && f.follows.includes("天吏")),
    JSON.stringify(j.buy.negativeFollowers));
  check("根拠 追従先に十二直・宿・六黄道を含めない", [...j.buy.positiveFollowers, ...j.buy.negativeFollowers].every((f) => f.follows.every((n) => !["寶光", "白虎"].includes(n) && !n.includes("（十二直）"))));
}
{
  const COMPOSITE = new Set(["青龍", "明堂", "寶光", "玉堂", "司命", "天刑", "朱雀", "白虎", "天牢", "元武", "勾陳"]);
  const bad: string[] = [];
  let followerDays = 0;
  for (let t = Date.UTC(2025, 0, 1); t <= Date.UTC(2027, 11, 31); t += 86_400_000) {
    const d = new Date(t);
    const iso = d.toISOString().slice(0, 10);
    const r = calculateTakujitsuFull({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: 12, minute: 0, timezone: "Asia/Tokyo" });
    const j = judgeNewCarDay(iso, d.getUTCDay(), r);
    for (const part of [j.buy, j.delivery]) {
      const e = r.activities.evaluations.find((x) => x.activityId === part.baseActivityId);
      for (const side of ["positive", "negative"] as const) {
        const src = (side === "positive" ? e?.positiveSources : e?.negativeSources) ?? [];
        const direct = side === "positive" ? part.positiveSources : part.negativeSources;
        const fol = side === "positive" ? part.positiveFollowers : part.negativeFollowers;
        if (fol.length > 0) followerDays++;
        if (direct.length + fol.length !== src.length) bad.push(`${iso} ${part.baseActivityId} ${side} 件数 ${direct.length}+${fol.length}≠${src.length}`);
        if (direct.some((s) => COMPOSITE.has(s.name))) bad.push(`${iso} ${part.baseActivityId} ${side} 追従要素が直接根拠に残る`);
        const targetType = side === "positive" ? "kichijin" : "kyojin";
        const allowed = new Set(src.filter((s) => s.sourceType === targetType && !COMPOSITE.has(s.sourceName)).map((s) => s.sourceName));
        for (const f of fol) {
          if (f.follows.length === 0 || f.follows.some((n) => !allowed.has(n))) bad.push(`${iso} ${part.baseActivityId} ${side} ${f.name} の追従先が不正`);
          if (!src.some((s) => s.sourceName === f.name)) bad.push(`${iso} ${f.name} はエンジンの出典に無い`);
        }
      }
    }
  }
  check("根拠 実日付：追従分は直接根拠と分離・二重計上なし・存在しない根拠なし", bad.length === 0, bad.slice(0, 5).join("／"));
  check("根拠 実日付：追従分の表示が実際に発生する", followerDays > 0, String(followerDays));
}

// 11. 月の切替（月末・月初・閏年）
{
  check("11 閏年 2028年2月は29日", daysInMonthOf(2028, 2) === 29 && buildNewCarMonth(2028, 2, "2028-02-01", true).days.length === 29);
  check("11 平年 2026年2月は28日", daysInMonthOf(2026, 2) === 28);
  check("11 2100年は平年（2100-02 は28日）", daysInMonthOf(2100, 2) === 28);
  check("11 31日の月", buildNewCarMonth(2026, 1, "2026-01-01", true).days.at(-1)?.dateIso === "2026-01-31");
  check("11 12月→翌月は翌年1月", JSON.stringify(shiftYearMonth(2025, 12, 1)) === '{"year":2026,"month":1}');
  check("11 1月→前月は前年12月", JSON.stringify(shiftYearMonth(2026, 1, -1)) === '{"year":2025,"month":12}');
  const feb = buildNewCarMonth(2028, 2, "2028-02-01", true);
  check("11 月初・月末の日付と曜日", feb.days[0].dateIso === "2028-02-01" && feb.days[0].weekday === 2 && feb.days[28].dateIso === "2028-02-29" && feb.days[28].weekday === 2);
  check("11 入力検証", isValidNewCarYearMonth(2026, 10) && !isValidNewCarYearMonth(2026, 13) && !isValidNewCarYearMonth(2026, 0) && !isValidNewCarYearMonth(1800, 1) && !isValidNewCarYearMonth("2026", 1) && !isValidNewCarYearMonth(2026.5, 1));
}

// 13. 無料・有料（既存 isDateAllowedForDetail：無料＝今日〜今日+30日）
{
  const today = "2026-10-26";
  const oct = buildNewCarMonth(2026, 10, today, false);
  const nov = buildNewCarMonth(2026, 11, today, false);
  const dec = buildNewCarMonth(2026, 12, today, false);
  const unlocked = [...oct.days, ...nov.days, ...dec.days].filter((d) => !d.locked).map((d) => d.dateIso);
  check("13 無料：表示できるのは今日〜今日+30日の31日", unlocked.length === 31 && unlocked[0] === "2026-10-26" && unlocked.at(-1) === "2026-11-25", `${unlocked.length} ${unlocked[0]}〜${unlocked.at(-1)}`);
  check("13 無料：過去日・範囲外は locked で判定データを持たない",
    [...oct.days, ...nov.days, ...dec.days].filter((d) => d.locked).every((d) => !("judgment" in d)) && oct.hasLockedDays && dec.days.every((d) => d.locked));
  const paid = buildNewCarMonth(2025, 3, today, true);
  check("13 有料：過去月も全日表示", paid.days.every((d) => !d.locked) && !paid.hasLockedDays);
}

console.log("[区分B] 一般向け 新車購入・納車の吉日");
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
