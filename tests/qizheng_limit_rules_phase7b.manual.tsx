// tests/qizheng_limit_rules_phase7b.manual.tsx
//
// 七政四餘 行限ルール Phase 7B（流年・太歳・流年神殺を使う通常ルール）の確認。
// 実行: TZ=Asia/Tokyo npx tsx tests/qizheng_limit_rules_phase7b.manual.tsx   （--print で成立例を出力）
//
// - 流年ルール（lr_0570・lr_0588）は、対象年齢の大限・小限宮（流年が求まったとき）だけ判定され、それ以外の宮では出ない
// - 流年神殺は lib/liunian.ts の値（対象年の年干・年支）を使い、出生時神殺と取り違えない
// - 1条件を外すと出ない／神殺の列挙は OR
// - 第1限・小限では限度系ルールが出ない。lr_0550 と Phase 6B の11件は従来どおり。death_timing は出ない
// - 実在の日時（画面と同じ計算手順）で、命宮方式の通常（ASC 基準命度）・古典（calcMingDegreeFromSunLon）の両モードの成立例

import { CONFIRMED_LIMIT_RULES, loadNormalLimitRules, matchConfirmedLimitRules, type AnnualInput, type BodyAtBranch, type LimitRuleInput } from "../src/lib/limit_rules";
import { getLiunianForLimit } from "../src/lib/liunian";
import { getNenshiPalaceShensha } from "../src/lib/shensha_engine";
import allRulesJson from "../docs/qizheng-data/qizheng_limit_rules_v1_ja.json";
import { ascMingDegree } from "../src/lib/ming_degree";
import { sampleChart } from "./helpers/qizheng_sample_chart";
import * as BigLimit from "../src/lib/big_limit";
import { getBigLimitDegree } from "../src/lib/big_limit_degree";
import { getCurrentSmallLimitBranch } from "../src/lib/small_limit";

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("NG", msg); } };
const PRINT = process.argv.includes("--print");
const ALL = (allRulesJson as unknown as { records: { id: string; sensitivity: string }[] }).records;
const deathIds = new Set(ALL.filter((r) => r.sensitivity === "death_timing").map((r) => r.id));
const ANNUAL_IDS = ["lr_0570", "lr_0588"];
const DEGREE_IDS = CONFIRMED_LIMIT_RULES.filter((r) => r.needsDegree).map((r) => r.id);
const BR = [..."子丑寅卯辰巳午未申酉戌亥"];

const annualOf = (l: ReturnType<typeof getLiunianForLimit>): AnnualInput | null =>
  l.available ? { targetYear: l.targetYear, stem: l.stem, branch: l.branch, taisuiBranch: l.taisuiBranch, shensha: l.shensha } : null;
const where = (map: Partial<Record<string, string[]>>, name: string) => BR.filter((b) => (map[b] ?? []).includes(name));

async function main() {
  const normal = await loadNormalLimitRules();
  check(normal.size === 400 && [...normal.values()].every((r) => r.sensitivity === "normal"), "読み込みは normal 400件だけ");
  check(ANNUAL_IDS.every((id) => CONFIRMED_LIMIT_RULES.some((r) => r.id === id && r.needsAnnual)), "流年ルール2件が登録され needsAnnual");
  const ids = (i: LimitRuleInput) => matchConfirmedLimitRules(i, normal).map((m) => m.rec.id);

  // ---------- 合成：2026年（丙午）、命宮子・1984年生 42歳 ----------
  const MING = "子", DEG = 12.3, BIRTH = 1984, AGE = 42;
  const big = BigLimit.getCurrentBigLimit(MING as any, DEG, AGE)!;
  const small = getCurrentSmallLimitBranch(MING, AGE)!;
  const lBig = getLiunianForLimit({ birthYear: BIRTH, targetAge: AGE, selection: { type: "big", branch: big.branch }, mingBranch: MING, mingDegree: DEG });
  const a = annualOf(lBig)!;
  check(!!a && a.taisuiBranch === "午" && a.targetYear === 2026, "2026年の太歳宮＝午");
  const yb = getNenshiPalaceShensha("午" as any);
  check(JSON.stringify(a.shensha.year_branch) === JSON.stringify(yb), "流年神殺（年支系）＝対象年の年支（午）で既存エンジン");
  const sangmen = where(a.shensha.year_branch, "喪門"), baihu = where(a.shensha.year_branch, "白虎");
  const baowei = where(a.shensha.year_branch, "豹尾"), huangfan = where(a.shensha.year_branch, "黄旙");
  check(sangmen.length === 1 && baihu.length === 1 && baowei.length === 1 && huangfan.length === 1, "喪門・白虎・豹尾・黄旙の宮が一つずつ");
  const base = (o: Partial<LimitRuleInput>): LimitRuleInput => ({ type: "big", branch: "寅", isDayBirth: true, bodies: [], degree: null, mingBranch: "亥", annual: a, ...o });

  // lr_0570：喪門 OR 白虎 が限宮 OR 命宮（「守命限」）
  check(ids(base({ branch: sangmen[0] })).includes("lr_0570"), `0570：喪門（${sangmen[0]}）が限宮 → 成立`);
  check(ids(base({ branch: baihu[0] })).includes("lr_0570"), `0570：白虎（${baihu[0]}）が限宮 → 成立（列挙は OR）`);
  const neither = BR.find((b) => b !== sangmen[0] && b !== baihu[0])!;
  const mingNeither = BR.find((b) => b !== sangmen[0] && b !== baihu[0] && b !== neither)!;
  check(!ids(base({ branch: neither, mingBranch: mingNeither })).includes("lr_0570"), "0570：限宮・命宮とも喪門白虎なし → 不成立");
  check(ids(base({ branch: neither, mingBranch: sangmen[0] })).includes("lr_0570"), "0570：喪門が命宮 → 成立（守命）");
  check(!ids(base({ branch: sangmen[0], annual: null })).includes("lr_0570"), "0570：流年なし（対象年齢外の宮）→ 不成立");
  const m570 = matchConfirmedLimitRules(base({ branch: sangmen[0] }), normal).find((m) => m.rec.id === "lr_0570");
  check(m570?.basis === `太歳＝午、流年神殺＝喪門が限宮（${sangmen[0]}）にある`, `0570：該当表示: ${m570?.basis}`);
  // lr_0588：豹尾 OR 黄幡（エンジン表記 黄旙）が限宮
  check(ids(base({ branch: baowei[0] })).includes("lr_0588"), "0588：豹尾が限宮 → 成立");
  check(ids(base({ branch: huangfan[0] })).includes("lr_0588"), "0588：黄旙（原文 黃幡）が限宮 → 成立");
  const noBw = BR.find((b) => b !== baowei[0] && b !== huangfan[0])!;
  check(!ids(base({ branch: noBw })).includes("lr_0588"), "0588：限宮に豹尾・黄旙なし → 不成立");
  check(!ids(base({ branch: noBw, mingBranch: baowei[0] })).includes("lr_0588"), "0588：豹尾が命宮だけ → 不成立");
  // 流年神殺と出生時神殺を取り違えない：出生年（1984 子）の豹尾の宮では、流年の豹尾が無ければ出ない
  const natalBw = where(getNenshiPalaceShensha("子" as any), "豹尾")[0];
  if (natalBw !== baowei[0] && natalBw !== huangfan[0]) check(!ids(base({ branch: natalBw })).includes("lr_0588"), `0588：出生年の豹尾の宮（${natalBw}）では出ない`);
  // 小限（対象年齢の小限宮）：流年ルールは判定され、限度系は出ない
  const lSmall = getLiunianForLimit({ birthYear: BIRTH, targetAge: AGE, selection: { type: "small", branch: small }, mingBranch: MING, mingDegree: DEG });
  check(lSmall.available, "対象年齢の小限宮では流年が求まる");
  check(ids(base({ type: "small", branch: sangmen[0], annual: annualOf(lSmall) })).includes("lr_0570"), "小限でも流年ルールは判定される");
  check(!ids(base({ type: "small", branch: "午", degree: { limitOrder: 3, mansion: "星", degreeLord: "sun" }, bodies: [{ id: "jupiter", label: "木", branch: "午", mansion: "星" }] })).some((x) => DEGREE_IDS.includes(x)), "小限では限度系が出ない");
  // 対象年齢外の大限・小限：流年が求まらず流年ルールは出ない
  const otherBig = BR.find((b) => b !== big.branch)!;
  check(!getLiunianForLimit({ birthYear: BIRTH, targetAge: AGE, selection: { type: "big", branch: otherBig }, mingBranch: MING, mingDegree: DEG }).available, "対象年齢外の大限では流年が求まらない");

  // ---------- 回帰：lr_0550 と Phase 6B の11件は流年の有無で結果が変わらない ----------
  let rnd = 99;
  const rand = (n: number) => { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd % n; };
  const MAN = ["星", "奎", "井", "尾", "觜", "女", "氐", "柳", "牛", "軫", "角", "房"];
  const STARS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "rahu", "ketu", "yuebo", "ziqi"];
  for (let t = 0; t < 3000; t++) {
    const bodies: BodyAtBranch[] = STARS.map((id) => ({ id, label: id, branch: BR[rand(12)], mansion: MAN[rand(12)] }));
    const inp = base({ type: rand(2) ? "big" : "small", branch: BR[rand(12)], isDayBirth: !!rand(2), bodies, degree: rand(3) ? { limitOrder: 2 + rand(10), mansion: MAN[rand(12)], degreeLord: "sun" } : null });
    const without = ids({ ...inp, annual: null });
    const withA = ids(inp).filter((x) => !ANNUAL_IDS.includes(x));
    check(JSON.stringify(without) === JSON.stringify(withA), `流年を渡しても既存ルールの結果は同じ #${t}`);
    check(ids(inp).every((x) => !deathIds.has(x)), "death_timing が出ない");
  }

  // ---------- 実在の日時（画面と同じ計算手順。通常＝ASC 基準命度／古典＝calcMingDegreeFromSunLon の両モード）----------
  const found = new Map<string, string>();
  let annualChecks = 0, firstLimit = 0, smallChecks = 0, outside = 0;
  const start = Date.UTC(1935, 0, 1, 3, 0);
  for (let k = 0; k < 3000; k++) {
    const d = new Date(start + k * 10.11 * 86400000);
    for (const mode of ["getsu", "handen"] as const) {
      const c = sampleChart(d, mode);
      const { bodies, mingBranch, mingDegree, isDayBirth, birthYear } = c;
      if (mode === "handen") check(mingDegree === ascMingDegree(c.ascLon, mingBranch), "通常：ASC 基準命度");
      else check(mingDegree === BigLimit.calcMingDegreeFromSunLon(c.sunLon), "古典：calcMingDegreeFromSunLon");
      const tag = mode === "handen" ? "通常" : "古典";
      for (const age of [5, 18, 33, 47, 60, 72]) {
        const span = BigLimit.getCurrentBigLimit(mingBranch as any, mingDegree, age);
        if (!span) continue;
        const bd = getBigLimitDegree({ mingBranch: mingBranch as any, mingDegree, targetAge: age, clickedBranch: span.branch });
        const degree = bd.available ? { limitOrder: bd.limitOrder, mansion: bd.mansion, degreeLord: bd.degreeLord?.star ?? null } : null;
        // 流年の大限判定も同じ共通命度（getLiunianForLimit に同じ mingDegree を渡す）
        const lb = getLiunianForLimit({ birthYear, targetAge: age, selection: { type: "big", branch: span.branch }, mingBranch, mingDegree });
        check(lb.available && lb.targetYear === birthYear + age, "対象年齢の大限では流年が求まる");
        const ms = matchConfirmedLimitRules({ type: "big", branch: span.branch, isDayBirth, bodies, degree, mingBranch, annual: annualOf(lb) }, normal);
        annualChecks++;
        check(ms.every((m) => !deathIds.has(m.rec.id)), "death_timing が出ない");
        if (span.order === 0) { firstLimit++; check(!ms.some((m) => DEGREE_IDS.includes(m.rec.id)), "第1限で限度系が出ない"); }
        for (const m of ms) if (ANNUAL_IDS.includes(m.rec.id) && !found.has(`${m.rec.id}|big|${mode}`)) {
          found.set(`${m.rec.id}|big|${mode}`, `${tag}：${birthYear}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} 東京・命宮${mingBranch}・命度${mingDegree.toFixed(2)}・${age}歳 → 対象年${lb.available ? lb.targetYear + "年" + lb.ganzhi : ""}・大限${span.branch}宮（第${span.order + 1}限）／該当：${m.basis}`);
        }
        // 対象年齢外の大限：流年は求まらず、流年ルールは出ない
        const other = BR.find((b) => b !== span.branch)!;
        const lo = getLiunianForLimit({ birthYear, targetAge: age, selection: { type: "big", branch: other }, mingBranch, mingDegree });
        outside++;
        check(!lo.available, "対象年齢外の大限では流年が求まらない");
        check(!matchConfirmedLimitRules({ type: "big", branch: other, isDayBirth, bodies, degree: null, mingBranch, annual: annualOf(lo) }, normal).some((m) => ANNUAL_IDS.includes(m.rec.id)), "対象年齢外の大限で流年ルールが出ない");
        // 対象年齢の小限
        const sb = getCurrentSmallLimitBranch(mingBranch, age)!;
        const ls = getLiunianForLimit({ birthYear, targetAge: age, selection: { type: "small", branch: sb }, mingBranch, mingDegree });
        const sm = matchConfirmedLimitRules({ type: "small", branch: sb, isDayBirth, bodies, degree, mingBranch, annual: annualOf(ls) }, normal);
        smallChecks++;
        check(!sm.some((m) => DEGREE_IDS.includes(m.rec.id)), "小限で限度系が出ない");
        check(sm.every((m) => !deathIds.has(m.rec.id)), "小限で death_timing が出ない");
        for (const m of sm) if (ANNUAL_IDS.includes(m.rec.id) && !found.has(`${m.rec.id}|small|${mode}`)) found.set(`${m.rec.id}|small|${mode}`, `${tag}：${birthYear}年生 ${age}歳 小限${sb}宮／該当：${m.basis}`);
      }
    }
  }
  for (const mode of ["getsu", "handen"]) check(ANNUAL_IDS.every((id) => found.has(`${id}|big|${mode}`)), `実在の盤で流年ルール2件が大限で成立（${mode === "handen" ? "通常" : "古典"}）`);
  if (PRINT) {
    console.log(`実在の盤 3000日時 × 2モード × 年齢6通り（大限 ${annualChecks}・第1限 ${firstLimit}・小限 ${smallChecks}・対象年齢外の大限 ${outside}）`);
    for (const [k, v] of found) console.log(k, v);
  }
  if (fail) { console.log(`FAIL ${fail}`); process.exit(1); }
  console.log("PASS");
}
main();
