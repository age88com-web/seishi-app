// tests/qizheng_limit_rules_phase6.manual.tsx
//
// 七政四餘 行限ルール Phase 6／6B（限宿・限度主を使う通常ルール。6B で犯度・同躔・星列挙を原典の用例から再確認）の確認。
// 実行: TZ=Asia/Tokyo npx tsx tests/qizheng_limit_rules_phase6.manual.tsx   （--print で成立例を出力）
//
// 1. 729件の全件再監査：normal 400件が docs/qizheng-limit-rules-normal-audit.md に1回ずつ載り、
//    CONFIRMED の一覧が src/lib/limit_rules.ts の登録と一致する（death_timing は載らない）
// 2. 読み込みは normal だけ（death_timing は判定・表示されない）
// 3. 新規ルールは条件がすべて成立したときだけ出る／1条件でも外すと出ない（星の列挙は OR、限宿条件と犯度条件は AND）
// 4. 第1限・小限・限度不明では限度系ルールが出ない
// 5. lr_0550 は従来の判定と同じ結果
// 6. 実在の日時（画面と同じ計算手順）で、命宮方式の通常（ASC 基準命度）・古典（calcMingDegreeFromSunLon）の両モードについて
//    複数盤・複数年齢を走査し、大限区切り・限宿・宿内度・限度主・新規ルールの成立例・lr_0550・第1限／小限で出ないことを確認

import fs from "fs";
import {
  CONFIRMED_LIMIT_RULES, loadNormalLimitRules, matchConfirmedLimitRules, matchLr0550,
  type BodyAtBranch, type LimitRuleInput,
} from "../src/lib/limit_rules";
import allRulesJson from "../docs/qizheng-data/qizheng_limit_rules_v1_ja.json";
import { lonToMansionDeg } from "../src/lib/mansions28";
import { getMansionDegreeLord } from "../src/lib/qizheng_interpretations";
import { ascMingDegree } from "../src/lib/ming_degree";
import { sampleChart } from "./helpers/qizheng_sample_chart";
import * as BigLimit from "../src/lib/big_limit";
import { getBigLimitDegree } from "../src/lib/big_limit_degree";
import { getCurrentSmallLimitBranch } from "../src/lib/small_limit";

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("NG", msg); } };
const PRINT = process.argv.includes("--print");

type Rec = { id: string; sensitivity: string; scope: string };
const ALL = (allRulesJson as unknown as { records: Rec[] }).records;
const NEW_IDS = ["lr_0155", "lr_0163", "lr_0164", "lr_0165", "lr_0167", "lr_0169", "lr_0170", "lr_0172", "lr_0174", "lr_0180", "lr_0633"];
// Phase 6B で CONFIRMED から外したもの（同躔の相手・犯度の所在・「逢」の範囲が原典で確定できない）
const REMOVED_IDS = ["lr_0338", "lr_0342", "lr_0566", "lr_0567", "lr_0608"];
const DEGREE_IDS = CONFIRMED_LIMIT_RULES.filter((r) => r.needsDegree).map((r) => r.id);

async function main() {
  // ---------- 1・2. 全件監査と読み込み ----------
  check(ALL.length === 729, `全件数 ${ALL.length}`);
  const normalIds = ALL.filter((r) => r.sensitivity === "normal").map((r) => r.id);
  const deathIds = new Set(ALL.filter((r) => r.sensitivity === "death_timing").map((r) => r.id));
  check(normalIds.length === 400 && deathIds.size === 329, `normal ${normalIds.length} / death_timing ${deathIds.size}`);
  const doc = fs.readFileSync("docs/qizheng-limit-rules-normal-audit.md", "utf8");
  const rows = [...doc.matchAll(/^\| (lr_\d{4}) \| (CONFIRMED|PARTIAL|THEORY|AMBIGUOUS)/gm)].map((m) => ({ id: m[1], cls: m[2] }));
  check(rows.length === 400 && new Set(rows.map((r) => r.id)).size === 400, `監査表の行数 ${rows.length}`);
  check(normalIds.every((id) => rows.some((r) => r.id === id)), "normal 全件が監査表にある");
  check(rows.every((r) => !deathIds.has(r.id)), "death_timing は監査表に無い");
  const docConfirmed = rows.filter((r) => r.cls === "CONFIRMED").map((r) => r.id).sort();
  const codeConfirmed = CONFIRMED_LIMIT_RULES.map((r) => r.id).sort();
  check(JSON.stringify(docConfirmed) === JSON.stringify(codeConfirmed), `監査表の CONFIRMED と登録が一致: ${docConfirmed.join(",")} / ${codeConfirmed.join(",")}`);
  for (const r of CONFIRMED_LIMIT_RULES) {
    const rec = ALL.find((x) => x.id === r.id);
    check(!!rec && rec.sensitivity === "normal" && rec.scope === r.scope, `登録 ${r.id} の scope/sensitivity が JSON と一致`);
  }
  const normal = await loadNormalLimitRules();
  check(normal.size === 400 && [...normal.values()].every((r) => r.sensitivity === "normal"), "読み込みは normal 400件だけ");

  // ---------- 3・4. 条件の成立／不成立 ----------
  const B = (id: string, branch: string, mansion: string): BodyAtBranch => ({ id, label: id, branch, mansion });
  const base = (o: Partial<LimitRuleInput>): LimitRuleInput => ({
    type: "big", branch: "寅", isDayBirth: true, bodies: [], degree: null, ...o,
  });
  const ids = (i: LimitRuleInput) => matchConfirmedLimitRules(i, normal).map((m) => m.rec.id);
  const deg = (mansion: string, lord: string | null, limitOrder = 3) => ({ limitOrder, mansion, degreeLord: lord });

  check(REMOVED_IDS.every((id) => !CONFIRMED_LIMIT_RULES.some((r) => r.id === id)), "6B で外した5件は登録に無い");
  // 限度宜忌：lr_0155「星日忌木氣犯度」＝限宿が星 AND（木星 OR 紫炁が星宿）
  const c155 = base({ branch: "午", degree: deg("星", "sun"), bodies: [B("jupiter", "午", "星"), B("ziqi", "未", "張")] });
  check(ids(c155).includes("lr_0155"), "0155：限宿星・木星だけが星宿 → 成立（列挙は OR）");
  check(ids({ ...c155, bodies: [B("jupiter", "巳", "翼"), B("ziqi", "午", "星")] }).includes("lr_0155"), "0155：紫炁だけが星宿 → 成立");
  check(ids({ ...c155, bodies: [B("jupiter", "午", "星"), B("ziqi", "午", "星")] }).includes("lr_0155"), "0155：両方が星宿 → 成立");
  check(!ids({ ...c155, bodies: [B("jupiter", "巳", "翼"), B("ziqi", "未", "張")] }).includes("lr_0155"), "0155：どちらも星宿に無い（犯度条件が欠ける）→ 不成立");
  check(!ids({ ...c155, bodies: [B("mars", "午", "星")] }).includes("lr_0155"), "0155：列挙外の星だけ → 不成立");
  check(!ids({ ...c155, bodies: [B("jupiter", "午", "")] }).includes("lr_0155"), "0155：星の宿が不明 → 不成立");
  check(!ids({ ...c155, degree: deg("張", "moon") }).includes("lr_0155"), "0155：限宿が張（限宿条件が欠ける）→ 不成立");
  check(!ids({ ...c155, degree: deg("星", "sun", 1) }).includes("lr_0155"), "0155：第1限扱い（limitOrder 1）→ 不成立");
  check(!ids({ ...c155, degree: null }).includes("lr_0155"), "0155：限度なし（第1限・他の大限）→ 不成立");
  check(!ids({ ...c155, type: "small" }).includes("lr_0155"), "0155：小限 → 不成立");
  const m155 = matchConfirmedLimitRules(c155, normal).find((m) => m.rec.id === "lr_0155");
  check(m155?.basis === "限宿＝星宿、出生時の木星が星宿にある", `0155：該当表示は実際に犯度の星だけ: ${m155?.basis}`);
  // 他の限度宜忌（OR）
  const one = (id: string, mansion: string, star: string, lord: string) =>
    ids(base({ degree: deg(mansion, lord), bodies: [B(star, "子", mansion)] })).includes(id);
  check(one("lr_0163", "奎", "venus", "jupiter") && one("lr_0163", "奎", "ziqi", "jupiter"), "0163：金星・紫炁のいずれか");
  check(one("lr_0164", "井", "ziqi", "jupiter") && one("lr_0164", "井", "venus", "jupiter"), "0164：紫炁・金星のいずれか");
  check(one("lr_0165", "尾", "rahu", "mars") && one("lr_0165", "尾", "mercury", "mars"), "0165：羅喉・水星のいずれか");
  check(one("lr_0167", "觜", "saturn", "mars") && one("lr_0167", "觜", "ketu", "mars") && one("lr_0167", "觜", "yuebo", "mars"), "0167：土星・計都・月孛のいずれか");
  check(one("lr_0169", "女", "jupiter", "saturn") && one("lr_0169", "女", "ziqi", "saturn"), "0169：木星・紫炁のいずれか");
  check(one("lr_0172", "柳", "jupiter", "saturn") && one("lr_0172", "柳", "ziqi", "saturn"), "0172：木星・紫炁のいずれか");
  check(one("lr_0174", "牛", "ziqi", "venus") && !one("lr_0174", "牛", "mercury", "venus"), "0174：紫炁だけ");
  // 句読が二通りに読める倒限の文：どちらの読みでも成り立つ星だけ
  check(one("lr_0170", "氐", "mercury", "saturn"), "0170：水星が氐 → 成立");
  check(!one("lr_0170", "氐", "rahu", "saturn") && !one("lr_0170", "氐", "ziqi", "saturn"), "0170：羅喉・紫炁だけ（一方の読みでは倒限にならない）→ 不成立");
  check(one("lr_0180", "軫", "ketu", "mercury"), "0180：計都が軫 → 成立");
  check(!one("lr_0180", "軫", "saturn", "mercury"), "0180：土星だけ（一方の読みでは倒限にならない）→ 不成立");
  // 6B で外したもの：以前成立した形でも出ない
  check(!ids(base({ branch: "戌", degree: deg("婁", "venus"), bodies: [B("mercury", "戌", "婁"), B("yuebo", "戌", "婁")] })).includes("lr_0338"), "0338：外したので出ない");
  check(!ids(base({ branch: "亥", degree: deg("室", "mars"), bodies: [B("venus", "亥", "室"), B("rahu", "亥", "室")] })).includes("lr_0342"), "0342：外したので出ない");
  check(!ids(base({ degree: deg("斗", "jupiter"), bodies: [B("venus", "寅", "斗")] })).some((x) => x === "lr_0566" || x === "lr_0567"), "0566/0567：外したので出ない");
  check(!ids(base({ branch: "午", bodies: [B("jupiter", "午", "柳"), B("ziqi", "午", "星")] })).includes("lr_0608"), "0608：外したので出ない");
  // 星配置：lr_0633（日・月のいずれか。限度不要。小限でも可）
  const c633 = base({ branch: "子", bodies: [B("sun", "子", "女"), B("moon", "丑", "牛")] });
  check(ids(c633).includes("lr_0633") && ids({ ...c633, type: "small" }).includes("lr_0633"), "0633：限宮に太陽だけ → 大限・小限とも成立");
  check(ids({ ...c633, bodies: [B("sun", "亥", "室"), B("moon", "子", "虚")] }).includes("lr_0633"), "0633：限宮に太陰だけ → 成立");
  check(!ids({ ...c633, bodies: [B("sun", "亥", "室"), B("moon", "丑", "牛")] }).includes("lr_0633"), "0633：日月とも別宮 → 不成立");
  // 表示順：限宿（3）→ 星配置（4）
  const multi = base({ branch: "午", isDayBirth: true, degree: deg("星", "sun"), bodies: [B("jupiter", "午", "星"), B("sun", "午", "柳")] });
  const order = ids(multi);
  check(JSON.stringify(order) === JSON.stringify(["lr_0155", "lr_0550", "lr_0633"]), `表示順: ${order.join(",")}`);

  // ---------- 5. lr_0550 の回帰（従来の判定と同じ） ----------
  const BR = [..."子丑寅卯辰巳午未申酉戌亥"];
  const STARS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "rahu", "ketu", "yuebo", "ziqi"];
  let rnd = 12345;
  const rand = (n: number) => { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd % n; };
  for (let t = 0; t < 3000; t++) {
    const bodies = STARS.map((id) => B(id, BR[rand(12)], "角"));
    const input = base({ branch: BR[rand(12)], isDayBirth: rand(2) === 0, bodies, type: rand(2) ? "big" : "small" });
    const old = matchLr0550(input.branch, input.isDayBirth, bodies);
    const now = matchConfirmedLimitRules(input, normal).find((m) => m.rec.id === "lr_0550");
    check((old.length > 0) === !!now && (!now || JSON.stringify(now.matched) === JSON.stringify(old)), `lr_0550 回帰 #${t}`);
    if (now) check(now.basis === undefined, "lr_0550 の該当表示は従来の文言（basis なし）");
  }

  // ---------- 6. 実在の日時で複数盤・複数年齢（通常＝ASC 基準命度／古典＝calcMingDegreeFromSunLon の両モード） ----------
  // 盤の値は画面と同じ手順（tests/helpers/qizheng_sample_chart.ts：命宮方式に応じた命宮と共通の命度 mingDegreeForMode）
  const found = new Map<string, string>();
  const stat = { charts: 0, firstLimitChecks: 0, smallChecks: 0, degreeChecks: 0, modeDiff: 0 };
  const start = Date.UTC(1935, 0, 1, 3, 0);
  for (let k = 0; k < 9000; k++) {
    const d = new Date(start + k * 3.37 * 86400000); // 約3.4日ごと（時刻もずれる）
    const byMode = { getsu: sampleChart(d, "getsu"), handen: sampleChart(d, "handen") };
    if (byMode.getsu.mingDegree !== byMode.handen.mingDegree) stat.modeDiff++;
    for (const mode of ["getsu", "handen"] as const) {
      const c = byMode[mode];
      const { bodies, mingBranch, mingDegree, isDayBirth } = c;
      stat.charts++;
      // 1・2. 命度：通常＝ASC 基準、古典＝calcMingDegreeFromSunLon
      if (mode === "handen") check(mingDegree === ascMingDegree(c.ascLon, mingBranch), "通常：ASC 基準命度");
      else check(mingDegree === BigLimit.calcMingDegreeFromSunLon(c.sunLon), "古典：calcMingDegreeFromSunLon");
      const spans = BigLimit.buildBigLimitSpans(mingBranch as any, mingDegree);
      check(spans[0]!.endAge === 10 + mingDegree / 3, "大限区切り：第1限＝10＋命度/3");
      for (const age of [8, 15, 23, 31, 38, 46, 53, 61, 68, 76, 84]) {
        const span = BigLimit.getCurrentBigLimit(mingBranch as any, mingDegree, age);
        if (!span) continue;
        // 3. 大限区切り：区間判定が同じ命度の大限表と一致
        check(spans.some((x) => x && x.branch === span.branch && x.startAge === span.startAge && x.endAge === span.endAge && age >= x.startAge && age < x.endAge), "大限区切りが共通命度の大限表と一致");
        const bd = getBigLimitDegree({ mingBranch: mingBranch as any, mingDegree, targetAge: age, clickedBranch: span.branch });
        // 4〜6. 限宿・宿内度・限度主：同じ命度・同じ大限区間から独立に再計算して一致
        if (bd.available) {
          check(bd.startAge === span.startAge && bd.endAge === span.endAge, "限度は同じ大限区間");
          check(Math.abs(bd.progressedDegree - (age - span.startAge) * 30 / (span.endAge - span.startAge)) < 1e-9, "宮内の進行度＝経過年×30/年数");
          const m = lonToMansionDeg(bd.longitude) as any;
          check(m.mansion.label === bd.mansion && Math.abs(m.degInMansion - bd.mansionDegree) < 1e-9, "限宿・宿内度＝限度の黄経の宿");
          check((getMansionDegreeLord(bd.mansion)?.star ?? null) === (bd.degreeLord?.star ?? null), "限度主＝限宿の度グループの主星");
        }
        const degree = bd.available ? { limitOrder: bd.limitOrder, mansion: bd.mansion, degreeLord: bd.degreeLord?.star ?? null } : null;
        const input: LimitRuleInput = { type: "big", branch: span.branch, isDayBirth, bodies, degree };
        const ms = matchConfirmedLimitRules(input, normal);
        check(ms.every((m) => !deathIds.has(m.rec.id) && m.rec.sensitivity === "normal"), "death_timing が出ない");
        // 9. lr_0550：従来の判定と同じ
        const l550 = ms.find((m) => m.rec.id === "lr_0550");
        check(JSON.stringify(l550?.matched ?? []) === JSON.stringify(matchLr0550(span.branch, isDayBirth, bodies)), "lr_0550 が従来の判定と同じ（大限）");
        if (span.order === 0) {
          stat.firstLimitChecks++;
          check(!bd.available, "第1限では限度が求まらない");
          check(!ms.some((m) => DEGREE_IDS.includes(m.rec.id)), `第1限で限度系ルールが出ない（${d.toISOString()} ${age}歳）`);
        } else if (degree) {
          stat.degreeChecks++;
        }
        for (const m of ms) {
          const key = `${m.rec.id}|${mode}`;
          if (NEW_IDS.includes(m.rec.id) && !found.has(key)) {
            found.set(key, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} 東京・${isDayBirth ? "昼" : "夜"}生・命宮${mingBranch}・命度${mingDegree.toFixed(2)}・${age}歳 大限${span.branch}宮（第${span.order + 1}限）${degree ? `限宿${degree.mansion}・限度主${degree.degreeLord}` : ""}／該当：${m.basis ?? ""}`);
          }
        }
        // 小限：限度系は出ない
        const sb = getCurrentSmallLimitBranch(mingBranch, age);
        if (sb) {
          stat.smallChecks++;
          const sm = matchConfirmedLimitRules({ type: "small", branch: sb, isDayBirth, bodies, degree }, normal);
          check(!sm.some((m) => DEGREE_IDS.includes(m.rec.id)), "小限で限度系ルールが出ない（限度を渡しても）");
          check(sm.every((m) => !deathIds.has(m.rec.id)), "小限で death_timing が出ない");
          check(JSON.stringify(sm.find((m) => m.rec.id === "lr_0550")?.matched ?? []) === JSON.stringify(matchLr0550(sb, isDayBirth, bodies)), "lr_0550 が従来の判定と同じ（小限）");
        }
      }
    }
  }
  check(stat.firstLimitChecks > 0 && stat.smallChecks > 0 && stat.degreeChecks > 0, "第1限・小限・第2限以降をそれぞれ確認した");
  check(stat.modeDiff > 0, "通常と古典で命度が実際に異なる盤がある（通常モードが ASC 基準を使っている）");
  for (const mode of ["getsu", "handen"] as const) {
    check([...found.keys()].some((k) => k.endsWith("|" + mode) && DEGREE_IDS.includes(k.split("|")[0])), `${mode === "handen" ? "通常" : "古典"}モードで限度系の新規ルールが成立した`);
  }
  if (PRINT) {
    console.log(`実在の盤 9000日時 × 2モード × 年齢11通り（第2限以降の限度あり ${stat.degreeChecks}・第1限 ${stat.firstLimitChecks}・小限 ${stat.smallChecks}・命度が両モードで異なる日時 ${stat.modeDiff}）`);
    for (const mode of ["getsu", "handen"] as const) {
      console.log(mode === "handen" ? "== 通常（ASC 基準命度） ==" : "== 古典（calcMingDegreeFromSunLon） ==");
      for (const id of NEW_IDS) console.log(id, found.get(`${id}|${mode}`) ?? "（この走査では成立例なし）");
    }
  }

  if (fail) { console.log(`FAIL ${fail}`); process.exit(1); }
  const cnt = (mode: string) => NEW_IDS.filter((id) => found.has(`${id}|${mode}`)).length;
  console.log(`PASS（新規成立例 古典 ${cnt("getsu")}/${NEW_IDS.length}・通常 ${cnt("handen")}/${NEW_IDS.length} 件）`);
}
main();
