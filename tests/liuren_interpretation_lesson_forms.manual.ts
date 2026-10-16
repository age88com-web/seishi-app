// tests/liuren_interpretation_lesson_forms.manual.ts
//
// 六壬神課 Phase 5P（課体 FACT lessonForms.ts と、婚姻・家宅の規則）のテスト。
// 実行: npx tsx tests/liuren_interpretation_lesson_forms.manual.ts
//
//   1. 六儀卦: 旬儀（旬首の支）・支儀（『心鏡』の表）が六十日すべてで正しく、初伝が旬儀・支儀のときだけ成立（720課）
//   2. 羅網格（『大全』）: 干上＝日干の寄宮の前一辰・支上＝日支の前一辰のときだけ成立。天羅は2書で一致、地網は2説を別々に持つ
//   3. 既存の判定（九宗門・格・patterns.ts）は判定し直さず、起課結果のまま参照する
//   4. DOMAIN との分離: 最終監査で、婚姻の六儀（『直指』）・家宅の羅網（『指南』陽宅章）への接続は保留。DOMAIN は課体 FACT を使わない
//   5. 古典の例: 羅網格は『指南』の占験3例（月将は原典の課名・三伝で選ぶ）で成立。旬儀は『断案２』例43「甲戌旬…戌は六儀」と一致
//   6. 起課結果・FACT を書き換えない。同じ入力で同じ結果。課体 FACT は吉凶を持たない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { detectClassicalPatterns } from "../src/lib/liuren/interpretation/patterns";
import { existingLessonFormsOf, lessonFormsOf, liuYiBranchesOf, liuYiGuaOf, luoWangOf, tianLuoDiWangOf } from "../src/lib/liuren/interpretation/lessonForms";
import { evaluateMarriageDomain } from "../src/lib/liuren/interpretation/marriageDomain";
import type { DomainResult } from "../src/lib/liuren/interpretation/domainResult";
import type { InterpretationContext } from "../src/lib/liuren/interpretation/roles";
import { readdirSync } from "node:fs";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const factsOf = (day: string, jiang: Branch, shi: Branch = "子") =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
const reading = (r: DomainResult, key: string) => r.readings.find((x) => x.key === key) ?? null;
const nxt = (b: Branch) => BRANCHES[(BRANCHES.indexOf(b) + 1) % 12] as Branch;
const LODGE: Record<string, Branch> = { 甲: "寅", 乙: "辰", 丙: "巳", 丁: "未", 戊: "巳", 己: "未", 庚: "申", 辛: "戌", 壬: "亥", 癸: "丑" };
const ZHI_YI = "午巳辰卯寅丑未申酉戌亥子"; // 子日から亥日（『心鏡』注の表）

// ---- 1・2. 720課 ----
{
  let liuOk = true, luoOk = true, liuSeen = 0, liuNotInit = 0, luoSeen = 0, halfLuo = 0, unchanged = true, det = true, xunOk = true;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`;
    const chart = calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[o] as Branch });
    const f = buildInterpretationFacts(chart), cb = JSON.stringify(chart), fb = JSON.stringify(f);
    const { xunYi, zhiYi } = liuYiBranchesOf(f);
    const head = BRANCHES[((i % 12) - (i % 10) + 12) % 12];
    if (xunYi !== head || zhiYi !== ZHI_YI[i % 12]) xunOk = false;
    const ly = liuYiGuaOf(f), init = f.transmissions![0].branch;
    if (ly.holds !== (init === xunYi || init === zhiYi)) liuOk = false;
    if (ly.holds) liuSeen += 1;
    if (!ly.holds && f.transmissions!.some((t) => t.branch === xunYi || t.branch === zhiYi)) liuNotInit += 1;
    const lw = luoWangOf(f), s = f.lessons[0].upper, z = f.lessons[2].upper;
    const exp = s === nxt(LODGE[day[0]]) && z === nxt(day[1] as Branch);
    if (lw.holds !== exp) luoOk = false;
    if (lw.holds) luoSeen += 1;
    // 干上・支上の条件は天地盤が一辰ずれる盤（地盤の各支の上に次の支が乗る）で同時に成り立ち、片方だけの盤はない
    if (lw.holds !== (f.plate.heavenOn["子"] === "丑")) halfLuo += 1;
    if (JSON.stringify(lessonFormsOf(f)) !== JSON.stringify(lessonFormsOf(f))) det = false;
    if (JSON.stringify(chart) !== cb || JSON.stringify(f) !== fb) unchanged = false;
  }
  check("旬儀（旬首の支）・支儀（『心鏡』の表）が六十日すべてで正しい", xunOk);
  check("六儀卦: 初伝が旬儀・支儀のときだけ成立（720課）", liuOk && liuSeen > 0, `${liuSeen}`);
  check("六儀卦: 旬儀・支儀が中伝・末伝にあるだけでは成立しない（「用得此神」）", liuNotInit > 0);
  check("羅網格: 干上＝寄宮の前一辰・支上＝日支の前一辰のときだけ成立（720課）", luoOk && luoSeen > 0, `${luoSeen}`);
  check("羅網格: 成立は「天地盤が一辰ずれる盤（各支の上に次の支）」と一致し、干上・支上の片方だけの盤はない（構造上同時に成り立つ）", halfLuo === 0);
  check("課体 FACT は同じ入力で同じ結果・起課結果と FACT を書き換えない", det && unchanged);
  const tl = tianLuoDiWangOf(factsOf("庚子", "子"));
  check("天羅は寄宮の前一辰（『心鏡』の例「庚日庚課申，則酉為天羅，卯為地網」）。地網は2説を別々に持つ（『心鏡』＝天羅の冲 卯／『大全』＝日支の前一辰）",
    tl.tianLuo === "酉" && tl.diWangXinJing === "卯" && tl.diWangDaQuan === "丑");
}

// ---- 3. 既存の判定 ----
{
  let same = true;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o += 5) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch);
    const e = existingLessonFormsOf(f);
    if (f.sanchuan.status !== "determined" || e.method !== f.sanchuan.method || e.pattern !== f.sanchuan.pattern || e.classical.join() !== detectClassicalPatterns(f).map((p) => p.kind).join()) same = false;
  }
  check("既存の判定（九宗門の法・格・patterns.ts）は起課結果・既存の関数の値そのまま（判定し直さない）", same);
  const code = readFileSync("src/lib/liuren/interpretation/lessonForms.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  check("課体 FACT は吉凶・向きを持たない（favoring・hindering・吉凶の語がない）", !/favoring|hindering|direction|吉凶/.test(code));
  check("起課エンジン（calculateLiuren・sanchuan の判定）を呼ばない", !/calculateLiuren|from "\.\.\/sanchuan/.test(code));
}

// ---- 4. DOMAIN との分離（最終監査で保留） ----
{
  const dir = "src/lib/liuren/interpretation";
  const users = readdirSync(dir).filter((x) => x.endsWith(".ts") && x !== "lessonForms.ts" && /from "\.\/lessonForms"/.test(readFileSync(`${dir}/${x}`, "utf8")));
  check("DOMAIN・既存 FACT は lessonForms を import しない（婚姻の六儀・家宅の羅網は保留）", users.length === 0, users.join(","));
  // 婚姻の「課伝所喜」は従来どおり元胎・連茹だけで、六儀卦が成立する盤でも六儀を書かない（既存の判断は消さない）
  let marOk = true, liuSeen = 0, oldKept = 0;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch);
    const fp = reading(evaluateMarriageDomain(f, { domain: "marriage", subtype: "proposal" } as InterpretationContext, "寅"), "favoredPattern");
    if (liuYiGuaOf(f).holds) { liuSeen += 1; if (fp && fp.detected.includes("六儀（")) marOk = false; }
    if (fp && (fp.detected.includes("元胎") || fp.detected.includes("連茹"))) oldKept += 1;
  }
  check("婚姻: 六儀卦が成立する盤でも「課伝所喜」に六儀を加えない。元胎・連茹の既存の読みは残る", marOk && liuSeen > 0 && oldKept > 0);
  const house = readFileSync("src/lib/liuren/interpretation/houseDomain.ts", "utf8");
  check("家宅: 羅網の規則（luoWangOnBodyHouse）を持たない", !house.includes("luoWang"));
}

// ---- 5. 古典の例 ----
const lines: string[] = [];
{
  // 羅網格: 『指南』の占験3例。月将は原典の課名・三伝で選ぶ（羅網の位置では選ばない）
  const C = [
    { name: "仕宦章 占験八（丁丑八月 己未日 辰時）「中末干支年命俱見羅網」", day: "己未", shi: "辰", jiang: "巳", pick: "原典の課名「八專」に合う 巳将" },
    { name: "仕宦章 占験十三（丁丑七月 甲戌日 巳時）「仕宦逢羅網」", day: "甲戌", shi: "巳", jiang: "午", pick: "原典の三伝 庚辰・辛巳・壬午 に合う 午将（課名は原典「重審」・エンジン「比用」で不一致）" },
    { name: "隠遁章 占験一（甲申五月 乙未日 未時）「日上羅網逢空」", day: "乙未", shi: "未", jiang: "申", pick: "原典の課名「蒿矢」に合う 申将" },
  ];
  let ok = true;
  for (const c of C) {
    const f = factsOf(c.day, c.jiang as Branch, c.shi as Branch), l = luoWangOf(f);
    if (!l.holds) ok = false;
    lines.push(`羅網格｜『指南』${c.name}｜${c.pick}｜${l.holds ? "成立" : "不成立"}（${l.detail}）`);
  }
  check("羅網格: 『指南』の占験3例（課名・三伝で選んだ月将）で成立する（課体の成立の検証。家宅の規則の出典ではない）", ok);
  const g = factsOf("乙未", "申", "未");
  check("隠遁章 占験一: 天羅 巳 が旬空（原典「日上羅網逢空」と一致）", g.xun.voidBranches.includes("巳") && g.lessons[0].upper === "巳");
  const s = factsOf("甲戌", "午", "巳");
  lines.push(`仕宦章 占験十三｜課名 原典「重審」・エンジン「${s.sanchuan.status === "determined" ? s.sanchuan.method : "-"}」（不一致の記録。起課は変えない）`);
  // 旬儀: 『断案２』例43（丁丑日・甲戌旬）「戌は六儀」。初伝は子なので六儀卦ではない（原典も六儀卦とは言わない）
  const e43 = factsOf("丁丑", "午", "未");
  check("『断案２』例43: 甲戌旬の旬儀は 戌（原典「戌は六儀」）、初伝 子 なので六儀卦は成立しない", liuYiBranchesOf(e43).xunYi === "戌" && !liuYiGuaOf(e43).holds && e43.transmissions![0].branch === "子");
  lines.push("六儀｜『断案２』例43（丁丑日 甲戌旬）「戌は六儀」｜旬儀 戌 と一致。初伝 子 なので六儀卦は不成立（原典も「六儀が助け守り」と言うだけ）");
  lines.push("六儀｜『六壬断案』例18「宅の六儀は…引進」｜抽出テキストに欠字があり照合できない");
}

console.log("古典の例:");
for (const l of lines) console.log(`  ${l}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
