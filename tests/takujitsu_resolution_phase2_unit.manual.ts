// tests/takujitsu_resolution_phase2_unit.manual.ts
//
// 目的:
//   擇日「神殺解除・相殺・増悪」第2実装フェーズで pending:false に
//   変更した7ルール（No.8・12・14・17・18・20・21）の単体テスト。
//   区分B（擇日実例.pdfには解除規則の記載が無いため、
//   docs/takujitsu_resolution_rules.md の規定そのものを期待値とする）。
//
// 検証観点（ユーザー指示）:
//   ・対象凶神だけ→active
//   ・徳合を構成する6神殺（天徳/天徳合/月徳/月徳合/歳徳/歳徳合）の
//     どれでも同じ「徳合あり」として認識されること
//   ・赦願＝天赦のみ/天願のみ/両方→成立、両方なし→不成立
//   ・AND条件（No.8・12・18・20・21）は片方だけでは不成立、両方で成立
//   ・OR条件（No.14・17）は片方だけで成立
//   ・無関係な吉神では状態が変化しない
//
// 実行:
//   npx tsx tests/takujitsu_resolution_phase2_unit.manual.ts

import { resolve } from "../src/lib/takujitsu/resolution";
import type { ResolvedShinsatsuEntry } from "../src/lib/takujitsu/resolution";
import type { ShinsatsuResult } from "../src/lib/takujitsu";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function raw(kichijin: string[], kyojin: string[]): ShinsatsuResult {
  return { kichijin, kyojin };
}

function findEntry(entries: readonly ResolvedShinsatsuEntry[], name: string): ResolvedShinsatsuEntry | undefined {
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

console.log("[区分B] resolution engine 第2フェーズ 単体テスト（No.8・12・14・17・18・20・21）");
console.log("根拠: docs/takujitsu_resolution_rules.md（本文の解除・増悪ルールそのものを期待値とする）\n");

const DEHE_MEMBERS = ["天徳", "天徳合", "月徳", "月徳合", "歳徳", "歳徳合"];

// ==== No.14 氣往亡：徳合(OR6) OR 赦願(OR2)（「・」のみでAND明示が無いためOR） ====
{
  check("14. 氣往亡のみ成立（条件なし）→active", findEntry(resolve(raw([], ["氣往亡"])).kyojin, "氣往亡")?.status, "active");

  for (const name of DEHE_MEMBERS) {
    check(
      `14. 徳合の構成神「${name}」単独→aggravated`,
      findEntry(resolve(raw([name], ["氣往亡"])).kyojin, "氣往亡")?.status,
      "aggravated",
    );
  }

  check("14. 赦願＝天赦のみ→aggravated", findEntry(resolve(raw(["天赦"], ["氣往亡"])).kyojin, "氣往亡")?.status, "aggravated");
  check("14. 赦願＝天願のみ→aggravated", findEntry(resolve(raw(["天願"], ["氣往亡"])).kyojin, "氣往亡")?.status, "aggravated");
  check(
    "14. 赦願＝天赦・天願両方→aggravated",
    findEntry(resolve(raw(["天赦", "天願"], ["氣往亡"])).kyojin, "氣往亡")?.status,
    "aggravated",
  );
  check(
    "14. 徳合・赦願とも無関係な吉神のみ→active",
    findEntry(resolve(raw(["驛馬"], ["氣往亡"])).kyojin, "氣往亡")?.status,
    "active",
  );
}

// ==== No.17 觸水龍：徳合(OR6) OR 天願単独（赦願ペアではなく天願そのもの） ====
{
  check(
    "17. 觸水龍のみ成立→active",
    findEntry(resolve(raw([], ["觸水龍"])).kyojin, "觸水龍")?.status,
    "active",
  );
  for (const name of DEHE_MEMBERS) {
    check(
      `17. 徳合の構成神「${name}」単独→aggravated`,
      findEntry(resolve(raw([name], ["觸水龍"])).kyojin, "觸水龍")?.status,
      "aggravated",
    );
  }
  check("17. 天願単独→aggravated", findEntry(resolve(raw(["天願"], ["觸水龍"])).kyojin, "觸水龍")?.status, "aggravated");
  check(
    "17. 天赦単独では不成立（赦願ペアではなく天願そのものが条件のため）→active",
    findEntry(resolve(raw(["天赦"], ["觸水龍"])).kyojin, "觸水龍")?.status,
    "active",
  );
  check(
    "17. 無関係な吉神のみ→active",
    findEntry(resolve(raw(["驛馬"], ["觸水龍"])).kyojin, "觸水龍")?.status,
    "active",
  );
}

// ==== No.8 月厭・厭對：徳合(OR6) AND 赦願(OR2)（「一緒になれば」でAND確定） ====
{
  check("8. 月厭のみ成立→active", findEntry(resolve(raw([], ["月厭"])).kyojin, "月厭")?.status, "active");
  check(
    "8. 徳合のみ（赦願なし）→AND不成立→active",
    findEntry(resolve(raw(["天徳"], ["月厭"])).kyojin, "月厭")?.status,
    "active",
  );
  check(
    "8. 赦願のみ（徳合なし、天赦）→AND不成立→active",
    findEntry(resolve(raw(["天赦"], ["月厭"])).kyojin, "月厭")?.status,
    "active",
  );
  check(
    "8. 赦願のみ（徳合なし、天願）→AND不成立→active",
    findEntry(resolve(raw(["天願"], ["月厭"])).kyojin, "月厭")?.status,
    "active",
  );
  check(
    "8. 徳合(天徳)＋赦願(天赦)両方→cancelled",
    findEntry(resolve(raw(["天徳", "天赦"], ["月厭"])).kyojin, "月厭")?.status,
    "cancelled",
  );
  check(
    "8. 徳合(歳徳合)＋赦願(天願)両方→cancelled（徳合・赦願とも別の構成神で成立）",
    findEntry(resolve(raw(["歳徳合", "天願"], ["月厭"])).kyojin, "月厭")?.status,
    "cancelled",
  );
  check(
    "8. 厭對も同じ条件でcancelled",
    findEntry(resolve(raw(["天徳", "天赦"], ["厭對"])).kyojin, "厭對")?.status,
    "cancelled",
  );
  check(
    "8. 無関係な吉神のみ→active",
    findEntry(resolve(raw(["驛馬"], ["月厭"])).kyojin, "月厭")?.status,
    "active",
  );
}

// ==== No.12 土符：徳合(OR6) AND 赦願(OR2)（「合わさると」でAND確定） ====
{
  check("12. 土符のみ成立→active", findEntry(resolve(raw([], ["土符"])).kyojin, "土符")?.status, "active");
  check(
    "12. 徳合のみ→AND不成立→active",
    findEntry(resolve(raw(["月徳"], ["土符"])).kyojin, "土符")?.status,
    "active",
  );
  check(
    "12. 赦願のみ→AND不成立→active",
    findEntry(resolve(raw(["天赦"], ["土符"])).kyojin, "土符")?.status,
    "active",
  );
  check(
    "12. 徳合＋赦願両方→aggravated",
    findEntry(resolve(raw(["月徳", "天願"], ["土符"])).kyojin, "土符")?.status,
    "aggravated",
  );
}

// ==== No.18 四離・四絶：徳合(OR6) AND 天願単独（本文の「と」でAND確定） ====
{
  check("18. 四離のみ成立→active", findEntry(resolve(raw([], ["四離"])).kyojin, "四離")?.status, "active");
  check(
    "18. 徳合のみ（天願なし）→AND不成立→active",
    findEntry(resolve(raw(["天徳"], ["四離"])).kyojin, "四離")?.status,
    "active",
  );
  check(
    "18. 天願のみ（徳合なし）→AND不成立→active",
    findEntry(resolve(raw(["天願"], ["四離"])).kyojin, "四離")?.status,
    "active",
  );
  check(
    "18. 徳合＋天赦（天願ではない）→AND不成立→active（天願そのものが条件のため天赦では代替不可）",
    findEntry(resolve(raw(["天徳", "天赦"], ["四離"])).kyojin, "四離")?.status,
    "active",
  );
  check(
    "18. 徳合＋天願両方→aggravated",
    findEntry(resolve(raw(["天徳", "天願"], ["四離"])).kyojin, "四離")?.status,
    "aggravated",
  );
  check(
    "18. 四絶も同じ条件でaggravated",
    findEntry(resolve(raw(["歳徳", "天願"], ["四絶"])).kyojin, "四絶")?.status,
    "aggravated",
  );
}

// ==== No.20 八節日・No.21 土王用事：徳合(OR6) AND 赦願(OR2)（「あわさると」でAND確定） ====
{
  for (const name of ["八節日", "土王用事"]) {
    check(`20/21. ${name}のみ成立→active`, findEntry(resolve(raw([], [name])).kyojin, name)?.status, "active");
    check(
      `20/21. ${name}：徳合のみ→AND不成立→active`,
      findEntry(resolve(raw(["天徳合"], [name])).kyojin, name)?.status,
      "active",
    );
    check(
      `20/21. ${name}：赦願のみ→AND不成立→active`,
      findEntry(resolve(raw(["天願"], [name])).kyojin, name)?.status,
      "active",
    );
    check(
      `20/21. ${name}：徳合＋赦願両方→aggravated`,
      findEntry(resolve(raw(["天徳合", "天赦"], [name])).kyojin, name)?.status,
      "aggravated",
    );
  }
}

// ---- No.13a 四撃〜五虚 × 土旺（監修確定 2026-10-06：土旺＝土王用事の期間）→ 増悪 ----
{
  for (const name of ["四撃", "四耗", "四廢", "四忌", "四窮", "五虚"]) {
    check(`13a. ${name}＋土王用事→aggravated`, findEntry(resolve(raw([], [name, "土王用事"])).kyojin, name)?.status, "aggravated");
    check(`13a. ${name}のみ→active`, findEntry(resolve(raw([], [name])).kyojin, name)?.status, "active");
  }
  // 13b（徳合・六合で解除）と同時成立する場合は、本文に優先順位が無いため pending
  check("13a×13b. 四撃＋土王用事＋月徳→pending", findEntry(resolve(raw(["月徳"], ["四撃", "土王用事"])).kyojin, "四撃")?.status, "pending");
}

// ---- No.6 満日（天狗）：「歳徳・月徳が同宮すれば忌まない」→ 解除 ----
{
  check("6. 天狗のみ→active", findEntry(resolve(raw([], ["天狗"])).kyojin, "天狗")?.status, "active");
  check("6. 天狗＋歳徳→cancelled", findEntry(resolve(raw(["歳徳"], ["天狗"])).kyojin, "天狗")?.status, "cancelled");
  check("6. 天狗＋月徳→cancelled", findEntry(resolve(raw(["月徳"], ["天狗"])).kyojin, "天狗")?.status, "cancelled");
  check("6. 天狗＋天徳（本文に無い）→active", findEntry(resolve(raw(["天徳"], ["天狗"])).kyojin, "天狗")?.status, "active");
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
