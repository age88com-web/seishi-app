// tests/liuren_interpretation_heavenly_general_site_growth.manual.ts
//
// 六壬神課 Phase 4I（天将の固有五行を加臨先に当てた十二長生 HeavenlyGeneralSiteGrowthState）のテスト。
// 実行: npx tsx tests/liuren_interpretation_heavenly_general_site_growth.manual.ts
//
//   1. 12天将×12地盤支の144組が growthStageOf（Phase 3A の五行生墓法）・growthPhaseOf（Phase 3H）と一致。五行別の長生の支・土は火に従う
//   2. 例37-2: 天后（水）が酉の上（午加酉）で沐浴。本文の「敗」は十二長生の沐浴に当たる（FACT 名には使わない）
//   3. 占時12支 8,640課×8位置（69,120位置）で、general・generalElement・siteBranch が Phase 4H と一致し、
//      十二長生は天将の五行×地盤支（天盤支・所属支・天盤支の五行ではない）。分布を出す
//   4. anchor 経由で到達（日干・日支は null）。旬空・坐空で変わらない
//   5. 例54-5 は根拠にしない（記録だけ）。次段階の候補を Phase 4D の記録から再調査して出力する
//   6. 季節旺衰・天盤支での十二長生・日干との関係・吉凶・ROLE・DOMAIN を持たない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { BRANCH_ELEMENT, GENERALS } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { anchorResolutionContextOf, resolveAnchor } from "../src/lib/liuren/interpretation/anchorResolver";
import { GROWTH_STAGES, growthStageOf, rulingElementOfMonth, seasonalStrengthOf } from "../src/lib/liuren/interpretation/states";
import { growthPhaseOf } from "../src/lib/liuren/interpretation/qiState";
import { siteStateOf } from "../src/lib/liuren/interpretation/siteState";
import { heavenlyGeneralIntrinsicAttributesOf } from "../src/lib/liuren/interpretation/heavenlyGeneralAttributes";
import { heavenlyGeneralPlacementRelationsOf } from "../src/lib/liuren/interpretation/heavenlyGeneralPlacement";
import {
  heavenlyGeneralSiteGrowthStateOf, heavenlyGeneralSiteGrowthStateOfResolution, siteGrowthFromPlacement,
} from "../src/lib/liuren/interpretation/heavenlyGeneralSiteGrowth";
import type { BoardAnchor } from "../src/lib/liuren/interpretation/roles";
import type { InterpretationFacts } from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };

// ---- 1. 144組と五行別 ----
let combos = 0;
for (const g of GENERALS) {
  const element = heavenlyGeneralIntrinsicAttributesOf(g).element;
  for (const site of BRANCHES) {
    const s = siteGrowthFromPlacement({ general: g, generalElement: element, siteBranch: site });
    combos += 1;
    if (s.growthStageAtSite !== growthStageOf(element, site) || s.growthPhaseAtSite !== growthPhaseOf(s.growthStageAtSite)) check(`${g}×${site}`, false, JSON.stringify(s));
    if (Object.keys(s).join() !== "general,generalElement,siteBranch,growthStageAtSite,growthPhaseAtSite") check(`${g}×${site} 項目`, false);
  }
}
check("12天将×12地盤支の144組が growthStageOf・growthPhaseOf と一致", combos === 144);
const longLife: Record<string, Branch> = {};
for (const g of GENERALS) {
  const e = heavenlyGeneralIntrinsicAttributesOf(g).element;
  longLife[e] = BRANCHES.find((b) => siteGrowthFromPlacement({ general: g, generalElement: e, siteBranch: b }).growthStageAtSite === "長生")!;
}
check("五行別の長生の支: 木亥・火寅・土寅（土は火に従う）・金巳・水申", JSON.stringify(longLife) === JSON.stringify({ 土: "寅", 火: "寅", 木: "亥", 金: "巳", 水: "申" }), JSON.stringify(longLife));
check("土の墓は戌（土墓従火。勾陳＝土 を戌に当てると墓）", siteGrowthFromPlacement({ general: "勾陳", generalElement: "土", siteBranch: "戌" }).growthStageAtSite === "墓");
check("五行は陰陽で逆行しない（天后＝壬子水・玄武＝癸亥水 は同じ段階）",
  BRANCHES.every((b) => growthStageOf("水", b) === siteGrowthFromPlacement({ general: "玄武", generalElement: heavenlyGeneralIntrinsicAttributesOf("玄武").element, siteBranch: b }).growthStageAtSite));

// ---- 2. 例37-2 ----
const factsOf = (day: string, jiang: Branch, shi: Branch) =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
const f37 = factsOf("癸酉", "巳", "申");
const g37 = heavenlyGeneralSiteGrowthStateOf(f37, "午");
check("例37-2 初伝午の天后: generalElement 水・siteBranch 酉・growthStageAtSite 沐浴",
  g37.general === "天后" && g37.generalElement === "水" && g37.siteBranch === "酉" && g37.growthStageAtSite === "沐浴", JSON.stringify(g37));
check("例37-2 沐浴の大分類は既存分類どおり（growing）", g37.growthPhaseAtSite === growthPhaseOf("沐浴") && g37.growthPhaseAtSite === "growing");
const s37 = siteStateOf(f37, "午");
check("例37 天盤支の五行（午＝火）を酉に当てた SiteState の十二長生は死で、今回の FACT（水の沐浴）とは別", s37.growthStageAtSite === "死" && s37.growthStageAtSite !== g37.growthStageAtSite);

// ---- 3・4. 69,120位置 ----
const POS = ["standing", "lesson1", "lesson2", "lesson3", "lesson4", "initial", "middle", "final"] as const;
const ANCHOR: Record<(typeof POS)[number], BoardAnchor> = {
  standing: { kind: "position", position: "standing" }, lesson1: { kind: "lesson", index: 1 }, lesson2: { kind: "lesson", index: 2 },
  lesson3: { kind: "lesson", index: 3 }, lesson4: { kind: "lesson", index: 4 }, initial: { kind: "position", position: "initial" },
  middle: { kind: "position", position: "middle" }, final: { kind: "position", position: "final" },
};
const skyOf = (f: InterpretationFacts, p: (typeof POS)[number]): Branch =>
  p === "standing" ? f.lessons[0].upper : p.startsWith("lesson") ? f.lessons[Number(p.slice(-1)) - 1].upper
  : f.transmissions![["initial", "middle", "final"].indexOf(p)].branch;
let positions = 0, mismatch = 0, differsFromSky = 0, differsFromAffiliated = 0, differsFromSiteState = 0, withConstraint = 0;
const dist: Record<string, number> = {};
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
  const facts = buildInterpretationFacts(calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: shi, monthGeneral: BRANCHES[o] }));
  const ctx = shi === "子" || shi === "午" ? anchorResolutionContextOf(facts) : null;
  const before = ctx ? JSON.stringify(ctx) : "";
  for (const p of POS) {
    const sky = skyOf(facts, p);
    const s = heavenlyGeneralSiteGrowthStateOf(facts, sky);
    const pl = heavenlyGeneralPlacementRelationsOf(facts, sky);
    positions += 1;
    const ok = s.general === pl.general && s.generalElement === pl.generalElement && s.siteBranch === pl.siteBranch &&
      s.siteBranch === facts.plate.earthUnder[sky] && s.growthStageAtSite === growthStageOf(pl.generalElement, pl.siteBranch) &&
      s.growthPhaseAtSite === growthPhaseOf(s.growthStageAtSite);
    if (!ok) mismatch += 1;
    inc(dist, s.growthStageAtSite);
    // 天盤支・所属支・天盤支の五行で求めた値と区別できる（違う位置がある）
    if (s.growthStageAtSite !== growthStageOf(pl.generalElement, sky)) differsFromSky += 1;
    if (s.growthStageAtSite !== growthStageOf(pl.generalElement, pl.affiliatedBranch)) differsFromAffiliated += 1;
    if (s.growthStageAtSite !== siteStateOf(facts, sky).growthStageAtSite) differsFromSiteState += 1;
    if (ctx) {
      const r = resolveAnchor(ANCHOR[p], ctx)!;
      if (JSON.stringify(heavenlyGeneralSiteGrowthStateOfResolution(facts, r)) !== JSON.stringify(s)) check(`${p} anchor`, false);
      if (r.constraints.length) withConstraint += 1;
    }
  }
  if (ctx) {
    if (heavenlyGeneralSiteGrowthStateOfResolution(facts, resolveAnchor({ kind: "dayStem" }, ctx)!) !== null) check("日干は null", false);
    if (heavenlyGeneralSiteGrowthStateOfResolution(facts, resolveAnchor({ kind: "dayBranch" }, ctx)!) !== null) check("日支は null", false);
    if (JSON.stringify(ctx) !== before) check("既存 FACT 不変", false);
  }
}
check("69,120位置: Phase 4H と一致し、十二長生は天将の五行×地盤支", positions === 69120 && mismatch === 0, `${positions} / ${mismatch}`);
check("天将の五行を天盤支に当てた値とは別（違う位置がある）", differsFromSky > 0, String(differsFromSky));
check("天将の五行を所属支に当てた値とは別（違う位置がある）", differsFromAffiliated > 0, String(differsFromAffiliated));
check("SiteState の十二長生（天盤支の五行）とは別（違う位置がある）", differsFromSiteState > 0, String(differsFromSiteState));
check("旬空・坐空の制約がある位置でも同じ値（anchor 経由と一致）", withConstraint > 0, String(withConstraint));

// ---- 5. 例54-5 は根拠にしない・次段階の再調査 ----
const f54 = factsOf("庚辰", "子", "子");
const g54 = heavenlyGeneralSiteGrowthStateOf(f54, "巳");
// 例54 は戊申年十二月（丑月）の占。月令は土で、火（朱雀・巳）は休。本文の「旺じる」は季節旺衰の旺ではない
const ruling54 = rulingElementOfMonth("丑");
check("例54-5 の記録: 朱雀（火）の地盤巳での十二長生は臨官（「旺」の根拠にはしない）", g54.general === "朱雀" && g54.growthStageAtSite === "臨官");
check("例54 は十二月（丑月）の占で、火は季節旺衰では休（「旺じる」は季節旺衰の旺ではない）", seasonalStrengthOf("火", ruling54) === "休");
{
  // Phase 4D の記録から、天将の五行が他の FACT と組んでいる文を再調査する
  const src4d = readFileSync("tests/liuren_audit_heavenly_general_usage.manual.ts", "utf8");
  const ids = (needle: string) => [...src4d.matchAll(/^\s*R\("(\d+-\d+)".*$/gm)].filter((m) => m[0].includes(needle)).map((m) => m[1]);
  check("Phase 4D の「天将の所属五行・干支」の文は11文のまま", ids("天将の所属五行・干支").length === 11);
}
const NEXT = [
  { kind: "季節旺衰", status: "根拠なし", detail: "天将の五行の季節旺衰を使う文はない。54-5「朱雀は巳火に旺じる」は十二月（丑月・土旺）の占で火は休なので季節旺衰ではない。35-3「白虎が死気に乗じる」・46-2「天后穢神（死神の上）」は月の神殺で、天将の五行の旺衰ではない" },
  { kind: "天盤支での十二長生", status: "判定不能", detail: "30-3「木神の青龍が午につく＝焼身」は、木を午に当てると死（十二長生）だが、本文は理由を書かない（4H の 午→青龍 generatedBy でも読める）。54-5「巳火に旺じる」も臨官とは決められない" },
  { kind: "日干との生剋", status: "根拠なし", detail: "天将の五行と日干を比べる文はない（48-1 の「庚金を生じる」は戌土＝支の五行）" },
  { kind: "その他: 天盤支の五行の十二長生（既存）", status: "既存 FACT で表せる", detail: "37-2「午火は酉で光なく」は天盤支の五行を地盤支に当てた十二長生（SiteState。火の酉＝死）で、天将の五行ではない" },
  { kind: "その他: 陰神", status: "FACT 追加が要る", detail: "55-3「酉が太常で衣服、その上神戌が玄武で汚れ」・32-3「四課は玄武の陰神」" },
  { kind: "その他: 天将が三伝に入らない", status: "既存 FACT で求められる", detail: "54-1「太常は入伝せず、よって武は不可」" },
];

// ---- 6. コード ----
{
  const code = readFileSync("src/lib/liuren/interpretation/heavenlyGeneralSiteGrowth.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const hit = ["affiliatedBranch", "seasonal", "rulingElement", "dayStem", "constraints", "isVoid", "敗", "旺", "good", "bad", "strong", "weak",
    "effective", "吉", "凶", "role", "domain", "InterpretationContext", "GROWTH_STAGES", "SANHE"].filter((w) => code.includes(w));
  check("heavenlyGeneralSiteGrowth.ts に所属支・季節旺衰・日干・制約・解釈語・独自の十二長生表がない", hit.length === 0, hit.join(","));
  // 天盤支は位置を探す引数としてだけ使い、十二長生に渡すのは天将の五行と地盤支だけ
  const calls = [...code.matchAll(/growthStageOf\(([^)]*)\)/g)].map((m) => m[1]);
  check("growthStageOf に渡すのは天将の五行と地盤支だけ（天盤支ではない）", calls.length === 1 && calls[0] === "p.generalElement, p.siteBranch", calls.join(" / "));
  check("RoleMatcher を変更していない", !/siteGrowth|SiteGrowth/.test(readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8")));
}

console.log(`144組 ✓ ／ 五行別の長生の支: ${JSON.stringify(longLife)}`);
console.log(`例37-2: 天后 水 × 地盤酉 → ${g37.growthStageAtSite}（${g37.growthPhaseAtSite}） ／ 参考: SiteState（午の火×酉）＝${s37.growthStageAtSite}`);
console.log(`例54-5（根拠にしない）: 朱雀 火 × 地盤巳 → ${g54.growthStageAtSite} ／ 十二月（丑月）の火の旺衰 ${seasonalStrengthOf("火", ruling54)}`);
console.log(`69,120位置の growthStageAtSite: ${GROWTH_STAGES.map((g) => `${g}${dist[g] ?? 0}`).join(" ")}`);
console.log(`区別: 天盤支に当てた値と違う ${differsFromSky} ／ 所属支に当てた値と違う ${differsFromAffiliated} ／ SiteState と違う ${differsFromSiteState}`);
console.log("次段階の再調査:");
for (const n of NEXT) console.log(`  ${n.kind}［${n.status}］ ${n.detail}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
