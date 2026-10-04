// tests/liuren_interpretation_actualization.manual.ts
//
// 六壬神課 解釈エンジン Phase 3S（実現の制約 FACT）のテスト。
// 実行: npx tsx tests/liuren_interpretation_actualization.manual.ts
//
//   この層は「象意が存在するか」ではなく「現実化・作用するときに古典上考慮される制約 FACT が付いているか」を持つ。
//   制約があるから作用しない、とはしない。
//   1. 古典例（S1 辛巳・D54 庚辰・D43 丁丑・D34 丙午・C 癸亥・D 乙卯・三伝皆空 壬子／甲午）の存在 FACT と制約
//   2. 720課×月支で、StandingPathComparison（Phase 3P・3R）だけから作られ、元の isVoid・isSeatedOnVoid と一致すること
//   3. 720課の監査（標識・十二長生・六親・日干との関係 × 制約、地点どうしの関係の両端の制約）

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { standingPathComparisonOf } from "../src/lib/liuren/interpretation/standingPathComparison";
import { standingPathActualizationFrom, standingPathActualizationOf } from "../src/lib/liuren/interpretation/actualization";
import { GROWTH_STAGES } from "../src/lib/liuren/interpretation/states";
import type {
  ActualizationConstraint, ComparisonPosition, ElementRelation, PositionActualizationState, StandingPathActualization,
  TransmissionToDayStemRelation,
} from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

const ST: ComparisonPosition[] = ["standing", "initial", "middle", "final"];
const SHORT: Record<TransmissionToDayStemRelation, string> = {
  transmissionGeneratesDayStem: "生干", sameElement: "比和", dayStemGeneratesTransmission: "干生",
  transmissionOvercomesDayStem: "剋干", dayStemOvercomesTransmission: "干剋",
};
const cs = (c: readonly ActualizationConstraint[]) => c.join("+") || "[]";
const cls = (c: readonly ActualizationConstraint[]) =>
  c.length === 0 ? "制約なし" : c.length === 2 ? "両方" : c[0] === "dayXunVoid" ? "旬空のみ" : "坐空のみ";
const actOf = (day: string, offset: number | null, jiang?: Branch, shi?: Branch): StandingPathActualization => standingPathActualizationOf(buildInterpretationFacts(
  jiang && shi
    ? calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang })
    : calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[offset!] }),
))!;
const describe = (a: StandingPathActualization) => a.states.map((s) =>
  `${s.position} ${s.branch}: ${SHORT[s.relationToDayStem]}・${s.sixRelation}・${s.growthStage} 禄${s.markers.daySalary ? "○" : "－"} 徳${s.markers.dayVirtue ? "○" : "－"} 丁${s.markers.xunDing ? "○" : "－"} 馬${s.markers.yima ? "○" : "－"} 制約${cs(s.constraints)}`);

// ---- 1. 古典例 ----
const lines: string[] = [];
const show = (name: string, a: StandingPathActualization) => {
  lines.push(name);
  for (const l of describe(a)) lines.push(`    ${l}`);
};
{
  const s1 = actOf("辛巳", 11);
  check("S1 辛巳 干上酉 日禄・帝旺・制約 dayXunVoid", s1.states[0].branch === "酉" && s1.states[0].markers.daySalary &&
    s1.states[0].growthStage === "帝旺" && cs(s1.states[0].constraints) === "dayXunVoid");
  show("S1 辛巳 天盤差11", s1);
  const d54 = actOf("庚辰", null, "子", "子");
  check("D54 庚辰 干上申 日禄・制約 dayXunVoid+seatedOnVoid", d54.states[0].branch === "申" && d54.states[0].markers.daySalary &&
    cs(d54.states[0].constraints) === "dayXunVoid+seatedOnVoid");
  show("D54 庚辰 子将子時", d54);
  const d43 = actOf("丁丑", null, "午", "未");
  check("D43 丁丑 干上午 日禄・制約なし", d43.states[0].branch === "午" && d43.states[0].markers.daySalary && d43.states[0].constraints.length === 0);
  check("S1・D54・D43 は日禄が同じく存在し、制約だけが異なる",
    [s1, d54, d43].every((a) => a.states[0].markers.daySalary) &&
    new Set([s1, d54, d43].map((a) => cs(a.states[0].constraints))).size === 3);
  show("D43 丁丑 午将未時", d43);
  const d34 = actOf("丙午", null, "卯", "申");
  const f = d34.states[3];
  check("D34 丙午 末伝寅 長生・生干を保ったまま制約 dayXunVoid", f.branch === "寅" && f.growthStage === "長生" &&
    f.relationToDayStem === "transmissionGeneratesDayStem" && f.constraints.includes("dayXunVoid"));
  show("D34 丙午 卯将申時", d34);
  const c = actOf("癸亥", 11);
  check("C 癸亥 干上子 日禄・帝旺・比和のまま制約 dayXunVoid+seatedOnVoid", c.states[0].markers.daySalary && c.states[0].growthStage === "帝旺" &&
    c.states[0].relationToDayStem === "sameElement" && cs(c.states[0].constraints) === "dayXunVoid+seatedOnVoid");
  show("C 癸亥 天盤差11", c);
  const d = actOf("乙卯", 11);
  check("D 乙卯 干上卯 日禄・帝旺・制約なし／初伝丑 旬空・中伝子 旬空+坐空・末伝亥 坐空",
    d.states[0].markers.daySalary && d.states[0].growthStage === "帝旺" && d.states[0].constraints.length === 0 &&
    d.states.slice(1).map((s) => cs(s.constraints)).join(" ") === "dayXunVoid dayXunVoid+seatedOnVoid seatedOnVoid",
    d.states.map((s) => cs(s.constraints)).join(" "));
  show("D 乙卯 天盤差11", d);
  for (const [name, day] of [["S3a 壬子 天盤差1", "壬子"], ["S3b 甲午 天盤差1", "甲午"]]) {
    const a = actOf(day, 1);
    check(`${name} 干上に制約なし・三伝だけに制約`, a.states[0].constraints.length === 0 && a.states.slice(1).every((s) => s.constraints.length > 0),
      a.states.map((s) => cs(s.constraints)).join(" "));
    show(name, a);
  }
  // 元 FACT は残っている
  check("元の isVoid・isSeatedOnVoid は source に残る", d.states[2].source.isVoid && d.states[2].source.isSeatedOnVoid);
}

// ---- 2・3. 720課 ----
const CLASSES = ["制約なし", "旬空のみ", "坐空のみ", "両方"];
type Tally = Record<string, Record<string, number>>;
const tally = (keys: string[]): Tally => Object.fromEntries(keys.map((k) => [k, Object.fromEntries(CLASSES.map((c) => [c, 0]))]));
const markerTally: Record<string, Tally> = Object.fromEntries(["日禄", "日徳", "旬丁", "驛馬"].map((m) => [m, tally(ST)]));
const growthTally = tally([...GROWTH_STAGES]);
const sixTally = tally(["兄弟", "子孫", "妻財", "官鬼", "父母"]);
const relTally = tally(Object.values(SHORT));
const endpoint: Record<string, number> = {};
const RELS: ElementRelation[] = ["generates", "sameElement", "generatedBy", "overcomes", "overcomeBy"];
const byRelation: Record<string, { 件数: number; to側に制約: number; from側に制約: number; 両端に制約: number }> =
  Object.fromEntries(RELS.map((r) => [r, { 件数: 0, to側に制約: 0, from側に制約: 0, 両端に制約: 0 }]));
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };
const MARK: [string, keyof PositionActualizationState["markers"]][] = [["日禄", "daySalary"], ["日徳", "dayVirtue"], ["旬丁", "xunDing"], ["驛馬", "yima"]];
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const tag = `${STEMS[i % 10]}${BRANCHES[i % 12]}+${o}`;
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const before = JSON.stringify(chart);
    const facts = buildInterpretationFacts(chart);
    for (const m of [null, BRANCHES[(i + o) % 12]] as (Branch | null)[]) {
      const c = standingPathComparisonOf(facts, m)!;
      const a = standingPathActualizationFrom(c);
      const srcs = [c.standing, c.path.initial, c.path.middle, c.path.final];
      const ok = a.states.every((s, k) => s.position === ST[k] && s.source === srcs[k] && s.branch === srcs[k].branch &&
        (s.constraints.includes("dayXunVoid") === srcs[k].isVoid) && (s.constraints.includes("seatedOnVoid") === srcs[k].isSeatedOnVoid) &&
        (s.constraints.includes("dayXunVoid") === c.voidPositions.dayXunVoid.includes(ST[k])) &&
        (s.constraints.includes("seatedOnVoid") === c.voidPositions.seatedOnVoid.includes(ST[k])) &&
        s.relationToDayStem === srcs[k].relationToDayStem && s.sixRelation === srcs[k].sixRelation &&
        s.growthStage === srcs[k].growthStage && s.growthPhase === srcs[k].growthPhase &&
        s.markers.daySalary === c.markerPositions.daySalary.includes(ST[k]) && s.markers.yima === c.markerPositions.yima.includes(ST[k])) &&
        a.internalRelations.length === 6 && a.internalRelations.every((r, k) => r.relation === c.internalRelations.all[k] &&
          r.fromConstraints === a.states[ST.indexOf(r.relation.fromPosition)].constraints &&
          r.toConstraints === a.states[ST.indexOf(r.relation.toPosition)].constraints);
      if (!ok) check(`${tag} 月${m ?? "なし"} Phase 3P・3R の参照・転記`, false);
    }
    check(`${tag} 起課結果不変`, JSON.stringify(chart) === before);

    const a = standingPathActualizationOf(facts)!;
    for (const s of a.states) {
      const k = cls(s.constraints);
      for (const [label, key] of MARK) if (s.markers[key]) markerTally[label][s.position][k] += 1;
      growthTally[s.growthStage][k] += 1;
      sixTally[s.sixRelation][k] += 1;
      relTally[SHORT[s.relationToDayStem]][k] += 1;
    }
    for (const r of a.internalRelations) {
      inc(endpoint, `${cls(r.fromConstraints)}→${cls(r.toConstraints)}`);
      const b = byRelation[r.relation.relation];
      b.件数 += 1;
      if (r.toConstraints.length) b.to側に制約 += 1;
      if (r.fromConstraints.length) b.from側に制約 += 1;
      if (r.toConstraints.length && r.fromConstraints.length) b.両端に制約 += 1;
    }
  }
}
check("三伝未確定 → null", standingPathActualizationOf({ ...buildInterpretationFacts(calculateLiuren({
  dayStem: "甲", dayBranch: "子", divinationBranch: "子", monthGeneral: "卯" })), transmissions: null }) === null);
const total = (o: Record<string, number>) => Object.values(o).reduce((x, y) => x + y, 0);
check("地点の合計＝720×4", Object.values(growthTally).reduce((x, t) => x + total(t), 0) === 2880);
check("端点の組合せの合計＝720×6", total(endpoint) === 4320);

const row = (t: Record<string, number>) => CLASSES.map((c) => `${c} ${t[c]}`).join(" / ");
console.log("古典例（存在する FACT と制約）:");
for (const l of lines) console.log(`  ${l}`);
for (const [label] of MARK) {
  console.log(`${label} × 制約（地点ごと）:`);
  for (const p of ST) console.log(`  ${p}: ${row(markerTally[label][p])}`);
}
console.log("十二長生 × 制約（4地点・720課）:");
for (const g of GROWTH_STAGES) console.log(`  ${g}: ${row(growthTally[g])}`);
console.log("六親 × 制約:");
for (const k of Object.keys(sixTally)) console.log(`  ${k}: ${row(sixTally[k])}`);
console.log("日干との関係 × 制約:");
for (const k of Object.keys(relTally)) console.log(`  ${k}: ${row(relTally[k])}`);
console.log("地点どうしの関係の両端の制約（from→to、6組×720課）:");
for (const [k, v] of Object.entries(endpoint).sort((x, y) => y[1] - x[1])) console.log(`  ${k}: ${v}`);
console.log("関係の種類ごとの端点の制約:");
for (const r of RELS) console.log(`  ${r}: ${JSON.stringify(byRelation[r])}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
