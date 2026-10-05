// tests/liuren_interpretation_board_context_branch.manual.ts
//
// 六壬神課 Phase 4O（盤上の支と盤外の支の一致 BoardContextBranchComparison）のテスト。
// 実行: npx tsx tests/liuren_interpretation_board_context_branch.manual.ts
//
//   1. 全 anchor の比較可否（dayStem は干なので比較不能・一課の下神も干なので比較不能・他は支）
//   2. 一致は matches: true／false、盤外が解決できなければ unresolved（personNotFound・natalYearMissing・taiSuiMissing。false にしない）
//   3. 『六壬断案２』例53（初伝＝年命 辰）・例52（日上＝太歳 酉）は一致。例42（初伝 子 は本命 未 の上神で、本命そのものではない）・
//      例44（未の上 戌）は今回の FACT では一致しない（限界の確認）。例51（寅上辰は年命）は、辰が盤上の anchor にないので表せない
//   4. 同じ支でも出典（本命・太歳、別の人物）を区別。720課×比較できる anchor×複数の盤外の支で、
//      比較結果が resolveAnchor・resolveContextBranch の値どおり。8,640課で起課結果が変わらない
//   5. 上神・天将・六親・十二長生・空亡・ROLE・DOMAIN を持たない。BoardAnchor・Resolver・RoleMatcher を変更しない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { anchorResolutionContextOf, resolveAnchor } from "../src/lib/liuren/interpretation/anchorResolver";
import type { RelationAnchor } from "../src/lib/liuren/interpretation/anchorResolver";
import { natalYearStateOf } from "../src/lib/liuren/interpretation/natalYear";
import { taiSuiStateOf } from "../src/lib/liuren/interpretation/taiSui";
import { resolveContextBranch } from "../src/lib/liuren/interpretation/contextBranch";
import { compareBoardContextBranch } from "../src/lib/liuren/interpretation/boardContextBranch";
import type { BoardContextBranchComparison } from "../src/lib/liuren/interpretation/boardContextBranch";
import type { ContextBranchSource, InterpretationContext } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const ctxOf = (day: string, jiang: Branch, shi: Branch) =>
  anchorResolutionContextOf(buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang })));
const person = (id: string, stem: Stem, branch: Branch) => ({ id, natalYear: natalYearStateOf(stem, branch) });
const P = (personId: string): ContextBranchSource => ({ kind: "personNatalYear", personId });
const T: ContextBranchSource = { kind: "taiSui" };
const show = (c: BoardContextBranchComparison) =>
  c.status === "compared" ? `${c.boardBranch}／${c.contextBranch} → ${c.matches}` : `unresolved（${c.boardReason ?? ""}${c.boardReason && c.contextReason ? "・" : ""}${c.contextReason ?? ""}）`;

const ANCHORS: [string, RelationAnchor][] = [
  ["dayStem", { kind: "dayStem" }], ["dayBranch", { kind: "dayBranch" }],
  ...([1, 2, 3, 4] as const).flatMap((i) => [[`lesson${i}.upper`, { kind: "lesson", index: i, part: "upper" }], [`lesson${i}.lower`, { kind: "lesson", index: i, part: "lower" }]] as [string, RelationAnchor][]),
  ["standing", { kind: "position", position: "standing" }], ["initial", { kind: "position", position: "initial" }],
  ["middle", { kind: "position", position: "middle" }], ["final", { kind: "position", position: "final" }],
];

// ---- 1. 全 anchor の比較可否 ----
const comparable: string[] = [];
const notComparable: string[] = [];
{
  const ctx = ctxOf("戊辰", "未", "巳");
  const context: InterpretationContext = { domain: "work", persons: [person("A", "甲", "子")] };
  for (const [name, a] of ANCHORS) {
    const c = compareBoardContextBranch(a, P("A"), ctx, context);
    if (c.status === "compared") comparable.push(name);
    else notComparable.push(`${name}（${c.boardReason}）`);
  }
  check("比較できない anchor は dayStem（干）と lesson1.lower（日干そのもの）だけ",
    notComparable.join() === "dayStem（dayStemIsStem）,lesson1.lower（lessonLowerIsStem）", notComparable.join());
  const ds = compareBoardContextBranch({ kind: "dayStem" }, P("A"), ctx, context);
  check("dayStem は支に変換せず、解決の standing（干上）も代わりに使わない", ds.status === "unresolved" && ds.boardReason === "dayStemIsStem" && !("boardBranch" in ds));
}

// ---- 2. matches と unresolved ----
{
  const ctx = ctxOf("丙子", "卯", "丑"); // 例53
  const yes = compareBoardContextBranch({ kind: "position", position: "initial" }, P("A"), ctx, { domain: "work", persons: [person("A", "戊", "辰")] });
  const no = compareBoardContextBranch({ kind: "position", position: "initial" }, P("A"), ctx, { domain: "work", persons: [person("A", "甲", "子")] });
  check("同じ盤で、一致する本命は true・一致しない本命は false", yes.status === "compared" && yes.matches && no.status === "compared" && !no.matches);
  const c1 = compareBoardContextBranch({ kind: "position", position: "initial" }, P("X"), ctx, { domain: "work", persons: [person("A", "戊", "辰")] });
  const c2 = compareBoardContextBranch({ kind: "position", position: "initial" }, P("N"), ctx, { domain: "work", persons: [{ id: "N" }] });
  const c3 = compareBoardContextBranch({ kind: "position", position: "initial" }, T, ctx, { domain: "work" });
  check("存在しない人物は false ではなく unresolved（personNotFound）", c1.status === "unresolved" && c1.contextReason === "personNotFound" && !("matches" in c1));
  check("本命のない人物は unresolved（natalYearMissing）", c2.status === "unresolved" && c2.contextReason === "natalYearMissing");
  check("太歳のない CONTEXT は unresolved（taiSuiMissing）", c3.status === "unresolved" && c3.contextReason === "taiSuiMissing");
  const both = compareBoardContextBranch({ kind: "dayStem" }, T, ctx, { domain: "work" });
  check("盤側・盤外側の両方が解決できないときは両方の理由を持つ", both.status === "unresolved" && both.boardReason === "dayStemIsStem" && both.contextReason === "taiSuiMissing");
}

// ---- 3. 断例 ----
const lines: string[] = [];
{
  const c = compareBoardContextBranch({ kind: "position", position: "initial" }, P("A"), ctxOf("丙子", "卯", "丑"), { domain: "work", persons: [person("A", "戊", "辰")] });
  check("例53 初伝 辰 ＝ 年命 辰（戊辰生）: matches true", c.status === "compared" && c.boardBranch === "辰" && c.contextBranch === "辰" && c.matches);
  lines.push(`例53 initial × 年命: ${show(c)}`);
}
{
  const c = compareBoardContextBranch({ kind: "position", position: "standing" }, T, ctxOf("丁丑", "午", "辰"), { domain: "work", taiSui: taiSuiStateOf("酉") });
  check("例52 日上（standing＝一課上神）酉 ＝ 太歳 酉: matches true", c.status === "compared" && c.boardBranch === "酉" && c.contextBranch === "酉" && c.matches);
  const l1 = compareBoardContextBranch({ kind: "lesson", index: 1, part: "upper" }, T, ctxOf("丁丑", "午", "辰"), { domain: "work", taiSui: taiSuiStateOf("酉") });
  check("例52 一課上神を part: upper で指定しても同じ（lesson の意味は変えない）", l1.status === "compared" && l1.matches);
  lines.push(`例52 standing × 太歳: ${show(c)}`);
}
{
  const ctx = ctxOf("甲寅", "未", "寅");
  const c = compareBoardContextBranch({ kind: "position", position: "initial" }, P("A"), ctx, { domain: "house", persons: [person("A", "辛", "未")] });
  check("例42 初伝 子 と本命 未 は一致しない（初伝は本命の上神。今回の FACT では表せない）", c.status === "compared" && c.boardBranch === "子" && c.contextBranch === "未" && !c.matches);
  check("例42 参考: 初伝 子 は plate.heavenOn[未]（本命の上神）と同じ（次段階の候補）", ctx.facts.plate.heavenOn["未"] === "子");
  lines.push(`例42 initial × 本命: ${show(c)}（初伝＝本命の上神 ${ctx.facts.plate.heavenOn["未"]}）`);
}
{
  const ctx = ctxOf("庚辰", "子", "酉");
  const context: InterpretationContext = { domain: "exam", persons: [person("A", "己", "未")] };
  const l3 = compareBoardContextBranch({ kind: "lesson", index: 3, part: "upper" }, P("A"), ctx, context);
  const l4 = compareBoardContextBranch({ kind: "lesson", index: 4, part: "upper" }, P("A"), ctx, context);
  check("例44 三課上神 未 ＝ 本命 未（一致する）", l3.status === "compared" && l3.matches);
  check("例44 四課上神 戌（未の上）と本命 未 は一致しない（「未上は戌」は上神との一致で、今回の FACT では表せない）",
    l4.status === "compared" && l4.boardBranch === "戌" && !l4.matches && ctx.facts.plate.heavenOn["未"] === "戌");
  lines.push(`例44 lesson3.upper × 本命: ${show(l3)} ／ lesson4.upper × 本命: ${show(l4)}`);
}
{
  // 例51 癸亥日 未将巳時「寅上辰は年命」: 辰は地盤 寅 の上の天盤支。盤上の anchor（日支・四課・干上・三伝）に辰はない
  const ctx = ctxOf("癸亥", "未", "巳");
  const context: InterpretationContext = { domain: "exam", persons: [person("A", "戊", "辰")] };
  const hits = ANCHORS.map(([name, a]) => [name, compareBoardContextBranch(a, P("A"), ctx, context)] as const).filter(([, c]) => c.status === "compared" && c.matches);
  check("例51 年命 辰 と一致する盤上の anchor はない（寅上の辰は anchor で表せない。無理に当てはめない）", hits.length === 0, hits.map(([n]) => n).join());
  check("例51 参考: 辰は地盤 寅 の上（plate.earthUnder[辰]＝寅）", ctx.facts.plate.earthUnder["辰"] === "寅");
  lines.push(`例51 年命 辰: 一致する anchor なし（辰は地盤 ${ctx.facts.plate.earthUnder["辰"]} の上）`);
}

// ---- 4. 出典の区別・720課・8,640課 ----
{
  const ctx = ctxOf("庚辰", "子", "酉"); // 三課上神 未
  const context: InterpretationContext = { domain: "exam", persons: [person("A", "己", "未"), person("B", "己", "未")], taiSui: taiSuiStateOf("未") };
  const anchor: RelationAnchor = { kind: "lesson", index: 3, part: "upper" };
  const [ca, cb, ct] = [P("A"), P("B"), T].map((s) => compareBoardContextBranch(anchor, s, ctx, context));
  check("本命 未 と太歳 未 は同じ一致でも出典が違う比較として区別", ca.status === "compared" && ct.status === "compared" && ca.matches && ct.matches && ca.source.kind !== ct.source.kind);
  check("同じ本命 未 の人物 A・B は personId で別の比較", ca.status === "compared" && cb.status === "compared" && JSON.stringify(ca.source) !== JSON.stringify(cb.source));
}
const SOURCES: ContextBranchSource[] = [P("A"), P("B"), P("N"), P("X"), T];
let compared = 0, unresolved = 0, matched = 0, mismatch = 0, charts = 0, changed = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
  const input = { dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: shi, monthGeneral: BRANCHES[o] };
  const chart = calculateLiuren(input);
  const before = JSON.stringify(chart);
  charts += 1;
  if (shi === "子") {
    const ctx = anchorResolutionContextOf(buildInterpretationFacts(chart));
    const ctxBefore = JSON.stringify(ctx);
    const context: InterpretationContext = {
      domain: "work", persons: [person("A", STEMS[(i + 3) % 10], BRANCHES[(i + 3) % 12]), person("B", STEMS[o % 10], BRANCHES[o % 12]), { id: "N" }],
      taiSui: taiSuiStateOf(BRANCHES[(i + o) % 12]),
    };
    for (const [, a] of ANCHORS) for (const s of SOURCES) {
      const c = compareBoardContextBranch(a, s, ctx, context);
      const ctxSide = resolveContextBranch(context, s);
      const r = resolveAnchor(a.kind === "lesson" ? { kind: "lesson", index: a.index } : a, ctx)!;
      // 監査用に期待値を別に読む（resolveAnchor・resolveContextBranch の結果から）
      const expectedBoard: Branch | null =
        r.kind === "dayStem" ? null : r.kind === "dayBranch" ? r.source.branch : r.kind === "path" ? r.source.branch
        : a.kind === "lesson" && a.part === "lower" ? (r.source.index === 1 ? null : (r.source.lower as Branch)) : r.source.upper.branch;
      if (c.status === "compared") {
        compared += 1;
        if (c.matches) matched += 1;
        const ok = expectedBoard === c.boardBranch && ctxSide.status === "resolved" && ctxSide.branch === c.contextBranch && c.matches === (c.boardBranch === c.contextBranch);
        if (!ok) mismatch += 1;
      } else {
        unresolved += 1;
        const ok = (expectedBoard === null) === (c.boardReason !== undefined) && (ctxSide.status === "unresolved") === (c.contextReason !== undefined);
        if (!ok) mismatch += 1;
      }
    }
    if (JSON.stringify(ctx) !== ctxBefore) changed += 1;
  }
  if (JSON.stringify(chart) !== before || JSON.stringify(calculateLiuren(input)) !== before) changed += 1;
}
check("720課×14 anchor×5 出典: 比較結果が resolveAnchor・resolveContextBranch の値どおり", mismatch === 0 && compared + unresolved === 720 * 14 * 5, `${mismatch} / ${compared + unresolved}`);
check("8,640課で比較しても起課結果・解釈 FACT が変わらない", charts === 8640 && changed === 0, `${charts} / ${changed}`);

// ---- 5. コード ----
{
  const strip = (p: string) => readFileSync(p, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const code = strip("src/lib/liuren/interpretation/boardContextBranch.ts");
  const hit = ["heavenOn", "earthUnder", "generalOn", "heavenlyGeneral", "sixRelation", "relationToDayStem", "growth", "isVoid", "constraints",
    "facts.lessons", "facts.transmissions", "persons", "taiSui.branch", "SemanticRole", "role:", "domain ===", "吉", "凶"].filter((w) => code.includes(w));
  check("boardContextBranch.ts に上神・天将・六親・十二長生・空亡・独自の盤や人物の読み取り・ROLE・DOMAIN がない", hit.length === 0, hit.join(","));
  const roles = strip("src/lib/liuren/interpretation/roles.ts");
  check("BoardAnchor・ContextBranchSource を変更していない（盤外の種類は personNatalYear・taiSui のまま）",
    !/natal|taiSui/i.test(roles.split("export type BoardAnchor =")[1].split(";\n")[0]) &&
    roles.split("export type ContextBranchSource =")[1].split("export interface ContextBranchResolution")[0].match(/kind:/g)?.length === 2);
  check("RoleMatcher に一致の matcher を足していない", !/matchesNatalYear|matchesTaiSui|BoardContext/.test(readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8")));
}

console.log(`比較できる anchor: ${comparable.join(" ")}`);
console.log(`比較できない anchor: ${notComparable.join(" ")}`);
console.log("断例:");
for (const l of lines) console.log(`  ${l}`);
console.log(`720課×14×5: compared ${compared}（一致 ${matched}） ／ unresolved ${unresolved}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
