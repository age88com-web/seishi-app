// tests/liuren_interpretation_monthly_spirits.manual.ts
//
// 六壬神課 Phase 5K（月建の神煞・第1群 monthlySpirits.ts）のテスト。
// 実行: npx tsx tests/liuren_interpretation_monthly_spirits.manual.ts
//
//   1. 十二月支すべてで7種（生気・死気・月厭・血支・血忌・天喜・天馬）の支が原典の起例・表と一致
//   2. 原典の例: 算法の復元に使った例（生気・死気の『六壬大全』卷九）と、独立した検証例（別の書の割注など）を分けて固定する
//   3. 算法の確定状況（生気・死気は例からの復元、他は起例が明示）と出典の保持
//   4. 天馬と驛馬を混同しない・『心鏡』の生神・死神を作らない・既存の標識（日徳・日禄・旬丁・驛馬）を変えない
//   5. 月支がなければ null（推測しない）・月支が変われば位置が変わる・同じ入力で同じ結果・FACT を書き換えない
//   6. 盤上の位置（四課上神・三伝・地盤・天将・旬空）を720課×十二月で facts と照合。DOMAIN は神煞を参照しない

import { readFileSync, readdirSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { dayMarkersOf, yimaOf } from "../src/lib/liuren/interpretation/markers";
import {
  MONTHLY_SPIRIT_DEFINITIONS, MONTHLY_SPIRIT_KINDS, lunarMonthNumberOf, monthlySpiritBranchOf, monthlySpiritOf, monthlySpiritsOf,
} from "../src/lib/liuren/interpretation/monthlySpirits";
import type { MonthlySpiritKind } from "../src/lib/liuren/interpretation/monthlySpirits";
import { growthStageOf } from "../src/lib/liuren/interpretation/states";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const factsOf = (day: string, jiang: Branch, shi: Branch = "子") =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
/** 何月 → 月支（1＝寅） */
const monthOf = (n: number): Branch => BRANCHES[(n + 1) % 12] as Branch;

// ---- 1. 十二月支の対応（原典の起例・表をそのまま書いたもの） ----
const TABLE: Record<MonthlySpiritKind, string> = {
  shengQi: "子丑寅卯辰巳午未申酉戌亥", // 正月子 順行（復元）
  siQi: "午未申酉戌亥子丑寅卯辰巳", // 正月午 順行（復元）
  yueYan: "戌酉申未午巳辰卯寅丑子亥", // 『心鏡』「正月起戌逆十二」
  xueZhi: "丑寅卯辰巳午未申酉戌亥子", // 『心鏡』「正月起丑顺行十二支」
  xueJi: "丑未寅申卯酉辰戌巳亥午子", // 『心鏡』の表
  tianXi: "戌戌戌丑丑丑辰辰辰未未未", // 『心鏡』「春戌，夏丑，秋辰，冬未」
  tianMa: "午申戌子寅辰午申戌子寅辰", // 『心鏡』「正月起午，顺行六阳神」
};
{
  let ok = true;
  const bad: string[] = [];
  for (const k of MONTHLY_SPIRIT_KINDS) for (let n = 1; n <= 12; n++) {
    const got = monthlySpiritBranchOf(k, monthOf(n));
    if (got !== TABLE[k][n - 1]) { ok = false; bad.push(`${k} ${n}月 ${got}`); }
  }
  check("7種×十二月支がすべて原典の起例・表と一致", ok, bad.join(","));
  check("月の数え方は寅月＝正月（月支12種すべて）", BRANCHES.every((b, i) => lunarMonthNumberOf(b as Branch) === ((i + 10) % 12) + 1) && lunarMonthNumberOf("寅") === 1 && lunarMonthNumberOf("丑") === 12);
  check("月支でない値は例外", (() => { try { monthlySpiritBranchOf("tianMa", "甲" as Branch); return false; } catch { return true; } })());
  check("天馬は陽支だけ・6か月で一巡する", BRANCHES.every((b) => ["子", "寅", "辰", "午", "申", "戌"].includes(monthlySpiritBranchOf("tianMa", b as Branch))));
  check("十二月で生気・死気・月厭・血支・血忌は12支すべて、天喜は4支、天馬は6支をとる",
    (["shengQi", "siQi", "yueYan", "xueZhi", "xueJi"] as const).every((k) => new Set(BRANCHES.map((b) => monthlySpiritBranchOf(k, b as Branch))).size === 12) &&
    new Set(BRANCHES.map((b) => monthlySpiritBranchOf("tianXi", b as Branch))).size === 4 && new Set(BRANCHES.map((b) => monthlySpiritBranchOf("tianMa", b as Branch))).size === 6);
  check("生気と死気は常に冲（6支離れる）", BRANCHES.every((b) => Math.abs(BRANCHES.indexOf(monthlySpiritBranchOf("shengQi", b as Branch)) - BRANCHES.indexOf(monthlySpiritBranchOf("siQi", b as Branch))) === 6));
}

// ---- 2. 原典の例 ----
// use: reconstruction＝算法の復元に使った例 / verification＝起例の文・復元に使っていない書の例（独立した検証）/ sameBook＝起例と同じ書の例（独立ではない）
// direct: 原文が月と支を直接書く（false は胎神などから求めた支）
type Ex = { kind: MonthlySpiritKind; month: number; branch: Branch; source: string; quote: string; use: "reconstruction" | "verification" | "sameBook"; direct: boolean; note?: string };
const DQ = "『六壬大全』卷九 毕法赋";
const EXAMPLES: Ex[] = [
  // 生気（復元に使った例。『大全』卷九）
  { kind: "shengQi", month: 7, branch: "午", source: `${DQ} 胎財生気`, quote: "及七月生气在午", use: "reconstruction", direct: true },
  { kind: "shengQi", month: 6, branch: "巳", source: `${DQ} 月厭煞`, quote: "六月占，巳加母年命。十二月占，亥加母年命上。缘生气作月厌", use: "reconstruction", direct: true },
  { kind: "shengQi", month: 12, branch: "亥", source: `${DQ} 月厭煞`, quote: "六月占，巳加母年命。十二月占，亥加母年命上。缘生气作月厌", use: "reconstruction", direct: true },
  { kind: "shengQi", month: 4, branch: "卯", source: `${DQ} 胎財生気`, quote: "六庚六辛日，四月占皆然", use: "reconstruction", direct: false, note: "庚辛日の胎神（卯）から求めた支" },
  { kind: "shengQi", month: 1, branch: "子", source: `${DQ} 胎財生気`, quote: "六戊六已日，正月占，亦主孕喜", use: "reconstruction", direct: false, note: "戊己日の胎神を子とする説に依存（胎神は子・午の二説）" },
  // 死気（復元に使った例。『大全』卷九）
  { kind: "siQi", month: 7, branch: "子", source: `${DQ} 胎財死気`, quote: "七月死气在子", use: "reconstruction", direct: true },
  { kind: "siQi", month: 10, branch: "卯", source: `${DQ} 胎財死気`, quote: "十月死气在夘", use: "reconstruction", direct: true },
  { kind: "siQi", month: 1, branch: "午", source: `${DQ} 胎財死気`, quote: "正月死气在午", use: "reconstruction", direct: true },
  { kind: "siQi", month: 4, branch: "酉", source: `${DQ} 胎財死気`, quote: "四月死气在酉", use: "reconstruction", direct: true },
  { kind: "siQi", month: 3, branch: "申", source: `${DQ} 忧子格`, quote: "乃六合三月占加申，四月占加酉，乃月之死气克六合", use: "reconstruction", direct: true },
  { kind: "siQi", month: 4, branch: "酉", source: `${DQ} 忧子格`, quote: "乃六合三月占加申，四月占加酉，乃月之死气克六合", use: "reconstruction", direct: true },
  ...([[11, "辰"], [5, "戌"], [8, "丑"], [2, "未"]] as const).map(([m, b]): Ex => ({ kind: "siQi", month: m, branch: b, source: `${DQ} 忧母格`, quote: "如十一月占，天后乘辰。五月占，天后乘戌。八月占，天后乘丑。二月占，天后乘未。已上者，乃月内死气克天后也", use: "reconstruction", direct: true })),
  ...([[3, "申"], [9, "寅"]] as const).map(([m, b]): Ex => ({ kind: "siQi", month: m, branch: b, source: `${DQ} 月厭煞`, quote: "如三月占，不宜申加母年命上。九月占，不宜寅加母年命上。缘死气作月厌", use: "reconstruction", direct: true })),
  // 生気・死気の独立した検証例（『大六壬指南』孕産章 占験三「丁丑年四月乙酉日」の割注）
  { kind: "shengQi", month: 4, branch: "卯", source: "『大六壬指南』孕産章第八 占験三", quote: "但末传卯作支之胎神生气", use: "verification", direct: true },
  { kind: "siQi", month: 4, branch: "酉", source: "『大六壬指南』孕産章第八 占験三", quote: "酉为日之胎鬼死气", use: "verification", direct: true },
  // 生気の同系統の例（『直指』毕法賦は『大全』毕法賦と同じ文の系統なので独立ではない）
  { kind: "shengQi", month: 7, branch: "午", source: "『御定六壬直指』毕法賦", quote: "乃七月生气在午", use: "sameBook", direct: true, note: "『大全』毕法賦と同系統の文" },
  // 月厭（起例は『心鏡』。『大全』の例は別の書）
  ...([[3, "申"], [9, "寅"], [6, "巳"], [12, "亥"]] as const).map(([m, b]): Ex => ({ kind: "yueYan", month: m, branch: b, source: `${DQ} 月厭煞`, quote: m === 3 || m === 9 ? "如三月占，不宜申加母年命上。九月占，不宜寅加母年命上。缘死气作月厌" : "六月占，巳加母年命。十二月占，亥加母年命上。缘生气作月厌", use: "verification", direct: true })),
  { kind: "yueYan", month: 7, branch: "辰", source: `${DQ} 血厭克宅格`, quote: "缘七月血忌在辰，月厌亦在辰", use: "verification", direct: true },
  // 血支・血忌（起例は『心鏡』）
  { kind: "xueZhi", month: 1, branch: "丑", source: `${DQ} 生養神二血法`, quote: "如在正月占，言血支、血忌皆在丑", use: "verification", direct: true },
  { kind: "xueJi", month: 1, branch: "丑", source: `${DQ} 生養神二血法`, quote: "如在正月占，言血支、血忌皆在丑", use: "verification", direct: true },
  { kind: "xueZhi", month: 12, branch: "子", source: `${DQ} 生養神二血法`, quote: "如在十二月占，言血支、血忌皆在子", use: "verification", direct: true },
  { kind: "xueJi", month: 12, branch: "子", source: `${DQ} 生養神二血法`, quote: "如在十二月占，言血支、血忌皆在子", use: "verification", direct: true },
  { kind: "xueJi", month: 7, branch: "辰", source: `${DQ} 血厭克宅格`, quote: "缘七月血忌在辰，月厌亦在辰", use: "verification", direct: true },
  { kind: "xueZhi", month: 5, branch: "巳", source: "『大六壬指南』選挙章第十三 占験二 割注", quote: "血支者正月自丑顺行，五月在巳", use: "verification", direct: true },
  ...([[1, "丑"], [2, "未"], [3, "寅"], [4, "申"], [5, "卯"], [6, "酉"]] as const).map(([m, b]): Ex => ({ kind: "xueJi", month: m, branch: b, source: "『大六壬指南』選挙章第十三 占験二 割注", quote: "血忌者，正月丑二未三寅四申五卯六酉", use: "verification", direct: true })),
  // 天喜
  ...([7, 8, 9] as const).map((m): Ex => ({ kind: "tianXi", month: m, branch: "辰", source: "『大六壬指南』選挙章第十三 占験一 割注", quote: "秋三月天喜在辰", use: "verification", direct: true })),
  // 天馬
  { kind: "tianMa", month: 3, branch: "戌", source: "『大六壬指南』隠遁章第十九 占験二 割注", quote: "盖此时仍在辰月，天马在戌也", use: "verification", direct: true },
  { kind: "tianMa", month: 3, branch: "戌", source: "『六壬心鏡』巻二 隱匿門", quote: "中见天魁是天马", use: "sameBook", direct: true, note: "起例と同じ書（乙巳日 三月課の例）" },
];
{
  const bad = EXAMPLES.filter((e) => monthlySpiritBranchOf(e.kind, monthOf(e.month)) !== e.branch).map((e) => `${e.kind} ${e.month}月`);
  check(`原典の例 ${EXAMPLES.length}件がすべて一致`, bad.length === 0, bad.join(","));
  const rec = EXAMPLES.filter((e) => e.use === "reconstruction");
  check("生気・死気の復元に使った例は『大全』卷九の17か所（うち月と支を直接書くもの15・胎神から求めたもの2）",
    rec.length === 17 && rec.every((e) => e.source.startsWith(DQ) && (e.kind === "shengQi" || e.kind === "siQi")) && rec.filter((e) => e.direct).length === 15);
  check("戊己日の胎神説に依存しない復元例は16か所（Phase 5J の「16例」）", rec.filter((e) => !e.note?.includes("戊己")).length === 16);
  check("復元例の月と支の組は15通り（三月申・四月酉が2つの格に重複）", new Set(rec.map((e) => `${e.kind}${e.month}${e.branch}`)).size === 15);
  check("生気・死気には、復元に使っていない書（『指南』孕産章 占験三）の独立した検証例がある",
    (["shengQi", "siQi"] as const).every((k) => EXAMPLES.some((e) => e.kind === k && e.use === "verification" && e.source.includes("指南"))));
  check("月厭・血支・血忌・天喜・天馬には、起例の書（『心鏡』）と別の書の検証例がある",
    (["yueYan", "xueZhi", "xueJi", "tianXi", "tianMa"] as const).every((k) => EXAMPLES.some((e) => e.kind === k && e.use === "verification" && !e.source.includes("心鏡"))));
  const DQ_TEXT = readFileSync("src/lib/liuren/interpretation/monthlySpirits.ts", "utf8");
  check("復元に使った例の原文は、定義の出典（sources）に引用されている", [...new Set(rec.map((e) => e.quote))].every((q) => DQ_TEXT.includes(q)));
  // 『大全』「夫天喜者，乃逐季養」: 季の五行（春木・夏火・秋金・冬水）の十二長生の「養」が天喜と一致する
  check("『大全』の天喜（逐季の養神）が十二長生の養と一致（春木＝戌・夏火＝丑・秋金＝辰・冬水＝未）",
    (["木", "火", "金", "水"] as const).every((el, s) => growthStageOf(el, monthlySpiritBranchOf("tianXi", monthOf(s * 3 + 1))) === "養"));
}

// ---- 3. 算法の確定状況・出典 ----
{
  const D = MONTHLY_SPIRIT_DEFINITIONS;
  check("生気・死気は例からの復元（reconstructedFromExamples）で、起例の文（rule）を出典に持たない",
    (["shengQi", "siQi"] as const).every((k) => D[k].status === "reconstructedFromExamples" && D[k].sources.every((s) => s.role === "example" && s.source === "『六壬大全』")));
  check("生気・死気の注記に「起例の文は取得資料にない」と書く", (["shengQi", "siQi"] as const).every((k) => D[k].notes.some((n) => n.includes("起例の文は取得資料にない"))));
  check("生気・死気の注記に、『大全』の17か所からの復元・戊己日の胎神説に依存する1か所・復元に使っていない『指南』の検証例を分けて書く",
    (["shengQi", "siQi"] as const).every((k) => D[k].notes.some((n) => n.includes("『大全』卷九の17か所")) && D[k].notes.some((n) => n.startsWith("独立した検証例（復元に使っていない書）") && n.includes("『大六壬指南』孕産章第八 占験三"))) &&
    D.shengQi.notes.some((n) => n.includes("1か所") && n.includes("戊己日の胎神") && n.includes("16か所")));
  check("月厭・血支・血忌・天喜・天馬は起例が明示（explicit）で、『心鏡』の起例の文を出典に持つ",
    (["yueYan", "xueZhi", "xueJi", "tianXi", "tianMa"] as const).every((k) => D[k].status === "explicit" && D[k].sources.some((s) => s.role === "rule" && s.source === "『六壬心鏡』")));
  check("7種すべてに名前・算法・出典がある", MONTHLY_SPIRIT_KINDS.every((k) => D[k].kind === k && !!D[k].name && !!D[k].algorithm && D[k].sources.length > 0 && D[k].sources.every((s) => !!s.quote && !!s.locator)));
  check("神煞名は7種で重複しない", new Set(MONTHLY_SPIRIT_KINDS.map((k) => D[k].name)).size === 7 && MONTHLY_SPIRIT_KINDS.length === 7);
}

// ---- 4. 天馬と驛馬・生神・既存の標識 ----
{
  const src = readFileSync("src/lib/liuren/interpretation/monthlySpirits.ts", "utf8");
  const code = src.replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  check("天馬は驛馬の関数・表（markers・YIMA）を使わない", !/from "\.\/markers"|YIMA|yimaOf/.test(code));
  let differs = false, monthOnly = true;
  for (let i = 0; i < 60; i++) for (const mb of BRANCHES) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, "子");
    const t = monthlySpiritOf(f, "tianMa", mb as Branch)!.branch;
    if (t !== yimaOf(f.basic.dayBranch)) differs = true;
    if (t !== monthlySpiritBranchOf("tianMa", mb as Branch)) monthOnly = false;
  }
  check("天馬は月支だけで決まり（日干支で変わらない）、日支基準の驛馬と別の値になる盤がある", monthOnly && differs);
  check("驛馬は MarkerKind のまま、天馬は月建の神煞として別の種類", !MONTHLY_SPIRIT_KINDS.includes("yima" as MonthlySpiritKind) && MONTHLY_SPIRIT_KINDS.includes("tianMa"));
  check("『心鏡』の生神・死神は作らない（別の神煞として注記だけ）", !/shengShen|siShen|"生神"|"死神"/.test(code) &&
    MONTHLY_SPIRIT_DEFINITIONS.shengQi.notes.some((n) => n.includes("生神") && n.includes("統合しない")) && MONTHLY_SPIRIT_DEFINITIONS.siQi.notes.some((n) => n.includes("死神")));
  const f = factsOf("癸卯", "申", "午");
  const before = JSON.stringify(dayMarkersOf(f));
  monthlySpiritsOf(f, "巳");
  check("既存の標識（日徳・日禄・旬丁・驛馬）は神煞を求めても変わらない", JSON.stringify(dayMarkersOf(f)) === before);
}

// ---- 5. 月支・決定性 ----
{
  const f = factsOf("甲子", "卯");
  check("月支がなければ null（推測しない）", monthlySpiritsOf(f, null) === null && monthlySpiritsOf(f, undefined) === null && monthlySpiritOf(f, "shengQi", null) === null);
  const a = monthlySpiritsOf(f, "寅")!, b = monthlySpiritsOf(f, "卯")!;
  check("月支が変われば位置が変わる（寅月→卯月）", (["shengQi", "siQi", "yueYan", "xueZhi", "xueJi", "tianMa"] as const).every((k) => a[k].branch !== b[k].branch) && a.tianXi.branch === b.tianXi.branch);
  check("monthlySpiritsOf は7種すべてを持ち、各値は monthlySpiritOf と同じ", MONTHLY_SPIRIT_KINDS.every((k) => JSON.stringify(a[k]) === JSON.stringify(monthlySpiritOf(f, k, "寅"))));
}

// ---- 6. 720課×十二月 ----
{
  let n = 0, placementOk = true, deterministic = true, unchanged = true;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const chart = calculateLiuren({ dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[o] as Branch });
    const f = buildInterpretationFacts(chart);
    const before = JSON.stringify(f), chartBefore = JSON.stringify(chart);
    for (const mb of BRANCHES) {
      const s = monthlySpiritsOf(f, mb as Branch)!;
      if (JSON.stringify(s) !== JSON.stringify(monthlySpiritsOf(f, mb as Branch))) deterministic = false;
      for (const k of MONTHLY_SPIRIT_KINDS) {
        const p = s[k]; n += 1;
        const lessons = f.lessons.filter((l) => l.upper === p.branch).map((l) => l.index).join("");
        const ts = f.transmissions!.map((t, j) => (t.branch === p.branch ? j : -1)).filter((j) => j >= 0).join("");
        if (p.monthBranch !== mb || p.earthUnder !== f.plate.earthUnder[p.branch] || p.general !== f.generals.generalOn[p.branch] ||
          p.isVoid !== f.xun.voidBranches.includes(p.branch) || p.lessons.map((l) => l.index).join("") !== lessons ||
          p.transmissions!.map((t) => ["initial", "middle", "final"].indexOf(t.position)).join("") !== ts ||
          p.lessons.some((l) => l.isVoid !== p.isVoid)) placementOk = false;
      }
    }
    if (JSON.stringify(f) !== before || JSON.stringify(chart) !== chartBefore) unchanged = false;
  }
  check(`720課×十二月×7種（${n}件）の盤上の位置（四課上神・三伝・地盤・天将・旬空）が facts と一致`, placementOk && n === 720 * 12 * 7);
  check("同じ入力で同じ結果", deterministic);
  check("神煞を求めても起課結果・解釈 FACT が変わらない", unchanged);
  const tsNull = monthlySpiritOf({ ...factsOf("甲子", "卯"), transmissions: null } as ReturnType<typeof factsOf>, "tianMa", "寅");
  check("三伝が未確定なら transmissions は null（四課上神は返す）", tsNull !== null && tsNull.transmissions === null && Array.isArray(tsNull.lessons));
}

// ---- 7. DOMAIN は今回の神煞を参照しない ----
{
  const dir = "src/lib/liuren/interpretation";
  const users = readdirSync(dir).filter((x) => x.endsWith(".ts") && x !== "monthlySpirits.ts" && readFileSync(`${dir}/${x}`, "utf8").includes("monthlySpirits"));
  check("DOMAIN・既存 FACT は monthlySpirits を参照しない（規則の解放は Phase 5L）", users.length === 0, users.join(","));
}

console.log("十二月支の対応（寅月＝正月から）:");
for (const k of MONTHLY_SPIRIT_KINDS) console.log(`  ${MONTHLY_SPIRIT_DEFINITIONS[k].name}（${MONTHLY_SPIRIT_DEFINITIONS[k].status}）: ${Array.from({ length: 12 }, (_, i) => monthlySpiritBranchOf(k, monthOf(i + 1))).join("")}`);
console.log(`原典の例 ${EXAMPLES.length}件（復元 ${EXAMPLES.filter((e) => e.use === "reconstruction").length}・独立した検証 ${EXAMPLES.filter((e) => e.use === "verification").length}・同じ書／同系統 ${EXAMPLES.filter((e) => e.use === "sameBook").length}）`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
