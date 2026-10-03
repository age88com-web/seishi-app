// tests/liuren_interpretation_facts.manual.ts
//
// 六壬神課 解釈エンジンの FACT 層（src/lib/liuren/interpretation/）のテスト。
// 実行: npx tsx tests/liuren_interpretation_facts.manual.ts
//
//   60日干支 × 天盤差 0〜11 = 720課すべてで:
//     1. 日干・日支・占時・月将の転記
//     2. 四課4件の保持（上神・下神・地盤支）
//     3. 四課の天将＝chart.lessonGenerals＝generalOn[上神]
//     4. 四課上神の六親（三伝と同じ支なら三伝の六親と一致。固定例も確認）
//     5. 三伝3件が chart.transmissions・sanchuan の初中末と一致
//     6. 空亡・旬首が chart.xun と一致
//     7. 課体 method / pattern / middleFinalEvidence / trace が失われない
//     +  四課の剋関係が五行表から直接求めた値と一致し、重審・元首の課に対応する剋がある
//     10. FACT 生成で起課結果が書き換わらない
//   8. 三伝未確定（undetermined・transmissions null）を例外なく処理できる
//   9. 生・剋・比和・冲・刑の関係判定（固定例）

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, LiurenChart, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { ELEMENT_CONTROLS } from "../src/lib/liuren/constants";
import { elementOf } from "../src/lib/liuren/relations";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { relationBetween } from "../src/lib/liuren/interpretation/relations";
import type { StructuralRelation } from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function chartOf(i: number, offset: number): LiurenChart {
  // 占時を子に固定し、月将で天盤差を作る（liuren_exhaustive と同じ作り方）
  return calculateLiuren({
    dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12],
    divinationBranch: "子", monthGeneral: BRANCHES[offset],
  });
}

// ---- 720課 ----
let total = 0;
let reference = 0;
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const chart = chartOf(i, o);
    const tag = `${chart.input.dayStem}${chart.input.dayBranch}+${o}`;
    const before = JSON.stringify(chart);
    const f = buildInterpretationFacts(chart);
    total += 1;

    // 1. 基本
    check(`${tag} 基本`, same(f.basic, chart.input));

    // 2・3・4. 四課
    check(`${tag} 四課4件`, f.lessons.length === 4);
    f.lessons.forEach((l, k) => {
      const src = chart.lessons[k];
      check(`${tag} ${k + 1}課 転記`, l.index === src.index && l.upper === src.upper &&
        l.lower === src.lower && l.lowerBranch === src.lowerBranch);
      check(`${tag} ${k + 1}課 天将`, l.general === chart.lessonGenerals[k] &&
        l.general === chart.generals.generalOn[l.upper]);
      const t = chart.transmissions?.find((x) => x.branch === l.upper);
      if (t) check(`${tag} ${k + 1}課 六親（三伝と同じ支）`, l.relation === t.relation, `${l.relation} / ${t.relation}`);

      // 剋関係: 五行表から直接求めた値と一致
      const zei = ELEMENT_CONTROLS[elementOf(src.lower)] === elementOf(src.upper);
      const ke = ELEMENT_CONTROLS[elementOf(src.upper)] === elementOf(src.lower);
      const expected = zei ? "下賊" : ke ? "上剋" : "無剋";
      check(`${tag} ${k + 1}課 剋`, l.zeike === expected && !(zei && ke), `${l.zeike} / ${expected}`);
    });

    // 重審は下賊の課が、元首は上剋の課があり下賊の課がない（課体と剋関係の対応）
    const kinds = f.lessons.map((l) => l.zeike);
    if (f.sanchuan.method === "重審") check(`${tag} 重審に下賊`, kinds.includes("下賊"));
    if (f.sanchuan.method === "元首") check(`${tag} 元首に上剋のみ`, kinds.includes("上剋") && !kinds.includes("下賊"));

    // 5. 三伝
    check(`${tag} 三伝 転記`, f.transmissions === chart.transmissions);
    if (f.sanchuan.status === "determined" && f.transmissions) {
      check(`${tag} 三伝 初中末`, f.transmissions[0].branch === f.sanchuan.initial &&
        f.transmissions[1].branch === f.sanchuan.middle && f.transmissions[2].branch === f.sanchuan.final);
    } else {
      check(`${tag} 三伝確定`, false, "720課はすべて確定のはず");
    }

    // 6. 空亡
    check(`${tag} 空亡`, same(f.xun, chart.xun) && f.xun.voidBranches.length === 2);
    f.transmissions?.forEach((t, k) =>
      check(`${tag} 三伝${k} isVoid`, t.isVoid === f.xun.voidBranches.includes(t.branch)));

    // 天地盤・天将
    check(`${tag} 天地盤`, f.plate === chart.plate);
    check(`${tag} 天将配置`, f.generals === chart.generals);

    // 7. 課体
    check(`${tag} 課体`, f.sanchuan === chart.sanchuan && f.sanchuan.method === chart.sanchuan.method);
    if (f.sanchuan.status === "determined" && chart.sanchuan.status === "determined") {
      check(`${tag} pattern・根拠`, f.sanchuan.pattern === chart.sanchuan.pattern &&
        f.sanchuan.middleFinalEvidence === chart.sanchuan.middleFinalEvidence &&
        f.sanchuan.trace.length > 0);
      if (f.sanchuan.middleFinalEvidence === "reference") reference += 1;
    }

    // 10. 起課結果を書き換えない
    check(`${tag} 起課結果不変`, JSON.stringify(chart) === before);
  }
}
check("720課", total === 720, String(total));
check("遥剋の中末伝 reference が残る", reference > 0, String(reference));

// 4. 六親の固定例（日干の五行基準。講座 p55）
{
  const f = buildInterpretationFacts(calculateLiuren({ dayStem: "甲", dayBranch: "子", divinationBranch: "子", monthGeneral: "子" }));
  // 伏吟: 一課 寅/甲（寅木＝兄弟）、三課 子/子（子水＝父母）
  check("六親 甲日 寅＝兄弟", f.lessons[0].upper === "寅" && f.lessons[0].relation === "兄弟", `${f.lessons[0].upper}${f.lessons[0].relation}`);
  check("六親 甲日 子＝父母", f.lessons[2].upper === "子" && f.lessons[2].relation === "父母", `${f.lessons[2].upper}${f.lessons[2].relation}`);
  const g = buildInterpretationFacts(calculateLiuren({ dayStem: "庚", dayBranch: "午", divinationBranch: "子", monthGeneral: "子" }));
  // 伏吟: 一課 申/庚（兄弟）、三課 午/午（午火が庚金を剋す＝官鬼）
  check("六親 庚日 午＝官鬼", g.lessons[2].upper === "午" && g.lessons[2].relation === "官鬼", `${g.lessons[2].upper}${g.lessons[2].relation}`);
}

// 8. 三伝未確定（720課には存在しないため、確定済みの課から未確定の形を作る）
{
  const base = chartOf(0, 3);
  const undeterminedChart: LiurenChart = {
    ...base,
    sanchuan: { status: "undetermined", method: "遥剋", reason: "テスト用の未確定", trace: [{ stage: "テスト", detail: "未確定" }] },
    transmissions: null,
  };
  let f: ReturnType<typeof buildInterpretationFacts> | null = null;
  let error = "";
  try {
    f = buildInterpretationFacts(undeterminedChart);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  check("未確定 例外なし", f !== null, error);
  check("未確定 transmissions null", f?.transmissions === null);
  check("未確定 status・reason 保持", f?.sanchuan.status === "undetermined" && f.sanchuan.reason === "テスト用の未確定");
  check("未確定 四課は保持", f?.lessons.length === 4 && same(f.lessons.map((l) => l.upper), base.lessons.map((l) => l.upper)));
}

// 9. 構造関係
const rel = (a: Stem | Branch, b: Stem | Branch, expected: StructuralRelation[]) => {
  const got = relationBetween(a, b);
  check(`関係 ${a}→${b}`, got.from === a && got.to === b && same([...got.relations].sort(), [...expected].sort()),
    `${got.relations.join(",") || "なし"} / ${expected.join(",") || "なし"}`);
};
rel("甲", "丙", ["generates"]);              // 木生火
rel("丙", "甲", ["generatedBy"]);
rel("甲", "戊", ["overcomes"]);              // 木剋土
rel("庚", "甲", ["overcomes"]);              // 金剋木
rel("甲", "庚", ["overcomeBy"]);
rel("甲", "乙", ["sameElement"]);            // 比和
rel("甲", "子", ["generatedBy"]);            // 干と支（水生木）。冲・刑は支どうしのみ
rel("子", "亥", ["sameElement"]);
rel("子", "午", ["overcomes", "clashes"]);   // 水剋火・子午冲
rel("午", "子", ["overcomeBy", "clashes"]);
rel("寅", "申", ["overcomeBy", "clashes", "punishedBy"]); // 金剋木・寅申冲・申刑寅（XING）
rel("寅", "巳", ["generates", "punishes"]);  // 木生火・寅刑巳
rel("巳", "寅", ["generatedBy", "punishedBy"]);
rel("子", "卯", ["generates", "punishes", "punishedBy"]); // 子卯の互刑
rel("辰", "辰", ["sameElement", "punishes", "punishedBy"]); // 自刑
rel("子", "子", ["sameElement"]);            // 自刑でない同支
rel("丑", "戌", ["sameElement", "punishes"]); // 丑刑戌
rel("辰", "戌", ["sameElement", "clashes"]);
rel("卯", "申", ["overcomeBy"]);

console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
