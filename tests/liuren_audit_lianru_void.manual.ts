// tests/liuren_audit_lianru_void.manual.ts
//
// 六壬神課 Phase 3M-A: 連茹空亡の古典構造監査（監査専用。本番コードは変更しない）。
// 実行: npx tsx tests/liuren_audit_lianru_void.manual.ts
//
//   古典6例（壬子・甲午・丁巳・戊申・乙卯・甲子）を既存の起課エンジンで再現し、
//     dayXunVoid … 占日の旬の空亡（既存の isVoid）
//     pathXunVoid 候補 … 三伝の各支が「どの旬の空亡か」（本旬からのずれ k。+1＝後旬・+2＝外後旬・−1＝前旬）
//   を並べ、候補規則ごとに古典の記述と照合する。720課の連茹・連間についても候補規則の成立件数を数える。
//   旬は六十甲子で旬首を10日ずつずらしたもの。各旬の空亡は既存の resolveXun(甲, 旬首の支) で求める。

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { resolveXun } from "../src/lib/liuren/relations";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { analyzeTransmissionFlow } from "../src/lib/liuren/interpretation/flow";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

/** 六十甲子での日の番号（0＝甲子） */
const indexOfDay = (s: Stem, b: Branch) => {
  for (let i = 0; i < 60; i++) if (STEMS[i % 10] === s && BRANCHES[i % 12] === b) return i;
  throw new Error(`${s}${b}`);
};
/** 本旬から k 旬ずれた旬（k>0 は後の旬） */
function xunAt(dayIndex: number, k: number) {
  const head = (((dayIndex - (dayIndex % 10)) + 10 * k) % 60 + 60) % 60;
  const headBranch = BRANCHES[head % 12];
  const x = resolveXun("甲", headBranch);
  return { k, name: x.xunHead, voids: x.voidBranches };
}
const K_RANGE = [-2, -1, 0, 1, 2, 3];
const K_NAME: Record<number, string> = { [-2]: "前々旬", [-1]: "前旬", 0: "本旬", 1: "後旬", 2: "外後旬", 3: "外後旬の次" };
/** その支を空亡とする旬のずれ k（6旬で12支を1回ずつ覆うので一意） */
function xunOffsetOf(dayIndex: number, b: Branch): number {
  return K_RANGE.find((k) => xunAt(dayIndex, k).voids.includes(b))!;
}

type Rule = { name: string; test: (k: number[], dir: number) => boolean };
const RULES: Rule[] = [
  { name: "R1 本旬→後旬→外後旬（k＝0,1,2。F の字義どおり）", test: (k) => k.join() === "0,1,2" },
  { name: "R2 本旬起点・後の旬へ（k[0]=0、1伝ごとに 0 か +1）", test: (k) => k[0] === 0 && [1, 2].every((i) => [0, 1].includes(k[i] - k[i - 1])) },
  { name: "R3 本旬起点・前の旬へ（k[0]=0、1伝ごとに 0 か −1）", test: (k) => k[0] === 0 && [1, 2].every((i) => [0, -1].includes(k[i] - k[i - 1])) },
  { name: "R4 本旬起点・経路の向きで決まる（退＝後の旬へ・進＝前の旬へ）",
    test: (k, dir) => k[0] === 0 && [1, 2].every((i) => [0, dir < 0 ? 1 : -1].includes(k[i] - k[i - 1])) },
  { name: "R5 本旬を含む連続した旬・経路の向きで決まる（初伝が本旬でなくてよい）",
    test: (k, dir) => k.includes(0) && [1, 2].every((i) => [0, dir < 0 ? 1 : -1].includes(k[i] - k[i - 1])) },
];
/** 三伝の支の向き（初→中の差で見る。+1・+2＝進、−1・−2＝退） */
const directionOf = (ts: Branch[]) => {
  const d = (BRANCHES.indexOf(ts[1]) - BRANCHES.indexOf(ts[0]) + 12) % 12;
  return d === 1 || d === 2 ? 1 : d === 11 || d === 10 ? -1 : 0;
};

// ---- 古典6例 ----
type Classic = { id: string; day: string; upper: Branch | null; ts: string; classical: string; allVoidClaimed: boolean | null };
const CLASSICS: Classic[] = [
  { id: "A", day: "壬子", upper: "子", ts: "寅卯辰", classical: "進茹空亡宜退步・三伝皆空", allVoidClaimed: true },
  { id: "B", day: "甲午", upper: "卯", ts: "辰巳午", classical: "三伝皆空・進茹だが退歩を宜とする", allVoidClaimed: true },
  { id: "C", day: "丁巳", upper: "午", ts: "卯寅丑", classical: "踏腳空亡・退茹だが進むを宜とする", allVoidClaimed: null },
  { id: "D", day: "戊申", upper: "辰", ts: "卯寅丑", classical: "三伝は日鬼・鬼空・退くより進む", allVoidClaimed: null },
  { id: "E", day: "乙卯", upper: "卯", ts: "丑子亥", classical: "踏腳空亡／『御定六壬直指』三傳皆空", allVoidClaimed: true },
  { id: "F", day: "甲子", upper: null, ts: "戌申午", classical: "初伝＝本旬之空・中伝＝後旬之空・末伝＝外後旬之空", allVoidClaimed: true },
];
const lines: string[] = [];
const ruleHits: Record<string, string[]> = Object.fromEntries(RULES.map((r) => [r.name, []]));
for (const c of CLASSICS) {
  const s = c.day[0] as Stem;
  const b = c.day[1] as Branch;
  // 既存の起課で再現（天盤差 0〜11 で 干上・三伝が一致する課を探す）
  let found: { offset: number; chart: ReturnType<typeof calculateLiuren> } | null = null;
  for (let o = 0; o < 12 && !found; o++) {
    const chart = calculateLiuren({ dayStem: s, dayBranch: b, divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const ts = chart.transmissions?.map((t) => t.branch).join("");
    if (ts === c.ts && (c.upper === null || chart.lessons[0].upper === c.upper)) found = { offset: o, chart };
  }
  check(`${c.id} ${c.day} 再現`, found !== null);
  if (!found) continue;
  const chart = found.chart;
  const facts = buildInterpretationFacts(chart);
  const flow = analyzeTransmissionFlow(facts);
  const di = indexOfDay(s, b);
  const ts = [...c.ts] as Branch[];
  const ks = ts.map((x) => xunOffsetOf(di, x));
  const dir = directionOf(ts);
  check(`${c.id} 本旬の空亡＝既存 xun`, xunAt(di, 0).voids.join() === chart.xun.voidBranches.join() && xunAt(di, 0).name === chart.xun.xunHead);
  // dayXunVoid（既存の isVoid）は「k＝0」と同じ
  check(`${c.id} dayXunVoid は k＝0 と同じ`, ts.every((x, i) => chart.transmissions![i].isVoid === (ks[i] === 0)));
  lines.push(`${c.id} ${c.day}日 天盤差${found.offset} 干上${chart.lessons[0].upper} 三伝${c.ts}（${chart.sanchuan.method}・${flow.status === "determined" ? flow.movementPattern : "-"}）`);
  lines.push(`    古典: ${c.classical}`);
  lines.push(`    本旬 ${xunAt(di, 0).name}旬 空亡${xunAt(di, 0).voids.join("")} ／ 後旬 ${xunAt(di, 1).name}旬 ${xunAt(di, 1).voids.join("")} ／ 外後旬 ${xunAt(di, 2).name}旬 ${xunAt(di, 2).voids.join("")} ／ 前旬 ${xunAt(di, -1).name}旬 ${xunAt(di, -1).voids.join("")}`);
  lines.push(`    dayXunVoid（既存 isVoid）: ${chart.transmissions!.map((t) => `${t.branch}${t.isVoid ? "空" : "－"}`).join(" ")}`);
  lines.push(`    pathXunVoid 候補（各伝を空亡とする旬）: ${ts.map((x, i) => `${x}＝${K_NAME[ks[i]]}之空（k=${ks[i]}）`).join(" ／ ")}`);
  for (const r of RULES) {
    const ok = r.test(ks, dir);
    if (ok) ruleHits[r.name].push(c.id);
    lines.push(`    ${ok ? "○" : "×"} ${r.name}`);
  }
}

// F の字義（戌＝本旬之空・申＝後旬之空・午＝外後旬之空）
{
  const di = indexOfDay("甲", "子");
  check("F 戌＝本旬（甲子旬）之空", xunAt(di, 0).voids.includes("戌") && xunAt(di, 0).name === "甲子");
  check("F 申＝後旬（甲戌旬）之空", xunAt(di, 1).voids.includes("申") && xunAt(di, 1).name === "甲戌");
  check("F 午＝外後旬（甲申旬）之空", xunAt(di, 2).voids.includes("午") && xunAt(di, 2).name === "甲申");
}
// 乙卯日の亥（後旬 甲子旬の空亡）
{
  const di = indexOfDay("乙", "卯");
  check("E 乙卯日 亥＝後旬（甲子旬）之空", xunAt(di, 1).name === "甲子" && xunAt(di, 1).voids.includes("亥"));
}

// ---- 720課: 連茹・連間で候補規則が成り立つ件数 ----
const moves = ["進茹", "退茹", "進間", "退間"];
const stats: Record<string, Record<string, number>> = Object.fromEntries(moves.map((m) => [m, { 課数: 0, 日旬空を含む: 0, ...Object.fromEntries(RULES.map((r) => [r.name.slice(0, 2), 0])) }]));
let r5EqualsAnyDayVoidForLianru = true;
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const flow = analyzeTransmissionFlow(buildInterpretationFacts(chart));
    if (flow.status !== "determined" || !moves.includes(flow.movementPattern)) continue;
    const ts = chart.transmissions!.map((t) => t.branch);
    const ks = ts.map((x) => xunOffsetOf(i, x));
    const dir = directionOf(ts);
    const st = stats[flow.movementPattern];
    st.課数 += 1;
    const anyDayVoid = chart.transmissions!.some((t) => t.isVoid);
    if (anyDayVoid) st.日旬空を含む += 1;
    for (const r of RULES) if (r.test(ks, dir)) st[r.name.slice(0, 2)] += 1;
    if ((flow.movementPattern === "進茹" || flow.movementPattern === "退茹") && RULES[4].test(ks, dir) !== anyDayVoid) r5EqualsAnyDayVoidForLianru = false;
  }
}
check("連茹では R5 ＝「三伝のどれかが日旬空」と同値", r5EqualsAnyDayVoidForLianru);


// ==== Phase 3M-B: 踏脚空亡・三伝皆空の定義監査（9例）====
//   各伝について「空」を別々に見る（1つの boolean にまとめない）:
//     日旬空   … 支そのものが占日の旬空（既存 isVoid）
//     坐空     … その支（天盤）が乗る地盤支が日旬空（plate.earthUnder）
//     天空     … その支に十二天将の天空が乗る（generals.generalOn）
//     R4       … Phase 3M-A の候補規則で、その伝が本旬から経路の向きにたどった旬の空亡に当たるか
type Example = { id: string; day: string; offset: number; ts: string; classical: string };
const EXAMPLES: Example[] = [
  { id: "A", day: "壬子", offset: 1, ts: "寅卯辰", classical: "進茹空亡・三伝皆空" },
  { id: "B", day: "甲午", offset: 1, ts: "辰巳午", classical: "三伝皆空" },
  { id: "C", day: "丁巳", offset: 11, ts: "卯寅丑", classical: "踏脚空亡・退歩伝全値空亡" },
  { id: "D", day: "戊申", offset: 11, ts: "卯寅丑", classical: "日鬼・鬼空" },
  { id: "E", day: "乙卯", offset: 11, ts: "丑子亥", classical: "踏脚空亡／直指 三傳皆空" },
  { id: "F", day: "甲子", offset: 10, ts: "戌申午", classical: "本旬之空・後旬之空・外後旬之空" },
  { id: "G", day: "丙午", offset: 11, ts: "卯寅丑", classical: "雖三傳生日、豈宜皆空" },
  { id: "H", day: "甲申", offset: 10, ts: "午辰寅", classical: "踏脚空亡格（午加申）" },
  { id: "I", day: "丙辰", offset: 10, ts: "丑亥酉", classical: "踏脚空亡格（丑加卯）" },
];
const detail: string[] = [];
const table: string[] = ["例 | 日 | 旬空 | 三伝 | 進退 | 日旬空 | 坐空 | 天空 | R4 | 空or坐空 | 四課三伝俱退 | 古典"];
for (const e of EXAMPLES) {
  const s = e.day[0] as Stem;
  const b = e.day[1] as Branch;
  const chart = calculateLiuren({ dayStem: s, dayBranch: b, divinationBranch: "子", monthGeneral: BRANCHES[e.offset] });
  const facts = buildInterpretationFacts(chart);
  const flow = analyzeTransmissionFlow(facts);
  const ts = chart.transmissions!.map((t) => t.branch);
  check(`3M-B ${e.id} 再現`, ts.join("") === e.ts, ts.join(""));
  const di = indexOfDay(s, b);
  const voids = chart.xun.voidBranches as readonly Branch[];
  const ks = ts.map((x) => xunOffsetOf(di, x));
  const dir = directionOf(ts);
  const r4 = RULES[3].test(ks, dir);
  const dayVoid = ts.map((x) => voids.includes(x));
  const seatVoid = ts.map((x) => voids.includes(chart.plate.earthUnder[x]));
  const sky = ts.map((x) => chart.generals.generalOn[x] === "天空");
  // 四課三伝俱退: 四課の上神がすべて下神（地盤支）から退き、三伝も退く
  const step = (from: Branch, to: Branch) => (BRANCHES.indexOf(to) - BRANCHES.indexOf(from) + 12) % 12;
  const lessonsRetreat = chart.lessons.every((l) => [10, 11].includes(step(l.lowerBranch, l.upper)));
  const allRetreat = lessonsRetreat && dir < 0;
  const flag = (xs: boolean[]) => xs.map((x) => (x ? "○" : "－")).join("");
  detail.push(`${e.id} ${e.day}日 天盤差${e.offset} 本旬${chart.xun.xunHead}旬 旬空${voids.join("")} 三伝${ts.join("")}（${chart.sanchuan.method}・${flow.status === "determined" ? flow.movementPattern : "-"}） 古典: ${e.classical}`);
  for (const l of facts.lessons) {
    detail.push(`    ${l.index}課 下${l.lower}（地盤${l.lowerBranch}${voids.includes(l.lowerBranch) ? "・空" : ""}） 上${l.upper}${voids.includes(l.upper) ? "・空" : ""} ${l.relation} ${l.zeike}`);
  }
  ts.forEach((x, i) => {
    const t = chart.transmissions![i];
    detail.push(`    ${["初伝", "中伝", "末伝"][i]} 天盤${x} 加 地盤${chart.plate.earthUnder[x]} ${t.relation} 天将${t.general} | 日旬空${dayVoid[i] ? "○" : "－"} 坐空${seatVoid[i] ? "○" : "－"} 天空${sky[i] ? "○" : "－"} 旬${K_NAME[ks[i]]}(k=${ks[i]})`);
  });
  // 四課（一課の地盤＝寄宮から）→三伝 の支の並び
  const chain = [chart.lessons[0].lowerBranch, chart.lessons[0].upper, chart.lessons[1].upper, chart.lessons[2].lowerBranch, chart.lessons[2].upper, chart.lessons[3].upper, ...ts];
  detail.push(`    支の並び 一課地盤→一課上→二課上 | 三課地盤→三課上→四課上 | 三伝: ${chain.slice(0, 3).join("→")} | ${chain.slice(3, 6).join("→")} | ${ts.join("→")}（四課も退く: ${lessonsRetreat ? "○" : "×"}）`);
  const either = ts.map((_, i) => dayVoid[i] || seatVoid[i]);
  table.push(`${e.id} | ${e.day} | ${voids.join("")} | ${ts.join("")} | ${flow.status === "determined" ? flow.movementPattern : "-"} | ${flag(dayVoid)} | ${flag(seatVoid)} | ${flag(sky)} | ${ks.join(",")}${r4 ? "○" : "×"} | ${flag(either)} | ${allRetreat ? "○" : "×"} | ${e.classical}`);
}

// 720課: 四課三伝俱退（天盤差 10・11 で三伝も退く）と空亡
const audit = { 俱退: 0, 俱退で日旬空あり: 0, 俱退でR4: 0, 俱退で空or坐空が三伝すべて: 0, 退茹退間: 0, 退茹退間で俱退でない: 0 };
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const flow = analyzeTransmissionFlow(buildInterpretationFacts(chart));
    if (flow.status !== "determined") continue;
    const ts = chart.transmissions!.map((t) => t.branch);
    const voids = chart.xun.voidBranches as readonly Branch[];
    const step = (from: Branch, to: Branch) => (BRANCHES.indexOf(to) - BRANCHES.indexOf(from) + 12) % 12;
    const lessonsRetreat = chart.lessons.every((l) => [10, 11].includes(step(l.lowerBranch, l.upper)));
    const retreatMove = flow.movementPattern === "退茹" || flow.movementPattern === "退間";
    if (retreatMove) audit.退茹退間 += 1;
    if (retreatMove && !lessonsRetreat) audit.退茹退間で俱退でない += 1;
    if (!(lessonsRetreat && retreatMove)) continue;
    audit.俱退 += 1;
    if (ts.some((x) => voids.includes(x))) audit.俱退で日旬空あり += 1;
    if (RULES[3].test(ts.map((x) => xunOffsetOf(i, x)), directionOf(ts))) audit.俱退でR4 += 1;
    if (ts.every((x) => voids.includes(x) || voids.includes(chart.plate.earthUnder[x]))) audit.俱退で空or坐空が三伝すべて += 1;
  }
}
console.log("==== Phase 3M-B 9例 ====");
for (const l of detail) console.log(`  ${l}`);
console.log("比較表:");
for (const l of table) console.log(`  ${l}`);
console.log(`720課 四課三伝俱退: ${JSON.stringify(audit)}`);
console.log("古典6例:");
for (const l of lines) console.log(`  ${l}`);
console.log("候補規則ごとに成り立つ例:");
for (const r of RULES) console.log(`  ${r.name}: ${ruleHits[r.name].join("・") || "なし"}`);
console.log("720課 連茹・連間での成立件数:");
for (const m of moves) console.log(`  ${m}: ${JSON.stringify(stats[m])}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
