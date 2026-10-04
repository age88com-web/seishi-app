// tests/liuren_audit_semantic_roles.manual.ts
//
// 六壬神課 Phase 3T: Semantic Role 層の設計監査（監査専用。ROLE の自動判定は実装しない）。
// 実行: npx tsx tests/liuren_audit_semantic_roles.manual.ts
//
//   1. roles.ts が型だけ（実行時に何も export しない）で、評価語を持たないこと
//   2. DOMAIN・subtype・goal の整理と、FACT → ROLE 候補の対応表（出典のあるものと、原典未確認の候補を分ける）
//   3. 古典に読み方が明記された例について、ROLE をこのテストの中で手で割り当て、
//      source（盤上の位置）→ Phase 3S の制約・Phase 3R の地点どうしの関係 を FACT を書き換えずにたどれること
//   4. 同じ盤上の位置・同じ六親が、CONTEXT によって別の ROLE になること（固定の変換ではない）
//   出典: 『六壬神課講座』p57・p59・p61・p62・p65・p66・p67、『六壬断案２』例34・46・54

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { standingPathActualizationOf } from "../src/lib/liuren/interpretation/actualization";
import * as rolesModule from "../src/lib/liuren/interpretation/roles";
import type {
  BoardAnchor, DomainSubtypes, InterpretationContext, InterpretationDomain, InterpretationGoal, RoleEvidenceKind,
  SemanticRole, SemanticRoleAssignment,
} from "../src/lib/liuren/interpretation/roles";
import type { ComparisonPosition, InterpretationFacts, StandingPathActualization } from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

// ---- 1. roles.ts は型だけ ----
{
  check("roles.ts は実行時に何も export しない（型だけ）", Object.keys(rolesModule).length === 0, Object.keys(rolesModule).join(","));
  const src = readFileSync("src/lib/liuren/interpretation/roles.ts", "utf8").replace(/\/\/.*$/gm, "");
  const forbidden = ["favorable", "unfavorable", "goodTarget", "badObstacle", "score", "weight", "isEffective", "shouldAdvance", "shouldRetreat"];
  const hit = forbidden.filter((w) => src.includes(w));
  check("roles.ts のコードに評価語がない", hit.length === 0, hit.join(","));
  check("roles.ts に関数の実装がない", !/function\s+\w+\s*\(/.test(src) && !/=>\s*\{/.test(src));
}

// ---- 2. 整理 ----
const DOMAINS: Record<InterpretationDomain, { subtypes: DomainSubtypes[InterpretationDomain][]; note: string }> = {
  wealth: { subtypes: ["general"], note: "求財" },
  work: { subtypes: ["employment", "jobChange", "promotion", "transfer", "currentWork", "resignation", "independence"], note: "仕事は subtype で分ける" },
  exam: { subtypes: ["general"], note: "試験（断案2 前程仕進）" },
  house: { subtypes: ["residence", "moving"], note: "家宅・転居で同じ位置の読み方が変わる（講座 p67）" },
  marriage: { subtypes: ["general"], note: "婚姻（講座 p62）" },
  travel: { subtypes: ["departure"], note: "自分が出る（movement は主体から外へ）" },
  traveler: { subtypes: ["return"], note: "外出中の人が帰る（movement は外から主体へ）。travel とは向きが逆" },
  lostItem: { subtypes: ["general"], note: "失物。盗難とは別" },
  theft: { subtypes: ["general"], note: "盗難。玄武があるだけで盗難にしない" },
  litigation: { subtypes: ["general"], note: "訴訟。日干＝原告と固定せず subjectAnchor で指定" },
  illness: { subtypes: ["general"], note: "病（講座 p61・p66 で評価が逆転する例あり）" },
  pregnancy: { subtypes: ["maintain"], note: "妊娠の維持。出産とは胎神の意味が逆転し得る" },
  childbirth: { subtypes: ["delivery"], note: "出産" },
  missingPerson: { subtypes: ["general"], note: "失踪・尋人" },
  weather: { subtypes: ["general"], note: "天候" },
};
const GOALS: Record<InterpretationGoal, string> = {
  acquire: "得たい", preserve: "保ちたい", maintain: "維持したい", release: "手放したい", separate: "離れたい",
  move: "移りたい", return: "戻したい・戻ってほしい", recover: "回復したい", control: "抑えたい", reconcile: "和解したい",
  discover: "見つけたい", avoid: "避けたい",
};
const ROLES: Record<SemanticRole, string> = {
  self: "主体", counterparty: "相手", target: "目的・対象", resource: "資源", authority: "官・上位者・官府", document: "文書・印綬",
  movement: "移動", origin: "出発点", destination: "行き先", environment: "環境・条件", obstacle: "妨げ", support: "支え",
  process: "経過", outcome: "結果",
};
const EVIDENCE: RoleEvidenceKind[] = ["boardPosition", "sixRelation", "marker", "heavenlyGeneral", "pattern", "context", "classicalRule"];

/** FACT → ROLE 候補（吉凶は付けない。status: 出典あり / 原典未確認の候補） */
type MapRow = { domain: InterpretationDomain; subtype?: string; fact: string; roles: SemanticRole[]; status: string };
const MAP: MapRow[] = [
  // 全般（講座 p57・p59・p61・p62・p65）
  { domain: "wealth", fact: "日干", roles: ["self"], status: "講座 p57・p62（日干＝自分・主体）" },
  { domain: "wealth", fact: "一課（干上）", roles: ["self"], status: "講座 p57・p62（一課＝自分の状態）" },
  { domain: "wealth", fact: "二課", roles: ["environment"], status: "講座 p62（自分をとりまく環境）" },
  { domain: "wealth", fact: "日支・三課", roles: ["target", "counterparty"], status: "講座 p61・p62（日支＝相手・目的・対象）" },
  { domain: "wealth", fact: "四課", roles: ["environment"], status: "講座 p62（相手にまつわる条件・環境）" },
  { domain: "wealth", fact: "三課・四課が初伝で妻財", roles: ["target", "resource"], status: "講座 p62（求財で財を得る）" },
  { domain: "wealth", fact: "初伝", roles: ["process"], status: "講座 p63〜65（発用）" },
  { domain: "wealth", fact: "末伝", roles: ["outcome"], status: "講座 p59（帰計門＝結果・応期）" },
  { domain: "wealth", fact: "日禄", roles: ["resource"], status: "候補（原典未確認）" },
  { domain: "house", subtype: "residence", fact: "日干・一課", roles: ["self"], status: "講座 p67（日干＝住む人）" },
  { domain: "house", subtype: "residence", fact: "日支・三課", roles: ["target"], status: "講座 p67（日支＝家）" },
  { domain: "house", subtype: "moving", fact: "一課（日上神）", roles: ["origin"], status: "講座 p67（転居では日上神＝旧宅）" },
  { domain: "house", subtype: "moving", fact: "三課（支上神）", roles: ["destination"], status: "講座 p67（転居では支上神＝新宅）" },
  { domain: "marriage", fact: "一課", roles: ["self"], status: "講座 p62（新郎）" },
  { domain: "marriage", fact: "三課", roles: ["counterparty"], status: "講座 p62（新婦）" },
  { domain: "marriage", fact: "二課・四課", roles: ["environment"], status: "講座 p62（それぞれの家族）" },
  { domain: "exam", fact: "官鬼で長生（学堂）", roles: ["authority", "document"], status: "断案2 例54（官星学堂、科甲）" },
  { domain: "work", fact: "官鬼", roles: ["authority"], status: "候補（原典未確認。subtype ごとに要確認）" },
  { domain: "work", fact: "末伝の妻財（前程占）", roles: ["counterparty"], status: "断案2 例46（末伝は妻爻＝妻）" },
  { domain: "illness", fact: "日干を剋す神", roles: ["obstacle"], status: "講座 p66（病占で日干を剋す神。空亡なら凶作用をなくす）" },
  { domain: "illness", fact: "日支・支上神", roles: ["target"], status: "講座 p61（病気占で日支が強められると病状悪化の可能性）" },
  { domain: "travel", fact: "驛馬・三伝", roles: ["movement"], status: "候補（原典未確認）" },
  { domain: "traveler", fact: "日支・三伝", roles: ["counterparty", "movement"], status: "候補（原典未確認。向きは travel と逆）" },
  { domain: "lostItem", fact: "類神（物）", roles: ["target"], status: "候補（原典未確認）" },
  { domain: "theft", fact: "玄武・盗神", roles: ["counterparty"], status: "候補（原典未確認。玄武だけで盗難にしない）" },
  { domain: "litigation", fact: "subjectAnchor・counterpartyAnchor", roles: ["self", "counterparty"], status: "候補（原典未確認。先訴・後訴は CONTEXT で指定）" },
  { domain: "litigation", fact: "官鬼", roles: ["authority", "obstacle"], status: "候補（原典未確認）" },
  { domain: "pregnancy", fact: "胎神", roles: ["target"], status: "候補（原典未確認。出産とは意味が逆転し得る）" },
  { domain: "childbirth", fact: "胎神", roles: ["target"], status: "候補（原典未確認）" },
];
check("FACT→ROLE 対応表の ROLE はすべて定義済み", MAP.every((r) => r.roles.every((x) => x in ROLES)));
check("work は subtype を7つに分ける", DOMAINS.work.subtypes.length === 7);
check("travel と traveler、lostItem と theft、pregnancy と childbirth は別の DOMAIN", ["travel", "traveler", "lostItem", "theft", "pregnancy", "childbirth"].every((d) => d in DOMAINS));

// ---- 3・4. 古典例で ROLE を手で割り当て、たどれるか確かめる ----
const factsOf = (day: string, jiang: Branch, shi: Branch): InterpretationFacts =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
const factsAt = (day: string, offset: number): InterpretationFacts =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[offset] }));
const pos = (position: ComparisonPosition): BoardAnchor => ({ kind: "position", position });
const lesson = (index: 1 | 2 | 3 | 4): BoardAnchor => ({ kind: "lesson", index });
const LESSON_POSITION: Partial<Record<number, ComparisonPosition>> = { 1: "standing" }; // 一課上神＝干上

type Example = { name: string; facts: InterpretationFacts; context: InterpretationContext; assignments: SemanticRoleAssignment[] };
const D34 = factsOf("丙午", "卯", "申");
const EXAMPLES: Example[] = [
  {
    name: "家宅（住む）丙午日 例34", facts: D34, context: { domain: "house", subtype: "residence" },
    assignments: [
      { role: "self", source: { kind: "dayStem" }, evidence: [{ kind: "classicalRule", detail: "日干＝住む人", citation: "講座 p67" }], confidence: "direct" },
      { role: "self", source: lesson(1), evidence: [{ kind: "boardPosition", detail: "一課＝住む人の表象", citation: "講座 p67" }], confidence: "direct" },
      { role: "target", source: { kind: "dayBranch" }, evidence: [{ kind: "classicalRule", detail: "日支＝家", citation: "講座 p67" }], confidence: "direct" },
      { role: "outcome", source: pos("final"), evidence: [{ kind: "boardPosition", detail: "末伝＝結果", citation: "講座 p59" }], confidence: "direct" },
    ],
  },
  {
    name: "家宅（転居）丙午日 例34 と同じ盤", facts: D34, context: { domain: "house", subtype: "moving" },
    assignments: [
      { role: "origin", source: lesson(1), evidence: [{ kind: "classicalRule", detail: "転居では日上神（一課）＝旧宅", citation: "講座 p67" }, { kind: "context", detail: "subtype=moving" }], confidence: "combined" },
      { role: "destination", source: lesson(3), evidence: [{ kind: "classicalRule", detail: "転居では支上神（三課）＝新宅", citation: "講座 p67" }, { kind: "context", detail: "subtype=moving" }], confidence: "combined" },
    ],
  },
  {
    name: "試験 庚辰日 例54", facts: factsOf("庚辰", "子", "子"), context: { domain: "exam", goal: "acquire" },
    assignments: [
      { role: "authority", source: pos("final"), evidence: [{ kind: "sixRelation", detail: "sixRelation=官鬼" }, { kind: "boardPosition", detail: "growthStage=長生（学堂）" }, { kind: "classicalRule", detail: "官星学堂、故に科甲", citation: "断案2 例54" }, { kind: "context", detail: "domain=exam" }], confidence: "combined" },
      { role: "document", source: pos("final"), evidence: [{ kind: "classicalRule", detail: "学堂（文）", citation: "断案2 例54" }], confidence: "inferred" },
      { role: "resource", source: pos("standing"), evidence: [{ kind: "marker", detail: "daySalary=true" }, { kind: "classicalRule", detail: "将仕の禄は虚禄（禄は空）", citation: "断案2 例54" }], confidence: "combined" },
    ],
  },
  {
    name: "前程 戊辰日 例46", facts: factsOf("戊辰", "未", "巳"), context: { domain: "work", subtype: "currentWork" },
    assignments: [
      { role: "counterparty", source: pos("final"), evidence: [{ kind: "sixRelation", detail: "sixRelation=妻財" }, { kind: "classicalRule", detail: "末伝は妻爻（妻）で空亡に坐す", citation: "断案2 例46" }], confidence: "combined" },
      { role: "outcome", source: pos("final"), evidence: [{ kind: "boardPosition", detail: "末伝＝結果", citation: "講座 p59" }], confidence: "direct" },
    ],
  },
  {
    name: "求財 乙卯日 天盤差11（初伝が妻財）", facts: factsAt("乙卯", 11), context: { domain: "wealth", goal: "acquire" },
    assignments: [
      { role: "target", source: pos("initial"), evidence: [{ kind: "sixRelation", detail: "sixRelation=妻財" }, { kind: "boardPosition", detail: "初伝（発用）" }, { kind: "context", detail: "domain=wealth" }], confidence: "combined" },
      { role: "resource", source: pos("initial"), evidence: [{ kind: "sixRelation", detail: "sixRelation=妻財" }], confidence: "direct" },
      { role: "outcome", source: pos("final"), evidence: [{ kind: "boardPosition", detail: "末伝＝結果", citation: "講座 p59" }], confidence: "direct" },
    ],
  },
];

const lines: string[] = [];
/** ROLE の source（position）から、Phase 3S の状態と Phase 3R の関係をたどる（参照するだけ） */
function trace(a: StandingPathActualization, src: BoardAnchor) {
  const position = src.kind === "position" ? src.position : src.kind === "lesson" ? LESSON_POSITION[src.index] : undefined;
  if (!position) return null;
  const state = a.states.find((s) => s.position === position)!;
  const relations = a.internalRelations.filter((r) => r.relation.fromPosition === position || r.relation.toPosition === position);
  return { position, state, relations };
}
for (const ex of EXAMPLES) {
  const a = standingPathActualizationOf(ex.facts)!;
  const before = JSON.stringify(a) + JSON.stringify(ex.facts);
  lines.push(`${ex.name}（domain=${ex.context.domain}${ex.context.subtype ? `/${ex.context.subtype}` : ""}${ex.context.goal ? ` goal=${ex.context.goal}` : ""}）`);
  for (const r of ex.assignments) {
    const t = trace(a, r.source);
    const src = r.source.kind === "position" ? r.source.position : r.source.kind === "lesson" ? `${r.source.index}課` : r.source.kind;
    const ev = r.evidence.map((e) => `${e.kind}:${e.detail}${e.citation ? `〔${e.citation}〕` : ""}`).join(" ／ ");
    if (t) {
      check(`${ex.name} ${r.role} の制約は Phase 3S の同じオブジェクト`, t.state.constraints === a.states.find((s) => s.position === t.position)!.constraints);
      check(`${ex.name} ${r.role} の関係は Phase 3R の同じオブジェクト`, t.relations.every((x) => a.internalRelations.includes(x)) && t.relations.length === 3);
      lines.push(`    ${r.role}（${r.confidence}） ← ${src} ${t.state.branch}: ${t.state.sixRelation}・${t.state.growthStage} 制約[${t.state.constraints.join("+")}] 関係${t.relations.length}組 | 根拠 ${ev}`);
    } else {
      lines.push(`    ${r.role}（${r.confidence}） ← ${src}（盤の位置で追う対象ではない） | 根拠 ${ev}`);
    }
  }
  check(`${ex.name} ROLE を付けても FACT は変わらない`, JSON.stringify(a) + JSON.stringify(ex.facts) === before);
}
// 同じ位置（一課）が CONTEXT で別の ROLE になる
{
  const res = EXAMPLES[0].assignments.filter((r) => r.source.kind === "lesson" && r.source.index === 1).map((r) => r.role);
  const mov = EXAMPLES[1].assignments.filter((r) => r.source.kind === "lesson" && r.source.index === 1).map((r) => r.role);
  check("一課は住む（self）と転居（origin）で別の ROLE（講座 p67）", res.join() === "self" && mov.join() === "origin");
  const finalRoles = EXAMPLES[2].assignments.filter((r) => r.source.kind === "position" && r.source.position === "final").map((r) => r.role);
  check("1地点に複数の ROLE（例54 末伝巳＝authority・document）", finalRoles.length === 2);
}
// 同じ六親が DOMAIN で別の ROLE になる（妻財: 求財＝target・resource／前程＝counterparty）
{
  const wealth = EXAMPLES[4].assignments.filter((r) => r.source.kind === "position" && r.source.position === "initial").map((r) => r.role);
  const work = EXAMPLES[3].assignments.filter((r) => r.role === "counterparty");
  check("妻財は求財で target・resource、前程の例46 では counterparty（固定の変換ではない）", wealth.join() === "target,resource" && work.length === 1);
}

console.log(`DOMAIN（${Object.keys(DOMAINS).length}）:`);
for (const [d, v] of Object.entries(DOMAINS)) console.log(`  ${d}: subtype ${v.subtypes.join("・")} ／ ${v.note}`);
console.log(`goal（${Object.keys(GOALS).length}）: ${Object.entries(GOALS).map(([k, v]) => `${k}=${v}`).join(" ")}`);
console.log(`SemanticRole（${Object.keys(ROLES).length}）: ${Object.entries(ROLES).map(([k, v]) => `${k}=${v}`).join(" ")}`);
console.log(`RoleEvidenceKind: ${EVIDENCE.join(" / ")}`);
console.log("FACT → ROLE 候補:");
for (const r of MAP) console.log(`  ${r.domain}${r.subtype ? `/${r.subtype}` : ""}: ${r.fact} → ${r.roles.join("・")} 〔${r.status}〕`);
console.log("古典例の手動割り当てと追跡:");
for (const l of lines) console.log(`  ${l}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
