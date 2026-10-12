// tests/ziwei_taisei_influence.manual.ts
//
// 太歳宮による年運補助レイヤー（src/lib/ziwei/fortune/taiseiInfluence.ts。重なりだけ）の確認。docs/ziwei-basic-spec.md §31。
// 実行: npx tsx tests/ziwei_taisei_influence.manual.ts

import { readFileSync } from "node:fs";
import { calculateZiweiChart } from "../src/lib/ziwei";
import type { Branch, ZiweiChart } from "../src/lib/ziwei";
import { STAR_LUCK } from "../src/lib/ziwei/patterns/luck";
import { evaluatePatterns } from "../src/lib/ziwei/patterns/evaluate";
import {
  buildFortuneContextFor,
  buildFortunePalaceContext,
  parseAppraisalDate,
  selectionFromDate,
  taiseiRelationOf,
  withMajor,
  withMinor,
} from "../src/lib/ziwei/fortune";
import type { FortuneContext, FortuneSelection } from "../src/lib/ziwei/fortune";
import { buildFortuneStarMeaningContext } from "../src/lib/ziwei/meanings/fortune";
import { buildFortuneTransformationContext } from "../src/lib/ziwei/meanings/fortune-transformations";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}

const BRANCHES: Branch[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const S38 = calculateZiweiChart({ birth: { year: 1965, month: 1, day: 10, hour: 0, minute: 0 }, place: "東京", sex: "male" });
const ctxOf = (c: ZiweiChart, s: FortuneSelection): FortuneContext => buildFortuneContextFor(c, parseAppraisalDate(s.appraisalDate)!, s);
// ---------------------------------------------------------------------------
// 1. 太歳宮・三方四正・関係
// ---------------------------------------------------------------------------
{
  const f = ctxOf(S38, selectionFromDate(S38, "2008-07-01")); // 戊子年
  const ti = f.taiseiInfluence;
  check("太歳宮＝年支（既存の太歳）", ti.taiseiBranch === f.taisei.branch && ti.taiseiBranch === "子" && f.taisei.yearStem === "戊");
  check("太歳宮の本命の宮名", ti.taiseiPalace === S38.palaces.find((p) => p.branch === "子")!.name);
  check("三合2宮（辰・申）", JSON.stringify(ti.sanfangSizheng.trines.map((c) => c.palace.branch).sort()) === JSON.stringify(["申", "辰"].sort()));
  check("対宮（午）", ti.sanfangSizheng.opposite.palace.branch === "午");
  check("branches は三合2宮＋対宮（太歳宮を含まない）", ti.sanfangSizheng.branches.length === 3 && !ti.sanfangSizheng.branches.includes("子"));
  check("関係: 太歳宮 same_palace", ti.samePalace.palace.relation === "same_palace");
  check("関係: 三合 trine", ti.sanfangSizheng.trines.every((c) => c.palace.relation === "trine"));
  check("関係: 対宮 opposite", ti.sanfangSizheng.opposite.palace.relation === "opposite");
  for (const t of BRANCHES)
    for (const b of BRANCHES) {
      const r = taiseiRelationOf(t, b);
      const d = (BRANCHES.indexOf(b) - BRANCHES.indexOf(t) + 12) % 12;
      check(`関係 ${t}→${b}`, r === (d === 0 ? "same_palace" : d === 6 ? "opposite" : d === 4 || d === 8 ? "trine" : null));
    }
  check("4宮の relation は3種類を区別", new Set([ti.samePalace, ...ti.sanfangSizheng.trines, ti.sanfangSizheng.opposite].map((c) => c.palace.relation)).size === 3);
  // 小限は別の層（置き換えない）
  check("小限は別の層で保持", ti.minorLimit !== null && ti.minorLimit.branch === f.minorLimit!.palaceBranch && ti.minorLimit.age === 45);
  check("太歳と小限は別の宮（2008年 S38）", ti.minorLimit!.branch !== ti.taiseiBranch);
  check("宮の大限・小限の宮名も持つ", ti.samePalace.palace.majorPalace !== null && ti.samePalace.palace.minorPalace !== null);
}

// ---------------------------------------------------------------------------
// 2. 四化3層・星・吉凶・格局（多数の命盤・鑑定日）
// ---------------------------------------------------------------------------
let tripleJi = 0;
let natalPatternHits = 0;
let fortunePatternHits = 0;
const charts: ZiweiChart[] = [S38];
for (let y = 1950; y < 2000; y += 7) charts.push(calculateZiweiChart({ birth: { year: y, month: (y % 12) + 1, day: 8, hour: y % 24, minute: 0 }, place: "東京", sex: y % 2 ? "male" : "female" }));
for (const c of charts) {
  const natal = evaluatePatterns(c).patterns.filter((p) => p.conditionMatched === true);
  for (let year = c.chartDate.year + 15; year < c.chartDate.year + 60; year += 3) {
    const s = selectionFromDate(c, `${year}-08-01`);
    if (s.minorAge === null) continue;
    const f = ctxOf(c, s);
    const ti = f.taiseiInfluence;
    const area = [ti.samePalace, ...ti.sanfangSizheng.trines, ti.sanfangSizheng.opposite];
    for (const box of area) {
      const b = box.palace.branch;
      const layers = f.transformationsByBranch[b];
      check("四化: 層のまま全部", box.transformations.length === layers.length && layers.every((l) => box.transformations.some((x) => x.origin === l.origin && x.star === l.star && x.type === l.kind.slice(0, 2))));
      check("四化: relation", box.transformations.every((x) => x.relation === box.palace.relation && x.branch === b));
      const stars = c.palaces.find((p) => p.branch === b)!.stars;
      check("星: 宮の星すべて", JSON.stringify(box.stars.map((x) => x.star)) === JSON.stringify(stars));
      check("星: 吉凶は既存の分類", box.stars.every((x) => x.luck === STAR_LUCK[x.star]));
      const ji = box.transformations.filter((x) => x.type === "化忌");
      if (new Set(ji.map((x) => x.origin)).size >= 2) tripleJi += 1;
      // 本命格局
      const nExp = natal.filter((p) => p.matchedPalaces.some((m) => m.branch === b) || p.affectedPalaces.some((m) => m.branch === b)).map((p) => p.id);
      const nGot = [...new Set(box.patterns.filter((x) => x.layer === "natal").map((x) => x.id))];
      check("本命格局との位置関係", JSON.stringify(nExp.sort()) === JSON.stringify(nGot.sort()), `${b} ${nExp} / ${nGot}`);
      natalPatternHits += nGot.length;
      // 行運格局
      const fExp = [...f.majorPatterns, ...f.minorPatterns].filter((p) => p.conditionMatched && (p.matchedPalaces.some((m) => m.branch === b) || p.affectedPalaces.some((m) => m.branch === b)));
      const fGot = box.patterns.filter((x) => x.layer !== "natal");
      check("行運格局との位置関係", fExp.every((p) => fGot.some((x) => x.id === p.id && x.layer === p.origin)) && fGot.every((x) => fExp.some((p) => p.id === x.id && p.origin === x.layer)));
      fortunePatternHits += fGot.length;
    }
    check("overlaps は4宮の重なりの合計", ti.overlaps.length === area.reduce((n, x) => n + x.transformations.length + x.stars.length + x.patterns.length, 0));
    // 太歳層は重なりだけ（増強の判定・ルールを持たない）
    check("太歳層に増強の判定がない", !("amplifications" in ti) && !("ruleCandidates" in ti));
  }
}
check("同じ宮で化忌の層が2つ以上（統合しない）を確認した", tripleJi > 0, `${tripleJi}`);
check("本命格局が太歳の範囲に入る例がある", natalPatternHits > 0);
check("行運格局が太歳の範囲に入る例がある", fortunePatternHits > 0);
console.log(`化忌の層が重なる宮: ${tripleJi}・本命格局: ${natalPatternHits}・行運格局: ${fortunePatternHits}`);

// ---------------------------------------------------------------------------
// 3. 羊陀夾忌の流年ルール（S33）は太歳層ではなく流年＝小限の層（§32。tests/ziwei_fortune_year_rules.manual.ts）
// ---------------------------------------------------------------------------
check("S33 は太歳層で判定しない", !/YANGTUO|yangtuo|流年化忌/.test(readFileSync("src/lib/ziwei/fortune/taiseiInfluence.ts", "utf8").replace(/^\/\/.*$/gm, "")));

// ---------------------------------------------------------------------------
// 5. 他のレイヤーを変えない
// ---------------------------------------------------------------------------
{
  // 鑑定日（太歳）だけ変えて、大限・小限は同じ選択 → 星曜象意・四化象意は同じ
  const base = withMinor(S38, withMajor(S38, selectionFromDate(S38, "2008-07-01"), 42), 45);
  const other = { ...base, appraisalDate: "2011-07-01" };
  check("太歳が変わる", ctxOf(S38, base).taisei.branch !== ctxOf(S38, other).taisei.branch);
  for (const b of BRANCHES) {
    const a1 = buildFortunePalaceContext(S38, { appraisalDate: parseAppraisalDate(base.appraisalDate)!, majorStartAge: 42, minorAge: 45 }, b);
    const a2 = buildFortunePalaceContext(S38, { appraisalDate: parseAppraisalDate(other.appraisalDate)!, majorStartAge: 42, minorAge: 45 }, b);
    check(`${b}: 行運星曜象意は太歳で変わらない`, JSON.stringify(buildFortuneStarMeaningContext(S38, a1)) === JSON.stringify(buildFortuneStarMeaningContext(S38, a2)));
    check(`${b}: 行運四化象意は太歳で変わらない`, JSON.stringify(buildFortuneTransformationContext(a1)) === JSON.stringify(buildFortuneTransformationContext(a2)));
    check(`${b}: 宮クリックの太歳との関係`, a1.taiseiRelation === taiseiRelationOf(a1.fortune.taisei.branch, b));
  }
  check("S40 喜忌は太歳に当てない", !/xiji|XIJI/i.test(readFileSync("src/lib/ziwei/fortune/taiseiInfluence.ts", "utf8").replace(/^\/\/.*$/gm, "")));
  check("行運星曜象意は太歳層を参照しない", !/taisei/i.test(readFileSync("src/lib/ziwei/meanings/fortune/evaluate.ts", "utf8")));
  check("行運四化象意は太歳層を参照しない", !/taisei/i.test(readFileSync("src/lib/ziwei/meanings/fortune-transformations/interpretation.ts", "utf8")));
  const before = JSON.stringify(S38);
  ctxOf(S38, base);
  check("本命盤を変更しない", JSON.stringify(S38) === before);
}

const fail = failures.length;
console.log(`太歳の年運補助: ${pass} / ${pass + fail} PASS`);
if (fail) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
