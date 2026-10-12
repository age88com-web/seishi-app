// tests/ziwei_rule_interpretation.manual.ts
//
// アプリ内・資料ベースの宮別解釈（src/lib/ziwei/meanings/ruleInterpretation.ts、buildRuleBasedInterpretation）の確認。
// 実行: npx tsx tests/ziwei_rule_interpretation.manual.ts
//
// 命盤A・Bの全12宮 × brief・standard・detailed で、次を確認する:
//   同じ入力で完全に同じ結果・全ての文に元データ ID・存在しない ID を使わない・文は「固定の前置き＋資料の文」だけ
//   （資料外の文を作らない）・一部一致・needs_review・条件付きの文を本文に使わない・資料外の固定助言文が無い・
//   brief ≤ standard ≤ detailed の情報量・A は本文に使う（前文が使えないものを除く）・文字数の上限（A だけで超える場合を除く）。

import { calculateZiweiChart } from "../src/lib/ziwei";
import type { Branch, ZiweiChart } from "../src/lib/ziwei";
import {
  buildAiMeaningContext,
  buildPalaceMeaningContext,
  COMBINATION_MEANINGS,
  PALACE_MEANINGS,
  STAR_MEANINGS,
  STAR_PALACE_MEANINGS,
  TRANSFORMATION_MEANINGS,
} from "../src/lib/ziwei/meanings";
import type { AiDetailLevel } from "../src/lib/ziwei/meanings";
import { buildRuleBasedInterpretation, INTERPRETATION_THEMES } from "../src/lib/ziwei/meanings/ruleInterpretation";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}

const BRANCHES = "子丑寅卯辰巳午未申酉戌亥".split("") as Branch[];
const LEVELS: AiDetailLevel[] = ["brief", "standard", "detailed"];
const ENTRY = new Map(
  [...STAR_MEANINGS, ...TRANSFORMATION_MEANINGS, ...PALACE_MEANINGS, ...STAR_PALACE_MEANINGS, ...COMBINATION_MEANINGS].map((e) => [e.id, e]),
);
/** 資料に無ければ生成してはいけない助言・評価の表現（AI 実証で混入したものを含む） */
const ADVICE_PHRASES = ["バランス", "求められ", "心がけ", "注意が必要", "重要です", "大切です", "おすすめ", "べきです", "吉", "凶", "運勢", "将来"];

const charts: [string, ZiweiChart][] = [
  ["A", calculateZiweiChart({ birth: { year: 1955, month: 10, day: 16, hour: 15, minute: 55 }, place: "東京", sex: "female" })],
  ["B", calculateZiweiChart({ birth: { year: 1964, month: 12, day: 21, hour: 6, minute: 0 }, place: "東京", sex: "male" })],
];

for (const [cid, chart] of charts) {
  for (const b of BRANCHES) {
    const ctx = buildPalaceMeaningContext(chart, b);
    const byLevel = Object.fromEntries(LEVELS.map((lv) => [lv, buildRuleBasedInterpretation(ctx, { detailLevel: lv })])) as Record<
      AiDetailLevel,
      ReturnType<typeof buildRuleBasedInterpretation>
    >;
    const tag0 = `${cid}/${ctx.palace.name}(${b})`;
    const starNames = ctx.stars.map((s) => s.name as string);

    check(
      `${tag0} brief ≤ standard ≤ detailed`,
      byLevel.brief.counts.usedSourceIds <= byLevel.standard.counts.usedSourceIds &&
        byLevel.standard.counts.usedSourceIds <= byLevel.detailed.counts.usedSourceIds,
    );

    for (const lv of LEVELS) {
      const r = byLevel[lv];
      const tag = `${tag0}/${lv}`;
      const ai = buildAiMeaningContext(ctx, { detailLevel: lv });
      const allowed = new Set([...ai.keyMeanings.map((m) => m.id), ...ai.contextSentences.map((s) => s.id)]);
      const refIds = new Set(ai.referenceOnly.map((x) => x.id));
      const reviewIds = new Set(ai.reviewItems.flatMap((x) => x.meanings.map((m) => m.id)));

      // 決定論: 同じ入力で完全に同じ結果
      check(`${tag} 同一入力で同一`, JSON.stringify(buildRuleBasedInterpretation(ctx, { detailLevel: lv })) === JSON.stringify(r));

      const sentences = r.sections.flatMap((s) => s.sentences);
      const usedPrimary = new Set(sentences.filter((s) => s.role === "primary").flatMap((s) => s.sourceIds));
      for (const s of sentences) {
        check(`${tag} 文に根拠ID`, s.sourceIds.length > 0, s.text);
        for (const id of s.sourceIds) {
          check(`${tag} ${id} は実在`, ENTRY.has(id));
          check(`${tag} ${id} は選別済みの資料`, allowed.has(id));
          check(`${tag} ${id} は参考（一部一致・条件未判定）でない`, !refIds.has(id));
          check(`${tag} ${id} は要確認でない`, !reviewIds.has(id));
          if (ENTRY.get(id)?.condition) check(`${tag} ${id} は条件付きなら条件成立`, r.counts.conditionMetInBody.includes(id), ENTRY.get(id)?.condition ?? "");
        }
        // 文は「固定の前置き＋資料の文」だけ（資料の文は書き換えない）
        const e = ENTRY.get(s.sourceIds[0]);
        check(`${tag} ${s.sourceIds[0]} 本文はデータの表示文のまま`, !!e && s.text === `${s.prefix}${e.text}`);
        // 表示しない文（空文）は選別だけ保ち、前置き・判断根拠を付けない（§35）
        if (e?.text === "") check(`${tag} ${s.sourceIds[0]} 空文は前置き・判断根拠なし`, s.text === "" && s.prefix === "" && s.basis === "");
        else check(`${tag} ${s.sourceIds[0]} 判断根拠あり`, s.basis.length > 0 && r.sections.some((sec) => sec.sentences.includes(s) && sec.basis.includes(s.basis)));
        const prefixOk = new RegExp(
          `^(一方で、)?(また、)?(${starNames.map((n) => `${n}については、`).join("|") || "(?!)"})?(${ctx.palace.name}は、)?$`,
        ).test(s.prefix);
        check(`${tag} 前置きは固定のものだけ`, prefixOk, s.prefix);
        if (s.role === "context") check(`${tag} 補助文は前置きなし`, s.prefix === "");
      }
      // 補助文は直後の主文の前文としてだけ現れる
      for (const sec of r.sections) {
        sec.sentences.forEach((s, i) => {
          if (s.role !== "context") return;
          const next = sec.sentences.slice(i + 1).find((x) => x.role === "primary");
          check(`${tag} 補助文 ${s.sourceIds[0]} の後に主文`, !!next && (next.contextIds ?? []).includes(s.sourceIds[0]));
        });
        check(`${tag} 節の根拠`, JSON.stringify(sec.sourceIds) === JSON.stringify([...new Set(sec.sentences.flatMap((s) => s.sourceIds))]));
        check(`${tag} 節の文`, sec.text === sec.sentences.map((s) => s.text).join(""));
      }
      // 節はテーマ順・重複なし
      const themes = r.sections.map((s) => s.theme);
      check(`${tag} テーマの順序`, themes.every((t, i) => i === 0 || INTERPRETATION_THEMES.indexOf(themes[i - 1]) < INTERPRETATION_THEMES.indexOf(t)));
      // 同じ資料の文を二度使わない
      check(`${tag} 同じ資料を重複して使わない`, usedPrimary.size === sentences.filter((s) => s.role === "primary").length);
      // 資料外の固定助言文を作らない（資料の文にあるときだけ許す）
      const usedTexts = sentences.map((s) => s.text).join("\n");
      for (const p of ADVICE_PHRASES) check(`${tag} 資料外の表現「${p}」なし`, !r.fullText.includes(p) || usedTexts.includes(p));
      // A はすべて本文に使う（前文が本文に使えないものは excluded に理由つきで残す）
      for (const m of ai.keyMeanings.filter((x) => x.rank === "A")) {
        check(`${tag} A ${m.id} を本文に使う`, usedPrimary.has(m.id) || r.excluded.some((x) => x.id === m.id));
      }
      // 文字数: B を足したときは目安の上限以内
      if (r.counts.rankB > 0) check(`${tag} 文字数の上限（原文換算）`, r.counts.budgetCharCount <= r.counts.lengthTarget[1], `${r.counts.budgetCharCount}`);
      check(`${tag} 出典`, r.sources.length > 0 === sentences.length > 0);
    }
  }
}

// 命盤A 命宮（寅）
{
  const ctx = buildPalaceMeaningContext(charts[0][1], "寅");
  const [brief, standard, detailed] = LEVELS.map((lv) => buildRuleBasedInterpretation(ctx, { detailLevel: lv }));
  // 文字数の目安は原文換算（budgetCharCount）で判定する（表示文は書き直してあるため長さが少し違う。§35）
  check("命盤A 命宮 standard は 500〜800字（原文換算）", standard.counts.budgetCharCount >= 500 && standard.counts.budgetCharCount <= 800, `${standard.counts.budgetCharCount}`);
  check("命盤A 命宮 detailed は 1000〜1500字（原文換算）", detailed.counts.budgetCharCount >= 1000 && detailed.counts.budgetCharCount <= 1500, `${detailed.counts.budgetCharCount}`);
  console.log(`命盤A 命宮 表示文字数: standard ${standard.counts.charCount}・detailed ${detailed.counts.charCount}（原文換算 ${standard.counts.budgetCharCount}・${detailed.counts.budgetCharCount}）`);
  check("命盤A 命宮 brief < standard < detailed（資料数）", brief.counts.usedSourceIds < standard.counts.usedSourceIds && standard.counts.usedSourceIds < detailed.counts.usedSourceIds);
  check("命盤A 命宮 テーマ別（3テーマ以上）", standard.sections.length >= 3);
  const personality = standard.sections.find((s) => s.theme === "性格・人物像");
  check("命盤A 命宮 性格の節に複数の星", !!personality && new Set(personality.sentences.map((s) => s.sourceIds[0].slice(0, 4))).size >= 1 && personality.sourceIds.length >= 2);
  check("命盤A 命宮 完全一致の組み合わせ N-CB-0192 を使う", standard.sections.some((s) => s.sourceIds.includes("N-CB-0192")));
  check("命盤A 命宮 短所 N-ST-0705 を短所・注意に", standard.sections.some((s) => s.theme === "短所・注意" && s.sourceIds.includes("N-ST-0705")));
  check("命盤A 命宮 一部一致を使わない", !standard.fullText.includes("好奇心旺盛") && !standard.fullText.includes("独りよがり"));
  check(
    "命盤A 命宮 前文 N-ST-0180 が条件不成立の N-ST-0181 は本文外（理由つき）",
    !standard.sections.some((s) => s.sourceIds.some((id) => id === "N-ST-0181" || id === "N-ST-0180")) &&
      standard.conditionExcluded.some((x) => x.id === "N-ST-0181" && x.reason.includes("N-ST-0180")),
  );
}

const fail = failures.length;
console.log(`資料ベース解釈: ${pass} / ${pass + fail} PASS`);
if (fail > 0) {
  console.log(failures.slice(0, 60).join("\n"));
  process.exit(1);
}
process.exit(0);
