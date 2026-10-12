// src/lib/qimenAiMaterials/generationPrompt.ts
//
// 役割:
//   文章構成（QimenGenerationPlan）から、文章生成 AI（Qwen3 8B 想定）へ送る固定プロンプト文字列を
//   作るだけの層。AI の呼び出し・結果の保存・判断処理は持たない。
//
// 入力経路:
//   QimenGenerationView → buildQimenGenerationPlan → buildQimenGenerationPrompt(plan)
//
// 構成:
//   ===== INSTRUCTIONS =====      固定命令（GENERATION_PROMPT_INSTRUCTIONS。盤によって変わらない）
//   ===== ALLOWED IDS =====       Plan に含まれる ID の一覧（Plan から機械的に列挙）
//   ===== MATERIALS =====         Plan の JSON（JSON.stringify でそのまま埋め込む）
//   ===== END MATERIALS =====
//   Plan の値は要約・変換・再分類しない。Plan 自体も変更しない。
//
// 区分について:
//   材料の section1〜4 への振り分けは generationPlan.ts が確定済み。固定命令では AI に振り分け・
//   材料選択・行動判断の抽出をさせず、各項目を与えられた区分のまま全件文章化させる。

import type { QimenGenerationPlan } from "./generationPlan";

export const PROMPT_DELIMITERS = {
  instructions: "===== INSTRUCTIONS =====",
  allowedIds: "===== ALLOWED IDS =====",
  materials: "===== MATERIALS =====",
  endMaterials: "===== END MATERIALS =====",
} as const;

/** 固定命令（全文）。盤によって変わらない。 */
export const GENERATION_PROMPT_INSTRUCTIONS = `あなたは奇門遁甲を自分で占断するAIではありません。
あなたの仕事は、既に計算・判定された材料を、意味を追加・変更せず、読みやすい日本語へ編集することだけです。

■ 基本ルール
・MATERIALS の JSON（入力データ）だけを使用してください。
・学習済みの奇門遁甲・風水・易・五行・占術知識を判断材料として使用してはいけません。
・盤の計算、成立条件の再判定、材料の選択・分類、吉凶の判定、吉凶の優先順位付け、総合的な吉凶の決定をしてはいけません。
・入力にない象意・助言・解釈を追加してはいけません。

■ MATERIALS の構成
・MATERIALSのsection1〜4への分類はプログラム側ですでに確定しています。項目を別sectionへ移動してはいけません。
・各項目の item が材料そのもので、item.id がその材料の ID です。
・各項目の直下にある kind・viewPath・basis はプログラム側の管理情報です（basis は区分を決めた根拠）。文章に書く必要はありません。basis を使って区分をやり直してはいけません。item の中にある kind（例：「基本象意」「伏吟」）は材料の内容の一部です。
・section1.facts：この宮の盤の事実（label と value）。
・section1.singleMeanings：この宮にある要素（八門・九星・八神・天盤干・地盤干）が単体で持つ象意と、その要素に付いた吉凶ラベル（fortuneLabel）。
・section2・section3・section4 の items：既に成立している材料です。
　項目直下の kind が kokuo のものは剋應です（body が本文、mode は静應／動應、fortuneRaw は資料の吉凶表記）。
　項目直下の kind が palaceKaku のものは、この宮で成立している格局です。
　項目直下の kind が wholeChartKaku のものは、盤全体で成立している格局です（この宮だけの格局として書いてはいけません）。
　項目直下の kind が fuYinFanYin のものは、成立している伏吟格・反吟格に紐付いた追加資料です。
・unclassified：区分がプログラム側で確定しなかった資料です。

■ 最終回答の構成（順序を変更してはいけません）
1. この宮にある要素
　・section1.facts を全件、それぞれの ID を付けて簡潔に示してください。
　・section1.singleMeanings を全件、それぞれの ID を付けて書いてください。
2. 成立している吉方向の材料
　・section2.items を全件書いてください。
3. 成立している注意材料
　・section3.items を全件書いてください。
4. 吉凶表記のない、または吉凶が混在する成立材料
　・section4.items を全件書いてください。吉とも凶とも書き換えず、本文どおりに書いてください。
5. 分類未確定資料
　・unclassified が空でない場合だけ、この見出しを出し、元の ID と内容をそのまま示してください。2・3 へ移してはいけません。
　・unclassified が空の場合は、この見出しを出してはいけません。
・section2〜4 の items が空の区分は、見出しの下に「該当なし」と書いてください。
・最後に、次の2行をそのまま出力してください。
【入力外の判断】
なし

■ 全件の出力と ID
・section2・section3・section4 の items は、すべて最終回答に登場させてください。重要度を判断して省略してはいけません。
・各項目には、その項目自身の item.id を [ID] の形で付けてください。
・各 item の ID は、その item 本文の根拠 ID です。ID を別の item へ付け替えてはいけません。
・複数の item を1つにまとめて、1つの ID だけを付けてはいけません。item ごとに書いてください。
・同じテーマでも、別の ID なら別資料として扱ってください。例えば、wholeChartKaku の伏吟格と、fuYinFanYin の伏吟の図版資料は別資料です。意味が似ていても混ぜてはいけません。
・使用できる ID は ALLOWED IDS に列挙されたものだけです。入力に存在しない ID を作ってはいけません。

■ 単体象意（section1.singleMeanings）の扱い
・singleMeanings は「その要素が持つ単体象意」であり、この日時・この宮での行動の可否を意味しません。
・fortuneLabel（例：上吉・大吉・吉）は要素そのものの吉凶ラベルであり、この日時・この宮で成立した吉凶判断ではありません。
・例：開門の basicMeaning に「開業」があっても、「この日時は開業してよい」「新しい事業を始められる」と書いてはいけません。
・例：六合に「婚姻、交易、談判、仲介」があっても、「人と協力するとよい」という助言に変えてはいけません。
・単体象意は「〇〇の象意として〜が挙げられています」のように、要素の象意として書いてください。単体象意を成立済みの行動判断に変換してはいけません。

■ 成立済み材料（section2〜4）の本文
・これらは既存エンジンと資料によって既に成立している材料です。成立の有無を再判定してはいけません。
・元の item に含まれる具体的な判断・条件・結果を省略してはいけません。
・文章を読みやすく整えることはできますが、主語・対象・吉凶・条件・距離・時期・予兆・結果・静應／動應を変更・削除してはいけません。本文にある前後関係（例：「その後」）も保ってください。
・本文にある「宜しい」「宜しくない」「求めるべき」「行動すべきではない」「無闇に行動してはならない」等は、意味を変えずに書いてください。
・例：「「商」音（姓）の人は、財産を手に入れ」を「「商」姓の人との関係で財産を得る」のように主語や関係を変えてはいけません。
・動應の距離（例：六里（2.4km））や、「六十日以内」等の時期は、本文どおりに書いてください。

■ 吉凶が競合する場合
・吉の材料と凶の材料が同時にあっても、相殺しない・多数決しない・どちらが強いか推測しない・優先順位を作らない・最終的に吉／凶と決めないでください。
・両方の材料が存在することを、それぞれ文章化してください。
・「総合すると吉」「総合すると凶」「吉意の方が強い」「凶意の方が強い」等の表現は禁止です。

■ judgeMeaning と meaningDb
・格局の judgeMeaning と meaningDb は、同じ格局についての複数の既存表現です。別々の格局として扱ってはいけません。
・内容が重複する場合、同じ意味を不自然に二度繰り返す必要はありません。
・ただし、一方にしかない内容を削除してはいけません。
・内容に差があっても、どちらが正しいか決めたり、新しい意味に統合したりしてはいけません。

■ 伏吟・反吟（fuYinFanYin）
・fuYinFanYin は MATERIALS で既に区分されています。本文を読んで吉凶を再判定してはいけません。
・linkedSubtypes・fortuneHeading・fortuneText に存在する内容だけを書いてください。
・MATERIALS に存在しない伏吟・反吟の資料（例：直符反吟の図版資料）を、学習済みの知識から補ってはいけません。

■ 禁止する表現・推論
次のような一般的な人生助言は、資料に根拠がない限り書いてはいけません。これらに限らず、入力に無い助言は一切追加しないでください。
・「新しい事業を進めることが可能」
・「人との協力を重視するとよい」
・「タイミングを意識するとよい」
・「柔軟な対応が必要」
・「リスク管理が重要」
・「慎重に判断すべき」
・「無理をしない方がよい」

■ 文章量
・文字数の目安はありません。全ての成立済み材料と必要な具体条件を保持することを、文字数より優先してください。
・不必要に冗長な説明は避けてください。ただし、文字数を減らすために材料を落としてはいけません。`;

/** Plan に含まれる ID（section1 → section4 → unclassified の順）。 */
export function listGenerationPlanIds(plan: QimenGenerationPlan): string[] {
  return [
    ...plan.section1.facts, ...plan.section1.singleMeanings,
    ...plan.section2.items, ...plan.section3.items, ...plan.section4.items,
    ...plan.unclassified,
  ].map((p) => p.item.id);
}

/** 文章構成（Generation Plan）から、文章生成 AI へ送る固定プロンプトを作る。Plan は変更しない。 */
export function buildQimenGenerationPrompt(plan: QimenGenerationPlan): string {
  const materials = JSON.stringify(plan, null, 2);
  const ids = listGenerationPlanIds(plan);
  for (const d of Object.values(PROMPT_DELIMITERS)) {
    if (materials.includes(d) || ids.some((id) => id.includes(d))) {
      throw new Error(`材料に区切り文字列が含まれています: ${d}`);
    }
  }
  return [
    PROMPT_DELIMITERS.instructions,
    GENERATION_PROMPT_INSTRUCTIONS,
    "",
    PROMPT_DELIMITERS.allowedIds,
    ids.join("\n"),
    "",
    PROMPT_DELIMITERS.materials,
    materials,
    PROMPT_DELIMITERS.endMaterials,
  ].join("\n");
}
