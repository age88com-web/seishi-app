// tests/qimen_dingju_context.manual.ts
//
// 奇門遁甲「超神・接気・置閏」（src/lib/qimen/dingjuContext.ts）の回帰テスト。
// 実行: npx tsx tests/qimen_dingju_context.manual.ts
//
// 期待値の出典:
//   ・講義資料 p16〜p18・p21・p25（docs/source/奇門遁甲講義案N.pdf）
//   ・ユーザー確定仕様（2026-10-06 提示「超神節気・置閏」）: 1974 / 1975 / 1976 / 1979 の連続例
//   ・本プロジェクトの実装規則（ユーザー確定 2026-10-06）:
//       置閏の閾値は「二至当日を含めず、符頭が二至の9日以上前」／日の境は 23:00
//   ※「規則から導出」と記したケースは講義の具体例ではなく、上記規則を適用した結果。
//
// テスト用フレームワーク未導入のため、簡易 assert で検証する。終了コード 0 = PASS。

import { calculate as calculateCalendar } from "../src/lib/calendar";
import type { CalendarInput } from "../src/lib/calendar";
import { calculate as calculateQimen } from "../src/lib/qimen";
import { resolveDingju } from "../src/lib/qimen/dingju";
import type { Stem, Branch } from "../src/lib/eto";
import {
  resolveDingjuContext,
  resolveSolsticeAnchor,
  LEAP_THRESHOLD_DAYS,
} from "../src/lib/qimen/dingjuContext";
import type { QimenDingjuContext, Solstice } from "../src/lib/qimen/dingjuContext";

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  if (actual === expected) {
    pass += 1;
  } else {
    fail += 1;
    console.log(`  FAIL ${label}: got ${String(actual)}, want ${String(expected)}`);
  }
}

function ctxAt(y: number, m: number, d: number, h = 12, mi = 0): QimenDingjuContext {
  const input: CalendarInput = { year: y, month: m, day: d, hour: h, minute: mi, timezone: "Asia/Tokyo" };
  return resolveDingjuContext(calculateCalendar(input), input);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function expectJu(
  label: string, c: QimenDingjuContext,
  term: string, dun: string, yuan: string, ju: number, leap: boolean,
): void {
  check(`${label} 定局節気`, c.effectiveSolarTerm, term);
  check(`${label} 陰陽遁`, c.effectiveDun, dun);
  check(`${label} 三元`, c.effectiveYuan, yuan);
  check(`${label} 局`, c.effectiveJu, ju);
  check(`${label} 置閏`, c.isLeapAdjustment, leap);
}

// ---- 1974: 正授（ユーザー確定仕様）----
{
  console.log("1974-06-22 夏至: 正授");
  const c = ctxAt(1974, 6, 22);
  check("1974 実際の節気", c.actualSolarTerm, "夏至");
  check("1974 関係", c.relation, "正授");
  check("1974 符頭", c.futouDate, "1974-06-22");
  expectJu("1974-06-22", c, "夏至", "陰遁", "上元", 9, false);
}

// ---- 1975: 超神・置閏なし（講義 p17／ユーザー確定仕様）----
{
  console.log("1975-06-22 夏至: 超神・置閏なし");
  const c = ctxAt(1975, 6, 22);
  check("1975 実際の節気", c.actualSolarTerm, "夏至");
  check("1975 関係", c.relation, "超神");
  check("1975 符頭", c.futouDate, "1975-06-17");
  check("1975 差日数（二至当日を含めない）", c.relationDays, 5);
  check("1975 差日数 < 閾値", c.relationDays < LEAP_THRESHOLD_DAYS, true);
  expectJu("1975-06-22", c, "夏至", "陰遁", "中元", 3, false);
  // 6/17〜21 の局は講義に明記なし（規則から導出: 超神のため夏至の上元が 6/17 から始まる）
  for (let d = 17; d <= 21; d += 1) {
    expectJu(`1975-06-${d}`, ctxAt(1975, 6, d), "夏至", "陰遁", "上元", 9, false);
  }
}

// ---- 1976: 置閏（講義 p17／ユーザー確定の受け入れ条件）----
{
  console.log("1976: 6/10まで通常の陽九局 → 6/11〜25 置閏 → 6/26 陰九局");
  for (let d = 6; d <= 10; d += 1) {
    expectJu(`1976-06-${pad(d)}`, ctxAt(1976, 6, d), "芒種", "陽遁", "下元", 9, false);
  }
  for (let d = 11; d <= 15; d += 1) {
    expectJu(`1976-06-${d}`, ctxAt(1976, 6, d), "芒種", "陽遁", "上元", 6, true);
  }
  for (let d = 16; d <= 20; d += 1) {
    expectJu(`1976-06-${d}`, ctxAt(1976, 6, d), "芒種", "陽遁", "中元", 3, true);
  }
  for (let d = 21; d <= 25; d += 1) {
    expectJu(`1976-06-${d}`, ctxAt(1976, 6, d), "芒種", "陽遁", "下元", 9, true);
  }
  // 実際の夏至（6/21 15:15 JST）の前後でも、定局は陽九局のまま
  expectJu("1976-06-21 15:00", ctxAt(1976, 6, 21, 15), "芒種", "陽遁", "下元", 9, true);
  expectJu("1976-06-21 18:00", ctxAt(1976, 6, 21, 18), "芒種", "陽遁", "下元", 9, true);
  expectJu("1976-06-26", ctxAt(1976, 6, 26), "夏至", "陰遁", "上元", 9, false);

  // 天文上の節気と定局用節気の同時保持（仕様 §8）
  const c = ctxAt(1976, 6, 22);
  check("1976-06-22 actualSolarTerm", c.actualSolarTerm, "夏至");
  check("1976-06-22 effectiveSolarTerm", c.effectiveSolarTerm, "芒種");
  check("1976-06-22 actualDun", c.actualDun, "陰遁");
  check("1976-06-22 effectiveDun", c.effectiveDun, "陽遁");
  check("1976-06-22 effectiveJu", c.effectiveJu, 9);
  check("1976-06-22 置閏の二至", c.leap?.solstice, "夏至");
  check("1976-06-22 置閏の節気", c.leap?.repeatedTerm, "芒種");
  check("1976-06-22 置閏期間 初日", c.leap?.startDate, "1976-06-11");
  check("1976-06-22 置閏期間 最終日", c.leap?.endDate, "1976-06-25");
  check("1976-06-22 関係（置閏後の夏至）", c.relation, "接気");
  check("1976-06-22 夏至の上元符頭", c.futouDate, "1976-06-26");

  // 置閏判定の根拠: 1976 夏至の節入り日（6/21）と、置閏前の上元符頭候補（6/11）の差は 10日
  const a = resolveSolsticeAnchor(1976, "夏至");
  check("1976 夏至 上元符頭（置閏後）", a.shangYuanSerial - a.daySerial, 5);
}

// ---- 1979: 接気（ユーザー確定仕様）----
{
  console.log("1979-06-22 夏至: 接気");
  const c = ctxAt(1979, 6, 22);
  check("1979 実際の節気", c.actualSolarTerm, "夏至");
  check("1979 関係", c.relation, "接気");
  check("1979 符頭", c.futouDate, "1979-06-26");
  const f = calculateCalendar({ year: 1979, month: 6, day: 26, hour: 12, minute: 0, timezone: "Asia/Tokyo" });
  check("1979-06-26 日干支", `${f.dayStem}${f.dayBranch}`, "甲子");
  expectJu("1979-06-26", ctxAt(1979, 6, 26), "夏至", "陰遁", "上元", 9, false);
}

// ---- 日の境 23:00（本プロジェクトの基本ルール。CalendarEngine の既存仕様）----
{
  console.log("日の境 23:00");
  // 1976-06-10 23:30 は 6/11 の日干支（甲午）として扱う → 置閏期間の陽六局
  expectJu("1976-06-10 22:59", ctxAt(1976, 6, 10, 22, 59), "芒種", "陽遁", "下元", 9, false);
  expectJu("1976-06-10 23:30", ctxAt(1976, 6, 10, 23, 30), "芒種", "陽遁", "上元", 6, true);
  // 1994 夏至の節入りは 6/21 23:39 JST → 6/22（己卯。符頭）の日として扱い、正授（規則から導出）
  const a = resolveSolsticeAnchor(1994, "夏至");
  check("1994 夏至 節入り日", new Date(a.daySerial * 86_400_000).toISOString().slice(0, 10), "1994-06-22");
  check("1994 夏至 関係", a.relation, "正授");
  check("1994-06-21 23:50 日干支（23:00 以降は翌日）", (() => { const c = calculateCalendar({ year: 1994, month: 6, day: 21, hour: 23, minute: 50, timezone: "Asia/Tokyo" }); return `${c.dayStem}${c.dayBranch}`; })(), "己卯");
}

// ---- 講義例 2015 / 2012（現行結果の維持）----
{
  console.log("講義 p18/p21: 2015-09-08 10:00 / p25: 2012-03-06 卯刻");
  const r = calculateQimen({ year: 2015, month: 9, day: 8, hour: 10, minute: 0, timezone: "Asia/Tokyo" });
  check("2015 実際の節気", r.dingjuContext.actualSolarTerm, "白露");
  check("2015 定局", `${r.dingju.dun}${r.dingju.yuan}${r.dingju.ju}`, "陰遁中元3");
  check("2015 四柱", `${r.calendar.yearStem}${r.calendar.yearBranch}${r.calendar.monthStem}${r.calendar.monthBranch}${r.calendar.dayStem}${r.calendar.dayBranch}${r.calendar.hourStem}${r.calendar.hourBranch}`, "乙未乙酉丁亥乙巳");
  check("2015 旬首", r.xunShou.xunShou, "甲辰");
  check("2015 六儀", r.xunShou.liuyi, "壬");

  const q = calculateQimen({ year: 2012, month: 3, day: 6, hour: 6, minute: 0, timezone: "Asia/Tokyo" });
  check("2012 定局", `${q.dingju.dun}${q.dingju.yuan}${q.dingju.ju}`, "陽遁上元1");
  check("2012 日・時干支", `${q.calendar.dayStem}${q.calendar.dayBranch}${q.calendar.hourStem}${q.calendar.hourBranch}`, "丙寅辛卯");
}

// ---- 局数表（講義 p14・p15。雨水の下元は監修訂正で 3）----
{
  console.log("局数表（雨水の下元は講義表 2 → 監修訂正 3）");
  const TABLE: Record<string, [number, number, number]> = {
    冬至: [1, 7, 4], 啓蟄: [1, 7, 4], 小寒: [2, 8, 5], 春分: [3, 9, 6], 大寒: [3, 9, 6], 芒種: [6, 3, 9],
    穀雨: [5, 2, 8], 小満: [5, 2, 8], 立春: [8, 5, 2], 立夏: [4, 1, 7], 清明: [4, 1, 7], 雨水: [9, 6, 3],
    夏至: [9, 3, 6], 白露: [9, 3, 6], 小暑: [8, 2, 5], 秋分: [7, 1, 4], 大暑: [7, 1, 4], 立秋: [2, 5, 8],
    霜降: [5, 8, 3], 小雪: [5, 8, 3], 大雪: [4, 7, 1], 処暑: [1, 4, 7], 立冬: [6, 9, 3], 寒露: [6, 9, 3],
  };
  // 上元の符頭（甲子）・中元（己巳）・下元（甲戌）
  const futou: [Stem, Branch][] = [["甲", "子"], ["己", "巳"], ["甲", "戌"]];
  for (const [term, jus] of Object.entries(TABLE)) {
    futou.forEach(([st, br], i) => check(`${term} ${["上元", "中元", "下元"][i]}`, resolveDingju({ solarTerm: term, dayStem: st, dayBranch: br }).ju, jus[i]));
  }
  // 実日付: 2026-03-01〜05（甲戌〜戊寅）は雨水の下元 → 陽遁3局
  for (let d = 1; d <= 5; d += 1) {
    expectJu(`2026-03-0${d}`, ctxAt(2026, 3, d), "雨水", "陽遁", "下元", 3, false);
  }
}

// ---- 局所判定と逐次適用の一致（1900〜2100）----
{
  console.log("局所判定 = 逐次適用（1900〜2100 の二至）");
  let prev = resolveSolsticeAnchor(1900, "夏至").shangYuanSerial;
  let bad = 0;
  for (let y = 1900; y <= 2100; y += 1) {
    for (const s of ["夏至", "冬至"] as Solstice[]) {
      if (y === 1900 && s === "夏至") continue;
      const a = resolveSolsticeAnchor(y, s);
      const candidate = prev + 180;
      const expected = a.daySerial - candidate >= LEAP_THRESHOLD_DAYS ? candidate + 15 : candidate;
      if (a.shangYuanSerial !== expected) bad += 1;
      prev = expected;
    }
  }
  check("1900〜2100 の二至で逐次適用と異なる上元符頭", bad, 0);
}

// ---- 局所判定と逐次適用の一致（1974 正授から）----
{
  console.log("局所判定 = 1974年正授からの逐次適用（1974〜1980）");
  const solstices: [number, Solstice][] = [];
  for (let y = 1974; y <= 1980; y += 1) {
    solstices.push([y, "夏至"], [y, "冬至"]);
  }
  let prev = resolveSolsticeAnchor(1974, "夏至").shangYuanSerial;
  const leaps: string[] = [];
  for (const [y, s] of solstices.slice(1)) {
    const a = resolveSolsticeAnchor(y, s);
    const candidate = prev + 180;
    const isLeap = a.daySerial - candidate >= LEAP_THRESHOLD_DAYS;
    const expected = isLeap ? candidate + 15 : candidate;
    check(`${y}${s} 上元符頭`, a.shangYuanSerial, expected);
    if (isLeap) leaps.push(`${y}${s}`);
    prev = expected;
  }
  // 1976 夏至は講義例。1978 冬至は規則から導出（冬至側の講義例は無い）。
  check("置閏した二至（1974〜1980）", leaps.join(","), "1976夏至,1978冬至");
}

// ---- 不変条件（1974-06-01〜1980-06-30 の毎日、正午）----
{
  console.log("不変条件: 1974-06-01〜1980-06-30");
  const leapDays = new Map<string, number>();
  let errors = 0;
  const start = Date.UTC(1974, 5, 1);
  const end = Date.UTC(1980, 5, 30);
  for (let t = start; t <= end; t += 86_400_000) {
    const d = new Date(t);
    let c: QimenDingjuContext;
    try {
      c = ctxAt(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    } catch (e) {
      errors += 1;
      console.log(`  FAIL ${d.toISOString().slice(0, 10)}: ${(e as Error).message}`);
      continue;
    }
    if (c.isLeapAdjustment) {
      const key = `${c.leap?.solstice}:${c.leap?.startDate}`;
      leapDays.set(key, (leapDays.get(key) ?? 0) + 1);
      if (!["芒種", "大雪"].includes(c.effectiveSolarTerm)) errors += 1;
    }
  }
  check("例外なし", errors, 0);
  check(
    "置閏期間",
    [...leapDays.entries()].map(([k, v]) => `${k}x${v}`).join(","),
    "夏至:1976-06-11x15,冬至:1978-12-13x15",
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
