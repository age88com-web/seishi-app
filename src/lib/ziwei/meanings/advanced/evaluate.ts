// src/lib/ziwei/meanings/advanced/evaluate.ts
//
// 応用編・144命宮配置解釈の取得と条件判定。docs/ziwei-basic-spec.md §24。
// 入口: getAdvancedInterpretation(chart)。命盤の紫微星の支 × 命宮の支で項目を引き、文ごとに
//   男女（出生情報の性別）→ 条件（成立なら表示、不成立・未判定なら表示しない）を判定する。
//   条件付きの文を受ける後続文（blockOf）は、先頭の文と同じ結果にする（後続文だけを出さない）。
// 本文は資料の文のまま（要約・言い換え・接続語の追加をしない）。

import { mainStarsOf } from "../../stars";
import { sanfangSizheng } from "../../sanfang";
import { viewOf } from "../../patterns/chartView";
import type { Branch, MainStar, ZiweiChart } from "../../types";
import { combine, evaluateCondition } from "./conditions";
import { ADVANCED_SOURCE_LABEL, getAdvancedItem } from "./data";
import type { AdvancedInterpretation, AdvancedItem, EvaluatedSentence, StructureCheck } from "./types";

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** 見出しの配置（主星・主星なし・借りる星）を既存の作盤エンジン（mainStarsOf）と照合する */
export function checkStructure(item: AdvancedItem): StructureCheck {
  const pos = mainStarsOf(item.ziweiBranch);
  const at = (b: Branch) => (Object.keys(pos) as MainStar[]).filter((s) => pos[s] === b);
  const engineMain = at(item.mingBranch);
  const engineNoMain = engineMain.length === 0;
  const engineBorrowed = engineNoMain ? at(sanfangSizheng(item.mingBranch).opposite) : [];
  const notes: string[] = [];
  let ok: boolean;
  if (item.noMainStar) {
    ok = engineNoMain && sameSet(item.borrowedStars, engineBorrowed);
    notes.push(`見出し: 主星なし・対宮の ${item.borrowedStars.join("・")}／エンジン: ${engineNoMain ? `主星なし・対宮 ${engineBorrowed.join("・")}` : `主星 ${engineMain.join("・")}`}`);
    if (item.borrowNote && !item.borrowNote.startsWith("借りる")) notes.push(`見出しは「${item.heading}」で「借りる」の記載なし（資料の処理記録 要確認6）`);
  } else {
    ok = !engineNoMain && sameSet(item.displayedMainStars, engineMain);
    notes.push(`見出し: ${item.displayedMainStars.join("・")}／エンジン: ${engineNoMain ? "主星なし" : engineMain.join("・")}`);
  }
  if (item.sourceCorrection) {
    notes.push(`見出しを訂正済み: 元「${item.sourceCorrection.originalHeading}」→「${item.sourceCorrection.correctedHeading}」（${item.sourceCorrection.reason}）`);
  }
  if (item.headingBranchMismatch) {
    notes.push(`見出しの命宮は「${item.headingBranch}」だが、ブロック内の並び（子→亥）では${item.mingBranch}。星配置は${item.mingBranch}のエンジンの配置と照合`);
  }
  return {
    status: !ok ? "mismatch" : item.headingBranchMismatch ? "needs_review" : "match",
    engineMainStars: engineMain,
    engineNoMainStar: engineNoMain,
    engineBorrowed,
    notes,
  };
}

export function evaluateAdvancedInterpretation(item: AdvancedItem, chart: ZiweiChart): AdvancedInterpretation {
  const v = viewOf(chart);
  const subject: MainStar[] = [...item.displayedMainStars, ...item.borrowedStars];
  const all = item.paragraphs.flatMap((p) => p.sentences);
  const own = new Map<string, EvaluatedSentence>();
  for (const s of all) {
    const results = s.conditions.map((c) => ({ condition: c, ...evaluateCondition(v, c, subject) }));
    const result = s.conditions.length === 0 ? "unconditional" : combine(results.map((r) => r.result));
    own.set(s.id, { id: s.id, text: s.text, shown: false, hiddenReason: null, conditionResults: results, result, blockOf: s.blockOf, gender: s.gender });
  }
  const sexOf = chart.sex;
  const sentences: EvaluatedSentence[] = all.map((s) => {
    const e = own.get(s.id)!;
    const lead = s.blockOf ? own.get(s.blockOf)! : e;
    const result = s.blockOf ? lead.result : e.result;
    let hiddenReason: EvaluatedSentence["hiddenReason"] = null;
    if (s.gender && s.gender !== sexOf) hiddenReason = "gender";
    else if (s.blockOf && lead.gender && lead.gender !== sexOf) hiddenReason = "gender";
    else if (result === "notMet") hiddenReason = "notMet";
    else if (result === "pending") hiddenReason = "pending";
    return { ...e, result, shown: hiddenReason === null, hiddenReason };
  });
  const paragraphs = item.paragraphs
    .map((p) => {
      const shown = p.sentences.filter((s) => sentences.find((x) => x.id === s.id)!.shown);
      return { id: p.id, text: shown.map((s) => s.text).join(""), sentenceIds: shown.map((s) => s.id) };
    })
    .filter((p) => p.sentenceIds.length > 0);
  return {
    item,
    structure: checkStructure(item),
    paragraphs,
    sentences,
    counts: {
      sentences: sentences.length,
      shown: sentences.filter((s) => s.shown).length,
      hiddenGender: sentences.filter((s) => s.hiddenReason === "gender").length,
      hiddenNotMet: sentences.filter((s) => s.hiddenReason === "notMet").length,
      pending: sentences.filter((s) => s.hiddenReason === "pending").length,
    },
    source: ADVANCED_SOURCE_LABEL,
  };
}

/** 命盤から応用編の解釈（紫微星の支 × 命宮の支） */
export function getAdvancedInterpretation(chart: ZiweiChart): AdvancedInterpretation {
  const item = getAdvancedItem(chart.starPositions["紫微星"], chart.mingPalace);
  if (!item) throw new Error(`応用編の項目がない: 紫微 ${chart.starPositions["紫微星"]}・命宮 ${chart.mingPalace}`);
  return evaluateAdvancedInterpretation(item, chart);
}
