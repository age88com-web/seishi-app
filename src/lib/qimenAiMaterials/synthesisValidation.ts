// src/lib/qimenAiMaterials/synthesisValidation.ts
//
// 役割:
//   AI 統合解説の本文を、統合解説用入力（QimenSynthesisInput）と機械的に照合する。
//   AI・意味の類似度・embedding は使わず、文字列の一致だけで判定する。
//   機械的に判定できないもの（否定の反転・言い換え・因果の付加・主語の変更）は
//   humanReviewNotes に回し、自動で正しいとはしない。
//
// 文の単位（claim）:
//   段落（空行で区切る）ごとに、引用タグの並び（[ID][ID]…）の直前までの文字列を、
//   その引用タグの文とする。段落の最後の引用タグより後ろの文字列と、引用タグの無い段落は
//   「引用なしの文」とする。引用タグは [ID] と [ID: ID] の両方を読み取る。
//
// 却下する条件（1つでもあれば rejected）:
//   unknownIds             入力に無い ID の引用
//   missingRequiredIds     成立済み材料・分類未確定資料の ID のうち一度も引用されないもの
//   uncitedClaims          引用なしの文に、資料に固有の語（下記）が含まれる
//   citationMismatches     文中の資料に固有の語が、引用した資料には無く、別の資料にだけある
//   unverifiedQuotes       「」の中の文字列が、引用した資料の本文・確定情報にそのまま無い
//   illegalFortuneWords    吉凶語が、引用した資料の本文・確定情報に無い
//   reclassifiedSection4   section4 の材料だけを引用した文で、吉・凶への分類表現を使っている
//   singleMeaningConversions 単体象意だけを引用した文で、許可・推奨の表現を使っている
//   unsupportedNumbers     数字＋単位（日・里・km・年・月 など）が、引用した資料に無い
//   bannedPhrases / summaryJudgments  禁止表現・総合判定の表現
//
// 資料に固有の語:
//   各資料の本文・名称・内訳・組み合わせ・要素名・単体象意の文から、漢字の2字以上の連なりを
//   取り出したもの。区分名や資料の種類など、どの資料にも共通する語は除く（META_TERMS）。

import type { QimenSynthesisInput } from "./synthesisInput";

export interface SynthesisValidation {
  passed: boolean;
  citedIds: string[];
  unknownIds: string[];
  missingRequiredIds: string[];
  uncitedClaims: string[];
  citationMismatches: { claim: string; term: string; foundIn: string[]; cited: string[] }[];
  unverifiedQuotes: { claim: string; quote: string; cited: string[] }[];
  illegalFortuneWords: { claim: string; word: string; cited: string[] }[];
  reclassifiedSection4: { claim: string; expression: string; cited: string[] }[];
  singleMeaningConversions: { claim: string; expression: string; cited: string[] }[];
  unsupportedNumbers: { claim: string; value: string; cited: string[] }[];
  bannedPhrases: string[];
  summaryJudgments: string[];
  humanReviewNotes: string[];
}

export const SYNTHESIS_BANNED_PHRASES = [
  "新しい事業を進めることが可能",
  "人との協力を重視するとよい",
  "タイミングを意識するとよい",
  "柔軟な対応が必要",
  "リスク管理が重要",
  "慎重に判断すべき",
  "無理をしない方がよい",
] as const;

export const SYNTHESIS_SUMMARY_PHRASES = [
  "総合すると", "総合的に", "相殺", "差し引き", "多数決", "上回る", "優勢",
  "吉意の方が", "凶意の方が", "吉意が強", "凶意が強", "吉の方が強", "凶の方が強",
] as const;

/** 吉凶語（長い語から照合する）。「吉凶」は分類ではない語として先に取り除く。 */
const FORTUNE_WORDS = [
  "宜しからざる", "宜しくない", "吉方向", "吉格", "凶格", "大吉", "大凶", "上吉", "中吉", "小吉", "次吉",
  "中凶", "小凶", "吉利", "大利", "不吉", "不利", "宜しい", "良い", "よい", "吉", "凶",
];
const FORTUNE_NEUTRAL = /吉凶/g;

/** section4 の分類し直しとみなす表現。 */
const SECTION4_RECLASS = [
  "吉である", "凶である", "吉とされ", "凶とされ", "吉と言え", "凶と言え", "吉といえ", "凶といえ",
  "吉方向", "注意材料", "吉の材料", "凶の材料", "吉兆", "凶兆",
];

/** 単体象意からの許可・推奨とみなす表現。 */
const SINGLE_CONVERSION = [
  "この日時", "良い", "よい", "宜しい", "べき", "できる", "向いている", "適している", "おすすめ", "勧め", "好機", "チャンス",
];

/** 因果をつなぐ表現（人の確認に回す）。 */
const CAUSAL = ["ので", "ため", "から", "結果", "によって", "だから", "そのため"];

/** どの資料にも共通する語（資料に固有の語から除く）。 */
const META_TERMS = new Set([
  "象意", "吉凶", "表記", "盤全体", "資料", "成立", "格局", "剋應", "判断", "材料", "要素", "本文", "区分",
  "説明", "同時", "存在", "分類", "注意", "方向", "天盤", "地盤", "人盤", "八門", "九星", "八神", "宮位",
  "三奇", "六儀", "基本", "判定", "意味", "混在", "未確定", "吉格", "凶格", "追加", "伏吟反吟", "対応",
  "宮番号", "八卦", "天盤干", "地盤干", "統合", "解説", "以内",
]);

const ID_TAG = /\[(?:ID:\s*)?([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+)\]/g;
const TAG_RUN = /(?:\[(?:ID:\s*)?[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+\]\s*)+/g;
const KANJI_RUN = /[㐀-䶿一-鿿豈-﫿々]{2,}/g;
const NUMBER_EXPR = /(?:[0-9０-９]+(?:\.[0-9０-９]+)?\s*(?:km|ｋｍ|日|里|年|か月|ヶ月|月|時間|人)|[一二三四五六七八九十百千]+(?:日|里|年|か月|ヶ月|月|時間|人))/g;

interface Claim {
  text: string;
  cited: string[];
}

/** 本文を引用タグ単位の文に分ける。 */
function splitClaims(text: string): { claims: Claim[]; uncited: string[] } {
  const claims: Claim[] = [];
  const uncited: string[] = [];
  for (const para of text.split(/\n\s*\n/)) {
    let last = 0;
    for (const m of para.matchAll(TAG_RUN)) {
      const idx = m.index ?? 0;
      const cited = [...m[0].matchAll(ID_TAG)].map((x) => x[1]);
      claims.push({ text: para.slice(last, idx), cited });
      last = idx + m[0].length;
    }
    const rest = para.slice(last);
    if (rest.trim() !== "") uncited.push(rest);
  }
  return { claims, uncited };
}

/** 一番外側の「」の中身を取り出す（入れ子の「」に対応）。 */
function outerQuotes(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "「") {
      if (depth === 0) start = i + 1;
      depth += 1;
    } else if (text[i] === "」" && depth > 0) {
      depth -= 1;
      if (depth === 0) out.push(text.slice(start, i));
    }
  }
  return out;
}

/** 吉凶語を長い語から順に取り出す（一度取り出した部分は重ねて数えない）。 */
function fortuneWordsIn(text: string): Set<string> {
  let t = text.replace(FORTUNE_NEUTRAL, "〇〇");
  const found = new Set<string>();
  for (const w of FORTUNE_WORDS) {
    if (t.includes(w)) {
      found.add(w);
      t = t.split(w).join("〇".repeat(w.length));
    }
  }
  return found;
}

/** 資料1件の照合用テキスト（確定情報＋本文）。 */
function itemTexts(input: QimenSynthesisInput): Map<string, { text: string; section: string | null }> {
  const map = new Map<string, { text: string; section: string | null }>();
  for (const s of input.singleMeanings) {
    // 照合用の文字列は、判定規則を変えないため従来どおり項目を「、」でつないで作る（表示・入力の形式とは別）。
    const text = [s.element, s.role, s.kind, s.fortuneLabel ?? "", ...s.lines.map((l) => `${l.label}：${l.values.join("、")}`)].join("\n");
    map.set(s.id, { text, section: null });
  }
  for (const e of input.established) {
    const h = e.header;
    const text = [
      e.sectionLabel, h.type, h.name ?? "", h.fortune ?? "", h.category ?? "", h.scope ?? "", h.detail ?? "",
      h.mode ?? "", h.combination ?? "", h.judgeDetail ?? "",
      h.linkedKaku ? `${h.linkedKaku.name} ${h.linkedKaku.category}` : "",
      ...e.sourceText.map((s) => `${s.label}：${s.text}`),
    ].join("\n");
    map.set(e.id, { text, section: e.section });
  }
  return map;
}

/** 資料に固有の語 → その語を含む資料の ID。 */
function termIndex(texts: Map<string, { text: string }>): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const [id, { text }] of texts) {
    for (const m of text.matchAll(KANJI_RUN)) {
      const term = m[0];
      if (META_TERMS.has(term)) continue;
      const list = index.get(term) ?? [];
      if (!list.includes(id)) list.push(id);
      index.set(term, list);
    }
  }
  return index;
}

/** AI 統合解説の本文を機械的に検証する。 */
export function validateSynthesis(text: string, input: QimenSynthesisInput): SynthesisValidation {
  const texts = itemTexts(input);
  const required = input.established.map((e) => e.id);
  const allowed = new Set(texts.keys());
  const index = termIndex(texts);
  const citedText = (ids: string[]) => ids.map((id) => texts.get(id)?.text ?? "").join("\n");

  const { claims, uncited } = splitClaims(text);
  const citedIds = [...new Set(claims.flatMap((c) => c.cited))];

  const v: SynthesisValidation = {
    passed: false,
    citedIds,
    unknownIds: citedIds.filter((id) => !allowed.has(id)),
    missingRequiredIds: required.filter((id) => !citedIds.includes(id)),
    uncitedClaims: [],
    citationMismatches: [],
    unverifiedQuotes: [],
    illegalFortuneWords: [],
    reclassifiedSection4: [],
    singleMeaningConversions: [],
    unsupportedNumbers: [],
    bannedPhrases: SYNTHESIS_BANNED_PHRASES.filter((p) => text.includes(p)),
    summaryJudgments: SYNTHESIS_SUMMARY_PHRASES.filter((p) => text.includes(p)),
    humanReviewNotes: [
      "否定の反転・微妙な言い換え・因果関係の付加・意味上の主語の変更は機械判定していません。確定資料と照らして人が確認してください。",
    ],
  };

  // 引用なしの文
  for (const u of uncited) {
    const terms = [...index.keys()].filter((t) => u.includes(t));
    if (terms.length > 0 || outerQuotes(u).length > 0 || fortuneWordsIn(u).size > 0) v.uncitedClaims.push(u.trim());
  }

  for (const c of claims) {
    const claim = c.text.trim();
    const known = c.cited.filter((id) => allowed.has(id));
    if (known.length === 0) {
      // 引用タグはあるが全て未知 ID の文は、資料の語を含めば引用なしと同じ扱い
      const terms = [...index.keys()].filter((t) => claim.includes(t));
      if (terms.length > 0) v.uncitedClaims.push(claim);
      continue;
    }
    const src = citedText(known);

    // 引用のずれ
    for (const [term, ids] of index) {
      if (!claim.includes(term) || src.includes(term)) continue;
      v.citationMismatches.push({ claim, term, foundIn: ids, cited: known });
    }
    // 「」の引用
    for (const q of outerQuotes(claim)) {
      if (!src.includes(q)) v.unverifiedQuotes.push({ claim, quote: q, cited: known });
    }
    // 吉凶語
    const srcFortune = fortuneWordsIn(src);
    for (const w of fortuneWordsIn(claim)) {
      if (!srcFortune.has(w)) v.illegalFortuneWords.push({ claim, word: w, cited: known });
    }
    // section4 の分類し直し
    if (known.every((id) => texts.get(id)?.section === "section4")) {
      for (const e of SECTION4_RECLASS) {
        if (claim.includes(e) && !src.includes(e)) v.reclassifiedSection4.push({ claim, expression: e, cited: known });
      }
    } else if (known.some((id) => texts.get(id)?.section === "section4") && fortuneWordsIn(claim).size > 0) {
      v.humanReviewNotes.push(`吉凶表記なしの材料と他の材料を同じ文で引用し、吉凶語を使っています（人の確認が必要）: ${claim}`);
    }
    // 単体象意からの許可・推奨
    if (known.every((id) => texts.get(id)?.section === null)) {
      for (const e of SINGLE_CONVERSION) {
        if (claim.includes(e) && !src.includes(e)) v.singleMeaningConversions.push({ claim, expression: e, cited: known });
      }
    }
    // 数字＋単位
    for (const m of claim.matchAll(NUMBER_EXPR)) {
      if (!src.includes(m[0])) v.unsupportedNumbers.push({ claim, value: m[0], cited: known });
    }
    // 因果の表現（人の確認）
    const causal = CAUSAL.filter((w) => claim.includes(w) && !src.includes(w));
    if (causal.length > 0) {
      v.humanReviewNotes.push(`資料に無い因果の表現（${causal.join("・")}）があります（人の確認が必要）: ${claim}`);
    }
  }

  v.passed =
    v.unknownIds.length === 0 &&
    v.missingRequiredIds.length === 0 &&
    v.uncitedClaims.length === 0 &&
    v.citationMismatches.length === 0 &&
    v.unverifiedQuotes.length === 0 &&
    v.illegalFortuneWords.length === 0 &&
    v.reclassifiedSection4.length === 0 &&
    v.singleMeaningConversions.length === 0 &&
    v.unsupportedNumbers.length === 0 &&
    v.bannedPhrases.length === 0 &&
    v.summaryJudgments.length === 0;
  return v;
}
