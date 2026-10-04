// tests/liuren_interpretation_site_state.manual.ts
//
// 六壬神課 Phase 4A（天盤支が乗る地盤位置での状態 SiteState）のテスト。
// 実行: npx tsx tests/liuren_interpretation_site_state.manual.ts
//
//   1. 720課の 干上・初中末・一〜四課上神 で siteBranch＝plate.earthUnder[skyBranch]、坐空（isSeatedOnVoid）と同じ地盤支、
//      四課は lowerBranch と一致。growthStageAtSite は天盤支自身の五行で見る（地盤支の五行・日干の五行ではない）
//   2. structural＝relationBetween(skyBranch, siteBranch)。skyBranch＝siteBranch（伏吟）も通常の FACT
//   3. 既存の growthStage・制約（旬空・坐空）・DayBranchState は変わらない。日干・日支そのものは SiteState を持たない
//   4. 古典例 丁亥日 初伝午（午そのもの 帝旺・午加亥 で 絶）と、自身の growthStage と大きく異なる例・site relation 例
//   5. 分布（十二長生・GrowthPhase・五行関係・合冲刑害破）

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { BRANCH_ELEMENT, STEM_ELEMENT } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { anchorResolutionContextOf, resolveAnchor } from "../src/lib/liuren/interpretation/anchorResolver";
import { relationBetween } from "../src/lib/liuren/interpretation/relations";
import { growthStageOf, GROWTH_STAGES } from "../src/lib/liuren/interpretation/states";
import { isSeatedOnVoid } from "../src/lib/liuren/interpretation/voidStructure";
import {
  lessonUpperSiteStateOf, siteStateOf, siteStateOfResolution, standingSiteStateOf, transmissionSiteStatesOf,
} from "../src/lib/liuren/interpretation/siteState";
import type { SiteState } from "../src/lib/liuren/interpretation/types";
import type { BoardAnchor } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };

const POS = ["standing", "initial", "middle", "final", "lesson1", "lesson2", "lesson3", "lesson4"] as const;
type Pos = (typeof POS)[number];
const stageDist = Object.fromEntries(POS.map((p) => [p, {} as Record<string, number>])) as Record<Pos, Record<string, number>>;
const phaseDist = Object.fromEntries(POS.map((p) => [p, {} as Record<string, number>])) as Record<Pos, Record<string, number>>;
const relDist = Object.fromEntries(POS.map((p) => [p, {} as Record<string, number>])) as Record<Pos, Record<string, number>>;
const structDist = Object.fromEntries(POS.map((p) => [p, {} as Record<string, number>])) as Record<Pos, Record<string, number>>;
const sameSite: Record<string, number> = {};
let sameSiteNonFuyin = 0;
let checked = 0;
const bigDiff: string[] = [];
const relExamples: string[] = [];
const relSeen = new Set<string>();
const wantRel = new Set(["clashes", "combines", "punishes", "harms", "breaks"]);
const ANCHORS: [BoardAnchor, Pos][] = [
  [{ kind: "position", position: "standing" }, "standing"], [{ kind: "position", position: "initial" }, "initial"],
  [{ kind: "position", position: "middle" }, "middle"], [{ kind: "position", position: "final" }, "final"],
  [{ kind: "lesson", index: 1 }, "lesson1"], [{ kind: "lesson", index: 2 }, "lesson2"],
  [{ kind: "lesson", index: 3 }, "lesson3"], [{ kind: "lesson", index: 4 }, "lesson4"],
];

for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`;
    const tag = `${day}+${o}`;
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const facts = buildInterpretationFacts(chart);
    const ctx = anchorResolutionContextOf(facts);
    const before = JSON.stringify(ctx);
    const ts = transmissionSiteStatesOf(facts);
    if (!ts) { check(`${tag} 三伝確定`, false); continue; }
    const states: Record<Pos, SiteState> = {
      standing: standingSiteStateOf(facts), initial: ts.initial, middle: ts.middle, final: ts.final,
      lesson1: lessonUpperSiteStateOf(facts, 1), lesson2: lessonUpperSiteStateOf(facts, 2),
      lesson3: lessonUpperSiteStateOf(facts, 3), lesson4: lessonUpperSiteStateOf(facts, 4),
    };
    const sky: Record<Pos, Branch> = {
      standing: facts.lessons[0].upper, initial: facts.transmissions![0].branch, middle: facts.transmissions![1].branch, final: facts.transmissions![2].branch,
      lesson1: facts.lessons[0].upper, lesson2: facts.lessons[1].upper, lesson3: facts.lessons[2].upper, lesson4: facts.lessons[3].upper,
    };
    for (const p of POS) {
      const s = states[p];
      checked += 1;
      const ok =
        s.skyBranch === sky[p] &&
        s.siteBranch === facts.plate.earthUnder[s.skyBranch] &&
        // 坐空と同じ地盤支
        isSeatedOnVoid(facts, s.skyBranch) === facts.xun.voidBranches.includes(s.siteBranch) &&
        s.skyElement === BRANCH_ELEMENT[s.skyBranch] &&
        s.growthStageAtSite === growthStageOf(BRANCH_ELEMENT[s.skyBranch], s.siteBranch) &&
        JSON.stringify(s.structural) === JSON.stringify(relationBetween(s.skyBranch, s.siteBranch)) &&
        s.structural.relations.includes(s.relation) &&
        JSON.stringify(s) === JSON.stringify(siteStateOf(facts, s.skyBranch));
      if (!ok) check(`${tag} ${p}`, false, JSON.stringify(s));
      // 四課の地盤支と一致（一課は日干の寄宮支）
      if (p.startsWith("lesson") && s.siteBranch !== facts.lessons[Number(p[6]) - 1].lowerBranch) check(`${tag} ${p} lowerBranch`, false);
      inc(stageDist[p], s.growthStageAtSite);
      inc(phaseDist[p], s.growthPhaseAtSite);
      inc(relDist[p], s.relation);
      for (const r of s.structural.relations) if (wantRel.has(r)) inc(structDist[p], r);
      if (s.skyBranch === s.siteBranch) {
        inc(sameSite, p);
        if (facts.plate.offset !== 0) sameSiteNonFuyin += 1;
        if (s.growthStageAtSite !== growthStageOf(s.skyElement, s.skyBranch) || !s.structural.relations.includes("sameElement")) check(`${tag} ${p} same-site`, false);
      }
    }
    // 既存の日干基準 growthStage は別物のまま（日干の五行で天盤支を見る）
    const ini = resolveAnchor({ kind: "position", position: "initial" }, ctx);
    if (ini?.kind !== "path" || ini.source.growthStage !== growthStageOf(STEM_ELEMENT[facts.basic.dayStem], ini.source.branch)) check(`${tag} 既存 growthStage`, false);
    // anchor から到達
    for (const [a, p] of ANCHORS) {
      const r = resolveAnchor(a, ctx)!;
      if (JSON.stringify(siteStateOfResolution(facts, r)) !== JSON.stringify(states[p])) check(`${tag} anchor ${p}`, false);
    }
    if (siteStateOfResolution(facts, resolveAnchor({ kind: "dayStem" }, ctx)!) !== null) check(`${tag} 日干は SiteState なし`, false);
    if (siteStateOfResolution(facts, resolveAnchor({ kind: "dayBranch" }, ctx)!) !== null) check(`${tag} 日支は SiteState なし`, false);
    if (JSON.stringify(ctx) !== before) check(`${tag} 既存 FACT 不変`, false);
    if ("siteState" in ctx.dayBranch) check(`${tag} DayBranchState に site なし`, false);
    // 例の収集
    const own = (ini as Extract<typeof ini, { kind: "path" }>).source;
    const steps = (GROWTH_STAGES.indexOf(states.initial.growthStageAtSite) - GROWTH_STAGES.indexOf(own.growthStage) + 12) % 12;
    if (bigDiff.length < 4 && steps === 6 && i % 7 === 0) {
      bigDiff.push(`${day}日 天盤差${o} 初伝${own.branch}: 自身（日干${facts.basic.dayStem}基準）${own.growthStage} ／ ${own.branch}加${states.initial.siteBranch}（${states.initial.skyElement}基準）${states.initial.growthStageAtSite}`);
    }
    const rels = states.initial.structural.relations.filter((r) => wantRel.has(r));
    const firstNew = rels.find((r) => !relSeen.has(r));
    if (firstNew && i % 13 === 0) {
      for (const r of rels) relSeen.add(r);
      relExamples.push(`${day}日 天盤差${o} 初伝 ${states.initial.skyBranch}→${states.initial.siteBranch}: ${states.initial.relation} ／ ${rels.join("・")}`);
    }
  }
}
check("720課×8位置を監査", checked === 720 * 8, String(checked));
check("skyBranch＝siteBranch は伏吟（offset 0）だけ", sameSiteNonFuyin === 0);

// 古典例 丁亥日 初伝午（Phase 3Q S2: 天盤差7）
{
  const facts = buildInterpretationFacts(calculateLiuren({ dayStem: "丁", dayBranch: "亥", divinationBranch: "子", monthGeneral: BRANCHES[7] }));
  const ctx = anchorResolutionContextOf(facts);
  const ini = resolveAnchor({ kind: "position", position: "initial" }, ctx)!;
  const site = siteStateOfResolution(facts, ini)!;
  check("丁亥 初伝午 自身の growthStage＝帝旺", ini.kind === "path" && ini.source.branch === "午" && ini.source.growthStage === "帝旺");
  check("丁亥 初伝午 siteBranch＝亥・growthStageAtSite＝絶", site.siteBranch === "亥" && site.growthStageAtSite === "絶" && site.growthPhaseAtSite === "renewingBoundary");
  console.log(`丁亥例: 初伝午 自身 ${ini.kind === "path" ? ini.source.growthStage : ""} ／ 午加${site.siteBranch} ${site.growthStageAtSite}（${site.growthPhaseAtSite}） 関係 ${site.structural.relations.join("・")}`);
}

// コードに評価語・ROLE・DOMAIN・制約が出てこない
{
  const src = readFileSync("src/lib/liuren/interpretation/siteState.ts", "utf8").replace(/\/\/.*$/gm, "");
  const hit = ["Supports", "Weakens", "rooted", "strong", "weak", "good", "bad", "self", "target", "resource", "obstacle", "domain", "constraints", "seasonal", "吉", "凶"].filter((w) => src.includes(w));
  check("siteState.ts に評価語・ROLE・DOMAIN・制約・旺相休囚死が出てこない", hit.length === 0, hit.join(","));
  const act = readFileSync("src/lib/liuren/interpretation/actualization.ts", "utf8");
  check("actualization に SiteState を使っていない", !act.includes("site"));
}

const fmt = (o: Record<string, number>, order?: readonly string[]) =>
  (order ?? Object.keys(o)).filter((k) => o[k]).map((k) => `${k}${o[k]}`).join(" ");
console.log("growthStageAtSite 分布:");
for (const p of POS) console.log(`  ${p}: ${fmt(stageDist[p], GROWTH_STAGES)}`);
console.log("growthPhaseAtSite 分布:");
for (const p of POS) console.log(`  ${p}: ${fmt(phaseDist[p], ["emerging", "growing", "peak", "declining", "terminal", "renewingBoundary"])}`);
console.log("五行関係（天盤支→地盤支）分布:");
for (const p of POS) console.log(`  ${p}: ${fmt(relDist[p], ["generates", "sameElement", "generatedBy", "overcomes", "overcomeBy"])}`);
console.log("合冲刑害破 件数:");
for (const p of POS) console.log(`  ${p}: ${fmt(structDist[p], ["combines", "clashes", "punishes", "harms", "breaks"]) || "なし"}`);
console.log(`skyBranch＝siteBranch: ${JSON.stringify(sameSite)}（伏吟以外 ${sameSiteNonFuyin}）`);
console.log("自身の growthStage と growthStageAtSite が6段離れる例:");
for (const e of bigDiff) console.log(`  ${e}`);
console.log("site relation 例:");
for (const e of relExamples) console.log(`  ${e}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
