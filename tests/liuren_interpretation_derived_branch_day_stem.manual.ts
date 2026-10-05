// tests/liuren_interpretation_derived_branch_day_stem.manual.ts
//
// 六壬神課 Phase 4K（任意の支と日干の関係 DerivedBranchDayStemState）のテスト。
// 実行: npx tsx tests/liuren_interpretation_derived_branch_day_stem.manual.ts
//
//   1. 日干10干×12支の120組: 五行・日干関係・六親が既存の計算元（elementOf・relationBetween・sixRelation）と一致
//   2. 720課で、三伝（Phase 3K）・干上（Phase 3L）・四課上神（Phase 3U）・日支（Phase 3V）の既存値と一致
//   3. 占時12支 8,640課×4課の陰神（Phase 4J）すべてに使え、YinSpiritState は変わらない。分布を出す
//   4. 例50（陰神の辰と戊日干の「助関係」）、例39-10（初伝戌の上神申）。陰神の連鎖・行年は監査だけ
//   5. 十二長生・旺衰・標識・空亡・天将・SiteState・吉凶・ROLE・DOMAIN を持たない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { elementOf, sixRelation } from "../src/lib/liuren/relations";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { anchorResolutionContextOf } from "../src/lib/liuren/interpretation/anchorResolver";
import { relationBetween } from "../src/lib/liuren/interpretation/relations";
import { transmissionToDayStemRelation } from "../src/lib/liuren/interpretation/dayStemFlow";
import { lessonYinSpiritStateOf, lessonYinSpiritStatesOf } from "../src/lib/liuren/interpretation/yinSpirit";
import { heavenlyGeneralStateOf } from "../src/lib/liuren/interpretation/heavenlyGeneralState";
import { derivedBranchDayStemStateOf, yinSpiritDayStemStateOf } from "../src/lib/liuren/interpretation/derivedBranchDayStem";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };
const factsOf = (day: string, jiang: Branch, shi: Branch) =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));

// 五行関係と六親の対応（同じ五行関係を2通りに言ったもの。照合用）
const SIX_OF: Record<string, string> = {
  transmissionGeneratesDayStem: "父母", sameElement: "兄弟", dayStemGeneratesTransmission: "子孫",
  transmissionOvercomesDayStem: "官鬼", dayStemOvercomesTransmission: "妻財",
};

// ---- 1. 120組 ----
let combos = 0;
for (let i = 0; i < 10; i++) {
  // 日干ごとに六十干支の組を1つ取る（甲子・乙丑…癸酉）。関係は日干と支だけで決まる
  const stem = STEMS[i];
  const facts = buildInterpretationFacts(calculateLiuren({ dayStem: stem, dayBranch: BRANCHES[i], divinationBranch: "子", monthGeneral: "子" }));
  for (const b of BRANCHES) {
    const s = derivedBranchDayStemStateOf(facts, b);
    combos += 1;
    const ok = Object.keys(s).join() === "branch,element,relationToDayStem,sixRelation" && s.branch === b && s.element === elementOf(b) &&
      s.relationToDayStem === transmissionToDayStemRelation(relationBetween(b, stem)) && s.sixRelation === sixRelation(stem, b) &&
      SIX_OF[s.relationToDayStem] === s.sixRelation;
    if (!ok) check(`${stem}×${b}`, false, JSON.stringify(s));
  }
}
check("日干10干×12支の120組が既存の計算元と一致（日干関係と六親も対応）", combos === 120);

// ---- 2. 既存 FACT との一致（720課） ----
let compared = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
  const facts = buildInterpretationFacts(calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] }));
  const ctx = anchorResolutionContextOf(facts);
  const tag = `${STEMS[i % 10]}${BRANCHES[i % 12]}+${o}`;
  const same = (label: string, x: { branch: Branch; relationToDayStem: string; sixRelation: string }) => {
    const s = derivedBranchDayStemStateOf(facts, x.branch);
    compared += 1;
    if (s.relationToDayStem !== x.relationToDayStem || s.sixRelation !== x.sixRelation) check(`${tag} ${label}`, false, `${JSON.stringify(s)} / ${JSON.stringify(x)}`);
  };
  const c = ctx.comparison!;
  same("干上（Phase 3L）", c.standing);
  same("初伝（Phase 3K）", c.path.initial);
  same("中伝（Phase 3K）", c.path.middle);
  same("末伝（Phase 3K）", c.path.final);
  for (const l of ctx.fourLessons.lessons) same(`lesson${l.index}（Phase 3U）`, l.upper);
  same("日支（Phase 3V）", ctx.dayBranch);
}
check("720課: 三伝・干上・四課上神・日支の既存値と一致（9項目×720）", compared === 720 * 9, String(compared));

// ---- 3. 陰神（8,640課×4課） ----
const sixDist: Record<string, number> = {};
const relDist: Record<string, number> = {};
let yinCount = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
  const facts = buildInterpretationFacts(calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: shi, monthGeneral: BRANCHES[o] }));
  for (const y of lessonYinSpiritStatesOf(facts)) {
    const before = JSON.stringify(y);
    const s = yinSpiritDayStemStateOf(facts, y);
    yinCount += 1;
    if (JSON.stringify(y) !== before || Object.keys(y).join() !== "lessonIndex,sourceBranch,yinSpiritBranch,yinSpiritGeneral") check("YinSpiritState が変わる", false);
    if (JSON.stringify(s) !== JSON.stringify(derivedBranchDayStemStateOf(facts, y.yinSpiritBranch))) check("陰神の接続", false);
    inc(sixDist, s.sixRelation); inc(relDist, s.relationToDayStem);
  }
}
check("8,640課×4課の陰神すべてで取得できる", yinCount === 8640 * 4, String(yinCount));

// ---- 4. 資料の用例 ----
{
  // 例50 戊寅日 申将未時: 三課上神 卯 の陰神 辰（初伝）。本文「辰土が戊日干と助関係にある」
  const f50 = factsOf("戊寅", "申", "未");
  const y = lessonYinSpiritStateOf(f50, 3);
  const s = yinSpiritDayStemStateOf(f50, y);
  check("例50 陰神 辰（三課上神 卯の上）・日干 戊", y.sourceBranch === "卯" && y.yinSpiritBranch === "辰" && f50.basic.dayStem === "戊");
  check("例50 辰は土で、日干戊（土）と sameElement・兄弟（本文の「助関係」）", s.element === "土" && s.relationToDayStem === "sameElement" && s.sixRelation === "兄弟", JSON.stringify(s));
  console.log(`例50: 陰神 ${y.yinSpiritBranch}（三課上神 ${y.sourceBranch} の上） 日干 ${f50.basic.dayStem} ／ ${JSON.stringify(s)}`);
}
{
  // 例39-10 壬寅日 子将寅時「初伝戌…その上神が申で白虎」（天将盤は別方式の例。支だけ確かめる）
  const f39 = factsOf("壬寅", "子", "寅");
  const ini = f39.transmissions![0].branch;
  const over = f39.plate.heavenOn[ini];
  const s = derivedBranchDayStemStateOf(f39, over);
  check("例39-10 初伝 戌 の上神は plate.heavenOn で 申", ini === "戌" && over === "申");
  check("例39-10 申にも共通 FACT がそのまま使える（申は金、壬水を生ずる＝父母）", s.element === "金" && s.relationToDayStem === "transmissionGeneratesDayStem" && s.sixRelation === "父母");
  console.log(`例39-10: 初伝 ${ini} の上神 ${over}（エンジンの天将 ${heavenlyGeneralStateOf(f39, over).general}、断案の盤では白虎） ／ ${JSON.stringify(s)}`);
}
{
  // 陰神の連鎖（例36「子の陰神は寅、寅の陰神は辰」）: 一段目の支を基準に渡す API はない（四課の番号で受け取る）。
  // 天地盤では plate.heavenOn をもう一度引けば二段目になる（実装はしない。ここでは監査だけ）
  const f36 = factsOf("庚戌", "亥", "酉");
  const y1 = lessonYinSpiritStateOf(f36, 3);
  const second = f36.plate.heavenOn[y1.yinSpiritBranch];
  check("例36 二段目（寅の陰神 辰）は、一段目の陰神 寅 に plate.heavenOn をもう一度引いた支で、四課の陰神と同じ",
    y1.yinSpiritBranch === "寅" && second === "辰" && lessonYinSpiritStateOf(f36, 4).yinSpiritBranch === second);
  check("Phase 4J の公開 API は四課の番号だけを受け取る（任意の支を基準に渡す関数はない）", lessonYinSpiritStateOf.length === 2);
}

// ---- 5. コード ----
{
  const code = readFileSync("src/lib/liuren/interpretation/derivedBranchDayStem.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const hit = ["growthStage", "seasonal", "Salary", "Virtue", "xunDing", "yima", "isVoid", "SeatedOnVoid", "voidBranches", "generalOn", "heavenlyGeneral",
    "siteState", "earthUnder", "constraints", "support", "obstacle", "good", "bad", "effective", "助", "role", "domain", "InterpretationContext",
    "STEM_ELEMENT", "BRANCH_ELEMENT", "ELEMENT_GENERATES", "ELEMENT_CONTROLS", "兄弟", "父母", "子孫", "官鬼", "妻財"].filter((w) => code.includes(w));
  check("derivedBranchDayStem.ts に他の FACT・吉凶・独自の五行表や六親表がない", hit.length === 0, hit.join(","));
  check("RoleMatcher を変更していない", !/derivedBranch|DerivedBranch/.test(readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8")));
  check("YinSpiritState の型に日干関係を足していない",
    !/relationToDayStem|sixRelation/.test(readFileSync("src/lib/liuren/interpretation/types.ts", "utf8").split("export interface YinSpiritState")[1].split("}")[0]));
}

const sixOrder = ["父母", "兄弟", "子孫", "官鬼", "妻財"];
const relOrder = ["transmissionGeneratesDayStem", "sameElement", "dayStemGeneratesTransmission", "transmissionOvercomesDayStem", "dayStemOvercomesTransmission"];
console.log(`8,640課×4課の陰神 六親: ${sixOrder.map((k) => `${k}${sixDist[k] ?? 0}`).join(" ")}`);
console.log(`同 日干関係: ${relOrder.map((k) => `${k} ${relDist[k] ?? 0}`).join(" ／ ")}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
