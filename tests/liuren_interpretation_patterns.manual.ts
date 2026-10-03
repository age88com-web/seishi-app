// tests/liuren_interpretation_patterns.manual.ts
//
// 六壬神課 解釈エンジン Phase 3E・3E-2（古典共通パターン層Ⅰ: 元胎・関隔・稼穡・四絶・墓覆干頭）のテスト。
// 実行: npx tsx tests/liuren_interpretation_patterns.manual.ts
//
//   1. 元胎・関隔: 四孟・四仲の 4×4×4＝64 通りの三伝のうち、古典に列挙された配列だけで成立
//      稼穡: 三伝がすべて辰戌丑未なら成立（重複支も含む）。12×12×12 通りで、四季神以外が1つでも入れば不成立。
//            subtype は『六壬粹言』の順3配列＝cuiyanForward・逆2配列＝cuiyanReverse・それ以外＝general
//   2. 四絶: 十干 × 天盤差12 の実際の課で、乙卯臨申・丁午臨亥・己午臨亥・辛酉臨寅・癸子臨巳 だけで成立（陽干は不成立）
//   3. 墓覆干頭: 甲未・丙戌・戊戌・庚丑・壬辰（陰干・別の支では不成立）。720課で一課上神から直接求めた値と一致
//   4. 既存の三伝FLOW・三合・sanchuan.pattern と混ざらない
//   5. 720課の監査: 各パターンの件数、general 稼穡の配列別件数、四孟・四仲の3支だけで列挙外の三伝

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { analyzeTransmissionFlow } from "../src/lib/liuren/interpretation/flow";
import { detectClassicalPatterns } from "../src/lib/liuren/interpretation/patterns";
import type {
  ClassicalPattern, InterpretationFacts, LessonFact, TransmissionFact,
} from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const labelOf = (p: ClassicalPattern) =>
  p.kind === "jiaSe" ? `jiaSe:${p.subtype}` : "direction" in p ? `${p.kind}:${p.direction}` : p.kind;
const describe = (ps: readonly ClassicalPattern[]) => ps.map(labelOf).join(",") || "なし";

function chartFacts(stem: Stem, branch: Branch, offset: number): InterpretationFacts {
  return buildInterpretationFacts(calculateLiuren({ dayStem: stem, dayBranch: branch, divinationBranch: "子", monthGeneral: BRANCHES[offset] }));
}
/** 日干の六十干支のうち最初の日支 */
const firstBranchOf = (s: Stem): Branch => BRANCHES[STEMS.indexOf(s)];

// 三伝だけを差し替える土台。乙丑日・天盤差0（伏吟）は四絶・墓覆干頭が成り立たない課にする
const BASE = chartFacts("乙", "丑", 0);
function withTransmissions(b: string): InterpretationFacts {
  const t = [...b].map((x, i): TransmissionFact => ({ ...BASE.transmissions![i], branch: x as Branch }));
  return { ...BASE, transmissions: [t[0], t[1], t[2]] };
}
check("土台の課に四絶・墓覆干頭なし", detectClassicalPatterns(withTransmissions("子丑寅")).length === 0,
  describe(detectClassicalPatterns(withTransmissions("子丑寅"))));

// ---- 1. 三伝の配列 ----
const GROUPS: [string, string, Record<string, string>][] = [
  ["四孟", "寅巳申亥", {
    寅巳申: "yuanTai:forward", 巳申亥: "yuanTai:forward", 申亥寅: "yuanTai:forward", 亥寅巳: "yuanTai:forward",
    亥申巳: "yuanTai:reverse", 申巳寅: "yuanTai:reverse", 巳寅亥: "yuanTai:reverse", 寅亥申: "yuanTai:reverse",
  }],
  ["四仲", "子卯午酉", {
    子卯午: "guanGe:forward", 卯午酉: "guanGe:forward", 午酉子: "guanGe:forward", 酉子卯: "guanGe:forward",
    子酉午: "guanGe:reverse", 酉午卯: "guanGe:reverse", 午卯子: "guanGe:reverse", 卯子酉: "guanGe:reverse",
  }],
];
// 稼穡: 四季神だけの三伝は 64 通りすべて成立。subtype は『六壬粹言』の列挙配列だけ cuiyan
const CUIYAN: Record<string, string> = {
  辰未戌: "cuiyanForward", 未戌丑: "cuiyanForward", 戌丑辰: "cuiyanForward",
  丑戌未: "cuiyanReverse", 戌未辰: "cuiyanReverse",
};
const SIJI = "辰戌丑未";
for (const a of SIJI) for (const b of SIJI) for (const c of SIJI) {
  const key = a + b + c;
  const expected = `jiaSe:${CUIYAN[key] ?? "general"}`;
  const got = describe(detectClassicalPatterns(withTransmissions(key)));
  check(`稼穡 ${key}`, got === expected, `${got} / ${expected}`);
}
for (const key of ["辰丑戌", "未丑戌", "戌辰戌", "未丑未", "辰未丑", "辰辰辰", "丑丑丑", "未未未", "戌戌戌"]) {
  const got = describe(detectClassicalPatterns(withTransmissions(key)));
  check(`基本稼穡（general）${key}`, got === "jiaSe:general", got);
}
// 12×12×12: 四季神以外が1つでも入れば稼穡でない
for (const a of BRANCHES) for (const b of BRANCHES) for (const c of BRANCHES) {
  const key = a + b + c;
  const all = [...key].every((x) => SIJI.includes(x));
  const has = detectClassicalPatterns(withTransmissions(key)).some((p) => p.kind === "jiaSe");
  if (has !== all) check(`稼穡の成否 ${key}`, false, `${has} / ${all}`);
}
check("稼穡の成否 1728通り", true);
for (const [label, set, expected] of GROUPS) {
  for (const a of set) for (const b of set) for (const c of set) {
    const key = a + b + c;
    const got = describe(detectClassicalPatterns(withTransmissions(key)));
    check(`${label} ${key}`, got === (expected[key] ?? "なし"), `${got} / ${expected[key] ?? "なし"}`);
  }
}
{
  const fwd = detectClassicalPatterns(withTransmissions("寅巳申"))[0];
  const rev = detectClassicalPatterns(withTransmissions("亥申巳"))[0];
  check("順元胎＝生胎", fwd?.kind === "yuanTai" && fwd.classicalName === "生胎" && fwd.branches.initial === "寅");
  check("逆元胎＝病胎", rev?.kind === "yuanTai" && rev.classicalName === "病胎" && rev.branches.final === "巳");
}

// ---- 2. 四絶 ----
const SALARY: Record<Stem, Branch> = { 甲: "寅", 乙: "卯", 丙: "巳", 丁: "午", 戊: "巳", 己: "午", 庚: "申", 辛: "酉", 壬: "亥", 癸: "子" };
const FOUR_JUE: Partial<Record<Stem, Branch>> = { 乙: "申", 丁: "亥", 己: "亥", 辛: "寅", 癸: "巳" };
for (const s of STEMS) {
  for (let o = 0; o < 12; o++) {
    const f = chartFacts(s, firstBranchOf(s), o);
    // 天盤差 o では、天盤の禄支の下の地盤支＝禄支 − o
    const earth = BRANCHES[(BRANCHES.indexOf(SALARY[s]) - o + 12) % 12];
    const expected = FOUR_JUE[s] === earth;
    const got = detectClassicalPatterns(f).find((p) => p.kind === "fourJue");
    check(`四絶 ${s}日 天盤差${o}（${SALARY[s]}臨${earth}）＝${expected}`, !!got === expected &&
      (!got || (got.kind === "fourJue" && got.salaryBranch === SALARY[s] && got.earthBranch === earth &&
        got.salaryIsVoid === f.xun.voidBranches.includes(SALARY[s]))), JSON.stringify(got));
  }
}
check("己日 午臨亥＝四絶（Phase 3E-2）", detectClassicalPatterns(chartFacts("己", "巳", 7)).some((p) =>
  p.kind === "fourJue" && p.dayStem === "己" && p.salaryBranch === "午" && p.earthBranch === "亥"));
for (const s of ["甲", "丙", "戊", "庚", "壬"] as Stem[]) {
  const any = Array.from({ length: 12 }, (_, o) => chartFacts(s, firstBranchOf(s), o))
    .some((f) => detectClassicalPatterns(f).some((p) => p.kind === "fourJue"));
  check(`陽干 ${s} は四絶にならない（天盤差12通り）`, !any);
}

// ---- 3. 墓覆干頭 ----
const TOMB: Partial<Record<Stem, Branch>> = { 甲: "未", 丙: "戌", 戊: "戌", 庚: "丑", 壬: "辰" };
const withUpper = (s: Stem, upper: Branch): InterpretationFacts => {
  const base = chartFacts(s, firstBranchOf(s), 0);
  const l: LessonFact = { ...base.lessons[0], upper };
  return { ...base, lessons: [l, base.lessons[1], base.lessons[2], base.lessons[3]] };
};
for (const s of STEMS) {
  for (const b of BRANCHES) {
    const expected = TOMB[s] === b;
    const got = detectClassicalPatterns(withUpper(s, b)).find((p) => p.kind === "tombOverStem");
    check(`墓覆干頭 ${s}日 干上${b}＝${expected}`, !!got === expected &&
      (!got || (got.kind === "tombOverStem" && got.dayStem === s && got.upper === b && got.lessonIndex === 1)));
  }
}

// ---- 5. 720課の監査（＋4. 既存の構造と混ざらない） ----
const counts: Record<string, number> = {
  "yuanTai:forward": 0, "yuanTai:reverse": 0, "guanGe:forward": 0, "guanGe:reverse": 0,
  "jiaSe:cuiyanForward": 0, "jiaSe:cuiyanReverse": 0, "jiaSe:general": 0, fourJue: 0, tombOverStem: 0,
};
const general: Record<string, number> = {};
const unlisted: Record<string, Record<string, number>> = { 四孟: {}, 四仲: {} };
let withOtherMovement = 0;
let withHarmony = 0;
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const s = STEMS[i % 10];
    const b = BRANCHES[i % 12];
    const chart = calculateLiuren({ dayStem: s, dayBranch: b, divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const before = JSON.stringify(chart);
    const facts = buildInterpretationFacts(chart);
    const ps = detectClassicalPatterns(facts);
    for (const p of ps) counts[labelOf(p)] += 1;
    for (const p of ps) {
      if (p.kind === "jiaSe" && p.subtype === "general") {
        const k = `${p.branches.initial}${p.branches.middle}${p.branches.final}`;
        general[k] = (general[k] ?? 0) + 1;
      }
    }

    // 墓覆干頭は一課上神から直接求めた値と一致
    const tombExpected = TOMB[s] === chart.lessons[0].upper;
    check(`${s}${b}+${o} 墓覆干頭`, ps.some((p) => p.kind === "tombOverStem") === tombExpected);

    const ts = facts.transmissions!;
    const key = ts.map((t) => t.branch).join("");
    for (const [label, set, expected] of GROUPS) {
      if ([...key].every((x) => set.includes(x)) && !expected[key]) {
        unlisted[label][key] = (unlisted[label][key] ?? 0) + 1;
      }
    }
    const flow = analyzeTransmissionFlow(facts);
    if (flow.status === "determined" && ps.some((p) => p.kind === "yuanTai" || p.kind === "guanGe" || p.kind === "jiaSe")) {
      if (flow.movementPattern !== "その他") withOtherMovement += 1;
      if (flow.threeHarmony.complete) withHarmony += 1;
    }
    check(`${s}${b}+${o} 起課結果不変（sanchuan.pattern を含む）`, JSON.stringify(chart) === before);
  }
}
// 元胎・関隔・稼穡の配列は三合局（3支とも同じ五行局）にならない
check("元胎・関隔・稼穡は完全三合局と重ならない", withHarmony === 0, String(withHarmony));

const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const jiaSeTotal = counts["jiaSe:cuiyanForward"] + counts["jiaSe:cuiyanReverse"] + counts["jiaSe:general"];
check("general 稼穡の配列別件数の合計", total(general) === counts["jiaSe:general"]);
console.log(`720課 パターン件数: ${JSON.stringify(counts)}`);
console.log(`  稼穡総数: ${jiaSeTotal}`);
console.log(`  general 稼穡の配列別: ${JSON.stringify(Object.fromEntries(Object.entries(general).sort((a, b) => b[1] - a[1])))}`);
console.log(`  元胎・関隔・稼穡のうち進退（進茹〜退間）とも成り立つもの: ${withOtherMovement}`);
for (const [label, m] of Object.entries(unlisted)) {
  console.log(`  ${label}の3支だけで列挙外の三伝: ${total(m)}件 ${JSON.stringify(m)}`);
}
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
