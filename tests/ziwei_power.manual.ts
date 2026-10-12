// tests/ziwei_power.manual.ts
//
// 星の力量・宮の運命指数（src/lib/ziwei/power.ts）と、力量の条件付きの文の判定（meanings/powerCondition.ts）の確認。
// 実行: npx tsx tests/ziwei_power.manual.ts
// 正本: docs/ziwei-basic-spec.md §22、fixture: docs/ziwei-fixtures-candidate.json powerFixtures
//
// 確認すること:
//   - 表13の全372セル（入門・基礎編を別々に転記した fixture と、power.ts の2表・採用表）。表の空欄と旺衰表の空欄の一致
//   - 旺衰との対応（参考表示のみ。力量の計算は旺衰を使わない）
//   - 命盤A（入門 p.16）の星の印刷値・宮の合計・運命指数・段階、命盤B（基礎編 S19）の星の印刷値・宮の運命指数
//     （needs_review の値は正解にせず、差を記録する）
//   - 段階の境界、全盤面で空欄に当たらない・式どおり
//   - 条件付きの文: 表の登録・引用の一致・成立／不成立／判定不能・文脈（前文）の整合・後続文だけを出さない

import fs from "node:fs";
import {
  calculateChartPower,
  calculateZiweiChart,
  POWER_STARS,
  POWER_TABLE,
  POWER_TABLE_KISO,
  POWER_TABLE_NYUMON,
  powerGradeOf,
  starPowerOf,
  starStrengthOf,
  STAR_STRENGTH,
} from "../src/lib/ziwei";
import type { Branch, PlacedStar, PowerStar, ZiweiChart, ZiweiInput } from "../src/lib/ziwei";
import {
  buildAiMeaningContext,
  buildPalaceMeaningContext,
  CONDITION_SPECS,
  evaluatePowerCondition,
  specFor,
  STAR_MEANINGS,
  TRANSFORMATION_MEANINGS,
} from "../src/lib/ziwei/meanings";
import type { AiDetailLevel, PowerSnapshot } from "../src/lib/ziwei/meanings";
import { buildRuleBasedInterpretation } from "../src/lib/ziwei/meanings/ruleInterpretation";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}
const report: string[] = [];

const BRANCHES = "子丑寅卯辰巳午未申酉戌亥".split("") as Branch[];
const LEVELS: AiDetailLevel[] = ["brief", "standard", "detailed"];
const FX = JSON.parse(fs.readFileSync("docs/ziwei-fixtures-candidate.json", "utf8")).powerFixtures;
const ENTRY = new Map([...STAR_MEANINGS, ...TRANSFORMATION_MEANINGS].map((e) => [e.id, e]));

// ---------------------------------------------------------------------------
// 1. 表13の全セル
// ---------------------------------------------------------------------------
type Cell = [string, Branch, number | null];
const nyumonCells: Cell[] = FX.tableNyumon.cells;
const kisoCells: Cell[] = FX.tableKiso.cells;
check("表: 入門 fixture 372セル", nyumonCells.length === 372);
check("表: 基礎編 fixture 372セル", kisoCells.length === 372);
check("表: 31行", POWER_STARS.length === 31);
let tableDiff = 0;
for (const [i, [star, b, v]] of nyumonCells.entries()) {
  const bi = BRANCHES.indexOf(b);
  const k = kisoCells[i];
  check(`表 ${star}・${b} 入門=基礎編（fixture）`, k[0] === star && k[1] === b && k[2] === v);
  if (k[2] !== v) tableDiff += 1;
  check(`表 ${star}・${b} power.ts 入門`, POWER_TABLE_NYUMON[star as PowerStar][bi] === v);
  check(`表 ${star}・${b} power.ts 基礎編`, POWER_TABLE_KISO[star as PowerStar][bi] === k[2]);
  check(`表 ${star}・${b} 採用表`, POWER_TABLE[star as PowerStar][bi] === v && starPowerOf(star as PowerStar, b) === v);
}
report.push(`表13: 372セル（入門・基礎編の差 ${tableDiff}）・空欄 ${nyumonCells.filter((c) => c[2] === null).length}`);
for (const s of ["天馬星", "天姚星", "紅鸞星"] as PlacedStar[]) {
  for (const b of BRANCHES) check(`${s} は力量なし（入門 p.26）`, starPowerOf(s, b) === null);
}
// 表の空欄 ＝ 旺衰表の空欄（禄存・敬羊・陀羅の入らない支）
for (const star of Object.keys(STAR_STRENGTH) as PlacedStar[]) {
  for (const b of BRANCHES) {
    check(`${star}・${b} 力量の空欄と旺衰の空欄が一致`, (starPowerOf(star, b) === null) === (starStrengthOf(star, b) === null));
  }
}

// ---------------------------------------------------------------------------
// 2. 旺衰との対応（参考。資料に換算規則はない。計算には使わない）
// ---------------------------------------------------------------------------
const corr: string[] = [];
let notFunction = 0;
for (const star of Object.keys(STAR_STRENGTH) as PlacedStar[]) {
  const map = new Map<string, Set<number>>();
  for (const b of BRANCHES) {
    const st = starStrengthOf(star, b);
    const v = starPowerOf(star, b);
    if (st === null || v === null) continue;
    map.set(st, (map.get(st) ?? new Set()).add(v));
  }
  const multi = [...map.values()].some((s) => s.size > 1);
  if (multi) notFunction += 1;
  corr.push(`${star}: ${[...map].map(([k, v]) => `${k}→${[...v].join("/")}`).join(" ")}${multi ? "（同じ旺衰で値が複数）" : ""}`);
}
report.push(
  `旺衰との対応（参考）: 同じ旺衰に複数の力量値がある星 ${notFunction}/21。星ごとには旺衰と力量が1対1に対応するが、対応は星ごとに違い（例: 旺＝紫微星4・貪狼星2）、資料に換算規則はない`,
);
report.push(...corr.map((c) => `  ${c}`));
// 旺衰が同じでも力量が違う例（旺衰を入力にしていないことの確認）: 紫微星 廟（丑6・午6・未6）と 天梁星 廟（子6・寅6…）は同値だが、
// 太陽星 旺（寅4・辰4・巳4・午4）と 天府星 旺（午4・酉4）… 星ごとに表の値を参照していることを calculateChartPower で確かめる（4.）

// ---------------------------------------------------------------------------
// 3. 命盤A・B
// ---------------------------------------------------------------------------
const chartA = calculateZiweiChart({ birth: { year: 1955, month: 10, day: 16, hour: 15, minute: 55 }, place: "東京", sex: "female" });
const chartB = calculateZiweiChart({ birth: { year: 1964, month: 12, day: 21, hour: 6, minute: 0 }, place: "東京", sex: "male" });
const powerA = calculateChartPower(chartA);
const powerB = calculateChartPower(chartB);
const tenths = (self: number, opp: number, t1: number, t2: number) => (self * 10 + opp * 5 + (t1 + t2) * 3) / 10;
const oppOf = (b: Branch) => BRANCHES[(BRANCHES.indexOf(b) + 6) % 12];
const trinesOf = (b: Branch): [Branch, Branch] => [BRANCHES[(BRANCHES.indexOf(b) + 4) % 12], BRANCHES[(BRANCHES.indexOf(b) + 8) % 12]];

// 命盤A: 星の印刷値（火星・巳は needs_review）
for (const s of FX.chartA.stars as { branch: Branch; star: PowerStar; printed: number; needs_review: boolean }[]) {
  const e = powerA.byBranch[s.branch].stars.find((x) => x.star === s.star);
  check(`命盤A ${s.star}・${s.branch} が盤面にある`, !!e);
  if (s.needs_review) {
    report.push(`命盤A needs_review: ${s.star}・${s.branch} 印刷 ${s.printed} ／ 表13 ${e?.basePower}（表を採用）`);
    check(`命盤A ${s.star}・${s.branch} は表の値（印刷値に合わせない）`, e?.basePower === starPowerOf(s.star, s.branch));
  } else {
    check(`命盤A ${s.star}・${s.branch} 印刷値 ${s.printed}`, e?.finalPower === s.printed, `${e?.finalPower}`);
  }
}
// 命盤A: 印刷された宮の合計から推羅式 → 印刷の運命指数・段階（12宮すべて一致すること）
type PA = { branch: Branch; palace: string; printedSum: number; printedIndex: number; printedGrade: string };
const aPal: PA[] = FX.chartA.palaces;
const aSum = new Map(aPal.map((p) => [p.branch, p.printedSum]));
let aFormulaOk = 0;
for (const p of aPal) {
  const [t1, t2] = trinesOf(p.branch);
  const idx = tenths(p.printedSum, aSum.get(oppOf(p.branch))!, aSum.get(t1)!, aSum.get(t2)!);
  const ok = idx === p.printedIndex && powerGradeOf(idx) === p.printedGrade;
  if (ok) aFormulaOk += 1;
  check(`命盤A ${p.palace} 印刷の合計から推羅式 = 印刷 ${p.printedIndex}（${p.printedGrade}）`, ok, `${idx} ${powerGradeOf(idx)}`);
}
report.push(`命盤A: 印刷の合計 → 推羅式 → 印刷の運命指数・段階 ${aFormulaOk}/12 一致`);
// 命盤A: エンジン（表・禄存あり）の値と印刷値の差。差が出るのは火星・巳（巳宮）と禄存（卯宮）の影響を受ける宮だけ
for (const p of aPal) {
  const e = powerA.byBranch[p.branch];
  const affectedSum = p.branch === "巳" || p.branch === "卯";
  if (!affectedSum) check(`命盤A ${p.palace} 宮の合計 = 印刷 ${p.printedSum}`, e.sum === p.printedSum, `${e.sum}`);
  const related = [p.branch, oppOf(p.branch), ...trinesOf(p.branch)].some((b) => b === "巳" || b === "卯");
  if (!related) check(`命盤A ${p.palace} 運命指数 = 印刷 ${p.printedIndex}`, e.index === p.printedIndex && e.grade === p.printedGrade, `${e.index}`);
  if (e.index !== p.printedIndex || e.sum !== p.printedSum) {
    report.push(
      `命盤A needs_review: ${p.palace}(${p.branch}) 印刷 合計${p.printedSum}・${p.printedIndex}（${p.printedGrade}） ／ エンジン 合計${e.sum}・${e.index.toFixed(1)}（${e.grade}）`,
    );
  }
}
check("命盤A 命宮 14.6 最強", powerA.byBranch["寅"].index === 14.6 && powerA.byBranch["寅"].grade === "最強");
check("命盤A 命宮の式", powerA.byBranch["寅"].formula === "8 + 3×0.5 + 11×0.3 + 6×0.3 = 14.6", powerA.byBranch["寅"].formula);
check("命盤A 酉宮は天姚だけ（無視）→ 合計0", powerA.byBranch["酉"].sum === 0 && powerA.byBranch["酉"].ignoredStars.includes("天姚星"));
check("命盤A 申宮 天馬・紅鸞は無視", ["天馬星", "紅鸞星"].every((s) => powerA.byBranch["申"].ignoredStars.includes(s as PlacedStar)));
check(
  "命盤A 四化は化が付いた星の宮で数える",
  powerA.byBranch["巳"].stars.some((s) => s.star === "化禄星" && s.attachedTo === "天機星" && s.finalPower === 3) &&
    powerA.byBranch["亥"].stars.some((s) => s.star === "化忌星" && s.finalPower === -3),
);

// 命盤B: 星の印刷値（全件一致）・宮の運命指数（印刷値との差を記録。needs_review）
for (const s of FX.chartB.stars as { branch: Branch; star: PowerStar; printed: number }[]) {
  const e = powerB.byBranch[s.branch].stars.find((x) => x.star === s.star);
  check(`命盤B ${s.star}・${s.branch} 印刷値 ${s.printed}`, e?.finalPower === s.printed, `${e?.finalPower}`);
}
const bDiffs: string[] = [];
for (const p of FX.chartB.palaces as { branch: Branch; palace: string; printedIndex: number }[]) {
  const e = powerB.byBranch[p.branch];
  const d = Math.round((p.printedIndex - e.index) * 10) / 10;
  check(`命盤B ${p.palace} 段階は印刷値の段階と同じ`, e.grade === powerGradeOf(p.printedIndex), `${e.index} / ${p.printedIndex}`);
  bDiffs.push(`${p.palace} ${p.printedIndex}/${e.index.toFixed(1)}(${d >= 0 ? "+" : ""}${d.toFixed(1)})`);
}
report.push(`命盤B needs_review: 印刷／推羅式 ${bDiffs.join("・")}`);

// ---------------------------------------------------------------------------
// 4. 段階の境界・全盤面
// ---------------------------------------------------------------------------
for (const [v, g] of [[12.0, "最強"], [11.9, "強"], [9.0, "強"], [8.9, "平"], [7.0, "平"], [6.9, "弱"], [3.0, "弱"], [2.9, "最弱"], [-4.6, "最弱"], [19.7, "最強"]] as const) {
  check(`段階 ${v} → ${g}`, powerGradeOf(v) === g);
}
const inputs: ZiweiInput[] = [];
for (let y = 1930; y <= 2010; y += 3) {
  for (let m = 1; m <= 12; m += 1) {
    for (const d of [3, 17]) inputs.push({ birth: { year: y, month: m, day: d, hour: (y + m * 5 + d) % 24, minute: 10 }, place: "東京", sex: (m + d) % 2 ? "male" : "female" });
  }
}
let sweepOk = 0;
for (const inp of inputs) {
  const c = calculateZiweiChart(inp);
  let p;
  try {
    p = calculateChartPower(c);
  } catch (e) {
    check(`全盤面 ${JSON.stringify(inp.birth)} 空欄に当たらない`, false, String(e));
    continue;
  }
  let ok = true;
  for (const pp of p.palaces) {
    const direct = c.palaces.find((x) => x.branch === pp.branch)!;
    const expectSum =
      direct.stars.reduce((n, s) => n + (starPowerOf(s, pp.branch) ?? 0), 0) +
      c.transformations.filter((t) => t.branch === pp.branch).reduce((n, t) => n + starPowerOf(t.kind, pp.branch)!, 0);
    const [t1, t2] = trinesOf(pp.branch);
    const idx = tenths(pp.sum, p.byBranch[oppOf(pp.branch)].sum, p.byBranch[t1].sum, p.byBranch[t2].sum);
    if (pp.sum !== expectSum || pp.index !== idx || pp.grade !== powerGradeOf(idx)) ok = false;
    if (pp.ignoredStars.some((s) => !["天馬星", "天姚星", "紅鸞星"].includes(s))) ok = false;
    if (pp.stars.some((s) => s.adjustments.length > 0 || s.finalPower !== s.basePower)) ok = false;
  }
  check(`全盤面 ${JSON.stringify(inp.birth)} 式どおり`, ok);
  if (ok) sweepOk += 1;
}
report.push(`全盤面: ${sweepOk}/${inputs.length} 件で空欄に当たらず式どおり`);

// ---------------------------------------------------------------------------
// 5. 条件付きの文: 登録・引用
// ---------------------------------------------------------------------------
const conditional = [...ENTRY.values()].filter((e) => e.condition);
const ming = conditional.filter((e) => e.condition === "命宮の力量");
check("条件付きの文 128件", conditional.length === 128, `${conditional.length}`);
check("命宮の力量の文はすべて登録", ming.every((e) => !!CONDITION_SPECS[e.id]), ming.filter((e) => !CONDITION_SPECS[e.id]).map((e) => e.id).join(","));
check("登録は命宮の力量の文だけ", Object.keys(CONDITION_SPECS).every((id) => ENTRY.get(id)?.condition === "命宮の力量"));
// 条件の語句が資料の文の引用であることは、原文を含む中間データ（scripts/ziwei/.cache。git 管理外）があるときだけ確かめる（§35）
const RAW_DIR = "scripts/ziwei/.cache/meanings_raw";
const RAW_TEXT = new Map<string, string>();
for (const f of ["stars", "transformations", "palaces", "starPalace", "combinations"]) {
  if (!fs.existsSync(`${RAW_DIR}/${f}.json`)) continue;
  for (const e of JSON.parse(fs.readFileSync(`${RAW_DIR}/${f}.json`, "utf8")) as { id: string; sourceText: string }[]) RAW_TEXT.set(e.id, e.sourceText);
}
for (const [id, spec] of Object.entries(CONDITION_SPECS)) {
  const text = RAW_TEXT.get(id);
  if (text === undefined) continue;
  for (const t of spec.terms) {
    if (t.kind === "other") continue;
    const phrase = t.phrase.replace(/（(天同星の節)）/g, "");
    check(`${id} の条件「${phrase}」は資料の文の引用`, text.includes(phrase));
  }
}
// 構造上の判定可能性（盤面によらない）
const full = ming.filter((e) => {
  const s = specFor(e.id)!;
  return !s.branching && s.terms.every((t) => t.kind === "palacePower" || (t.kind === "starPower" && !!["武曲星", "巨門星", "天梁星", "七殺星"].includes(t.star)));
});
const partial = ming.filter((e) => {
  const s = specFor(e.id)!;
  return !full.includes(e) && !s.branching && s.combine === "all" && s.terms.some((t) => t.kind === "palacePower" || (t.kind === "starPower" && ["武曲星", "巨門星", "天梁星", "七殺星"].includes(t.star)));
});
report.push(
  `条件付きの文 128件: 命宮の力量 ${ming.length}（成立・不成立とも判定可 ${full.length}、不成立だけ判定可 ${partial.length}、常に判定不能 ${ming.length - full.length - partial.length}）・巡る宮の力量 ${conditional.length - ming.length}（判定不能）`,
);
report.push(`  成立・不成立とも判定可: ${full.map((e) => e.id).join(" ")}`);

// ---------------------------------------------------------------------------
// 6. 判定（合成した力量で成立・不成立・判定不能）
// ---------------------------------------------------------------------------
const snap = (grade: PowerSnapshot["mingPalace"]["grade"], stars: Record<string, number> = {}): PowerSnapshot => ({
  mingPalace: { branch: "寅", index: { 最強: 14, 強: 10, 平: 8, 弱: 5, 最弱: 1 }[grade], grade },
  starPower: Object.fromEntries(Object.entries(stars).map(([s, v]) => [s, { branch: "寅" as Branch, power: v }])),
});
const ev = (id: string, p: PowerSnapshot) => evaluatePowerCondition(ENTRY.get(id)!, p)!.result;
check("N-ST-0021 最強 → 成立", ev("N-ST-0021", snap("最強")) === "met");
check("N-ST-0021 強 → 成立", ev("N-ST-0021", snap("強")) === "met");
check("N-ST-0021 平 → 不成立", ev("N-ST-0021", snap("平")) === "notMet");
check("N-ST-0727 弱 → 成立", ev("N-ST-0727", snap("弱")) === "met");
check("N-ST-0727 最弱 → 成立", ev("N-ST-0727", snap("最弱")) === "met");
check("N-ST-0727 平 → 不成立", ev("N-ST-0727", snap("平")) === "notMet");
check("N-ST-0256（弱くなければ・配合）平 → 判定不能", ev("N-ST-0256", snap("平")) === "undetermined");
check("N-ST-0256（弱くなければ・配合）弱 → 不成立", ev("N-ST-0256", snap("弱")) === "notMet");
check("N-ST-0180 武曲0 → 成立", ev("N-ST-0180", snap("強", { 武曲星: 0 })) === "met");
check("N-ST-0180 武曲2 → 不成立", ev("N-ST-0180", snap("強", { 武曲星: 2 })) === "notMet");
check("N-ST-0180 武曲なし → 判定不能", ev("N-ST-0180", snap("強")) === "undetermined");
check("N-ST-0482 巨門4 → 成立", ev("N-ST-0482", snap("強", { 巨門星: 4 })) === "met");
check("N-ST-0482 巨門2 → 成立", ev("N-ST-0482", snap("強", { 巨門星: 2 })) === "met");
check("N-ST-0482 巨門-4 → 不成立", ev("N-ST-0482", snap("強", { 巨門星: -4 })) === "notMet");
check("N-ST-0484 巨門-6 → 成立", ev("N-ST-0484", snap("強", { 巨門星: -6 })) === "met");
check("N-ST-0573 天梁2 → 不成立（4〜6 でない）", ev("N-ST-0573", snap("強", { 天梁星: 2 })) === "notMet");
check("N-ST-0574 天梁2 → 不成立（0 でない）", ev("N-ST-0574", snap("強", { 天梁星: 2 })) === "notMet");
check("N-ST-0574 天梁0 → 成立", ev("N-ST-0574", snap("強", { 天梁星: 0 })) === "met");
check("N-ST-0621 七殺4・命宮強 → 成立", ev("N-ST-0621", snap("強", { 七殺星: 4 })) === "met");
check("N-ST-0621 七殺-2・命宮強 → 不成立", ev("N-ST-0621", snap("強", { 七殺星: -2 })) === "notMet");
check("N-ST-0079 天機（数値なし）→ 判定不能", ev("N-ST-0079", snap("強", { 天機星: 6 })) === "undetermined");
check("N-ST-0127 太陽弱（不明）かつ 命宮平 → 不成立", ev("N-ST-0127", snap("平", { 太陽星: 0 })) === "notMet");
check("N-ST-0127 太陽弱（不明）かつ 命宮弱 → 判定不能", ev("N-ST-0127", snap("弱", { 太陽星: 0 })) === "undetermined");
check("N-ST-0474 巨門弱 または 命宮弱: 巨門-4・命宮強 → 成立", ev("N-ST-0474", snap("強", { 巨門星: -4 })) === "met");
check("N-ST-0474: 巨門4・命宮強 → 不成立", ev("N-ST-0474", snap("強", { 巨門星: 4 })) === "notMet");
check("N-ST-0374 太陰弱（不明）または 命宮弱: 命宮弱 → 成立", ev("N-ST-0374", snap("弱", { 太陰星: 0 })) === "met");
check("N-ST-0374: 命宮強 → 判定不能", ev("N-ST-0374", snap("強", { 太陰星: 0 })) === "undetermined");
check("N-ST-0625（1文に強弱の両方）→ 判定不能", ev("N-ST-0625", snap("強", { 七殺星: 4 })) === "undetermined");
check("N-ST-0037（同宮加会の条件あり）命宮弱 → 判定不能", ev("N-ST-0037", snap("弱")) === "undetermined");
check("N-ST-0037 命宮強 → 不成立", ev("N-ST-0037", snap("強")) === "notMet");
check("巡る宮の力量 → 判定不能", ev("N-ST-RN-026", snap("最強")) === "undetermined");

// ---------------------------------------------------------------------------
// 7. 盤面での接続（成立 → 本文、不成立 → 除外、判定不能 → 参考。文脈の整合・後続文だけを出さない）
// ---------------------------------------------------------------------------
/** 命宮に武曲星があり、その力量が0（卯・巳・酉・亥）の盤面を探す（N-ST-0180 が成立する例） */
function findChart(pred: (c: ZiweiChart) => boolean): ZiweiChart | null {
  for (let y = 1950; y <= 1999; y += 1) {
    for (let m = 1; m <= 12; m += 1) {
      for (const h of [1, 5, 9, 13, 17, 21]) {
        const c = calculateZiweiChart({ birth: { year: y, month: m, day: 11, hour: h, minute: 0 }, place: "東京", sex: "male" });
        if (pred(c)) return c;
      }
    }
  }
  return null;
}
const wuquZero = findChart((c) => {
  const b = c.starPositions["武曲星"];
  return b === c.mingPalace && starPowerOf("武曲星", b) === 0;
});
check("武曲星（力量0）が命宮にある盤面がある", !!wuquZero);
const charts: [string, ZiweiChart][] = [
  ["A", chartA],
  ["B", chartB],
  ...(wuquZero ? ([["武曲0", wuquZero]] as [string, ZiweiChart][]) : []),
];
if (wuquZero) {
  const ctx = buildPalaceMeaningContext(wuquZero, wuquZero.mingPalace);
  for (const lv of LEVELS) {
    const ai = buildAiMeaningContext(ctx, { detailLevel: lv });
    const r = buildRuleBasedInterpretation(ctx, { detailLevel: lv });
    const ids = r.sections.flatMap((s) => s.sentences.map((x) => x.sourceIds[0]));
    check(`武曲0 ${lv} N-ST-0180 は成立`, !ai.conditionExcluded.some((x) => x.id === "N-ST-0180") && !ai.referenceOnly.some((x) => x.id === "N-ST-0180"));
    if (ids.includes("N-ST-0181")) check(`武曲0 ${lv} N-ST-0181 は N-ST-0180 と一緒に本文`, ids.indexOf("N-ST-0180") >= 0 && ids.indexOf("N-ST-0180") < ids.indexOf("N-ST-0181"));
    if (lv === "detailed") {
      check("武曲0 detailed N-ST-0180・0181 が本文に復帰", ids.includes("N-ST-0180") && ids.includes("N-ST-0181"));
      report.push(
        `武曲0 の例（${JSON.stringify(wuquZero.timeCorrection.legal)} 命宮 ${wuquZero.mingPalace}）detailed 本文の条件成立文: ${r.counts.conditionMetInBody.join(" ")}`,
      );
    }
  }
}
const restored = new Map<string, Set<string>>();
for (const [cid, chart] of charts) {
  for (const b of BRANCHES) {
    const ctx = buildPalaceMeaningContext(chart, b);
    check(`${cid}/${b} 宮の力量をコンテキストに持つ`, ctx.power.palace.branch === b && ctx.power.mingPalace.branch === chart.mingPalace);
    for (const lv of LEVELS) {
      const tag = `${cid}/${ctx.palace.name}(${b})/${lv}`;
      const ai = buildAiMeaningContext(ctx, { detailLevel: lv });
      const r = buildRuleBasedInterpretation(ctx, { detailLevel: lv });
      const body = r.sections.flatMap((s) => s.sentences);
      const bodyIds = body.map((s) => s.sourceIds[0]);
      // 本文の条件付きの文は成立したものだけ
      for (const id of bodyIds) {
        const e = ENTRY.get(id);
        if (e?.condition) {
          const res = evaluatePowerCondition(e, ctx.power)!.result;
          check(`${tag} 本文の条件付き ${id} は成立`, res === "met", res);
          const set = restored.get(`${cid}/${b}`) ?? new Set();
          set.add(id);
          restored.set(`${cid}/${b}`, set);
        }
      }
      // 後続文（前文依存の主文）は前文と一緒。前文は主文より前
      for (const s of body.filter((x) => x.role === "primary" && x.contextIds)) {
        const key = ai.keyMeanings.find((k) => k.id === s.sourceIds[0])!;
        for (const pid of key.context?.previous ?? []) {
          check(`${tag} ${s.sourceIds[0]} の前文 ${pid} が本文にある`, bodyIds.includes(pid) && bodyIds.indexOf(pid) < bodyIds.indexOf(s.sourceIds[0]));
        }
      }
      // 不成立の文は本文にも参考にも入らない。判定不能の文は参考にある
      for (const x of ai.conditionExcluded) {
        check(`${tag} 不成立 ${x.id} は本文外`, !bodyIds.includes(x.id));
        check(`${tag} 不成立 ${x.id} は参考外`, !ai.referenceOnly.some((y) => y.id === x.id));
      }
      for (const x of ai.referenceOnly.filter((y) => y.status === "参考・条件未判定")) {
        check(`${tag} 判定不能 ${x.id} は本文外`, !bodyIds.includes(x.id));
        check(`${tag} 判定不能 ${x.id} に判定理由`, !!x.conditionEvaluation && x.reason.length > 0);
      }
      // 力量から文を作らない: 前置きは固定のもの（ruleInterpretation の ALLOWED_PREFIXES）だけ。数値・段階名を足さない
      check(`${tag} 前置きに力量の数値・段階名がない`, body.every((x) => !/[0-9０-９]|最強|最弱|運命指数|力量/.test(x.prefix)));
    }
  }
}
// 命盤A 命宮（最強）: N-ST-0180/0181 は不成立で両方除外
{
  const ctx = buildPalaceMeaningContext(chartA, "寅");
  const r = buildRuleBasedInterpretation(ctx, { detailLevel: "detailed" });
  const ids = r.sections.flatMap((s) => s.sourceIds);
  check("命盤A 命宮 N-ST-0180・0181 は本文外", !ids.includes("N-ST-0180") && !ids.includes("N-ST-0181"));
  check("命盤A 命宮 N-ST-0181 は前文不成立で除外", r.conditionExcluded.some((x) => x.id === "N-ST-0181"));
  report.push(`命盤A 命宮 detailed 条件判定: 成立 ${r.counts.powerConditions.met}・不成立 ${r.counts.powerConditions.notMet}・判定不能 ${r.counts.powerConditions.undetermined}`);
}
for (const [k, v] of restored) report.push(`本文に入った条件成立文 ${k}: ${[...v].join(" ")}`);

const fail = failures.length;
console.log(report.join("\n"));
console.log(`\n力量: ${pass} / ${pass + fail} PASS`);
if (fail) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
