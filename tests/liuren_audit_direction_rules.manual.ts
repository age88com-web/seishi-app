// tests/liuren_audit_direction_rules.manual.ts
//
// 六壬神課 Phase 3O: 古典進退規則の優先順位監査（監査専用。本番コードは変更しない）。
// 実行: npx tsx tests/liuren_audit_direction_rules.manual.ts
//
//   DirectionEvidence（Phase 3N）だけを材料に、古典5例（宜進格・不宜進格・宜退格・不宜退格・丁巳日）を
//     H1 基本方向 / H2 行き先の空亡（候補 A〜D）/ H3 干上の根拠 / H4 干上の空亡 / H5・H6 経路の変化
//   で整理し、優先順位モデル（Model 0・A・B・C）がどこまで説明できるかを比べる。
//   古典の結論は「許される結果の集合」としてテスト側にだけ持つ（不宜進＝退か守、不宜退＝進か守。宜退と同一視しない）。
//   720課には結論を付けず、候補条件が何課で成り立つかだけを数える。score・加点減点は使わない。

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { directionEvidenceOf } from "../src/lib/liuren/interpretation/directionEvidence";
import type { DirectionEvidence, TransmissionPosition } from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

/** 監査でだけ使う結果の種類（本番の型にはしない） */
type Outcome = "advance" | "retreat" | "stay";
const POS: TransmissionPosition[] = ["initial", "middle", "final"];
const evidenceOf = (day: string, offset: number): DirectionEvidence => directionEvidenceOf(buildInterpretationFacts(calculateLiuren({
  dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[offset],
})))!;

// ---- 条件（すべて既存 FACT の読み取り。1つにまとめない） ----
/** H2 行き先の空亡の候補 */
const VOID_CANDIDATES: Record<string, (e: DirectionEvidence) => boolean> = {
  "A 末伝 dayXunVoid": (e) => e.terminal.dayXunVoid,
  "B 末伝 seatedOnVoid": (e) => e.terminal.seatedOnVoid,
  "C 三伝内 dayXunVoid": (e) => POS.some((p) => e.path.states[p].isVoid),
  "D 三伝内 seatedOnVoid": (e) => POS.some((p) => e.path.states[p].isSeatedOnVoid),
};
/** H3 干上の根拠（個別に見る） */
const STANDING_SUPPORT: Record<string, (e: DirectionEvidence) => boolean> = {
  日禄: (e) => e.standing.isDaySalary,
  帝旺: (e) => e.standing.growthStage === "帝旺",
  長生: (e) => e.standing.growthStage === "長生",
  生干: (e) => e.standing.relationToDayStem === "transmissionGeneratesDayStem",
  比和: (e) => e.standing.relationToDayStem === "sameElement",
};
/** H4 干上の空亡 */
const standingVoid = (e: DirectionEvidence) => e.standing.isVoid || e.standing.isSeatedOnVoid;
/** 干上の「実の旺禄」: 日禄か帝旺で、旬空・坐空のどちらでもない（モデル用の組合せ。本番の FACT にはしない） */
const standingSolid = (e: DirectionEvidence) => (e.standing.isDaySalary || e.standing.growthStage === "帝旺") && !standingVoid(e);
/** H5 経路が末伝で生干・日禄・長生・帝旺に至る（どれに当たるかは別々に出す） */
const H5: Record<string, (e: DirectionEvidence) => boolean> = {
  末伝生干: (e) => e.path.states.final.relationToDayStem === "transmissionGeneratesDayStem",
  末伝日禄: (e) => e.path.states.final.isDaySalary,
  末伝長生: (e) => e.path.states.final.growthStage === "長生",
  末伝帝旺: (e) => e.path.states.final.growthStage === "帝旺",
};
/** H6 経路が剋干・脱（干生）・死・墓・空亡へ向かう */
const H6: Record<string, (e: DirectionEvidence) => boolean> = {
  初伝剋干: (e) => e.path.states.initial.relationToDayStem === "transmissionOvercomesDayStem",
  中末に干生: (e) => [e.path.states.middle, e.path.states.final].some((s) => s.relationToDayStem === "dayStemGeneratesTransmission"),
  末伝死墓: (e) => ["死", "墓"].includes(e.path.states.final.growthStage),
  三伝に旬空: (e) => POS.some((p) => e.path.states[p].isVoid),
};
const base = (e: DirectionEvidence): Outcome => (e.movementDirection === "advancing" ? "advance" : e.movementDirection === "retreating" ? "retreat" : "stay");
const flip = (o: Outcome): Outcome => (o === "advance" ? "retreat" : o === "retreat" ? "advance" : o);
/** 経路が「末伝で生干・日禄・長生・帝旺のどれか」に至り、末伝が行き先の空亡（候補 v）でない */
const pathSupported = (e: DirectionEvidence, v: (e: DirectionEvidence) => boolean) =>
  Object.values(H5).some((f) => f(e)) && !v(e);

// ---- 優先順位モデル（監査でだけ定義。後の段ほど前の結果を上書きする） ----
type Model = { name: string; run: (e: DirectionEvidence, v: (e: DirectionEvidence) => boolean) => Outcome };
const MODELS: Model[] = [
  { name: "Model 0 movement のみ（H1）", run: (e) => base(e) },
  {
    name: "Model A movement → void → standing",
    run: (e, v) => {
      let o = base(e);
      if (o !== "stay" && v(e)) o = flip(o); // 行き先が空なら向きを返す
      if (standingSolid(e)) o = "stay"; // 干上が実の旺禄なら守る
      return o;
    },
  },
  {
    name: "Model B movement → standing → void",
    run: (e, v) => {
      let o = base(e);
      if (standingSolid(e)) o = "stay";
      if (e.movementDirection !== "neutral" && v(e)) o = flip(base(e)); // 行き先が空なら、守っていても向きを返す
      return o;
    },
  },
  {
    name: "Model C standing と path の比較 → movement → void",
    run: (e, v) => {
      const s = standingSolid(e);
      const p = pathSupported(e, v);
      if (s && !p) return "stay"; // 現在地だけに根拠
      let o = base(e); // 経路側にも根拠がある、またはどちらにもない → 三伝の向き
      if (o !== "stay" && v(e)) o = flip(o);
      return o;
    },
  },
];

// ---- 古典5例 ----
type Classic = { id: string; name: string; day: string; offset: number; allowed: Outcome[]; note: string };
const CLASSICS: Classic[] = [
  { id: "A", name: "宜進格", day: "己卯", offset: 1, allowed: ["advance"], note: "宜進" },
  { id: "B", name: "不宜進格", day: "壬午", offset: 1, allowed: ["retreat", "stay"], note: "不宜進（退か守。宜退とは限らない）" },
  { id: "C", name: "宜退格", day: "癸亥", offset: 11, allowed: ["retreat"], note: "宜退" },
  { id: "D", name: "不宜退格", day: "乙卯", offset: 11, allowed: ["advance", "stay"], note: "不宜退（進か守。宜進とは限らない）" },
  { id: "E", name: "丁巳日", day: "丁巳", offset: 11, allowed: ["advance", "stay"], note: "進取を宜（advance）／干上旺禄を守る（stay）の2説" },
];
const yes = (b: boolean) => (b ? "○" : "－");
const lines: string[] = [];
const modelTable: string[] = [];
for (const c of CLASSICS) {
  const e = evidenceOf(c.day, c.offset);
  lines.push(`${c.id} ${c.name} ${c.day}日 天盤差${c.offset}（${e.movementPattern}→${e.movementDirection}） 古典: ${c.note}`);
  lines.push(`    H2 行き先の空亡: ${Object.entries(VOID_CANDIDATES).map(([k, f]) => `${k}${yes(f(e))}`).join(" ")}`);
  lines.push(`    H3 干上の根拠: ${Object.entries(STANDING_SUPPORT).map(([k, f]) => `${k}${yes(f(e))}`).join(" ")}`);
  lines.push(`    H4 干上の空亡: 旬空${yes(e.standing.isVoid)} 坐空${yes(e.standing.isSeatedOnVoid)} → 実の旺禄${yes(standingSolid(e))}`);
  lines.push(`    H5 経路の到達: ${Object.entries(H5).map(([k, f]) => `${k}${yes(f(e))}`).join(" ")}`);
  lines.push(`    H6 経路の阻害: ${Object.entries(H6).map(([k, f]) => `${k}${yes(f(e))}`).join(" ")}`);
}
const explained: Record<string, Record<string, string[]>> = {};
for (const m of MODELS) {
  explained[m.name] = {};
  for (const [vk, vf] of Object.entries(VOID_CANDIDATES)) {
    const row = CLASSICS.map((c) => {
      const o = m.run(evidenceOf(c.day, c.offset), vf);
      const ok = c.allowed.includes(o);
      if (ok) (explained[m.name][vk] ??= []).push(c.id);
      return `${c.id}:${o}${ok ? "○" : "×"}`;
    });
    modelTable.push(`${m.name} ／ 行き先の空亡＝${vk}: ${row.join(" ")}`);
  }
}

// 監査の前提（FACT の再確認）
{
  const a = evidenceOf("己卯", 1);
  check("A advancing・干上申 干生・旬空・病・末伝午 生干・禄・帝旺", a.movementDirection === "advancing" &&
    a.standing.relationToDayStem === "dayStemGeneratesTransmission" && a.standing.isVoid && a.standing.growthStage === "病" &&
    a.path.states.final.relationToDayStem === "transmissionGeneratesDayStem" && a.path.states.final.isDaySalary && a.path.states.final.growthStage === "帝旺");
  const b = evidenceOf("壬午", 1);
  check("B advancing・干上子 比和・帝旺・初伝丑 剋干・旬丁", b.movementDirection === "advancing" && b.standing.growthStage === "帝旺" &&
    b.path.states.initial.relationToDayStem === "transmissionOvercomesDayStem" && b.path.states.initial.isXunDing);
  const c = evidenceOf("癸亥", 11);
  check("C retreating・干上子 禄・帝旺・旬空・坐空", c.movementDirection === "retreating" && c.standing.isDaySalary &&
    c.standing.growthStage === "帝旺" && c.standing.isVoid && c.standing.isSeatedOnVoid);
  const d = evidenceOf("乙卯", 11);
  check("D retreating・干上卯 禄・帝旺・非空・三伝 丑旬空 子旬空坐空 亥坐空", d.movementDirection === "retreating" && d.standing.isDaySalary &&
    !standingVoid(d) && d.path.states.initial.isVoid && d.path.states.middle.isVoid && d.path.states.middle.isSeatedOnVoid &&
    !d.path.states.final.isVoid && d.path.states.final.isSeatedOnVoid);
  const e = evidenceOf("丁巳", 11);
  check("E retreating・干上午 禄・帝旺・非空・末伝丑 干生・旬空・養", e.movementDirection === "retreating" && e.standing.isDaySalary &&
    e.standing.growthStage === "帝旺" && !standingVoid(e) && e.terminal.dayXunVoid && e.path.states.final.growthStage === "養" &&
    e.path.states.final.relationToDayStem === "dayStemGeneratesTransmission");
}

// ---- 720課: 候補条件の発火件数（結論は付けない） ----
const COND: Record<string, (e: DirectionEvidence) => boolean> = {
  "退茹＋末伝旬空": (e) => e.movementPattern === "退茹" && e.terminal.dayXunVoid,
  "退茹＋干上禄": (e) => e.movementPattern === "退茹" && e.standing.isDaySalary,
  "退茹＋干上禄＋帝旺": (e) => e.movementPattern === "退茹" && e.standing.isDaySalary && e.standing.growthStage === "帝旺",
  "退茹＋干上禄＋末伝旬空": (e) => e.movementPattern === "退茹" && e.standing.isDaySalary && e.terminal.dayXunVoid,
  "退茹＋干上が実の旺禄": (e) => e.movementPattern === "退茹" && standingSolid(e),
  "進茹＋干上空亡（旬空）": (e) => e.movementPattern === "進茹" && e.standing.isVoid,
  "進茹＋末伝禄": (e) => e.movementPattern === "進茹" && e.path.states.final.isDaySalary,
  "進茹＋干上帝旺": (e) => e.movementPattern === "進茹" && e.standing.growthStage === "帝旺",
  "進茹＋干上帝旺＋初伝剋干": (e) => e.movementPattern === "進茹" && e.standing.growthStage === "帝旺" && H6.初伝剋干(e),
  "advancing＋干上禄": (e) => e.movementDirection === "advancing" && e.standing.isDaySalary,
  "advancing＋干上が実の旺禄": (e) => e.movementDirection === "advancing" && standingSolid(e),
  "retreating＋干上が実の旺禄": (e) => e.movementDirection === "retreating" && standingSolid(e),
  "干上禄（全体）": (e) => e.standing.isDaySalary,
  "干上帝旺（全体）": (e) => e.standing.growthStage === "帝旺",
};
const fired: Record<string, number> = Object.fromEntries(Object.keys(COND).map((k) => [k, 0]));
const offsetsOf: Record<string, Set<number>> = Object.fromEntries(Object.keys(COND).map((k) => [k, new Set<number>()]));
const stemsOf: Record<string, Set<string>> = Object.fromEntries(Object.keys(COND).map((k) => [k, new Set<string>()]));
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const e = evidenceOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, o);
    for (const [k, f] of Object.entries(COND)) {
      if (!f(e)) continue;
      fired[k] += 1;
      offsetsOf[k].add(o);
      stemsOf[k].add(STEMS[i % 10]);
    }
  }
}
// 構造的必然の確認: 干上禄は天盤差0・11だけ（寄宮支と日禄の位置関係）。advancing（天盤差1・2）には現れない
check("干上禄は天盤差0・11だけ", [...offsetsOf["干上禄（全体）"]].sort((a, b) => a - b).join() === "0,11");
check("advancing（天盤差1・2）で干上禄は0件", fired["advancing＋干上禄"] === 0);
check("干上帝旺は天盤差1（陽干）・11（陰干）だけ", [...offsetsOf["干上帝旺（全体）"]].sort((x, y) => x - y).join() === "1,11");
check("退茹＋干上禄 は必ず帝旺（陰干の禄＝帝旺）", fired["退茹＋干上禄"] === fired["退茹＋干上禄＋帝旺"] &&
  [...stemsOf["退茹＋干上禄"]].every((s) => "乙丁己辛癸".includes(s)));

console.log("古典5例の条件:");
for (const l of lines) console.log(`  ${l}`);
console.log("優先順位モデル × 行き先の空亡の候補（○＝古典の許す結果に入る）:");
for (const l of modelTable) console.log(`  ${l}`);
console.log("5例すべてを説明できる組合せ:");
for (const m of MODELS) {
  const ok = Object.entries(explained[m.name]).filter(([, ids]) => ids.length === 5).map(([k]) => k);
  console.log(`  ${m.name}: ${ok.join(" / ") || "なし"}`);
}
console.log("720課 候補条件の発火件数（天盤差・日干）:");
for (const k of Object.keys(COND)) {
  console.log(`  ${k}: ${fired[k]}課 天盤差{${[...offsetsOf[k]].sort((a, b) => a - b).join(",")}} 日干{${[...stemsOf[k]].join("")}}`);
}
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
