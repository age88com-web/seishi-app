// tests/liuren_interpretation_secondary_spirits.manual.ts
//
// 六壬神課 Phase 5M（太歳・第2群の神煞 secondarySpirits.ts と、それを使う家宅の規則）のテスト。
// 実行: npx tsx tests/liuren_interpretation_secondary_spirits.manual.ts
//
//   1. 十二支すべてで6種（病符・歳破＝太歳基準、天鬼・関神・生神・死神＝月支基準）の支が原典の起例と一致
//   2. 原典の例: 病符（『大全』の起例の例）・天鬼・死神、歳破（『大六壬指南』の占験4例。起例の文がないので例から求めた算法）
//   3. 確定状況・出典・原典差（生神と死気・死神と死気を統合しない、天車・浴盆を作らない）
//   4. 基準（太歳・月支）がなければ null（推測しない）。盤上の位置が facts と一致。同じ入力で同じ結果。FACT を書き換えない
//   5. 家宅: 病符が宅上で支を剋す（天鬼・白虎は detected に添える）、干墓并関（初伝が日干の墓で関神。干の二課＝人衰／支の二課＝宅廃）

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { STEM_ELEMENT } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { monthlySpiritBranchOf } from "../src/lib/liuren/interpretation/monthlySpirits";
import {
  SECONDARY_SPIRIT_DEFINITIONS, SECONDARY_SPIRIT_KINDS, secondarySpiritBranchOf, secondarySpiritOf, secondarySpiritsOf,
} from "../src/lib/liuren/interpretation/secondarySpirits";
import type { SecondarySpiritKind } from "../src/lib/liuren/interpretation/secondarySpirits";
import { evaluateHouseDomain } from "../src/lib/liuren/interpretation/houseDomain";
import { taiSuiStateOf } from "../src/lib/liuren/interpretation/taiSui";
import { relationBetween } from "../src/lib/liuren/interpretation/relations";
import { growthStageOf } from "../src/lib/liuren/interpretation/states";
import type { DomainResult } from "../src/lib/liuren/interpretation/domainResult";
import type { InterpretationContext } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const factsOf = (day: string, jiang: Branch, shi: Branch = "子") =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
type F = ReturnType<typeof factsOf>;
const reading = (r: DomainResult, key: string) => r.readings.find((x) => x.key === key) ?? null;
const monthOf = (n: number): Branch => BRANCHES[(n + 1) % 12] as Branch;

// ---- 1. 十二支の対応 ----
{
  // 太歳基準（子年から亥年）。病符＝前年の太歳、歳破＝太歳の冲
  const BING = "亥子丑寅卯辰巳午未申酉戌", PO = "午未申酉戌亥子丑寅卯辰巳";
  // 月支基準（正月＝寅月から十二月）
  const GUI = "酉午卯子酉午卯子酉午卯子", GUAN = "丑丑丑辰辰辰未未未戌戌戌", SHENG = "午未申酉戌亥子丑寅卯辰巳", SI = "巳午未申酉戌亥子丑寅卯辰";
  const bad: string[] = [];
  BRANCHES.forEach((t, k) => {
    if (secondarySpiritBranchOf("bingFu", t as Branch) !== BING[k]) bad.push(`病符 ${t}`);
    if (secondarySpiritBranchOf("suiPo", t as Branch) !== PO[k]) bad.push(`歳破 ${t}`);
  });
  for (let n = 1; n <= 12; n++) {
    const m = monthOf(n);
    if (secondarySpiritBranchOf("tianGui", m) !== GUI[n - 1]) bad.push(`天鬼 ${n}月`);
    if (secondarySpiritBranchOf("guanShen", m) !== GUAN[n - 1]) bad.push(`関神 ${n}月`);
    if (secondarySpiritBranchOf("shengShen", m) !== SHENG[n - 1]) bad.push(`生神 ${n}月`);
    if (secondarySpiritBranchOf("siShen", m) !== SI[n - 1]) bad.push(`死神 ${n}月`);
  }
  check("6種×十二支（太歳・月支）がすべて原典の起例と一致", bad.length === 0, bad.join(","));
  check("支でない値は例外", (() => { try { secondarySpiritBranchOf("bingFu", "甲" as Branch); return false; } catch { return true; } })());
  check("病符は太歳の前、歳破は太歳と冲（6支離れる）", BRANCHES.every((t) => BRANCHES.indexOf(secondarySpiritBranchOf("suiPo", t as Branch)) === (BRANCHES.indexOf(t) + 6) % 12));
}

// ---- 2. 原典の例 ----
const caseLines: string[] = [];
{
  check("『大全』病符の例「子年亥為病符，丑年子為病符」", secondarySpiritBranchOf("bingFu", "子") === "亥" && secondarySpiritBranchOf("bingFu", "丑") === "子");
  check("『心鏡』天鬼の例「正月酉，二月午」", secondarySpiritBranchOf("tianGui", monthOf(1)) === "酉" && secondarySpiritBranchOf("tianGui", monthOf(2)) === "午");
  check("『心鏡』巻三「六月死神來至戌」（起例と同じ書の例）", secondarySpiritBranchOf("siShen", monthOf(6)) === "戌");
  // 歳破: 『大六壬指南』の占験4例。月将は節気の前後の2候補のうち、原典の位置と一致した方（規則の出典ではない）
  const SUI: { name: string; day: string; shi: Branch; jiang: Branch; year: Branch; pos: "initial" | "middle" | "final"; quote: string; gen?: string }[] = [
    { name: "章奏章 占験五（辛未年六月 癸卯日 卯時 未将）", day: "癸卯", shi: "卯", jiang: "未", year: "未", pos: "middle", quote: "独存中传，岁破为鬼" },
    { name: "応候章 占験四（庚寅年十月 辛巳日 午時 卯将）", day: "辛巳", shi: "午", jiang: "卯", year: "寅", pos: "final", quote: "末传太阴刀乘岁破冲克太岁", gen: "太陰" },
    { name: "占訟章 占験四（壬午年七月 甲午日 午時 巳将）", day: "甲午", shi: "午", jiang: "巳", year: "午", pos: "initial", quote: "岁破发用" },
    { name: "仕宦章 占験十九（壬午年十二月 甲午日 未時 子将）", day: "甲午", shi: "未", jiang: "子", year: "午", pos: "initial", quote: "初传岁破内战" },
  ];
  const IDX = { initial: 0, middle: 1, final: 2 } as const;
  let ok = true;
  for (const c of SUI) {
    const f = factsOf(c.day, c.jiang, c.shi), p = secondarySpiritOf(f, "suiPo", { taiSui: c.year })!;
    const t = f.transmissions![IDX[c.pos]];
    const hit = t.branch === p.branch;
    if (!hit) ok = false;
    const genText = c.gen ? `｜天将 原典 ${c.gen}／エンジン ${f.generals.generalOn[t.branch]}（${c.gen === f.generals.generalOn[t.branch] ? "一致" : "不一致。原因は未確定・起課は変更しない"}）` : "";
    caseLines.push(`${c.name}｜三伝 ${f.transmissions!.map((x) => x.branch).join("")}｜歳破 ${p.branch}（太歳 ${c.year} の冲）が${({ initial: "初伝", middle: "中伝", final: "末伝" })[c.pos]}${hit ? "で原典と一致" : "でない"}${genText}`);
  }
  check("歳破: 『指南』の占験4例で、原典が歳破とする位置（中伝・末伝・初伝2）が太歳の冲と一致", ok);
  check("歳破は例から求めた算法（reconstructedFromExamples）で、例は規則の出典でない（role＝example）",
    SECONDARY_SPIRIT_DEFINITIONS.suiPo.status === "reconstructedFromExamples" && SECONDARY_SPIRIT_DEFINITIONS.suiPo.sources.length === 4 && SECONDARY_SPIRIT_DEFINITIONS.suiPo.sources.every((s) => s.role === "example" && s.source === "『大六壬指南』"));
}

// ---- 3. 確定状況・原典差 ----
{
  const D = SECONDARY_SPIRIT_DEFINITIONS;
  check("病符・天鬼・関神・生神・死神は起例が明示（explicit）で、起例の文（rule）を出典に持つ",
    (["bingFu", "tianGui", "guanShen", "shengShen", "siShen"] as const).every((k) => D[k].status === "explicit" && D[k].sources.some((s) => s.role === "rule")));
  check("基準: 病符・歳破は太歳、天鬼・関神・生神・死神は月支", D.bingFu.basis === "taiSui" && D.suiPo.basis === "taiSui" && (["tianGui", "guanShen", "shengShen", "siShen"] as const).every((k) => D[k].basis === "monthBranch"));
  check("生神は位置が死気（正月午）と常に同じだが別の神煞として持つ", BRANCHES.every((m) => secondarySpiritBranchOf("shengShen", m as Branch) === monthlySpiritBranchOf("siQi", m as Branch)) &&
    D.shengShen.name === "生神" && D.shengShen.notes.some((n) => n.includes("統合しない")));
  check("死神（正月巳）は死気（正月午）と別の支・別の神煞", BRANCHES.every((m) => secondarySpiritBranchOf("siShen", m as Branch) !== monthlySpiritBranchOf("siQi", m as Branch)));
  const code = readFileSync("src/lib/liuren/interpretation/secondarySpirits.ts", "utf8");
  const body = code.replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  check("天車（原典差）・浴盆（疾病 DOMAIN に既存）は作らない", !SECONDARY_SPIRIT_KINDS.some((k) => ["tianChe", "yuPen"].includes(k)) && code.includes("天車煞即關神") && code.includes("重複して作らない"));
  check("monthlySpirits・markers を import しない（既存の神煞 FACT を変えない）", !/from "\.\/(monthlySpirits|markers)"/.test(body));
  check("関神の出典に『大全』卷十・鬼墓課と『心鏡』巻六の3つがあり、天車との食い違いを注記", D.guanShen.sources.length === 3 && D.guanShen.notes.some((n) => n.includes("天車")));
}

// ---- 4. 基準・位置・決定性 ----
{
  const f = factsOf("甲子", "卯");
  const none = secondarySpiritsOf(f, {});
  check("太歳・月支がなければ6種とも null（推測しない）", SECONDARY_SPIRIT_KINDS.every((k) => none[k] === null));
  const onlyT = secondarySpiritsOf(f, { taiSui: "子" }), onlyM = secondarySpiritsOf(f, { monthBranch: "寅" });
  check("太歳だけなら病符・歳破だけ、月支だけなら天鬼・関神・生神・死神だけ求める",
    !!onlyT.bingFu && !!onlyT.suiPo && !onlyT.tianGui && !onlyT.siShen && !onlyM.bingFu && !onlyM.suiPo && !!onlyM.tianGui && !!onlyM.guanShen && !!onlyM.shengShen && !!onlyM.siShen);
  let placementOk = true, det = true, unchanged = true, n = 0;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const chart = calculateLiuren({ dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[o] as Branch });
    const g = buildInterpretationFacts(chart), before = JSON.stringify(g), cb = JSON.stringify(chart);
    for (const b of BRANCHES) {
      const s = secondarySpiritsOf(g, { taiSui: b as Branch, monthBranch: b as Branch });
      if (JSON.stringify(s) !== JSON.stringify(secondarySpiritsOf(g, { taiSui: b as Branch, monthBranch: b as Branch }))) det = false;
      for (const k of SECONDARY_SPIRIT_KINDS) {
        const p = s[k]!; n += 1;
        if (p.earthUnder !== g.plate.earthUnder[p.branch] || p.general !== g.generals.generalOn[p.branch] || p.isVoid !== g.xun.voidBranches.includes(p.branch) ||
          p.lessons.map((l) => l.index).join("") !== g.lessons.filter((l) => l.upper === p.branch).map((l) => l.index).join("") ||
          (p.transmissions ?? []).length !== g.transmissions!.filter((t) => t.branch === p.branch).length) placementOk = false;
      }
    }
    if (JSON.stringify(g) !== before || JSON.stringify(chart) !== cb) unchanged = false;
  }
  check(`720課×十二支×6種（${n}件）の盤上の位置（四課上神・三伝・地盤・天将・旬空）が facts と一致`, placementOk && n === 720 * 12 * 6);
  check("同じ入力で同じ結果", det);
  check("神煞を求めても起課結果・解釈 FACT が変わらない", unchanged);
}

// ---- 5. 家宅の規則 ----
{
  const house = (f: F, ts: Branch | null, mb: Branch | null, goal?: string) =>
    evaluateHouseDomain(f, { domain: "house", subtype: "residence", ...(ts ? { taiSui: taiSuiStateOf(ts) } : {}), ...(goal ? { goal } : {}) } as InterpretationContext, mb);
  let bingOk = true, guiSeen = 0, tigerSeen = 0, siteNoOvercome = 0, guanOk = true, guanP = 0, guanH = 0, earthOk = true, noTaiOk = true, leaveOk = true, ambSeen = 0, ambOk = true;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch);
    for (const ts of BRANCHES) {
      const mb = BRANCHES[(i + o + BRANCHES.indexOf(ts)) % 12] as Branch;
      const r = house(f, ts as Branch, mb), bf = secondarySpiritBranchOf("bingFu", ts as Branch);
      const site = f.lessons[2].upper, cond = site === bf && relationBetween(bf, f.basic.dayBranch).relations.includes("overcomes");
      const x = reading(r, "bingFuOnSite");
      if (!!x !== cond) bingOk = false;
      if (site === bf && !cond) siteNoOvercome += 1;
      if (x) {
        const gui = secondarySpiritBranchOf("tianGui", mb) === bf;
        if (x.detected.includes("天鬼") !== gui || x.direction !== "hindering") bingOk = false;
        if (gui) guiSeen += 1;
        if (f.generals.generalOn[bf] === "白虎") { tigerSeen += 1; if (!x.detected.includes("白虎")) bingOk = false; }
      }
      if (ts !== "子" && ts !== "午") continue; // 干墓并関は太歳によらない（月だけ変えて2回見る）
      const init = f.transmissions![0].branch, earth = STEM_ELEMENT[f.basic.dayStem] === "土";
      const tomb = !earth && init === secondarySpiritBranchOf("guanShen", mb) && growthStageOf(STEM_ELEMENT[f.basic.dayStem], init) === "墓";
      const o2 = f.sanchuan.status === "determined" ? f.sanchuan.initialOrigin : null;
      const unique = !!o2 && (o2.kind === "uniqueLesson" || o2.kind === "ruleLesson");
      const lesson = unique ? (o2 as { lesson: number }).lesson : 0;
      const p = tomb && unique && lesson <= 2, h = tomb && unique && lesson >= 3;
      if (!!reading(r, "stemTombGuanShenPerson") !== p || !!reading(r, "stemTombGuanShenHouse") !== h) guanOk = false;
      if (tomb && !unique) {
        ambSeen += 1;
        if (reading(r, "stemTombGuanShenPerson") || reading(r, "stemTombGuanShenHouse") || !r.missing.some((m) => m.key === "stemTombGuanOrigin")) ambOk = false;
      }
      if (p) guanP += 1;
      if (h) { guanH += 1; if (reading(house(f, ts as Branch, mb, "release"), "stemTombGuanShenHouse")?.direction !== "neutral") leaveOk = false; }
      if (earth && (reading(r, "stemTombGuanShenPerson") || reading(r, "stemTombGuanShenHouse"))) earthOk = false;
    }
    const nt = house(f, null, BRANCHES[(i + o) % 12] as Branch);
    if (reading(nt, "bingFuOnSite") || !nt.summary.includes("太歳がないので病符は求めない")) noTaiOk = false;
  }
  check("病符: 宅上が病符で日支を剋す、と720課×太歳12で完全に一致（向きは妨げ）", bingOk);
  check("病符: 宅上が病符でも支を剋さなければ成立しない（神煞の存在だけで成立しない）", siteNoOvercome > 0);
  check("病符: 天鬼と同じ支・白虎が乗る盤では detected にその旨を添える", guiSeen > 0 && tigerSeen > 0, `${guiSeen}/${tigerSeen}`);
  check("病符: 太歳がなければ出さず、要約に「太歳がないので病符は求めない」と書く", noTaiOk);
  check("干墓并関: 初伝が日干の墓で関神、発用元が干の二課＝人衰・支の二課＝宅廃、と完全に一致", guanOk && guanP > 0 && guanH > 0, `${guanP}/${guanH}`);
  check("干墓并関: 土日は判断しない", earthOk);
  check("干墓并関: 発用元が課から取らない盤（derived）は方向を出さず不足にする", ambSeen > 0 && ambOk, `${ambSeen}`);
  // 720課で初伝が日干の墓（辰戌丑未）かつ発用元が ambiguousLessons の盤は 壬午日 巳将（第1・4課が同じ上神 辰）だけ。夏（関神 辰）で確かめる
  const amb = factsOf("壬午", "巳");
  const ambR = house(amb, null, "午");
  check("干墓并関: 壬午日 巳将（初伝 辰 の発用元が第1・4課で一つに決まらない）は人衰・宅廃を出さず不足に出す",
    amb.sanchuan.status === "determined" && amb.sanchuan.initialOrigin.kind === "ambiguousLessons" && !reading(ambR, "stemTombGuanShenPerson") && !reading(ambR, "stemTombGuanShenHouse") &&
    ambR.missing.some((m) => m.key === "stemTombGuanOrigin" && m.detail.includes("第1・4課")));
  // 候補がすべて干側の ambiguousLessons は720課に現れないので、発用元だけを差し替えた FACT で確かめる（起課は変えない）
  let synthOk = false;
  for (let i = 0; i < 60 && !synthOk; i++) for (const j of BRANCHES) {
    const g = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, j as Branch);
    for (const mb of BRANCHES) {
      const base = house(g, null, mb as Branch);
      const x = reading(base, "stemTombGuanShenPerson");
      if (!x || g.sanchuan.status !== "determined") continue;
      const o = g.sanchuan.initialOrigin as { branch: Branch; method: string };
      const fake = { ...g, sanchuan: { ...g.sanchuan, initialOrigin: { kind: "ambiguousLessons", lessons: [1, 2], branch: o.branch, method: o.method } } } as F;
      const r2 = house(fake, null, mb as Branch);
      synthOk = !reading(r2, "stemTombGuanShenPerson") && r2.missing.some((m) => m.key === "stemTombGuanOrigin");
      break;
    }
  }
  check("干墓并関: 発用元の候補がすべて干側（第1・2課）でも一つの課に決まらなければ方向を出さない（発用元だけ差し替えた FACT）", synthOk);
  check("干墓并関（宅廃）: 家を離れたい問いでは向きを決めない", leaveOk);
  // 『大全』卷十の例（規則の出典。独立した検証ではない）: 乙丑・乙未・乙酉・乙亥日の秋の占で未（干の墓・関神）が干上から発用＝人衰。
  // 丁卯日は戌（干の墓）が支上から発用＝宅廃（冬の関神 戌）。占時・月将は原典にないので、成立する盤があるかだけを見る
  const exists = (day: string, months: Branch[], key: string) => BRANCHES.some((j) => BRANCHES.some((shi) => months.some((mb) => !!reading(house(factsOf(day, j as Branch, shi as Branch), null, mb), key))));
  check("『大全』の例: 乙丑・乙未・乙酉・乙亥日の秋（申酉戌月）に、未が干の二課から発用して人衰が成立する盤がある（規則の出典の例）",
    ["乙丑", "乙未", "乙酉", "乙亥"].every((d) => exists(d, ["申", "酉", "戌"], "stemTombGuanShenPerson")));
  check("『大全』の例: 丁卯日の冬（亥子丑月）に、戌が支の二課から発用して宅廃が成立する盤がある（規則の出典の例）", exists("丁卯", ["亥", "子", "丑"], "stemTombGuanShenHouse"));
  const s = house(factsOf("癸卯", "申", "午"), "丑", "巳").summary;
  check("要約に太歳・第2群の神煞の段（象意・助ける条件・妨げる条件・相反・判断できない事項）を加える",
    ["太歳・第2群の神煞による読み", "・神煞が示す象意:", "・実現を助ける条件:", "・実現を妨げる条件:", "・判断が相反する事項:", "・判断できない事項:"].every((x) => s.includes(x)) && s.includes("雖病無妨"));
}

console.log("歳破の例（『大六壬指南』占験。規則の出典ではない）:");
for (const l of caseLines) console.log(`  ${l}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
