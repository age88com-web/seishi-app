// tests/liuren_interpretation_standing_path.manual.ts
//
// 六壬神課 解釈エンジン Phase 3L（干上の現在地と三伝の経路）のテスト。
// 実行: npx tsx tests/liuren_interpretation_standing_path.manual.ts
//
//   1. 720課×月支12 で、干上（一課上神）の各値が既存の FACT・関数と一致し、path が Phase 3K と同じ。FACT・起課結果を書き換えない
//   2. 古典4例（宜進格・不宜進格・宜退格・不宜退格）を既存の起課エンジンで再現し、原文の記述と FACT を照合
//   3. 720課の監査（干上の関係・標識、干上→初伝・末伝の関係、禄・空亡の比較、4段階の並び、進茹・退茹とのクロス）

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { BRANCH_ELEMENT } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { transmissionDayStemFlowOf } from "../src/lib/liuren/interpretation/dayStemFlow";
import { dayMarkersOf } from "../src/lib/liuren/interpretation/markers";
import { growthPhaseOf } from "../src/lib/liuren/interpretation/qiState";
import { relationBetween } from "../src/lib/liuren/interpretation/relations";
import { growthStageOfStem, rulingElementOfMonth, seasonalStrengthOf } from "../src/lib/liuren/interpretation/states";
import { dayStemStandingOf, standingAndTransmissionPathOf } from "../src/lib/liuren/interpretation/standingPath";
import type {
  InterpretationFacts, StandingAndTransmissionPath, TransmissionPosition, TransmissionToDayStemRelation,
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
const REL_ORDER: TransmissionToDayStemRelation[] = [
  "transmissionGeneratesDayStem", "sameElement", "dayStemGeneratesTransmission", "transmissionOvercomesDayStem", "dayStemOvercomesTransmission",
];
const FROM_RELATION: [string, TransmissionToDayStemRelation][] = [
  ["generates", "transmissionGeneratesDayStem"], ["sameElement", "sameElement"], ["generatedBy", "dayStemGeneratesTransmission"],
  ["overcomes", "transmissionOvercomesDayStem"], ["overcomeBy", "dayStemOvercomesTransmission"],
];
const POS: TransmissionPosition[] = ["initial", "middle", "final"];
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };
const top = (o: Record<string, number>, n: number) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const factsOf = (day: string, offset: number): InterpretationFacts => buildInterpretationFacts(calculateLiuren({
  dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[offset],
}));

// ---- 2. 古典4例 ----
type Classic = { name: string; day: string; offset: number; upper: Branch; ts: string; expect: (x: StandingAndTransmissionPath) => [boolean, string][] };
const CLASSICS: Classic[] = [
  {
    name: "A 宜進格", day: "己卯", offset: 1, upper: "申", ts: "辰巳午",
    expect: ({ standing: s, path: p }) => [
      [s.relationToDayStem === "dayStemGeneratesTransmission", "干上申＝脱気（己土が申金を生ず）"],
      [s.isVoid, "干上申＝空亡（甲戌旬の空亡は申酉）"],
      [p!.states.initial.relationToDayStem === "sameElement" && p!.states.initial.sixRelation === "兄弟", "初伝辰＝比肩（比和・兄弟）"],
      [p!.states.middle.relationToDayStem === "transmissionGeneratesDayStem" && p!.states.final.relationToDayStem === "transmissionGeneratesDayStem", "中末巳午＝生我"],
      [p!.states.final.isDaySalary, "末伝午＝日禄"],
    ],
  },
  {
    name: "B 不宜進格", day: "壬午", offset: 1, upper: "子", ts: "丑寅卯",
    expect: ({ standing: s, path: p }) => [
      [s.relationToDayStem === "sameElement" && s.growthStage === "帝旺", "干上子＝旺神（比和・十二長生 帝旺）"],
      [p!.states.initial.relationToDayStem === "transmissionOvercomesDayStem", "初伝丑＝剋日"],
      [p!.states.middle.relationToDayStem === "dayStemGeneratesTransmission" && p!.states.final.relationToDayStem === "dayStemGeneratesTransmission", "中末寅卯＝脱（壬水が木を生ず）"],
    ],
  },
  {
    name: "C 宜退格", day: "癸亥", offset: 11, upper: "子", ts: "戌酉申",
    expect: ({ standing: s, path: p }) => [
      [s.growthStage === "帝旺", "干上子＝旺神（帝旺）"],
      [s.isVoid, "干上子＝旬空（甲寅旬の空亡は子丑）"],
      [p!.states.initial.relationToDayStem === "transmissionOvercomesDayStem" && p!.states.initial.sixRelation === "官鬼", "初伝戌＝日鬼（官鬼）"],
      [p!.states.middle.growthStage === "沐浴", "中伝酉＝敗気（十二長生 沐浴）"],
      [p!.states.final.growthStage === "長生", "末伝申＝長生"],
    ],
  },
  {
    name: "D 不宜退格", day: "乙卯", offset: 11, upper: "卯", ts: "丑子亥",
    expect: ({ standing: s, path: p }) => [
      [s.isDaySalary, "干上卯＝日禄"],
      [p!.states.initial.relationToDayStem === "dayStemOvercomesTransmission" && p!.states.initial.sixRelation === "妻財", "初伝丑＝財"],
      [p!.states.middle.relationToDayStem === "transmissionGeneratesDayStem" && p!.states.final.relationToDayStem === "transmissionGeneratesDayStem", "中末子亥＝生"],
      [p!.states.initial.isVoid && p!.states.middle.isVoid && !p!.states.final.isVoid, "三伝は空へ引き込む（甲寅旬の空亡は子丑。初伝丑・中伝子が空亡、末伝亥は空亡でない）"],
    ],
  },
];
const classicLines: string[] = [];
for (const c of CLASSICS) {
  const facts = factsOf(c.day, c.offset);
  const x = standingAndTransmissionPathOf(facts);
  const ts = x.path ? POS.map((p) => x.path!.states[p].branch).join("") : "未確定";
  check(`${c.name} 再現（${c.day} 干上${c.upper} 三伝${c.ts}）`, x.standing.branch === c.upper && ts === c.ts, `干上${x.standing.branch} 三伝${ts}`);
  classicLines.push(`${c.name}: ${c.day}日 天盤差${c.offset} 干上${x.standing.branch} 三伝${ts}（${facts.sanchuan.method}）`);
  for (const [ok, label] of c.expect(x)) {
    check(`${c.name} ${label}`, ok);
    classicLines.push(`    ${ok ? "○" : "×"} ${label}`);
  }
  const s = x.standing;
  classicLines.push(`    干上 FACT: ${SHORT[s.relationToDayStem]}・${s.sixRelation}・${s.growthStage}(${s.growthPhase})・空亡${s.isVoid ? "○" : "－"}・禄${s.isDaySalary ? "○" : "－"}`);
  for (const p of POS) {
    const t = x.path!.states[p];
    classicLines.push(`    ${p} ${t.branch}: ${SHORT[t.relationToDayStem]}・${t.sixRelation}・${t.growthStage}(${t.growthPhase})・空亡${t.isVoid ? "○" : "－"}・禄${t.isDaySalary ? "○" : "－"}`);
  }
}

// ---- 1・3. 720課 ----
const standingRel: Record<string, number> = {};
const standingMarker = { 日禄: 0, 日徳: 0, 旬丁: 0, 驛馬: 0, 空亡: 0 };
const toInitial: Record<string, number> = {};
const toFinal: Record<string, number> = {};
const salary = { 干上禄・三伝禄なし: 0, 干上禄なし・中末に禄: 0, 干上も三伝も禄: 0, どちらにも禄なし: 0, 干上禄なし・初伝だけ禄: 0 };
const voids = {
  干上空亡・三伝空亡なし: 0, 干上空亡・三伝一部空亡: 0, 干上空亡・三伝すべて空亡: 0,
  干上非空亡・三伝空亡なし: 0, 干上非空亡・三伝一部空亡: 0, 干上非空亡・三伝すべて空亡: 0,
};
const seasonal4: Record<string, number> = {};
const phase4: Record<string, number> = {};
const moveRel: Record<string, Record<string, number>> = { 進茹: {}, 退茹: {} };
const moveVoid: Record<string, { 課数: number; 全空亡: number; 一部空亡: number; 空亡なし: number }> = {
  進茹: { 課数: 0, 全空亡: 0, 一部空亡: 0, 空亡なし: 0 }, 退茹: { 課数: 0, 全空亡: 0, 一部空亡: 0, 空亡なし: 0 },
};
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`;
    const tag = `${day}+${o}`;
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const before = JSON.stringify(chart);
    const facts = buildInterpretationFacts(chart);
    const factsBefore = JSON.stringify(facts);
    const markers = dayMarkersOf(facts);
    const upper = facts.lessons[0].upper;
    for (let m = 0; m < 12; m++) {
      const month = BRANCHES[m] as Branch;
      const x = standingAndTransmissionPathOf(facts, month);
      const s = x.standing;
      const rb = relationBetween(upper, facts.basic.dayStem);
      const on1 = (mk: typeof markers.yima) => mk.lessons.some((l) => l.index === 1);
      const ok = s.branch === upper && s.element === BRANCH_ELEMENT[upper] &&
        s.relationToDayStem === FROM_RELATION.find(([r]) => rb.relations.includes(r as never))![1] &&
        s.sixRelation === facts.lessons[0].relation &&
        s.isDaySalary === (markers.daySalary.branch === upper) && s.isDayVirtue === (markers.dayVirtue.branch === upper) &&
        s.isXunDing === (markers.xunDing.branch === upper) && s.isYima === (markers.yima.branch === upper) &&
        s.isDaySalary === on1(markers.daySalary) && s.isYima === on1(markers.yima) &&
        s.isVoid === facts.xun.voidBranches.includes(upper) &&
        s.growthStage === growthStageOfStem(facts.basic.dayStem, upper) && s.growthPhase === growthPhaseOf(s.growthStage) &&
        s.seasonalStrength === seasonalStrengthOf(BRANCH_ELEMENT[upper], rulingElementOfMonth(month));
      if (!ok) check(`${tag} 月${month} 干上 既存と一致`, false, JSON.stringify(s));
      if (JSON.stringify(x.path) !== JSON.stringify(transmissionDayStemFlowOf(facts, month))) check(`${tag} 月${month} path＝Phase 3K`, false);
      const p = x.path!;
      inc(seasonal4, [s.seasonalStrength, ...POS.map((q) => p.states[q].seasonalStrength)].join("→"));
      if (m !== 0) continue;

      // 月支に依らない集計（720課）
      check(`${tag} 月支なし → 旺衰 null`, dayStemStandingOf(facts).seasonalStrength === null);
      const st = p.states;
      inc(standingRel, SHORT[s.relationToDayStem]);
      if (s.isDaySalary) standingMarker.日禄 += 1;
      if (s.isDayVirtue) standingMarker.日徳 += 1;
      if (s.isXunDing) standingMarker.旬丁 += 1;
      if (s.isYima) standingMarker.驛馬 += 1;
      if (s.isVoid) standingMarker.空亡 += 1;
      inc(toInitial, `${s.relationToDayStem}|${st.initial.relationToDayStem}`);
      inc(toFinal, `${s.relationToDayStem}|${st.final.relationToDayStem}`);
      const pathSalary = POS.some((q) => st[q].isDaySalary);
      if (s.isDaySalary && !pathSalary) salary.干上禄・三伝禄なし += 1;
      else if (s.isDaySalary && pathSalary) salary.干上も三伝も禄 += 1;
      else if (st.middle.isDaySalary || st.final.isDaySalary) salary.干上禄なし・中末に禄 += 1;
      else if (st.initial.isDaySalary) salary.干上禄なし・初伝だけ禄 += 1;
      else salary.どちらにも禄なし += 1;
      const nv = POS.filter((q) => st[q].isVoid).length;
      const pathVoid = nv === 0 ? "三伝空亡なし" : nv === 3 ? "三伝すべて空亡" : "三伝一部空亡";
      voids[`${s.isVoid ? "干上空亡" : "干上非空亡"}・${pathVoid}` as keyof typeof voids] += 1;
      inc(phase4, [s.growthPhase, ...POS.map((q) => st[q].growthPhase)].join("→"));
      if (p.movementPattern === "進茹" || p.movementPattern === "退茹") {
        const mv = p.movementPattern;
        inc(moveRel[mv], [s.relationToDayStem, ...POS.map((q) => st[q].relationToDayStem)].map((r) => SHORT[r]).join("→"));
        moveVoid[mv].課数 += 1;
        moveVoid[mv][nv === 3 ? "全空亡" : nv === 0 ? "空亡なし" : "一部空亡"] += 1;
      }
    }
    check(`${tag} 起課結果・FACT 不変`, JSON.stringify(chart) === before && JSON.stringify(facts) === factsBefore);
  }
}
check("干上 relation の合計＝720", total(standingRel) === 720);
check("禄の比較（排他）の合計＝720", total(salary) === 720, JSON.stringify(salary));
check("空亡の比較（排他）の合計＝720", total(voids) === 720, JSON.stringify(voids));
check("旺衰4段階の合計＝720×12", total(seasonal4) === 8640);
check("三伝未確定 → path null・standing はある", (() => {
  const f = factsOf("甲子", 3);
  const x = standingAndTransmissionPathOf({ ...f, transmissions: null });
  return x.path === null && x.standing.branch === f.lessons[0].upper;
})());

const table = (o: Record<string, number>) => {
  const head = `    干上＼伝 | ${REL_ORDER.map((r) => SHORT[r]).join(" | ")}`;
  const rows = REL_ORDER.map((a) => `    ${SHORT[a]} | ${REL_ORDER.map((b) => o[`${a}|${b}`] ?? 0).join(" | ")}`);
  return [head, ...rows].join("\n");
};
console.log("古典4例:");
for (const l of classicLines) console.log(`  ${l}`);
console.log(`干上 relation: ${REL_ORDER.map((r) => `${SHORT[r]} ${standingRel[SHORT[r]] ?? 0}`).join(" / ")}`);
console.log(`干上 標識: ${JSON.stringify(standingMarker)}`);
console.log(`干上→初伝:\n${table(toInitial)}`);
console.log(`干上→末伝:\n${table(toFinal)}`);
console.log(`禄の比較: ${JSON.stringify(salary)}`);
console.log(`空亡の比較: ${JSON.stringify(voids)}`);
console.log(`旺衰 干上→初→中→末（720課×月支12）: ${Object.keys(seasonal4).length}種 上位20:`);
for (const [k, v] of top(seasonal4, 20)) console.log(`  ${k}: ${v}`);
console.log(`GrowthPhase 干上→初→中→末（720課）: ${Object.keys(phase4).length}種 上位20:`);
for (const [k, v] of top(phase4, 20)) console.log(`  ${k}: ${v}`);
for (const mv of ["進茹", "退茹"]) {
  console.log(`${mv} 干上→初→中→末 relation: ${Object.keys(moveRel[mv]).length}種 上位: ${top(moveRel[mv], 10).map(([k, v]) => `${k} ${v}`).join(" / ")}`);
  console.log(`${mv} 空亡: ${JSON.stringify(moveVoid[mv])}`);
}
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
