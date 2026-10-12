// src/lib/ziwei/meanings/aiSummary.ts
//
// 宮別象意の AI 要約（実証テスト用）。docs/ziwei-basic-spec.md §21.11。
//   - buildAiSummaryPrompt: buildAiMeaningContext() が選別した資料だけから、AI（ローカル Ollama）への
//     プロンプトを作る。象意データ全体は渡さない。一部一致・条件未判定の参考（referenceOnly）は渡さない。
//   - verifyAiSummary: AI の生出力とは別に、根拠 ID・引用・資料外の語を機械的に検証する。
// AI は「資料を整理して自然な日本語にまとめる編集者」として使う。占断・補完・予測はさせない。
// ネットワーク呼び出しは持たない（ollamaClient.ts / API ルート側）。

import type { AiMeaningContext, AiMeaningKind, SourceRef } from "./types";

/** 詳しさごとの文字数の目安（§21.10） */
export const AI_SUMMARY_LENGTH: Readonly<Record<AiMeaningContext["detailLevel"], readonly [number, number]>> = {
  brief: [200, 300],
  standard: [500, 800],
  detailed: [1000, 1500],
};

const KIND_LABEL: Readonly<Record<AiMeaningKind, string>> = {
  starPalace: "星×宮",
  starBase: "星の基本象意",
  combination: "同宮の組み合わせ（完全一致）",
  transformation: "四化",
  jiahui: "三方四正の加会（完全一致）",
  palace: "宮そのものの意味",
};

function sourceLabel(r: SourceRef): string {
  return r.source === "紫微斗数入門" ? `入門 p.${r.docPage ?? r.pdfPage}` : `基礎編 S${r.pdfPage}`;
}

export interface AiSummaryPrompt {
  system: string;
  user: string;
  /** 根拠として使ってよい資料 ID（主文） */
  materialIds: string[];
  /** 本文理解の補助として渡した前後の文の ID（単独の根拠にしない） */
  contextIds: string[];
  /** 主文と同内容として代表にまとめた別収録・別資料の ID（引用されても可） */
  alsoInIds: string[];
  /** 送った資料の件数 */
  counts: { materials: number; contextSentences: number; reviewItems: number };
}

const SYSTEM_PROMPT = `あなたは紫微斗数の資料を整理する日本語の編集者です。占い師ではありません。
入力された「資料」だけを使い、その宮の象意を自然な日本語の文章にまとめてください。

# 禁止（必ず守る）
- 入力資料にない象意を追加しない。
- あなた自身の紫微斗数の知識や一般的な解釈で補完しない。
- 星の吉凶を勝手に付け加えない。
- 旺衰（廟・旺・得地・利益・平和・不得地・陥）から独自に吉凶や強弱を推測しない。資料に旺衰による違いの記述がなければ、旺衰には触れない。
- 四化（化禄・化権・化科・化忌）の意味を資料外から補わない。
- 「参考・条件未充足」の組み合わせは入力に含めていない。入力にない組み合わせを成立したものとして書かない。
- 「要確認」の資料は確定事項として扱わない。
- 三方四正を独自のルールで総合判断しない。三方四正の構造は参考情報であり、解釈に使ってよいのは資料欄に明記された加会・組み合わせだけ。
- 将来の予測、運勢の時期の推測をしない。
- 資料にない数字・年齢・時期を書かない。

# 行うこと
- 重複する内容をまとめる。
- 星ごとの羅列（「○○星は〜。△△星は〜。」の順番説明）を避け、共通する特徴を整理する。
- 相反する特徴があれば両方残す。
- 長所だけでなく、資料にあれば短所・注意点も含める。
- 読みやすい日本語に整える。

# 構成
資料に材料がある範囲で、次の順に自然につなぐ（材料がない項目は書かない。見出しは付けない）:
全体傾向 → 性格・人物像 → 長所・能力 → 仕事・社会性 → 人間関係 → 注意点

# 補助文
「補助文」は、直後の資料の本文を理解するための前後の文です。補助文を独立した象意として書き足したり、重ねて解釈したりしない。補助文だけを根拠にしない。

# 根拠の書き方
- 段落ごとに、その段落で使った資料の ID を段落の末尾に [根拠: ID, ID] の形で必ず付ける。
- 使ってよい ID は入力の資料 ID だけ。存在しない ID を作らない。
- 資料の文を「」で引用する場合は、資料の文をそのまま使う。

# 出力
- 日本語の地の文だけ。見出し・箇条書き・前置き・締めの挨拶は書かない。
- 分量の目安は {LENGTH} 字（根拠の表記を除く）。資料にない内容で分量を増やさない。`;

/** 選別済みの AI 用コンテキストから、Ollama へ送るプロンプトを作る */
export function buildAiSummaryPrompt(ai: AiMeaningContext): AiSummaryPrompt {
  const [minLen, maxLen] = AI_SUMMARY_LENGTH[ai.detailLevel];
  const sentenceById = new Map<string, { text: string; ref: SourceRef }>([
    ...ai.keyMeanings.map((m): [string, { text: string; ref: SourceRef }] => [m.id, m]),
    ...ai.contextSentences.map((s): [string, { text: string; ref: SourceRef }] => [s.id, s]),
  ]);

  const lines: string[] = [];
  lines.push(`# 対象: ${ai.palace.name}（${ai.palace.branch}）${ai.palace.isShenPalace ? "・身宮" : ""}`);
  lines.push("");
  lines.push("# 本宮の星（構造情報。旺衰・四化は資料に記述がなければ解釈しない）");
  if (ai.stars.length === 0) lines.push("- なし");
  for (const s of ai.stars) {
    lines.push(
      `- ${s.name}${s.isMain ? "（主星）" : ""}・旺衰: ${s.strength ?? "なし"}・四化: ${s.transformations.length ? s.transformations.join("、") : "なし"}`,
    );
  }
  lines.push("");
  lines.push("# 三方四正（構造情報のみ。これだけを理由に意味を作らない）");
  for (const p of [ai.sanfangSizheng.self, ai.sanfangSizheng.opposite, ...ai.sanfangSizheng.trines]) {
    const stars = p.stars.map((s) => `${s.name}${s.transformations.length ? `（${s.transformations.join("、")}）` : ""}`).join("、");
    lines.push(`- ${p.role} ${p.name}（${p.branch}）: ${stars || "星なし"}`);
  }
  lines.push("");
  lines.push("# 資料（根拠に使ってよいのはこの ID だけ）");
  for (const m of ai.keyMeanings) {
    const stars = m.stars.length ? `・${m.stars.join("・")}` : "";
    for (const id of m.context?.previous ?? []) {
      const s = sentenceById.get(id);
      if (s) lines.push(`  （補助文・前 ${id}）${s.text}`);
    }
    lines.push(`- [${m.id}] ${KIND_LABEL[m.kind]}${stars}（${sourceLabel(m.ref)}）: ${m.text}`);
    for (const id of m.context?.next ?? []) {
      const s = sentenceById.get(id);
      if (s) lines.push(`  （補助文・後 ${id}）${s.text}`);
    }
  }
  if (ai.reviewItems.length > 0) {
    lines.push("");
    lines.push("# 要確認（資料間で扱いが分かれている。確定事項として書かない）");
    for (const r of ai.reviewItems) {
      lines.push(`- ${r.topic}: ${r.note ?? ""}`);
      for (const m of r.meanings) lines.push(`  - [${m.id}]（${sourceLabel(m.ref)}）${m.text}`);
    }
  }
  lines.push("");
  lines.push(`上の資料だけを使い、${minLen}〜${maxLen}字程度の文章にまとめてください。`);

  return {
    system: SYSTEM_PROMPT.replace("{LENGTH}", `${minLen}〜${maxLen}`),
    user: lines.join("\n"),
    materialIds: ai.keyMeanings.map((m) => m.id),
    contextIds: ai.contextSentences.map((s) => s.id),
    alsoInIds: ai.keyMeanings.flatMap((m) => (m.alsoIn ?? []).map((x) => x.id)),
    counts: {
      materials: ai.keyMeanings.length,
      contextSentences: ai.contextSentences.length,
      reviewItems: ai.reviewItems.reduce((n, r) => n + r.meanings.length, 0),
    },
  };
}


// ---------------------------------------------------------------------------
// 検証（AI の生出力とは別に持つ）
//   奇門遁甲の検証器（src/lib/qimenAiMaterials/synthesisValidation.ts）と同じ考え方・項目名で、
//   文字列の一致だけで機械的に判定する（AI・意味の類似度は使わない）。機械的に判定できないもの
//   （言い換え・否定の反転・因果の付加・資料外の意味の混入）は humanReviewNotes に回し、自動で正しいとはしない。
//
//   文の単位: 段落ごとに、末尾の [根拠: ID, …] をその段落の根拠とする。根拠のない段落は「根拠なしの段落」。
//   資料に固有の語: 入力資料の文から取り出した漢字2字以上の連なりのうち、多くの資料に共通する語を除いたもの。
// ---------------------------------------------------------------------------

/** 吉凶語（長い語から照合する）。資料の根拠に無ければ illegalFortuneWords */
const FORTUNE_WORDS = ["大吉", "大凶", "不吉", "吉運", "凶運", "吉星", "凶星", "吉", "凶"];
/** 予測・時期・運勢の語。入力資料のどの文にも無ければ possibleOutsideTerms（資料外の可能性） */
export const OUTSIDE_TERM_CANDIDATES: readonly string[] = [
  "運勢", "開運", "将来", "未来", "晩年", "若い頃", "時期", "年齢", "大限", "小限", "流年",
  "廟", "得地", "利益", "平和", "不得地", "化禄", "化権", "化科", "化忌",
  "三方四正", "対宮", "三合", "加会", "財運", "金運", "健康運", "結婚運",
];
const NUMBER_WITH_UNIT = /[0-9０-９一二三四五六七八九十百]+\s*(?:歳|才|年|ヶ月|か月|月|日|%|％|人|回)/g;
const CITATION = /\[根拠[:：]\s*([^\]]*)\]/g;

export interface AiSummaryParagraph {
  text: string;
  citedIds: string[];
}

export interface AiSummaryVerification {
  /** 機械的な却下条件（unknownIds・uncitedClaims・citationMismatches・unverifiedQuotes・illegalFortuneWords・unsupportedNumbers）が無い */
  passed: boolean;
  /** 根拠表記を除いた本文の文字数（空白・改行を除く） */
  charCount: number;
  lengthTarget: readonly [number, number];
  withinLength: boolean;
  paragraphs: AiSummaryParagraph[];
  citedIds: string[];
  /** 入力に無い ID の引用 */
  unknownIds: string[];
  /** 根拠 ID の無い段落 */
  uncitedClaims: string[];
  /** 段落中の資料に固有の語が、引用した資料には無く、別の資料にだけある／補助文や参考だけを根拠にしている */
  citationMismatches: { paragraph: number; issue: string; term?: string; foundIn?: string[]; cited: string[] }[];
  /** 「」の中の文字列が、引用した資料の文にそのまま無い */
  unverifiedQuotes: { paragraph: number; quote: string; cited: string[] }[];
  /** 吉凶語が、引用した資料の文に無い */
  illegalFortuneWords: { paragraph: number; word: string; cited: string[] }[];
  /** 数字＋単位（歳・年・月 など）が、引用した資料に無い */
  unsupportedNumbers: { paragraph: number; value: string; cited: string[] }[];
  /** 入力資料のどの文にも無い予測・旺衰・四化・三方四正などの語（資料外の可能性。人が確認する） */
  possibleOutsideTerms: string[];
  /** 入力の資料 ID のうち引用されなかったもの（情報） */
  unusedMaterialIds: string[];
  /** 機械的に判定できないため人が確認すること */
  humanReviewNotes: string[];
}

/** 漢字2字以上の連なり */
function kanjiTerms(s: string): string[] {
  return [...new Set(s.match(/[一-鿿々]{2,}/g) ?? [])];
}

export function verifyAiSummary(content: string, ai: AiMeaningContext, prompt: AiSummaryPrompt): AiSummaryVerification {
  const text = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const material = new Set(prompt.materialIds);
  const contextOnly = new Set(prompt.contextIds);
  const alsoIn = new Set(prompt.alsoInIds);
  const reviewIds = new Set(ai.reviewItems.flatMap((r) => r.meanings.map((m) => m.id)));
  const referenceIds = new Set(ai.referenceOnly.map((r) => r.id));
  const known = new Set([...material, ...contextOnly, ...alsoIn, ...reviewIds]);

  // ID → 資料の文（alsoIn は代表の文で照合する）
  const textById = new Map<string, string>();
  for (const m of ai.keyMeanings) {
    textById.set(m.id, m.text);
    for (const x of m.alsoIn ?? []) textById.set(x.id, m.text);
  }
  for (const s of ai.contextSentences) textById.set(s.id, s.text);
  for (const r of ai.reviewItems) for (const m of r.meanings) textById.set(m.id, m.text);
  const materialTexts = ai.keyMeanings.map((m) => ({ id: m.id, text: m.text }));
  const allInputText = [...textById.values()].join("\n");

  // 資料に固有の語: 資料の 20% 以上に出る語（性格・命宮など共通の語）は除く
  const termCount = new Map<string, number>();
  for (const m of materialTexts) for (const t of kanjiTerms(m.text)) termCount.set(t, (termCount.get(t) ?? 0) + 1);
  const common = new Set([...termCount].filter(([, n]) => n >= Math.max(2, materialTexts.length * 0.2)).map(([t]) => t));
  const distinctive = [...termCount.keys()].filter((t) => !common.has(t)).sort((a, b) => b.length - a.length);

  const paragraphs: AiSummaryParagraph[] = text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      const ids: string[] = [];
      for (const m of p.matchAll(CITATION)) {
        for (const id of m[1].split(/[,、，\s]+/).map((x) => x.trim()).filter(Boolean)) if (!ids.includes(id)) ids.push(id);
      }
      return { text: p, citedIds: ids };
    });

  const citedIds = [...new Set(paragraphs.flatMap((p) => p.citedIds))];
  const unknownIds = citedIds.filter((id) => !known.has(id));
  const uncitedClaims = paragraphs.filter((p) => p.citedIds.length === 0).map((p) => p.text);

  const citationMismatches: AiSummaryVerification["citationMismatches"] = [];
  const unverifiedQuotes: AiSummaryVerification["unverifiedQuotes"] = [];
  const illegalFortuneWords: AiSummaryVerification["illegalFortuneWords"] = [];
  const unsupportedNumbers: AiSummaryVerification["unsupportedNumbers"] = [];

  paragraphs.forEach((p, i) => {
    const n = i + 1;
    const body = p.text.replace(CITATION, "");
    const cited = p.citedIds;
    const citedText = cited.map((id) => textById.get(id) ?? "").join("\n");
    if (cited.length === 0) return;

    if (cited.every((id) => contextOnly.has(id) || !known.has(id)) && cited.some((id) => contextOnly.has(id))) {
      citationMismatches.push({ paragraph: n, issue: "補助文だけを根拠にしている", cited });
    }
    const refs = cited.filter((id) => referenceIds.has(id));
    if (refs.length > 0) citationMismatches.push({ paragraph: n, issue: "参考（一部一致・条件未判定）の ID を根拠にしている", cited: refs });

    // 資料に固有の語が、引用した資料に無く、別の資料にだけある
    let rest = body;
    for (const term of distinctive) {
      if (!rest.includes(term)) continue;
      rest = rest.split(term).join("");
      if (citedText.includes(term)) continue;
      const foundIn = materialTexts.filter((m) => m.text.includes(term)).map((m) => m.id);
      if (foundIn.length > 0) citationMismatches.push({ paragraph: n, issue: "引用していない資料にだけある語", term, foundIn, cited });
    }

    for (const m of body.matchAll(/「([^」]{4,})」/g)) {
      if (!citedText.includes(m[1])) unverifiedQuotes.push({ paragraph: n, quote: m[1], cited });
    }
    let fortuneRest = body;
    for (const w of FORTUNE_WORDS) {
      if (!fortuneRest.includes(w)) continue;
      fortuneRest = fortuneRest.split(w).join("");
      if (!citedText.includes(w)) illegalFortuneWords.push({ paragraph: n, word: w, cited });
    }
    for (const m of body.matchAll(NUMBER_WITH_UNIT)) {
      if (!citedText.includes(m[0])) unsupportedNumbers.push({ paragraph: n, value: m[0], cited });
    }
  });

  const bodyAll = text.replace(CITATION, "");
  const possibleOutsideTerms = OUTSIDE_TERM_CANDIDATES.filter((t) => bodyAll.includes(t) && !allInputText.includes(t));
  const charCount = bodyAll.replace(/\s/g, "").length;
  const lengthTarget = AI_SUMMARY_LENGTH[ai.detailLevel];

  return {
    passed:
      unknownIds.length === 0 &&
      uncitedClaims.length === 0 &&
      citationMismatches.length === 0 &&
      unverifiedQuotes.length === 0 &&
      illegalFortuneWords.length === 0 &&
      unsupportedNumbers.length === 0,
    charCount,
    lengthTarget,
    withinLength: charCount >= lengthTarget[0] && charCount <= lengthTarget[1],
    paragraphs,
    citedIds,
    unknownIds,
    uncitedClaims,
    citationMismatches,
    unverifiedQuotes,
    illegalFortuneWords,
    unsupportedNumbers,
    possibleOutsideTerms,
    unusedMaterialIds: prompt.materialIds.filter((id) => !citedIds.includes(id)),
    humanReviewNotes: [
      "言い換え・要約が資料の意味から外れていないか（機械的には判定しない）。",
      "資料に無い性格・能力・対人傾向などを付け加えていないか。",
      "相反する記述の一方を落としていないか、否定を反転していないか。",
      "旺衰・四化・三方四正から独自の解釈を加えていないか。",
    ],
  };
}
