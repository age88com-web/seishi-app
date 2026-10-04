// tests/liuren_interpretation_day_branch_state.manual.ts
//
// 六壬神課 解釈エンジン Phase 3V（日支そのものの状態 FACT）のテスト。
// 実行: npx tsx tests/liuren_interpretation_day_branch_state.manual.ts
//
//   1. 720課×月支で、日支の各値が既存の関数から直接求めた値と一致し、三課の下神・地盤支（Phase 3U）と同じ支であること
//   2. 坐空を付けていないこと。制約は旬空だけが対象（applicableConstraints）で、旬空の値は既存の旬空 FACT のまま
//   3. 日支 → 四課上神・三伝の関係を、保存せず必要なときに求められること
//   4. 家宅（日支・三課下神・三課上神の区別）、婚姻・訴訟（anchor として日干・日支の両方の FACT に到達できる）。ROLE は付けない
//   5. 720課の監査（六親・十二長生・標識・旬空 true の件数）

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { sixRelation } from "../src/lib/liuren/relations";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { dayMarkersOf } from "../src/lib/liuren/interpretation/markers";
import { relationBetween } from "../src/lib/liuren/interpretation/relations";
import { directionEvidenceOf } from "../src/lib/liuren/interpretation/directionEvidence";
import { fourLessonsStateOf } from "../src/lib/liuren/interpretation/fourLessonsState";
import { elementRelationOf } from "../src/lib/liuren/interpretation/standingPathComparison";
import { GROWTH_STAGES, growthStageOfStem, rulingElementOfMonth, seasonalStrengthOf } from "../src/lib/liuren/interpretation/states";
import { dayBranchRelationTo, dayBranchStateOf } from "../src/lib/liuren/interpretation/dayBranchState";
import type { BoardAnchor } from "../src/lib/liuren/interpretation/roles";
import type { DayBranchState, DayStemStandingState, InterpretationFacts, TransmissionToDayStemRelation } from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

const SIX_OF: Record<TransmissionToDayStemRelation, string> = {
  transmissionGeneratesDayStem: "父母", sameElement: "兄弟", dayStemGeneratesTransmission: "子孫",
  transmissionOvercomesDayStem: "官鬼", dayStemOvercomesTransmission: "妻財",
};
const ELEMENT: Record<string, string> = { 子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火", 午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水" };
const factsOf = (day: string, jiang: Branch, shi: Branch): InterpretationFacts =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));

/** 監査用: BoardAnchor の dayStem・dayBranch から FACT へ到達する（将来の API 案の形を確かめるだけ。ROLE は付けない） */
function resolveAnchor(facts: InterpretationFacts, anchor: BoardAnchor): { kind: string; stem?: Stem; standing?: DayStemStandingState; dayBranch?: DayBranchState } | null {
  if (anchor.kind === "dayStem") return { kind: "dayStem", stem: facts.basic.dayStem, standing: directionEvidenceOf(facts)?.standing };
  if (anchor.kind === "dayBranch") return { kind: "dayBranch", dayBranch: dayBranchStateOf(facts) };
  return null;
}

// ---- 4. 古典例（ROLE は付けない） ----
const lines: string[] = [];
{
  // 家宅: 講座 p67「日支を家とする。それらの表象はそれぞれ一課、三課」。例34 丙午日（占宅）
  const f = factsOf("丙午", "卯", "申");
  const d = dayBranchStateOf(f);
  const l3 = fourLessonsStateOf(f).lessons[2];
  check("家宅 日支・三課下神・三課上神を区別できる", d.branch === "午" && l3.lower === "午" && l3.lowerBranch === "午" && l3.upper.branch === "丑" &&
    d.anchor === "dayBranch" && !("isSeatedOnVoid" in d));
  lines.push(`家宅 例34 丙午日: 日支 ${d.branch}（${d.sixRelation}・${d.growthStage}・旬空${d.isDayXunVoid ? "○" : "－"}） ／ 三課下神 ${l3.lower}（地盤 ${l3.lowerBranch}） ／ 三課上神 ${l3.upper.branch}（${l3.upper.sixRelation}・${l3.upper.growthStage}・坐空${l3.upper.isSeatedOnVoid ? "○" : "－"}）`);
  // 婚姻・訴訟: anchor として日干・日支の両方の FACT に到達できる（日支＝相手・被告のような固定はしない）
  for (const [subject, counter] of [[{ kind: "dayStem" }, { kind: "dayBranch" }], [{ kind: "dayBranch" }, { kind: "dayStem" }]] as [BoardAnchor, BoardAnchor][]) {
    const a = resolveAnchor(f, subject);
    const b = resolveAnchor(f, counter);
    check(`anchor subject=${subject.kind}・counterparty=${counter.kind} の両方に到達`, a !== null && b !== null && a.kind === subject.kind && b.kind === counter.kind);
  }
  lines.push(`anchor: dayStem → 日干 ${f.basic.dayStem}・干上 ${directionEvidenceOf(f)!.standing.branch} ／ dayBranch → DayBranchState ${d.branch}（subject・counterparty のどちらにも指定できる）`);
}

// ---- 1〜3・5. 720課 ----
const six: Record<string, number> = { 兄弟: 0, 子孫: 0, 妻財: 0, 官鬼: 0, 父母: 0 };
const growth: Record<string, number> = Object.fromEntries(GROWTH_STAGES.map((g) => [g, 0]));
const markerCount = { daySalary: 0, dayVirtue: 0, xunDing: 0, yima: 0 };
let voidTrue = 0;
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const tag = `${STEMS[i % 10]}${BRANCHES[i % 12]}+${o}`;
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const before = JSON.stringify(chart);
    const facts = buildInterpretationFacts(chart);
    const factsBefore = JSON.stringify(facts);
    const markers = dayMarkersOf(facts);
    const fl = fourLessonsStateOf(facts);
    for (const m of [null, BRANCHES[(i + o) % 12]] as (Branch | null)[]) {
      const d = dayBranchStateOf(facts, m);
      const b = facts.basic.dayBranch;
      const ok = d.branch === b && d.branch === facts.lessons[2].lower && d.branch === fl.lessons[2].lowerBranch &&
        ELEMENT[d.branch] === d.element &&
        SIX_OF[d.relationToDayStem] === d.sixRelation && d.sixRelation === sixRelation(facts.basic.dayStem, b) &&
        d.growthStage === growthStageOfStem(facts.basic.dayStem, b) &&
        d.seasonalStrength === (m ? seasonalStrengthOf(d.element, rulingElementOfMonth(m)) : null) &&
        d.markers.daySalary === (markers.daySalary.branch === b) && d.markers.dayVirtue === (markers.dayVirtue.branch === b) &&
        d.markers.xunDing === (markers.xunDing.branch === b) && d.markers.yima === (markers.yima.branch === b) &&
        d.isDayXunVoid === facts.xun.voidBranches.includes(b) &&
        d.applicableConstraints.join() === "dayXunVoid" && d.constraints.join() === (d.isDayXunVoid ? "dayXunVoid" : "") &&
        !("isSeatedOnVoid" in d) && !(d.constraints as readonly string[]).includes("seatedOnVoid");
      if (!ok) check(`${tag} 月${m ?? "なし"} 日支の値`, false, JSON.stringify(d));
    }
    // 3. 日支 → 四課上神・三伝（必要なときに求める）
    const d = dayBranchStateOf(facts);
    const e = directionEvidenceOf(facts)!;
    const targets = [...fl.lessons.map((l) => l.upper.branch), e.path.states.initial.branch, e.path.states.middle.branch, e.path.states.final.branch];
    if (!targets.every((t) => dayBranchRelationTo(d, t).relation === elementRelationOf(relationBetween(d.branch, t)))) check(`${tag} 日支→四課・三伝`, false);
    check(`${tag} 起課結果・FACT 不変`, JSON.stringify(chart) === before && JSON.stringify(facts) === factsBefore);

    six[d.sixRelation] += 1;
    growth[d.growthStage] += 1;
    for (const k of Object.keys(markerCount) as (keyof typeof markerCount)[]) if (d.markers[k]) markerCount[k] += 1;
    if (d.isDayXunVoid) voidTrue += 1;
  }
}
// 旬空 true の件数は期待値で通さず、そのまま報告する（既存の旬空 FACT から求めた結果）
console.log("古典例（ROLE は付けない）:");
for (const l of lines) console.log(`  ${l}`);
console.log(`720課 日支の六親: ${Object.entries(six).map(([k, v]) => `${k} ${v}`).join(" / ")}`);
console.log(`720課 日支の十二長生: ${Object.entries(growth).map(([k, v]) => `${k} ${v}`).join(" / ")}`);
console.log(`720課 日支が標識の支: 日禄 ${markerCount.daySalary} / 日徳 ${markerCount.dayVirtue} / 旬丁 ${markerCount.xunDing} / 驛馬 ${markerCount.yima}`);
console.log(`720課 日支 dayXunVoid=true: ${voidTrue}件`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
