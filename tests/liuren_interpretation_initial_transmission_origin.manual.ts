// tests/liuren_interpretation_initial_transmission_origin.manual.ts
//
// 六壬神課 Phase 3Z（初伝の発用元メタデータ）のテスト。
// 実行: npx tsx tests/liuren_interpretation_initial_transmission_origin.manual.ts
//
//   1. 起課エンジンが記録した initialOrigin について、720課で
//      origin.branch＝初伝、uniqueLesson・ruleLesson の課の上神＝初伝、ambiguousLessons の全候補の上神＝初伝、derived に課なし
//   2. Phase 3Y の監査（エンジンの判定関数・涉害の候補の記録から候補の課を数えたもの）と1課ずつ一致すること
//      （方式 A の重複47課＝ambiguousLessons、伏吟 一課42・三課18＝ruleLesson、derived 47課）
//   3. BoardAnchor への変換（ambiguous は候補をすべて、derived は空）と、解釈層が起課結果をそのまま参照していること
//   4. 古典例（断案2 例35・43・50）の発用元。例38 は原文の課式と起課が合わないため照合しない
//   5. 求財（講座 p62「三課・四課が初伝で財」）の再監査: 一意に三課・四課・候補に三課・四課を含むもの を分けて数える

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, InitialTransmissionOrigin, LiurenChart, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { controls } from "../src/lib/liuren/relations";
import { isZei, isKe } from "../src/lib/liuren/sanchuan/context";
import { FUYIN_GAN_FIRST } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { initialOriginOf, originLessonAnchors } from "../src/lib/liuren/interpretation/initialTransmissionOrigin";
import { anchorResolutionContextOf, resolveAnchor } from "../src/lib/liuren/interpretation/anchorResolver";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };

/** Phase 3Y の監査と同じ方法で候補の課を数える（照合用。本番では使わない） */
function phase3y(chart: LiurenChart): { kind: string; lessons: number[] } {
  const s = chart.sanchuan;
  if (s.status !== "determined") return { kind: "undetermined", lessons: [] };
  const ls = chart.lessons;
  const init = s.initial;
  const withInitial = (xs: readonly { index: number; upper: string }[]) => xs.filter((l) => l.upper === init).map((l) => l.index);
  const zeike = () => { const z = ls.filter(isZei); return withInitial(z.length ? z : ls.filter(isKe)); };
  const lessonsKind = (xs: number[]) => ({ kind: xs.length === 1 ? "uniqueLesson" : "ambiguousLessons", lessons: xs });
  switch (s.method) {
    case "重審": case "元首": case "比用": return lessonsKind(zeike());
    case "涉害": return lessonsKind(withInitial((s.shehai ?? []).map((t) => ({ index: t.lessonIndex, upper: t.upper }))));
    case "遥剋": return lessonsKind(withInitial(ls.filter((l) => controls(l.upper, chart.input.dayStem) || controls(chart.input.dayStem, l.upper))));
    case "返吟": return s.pattern === "無依格" ? lessonsKind(zeike()) : { kind: "derived", lessons: [] };
    case "伏吟": return { kind: "ruleLesson", lessons: [FUYIN_GAN_FIRST.includes(chart.input.dayStem) ? 1 : 3] };
    default: return { kind: "derived", lessons: [] };
  }
}
const lessonsOf = (o: InitialTransmissionOrigin): number[] =>
  o.kind === "uniqueLesson" || o.kind === "ruleLesson" ? [o.lesson] : o.kind === "ambiguousLessons" ? [...o.lessons] : [];

// ---- 1〜3・5. 720課 ----
const kindCount: Record<string, number> = {};
const byMethod: Record<string, Record<string, number>> = {};
const fuyin: Record<string, number> = {};
const derivedByMethod: Record<string, number> = {};
const wealth = { 一意に三課: 0, 一意に四課: 0, 一意に三課四課で妻財: 0, ambiguousに三課か四課を含む: 0, ambiguousに含み妻財: 0, ruleLessonの三課: 0 };
let mismatch3y = 0;
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const tag = `${STEMS[i % 10]}${BRANCHES[i % 12]}+${o}`;
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const s = chart.sanchuan;
    if (s.status !== "determined") { check(`${tag} 確定`, false); continue; }
    const origin = s.initialOrigin;
    const facts = buildInterpretationFacts(chart);
    // 1. 構造の確認
    const ls = lessonsOf(origin);
    const ok = origin.branch === s.initial && origin.branch === chart.transmissions![0].branch &&
      ls.every((x) => chart.lessons[x - 1].upper === s.initial) &&
      (origin.kind === "derived" ? !("lesson" in origin) && !("lessons" in origin) : ls.length >= 1) &&
      (origin.kind !== "ambiguousLessons" || ls.length >= 2) &&
      (origin.kind !== "ruleLesson" || (origin.lesson === 1 ? origin.rule === "dayStemUpper" : origin.rule === "dayBranchUpper"));
    if (!ok) check(`${tag} 発用元の構造`, false, JSON.stringify(origin));
    // method は結果の method と同じ（返吟の無依格だけは初伝を選んだ賊剋法の方式）
    const methodOk = s.method === "返吟" && s.pattern === "無依格" ? ["重審", "元首", "比用", "涉害"].includes(origin.method) : origin.method === s.method;
    if (!methodOk) check(`${tag} method`, false, `${origin.method} / ${s.method}`);
    // 2. Phase 3Y の監査と一致
    const y = phase3y(chart);
    if (y.kind !== origin.kind || y.lessons.join() !== ls.join()) { mismatch3y += 1; check(`${tag} Phase 3Y と一致`, false, `${JSON.stringify(y)} / ${JSON.stringify(origin)}`); }
    // 3. 解釈層は起課結果をそのまま参照し、anchor へ変換できる
    const ctx = anchorResolutionContextOf(facts);
    const anchors = originLessonAnchors(origin);
    if (initialOriginOf(facts) !== origin || anchors.length !== ls.length || !anchors.every((a) => resolveAnchor(a, ctx)?.kind === "lesson")) {
      check(`${tag} anchor`, false);
    }
    // 集計
    inc(kindCount, origin.kind);
    const key = `${s.method}${s.pattern ? `・${s.pattern}` : ""}`;
    byMethod[key] ??= {};
    inc(byMethod[key], origin.kind === "uniqueLesson" || origin.kind === "ruleLesson" ? `${origin.kind}:lesson${origin.lesson}` : origin.kind);
    if (s.method === "伏吟" && origin.kind === "ruleLesson") inc(fuyin, `lesson${origin.lesson}`);
    if (origin.kind === "derived") inc(derivedByMethod, key);
    const wife = (x: number) => facts.lessons[x - 1].relation === "妻財"; // 六親は解釈層の FACT から
    if (origin.kind === "uniqueLesson" && origin.lesson === 3) wealth.一意に三課 += 1;
    if (origin.kind === "uniqueLesson" && origin.lesson === 4) wealth.一意に四課 += 1;
    if (origin.kind === "uniqueLesson" && [3, 4].includes(origin.lesson) && wife(origin.lesson)) wealth.一意に三課四課で妻財 += 1;
    if (origin.kind === "ambiguousLessons" && origin.lessons.some((x) => x === 3 || x === 4)) {
      wealth.ambiguousに三課か四課を含む += 1;
      if (origin.lessons.some((x) => (x === 3 || x === 4) && wife(x))) wealth.ambiguousに含み妻財 += 1;
    }
    if (origin.kind === "ruleLesson" && origin.lesson === 3) wealth.ruleLessonの三課 += 1;
  }
}
check("Phase 3Y の監査と720課すべて一致", mismatch3y === 0, String(mismatch3y));
check("ambiguousLessons＝47課（Phase 3Y の重複課）", kindCount.ambiguousLessons === 47, String(kindCount.ambiguousLessons));
check("伏吟 ruleLesson 一課42・三課18", fuyin.lesson1 === 42 && fuyin.lesson3 === 18, JSON.stringify(fuyin));
check("derived＝47課", kindCount.derived === 47, String(kindCount.derived));

// ---- 4. 古典例 ----
const classics: string[] = [];
for (const [id, day, jiang, shi, expected, text] of [
  ["例35", "丁卯", "子", "卯", 3, "三課が発用"], ["例43", "丁丑", "午", "未", 3, "支上初伝"], ["例50", "戊寅", "申", "未", 4, "四課発伝"],
] as [string, string, Branch, Branch, number, string][]) {
  const chart = calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang });
  const o = (chart.sanchuan as { initialOrigin: InitialTransmissionOrigin }).initialOrigin;
  check(`断案2 ${id}（${text}）＝uniqueLesson lesson${expected}`, o.kind === "uniqueLesson" && o.lesson === expected, JSON.stringify(o));
  classics.push(`${id} ${day}日 ${jiang}将${shi}時: ${JSON.stringify(o)} ／ 原文「${text}」`);
}

console.log("発用元の種類（720課）:", JSON.stringify(kindCount));
console.log("方式 × 発用元:");
for (const [k, v] of Object.entries(byMethod)) console.log(`  ${k}: ${Object.entries(v).map(([a, n]) => `${a} ${n}`).join(" / ")}`);
console.log(`伏吟: ${JSON.stringify(fuyin)} ／ derived の方式: ${JSON.stringify(derivedByMethod)}`);
console.log("古典例:");
for (const c of classics) console.log(`  ${c}`);
console.log(`求財（講座 p62）の再監査: ${JSON.stringify(wealth)}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
