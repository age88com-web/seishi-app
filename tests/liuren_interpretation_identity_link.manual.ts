// tests/liuren_interpretation_identity_link.manual.ts
//
// 六壬神課 Phase 4R（IDENTITY 層: IdentityLink と collectIdentityLinks）のテスト。
// 実行: npx tsx tests/liuren_interpretation_identity_link.manual.ts
//
//   1. つながりは Phase 4P の比較で matches: true の組だけ。720課×複数の出典で、比較の true の組と完全一致
//   2. 出典は呼び出し側が渡すだけ（subjectPersonId などから自動では選ばない）。解決できない出典は出典ごとに1件
//   3. 干上と一課上神・同じ支の別の位置・同じ支の別の派生（伏吟）・同じ本命の別人物・本命と太歳は、別のつながり
//   4. 『六壬断案２』例53（年命 辰 self＝初伝）・例42（本命 未 heavenOn 子＝初伝。self は初伝とつながらない）・
//      例44（本命 未 self＝三課上神、heavenOn 戌＝四課上神）・例51（年命 辰 earthUnder 寅 は盤の位置にない）・
//      例52（太歳 酉 self＝干上、heavenOn 亥 は盤の位置にあればつながる）
//   5. 順序は決定的（出典の入力順 → 派生 → 位置）・二重に作らない。8,640課で起課結果・解釈 FACT が変わらない
//   6. つながりに六親・十二長生・天将・空亡・驛馬・吉凶・ROLE を持たない。既存の API・型を変更しない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { anchorResolutionContextOf } from "../src/lib/liuren/interpretation/anchorResolver";
import type { AnchorResolutionContext, RelationAnchor } from "../src/lib/liuren/interpretation/anchorResolver";
import { natalYearStateOf } from "../src/lib/liuren/interpretation/natalYear";
import { taiSuiStateOf } from "../src/lib/liuren/interpretation/taiSui";
import { compareBoardDerivedContextBranch } from "../src/lib/liuren/interpretation/contextBranchDerivation";
import type { ContextBranchDerivation } from "../src/lib/liuren/interpretation/contextBranchDerivation";
import { IDENTITY_LINK_ANCHORS, collectIdentityLinks } from "../src/lib/liuren/interpretation/identityLink";
import type { IdentityLink } from "../src/lib/liuren/interpretation/identityLink";
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
const anchorName = (a: RelationAnchor) => a.kind === "lesson" ? `lesson${a.index}.${a.part}` : a.kind === "position" ? a.position : a.kind;
const linkName = (l: IdentityLink) => `${l.source.source.kind === "personNatalYear" ? l.source.source.personId : "taiSui"}/${l.source.derivation}→${anchorName(l.anchor)}=${l.branch}`;
const has = (links: readonly IdentityLink[], src: ContextBranchSource, d: ContextBranchDerivation, anchor: string) =>
  links.find((l) => JSON.stringify(l.source.source) === JSON.stringify(src) && l.source.derivation === d && anchorName(l.anchor) === anchor);

// ---- 盤の位置 ----
check("盤の位置は Phase 4O で比べられる12種（日干・一課の下神を含まない）",
  IDENTITY_LINK_ANCHORS.length === 12 && !IDENTITY_LINK_ANCHORS.some((a) => a.kind === "dayStem" || (a.kind === "lesson" && a.index === 1 && a.part === "lower")));

// ---- 4. 断例 ----
const lines: string[] = [];
{
  const c = collectIdentityLinks(ctxOf("丙子", "卯", "丑"), { domain: "work", persons: [person("A", "戊", "辰")] }, [P("A")]);
  const l = has(c.links, P("A"), "self", "initial");
  check("例53 年命 辰 self → 初伝 辰 のつながり", !!l && l.branch === "辰" && l.baseBranch === "辰");
  lines.push(`例53: ${c.links.map(linkName).join(" ")}`);
}
{
  const c = collectIdentityLinks(ctxOf("甲寅", "未", "寅"), { domain: "house", persons: [person("A", "辛", "未")] }, [P("A")]);
  const l = has(c.links, P("A"), "heavenOn", "initial");
  check("例42 本命 未 heavenOn → 初伝 子 のつながり", !!l && l.branch === "子" && l.baseBranch === "未");
  check("例42 本命 未 self は初伝とつながらない", !has(c.links, P("A"), "self", "initial"));
  lines.push(`例42: ${c.links.map(linkName).join(" ")}`);
}
{
  const c = collectIdentityLinks(ctxOf("庚辰", "子", "酉"), { domain: "exam", persons: [person("A", "己", "未")] }, [P("A")]);
  check("例44 本命 未 self → 三課上神 未 と、heavenOn → 四課上神 戌 を区別して取得",
    has(c.links, P("A"), "self", "lesson3.upper")?.branch === "未" && has(c.links, P("A"), "heavenOn", "lesson4.upper")?.branch === "戌");
  lines.push(`例44: ${c.links.map(linkName).join(" ")}`);
}
{
  const ctx = ctxOf("癸亥", "未", "巳");
  const c = collectIdentityLinks(ctx, { domain: "exam", persons: [person("A", "戊", "辰")] }, [P("A")]);
  check("例51 年命 辰 earthUnder 寅 は盤の位置にないのでつながりを作らない（FACT は Phase 4P に残る）",
    !c.links.some((l) => l.source.derivation === "earthUnder") && ctx.facts.plate.earthUnder["辰"] === "寅");
  lines.push(`例51: ${c.links.map(linkName).join(" ") || "つながりなし"}`);
}
{
  const ctx = ctxOf("丁丑", "午", "辰");
  const c = collectIdentityLinks(ctx, { domain: "work", taiSui: taiSuiStateOf("酉") }, [T]);
  check("例52 太歳 酉 self → 干上 酉 のつながり", has(c.links, T, "self", "standing")?.branch === "酉");
  const onLinks = c.links.filter((l) => l.source.derivation === "heavenOn");
  check("例52 太歳 酉 heavenOn 亥 は、亥がある盤の位置（二課上神・中伝）とだけつながる",
    onLinks.length > 0 && onLinks.every((l) => l.branch === "亥") && onLinks.map((l) => anchorName(l.anchor)).join() === "lesson2.upper,middle");
  lines.push(`例52: ${c.links.map(linkName).join(" ")}`);
}

// ---- 2・3. 出典・重複・区別 ----
{
  const ctx = ctxOf("庚辰", "子", "酉"); // 三課上神 未・四課下神 未
  const context: InterpretationContext = {
    domain: "exam", persons: [person("A", "己", "未"), person("B", "己", "未"), { id: "N" }], subjectPersonId: "A", counterpartyPersonId: "B", taiSui: taiSuiStateOf("未"),
  };
  const none = collectIdentityLinks(ctx, context, []);
  check("出典を渡さなければ何も集めない（subjectPersonId・太歳を自動で選ばない）", none.links.length === 0 && none.unresolved.length === 0);
  const c = collectIdentityLinks(ctx, context, [P("A"), P("B"), T, P("X"), P("N"), P("A")]);
  check("解決できない出典は出典ごとに1件（personNotFound・natalYearMissing）",
    JSON.stringify(c.unresolved) === JSON.stringify([{ source: P("X"), reason: "personNotFound" }, { source: P("N"), reason: "natalYearMissing" }]));
  check("太歳のない CONTEXT では taiSuiMissing が1件", JSON.stringify(collectIdentityLinks(ctx, { domain: "exam" }, [T]).unresolved) === JSON.stringify([{ source: T, reason: "taiSuiMissing" }]));
  const a = c.links.filter((l) => JSON.stringify(l.source.source) === JSON.stringify(P("A")));
  const b = c.links.filter((l) => JSON.stringify(l.source.source) === JSON.stringify(P("B")));
  const t = c.links.filter((l) => l.source.source.kind === "taiSui");
  check("同じ出典を2回渡しても二重に作らない", a.length === new Set(a.map((l) => JSON.stringify([l.source, l.anchor]))).size && c.links.length === new Set(c.links.map((l) => JSON.stringify([l.source, l.anchor]))).size);
  check("同じ本命 未 の A・B は別のつながり（personId で区別）", a.length > 0 && a.length === b.length && a.every((l, i) => l.branch === b[i].branch && anchorName(l.anchor) === anchorName(b[i].anchor)));
  check("本命 未 と太歳 未 も別のつながり", t.length === a.length && t.every((l, i) => l.branch === a[i].branch && l.source.source.kind !== a[i].source.source.kind));
  check("同じ支の別の位置（三課上神 未・四課下神 未）は別のつながり", !!has(c.links, P("A"), "self", "lesson3.upper") && !!has(c.links, P("A"), "self", "lesson4.lower"));
  const order = c.links.map((l) => `${JSON.stringify(l.source.source)}|${["self", "heavenOn", "earthUnder"].indexOf(l.source.derivation)}|${IDENTITY_LINK_ANCHORS.findIndex((x) => JSON.stringify(x) === JSON.stringify(l.anchor))}`);
  const srcOrder = [P("A"), P("B"), T].map((s) => JSON.stringify(s));
  const sorted = [...order].sort((x, y) => {
    const [sx, dx, ax] = x.split("|"); const [sy, dy, ay] = y.split("|");
    return srcOrder.indexOf(sx) - srcOrder.indexOf(sy) || Number(dx) - Number(dy) || Number(ax) - Number(ay);
  });
  check("順序は 出典の入力順 → 派生（self・heavenOn・earthUnder）→ 位置（IDENTITY_LINK_ANCHORS の順）", order.join() === sorted.join());
  check("同じ入力なら毎回同じ一覧", JSON.stringify(collectIdentityLinks(ctx, context, [P("A"), P("B"), T, P("X"), P("N"), P("A")])) === JSON.stringify(c));
}
{
  // 干上と一課上神は同じ支でも別の位置として両方持つ。伏吟では 3種類の派生が同じ支でも別のつながり
  const ctx = ctxOf("甲子", "子", "子"); // 伏吟
  const u1 = ctx.facts.lessons[0].upper;
  const c = collectIdentityLinks(ctx, { domain: "work", taiSui: taiSuiStateOf(u1) }, [T]);
  check("干上と一課上神は別のつながりとして両方持つ", !!has(c.links, T, "self", "standing") && !!has(c.links, T, "self", "lesson1.upper"));
  check("伏吟で self・heavenOn・earthUnder が同じ支でも別のつながり",
    ["self", "heavenOn", "earthUnder"].every((d) => !!has(c.links, T, d as ContextBranchDerivation, "standing")));
}

// ---- 1・5. 720課・8,640課 ----
let mismatch = 0, total = 0, charts = 0, changed = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
  const input = { dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: shi, monthGeneral: BRANCHES[o] };
  const chart = calculateLiuren(input);
  const before = JSON.stringify(chart);
  charts += 1;
  if (shi === "子") {
    const ctx: AnchorResolutionContext = anchorResolutionContextOf(buildInterpretationFacts(chart));
    const ctxBefore = JSON.stringify(ctx);
    const context: InterpretationContext = {
      domain: "work", persons: [person("A", STEMS[(i + 3) % 10], BRANCHES[(i + 3) % 12]), person("B", STEMS[o % 10], BRANCHES[o % 12])],
      taiSui: taiSuiStateOf(BRANCHES[(i + o) % 12]),
    };
    const sources = [P("A"), P("B"), T];
    const c = collectIdentityLinks(ctx, context, sources);
    // 期待: Phase 4P の比較で matches: true の組（出典 → 派生 → 位置の順）
    const expected: string[] = [];
    for (const s of sources) for (const d of ["self", "heavenOn", "earthUnder"] as ContextBranchDerivation[]) for (const a of IDENTITY_LINK_ANCHORS) {
      const cmp = compareBoardDerivedContextBranch(a, { source: s, derivation: d }, ctx, context);
      if (cmp.status === "compared" && cmp.matches) expected.push(JSON.stringify([s, d, a, cmp.baseBranch, cmp.contextBranch]));
    }
    const got = c.links.map((l) => JSON.stringify([l.source.source, l.source.derivation, l.anchor, l.baseBranch, l.branch]));
    total += got.length;
    if (got.join() !== expected.join() || c.unresolved.length || c.unavailableAnchors.length) mismatch += 1;
    if (JSON.stringify(ctx) !== ctxBefore) changed += 1;
  }
  if (JSON.stringify(chart) !== before || JSON.stringify(calculateLiuren(input)) !== before) changed += 1;
}
check("720課×3出典: つながりが Phase 4P の比較で true の組と完全一致（順序も同じ）", mismatch === 0, String(mismatch));
check("8,640課でつながりを集めても起課結果・解釈 FACT が変わらない", charts === 8640 && changed === 0, `${charts} / ${changed}`);

// ---- 6. 型・コード ----
{
  const strip = (p: string) => readFileSync(p, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const code = strip("src/lib/liuren/interpretation/identityLink.ts");
  const linkType = code.split("export interface IdentityLink {")[1].split("}")[0];
  check("IdentityLink の項目は source・anchor・baseBranch・branch だけ", (linkType.match(/^\s*(\w+)\??:/gm) ?? []).map((s) => s.trim().replace(/[?:]/g, "")).join() === "source,anchor,baseBranch,branch");
  const hit = ["sixRelation", "relationToDayStem", "growth", "general", "isVoid", "SeatedOnVoid", "yima", "good", "bad", "favorable", "effective", "SemanticRole",
    "subjectPersonId", "counterpartyPersonId", "domain ===", "timing", "行年", "寄宮", "jigong", "旬尾", "Evidence"].filter((w) => code.includes(w));
  check("identityLink.ts に六親・十二長生・天将・空亡・驛馬・吉凶・ROLE・自動選択・DOMAIN・時期・行年・寄宮・旬尾・Evidence がない", hit.length === 0, hit.join(","));
  check("RoleMatcher・RoleEvidence を変更していない", !/IdentityLink|identityLink/.test(readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8") + readFileSync("src/lib/liuren/interpretation/roles.ts", "utf8")));
}

console.log("断例:");
for (const l of lines) console.log(`  ${l}`);
console.log(`720課のつながり総数: ${total}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
