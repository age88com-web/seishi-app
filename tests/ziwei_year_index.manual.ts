// tests/ziwei_year_index.manual.ts
//
// 流年指数（src/lib/ziwei/fortune/yearIndex.ts）の確認。docs/ziwei-basic-spec.md §34。
// fixture: tests/fixtures/ziwei_year_index_examples.json（命盤A の印刷された運命指数からの手計算）
// 実行: npx tsx tests/ziwei_year_index.manual.ts

import { readFileSync } from "node:fs";
import { calculateZiweiChart, dayunAt, xiaoxianAt } from "../src/lib/ziwei";
import type { Branch, ZiweiChart } from "../src/lib/ziwei";
import { calculateChartPower } from "../src/lib/ziwei/power";
import {
  YEAR_INDEX_FORMULA,
  buildFortuneContextFor,
  buildYearFortuneIndexSeries,
  calcYearFortuneIndex,
  parseAppraisalDate,
  selectionFromDate,
  withMajor,
  withMinor,
} from "../src/lib/ziwei/fortune";
import type { FortuneSelection } from "../src/lib/ziwei/fortune";
import fx from "./fixtures/ziwei_year_index_examples.json";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}
const ctxOf = (c: ZiweiChart, s: FortuneSelection) => buildFortuneContextFor(c, parseAppraisalDate(s.appraisalDate)!, s);
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// ---------------------------------------------------------------------------
// 1. 手計算 fixture（命盤A）
// ---------------------------------------------------------------------------
const A = calculateZiweiChart(fx.chart.input as Parameters<typeof calculateZiweiChart>[0]);
const powerA = calculateChartPower(A);
for (const [b, v] of Object.entries(fx.chart.printedIndex)) check(`命盤A ${b}: 印刷値＝エンジン`, powerA.byBranch[b as Branch].index === v);
check("命盤A 大限の範囲", A.dayun.periods[0].startAge === fx.chart.majorFirstStartAge && A.dayun.periods.at(-1)!.endAge === fx.chart.majorLastEndAge);
for (const c of fx.cases) {
  const r = calcYearFortuneIndex(A, c.age);
  check(`命盤A ${c.age}歳: 大限の宮`, (r.major?.branch ?? null) === c.major, `${r.major?.branch}`);
  check(`命盤A ${c.age}歳: 小限の宮`, (r.minor?.branch ?? null) === c.minor, `${r.minor?.branch}`);
  check(`命盤A ${c.age}歳: 流年指数 ${c.yearIndex}`, c.yearIndex === null ? r.yearIndex === null : r.yearIndex !== null && close(r.yearIndex, c.yearIndex), `${r.yearIndex}`);
}
check("大限開始前は beforeFirstMajor", calcYearFortuneIndex(A, 4).status === "beforeFirstMajor" && calcYearFortuneIndex(A, 4).major === null);
check("大限表の範囲外は afterLastMajor", calcYearFortuneIndex(A, 125).status === "afterLastMajor" && calcYearFortuneIndex(A, 125).yearIndex === null);
check("0歳以下は invalidAge", calcYearFortuneIndex(A, 0).status === "invalidAge");
check("式の係数は大限2・小限1", YEAR_INDEX_FORMULA.majorCoefficient === 2 && YEAR_INDEX_FORMULA.minorCoefficient === 1);

// ---------------------------------------------------------------------------
// 2. 式・大限／小限の指数（多数の命盤の全年齢）
// ---------------------------------------------------------------------------
const charts: ZiweiChart[] = [A];
for (let y = 1940; y < 2005; y += 3)
  charts.push(calculateZiweiChart({ birth: { year: y, month: ((y * 5) % 12) + 1, day: 3 + (y % 25), hour: (y * 7) % 24, minute: 0 }, place: "東京", sex: y % 2 ? "male" : "female" }));
let negatives = 0;
for (const c of charts) {
  const power = calculateChartPower(c);
  const series = buildYearFortuneIndexSeries(c, power);
  const last = c.dayun.periods.at(-1)!.endAge;
  check("系列: 1歳〜大限表の最後・重複も欠落もない", series.length === last && series.every((s, i) => s.age === i + 1));
  for (const s of series) {
    const p = dayunAt(c.dayun, s.age);
    const mb = xiaoxianAt(c.xiaoxian, s.age);
    if (!p) {
      check("大限なし → null", s.yearIndex === null && s.major === null);
      continue;
    }
    check("大限指数＝大限の宮の運命指数", s.major!.branch === p.branch && s.major!.destinyIndex === power.byBranch[p.branch].index);
    check("小限指数＝小限の宮の運命指数", s.minor!.branch === mb && s.minor!.destinyIndex === power.byBranch[mb].index);
    check("式 major×2＋minor（小数1桁で正確）", close(s.yearIndex!, Math.round((s.major!.destinyIndex * 2 + s.minor!.destinyIndex) * 10) / 10) && close(s.yearIndex! * 10, Math.round(s.yearIndex! * 10)));
    if (s.yearIndex! < 0) negatives += 1;
  }
  check("系列＝1年分の計算", JSON.stringify(series) === JSON.stringify(series.map((s) => calcYearFortuneIndex(c, s.age, power))));
}
console.log(`負の流年指数: ${negatives} 年（区切りは作らない）`);

// ---------------------------------------------------------------------------
// 3. 選択との連動（小限の年齢から大限を求める）
// ---------------------------------------------------------------------------
const S38 = calculateZiweiChart({ birth: { year: 1965, month: 1, day: 10, hour: 0, minute: 0 }, place: "東京", sex: "male" });
{
  const s0 = selectionFromDate(S38, "2008-07-01");
  const f0 = ctxOf(S38, s0);
  check("鑑定日の小限（45歳）の流年指数", f0.yearIndex!.age === 45 && f0.yearIndex!.major!.startAge === 42);
  const s1 = withMinor(S38, s0, 57);
  const f1 = ctxOf(S38, s1);
  check("小限を変えると流年指数が変わる", f1.yearIndex!.age === 57 && f1.yearIndex!.yearIndex !== f0.yearIndex!.yearIndex);
  check("対応する大限も変わる（52〜61）", f1.yearIndex!.major!.startAge === 52 && f1.majorLimit!.palaceBranch === f1.yearIndex!.major!.branch);
  check("小限を手動で変えても鑑定日は変わらない", s1.appraisalDate === "2008-07-01");
  // 手動の大限と小限が食い違っても、流年指数は年齢の大限から
  const mismatch = ctxOf(S38, { appraisalDate: "2008-07-01", majorStartAge: 12, minorAge: 45 });
  check("選択の大限（12〜21）と食い違っても年齢の大限（42〜51）を使う", mismatch.yearIndex!.major!.startAge === 42 && mismatch.yearIndex!.yearIndex === f0.yearIndex!.yearIndex);
  const before = ctxOf(S38, withMinor(S38, s0, 1));
  check("大限開始前の小限: 流年指数 null", before.yearIndex!.yearIndex === null && before.yearIndex!.status === "beforeFirstMajor");
  // 全大限×全小限で、選択と系列が一致
  const series = buildYearFortuneIndexSeries(S38);
  for (const p of S38.dayun.periods)
    for (let age = p.startAge; age <= p.endAge; age += 1) {
      const f = ctxOf(S38, withMinor(S38, withMajor(S38, s0, p.startAge), age));
      check(`${age}歳: グラフ値＝選択の計算値`, JSON.stringify(f.yearIndex) === JSON.stringify(series[age - 1]));
    }
}

// ---------------------------------------------------------------------------
// 4. 他のレイヤーを数値に入れない
// ---------------------------------------------------------------------------
{
  const series = buildYearFortuneIndexSeries(S38);
  const natal = calculateChartPower(S38);
  // 鑑定日（太歳）・大限四化・小限四化・喜忌・S33 が変わっても、同じ年齢なら同じ値
  for (const date of ["1990-07-01", "2008-07-01", "2026-07-01"]) {
    for (const age of [20, 45, 57, 80]) {
      const f = ctxOf(S38, withMinor(S38, selectionFromDate(S38, date), age));
      check(`${date} ${age}歳: 太歳・四化・喜忌・S33 に関係なく同じ値`, JSON.stringify(f.yearIndex) === JSON.stringify(series[age - 1]));
      check(`${date} ${age}歳: 宮の運命指数は本命のまま`, f.yearIndex!.minor!.destinyIndex === natal.byBranch[f.yearIndex!.minor!.branch].index);
    }
  }
  const src = readFileSync("src/lib/ziwei/fortune/yearIndex.ts", "utf8").replace(/^\/\/.*$/gm, "");
  check("式に四化・太歳・喜忌・S33・格局を使わない", !/transformation|taisei|xiji|liunian|pattern/i.test(src));
  check("吉凶ランクを作らない", !/吉|凶/.test(src));
}

const fail = failures.length;
console.log(`流年指数: ${pass} / ${pass + fail} PASS`);
if (fail) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
