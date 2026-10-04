// tests/liuren_interpretation_seasonal_timeline.manual.ts
//
// 六壬神課 解釈エンジン Phase 3I（時令の気勢タイムライン）のテスト。
// 実行: npx tsx tests/liuren_interpretation_seasonal_timeline.manual.ts
//
//   1. 5五行 × 12月支＝60起点の previous・current・next・next2 が seasonalStrengthOf（月令は rulingElementOfMonth）と一致
//   2. 月令の順の循環（丑→寅、子→丑、亥→子）・任意の offset
//   3. 古典例の確認用: 水の月令推移（戌→亥→子→丑）
//   4. 三伝は各伝の地支自身の五行、日干は STEM_ELEMENT の五行。既存の FLOW・stateFlow・qiState を書き換えない
//   5. 720課 × 月支12 の監査: 初伝・中伝・末伝・三伝合計・日干の current→next の組合せ、指定5種の件数

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Element } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { STEM_ELEMENT, BRANCH_ELEMENT } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { analyzeTransmissionFlow } from "../src/lib/liuren/interpretation/flow";
import { qiStatesOf } from "../src/lib/liuren/interpretation/qiState";
import { stateTransitionsOf } from "../src/lib/liuren/interpretation/stateFlow";
import { rulingElementOfMonth, seasonalStrengthOf } from "../src/lib/liuren/interpretation/states";
import {
  dayStemSeasonalTimeline, seasonalPointAt, seasonalPointsBetween, seasonalTimelineOf, transmissionSeasonalTimelines,
} from "../src/lib/liuren/interpretation/seasonalTimeline";
import type { SeasonalStrength } from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

const ELEMENTS: Element[] = ["木", "火", "土", "金", "水"];
const MONTH_ORDER = [..."寅卯辰巳午未申酉戌亥子丑"] as Branch[];
const expectedAt = (el: Element, m: Branch) => seasonalStrengthOf(el, rulingElementOfMonth(m));

// ---- 1. 60起点 ----
const table: string[] = [];
for (const el of ELEMENTS) {
  const row: string[] = [];
  for (let k = 0; k < 12; k++) {
    const m = MONTH_ORDER[k];
    const tl = seasonalTimelineOf(el, m);
    const ms = [-1, 0, 1, 2].map((d) => MONTH_ORDER[(k + d + 12) % 12]);
    const ok = tl.element === el && tl.currentMonthBranch === m &&
      tl.points.map((p) => p.offset).join() === "-1,0,1,2" &&
      tl.points.every((p, i) => p.monthBranch === ms[i] && p.rulingElement === rulingElementOfMonth(ms[i]) && p.strength === expectedAt(el, ms[i])) &&
      tl.previous === tl.points[0] && tl.current === tl.points[1] && tl.next === tl.points[2] && tl.next2 === tl.points[3];
    check(`${el} ${m}月`, ok, JSON.stringify(tl.points));
    const [t1, t2] = tl.transitions;
    check(`${el} ${m}月 遷移`, t1.fromOffset === 0 && t1.toOffset === 1 && t1.from === tl.current.strength && t1.to === tl.next.strength &&
      t1.changed === (t1.from !== t1.to) && t1.fromMonthBranch === m && t1.toMonthBranch === ms[2] &&
      t2.fromOffset === 1 && t2.toOffset === 2 && t2.from === tl.next.strength && t2.to === tl.next2.strength);
    row.push(`${m}:${tl.current.strength}${tl.next.strength}${tl.next2.strength}`);
  }
  table.push(`${el} ${row.join(" ")}`);
}

// ---- 2. 循環 ----
check("丑→寅（翌月）", seasonalPointAt("木", "丑", 1).monthBranch === "寅" && seasonalPointAt("木", "丑", 1).strength === "旺");
check("寅→丑（前月）", seasonalPointAt("木", "寅", -1).monthBranch === "丑" && seasonalPointAt("木", "寅", -1).strength === "囚");
check("亥→子", seasonalPointAt("水", "亥", 1).monthBranch === "子");
check("子→丑", seasonalPointAt("水", "子", 1).monthBranch === "丑");
check("offset ±12 は同じ月", seasonalPointAt("火", "午", 12).monthBranch === "午" && seasonalPointAt("火", "午", -12).monthBranch === "午");
check("任意範囲 −3〜+3", seasonalPointsBetween("金", "酉", -3, 3).map((p) => p.monthBranch).join("") === "午未申酉戌亥子");

// ---- 3. 水の月令推移（古典例「仲冬に子水司令」の確認用） ----
const water = seasonalPointsBetween("水", "戌", 0, 3).map((p) => `${p.monthBranch}${p.rulingElement}旺:水${p.strength}`).join(" → ");
check("水 戌→亥→子→丑＝死→旺→旺→死", water === "戌土旺:水死 → 亥水旺:水旺 → 子水旺:水旺 → 丑土旺:水死", water);
const waterAtHai = seasonalTimelineOf("水", "亥");
check("水 亥月: 前月戌＝死・当月亥＝旺・翌月子＝旺・翌々月丑＝死", [waterAtHai.previous, waterAtHai.current, waterAtHai.next, waterAtHai.next2]
  .map((p) => p.strength).join("") === "死旺旺死");
check("水 亥月 亥→子 は変化なし（旺→旺）", !waterAtHai.transitions[0].changed && waterAtHai.transitions[0].from === "旺");

// ---- 4・5. 720課 × 月支12 ----
const STRENGTHS: SeasonalStrength[] = ["旺", "相", "休", "囚", "死"];
const empty = () => Object.fromEntries(STRENGTHS.flatMap((a) => STRENGTHS.map((b) => [`${a}→${b}`, 0]))) as Record<string, number>;
const byPos: Record<"initial" | "middle" | "final" | "三伝合計" | "日干", Record<string, number>> = {
  initial: empty(), middle: empty(), final: empty(), 三伝合計: empty(), 日干: empty(),
};
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const tag = `${STEMS[i % 10]}${BRANCHES[i % 12]}+${o}`;
    const facts = buildInterpretationFacts(calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] }));
    const factsBefore = JSON.stringify(facts);
    for (const m of BRANCHES) {
      const flow = analyzeTransmissionFlow(facts, m);
      if (flow.status !== "determined") {
        check(`${tag} 確定`, false);
        continue;
      }
      const before = JSON.stringify([flow, stateTransitionsOf(flow), qiStatesOf(flow)]);
      const tt = transmissionSeasonalTimelines(facts, m)!;
      const dt = dayStemSeasonalTimeline(facts, m);
      check(`${tag} 月${m} 既存 FLOW・stateFlow・qiState 不変`, JSON.stringify([flow, stateTransitionsOf(flow), qiStatesOf(flow)]) === before);
      for (const p of ["initial", "middle", "final"] as const) {
        const t = tt[p];
        check(`${tag} 月${m} ${p}`, t.position === p && t.branch === flow.branches[p] && t.element === BRANCH_ELEMENT[t.branch] &&
          t.current.strength === flow.seasonalStrength![p]);
        const key = `${t.transitions[0].from}→${t.transitions[0].to}`;
        byPos[p][key] += 1;
        byPos.三伝合計[key] += 1;
      }
      check(`${tag} 月${m} 日干`, dt.dayStem === facts.basic.dayStem && dt.element === STEM_ELEMENT[facts.basic.dayStem]);
      byPos.日干[`${dt.transitions[0].from}→${dt.transitions[0].to}`] += 1;
    }
    check(`${tag} FACT 不変`, JSON.stringify(facts) === factsBefore);
  }
}
check("三伝未確定 → null", transmissionSeasonalTimelines({ ...buildInterpretationFacts(calculateLiuren({
  dayStem: "甲", dayBranch: "子", divinationBranch: "子", monthGeneral: "子" })), transmissions: null }, "寅") === null);
const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
check("伝ごとの合計＝8640", ["initial", "middle", "final", "日干"].every((k) => total(byPos[k as keyof typeof byPos]) === 8640));

console.log("5五行 × 12月（月:当月・翌月・翌々月）:");
for (const r of table) console.log(`  ${r}`);
console.log(`水の月令推移: ${water}`);
const LABEL = { initial: "初伝", middle: "中伝", final: "末伝", 三伝合計: "三伝合計", 日干: "日干五行" } as const;
for (const k of Object.keys(byPos) as (keyof typeof byPos)[]) {
  const nonzero = Object.entries(byPos[k]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  console.log(`720課×月支12 ${LABEL[k]} current→next（${nonzero.length}種）: ${nonzero.map(([a, v]) => `${a} ${v}`).join(" / ")}`);
}
const PICK = ["休→相", "囚→休", "死→囚", "相→旺", "旺→相"];
for (const k of Object.keys(byPos) as (keyof typeof byPos)[]) {
  console.log(`  指定5種 ${LABEL[k]}: ${PICK.map((p) => `${p} ${byPos[k][p]}`).join(" / ")}`);
}
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
