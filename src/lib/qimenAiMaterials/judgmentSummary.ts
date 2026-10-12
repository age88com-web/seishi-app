// src/lib/qimenAiMaterials/judgmentSummary.ts
//
// 役割:
//   確定判断材料の表示用構造（buildJudgmentDisplay の結果）から、利用者向けの短い定型説明
//   「この宮の判断材料について」を、AI を使わずプログラムだけで作る。
//   鑑定・解釈はしない。使うのは確定済みの分類・材料の確定名称（label）・scope・関連資料の親子・件数だけで、
//   原文（sourceText）は読まない。新しい吉凶・総合判定・優先順位・強弱・相殺・因果・行動助言・推量は書かない。
//
// 2段構成:
//   buildJudgmentSummary(display)     … 定型説明用データ（グループごとの名称・件数・関連資料の親・内部 ID）
//   renderJudgmentSummaryText(summary) … 文章（段落の配列）。UI でカード・箇条書きにする場合はデータ側を使う。
//
// 宮名:
//   「乾六宮」のような宮名ラベルは UI（src/app/qimen/page.tsx）の定数にしか無いため使わない。
//   共通ライブラリ @/lib/qimen が公開する PALACE_TRIGRAM（奇門計算側の八卦）と宮番号から「乾宮（6宮）」と書く
//   （「〇宮」は既存の剋應の組み合わせ表示「乙奇 × 乾宮」と同じ形）。八卦の無い中宮は「5宮」とだけ書く。
//
// 0件の扱い:
//   段落を省略せず、4つのグループすべてについて1文ずつ書く。0件のときは「今回の分類では〜はありません」と
//   分類の結果だけを述べる（「吉ではない」「吉意がない」とは書かない）。どの宮でも同じ構成で読めるようにするため。

import { PALACE_TRIGRAM } from "@/lib/qimen";
import type { JudgmentItem, QimenJudgmentDisplay } from "./judgmentDisplay";

export interface JudgmentSummaryEntry {
  /** 内部 ID（文章には出さない。追跡用） */
  id: string;
  /** 確定名称（JudgmentItem.label そのまま） */
  name: string;
  scope: "この宮" | "盤全体" | null;
}

export interface JudgmentSummary {
  palaceNumber: number;
  /** 八卦＋「宮」（例: 乾宮）。八卦の無い中宮は null */
  palaceTrigramName: string | null;
  favorable: JudgmentSummaryEntry[];
  cautionPalace: JudgmentSummaryEntry[];
  cautionWholeChart: JudgmentSummaryEntry[];
  /** 関連資料を持つ材料（親）と、その関連資料の件数 */
  relatedParents: { parent: JudgmentSummaryEntry; relatedIds: string[] }[];
  unclassifiedKokuo: JudgmentSummaryEntry[];
  /** 対応格局を確定できず、どこにもつながなかった関連資料の内部 ID */
  unlinkedIds: string[];
}

export interface JudgmentSummaryText {
  paragraphs: string[];
  text: string;
}

const CLOSING = "具体的な内容は、それぞれの判断材料をご確認ください。";

function entry(i: JudgmentItem): JudgmentSummaryEntry {
  return { id: i.id, name: i.label, scope: i.scope };
}

/** 確定判断材料の表示用構造から、定型説明用データを作る。入力は変更しない。 */
export function buildJudgmentSummary(display: QimenJudgmentDisplay): JudgmentSummary {
  const trigram = PALACE_TRIGRAM[display.palaceNumber];
  const g = display.groups;
  const parents = Object.values(g).flatMap((grp) => grp.items).filter((p) => p.related.length > 0);
  return {
    palaceNumber: display.palaceNumber,
    palaceTrigramName: trigram ? `${trigram}宮` : null,
    favorable: g.favorable.items.map(entry),
    cautionPalace: g.cautionPalace.items.map(entry),
    cautionWholeChart: g.cautionWholeChart.items.map(entry),
    relatedParents: parents.map((p) => ({ parent: entry(p), relatedIds: p.related.map((c) => c.id) })),
    unclassifiedKokuo: g.unclassifiedKokuo.items.map(entry),
    unlinkedIds: display.unlinked.map((u) => u.item.id),
  };
}

/** 名称を『』で囲んで並べる（1件: 『A』／2件: 『A』と『B』／3件以上: 『A』『B』『C』）。 */
export function joinNames(names: string[]): string {
  const q = names.map((n) => `『${n}』`);
  if (q.length <= 1) return q.join("");
  if (q.length === 2) return `${q[0]}と${q[1]}`;
  return q.join("");
}

/** 名称に scope の注記を付ける（吉となる材料のうち盤全体のものだけ）。 */
function favorableName(e: JudgmentSummaryEntry): string {
  return e.scope === "盤全体" ? `${e.name}（盤全体）` : e.name;
}

/** 定型説明用データから文章を作る。 */
export function renderJudgmentSummaryText(s: JudgmentSummary): JudgmentSummaryText {
  const palace = s.palaceTrigramName ? `${s.palaceTrigramName}（${s.palaceNumber}宮）` : `${s.palaceNumber}宮`;
  const paragraphs: string[] = [];

  // 吉となる材料
  paragraphs.push(
    s.favorable.length > 0
      ? `この${palace}には、吉となる材料として${joinNames(s.favorable.map(favorableName))}が成立しています。`
      : `この${palace}では、今回の分類で吉となる材料はありません。`,
  );

  // 注意する材料（この宮）
  paragraphs.push(
    s.cautionPalace.length > 0
      ? `一方、この宮には${joinNames(s.cautionPalace.map((e) => e.name))}が注意する材料として成立しています。`
      : "この宮では、今回の分類で注意する材料はありません。",
  );

  // 注意する材料（盤全体）＋関連資料
  const whole: string[] = [
    s.cautionWholeChart.length > 0
      ? `さらに宮単独の材料とは別に、盤全体では${joinNames(s.cautionWholeChart.map((e) => e.name))}が成立しています。`
      : "盤全体では、今回の分類で注意する材料はありません。",
  ];
  if (s.relatedParents.length > 0) {
    const single = s.relatedParents.filter((r) => r.relatedIds.length === 1).map((r) => r.parent.name);
    const multi = s.relatedParents.filter((r) => r.relatedIds.length > 1);
    if (single.length === 1) whole.push(`${joinNames(single)}には、別の関連資料もあります。`);
    if (single.length > 1) whole.push(`${joinNames(single)}には、それぞれ別の関連資料もあります。`);
    for (const r of multi) whole.push(`${joinNames([r.parent.name])}には、別の関連資料が${r.relatedIds.length}件あります。`);
  }
  paragraphs.push(whole.join(""));

  // 吉凶を分類していない剋應
  paragraphs.push(
    s.unclassifiedKokuo.length > 0
      ? `このほか、吉凶を分類していない剋應として、${s.unclassifiedKokuo.length}件の剋應が成立しています。`
      : "吉凶を分類していない剋應は、今回はありません。",
  );

  // 対応格局を確定できなかった関連資料（ある場合だけ）
  if (s.unlinkedIds.length > 0) {
    paragraphs.push(`このほか、対応する格局を確定できなかった関連資料が${s.unlinkedIds.length}件あります。`);
  }

  paragraphs.push(CLOSING);
  return { paragraphs, text: paragraphs.join("\n\n") };
}
