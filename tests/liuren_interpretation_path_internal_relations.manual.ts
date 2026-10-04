// tests/liuren_interpretation_path_internal_relations.manual.ts
//
// 六壬神課 解釈エンジン Phase 3R（干上・三伝の地点どうしの関係 FACT）のテスト。
// 実行: npx tsx tests/liuren_interpretation_path_internal_relations.manual.ts
//
//   1. S5 甲午日・天盤差9（干上亥・三伝 申→巳→寅）で、干上亥と初伝申の関係が
//      「申（金）が亥（水）を生ずる」構造として取れること（順方向の干上→初伝＝generatedBy。逆向きは保存しない）
//   2. 古典例（A 己卯・B 壬午・C 癸亥・D 乙卯・丁巳・D34・D54）の6関係
//   3. 720課で、各関係が relationBetween と一致し、隣接3組が6組の同じオブジェクトで、逆向きを保存していないこと
//   4. 720課の監査（三伝の遞生・逆遞生・連剋・逆連剋・同気連続、並びの種類、movementPattern とのクロス）
//   古典の評価（「官鬼が長生の源として働く」等）は本番 FACT に入れない。生＝吉・剋＝凶 にしない。

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { relationBetween } from "../src/lib/liuren/interpretation/relations";
import { analyzeTransmissionFlow } from "../src/lib/liuren/interpretation/flow";
import { elementRelationOf, standingPathComparisonOf } from "../src/lib/liuren/interpretation/standingPathComparison";
import type { ComparisonPosition, ElementRelation, StandingPathComparison } from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

const LABEL: Record<ComparisonPosition, string> = { standing: "干上", initial: "初", middle: "中", final: "末" };
const REL: Record<ElementRelation, string> = {
  generates: "生ずる", sameElement: "同気", generatedBy: "生じられる", overcomes: "剋す", overcomeBy: "剋される",
};
const ELEMENT: Record<string, string> = { 子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火", 午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水" };
const compOf = (day: string, offset: number | null, jiang?: Branch, shi?: Branch): StandingPathComparison => standingPathComparisonOf(buildInterpretationFacts(
  jiang && shi
    ? calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang })
    : calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[offset!] }),
))!;
const relOf = (x: StandingPathComparison, f: ComparisonPosition, t: ComparisonPosition) =>
  x.internalRelations.all.find((r) => r.fromPosition === f && r.toPosition === t)!;
const describe = (x: StandingPathComparison) => x.internalRelations.all.map((r) =>
  `${LABEL[r.fromPosition]}${r.fromBranch}(${ELEMENT[r.fromBranch]})→${LABEL[r.toPosition]}${r.toBranch}(${ELEMENT[r.toBranch]}) ${REL[r.relation]}`).join(" ／ ");

// ---- 1. S5 甲午 ----
const lines: string[] = [];
{
  const x = compOf("甲午", 9);
  const r = relOf(x, "standing", "initial");
  check("S5 甲午 干上亥・三伝申巳寅", x.standing.branch === "亥" && [x.path.initial, x.path.middle, x.path.final].map((t) => t.branch).join("") === "申巳寅");
  // 干上亥 → 初伝申 は「生じられる」＝ 申（金）が亥（水）を生ずる
  check("S5 干上亥→初伝申＝generatedBy（申の金が亥の水を生ずる）", r.relation === "generatedBy" && r.fromBranch === "亥" && r.toBranch === "申");
  check("S5 逆向き（初伝申→干上亥）は relationBetween で generates として取れる（保存はしない）",
    elementRelationOf(relationBetween("申", "亥")) === "generates" && !x.internalRelations.all.some((y) => y.fromPosition === "initial" && (y.toPosition as string) === "standing"));
  check("S5 初伝申＝官鬼、干上亥＝長生（日干との関係とは別に、地点どうしの関係を持つ）",
    x.path.initial.sixRelation === "官鬼" && x.standing.growthStage === "長生");
  lines.push(`S5 甲午 天盤差9: ${describe(x)}`);
}

// ---- 2. 古典例 ----
const EXAMPLES: [string, string, number | null, Branch?, Branch?][] = [
  ["A 己卯", "己卯", 1], ["B 壬午", "壬午", 1], ["C 癸亥", "癸亥", 11], ["D 乙卯", "乙卯", 11], ["丁巳", "丁巳", 11],
  ["D34 丙午", "丙午", null, "卯", "申"], ["D54 庚辰", "庚辰", null, "子", "子"],
];
for (const [name, day, offset, jiang, shi] of EXAMPLES) {
  const x = compOf(day, offset, jiang, shi);
  lines.push(`${name}: ${describe(x)}`);
}
{
  const a = compOf("己卯", 1);
  check("A 中伝巳→末伝午＝同気（火）", relOf(a, "middle", "final").relation === "sameElement");
  const b = compOf("壬午", 1);
  // 日干との関係（剋干→干生→干生）とは別に、経路内の生剋（丑→寅＝剋される、寅→卯＝同気）を持つ
  check("B 経路内の関係は日干との関係と別（丑→寅＝剋される・寅→卯＝同気）",
    relOf(b, "initial", "middle").relation === "overcomeBy" && relOf(b, "middle", "final").relation === "sameElement" &&
    b.path.initial.relationToDayStem === "transmissionOvercomesDayStem");
  const d34 = compOf("丙午", null, "卯", "申");
  check("D34 末伝寅は日干を生じ（生干）、同時に旬空（両方を別の FACT として持つ）",
    d34.path.final.relationToDayStem === "transmissionGeneratesDayStem" && d34.path.final.isVoid);
  const d54 = compOf("庚辰", null, "子", "子");
  check("D54 末伝巳＝官鬼・長生、中伝寅→末伝巳＝生ずる（木生火）",
    d54.path.final.sixRelation === "官鬼" && d54.path.final.growthStage === "長生" && relOf(d54, "middle", "final").relation === "generates");
  lines.push(`D34 末伝寅: 日干との関係 生干・旬空${d34.path.final.isVoid ? "○" : "－"}（内部の関係と空亡は別の FACT）`);
  lines.push(`D54 末伝巳: ${d54.path.final.sixRelation}・${d54.path.final.growthStage}`);
}

// ---- 3・4. 720課 ----
const CHAINS: [string, ElementRelation][] = [
  ["三伝遞生（初→中・中→末とも生ずる）", "generates"],
  ["逆遞生（初→中・中→末とも生じられる）", "generatedBy"],
  ["三伝連剋（初→中・中→末とも剋す）", "overcomes"],
  ["逆連剋（初→中・中→末とも剋される）", "overcomeBy"],
  ["同気連続（初→中・中→末とも同気）", "sameElement"],
];
const MOVES = ["進茹", "退茹", "進間", "退間", "その他"];
const chainCount: Record<string, number> = Object.fromEntries(CHAINS.map(([k]) => [k, 0]));
const cross: Record<string, Record<string, number>> = Object.fromEntries(MOVES.map((m) => [m, Object.fromEntries(CHAINS.map(([k]) => [k, 0]))]));
const seq2: Record<string, number> = {};
const seq3: Record<string, number> = {};
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };
const ORDER: [ComparisonPosition, ComparisonPosition][] = [
  ["standing", "initial"], ["standing", "middle"], ["standing", "final"], ["initial", "middle"], ["initial", "final"], ["middle", "final"],
];
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const tag = `${STEMS[i % 10]}${BRANCHES[i % 12]}+${o}`;
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const before = JSON.stringify(chart);
    const x = standingPathComparisonOf(buildInterpretationFacts(chart))!;
    const branchAt: Record<ComparisonPosition, Branch> = {
      standing: x.standing.branch, initial: x.path.initial.branch, middle: x.path.middle.branch, final: x.path.final.branch,
    };
    const all = x.internalRelations.all;
    const ok = all.length === 6 && all.every((r, k) => r.fromPosition === ORDER[k][0] && r.toPosition === ORDER[k][1] &&
      r.fromBranch === branchAt[r.fromPosition] && r.toBranch === branchAt[r.toPosition] &&
      JSON.stringify(r.structural) === JSON.stringify(relationBetween(r.fromBranch, r.toBranch)) &&
      r.relation === elementRelationOf(r.structural)) &&
      x.internalRelations.adjacent[0] === all[0] && x.internalRelations.adjacent[1] === all[3] && x.internalRelations.adjacent[2] === all[5];
    if (!ok) check(`${tag} 地点どうしの関係`, false);
    check(`${tag} 起課結果不変`, JSON.stringify(chart) === before);

    const [, im, mf] = x.internalRelations.adjacent;
    // Phase 3B の FLOW（三伝内の生・剋の連続）と同じ結果になる
    const flow = analyzeTransmissionFlow(buildInterpretationFacts(chart));
    if (flow.status === "determined" &&
      ((im.relation === "generates" && mf.relation === "generates") !== flow.generationFlow.amongTransmissions ||
       (im.relation === "overcomes" && mf.relation === "overcomes") !== flow.overcomingFlow.amongTransmissions)) {
      check(`${tag} Phase 3B FLOW と一致`, false);
    }
    for (const [k, rel] of CHAINS) {
      if (im.relation === rel && mf.relation === rel) {
        chainCount[k] += 1;
        cross[x.movementPattern][k] += 1;
      }
    }
    inc(seq2, `${REL[im.relation]}→${REL[mf.relation]}`);
    inc(seq3, x.internalRelations.adjacent.map((r) => REL[r.relation]).join("→"));
  }
}
const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
check("三伝2区間の並びの合計＝720", total(seq2) === 720);

console.log("古典例の6関係（順方向のみ）:");
for (const l of lines) console.log(`  ${l}`);
console.log("720課 三伝の連続（初→中・中→末）:");
for (const [k] of CHAINS) console.log(`  ${k}: ${chainCount[k]}`);
console.log(`720課 初→中・中→末 の並び（${Object.keys(seq2).length}種）:`);
for (const [k, v] of Object.entries(seq2).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
console.log(`720課 干上→初・初→中・中→末 の並び（${Object.keys(seq3).length}種）上位20:`);
for (const [k, v] of Object.entries(seq3).sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${k}: ${v}`);
console.log("movementPattern とのクロス:");
for (const m of MOVES) console.log(`  ${m}: ${CHAINS.map(([k]) => `${k.split("（")[0]} ${cross[m][k]}`).join(" / ")}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
