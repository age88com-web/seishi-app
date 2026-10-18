// src/app/liuren/synthesisAdapter.ts
//
// 六壬神課 総合解釈の UI 接続（Phase 5T・第1段階）。
// 起課結果（LiurenChart）と問いの選択から、既存の処理をそのまま順に呼ぶだけ:
//   buildInterpretationFacts（FACT）→ synthesizeLiurenInterpretation（既存の DOMAIN 評価 → DomainSynthesis）→ narrateDomainSynthesis（文章化）
// 判断・文章は作らない。表示名（topic・subtype・goal）は UI 層の表（下）に置き、規則・識別子は変えない。
//
// 接続する占的は行人（traveler・subtype return）だけ。人物（問う人・行人）・本命・太歳・行年・類神は、
// 既存の画面に入力がないので渡さない（DOMAIN が不足として返す。問う人と行人を同じ人物として扱わない・年齢や行年を推測しない）。
// 月支は日時入力のときだけ暦（calendar.monthBranch）から渡す。日干支の直接指定では渡さない（月建の神煞は不足として返る）。

import type { Branch, LiurenChart } from "@/lib/liuren";
import type { DomainResult } from "@/lib/liuren/interpretation/domainResult";
import type { DomainSynthesis } from "@/lib/liuren/interpretation/domainSynthesis";
import { synthesizeLiurenInterpretation } from "@/lib/liuren/interpretation/domainSynthesis";
import { buildInterpretationFacts } from "@/lib/liuren/interpretation/facts";
import type { InterpretationContext, InterpretationGoal } from "@/lib/liuren/interpretation/roles";
import { narrateDomainSynthesis } from "@/lib/liuren/interpretation/synthesisNarrative";
import type { SynthesisNarrative } from "@/lib/liuren/interpretation/synthesisNarrative";

/** 画面で選べる占的（第1段階は行人だけ。"" は総合解釈を出さない） */
export type LiurenQuestionId = "" | "traveler";

/** 行人の問いで選べる goal（travelerDomain.ts: avoid・separate・release を「帰ることを望まない問い」として向きを逆にする） */
export type TravelerGoalChoice = "return" | "avoid";

export interface LiurenQuestion {
  id: LiurenQuestionId;
  goal: TravelerGoalChoice;
}

export interface LiurenSynthesisView {
  context: InterpretationContext;
  monthBranch: Branch | null;
  result: DomainResult;
  synthesis: DomainSynthesis;
  narrative: SynthesisNarrative;
}

/** 問いの選択 → DOMAIN に渡す Context（入力にないものは入れない） */
export function contextOf(q: LiurenQuestion): InterpretationContext | null {
  if (q.id === "traveler") return { domain: "traveler", subtype: "return", goal: q.goal as InterpretationGoal };
  return null;
}

/** 起課結果と問いから、総合解釈（DomainResult・DomainSynthesis・文章）を作る。占的が未選択なら null */
export function buildLiurenSynthesisView(chart: LiurenChart, monthBranch: Branch | null, q: LiurenQuestion): LiurenSynthesisView | null {
  const context = contextOf(q);
  if (!context) return null;
  const facts = buildInterpretationFacts(chart);
  const { result, synthesis } = synthesizeLiurenInterpretation(facts, context, monthBranch);
  if (!result || !synthesis) return null;
  return { context, monthBranch, result, synthesis, narrative: narrateDomainSynthesis(result, synthesis, context) };
}

// ---- 表示名（UI 層だけ。規則・識別子は変えない。意味を規則で確かめたものだけ） ----

/**
 * 行人の topic（travelerDomain.ts 冒頭の説明「relation（行人と家）・return（帰還の動き）・movement（いまの動きの段階）・
 * obstacle（帰還の妨げ）・safety（道中の災い）」と、各 topic の規則の label で確かめた）
 */
export const TOPIC_LABEL: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  traveler: { relation: "行人と家", return: "帰還の動き", movement: "いまの動きの段階", obstacle: "帰還の妨げ", safety: "道中の災い" },
};
/** subtype（roles.ts: traveler の return＝外出中の人が帰るか） */
export const SUBTYPE_LABEL: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  traveler: { return: "外出中の人が帰るか" },
};
/** goal（travelerDomain.ts: avoid は「帰ることを望まない問い」で向きが逆。return はそれ以外の既定の向き） */
export const GOAL_LABEL: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  traveler: { return: "帰ることを望む", avoid: "帰ることを望まない" },
};

/** 表示名があれば「表示名（識別子）」、なければ識別子のまま */
export function labelOf(table: Readonly<Record<string, Readonly<Record<string, string>>>>, domain: string, id: string | null | undefined): string {
  if (!id) return "—";
  const l = table[domain]?.[id];
  return l ? `${l}（${id}）` : id;
}
