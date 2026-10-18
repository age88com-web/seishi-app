// src/app/liuren/synthesisDisplay.ts
//
// 六壬神課 総合解釈の画面表示（Phase 5T 追加修正）。表示専用で、判断・規則・関係判定は作らない。
// synthesisAdapter.ts が作った同じ総合解釈（DomainResult・DomainSynthesis・文章化）から、
//   通常表示 … 占断の意味ごとの見出しと日本語の文（内部識別子を出さない）
//   詳細表示 … 読みごとの技術情報（規則 ID・軸・論点・FACT・推論レベル・確実性・出典の原文）と、判断間の関係
// を組み立てる。
//
// 行人の通常表示の振り分け（travelerDomain.ts の規則の向きの付け方を、そのまま使う）:
//   帰還を促す要素／帰還を妨げる要素 … topic relation・return・obstacle の読みを、帰還に対する向きで分ける。
//     goal return（既定）では DOMAIN の向き（追い風＝帰る読み・妨げ＝帰らない読み）がそのまま帰還に対する向き。
//     goal avoid では、DOMAIN が「帰ることを望まない問いでは逆向き」と注記して向きを反転しているので、その注記のある読みだけ反転し直して帰還に対する向きにする。
//     注記のない読みは振り分けず「その他の読み」に置く（推測しない）。
//   帰還についての参考 … 同じ topic で DOMAIN が向きを決めない読み
//   現在の移動状況 … topic movement（向きは読みごとに添える）
//   道中の安全 … topic safety
//   読みが分かれている点 … DomainSynthesis の対立（同じ論点・同じ軸で逆向き）。どちらとも決めない
//   判断に必要な追加情報 … DomainResult.missing（括弧書きの英字の識別子だけを除く）
//   入力の要約（Phase 5U）… synthesisAdapter が personInputs.inputSummary で作った日本語の要約を、問いの情報に並べる
// 文は「盤では、{detected}。古典では「{label}」と読みます。{directionNote}」の型で、読みの文を言い換えない。
// 同じ見出しの中で detected が同じ読みは、盤の配置を一度だけ書く。

import type { DomainAxis, DomainCitation, DomainDirection, DomainInferenceLevel } from "@/lib/liuren/interpretation/domainResult";
import type { SynthesisReadingRef } from "@/lib/liuren/interpretation/domainSynthesis";
import type { NarrativeCertainty } from "@/lib/liuren/interpretation/synthesisNarrative";
import { DOMAIN_LABEL } from "@/lib/liuren/interpretation/synthesisNarrative";
import { GOAL_LABEL, TOPIC_LABEL } from "./synthesisAdapter";
import type { LiurenSynthesisView } from "./synthesisAdapter";

/** 通常表示の1件（同じ盤の配置の読みをまとめる） */
export interface DisplayItem {
  /** 本文（日本語の文。内部識別子を含まない） */
  sentence: string;
  /** 帰還に対する向きなど、読みごとの短い補足（なければ空） */
  tags: readonly string[];
  /** 対応する読み（DomainResult.readings の位置。表示しないが、詳細表示と結び付ける） */
  readingIndexes: readonly number[];
}

export interface DisplaySection {
  id: "overall" | "promote" | "hinder" | "reference" | "movement" | "safety" | "divergent" | "other" | "missing";
  heading: string;
  /** 見出しの下の説明（なければ省く） */
  lead?: string;
  items: readonly DisplayItem[];
}

export interface ReadingDetail {
  index: number;
  label: string;
  ruleId: string;
  axis: string;
  topic: string;
  direction: string;
  level: string;
  certainty: string;
  detected: string;
  directionNote?: string;
  evidence: readonly string[];
  citations: readonly DomainCitation[];
}

export interface SynthesisDisplay {
  title: string;
  /** 問いの情報（占的・目的・月支） */
  facts: readonly { label: string; value: string }[];
  sections: readonly DisplaySection[];
  details: readonly ReadingDetail[];
  /** 判断間の関係（Phase 5S の文。詳細表示だけ。内部識別子を含みうる） */
  relations: readonly { text: string; ruleIds: readonly string[]; certainty: string }[];
  /** 不足の key（詳細表示だけ） */
  missingKeys: readonly { key: string; detail: string }[];
}

const AXIS_JA: Record<DomainAxis, string> = { relation: "関係", opportunity: "機会", support: "後押し", obstruction: "妨げ", actualization: "実現性", trajectory: "流れ", timing: "時期" };
const DIRECTION_JA: Record<DomainDirection, string> = { favoring: "追い風", hindering: "妨げ", neutral: "向きを決めない" };
/** domainResult.ts の DomainInferenceLevel の説明どおり */
const LEVEL_JA: Record<DomainInferenceLevel, string> = { direct: "原文の判断", combined: "訳注・複数の盤の要素の組合せ", inferred: "資料から一般化" };
/** synthesisNarrative.ts の NarrativeCertainty の説明どおり */
const CERTAINTY_JA: Record<NarrativeCertainty, string> = {
  ruleReading: "規則の読みの引用", confirmed: "型で確かめた関係・同一", structure: "構造だけの整理（同一・条件は未確認）", notDeterminable: "判断不能", input: "入力の情報",
};
/** travelerDomain.ts が goal avoid などで向きを反転した読みに付ける注記 */
const TRAVELER_REVERSED_NOTE = "帰ることを望まない問いでは逆向き";

const end = (s: string) => (/。$/.test(s) ? s : `${s}。`);
/** 本文: 盤の配置と古典の読み（label）、DOMAIN の補足（directionNote）をそのまま並べる */
function sentenceOf(refs: readonly SynthesisReadingRef[]): string {
  const d = refs[0].reading.detected;
  const readings = refs.map((r) => `古典では「${r.label}」と読みます。${r.directionNote && r.directionNote !== TRAVELER_REVERSED_NOTE ? end(r.directionNote) : ""}`).join("");
  return `盤では、${end(d)}${readings}`;
}
/** 不足の文から、括弧書きの英字の識別子（例:（travelerPersonId））と「人物 ID」の ID を除く（意味は変えない） */
export function plainMissing(detail: string): string {
  return detail.replace(/（[A-Za-z0-9_.]+）/g, "").replace(/人物\s*ID\s*/g, "人物");
}

function itemsOf(refs: readonly SynthesisReadingRef[], tagOf: (r: SynthesisReadingRef) => string | null = () => null): DisplayItem[] {
  const groups = new Map<string, SynthesisReadingRef[]>();
  for (const r of refs) groups.set(r.reading.detected, [...(groups.get(r.reading.detected) ?? []), r]);
  return [...groups.values()].map((g) => ({ sentence: sentenceOf(g), tags: [...new Set(g.map(tagOf).filter((t): t is string => !!t))], readingIndexes: g.map((r) => r.index) }));
}

/** 行人: 帰還に対する向き（"return"＝帰る読み・"notReturn"＝帰らない読み・null＝決められない） */
function travelerLean(r: SynthesisReadingRef, goal: string | undefined): "return" | "notReturn" | null {
  if (r.direction === "neutral") return null;
  const reversed = goal !== undefined && goal !== "return" && r.directionNote === TRAVELER_REVERSED_NOTE;
  if (goal !== undefined && goal !== "return" && !reversed) return null;
  const favoring = r.direction === "favoring";
  return (reversed ? !favoring : favoring) ? "return" : "notReturn";
}

function travelerSections(v: LiurenSynthesisView): DisplaySection[] {
  const R = v.synthesis.readings, goal = v.synthesis.goal;
  const avoid = goal === "avoid";
  const backTopics = new Set(["relation", "return", "obstacle"]);
  const back = R.filter((r) => r.topic !== null && backTopics.has(r.topic));
  const promote = back.filter((r) => travelerLean(r, goal) === "return"), hinder = back.filter((r) => travelerLean(r, goal) === "notReturn");
  const reference = back.filter((r) => r.direction === "neutral");
  const other = back.filter((r) => r.direction !== "neutral" && travelerLean(r, goal) === null)
    .concat(R.filter((r) => r.topic === null || !["relation", "return", "obstacle", "movement", "safety"].includes(r.topic)));
  const movement = R.filter((r) => r.topic === "movement"), safety = R.filter((r) => r.topic === "safety");
  const s: DisplaySection[] = [];
  const overall = promote.length && hinder.length
    ? "帰還を促す読みと、帰還を妨げる読みが両方成立しています。規則からはどちらか一方に決められないので、相殺せずに両方を示します。"
    : promote.length ? "帰還を促す読みが成立しています。帰還を妨げる読みは、この盤では成立していません。"
      : hinder.length ? "帰還を妨げる読みが成立しています。帰還を促す読みは、この盤では成立していません。"
        : "帰還について向きを示す読みは、この盤では成立していません。";
  s.push({ id: "overall", heading: "帰還についての判断", lead: `${overall}帰還の時期（応期）は扱いません。`, items: [] });
  if (promote.length) s.push({ id: "promote", heading: "帰還を促す要素", ...(avoid ? { lead: "問いの目的（帰ることを望まない）から見ると、妨げになる読みです。" } : {}), items: itemsOf(promote) });
  if (hinder.length) s.push({ id: "hinder", heading: "帰還を妨げる要素", ...(avoid ? { lead: "問いの目的（帰ることを望まない）から見ると、追い風になる読みです。" } : {}), items: itemsOf(hinder) });
  if (reference.length) s.push({ id: "reference", heading: "帰還についての参考（向きを決めない読み）", items: itemsOf(reference) });
  const leanTag = (r: SynthesisReadingRef) => { const l = travelerLean(r, goal); return l === "return" ? "帰還を促す読み" : l === "notReturn" ? "帰還を妨げる読み" : "向きを決めない読み"; };
  if (movement.length) s.push({ id: "movement", heading: "現在の移動状況", items: itemsOf(movement, leanTag) });
  if (safety.length) s.push({ id: "safety", heading: "道中の安全", items: itemsOf(safety) });
  if (other.length) s.push({ id: "other", heading: "その他の読み", items: itemsOf(other, (r) => DIRECTION_JA[r.direction]) });
  return s;
}

/** 通常表示・詳細表示（同じ総合解釈から作る） */
export function buildSynthesisDisplay(v: LiurenSynthesisView): SynthesisDisplay {
  const d = v.synthesis.domain, R = v.synthesis.readings;
  const facts = [
    { label: "占的", value: DOMAIN_LABEL[d] },
    ...(v.synthesis.goal && GOAL_LABEL[d]?.[v.synthesis.goal] ? [{ label: "問いの目的", value: GOAL_LABEL[d][v.synthesis.goal] }] : []),
    { label: "月支", value: v.monthBranch ? `${v.monthBranch}（日時の暦から）` : "なし（日干支を直接指定したため。月の神煞を使う読みは行いません）" },
    ...(v.inputs ?? []),
  ];
  const sections: DisplaySection[] = d === "traveler" ? travelerSections(v) : [{ id: "other", heading: "成立した読み", items: itemsOf(R, (r) => DIRECTION_JA[r.direction]) }];
  if (!R.length) sections.splice(0, sections.length, { id: "overall", heading: "判断", lead: "この盤では、規則で成立した読みはありません。", items: [] });
  const conflicts = v.synthesis.relations.conflicting.map((c) => {
    const a = R[c.a], b = R[c.b];
    return { sentence: `「${a.label}」と「${b.label}」は、同じ点について逆の読みです（${a.sourceBooks.join("・")}／${b.sourceBooks.join("・")}）。どちらが正しいかは決めずに、両方を示します。`, tags: [], readingIndexes: [a.index, b.index] };
  });
  if (conflicts.length) sections.push({ id: "divergent", heading: "読みが分かれている点", items: conflicts });
  if (v.result.missing.length) sections.push({ id: "missing", heading: "判断に必要な追加情報", lead: "次の情報がないため、関係する読みは行っていません。", items: v.result.missing.map((m) => ({ sentence: end(plainMissing(m.detail)), tags: [], readingIndexes: [] })) });

  const certaintyOf = new Map<number, NarrativeCertainty>();
  for (const s of v.narrative.sections) for (const p of [...s.paragraphs, ...(s.subsections ?? []).flatMap((x) => x.paragraphs)]) if (p.kind.startsWith("axis.")) for (const i of p.readingIndexes) certaintyOf.set(i, p.certainty);
  const details: ReadingDetail[] = R.map((r) => ({
    index: r.index, label: r.label, ruleId: r.ruleId,
    axis: `${AXIS_JA[r.axis]}（${r.axis}）`,
    topic: r.topic === null ? "なし" : `${TOPIC_LABEL[d]?.[r.topic] ?? r.topic}（${r.topic}）`,
    direction: `${DIRECTION_JA[r.direction]}（問いの目的に対する向き）`,
    level: `${LEVEL_JA[r.level]}（${r.level}）`,
    certainty: CERTAINTY_JA[certaintyOf.get(r.index) ?? "ruleReading"],
    detected: r.reading.detected, ...(r.directionNote ? { directionNote: r.directionNote } : {}),
    evidence: r.evidenceKeys, citations: r.reading.citations,
  }));
  const rel = v.narrative.sections.find((s) => s.id === "relations")?.paragraphs ?? [];
  return {
    title: `総合解釈：${DOMAIN_LABEL[d]}`, facts, sections, details,
    relations: rel.map((p) => ({ text: p.text, ruleIds: p.ruleIds, certainty: CERTAINTY_JA[p.certainty] })),
    missingKeys: v.result.missing.map((m) => ({ key: m.key, detail: m.detail })),
  };
}
