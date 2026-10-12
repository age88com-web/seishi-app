// tests/ziwei_fortune_selection.manual.ts
//
// 行運の選択状態（src/lib/ziwei/fortune/selection.ts）と、選択を明示的に受け取る行運コンテキスト
// （buildFortuneContextFor・buildFortunePalaceContext）の確認。docs/ziwei-basic-spec.md §28。
// 実行: npx tsx tests/ziwei_fortune_selection.manual.ts
// （盤面の表示・クリックの伝播はブラウザで確認する）

import { calculateZiweiChart, dayunAt } from "../src/lib/ziwei";
import type { ZiweiChart } from "../src/lib/ziwei";
import {
  buildFortuneContext,
  buildFortuneContextFor,
  buildFortunePalaceContext,
  minorAgeOptions,
  parseAppraisalDate,
  selectionFromDate,
  withMajor,
  withMinor,
} from "../src/lib/ziwei/fortune";
import type { FortuneSelection } from "../src/lib/ziwei/fortune";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}

const S38 = calculateZiweiChart({ birth: { year: 1965, month: 1, day: 10, hour: 0, minute: 0 }, place: "東京", sex: "male" });
const ctx = (c: ZiweiChart, s: FortuneSelection) => buildFortuneContextFor(c, parseAppraisalDate(s.appraisalDate)!, s);

// ---------------------------------------------------------------------------
// 1. 鑑定日 → 大限・小限の同期
// ---------------------------------------------------------------------------
const day = "2008-07-01"; // S38 は数え45歳・己巳の大限（42〜51）
const s0 = selectionFromDate(S38, day);
check("鑑定日に同期: 小限＝数え年45", s0.minorAge === 45);
check("鑑定日に同期: 大限＝42〜51", s0.majorStartAge === 42);
check("同期した選択の行運＝鑑定日の行運", JSON.stringify(ctx(S38, s0)) === JSON.stringify(buildFortuneContext(S38, parseAppraisalDate(day)!)));
{
  const s = selectionFromDate(S38, "2020-07-01");
  check("鑑定日を変えると大限・小限も同期", s.minorAge === 57 && s.majorStartAge === 52 && s.appraisalDate === "2020-07-01");
}

// ---------------------------------------------------------------------------
// 2. 大限の手動変更
// ---------------------------------------------------------------------------
{
  const s = withMajor(S38, s0, 22);
  check("大限を選ぶ: 22〜31（丁卯）へ", s.majorStartAge === 22 && ctx(S38, s).majorLimit!.palaceStem === "丁");
  check("大限を選んでも鑑定日は変わらない", s.appraisalDate === day);
  check("小限が範囲外なら大限の開始年齢へ", s.minorAge === 22);
  const kept = withMajor(S38, { ...s0, minorAge: 47 }, 42);
  check("小限が範囲内なら維持", kept.minorAge === 47 && kept.majorStartAge === 42);
  check("存在しない大限は無視", JSON.stringify(withMajor(S38, s0, 43)) === JSON.stringify(s0));
  check("太歳は鑑定日のまま（大限を変えても変わらない）", ctx(S38, s).taisei.branch === ctx(S38, s0).taisei.branch);
}

// ---------------------------------------------------------------------------
// 3. 小限の手動変更
// ---------------------------------------------------------------------------
{
  const s = withMinor(S38, s0, 57);
  check("小限を選ぶ: 57歳", s.minorAge === 57);
  check("別の大限の年齢なら大限も切り替える（52〜61）", s.majorStartAge === 52);
  check("小限を選んでも鑑定日は変わらない", s.appraisalDate === day);
  const s2 = withMinor(S38, s0, 48);
  check("同じ大限の年齢なら大限は維持", s2.majorStartAge === 42 && s2.minorAge === 48);
  check("小限の選択肢は数え1歳〜大限表の最後", minorAgeOptions(S38)[0] === 1 && minorAgeOptions(S38).at(-1) === S38.dayun.periods.at(-1)!.endAge);
  check("範囲外の年齢は無視", JSON.stringify(withMinor(S38, s0, 999)) === JSON.stringify(s0));
  const s3 = withMinor(S38, s0, 1);
  check("大限開始前の年齢: 大限なし・小限あり", s3.majorStartAge === null && ctx(S38, s3).majorLimitStatus === "beforeFirst" && ctx(S38, s3).minorLimit !== null);
  // 小限は12年で同じ宮に戻るため、45歳と48歳で比べる
  check("小限の宮・四化が切り替わる", ctx(S38, s2).minorLimit!.palaceBranch !== ctx(S38, s0).minorLimit!.palaceBranch && ctx(S38, s2).minorLimit!.palaceStem !== ctx(S38, s0).minorLimit!.palaceStem);
}

// ---------------------------------------------------------------------------
// 4. 四化の層・行運格局の追従
// ---------------------------------------------------------------------------
{
  const natalBefore = JSON.stringify(S38.transformations);
  for (const p of S38.dayun.periods) {
    const s = withMajor(S38, s0, p.startAge);
    const f = ctx(S38, s);
    check(`大限 ${p.startAge}: 大限四化は選択した大限の干`, f.majorLimit!.palaceBranch === p.branch && f.majorTransformations.every((t) => t.origin === "major"));
    check(`大限 ${p.startAge}: 行運格局は選択した大限で判定`, f.majorPatterns.every((x) => x.limit.branch === p.branch));
    check(`大限 ${p.startAge}: 生年四化は変わらない`, JSON.stringify(f.natalTransformations.map((t) => [t.kind, t.star])) === JSON.stringify(S38.transformations.map((t) => [t.kind, t.star])));
  }
  check("生年四化（chart）を変更しない", JSON.stringify(S38.transformations) === natalBefore);
  // 己巳では三奇嘉會、丙寅では三奇嘉會が成立しない（選択に追従）
  const jisi = ctx(S38, withMajor(S38, s0, 42)).majorPatterns.find((p) => p.id === "K2-19")!;
  const bingyin = ctx(S38, withMajor(S38, s0, 12)).majorPatterns.find((p) => p.id === "K2-19")!;
  check("己巳: 三奇嘉會 成立", jisi.status === "confirmed");
  check("丙寅: 三奇嘉會 不成立", bingyin.status === "not_applicable");
}
// 同じ星に生年・大限・小限の3層（盤面の星の横に3つ並ぶ）
{
  let found: string | null = null;
  outer: for (const p of S38.dayun.periods) {
    for (let age = p.startAge; age <= p.endAge; age += 1) {
      const f = ctx(S38, withMinor(S38, withMajor(S38, s0, p.startAge), age));
      for (const n of S38.transformations) {
        if (f.majorTransformations.some((t) => t.star === n.star) && f.minorTransformations.some((t) => t.star === n.star)) {
          const layers = f.transformationsByBranch[n.branch].filter((t) => t.star === n.star);
          if (new Set(layers.map((t) => t.origin)).size === 3) {
            found = `${n.star} 大限${p.startAge} 小限${age}: ${layers.map((t) => `${t.origin}${t.kind}`).join("・")}`;
            break outer;
          }
        }
      }
    }
  }
  check("同じ星に生年・大限・小限の四化が3つとも残る", found !== null);
  console.log(`3層の例: ${found}`);
}

// ---------------------------------------------------------------------------
// 5. 成立の由来（formationBasis）
// ---------------------------------------------------------------------------
{
  const dingmao = ctx(S38, withMajor(S38, s0, 22)).majorPatterns.find((p) => p.id === "K2-33")!;
  check("丁卯の刑忌夾印: 生年だけでも大限だけでも成立（each_alone）", dingmao.formationBasis?.kind === "each_alone");
  const bingyin = ctx(S38, withMajor(S38, s0, 12)).majorPatterns.find((p) => p.id === "K2-32")!;
  check("丙寅の羊陀夾忌: 生年の化忌だけ（natal_only）", bingyin.formationBasis?.kind === "natal_only");
  const S39 = calculateZiweiChart({ birth: { year: 1975, month: 3, day: 9, hour: 22, minute: 0 }, place: "東京", sex: "male" });
  const s39 = selectionFromDate(S39, "1985-07-01");
  const ytj = ctx(S39, withMajor(S39, s39, dayunAt(S39.dayun, 8)!.startAge)).majorPatterns.find((p) => p.id === "K2-32")!;
  check("S39 己卯の羊陀夾忌: 大限の化忌だけ（major_only）", ytj.formationBasis?.kind === "major_only");
  const none = ctx(S38, withMajor(S38, s0, 12)).majorPatterns.find((p) => p.id === "K2-19")!;
  check("不成立の formationBasis は null", none.formationBasis === null);
}

// ---------------------------------------------------------------------------
// 6. 宮クリック用（鑑定日・大限・小限を明示的に渡す）
// ---------------------------------------------------------------------------
{
  const s = withMinor(S38, withMajor(S38, s0, 22), 25);
  const p = buildFortunePalaceContext(S38, { appraisalDate: parseAppraisalDate(s.appraisalDate)!, majorStartAge: s.majorStartAge, minorAge: s.minorAge }, "卯");
  check("宮クリック用: 選択した大限（丁卯）で卯は大限命宮", p.isMajorMing && p.majorPalace === "命宮");
  check("宮クリック用: 太歳は鑑定日のまま", p.fortune.taisei.branch === ctx(S38, s0).taisei.branch);
}

const fail = failures.length;
console.log(`行運の選択: ${pass} / ${pass + fail} PASS`);
if (fail) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
