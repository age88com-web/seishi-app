// tests/liuren_interpretation_heavenly_general_attributes.manual.ts
//
// 六壬神課 Phase 4G（十二天将の固有属性 HeavenlyGeneralIntrinsicAttributes）のテスト。
// 実行: npx tsx tests/liuren_interpretation_heavenly_general_attributes.manual.ts
//
//   1. 『六壬神課講座』p56「十二天将象意」表（ページ画像から転記）の「所属干支」列と FACT が12天将すべてで一致。重複・欠落なし
//      列は「十二天将」「所属干支」「象意」の3つ。所属干支は「己丑土」のように干・支・五行を1つの欄に書く
//      （象意列の末尾の色・数は象意列の中にあり、別の列ではない。FACT には入れない）
//   2. 既存の型（Stem・Branch・Element・HeavenlyGeneral）を使う。所属干支の干・支・五行は互いに整合する
//   3. 固有属性は盤によらない（占時12支 8,640課の全8位置で、その位置の天将の属性が表どおり）
//   4. 位置 FACT（Phase 4B の skyBranch）・加臨先（Phase 4A の siteBranch）・天盤支の五行・天将固有の五行を別々に持つ
//   5. anchor 経由で 位置→天将→固有属性 に到達（日干・日支そのものは null）
//   6. Phase 4D で「天将の所属五行・干支」を使うと分類した11文と、「加臨（地盤支）」を使う23文の再照合
//   7. ROLE・DOMAIN・吉凶・生剋の評価・起課の変更がない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, HeavenlyGeneral, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { BRANCH_ELEMENT, GENERALS, STEM_ELEMENT } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { anchorResolutionContextOf, resolveAnchor } from "../src/lib/liuren/interpretation/anchorResolver";
import { heavenlyGeneralStateOf } from "../src/lib/liuren/interpretation/heavenlyGeneralState";
import { siteStateOf } from "../src/lib/liuren/interpretation/siteState";
import {
  heavenlyGeneralIntrinsicAttributesOf, heavenlyGeneralIntrinsicAttributesOfResolution, intrinsicAttributesOfPosition,
} from "../src/lib/liuren/interpretation/heavenlyGeneralAttributes";
import type { BoardAnchor } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

// ---- 1. p56 の転記（ページ画像から。象意列は監査資料としてここにだけ置く） ----
const P56: [general: HeavenlyGeneral, affiliation: string, imagery: string][] = [
  ["貴人", "己丑土", "高貴、給料、昇進、文章、長、福徳、宝石、牛、寒熱、黄、八"],
  ["螣蛇", "丁巳火", "文字、災禍、怪異、心配、小人、悪人、蛇、腫物、血、紫、四"],
  ["朱雀", "丙午火", "知恵、華麗、学者、文書、贅沢、羽毛、果物、午、火気、赤、九"],
  ["六合", "乙卯木", "交易、信用、仲人、婚姻、友人、秘密、製造、材料、塩、青、六"],
  ["勾陳", "戊辰土", "戦争、兵、警察、遅滞、愚直、貧困、死者、霊、けもの、青黒、五"],
  ["青龍", "甲寅木", "活動、権力、金銭、儀式、商売、転職、収穫、狐狸、黄赤、七"],
  ["天空", "戊戌土", "損失、召使、無駄な努力、詐欺、消耗、貧乏、合格、黄、五"],
  ["白虎", "庚申金", "果断、残酷、病気、怪我、武器、流血、交通、栗色、七"],
  ["太常", "己未土", "忍耐、日常、田園、酒食、衣服、転職、昇進、黄、八"],
  ["玄武", "癸亥水", "陰険、横領、盗賊、邪なこと、陰謀、水神、豆類、黒、四"],
  ["太陰", "辛酉金", "陰私、秘密、消極、引退、潔白、同僚、清潔、黄、六"],
  ["天后", "壬子水", "柔軟、耽溺、女性、妻、結婚、男女関係、傷害、白、九"],
];
check("p56 の表は12行で、十二天将の順（GENERALS）と同じ", P56.map((r) => r[0]).join() === GENERALS.join());
check("p56 の天将に重複・欠落なし", new Set(P56.map((r) => r[0])).size === 12);
for (const [g, aff] of P56) {
  const a = heavenlyGeneralIntrinsicAttributesOf(g);
  check(`${g}: FACT＝p56「${aff}」`, `${a.affiliatedStem}${a.affiliatedBranch}${a.element}` === aff && a.general === g, JSON.stringify(a));
  check(`${g}: 項目は general・affiliatedStem・affiliatedBranch・element だけ（象意は入れない）`,
    Object.keys(a).join() === "general,affiliatedStem,affiliatedBranch,element");
  // 2. 既存の型の値で、所属干支の干・支・五行が互いに整合する（表の転記の確認。五行は表の値で、干支から計算していない）
  check(`${g}: 干 ${a.affiliatedStem}・支 ${a.affiliatedBranch} の五行がどちらも ${a.element}`,
    STEMS.includes(a.affiliatedStem) && BRANCHES.includes(a.affiliatedBranch) && STEM_ELEMENT[a.affiliatedStem] === a.element && BRANCH_ELEMENT[a.affiliatedBranch] === a.element);
}
check("12天将の所属支はすべて異なる", new Set(GENERALS.map((g) => heavenlyGeneralIntrinsicAttributesOf(g).affiliatedBranch)).size === 12);

// ---- 3〜5. 盤によらないこと・位置 FACT との分離・anchor ----
const ANCHORS: [string, BoardAnchor][] = [
  ["standing", { kind: "position", position: "standing" }], ["lesson1", { kind: "lesson", index: 1 }], ["lesson2", { kind: "lesson", index: 2 }],
  ["lesson3", { kind: "lesson", index: 3 }], ["lesson4", { kind: "lesson", index: 4 }], ["initial", { kind: "position", position: "initial" }],
  ["middle", { kind: "position", position: "middle" }], ["final", { kind: "position", position: "final" }],
];
let positions = 0, skyEqualsIntrinsic = 0, siteEqualsIntrinsic = 0, skyElementDiffers = 0;
const fixedOk = { all: true };
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
  const facts = buildInterpretationFacts(calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: shi, monthGeneral: BRANCHES[o] }));
  const withAnchor = shi === "子";
  const ctx = withAnchor ? anchorResolutionContextOf(facts) : null;
  const before = withAnchor ? JSON.stringify(ctx) : "";
  for (const [name, a] of ANCHORS) {
    const r = ctx ? resolveAnchor(a, ctx)! : null;
    const sky = name === "standing" || name === "lesson1" ? facts.lessons[0].upper
      : name.startsWith("lesson") ? facts.lessons[Number(name.slice(-1)) - 1].upper
      : facts.transmissions![["initial", "middle", "final"].indexOf(name)].branch;
    const pos = heavenlyGeneralStateOf(facts, sky);
    const attr = intrinsicAttributesOfPosition(pos);
    positions += 1;
    // 盤によらない: その位置の天将の属性は表どおり
    if (JSON.stringify(attr) !== JSON.stringify(heavenlyGeneralIntrinsicAttributesOf(pos.general))) fixedOk.all = false;
    // 位置（skyBranch）・加臨先（siteBranch）・天将固有の支は別の項目
    const site = siteStateOf(facts, sky);
    if (sky === attr.affiliatedBranch) skyEqualsIntrinsic += 1;
    if (site.siteBranch === attr.affiliatedBranch) siteEqualsIntrinsic += 1;
    if (site.skyElement !== attr.element) skyElementDiffers += 1;
    if ("affiliatedBranch" in pos || "element" in pos || "general" in site || "affiliatedBranch" in site) check(`${name} 位置・加臨の FACT に固有属性が混ざる`, false);
    // anchor 経由
    if (r && JSON.stringify(heavenlyGeneralIntrinsicAttributesOfResolution(facts, r)) !== JSON.stringify(attr)) check(`${name} anchor`, false);
  }
  if (ctx) {
    if (heavenlyGeneralIntrinsicAttributesOfResolution(facts, resolveAnchor({ kind: "dayStem" }, ctx)!) !== null) check("日干そのものは null", false);
    if (heavenlyGeneralIntrinsicAttributesOfResolution(facts, resolveAnchor({ kind: "dayBranch" }, ctx)!) !== null) check("日支そのものは null", false);
    if (JSON.stringify(ctx) !== before) check("既存 FACT 不変", false);
  }
}
check("占時12支 8,640課×8位置で、固有属性は盤によらず表どおり", fixedOk.all && positions === 8640 * 8, String(positions));
check("天将が自分の所属支に乗っている位置もあるが一部だけ（skyBranch と所属支は別の項目）", skyEqualsIntrinsic > 0 && skyEqualsIntrinsic < positions, String(skyEqualsIntrinsic));
check("加臨先（siteBranch）と所属支が同じ位置も一部だけ", siteEqualsIntrinsic > 0 && siteEqualsIntrinsic < positions, String(siteEqualsIntrinsic));
check("天盤支の五行（SiteState.skyElement）と天将固有の五行が違う位置がある（別の FACT）", skyElementDiffers > 0, String(skyElementDiffers));

// ---- 6. Phase 4D の記録との再照合 ----
// Phase 4D の記録（tests/liuren_audit_heavenly_general_usage.manual.ts）から ID・天将・支を読む
const src4d = readFileSync("tests/liuren_audit_heavenly_general_usage.manual.ts", "utf8");
type Rec4D = { id: string; generals: HeavenlyGeneral[]; branch?: Branch; line: string };
const recs: Rec4D[] = [...src4d.matchAll(/^\s*R\("(\d+-\d+)", "[^"]+", "[^"]+", \[([^\]]*)\], \{([^}]*)\}.*$/gm)].map((m) => ({
  id: m[1],
  generals: (m[2].match(/"([^"]+)"/g) ?? []).map((s) => s.slice(1, -1) as HeavenlyGeneral),
  branch: (m[3].match(/b: "(.)"/)?.[1] as Branch | undefined),
  line: m[0],
}));
check("Phase 4D の記録142文を読めた", recs.length === 142, String(recs.length));
const affil = recs.filter((r) => r.line.includes("天将の所属五行・干支"));
const kalin = recs.filter((r) => r.line.includes("加臨（地盤支）"));
check("「天将の所属五行・干支」は11文", affil.length === 11, affil.map((r) => r.id).join());
check("「加臨（地盤支）」は23文", kalin.length === 23, String(kalin.length));

// 11文: 本文が述べる天将の属性が、今回の FACT で表せるか
const A = (g: HeavenlyGeneral) => heavenlyGeneralIntrinsicAttributesOf(g);
const AFFIL_CHECK: Record<string, { ok: boolean; expressed: string; remains: string }> = {
  "30-3": { ok: A("青龍").element === "木", expressed: "青龍の五行＝木（「木神の青龍」）", remains: "午に乗る＝焼身（木と午火の関係）は未評価" },
  "33-4": { ok: A("六合").element === "木", expressed: "六合の五行＝木（「支上の寅に六合で木が重なる」）", remains: "支の五行と重なることの判定は未評価" },
  "34-3": { ok: A("螣蛇").affiliatedBranch === "巳", expressed: "螣蛇の所属支＝巳（「巳（螣蛇）上の子に螣蛇＝両蛇夾鬼」）", remains: "加臨先が所属支と同じことの判定は未実装" },
  "36-1": { ok: A("天后").element === "水", expressed: "天后の五行＝水（「宅上に天后＝前に水」）", remains: "水を場所として読むのは象意" },
  "37-2": { ok: A("天后").element === "水", expressed: "天后の五行＝水（「天后は水」）", remains: "水が酉で敗（沐浴）は、天将五行を地盤支に当てる十二長生で未評価" },
  "39-8": { ok: A("白虎").affiliatedStem === "庚" && A("白虎").affiliatedBranch === "申", expressed: "白虎の所属干支＝庚申（「申金自体が白虎」）", remains: "—" },
  "43-6": { ok: A("白虎").element === "金", expressed: "白虎の五行＝金（「午火が白虎を抑える」）", remains: "午火が金を剋す関係は未評価" },
  "47-3": { ok: A("玄武").affiliatedBranch === "亥", expressed: "玄武の所属支＝亥（「玄武は本家に帰る」）", remains: "加臨先が所属支と同じことの判定は未実装" },
  "53-4": { ok: A("白虎").element === "金", expressed: "白虎の五行＝金（「白虎（金神）に剋される」）", remains: "剋の関係は未評価" },
  "54-2": { ok: A("青龍").affiliatedBranch === "寅", expressed: "青龍の所属支＝寅（「寅上青龍は入廟」）", remains: "乗る支が所属支と同じことの判定は未実装" },
  "54-5": { ok: A("朱雀").element === "火", expressed: "朱雀の五行＝火（「巳火に旺じる」）", remains: "天将五行と支の旺衰の関係は未評価" },
};
check("11文すべてを再照合した", affil.every((r) => r.id in AFFIL_CHECK) && Object.keys(AFFIL_CHECK).length === 11);
for (const [id, c] of Object.entries(AFFIL_CHECK)) check(`${id} ${c.expressed}`, c.ok);
{
  // 天将盤が一致する例（37・43・54）: 天盤支・加臨先・天将固有の支／五行が別物であることを、その盤で確かめる
  const at = (day: string, jiang: Branch, shi: Branch, sky: Branch) => {
    const f = buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
    const p = heavenlyGeneralStateOf(f, sky);
    return { general: p.general, sky, site: siteStateOf(f, sky).siteBranch, skyElement: siteStateOf(f, sky).skyElement, attr: intrinsicAttributesOfPosition(p) };
  };
  const e37 = at("癸酉", "巳", "申", "午");
  check("例37 天后: 天盤支 午（火）・加臨先 酉・天将固有 子（水）が別々", e37.general === "天后" && e37.skyElement === "火" && e37.site === "酉" && e37.attr.affiliatedBranch === "子" && e37.attr.element === "水");
  const e43 = at("丁丑", "午", "未", "午");
  check("例43 白虎: 天盤支 午（火）・加臨先 未・天将固有 申（金）が別々", e43.general === "白虎" && e43.skyElement === "火" && e43.site === "未" && e43.attr.affiliatedBranch === "申" && e43.attr.element === "金");
  const e54 = at("庚辰", "子", "子", "寅");
  check("例54 青龍: 天盤支 寅・加臨先 寅（伏吟）・天将固有 寅が一致する例（入廟。同じでも項目は別）", e54.general === "青龍" && e54.sky === "寅" && e54.site === "寅" && e54.attr.affiliatedBranch === "寅");
}
// 加臨23文: 加臨先（siteBranch）は位置の FACT で、天将固有の属性では表さない
const kalinLines: string[] = [];
let kalinSiteIsIntrinsic = 0;
for (const r of kalin) {
  const g = r.generals[0];
  const attr = g ? heavenlyGeneralIntrinsicAttributesOf(g) : null;
  // 天将固有の属性は盤によらないので、加臨先を表すことはできない（固有属性に地盤支の項目はない）
  if (attr && ("siteBranch" in attr || "skyBranch" in attr)) check(`${r.id} 固有属性に加臨先がある`, false);
  kalinLines.push(`${r.id} ${r.generals.join("・") || "-"} 支${r.branch ?? "-"} 所属支${attr?.affiliatedBranch ?? "-"}`);
  if (r.id === "34-3" || r.id === "47-3") kalinSiteIsIntrinsic += 1;
}
check("加臨23文のうち、加臨先と所属支を比べている文は 34-3・47-3（どちらも天将盤が別方式の例）", kalinSiteIsIntrinsic === 2);

// ---- 7. ROLE・DOMAIN・吉凶・生剋・起課 ----
{
  const code = readFileSync("src/lib/liuren/interpretation/heavenlyGeneralAttributes.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const hit = ["relationBetween", "controls", "generates", "good", "bad", "auspicious", "inauspicious", "support", "obstacle", "role", "domain",
    "InterpretationContext", "吉", "凶", "象意", "imagery", "earthUnder", "siteBranch", "skyBranch:"].filter((w) => code.includes(w));
  check("heavenlyGeneralAttributes.ts に生剋・吉凶・ROLE・DOMAIN・象意・位置の項目が出てこない", hit.length === 0, hit.join(","));
  check("RoleMatcher を変更していない（固有属性の matcher なし）", !/affiliated|intrinsic/i.test(readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8")));
}

console.log("p56 の表（列: 十二天将・所属干支・象意）:");
for (const [g, aff, img] of P56) console.log(`  ${g} ${aff} ｜ 象意（FACT に入れない）: ${img}`);
console.log(`8,640課×8位置: 天将が所属支に乗る ${skyEqualsIntrinsic} ／ 加臨先が所属支 ${siteEqualsIntrinsic} ／ 天盤支の五行と天将の五行が違う ${skyElementDiffers}`);
console.log("Phase 4D「天将の所属五行・干支」11文:");
for (const [id, c] of Object.entries(AFFIL_CHECK)) console.log(`  ${id}: ${c.expressed} ／ 残り: ${c.remains}`);
console.log(`Phase 4D「加臨（地盤支）」23文: ${kalinLines.join(" ／ ")}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
