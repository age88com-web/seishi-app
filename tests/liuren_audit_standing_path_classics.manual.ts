// tests/liuren_audit_standing_path_classics.manual.ts
//
// 六壬神課 Phase 3Q: 干上と三伝の比較構造（Phase 3P）の古典横断監査（監査専用。本番コードは変更しない）。
// 実行: npx tsx tests/liuren_audit_standing_path_classics.manual.ts
//
//   各古典例を既存の起課エンジンで再現し、standingPathComparisonOf()（Phase 3P）の FACT だけを出力する。
//   FACT（アプリが算出したもの）と CLASSICAL（古典がそれをどう評価したか）を分けて記録する。
//   古典の出典:
//     ユーザー提示の古典記述（辛巳・丁亥・三伝皆空・癸丑・甲午長生無気）
//     『六壬断案２』（docs/source/六壬断案２.docx。邵先生の判断と訳者註）例34・43・46・48・54・56
//     『六壬神課講座』p66「空亡について」（問う内容による評価の逆転・浮天空亡・落底空亡）
//   月令は、原文に月がある場合だけ旧暦月を月建に読み替える（正月＝寅 … 十二月＝丑）。原文に月がない例は補わない。
//   720課に吉凶・宜進・宜退・宜守は付けない。

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { detectClassicalPatterns } from "../src/lib/liuren/interpretation/patterns";
import { standingPathComparisonOf } from "../src/lib/liuren/interpretation/standingPathComparison";
import type {
  ComparisonPosition, DayStemStandingState, StandingPathComparison, TransmissionDayStemState, TransmissionToDayStemRelation,
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
const LABEL: Record<ComparisonPosition, string> = { standing: "干上", initial: "初伝", middle: "中伝", final: "末伝" };
const yes = (b: boolean) => (b ? "○" : "－");
/** 旧暦の月（原文）→ 月建 */
const MONTH_BRANCH: Record<number, Branch> = { 1: "寅", 2: "卯", 3: "辰", 4: "巳", 5: "午", 6: "未", 7: "申", 8: "酉", 9: "戌", 10: "亥", 11: "子", 12: "丑" };
/** Phase 3O の候補（監査でだけ使う組合せ。本番の FACT にはしない）: 干上が日禄か帝旺で、旬空・坐空でない */
const standingSolid = (s: DayStemStandingState) => (s.isDaySalary || s.growthStage === "帝旺") && !s.isVoid && !s.isSeatedOnVoid;

type Case = {
  id: string;
  theme: string;
  day: string;
  /** 天盤差で指定（divinationBranch 子・monthGeneral＝天盤差）。月将・占時が原文にある場合は jiang・shi */
  offset?: number;
  jiang?: Branch;
  shi?: Branch;
  /** 原文の旧暦月（ある場合だけ） */
  lunarMonth?: number;
  expect: { upper: Branch; ts: string };
  classical: string[];
  checks?: (x: StandingPathComparison) => [boolean, string][];
};

const CASES: Case[] = [
  {
    id: "S1", theme: "日禄空亡", day: "辛巳", offset: 11, expect: { upper: "酉", ts: "卯寅丑" },
    classical: ["（ユーザー提示）日禄空亡、改行別做 ― 禄が空亡なので、その禄を守らず別の経路へ転じる"],
    checks: (x) => [
      [x.standing.isDaySalary, "干上酉＝日禄"],
      [x.standing.isVoid, "干上酉＝旬空（甲戌旬の空亡は申酉）"],
    ],
  },
  {
    id: "S2", theme: "四絶（禄と加臨の分離）", day: "丁亥", offset: 7, expect: { upper: "寅", ts: "午丑申" },
    classical: ["（ユーザー提示）初伝午＝日禄だが、絶・空亡なら禄として有効としない（四絶「丁己禄午加亥」）"],
    checks: (x) => [
      [x.path.initial.isDaySalary, "初伝午＝日禄"],
      [x.path.initial.isVoid, "初伝午＝旬空（甲申旬の空亡は午未）"],
      [x.path.initial.growthStage === "帝旺", "初伝午の十二長生は帝旺（午そのものは絶ではない）"],
    ],
  },
  {
    id: "S3a", theme: "三伝皆空", day: "壬子", offset: 1, expect: { upper: "子", ts: "寅卯辰" },
    classical: [
      "（ユーザー提示）進茹空亡宜退步・三伝皆空",
      "（講座 p66）三伝が全部空亡なら全く得るものがなく目的も達成しない。ただし悪いこと・心配事もなくなる場合もある",
    ],
  },
  {
    id: "S3b", theme: "三伝皆空", day: "甲午", offset: 1, expect: { upper: "卯", ts: "辰巳午" },
    classical: ["（ユーザー提示）三伝皆空・進茹だが退歩を宜とする", "（講座 p66）同上（問う内容により評価が変わる）"],
  },
  {
    id: "S4", theme: "空亡＋脱気", day: "癸丑", offset: 1, expect: { upper: "寅", ts: "寅卯辰" },
    classical: ["（ユーザー提示）干上寅は空亡かつ脱気（癸水が寅木を生ず）。空亡と脱は別の材料"],
    checks: (x) => [
      [x.standing.relationToDayStem === "dayStemGeneratesTransmission", "干上寅＝干生（脱）"],
      [x.standing.isVoid, "干上寅＝旬空（甲辰旬の空亡は寅卯）"],
    ],
  },
  {
    id: "S5", theme: "長生無気・官鬼", day: "甲午", offset: 9, expect: { upper: "亥", ts: "申巳寅" },
    classical: [
      "（ユーザー提示）干上亥＝長生でも、季節によって無気になる。月の条件は提示文から確定できないため補わない",
      "（ユーザー提示）官鬼であっても長生の源として働けば単純に忌まない",
    ],
    checks: (x) => [
      [x.standing.growthStage === "長生", "干上亥＝長生"],
      [x.standing.seasonalStrength === null, "月支を補っていないので旺相休囚死は null（十二長生とは別の軸）"],
      [x.path.initial.sixRelation === "官鬼" && x.path.initial.relationToDayStem === "transmissionOvercomesDayStem", "初伝申＝官鬼（剋干）"],
    ],
  },
  {
    id: "D34", theme: "長生空亡・進退の比較", day: "丙午", jiang: "卯", shi: "申", expect: { upper: "子", ts: "子未寅" },
    classical: [
      "（断案2 例34 邵先生）寅は空亡で、引進できず、生をみて生とはいえず、かえって凶咎となる。…甲辰旬で寅を見るのは、進めば空亡、退けば子の剋",
      "（訳者註）寅は長生、六合は吉将ですが、空亡で丙を生ずる力がありません",
    ],
    checks: (x) => [
      [x.path.final.growthStage === "長生" && x.path.final.isVoid, "末伝寅＝長生・旬空"],
      [x.standing.sixRelation === "官鬼", "干上子＝官鬼（子が丙を剋す）"],
    ],
  },
  {
    id: "D43", theme: "日禄扶身（退連茹）", day: "丁丑", jiang: "午", shi: "未", lunarMonth: 6, expect: { upper: "午", ts: "子亥戌" },
    classical: [
      "（断案2 例43 邵先生）人がこの課をみれば、まさに退連茹とするが…午は丁の建禄で干上に臨み、日禄扶身…科挙に高位で合格すること疑いなし（占前程）",
    ],
    checks: (x) => [
      [x.movementPattern === "退茹", "退茹"],
      [x.standing.isDaySalary && !x.standing.isVoid && !x.standing.isSeatedOnVoid, "干上午＝日禄・空亡なし"],
    ],
  },
  {
    id: "D46", theme: "末伝坐空", day: "戊辰", jiang: "未", shi: "巳", lunarMonth: 6, expect: { upper: "未", ts: "申戌子" },
    classical: [
      "（断案2 例46 邵先生）三淵を渉るとは…一伝は遠くまた一伝で、空亡に入る。…末伝は妻爻で空亡に坐し…（占前程）",
    ],
    checks: (x) => [
      [x.path.final.isSeatedOnVoid && !x.path.final.isVoid, "末伝子＝坐空（『空亡に坐し』）・旬空ではない"],
      [x.path.middle.isVoid, "中伝戌＝旬空（『空亡に入る』）"],
      [x.path.final.sixRelation === "妻財", "末伝子＝妻財（『妻爻』）"],
    ],
  },
  {
    id: "D48", theme: "干上空亡・落空・盗気", day: "庚戌", jiang: "亥", shi: "辰", lunarMonth: 2, expect: { upper: "卯", ts: "戌巳子" },
    classical: [
      "（断案2 例48 邵先生）庚の上は卯で空亡であり、これは朽木が彫るに堪えないということで、虚名である。戌は模範とするが落空であり…末伝は盗気",
      "（訳者註）初伝は戌土六合で庚金を生じていますので凶というほどではなく…",
    ],
    checks: (x) => [
      [x.standing.isVoid, "干上卯＝旬空"],
      [x.path.initial.isSeatedOnVoid && x.path.initial.relationToDayStem === "transmissionGeneratesDayStem", "初伝戌＝坐空（『落空』）・生干"],
      [x.path.final.relationToDayStem === "dayStemGeneratesTransmission", "末伝子＝干生（『盗気』）"],
    ],
  },
  {
    id: "D54", theme: "虚禄・官鬼長生", day: "庚辰", jiang: "子", shi: "子", lunarMonth: 12, expect: { upper: "申", ts: "申寅巳" },
    classical: [
      "（断案2 例54 邵先生）将仕の禄は虚禄である。…庚禄は申で、禄は空…末伝巳は朱雀となり長生で、官星学堂、故に科甲である。日干天地盤みな空禄（占武試）",
      "（訳者註）巳は官鬼ですが、年命でありさらに日干の長生で学堂でもあります。…初伝空亡なので、結局武試は受けられないか受けても通らない",
    ],
    checks: (x) => [
      [x.standing.isDaySalary && x.standing.isVoid && x.standing.isSeatedOnVoid, "干上申＝日禄・旬空・坐空（『日干天地盤みな空禄』）"],
      [x.path.final.sixRelation === "官鬼" && x.path.final.growthStage === "長生", "末伝巳＝官鬼・長生"],
    ],
  },
  {
    id: "D56", theme: "伏吟・干上禄", day: "壬午", jiang: "寅", shi: "寅", lunarMonth: 10, expect: { upper: "亥", ts: "亥午子" },
    classical: [
      "（断案2 例56 邵先生）日干が禄をいただき太常を兼ねている。必ず兼職がある。また俸禄は増える。若し昇進や転職ならばまだである（占前程）",
      "（訳者註）伏吟というのは目下は動きがなく、時が替わるのを待つしかない",
    ],
    checks: (x) => [
      [x.standing.isDaySalary && !x.standing.isVoid && !x.standing.isSeatedOnVoid, "干上亥＝日禄・空亡なし"],
    ],
  },
];

const lines: string[] = [];
const solidRows: string[] = [];
for (const c of CASES) {
  const s = c.day[0] as Stem;
  const b = c.day[1] as Branch;
  const chart = c.jiang && c.shi
    ? calculateLiuren({ dayStem: s, dayBranch: b, divinationBranch: c.shi, monthGeneral: c.jiang })
    : calculateLiuren({ dayStem: s, dayBranch: b, divinationBranch: "子", monthGeneral: BRANCHES[c.offset!] });
  const facts = buildInterpretationFacts(chart);
  const month = c.lunarMonth ? MONTH_BRANCH[c.lunarMonth] : null;
  const x = standingPathComparisonOf(facts, month)!;
  const ts = [x.path.initial, x.path.middle, x.path.final].map((t) => t.branch).join("");
  check(`${c.id} ${c.day} 再現（干上${c.expect.upper} 三伝${c.expect.ts}）`, x.standing.branch === c.expect.upper && ts === c.expect.ts, `干上${x.standing.branch} 三伝${ts}`);
  const stages: [ComparisonPosition, DayStemStandingState | TransmissionDayStemState][] =
    [["standing", x.standing], ["initial", x.path.initial], ["middle", x.path.middle], ["final", x.path.final]];
  const head = c.jiang ? `${c.jiang}将${c.shi}時（天盤差${chart.plate.offset}）` : `天盤差${c.offset}`;
  lines.push(`${c.id}【${c.theme}】${c.day}日 ${head} 干上${x.standing.branch} 三伝${ts}（${chart.sanchuan.method}・${x.movementPattern}） 旬空${chart.xun.voidBranches.join("")}` +
    (month ? ` 月建${month}（原文 ${c.lunarMonth}月）` : " 月建なし"));
  lines.push("    FACT:");
  for (const [p, t] of stages) {
    const extra = "isXunDing" in t ? ` 丁${yes(t.isXunDing)} 馬${yes(t.isYima)}` : "";
    lines.push(`      ${LABEL[p]} ${t.branch}（加 地盤${chart.plate.earthUnder[t.branch]}）: ${SHORT[t.relationToDayStem]}・${t.sixRelation}・${t.growthStage}・旺衰${t.seasonalStrength ?? "－"} 禄${yes(t.isDaySalary)} 徳${yes(t.isDayVirtue)}${extra} 旬空${yes(t.isVoid)} 坐空${yes(t.isSeatedOnVoid)}`);
  }
  const four = detectClassicalPatterns(facts).filter((p) => p.kind === "fourJue");
  if (four.length) lines.push(`      PATTERN 四絶: ${four.map((p) => (p.kind === "fourJue" ? `${p.salaryBranch}加${p.earthBranch}（禄の旬空${yes(p.salaryIsVoid)}）` : "")).join(" ")}`);
  lines.push("    CLASSICAL:");
  for (const cl of c.classical) lines.push(`      ${cl}`);
  for (const [ok, label] of c.checks?.(x) ?? []) {
    check(`${c.id} ${label}`, ok);
    lines.push(`      ${ok ? "○" : "×"} ${label}`);
  }
  solidRows.push(`${c.id} ${c.day}: 干上 禄${yes(x.standing.isDaySalary)} 帝旺${yes(x.standing.growthStage === "帝旺")} 旬空${yes(x.standing.isVoid)} 坐空${yes(x.standing.isSeatedOnVoid)} → 候補「実の旺禄」${yes(standingSolid(x.standing))} ／ ${x.movementPattern}`);
}
// 丁亥日の四絶（午加亥）を PATTERN 層が検出していること
{
  const f = buildInterpretationFacts(calculateLiuren({ dayStem: "丁", dayBranch: "亥", divinationBranch: "子", monthGeneral: BRANCHES[7] }));
  const four = detectClassicalPatterns(f).find((p) => p.kind === "fourJue");
  check("S2 丁亥 四絶 午加亥（日禄と加臨の地盤を分離）", four?.kind === "fourJue" && four.salaryBranch === "午" && four.earthBranch === "亥" && four.salaryIsVoid);
}
// 甲午日 干上亥（長生）の旺相休囚死は月支で変わる（参考。古典の月条件は補わない）
const reference: string[] = [];
{
  const f = buildInterpretationFacts(calculateLiuren({ dayStem: "甲", dayBranch: "午", divinationBranch: "子", monthGeneral: BRANCHES[9] }));
  reference.push(BRANCHES.map((m) => `${m}月${standingPathComparisonOf(f, m)!.standing.seasonalStrength}`).join(" "));
  check("S5 長生（十二長生）は月支で変わらない", BRANCHES.every((m) => standingPathComparisonOf(f, m)!.standing.growthStage === "長生"));
}


// ==== Phase 3O の優先順位モデルを、三伝皆空の2例（S3a・S3b）に当てはめる ====
// 結果の種類・モデルは監査でだけ定義する（本番の型にはしない）。Phase 3O の5例の許される結果も並べる。
type Outcome = "advance" | "retreat" | "stay";
const VOIDS: Record<string, (x: StandingPathComparison) => boolean> = {
  "末伝旬空": (x) => x.path.final.isVoid,
  "末伝坐空": (x) => x.path.final.isSeatedOnVoid,
  "三伝内旬空": (x) => [x.path.initial, x.path.middle, x.path.final].some((t) => t.isVoid),
  "三伝内坐空": (x) => [x.path.initial, x.path.middle, x.path.final].some((t) => t.isSeatedOnVoid),
};
const baseOf = (x: StandingPathComparison): Outcome => (x.movementDirection === "advancing" ? "advance" : x.movementDirection === "retreating" ? "retreat" : "stay");
const flip = (o: Outcome): Outcome => (o === "advance" ? "retreat" : o === "retreat" ? "advance" : o);
const modelA = (x: StandingPathComparison, v: (x: StandingPathComparison) => boolean): Outcome => {
  let o = baseOf(x);
  if (o !== "stay" && v(x)) o = flip(o);
  return standingSolid(x.standing) ? "stay" : o;
};
const modelB = (x: StandingPathComparison, v: (x: StandingPathComparison) => boolean): Outcome => {
  let o = baseOf(x);
  if (standingSolid(x.standing)) o = "stay";
  if (x.movementDirection !== "neutral" && v(x)) o = flip(baseOf(x));
  return o;
};
const ALL_CASES: [string, string, number, Outcome[]][] = [
  ["A 己卯（宜進）", "己卯", 1, ["advance"]],
  ["B 壬午（不宜進）", "壬午", 1, ["retreat", "stay"]],
  ["C 癸亥（宜退）", "癸亥", 11, ["retreat"]],
  ["D 乙卯（不宜退）", "乙卯", 11, ["advance", "stay"]],
  ["E 丁巳（進取／守）", "丁巳", 11, ["advance", "stay"]],
  ["S3a 壬子（宜退步）", "壬子", 1, ["retreat"]],
  ["S3b 甲午（退歩を宜）", "甲午", 1, ["retreat"]],
];
const modelLines: string[] = [];
const survivors: string[] = [];
for (const [mName, model] of [["Model A movement→void→standing", modelA], ["Model B movement→standing→void", modelB]] as const) {
  for (const [vName, v] of Object.entries(VOIDS)) {
    const row = ALL_CASES.map(([label, day, offset, allowed]) => {
      const x = standingPathComparisonOf(buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[offset] })))!;
      const o = model(x, v);
      return { label, ok: allowed.includes(o), o };
    });
    modelLines.push(`${mName} ／ 行き先の空亡＝${vName}: ${row.map((r) => `${r.label.split(" ")[0]}:${r.o}${r.ok ? "○" : "×"}`).join(" ")}`);
    if (row.every((r) => r.ok)) survivors.push(`${mName}（${vName}）`);
  }
}
{
  const x = standingPathComparisonOf(buildInterpretationFacts(calculateLiuren({ dayStem: "壬", dayBranch: "子", divinationBranch: "子", monthGeneral: BRANCHES[1] })))!;
  check("S3a 壬子 干上子は帝旺・空亡なし（候補「実の旺禄」に当たる）", standingSolid(x.standing));
  check("S3a は Model A（干上が最後に上書き）では守になり、古典の宜退步と合わない", modelA(x, VOIDS.三伝内旬空) === "stay");
}
console.log("古典例（FACT と CLASSICAL を分けて記録）:");
for (const l of lines) console.log(`  ${l}`);
console.log(`参考 S5 甲午日 干上亥（長生）の旺相休囚死（月支12通り。古典の月条件ではない）: ${reference[0]}`);
console.log("Phase 3O 候補「干上が実の旺禄なら守る」の確認:");
for (const r of solidRows) console.log(`  ${r}`);
console.log("Phase 3O の優先順位モデルを 7例（Phase 3O の5例＋三伝皆空2例）に当てはめた結果:");
for (const l of modelLines) console.log(`  ${l}`);
console.log(`7例すべてと合うモデル: ${survivors.join(" / ") || "なし"}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
