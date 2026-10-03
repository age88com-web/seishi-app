// tests/liuren_textbook.manual.ts
//
// 六壬神課 起課エンジン（src/lib/liuren/）の回帰テスト。
// 『六壬神課講座』掲載30例（tests/fixtures/liuren_textbook.json）と照合する。
// 実行: npx tsx tests/liuren_textbook.manual.ts
//
// 照合方針:
//   各例の assert に挙げた項目だけを講座の正解として照合する。
//   講座に中伝・末伝・法名が載っていない例は、それを正解値として固定しない。
//   E06 は講座に結論がないため参考fixture（照合対象外）。

import fixture from "./fixtures/liuren_textbook.json";
import { calculateLiuren, calculateLiurenAt } from "../src/lib/liuren";
import type { LiurenChart, Stem, Branch } from "../src/lib/liuren";
import { BRANCHES } from "../src/lib/eto";
import { makeContext } from "../src/lib/liuren/sanchuan/context";
import { yaokeCandidates } from "../src/lib/liuren/sanchuan/yaoke";

type Case = (typeof fixture.cases)[number] & {
  divinationBranch?: string;
  monthGeneral?: string;
  expected: Record<string, unknown>;
};

let fail = 0;
function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function chartFor(c: Case): LiurenChart {
  // 月将・占時の記載がない例は、差分（offset）が同じになる任意の組（占時子）で起課する。
  // この場合は天将を照合しない（fixture の assert に天将を入れていない）。
  const divinationBranch = (c.divinationBranch ?? "子") as Branch;
  const monthGeneral = (c.monthGeneral ?? BRANCHES[c.offset]) as Branch;
  return calculateLiuren({
    dayStem: c.day[0] as Stem,
    dayBranch: c.day[1] as Branch,
    divinationBranch,
    monthGeneral,
  });
}

function actualOf(chart: LiurenChart, key: string): unknown {
  const s = chart.sanchuan;
  const t = chart.transmissions;
  switch (key) {
    case "lessons": return chart.lessons.map((l) => `${l.upper}/${l.lower}`);
    case "method": return s.method;
    case "methodFamily": return s.method === "重審" || s.method === "元首" ? "賊剋法" : s.method;
    case "pattern": return s.status === "determined" ? s.pattern : null;
    case "initial": return s.status === "determined" ? s.initial : null;
    case "middle": return s.status === "determined" ? s.middle : null;
    case "final": return s.status === "determined" ? s.final : null;
    case "lessonGenerals": return chart.lessonGenerals;
    case "transmissionGenerals": return t?.map((x) => x.general) ?? null;
    case "hiddenStems": return t?.map((x) => x.hiddenStem) ?? null;
    case "hiddenStemsPartial": return t?.slice(0, 2).map((x) => x.hiddenStem) ?? null;
    case "relations": return t?.map((x) => x.relation) ?? null;
    default: throw new Error(`unknown assert key ${key}`);
  }
}

// ---- 講座30例 ----
console.log("== 講座30例 ==");
let textbookPass = 0;
let textbookTotal = 0;
for (const raw of fixture.cases) {
  const c = raw as Case;
  const chart = chartFor(c);
  const errors: string[] = [];
  if (chart.plate.offset !== c.offset) errors.push(`offset got ${chart.plate.offset}`);
  const expectedLessons = c.lessons;
  for (const key of c.assert) {
    const want = key === "lessons" ? expectedLessons : c.expected[key];
    const got = actualOf(chart, key);
    if (!eq(got, want)) errors.push(`${key}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
  const s = chart.sanchuan;
  const summary = s.status === "determined"
    ? `${s.method}${s.pattern ? "・" + s.pattern : ""} ${s.initial}${s.middle}${s.final}` +
      (s.middleFinalEvidence === "reference" ? "（中末は参考値）" : "")
    : `未確定: ${s.reason}`;
  const isReferenceOnly = c.assert.length === 1 && c.assert[0] === "lessons" && c.id === "E06";
  if (!isReferenceOnly) textbookTotal += 1;
  if (errors.length === 0) {
    if (!isReferenceOnly) textbookPass += 1;
    console.log(`  ok   ${c.id} ${c.day}+${c.offset} ${summary}${isReferenceOnly ? "  [参考fixture・講座に結論なし]" : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${c.id} ${c.day}+${c.offset} ${summary}\n       ${errors.join("\n       ")}`);
  }
}
console.log(`講座回答あり: ${textbookPass}/${textbookTotal} PASS`);

// ---- 個別回帰 ----
console.log("== 個別回帰 ==");
function check(label: string, ok: boolean, detail: string): void {
  if (ok) console.log(`  ok   ${label}: ${detail}`);
  else { fail += 1; console.log(`  FAIL ${label}: ${detail}`); }
}
function caseById(id: string): Case {
  return fixture.cases.find((c) => c.id === id) as Case;
}

// E09: 涉害③は干上神（一課の上神＝子）を初伝にする。一課の地盤支（巳）ではない
{
  const chart = chartFor(caseById("E09"));
  const s = chart.sanchuan;
  const initial = s.status === "determined" ? s.initial : null;
  const usedFinalStep = s.trace.some((t) => t.stage === "涉害③最終判定");
  check("E09 涉害③の上神選択", initial === "子" && initial !== chart.lessons[0].lowerBranch && usedFinalStep,
    `初伝 ${initial}（一課の地盤支は ${chart.lessons[0].lowerBranch}）、③到達 ${usedFinalStep}`);
}

// E15・E17: 遥剋候補があっても八専を優先
for (const [id, candidate] of [["E15", "申"], ["E17", "亥"]] as const) {
  const chart = chartFor(caseById(id));
  const ctx = makeContext(chart.input.dayStem, chart.input.dayBranch, chart.lessons, chart.plate);
  const yaoke = yaokeCandidates(ctx);
  const s = chart.sanchuan;
  check(`${id} 八専＞遥剋`,
    s.method === "八専" && !!yaoke && yaoke.uppers.includes(candidate),
    `法 ${s.method}、遥剋候補 ${yaoke ? yaoke.uppers.join("") : "なし"}`);
}

// E16: 本文の三伝（亥辰辰）を正とし、表の「丑亥亥」は採用しない
{
  const c = caseById("E16") as Case & { reference: { misprintInTable: string[] } };
  const s = chartFor(c).sanchuan;
  const got = s.status === "determined" ? [s.initial, s.middle, s.final] : null;
  check("E16 本文の三伝を採用", eq(got, ["亥", "辰", "辰"]) && !eq(got, c.reference.misprintInTable),
    `三伝 ${got?.join("")}`);
}

// 日時入力: 例題①（1994/10/9 午時）が月将辰・占時午・戊辰日になり E26 と同じ盤になる
{
  const r = calculateLiurenAt({ year: 1994, month: 10, day: 9, hour: 12, minute: 0, timezone: "Asia/Tokyo" });
  const s = r.chart.sanchuan;
  check("日時入力 1994/10/9 12:00",
    r.chart.input.monthGeneral === "辰" && r.chart.input.divinationBranch === "午" &&
      `${r.chart.input.dayStem}${r.chart.input.dayBranch}` === "戊辰" &&
      s.status === "determined" && `${s.initial}${s.middle}${s.final}` === "丑亥酉",
    `月将 ${r.chart.input.monthGeneral}（${r.zhongqi}）占時 ${r.chart.input.divinationBranch} 日 ${r.chart.input.dayStem}${r.chart.input.dayBranch}`);
}

if (fail > 0) {
  console.log(`FAIL: ${fail}`);
  process.exit(1);
}
console.log("ALL PASS");
