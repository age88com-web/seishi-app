// tests/ziwei_meanings_context.manual.ts
//
// 宮クリック時の象意コンテキスト（src/lib/ziwei/meanings/context.ts、buildPalaceMeaningContext）の確認。
// 実行: npx tsx tests/ziwei_meanings_context.manual.ts
//
// 命盤A（入門 p.16）・命盤B（基礎編 S19）の全12宮について、次を確認する:
//   宮の意味・宮内の星の基本象意・星×宮・旺衰と四化・組み合わせ（資料に明記されたものだけ、盤面の星がそろうもの
//   だけ）・三方四正4宮・出典の保持・重複が暴走しないこと。

import {
  calculateZiweiChart,
  sanfangSizheng,
  starStrengthOf,
} from "../src/lib/ziwei";
import type { Branch, ZiweiChart } from "../src/lib/ziwei";
import {
  buildPalaceMeaningContext,
  COMBINATION_MEANINGS,
  PALACE_MEANINGS,
  STAR_MEANINGS,
  STAR_PALACE_MEANINGS,
  TRANSFORMATION_MEANINGS,
} from "../src/lib/ziwei/meanings";
import type {
  ContextMeaning,
  PalaceMeaningContext,
} from "../src/lib/ziwei/meanings";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}

const BRANCHES = "子丑寅卯辰巳午未申酉戌亥".split("") as Branch[];
const ALL_ENTRIES = new Map(
  [
    ...STAR_MEANINGS,
    ...TRANSFORMATION_MEANINGS,
    ...PALACE_MEANINGS,
    ...STAR_PALACE_MEANINGS,
    ...COMBINATION_MEANINGS,
  ].map((e) => [e.id, e]),
);

const charts: [string, ZiweiChart][] = [
  [
    "A",
    calculateZiweiChart({
      birth: { year: 1955, month: 10, day: 16, hour: 15, minute: 55 },
      place: "東京",
      sex: "female",
    }),
  ],
  [
    "B",
    calculateZiweiChart({
      birth: { year: 1964, month: 12, day: 21, hour: 6, minute: 0 },
      place: "東京",
      sex: "male",
    }),
  ],
];

function allMeanings(c: PalaceMeaningContext): ContextMeaning[] {
  return [
    ...c.palaceMeanings,
    ...c.shenPalaceMeanings,
    ...c.stars.flatMap((s) => [
      ...s.baseMeanings,
      ...s.palaceMeanings,
      ...s.transformationMeanings.flatMap((t) => t.meanings),
    ]),
    ...c.samePalaceCombinations.map((x) => x.meaning),
    ...c.relatedMeanings.map((x) => x.meaning),
  ];
}

for (const [id, chart] of charts) {
  for (const b of BRANCHES) {
    const c = buildPalaceMeaningContext(chart, b);
    const palace = chart.palaces.find((p) => p.branch === b)!;
    const tag = `${id}/${palace.name}(${b})`;

    // 宮の意味
    check(`${tag} 宮の意味がある`, c.palaceMeanings.length > 0);
    check(
      `${tag} 宮の意味はこの宮のもの`,
      c.palaceMeanings.every(
        (m) =>
          (ALL_ENTRIES.get(m.id) as { palace?: string }).palace === palace.name,
      ),
    );
    check(
      `${tag} 身宮の意味は身宮のときだけ`,
      palace.isShenPalace
        ? c.shenPalaceMeanings.length > 0
        : c.shenPalaceMeanings.length === 0,
    );
    if (palace.isShenPalace)
      check(
        `${tag} 身宮の needs_review`,
        c.reviewNotes.some(
          (r) => r.topic === "身宮" && r.status === "needs_review",
        ),
      );

    // 宮内の星・旺衰・四化
    check(
      `${tag} 宮内の星がすべて入る`,
      JSON.stringify(c.stars.map((s) => s.name)) ===
        JSON.stringify(palace.stars),
    );
    for (const s of c.stars) {
      check(
        `${tag} ${s.name} 基本象意`,
        s.baseMeanings.length > 0 &&
          s.baseMeanings.every((m) =>
            (ALL_ENTRIES.get(m.id) as { stars: string[] }).stars.includes(
              s.name,
            ),
          ),
      );
      check(`${tag} ${s.name} 旺衰`, s.strength === starStrengthOf(s.name, b));
      const kinds = chart.transformations
        .filter((t) => t.star === s.name)
        .map((t) => t.kind);
      check(
        `${tag} ${s.name} 四化`,
        JSON.stringify(s.transformations) === JSON.stringify(kinds),
      );
      check(
        `${tag} ${s.name} 旺衰別・星×四化の象意は空（資料になし）`,
        s.strengthMeanings.length === 0 &&
          s.starTransformationMeanings.length === 0,
      );
      // 星×宮: 命宮以外は starPalace のこの星・この宮の記述を含む
      if (palace.name !== "命宮") {
        const expected = STAR_PALACE_MEANINGS.filter(
          (e) => e.stars.includes(s.name) && e.palace === palace.name,
        ).map((e) => e.id);
        const got = new Set(
          s.palaceMeanings.flatMap((m) => [m.id, ...(m.mergedIds ?? [])]),
        );
        check(
          `${tag} ${s.name} 星×宮`,
          expected.every((x) => got.has(x)),
          `期待 ${expected.length} 件`,
        );
      }
    }

    // 組み合わせ: 資料の文そのもの。節の対象星が本宮にあり、相手が同宮（本宮）または加会（対宮・三合）の位置にある
    const sf = sanfangSizheng(b);
    const where = (star: string): Branch[] =>
      chart.palaces
        .filter(
          (p) =>
            p.stars.includes(star as never) ||
            chart.transformations.some(
              (t) => t.kind === star && p.stars.includes(t.star),
            ),
        )
        .map((p) => p.branch);
    for (const x of [...c.samePalaceCombinations, ...c.relatedMeanings]) {
      const orig = COMBINATION_MEANINGS.find((e) => e.id === x.meaning.id);
      check(
        `${tag} 組み合わせ ${x.meaning.id} は資料にある文`,
        !!orig && orig.textKey === x.meaning.textKey,
      );
      check(
        `${tag} 組み合わせ ${x.meaning.id} 対象星が本宮`,
        x.matchedSubjects.length > 0 &&
          x.matchedSubjects.every((s) => where(s).includes(b)),
      );
      for (const p of x.matchedPartners) {
        const allowed = p.role === "本宮" ? [b] : [sf.opposite, ...sf.trines];
        check(
          `${tag} 組み合わせ ${x.meaning.id} 相手 ${p.star}`,
          where(p.star).includes(p.branch) && allowed.includes(p.branch),
        );
        if (x.relation === "同宮")
          check(
            `${tag} 組み合わせ ${x.meaning.id} 同宮のみの文は本宮だけ`,
            p.role === "本宮",
          );
      }
    }
    check(
      `${tag} 同宮の組み合わせは相手が本宮にある`,
      c.samePalaceCombinations.every((x) =>
        x.matchedPartners.some((p) => p.role === "本宮"),
      ),
    );
    check(
      `${tag} 加会の関係は相手が本宮にない`,
      c.relatedMeanings.every((x) =>
        x.matchedPartners.every((p) => p.role !== "本宮"),
      ),
    );
    if (palace.name !== "命宮")
      check(
        `${tag} 命宮以外は組み合わせなし`,
        c.samePalaceCombinations.length === 0 && c.relatedMeanings.length === 0,
      );

    // 三方四正4宮
    check(
      `${tag} 三方四正`,
      c.sanfang.self.branch === b &&
        c.sanfang.opposite.branch === sf.opposite &&
        c.sanfang.trines[0].branch === sf.trines[0] &&
        c.sanfang.trines[1].branch === sf.trines[1],
    );
    for (const p of [c.sanfang.self, c.sanfang.opposite, ...c.sanfang.trines]) {
      const cp = chart.palaces.find((x) => x.branch === p.branch)!;
      check(
        `${tag} 三方四正 ${p.branch} の宮名・星`,
        p.name === cp.name &&
          JSON.stringify(p.stars.map((s) => s.name)) ===
            JSON.stringify(cp.stars),
      );
      check(
        `${tag} 三方四正 ${p.branch} の旺衰`,
        p.stars.every((s) => s.strength === starStrengthOf(s.name, p.branch)),
      );
    }

    // 出典の保持: 全件がデータの ref と同一
    const all = allMeanings(c);
    check(
      `${tag} 出典`,
      all.every(
        (m) =>
          JSON.stringify(m.ref) ===
            JSON.stringify(ALL_ENTRIES.get(m.id)?.ref) &&
          !!m.ref.source &&
          m.ref.pdfPage > 0 &&
          !!m.ref.section,
      ),
    );
    check(
      `${tag} 本文はデータのまま`,
      all.every((m) => m.text === ALL_ENTRIES.get(m.id)?.text),
    );
    check(
      `${tag} sources に全出典`,
      all.every((m) =>
        c.sources.some((r) => JSON.stringify(r) === JSON.stringify(m.ref)),
      ),
    );

    // 重複が暴走しない: 各一覧の中で ID が重複しない。全体でも同じ ID は各一覧に1回まで
    const lists: ContextMeaning[][] = [
      c.palaceMeanings,
      c.shenPalaceMeanings,
      ...c.stars.flatMap((s) => [
        s.baseMeanings,
        s.palaceMeanings,
        ...s.transformationMeanings.map((t) => t.meanings),
      ]),
      c.samePalaceCombinations.map((x) => x.meaning),
      c.relatedMeanings.map((x) => x.meaning),
    ];
    check(
      `${tag} 各一覧で ID 重複なし`,
      lists.every((l) => new Set(l.map((m) => m.id)).size === l.length),
    );
    check(
      `${tag} 各一覧で同じ資料の同じ文が重複しない`,
      lists.every(
        (l) =>
          new Set(l.map((m) => m.textKey)).size ===
          l.length,
      ),
    );
    check(`${tag} 件数が過大でない`, all.length < 400, `${all.length} 件`);
  }
}

// 個別: 命盤A 命宮（寅）。資料に明記された 武曲星＋天相星 の同宮（N-CB-0192）は、相手がそろうので全一致で取れる
{
  const c = buildPalaceMeaningContext(charts[0][1], "寅");
  const x = c.samePalaceCombinations.find((y) => y.meaning.id === "N-CB-0192");
  check(
    "命盤A 命宮 武曲星＋天相星（N-CB-0192）",
    !!x &&
      !x.partialMatch &&
      x.matchedPartners.some((p) => p.star === "天相星" && p.role === "本宮"),
  );
  // 資料にない組み合わせ（例: 武曲星＋右弼星だけを対象とする文）は作らない: 返る文はすべて組み合わせデータの文
  check(
    "命盤A 命宮 組み合わせはデータの文だけ",
    c.samePalaceCombinations.every((y) =>
      COMBINATION_MEANINGS.some((e) => e.id === y.meaning.id),
    ),
  );
}
// 個別: 命盤B 命宮（酉）は太陰星だけで同宮の相手がいないため、同宮の組み合わせは0件
{
  const c = buildPalaceMeaningContext(charts[1][1], "酉");
  check(
    "命盤B 命宮 同宮の組み合わせなし（相手の星がない）",
    c.samePalaceCombinations.length === 0,
  );
}
// 個別: 命盤B 兄弟宮（申）に紫微星・天府星が同宮するが、組み合わせの文は命宮の節のものだけなので取らない
{
  const c = buildPalaceMeaningContext(charts[1][1], "申");
  check(
    "命盤B 兄弟宮 紫微星・天府星は同宮",
    c.stars.some((s) => s.name === "紫微星") &&
      c.stars.some((s) => s.name === "天府星"),
  );
  check(
    "命盤B 兄弟宮 組み合わせを生成しない",
    c.samePalaceCombinations.length === 0,
  );
}

const fail = failures.length;
console.log(`象意コンテキスト: ${pass} / ${pass + fail} PASS`);
if (fail > 0) {
  console.log(failures.slice(0, 80).join("\n"));
  process.exit(1);
}
process.exit(0);
