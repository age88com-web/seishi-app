// tests/liuren_interpretation_domain_synthesis.manual.ts
//
// 六壬神課 Phase 5R（総合解釈の基盤 domainSynthesis.ts）のテスト。
// 実行: npx tsx tests/liuren_interpretation_domain_synthesis.manual.ts
//
//   A. 人工のケース（DomainResult を手で組み立てる。古典の占験の検証ではない）: 関係の判定・根拠 FACT の同一性の規則そのものを確かめる
//   B. 実際の起課結果のケース（エンジンの盤と既存の DOMAIN の結果。古典の占験の再現ではなく、構造の検証）
//   C. 既存機能の保護: 規則を判定し直さない・DomainResult を書き換えない・評価関数の出力そのまま・点数や結論を持たない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { summarizeDomainReadings } from "../src/lib/liuren/interpretation/domainResult";
import type { DomainAxis, DomainCitation, DomainDirection, DomainReading } from "../src/lib/liuren/interpretation/domainResult";
import { DOMAIN_EVALUATORS, evaluateLiurenDomain, evidenceIdentityOf, synthesizeDomainResult, synthesizeLiurenInterpretation } from "../src/lib/liuren/interpretation/domainSynthesis";
import type { DomainSynthesis, SynthesisRelationKind } from "../src/lib/liuren/interpretation/domainSynthesis";
import type { InterpretationContext } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const factsOf = (day: string, jiang: string) =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: "子", monthGeneral: jiang as Branch }));
const rel = (s: DomainSynthesis, kind: SynthesisRelationKind, a: string, b: string) =>
  s.relations[kind].find((r) => [s.readings[r.a].ruleId, s.readings[r.b].ruleId].sort().join() === [a, b].sort().join()) ?? null;
const kindOf = (s: DomainSynthesis, a: string, b: string) =>
  (["reinforcing", "coexisting", "conflicting", "conditional", "undetermined"] as const).find((k) => rel(s, k, a, b)) ?? null;

// ---- A. 人工のケース（DomainResult を手で組み立てる。古典の占験の検証ではない） ----
const XJ: DomainCitation = { source: "『六壬心鏡』", locator: "人工", layer: "原文", quote: "（人工のテスト用）" };
const ZN: DomainCitation = { source: "『大六壬指南』", locator: "人工", layer: "原文", quote: "（人工のテスト用）" };
function R(id: string, axis: DomainAxis, topic: string | undefined, direction: DomainDirection, evidence: [string, string][], citations: DomainCitation[] = [XJ], key = id): DomainReading {
  return { ruleId: id, axis, key, label: id, ...(topic ? { topic } : {}), detected: `${id} を検出（人工）`, evidence: evidence.map(([fact, detail]) => ({ fact, detail })), direction, level: "direct", citations };
}
const art = (rs: DomainReading[], missing: { key: string; detail: string }[] = []) => synthesizeDomainResult(summarizeDomainReadings("wealth", "seekingWealth", "acquire", rs, missing, "人工"));
const ev = (fact: string, detail: string) => ({ fact, detail });
{
  // 1. 支援と障害が同時に成立（同じ論点・別の軸）
  const s = art([R("sup", "support", "t", "favoring", [["a", "1"]]), R("obs", "obstruction", "t", "hindering", [["b", "1"]])]);
  check("人工1: 支援（support）と障害（obstruction）が同じ論点で同時に成立 → coexisting（両方残す。対立にしない）", kindOf(s, "sup", "obs") === "coexisting" && s.readings.length === 2);
  // 2. 機会と実現性の障害: 同じ論点にあるだけでは条件関係と断定しない（候補）
  const s2 = art([R("opp", "opportunity", "t", "favoring", [["a", "1"]]), R("act", "actualization", "t", "hindering", [["v", "空"]])]);
  const c2 = rel(s2, "coexisting", "opp", "act");
  check("人工2: 同じ論点の機会と実現性 → conditional にせず coexisting＋conditionCandidate。realization も conditionConfirmed=false",
    c2?.conditionCandidate === true && s2.relations.conditional.length === 0 && s2.realization.length === 1 && s2.realization[0].conditionConfirmed === false);
  // 3. 補強: 判断内容が同じ（key が同じ）と確かめられるときだけ
  const s3 = art([R("x", "support", "t", "favoring", [["a", "1"]], [XJ], "sameReading"), R("y", "opportunity", "t", "favoring", [["b", "2"]], [ZN], "sameReading")]);
  const c3 = rel(s3, "reinforcing", "x", "y");
  check("人工3: 同じ読み（key が同じ）を別の規則・別の根拠が同じ向きで示す → reinforcing（basis readingKey）", c3?.basis === "readingKey" && c3.targetAlignment === "sameTopic");
  const s3b = art([R("x", "support", "t", "favoring", [["a", "1"]]), R("y", "opportunity", "t", "favoring", [["b", "2"]])]);
  const c3b = rel(s3b, "coexisting", "x", "y");
  check("人工3b: 同じ論点・同じ向きでも判断内容（key）が違えば補強と断定しない → coexisting＋sameDirectionOnTopic", c3b?.sameDirectionOnTopic === true && s3b.relations.reinforcing.length === 0);
  // 4. 根拠 FACT の同一性
  check("人工4a: 位置を名前で指す FACT（initial｜寅）が同じ → sameReference", evidenceIdentityOf(ev("initial", "寅"), ev("initial", "寅")) === "sameReference");
  check("人工4b: 名前と detail が同じでも位置・対象を特定しない FACT（sixRelation｜子孫）→ possiblySame（同一と断定しない）",
    evidenceIdentityOf(ev("sixRelation", "子孫"), ev("sixRelation", "子孫")) === "possiblySame");
  check("人工4c: 名前が違うだけでは独立と断定しない（同じ位置の別の属性・位置を持たない名前 → unknown）",
    evidenceIdentityOf(ev("initial", "寅"), ev("initial.growthStage", "絶")) === "unknown" && evidenceIdentityOf(ev("sixRelation", "子孫"), ev("tiger", "申")) === "unknown"
    && evidenceIdentityOf(ev("dayXunVoid", "初伝 亥"), ev("initial.isVoid", "旬空")) === "unknown");
  check("人工4d: 位置が違う FACT（干上と支上）→ distinctPosition（同じ支でも別の FACT）", evidenceIdentityOf(ev("lesson1.upper", "子"), ev("lesson3.upper", "子")) === "distinctPosition"
    && evidenceIdentityOf(ev("standing", "墓"), ev("lesson1.upper", "未")) === "unknown");
  const s4 = art([R("x", "support", "t", "favoring", [["initial", "寅"]]), R("y", "support", "t", "favoring", [["initial", "寅"], ["sixRelation", "子孫"]]), R("z", "support", "t", "favoring", [["sixRelation", "子孫"]])]);
  const cl = s4.evidenceClusters.find((c) => c.topic === "t" && c.direction === "favoring")!;
  check("人工4e: 同じ FACT への参照だけで群をつくり（x・y）、同一の可能性（y・z）は別に記録。群が独立とは言わない",
    cl.groups.length === 2 && cl.groups.some((g) => g.join() === "0,1") && cl.possiblyLinked.length === 1 && cl.possiblyLinked[0].join() === "1,2" && cl.groupsDistinctByPosition === false
    && rel(s4, "coexisting", "x", "y")?.evidenceSharing === "sameReference" && rel(s4, "coexisting", "y", "z")?.evidenceSharing === "possiblySame");
  // 5. 向きが逆でも論点が違えば対立しない
  const s5 = art([R("x", "opportunity", "t1", "favoring", [["a", "1"]]), R("y", "opportunity", "t2", "hindering", [["b", "1"]])]);
  check("人工5: 向きが逆でも論点（topic）が違う → coexisting（targetAlignment differentTopic）", rel(s5, "coexisting", "x", "y")?.targetAlignment === "differentTopic" && s5.relations.conflicting.length === 0);
  // 6. 同じ論点・同じ軸で逆の判断
  const s6 = art([R("x", "actualization", "t", "favoring", [["a", "1"]]), R("y", "actualization", "t", "hindering", [["b", "1"]])]);
  check("人工6: 同じ論点・同じ軸で向きが逆（同じ書）→ conflicting（disjointSources=false）。両方残す", rel(s6, "conflicting", "x", "y")?.disjointSources === false && s6.readings.length === 2);
  // 7. 判断不能
  const s7 = art([R("x", "support", undefined, "favoring", [["a", "1"]]), R("y", "obstruction", "t", "hindering", [["b", "1"]]), R("z", "support", "t", "neutral", [["c", "1"]])],
    [{ key: "subjectSide", detail: "男女の側がない" }]);
  check("人工7: topic のない読み・同じ論点の向きなしの読みとの組 → undetermined。不足はそのまま持つ",
    rel(s7, "undetermined", "x", "y")?.basis === "notDeterminable" && rel(s7, "undetermined", "y", "z")?.targetAlignment === "sameTopic"
    && s7.missing.readingsWithoutTopic.join() === "0" && s7.missing.domain.some((m) => m.key === "subjectSide"));
  // 8. 任意 FACT（行年）がない
  const s8 = art([], [{ key: "xingNian", detail: "行年の入力がない" }]);
  check("人工8: 行年がない → 不足（xingNian）を写すだけで、読み・関係を作らない", s8.status === "noReadings" && s8.missing.domain[0].key === "xingNian" && Object.values(s8.relations).every((x) => x.length === 0));
  // 9. 古典の異なる見解
  const s9 = art([R("x", "actualization", "t", "favoring", [["a", "1"]], [XJ]), R("y", "actualization", "t", "hindering", [["b", "1"]], [ZN])]);
  check("人工9: 同じ論点・同じ軸で出典の書が重ならない逆の判断 → conflicting（disjointSources=true）。どちらも消さない", rel(s9, "conflicting", "x", "y")?.disjointSources === true && s9.readings.length === 2);
  const s9b = art([R("x", "actualization", "t", "favoring", [["a", "1"]], [XJ, ZN]), R("y", "actualization", "t", "hindering", [["b", "1"]], [ZN])]);
  check("人工9b: 出典の書が一つでも重なれば disjointSources=false", rel(s9b, "conflicting", "x", "y")?.disjointSources === false);
  // 10. 結果が一件もない
  const s10 = art([]);
  check("人工10: 読みが一件もない → status noReadings・関係・群・推移はすべて空", s10.status === "noReadings" && s10.readings.length === 0
    && Object.values(s10.relations).every((x) => x.length === 0) && s10.evidenceClusters.length === 0 && s10.trajectory.readings.length === 0);
  check("人工: 読みの人物の対応は記録されていない（notRecordedInReadings）", s10.participantAlignment === "notRecordedInReadings");
}

// ---- B. 実際の起課結果のケース（構造の検証。古典の占験の再現ではない） ----
const lines: string[] = [];
{
  const run = (day: string, jiang: string, mb: string, ctx: Partial<InterpretationContext>) => {
    const f = factsOf(day, jiang), context = ctx as InterpretationContext;
    const { result, synthesis } = synthesizeLiurenInterpretation(f, context, mb as Branch);
    return { f, result: result!, s: synthesis! };
  };
  // 1・4. 疾病（甲子日 子将 子時 月支子）
  const ill = run("甲子", "子", "子", { domain: "illness" });
  check("実盤1 疾病 甲子日子将: 救い（子孫）と障害（鬼）が同じ論点 rescue で両方成立 → coexisting。overview の追い風・妨げも両方ある",
    kindOf(ill.s, "illness.childrenPresent", "illness.ghostInTransmissions") === "coexisting" && ill.result.overview.contradiction);
  const r4 = rel(ill.s, "coexisting", "illness.childrenPresent", "illness.childrenControlTiger");
  const cl4 = ill.s.evidenceClusters.find((c) => c.topic === "rescue" && c.direction === "favoring")!;
  check("実盤4 疾病 甲子日子将: 子孫の2規則は同じ論点・同じ向きだが読みが違う → 補強と断定しない（sameDirectionOnTopic）。sixRelation｜子孫 は位置を特定しないので possiblySame",
    r4?.sameDirectionOnTopic === true && r4.evidenceSharing === "possiblySame" && cl4.possiblyLinked.length === 1 && !cl4.groupsDistinctByPosition);
  lines.push(`疾病 甲子日子将 子時 月支子｜rescue: 子孫2規則は sameDirectionOnTopic・根拠 ${r4?.evidenceSharing}（sixRelation｜子孫）。鬼（妨げ）と併存`);
  // 2. 盗難（甲子日 卯将 月支卯）: 機会と実現性は条件関係の候補
  const lost = run("甲子", "卯", "卯", { domain: "lostItem", subtype: "theft", goal: "recover" });
  const v = lost.s.realization.find((x) => x.opportunity.some((i) => lost.s.readings[i].direction === "favoring") && x.actualization.some((i) => lost.s.readings[i].direction === "hindering"));
  check("実盤2 盗難 甲子日卯将: 機会（favoring）と実現性の妨げ（hindering）が同じ論点 → 条件関係の候補（conditionCandidate）で、conditional にしない",
    !!v && v.conditionConfirmed === false && lost.s.relations.conditional.length === 0
    && lost.s.relations.coexisting.some((r) => r.conditionCandidate === true && [r.a, r.b].some((i) => v!.opportunity.includes(i)) && [r.a, r.b].some((i) => v!.actualization.includes(i) && lost.s.readings[i].direction === "hindering")));
  lines.push(`盗難 甲子日卯将 子時 月支卯｜${v ? `${v.topic}: 機会 ${v.opportunity.map((i) => lost.s.readings[i].ruleId).join("・")} ／ 実現性 ${v.actualization.map((i) => `${lost.s.readings[i].ruleId}(${lost.s.readings[i].direction})`).join("・")}（条件関係は未確定）` : "-"}`);
  // 3・5・6. 行人（甲子日 子将 月支子）
  const tr = run("甲子", "子", "子", { domain: "traveler", subtype: "return", goal: "return" });
  check("実盤3 行人 甲子日子将: 別の規則が帰る（return）を同じ向きで示しても、読みが違うので補強と断定しない（sameDirectionOnTopic）",
    rel(tr.s, "coexisting", "traveler.initialBeforeBranch", "traveler.divinationOnStemSite")?.sameDirectionOnTopic === true && tr.s.relations.reinforcing.length === 0);
  check("実盤5 行人 甲子日子将: 末伝が初伝を剋す（return・妨げ）と天罡の段階（movement・追い風）は論点が違う → coexisting",
    rel(tr.s, "coexisting", "traveler.finalOvercomesInitial", "traveler.tianGangStage")?.targetAlignment === "differentTopic");
  check("実盤6 行人 甲子日子将: 同じ論点 return・同じ軸 trajectory で向きが逆（『指南』を共有）→ conflicting（disjointSources=false）",
    rel(tr.s, "conflicting", "traveler.initialBeforeBranch", "traveler.finalOvercomesInitial")?.disjointSources === false);
  check("実盤 行人: 三伝 FLOW の既存の値（movementPattern）を trajectory に添えるだけ", tr.s.trajectory.flow?.movementPattern === "その他" && tr.s.trajectory.readings.length > 0);
  // FACT の同一性（実盤）
  const tr2 = run("丙寅", "子", "寅", { domain: "traveler", subtype: "return", goal: "return" });
  const sr = rel(tr2.s, "coexisting", "traveler.stemToSite", "traveler.finalAtDayBranch");
  check("実盤 行人 丙寅日子将: 2規則が final｜寅（末伝）を参照 → sameReference", sr?.evidenceSharing === "sameReference" && sr.evidencePairs.some((p) => p.identity === "sameReference" && p.a === "final｜寅"));
  const tr3 = run("甲子", "卯", "卯", { domain: "traveler", subtype: "return", goal: "return" });
  check("実盤 行人 甲子日卯将: 中伝の旬空と末伝の坐空は位置が違う → distinctPositions",
    rel(tr3.s, "coexisting", "traveler.middleVoid", "traveler.finalSeatedOnVoid")?.evidenceSharing === "distinctPositions");
  // 7. ROLE の不足: 婚姻（男女の側なし）・仕事（読みに topic がない）
  const mar = run("甲子", "子", "子", { domain: "marriage", subtype: "proposal", goal: "acquire" });
  check("実盤7 婚姻: 男女の側（subjectSide）・本命がない不足を DomainResult からそのまま持つ", mar.s.missing.domain.some((m) => m.key === "subjectSide") && mar.s.missing.domain.some((m) => m.key === "natalYear"));
  let workNoTopic = false;
  for (const j of BRANCHES) {
    const w = run("甲子", j, "子", { domain: "work", goal: "acquire" });
    if (w.s.readings.length >= 2) { workNoTopic = w.s.readings.every((r) => r.topic === null) && w.s.relations.undetermined.length === w.s.readings.length * (w.s.readings.length - 1) / 2; break; }
  }
  check("実盤7 仕事: 既存の規則に topic がないので、読みどうしの関係はすべて undetermined（推測で論点を決めない）", workNoTopic);
  // 8. 行年がない
  check("実盤8 行人: 行年の入力がない不足を写すだけで、行年の読みを作らない",
    tr.s.missing.domain.some((m) => m.key === "xingNian" || m.key === "xingNianUnresolved") && !tr.s.readings.some((r) => r.evidenceKeys.some((k) => k.startsWith("xingNian"))));
  // 9. 古典の異なる見解: 勾陳と盗神（『心鏡』）／勾陳と玄武（『直指』）
  const g = run("甲子", "戌", "戌", { domain: "lostItem", subtype: "theft", goal: "recover" });
  const r9 = rel(g.s, "conflicting", "lostItem.gouVsThiefGod", "lostItem.gouVsXuanwu");
  check("実盤9 盗難 甲子日戌将: 『心鏡』（勾陳と盗神）と『直指』（勾陳と玄武）が capture で逆 → conflicting（disjointSources=true）。両方残す",
    r9?.disjointSources === true && g.result.readings.some((r) => r.ruleId === "lostItem.gouVsThiefGod") && g.result.readings.some((r) => r.ruleId === "lostItem.gouVsXuanwu"));
  lines.push(`盗難 甲子日戌将 子時 月支戌｜capture: ${g.s.readings[r9!.a].ruleId}(${g.s.readings[r9!.a].direction}) と ${g.s.readings[r9!.b].ruleId}(${g.s.readings[r9!.b].direction}) は出典の書が重ならない`);
  // 10. 結果が一件もない
  const none = run("甲子", "丑", "丑", { domain: "work", goal: "acquire" });
  check("実盤10 仕事 甲子日丑将: 読みが0件 → noReadings。不足はそのまま", none.s.status === "noReadings" && none.result.readings.length === 0 && none.s.missing.domain.length > 0);
  const w = synthesizeLiurenInterpretation(factsOf("甲子", "子"), { domain: "weather" } as InterpretationContext);
  check("実盤10: 評価関数のない DOMAIN（天候）は result・synthesis とも null（推測で読みを作らない）", w.result === null && w.synthesis === null);
  const p = run("甲子", "子", "子", { domain: "illness", persons: [{ id: "A" }], subjectPersonId: "A", patientPersonId: "A" });
  check("人物の対応: CONTEXT の人物 ID を写すだけ（読みごとの対応は記録されていない）", p.s.participants.subjectPersonId === "A" && p.s.participants.patientPersonId === "A"
    && Object.keys(p.s.participants).length === 2 && p.s.participantAlignment === "notRecordedInReadings");
}

// ---- C. 既存機能の保護（720課・全10 DOMAIN） ----
{
  const subs: [string, string | undefined, string | undefined][] = [["work", undefined, "acquire"], ["exam", "civil", undefined], ["house", "residence", "maintain"], ["traveler", "return", "return"], ["travel", "departure", "move"],
    ["marriage", "proposal", "acquire"], ["illness", undefined, undefined], ["wealth", "seekingWealth", "acquire"], ["litigation", "litigation", undefined], ["lostItem", "theft", "recover"], ["pregnancy", "maintain", "maintain"], ["childbirth", "delivery", undefined]];
  let sameAsEvaluator = true, unchanged = true, refsExact = true, partition = true, deterministic = true, conflictOk = true, coexistOk = true, reinforceOk = true, noConditional = true, n = 0;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o += 2) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o]), mb = BRANCHES[(i + o) % 12] as Branch;
    for (const [domain, subtype, goal] of subs) {
      const ctx = { domain, subtype, goal } as InterpretationContext;
      const direct = DOMAIN_EVALUATORS[ctx.domain]!(f, ctx, mb), r = evaluateLiurenDomain(f, ctx, mb)!;
      if (JSON.stringify(direct) !== JSON.stringify(r)) sameAsEvaluator = false;
      const before = JSON.stringify(r), s = synthesizeDomainResult(r, { facts: f, context: ctx });
      if (JSON.stringify(r) !== before) unchanged = false;
      if (JSON.stringify(synthesizeDomainResult(r, { facts: f, context: ctx })) !== JSON.stringify(s)) deterministic = false;
      if (s.readings.some((x, k) => x.reading !== r.readings[k] || x.direction !== r.readings[k].direction || x.axis !== r.readings[k].axis || x.ruleId !== r.readings[k].ruleId)) refsExact = false;
      const m = s.readings.length, total = Object.values(s.relations).reduce((a, x) => a + x.length, 0);
      if (total !== m * (m - 1) / 2) partition = false;
      for (const c of s.relations.conflicting) { const a = s.readings[c.a], b = s.readings[c.b]; if (a.topic === null || a.topic !== b.topic || a.axis !== b.axis || a.direction === b.direction || a.direction === "neutral" || b.direction === "neutral") conflictOk = false; }
      for (const c of s.relations.coexisting) { const a = s.readings[c.a], b = s.readings[c.b]; if (a.topic === b.topic && a.axis === b.axis && a.direction !== b.direction && a.direction !== "neutral" && b.direction !== "neutral") coexistOk = false; }
      for (const c of s.relations.reinforcing) { const a = s.readings[c.a], b = s.readings[c.b]; if (a.key !== b.key || a.topic === null || a.topic !== b.topic || a.direction !== b.direction || c.basis !== "readingKey") reinforceOk = false; }
      if (s.relations.conditional.length || s.realization.some((x) => x.conditionConfirmed)) noConditional = false;
      n += 1;
    }
  }
  check("入口 evaluateLiurenDomain は既存の評価関数の出力そのまま（12 DOMAIN 名・全10 評価関数）", sameAsEvaluator, `${n}`);
  check("総合は DomainResult を書き換えない・同じ入力で同じ結果", unchanged && deterministic);
  check("読みは DomainResult の読みをそのまま参照（軸・向き・ruleId を変えない。規則を判定し直さない）", refsExact);
  check("読みの組はすべて、5種の関係のどれか1つに入る", partition);
  check("conflicting は同じ topic・同じ軸・逆の向き（neutral を除く）だけ", conflictOk);
  check("同じ topic・同じ軸で向きが逆の組を coexisting にしない", coexistOk);
  check("reinforcing は判断内容が同じ（key が同じ）・同じ topic・同じ向きの組だけ", reinforceOk);
  check("確定した条件付き関係（conditional）は出さない（既存の型に条件を明示する項目がない）", noConditional);
  const code = readFileSync("src/lib/liuren/interpretation/domainSynthesis.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  check("総合は点数・吉凶の結論を持たず、起課を呼ばず、DOMAIN の文（summary・detected）を作り替えない",
    !/score|吉凶|calculateLiuren|summary:|detected:/.test(code));
  const dir = "src/lib/liuren/interpretation";
  const users = ["careerDomain", "houseDomain", "illnessDomain", "litigationDomain", "lostItemDomain", "marriageDomain", "pregnancyDomain", "travelDomain", "travelerDomain", "wealthDomain", "domainResult"]
    .filter((x) => /domainSynthesis/.test(readFileSync(`${dir}/${x}.ts`, "utf8")));
  check("既存の DOMAIN・domainResult は総合層を参照しない（依存は総合 → DOMAIN の一方向）", users.length === 0, users.join(","));
}

console.log("実盤のケース（構造の検証。古典の占験の再現ではない）:");
for (const l of lines) console.log(`  ${l}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
