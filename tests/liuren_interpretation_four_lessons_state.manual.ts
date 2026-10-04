// tests/liuren_interpretation_four_lessons_state.manual.ts
//
// 六壬神課 解釈エンジン Phase 3U（四課の状態 FACT）のテスト。
// 実行: npx tsx tests/liuren_interpretation_four_lessons_state.manual.ts
//
//   1. 720課×月支で、一課の上神の状態が干上（Phase 3L の DayStemStandingState）と完全に一致
//   2. 二〜四課の上神の各値が既存 FACT（facts.lessons・dayMarkersOf・旬空・天地盤・十二長生）から直接求めた値と一致
//   3. 制約（Phase 3S と同じ規則）、上神どうしの順方向6組、下神→上神（一課は干のまま）、既存の剋関係との整合
//   4. 四課→三伝の関係は保存せず、必要なときに求められること
//   5. 家宅・転居・婚姻の古典例で、ROLE を付けずに一課〜四課の状態が同じ形で取れること。日支の扱いの監査
//   6. 720課の監査（制約・日禄・日徳・六親・十二長生・上神どうしの関係の分布）

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { dayMarkersOf } from "../src/lib/liuren/interpretation/markers";
import { growthPhaseOf } from "../src/lib/liuren/interpretation/qiState";
import { relationBetween } from "../src/lib/liuren/interpretation/relations";
import { constraintsOf } from "../src/lib/liuren/interpretation/actualization";
import { directionEvidenceOf } from "../src/lib/liuren/interpretation/directionEvidence";
import { dayStemStandingOf } from "../src/lib/liuren/interpretation/standingPath";
import { elementRelationOf } from "../src/lib/liuren/interpretation/standingPathComparison";
import { GROWTH_STAGES, growthStageOfStem } from "../src/lib/liuren/interpretation/states";
import { fourLessonsStateOf, lessonToTransmissionRelation } from "../src/lib/liuren/interpretation/fourLessonsState";
import type {
  ActualizationConstraint, ElementRelation, FourLessonsState, InterpretationFacts, LessonPosition, TransmissionToDayStemRelation,
} from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

const LP: LessonPosition[] = ["lesson1", "lesson2", "lesson3", "lesson4"];
const SIX_OF: Record<TransmissionToDayStemRelation, string> = {
  transmissionGeneratesDayStem: "父母", sameElement: "兄弟", dayStemGeneratesTransmission: "子孫",
  transmissionOvercomesDayStem: "官鬼", dayStemOvercomesTransmission: "妻財",
};
const CLASSES = ["制約なし", "旬空のみ", "坐空のみ", "両方"];
const cls = (c: readonly ActualizationConstraint[]) =>
  c.length === 0 ? "制約なし" : c.length === 2 ? "両方" : c[0] === "dayXunVoid" ? "旬空のみ" : "坐空のみ";
const factsOf = (day: string, jiang: Branch, shi: Branch): InterpretationFacts =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));

// ---- 5. 古典例（ROLE は付けない） ----
const lines: string[] = [];
const describe = (s: FourLessonsState) => s.lessons.map((l) =>
  `${l.position} 下${l.lower}（地盤${l.lowerBranch}）上${l.upper.branch}: ${l.upper.sixRelation}・${l.upper.growthStage} 禄${l.upper.isDaySalary ? "○" : "－"} 徳${l.upper.isDayVirtue ? "○" : "－"} 制約[${l.constraints.join("+")}] 下→上 ${l.lowerToUpper.relation}（${l.lowerToUpper.zeike}）`);
{
  // 家宅（住む）・転居: 講座 p67 の一課・三課（例34 丙午日 卯将申時は「占宅」）
  const f = factsOf("丙午", "卯", "申");
  const s = fourLessonsStateOf(f);
  check("家宅・転居 例34 一課・三課の状態が同じ形で取れる", s.lessons[0].upper.branch === f.lessons[0].upper && s.lessons[2].upper.branch === f.lessons[2].upper &&
    Object.keys(s.lessons[0]).join() === Object.keys(s.lessons[2]).join());
  lines.push("家宅・転居（講座 p67。一課・三課）例34 丙午日 卯将申時:");
  for (const l of describe(s)) lines.push(`    ${l}`);
  // 婚姻: 講座 p62 の一課〜四課（婚姻の古典例は手元の資料にないため、同じ盤で4課すべてが取れることだけ確認）
  check("婚姻 一課〜四課すべての状態が同じ形で取れる", s.lessons.every((l, k) => l.position === LP[k] && Object.keys(l).join() === Object.keys(s.lessons[0]).join()));
}

// ---- 1〜4・6. 720課 ----
const constraintDist = Object.fromEntries(LP.map((p) => [p, Object.fromEntries(CLASSES.map((c) => [c, 0]))])) as Record<LessonPosition, Record<string, number>>;
const salary = Object.fromEntries(LP.map((p) => [p, Object.fromEntries(["あり", ...CLASSES].map((c) => [c, 0]))])) as Record<LessonPosition, Record<string, number>>;
const virtue = Object.fromEntries(LP.map((p) => [p, Object.fromEntries(["あり", ...CLASSES].map((c) => [c, 0]))])) as Record<LessonPosition, Record<string, number>>;
const six = Object.fromEntries(LP.map((p) => [p, Object.fromEntries(["兄弟", "子孫", "妻財", "官鬼", "父母"].map((c) => [c, 0]))])) as Record<LessonPosition, Record<string, number>>;
const growth = Object.fromEntries(LP.map((p) => [p, Object.fromEntries(GROWTH_STAGES.map((g) => [g, 0]))])) as Record<LessonPosition, Record<string, number>>;
const RELS: ElementRelation[] = ["generates", "sameElement", "generatedBy", "overcomes", "overcomeBy"];
const pairDist: Record<string, Record<ElementRelation, number>> = {};
let lesson3LowerIsDayBranch = true;
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const tag = `${STEMS[i % 10]}${BRANCHES[i % 12]}+${o}`;
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const before = JSON.stringify(chart);
    const facts = buildInterpretationFacts(chart);
    const factsBefore = JSON.stringify(facts);
    const markers = dayMarkersOf(facts);
    const voids = facts.xun.voidBranches as readonly Branch[];
    for (const m of [null, BRANCHES[(i + o) % 12]] as (Branch | null)[]) {
      const s = fourLessonsStateOf(facts, m);
      // 1. 一課＝干上（Phase 3L）と完全一致。DirectionEvidence の standing とも一致
      const standing = dayStemStandingOf(facts, m);
      if (JSON.stringify(s.lessons[0].upper) !== JSON.stringify(standing) ||
        JSON.stringify(s.lessons[0].upper) !== JSON.stringify(directionEvidenceOf(facts, m)!.standing)) {
        check(`${tag} 月${m ?? "なし"} 一課＝干上`, false);
      }
      // 2・3. 各課の値を既存 FACT から直接求めた値と比べる
      const ok = s.lessons.every((l, k) => {
        const src = facts.lessons[k];
        const u = l.upper;
        const rb = elementRelationOf(relationBetween(src.lower, src.upper));
        const zeikeOk = (src.zeike === "下賊") === (rb === "overcomes") && (src.zeike === "上剋") === (rb === "overcomeBy");
        return l.position === LP[k] && l.index === k + 1 && l.lower === src.lower && l.lowerBranch === src.lowerBranch &&
          u.branch === src.upper && u.sixRelation === src.relation && SIX_OF[u.relationToDayStem] === u.sixRelation &&
          u.isVoid === voids.includes(src.upper) && u.isSeatedOnVoid === voids.includes(facts.plate.earthUnder[src.upper]) &&
          u.isDaySalary === markers.daySalary.lessons.some((x) => x.index === k + 1) &&
          u.isYima === markers.yima.lessons.some((x) => x.index === k + 1) &&
          u.growthStage === growthStageOfStem(facts.basic.dayStem, src.upper) && u.growthPhase === growthPhaseOf(u.growthStage) &&
          JSON.stringify(l.constraints) === JSON.stringify(constraintsOf(u)) &&
          l.lowerToUpper.from === src.lower && l.lowerToUpper.to === src.upper && l.lowerToUpper.relation === rb &&
          l.lowerToUpper.zeike === src.zeike && zeikeOk;
      }) && s.internalRelations.length === 6 && s.internalRelations.every((r) =>
        r.fromBranch === s.lessons[LP.indexOf(r.fromPosition)].upper.branch && r.toBranch === s.lessons[LP.indexOf(r.toPosition)].upper.branch &&
        LP.indexOf(r.fromPosition) < LP.indexOf(r.toPosition) &&
        JSON.stringify(r.structural) === JSON.stringify(relationBetween(r.fromBranch, r.toBranch)) && r.relation === elementRelationOf(r.structural));
      if (!ok) check(`${tag} 月${m ?? "なし"} 四課の値`, false);
    }
    // 4. 四課→三伝は必要なときに求める
    const e = directionEvidenceOf(facts)!;
    const s = fourLessonsStateOf(facts);
    const lt = lessonToTransmissionRelation(s.lessons[2], e.path.states.initial);
    if (lt.relation !== elementRelationOf(relationBetween(s.lessons[2].upper.branch, e.path.states.initial.branch))) check(`${tag} 四課→三伝`, false);
    if (facts.lessons[2].lowerBranch !== facts.basic.dayBranch) lesson3LowerIsDayBranch = false;
    check(`${tag} 起課結果・FACT 不変`, JSON.stringify(chart) === before && JSON.stringify(facts) === factsBefore);

    // 6. 分布
    for (const l of s.lessons) {
      const k = cls(l.constraints);
      constraintDist[l.position][k] += 1;
      if (l.upper.isDaySalary) { salary[l.position].あり += 1; salary[l.position][k] += 1; }
      if (l.upper.isDayVirtue) { virtue[l.position].あり += 1; virtue[l.position][k] += 1; }
      six[l.position][l.upper.sixRelation] += 1;
      growth[l.position][l.upper.growthStage] += 1;
    }
    for (const r of s.internalRelations) {
      const key = `${r.fromPosition}→${r.toPosition}`;
      pairDist[key] ??= { generates: 0, sameElement: 0, generatedBy: 0, overcomes: 0, overcomeBy: 0 };
      pairDist[key][r.relation] += 1;
    }
  }
}
check("三課の地盤支（lowerBranch）は日支そのもの（720課）", lesson3LowerIsDayBranch);

const row = (o: Record<string, number>, keys: string[]) => keys.map((k) => `${k} ${o[k]}`).join(" / ");
console.log("古典例（ROLE は付けない）:");
for (const l of lines) console.log(`  ${l}`);
console.log("四課の上神 × 制約:");
for (const p of LP) console.log(`  ${p}: ${row(constraintDist[p], CLASSES)}`);
console.log("四課の日禄:");
for (const p of LP) console.log(`  ${p}: ${row(salary[p], ["あり", ...CLASSES])}`);
console.log("四課の日徳:");
for (const p of LP) console.log(`  ${p}: ${row(virtue[p], ["あり", ...CLASSES])}`);
console.log("四課の六親:");
for (const p of LP) console.log(`  ${p}: ${row(six[p], ["兄弟", "子孫", "妻財", "官鬼", "父母"])}`);
console.log("四課の十二長生:");
for (const p of LP) console.log(`  ${p}: ${row(growth[p], [...GROWTH_STAGES])}`);
console.log("四課の上神どうしの関係:");
const totalRel = { generates: 0, sameElement: 0, generatedBy: 0, overcomes: 0, overcomeBy: 0 };
for (const [k, v] of Object.entries(pairDist)) {
  console.log(`  ${k}: ${RELS.map((r) => `${r} ${v[r]}`).join(" / ")}`);
  for (const r of RELS) totalRel[r] += v[r];
}
console.log(`  6組合計: ${RELS.map((r) => `${r} ${totalRel[r]}`).join(" / ")}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
