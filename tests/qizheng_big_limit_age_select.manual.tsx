// tests/qizheng_big_limit_age_select.manual.tsx
//
// 大限パネルの「この大限で見る年齢」（src/lib/big_limit_ages.ts・LimitDetailPanel）の確認。
// 実行: npx tsx tests/qizheng_big_limit_age_select.manual.tsx
//
// - 選択肢は既存の大限区間（startAge 以上 endAge 未満）に入る整数年齢だけ（例：35.5〜50.5 → 36〜50）
// - 既存の対象年齢が範囲内ならその年齢を選択状態、未入力・範囲外なら「年齢を選択」
// - 選んだ年齢を既存の targetAge として、限宿・宿内度・限度主・対象年・流年・太歳宮が同じ年齢で求まる
//   （1984年生：42歳 → 2026年・丙午・午、43歳 → 2027年・丁未・未）
// - 小限パネルには年齢選択を出さない

import { renderToStaticMarkup } from "react-dom/server";
import { integerAgesOfBigLimit } from "../src/lib/big_limit_ages";
import { buildBigLimitSpans, getCurrentBigLimit } from "../src/lib/big_limit";
import { getBigLimitDegree } from "../src/lib/big_limit_degree";
import { getLiunianForLimit } from "../src/lib/liunian";
import { LimitDetailPanel, type PalaceDetail } from "../src/components/PalaceDetailPanel";

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("NG", msg); } };

// 区間 35.5〜50.5 の大限ができる命度を探す（第1限 10＋命度/3、以後の年数は既存表どおり）
const MING = "子", BIRTH = 1984;
let deg = -1, br = "";
for (let d10 = 0; d10 < 300 && deg < 0; d10++) {
  const d = d10 / 10;
  const sp = buildBigLimitSpans(MING as any, d).find((s) => s && Math.abs(s.startAge - 35.5) < 1e-9 && Math.abs(s.endAge - 50.5) < 1e-9);
  if (sp) { deg = d; br = sp.branch; }
}
check(deg >= 0, "35.5〜50.5歳の大限がある命度が見つかる");
const ages = integerAgesOfBigLimit(MING, deg, br);
check(JSON.stringify(ages) === JSON.stringify(Array.from({ length: 15 }, (_, i) => 36 + i)), `選択肢は36〜50歳: ${ages.join(",")}`);
for (const a of ages) check(getCurrentBigLimit(MING as any, deg, a)?.branch === br, `${a}歳はこの大限に入る`);
check(integerAgesOfBigLimit(MING, null, br).length === 0, "命度が無ければ選択肢なし");
// 他の大限でも、選択肢は既存の大限判定と一致し、区間外の整数を含まない
for (const sp of buildBigLimitSpans(MING as any, deg)) {
  if (!sp) continue;
  const as = integerAgesOfBigLimit(MING, deg, sp.branch);
  check(as.every((a) => a >= sp.startAge && a < sp.endAge) && as.length === Math.ceil(sp.endAge) - Math.ceil(sp.startAge), `${sp.branch}宮の選択肢が区間どおり`);
}

const detail: PalaceDetail = {
  branch: br, palaceName: "財帛宮", isShenPalace: false, mingBranch: MING, shenBranch: "午", sex: "男", isDayBirth: true,
  stars: [], henyou: [], henyou2: [], shensha: [], lord: null, mingLord: null, shenLord: null, kakkyoku: null,
  palaceNameByBranch: {}, allStars: [], henyouByBranch: {}, henyou2All: [], shenshaByBranch: {},
};
// ChartSVG と同じ組み立て：対象年齢 targetAge から、限度・流年・選択状態を同じ値で求める
const render = (targetAge: number | null) => {
  const sel = { type: "big" as const, branch: br, ageRange: "35.5〜50.5" };
  const bigDegree = getBigLimitDegree({ mingBranch: MING as any, mingDegree: deg, targetAge, clickedBranch: br });
  const liunian = getLiunianForLimit({ birthYear: BIRTH, targetAge, selection: sel, mingBranch: MING, mingDegree: deg });
  const value = targetAge != null && ages.includes(targetAge) ? targetAge : null;
  return renderToStaticMarkup(<LimitDetailPanel selection={sel} detail={detail} bigDegree={bigDegree} liunian={liunian}
    bigAgeSelect={{ ages, value, onChange: () => {} }} />);
};
const h42 = render(42);
check(h42.includes("この大限で見る年齢") && /<option value="42" selected="">42歳<\/option>/.test(h42), "42歳が選択状態");
check(!h42.includes("年齢を選択"), "範囲内の対象年齢があるときは「年齢を選択」を出さない");
check(h42.includes("対象年：2026年（42歳）") && h42.includes("流年：丙午") && h42.includes("太歳宮：午"), "42歳：2026年・丙午・午");
check(h42.includes("限宿：") && h42.includes("宿内度：") && h42.includes("限度主："), "42歳：限宿・宿内度・限度主を表示");
const h43 = render(43);
check(h43.includes("対象年：2027年（43歳）") && h43.includes("流年：丁未") && h43.includes("太歳宮：未"), "43歳：2027年・丁未・未");
const d42 = getBigLimitDegree({ mingBranch: MING as any, mingDegree: deg, targetAge: 42, clickedBranch: br });
const d43 = getBigLimitDegree({ mingBranch: MING as any, mingDegree: deg, targetAge: 43, clickedBranch: br });
check(d42.available && d43.available && d42.progressedDegree !== d43.progressedDegree, "42歳と43歳で限度が更新される");
for (const t of [null, 20, 60]) {
  const h = render(t);
  check(h.includes("<option value=\"\" selected=\"\">年齢を選択</option>") && !/<option value="\d+" selected/.test(h), `対象年齢 ${t ?? "未入力"}：年齢を自動で決めず「年齢を選択」`);
  check(!h.includes("対象年："), `対象年齢 ${t ?? "未入力"}：流年は出さない`);
}
// 小限パネルには年齢選択を出さない
const hs = renderToStaticMarkup(<LimitDetailPanel selection={{ type: "small", branch: br, ages: [1, 13] }} detail={detail} bigAgeSelect={{ ages, value: 42, onChange: () => {} }} />);
check(!hs.includes("この大限で見る年齢"), "小限パネルには年齢選択を出さない");

if (fail) { console.log(`FAIL ${fail}`); process.exit(1); }
console.log("PASS");
