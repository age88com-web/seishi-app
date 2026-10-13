// tests/qizheng_liunian.manual.tsx
//
// 七政四餘 行限と流年の連動（src/lib/liunian.ts、Phase 7A）の確認。
// 実行: npx tsx tests/qizheng_liunian.manual.tsx
//
// - 対象年 = 出生年 + 対象年齢（1984年生・42歳 → 2026年、43歳 → 2027年）
// - 流年干支・太歳宮（＝流年の年支）は共通暦エンジンの年干支（1900〜2100年で60年周期と一致）
// - 大限・小限とも、クリックした宮が対象年齢の大限宮・小限宮のときだけ流年を出す（同じ対象年の情報）
// - 流年神殺は対象年の年干・年支で既存の神殺エンジンを適用し、出生時神殺とは別に保持
// - 行限パネルに「対象年・流年・太歳宮」を表示。流年を渡さない場合の表示は従来と同じ

import { renderToStaticMarkup } from "react-dom/server";
import { getLiunianForLimit, liunianOfYear, targetYearOf } from "../src/lib/liunian";
import { getCurrentBigLimit } from "../src/lib/big_limit";
import { getCurrentSmallLimitBranch, smallLimitAgesForBranch } from "../src/lib/small_limit";
import { getNenganPalaceShensha, getNenshiPalaceShensha } from "../src/lib/shensha_engine";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { LimitDetailPanel, type PalaceDetail } from "../src/components/PalaceDetailPanel";

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("NG", msg); } };

// 対象年と流年干支
check(targetYearOf(1984, 42) === 2026 && targetYearOf(1984, 43) === 2027 && targetYearOf(1984, 0) === 1984, "対象年＝出生年＋対象年齢（0歳＝出生年）");
check(JSON.stringify(liunianOfYear(2026)) === JSON.stringify({ stem: "丙", branch: "午" }), "2026年＝丙午");
check(JSON.stringify(liunianOfYear(2027)) === JSON.stringify({ stem: "丁", branch: "未" }), "2027年＝丁未");
check(JSON.stringify(liunianOfYear(1984)) === JSON.stringify({ stem: "甲", branch: "子" }), "1984年＝甲子");
for (let y = 1900; y <= 2100; y++) {
  const i = (((y - 1984) % 60) + 60) % 60;
  const g = liunianOfYear(y);
  check(g.stem === STEMS[i % 10] && g.branch === BRANCHES[i % 12], `${y}年の干支が60年周期と一致`);
}

// 行限クリックとの連動（命宮・命度は任意の例）
const MING = "子", DEG = 12.3, BIRTH = 1984;
for (const age of [42, 43]) {
  const big = getCurrentBigLimit(MING as any, DEG, age)!;
  const small = getCurrentSmallLimitBranch(MING, age)!;
  const lb = getLiunianForLimit({ birthYear: BIRTH, targetAge: age, selection: { type: "big", branch: big.branch }, mingBranch: MING, mingDegree: DEG });
  const ls = getLiunianForLimit({ birthYear: BIRTH, targetAge: age, selection: { type: "small", branch: small }, mingBranch: MING, mingDegree: DEG });
  const y = BIRTH + age, g = liunianOfYear(y);
  check(lb.available && lb.targetYear === y && lb.ganzhi === g.stem + g.branch && lb.taisuiBranch === g.branch, `${age}歳：大限クリックで ${y}年の流年`);
  check(ls.available && lb.available && ls.targetYear === y && ls.ganzhi === lb.ganzhi && ls.taisuiBranch === lb.taisuiBranch, `${age}歳：小限クリックで同じ ${y}年の流年`);
  check(smallLimitAgesForBranch(MING, small).includes(age % 12), "小限宮は対象年齢の小限ラベルの宮");
  // 対象年齢の大限・小限でない宮は流年を出さない（範囲や別ラベルの年齢から1年を選ばない）
  const otherBig = "子丑寅卯辰巳午未申酉戌亥".split("").find((b) => b !== big.branch)!;
  const otherSmall = "子丑寅卯辰巳午未申酉戌亥".split("").find((b) => b !== small)!;
  check(!getLiunianForLimit({ birthYear: BIRTH, targetAge: age, selection: { type: "big", branch: otherBig }, mingBranch: MING, mingDegree: DEG }).available, `${age}歳：別の大限宮 → 出さない`);
  check(!getLiunianForLimit({ birthYear: BIRTH, targetAge: age, selection: { type: "small", branch: otherSmall }, mingBranch: MING, mingDegree: DEG }).available, `${age}歳：別の小限宮 → 出さない`);
  // 流年神殺：対象年の年干・年支で既存エンジンを適用し、出生時（1984 甲子）とは別
  if (lb.available) {
    check(JSON.stringify(lb.shensha.year_stem) === JSON.stringify(getNenganPalaceShensha(lb.stem as any)), "流年神殺（年干）＝対象年の年干で既存エンジン");
    check(JSON.stringify(lb.shensha.year_branch) === JSON.stringify(getNenshiPalaceShensha(lb.branch as any)), "流年神殺（年支）＝対象年の年支で既存エンジン");
    check(JSON.stringify(lb.shensha.year_branch) !== JSON.stringify(getNenshiPalaceShensha("子" as any)), "流年神殺は出生年（子）の神殺と別");
  }
}
check(getLiunianForLimit({ birthYear: BIRTH, targetAge: null, selection: { type: "big", branch: "子" }, mingBranch: MING, mingDegree: DEG }).available === false, "対象年齢なし → 出さない");
check(getLiunianForLimit({ birthYear: null, targetAge: 42, selection: { type: "small", branch: "子" }, mingBranch: MING, mingDegree: DEG }).available === false, "出生年なし → 出さない");
check(getLiunianForLimit({ birthYear: BIRTH, targetAge: 42, selection: { type: "big", branch: getCurrentBigLimit(MING as any, DEG, 42)!.branch }, mingBranch: MING, mingDegree: null }).available === false, "命度なし（大限を確認できない）→ 出さない");

// パネル表示
const detail = (branch: string): PalaceDetail => ({
  branch, palaceName: "官禄宮", isShenPalace: false, mingBranch: MING, shenBranch: "午", sex: "男", isDayBirth: true,
  stars: [], henyou: [], henyou2: [], shensha: [], lord: null, mingLord: null, shenLord: null, kakkyoku: null,
  palaceNameByBranch: {}, allStars: [], henyouByBranch: {}, henyou2All: [], shenshaByBranch: {},
});
for (const [age, year, gz, tb] of [[42, 2026, "丙午", "午"], [43, 2027, "丁未", "未"]] as const) {
  const big = getCurrentBigLimit(MING as any, DEG, age)!;
  const small = getCurrentSmallLimitBranch(MING, age)!;
  const hb = renderToStaticMarkup(<LimitDetailPanel selection={{ type: "big", branch: big.branch, ageRange: "x" }} detail={detail(big.branch)}
    liunian={getLiunianForLimit({ birthYear: BIRTH, targetAge: age, selection: { type: "big", branch: big.branch }, mingBranch: MING, mingDegree: DEG })} />);
  const hs = renderToStaticMarkup(<LimitDetailPanel selection={{ type: "small", branch: small, ages: smallLimitAgesForBranch(MING, small) }} detail={detail(small)}
    liunian={getLiunianForLimit({ birthYear: BIRTH, targetAge: age, selection: { type: "small", branch: small }, mingBranch: MING, mingDegree: DEG })} />);
  for (const [h, kind] of [[hb, "大限"], [hs, "小限"]] as const) {
    check(h.includes(`対象年：${year}年（${age}歳）`) && h.includes(`流年：${gz}`) && h.includes(`太歳宮：${tb}`), `パネル（${kind}・${age}歳）：対象年${year}・流年${gz}・太歳宮${tb}`);
  }
}
const hNone = renderToStaticMarkup(<LimitDetailPanel selection={{ type: "big", branch: "寅", ageRange: "x" }} detail={detail("寅")} />);
check(!hNone.includes("流年") && !hNone.includes('data-testid="liunian"'), "流年を渡さないときは従来どおり表示しない");

if (fail) { console.log(`FAIL ${fail}`); process.exit(1); }
console.log("PASS");
