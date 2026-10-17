// src/lib/liuren/interpretation/domainSynthesis.ts
//
// 役割（Phase 5R）:
//   総合解釈の基盤。既存の DOMAIN の結果（DomainResult）をそのまま入力にして、同じ占的の複数の読みの関係を整理する。
//   規則を判定し直さない・読みの向きや文を変えない・新しい判断を足さない。吉凶の点数や一つの結論にはまとめない。
//   関係は、既存の型の項目から確かめられる範囲だけで決め、確かめられないものは判断不能や候補として残す（断定しない）。
//
//   既存の構造の再利用（Phase 5R の監査）:
//     DomainResult（domainResult.ts）… 読み（ruleId・key・axis・topic・detected・evidence・direction・level・citations）・byAxis・overview・missing・summary
//     判断軸 DomainAxis … relation・opportunity・support・obstruction・actualization・trajectory（・timing）をそのまま使う
//     読みと向きの分離 … reading（何を示すか: key・axis・topic・detected）と direction（問いの goal に対する向き）は既存の項目のまま
//     「同じ段階」の判定 … monthlySpiritReadings.ts（Phase 5L）と同じく、topic を論点（対象・段階）の単位にする
//   interpretLiuRen・InterpretationResult は既存コードにない。入口は evaluateLiurenDomain（既存の評価関数を呼び分けるだけ）と
//   synthesizeDomainResult（DomainResult → DomainSynthesis）。
//
//   読みどうしの関係（同じ DomainResult の中の2つの読みごとに1つ）:
//     reinforcing  … 判断内容が同じと確かめられる（読みの key が同じで、別の規則）・同じ topic・同じ向き
//                    （key は DOMAIN が読みに付けた識別子。文章の類似では比べない。現在の規則表では、同じ key の規則は排他の DOMAIN・subtype にしかない）
//     conflicting  … 同じ topic・同じ軸で、向きが逆（favoring と hindering）。出典の書が重ならなければ disjointSources（両方残す。どちらが正しいかは決めない）
//     coexisting   … topic が違う（向きが逆でも対立にしない）／同じ topic・別の軸で追い風と妨げ／同じ topic・同じ向きで判断内容が違う（sameDirectionOnTopic）／
//                    同じ topic の機会（opportunity）と実現性（actualization）（conditionCandidate。条件関係は確定しない）
//     conditional  … 一方の規則が他方の成立・実現の条件になると明示されているときだけ。既存の型にその項目がないので、現在は出さない
//     undetermined … どちらかに topic がない／同じ topic で向きを決めない読み（neutral）を含む
//   根拠 FACT の同一性（evidence の項目の組ごと。EvidenceIdentity）:
//     sameReference     … fact と detail が同じで、fact の名前が盤上の一つの位置（初伝・干上など）や一つの神煞を指すと確かめられる
//     possiblySame      … fact と detail が同じだが、名前が位置・人物・対象を特定しない（例: sixRelation｜子孫）
//     distinctPosition  … 両方の名前が盤上の位置を指し、その位置が違う（同じ支でも別の FACT。互いに独立とまでは言わない）
//     unknown           … それ以外（名前が違うだけでは独立と断定しない）
//   FACT の識別子は DOMAIN ごとに付け方が違い、全面的な標準化はしていない（監査資料の課題）。

import type { Branch } from "../types";
import { evaluateCareerDomain } from "./careerDomain";
import { directionEvidenceOf } from "./directionEvidence";
import type { DomainAxis, DomainCitation, DomainDirection, DomainEvidenceItem, DomainInferenceLevel, DomainMissingFact, DomainReading, DomainResult } from "./domainResult";
import { evaluateHouseDomain } from "./houseDomain";
import { evaluateIllnessDomain } from "./illnessDomain";
import { evaluateLitigationDomain } from "./litigationDomain";
import { evaluateLostItemDomain } from "./lostItemDomain";
import { evaluateMarriageDomain } from "./marriageDomain";
import { evaluatePregnancyDomain } from "./pregnancyDomain";
import type { DomainSubtype, InterpretationContext, InterpretationDomain, InterpretationGoal, PersonContextId } from "./roles";
import { evaluateTravelDomain } from "./travelDomain";
import { evaluateTravelerDomain } from "./travelerDomain";
import type { InterpretationFacts, MovementDirection, MovementPattern } from "./types";
import { evaluateWealthDomain } from "./wealthDomain";

// ---- 入口: 既存の DOMAIN の評価関数を呼び分ける（評価関数そのものは変えない） ----

type Evaluator = (facts: InterpretationFacts, context: InterpretationContext, monthBranch?: Branch | null) => DomainResult;

/** InterpretationDomain → 既存の評価関数（評価関数のない DOMAIN は持たない） */
export const DOMAIN_EVALUATORS: Readonly<Partial<Record<InterpretationDomain, Evaluator>>> = {
  work: evaluateCareerDomain, exam: evaluateCareerDomain,
  house: evaluateHouseDomain, marriage: evaluateMarriageDomain, travel: evaluateTravelDomain, traveler: evaluateTravelerDomain,
  illness: evaluateIllnessDomain, wealth: evaluateWealthDomain, litigation: evaluateLitigationDomain, lostItem: evaluateLostItemDomain,
  pregnancy: evaluatePregnancyDomain, childbirth: evaluatePregnancyDomain,
};

/** 既存の DOMAIN の評価関数で読みを求める。評価関数のない DOMAIN（theft・missingPerson・weather）は null */
export function evaluateLiurenDomain(facts: InterpretationFacts, context: InterpretationContext, monthBranch?: Branch | null): DomainResult | null {
  const f = DOMAIN_EVALUATORS[context.domain];
  return f ? f(facts, context, monthBranch) : null;
}

// ---- 根拠 FACT の同一性 ----

export type EvidenceIdentity = "sameReference" | "possiblySame" | "distinctPosition" | "unknown";

/**
 * 盤上の一つの位置を名前で指す fact（属性の接尾辞 ".〜" を含めて同じ位置にまとめる。干上 standing は一課の上神と同じ位置）。
 * 既存の evidence で使われている名前のうち、名前だけで位置が決まるものに限る（detail に位置を書く名前は含めない）。
 */
const POSITION_PREFIXES: readonly [string, string][] = [
  ["initial", "initial"], ["middle", "middle"], ["final", "final"],
  ["lesson1", "lesson1"], ["standing", "lesson1"], ["lesson3", "lesson3"], ["divinationBranch", "divinationBranch"],
];
/** 名前だけで盤上の一つの値を指す fact（位置の比較には使わず、同じ参照の確認だけに使う） */
const SINGLE_VALUE_FACTS: readonly string[] = ["dayStem", "dayBranch", "lodgingBranch", "taiSui", "method", "transmissions", "tianGang.earth"];

/** fact の名前が指す盤上の位置（決まらなければ null） */
export function evidencePositionOf(fact: string): string | null {
  for (const [p, pos] of POSITION_PREFIXES) if (fact === p || fact.startsWith(`${p}.`)) return pos;
  return null;
}
const singleReference = (fact: string) =>
  evidencePositionOf(fact) !== null || SINGLE_VALUE_FACTS.includes(fact) || fact.startsWith("monthlySpirit.") || fact.startsWith("secondarySpirit.");

/** 根拠の項目2つが同じ FACT か */
export function evidenceIdentityOf(x: DomainEvidenceItem, y: DomainEvidenceItem): EvidenceIdentity {
  if (x.fact === y.fact && x.detail === y.detail) return singleReference(x.fact) ? "sameReference" : "possiblySame";
  const px = evidencePositionOf(x.fact), py = evidencePositionOf(y.fact);
  if (px !== null && py !== null && px !== py) return "distinctPosition";
  return "unknown";
}

/** 2つの読みの根拠の共有状態（項目の組のうち、最も強く同一を示すもの。すべて distinctPosition のときだけ distinctPositions） */
export type EvidenceSharing = "sameReference" | "possiblySame" | "distinctPositions" | "unknown";

export interface EvidencePairNote {
  identity: Exclude<EvidenceIdentity, "unknown">;
  a: string;
  b: string;
}

function sharingOf(x: readonly DomainEvidenceItem[], y: readonly DomainEvidenceItem[]): { sharing: EvidenceSharing; pairs: EvidencePairNote[] } {
  const pairs: EvidencePairNote[] = [];
  const ids: EvidenceIdentity[] = [];
  for (const a of x) for (const b of y) {
    const id = evidenceIdentityOf(a, b);
    ids.push(id);
    if (id !== "unknown") pairs.push({ identity: id, a: evidenceKeyOf(a.fact, a.detail), b: evidenceKeyOf(b.fact, b.detail) });
  }
  const sharing: EvidenceSharing = ids.includes("sameReference") ? "sameReference" : ids.includes("possiblySame") ? "possiblySame"
    : ids.length > 0 && ids.every((i) => i === "distinctPosition") ? "distinctPositions" : "unknown";
  return { sharing, pairs };
}

// ---- 総合結果の型 ----

/** 読みへの参照（DomainResult の読みをそのまま指し、写した項目は変えない） */
export interface SynthesisReadingRef {
  /** DomainResult.readings の位置 */
  index: number;
  ruleId: string;
  key: string;
  label: string;
  axis: DomainAxis;
  /** 論点（対象・段階）。読みに topic がなければ null */
  topic: string | null;
  direction: DomainDirection;
  directionNote?: string;
  level: DomainInferenceLevel;
  /** 根拠の FACT（"fact｜detail"） */
  evidenceKeys: readonly string[];
  /** 出典の書（重複なし） */
  sourceBooks: readonly DomainCitation["source"][];
  reading: DomainReading;
}

export type SynthesisRelationKind = "reinforcing" | "coexisting" | "conflicting" | "conditional" | "undetermined";

/** 関係を決めた根拠の確かさ: 読みの識別子（key）で判断内容が同じと確かめた／topic・軸・向きの構造だけ／決められない */
export type SynthesisRelationBasis = "readingKey" | "structure" | "notDeterminable";

export interface SynthesisRelation {
  kind: SynthesisRelationKind;
  basis: SynthesisRelationBasis;
  /** 2つの読み（DomainResult.readings の位置。a < b） */
  a: number;
  b: number;
  /** 論点の対応: 同じ topic／違う topic／topic がなく決められない */
  targetAlignment: "sameTopic" | "differentTopic" | "unknown";
  topic: string | null;
  /** 関係を決めた理由（構造の説明だけで、判断は書かない） */
  reason: string;
  /** 根拠 FACT の共有状態と、同一・位置違いと分かった項目の組 */
  evidenceSharing: EvidenceSharing;
  evidencePairs: readonly EvidencePairNote[];
  /** coexisting: 同じ topic・同じ向きだが、判断内容が同じとは確かめられない（補強とは断定しない） */
  sameDirectionOnTopic?: boolean;
  /** coexisting: 同じ topic の機会と実現性（条件関係の候補。確定していない） */
  conditionCandidate?: boolean;
  /** conflicting: 出典の書が重ならない（異なる古典の見解として両方残す） */
  disjointSources?: boolean;
}

/** 同じ topic・同じ向きの読みの根拠の群 */
export interface EvidenceCluster {
  topic: string;
  direction: Exclude<DomainDirection, "neutral">;
  /** 同じ FACT への参照（sameReference）でつながる読みの群（群の中は独立した根拠として数えない） */
  groups: readonly (readonly number[])[];
  /** 群をまたいで、同じ FACT の可能性（possiblySame）がある読みの組 */
  possiblyLinked: readonly (readonly [number, number])[];
  /** 群どうしの根拠がすべて位置違い（distinctPositions）と確かめられたか。false なら独立とは言えない */
  groupsDistinctByPosition: boolean;
}

/** 同じ topic に機会（opportunity）と実現性（actualization）の読みがある（条件関係は確定しない） */
export interface RealizationView {
  topic: string;
  opportunity: readonly number[];
  actualization: readonly number[];
  /** 一方が他方の条件になると明示した項目が既存の型にないので、常に false */
  conditionConfirmed: false;
}

export interface SynthesisEvidenceItem {
  key: string;
  fact: string;
  detail: string;
  /** 名前が指す盤上の位置（決まらなければ null） */
  position: string | null;
  readings: readonly number[];
}

export interface SynthesisCitationItem {
  citation: DomainCitation;
  readings: readonly number[];
}

export interface DomainSynthesis {
  domain: InterpretationDomain;
  subtype?: DomainSubtype;
  goal?: InterpretationGoal;
  status: "readings" | "noReadings";
  readings: readonly SynthesisReadingRef[];
  byAxis: Readonly<Record<DomainAxis, readonly number[]>>;
  /** 論点（topic）ごとの読みの位置。topic のない読みは含めない */
  byTopic: Readonly<Record<string, readonly number[]>>;
  relations: {
    reinforcing: readonly SynthesisRelation[];
    coexisting: readonly SynthesisRelation[];
    conflicting: readonly SynthesisRelation[];
    conditional: readonly SynthesisRelation[];
    undetermined: readonly SynthesisRelation[];
  };
  evidenceClusters: readonly EvidenceCluster[];
  realization: readonly RealizationView[];
  /** 事態の推移: trajectory 軸の読みと、facts を渡したときだけ三伝の進退（directionEvidence の既存の値） */
  trajectory: { readings: readonly number[]; flow: { movementPattern: MovementPattern; movementDirection: MovementDirection } | null };
  evidence: readonly SynthesisEvidenceItem[];
  citations: readonly SynthesisCitationItem[];
  /** 情報不足: DomainResult.missing そのままと、topic がなく関係を決められない読み */
  missing: { domain: readonly DomainMissingFact[]; readingsWithoutTopic: readonly number[] };
  /** 問いに関わる人物（CONTEXT の人物 ID。context を渡したときだけ） */
  participants: Readonly<Record<string, PersonContextId>>;
  /** 読みごとの人物の対応: 既存の読みは人物 ID を持たないので記録されていない */
  participantAlignment: "notRecordedInReadings";
}

// ---- 総合 ----

const AXES: readonly DomainAxis[] = ["relation", "opportunity", "support", "obstruction", "actualization", "trajectory", "timing"];
const PERSON_FIELDS = [
  "subjectPersonId", "counterpartyPersonId", "travelerPersonId", "patientPersonId", "wealthSeekerPersonId", "litigantPersonId", "ownerPersonId", "pregnantPersonId",
] as const;

const evidenceKeyOf = (fact: string, detail: string) => `${fact}｜${detail}`;
const opposite = (x: DomainDirection, y: DomainDirection) => (x === "favoring" && y === "hindering") || (x === "hindering" && y === "favoring");

function relationOf(x: SynthesisReadingRef, y: SynthesisReadingRef): SynthesisRelation {
  const { sharing, pairs } = sharingOf(x.reading.evidence, y.reading.evidence);
  const base = { a: x.index, b: y.index, evidenceSharing: sharing, evidencePairs: pairs };
  if (x.topic === null || y.topic === null) {
    return { kind: "undetermined", basis: "notDeterminable", ...base, targetAlignment: "unknown", topic: null, reason: "topic のない読みを含むので、同じ論点かを決められない" };
  }
  if (x.topic !== y.topic) {
    return { kind: "coexisting", basis: "structure", ...base, targetAlignment: "differentTopic", topic: null, reason: `論点が違う（${x.topic}・${y.topic}）。向きが逆でも対立にしない` };
  }
  const same = { ...base, targetAlignment: "sameTopic" as const, topic: x.topic };
  const axes = new Set([x.axis, y.axis]);
  if (x.axis !== y.axis && axes.has("opportunity") && axes.has("actualization")) {
    return { kind: "coexisting", basis: "structure", ...same, conditionCandidate: true,
      reason: "同じ論点に機会（opportunity）と実現性（actualization）がある。一方が他方の条件になるとは既存の規則に明示されていない（条件関係の候補）" };
  }
  if (x.direction === "neutral" || y.direction === "neutral") {
    return { kind: "undetermined", basis: "notDeterminable", ...same, reason: "同じ論点だが向きを決めない読みを含み、関係を既存の型から決められない" };
  }
  if (opposite(x.direction, y.direction)) {
    if (x.axis !== y.axis) return { kind: "coexisting", basis: "structure", ...same, reason: `同じ論点の別の軸（${x.axis}・${y.axis}）で、追い風と妨げが両方ある（どちらも残す）` };
    const disjoint = !x.sourceBooks.some((s) => y.sourceBooks.includes(s));
    return { kind: "conflicting", basis: "structure", ...same, disjointSources: disjoint, reason: `同じ論点・同じ軸（${x.axis}）で向きが逆${disjoint ? "（出典の書が重ならない）" : ""}` };
  }
  if (x.key === y.key && x.ruleId !== y.ruleId) {
    return { kind: "reinforcing", basis: "readingKey", ...same, reason: `同じ読み（key ${x.key}）を別の規則が同じ向きで示す${sharing === "sameReference" ? "。ただし同じ FACT を参照する" : ""}` };
  }
  return { kind: "coexisting", basis: "structure", ...same, sameDirectionOnTopic: true, reason: "同じ論点・同じ向きだが、判断内容が同じとは既存の型から確かめられない（補強とは断定しない）" };
}

/** 同じ FACT への参照（sameReference）で読みを群に分ける（union-find） */
function clustersOf(refs: readonly SynthesisReadingRef[]): { groups: number[][]; possiblyLinked: [number, number][]; distinct: boolean } {
  const parent = new Map(refs.map((r) => [r.index, r.index]));
  const find = (i: number): number => (parent.get(i) === i ? i : find(parent.get(i)!));
  const shared = new Map<string, EvidenceSharing>();
  for (const x of refs) for (const y of refs) if (x.index < y.index) {
    const s = sharingOf(x.reading.evidence, y.reading.evidence).sharing;
    shared.set(`${x.index},${y.index}`, s);
    if (s === "sameReference") parent.set(find(y.index), find(x.index));
  }
  const groups = new Map<number, number[]>();
  for (const r of refs) groups.set(find(r.index), [...(groups.get(find(r.index)) ?? []), r.index]);
  const possiblyLinked: [number, number][] = [];
  let distinct = true;
  for (const [k, s] of shared) {
    const [a, b] = k.split(",").map(Number);
    if (find(a) === find(b)) continue;
    if (s === "possiblySame") possiblyLinked.push([a, b]);
    if (s !== "distinctPositions") distinct = false;
  }
  return { groups: [...groups.values()], possiblyLinked, distinct };
}

/**
 * DomainResult → 総合結果。読み・向き・文は DomainResult のまま参照し、規則を判定し直さない。
 * facts を渡したときだけ、三伝の進退（directionEvidence の既存の値）を trajectory に添える。context を渡したときだけ人物の ID を写す。
 */
export function synthesizeDomainResult(result: DomainResult, options: { facts?: InterpretationFacts; context?: InterpretationContext } = {}): DomainSynthesis {
  const refs: SynthesisReadingRef[] = result.readings.map((r, index) => ({
    index, ruleId: r.ruleId, key: r.key, label: r.label, axis: r.axis, topic: r.topic ?? null, direction: r.direction,
    ...(r.directionNote ? { directionNote: r.directionNote } : {}), level: r.level,
    evidenceKeys: [...new Set(r.evidence.map((e) => evidenceKeyOf(e.fact, e.detail)))],
    sourceBooks: [...new Set(r.citations.map((c) => c.source))],
    reading: r,
  }));
  const relations: Record<SynthesisRelationKind, SynthesisRelation[]> = { reinforcing: [], coexisting: [], conflicting: [], conditional: [], undetermined: [] };
  for (let i = 0; i < refs.length; i++) for (let j = i + 1; j < refs.length; j++) {
    const rel = relationOf(refs[i], refs[j]);
    relations[rel.kind].push(rel);
  }
  const byTopic: Record<string, number[]> = {};
  for (const r of refs) if (r.topic !== null) (byTopic[r.topic] ??= []).push(r.index);
  const evidenceClusters: EvidenceCluster[] = [];
  const realization: RealizationView[] = [];
  for (const [topic, idx] of Object.entries(byTopic)) {
    const rs = idx.map((i) => refs[i]);
    for (const direction of ["favoring", "hindering"] as const) {
      const d = rs.filter((r) => r.direction === direction);
      if (!d.length) continue;
      const c = clustersOf(d);
      evidenceClusters.push({ topic, direction, groups: c.groups, possiblyLinked: c.possiblyLinked, groupsDistinctByPosition: c.groups.length > 1 && c.distinct });
    }
    const opportunity = rs.filter((r) => r.axis === "opportunity").map((r) => r.index), actualization = rs.filter((r) => r.axis === "actualization").map((r) => r.index);
    if (opportunity.length && actualization.length) realization.push({ topic, opportunity, actualization, conditionConfirmed: false });
  }
  const evidence = new Map<string, SynthesisEvidenceItem & { readings: number[] }>();
  for (const r of refs) for (const e of r.reading.evidence) {
    const key = evidenceKeyOf(e.fact, e.detail), item = evidence.get(key) ?? { key, fact: e.fact, detail: e.detail, position: evidencePositionOf(e.fact), readings: [] };
    if (!item.readings.includes(r.index)) item.readings.push(r.index);
    evidence.set(key, item);
  }
  const citations = new Map<string, SynthesisCitationItem & { readings: number[] }>();
  for (const r of refs) for (const c of r.reading.citations) {
    const key = `${c.source}｜${c.locator}｜${c.layer}｜${c.quote}`, item = citations.get(key) ?? { citation: c, readings: [] };
    if (!item.readings.includes(r.index)) item.readings.push(r.index);
    citations.set(key, item);
  }
  const de = options.facts ? directionEvidenceOf(options.facts) : null;
  const participants: Record<string, PersonContextId> = {};
  for (const k of PERSON_FIELDS) { const v = options.context?.[k]; if (v !== undefined) participants[k] = v; }
  return {
    domain: result.domain, ...(result.subtype ? { subtype: result.subtype } : {}), ...(result.goal ? { goal: result.goal } : {}),
    status: refs.length ? "readings" : "noReadings",
    readings: refs,
    byAxis: Object.fromEntries(AXES.map((a) => [a, refs.filter((r) => r.axis === a).map((r) => r.index)])) as Record<DomainAxis, number[]>,
    byTopic, relations, evidenceClusters, realization,
    trajectory: { readings: refs.filter((r) => r.axis === "trajectory").map((r) => r.index), flow: de ? { movementPattern: de.movementPattern, movementDirection: de.movementDirection } : null },
    evidence: [...evidence.values()], citations: [...citations.values()],
    missing: { domain: result.missing, readingsWithoutTopic: refs.filter((r) => r.topic === null).map((r) => r.index) },
    participants, participantAlignment: "notRecordedInReadings",
  };
}

/** 盤と問いから、既存の DOMAIN 評価と総合結果をまとめて返す（評価関数のない DOMAIN は result・synthesis とも null） */
export function synthesizeLiurenInterpretation(
  facts: InterpretationFacts, context: InterpretationContext, monthBranch?: Branch | null,
): { result: DomainResult | null; synthesis: DomainSynthesis | null } {
  const result = evaluateLiurenDomain(facts, context, monthBranch);
  return { result, synthesis: result ? synthesizeDomainResult(result, { facts, context }) : null };
}
