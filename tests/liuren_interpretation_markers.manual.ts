// tests/liuren_interpretation_markers.manual.ts
//
// 六壬神課 解釈エンジン Phase 3D（進間・日徳・日禄・旬丁・驛馬）のテスト。
// 実行: npx tsx tests/liuren_interpretation_markers.manual.ts
//
//   1. 進間: +2・+2 の12配列。進茹・退茹・退間は従来どおり
//   2. 日徳・日禄: 十干すべて
//   3. 旬丁: 六十甲子すべて（旬首から4番目＝丁の支。resolveXun の遁干と矛盾しない）
//   4. 驛馬: 十二日支すべて（申子辰→寅・寅午戌→申・亥卯未→巳・巳酉丑→亥）。既存 YIMA と一致
//   5. 出現位置: 四課上神・初伝・中伝・末伝、空亡の保持、三伝未確定
//   6. 720課の監査: 進退5分類、初伝が日徳・日禄・旬丁・驛馬の件数、初伝驛馬かつ空亡の件数

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { YIMA } from "../src/lib/liuren/constants";
import { resolveXun } from "../src/lib/liuren/relations";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { analyzeTransmissionFlow } from "../src/lib/liuren/interpretation/flow";
import {
  branchMarker, dayMarkersOf, daySalaryOf, dayVirtueOf, xunDingOf, yimaOf,
} from "../src/lib/liuren/interpretation/markers";
import type {
  BranchMarker, InterpretationFacts, LessonFact, TransmissionFact, TransmissionFlow,
} from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

function factsOf(day: string, monthGeneral: Branch = "卯"): InterpretationFacts {
  return buildInterpretationFacts(calculateLiuren({
    dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: "子", monthGeneral,
  }));
}

/** 四課上神・三伝の支・空亡だけを差し替えた FACT（日干支と旬・空亡は実際の課のまま） */
function withBoard(base: InterpretationFacts, uppers: string, ts: string, voids: [boolean, boolean, boolean]): InterpretationFacts {
  const lessons = base.lessons.map((l, i): LessonFact => ({ ...l, upper: uppers[i] as Branch }));
  const t = [...ts].map((b, i): TransmissionFact => ({ ...base.transmissions![i], branch: b as Branch, isVoid: voids[i] }));
  return {
    ...base,
    lessons: [lessons[0], lessons[1], lessons[2], lessons[3]],
    transmissions: [t[0], t[1], t[2]],
  };
}

// ---- 1. 進間 ----
{
  const base = factsOf("甲子");
  const flowOf = (b: string): TransmissionFlow => {
    const r = analyzeTransmissionFlow(withBoard(base, "子子子子", b, [false, false, false]));
    if (r.status !== "determined") throw new Error("確定のはず");
    return r;
  };
  for (const b of ["子寅辰", "丑卯巳", "寅辰午", "卯巳未", "辰午申", "巳未酉", "午申戌", "未酉亥", "申戌子", "酉亥丑", "戌子寅", "亥丑卯"]) {
    const got = flowOf(b).movementPattern;
    check(`進間 ${b}`, got === "進間", got);
  }
  for (const [b, m] of [["寅卯辰", "進茹"], ["亥子丑", "進茹"], ["辰卯寅", "退茹"], ["丑子亥", "退茹"],
    ["亥酉未", "退間"], ["寅子戌", "退間"], ["子寅卯", "その他"], ["子寅子", "その他"]] as const) {
    const got = flowOf(b).movementPattern;
    check(`従来の判定 ${b}＝${m}`, got === m, got);
  }
}

// ---- 2. 日徳・日禄 ----
const VIRTUE: Record<Stem, Branch> = { 甲: "寅", 己: "寅", 乙: "申", 庚: "申", 丙: "巳", 辛: "巳", 丁: "亥", 壬: "亥", 戊: "巳", 癸: "巳" };
const SALARY: Record<Stem, Branch> = { 甲: "寅", 乙: "卯", 丙: "巳", 丁: "午", 戊: "巳", 己: "午", 庚: "申", 辛: "酉", 壬: "亥", 癸: "子" };
for (const s of STEMS) {
  check(`日徳 ${s}＝${VIRTUE[s]}`, dayVirtueOf(s) === VIRTUE[s], dayVirtueOf(s));
  check(`日禄 ${s}＝${SALARY[s]}`, daySalaryOf(s) === SALARY[s], daySalaryOf(s));
}

// ---- 3. 旬丁 ----
for (let i = 0; i < 60; i++) {
  const s = STEMS[i % 10];
  const b = BRANCHES[i % 12];
  // 旬首（甲）は六十甲子で i − (i mod 10) 番目、丁はその3つ後
  const expected = BRANCHES[(i - (i % 10) + 3) % 12];
  const got = xunDingOf(s, b);
  const xun = resolveXun(s, b);
  check(`旬丁 ${s}${b}＝${expected}`, got === expected && xun.hiddenStemOf(got) === "丁" && !xun.voidBranches.includes(got),
    `${got}（${xun.xunHead}旬）`);
}

// ---- 4. 驛馬 ----
const YIMA_EXPECTED: [string, Branch][] = [["申子辰", "寅"], ["寅午戌", "申"], ["亥卯未", "巳"], ["巳酉丑", "亥"]];
for (const [group, horse] of YIMA_EXPECTED) {
  for (const b of [...group] as Branch[]) {
    check(`驛馬 ${b}＝${horse}`, yimaOf(b) === horse && YIMA[b] === horse, yimaOf(b));
  }
}

// ---- 5. 出現位置 ----
{
  // 甲戌日: 旬は甲戌旬で空亡は申酉。日徳・日禄＝寅、旬丁＝丑、驛馬（戌）＝申（空亡）
  const base = factsOf("甲戌");
  check("甲戌日 空亡＝申酉", base.xun.voidBranches.join("") === "申酉", base.xun.voidBranches.join(""));
  const f = withBoard(base, "申寅申丑", "申寅丑", [true, false, false]);
  const m = dayMarkersOf(f);
  const same = (x: BranchMarker, lessons: string, ts: string) => {
    const l = x.lessons.map((o) => `${o.index}${o.isVoid ? "空" : ""}`).join(",");
    const t = (x.transmissions ?? []).map((o) => `${o.position}${o.isVoid ? "空" : ""}`).join(",");
    return [l === lessons && t === ts, `四課 ${l} / 三伝 ${t}`] as const;
  };
  check("驛馬 種類・基準・支", m.yima.kind === "yima" && m.yima.basis === "dayBranch" && m.yima.branch === "申" && m.yima.isVoid);
  check("驛馬 出現（一課・三課・初伝、すべて空亡）", ...same(m.yima, "1空,3空", "initial空"));
  check("日徳 出現（二課・中伝）", m.dayVirtue.kind === "dayVirtue" && m.dayVirtue.basis === "dayStem" && m.dayVirtue.branch === "寅" &&
    !m.dayVirtue.isVoid && same(m.dayVirtue, "2", "middle")[0], same(m.dayVirtue, "2", "middle")[1]);
  check("日禄 出現（二課・中伝）", m.daySalary.branch === "寅" && same(m.daySalary, "2", "middle")[0], same(m.daySalary, "2", "middle")[1]);
  check("旬丁 出現（四課・末伝）", m.xunDing.basis === "dayXun" && m.xunDing.branch === "丑" && same(m.xunDing, "4", "final")[0],
    same(m.xunDing, "4", "final")[1]);

  // 中伝・末伝・複数の伝
  const g = withBoard(base, "子子子子", "寅申申", [false, true, true]);
  check("驛馬 中伝・末伝（空亡）", ...same(dayMarkersOf(g).yima, "", "middle空,final空"));
  check("驛馬 四課になし", dayMarkersOf(g).yima.lessons.length === 0);
  check("日徳 初伝", ...same(dayMarkersOf(g).dayVirtue, "", "initial"));

  // 三伝の isVoid は facts.transmissions の値をそのまま持つ
  const h = withBoard(base, "寅子子子", "寅子寅", [true, false, false]);
  check("三伝の isVoid は三伝の値", ...same(dayMarkersOf(h).dayVirtue, "1", "initial空,final"));

  // 三伝未確定
  const u = dayMarkersOf({ ...f, transmissions: null });
  check("三伝未確定 → transmissions null・四課は残る", u.yima.transmissions === null && u.yima.lessons.length === 2);

  // 共通関数で別の基準の馬も同じ形で作れる（今回は構造の確認だけ）
  const other = branchMarker(f, "yima", "dayBranch", yimaOf("寅"));
  check("branchMarker 共通関数", other.branch === "申" && other.lessons.length === 2);
}

// ---- 6. 720課の監査 ----
const moves: Record<string, number> = { 進茹: 0, 退茹: 0, 進間: 0, 退間: 0, その他: 0 };
const initial = { 日徳: 0, 日禄: 0, 旬丁: 0, 驛馬: 0, 驛馬空亡: 0 };
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const tag = `${chart.input.dayStem}${chart.input.dayBranch}+${o}`;
    const before = JSON.stringify(chart);
    const facts = buildInterpretationFacts(chart);
    const flow = analyzeTransmissionFlow(facts);
    if (flow.status !== "determined") {
      check(`${tag} 確定`, false);
      continue;
    }
    moves[flow.movementPattern] += 1;
    const m = dayMarkersOf(facts);
    for (const x of [m.dayVirtue, m.daySalary, m.xunDing, m.yima]) {
      // 出現位置を盤から直接数えた値と一致
      const lessons = facts.lessons.filter((l) => l.upper === x.branch).map((l) => l.index).join();
      const ts = facts.transmissions!.flatMap((t, k) => (t.branch === x.branch ? [`${k}${t.isVoid}`] : [])).join();
      const got = (x.transmissions ?? []).map((t) => `${["initial", "middle", "final"].indexOf(t.position)}${t.isVoid}`).join();
      check(`${tag} ${x.kind} 出現`, x.lessons.map((l) => l.index).join() === lessons && got === ts &&
        x.isVoid === facts.xun.voidBranches.includes(x.branch));
    }
    const isInitial = (x: BranchMarker) => (x.transmissions ?? []).some((t) => t.position === "initial");
    if (isInitial(m.dayVirtue)) initial.日徳 += 1;
    if (isInitial(m.daySalary)) initial.日禄 += 1;
    if (isInitial(m.xunDing)) initial.旬丁 += 1;
    if (isInitial(m.yima)) {
      initial.驛馬 += 1;
      if (m.yima.transmissions!.find((t) => t.position === "initial")!.isVoid) initial.驛馬空亡 += 1;
    }
    check(`${tag} 不変`, JSON.stringify(chart) === before);
  }
}
check("720課 進退の合計", Object.values(moves).reduce((a, b) => a + b, 0) === 720, JSON.stringify(moves));

console.log(`720課 進退: ${JSON.stringify(moves)}`);
console.log(`720課 初伝の標識: ${JSON.stringify(initial)}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
