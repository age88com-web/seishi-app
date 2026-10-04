// tests/liuren_interpretation_heavenly_general_placement.manual.ts
//
// 六壬神課 Phase 4H（天将の固有属性と、乗る天盤支・加臨先との関係 HeavenlyGeneralPlacementRelations）のテスト。
// 実行: npx tsx tests/liuren_interpretation_heavenly_general_placement.manual.ts
//
//   1. 五行どうしの関係（elementRelationBetweenElements）は 5×5 の全組で既存の relationBetween の五行部分と同じ。逆向きの関数も整合
//   2. 占時12支 8,640課×8位置（69,120位置）で、各項目が既存 FACT（Phase 4A・4B・4G）と一致し、関係が五行の組合せと一致
//      支の一致件数が Phase 4G（天盤支 6,168・地盤支 9,168）を再現
//   3. 天盤支と地盤支を取り違えると失敗する実例（例37・43）
//   4. Phase 4D・4G の11文のうち 30-3・34-3・37-2・43-6・47-3・53-4・54-2・54-5 の再照合
//      天将盤が別方式の例（30・34・47・53）は、断案の盤の天将と、エンジンの天地盤（天将の方式によらない）で確かめる
//   5. anchor 経由で到達（日干・日支は null）。旬空・坐空で値が変わらない。解釈語・十二長生・旺衰・ROLE・DOMAIN がない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Element, HeavenlyGeneral, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { BRANCH_ELEMENT } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { anchorResolutionContextOf, resolveAnchor } from "../src/lib/liuren/interpretation/anchorResolver";
import { relationBetween } from "../src/lib/liuren/interpretation/relations";
import { elementRelationOf } from "../src/lib/liuren/interpretation/standingPathComparison";
import { heavenlyGeneralStateOf } from "../src/lib/liuren/interpretation/heavenlyGeneralState";
import { heavenlyGeneralIntrinsicAttributesOf } from "../src/lib/liuren/interpretation/heavenlyGeneralAttributes";
import { siteStateOf } from "../src/lib/liuren/interpretation/siteState";
import {
  elementRelationBetweenElements, heavenlyGeneralPlacementRelationsOf, heavenlyGeneralPlacementRelationsOfResolution,
  placementRelationsFrom, reverseElementRelation,
} from "../src/lib/liuren/interpretation/heavenlyGeneralPlacement";
import type { BoardAnchor } from "../src/lib/liuren/interpretation/roles";
import type { InterpretationFacts } from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };

// ---- 1. 五行どうしの関係 ----
// 各五行の代表の支（同じ五行の支なら relationBetween の五行部分は同じ）
const REP: Record<Element, Branch> = { 木: "寅", 火: "午", 土: "辰", 金: "申", 水: "子" };
const ELEMENTS = Object.keys(REP) as Element[];
for (const a of ELEMENTS) for (const b of ELEMENTS) {
  const r = elementRelationBetweenElements(a, b);
  check(`${a}→${b} は relationBetween の五行部分と同じ`, r === elementRelationOf(relationBetween(REP[a], REP[b])), r);
  check(`${a}→${b} の逆向きは ${b}→${a}`, reverseElementRelation(r) === elementRelationBetweenElements(b, a));
}

// ---- 2. 69,120位置 ----
const POS = ["standing", "lesson1", "lesson2", "lesson3", "lesson4", "initial", "middle", "final"] as const;
const ANCHOR: Record<(typeof POS)[number], BoardAnchor> = {
  standing: { kind: "position", position: "standing" }, lesson1: { kind: "lesson", index: 1 }, lesson2: { kind: "lesson", index: 2 },
  lesson3: { kind: "lesson", index: 3 }, lesson4: { kind: "lesson", index: 4 }, initial: { kind: "position", position: "initial" },
  middle: { kind: "position", position: "middle" }, final: { kind: "position", position: "final" },
};
const skyOf = (f: InterpretationFacts, p: (typeof POS)[number]): Branch =>
  p === "standing" ? f.lessons[0].upper : p.startsWith("lesson") ? f.lessons[Number(p.slice(-1)) - 1].upper
  : f.transmissions![["initial", "middle", "final"].indexOf(p)].branch;
let positions = 0, skyMatch = 0, siteMatch = 0, withConstraint = 0, mismatch = 0;
const skyDist: Record<string, number> = {};
const siteDist: Record<string, number> = {};
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
  const facts = buildInterpretationFacts(calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: shi, monthGeneral: BRANCHES[o] }));
  const ctx = shi === "子" || shi === "午" ? anchorResolutionContextOf(facts) : null;
  const before = ctx ? JSON.stringify(ctx) : "";
  for (const p of POS) {
    const sky = skyOf(facts, p);
    const rel = heavenlyGeneralPlacementRelationsOf(facts, sky);
    const pos = heavenlyGeneralStateOf(facts, sky);
    const attr = heavenlyGeneralIntrinsicAttributesOf(pos.general);
    const site = siteStateOf(facts, sky);
    positions += 1;
    const ok =
      Object.keys(rel).join() === "general,generalElement,affiliatedBranch,skyBranch,skyElement,skyToGeneral,siteBranch,siteElement,siteToGeneral,skyBranchMatchesAffiliatedBranch,siteBranchMatchesAffiliatedBranch" &&
      rel.general === pos.general && rel.generalElement === attr.element && rel.affiliatedBranch === attr.affiliatedBranch &&
      rel.skyBranch === sky && rel.skyElement === site.skyElement && rel.skyElement === BRANCH_ELEMENT[sky] &&
      rel.siteBranch === site.siteBranch && rel.siteBranch === facts.plate.earthUnder[sky] && rel.siteElement === BRANCH_ELEMENT[rel.siteBranch] &&
      rel.skyToGeneral === elementRelationBetweenElements(rel.skyElement, rel.generalElement) &&
      rel.siteToGeneral === elementRelationBetweenElements(rel.siteElement, rel.generalElement) &&
      rel.skyBranchMatchesAffiliatedBranch === (sky === attr.affiliatedBranch) &&
      rel.siteBranchMatchesAffiliatedBranch === (site.siteBranch === attr.affiliatedBranch);
    if (!ok) mismatch += 1;
    inc(skyDist, rel.skyToGeneral); inc(siteDist, rel.siteToGeneral);
    if (rel.skyBranchMatchesAffiliatedBranch) skyMatch += 1;
    if (rel.siteBranchMatchesAffiliatedBranch) siteMatch += 1;
    if (ctx) {
      const r = resolveAnchor(ANCHOR[p], ctx)!;
      if (JSON.stringify(heavenlyGeneralPlacementRelationsOfResolution(facts, r)) !== JSON.stringify(rel)) check(`${p} anchor`, false);
      if (r.constraints.length) withConstraint += 1; // 制約があっても値は上と同じ（関数は制約を見ない）
    }
  }
  if (ctx) {
    if (heavenlyGeneralPlacementRelationsOfResolution(facts, resolveAnchor({ kind: "dayStem" }, ctx)!) !== null) check("日干は null", false);
    if (heavenlyGeneralPlacementRelationsOfResolution(facts, resolveAnchor({ kind: "dayBranch" }, ctx)!) !== null) check("日支は null", false);
    if (JSON.stringify(ctx) !== before) check("既存 FACT 不変", false);
  }
}
check("69,120位置すべてで既存 FACT・五行の組合せと一致", positions === 69120 && mismatch === 0, `${positions} / 不一致 ${mismatch}`);
check("天盤支＝所属支 6,168位置（Phase 4G と同じ）", skyMatch === 6168, String(skyMatch));
check("地盤支＝所属支 9,168位置（Phase 4G と同じ）", siteMatch === 9168, String(siteMatch));
check("旬空・坐空の制約がある位置でも同じ値（anchor 経由と一致）", withConstraint > 0, String(withConstraint));

// ---- 3. 天盤支と地盤支の取り違え ----
const factsOf = (day: string, jiang: Branch, shi: Branch) =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
{
  const f37 = factsOf("癸酉", "巳", "申");
  const r37 = heavenlyGeneralPlacementRelationsOf(f37, "午");
  check("例37 天后: 天盤支 午（火）→水 overcomeBy、地盤支 酉（金）→水 generates（取り違えると逆）",
    r37.general === "天后" && r37.skyBranch === "午" && r37.skyToGeneral === "overcomeBy" && r37.siteBranch === "酉" && r37.siteToGeneral === "generates");
  const f43 = factsOf("丁丑", "午", "未");
  const r43 = heavenlyGeneralPlacementRelationsOf(f43, "午");
  check("例43 白虎: 天盤支 午（火）→金 overcomes、地盤支 未（土）→金 generates（取り違えると逆）",
    r43.general === "白虎" && r43.skyToGeneral === "overcomes" && r43.siteBranch === "未" && r43.siteToGeneral === "generates");
  // 天盤支の違う SiteState を渡すと止まる（位置と加臨先を別の支から組み合わせない）
  let threw = false;
  try { placementRelationsFrom(heavenlyGeneralStateOf(f37, "午"), siteStateOf(f37, "酉")); } catch { threw = true; }
  check("位置の天盤支と SiteState の天盤支が違うとエラー", threw);
}

// ---- 4. Phase 4D・4G の文 ----
/** 天将盤が別方式の例: 断案の盤の天将を、エンジンの天地盤（天将の方式によらない）の位置に置く。位置の支はエンジンと同じであることを確かめる */
function docPlacement(day: string, jiang: Branch, shi: Branch, at: "initial" | "final" | "lesson3", sky: Branch, docGeneral: HeavenlyGeneral) {
  const f = factsOf(day, jiang, shi);
  const engineSky = at === "lesson3" ? f.lessons[2].upper : f.transmissions![at === "initial" ? 0 : 2].branch;
  const rel = placementRelationsFrom({ skyBranch: sky, general: docGeneral }, siteStateOf(f, sky));
  return { rel, sameBranch: engineSky === sky, engineGeneral: heavenlyGeneralStateOf(f, sky).general };
}
const lines: string[] = [];
{
  // 30-3 青龍＝木・午＝火（例30 末伝午。断案の盤では青龍、エンジンでは別の天将）
  const d = docPlacement("甲寅", "未", "午", "final", "午", "青龍");
  check("30-3 末伝午: 午（火）→青龍（木）は generatedBy（青龍の木が午の火を生ずる）", d.sameBranch && d.rel.skyToGeneral === "generatedBy" && reverseElementRelation(d.rel.skyToGeneral) === "generates");
  lines.push(`30-3 例30 末伝 午（断案: 青龍／エンジン: ${d.engineGeneral}）: skyToGeneral ${d.rel.skyToGeneral}（青龍→午は ${reverseElementRelation(d.rel.skyToGeneral)}） 地盤 ${d.rel.siteBranch} siteToGeneral ${d.rel.siteToGeneral}`);
}
{
  // 34-3 螣蛇の所属支＝巳（例34 初伝子が巳上）
  const d = docPlacement("丙午", "卯", "申", "initial", "子", "螣蛇");
  check("34-3 初伝子: 天盤支 子≠巳、地盤支 巳＝螣蛇の所属支", d.sameBranch && !d.rel.skyBranchMatchesAffiliatedBranch && d.rel.siteBranch === "巳" && d.rel.siteBranchMatchesAffiliatedBranch);
  lines.push(`34-3 例34 初伝 子（断案: 螣蛇／エンジン: ${d.engineGeneral}）: 地盤 ${d.rel.siteBranch} skyMatch ${d.rel.skyBranchMatchesAffiliatedBranch} siteMatch ${d.rel.siteBranchMatchesAffiliatedBranch}`);
}
{
  const r = heavenlyGeneralPlacementRelationsOf(factsOf("癸酉", "巳", "申"), "午");
  check("37-2 天后（水）と地盤酉（金）: siteToGeneral generates（酉の金が天后の水を生ずる）", r.siteToGeneral === "generates" && r.siteElement === "金" && r.generalElement === "水");
  lines.push(`37-2 例37 初伝 午（天后）: 天盤 午→水 ${r.skyToGeneral} ／ 地盤 酉→水 ${r.siteToGeneral}（「敗」＝十二長生の沐浴は未実装）`);
}
{
  const r = heavenlyGeneralPlacementRelationsOf(factsOf("丁丑", "午", "未"), "午");
  check("43-6 干上 午（火）→白虎（金）は overcomes", r.general === "白虎" && r.skyToGeneral === "overcomes");
  lines.push(`43-6 例43 干上 午（白虎）: 天盤 午→金 ${r.skyToGeneral} ／ 地盤 未→金 ${r.siteToGeneral}`);
}
{
  const d = docPlacement("丙寅", "亥", "申", "final", "寅", "玄武");
  check("47-3 末伝寅: 天盤支 寅≠亥、地盤支 亥＝玄武の所属支", d.sameBranch && !d.rel.skyBranchMatchesAffiliatedBranch && d.rel.siteBranch === "亥" && d.rel.siteBranchMatchesAffiliatedBranch);
  lines.push(`47-3 例47 末伝 寅（断案: 玄武／エンジン: ${d.engineGeneral}）: 地盤 ${d.rel.siteBranch} skyMatch ${d.rel.skyBranchMatchesAffiliatedBranch} siteMatch ${d.rel.siteBranchMatchesAffiliatedBranch}`);
}
{
  // 53-4 「寅は木で父母…それが白虎（金神）に剋される」: 白虎が乗る三課上神の寅（木）
  const d = docPlacement("丙子", "卯", "丑", "lesson3", "寅", "白虎");
  check("53-4 三課寅: 寅（木）→白虎（金）は overcomeBy（白虎の金が寅の木を剋す）", d.sameBranch && d.rel.skyToGeneral === "overcomeBy" && reverseElementRelation(d.rel.skyToGeneral) === "overcomes");
  lines.push(`53-4 例53 三課 寅（断案: 白虎／エンジン: ${d.engineGeneral}）: skyToGeneral ${d.rel.skyToGeneral}（白虎→寅は ${reverseElementRelation(d.rel.skyToGeneral)}）`);
}
{
  const f54 = factsOf("庚辰", "子", "子");
  const r2 = heavenlyGeneralPlacementRelationsOf(f54, "寅");
  check("54-2 中伝寅の青龍: 天盤支 寅＝所属支（地盤支も寅。伏吟）", r2.general === "青龍" && r2.skyBranchMatchesAffiliatedBranch && r2.siteBranchMatchesAffiliatedBranch);
  const r5 = heavenlyGeneralPlacementRelationsOf(f54, "巳");
  check("54-5 末伝巳の朱雀: 巳（火）→朱雀（火）は sameElement", r5.general === "朱雀" && r5.skyToGeneral === "sameElement");
  lines.push(`54-2 例54 中伝 寅（青龍）: skyMatch ${r2.skyBranchMatchesAffiliatedBranch} siteMatch ${r2.siteBranchMatchesAffiliatedBranch}`);
  lines.push(`54-5 例54 末伝 巳（朱雀）: skyToGeneral ${r5.skyToGeneral}（「旺じる」は未実装）`);
}

// ---- 5. コード ----
{
  const code = readFileSync("src/lib/liuren/interpretation/heavenlyGeneralPlacement.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const hit = ["RuMiao", "ruMiao", "入廟", "帰家", "本家", "home", "Home", "焼身", "受剋", "得地", "失地", "strong", "weak", "Strong", "Auspicious",
    "吉", "凶", "growthStage", "seasonal", "constraints", "isVoid", "SeatedOnVoid", "role", "domain", "InterpretationContext", "relationBetween("].filter((w) => code.includes(w));
  check("heavenlyGeneralPlacement.ts に解釈語・十二長生・旺衰・制約・ROLE・DOMAIN・relationBetween がない", hit.length === 0, hit.join(","));
  check("RoleMatcher を変更していない", !/placement|affiliated/i.test(readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8")));
}

const order = ["generates", "sameElement", "generatedBy", "overcomes", "overcomeBy"];
const fmt = (o: Record<string, number>) => order.map((k) => `${k}${o[k] ?? 0}`).join(" ");
console.log(`69,120位置: skyToGeneral ${fmt(skyDist)}`);
console.log(`           siteToGeneral ${fmt(siteDist)}`);
console.log(`天盤支＝所属支 ${skyMatch} ／ 地盤支＝所属支 ${siteMatch} ／ 制約のある位置 ${withConstraint}（占時子・午の anchor 照合分）`);
for (const l of lines) console.log(`  ${l}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
