// tests/liuren_interpretation_context_branch_derivation.manual.ts
//
// 六壬神課 Phase 4P（盤外の支からの一段の派生 DerivedContextBranchSource と resolveDerivedContextBranch）のテスト。
// 実行: npx tsx tests/liuren_interpretation_context_branch_derivation.manual.ts
//
//   1. self・heavenOn・earthUnder が天地盤の写像どおり。天地盤の逆写像が両方向で成り立つ。12支すべて
//   2. 盤外の支が解決できなければ Phase 4N の理由を持つ。同じ支でも派生の種類・出典（人物・太歳）を区別する
//   3. 『六壬断案２』例42（本命 未 の上 子＝初伝）・例44（未上は戌）・例51（年命 辰 の下 寅）・例52（太歳 酉 の上 亥＝昼貴人支）・
//      例33（太歳 午 の上 寅。行年 未 の上 卯 は支の構造だけ確認し、行年の出典は作らない）
//   4. 盤上の支との比較（Phase 4O の読み取りを使う別の関数）。例42 は self で false・heavenOn で true
//   5. 伏吟・返吟。派生した支を既存の関数（Phase 4K・4B・十二長生）に渡せる
//   6. 720課・8,640課で天地盤と一致し、起課結果が変わらない。派生の種類に驛馬・天将・十二長生がない。ROLE・DOMAIN を持たない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { CHONG } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { anchorResolutionContextOf } from "../src/lib/liuren/interpretation/anchorResolver";
import { heavenlyGeneralStateOf } from "../src/lib/liuren/interpretation/heavenlyGeneralState";
import { derivedBranchDayStemStateOf } from "../src/lib/liuren/interpretation/derivedBranchDayStem";
import { growthStageOfStem } from "../src/lib/liuren/interpretation/states";
import { dayNightNobleBranchPairStateOf } from "../src/lib/liuren/interpretation/dayNightNobleBranchPair";
import { natalYearStateOf } from "../src/lib/liuren/interpretation/natalYear";
import { taiSuiStateOf } from "../src/lib/liuren/interpretation/taiSui";
import { compareBoardContextBranch } from "../src/lib/liuren/interpretation/boardContextBranch";
import {
  compareBoardDerivedContextBranch, resolveDerivedContextBranch,
} from "../src/lib/liuren/interpretation/contextBranchDerivation";
import type { ContextBranchDerivation, DerivedContextBranchResolution } from "../src/lib/liuren/interpretation/contextBranchDerivation";
import type { ContextBranchSource, InterpretationContext } from "../src/lib/liuren/interpretation/roles";
import type { InterpretationFacts } from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const factsOf = (day: string, jiang: Branch, shi: Branch) =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
const person = (id: string, stem: Stem, branch: Branch) => ({ id, natalYear: natalYearStateOf(stem, branch) });
const P = (personId: string): ContextBranchSource => ({ kind: "personNatalYear", personId });
const T: ContextBranchSource = { kind: "taiSui" };
const DERIVATIONS: ContextBranchDerivation[] = ["self", "heavenOn", "earthUnder"];
const resolved = (f: InterpretationFacts, c: InterpretationContext, s: ContextBranchSource, d: ContextBranchDerivation): DerivedContextBranchResolution | null => {
  const r = resolveDerivedContextBranch(f, c, { source: s, derivation: d });
  return r.status === "resolved" ? r : null;
};

// ---- 1・6. 天地盤との一致（12支・720課・8,640課） ----
let charts = 0, mismatch = 0, changed = 0, inverse = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
  const input = { dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: shi, monthGeneral: BRANCHES[o] };
  const chart = calculateLiuren(input);
  const before = JSON.stringify(chart);
  const facts = buildInterpretationFacts(chart);
  charts += 1;
  for (const b of BRANCHES) {
    if (facts.plate.earthUnder[facts.plate.heavenOn[b]] !== b || facts.plate.heavenOn[facts.plate.earthUnder[b]] !== b) inverse += 1;
    // 12支それぞれを太歳として与え、3種類の派生を求める
    const context: InterpretationContext = { domain: "work", taiSui: taiSuiStateOf(b) };
    for (const d of DERIVATIONS) {
      const r = resolved(facts, context, T, d);
      const expected = d === "self" ? b : d === "heavenOn" ? facts.plate.heavenOn[b] : facts.plate.earthUnder[b];
      if (!r || r.baseBranch !== b || r.branch !== expected || Object.keys(r).join() !== "status,source,baseBranch,branch") mismatch += 1;
    }
  }
  if (JSON.stringify(chart) !== before || JSON.stringify(calculateLiuren(input)) !== before) changed += 1;
}
check("8,640課（うち720課は占時子）×12支×3種類: self・heavenOn・earthUnder が天地盤の写像どおり", charts === 8640 && mismatch === 0, `${charts} / ${mismatch}`);
check("天地盤の逆写像が両方向で成り立つ（earthUnder[heavenOn[b]]＝b・heavenOn[earthUnder[b]]＝b）", inverse === 0, String(inverse));
check("派生を求めても起課結果が変わらない", changed === 0, String(changed));

// ---- 2. 解決できない場合・出典の区別 ----
{
  const f = factsOf("庚辰", "子", "酉");
  for (const [label, ctx, s, reason] of [
    ["存在しない人物", { domain: "work", persons: [person("A", "己", "未")] }, P("X"), "personNotFound"],
    ["本命のない人物", { domain: "work", persons: [{ id: "N" }] }, P("N"), "natalYearMissing"],
    ["太歳のない CONTEXT", { domain: "work" }, T, "taiSuiMissing"],
  ] as [string, InterpretationContext, ContextBranchSource, string][]) {
    const ok = DERIVATIONS.every((d) => { const r = resolveDerivedContextBranch(f, ctx, { source: s, derivation: d }); return r.status === "unresolved" && r.reason === reason; });
    check(`${label}は 3種類とも unresolved（${reason}）`, ok);
  }
  const context: InterpretationContext = { domain: "exam", persons: [person("A", "己", "未"), person("B", "己", "未")], taiSui: taiSuiStateOf("未") };
  const self = resolved(f, context, P("A"), "self")!, on = resolved(f, context, P("A"), "heavenOn")!, under = resolved(f, context, P("A"), "earthUnder")!;
  check("同じ本命 未 でも self・heavenOn・earthUnder は別の支（未・戌・辰）として区別", self.branch === "未" && on.branch === "戌" && under.branch === "辰" && self.baseBranch === on.baseBranch);
  const onB = resolved(f, context, P("B"), "heavenOn")!;
  check("人物 A・B の本命 未 の heavenOn（どちらも戌）は personId で区別", on.branch === onB.branch && JSON.stringify(on.source) !== JSON.stringify(onB.source));
  const onT = resolved(f, context, T, "heavenOn")!;
  check("本命 未 と太歳 未 の heavenOn（どちらも戌）は出典で区別", on.branch === onT.branch && on.source.source.kind !== onT.source.source.kind);
}

// ---- 3・4. 断例 ----
const lines: string[] = [];
{
  // 例42 甲寅日 未将寅時（辛未生）「本命上が発用」
  const f = factsOf("甲寅", "未", "寅");
  const ctx = anchorResolutionContextOf(f);
  const context: InterpretationContext = { domain: "house", persons: [person("A", "辛", "未")] };
  const on = resolved(f, context, P("A"), "heavenOn")!;
  check("例42 本命 未 の heavenOn は 子", on.baseBranch === "未" && on.branch === "子");
  const self = compareBoardContextBranch({ kind: "position", position: "initial" }, P("A"), ctx, context);
  const derived = compareBoardDerivedContextBranch({ kind: "position", position: "initial" }, { source: P("A"), derivation: "heavenOn" }, ctx, context);
  const derivedSelf = compareBoardDerivedContextBranch({ kind: "position", position: "initial" }, { source: P("A"), derivation: "self" }, ctx, context);
  check("例42 初伝 子 と本命 未（Phase 4O・self）は false", self.status === "compared" && !self.matches && derivedSelf.status === "compared" && !derivedSelf.matches);
  check("例42 初伝 子 と本命 未 の heavenOn 子 は true（「本命上が発用」）", derived.status === "compared" && derived.matches && derived.baseBranch === "未" && derived.contextBranch === "子");
  lines.push(`例42: 本命 未 → heavenOn ${on.branch} ／ 初伝 ${derived.status === "compared" ? derived.boardBranch : "-"}: self ${self.status === "compared" && self.matches} ・ heavenOn ${derived.status === "compared" && derived.matches}`);
}
{
  const f = factsOf("庚辰", "子", "酉");
  const on = resolved(f, { domain: "exam", persons: [person("A", "己", "未")] }, P("A"), "heavenOn")!;
  check("例44 本命 未 の heavenOn は 戌（「未上は戌」）", on.baseBranch === "未" && on.branch === "戌");
  lines.push(`例44: 本命 未 → heavenOn ${on.branch}`);
}
{
  const f = factsOf("癸亥", "未", "巳");
  const under = resolved(f, { domain: "exam", persons: [person("A", "戊", "辰")] }, P("A"), "earthUnder")!;
  check("例51 年命 辰 の earthUnder は 寅（「寅上辰は年命」）", under.baseBranch === "辰" && under.branch === "寅");
  lines.push(`例51: 年命 辰 → earthUnder ${under.branch}`);
}
{
  const f = factsOf("丁丑", "午", "辰");
  const on = resolved(f, { domain: "work", taiSui: taiSuiStateOf("酉") }, T, "heavenOn")!;
  check("例52 太歳 酉 の heavenOn は 亥 で、Phase 4F の昼貴人支と同じ支（構造の一致だけ）", on.branch === "亥" && dayNightNobleBranchPairStateOf(f).dayBranch === on.branch);
  lines.push(`例52: 太歳 酉 → heavenOn ${on.branch}（昼貴人支 ${dayNightNobleBranchPairStateOf(f).dayBranch}）`);
}
{
  const f = factsOf("壬午", "辰", "申");
  const on = resolved(f, { domain: "house", taiSui: taiSuiStateOf("午") }, T, "heavenOn")!;
  check("例33 太歳 午 の heavenOn は 寅（訳注「午の陰神」の盤の構造）", on.branch === "寅");
  // 行年 未 の上 卯: 行年の出典は作らず、天地盤の写像だけを確かめる
  check("例33 参考: 行年 未 の上は plate.heavenOn[未]＝卯（行年の出典は作らない）", f.plate.heavenOn["未"] === "卯");
  lines.push(`例33: 太歳 午 → heavenOn ${on.branch} ／ 参考（行年 未）: plate.heavenOn[未]＝${f.plate.heavenOn["未"]}`);
}

// ---- 5. 伏吟・返吟・既存の関数へ ----
{
  const fuyin = factsOf("甲子", "子", "子"); // 天地盤の差 0
  const ctx: InterpretationContext = { domain: "work", taiSui: taiSuiStateOf("未") };
  const rs = DERIVATIONS.map((d) => resolved(fuyin, ctx, T, d)!);
  check("伏吟: 3種類とも同じ支だが、派生の種類は別々に保持", fuyin.plate.offset === 0 && new Set(rs.map((r) => r.branch)).size === 1 && new Set(rs.map((r) => r.source.derivation)).size === 3);
  const fanyin = factsOf("甲子", "午", "子"); // 天地盤の差 6
  const on = resolved(fanyin, ctx, T, "heavenOn")!, under = resolved(fanyin, ctx, T, "earthUnder")!;
  check("返吟: heavenOn・earthUnder はどちらも基準の支の冲", fanyin.plate.offset === 6 && on.branch === CHONG["未"] && under.branch === CHONG["未"]);
}
{
  const f = factsOf("甲寅", "未", "寅");
  const on = resolved(f, { domain: "house", persons: [person("A", "辛", "未")] }, P("A"), "heavenOn")!;
  check("派生した支を Phase 4K に渡せる（甲から見て子は父母）", derivedBranchDayStemStateOf(f, on.branch).sixRelation === "父母");
  check("派生した支を Phase 4B に渡せる（例42 の子は螣蛇）", heavenlyGeneralStateOf(f, on.branch).general === "螣蛇");
  check("派生した支を十二長生に渡せる（甲の子は沐浴）", growthStageOfStem("甲", on.branch) === "沐浴");
  check("解決結果に天将・六親・十二長生を埋め込んでいない", Object.keys(on).join() === "status,source,baseBranch,branch");
}

// ---- 6. コード ----
{
  const strip = (p: string) => readFileSync(p, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const code = strip("src/lib/liuren/interpretation/contextBranchDerivation.ts");
  const derivationType = code.split("export type ContextBranchDerivation =")[1].split(";")[0];
  check("派生の種類は self・heavenOn・earthUnder だけ（驛馬・天将・十二長生・陰神・上神の名前はない）", derivationType.trim() === `"self" | "heavenOn" | "earthUnder"`, derivationType);
  const hit = ["陰神", "上神", "yinSpirit", "yima", "generalOn", "heavenlyGeneral", "growth", "sixRelation", "persons", "natalYear", "taiSui.branch", "xingNian", "行年",
    "SemanticRole", "domain ===", "吉", "凶"].filter((w) => code.includes(w));
  check("contextBranchDerivation.ts に資料用語・他の FACT・独自の人物や太歳の読み取り・行年・ROLE・DOMAIN がない", hit.length === 0, hit.join(","));
  check("続けてたどる関数がない（公開関数は resolveDerivedContextBranch・compareBoardDerivedContextBranch だけ）",
    [...code.matchAll(/export function (\w+)/g)].map((m) => m[1]).join() === "resolveDerivedContextBranch,compareBoardDerivedContextBranch");
  const roles = strip("src/lib/liuren/interpretation/roles.ts");
  check("ContextBranchSource・BoardAnchor を変更していない", roles.split("export type ContextBranchSource =")[1].split("export interface ContextBranchResolution")[0].match(/kind:/g)?.length === 2 &&
    !/natal|taiSui/i.test(roles.split("export type BoardAnchor =")[1].split(";\n")[0]));
  check("RoleMatcher・Evidence を変更していない", !/Derived|derivation/.test(readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8")));
}

console.log("断例:");
for (const l of lines) console.log(`  ${l}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
