// src/lib/qimenAiMaterials/synthesisPrompt.ts
//
// 役割:
//   AI 統合解説（確定資料とは別枠の説明文）を作らせるためのプロンプトを組み立てる。
//   AI の仕事は、成立済み判断材料が同時に成立している状態を読み手が理解しやすい文章に整理することだけ。
//   原文の再現・転記、単体象意の解釈、占断そのものはさせない（確定資料はプログラムが別に全文表示する）。
//   旧 generationPrompt.ts（材料全体の文章化）とは別物で、そちらは変更しない。
//
// 構成:
//   ===== INSTRUCTIONS =====     固定命令（synthesisPromptInstructions(N)。成立済み判断材料の件数 N だけが盤ごとに変わる）
//   ===== REQUIRED IDS =====     根拠として扱う ID（成立済み材料・分類未確定資料の全件）
//   ===== MATERIALS =====        宮（宮番号・八卦）と成立済み判断材料の JSON（番号は付けない）
//   ===== END MATERIALS =====
//   単体象意は入力に含めない（入力に含まれていてもプロンプトには出さない）。

import { requiredSynthesisIds } from "./synthesisInput";
import type { QimenSynthesisInput, SynthesisEstablished } from "./synthesisInput";

export const SYNTHESIS_PROMPT_DELIMITERS = {
  instructions: "===== INSTRUCTIONS =====",
  requiredIds: "===== REQUIRED IDS =====",
  materials: "===== MATERIALS =====",
  endMaterials: "===== END MATERIALS =====",
} as const;

/** 成立済み判断材料の件数に応じた「全件を扱う」指示。 */
function allMaterialsLine(n: number): string {
  return n > 0
    ? `・成立済み判断材料は全${n}件です（REQUIRED IDS の${n}件）。${n}件すべてを、本文のどこかで根拠として扱ってください。1件でも扱わないと統合解説は採用されません。`
    : "・この宮には成立済み判断材料がありません。材料について書く必要はありません。";
}

/** 固定命令（全文）。成立済み判断材料の件数 N の行以外は盤によって変わらない。 */
export function synthesisPromptInstructions(n: number): string {
  return `あなたは奇門遁甲を自分で占断するAIではありません。
盤の計算、各資料の原文、具体的な条件は、プログラムが「確定資料」として読者に別に全文表示します。
あなたの仕事は、この宮で成立している判断材料全体を見て、それらが同時に成立している状態を、読み手が理解しやすい文章に整理することだけです。

■ あなたの仕事
・各資料を順番に紹介することではありません。各資料の原文を書き写すことでもありません。
・成立している判断材料全体を見て、次のことを説明してください。
　どのような吉の材料があるか。
　どのような注意材料が同時にあるか。
　盤全体に関係する材料には何があるか。
　同じテーマに関係する複数の資料がある場合は、それぞれ別の資料であることを保ったまま、読み手が関係を理解できるように説明する。
・最終的な吉凶の判定はしません。
・sourceText は判断の根拠として読んでかまいませんが、全文を再現する必要はありません。距離・期間・人物・予兆・結果などの具体的な条件も、書き写す必要はありません（確定資料に表示されます）。
・要約・整理はしてかまいません。ただし、意味を変えてはいけません。

■ 意味を変えない
・ある材料の意味を、別の材料に混ぜてはいけません。各材料についての説明は、その材料自身の ID にだけ対応させてください。
・種類の違う材料を同じ種類として扱ってはいけません。各材料の type（種類）を確認してください。例えば、格局（吉格・凶格）と剋應は別の種類です。剋應を「吉格」と呼んではいけません。
・主体や対象を変えてはいけません。条件を逆にしてはいけません。
・資料にない吉凶を付けてはいけません。資料にない因果関係を作ってはいけません。
・scope が「盤全体」の材料は、盤全体に関係する材料として書き、この宮だけの材料として書いてはいけません。
・格局の sourceText に「象意（判定側）」と「象意（意味DB側）」の2つがある場合、それは同じ格局の2つの資料表現です。別々の格局として扱わず、どちらが正しいかも決めないでください。

■ すべての材料を根拠として扱う
${allMaterialsLine(n)}
・1件ずつ順番に説明する必要はありません。自然な文章の中で扱ってください。
・材料を扱った文の文末に、その材料の ID を [ ] で囲んで付けてください。[ ] の中には、REQUIRED IDS に書かれている文字列を一字も変えずにそのまま書いてください。前後に文字を加えてはいけません。
・1つの文で複数の材料を扱った場合は、その文の文末に、扱った材料の ID をすべて並べてください。ただし、どの内容がどの材料のものか分からなくなるほど、多くの材料を1つの文にまとめてはいけません。
・ID を文の途中に置いてはいけません。REQUIRED IDS にない ID を作ってはいけません。
・本文に「材料1」のような番号を書いてはいけません。材料の名称や種類で書いてください。
・同じテーマに関係する資料が複数ある場合は、1つの資料にまとめず、それぞれの内容を書いた文の文末に、それぞれの ID を付けてください。

■ 吉凶表記のない、または吉凶が混在する材料（section が section4 のもの）
・これらは、プログラムが吉とも凶とも分類していない材料です。
・「吉」「凶」「吉の材料」「凶の材料」「注意材料」などに分類し直してはいけません。
・「剋應としてこのような内容がある」という扱いにしてください。

■ 禁止事項
・MATERIALS の JSON だけを使用してください。入力にない材料を追加してはいけません。
・学習済みの奇門遁甲・風水・易・五行・占術知識を使用してはいけません。八門・九星・八神・干などの意味を自分で補ってはいけません。
・新しい吉凶の判断、最終的な総合吉凶、優先順位、吉と凶の相殺、多数決、どちらが強いかの推定、資料にない行動の助言、資料にない因果関係は、いずれも禁止です。
・section の区分はプログラム側で確定しています。区分を変えたり、吉・凶を言い直したりしてはいけません。
・次のような表現は書いてはいけません。これらに限らず、入力に無い助言は一切追加しないでください。
　「新しい事業を進めることが可能」「人との協力を重視するとよい」「タイミングを意識するとよい」「柔軟な対応が必要」「リスク管理が重要」「慎重に判断すべき」「無理をしない方がよい」「総合すると吉」「総合すると凶」「吉意の方が強い」「凶意の方が強い」

■ 形式
・見出しは付けず、2〜4段落程度の自然な日本語の文章にしてください。文字数は固定しません。
・材料名の一覧だけにしてはいけません。確定資料の全文を再掲する必要はありません。`;
}

/** 成立済み判断材料1件分（存在する項目だけ。番号は付けない）。 */
function establishedView(e: SynthesisEstablished): Record<string, unknown> {
  const h = e.header;
  const out: Record<string, unknown> = { id: e.id, section: e.section, sectionLabel: e.sectionLabel, type: h.type };
  if (h.name !== null) out.name = h.name;
  if (h.fortune !== undefined) out.fortune = h.fortune;
  if (h.category !== undefined) out.category = h.category;
  if (h.scope !== undefined) out.scope = h.scope;
  if (h.detail !== undefined) out.detail = h.detail;
  if (h.mode !== undefined) out.mode = h.mode;
  if (h.combination !== undefined) out.combination = h.combination;
  if (h.linkedKaku !== undefined) out.linkedKaku = h.linkedKaku;
  if (h.judgeDetail !== undefined) out.judgeDetail = h.judgeDetail;
  if (h.unclassifiedReason !== undefined) out.unclassifiedReason = h.unclassifiedReason;
  out.sourceText = e.sourceText;
  return out;
}

/** MATERIALS に埋め込む JSON（宮と成立済み判断材料のみ。単体象意は含めない）。 */
export function synthesisMaterials(input: QimenSynthesisInput): Record<string, unknown> {
  return {
    palace: Object.fromEntries(input.facts.filter((f) => f.label === "宮番号" || f.label === "八卦").map((f) => [f.label, f.value])),
    established: input.established.map(establishedView),
  };
}

/** 統合解説用のプロンプトを作る。入力は変更しない。 */
export function buildSynthesisPrompt(input: QimenSynthesisInput): string {
  const materials = JSON.stringify(synthesisMaterials(input), null, 2);
  for (const d of Object.values(SYNTHESIS_PROMPT_DELIMITERS)) {
    if (materials.includes(d)) throw new Error(`材料に区切り文字列が含まれています: ${d}`);
  }
  return [
    SYNTHESIS_PROMPT_DELIMITERS.instructions,
    synthesisPromptInstructions(input.established.length),
    "",
    SYNTHESIS_PROMPT_DELIMITERS.requiredIds,
    requiredSynthesisIds(input).join("\n"),
    "",
    SYNTHESIS_PROMPT_DELIMITERS.materials,
    materials,
    SYNTHESIS_PROMPT_DELIMITERS.endMaterials,
  ].join("\n");
}
