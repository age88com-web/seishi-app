// tests/liuren_interpretation_synthesis_narrative.manual.ts
//
// 六壬神課 Phase 5S（総合解釈の文章化 synthesisNarrative.ts）のテスト。
// 実行: npx tsx tests/liuren_interpretation_synthesis_narrative.manual.ts
//
//   A. 人工のケース（DomainResult を手で組み立てる。古典の占験の検証ではない）
//   B. 実際の起課結果のケース（エンジンの盤と既存の DOMAIN の結果。古典の占験の再現ではなく、文章化の構造の検証）
//   C. 既存機能の保護（720課・全10 DOMAIN）: 読みを落とさない・文を言い換えない・入力を書き換えない・点数や結論の語を作らない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { summarizeDomainReadings } from "../src/lib/liuren/interpretation/domainResult";
import type { DomainAxis, DomainCitation, DomainDirection, DomainReading, DomainResult } from "../src/lib/liuren/interpretation/domainResult";
import { synthesizeDomainResult, synthesizeLiurenInterpretation } from "../src/lib/liuren/interpretation/domainSynthesis";
import { narrateDomainSynthesis, narrativeLines } from "../src/lib/liuren/interpretation/synthesisNarrative";
import type { NarrativeParagraph, SynthesisNarrative } from "../src/lib/liuren/interpretation/synthesisNarrative";
import type { InterpretationContext } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const factsOf = (day: string, jiang: string) =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: "子", monthGeneral: jiang as Branch }));
const all = (n: SynthesisNarrative): NarrativeParagraph[] => n.sections.flatMap((s) => [...s.paragraphs, ...(s.subsections ?? []).flatMap((x) => x.paragraphs)]);
const kinds = (n: SynthesisNarrative, kind: string) => all(n).filter((p) => p.kind === kind);
const section = (n: SynthesisNarrative, id: string) => n.sections.find((s) => s.id === id) ?? null;

// ---- A. 人工のケース ----
const XJ: DomainCitation = { source: "『六壬心鏡』", locator: "人工", layer: "原文", quote: "（人工のテスト用）" };
const ZN: DomainCitation = { source: "『大六壬指南』", locator: "人工", layer: "原文", quote: "（人工のテスト用）" };
function R(id: string, axis: DomainAxis, topic: string | undefined, direction: DomainDirection, evidence: [string, string][], citations: DomainCitation[] = [XJ], detected = `${id} を検出（人工）`): DomainReading {
  return { ruleId: id, axis, key: id, label: `${id} の読み`, ...(topic ? { topic } : {}), detected, evidence: evidence.map(([fact, detail]) => ({ fact, detail })), direction, level: "direct", citations };
}
const art = (rs: DomainReading[], missing: { key: string; detail: string }[] = []) => {
  const result = summarizeDomainReadings("wealth", "seekingWealth", "acquire", rs, missing, "人工");
  return { result, n: narrateDomainSynthesis(result, synthesizeDomainResult(result)) };
};
{
  // 1. 追い風と妨げ
  const a1 = art([R("sup", "support", "t", "favoring", [["a", "1"]]), R("obs", "obstruction", "t", "hindering", [["b", "1"]])]);
  const p1 = kinds(a1.n, "relation.favoringAndHindering");
  check("人工1: 追い風と妨げ → 両方を名指しし「相殺しない」と書く。全体像に追い風・妨げの段落が両方ある",
    p1.length === 1 && p1[0].ruleIds.join() === "sup,obs" && p1[0].text.includes("相殺しない") && kinds(a1.n, "overview.favoring").length === 1 && kinds(a1.n, "overview.hindering").length === 1);
  // 2. 機会と実現性
  const a2 = art([R("opp", "opportunity", "t", "favoring", [["a", "1"]]), R("act", "actualization", "t", "hindering", [["v", "空"]])]);
  const p2 = kinds(a2.n, "relation.conditionCandidate");
  check("人工2: 機会と実現性 → 条件関係の候補として書き「確定していない」と明記（確定した条件の文は作らない）",
    p2.length === 1 && p2[0].text.includes("確定していない") && p2[0].certainty === "structure" && !all(a2.n).some((p) => p.kind === "relation.conditional"));
  check("人工2: 機会・実現性の読みは判断軸ごとの説明に別々に出る", section(a2.n, "axes")!.subsections!.map((x) => x.axis).join() === "opportunity,actualization");
  // 3. 異なる古典の対立
  const a3 = art([R("x", "actualization", "t", "favoring", [["a", "1"]], [XJ]), R("y", "actualization", "t", "hindering", [["b", "1"]], [ZN])]);
  const p3 = kinds(a3.n, "relation.conflictDisjointSources");
  check("人工3: 出典の書が重ならない対立 → 両方の書名と向きを書き、どちらが正しいかは決めない",
    p3.length === 1 && p3[0].text.includes("『六壬心鏡』の規則") && p3[0].text.includes("『大六壬指南』の規則") && p3[0].text.includes("決めていない"));
  const a3b = art([R("x", "actualization", "t", "favoring", [["a", "1"]], [XJ, ZN]), R("y", "actualization", "t", "hindering", [["b", "1"]], [ZN])]);
  check("人工3b: 出典の書が重なる対立では「〜の規則は」という書き分けをしない", kinds(a3b.n, "relation.conflict").length === 1 && !kinds(a3b.n, "relation.conflict")[0].text.includes("の規則「"));
  // 4・5. 根拠の同一性
  const a4 = art([R("x", "support", "t", "favoring", [["final", "寅"]]), R("y", "support", "t", "favoring", [["final", "寅"], ["sixRelation", "子孫"]]), R("z", "support", "t", "favoring", [["sixRelation", "子孫"]])]);
  const same = kinds(a4.n, "relation.sameFact"), poss = kinds(a4.n, "relation.possiblySameFact");
  check("人工4: 位置を名前で指す同じ FACT（final｜寅）→「同じ FACT を参照」「独立した根拠としては数えない」（confirmed）",
    same.length === 1 && same[0].evidenceKeys.join() === "final｜寅" && same[0].text.includes("数えない") && same[0].certainty === "confirmed");
  check("人工5: 位置・対象を特定しない同じ文字列（sixRelation｜子孫）→「同じ FACT かどうかは確かめられない」（notDeterminable）",
    poss.length === 1 && poss[0].text.includes("確かめられない") && poss[0].certainty === "notDeterminable");
  const a5 = art([R("x", "support", "t", "favoring", [["a", "1"]]), R("y", "opportunity", "t", "favoring", [["b", "2"]])]);
  const p5 = kinds(a5.n, "relation.sameDirectionOnTopic");
  check("人工5b: 同じ論点・同じ向きの別の読み → 補強とせず、根拠の同一性は「判断できない」と書く。根拠の数を強さにしない",
    p5.length === 1 && p5[0].text.includes("補強とはしていない") && p5[0].text.includes("判断できない") && !/件の根拠|強い|弱い/.test(p5[0].text));
  // 6. topic なし
  const a6 = art([R("x", "support", undefined, "favoring", [["a", "1"]]), R("y", "obstruction", undefined, "hindering", [["b", "1"]])]);
  check("人工6: topic のない読み → 関係を決めない段落（notDeterminable）。論点の一覧は出さない", kinds(a6.n, "relation.undeterminedNoTopic").length === 1 && kinds(a6.n, "question.topics").length === 0);
  // 7・8. 不足
  const a7 = art([R("x", "support", "t", "favoring", [["a", "1"]])], [{ key: "subjectSide", detail: "男女の側が指定されていない" }, { key: "xingNian", detail: "行年の入力がない" }]);
  const lim = section(a7.n, "limits")!.paragraphs;
  check("人工7・8: 不足（ROLE・行年）は DomainResult.missing の detail をそのまま書き、key を持つ（新しい入力を求めない）",
    lim.map((p) => p.text).join("｜") === "男女の側が指定されていない｜行年の入力がない" && lim.map((p) => p.missingKeys[0]).join() === "subjectSide,xingNian");
  // 9. 0件
  const a9 = art([]);
  check("人工9: 読みが0件 → 全体像に「成立した読みはありません」だけ。判断軸・関係・原典の節は作らない（空の文で埋めない）",
    kinds(a9.n, "overview.none").length === 1 && !section(a9.n, "axes") && !section(a9.n, "relations") && !section(a9.n, "sources") && !section(a9.n, "limits"));
  // 10. 判断軸が1つ
  const a10 = art([R("x", "trajectory", "t", "neutral", [["a", "1"]])]);
  check("人工10: 判断軸が1つ → 判断軸の小見出しは1つ。関係の節は作らない", section(a10.n, "axes")!.subsections!.length === 1 && !section(a10.n, "relations"));
  // 12. 同じ文章
  const a12 = art([R("p", "trajectory", "house", "favoring", [["r", "1"]], [XJ], "同じ検出文"), R("q", "trajectory", "person", "hindering", [["s", "2"]], [ZN], "同じ検出文")]);
  const p12 = kinds(a12.n, "axis.readingShared");
  check("人工12: 同じ detected の2規則 → 検出文は1回だけ、読み・論点・向き・規則 ID は両方残す",
    p12.length === 1 && p12[0].ruleIds.join() === "p,q" && p12[0].text.split("同じ検出文").length === 2 && p12[0].text.includes("論点 house・追い風") && p12[0].text.includes("論点 person・妨げ"));
  const it = p12[0]?.readings ?? [];
  check("人工12b: まとめた段落でも、読みごとの論点・向き・根拠・出典を明細に分けて持つ（混同しない）。段落全体の topic・向きは付けない",
    it.length === 2 && it[0].topic === "house" && it[0].direction === "favoring" && it[0].evidenceKeys.join() === "r｜1" && it[0].citations[0].source === "『六壬心鏡』"
    && it[1].topic === "person" && it[1].direction === "hindering" && it[1].evidenceKeys.join() === "s｜2" && it[1].citations[0].source === "『大六壬指南』"
    && p12[0].topic === undefined && p12[0].direction === undefined && p12[0].evidenceKeys.length === 2 && p12[0].citations.length === 2);
}

// ---- B. 実際の起課結果のケース ----
const examples: string[] = [];
{
  const run = (day: string, jiang: string, mb: string, ctx: Partial<InterpretationContext>) => {
    const f = factsOf(day, jiang), context = ctx as InterpretationContext;
    const { result, synthesis } = synthesizeLiurenInterpretation(f, context, mb as Branch);
    return { result: result!, n: narrateDomainSynthesis(result!, synthesis!, context) };
  };
  // 1・2・5・11. 盗難（甲子日 卯将 月支卯）
  const lost = run("甲子", "卯", "卯", { domain: "lostItem", subtype: "theft", goal: "recover" });
  check("実盤1 盗難 甲子日卯将: 論点 capture の追い風（機会）と妨げを両方名指しする", kinds(lost.n, "relation.favoringAndHindering").some((p) => p.topic === "capture" && p.text.includes("相殺しない")));
  check("実盤2 盗難 甲子日卯将: 機会と実現性は条件関係の候補で、確定させない", kinds(lost.n, "relation.conditionCandidate").every((p) => p.text.includes("確定していない")) && kinds(lost.n, "relation.conditionCandidate").length === 1);
  check("実盤5 盗難 甲子日卯将: 玄武｜辰 などは同じ FACT か確かめられない根拠として書く", kinds(lost.n, "relation.possiblySameFact").some((p) => p.evidenceKeys[0] === "玄武｜辰"));
  check("実盤11 盗難 甲子日卯将: 複数の論点を識別子のまま一覧し、判断軸の段落に論点を書く", (kinds(lost.n, "question.topics")[0]?.text.split("・").length ?? 0) >= 4
    && kinds(lost.n, "question.topics")[0].text.includes("capture") && kinds(lost.n, "axis.reading").every((p) => p.text.startsWith("［")));
  examples.push(...narrativeLines(lost.n).slice(0, 4).map((l) => `盗難 甲子日卯将｜${l}`));
  // 3. 異なる古典の対立（甲子日 戌将 月支戌）
  const g = run("甲子", "戌", "戌", { domain: "lostItem", subtype: "theft", goal: "recover" });
  const c3 = kinds(g.n, "relation.conflictDisjointSources").find((p) => p.ruleIds.includes("lostItem.gouVsThiefGod") && p.ruleIds.includes("lostItem.gouVsXuanwu"));
  check("実盤3 盗難 甲子日戌将: 『心鏡』（勾陳と盗神）と『直指』（勾陳と玄武）を両方書き、どちらが正しいか決めない",
    !!c3 && c3.text.includes("『六壬心鏡』の規則") && c3.text.includes("『御定六壬直指』の規則") && c3.text.includes("決めていない"));
  if (c3) examples.push(`盗難 甲子日戌将｜・${c3.text}`);
  // 4. 同じ FACT（丙寅日 子将 月支寅 行人）
  const t2 = run("丙寅", "子", "寅", { domain: "traveler", subtype: "return", goal: "return" });
  const sf = kinds(t2.n, "relation.sameFact").find((p) => p.evidenceKeys[0] === "final｜寅");
  check("実盤4 行人 丙寅日子将: 2規則が末伝 final｜寅 を参照 →「同じ FACT」「独立した根拠としては数えない」", !!sf && sf.ruleIds.length >= 2 && sf.certainty === "confirmed");
  if (sf) examples.push(`行人 丙寅日子将｜・${sf.text}`);
  // 6・9. 仕事（topic なし・0件）
  let workOk = false;
  for (const j of BRANCHES) {
    const w = run("甲子", j, "子", { domain: "work", goal: "acquire" });
    if (w.result.readings.length >= 2) { workOk = kinds(w.n, "relation.undeterminedNoTopic").length === 1 && kinds(w.n, "question.topics").length === 0; break; }
  }
  check("実盤6 仕事: 規則に topic がないので、関係を決めない段落だけを書く（論点を補わない）", workOk);
  const none = run("甲子", "丑", "丑", { domain: "work", goal: "acquire" });
  check("実盤9 仕事 甲子日丑将: 読みが0件 → 「成立した読みはありません」と不足だけ", kinds(none.n, "overview.none").length === 1 && !section(none.n, "axes") && section(none.n, "limits")!.paragraphs.length === none.result.missing.length);
  // 7・8. 不足
  const mar = run("甲子", "子", "子", { domain: "marriage", subtype: "proposal", goal: "acquire" });
  check("実盤7 婚姻: 男女の側の不足を DomainResult の文のまま書く", section(mar.n, "limits")!.paragraphs.some((p) => p.missingKeys[0] === "subjectSide" && p.text === mar.result.missing.find((m) => m.key === "subjectSide")!.detail));
  const tr = run("甲子", "子", "子", { domain: "traveler", subtype: "return", goal: "return" });
  check("実盤8 行人: 行年の不足を DomainResult の文のまま書く", section(tr.n, "limits")!.paragraphs.some((p) => (p.missingKeys[0] === "xingNian" || p.missingKeys[0] === "xingNianUnresolved")));
  // 10. 判断軸が1つの実盤（盤を順に探す）
  let one: string | null = null;
  for (let i = 0; i < 60 && !one; i++) for (let o = 0; o < 12 && !one; o++) {
    const r = run(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o], BRANCHES[(i + o) % 12], { domain: "house", subtype: "residence", goal: "maintain" });
    const ax = section(r.n, "axes");
    if (ax && ax.subsections!.length === 1 && r.result.readings.length >= 1) one = `${STEMS[i % 10]}${BRANCHES[i % 12]}日 ${BRANCHES[o]}将 月支${BRANCHES[(i + o) % 12]} 家宅: ${ax.subsections![0].heading}`;
  }
  check("実盤10 家宅: 判断軸が1つの盤でも、その軸の小見出しだけを作る", one !== null, one ?? "");
  // 12. 同じ文章（乙丑日 辰将 月支巳 家宅）
  const h = run("乙丑", "辰", "巳", { domain: "house", subtype: "residence", goal: "maintain" });
  const p12 = kinds(h.n, "axis.readingShared").find((p) => p.ruleIds.includes("house.flowToHouse.house") && p.ruleIds.includes("house.flowToHouse.person"));
  check("実盤12 家宅 乙丑日辰将: 同じ detected の2規則（家・人）→ 検出文は1回、読み・論点・向きは両方", !!p12 && p12.text.split("日干 乙 が末伝 巳 を生じ、巳 が日支 丑 を生ず").length === 2);
  if (p12) examples.push(`家宅 乙丑日辰将｜・${p12.text}`);
}

// ---- C. 既存機能の保護 ----
{
  const subs: [string, string | undefined, string | undefined][] = [["work", undefined, "acquire"], ["exam", "civil", undefined], ["house", "residence", "maintain"], ["traveler", "return", "return"], ["travel", "departure", "move"],
    ["marriage", "proposal", "acquire"], ["illness", undefined, undefined], ["wealth", "seekingWealth", "acquire"], ["litigation", "litigation", undefined], ["lostItem", "theft", "recover"], ["pregnancy", "maintain", "maintain"], ["childbirth", "delivery", undefined]];
  let itemsOk = true, covered = true, verbatim = true, unchanged = true, deterministic = true, noEmpty = true, missingOk = true, sourcesOk = true, n = 0;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o += 3) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o]), mb = BRANCHES[(i + o) % 12] as Branch;
    for (const [domain, subtype, goal] of subs) {
      const ctx = { domain, subtype, goal } as InterpretationContext;
      const { result, synthesis } = synthesizeLiurenInterpretation(f, ctx, mb);
      const r = result as DomainResult, s = synthesis!, br = JSON.stringify(r), bs = JSON.stringify(s);
      const nar = narrateDomainSynthesis(r, s, ctx);
      if (JSON.stringify(r) !== br || JSON.stringify(s) !== bs) unchanged = false;
      if (JSON.stringify(narrateDomainSynthesis(r, s, ctx)) !== JSON.stringify(nar)) deterministic = false;
      const axisParas = (section(nar, "axes")?.subsections ?? []).flatMap((x) => x.paragraphs);
      const idx = axisParas.flatMap((p) => p.readingIndexes).sort((a, b) => a - b);
      if (idx.join() !== r.readings.map((_, k) => k).join()) covered = false;
      for (const p of axisParas) for (const k of p.readingIndexes) { const x = r.readings[k]; if (!p.text.includes(x.detected) || !p.text.includes(`「${x.label}」`) || (x.directionNote && !p.text.includes(x.directionNote)) || !p.ruleIds.includes(x.ruleId)) verbatim = false; }
      for (const p of all(nar)) {
        if (p.readings.map((x) => x.index).join() !== p.readingIndexes.join()) itemsOk = false;
        for (const x of p.readings) { const sr = s.readings[x.index]; if (x.ruleId !== sr.ruleId || x.topic !== sr.topic || x.direction !== sr.direction || x.axis !== sr.axis || x.level !== sr.level || x.evidenceKeys.join() !== sr.evidenceKeys.join() || x.citations !== sr.reading.citations) itemsOk = false; }
        if (p.kind.startsWith("axis.") && (p.ruleIds.join() !== [...new Set(p.readings.map((x) => x.ruleId))].join() || p.evidenceKeys.join() !== [...new Set(p.readings.flatMap((x) => x.evidenceKeys))].join())) itemsOk = false;
      }
      if (nar.sections.some((x) => !x.paragraphs.length && !(x.subsections ?? []).length) || all(nar).some((p) => !p.text)) noEmpty = false;
      const lim = section(nar, "limits")?.paragraphs.filter((p) => p.kind === "limit.missing") ?? [];
      if (lim.map((p) => p.text).join("｜") !== r.missing.map((m) => m.detail).join("｜")) missingOk = false;
      const cites = (section(nar, "sources")?.paragraphs ?? []).length;
      if (cites !== new Set(r.readings.flatMap((x) => x.citations.map((c) => `${c.source}｜${c.locator}｜${c.layer}｜${c.quote}`))).size) sourcesOk = false;
      n += 1;
    }
  }
  check("すべての段落が読みごとの明細（規則 ID・論点・向き・軸・推論レベル・根拠・出典）を DomainSynthesis のまま持ち、まとめた段落でも規則 ID・根拠を落とさない", itemsOk);
  check("すべての読みが判断軸ごとの説明にちょうど1回ずつ出る（読みを落とさない・重ねない）", covered, `${n}`);
  check("読みの detected・label・directionNote を言い換えずに引用し、規則 ID を残す", verbatim);
  check("DomainResult・DomainSynthesis を書き換えない・同じ入力で同じ文章", unchanged && deterministic);
  check("空の節・空の段落を作らない", noEmpty);
  check("不足は DomainResult.missing の detail を順にそのまま書く", missingOk);
  check("原典の節は、読みが使う出典を重複なく1件ずつ書く", sourcesOk);
  const code = readFileSync("src/lib/liuren/interpretation/synthesisNarrative.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  check("topic・subtype・goal の日本語の表示名を持たない（識別子のまま）", !/TOPIC_LABEL|GOAL_LABEL|SUBTYPE_LABEL/.test(code));
  check("文章の型に点数・吉凶・成否の結論・応期の語を持たない", !/score|吉|凶|必ず|成功|失敗|応期|日付|確率/.test(code));
  check("起課・DOMAIN の評価を呼ばない（DomainResult と DomainSynthesis を読むだけ）", !/calculateLiuren|evaluate[A-Z]\w*Domain|synthesizeLiurenInterpretation|synthesizeDomainResult\(/.test(code));
}

console.log("生成される文章の例（実盤。古典の占験の再現ではない）:");
for (const l of examples) console.log(`  ${l}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
