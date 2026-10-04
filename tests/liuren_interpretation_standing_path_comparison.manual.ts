// tests/liuren_interpretation_standing_path_comparison.manual.ts
//
// 六壬神課 解釈エンジン Phase 3P（干上と三伝の比較 FACT）のテスト。
// 実行: npx tsx tests/liuren_interpretation_standing_path_comparison.manual.ts
//
//   1. 古典5例の4段階（干上→初→中→末）を完全再現
//      古典語との対応（コメントのみ。本番型には入れない）:
//        干上が日干と比和で帝旺＝旺神、干生＝脱気、剋干（官鬼）＝日鬼、沐浴＝敗気、長生、日禄、旬空の地＝空郷
//   2. 720課×月支12 で、比較 FACT が DirectionEvidence（Phase 3N）の値をそのまま参照・転記していること
//   3. 720課の監査（4段階の並びの種類数、日禄・空亡の位置の組合せ、日禄・帝旺と空亡のクロス）

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { directionEvidenceOf } from "../src/lib/liuren/interpretation/directionEvidence";
import { standingPathComparisonFrom, standingPathComparisonOf } from "../src/lib/liuren/interpretation/standingPathComparison";
import type {
  ComparisonPosition, InterpretationFacts, StandingPathComparison, StandingPathSequence, TransmissionToDayStemRelation,
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
const ST: ComparisonPosition[] = ["standing", "initial", "middle", "final"];
const seqStr = <T>(q: StandingPathSequence<T>, f: (x: T) => string = String) => ST.map((p) => f(q[p as keyof typeof q] as T)).join("→");
const posStr = (xs: readonly ComparisonPosition[]) => (xs.length ? xs.join(",") : "[]");
const factsOf = (day: string, offset: number): InterpretationFacts => buildInterpretationFacts(calculateLiuren({
  dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[offset],
}));

// ---- 1. 古典5例 ----
type Expect = { name: string; day: string; offset: number; branches: string; rel: string; growth: string; salary: string; dayVoid: string; seatVoid?: string };
const CLASSICS: Expect[] = [
  // A 宜進格: 干上申＝脱気（干生）・空郷（旬空）、初辰＝比肩、中末＝生我、末午＝日禄・帝旺
  { name: "A 己卯", day: "己卯", offset: 1, branches: "申辰巳午", rel: "干生→比和→生干→生干", growth: "病→冠帯→臨官→帝旺", salary: "final", dayVoid: "standing" },
  // B 不宜進格: 干上子＝旺神（比和・帝旺）、初丑＝剋日、中末寅卯＝脱（干生）
  { name: "B 壬午", day: "壬午", offset: 1, branches: "子丑寅卯", rel: "比和→剋干→干生→干生", growth: "帝旺→衰→病→死", salary: "[]", dayVoid: "[]", seatVoid: "[]" },
  // C 宜退格: 干上子＝旺神だが旬空（空郷）、初戌＝日鬼、中酉＝敗気（沐浴）、末申＝長生
  { name: "C 癸亥", day: "癸亥", offset: 11, branches: "子戌酉申", rel: "比和→剋干→生干→生干", growth: "帝旺→冠帯→沐浴→長生", salary: "standing", dayVoid: "standing", seatVoid: "standing" },
  // D 不宜退格: 干上卯＝日禄、初丑＝財、中末＝生、三伝は空へ引き込む
  { name: "D 乙卯", day: "乙卯", offset: 11, branches: "卯丑子亥", rel: "比和→干剋→生干→生干", growth: "帝旺→冠帯→沐浴→長生", salary: "standing", dayVoid: "initial,middle", seatVoid: "middle,final" },
  // 丁巳日: 退茹・末伝旬空、干上午＝旺禄
  { name: "丁巳", day: "丁巳", offset: 11, branches: "午卯寅丑", rel: "比和→生干→生干→干生", growth: "帝旺→沐浴→長生→養", salary: "standing", dayVoid: "final" },
];
const classicLines: string[] = [];
for (const c of CLASSICS) {
  const x = standingPathComparisonOf(factsOf(c.day, c.offset))!;
  const branches = [x.standing.branch, x.path.initial.branch, x.path.middle.branch, x.path.final.branch].join("");
  const rel = seqStr(x.sequences.relationToDayStem, (r) => SHORT[r]);
  const growth = seqStr(x.sequences.growthStage);
  check(`${c.name} 支 ${c.branches}`, branches === c.branches, branches);
  check(`${c.name} relation ${c.rel}`, rel === c.rel, rel);
  check(`${c.name} growth ${c.growth}`, growth === c.growth, growth);
  check(`${c.name} salaryPositions ${c.salary}`, posStr(x.markerPositions.daySalary) === c.salary, posStr(x.markerPositions.daySalary));
  check(`${c.name} dayXunVoidPositions ${c.dayVoid}`, posStr(x.voidPositions.dayXunVoid) === c.dayVoid, posStr(x.voidPositions.dayXunVoid));
  if (c.seatVoid) check(`${c.name} seatedOnVoidPositions ${c.seatVoid}`, posStr(x.voidPositions.seatedOnVoid) === c.seatVoid, posStr(x.voidPositions.seatedOnVoid));
  classicLines.push(`${c.name}（天盤差${c.offset}・${x.movementPattern}→${x.movementDirection}） 支 ${[...branches].join("→")}`);
  classicLines.push(`    relation ${rel} ／ 六親 ${seqStr(x.sequences.sixRelation)} ／ growth ${growth}`);
  classicLines.push(`    日禄 ${posStr(x.markerPositions.daySalary)} 日徳 ${posStr(x.markerPositions.dayVirtue)} 旬丁 ${posStr(x.markerPositions.xunDing)} 驛馬 ${posStr(x.markerPositions.yima)} ／ 旬空 ${posStr(x.voidPositions.dayXunVoid)} 坐空 ${posStr(x.voidPositions.seatedOnVoid)}`);
  const t = x.transitions.standingToInitial;
  classicLines.push(`    干上→初伝: relation ${SHORT[t.relationToDayStem.from]}→${SHORT[t.relationToDayStem.to]} 六親 ${t.sixRelation.from}→${t.sixRelation.to} growth ${t.growthStage.from}→${t.growthStage.to}（${t.growthPhase.from}→${t.growthPhase.to}） 旬空 ${t.dayXunVoid.from}→${t.dayXunVoid.to} 坐空 ${t.seatedOnVoid.from}→${t.seatedOnVoid.to} 禄 ${t.daySalary.from}→${t.daySalary.to} 徳 ${t.dayVirtue.from}→${t.dayVirtue.to}`);
}
check("B 壬午 干上は非空（旬空・坐空なし）", (() => {
  const x = standingPathComparisonOf(factsOf("壬午", 1))!;
  return !x.standing.isVoid && !x.standing.isSeatedOnVoid;
})());

// ---- 2・3. 720課 ----
const uniq = { relation: new Set<string>(), growth: new Set<string>(), six: new Set<string>() };
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };
const salaryCombos: Record<string, number> = {};
const dayVoidCombos: Record<string, number> = {};
const seatVoidCombos: Record<string, number> = {};
const vClass = (dv: boolean, sv: boolean) => (dv && sv ? "両方" : dv ? "旬空のみ" : sv ? "坐空のみ" : "旬空なし・坐空なし");
const standingSalaryVoid: Record<string, number> = {};
const standingProsperVoid: Record<string, number> = {};
const finalSalaryVoid: Record<string, number> = {};
const pathSalaryVoid: Record<string, number> = {};
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const tag = `${STEMS[i % 10]}${BRANCHES[i % 12]}+${o}`;
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const before = JSON.stringify(chart);
    const facts = buildInterpretationFacts(chart);
    const factsBefore = JSON.stringify(facts);
    for (const m of [null, BRANCHES[(i + o) % 12]] as (Branch | null)[]) {
      const e = directionEvidenceOf(facts, m)!;
      const x: StandingPathComparison = standingPathComparisonFrom(e);
      const ps = [x.standing, x.path.initial, x.path.middle, x.path.final];
      const ok = x.standing === e.standing && x.path === e.path.states &&
        x.movementDirection === e.movementDirection && x.movementPattern === e.movementPattern &&
        ST.every((p, k) => x.sequences.relationToDayStem[p as "standing"] === ps[k].relationToDayStem &&
          x.sequences.sixRelation[p as "standing"] === ps[k].sixRelation && x.sequences.growthStage[p as "standing"] === ps[k].growthStage) &&
        posStr(x.markerPositions.daySalary) === posStr(ST.filter((_, k) => ps[k].isDaySalary)) &&
        posStr(x.markerPositions.yima) === posStr(ST.filter((_, k) => ps[k].isYima)) &&
        posStr(x.voidPositions.dayXunVoid) === posStr(ST.filter((_, k) => ps[k].isVoid)) &&
        posStr(x.voidPositions.seatedOnVoid) === posStr(ST.filter((_, k) => ps[k].isSeatedOnVoid)) &&
        [x.transitions.standingToInitial, x.transitions.initialToMiddle, x.transitions.middleToFinal].every((t, k) =>
          t.fromPosition === ST[k] && t.toPosition === ST[k + 1] &&
          t.relationToDayStem.from === ps[k].relationToDayStem && t.relationToDayStem.to === ps[k + 1].relationToDayStem &&
          t.growthPhase.from === ps[k].growthPhase && t.seatedOnVoid.to === ps[k + 1].isSeatedOnVoid &&
          t.daySalary.changed === (ps[k].isDaySalary !== ps[k + 1].isDaySalary));
      if (!ok) check(`${tag} 月${m ?? "なし"} 既存 FACT の参照・転記`, false);
    }
    check(`${tag} 起課結果・FACT 不変`, JSON.stringify(chart) === before && JSON.stringify(facts) === factsBefore);

    const x = standingPathComparisonOf(facts)!;
    uniq.relation.add(seqStr(x.sequences.relationToDayStem));
    uniq.growth.add(seqStr(x.sequences.growthStage));
    uniq.six.add(seqStr(x.sequences.sixRelation));
    inc(salaryCombos, posStr(x.markerPositions.daySalary));
    inc(dayVoidCombos, posStr(x.voidPositions.dayXunVoid));
    inc(seatVoidCombos, posStr(x.voidPositions.seatedOnVoid));
    const s = x.standing;
    if (s.isDaySalary) inc(standingSalaryVoid, vClass(s.isVoid, s.isSeatedOnVoid));
    if (s.growthStage === "帝旺") inc(standingProsperVoid, vClass(s.isVoid, s.isSeatedOnVoid));
    const f = x.path.final;
    if (f.isDaySalary) inc(finalSalaryVoid, vClass(f.isVoid, f.isSeatedOnVoid));
    for (const p of ["initial", "middle", "final"] as const) {
      const t = x.path[p];
      if (t.isDaySalary) inc(pathSalaryVoid, `${p}:${vClass(t.isVoid, t.isSeatedOnVoid)}`);
    }
  }
}
check("三伝未確定 → null", standingPathComparisonOf({ ...factsOf("甲子", 3), transmissions: null }) === null);
const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
check("位置の組合せの合計＝720", total(salaryCombos) === 720 && total(dayVoidCombos) === 720 && total(seatVoidCombos) === 720);

const show = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" / ");
console.log("古典5例:");
for (const l of classicLines) console.log(`  ${l}`);
console.log(`720課 4段階の並びの種類数: relation ${uniq.relation.size} / growthStage ${uniq.growth.size} / 六親 ${uniq.six.size}`);
console.log(`日禄の位置: ${show(salaryCombos)}`);
console.log(`旬空の位置: ${show(dayVoidCombos)}`);
console.log(`坐空の位置: ${show(seatVoidCombos)}`);
console.log(`干上日禄 × 干上の空亡（${total(standingSalaryVoid)}課）: ${show(standingSalaryVoid)}`);
console.log(`干上帝旺 × 干上の空亡（${total(standingProsperVoid)}課）: ${show(standingProsperVoid)}`);
console.log(`末伝日禄 × 末伝の空亡（${total(finalSalaryVoid)}課）: ${show(finalSalaryVoid)}`);
console.log(`三伝の日禄の位置 × その位置の空亡（${total(pathSalaryVoid)}件）: ${show(pathSalaryVoid)}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
