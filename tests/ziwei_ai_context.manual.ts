// tests/ziwei_ai_context.manual.ts
//
// AI 入力用の象意選別（src/lib/ziwei/meanings/aiContext.ts、buildAiMeaningContext）の確認。
// 実行: npx tsx tests/ziwei_ai_context.manual.ts
//
// 命盤A（入門 p.16）・命盤B（基礎編 S19）の全12宮 × detailLevel（brief・standard・detailed）で、次を確認する:
//   A ランクは件数上限で消えない（どの detailLevel でも同じ）・standard は従来（一律に絞っていた版）より多く、
//   detailed は standard 以上・採用件数は目安の上限以内（A が上限を超える場合を除く）・星×宮が基本象意より先・
//   命宮の星×宮は資料上の分類（カテゴリ・タグ）ごとに代表が A に入る・完全一致の組み合わせだけ採用・
//   一部一致と条件付きの文は通常材料に入らず参考に残る・三方四正4宮の構造が残る・needs_review が消えない・
//   出典が保持される・omittedCount が正しい。

import { evaluatePowerCondition } from "../src/lib/ziwei/meanings/powerCondition";
import { calculateZiweiChart } from "../src/lib/ziwei";
import type { Branch, ZiweiChart } from "../src/lib/ziwei";
import {
  AI_DETAIL_LEVELS,
  buildAiMeaningContext,
  buildPalaceMeaningContext,
  COMBINATION_MEANINGS,
  PALACE_MEANINGS,
  STAR_MEANINGS,
  STAR_PALACE_MEANINGS,
  TRANSFORMATION_MEANINGS,
  opensWithConnective,
  sentenceDependency,
} from "../src/lib/ziwei/meanings";
import type { AiDetailLevel, AiMeaningContext, ContextMeaning, PalaceMeaningContext } from "../src/lib/ziwei/meanings";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}

const BRANCHES = "子丑寅卯辰巳午未申酉戌亥".split("") as Branch[];
const LEVELS: AiDetailLevel[] = ["brief", "standard", "detailed"];
/** 前回（detailLevel 導入前、一律に絞っていた版）の命盤A 命宮の採用件数 */
const PREVIOUS_MING_A_SELECTED = 17;

const ALL_ENTRIES = new Map(
  [...STAR_MEANINGS, ...TRANSFORMATION_MEANINGS, ...PALACE_MEANINGS, ...STAR_PALACE_MEANINGS, ...COMBINATION_MEANINGS].map((e) => [
    e.id,
    e,
  ]),
);
const sameRef = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const charts: [string, ZiweiChart][] = [
  ["A", calculateZiweiChart({ birth: { year: 1955, month: 10, day: 16, hour: 15, minute: 55 }, place: "東京", sex: "female" })],
  ["B", calculateZiweiChart({ birth: { year: 1964, month: 12, day: 21, hour: 6, minute: 0 }, place: "東京", sex: "male" })],
];

function flatten(c: PalaceMeaningContext): ContextMeaning[] {
  return [
    ...c.palaceMeanings,
    ...c.shenPalaceMeanings,
    ...c.stars.flatMap((s) => [...s.baseMeanings, ...s.palaceMeanings, ...s.transformationMeanings.flatMap((t) => t.meanings)]),
    ...c.samePalaceCombinations.map((x) => x.meaning),
    ...c.relatedMeanings.map((x) => x.meaning),
  ];
}

const usable = (m: ContextMeaning) => !m.condition && m.review?.status !== "needs_review";

for (const [id, chart] of charts) {
  for (const b of BRANCHES) {
    const full = buildPalaceMeaningContext(chart, b);
    const byLevel = Object.fromEntries(LEVELS.map((lv) => [lv, buildAiMeaningContext(full, { detailLevel: lv })])) as Record<
      AiDetailLevel,
      AiMeaningContext
    >;
    const allIds = new Set(flatten(full).map((m) => m.id));
    const aIds = (x: AiMeaningContext) => x.keyMeanings.filter((m) => m.rank === "A").map((m) => m.id).sort();
    const tag0 = `${id}/${full.palace.name}(${b})`;

    // A は detailLevel によらず同じ（件数上限で消えない）
    check(`${tag0} A は brief と detailed で同じ`, sameRef(aIds(byLevel.brief), aIds(byLevel.detailed)));
    check(`${tag0} A は standard と detailed で同じ`, sameRef(aIds(byLevel.standard), aIds(byLevel.detailed)));
    // 詳しさの順に情報量が増える（減らない）
    check(
      `${tag0} brief ≤ standard ≤ detailed`,
      byLevel.brief.counts.selectedMeaningCount <= byLevel.standard.counts.selectedMeaningCount &&
        byLevel.standard.counts.selectedMeaningCount <= byLevel.detailed.counts.selectedMeaningCount,
    );
    check(`${tag0} brief の採用は standard に含まれる`, byLevel.brief.keyMeanings.every((m) => byLevel.standard.keyMeanings.some((x) => x.id === m.id)));

    // A の中身: 星×宮（命宮は分類ごとの代表、他の宮は全件）・主星の基本象意の先頭・完全一致の同宮の組み合わせ・本宮の四化
    const d = byLevel.detailed;
    const aSet = new Set(aIds(d));
    for (const s of full.stars) {
      // 前文が力量の条件付きで不成立・判定不能の文は代表にならない（§22.6）
      const blocked = (m: ContextMeaning) =>
        (sentenceDependency(m)?.previous ?? []).some((p) => !!p.condition && evaluatePowerCondition(p, full.power)?.result !== "met");
      const items = s.palaceMeanings.filter((m) => m.category !== "combination" && usable(m) && !blocked(m));
      const hasCategory = items.some((m) => m.category !== undefined);
      if (hasCategory) {
        const facets = new Set(items.flatMap((m) => [...(m.category ? [`category:${m.category}`] : []), ...(m.tags ?? []).map((t) => `tag:${t}`)]));
        for (const f of facets) {
          const covered = d.keyMeanings.some(
            (m) => m.rank === "A" && m.kind === "starPalace" && m.stars.includes(s.name) && [`category:${m.category}`, ...(ALL_ENTRIES.get(m.id)?.tags ?? []).map((t) => `tag:${t}`)].includes(f),
          );
          check(`${tag0} ${s.name} 分類 ${f} の代表が A`, covered);
        }
      } else {
        for (const m of items) {
          const inA = aSet.has(m.id) || d.keyMeanings.some((k) => k.rank === "A" && (k.alsoIn ?? []).some((x) => x.id === m.id));
          check(`${tag0} ${s.name} 星×宮 ${m.id} が A`, inA);
        }
      }
      if (s.isMain && s.baseMeanings.length > 0 && usable(s.baseMeanings[0])) {
        const first = s.baseMeanings[0];
        const inA = aSet.has(first.id) || d.keyMeanings.some((k) => k.rank === "A" && (k.alsoIn ?? []).some((x) => x.id === first.id));
        check(`${tag0} ${s.name} 主星の基本象意の先頭が A`, inA);
      }
    }

    for (const lv of LEVELS) {
      const ai = byLevel[lv];
      const tag = `${tag0}/${lv}`;
      const keyIds = new Set(ai.keyMeanings.map((m) => m.id));
      const [, cap] = AI_DETAIL_LEVELS[lv];

      // 件数
      check(`${tag} sourceMeaningCount`, ai.counts.sourceMeaningCount === allIds.size);
      check(`${tag} omittedCount`, ai.counts.omittedCount === ai.counts.sourceMeaningCount - ai.counts.selectedMeaningCount);
      check(`${tag} ランク件数`, ai.counts.rank.A + ai.counts.rank.B === ai.counts.selectedMeaningCount);
      check(`${tag} 上限（A が超える場合を除く）`, ai.counts.selectedMeaningCount <= Math.max(cap, ai.counts.rank.A), `${ai.counts.selectedMeaningCount}`);
      check(`${tag} 採用は元の象意だけ・重複なし`, [...keyIds].every((x) => allIds.has(x)) && keyIds.size === ai.keyMeanings.length);

      // 並び: A → B、同じランクの中は優先順位順（星×宮 → 基本象意 → …）
      check(
        `${tag} ランク・優先順位順`,
        ai.keyMeanings.every((m, i) => {
          if (i === 0) return true;
          const p = ai.keyMeanings[i - 1];
          return p.rank < m.rank || (p.rank === m.rank && p.priority <= m.priority);
        }),
      );

      // 組み合わせ: 完全一致だけ。一部一致は通常材料に入らず参考（C）
      check(`${tag} fullMatch だけ`, ai.fullMatchCombinations.every((c) => c.matchStatus === "full"));
      for (const c of [...full.samePalaceCombinations, ...full.relatedMeanings]) {
        if (c.matchStatus === "partial") {
          check(`${tag} 一部一致 ${c.meaning.id} は通常材料外`, !keyIds.has(c.meaning.id));
          check(`${tag} 一部一致 ${c.meaning.id} は参考`, ai.referenceOnly.some((r) => r.id === c.meaning.id && r.status === "参考・条件未充足"));
        }
      }
      for (const c of full.samePalaceCombinations) {
        if (c.matchStatus === "full" && usable(c.meaning)) {
          check(`${tag} 完全一致の同宮 ${c.meaning.id} は A`, ai.fullMatchCombinations.some((x) => x.meaning.id === c.meaning.id && x.meaning.rank === "A"));
        }
      }

      // 力量の条件付きの文（§22.6）: 通常材料は条件成立のものだけ。不成立 → conditionExcluded、判定不能 → 参考
      check(
        `${tag} 条件付きの通常材料は条件成立のものだけ`,
        ai.keyMeanings.every((m) => !ALL_ENTRIES.get(m.id)?.condition || m.conditionEvaluation?.result === "met"),
      );
      const conditional = full.stars
        .flatMap((s) => [...s.palaceMeanings, ...s.baseMeanings, ...s.transformationMeanings.flatMap((t) => t.meanings)])
        .filter((m) => m.condition && m.review?.status !== "needs_review");
      check(
        `${tag} 条件付きの文を失わない（採用・参考・不成立のどれか）`,
        conditional.every(
          (m) =>
            ai.keyMeanings.some((k) => k.id === m.id) ||
            ai.referenceOnly.some((r) => r.id === m.id && r.status === "参考・条件未判定" && r.conditionEvaluation?.result === "undetermined") ||
            ai.conditionExcluded.some((x) => x.id === m.id && x.conditionEvaluation.result === "notMet") ||
            [...ai.keyMeanings].some((k) => (k.alsoIn ?? []).some((x) => x.id === m.id)) ||
            // 条件成立で B の上限により採用しなかった文（他の B と同じ扱い）
            evaluatePowerCondition(m, full.power)?.result === "met",
        ),
      );
      // 前文が条件付きの主文は、前文の条件が成立したときだけ（後続文だけを出さない）
      for (const m of ai.keyMeanings) {
        for (const id of m.context?.previous ?? []) {
          const cs = ai.contextSentences.find((c) => c.id === id);
          if (cs?.condition) check(`${tag} ${m.id} の前文 ${id} は条件成立`, cs.conditionEvaluation?.result === "met");
        }
      }
      // 配合の文（相手の星と組になった文の続きのことがある）は星×宮に選ばない
      check(`${tag} 配合の文を星×宮に選ばない`, ai.keyMeanings.every((m) => !(m.kind === "starPalace" && m.category === "combination")));
      // 同内容としてまとめる（alsoIn）のは別資料の文か、同じ資料の同じ文だけ
      for (const m of ai.keyMeanings) {
        for (const x of m.alsoIn ?? []) {
          check(`${tag} ${m.id} の alsoIn ${x.id}`, x.ref.source !== m.ref.source || ALL_ENTRIES.get(x.id)?.textKey === m.textKey);
        }
      }

      // 三方四正・needs_review
      check(`${tag} 三方四正`, sameRef(ai.sanfangSizheng, full.sanfang));
      for (const r of full.reviewNotes) check(`${tag} needs_review ${r.topic}`, ai.reviewItems.some((x) => x.topic === r.topic && x.status === r.status));
      if (full.palace.isShenPalace) {
        const shen = ai.reviewItems.find((x) => x.topic === "身宮");
        check(`${tag} 身宮の文を一本化しない`, !!shen && shen.meanings.length === full.shenPalaceMeanings.length);
      }

      // 出典
      for (const m of ai.keyMeanings) {
        const e = ALL_ENTRIES.get(m.id);
        check(`${tag} 出典 ${m.id}`, !!e && sameRef(e.ref, m.ref) && e.text === m.text && e.textKey === m.textKey && !!m.ref.section && m.ref.pdfPage > 0);
        for (const x of m.alsoIn ?? []) check(`${tag} 別収録の出典 ${x.id}`, sameRef(ALL_ENTRIES.get(x.id)?.ref, x.ref));
      }
      for (const r of ai.referenceOnly) check(`${tag} 参考の出典 ${r.id}`, sameRef(ALL_ENTRIES.get(r.id)?.ref, r.ref));
      const srcKeys = new Set(ai.sources.map((r) => `${r.source}|${r.pdfPage}|${r.section}`));
      check(`${tag} sources に採用の出典`, ai.keyMeanings.every((m) => srcKeys.has(`${m.ref.source}|${m.ref.pdfPage}|${m.ref.section}`)));

      // 文脈: 前文（後続文）依存の主文は単独で渡さない。必要な前後の文を付け、出典を残す。件数は別枠
      const ctxIds = new Set(ai.contextSentences.map((s) => s.id));
      check(`${tag} 文脈文は重複しない`, ctxIds.size === ai.contextSentences.length);
      check(`${tag} 文脈文は採用文と重ねない`, [...ctxIds].every((x) => !keyIds.has(x)));
      check(`${tag} attachedContextCount`, ai.counts.attachedContextCount === ai.contextSentences.length);
      check(`${tag} 採用件数に文脈文を含めない`, ai.counts.selectedMeaningCount === ai.keyMeanings.length);
      check(`${tag} meaningsWithContextCount`, ai.counts.meaningsWithContextCount === ai.keyMeanings.filter((m) => m.context).length);
      for (const m of ai.keyMeanings) {
        const dep = sentenceDependency(m);
        if (dep) {
          check(`${tag} ${m.id} は文脈付き`, !!m.context);
          check(`${tag} ${m.id} の前後の文`, sameRef(m.context?.previous, dep.previous.map((s) => s.id)) && sameRef(m.context?.next, dep.next.map((s) => s.id)));
          for (const sid of [...(m.context?.previous ?? []), ...(m.context?.next ?? [])]) {
            const e = ALL_ENTRIES.get(sid);
            const inKey = ai.keyMeanings.find((k) => k.id === sid);
            const inCtx = ai.contextSentences.find((s) => s.id === sid);
            check(`${tag} ${m.id} の文脈 ${sid} を保持`, !!(inKey ?? inCtx));
            const held = inKey ?? inCtx;
            check(`${tag} ${m.id} の文脈 ${sid} の出典と本文`, !!e && !!held && sameRef(e.ref, held.ref) && e.text === held.text);
            check(`${tag} ${m.id} の文脈 ${sid} は同じ資料・同じ節`, !!e && e.ref.source === m.ref.source && e.ref.section === m.ref.section);
            if (inCtx) check(`${tag} 文脈文 ${sid} の参照元`, inCtx.referencedBy.includes(m.id));
            if (inCtx) check(`${tag} 文脈文 ${sid} の出典が sources に`, ai.sources.some((r) => sameRef(r, inCtx.ref)));
          }
        } else {
          check(`${tag} ${m.id} 独立文に文脈を付けない`, !m.context);
        }
        // 主文の本文は資料のまま（前文と結合しない）
        check(`${tag} ${m.id} 本文は結合しない`, m.text === ALL_ENTRIES.get(m.id)?.text);
      }
      for (const s of ai.contextSentences) {
        check(`${tag} 文脈文 ${s.id} の条件`, (s.condition ?? null) === (ALL_ENTRIES.get(s.id)?.condition ?? null));
        check(`${tag} 文脈文 ${s.id} は参照される`, s.referencedBy.length > 0 && s.referencedBy.every((r) => keyIds.has(r)));
      }

      // 単純な先頭N件の切り捨てではない
      if (allIds.size > ai.keyMeanings.length && full.stars.length > 0) {
        const headN = flatten(full).slice(0, ai.keyMeanings.length).map((m) => m.id);
        check(`${tag} 先頭N件ではない`, !sameRef(headN, ai.keyMeanings.map((m) => m.id)));
      }
    }
  }
}

// 命盤A 命宮（寅）: 元件数100件超。standard は従来より多く、detailed は standard より多い。N-CB-0192 は A
{
  const full = buildPalaceMeaningContext(charts[0][1], "寅");
  const [brief, standard, detailed] = LEVELS.map((lv) => buildAiMeaningContext(full, { detailLevel: lv }));
  check("命盤A 命宮 元件数が100件超", brief.counts.sourceMeaningCount > 100, `${brief.counts.sourceMeaningCount}`);
  check("命盤A 命宮 brief は 10〜20件（A 超過分を除く）", brief.counts.selectedMeaningCount >= 10 && brief.counts.selectedMeaningCount <= Math.max(20, brief.counts.rank.A));
  check("命盤A 命宮 standard は従来より多い", standard.counts.selectedMeaningCount > PREVIOUS_MING_A_SELECTED, `${standard.counts.selectedMeaningCount}`);
  check("命盤A 命宮 standard は 20〜35件", standard.counts.selectedMeaningCount >= 20 && standard.counts.selectedMeaningCount <= 35);
  check("命盤A 命宮 detailed は standard より多い", detailed.counts.selectedMeaningCount > standard.counts.selectedMeaningCount);
  check("命盤A 命宮 detailed は 30〜50件", detailed.counts.selectedMeaningCount >= 30 && detailed.counts.selectedMeaningCount <= 50);
  for (const x of [brief, standard, detailed]) {
    check(`命盤A 命宮 ${x.detailLevel} N-CB-0192 は A`, x.fullMatchCombinations.some((c) => c.meaning.id === "N-CB-0192" && c.meaning.rank === "A"));
  }
  // 「いずれにせよ筋肉質の体形で…」（N-ST-0181）は単独で渡さない。命盤A の命宮（寅）の武曲星は力量2で、
  // 直前の文 N-ST-0180「武曲星の力量が弱ければ（力量数値０）」は不成立 → 両方とも材料外（§22.6）
  for (const x of [brief, standard, detailed]) {
    check(`命盤A 命宮 ${x.detailLevel} N-ST-0181 は材料外`, !x.keyMeanings.some((k) => k.id === "N-ST-0181"));
    check(
      `命盤A 命宮 ${x.detailLevel} N-ST-0181 は前文不成立で除外`,
      x.conditionExcluded.some((c) => c.id === "N-ST-0181" && c.reason.includes("N-ST-0180") && c.conditionEvaluation.result === "notMet"),
    );
    check(`命盤A 命宮 ${x.detailLevel} N-ST-0180 は条件不成立`, x.conditionExcluded.some((c) => c.id === "N-ST-0180"));
  }
  // detailed で2つ前まで遡る例（N-ST-0533 は「また」、直前の N-ST-0532 は「したがって」で始まる）
  const n533 = detailed.keyMeanings.find((k) => k.id === "N-ST-0533");
  if (n533) check("命盤A 命宮 N-ST-0533 は2文前まで", sameRef(n533.context?.previous, ["N-ST-0531", "N-ST-0532"]));
  // 同じ前文を複数の主文が参照しても1回だけ（文脈文の ID は重複しない）
  check("命盤A 命宮 detailed 文脈文の重複なし", new Set(detailed.contextSentences.map((c) => c.id)).size === detailed.contextSentences.length);
  // 接続語で始まる文でも、判定は同じ節の直前の文があるときだけ（語句だけでは決めない）
  const opener = STAR_MEANINGS.find((e) => opensWithConnective(e) && sentenceDependency(e));
  check("接続語の判定例がある", !!opener);
  // 意味の違う記述（短所など資料のタグが違う文）は別の代表として残る
  check("命盤A 命宮 文昌星の短所（weakness）の文が A", brief.keyMeanings.some((m) => m.rank === "A" && m.stars.includes("文昌星") && m.facet === "tag:weakness"));
}
// 命盤A 官禄宮（午・身宮）: 身宮の needs_review が reviewItems に残る
{
  const ai = buildAiMeaningContext(buildPalaceMeaningContext(charts[0][1], "午"));
  check("命盤A 身宮 needs_review", ai.reviewItems.some((r) => r.topic === "身宮" && r.status === "needs_review" && r.meanings.length > 0));
}

const fail = failures.length;
console.log(`AI 入力用の選別: ${pass} / ${pass + fail} PASS`);
if (fail > 0) {
  console.log(failures.slice(0, 80).join("\n"));
  process.exit(1);
}
process.exit(0);
