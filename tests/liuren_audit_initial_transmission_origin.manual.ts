// tests/liuren_audit_initial_transmission_origin.manual.ts
//
// 六壬神課 Phase 3Y: 初伝の発用元の監査（監査専用。本番 FACT・起課エンジンは変更しない）。
// 実行: npx tsx tests/liuren_audit_initial_transmission_origin.manual.ts
//
//   起課エンジン（src/lib/liuren/sanchuan）の初伝の決め方を、方式（method・pattern）ごとに分類する:
//     A. 四課の候補から選ぶ … 重審・元首・比用（zeike.ts）、涉害（shehai.ts）、遥剋（yaoke.ts）、返吟の無依格
//        エンジンは選んだ「支」だけを返し、どの課から選んだか（課の番号）は返さない。
//        構造として課の番号が残るのは涉害の候補の記録（ShehaiCandidateTrace.lessonIndex）だけ。
//     B. 規則で一課・三課の上神を取る … 伏吟（干上神か支上神）、涉害の綴瑕格の最終判定（陽日は干上神、陰日は支上神）
//     C. 四課の上神ではない規則で決める … 昴星（酉の上下）、別責（干合の寄宮の上神・三合の次の支）、
//        八専（一課・四課の上神から2つ動かす）、返吟の無親格（驛馬・巳）
//   監査のためだけに、エンジンの isZei・isKe・涉害の候補の記録を読み、「初伝と同じ上神をもつ候補の課」が
//   1つに決まるか（重複課なら複数）を数える。trace の文章は読まない。

import { calculateLiuren } from "../src/lib/liuren";
import type { LiurenChart } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { controls } from "../src/lib/liuren/relations";
import { isZei, isKe } from "../src/lib/liuren/sanchuan/context";
import { FUYIN_GAN_FIRST } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };

type Category = "A 四課の候補から選ぶ" | "B 規則で一課・三課の上神" | "C 四課の上神ではない規則";
type Audit = { category: Category; originLessons: number[] | null; note: string };

/** 監査用: 方式ごとに「初伝と同じ上神をもつ候補の課」を求める（エンジンの判定関数・候補の記録を読むだけ） */
function auditOrigin(chart: LiurenChart): Audit {
  const s = chart.sanchuan;
  if (s.status !== "determined") return { category: "C 四課の上神ではない規則", originLessons: null, note: "未確定" };
  const ls = chart.lessons;
  const init = s.initial;
  const withInitial = (xs: readonly { index: number; upper: string }[]) => xs.filter((l) => l.upper === init).map((l) => l.index);
  const zeikeCandidates = () => {
    const zei = ls.filter(isZei);
    return zei.length ? zei : ls.filter(isKe);
  };
  switch (s.method) {
    case "重審": case "元首": case "比用":
      return { category: "A 四課の候補から選ぶ", originLessons: withInitial(zeikeCandidates()), note: "isZei・isKe の候補" };
    case "涉害":
      if (s.pattern === "綴瑕格" && s.shehai && !s.shehai.some((t) => t.upper === init)) {
        return { category: "B 規則で一課・三課の上神", originLessons: null, note: "綴瑕格 最終判定（候補外）" };
      }
      return { category: "A 四課の候補から選ぶ", originLessons: withInitial((s.shehai ?? []).map((t) => ({ index: t.lessonIndex, upper: t.upper }))), note: "涉害の候補の記録（lessonIndex）" };
    case "遥剋": {
      const day = chart.input.dayStem;
      const cands = ls.filter((l) => controls(l.upper, day) || controls(day, l.upper));
      return { category: "A 四課の候補から選ぶ", originLessons: withInitial(cands), note: "日干と相剋する上神" };
    }
    case "返吟":
      if (s.pattern === "無依格") return { category: "A 四課の候補から選ぶ", originLessons: withInitial(zeikeCandidates()), note: "無依格（賊剋）" };
      return { category: "C 四課の上神ではない規則", originLessons: null, note: "無親格（驛馬・巳）" };
    case "伏吟": {
      const gan = FUYIN_GAN_FIRST.includes(chart.input.dayStem);
      return { category: "B 規則で一課・三課の上神", originLessons: [gan ? 1 : 3], note: gan ? "干上神" : "支上神" };
    }
    default:
      return { category: "C 四課の上神ではない規則", originLessons: null, note: s.method };
  }
}

const byMethod: Record<string, Record<string, number>> = {};
const categoryCount: Record<string, number> = {};
const originDist: Record<string, number> = {};
const duplicates: Record<string, number> = {};
const dupExamples: string[] = [];
const ambiguous: string[] = [];
let lesson3or4Unique = 0;
let lesson3or4UniqueWife = 0;
let lesson3or4Any = 0;
let mismatch = 0;
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`;
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const facts = buildInterpretationFacts(chart);
    const s = chart.sanchuan;
    if (s.status !== "determined") continue;
    const a = auditOrigin(chart);
    const key = `${s.method}${s.pattern ? `・${s.pattern}` : ""}`;
    byMethod[key] ??= {};
    inc(categoryCount, a.category);
    // 初伝と同じ上神をもつ課の数（候補かどうかを問わない）
    const same = chart.lessons.filter((l) => l.upper === s.initial).map((l) => l.index);
    inc(duplicates, `${same.length}課`);
    if (same.length >= 2 && dupExamples.length < 6) dupExamples.push(`${day}日 天盤差${o} 初伝${s.initial}（${key}） 同じ上神の課 ${same.join("・")}`);
    let originKey: string;
    if (a.originLessons === null) originKey = a.category.startsWith("B") ? `B ${a.note}` : "derived/other";
    else if (a.originLessons.length === 1) originKey = `lesson${a.originLessons[0]}`;
    else if (a.originLessons.length === 0) { originKey = "候補に一致なし"; mismatch += 1; }
    else {
      originKey = `複数（${a.originLessons.map((x) => `lesson${x}`).join("・")}）`;
      if (ambiguous.length < 6) ambiguous.push(`${day}日 天盤差${o} 初伝${s.initial}（${key}） 候補の課 ${a.originLessons.join("・")}`);
    }
    inc(originDist, originKey);
    inc(byMethod[key], originKey);
    if (a.originLessons?.length === 1 && [3, 4].includes(a.originLessons[0])) {
      lesson3or4Unique += 1;
      if (facts.lessons[a.originLessons[0] - 1].relation === "妻財") lesson3or4UniqueWife += 1;
    }
    if (a.originLessons?.some((x) => x === 3 || x === 4)) lesson3or4Any += 1;
    // 候補の課の上神は初伝と一致する（定義上）
    if (a.originLessons && !a.originLessons.every((x) => chart.lessons[x - 1].upper === s.initial)) check(`${day}+${o} 候補の上神＝初伝`, false);
  }
}
check("候補の課の中に初伝と同じ上神が必ずある（A 分類）", mismatch === 0, String(mismatch));

console.log("方式ごとの分類（720課）:");
for (const [k, v] of Object.entries(categoryCount)) console.log(`  ${k}: ${v}`);
console.log("発用元の分布（監査での復元。本番 FACT ではない）:");
for (const [k, v] of Object.entries(originDist).sort((x, y) => y[1] - x[1])) console.log(`  ${k}: ${v}`);
console.log("方式 × 発用元:");
for (const [m, v] of Object.entries(byMethod)) console.log(`  ${m}: ${Object.entries(v).map(([k, n]) => `${k} ${n}`).join(" / ")}`);
console.log(`初伝と同じ上神をもつ課の数: ${Object.entries(duplicates).sort().map(([k, v]) => `${k} ${v}`).join(" / ")}`);
for (const e of dupExamples) console.log(`    ${e}`);
console.log("候補の課が複数（重複課）で、課の番号を1つに決められない例:");
for (const e of ambiguous) console.log(`    ${e}`);
console.log(`三課・四課のどちらか1つに決まる発用: ${lesson3or4Unique}課（うち上神が妻財 ${lesson3or4UniqueWife}課） ／ 候補に三課・四課を含む: ${lesson3or4Any}課`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
