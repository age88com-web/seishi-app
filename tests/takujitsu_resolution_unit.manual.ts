// tests/takujitsu_resolution_unit.manual.ts
//
// 目的:
//   擇日「神殺解除・相殺・増悪」レイヤー（src/lib/takujitsu/resolution/）の
//   単体テスト。区分B（擇日実例.pdfには解除規則の記載が無いため、
//   docs/takujitsu_resolution_rules.md の規定そのものを期待値とする）。
//
// 検証観点（ユーザー指示の8項目）:
//   1. 凶神のみ成立 → active
//   2. 凶神＋解除吉神 → cancelled
//   3. 凶神＋増悪条件 → aggravated
//   4. 条件不足 → active
//   5. pendingルール → rawを変更しない（かつstatusにも効力が反映されない）
//   6. raw ShinsatsuResultが完全に保持される
//   7. 複数ルール同時成立（競合時はpending、非競合なら一意に決まる）
//   8. unrelatedな吉神では状態が変化しない
//
// 実行:
//   npx tsx tests/takujitsu_resolution_unit.manual.ts

import { resolve } from "../src/lib/takujitsu/resolution";
import type { ResolvedShinsatsuEntry } from "../src/lib/takujitsu/resolution";
import type { ShinsatsuResult } from "../src/lib/takujitsu";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function raw(kichijin: string[], kyojin: string[]): ShinsatsuResult {
  return { kichijin, kyojin };
}

function findEntry(
  entries: readonly ResolvedShinsatsuEntry[],
  name: string,
): ResolvedShinsatsuEntry | undefined {
  return entries.find((e) => e.name === name);
}

function check(label: string, actualStatus: string | undefined, expectedStatus: string) {
  if (actualStatus === expectedStatus) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  [${label}] 期待=${expectedStatus} 実測=${actualStatus}`);
  }
}

function checkTrue(label: string, condition: boolean) {
  if (condition) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  [${label}] 条件を満たさなかった`);
  }
}

console.log("[区分B] resolution engine 単体テスト");
console.log("根拠: docs/takujitsu_resolution_rules.md（本文の解除・増悪ルールそのものを期待値とする）\n");

// ---- 1. 凶神のみ成立 → active ----
{
  const input = raw([], ["月刑"]);
  const result = resolve(input);
  check("1. 月刑のみ成立（徳合なし）→active", findEntry(result.kyojin, "月刑")?.status, "active");
}

// ---- 2. 凶神＋解除吉神 → cancelled（ルールNo.9a） ----
{
  const input = raw(["天徳"], ["月刑"]);
  const result = resolve(input);
  const entry = findEntry(result.kyojin, "月刑");
  check("2. 月刑+天徳（徳合）→cancelled", entry?.status, "cancelled");
  checkTrue("2. ruleId=9aが記録される", entry?.appliedRules?.some((r) => r.ruleId === "9a") ?? false);
}

// ---- 3. 凶神＋増悪条件 → aggravated（ルールNo.9b、凶神同士） ----
{
  const input = raw([], ["月刑", "月破"]);
  const result = resolve(input);
  check("3. 月刑+月破（増悪）→aggravated", findEntry(result.kyojin, "月刑")?.status, "aggravated");
  check("3. 月破自身はルール対象外のためactive", findEntry(result.kyojin, "月破")?.status, "active");
}

// ---- 4. 条件不足 → active ----
{
  const input = raw([], ["大時", "天吏"]);
  const result = resolve(input);
  check("4. 大時：徳合・天赦なし→active", findEntry(result.kyojin, "大時")?.status, "active");
  check("4. 天吏：徳合・天赦なし→active", findEntry(result.kyojin, "天吏")?.status, "active");
}

// ---- 5. pendingルール → rawを変更せず、statusにも効力を反映しない ----
{
  // 九空（ルールNo.19、第2実装フェーズ後も pending のまま＝「月建」条件が
  // 未確定のため）は「六合・月建・徳合がくれば解除」。徳合(天徳)を
  // 満たしても、pending中は効力を発生させない。
  const input = raw(["天徳"], ["九空"]);
  const beforeKichijin = [...input.kichijin];
  const beforeKyojin = [...input.kyojin];
  const result = resolve(input);
  const entry = findEntry(result.kyojin, "九空");
  check("5. pendingルール(九空)は条件成立でもactiveのまま", entry?.status, "active");
  checkTrue(
    "5. pendingルールの該当はappliedRulesに記録される（pending:true）",
    entry?.appliedRules?.some((r) => r.ruleId === "19" && r.pending === true) ?? false,
  );
  checkTrue("5. raw.kichijinが変更されていない", JSON.stringify(input.kichijin) === JSON.stringify(beforeKichijin));
  checkTrue("5. raw.kyojinが変更されていない", JSON.stringify(input.kyojin) === JSON.stringify(beforeKyojin));
}

// ---- 6. raw ShinsatsuResultが完全に保持される ----
{
  const input = raw(["天徳", "驛馬"], ["月刑", "五墓"]);
  const result = resolve(input);
  checkTrue("6. result.raw は入力と同一参照", result.raw === input);
  checkTrue(
    "6. result.raw.kyojin に解除された神殺も残る（月刑は削除されない）",
    result.raw.kyojin.includes("月刑"),
  );
  checkTrue("6. result.raw.kyojin の内容・件数が変わらない", result.raw.kyojin.length === 2);
  checkTrue("6. result.raw.kichijin の内容・件数が変わらない", result.raw.kichijin.length === 2);
}

// ---- 7. 複数ルール同時成立 ----
{
  // 7a. 競合するケース：月刑に対しcancel(9a)とaggravate(9b)が同時成立→pending
  const conflictInput = raw(["天徳"], ["月刑", "月破"]);
  const conflictResult = resolve(conflictInput);
  const conflictEntry = findEntry(conflictResult.kyojin, "月刑");
  check("7a. 月刑：cancel(9a)とaggravate(9b)が競合→pending", conflictEntry?.status, "pending");
  checkTrue(
    "7a. 競合した両ルールがappliedRulesに残る",
    (conflictEntry?.appliedRules?.length ?? 0) >= 2 &&
      (conflictEntry?.appliedRules?.some((r) => r.ruleId === "9a") ?? false) &&
      (conflictEntry?.appliedRules?.some((r) => r.ruleId === "9b") ?? false),
  );

  // 7b. 非競合（複数ルールが同じ対象グループに属し、同じkindで成立）：
  //     四撃・四忌・四窮・五虚の4項目が徳合(OR6)一発で同時にcancelledになる
  //     （13b）。四耗・四廢は神殺象意.pdf原本画像の確認（docs/takujitsu_except_resolution_final.md）
  //     により13bの対象から除外済み：四耗は徳合ANDのみでは解除されず
  //     徳合AND三合が必要（13c）、四廢は徳合併でも「猶忌」＝一切解除されない。
  const multiTargetInput = raw(["天徳"], ["四撃", "四耗", "四廢", "四忌", "四窮", "五虚"]);
  const multiTargetResult = resolve(multiTargetInput);
  for (const name of ["四撃", "四忌", "四窮", "五虚"]) {
    check(`7b. ${name}：徳合により一括cancelled`, findEntry(multiTargetResult.kyojin, name)?.status, "cancelled");
  }
  check("7b. 四耗：徳合のみ（三合なし）ではcancelledにならない→active", findEntry(multiTargetResult.kyojin, "四耗")?.status, "active");
  check("7b. 四廢：徳合併でも猶忌＝cancelledにならない→active", findEntry(multiTargetResult.kyojin, "四廢")?.status, "active");

  // 7c. 四耗は徳合AND三合が揃って初めてcancelledになる（新ルール13c）。
  const shierIn = raw(["天徳", "三合"], ["四耗"]);
  const shierResult = resolve(shierIn);
  check("7c. 四耗：徳合+三合→cancelled", findEntry(shierResult.kyojin, "四耗")?.status, "cancelled");
}

// ---- 8. unrelatedな吉神では状態が変化しない ----
{
  const input = raw(["驛馬"], ["八風"]);
  const result = resolve(input);
  check("8. 驛馬（無関係な吉神）だけでは八風は解除されない→active", findEntry(result.kyojin, "八風")?.status, "active");
}

// ---- 追加：reduced の確認（ルールNo.10、本文が明確に「解除するが凶のまま」と書き分けている唯一のケース） ----
{
  const input = raw(["天赦"], ["大時", "天吏"]);
  const result = resolve(input);
  check("追加. 大時+天赦→reduced（完全解除ではなく凶性軽減）", findEntry(result.kyojin, "大時")?.status, "reduced");
  check("追加. 天吏+天赦→reduced", findEntry(result.kyojin, "天吏")?.status, "reduced");
}

// ---- 追加：条件不成立時はappliedRulesも空（対象ルールの有無に関わらず） ----
{
  const input = raw([], ["九空"]);
  const result = resolve(input);
  const entry = findEntry(result.kyojin, "九空");
  check("追加. 九空：条件不成立（pendingルールのみ対象）→active", entry?.status, "active");
  checkTrue("追加. 条件不成立ならappliedRulesも記録されない", entry?.appliedRules === undefined);
}

// ---- 追加：吉神側もresolveされ、対象ルールが無ければactiveのまま ----
{
  const input = raw(["天徳", "六合"], ["八風"]);
  const result = resolve(input);
  check("追加. 吉神「天徳」自体はactiveのまま", findEntry(result.kichijin, "天徳")?.status, "active");
  check("追加. 八風は徳合(天徳)またはis六合でcancelled", findEntry(result.kyojin, "八風")?.status, "cancelled");
}

// ---- 追加：小耗（No.22、神殺象意.pdf「與德合天願併，則貪合忘沖，故不忌」） ----
{
  // A. 小耗のみ成立 → active
  const inputA = raw([], ["小耗"]);
  const resultA = resolve(inputA);
  check("小耗A. 小耗のみ成立→active", findEntry(resultA.kyojin, "小耗")?.status, "active");

  // B. 小耗＋徳合(天徳)成立 → cancelled（忌全体が解除される）
  const inputB = raw(["天徳"], ["小耗"]);
  const resultB = resolve(inputB);
  check("小耗B. 小耗+天徳(徳合)→cancelled", findEntry(resultB.kyojin, "小耗")?.status, "cancelled");

  // C. 小耗＋条件不成立の吉神（驛馬など無関係） → active
  const inputC = raw(["驛馬"], ["小耗"]);
  const resultC = resolve(inputC);
  check("小耗C. 小耗+無関係な吉神(驛馬)→active", findEntry(resultC.kyojin, "小耗")?.status, "active");

  // D. 天願限定：天赦だけでは解除されない（赦願ではなく天願単独が条件のため）
  const inputD = raw(["天赦"], ["小耗"]);
  const resultD = resolve(inputD);
  check("小耗D. 小耗+天赦のみ→天願ではないため解除されない→active", findEntry(resultD.kyojin, "小耗")?.status, "active");

  // D'. 天願そのものなら解除される
  const inputDprime = raw(["天願"], ["小耗"]);
  const resultDprime = resolve(inputDprime);
  check("小耗D'. 小耗+天願→cancelled", findEntry(resultDprime.kyojin, "小耗")?.status, "cancelled");

  // E. 徳合構成神の代表例（歳徳合）でも解除される
  const inputE = raw(["歳徳合"], ["小耗"]);
  const resultE = resolve(inputE);
  check("小耗E. 小耗+歳徳合(徳合の代表例)→cancelled", findEntry(resultE.kyojin, "小耗")?.status, "cancelled");

  // F. raw小耗はresolution後も保持される（cancelledでもraw.kyojinから削除しない）
  checkTrue("小耗F. raw.kyojinに小耗が保持される(ケースB)", resultB.raw.kyojin.includes("小耗"));
  checkTrue("小耗F. appliedRulesにルールID22が記録される", findEntry(resultB.kyojin, "小耗")?.appliedRules?.some((r) => r.ruleId === "22") ?? false);
}

console.log(`完全一致: ${pass} / ${pass + fail}`);
console.log(`不一致:   ${fail} / ${pass + fail}`);

if (fail > 0) {
  console.log("\n--- 不一致明細 ---");
  for (const f of failures) console.log(f);
  console.log(`\n${fail} 件 FAIL`);
  process.exit(1);
}

console.log(`\n${pass} / ${pass + fail} PASS`);
process.exit(0);
