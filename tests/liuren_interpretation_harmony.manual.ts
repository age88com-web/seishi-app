// tests/liuren_interpretation_harmony.manual.ts
//
// 六壬神課 解釈エンジン Phase 3F（全局課・三合欠一神）のテスト。
// 実行: npx tsx tests/liuren_interpretation_harmony.manual.ts
//
//   1. 全局課: 亥卯未＝曲直・寅午戌＝炎上・巳酉丑＝従革・申子辰＝潤下（各6通りの並び）。欠一神とは排他
//   2. 欠一神: 各局で1支を欠く3通り、重複伝（寅午午など）、三伝での位置
//   3. 排他: 完全三合・1支だけ・別局の2支では欠一神にならない
//   4. 欠けた支の盤上の位置: 日支・四課上神・四課の地盤支・日干上神・日支上神
//   5. 720課の監査: 全局4種（Phase 3C の 木38・火18・金34・水28 と一致するか）、欠一神の件数・位置別件数・実課例

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Element, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { analyzeTransmissionFlow } from "../src/lib/liuren/interpretation/flow";
import { detectClassicalPatterns } from "../src/lib/liuren/interpretation/patterns";
import type {
  FullHarmonyPattern, InterpretationFacts, LessonFact, MissingBranchOccurrences, PartialHarmonyPattern, TransmissionFact,
} from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

const BASE = buildInterpretationFacts(calculateLiuren({ dayStem: "乙", dayBranch: "丑", divinationBranch: "子", monthGeneral: "子" }));
function withTransmissions(b: string, base: InterpretationFacts = BASE): InterpretationFacts {
  const t = [...b].map((x, i): TransmissionFact => ({ ...base.transmissions![i], branch: x as Branch }));
  return { ...base, transmissions: [t[0], t[1], t[2]] };
}
const fullOf = (f: InterpretationFacts) => detectClassicalPatterns(f).filter((p): p is FullHarmonyPattern => p.kind === "fullHarmony");
const partialOf = (f: InterpretationFacts) => detectClassicalPatterns(f).filter((p): p is PartialHarmonyPattern => p.kind === "partialHarmony");
const perms = (s: string): string[] => {
  const [a, b, c] = [...s];
  return [a + b + c, a + c + b, b + a + c, b + c + a, c + a + b, c + b + a];
};

// ---- 1. 全局課 ----
const GROUPS: [string, Element, string][] = [["亥卯未", "木", "曲直"], ["寅午戌", "火", "炎上"], ["巳酉丑", "金", "従革"], ["申子辰", "水", "潤下"]];
for (const [g, el, name] of GROUPS) {
  for (const p of perms(g)) {
    const f = withTransmissions(p);
    const full = fullOf(f);
    check(`全局 ${p}＝${name}`, full.length === 1 && full[0].element === el && full[0].classicalName === name &&
      `${full[0].branches.initial}${full[0].branches.middle}${full[0].branches.final}` === p, JSON.stringify(full));
    check(`全局 ${p} は欠一神にしない`, partialOf(f).length === 0);
  }
}

// ---- 2. 欠一神 ----
// 局の外の支（三伝の3つ目）: 各局と別の局の支を使う
const OUTSIDE: Record<Element, Branch> = { 木: "子", 火: "酉", 金: "卯", 水: "午" } as Record<Element, Branch>;
for (const [g, el] of GROUPS) {
  const group = [...g] as Branch[];
  for (let k = 0; k < 3; k++) {
    const missing = group[k];
    const present = group.filter((_, i) => i !== k);
    for (const tri of [`${present[0]}${present[1]}${OUTSIDE[el]}`, `${present[1]}${present[0]}${present[0]}`, `${OUTSIDE[el]}${present[0]}${present[1]}`]) {
      const ps = partialOf(withTransmissions(tri));
      check(`欠一神 ${tri}（${el}局・欠${missing}）`, ps.length === 1 && ps[0].element === el && ps[0].missingBranch === missing &&
        ps[0].presentBranches.join("") === present.join("") && ps[0].missingOneOfThree &&
        ps[0].classicalNames.join() === "折腰格,虚一待用格", JSON.stringify(ps.map((p) => [p.element, p.presentBranches, p.missingBranch])));
    }
  }
}
{
  // 重複伝: 寅午午 → 火局の2支（寅・午）、欠＝戌
  const [p] = partialOf(withTransmissions("寅午午"));
  check("重複伝 寅午午＝火局・欠戌", p?.element === "火" && p.missingBranch === "戌" && p.presentBranches.join("") === "寅午");
  check("重複伝 寅午午 の位置", JSON.stringify(p?.transmissionPositions) ===
    JSON.stringify([{ branch: "寅", positions: ["initial"] }, { branch: "午", positions: ["middle", "final"] }]),
    JSON.stringify(p?.transmissionPositions));
  const [q] = partialOf(withTransmissions("戌子寅"));
  check("位置 戌子寅＝寅 initial 以外", q?.element === "火" && q.missingBranch === "午" &&
    JSON.stringify(q.transmissionPositions) === JSON.stringify([{ branch: "寅", positions: ["final"] }, { branch: "戌", positions: ["initial"] }]),
    JSON.stringify(q?.transmissionPositions));
}

// ---- 3. 排他 ----
for (const tri of ["寅子丑", "寅寅寅", "寅子子", "子丑寅", "辰戌丑", "卯酉卯"]) {
  check(`欠一神にならない ${tri}`, partialOf(withTransmissions(tri)).length === 0, JSON.stringify(partialOf(withTransmissions(tri))));
}
check("三伝未確定 → 全局・欠一神なし", detectClassicalPatterns({ ...BASE, transmissions: null })
  .every((p) => p.kind !== "fullHarmony" && p.kind !== "partialHarmony"));

// ---- 4. 欠けた支の盤上の位置 ----
{
  // 寅午子: 火局の寅・午、欠＝戌。日支・四課の上神と地盤支を差し替えて確かめる
  const board = (dayBranch: Branch, uppers: string, lowers: string): InterpretationFacts => {
    const f = withTransmissions("寅午子");
    const ls = f.lessons.map((l, i): LessonFact => ({ ...l, upper: uppers[i] as Branch, lowerBranch: lowers[i] as Branch }));
    return { ...f, basic: { ...f.basic, dayBranch }, lessons: [ls[0], ls[1], ls[2], ls[3]] };
  };
  const occ = (f: InterpretationFacts): MissingBranchOccurrences => partialOf(f)[0].missingBranchOccurrences;
  const a = occ(board("戌", "子子子子", "子子子子"));
  check("位置 日支＝戌", a.dayBranch && a.lessonUppers.length === 0 && !a.dayStemUpper && !a.dayBranchUpper, JSON.stringify(a));
  const b = occ(board("子", "戌子子子", "子子子子"));
  check("位置 日干上神（一課上神）＝戌", !b.dayBranch && b.dayStemUpper && !b.dayBranchUpper && b.lessonUppers.join() === "1", JSON.stringify(b));
  const c = occ(board("子", "子子戌子", "子子子子"));
  check("位置 日支上神（三課上神）＝戌", c.dayBranchUpper && !c.dayStemUpper && c.lessonUppers.join() === "3", JSON.stringify(c));
  const d = occ(board("子", "子戌子戌", "子子子子"));
  check("位置 四課上神（二課・四課）＝戌", d.lessonUppers.join() === "2,4" && !d.dayStemUpper && !d.dayBranchUpper, JSON.stringify(d));
  const e = occ(board("子", "子子子子", "戌子子戌"));
  check("位置 地盤支（一課・四課）＝戌", e.lessonLowerBranches.join() === "1,4" && e.lessonUppers.length === 0, JSON.stringify(e));
  const g = occ(board("子", "子子子子", "子子子子"));
  check("位置 どこにもない", !g.dayBranch && g.lessonUppers.length === 0 && g.lessonLowerBranches.length === 0 &&
    !g.dayStemUpper && !g.dayBranchUpper, JSON.stringify(g));
}

// ---- 5. 720課の監査 ----
const full: Record<string, number> = { 木: 0, 火: 0, 金: 0, 水: 0 };
const harmony: Record<string, number> = { 木: 0, 火: 0, 金: 0, 水: 0 };
const partial: Record<string, number> = { 木: 0, 火: 0, 金: 0, 水: 0 };
const where = { 日支: 0, 四課上神: 0, 四課地盤支: 0, 日干上神: 0, 日支上神: 0, どこにもない: 0 };
const examples: Record<string, string[]> = { 木: [], 火: [], 金: [], 水: [] };
let partialTotal = 0;
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const s: Stem = STEMS[i % 10];
    const b: Branch = BRANCHES[i % 12];
    const chart = calculateLiuren({ dayStem: s, dayBranch: b, divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const before = JSON.stringify(chart);
    const facts = buildInterpretationFacts(chart);
    const flow = analyzeTransmissionFlow(facts);
    if (flow.status === "determined" && flow.threeHarmony.complete) harmony[flow.threeHarmony.element] += 1;
    for (const p of fullOf(facts)) full[p.element] += 1;
    const ps = partialOf(facts);
    check(`${s}${b}+${o} 全局と欠一神は排他`, !(fullOf(facts).length > 0 && ps.length > 0));
    check(`${s}${b}+${o} 欠一神は1局まで`, ps.length <= 1, String(ps.length));
    for (const p of ps) {
      partialTotal += 1;
      partial[p.element] += 1;
      const m = p.missingBranchOccurrences;
      if (m.dayBranch) where.日支 += 1;
      if (m.lessonUppers.length) where.四課上神 += 1;
      if (m.lessonLowerBranches.length) where.四課地盤支 += 1;
      if (m.dayStemUpper) where.日干上神 += 1;
      if (m.dayBranchUpper) where.日支上神 += 1;
      if (!m.dayBranch && !m.lessonUppers.length && !m.lessonLowerBranches.length) where.どこにもない += 1;
      if (examples[p.element].length < 3) {
        const ts = facts.transmissions!.map((t) => t.branch).join("");
        const pos = [
          m.dayBranch && "日支",
          m.dayStemUpper && "日干上神",
          m.dayBranchUpper && "日支上神",
          m.lessonUppers.length && `四課上神(${m.lessonUppers.join("・")}課)`,
          m.lessonLowerBranches.length && `地盤支(${m.lessonLowerBranches.join("・")}課)`,
        ].filter(Boolean).join("・") || "なし";
        examples[p.element].push(`${s}${b}日 天盤差${o} | 三伝 ${ts} | 局の2支 ${p.presentBranches.join("")} | 欠 ${p.missingBranch} | 欠の位置 ${pos}`);
      }
    }
    check(`${s}${b}+${o} 起課結果不変`, JSON.stringify(chart) === before);
  }
}
check("全局4種＝Phase 3C の完全三合局（木38・火18・金34・水28）",
  JSON.stringify(full) === JSON.stringify(harmony) && JSON.stringify(full) === JSON.stringify({ 木: 38, 火: 18, 金: 34, 水: 28 }),
  `${JSON.stringify(full)} / ${JSON.stringify(harmony)}`);

console.log(`720課 全局課: 曲直${full.木} 炎上${full.火} 従革${full.金} 潤下${full.水}`);
console.log(`720課 欠一神: ${partialTotal}件 ${JSON.stringify(partial)}`);
console.log(`  欠けた支の位置（重複あり）: ${JSON.stringify(where)}`);
for (const [el, xs] of Object.entries(examples)) {
  console.log(`  ${el}局の例:`);
  for (const x of xs) console.log(`    ${x}`);
}
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
