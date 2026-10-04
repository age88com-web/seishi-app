// tests/liuren_interpretation_direction_evidence.manual.ts
//
// 六壬神課 解釈エンジン Phase 3N（進退判断の材料 FACT）のテスト。
// 実行: npx tsx tests/liuren_interpretation_direction_evidence.manual.ts
//
//   1. 720課×月支12 で、DirectionEvidence が既存の FACT と一致（movementDirection＝movementPattern の言い換え、
//      standing＝Phase 3L、path＝Phase 3K、terminal＝Phase 3M-C の末伝）。三伝未確定は null
//   2. 古典4例（宜進格・不宜進格・宜退格・不宜退格）と丁巳日・天盤差11 の FACT を出力（結論はコードで出さない）
//   3. 720課の監査（向きの件数、向き × 末伝の空亡・干上の日禄・日徳・空亡、干上→末伝の関係・十二長生、禄の移動、空⇔実）

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { transmissionDayStemFlowOf } from "../src/lib/liuren/interpretation/dayStemFlow";
import { dayStemStandingOf } from "../src/lib/liuren/interpretation/standingPath";
import { transmissionVoidStructureOf } from "../src/lib/liuren/interpretation/voidStructure";
import { directionEvidenceOf, movementDirectionOf } from "../src/lib/liuren/interpretation/directionEvidence";
import type {
  DirectionEvidence, InterpretationFacts, MovementDirection, TransmissionPosition, TransmissionToDayStemRelation,
} from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

const SHORT: Record<TransmissionToDayStemRelation, string> = {
  transmissionGeneratesDayStem: "生干", sameElement: "比和", dayStemGeneratesTransmission: "干生",
  transmissionOvercomesDayStem: "剋干", dayStemOvercomesTransmission: "干剋",
};
const REL: TransmissionToDayStemRelation[] = [
  "transmissionGeneratesDayStem", "sameElement", "dayStemGeneratesTransmission", "transmissionOvercomesDayStem", "dayStemOvercomesTransmission",
];
const DIRS: MovementDirection[] = ["advancing", "retreating", "neutral"];
const POS: TransmissionPosition[] = ["initial", "middle", "final"];
const factsOf = (day: string, offset: number): InterpretationFacts => buildInterpretationFacts(calculateLiuren({
  dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[offset],
}));
const mark = (b: boolean) => (b ? "○" : "－");

/** DirectionEvidence をそのまま1行ずつ書き出す（結論は付けない） */
function describe(e: DirectionEvidence): string[] {
  const s = e.standing;
  const out = [
    `movementDirection ${e.movementDirection}（${e.movementPattern}） | 末伝 dayXunVoid${mark(e.terminal.dayXunVoid)} seatedOnVoid${mark(e.terminal.seatedOnVoid)}`,
    `干上 ${s.branch}: ${SHORT[s.relationToDayStem]}・${s.sixRelation}・禄${mark(s.isDaySalary)}・徳${mark(s.isDayVirtue)}・旬空${mark(s.isVoid)}・坐空${mark(s.isSeatedOnVoid)}・${s.growthStage}(${s.growthPhase})・旺衰${s.seasonalStrength ?? "－"}`,
  ];
  for (const p of POS) {
    const t = e.path.states[p];
    out.push(`${p} ${t.branch}: ${SHORT[t.relationToDayStem]}・${t.sixRelation}・禄${mark(t.isDaySalary)}・徳${mark(t.isDayVirtue)}・丁${mark(t.isXunDing)}・馬${mark(t.isYima)}・旬空${mark(t.isVoid)}・坐空${mark(t.isSeatedOnVoid)}・${t.growthStage}(${t.growthPhase})・旺衰${t.seasonalStrength ?? "－"}`);
  }
  return out;
}

// ---- 2. 古典例（課の指定はテスト側だけ。本番コードは日干支・三伝を見分けない） ----
const CLASSICS: [string, string, number, string, string][] = [
  // [名前（古典の結論はラベルとしてだけ記録）, 日, 天盤差, 干上, 三伝]
  ["A 宜進格", "己卯", 1, "申", "辰巳午"],
  ["B 不宜進格", "壬午", 1, "子", "丑寅卯"],
  ["C 宜退格", "癸亥", 11, "子", "戌酉申"],
  ["D 不宜退格", "乙卯", 11, "卯", "丑子亥"],
  ["丁巳日 天盤差11", "丁巳", 11, "午", "卯寅丑"],
];
const classicLines: string[] = [];
for (const [name, day, offset, upper, ts] of CLASSICS) {
  const e = directionEvidenceOf(factsOf(day, offset))!;
  const got = POS.map((p) => e.path.states[p].branch).join("");
  check(`${name} 再現（干上${upper} 三伝${ts}）`, e.standing.branch === upper && got === ts, `干上${e.standing.branch} 三伝${got}`);
  classicLines.push(`${name}: ${day}日 天盤差${offset}`);
  for (const l of describe(e)) classicLines.push(`    ${l}`);
}
{
  const e = directionEvidenceOf(factsOf("丁巳", 11))!;
  check("丁巳 movementDirection＝retreating", e.movementDirection === "retreating");
  check("丁巳 末伝 dayXunVoid＝true", e.terminal.dayXunVoid && e.path.states.final.isVoid);
  check("丁巳 干上 日禄・帝旺", e.standing.isDaySalary && e.standing.growthStage === "帝旺");
}

// ---- 1・3. 720課 ----
const zero = () => Object.fromEntries(DIRS.map((d) => [d, 0])) as Record<MovementDirection, number>;
const dirCount = zero();
const cross = (labels: string[]) => Object.fromEntries(DIRS.map((d) => [d, Object.fromEntries(labels.map((l) => [l, 0]))])) as Record<MovementDirection, Record<string, number>>;
const TF = ["true", "false"];
const finalDay = cross(TF);
const finalSeat = cross(TF);
const salary = cross(TF);
const virtue = cross(TF);
const standingVoid = cross(["旬空○坐空○", "旬空○坐空－", "旬空－坐空○", "旬空－坐空－"]);
const relTable: Record<MovementDirection, Record<string, number>> = { advancing: {}, retreating: {}, neutral: {} };
const growthPair: Record<string, number> = {};
const SALARY_CLASSES = ["A 干上に禄・三伝に禄なし", "B 干上に禄なし・三伝に禄あり", "C 干上にも三伝にも禄", "D どちらにも禄なし"];
const salaryMove = cross(SALARY_CLASSES);
const VOID_CLASSES = ["干上空→末伝非空", "干上非空→末伝空", "両方空", "両方非空"];
const voidMove = cross(VOID_CLASSES);
const seatMove = cross(VOID_CLASSES);
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };
const vClass = (a: boolean, b: boolean) => (a && b ? "両方空" : a ? "干上空→末伝非空" : b ? "干上非空→末伝空" : "両方非空");

for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const tag = `${STEMS[i % 10]}${BRANCHES[i % 12]}+${o}`;
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const before = JSON.stringify(chart);
    const facts = buildInterpretationFacts(chart);
    const factsBefore = JSON.stringify(facts);
    for (const m of BRANCHES) {
      const e = directionEvidenceOf(facts, m)!;
      const v = transmissionVoidStructureOf(facts)!;
      const ok = e.movementDirection === movementDirectionOf(e.path.movementPattern) && e.movementPattern === e.path.movementPattern &&
        JSON.stringify(e.standing) === JSON.stringify(dayStemStandingOf(facts, m)) &&
        JSON.stringify(e.path) === JSON.stringify(transmissionDayStemFlowOf(facts, m)) &&
        e.terminal.dayXunVoid === v.finalIsDayXunVoid && e.terminal.seatedOnVoid === v.finalIsSeatedOnVoid;
      if (!ok) check(`${tag} 月${m} 既存 FACT と一致`, false);
    }
    check(`${tag} 起課結果・FACT 不変`, JSON.stringify(chart) === before && JSON.stringify(facts) === factsBefore);

    const e = directionEvidenceOf(facts)!;
    const d = e.movementDirection;
    const s = e.standing;
    const st = e.path.states;
    dirCount[d] += 1;
    finalDay[d][String(e.terminal.dayXunVoid)] += 1;
    finalSeat[d][String(e.terminal.seatedOnVoid)] += 1;
    salary[d][String(s.isDaySalary)] += 1;
    virtue[d][String(s.isDayVirtue)] += 1;
    standingVoid[d][`旬空${mark(s.isVoid)}坐空${mark(s.isSeatedOnVoid)}`] += 1;
    inc(relTable[d], `${s.relationToDayStem}|${st.final.relationToDayStem}`);
    inc(growthPair, `${s.growthStage}→${st.final.growthStage}`);
    const pathSalary = POS.some((p) => st[p].isDaySalary);
    salaryMove[d][SALARY_CLASSES[s.isDaySalary ? (pathSalary ? 2 : 0) : (pathSalary ? 1 : 3)]] += 1;
    voidMove[d][vClass(s.isVoid, st.final.isVoid)] += 1;
    seatMove[d][vClass(s.isSeatedOnVoid, st.final.isSeatedOnVoid)] += 1;
  }
}
check("三伝未確定 → null", directionEvidenceOf({ ...factsOf("甲子", 3), transmissions: null }) === null);
check("向きの合計＝720", DIRS.reduce((a, d) => a + dirCount[d], 0) === 720, JSON.stringify(dirCount));

const sumOver = (c: Record<MovementDirection, Record<string, number>>) => {
  const t: Record<string, number> = {};
  for (const d of DIRS) for (const [k, v] of Object.entries(c[d])) t[k] = (t[k] ?? 0) + v;
  return t;
};
const show = (title: string, c: Record<MovementDirection, Record<string, number>>) => {
  console.log(title);
  for (const d of DIRS) console.log(`  ${d}: ${JSON.stringify(c[d])}`);
  console.log(`  合計: ${JSON.stringify(sumOver(c))}`);
};
console.log("古典例（DirectionEvidence のみ）:");
for (const l of classicLines) console.log(`  ${l}`);
console.log(`720課 movementDirection: ${JSON.stringify(dirCount)}`);
show("向き × 末伝 dayXunVoid:", finalDay);
show("向き × 末伝 seatedOnVoid:", finalSeat);
show("向き × 干上 日禄:", salary);
show("向き × 干上 日徳:", virtue);
show("向き × 干上 空亡（dayXunVoid・seatedOnVoid）:", standingVoid);
console.log("干上 → 末伝 relationToDayStem（行＝干上、列＝末伝 生干|比和|干生|剋干|干剋）:");
for (const d of DIRS) {
  console.log(`  ${d}:`);
  for (const a of REL) console.log(`    ${SHORT[a]} | ${REL.map((b) => relTable[d][`${a}|${b}`] ?? 0).join(" | ")}`);
}
console.log(`干上 → 末伝 growthStage 上位20（${Object.keys(growthPair).length}種）:`);
for (const [k, v] of Object.entries(growthPair).sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${k}: ${v}`);
show("禄の移動:", salaryMove);
show("空→実／実→空（dayXunVoid）:", voidMove);
show("空→実／実→空（seatedOnVoid）:", seatMove);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
