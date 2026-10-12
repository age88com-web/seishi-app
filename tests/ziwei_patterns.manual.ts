// tests/ziwei_patterns.manual.ts
//
// 格局判定（src/lib/ziwei/patterns、基礎２ 本編33格）の確認。docs/ziwei-basic-spec.md §23.4。
// 実行: npx tsx tests/ziwei_patterns.manual.ts
//
// 確認: 33格の登録・全書52格は判定対象外・吉凶星の分類・三方四正＝三合2宮＋対宮・吉星／煞星（凶星）条件・
// 廟旺＝廟か旺・落陥＝不得地か陥・宮指定なしの12宮走査・三奇嘉會（命宮／身宮・warning）・「破格しやすい」を破格にしない・
// 日月同臨／日月夾命の sourceConflict・天馬差・四化表の維持・命盤11盤の fixture・状態の整合。

import fs from "node:fs";
import { calculateZiweiChart, mainStarsOf, sanfangSizheng, starStrengthOf, transformationTarget } from "../src/lib/ziwei";
import { BRANCH_PO } from "../src/lib/ziwei/branchRelations";
import type { Branch, ZiweiChart, ZiweiInput } from "../src/lib/ziwei";
import {
  CLASSICAL_REFERENCE_PATTERNS,
  evaluatePatterns,
  PATTERN_RULES,
  PATTERN_SOURCE_TEXT,
  STAR_LUCK,
  viewOf,
} from "../src/lib/ziwei/patterns";
import type { ChartPatterns, PatternResult } from "../src/lib/ziwei/patterns";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}
const report: string[] = [];
const HB = "子丑寅卯辰巳午未申酉戌亥".split("") as Branch[];
const byId = (r: ChartPatterns, id: string) => r.patterns.find((p) => p.id === id)!;

// ---------------------------------------------------------------------------
// 1. 登録
// ---------------------------------------------------------------------------
check("本編33格の資料の文", PATTERN_SOURCE_TEXT.length === 33);
check("本編33格の判定条件", PATTERN_RULES.length === 33 && new Set(PATTERN_RULES.map((r) => r.id)).size === 33);
check("資料の文と判定条件の ID が一致", PATTERN_SOURCE_TEXT.every((s) => PATTERN_RULES.some((r) => r.id === s.id)));
check("番号 1〜33", PATTERN_SOURCE_TEXT.map((s) => s.number).join(",") === Array.from({ length: 33 }, (_, i) => i + 1).join(","));
check("全書52格は referenceOnly", CLASSICAL_REFERENCE_PATTERNS.length === 52 && CLASSICAL_REFERENCE_PATTERNS.every((c) => c.referenceOnly === true));
const docs = JSON.parse(fs.readFileSync("docs/ziwei-patterns-candidate.json", "utf8"));
check("候補データの全書52格に referenceOnly: true", docs.classicalPatterns.length === 52 && docs.classicalPatterns.every((c: { referenceOnly?: boolean }) => c.referenceOnly === true));
for (const s of PATTERN_SOURCE_TEXT) check(`${s.id} 象意の文がある（独自文章・原文フィールドなし）`, s.meaningText.length > 0 && !("conditionText" in s));

// 吉星・凶星（入門 p.15）
const counts = Object.values(STAR_LUCK).reduce<Record<string, number>>((a, c) => ({ ...a, [c]: (a[c] ?? 0) + 1 }), {});
check("吉凶の分類は34星（吉星21・凶星12・平星1）", Object.keys(STAR_LUCK).length === 34 && counts["吉星"] === 21 && counts["凶星"] === 12 && counts["平星"] === 1, JSON.stringify(counts));
check("化禄・化権・化科は吉星、化忌は凶星", ["化禄星", "化権星", "化科星"].every((s) => STAR_LUCK[s as keyof typeof STAR_LUCK] === "吉星") && STAR_LUCK["化忌星"] === "凶星");

// 四化表は現行（入門 表10）を維持
check("戊の化科＝右弼（入門。基礎２ S37 の太陽ではない）", transformationTarget("化科星", "戊") === "右弼星");
check("壬の化科＝左輔（入門。基礎２ S37 の天府ではない）", transformationTarget("化科星", "壬") === "左輔星");
check("三奇嘉會に四化表差の記録", PATTERN_RULES.find((r) => r.id === "K2-19")!.sourceIssues.some((i) => i.kind === "sourceDifference" && i.note.includes("S37")));

// ---------------------------------------------------------------------------
// 2. 多数の盤面での性質
// ---------------------------------------------------------------------------
const inputs: ZiweiInput[] = [];
for (let y = 1930; y <= 2012; y += 1) {
  for (let m = 1; m <= 12; m += 1) {
    for (const d of [5, 19]) inputs.push({ birth: { year: y, month: m, day: d, hour: (y * 5 + m * 7 + d) % 24, minute: 20 }, place: "東京", sex: (y + m + d) % 2 ? "male" : "female" });
  }
}
const found: Record<string, number> = {};
const hit = (k: string) => (found[k] = (found[k] ?? 0) + 1);
let classicalLeak = 0;
for (const inp of inputs) {
  const chart = calculateZiweiChart(inp);
  const v = viewOf(chart);
  const r = evaluatePatterns(chart);
  const tag = JSON.stringify(inp.birth);
  if (r.patterns.length !== 33) check(`${tag} 33格すべて判定`, false);
  if (r.patterns.some((p) => !p.id.startsWith("K2-"))) classicalLeak += 1;

  // 三方四正＝三合2宮＋対宮（本宮を含まない）
  const b0 = chart.mingPalace;
  const sf = sanfangSizheng(b0);
  const mine = v.sanfangSizheng(b0);
  if (!(mine.length === 3 && !mine.includes(b0) && mine.includes(sf.opposite) && sf.trines.every((t) => mine.includes(t)))) check(`${tag} 三方四正`, false);

  for (const p of r.patterns) {
    // 状態の整合
    if (p.status === "confirmed" && !(p.conditionMatched === true && p.sourceStatus === "verified" && p.breakConditions.every((b) => b.result === "clear"))) check(`${tag} ${p.id} confirmed の整合`, false);
    if (p.conditionMatched === false && p.status !== "not_applicable") check(`${tag} ${p.id} 不一致は not_applicable`, false);
    if (p.conditionMatched === true && p.matchedPalaces.length === 0) check(`${tag} ${p.id} 一致の宮`, false);
    if (p.breakConditions.some((b) => /しやすい/.test(b.text))) check(`${tag} ${p.id} 「破格しやすい」を破格にしない`, false);
    if (p.conditionMatched) hit(`${p.id}:matched`);
    if (p.status === "confirmed") hit(`${p.id}:confirmed`);
  }

  // 日月並明: 廟旺＝廟か旺
  const bm = byId(r, "K2-05");
  const sunSt = starStrengthOf("太陽星", chart.starPositions["太陽星"]);
  const moonSt = starStrengthOf("太陰星", chart.starPositions["太陰星"]);
  const bothIn = v.sanfangSizheng(b0).includes(chart.starPositions["太陽星"]) && v.sanfangSizheng(b0).includes(chart.starPositions["太陰星"]);
  if (bothIn) {
    const expect = ["廟", "旺"].includes(sunSt ?? "") && ["廟", "旺"].includes(moonSt ?? "");
    if (bm.conditionMatched !== expect) check(`${tag} 日月並明＝廟旺`, false, `${sunSt}/${moonSt}`);
    hit(expect ? "日月並明:廟旺で一致" : `日月並明:三方四正にあるが廟旺でない(${sunSt}/${moonSt})`);
  }
  // 日月蔵輝: 落陥＝不得地か陥
  const zh = byId(r, "K2-27");
  if (zh.conditionMatched) {
    if (!(["不得地", "陥"].includes(sunSt ?? "") && ["不得地", "陥"].includes(moonSt ?? ""))) check(`${tag} 日月蔵輝＝落陥`, false);
    if (sunSt === "不得地" || moonSt === "不得地") hit("日月蔵輝:不得地を含む一致");
  }
  // 宮指定なし: 命宮以外の宮で成立
  for (const id of ["K2-09", "K2-22", "K2-23", "K2-27", "K2-29", "K2-32"]) {
    const p = byId(r, id);
    if (p.conditionMatched && p.matchedPalaces.some((x) => x.branch !== b0)) hit(`${id}:命宮以外の宮で成立`);
  }
  // 吉星条件（明珠出海・月生滄海・日月照壁・日月同臨・七殺朝斗）: 加会する吉星がないと不一致
  for (const id of ["K2-12", "K2-13", "K2-26"]) {
    const p = byId(r, id);
    const c = p.checks.find((x) => /吉星/.test(x.text) || /吉星/.test(x.detail));
    if (c && c.result === false && p.conditionMatched) check(`${tag} ${id} 吉星なしで一致しない`, false);
  }
  // 煞星＝凶星: 英星入廟の破格・禄合鴛鴦の不成立
  const yx = byId(r, "K2-16");
  if (yx.conditionMatched) {
    const same = v.maleficIn([b0], ["破軍星"]);
    const chong = v.maleficIn([sanfangSizheng(b0).opposite]);
    const po = v.maleficIn([BRANCH_PO[b0]]);
    const brk = same.length + chong.length + po.length > 0;
    if (brk !== yx.breakConditions.some((b) => b.result === "broken")) check(`${tag} 英星入廟 煞星（同宮・冲・破）＝凶星`, false);
    if (yx.status !== (brk ? "not_applicable" : "confirmed")) check(`${tag} 英星入廟 状態`, false, yx.status);
    hit(brk ? "英星入廟:煞星で破格" : "英星入廟:煞星なしで成立");
  }
  const lh = byId(r, "K2-21");
  const lhSame = lh.checks[0].result === true;
  if (lhSame) hit(lh.conditionMatched ? "禄合鴛鴦:煞星の加会なしで一致" : "禄合鴛鴦:煞星の加会で不成立");

  // 三奇嘉會
  const sq = byId(r, "K2-19");
  const three = ["化禄星", "化権星", "化科星"] as const;
  // 範囲は基準宮＋その三方四正（2026-10-01 確定）
  const okAt = (b: Branch) => three.every((k) => [b, ...v.sanfangSizheng(b)].includes(chart.transformations.find((t) => t.kind === k)!.branch));
  const mingOk = okAt(chart.mingPalace);
  const shenOk = okAt(chart.shenPalace);
  if (sq.conditionMatched !== (mingOk || shenOk)) check(`${tag} 三奇嘉會 命宮または身宮`, false);
  if (mingOk && !shenOk) hit("三奇嘉會:命宮だけで成立");
  if (shenOk && !mingOk) hit("三奇嘉會:身宮だけで成立");
  if (sq.conditionMatched) {
    const weak = sq.warningConditions.some((w) => w.text.includes("力量") && w.result === "applies");
    const grades = sq.matchedPalaces.map((p) => v.gradeOf(p.branch));
    if (weak !== grades.some((g) => g === "弱" || g === "最弱")) check(`${tag} 三奇嘉會 弱・最弱は warning`, false, grades.join(","));
    if (weak) {
      hit("三奇嘉會:弱・最弱で warning");
      if (sq.status === "not_applicable" || sq.breakConditions.length > 0) check(`${tag} 三奇嘉會 warning で破格にしない`, false);
    }
    if (sq.status !== "confirmed") check(`${tag} 三奇嘉會 成立は confirmed（warning があっても）`, false, sq.status);
  }
  // 日月同臨・日月夾命・禄馬交馳・馬頭帯箭は断定しない（sourceConflict・天馬差）
  for (const id of ["K2-26", "K2-15", "K2-23", "K2-18"]) if (byId(r, id).status === "confirmed") check(`${tag} ${id} は confirmed にしない`, false);
  // 羊陀夾忌: 対宮は affectedPalaces（成立宮ではない）
  const ytj = byId(r, "K2-32");
  if (ytj.conditionMatched) {
    const ok = ytj.affectedPalaces.length === ytj.matchedPalaces.length && ytj.affectedPalaces.every((a) => a.branch === sanfangSizheng(a.from).opposite && !ytj.matchedPalaces.some((m) => m.branch === a.branch && !(v.has(a.branch, "禄存星") && v.has(a.branch, "化忌星"))));
    if (!ok) check(`${tag} 羊陀夾忌 対宮は affectedPalaces`, false);
    hit("羊陀夾忌:対宮を affectedPalaces に");
  }
}
check("全書52格を判定結果に出さない", classicalLeak === 0);
for (const k of [
  "日月並明:廟旺で一致",
  "日月蔵輝:不得地を含む一致",
  "K2-09:命宮以外の宮で成立",
  "K2-22:命宮以外の宮で成立",
  "K2-29:命宮以外の宮で成立",
  "K2-32:命宮以外の宮で成立",
  "K2-23:命宮以外の宮で成立",
  "英星入廟:煞星で破格",
  // 「英星入廟:煞星なしで成立」は実際の命盤では起こらない（冲に必ず廉貞）。人工例で確認（4.）
  "羊陀夾忌:対宮を affectedPalaces に",
  "禄合鴛鴦:煞星の加会で不成立",
  "三奇嘉會:命宮だけで成立",
  "三奇嘉會:身宮だけで成立",
  "三奇嘉會:弱・最弱で warning",
]) {
  check(`盤面の例がある: ${k}`, (found[k] ?? 0) > 0);
}
report.push(`盤面 ${inputs.length} 件の集計: ${Object.entries(found).filter(([k]) => !k.startsWith("K2-")).map(([k, n]) => `${k} ${n}`).join("・")}`);
report.push(
  `格局ごとの一致／confirmed（${inputs.length}盤面）: ${PATTERN_SOURCE_TEXT.map((s) => `${s.number}${s.canonicalName.replace(/格$/, "")} ${found[`${s.id}:matched`] ?? 0}/${found[`${s.id}:confirmed`] ?? 0}`).join("・")}`,
);

// sourceConflict の記録
for (const id of ["K2-26", "K2-15"]) {
  check(`${id} sourceConflict を記録`, PATTERN_RULES.find((r) => r.id === id)!.sourceIssues.some((i) => i.kind === "sourceConflict" && i.blocking));
}
check("禄馬交馳に天馬差", PATTERN_RULES.find((r) => r.id === "K2-23")!.sourceIssues.some((i) => i.note.includes("天馬") && i.blocking));

// ---------------------------------------------------------------------------
// 3. 命盤11盤（fixture）
// ---------------------------------------------------------------------------
interface Ex {
  id: string;
  printed: { ming: Branch; shen: Branch; bureau: string; stars: Record<Branch, string[]>; hua: Record<string, string> };
  engineInputs: ZiweiInput[];
  expectedEngineDiffs: string[];
  tenmaDiff: { printed: Branch; engine: Branch } | null;
  expectedPatterns: { pattern: string; conditionMatched: boolean | null; status: string; sourceConflict?: boolean; matchedPalaceIncludes?: Branch }[];
}
const EX: Ex[] = JSON.parse(fs.readFileSync("tests/fixtures/ziwei_patterns_examples.json", "utf8")).examples;
check("命盤 fixture 11盤", EX.length === 11);
function diffs(c: ZiweiChart, e: Ex): string[] {
  const out: string[] = [];
  for (const b of HB) {
    const mine = c.palaces.find((p) => p.branch === b)!.stars as string[];
    const pr = e.printed.stars[b] ?? [];
    for (const s of pr) if (!mine.includes(s)) out.push(`${b}:印刷${s}/エンジンなし`);
    for (const s of mine) if (!pr.includes(s)) out.push(`${b}:エンジン${s}/印刷なし`);
  }
  for (const [k, s] of Object.entries(e.printed.hua)) if (c.transformations.find((t) => t.kind === k)?.star !== s) out.push(`${k}`);
  if (c.mingPalace !== e.printed.ming) out.push("命宮");
  if (c.shenPalace !== e.printed.shen) out.push("身宮");
  if (c.bureau.name !== e.printed.bureau) out.push("五行局");
  return out;
}
for (const e of EX) {
  for (const inp of e.engineInputs) {
    const c = calculateZiweiChart(inp);
    const d = diffs(c, e);
    check(`${e.id} ${JSON.stringify(inp.birth)} 星配置・四化・命宮・身宮・五行局`, d.sort().join("|") === [...e.expectedEngineDiffs].sort().join("|"), d.join(" "));
    if (e.tenmaDiff) check(`${e.id} 天馬差（印刷 ${e.tenmaDiff.printed}／エンジン ${e.tenmaDiff.engine}）`, c.starPositions["天馬星"] === e.tenmaDiff.engine);
    const r = evaluatePatterns(c);
    for (const x of e.expectedPatterns) {
      const p: PatternResult = byId(r, x.pattern);
      check(`${e.id} ${p.name} conditionMatched=${x.conditionMatched}`, p.conditionMatched === x.conditionMatched, `${p.conditionMatched}`);
      check(`${e.id} ${p.name} status=${x.status}`, p.status === x.status, p.status);
      if (x.sourceConflict) check(`${e.id} ${p.name} sourceConflict を記録`, p.sourceIssues.some((i) => i.kind === "sourceConflict"));
      if (x.matchedPalaceIncludes) check(`${e.id} ${p.name} 成立宮 ${x.matchedPalaceIncludes}`, p.matchedPalaces.some((m) => m.branch === x.matchedPalaceIncludes));
    }
  }
  const r0 = evaluatePatterns(calculateZiweiChart(e.engineInputs[0]));
  report.push(
    `${e.id}: ${e.expectedPatterns.map((x) => `${byId(r0, x.pattern).name}＝${byId(r0, x.pattern).status}`).join("・")}（confirmed: ${r0.confirmed.map((p) => p.name).join("・") || "なし"}）`,
  );
}

// ---------------------------------------------------------------------------
// 4. 確定仕様（2026-10-01）のケース
// ---------------------------------------------------------------------------
const CASES: Record<string, ZiweiInput> = JSON.parse(fs.readFileSync("tests/fixtures/ziwei_pattern_cases.json", "utf8")).cases;
const caseChart = (k: string) => {
  const inp = CASES[k];
  if (!inp) throw new Error(`fixture にない: ${k}`);
  return calculateZiweiChart(inp);
};
const hua = (c: ZiweiChart, k: string) => c.transformations.find((t) => t.kind === k)!.branch;
const sfOf = (b: Branch) => [sanfangSizheng(b).opposite, ...sanfangSizheng(b).trines];

// 馬頭帯箭: 命宮午 × 命宮に（貪狼｜天同） × （化禄｜擎羊）が同宮または三方四正
for (const main of ["貪狼", "天同"] as const) {
  for (const partner of ["化禄", "擎羊"] as const) {
    for (const rel of ["同宮", "加会"] as const) {
      const c = caseChart(`馬頭帯箭:${main}+${partner}${rel}`);
      const at = partner === "化禄" ? hua(c, "化禄星") : c.starPositions["擎羊星"];
      check(`馬頭帯箭 ${main}+${partner}（${rel}）の入力が該当配置`, c.mingPalace === "午" && c.starPositions[`${main}星` as "貪狼星"] === "午" && (rel === "同宮" ? at === "午" : sfOf("午").includes(at)));
      const p = byId(evaluatePatterns(c), "K2-18");
      check(`馬頭帯箭 ${main}+${partner}（${rel}）で条件一致`, p.conditionMatched === true);
      check(`馬頭帯箭 ${main}+${partner}（${rel}）は sourceConflict で断定しない`, p.status === "needs_review" && p.sourceIssues.some((i) => i.kind === "sourceConflict" && i.note.includes("S19")));
    }
  }
  const c = caseChart(`馬頭帯箭:${main}+なし`);
  const p = byId(evaluatePatterns(c), "K2-18");
  check(`馬頭帯箭 ${main}で化禄・擎羊とも同宮・加会なし → 不成立`, p.conditionMatched === false && p.status === "not_applicable");
}
check("馬頭帯箭の曖昧さ（同宮・加会の割り当て）は解消", !PATTERN_RULES.find((r) => r.id === "K2-18")!.sourceIssues.some((i) => i.kind === "ambiguity"));

// 英星入廟: 子・午＋破軍、煞星の同宮・冲・破で破格
for (const b of ["子", "午"] as const) {
  const c = caseChart(`英星入廟:${b}`);
  const p = byId(evaluatePatterns(c), "K2-16");
  check(`英星入廟 ${b}＋破軍で条件一致`, c.mingPalace === b && c.starPositions["破軍星"] === b && p.conditionMatched === true);
  check(`英星入廟 ${b}: 冲＝${sanfangSizheng(b).opposite}・破＝${BRANCH_PO[b]}`, p.breakConditions.some((x) => x.detail.includes(sanfangSizheng(b).opposite)) && p.breakConditions.some((x) => x.detail.includes(BRANCH_PO[b])));
}
{
  const c = caseChart("英星入廟:煞同宮");
  const p = byId(evaluatePatterns(c), "K2-16");
  check("英星入廟 煞星が同宮で破格", p.breakConditions.find((x) => x.text.includes("同宮"))!.result === "broken" && p.status === "not_applicable");
  const c2 = caseChart("英星入廟:煞冲");
  const p2 = byId(evaluatePatterns(c2), "K2-16");
  check("英星入廟 煞星が冲で破格", p2.breakConditions.find((x) => x.text.includes("冲）"))!.result === "broken" && p2.status === "not_applicable");
}
check("破の表（子⇔酉・丑⇔辰・寅⇔亥・卯⇔午・巳⇔申・未⇔戌）", ["子酉", "丑辰", "寅亥", "卯午", "巳申", "未戌"].every((x) => BRANCH_PO[x[0] as Branch] === x[1] && BRANCH_PO[x[1] as Branch] === x[0]));
// 実際の命盤では、破軍が子午のとき冲（対宮）に必ず廉貞（凶星）がある → 常に破格
for (const z of HB) {
  const pos = mainStarsOf(z);
  if (pos["破軍星"] === "子" || pos["破軍星"] === "午") check(`紫微 ${z}: 破軍 ${pos["破軍星"]} の冲に廉貞`, pos["廉貞星"] === sanfangSizheng(pos["破軍星"]).opposite);
}
// 人工例（実際の命盤では起こらない配置で判定ロジックだけを確かめる）: 冲の廉貞と凶星を動かす
function moveStar(chart: ZiweiChart, star: string, to: Branch): ZiweiChart {
  const c = JSON.parse(JSON.stringify(chart)) as ZiweiChart;
  const from = c.starPositions[star as "廉貞星"];
  c.palaces.find((p) => p.branch === from)!.stars = c.palaces.find((p) => p.branch === from)!.stars.filter((s) => s !== star);
  c.palaces.find((p) => p.branch === to)!.stars.push(star as "廉貞星");
  c.starPositions[star as "廉貞星"] = to;
  for (const t of c.transformations) if (t.star === star) t.branch = to;
  return c;
}
{
  let c = caseChart("英星入廟:午");
  const m = c.mingPalace;
  const bad = [m, sanfangSizheng(m).opposite, BRANCH_PO[m]];
  const safe = HB.find((b) => !bad.includes(b) && !sanfangSizheng(m).trines.includes(b))!;
  for (const b of bad) for (const st of [...c.palaces.find((p) => p.branch === b)!.stars]) if (STAR_LUCK[st] === "凶星" && st !== "破軍星") c = moveStar(c, st, safe);
  for (const t of c.transformations) if (t.kind === "化忌星" && bad.includes(t.branch)) c = moveStar(c, t.star, safe);
  const p = byId(evaluatePatterns(c), "K2-16");
  check("英星入廟（人工例）煞星なしで成立", p.conditionMatched === true && p.breakConditions.every((x) => x.result === "clear") && p.status === "confirmed");
  const withPo = moveStar(c, "天空星", BRANCH_PO[m]);
  const p2 = byId(evaluatePatterns(withPo), "K2-16");
  check("英星入廟（人工例）煞星が破の位置で破格", p2.breakConditions.find((x) => x.text.includes("破）"))!.result === "broken" && p2.status === "not_applicable");
}

// 三奇嘉會: 基準宮＋三方四正
{
  const c = caseChart("三奇:命宮基準・本宮に三奇の1つ");
  const three = ["化禄星", "化権星", "化科星"].map((k) => hua(c, k));
  const p = byId(evaluatePatterns(c), "K2-19");
  check("三奇嘉會 基準宮（命宮）に三奇の1つがあっても成立", three.includes(c.mingPalace) && p.conditionMatched === true && p.matchedPalaces.some((x) => x.branch === c.mingPalace));
  const c2 = caseChart("三奇:命宮基準");
  check("三奇嘉會 命宮基準で成立", byId(evaluatePatterns(c2), "K2-19").matchedPalaces.some((x) => x.branch === c2.mingPalace));
  const c3 = caseChart("三奇:身宮基準のみ");
  const p3 = byId(evaluatePatterns(c3), "K2-19");
  check("三奇嘉會 身宮基準だけで成立（命宮で成立しなくてよい）", c3.shenPalace !== c3.mingPalace && p3.conditionMatched === true && p3.matchedPalaces.every((x) => x.branch === c3.shenPalace));
  const c4 = caseChart("三奇:弱");
  const p4 = byId(evaluatePatterns(c4), "K2-19");
  check("三奇嘉會 弱・最弱は warning（破格にしない）", p4.warningConditions.some((w) => w.text.includes("力量") && w.result === "applies") && p4.breakConditions.length === 0 && p4.status === "confirmed");
  check("三奇嘉會 warning の文は「格が崩れやすい」（破格しやすい。表示は独自文章）", p4.warningConditions.every((w) => w.text.includes("崩れやすい")));
}
// 石中隠玉: 5星すべて
{
  const c5 = caseChart("石中隠玉:核心+5星");
  const c4 = caseChart("石中隠玉:核心+4星");
  check("石中隠玉 5星すべてで成立", byId(evaluatePatterns(c5), "K2-10").conditionMatched === true && byId(evaluatePatterns(c5), "K2-10").status === "confirmed");
  check("石中隠玉 4星では不成立", byId(evaluatePatterns(c4), "K2-10").conditionMatched === false);
}
// 紫府朝垣: 条件1 OR 条件2
{
  const c1 = caseChart("紫府朝垣:条件1のみ");
  const p1 = byId(evaluatePatterns(c1), "K2-03");
  check("紫府朝垣 条件1単独で成立", p1.checks[0].result === true && p1.checks[1].result === false && p1.conditionMatched === true && p1.status === "confirmed");
  const c2 = caseChart("紫府朝垣:両方");
  check("紫府朝垣 両方で成立", byId(evaluatePatterns(c2), "K2-03").conditionMatched === true);
  // 条件2の配置（命宮申・紫微 子 または 辰）では、命宮と三方四正に武曲（吉星）が必ずあり条件1も満たす
  for (const z of ["子", "辰"] as const) {
    const pos = mainStarsOf(z);
    const area = ["申", ...sfOf("申")];
    check(`紫府朝垣 条件2（紫微 ${z}）では条件1も成立（武曲 ${pos["武曲星"]} が命宮申の範囲）`, area.includes(pos["紫微星"]) && area.includes(pos["天府星"]) && area.includes(pos["天相星"]) && area.includes(pos["武曲星"]));
  }
}
// 羊陀夾忌: 対宮は affectedPalaces
{
  const c = caseChart("羊陀夾忌");
  const p = byId(evaluatePatterns(c), "K2-32");
  const b = c.starPositions["禄存星"];
  check("羊陀夾忌 成立宮は禄存の宮", p.matchedPalaces.length === 1 && p.matchedPalaces[0].branch === b);
  check("羊陀夾忌 対宮は affectedPalaces（成立宮ではない）", p.affectedPalaces.length === 1 && p.affectedPalaces[0].branch === sanfangSizheng(b).opposite && p.affectedPalaces[0].from === b);
}
// 明珠出海・七殺朝斗: 吉星は入門 p.15 のまま（太陽・太陰を含む）
check("明珠出海・石中隠玉・七殺朝斗・紫府朝垣・三奇嘉會・英星入廟は verified", ["K2-04", "K2-10", "K2-17", "K2-03", "K2-19", "K2-16"].every((id) => !PATTERN_RULES.find((r) => r.id === id)!.sourceIssues.some((i) => i.blocking)));

const fail = failures.length;
console.log(report.join("\n"));
console.log(`\n格局: ${pass} / ${pass + fail} PASS`);
if (fail) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
