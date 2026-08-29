// tests/ganzhi_parity.manual.ts
//
// 目的:
//   page.tsx の干支計算を eto.ts から CalendarEngine.calculate() へ置き換えた際の
//   互換性検証。旧 eto.ts の関数と新 CalendarEngine の結果を突き合わせる。
//
// page.tsx の呼び出しを再現:
//   dObj = new Date(date + "T" + time)         （ブラウザローカル＝JST 前提）
//   旧: yearStemBranch(dObj) / dayStemBranch(dForDay) / monthBranch(dObj)
//       dForDay = h>=23 なら +1h した dObj
//   新: calculate({ year, month, day, hour, minute })  ← dObj のローカル値をそのまま
//
// 実行: TZ=Asia/Tokyo npx tsx tests/ganzhi_parity.manual.ts

import { yearStemBranch, dayStemBranch, monthBranch } from "../src/lib/eto";
import { calculate } from "../src/lib/calendar";

interface Case { date: string; time: string; note?: string }

const cases: Case[] = [
  { date: "1990-01-01", time: "12:00", note: "一般的な生年月日" },
  { date: "1985-07-15", time: "09:30" },
  { date: "2000-12-31", time: "23:30", note: "子初(23時)またぎ" },
  { date: "1972-03-20", time: "06:00" },
  { date: "1996-09-09", time: "18:45" },
  { date: "2010-05-05", time: "00:10" },
  { date: "1963-11-22", time: "15:00" },
  { date: "1948-08-08", time: "21:20" },
  { date: "2023-06-21", time: "12:00", note: "夏至前後" },
  { date: "1937-10-02", time: "04:40" },
  // --- 意図的に境界に近いケース（差が出る可能性） ---
  { date: "1991-02-04", time: "12:00", note: "立春当日（境界）" },
  { date: "1991-02-03", time: "23:50", note: "立春直前（境界）" },
  { date: "1988-03-05", time: "08:00", note: "啓蟄前後（月支境界）" },
];

let match = 0;
let diff = 0;

function old(dateStr: string, timeStr: string) {
  const dObj = new Date(dateStr + "T" + timeStr);
  const dForDay = new Date(dObj.getTime());
  if (dForDay.getHours() >= 23) dForDay.setHours(dForDay.getHours() + 1);
  const y = yearStemBranch(dObj);
  const d = dayStemBranch(dForDay);
  return {
    year: y.stem + y.branch,
    day: d.stem + d.branch,
    month: monthBranch(dObj),
  };
}

function neu(dateStr: string, timeStr: string) {
  const dObj = new Date(dateStr + "T" + timeStr);
  const r = calculate({
    year: dObj.getFullYear(),
    month: dObj.getMonth() + 1,
    day: dObj.getDate(),
    hour: dObj.getHours(),
    minute: dObj.getMinutes(),
  });
  return {
    year: r.yearStem + r.yearBranch,
    day: r.dayStem + r.dayBranch,
    month: r.monthBranch,
  };
}

console.log(`TZ=${process.env.TZ ?? "(system)"}\n`);
for (const c of cases) {
  const o = old(c.date, c.time);
  const n = neu(c.date, c.time);
  const same = o.year === n.year && o.day === n.day && o.month === n.month;
  if (same) match += 1;
  else diff += 1;
  const tag = same ? "MATCH" : "DIFF ";
  console.log(
    `${tag} ${c.date} ${c.time}${c.note ? "  (" + c.note + ")" : ""}`,
  );
  if (!same) {
    console.log(`      年 old=${o.year} new=${n.year}`);
    console.log(`      日 old=${o.day} new=${n.day}`);
    console.log(`      月 old=${o.month} new=${n.month}`);
  }
}

console.log(`\n${match} match, ${diff} diff`);
