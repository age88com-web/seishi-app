// tests/liuren_interpretation_heavenly_general_state.manual.ts
//
// 六壬神課 Phase 4B（天盤支に乗る天将 HeavenlyGeneralPositionState）のテスト。
// 実行: npx tsx tests/liuren_interpretation_heavenly_general_state.manual.ts
//
//   1. 720課の 干上・一〜四課上神・初中末（5,760位置）で、天将＝起課エンジンの天将盤 generals.generalOn[天盤支]、
//      四課の既存値（chart.lessonGenerals・facts.lessons[].general）・三伝の既存値（transmissions[].general）と完全一致。
//      同じ天盤支なら、どの経路から参照しても同じ天将
//   2. 補足: 占時12支すべて（8,640課。昼占・夜占の両方）でも天将盤・既存値と一致
//   3. anchor から到達できる（日干・日支そのものは null）。SiteState・制約・既存 FACT は変わらない
//   4. 古典例（『六壬断案２』の本文で支と天将が明示されているもの）と一致すること（象意は判断しない）
//      断案の天将盤が講座（エンジン）と違う例（貴人方式の差。例30・33・34・36・38・40・42・56）は照合しない
//   5. 分布（各位置・全体）、三伝の玄武・朱雀の件数

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, HeavenlyGeneral, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { GENERALS } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { anchorResolutionContextOf, resolveAnchor } from "../src/lib/liuren/interpretation/anchorResolver";
import { siteStateOf } from "../src/lib/liuren/interpretation/siteState";
import {
  heavenlyGeneralStateOf, heavenlyGeneralStateOfResolution, lessonUpperHeavenlyGeneralStateOf,
  standingHeavenlyGeneralStateOf, transmissionHeavenlyGeneralStatesOf,
} from "../src/lib/liuren/interpretation/heavenlyGeneralState";
import type { HeavenlyGeneralPositionState } from "../src/lib/liuren/interpretation/types";
import type { BoardAnchor } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };

const POS = ["standing", "lesson1", "lesson2", "lesson3", "lesson4", "initial", "middle", "final"] as const;
type Pos = (typeof POS)[number];
const ANCHOR: Record<Pos, BoardAnchor> = {
  standing: { kind: "position", position: "standing" },
  lesson1: { kind: "lesson", index: 1 }, lesson2: { kind: "lesson", index: 2 }, lesson3: { kind: "lesson", index: 3 }, lesson4: { kind: "lesson", index: 4 },
  initial: { kind: "position", position: "initial" }, middle: { kind: "position", position: "middle" }, final: { kind: "position", position: "final" },
};

/** 1課分の監査。existing は既存の値（天将盤以外の出どころ） */
function auditChart(dayStem: Stem, dayBranch: Branch, divinationBranch: Branch, monthGeneral: Branch, withAnchor: boolean) {
  const tag = `${dayStem}${dayBranch} ${monthGeneral}将${divinationBranch}時`;
  const chart = calculateLiuren({ dayStem, dayBranch, divinationBranch, monthGeneral });
  const facts = buildInterpretationFacts(chart);
  const ts = transmissionHeavenlyGeneralStatesOf(facts);
  if (!ts || !chart.transmissions) { check(`${tag} 三伝確定`, false); return null; }
  const states: Record<Pos, HeavenlyGeneralPositionState> = {
    standing: standingHeavenlyGeneralStateOf(facts),
    lesson1: lessonUpperHeavenlyGeneralStateOf(facts, 1), lesson2: lessonUpperHeavenlyGeneralStateOf(facts, 2),
    lesson3: lessonUpperHeavenlyGeneralStateOf(facts, 3), lesson4: lessonUpperHeavenlyGeneralStateOf(facts, 4),
    initial: ts.initial, middle: ts.middle, final: ts.final,
  };
  const existing: Record<Pos, [Branch, HeavenlyGeneral, HeavenlyGeneral]> = {
    standing: [chart.lessons[0].upper, chart.lessonGenerals[0], facts.lessons[0].general],
    lesson1: [chart.lessons[0].upper, chart.lessonGenerals[0], facts.lessons[0].general],
    lesson2: [chart.lessons[1].upper, chart.lessonGenerals[1], facts.lessons[1].general],
    lesson3: [chart.lessons[2].upper, chart.lessonGenerals[2], facts.lessons[2].general],
    lesson4: [chart.lessons[3].upper, chart.lessonGenerals[3], facts.lessons[3].general],
    initial: [chart.transmissions[0].branch, chart.transmissions[0].general, facts.transmissions![0].general],
    middle: [chart.transmissions[1].branch, chart.transmissions[1].general, facts.transmissions![1].general],
    final: [chart.transmissions[2].branch, chart.transmissions[2].general, facts.transmissions![2].general],
  };
  const byBranch = new Map<Branch, HeavenlyGeneral>();
  let board = 0, lessonsOk = 0, transOk = 0;
  for (const p of POS) {
    const s = states[p];
    const [b, g1, g2] = existing[p];
    if (s.skyBranch !== b) check(`${tag} ${p} skyBranch`, false);
    if (s.general === chart.generals.generalOn[s.skyBranch]) board += 1; else check(`${tag} ${p} 天将盤`, false);
    const okExisting = s.general === g1 && s.general === g2;
    if (!okExisting) check(`${tag} ${p} 既存値`, false, `${s.general} / ${g1} / ${g2}`);
    else if (p.startsWith("lesson") || p === "standing") lessonsOk += 1; else transOk += 1;
    if (Object.keys(s).join() !== "skyBranch,general") check(`${tag} ${p} 項目は skyBranch・general だけ`, false);
    const prev = byBranch.get(s.skyBranch);
    if (prev !== undefined && prev !== s.general) check(`${tag} 同じ天盤支 ${s.skyBranch} で天将が違う`, false);
    byBranch.set(s.skyBranch, s.general);
  }
  if (withAnchor) {
    const ctx = anchorResolutionContextOf(facts);
    const before = JSON.stringify(ctx);
    for (const p of POS) {
      const r = resolveAnchor(ANCHOR[p], ctx)!;
      if (JSON.stringify(heavenlyGeneralStateOfResolution(facts, r)) !== JSON.stringify(states[p])) check(`${tag} anchor ${p}`, false);
      // SiteState には天将が入らない
      if ("general" in siteStateOf(facts, states[p].skyBranch)) check(`${tag} SiteState に天将`, false);
      // 制約は既存のまま（天将で増減しない）
      if (JSON.stringify(r.constraints) !== JSON.stringify(resolveAnchor(ANCHOR[p], anchorResolutionContextOf(facts))!.constraints)) check(`${tag} 制約`, false);
    }
    const ds = resolveAnchor({ kind: "dayStem" }, ctx)!;
    if (heavenlyGeneralStateOfResolution(facts, ds) !== null) check(`${tag} 日干そのものは null`, false);
    if (heavenlyGeneralStateOfResolution(facts, resolveAnchor({ kind: "dayBranch" }, ctx)!) !== null) check(`${tag} 日支そのものは null`, false);
    if ("general" in ctx.dayBranch) check(`${tag} DayBranchState に天将`, false);
    if (JSON.stringify(ctx) !== before) check(`${tag} 既存 FACT 不変`, false);
  }
  return { states, board, lessonsOk, transOk, dayOrNight: chart.generals.dayOrNight };
}

// ---- 1. 720課 ----
const dist = Object.fromEntries(POS.map((p) => [p, {} as Record<string, number>])) as Record<Pos, Record<string, number>>;
const total: Record<string, number> = {};
let positions = 0, boardOk = 0, lessonOk = 0, transOk = 0, sameBranchPairs = 0;
const triple: Record<"玄武" | "朱雀", Record<string, number>> = { 玄武: {}, 朱雀: {} };
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const a = auditChart(STEMS[i % 10], BRANCHES[i % 12], "子", BRANCHES[o], true);
    if (!a) continue;
    for (const p of POS) {
      positions += 1;
      inc(dist[p], a.states[p].general);
      inc(total, a.states[p].general);
    }
    boardOk += a.board; lessonOk += a.lessonsOk; transOk += a.transOk;
    // 例: lesson3 上神と初伝が同じ支なら同じ天将（auditChart で全組を確認済み。件数だけ数える）
    if (a.states.lesson3.skyBranch === a.states.initial.skyBranch) sameBranchPairs += 1;
    for (const g of ["玄武", "朱雀"] as const) {
      const where = (["initial", "middle", "final"] as const).filter((p) => a.states[p].general === g);
      for (const p of where) inc(triple[g], p);
      if (where.length) inc(triple[g], "いずれか");
    }
  }
}
check("720課×8位置＝5,760位置", positions === 5760, String(positions));
check("5,760位置すべて天将盤と一致", boardOk === 5760, String(boardOk));
check("四課・干上 3,600位置が既存値と一致", lessonOk === 3600, String(lessonOk));
check("三伝 2,160位置が既存値と一致", transOk === 2160, String(transOk));

// ---- 2. 補足: 占時12支（昼占・夜占の両方） ----
let extra = 0;
const dn: Record<string, number> = {};
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
  const a = auditChart(STEMS[i % 10], BRANCHES[i % 12], shi, BRANCHES[o], false);
  if (a) { extra += a.board; inc(dn, a.dayOrNight); }
}
check("占時12支 8,640課×8位置で天将盤と一致", extra === 8640 * 8, String(extra));

// ---- 4. 古典例（『六壬断案２』本文で支と天将が明示） ----
type Classic = [id: string, day: string, jiang: Branch, shi: Branch, pos: Pos, branch: Branch, general: HeavenlyGeneral, text: string];
const CLASSICS: Classic[] = [
  ["例35", "丁卯", "子", "卯", "initial", "子", "螣蛇", "子はﾄｳ蛇で宅に入り発用である"],
  ["例35", "丁卯", "子", "卯", "final", "午", "白虎", "白虎は午に乗じて酉上にあって末伝となる"],
  ["例37", "癸酉", "巳", "申", "final", "子", "青龍", "子が青龍で卯に加わる"],
  ["例41", "戊申", "未", "酉", "initial", "丑", "天空", "初伝丑は天空で卯上にあり"],
  ["例41", "戊申", "未", "酉", "lesson3", "午", "螣蛇", "日支申は支上午螣蛇に剋されます"],
  ["例43", "丁丑", "午", "未", "initial", "子", "螣蛇", "螣蛇が支上初伝に来て"],
  ["例43", "丁丑", "午", "未", "lesson3", "子", "螣蛇", "螣蛇が支上初伝に来て"],
  ["例46", "戊辰", "未", "巳", "final", "子", "天后", "末伝は妻爻で空亡に坐し、天后穢神"],
  ["例48", "庚戌", "亥", "辰", "initial", "戌", "六合", "初伝は戌土六合"],
  ["例48", "庚戌", "亥", "辰", "middle", "巳", "太常", "巳は官鬼で太常"],
  ["例49", "己卯", "午", "丑", "final", "卯", "白虎", "卯が白虎で戌に加わる"],
  ["例51", "癸亥", "未", "巳", "middle", "卯", "太陰", "太陰卯に乗じて幕貴となり"],
  ["例54", "庚辰", "子", "子", "middle", "寅", "青龍", "寅上青龍は入廟し"],
  ["例54", "庚辰", "子", "子", "final", "巳", "朱雀", "末伝巳は朱雀となり"],
];
const classicLines: string[] = [];
for (const [id, day, jiang, shi, pos, branch, general, text] of CLASSICS) {
  const a = auditChart(day[0] as Stem, day[1] as Branch, shi, jiang, true)!;
  const s = a.states[pos];
  check(`断案2 ${id} ${pos} ${branch}${general}`, s.skyBranch === branch && s.general === general, JSON.stringify(s));
  classicLines.push(`${id} ${day}日 ${jiang}将${shi}時 ${pos}: FACT ${s.skyBranch}${s.general} ／ 原文「${text}」`);
}
check("古典例は5例以上", new Set(CLASSICS.map((c) => c[0])).size >= 5);

// ---- コードに評価語・象意・ROLE・DOMAIN・天将配置の再実装が出てこない ----
{
  const src = readFileSync("src/lib/liuren/interpretation/heavenlyGeneralState.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const hit = ["auspicious", "benefic", "malefic", "good", "bad", "strong", "weak", "吉", "凶", "theft", "document", "wealth", "illness",
    "self", "counterparty", "resource", "obstacle", "authority", "domain", "GENERALS", "nobleBranch", "direction", "constraints", "siteState"].filter((w) => src.includes(w));
  check("heavenlyGeneralState.ts に評価語・象意・ROLE・DOMAIN・天将配置・制約・SiteState が出てこない", hit.length === 0, hit.join(","));
  const roleRules = readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8");
  check("RoleMatcher は変更していない（heavenlyGeneral の matcher なし）", !roleRules.includes("heavenlyGeneral"));
}

const fmt = (o: Record<string, number>) => GENERALS.map((g) => `${g}${o[g] ?? 0}`).join(" ");
console.log("各位置の12天将分布（720課・占時子＝夜占）:");
for (const p of POS) console.log(`  ${p}: ${fmt(dist[p])}`);
console.log(`全体（5,760位置）: ${fmt(total)}`);
console.log(`三伝の玄武: ${JSON.stringify(triple.玄武)} ／ 朱雀: ${JSON.stringify(triple.朱雀)}`);
console.log(`lesson3 上神＝初伝の課: ${sameBranchPairs}（すべて同じ天将）`);
console.log(`補足 占時12支: ${JSON.stringify(dn)}`);
console.log("古典例:");
for (const l of classicLines) console.log(`  ${l}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
