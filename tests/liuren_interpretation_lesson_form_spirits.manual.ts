// tests/liuren_interpretation_lesson_form_spirits.manual.ts
//
// 六壬神課 Phase 5Q（神煞・盤上位置・課体の三層: lessonFormSpirits.ts・branchPlacement.ts）のテスト。
// 実行: npx tsx tests/liuren_interpretation_lesson_form_spirits.manual.ts
//
//   1. A 神煞そのもの: 旬儀・支儀・天羅・地網（『心鏡』／『大全』）が六十日すべてで原典の定義どおり。地網の2説は別の神煞で、違う日がある
//   2. B 盤上の位置: branchPlacementOf が既存の位置（markers・monthlySpirits・secondarySpirits・xingNianPlacement）と同じ値。旬空と坐空を別に持つ
//   3. C 課体の成立: 神煞があるだけ・中伝末伝にあるだけでは六儀卦にならない。羅網格は天羅（干上）と『大全』の地網（支上）だけで決まり、『心鏡』の地網を使わない
//   4. 既存の課体: lessonForms.ts の判定は Phase 5P と同じ式のまま（720課）
//   5. 原典の用例: 『断案２』例43・例50・例30、『指南』の「貴履天羅／地網」（固定神殺の辰・戌の用法。原典の盤の貴人で照合し、記録するだけ）。定義の文がない用例は求めない
//   6. DOMAIN との分離・吉凶なし: DOMAIN・既存 FACT は新しいファイルを使わない

import { readdirSync, readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { branchPlacementOf } from "../src/lib/liuren/interpretation/branchPlacement";
import type { BranchPlacement } from "../src/lib/liuren/interpretation/branchPlacement";
import { LESSON_FORM_SPIRIT_DEFINITIONS, LESSON_FORM_SPIRIT_IDS, LESSON_FORM_TERM_USAGES, lessonFormSpiritsOf } from "../src/lib/liuren/interpretation/lessonFormSpirits";
import { liuYiGuaOf, luoWangOf } from "../src/lib/liuren/interpretation/lessonForms";
import { branchMarker } from "../src/lib/liuren/interpretation/markers";
import { MONTHLY_SPIRIT_KINDS, monthlySpiritOf } from "../src/lib/liuren/interpretation/monthlySpirits";
import { SECONDARY_SPIRIT_KINDS, secondarySpiritOf } from "../src/lib/liuren/interpretation/secondarySpirits";
import { maleXingNianOf } from "../src/lib/liuren/interpretation/xingNian";
import { xingNianPlacementOf } from "../src/lib/liuren/interpretation/xingNianPlacement";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const factsOf = (day: string, jiang: Branch, shi: Branch = "子") =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
const at = (b: Branch, n: number) => BRANCHES[(BRANCHES.indexOf(b) + n + 12) % 12] as Branch;
const LODGE: Record<string, Branch> = { 甲: "寅", 乙: "辰", 丙: "巳", 丁: "未", 戊: "巳", 己: "未", 庚: "申", 辛: "戌", 壬: "亥", 癸: "丑" };
const ZHI_YI = "午巳辰卯寅丑未申酉戌亥子"; // 子日から亥日（『心鏡』注の表）
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const pick = (p: BranchPlacement) => ({ branch: p.branch, isVoid: p.isVoid, earthUnder: p.earthUnder, general: p.general, lessons: p.lessons, transmissions: p.transmissions });

// ---- 1〜4. 720課 ----
{
  let defOk = true, diffDiWang = 0, sameDiWang = 0;
  let markerOk = true, monthOk = true, secOk = true, xnOk = true, placeOk = true;
  let voidOnly = 0, seatOnly = 0, both = 0;
  let liuNotInit = 0, liuInitOk = true, liuFinalOnly = 0;
  let luoOk = true, tlInTransNoLuo = 0, xjOnZhiNoLuo = 0, unchanged = true;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`, db = day[1] as Branch;
    const chart = calculateLiuren({ dayStem: day[0] as Stem, dayBranch: db, divinationBranch: "子", monthGeneral: BRANCHES[o] as Branch });
    const f = buildInterpretationFacts(chart), cb = JSON.stringify(chart), fb = JSON.stringify(f);
    const sp = lessonFormSpiritsOf(f);
    // 1. A
    const head = BRANCHES[((i % 12) - (i % 10) + 12) % 12] as Branch, tl = at(LODGE[day[0]], 1);
    if (sp.xunYi.branch !== head || sp.zhiYi.branch !== ZHI_YI[i % 12] || sp.tianLuo.branch !== tl || sp.diWangXinJing.branch !== at(tl, 6) || sp.diWangDaQuan.branch !== at(db, 1)) defOk = false;
    if (sp.xunYi.basisBranch !== head || sp.zhiYi.basisBranch !== db || sp.tianLuo.basisBranch !== LODGE[day[0]] || sp.diWangXinJing.basisBranch !== tl || sp.diWangDaQuan.basisBranch !== db) defOk = false;
    if (o === 0) { if (sp.diWangXinJing.branch === sp.diWangDaQuan.branch) sameDiWang += 1; else diffDiWang += 1; }
    // 2. B: 既存の位置と同じ値
    for (const b of BRANCHES as readonly Branch[]) {
      const p = branchPlacementOf(f, b), m = branchMarker(f, "yima", "dayBranch", b);
      if (!same({ isVoid: p.isVoid, lessons: p.lessons, transmissions: p.transmissions }, { isVoid: m.isVoid, lessons: m.lessons, transmissions: m.transmissions })) markerOk = false;
      if (p.seatedOnVoid !== f.xun.voidBranches.includes(f.plate.earthUnder[b]) || p.heavenOn !== f.plate.heavenOn[b] || f.plate.earthUnder[p.heavenOn] !== b) placeOk = false;
      if (!same(p.lowerLessons, f.lessons.filter((l) => l.lowerBranch === b).map((l) => l.index))) placeOk = false;
      if (p.isVoid && !p.seatedOnVoid) voidOnly += 1; else if (!p.isVoid && p.seatedOnVoid) seatOnly += 1; else if (p.isVoid) both += 1;
    }
    if (i % 7 === 0) for (const mb of BRANCHES as readonly Branch[]) {
      for (const k of MONTHLY_SPIRIT_KINDS) { const m = monthlySpiritOf(f, k, mb)!; if (!same(pick(branchPlacementOf(f, m.branch)), { branch: m.branch, isVoid: m.isVoid, earthUnder: m.earthUnder, general: m.general, lessons: m.lessons, transmissions: m.transmissions })) monthOk = false; }
      for (const k of SECONDARY_SPIRIT_KINDS) { const s = secondarySpiritOf(f, k, { taiSui: mb, monthBranch: mb })!; if (!same(pick(branchPlacementOf(f, s.branch)), { branch: s.branch, isVoid: s.isVoid, earthUnder: s.earthUnder, general: s.general, lessons: s.lessons, transmissions: s.transmissions })) secOk = false; }
    }
    if (i % 11 === 0) for (let age = 1; age <= 12; age++) {
      const x = xingNianPlacementOf(f, "p", maleXingNianOf(age)), p = branchPlacementOf(f, x.branch), u = branchPlacementOf(f, x.upper);
      if (!(p.isVoid === x.isVoid && p.heavenOn === x.upper && p.heavenOnGeneral === x.upperGeneral && p.heavenOnIsVoid === x.upperIsVoid && p.earthUnder === x.skyEarth && p.general === x.skyGeneral
        && p.seatedOnVoid === x.skySeatedOnVoid && same(p.lessons.map((l) => l.index), x.lessons) && same((p.transmissions ?? []).map((t) => t.position), x.transmissions)
        && same(u.lessons.map((l) => l.index), x.upperLessons) && same((u.transmissions ?? []).map((t) => t.position), x.upperTransmissions))) xnOk = false;
    }
    // 3. C: 六儀卦は初伝だけ。神煞が中伝・末伝にあるだけでは成立しない
    const ly = liuYiGuaOf(f), inInit = [sp.xunYi, sp.zhiYi].some((s) => s.placement.transmissions!.some((t) => t.position === "initial"));
    if (ly.holds !== inInit) liuInitOk = false;
    if (!ly.holds && [sp.xunYi, sp.zhiYi].some((s) => s.placement.transmissions!.length > 0)) liuNotInit += 1;
    if (!ly.holds && [sp.xunYi, sp.zhiYi].some((s) => s.placement.transmissions!.some((t) => t.position === "final"))) liuFinalOnly += 1;
    // 羅網格は天羅が干上（一課）・『大全』の地網が支上（三課）
    const lw = luoWangOf(f), onS = sp.tianLuo.placement.lessons.some((l) => l.index === 1), onZ = sp.diWangDaQuan.placement.lessons.some((l) => l.index === 3);
    if (lw.holds !== (onS && onZ)) luoOk = false;
    if (!lw.holds && (sp.tianLuo.placement.transmissions!.length > 0 || sp.tianLuo.placement.lessons.length > 0)) tlInTransNoLuo += 1;
    if (!lw.holds && sp.diWangXinJing.placement.lessons.some((l) => l.index === 3)) xjOnZhiNoLuo += 1;
    if (JSON.stringify(chart) !== cb || JSON.stringify(f) !== fb) unchanged = false;
  }
  check("A: 旬儀・支儀・天羅・地網（『心鏡』＝天羅の冲／『大全』＝日支の前一辰）の支と基準が六十日すべてで原典の定義どおり", defOk);
  check("A: 地網の2説は別の神煞として持ち、六十日のうち支が違う日がある（同じ日もあるが統合しない）", diffDiWang > 0 && LESSON_FORM_SPIRIT_IDS.includes("diWangXinJing") && LESSON_FORM_SPIRIT_IDS.includes("diWangDaQuan"), `違う ${diffDiWang}・同じ ${sameDiWang}`);
  check("B: 支の旬空・四課上神・三伝は既存の branchMarker（markers.ts）と同じ値", markerOk);
  check("B: 月建の神煞・第1群（monthlySpirits）の位置と同じ値（7種×12か月）", monthOk);
  check("B: 太歳・第2群の神煞（secondarySpirits）の位置と同じ値（6種）", secOk);
  check("B: 行年の位置（xingNianPlacement）の天盤側・地盤側（行年上神）・坐空と同じ値", xnOk);
  check("B: 地盤側の上神（heavenOn）・坐空・四課の下が起課結果どおり", placeOk);
  check("B: 旬空（支そのもの）と坐空（加わる地盤が旬空）は別の項目で、片方だけの盤がどちらもある", voidOnly > 0 && seatOnly > 0, `旬空のみ ${voidOnly}・坐空のみ ${seatOnly}・両方 ${both}`);
  check("C: 六儀卦の成立は、旬儀・支儀が初伝にあることと一致する（720課）", liuInitOk);
  check("C: 旬儀・支儀が三伝にあっても初伝でなければ六儀卦は成立しない（末伝だけの盤を含む）", liuNotInit > 0 && liuFinalOnly > 0, `${liuNotInit}・末伝 ${liuFinalOnly}`);
  check("C: 羅網格の成立は、天羅が干上かつ『大全』の地網が支上であることと一致する（720課）", luoOk);
  check("C: 天羅が四課・三伝にあっても羅網格でない盤がある（神煞の存在だけでは成立しない）", tlInTransNoLuo > 0, `${tlInTransNoLuo}`);
  check("C: 『心鏡』の地網が支上にあっても羅網格にはならない盤がある（羅網格は『大全』の地網だけで判定）", xjOnZhiNoLuo > 0, `${xjOnZhiNoLuo}`);
  check("起課結果・FACT を書き換えない", unchanged);
}

// ---- 4. 既存の課体の式（Phase 5P と同じ） ----
{
  let ok = true;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`;
    const f = factsOf(day, BRANCHES[o] as Branch), init = f.transmissions![0].branch;
    const xun = BRANCHES[((i % 12) - (i % 10) + 12) % 12] as Branch, zy = ZHI_YI[i % 12] as Branch;
    if (liuYiGuaOf(f).holds !== (init === xun || init === zy)) ok = false;
    if (luoWangOf(f).holds !== (f.lessons[0].upper === at(LODGE[day[0]], 1) && f.lessons[2].upper === at(day[1] as Branch, 1))) ok = false;
  }
  check("既存の課体: 六儀卦・羅網格の判定は Phase 5P の成立条件のまま（720課）", ok);
}

// ---- 5. 原典の用例 ----
const lines: string[] = [];
{
  // 『断案２』例43（戊申年六月 丁丑日 午将 未時）: 旬儀 戌 は末伝で亥の上。初伝 子 なので六儀卦は不成立
  const e43 = factsOf("丁丑", "午", "未"), s43 = lessonFormSpiritsOf(e43);
  const x = s43.xunYi.placement;
  check("『断案２』例43: 旬儀 戌 は末伝（地盤 亥 の上）で初伝ではない。六儀卦は不成立（末伝の六儀は六儀卦の証拠にしない）",
    x.branch === "戌" && same(x.transmissions!.map((t) => t.position), ["final"]) && x.earthUnder === "亥" && e43.transmissions![0].branch === "子" && !liuYiGuaOf(e43).holds);
  lines.push(`六儀｜『断案２』例43｜旬儀 戌＝末伝・地盤 ${x.earthUnder}（原典「戌が乾に加わる」）・初伝 ${e43.transmissions![0].branch}・六儀卦 ${liuYiGuaOf(e43).holds ? "成立" : "不成立"}`);
  // 『断案２』例50（戊寅日 申将 未時）「干支がみな天羅羊刃」「子が今日の地網」
  const e50 = factsOf("戊寅", "申", "未"), s50 = lessonFormSpiritsOf(e50);
  check("『断案２』例50: 干上 午＝天羅・支上 卯＝『大全』の地網（「干支がみな天羅」と一致）。『心鏡』の地網は 子（原典「子が今日の地網」と同じ支。推論）",
    e50.lessons[0].upper === "午" && s50.tianLuo.branch === "午" && e50.lessons[2].upper === "卯" && s50.diWangDaQuan.branch === "卯" && s50.diWangXinJing.branch === "子" && luoWangOf(e50).holds);
  lines.push(`天羅地網｜『断案２』例50｜干上 ${e50.lessons[0].upper}（天羅 ${s50.tianLuo.branch}）・支上 ${e50.lessons[2].upper}（『大全』地網 ${s50.diWangDaQuan.branch}）・『心鏡』地網 ${s50.diWangXinJing.branch}（原典「子が今日の地網」）`);
  // 『断案２』例30（甲寅日 未将 午時）「巳が辰に加わるのは勾地網」: どの定義とも合わない
  const e30 = factsOf("甲寅", "未", "午"), s30 = lessonFormSpiritsOf(e30);
  check("『断案２』例30: 巳が辰に加わる。地網（『心鏡』酉・『大全』卯）とも合わない（unmatched のまま）",
    e30.plate.earthUnder["巳"] === "辰" && !["巳", "辰"].includes(s30.diWangXinJing.branch) && !["巳", "辰"].includes(s30.diWangDaQuan.branch));
  lines.push(`地網｜『断案２』例30｜巳→地盤 ${e30.plate.earthUnder["巳"]}・『心鏡』地網 ${s30.diWangXinJing.branch}・『大全』地網 ${s30.diWangDaQuan.branch}｜一致しない`);

  // 『指南』「貴履天羅／地網」など。天地盤はエンジン、天将は原典の盤（貴人はエンジンの昼夜と違う例がある）
  const Z = [
    { n: "仕宦章 占験一（甲申日 未時・戌将 重審）「貴履地網」", day: "甲申", shi: "未", j: "戌", b: "丑", earth: "戌", m: "重審" },
    { n: "仕宦章 占験七（辛巳日 卯時・亥将 元首）「貴履地網」", day: "辛巳", shi: "卯", j: "亥", b: "午", earth: "戌", m: "元首" },
    { n: "占訟章 占験十八（甲子日 巳時・申将 重審）「貴履地網」", day: "甲子", shi: "巳", j: "申", b: "丑", earth: "戌", m: "重審" },
    { n: "仕宦章 占験十七（丙寅日 卯時・戌将 知一）「禄巳加戌入墓地網」", day: "丙寅", shi: "卯", j: "戌", b: "巳", earth: "戌", m: "比用" },
    { n: "仕宦章 占験十八（丁亥日 未時・辰将 元首）「日未臨戌入地網」", day: "丁亥", shi: "未", j: "辰", b: "未", earth: "戌", m: "元首" },
    { n: "仕宦章 占験十六（丁酉日 卯時・戌将 重審）「命上官貴履天羅」", day: "丁酉", shi: "卯", j: "戌", b: "亥", earth: "辰", m: "重審" },
    { n: "仕宦章 占験十七（丙寅日 卯時・戌将 知一）「官貴履天羅之地」", day: "丙寅", shi: "卯", j: "戌", b: "亥", earth: "辰", m: "比用" },
    { n: "仕宦章 占験三十（己未日 戌時・午将 三伝 卯亥未）「貴履天羅」", day: "己未", shi: "戌", j: "午", b: "子", earth: "辰", m: "元首" },
  ];
  let zOk = true, notDef = true;
  for (const z of Z) {
    const f = factsOf(z.day, z.j as Branch, z.shi as Branch), s = lessonFormSpiritsOf(f), p = branchPlacementOf(f, z.b as Branch);
    const method = f.sanchuan.status === "determined" ? f.sanchuan.method : "-";
    if (p.earthUnder !== z.earth || method !== z.m) zOk = false;
    // 地盤の辰・戌（固定神殺の用法）は、日干・日支から求める『心鏡』『大全』の天羅・地網とは別
    if ([s.tianLuo.branch, s.diWangXinJing.branch, s.diWangDaQuan.branch].includes(z.earth as Branch)) notDef = false;
    lines.push(`天羅／地網｜『指南』${z.n}｜原典の盤の ${z.b} → 地盤 ${p.earthUnder}｜天羅 ${s.tianLuo.branch}・『心鏡』地網 ${s.diWangXinJing.branch}・『大全』地網 ${s.diWangDaQuan.branch}｜エンジン ${method}`);
  }
  check("『指南』: 「履天羅」は地盤の辰、「地網」は地盤の戌に当たる（8か所。月将は原典の課名・三伝に合う方）", zOk);
  check("『指南』: その辰・戌は『心鏡』『大全』の天羅・地網と別（固定神殺の用法として記録するだけで、求めない）", notDef
    && LESSON_FORM_TERM_USAGES.filter((u) => u.status === "fixedSpiritUsage").length === 2 && LESSON_FORM_TERM_USAGES.filter((u) => u.status === "fixedSpiritUsage").every((u) => u.matches.length === 0));
  check("用例: 定義の文がない・見る位置が書かれていない・合わない用例は、どの神煞の定義にも結び付けない（定義の一致は確かめたものだけ）",
    LESSON_FORM_TERM_USAGES.every((u) => (u.status === "undefinedTerm" || u.status === "unmatched" || u.status === "fixedSpiritUsage") ? u.matches.length === 0 : true)
    && LESSON_FORM_TERM_USAGES.filter((u) => u.status === "definesLessonForm").length === 2);
  check("用例: 『直指』婚姻の六儀・『指南』陽宅章の羅網は、位置未確定・定義なしとして持つ（課体に結び付けない）",
    LESSON_FORM_TERM_USAGES.some((u) => u.source === "『御定六壬直指』" && u.term === "六儀" && u.status === "positionUnstated")
    && LESSON_FORM_TERM_USAGES.some((u) => u.locator === "陽宅章" && u.status === "undefinedTerm"));
}

// ---- 6. DOMAIN との分離・吉凶なし ----
{
  const dir = "src/lib/liuren/interpretation";
  const importers = (mod: string) => readdirSync(dir).filter((x) => x.endsWith(".ts") && new RegExp(`from "\\./${mod}"`).test(readFileSync(`${dir}/${x}`, "utf8")));
  check("lessonFormSpirits を使うのは課体（lessonForms.ts）だけ", same(importers("lessonFormSpirits"), ["lessonForms.ts"]), importers("lessonFormSpirits").join(","));
  check("branchPlacement を使うのは lessonFormSpirits.ts だけ（既存の位置の構造は変えない）", same(importers("branchPlacement"), ["lessonFormSpirits.ts"]), importers("branchPlacement").join(","));
  check("lessonForms を import するファイルはない（婚姻の六儀・家宅の羅網は保留のまま）", importers("lessonForms").length === 0, importers("lessonForms").join(","));
  for (const file of ["lessonFormSpirits.ts", "branchPlacement.ts"]) {
    const code = readFileSync(`${dir}/${file}`, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
    check(`${file}: 吉凶・向きを持たず、起課エンジンを呼ばない`, !/favoring|hindering|direction|吉凶|calculateLiuren|from "\.\.\/sanchuan/.test(code));
  }
  check("定義はすべて原文に明示（推測した算法を持たない）", LESSON_FORM_SPIRIT_IDS.every((id) => LESSON_FORM_SPIRIT_DEFINITIONS[id].status === "explicit" && LESSON_FORM_SPIRIT_DEFINITIONS[id].sources.length > 0));
}

console.log("古典の例:");
for (const l of lines) console.log(`  ${l}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
