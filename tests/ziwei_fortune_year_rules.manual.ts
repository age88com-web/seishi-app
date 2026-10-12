// tests/ziwei_fortune_year_rules.manual.ts
//
// S33 羊陀夾忌の流年（＝小限）ルール（fortune/liunian.ts、§32）と
// S40 四化星と宮の喜忌（fortune/xijiEvaluate.ts、§33）の確認。
// 実行: npx tsx tests/ziwei_fortune_year_rules.manual.ts

import { readFileSync } from "node:fs";
import { calculateZiweiChart } from "../src/lib/ziwei";
import type { Branch, Stem, ZiweiChart } from "../src/lib/ziwei";
import { sanfangSizheng } from "../src/lib/ziwei/sanfang";
import {
  FORTUNE_TYPE_READINGS,
  LIUNIAN_DEFINITION,
  YANGTUO_LIUNIAN_TEXT,
  XIJI_RULES,
  XIJI_SOURCE,
  buildFortuneContextFor,
  buildFortunePalaceContext,
  evaluateLimitXiji,
  fortuneTypeOf,
  natalMatchedPatterns,
  parseAppraisalDate,
  selectionFromDate,
  withMajor,
  withMinor,
} from "../src/lib/ziwei/fortune";
import type { FortuneContext, FortuneSelection, LimitXijiResult } from "../src/lib/ziwei/fortune";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}
const ctxOf = (c: ZiweiChart, s: FortuneSelection): FortuneContext => buildFortuneContextFor(c, parseAppraisalDate(s.appraisalDate)!, s);
const ring = (b: Branch) => {
  const s = sanfangSizheng(b);
  return [...s.trines, s.opposite];
};

const charts: ZiweiChart[] = [];
for (let y = 1940; y < 2000; y += 1)
  charts.push(calculateZiweiChart({ birth: { year: y, month: ((y * 5) % 12) + 1, day: 3 + (y % 25), hour: (y * 7) % 24, minute: 0 }, place: "東京", sex: y % 2 ? "male" : "female" }));

// ---------------------------------------------------------------------------
// A. S33 羊陀夾忌の流年（＝小限）
// ---------------------------------------------------------------------------
check("流年＝小限（source_inference）", LIUNIAN_DEFINITION.flowYear.meaning === "小限" && LIUNIAN_DEFINITION.flowYear.definitionStatus === "source_inference");
check("流年化忌＝小限化忌（source_inference）", LIUNIAN_DEFINITION.flowYearJi.origin === "minor" && LIUNIAN_DEFINITION.flowYearJi.definitionStatus === "source_inference");
const seen = { met: 0, metTrine: 0, metOpposite: 0, selfOnly: 0, otherMinor: 0, taiseiOnly: 0, affectedOnly: 0, majorOrigin: 0, natalOrigin: 0 };
for (const c of charts) {
  const natalYtj = natalMatchedPatterns(c).filter((p) => p.id === "K2-32").flatMap((p) => p.matchedPalaces.map((m) => m.branch));
  for (const p of c.dayun.periods) {
    for (let age = p.startAge; age <= p.endAge; age += 1) {
      const s = withMinor(c, withMajor(c, selectionFromDate(c, "2030-01-01"), p.startAge), age);
      const f = ctxOf(c, s);
      const L = f.liunian;
      const majorYtj = f.majorPatterns.filter((x) => x.id === "K2-32" && x.conditionMatched).flatMap((x) => x.matchedPalaces.map((m) => m.branch));
      // 候補: 本命・大限の羊陀夾忌を origin つきで全部
      check("候補は本命＋大限の羊陀夾忌", L.candidates.length === natalYtj.length + majorYtj.length && L.candidates.filter((x) => x.origin === "natal").length === natalYtj.length);
      const mb = f.minorLimit!.palaceBranch;
      const minorJi = (b: Branch) => f.transformationsByBranch[b].some((t) => t.origin === "minor" && t.kind === "化忌星");
      for (const cand of L.candidates) {
        const expected = mb === cand.branch && ring(cand.branch).some(minorJi);
        check("S33 判定: 小限宮一致かつ三合宮・対宮に小限化忌", cand.met === expected);
        if (expected) {
          seen.met += 1;
          if (sanfangSizheng(cand.branch).trines.some(minorJi)) seen.metTrine += 1;
          if (minorJi(sanfangSizheng(cand.branch).opposite)) seen.metOpposite += 1;
          if (cand.origin === "major") seen.majorOrigin += 1;
          else seen.natalOrigin += 1;
        }
        if (mb === cand.branch && !ring(cand.branch).some(minorJi) && minorJi(cand.branch)) {
          seen.selfOnly += 1;
          check("本宮の小限化忌だけでは不成立", !cand.met);
        }
        if (mb !== cand.branch && ring(cand.branch).some(minorJi)) {
          seen.otherMinor += 1;
          check("小限宮が違えば不成立", !cand.met);
        }
        if (f.taisei.branch === cand.branch && mb !== cand.branch) {
          seen.taiseiOnly += 1;
          check("太歳宮の一致だけでは不成立", !cand.met);
        }
        if (mb === sanfangSizheng(cand.branch).opposite && ring(mb).some(minorJi)) {
          seen.affectedOnly += 1;
          check("対宮（affectedPalaces）に小限が巡っただけでは不成立", !cand.met);
        }
      }
      // 作用は成立したときだけ・資料の文だけ
      const metBranches = [...new Set(L.candidates.filter((x) => x.met).map((x) => x.branch))];
      check("作用は成立したときだけ", JSON.stringify(L.effects.map((e) => e.branch).sort()) === JSON.stringify(metBranches.sort()));
      check("表示文は資料の意味の独自文章だけ", L.effects.every((e) => e.text === YANGTUO_LIUNIAN_TEXT && e.type === "negative"));
      // 宮クリック: 成立した宮だけ
      for (const e of L.effects) {
        const pc = buildFortunePalaceContext(c, { appraisalDate: f.date, majorStartAge: s.majorStartAge, minorAge: s.minorAge }, e.branch);
        check("宮クリック: 成立した宮で作用", pc.liunianEffects.length === 1 && pc.branch === mb);
      }
    }
  }
}
console.log(`S33: ${JSON.stringify(seen)}`);
check("成立例（三合宮の小限化忌）がある", seen.metTrine > 0);
check("成立例（対宮の小限化忌）がある", seen.metOpposite > 0);
check("本宮だけの例がある", seen.selfOnly > 0);
check("小限宮が違う例がある", seen.otherMinor > 0);
check("太歳宮だけ一致の例がある", seen.taiseiOnly > 0);
check("大限の羊陀夾忌で成立例がある", seen.majorOrigin > 0);
{
  // 本命の羊陀夾忌での成立例（1941-10-06 01:00 男・数え3歳、酉）
  const c = calculateZiweiChart({ birth: { year: 1941, month: 10, day: 6, hour: 1, minute: 0 }, place: "東京", sex: "male" });
  const f = ctxOf(c, withMinor(c, selectionFromDate(c, "2030-01-01"), 3));
  const cand = f.liunian.candidates.find((x) => x.origin === "natal" && x.branch === "酉");
  check("本命の羊陀夾忌（酉）に小限が巡り成立", !!cand && cand.met && cand.minorArrives && cand.minorJiInSanfang.length > 0, JSON.stringify(cand));
  check("本命の羊陀夾忌: 作用は資料の文", f.liunian.effects.length === 1 && f.liunian.effects[0].origins.includes("natal") && f.liunian.effects[0].text === YANGTUO_LIUNIAN_TEXT);
  console.log(`本命の例: ${cand?.detail}`);
  // 同じ命盤で小限が別の年（数え4）なら不成立
  const g = ctxOf(c, withMinor(c, selectionFromDate(c, "2030-01-01"), 4));
  check("小限が別の宮なら不成立", g.liunian.effects.length === 0);
}

// ---------------------------------------------------------------------------
// B. S40 四化星と宮の喜忌
// ---------------------------------------------------------------------------
check("S40 は大限・小限に適用", JSON.stringify(XIJI_SOURCE.appliesTo) === JSON.stringify(["major", "minor"]));
check("己は資料にない", XIJI_RULES["己"] === undefined && XIJI_SOURCE.missingStems.includes("己"));
check("9干の原文", (["甲", "乙", "丙", "丁", "戊", "庚", "辛", "壬", "癸"] as Stem[]).every((s) => XIJI_RULES[s]));
check("規則は要約と独自の表示文（原文フィールドなし）", Object.values(XIJI_RULES).every((r) => !!r && !("sourceText" in r) && r.summary.length > 0 && r.displayText.length > 0) && XIJI_RULES["癸"]!.displayText.includes("貪狼"));

const byStem = new Map<Stem, { status: Record<string, number>; withReading: Record<string, number> }>();
const tally = (m: Record<string, number>, k: string) => (m[k] = (m[k] ?? 0) + 1);
const typeStats: Record<string, number> = {};
let mixedTried = 0;
for (const c of charts.slice(0, 30)) {
  for (const p of c.dayun.periods) {
    for (let age = p.startAge; age <= p.endAge; age += 3) {
      const f = ctxOf(c, withMinor(c, withMajor(c, selectionFromDate(c, "2030-01-01"), p.startAge), age));
      for (const [lim, x, pats] of [
        [f.majorLimit!, f.majorXiji!, f.majorPatterns],
        [f.minorLimit!, f.minorXiji!, f.minorPatterns],
      ] as const) {
        const r: LimitXijiResult = x;
        // 大限・小限は別々（自分の干・宮）
        check(`${lim.limitType}: 自分の干`, r.stem === lim.palaceStem && r.branch === lim.palaceBranch && r.origin === lim.limitType);
        const st = byStem.get(r.stem) ?? { status: {}, withReading: {} };
        tally(st.status, r.status);
        // 既定: タイプ未確定 → タイプ条件の干は断定しない
        if (r.rule?.kind === "typeConditional") check(`${r.stem}: タイプ未確定なら断定しない`, r.status === "needs_review" && r.displayText === null);
        if (r.stem === "己") check("己は needs_review", r.status === "needs_review" && r.rule === null && r.displayText === null);
        if (r.stem === "丁") check("丁: 刑忌夾印（この行運の化忌）で半吉半凶", r.status === "applies" && r.displayText === XIJI_RULES["丁"]!.displayText && r.displayText.includes("半々"));
        if (r.stem === "壬") check("壬: 紫微化権・武曲化忌", r.status === "applies" && r.conditionCheck!.ok);
        if (r.stem === "丙") check("丙: 廉貞化忌の会照を確認した結果", (r.status === "applies") === r.conditionCheck!.ok);
        // 生年四化を混ぜない: 層に生年四化を足しても結果が同じ
        const mixed = evaluateLimitXiji(c, { ...lim, transformations: [...lim.transformations, ...f.natalTransformations] }, pats);
        check("生年四化を混ぜない", JSON.stringify(mixed) === JSON.stringify(r));
        mixedTried += 1;
        // 読みを確定した場合の判定（ロジックの確認）
        for (const reading of FORTUNE_TYPE_READINGS) {
          const rr = evaluateLimitXiji(c, lim, pats, { fortuneTypeReading: reading });
          const t = fortuneTypeOf(c, lim.palaceBranch, reading).type;
          tally(typeStats, `${reading}:${t}`);
          if (rr.rule?.kind === "typeConditional") {
            const expected = t === "needs_review" ? "needs_review" : t !== rr.rule.requiredType ? "notApplicable" : rr.conditionCheck && !rr.conditionCheck.ok ? "needs_review" : "applies";
            check(`${rr.stem} ${reading}: タイプ確定時の判定`, rr.status === expected);
            if (reading === "withSelf_all") tally(st.withReading, rr.status + (rr.conditionCheck ? (rr.conditionCheck.ok ? "/条件○" : "/条件×") : ""));
          }
        }
        byStem.set(r.stem, st);
      }
      // 太歳には当てない
      check("太歳に喜忌を当てない", !("xiji" in f.taiseiInfluence) && !("xiji" in f.taisei));
    }
  }
}
check("生年四化の混入確認を実施", mixedTried > 0);
for (const s of ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as Stem[]) check(`${s}: 実例あり`, byStem.has(s));
for (const [s, v] of [...byStem].sort()) console.log(`S40 ${s}: 既定 ${JSON.stringify(v.status)}${Object.keys(v.withReading).length ? `／本宮を含め全部そろう読み ${JSON.stringify(v.withReading)}` : ""}`);
console.log(`行運のタイプ（読み別）: ${JSON.stringify(typeStats)}`);
{
  // 大限・小限で干が違えば結果も別
  const c = charts[0];
  const f = ctxOf(c, withMinor(c, withMajor(c, selectionFromDate(c, "2030-01-01"), c.dayun.periods[2].startAge), c.dayun.periods[2].startAge + 1));
  check("大限・小限は別評価（干が違う例）", f.majorXiji!.stem !== f.minorXiji!.stem || f.majorXiji!.branch !== f.minorXiji!.branch);
}
check("taiseiInfluence は S40 を参照しない", !/xiji/i.test(readFileSync("src/lib/ziwei/fortune/taiseiInfluence.ts", "utf8").replace(/^\/\/.*$/gm, "")));

const fail = failures.length;
console.log(`S33・S40: ${pass} / ${pass + fail} PASS`);
if (fail) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
