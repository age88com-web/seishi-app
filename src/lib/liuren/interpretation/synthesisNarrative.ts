// src/lib/liuren/interpretation/synthesisNarrative.ts
//
// 役割（Phase 5S）:
//   総合解釈の文章化。DomainSynthesis（Phase 5R）と元の DomainResult から、見出し・段落に分けた説明を決まった型どおりに組み立てる。
//   既存の読みを整理して並べるだけで、新しい判断・結論・吉凶の点数・応期は作らない。生成 AI の作文は使わない。
//     読みの文 … DOMAIN の label・detected・directionNote をそのまま引用する（言い換えない）
//     関係の文 … DomainSynthesis の関係（併存・対立・条件関係の候補・判断不能）と根拠の共有状態を、決まった文で説明する
//     不足の文 … DomainResult.missing の detail をそのまま引用する（新しい入力を求めない）
//   同じ軸で同じ detected が複数の読みから返るときは、detected を一度だけ書き、読み（label・論点・向き・規則 ID）は別々に残す。
//   topic は規則の識別子のまま表示する（表示名の表は規則にないので、訳語を作らない）。subtype・goal も識別子のまま。
//
//   構成: A 問いと判断対象 → B 判断の全体像 → C 判断軸ごとの説明 → D 判断間の関係 → E 情報不足と判断の限界 → F 原典と根拠
//   該当する情報がない節・段落は作らない（空の文で埋めない）。

import { AXIS_LABEL } from "./domainResult";
import type { DomainAxis, DomainCitation, DomainDirection, DomainInferenceLevel, DomainResult } from "./domainResult";
import type { DomainSynthesis, EvidenceSharing, SynthesisReadingRef, SynthesisRelation } from "./domainSynthesis";
import type { InterpretationContext, InterpretationDomain } from "./roles";

export type NarrativeSectionId = "question" | "overview" | "axes" | "relations" | "limits" | "sources";

/**
 * 段落の確実性（文の出どころ）:
 *   ruleReading     … DOMAIN の規則が返した読みをそのまま引用
 *   confirmed       … 既存の型で確かめた関係・同一（同じ key・同じ FACT への参照）
 *   structure       … topic・軸・向きの構造だけから整理した関係（判断内容の同一や条件関係は確かめていない）
 *   notDeterminable … 既存の型から決められない
 *   input           … 問い・不足など、盤の判断ではない入力の情報
 */
export type NarrativeCertainty = "ruleReading" | "confirmed" | "structure" | "notDeterminable" | "input";

/** 段落が扱う読み1件ごとの明細（まとめた段落でも、読みごとの判断・根拠・出典を失わない） */
export interface NarrativeReadingItem {
  /** DomainResult.readings の位置 */
  index: number;
  ruleId: string;
  key: string;
  axis: DomainAxis;
  topic: string | null;
  direction: DomainDirection;
  level: DomainInferenceLevel;
  evidenceKeys: readonly string[];
  citations: readonly DomainCitation[];
}

export interface NarrativeParagraph {
  /** 段落の種類（UI で表示を分けるための識別子） */
  kind: string;
  text: string;
  axis?: DomainAxis;
  topic?: string;
  direction?: DomainDirection;
  /** 関連する読み（DomainResult.readings の位置） */
  readingIndexes: readonly number[];
  /** 読みごとの明細（readingIndexes と同じ順） */
  readings: readonly NarrativeReadingItem[];
  ruleIds: readonly string[];
  /** 根拠の FACT（"fact｜detail"） */
  evidenceKeys: readonly string[];
  citations: readonly DomainCitation[];
  /** 不足の key（DomainResult.missing） */
  missingKeys: readonly string[];
  certainty: NarrativeCertainty;
  /** 読みの推論レベル（読みを引用する段落だけ） */
  levels?: readonly DomainInferenceLevel[];
}

export interface NarrativeSection {
  id: NarrativeSectionId;
  heading: string;
  /** 判断軸ごとの小見出し（C の節だけ） */
  subsections?: readonly { axis: DomainAxis; heading: string; paragraphs: readonly NarrativeParagraph[] }[];
  paragraphs: readonly NarrativeParagraph[];
}

export interface SynthesisNarrative {
  domain: InterpretationDomain;
  sections: readonly NarrativeSection[];
}

/** DOMAIN の表示名（roles.ts の InterpretationDomain の説明どおり） */
export const DOMAIN_LABEL: Readonly<Record<InterpretationDomain, string>> = {
  wealth: "求財", work: "仕事・官職", exam: "試験", house: "家宅", marriage: "婚姻", travel: "出行", traveler: "行人（外出中の人が帰るか）",
  lostItem: "失物", theft: "盗難", litigation: "訴訟", illness: "病", pregnancy: "妊娠", childbirth: "出産", missingPerson: "失踪・尋人", weather: "天候",
};
/** 人物 ID の項目の表示名（roles.ts の InterpretationContext の説明どおり） */
const PERSON_LABEL: Readonly<Record<string, string>> = {
  subjectPersonId: "問う人", counterpartyPersonId: "相手", travelerPersonId: "行人", patientPersonId: "病人", wealthSeekerPersonId: "財を求める人",
  litigantPersonId: "争いの当事者", ownerPersonId: "物の所有者", pregnantPersonId: "妊娠・出産の本人",
};
const DIRECTION_LABEL: Readonly<Record<DomainDirection, string>> = { favoring: "追い風", hindering: "妨げ", neutral: "向きを決めない" };
/** 説明の順（opportunity から relation。timing は読みがあるときだけ最後） */
const AXIS_ORDER: readonly DomainAxis[] = ["opportunity", "support", "obstruction", "actualization", "trajectory", "relation", "timing"];

const uniq = <T>(xs: readonly T[]) => [...new Set(xs)];

function para(kind: string, text: string, refs: readonly SynthesisReadingRef[], certainty: NarrativeCertainty, extra: Partial<NarrativeParagraph> = {}): NarrativeParagraph {
  return {
    kind, text,
    readingIndexes: refs.map((r) => r.index),
    readings: refs.map((r) => ({ index: r.index, ruleId: r.ruleId, key: r.key, axis: r.axis, topic: r.topic, direction: r.direction, level: r.level, evidenceKeys: r.evidenceKeys, citations: r.reading.citations })),
    ruleIds: uniq(refs.map((r) => r.ruleId)), evidenceKeys: uniq(refs.flatMap((r) => r.evidenceKeys)),
    citations: uniq(refs.flatMap((r) => r.reading.citations)), missingKeys: [], certainty,
    ...(certainty === "ruleReading" ? { levels: uniq(refs.map((r) => r.level)) } : {}),
    ...extra,
  };
}

const labelList = (refs: readonly SynthesisReadingRef[]) => refs.map((r) => `「${r.label}」`).join("・");
const topicText = (t: string | null) => (t === null ? "論点（topic）なし" : `論点 ${t}`);

/** 読みを引用する文（label・detected・向き・directionNote をそのまま） */
function readingSentences(refs: readonly SynthesisReadingRef[]): string {
  const detected = refs[0].reading.detected, oneTopic = uniq(refs.map((r) => r.topic)).length === 1;
  const each = refs.map((r) => `「${r.label}」（${oneTopic ? "" : `${topicText(r.topic)}・`}${DIRECTION_LABEL[r.direction]}${r.directionNote ? `。${r.directionNote}` : ""}）`).join("、");
  return `${oneTopic ? `［${topicText(refs[0].topic)}］` : ""}${detected}。読み: ${each}`;
}

// ---- 各節 ----

function questionSection(s: DomainSynthesis, context?: InterpretationContext): NarrativeSection {
  const ps: NarrativeParagraph[] = [];
  const q = [`占的: ${DOMAIN_LABEL[s.domain]}`, s.subtype ? `subtype ${s.subtype}` : "", s.goal ? `goal ${s.goal}` : ""].filter(Boolean).join("・");
  ps.push(para("question.domain", q, [], "input"));
  const topics = Object.keys(s.byTopic);
  if (topics.length) ps.push(para("question.topics", `この盤の読みの論点（topic）: ${topics.join("・")}`, [], "input"));
  const people = Object.entries(s.participants).map(([k, v]) => `${PERSON_LABEL[k] ?? k} ${v}`);
  if (people.length) ps.push(para("question.participants", `人物: ${people.join("・")}`, [], "input"));
  if (context?.targetLabel) ps.push(para("question.target", `問う対象（入力のまま。判断には使わない）: ${context.targetLabel}`, [], "input"));
  return { id: "question", heading: "問いと判断対象", paragraphs: ps };
}

function overviewSection(s: DomainSynthesis): NarrativeSection {
  const R = s.readings;
  if (!R.length) return { id: "overview", heading: "判断の全体像", paragraphs: [para("overview.none", "この盤では、DOMAIN の規則で成立した読みはありません。", [], "confirmed")] };
  const axes = AXIS_ORDER.filter((a) => s.byAxis[a].length);
  const ps = [para("overview.axes", `成立している判断軸: ${axes.map((a) => `${AXIS_LABEL[a]}（${a}）${s.byAxis[a].length}件`).join("・")}`, R, "ruleReading")];
  for (const d of ["favoring", "hindering", "neutral"] as const) {
    const rs = R.filter((r) => r.direction === d);
    if (rs.length) ps.push(para(`overview.${d}`, `${d === "neutral" ? "向きが確定しない読み" : `${DIRECTION_LABEL[d]}を示す読み`}: ${labelList(rs)}`, rs, "ruleReading", { direction: d }));
  }
  return { id: "overview", heading: "判断の全体像", paragraphs: ps };
}

function axesSection(s: DomainSynthesis): NarrativeSection | null {
  const subsections = AXIS_ORDER.filter((a) => s.byAxis[a].length).map((axis) => {
    const rs = s.byAxis[axis].map((i) => s.readings[i]);
    const groups = new Map<string, SynthesisReadingRef[]>();
    for (const r of rs) groups.set(r.reading.detected, [...(groups.get(r.reading.detected) ?? []), r]);
    const paragraphs = [...groups.values()].map((g) => para(g.length > 1 ? "axis.readingShared" : "axis.reading", readingSentences(g), g, "ruleReading",
      { axis, ...(g[0].topic !== null && uniq(g.map((r) => r.topic)).length === 1 ? { topic: g[0].topic } : {}), ...(uniq(g.map((r) => r.direction)).length === 1 ? { direction: g[0].direction } : {}) }));
    return { axis, heading: `${AXIS_LABEL[axis]}（${axis}）`, paragraphs };
  });
  return subsections.length ? { id: "axes", heading: "判断軸ごとの説明", subsections, paragraphs: [] } : null;
}

const SHARING_TEXT: Record<EvidenceSharing, string> = {
  sameReference: "同じ FACT を参照している",
  possiblySame: "同じ FACT の可能性がある根拠を使っている（同じかどうかは確かめられない）",
  distinctPositions: "根拠は盤上の別の位置の FACT（互いに独立とまでは言えない）",
  unknown: "根拠が同じ FACT かどうかは判断できない",
};

function relationsSection(s: DomainSynthesis): NarrativeSection | null {
  const R = s.readings, ps: NarrativeParagraph[] = [];
  const pair = (r: SynthesisRelation) => [R[r.a], R[r.b]];
  for (const r of s.relations.reinforcing) {
    ps.push(para("relation.reinforcing", `${topicText(r.topic)}: 同じ読み（key ${R[r.a].key}）を別の規則 ${R[r.a].ruleId}・${R[r.b].ruleId} が同じ向き（${DIRECTION_LABEL[R[r.a].direction]}）で示している。${SHARING_TEXT[r.evidenceSharing]}`,
      pair(r), "confirmed", { topic: r.topic ?? undefined }));
  }
  // 同じ論点の別の好条件・別の妨げ（同じ向き・判断内容は同じと確かめられない）
  const sameDir = new Map<string, SynthesisRelation[]>();
  for (const r of s.relations.coexisting.filter((x) => x.sameDirectionOnTopic)) {
    const k = `${r.topic}｜${R[r.a].direction}`;
    sameDir.set(k, [...(sameDir.get(k) ?? []), r]);
  }
  for (const rs of sameDir.values()) {
    const refs = uniq(rs.flatMap((r) => [r.a, r.b])).sort((x, y) => x - y).map((i) => R[i]), d = refs[0].direction;
    const sharing = uniq(rs.map((r) => r.evidenceSharing));
    ps.push(para("relation.sameDirectionOnTopic",
      `${topicText(rs[0].topic)} で、同じ向き（${DIRECTION_LABEL[d]}）の別の読みが並んでいる: ${labelList(refs)}。同じ判断とは確かめられないので、補強とはしていない。根拠: ${sharing.map((x) => SHARING_TEXT[x]).join("／")}`,
      refs, "structure", { topic: rs[0].topic ?? undefined, direction: d }));
  }
  // 同じ論点で、別の軸どうしの組として成立する追い風と妨げ（論点ごとにまとめる。同じ軸どうしの逆向きは下の対立に書く）
  const fh = new Map<string, { f: Set<number>; h: Set<number> }>();
  for (const r of s.relations.coexisting.filter((x) => x.targetAlignment === "sameTopic" && !x.conditionCandidate && !x.sameDirectionOnTopic)) {
    const [a, b] = pair(r);
    if (a.direction === "neutral" || b.direction === "neutral" || a.direction === b.direction) continue;
    const g = fh.get(r.topic!) ?? { f: new Set<number>(), h: new Set<number>() };
    for (const x of [a, b]) (x.direction === "favoring" ? g.f : g.h).add(x.index);
    fh.set(r.topic!, g);
  }
  const axisReading = (x: SynthesisReadingRef) => `「${x.label}」（${AXIS_LABEL[x.axis]}）`;
  for (const [topic, g] of fh) {
    const f = [...g.f].sort((x, y) => x - y).map((i) => R[i]), h = [...g.h].sort((x, y) => x - y).map((i) => R[i]);
    ps.push(para("relation.favoringAndHindering", `${topicText(topic)} で、追い風の読み ${f.map(axisReading).join("・")} と妨げの読み ${h.map(axisReading).join("・")} が両方成立している（どちらも残し、相殺しない。同じ軸どうしで向きが逆の組は、対立として別に書く）`,
      [...f, ...h], "structure", { topic }));
  }
  // 対立（同じ論点・同じ軸で向きが逆）
  for (const r of s.relations.conflicting) {
    const [a, b] = pair(r), books = (x: SynthesisReadingRef) => x.sourceBooks.join("・");
    const text = r.disjointSources
      ? `${topicText(r.topic)}・${AXIS_LABEL[a.axis]}で向きが逆の読みがある: ${books(a)}の規則「${a.label}」は${DIRECTION_LABEL[a.direction]}、${books(b)}の規則「${b.label}」は${DIRECTION_LABEL[b.direction]}。出典の書が重ならない。どちらが正しいかは決めていない`
      : `${topicText(r.topic)}・${AXIS_LABEL[a.axis]}で向きが逆の読みがある: 「${a.label}」は${DIRECTION_LABEL[a.direction]}、「${b.label}」は${DIRECTION_LABEL[b.direction]}。どちらかに決めていない`;
    ps.push(para(r.disjointSources ? "relation.conflictDisjointSources" : "relation.conflict", text, [a, b], "structure", { topic: r.topic ?? undefined, axis: a.axis }));
  }
  // 条件関係の候補（同じ論点の機会と実現性）
  for (const v of s.realization) {
    const o = v.opportunity.map((i) => R[i]), a = v.actualization.map((i) => R[i]);
    ps.push(para("relation.conditionCandidate",
      `${topicText(v.topic)} に、機会の読み ${o.map((r) => `「${r.label}」（${DIRECTION_LABEL[r.direction]}）`).join("・")} と実現性の読み ${a.map((r) => `「${r.label}」（${DIRECTION_LABEL[r.direction]}）`).join("・")} がある。一方が他方の条件になるとは規則に明示されていないので、条件関係は確定していない（候補）`,
      [...o, ...a], "structure", { topic: v.topic }));
  }
  // 根拠 FACT の共有（同じ evidence を2つ以上の読みが使う）
  for (const e of s.evidence.filter((x) => x.readings.length > 1)) {
    const refs = e.readings.map((i) => R[i]);
    const same = s.relations.reinforcing.concat(s.relations.coexisting, s.relations.conflicting, s.relations.undetermined)
      .some((r) => e.readings.includes(r.a) && e.readings.includes(r.b) && r.evidencePairs.some((p) => p.identity === "sameReference" && p.a === e.key));
    ps.push(para(same ? "relation.sameFact" : "relation.possiblySameFact",
      same ? `${labelList(refs)} は同じ FACT（${e.key}${e.position ? `。位置 ${e.position}` : ""}）を参照している。独立した根拠としては数えない`
        : `${labelList(refs)} は同じ文字列の根拠（${e.key}）を使っているが、名前が位置・対象を特定しないので、同じ FACT かどうかは確かめられない`,
      refs, same ? "confirmed" : "notDeterminable", { evidenceKeys: [e.key] }));
  }
  // 判断不能
  const noTopic = s.missing.readingsWithoutTopic.map((i) => R[i]);
  if (noTopic.length && R.length > 1) {
    ps.push(para("relation.undeterminedNoTopic", `論点（topic）のない読み ${labelList(noTopic)} は、ほかの読みとの関係を決めていない（規則に論点が付いていない）`, noTopic, "notDeterminable"));
  }
  const neutralPairs = s.relations.undetermined.filter((r) => r.targetAlignment === "sameTopic");
  const neutralRefs = uniq(neutralPairs.flatMap((r) => [r.a, r.b])).filter((i) => R[i].direction === "neutral").map((i) => R[i]);
  if (neutralRefs.length) {
    ps.push(para("relation.undeterminedNeutral", `向きを決めない読み ${labelList(neutralRefs)} と、同じ論点のほかの読みとの関係は決めていない`, neutralRefs, "notDeterminable"));
  }
  return ps.length ? { id: "relations", heading: "判断間の関係", paragraphs: ps } : null;
}

function limitsSection(result: DomainResult, s: DomainSynthesis): NarrativeSection | null {
  const ps: NarrativeParagraph[] = result.missing.map((m) => para("limit.missing", m.detail, [], "input", { missingKeys: [m.key] }));
  if (Object.keys(s.participants).length && s.readings.length) {
    ps.push(para("limit.participants", "読みごとに、どの人物を指すかは記録されていない（人物の対応は問いの入力だけ）", [], "input"));
  }
  return ps.length ? { id: "limits", heading: "情報不足と判断の限界", paragraphs: ps } : null;
}

function sourcesSection(s: DomainSynthesis): NarrativeSection | null {
  const ps = s.citations.map((c) => {
    const refs = c.readings.map((i) => s.readings[i]);
    return para("source.citation", `${c.citation.source} ${c.citation.locator}（${c.citation.layer}）「${c.citation.quote}」 … ${refs.map((r) => r.ruleId).join("・")}`, refs, "ruleReading", { citations: [c.citation] });
  });
  return ps.length ? { id: "sources", heading: "原典と根拠", paragraphs: ps } : null;
}

/** 総合解釈の説明（見出し・段落に分ける）。result は synthesis の元の DomainResult、context は問いの入力（任意） */
export function narrateDomainSynthesis(result: DomainResult, synthesis: DomainSynthesis, context?: InterpretationContext): SynthesisNarrative {
  const sections = [questionSection(synthesis, context), overviewSection(synthesis), axesSection(synthesis), relationsSection(synthesis), limitsSection(result, synthesis), sourcesSection(synthesis)]
    .filter((x): x is NarrativeSection => x !== null);
  return { domain: synthesis.domain, sections };
}

/** 確認用: 見出しと本文だけを行に並べる（UI ではない） */
export function narrativeLines(n: SynthesisNarrative): string[] {
  return n.sections.flatMap((s) => [`■ ${s.heading}`, ...s.paragraphs.map((p) => `・${p.text}`),
    ...(s.subsections ?? []).flatMap((x) => [`  ◇ ${x.heading}`, ...x.paragraphs.map((p) => `  ・${p.text}`)])]);
}
