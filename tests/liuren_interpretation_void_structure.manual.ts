// tests/liuren_interpretation_void_structure.manual.ts
//
// 六壬神課 解釈エンジン Phase 3M-C（空亡の構造 FACT: dayXunVoid と seatedOnVoid の分離）のテスト。
// 実行: npx tsx tests/liuren_interpretation_void_structure.manual.ts
//
//   1. 古典例（丁巳・乙卯・壬子・甲午・丙午）の dayXunVoid・seatedOnVoid・末伝の値
//   2. 甲子日・天盤差10（戌→申→午・退間）は、日旬空と坐空だけでは古典の「本旬・後旬・外後旬之空」を表せない
//   3. 720課×月支12 で dayXunVoid が既存の isVoid と完全一致、seatedOnVoid が天地盤から直接求めた値と一致、
//      三伝（Phase 3K）・干上（Phase 3L）の isSeatedOnVoid が空亡の構造と一致。三伝未確定は null
//   4. 720課の監査: 位置別件数、日旬空 OR 坐空（監査値）、movementPattern 別の末伝、退茹・進茹＋末伝旬空、
//      空亡の位置の組合せ

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { analyzeTransmissionFlow } from "../src/lib/liuren/interpretation/flow";
import { transmissionDayStemFlowOf } from "../src/lib/liuren/interpretation/dayStemFlow";
import { dayStemStandingOf } from "../src/lib/liuren/interpretation/standingPath";
import { isSeatedOnVoid, transmissionVoidStructureOf } from "../src/lib/liuren/interpretation/voidStructure";
import type { InterpretationFacts, TransmissionPosition, Triple } from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

const POS: TransmissionPosition[] = ["initial", "middle", "final"];
const bits = (t: Triple<boolean>) => POS.map((p) => (t[p] ? "1" : "0")).join("");
const factsOf = (day: string, offset: number): InterpretationFacts => buildInterpretationFacts(calculateLiuren({
  dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[offset],
}));

// ---- 1. 古典例 ----
const CASES: [string, number, string, string, string][] = [
  // [日, 天盤差, 三伝, dayXunVoid, seatedOnVoid]
  ["丁巳", 11, "卯寅丑", "001", "000"],
  ["乙卯", 11, "丑子亥", "110", "011"],
  ["壬子", 1, "寅卯辰", "110", "011"],
  ["甲午", 1, "辰巳午", "110", "011"],
  ["丙午", 11, "卯寅丑", "110", "011"],
];
const exampleLines: string[] = [];
for (const [day, offset, ts, dv, sv] of CASES) {
  const f = factsOf(day, offset);
  const v = transmissionVoidStructureOf(f)!;
  const got = f.transmissions!.map((t) => t.branch).join("");
  check(`${day} 天盤差${offset} 三伝${ts}`, got === ts, got);
  check(`${day} dayXunVoid＝${dv}`, bits(v.dayXunVoid) === dv, bits(v.dayXunVoid));
  check(`${day} seatedOnVoid＝${sv}`, bits(v.seatedOnVoid) === sv, bits(v.seatedOnVoid));
  check(`${day} 末伝の値`, v.finalIsDayXunVoid === (dv[2] === "1") && v.finalIsSeatedOnVoid === (sv[2] === "1"));
  const or = POS.map((p) => (v.dayXunVoid[p] || v.seatedOnVoid[p] ? "1" : "0")).join("");
  exampleLines.push(`${day}日 天盤差${offset} 三伝${ts} 旬空${f.xun.voidBranches.join("")} | dayXunVoid ${bits(v.dayXunVoid)} | seatedOnVoid ${bits(v.seatedOnVoid)} | 末伝 旬空${v.finalIsDayXunVoid ? "○" : "－"} 坐空${v.finalIsSeatedOnVoid ? "○" : "－"} | OR（監査値）${or}`);
}
{
  const v = transmissionVoidStructureOf(factsOf("丁巳", 11))!;
  check("丁巳 末伝丑 finalIsDayXunVoid=true", v.finalIsDayXunVoid);
  const e = transmissionVoidStructureOf(factsOf("乙卯", 11))!;
  check("乙卯 日旬空 OR 坐空は三伝すべて（監査値。三伝皆空の判定ではない）", POS.every((p) => e.dayXunVoid[p] || e.seatedOnVoid[p]));
}

// ---- 2. 甲子日・退間（未実装領域） ----
{
  const f = factsOf("甲子", 10);
  const v = transmissionVoidStructureOf(f)!;
  const ts = f.transmissions!.map((t) => t.branch).join("");
  const or = POS.map((p) => (v.dayXunVoid[p] || v.seatedOnVoid[p] ? "1" : "0")).join("");
  check("甲子 天盤差10 三伝 戌申午", ts === "戌申午", ts);
  check("甲子 dayXunVoid＝100・seatedOnVoid＝010", bits(v.dayXunVoid) === "100" && bits(v.seatedOnVoid) === "010",
    `${bits(v.dayXunVoid)} / ${bits(v.seatedOnVoid)}`);
  // 古典は 戌＝本旬之空・申＝後旬之空・午＝外後旬之空 とするが、末伝午は日旬空でも坐空でもない
  check("甲子 末伝午（外後旬之空）は日旬空・坐空のどちらでも表せない（未実装領域）", !v.dayXunVoid.final && !v.seatedOnVoid.final && or === "110", or);
  exampleLines.push(`甲子日 天盤差10 三伝戌申午 旬空${f.xun.voidBranches.join("")} | dayXunVoid ${bits(v.dayXunVoid)} | seatedOnVoid ${bits(v.seatedOnVoid)} | OR ${or} → 末伝午（古典: 外後旬之空）は表せない`);
}

// ---- 3・4. 720課 ----
const posCount = { dayXunVoid: { initial: 0, middle: 0, final: 0 }, seatedOnVoid: { initial: 0, middle: 0, final: 0 }, OR: { initial: 0, middle: 0, final: 0 } };
const MOVES = ["進茹", "退茹", "進間", "退間", "その他"];
const byMove: Record<string, { 課数: number; 末伝dayXunVoid: number; 末伝seatedOnVoid: number }> =
  Object.fromEntries(MOVES.map((m) => [m, { 課数: 0, 末伝dayXunVoid: 0, 末伝seatedOnVoid: 0 }]));
const tuiruFinal: string[] = [];
let tuiruFinalCount = 0;
let jinruFinalCount = 0;
const jinruFinal: string[] = [];
const patterns = { dayXunVoid: {} as Record<string, number>, seatedOnVoid: {} as Record<string, number>, OR: {} as Record<string, number> };
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };
let standingChecked = 0;
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`;
    const tag = `${day}+${o}`;
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const before = JSON.stringify(chart);
    const facts = buildInterpretationFacts(chart);
    const factsBefore = JSON.stringify(facts);
    const v = transmissionVoidStructureOf(facts)!;
    const voids = chart.xun.voidBranches as readonly Branch[];
    const ts = chart.transmissions!;
    // 既存 isVoid と完全一致・坐空は天地盤から直接
    const ok = POS.every((p, k) => v.dayXunVoid[p] === ts[k].isVoid &&
      v.seatedOnVoid[p] === voids.includes(chart.plate.earthUnder[ts[k].branch])) &&
      v.finalIsDayXunVoid === ts[2].isVoid && v.finalIsSeatedOnVoid === v.seatedOnVoid.final;
    if (!ok) check(`${tag} 空亡の構造`, false, JSON.stringify(v));
    for (const m of BRANCHES) {
      const d = transmissionDayStemFlowOf(facts, m)!;
      const s = dayStemStandingOf(facts, m);
      const same = POS.every((p) => d.states[p].isVoid === v.dayXunVoid[p] && d.states[p].isSeatedOnVoid === v.seatedOnVoid[p]) &&
        JSON.stringify(d.voidStructure) === JSON.stringify(v) &&
        s.isSeatedOnVoid === voids.includes(chart.lessons[0].lowerBranch) &&
        s.isSeatedOnVoid === isSeatedOnVoid(facts, chart.lessons[0].upper);
      if (!same) check(`${tag} 月${m} 三伝・干上の坐空`, false);
      standingChecked += 1;
    }
    check(`${tag} 起課結果・FACT 不変`, JSON.stringify(chart) === before && JSON.stringify(facts) === factsBefore);

    const flow = analyzeTransmissionFlow(facts);
    const mv = flow.status === "determined" ? flow.movementPattern : "その他";
    const orT: Triple<boolean> = { initial: v.dayXunVoid.initial || v.seatedOnVoid.initial, middle: v.dayXunVoid.middle || v.seatedOnVoid.middle, final: v.dayXunVoid.final || v.seatedOnVoid.final };
    for (const p of POS) {
      if (v.dayXunVoid[p]) posCount.dayXunVoid[p] += 1;
      if (v.seatedOnVoid[p]) posCount.seatedOnVoid[p] += 1;
      if (orT[p]) posCount.OR[p] += 1;
    }
    byMove[mv].課数 += 1;
    if (v.finalIsDayXunVoid) byMove[mv].末伝dayXunVoid += 1;
    if (v.finalIsSeatedOnVoid) byMove[mv].末伝seatedOnVoid += 1;
    const tsStr = ts.map((t) => t.branch).join("");
    if (mv === "退茹" && v.finalIsDayXunVoid) {
      tuiruFinalCount += 1;
      tuiruFinal.push(`${day}日 天盤差${o} 干上${chart.lessons[0].upper} 三伝${tsStr} 旬空${voids.join("")} dayXunVoid ${bits(v.dayXunVoid)} seatedOnVoid ${bits(v.seatedOnVoid)}`);
    }
    if (mv === "進茹" && v.finalIsDayXunVoid) {
      jinruFinalCount += 1;
      jinruFinal.push(`${day}日 天盤差${o} 干上${chart.lessons[0].upper} 三伝${tsStr} 旬空${voids.join("")} dayXunVoid ${bits(v.dayXunVoid)} seatedOnVoid ${bits(v.seatedOnVoid)}`);
    }
    inc(patterns.dayXunVoid, bits(v.dayXunVoid));
    inc(patterns.seatedOnVoid, bits(v.seatedOnVoid));
    inc(patterns.OR, bits(orT));
  }
}
check("三伝未確定 → null", transmissionVoidStructureOf({ ...factsOf("甲子", 3), transmissions: null }) === null);
check("三伝・干上の坐空を 720課×月支12 で照合", standingChecked === 8640);
const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
check("組合せの合計＝720", total(patterns.dayXunVoid) === 720 && total(patterns.seatedOnVoid) === 720 && total(patterns.OR) === 720);

const top = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" / ");
console.log("古典例:");
for (const l of exampleLines) console.log(`  ${l}`);
for (const k of ["dayXunVoid", "seatedOnVoid", "OR"] as const) {
  console.log(`720課 ${k} 位置別: 初伝${posCount[k].initial} 中伝${posCount[k].middle} 末伝${posCount[k].final}`);
}
console.log("movementPattern 別の末伝:");
for (const m of MOVES) console.log(`  ${m}: ${JSON.stringify(byMove[m])}`);
console.log(`退茹＋末伝旬空: ${tuiruFinalCount}課`);
for (const l of tuiruFinal) console.log(`    ${l}`);
console.log(`進茹＋末伝旬空: ${jinruFinalCount}課`);
for (const l of jinruFinal) console.log(`    ${l}`);
for (const k of ["dayXunVoid", "seatedOnVoid", "OR"] as const) console.log(`${k} の組合せ（初中末）: ${top(patterns[k])}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
