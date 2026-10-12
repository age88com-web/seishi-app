// tests/shukuYo_unit.manual.ts
//
// 目的:
//   二十八宿暦（宿値日）src/lib/calendar/shukuYo.ts のロジック単体テスト。
//   実例PDFのような検証用データは存在しないため、依頼メッセージで
//   与えられた固定順序・七曜配当・周期定義そのものを検算する。
//
//   併せて calculate()（CalendarEngine 本体）側の統合も確認する:
//     - epochJdn 未指定時は shukuYoAnchor.ts の既定アンカーが使われ、
//       lodge28 等が常に算出されること（アンカー自体の値検証は
//       tests/shuku28_anchor_unit.manual.ts で行う。ここでは
//       「常に算出される」という統合の形だけを確認する）
//     - epochJdn 指定時は明示的な値で上書きでき、日柱と同じ日境界
//       （子初23:00）で宿が進むこと
//
// 実行:
//   npx tsx tests/shukuYo_unit.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import { resolveShukuYo, LODGE_28, SEVEN_LUMINARIES } from "../src/lib/calendar/shukuYo";
import { calculate } from "../src/lib/calendar";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  [${label}] 期待=${e} 実測=${a}`);
  }
}

// ── LODGE_28: 28件・重複なし・指定順どおり ──
const EXPECTED_LODGE_28 = [
  "角", "亢", "氐", "房", "心", "尾", "箕",
  "斗", "牛", "女", "虚", "危", "室", "壁",
  "奎", "婁", "胃", "昴", "畢", "觜", "参",
  "井", "鬼", "柳", "星", "張", "翼", "軫",
];
check("LODGE_28.length", LODGE_28.length, 28);
check("LODGE_28.order", [...LODGE_28], EXPECTED_LODGE_28);
check("LODGE_28.unique", new Set(LODGE_28).size, 28);

// ── 七曜配当（角=木起点のmod7循環）が依頼の対応表と一致するか ──
const EXPECTED_LUMINARY_GROUPS: Record<string, string[]> = {
  日: ["虚", "昴", "星", "房"],
  月: ["危", "畢", "張", "心"],
  火: ["室", "觜", "翼", "尾"],
  水: ["壁", "参", "軫", "箕"],
  木: ["奎", "井", "角", "斗"],
  金: ["婁", "鬼", "亢", "牛"],
  土: ["胃", "柳", "氐", "女"],
};

for (const luminary of SEVEN_LUMINARIES) {
  const actualGroup = LODGE_28.filter((_, i) => SEVEN_LUMINARIES[i % 7] === luminary).sort();
  const expectedGroup = [...EXPECTED_LUMINARY_GROUPS[luminary]].sort();
  check(`七曜=${luminary}`, actualGroup, expectedGroup);
}

// ── resolveShukuYo: 基準点・周期境界 ──
check("resolveShukuYo(0).lodge", resolveShukuYo(0).lodge, "角");
check("resolveShukuYo(0).shukuYo", resolveShukuYo(0).shukuYo, "木");
check("resolveShukuYo(0).lodgeIndex", resolveShukuYo(0).lodgeIndex, 0);
check("resolveShukuYo(0).minorCycleDay", resolveShukuYo(0).minorCycleDay, 0);
check("resolveShukuYo(0).majorCycleDay", resolveShukuYo(0).majorCycleDay, 0);

check("resolveShukuYo(27).lodge", resolveShukuYo(27).lodge, "軫");
check("resolveShukuYo(28).lodge", resolveShukuYo(28).lodge, "角"); // 1周して角に戻る
check("resolveShukuYo(28).lodgeIndex", resolveShukuYo(28).lodgeIndex, 0);

check("resolveShukuYo(83).minorCycleDay", resolveShukuYo(83).minorCycleDay, 83);
check("resolveShukuYo(84).minorCycleDay", resolveShukuYo(84).minorCycleDay, 0); // 小周が1周
check("resolveShukuYo(84).lodge", resolveShukuYo(84).lodge, "角"); // 84=28*3 なので宿も角に戻る

check("resolveShukuYo(419).majorCycleDay", resolveShukuYo(419).majorCycleDay, 419);
check("resolveShukuYo(420).majorCycleDay", resolveShukuYo(420).majorCycleDay, 0); // 大周が1周
check("resolveShukuYo(420).lodge", resolveShukuYo(420).lodge, "角"); // 420=28*15 なので宿も角に戻る

// 負の日数差（基準日より前）でも正しく mod できること
check("resolveShukuYo(-1).lodge", resolveShukuYo(-1).lodge, "軫");
check("resolveShukuYo(-28).lodgeIndex", resolveShukuYo(-28).lodgeIndex, 0);

// ── CalendarEngine 統合: epochJdn 未指定時は既定アンカーで常に算出される ──
// （アンカー自体の正しさは tests/shuku28_anchor_unit.manual.ts で検証する）
const withoutEpoch = calculate({ year: 2026, month: 1, day: 1, hour: 12, minute: 0 });
check("epochJdn未指定.lodge28が算出される", typeof withoutEpoch.lodge28 === "string", true);
check("epochJdn未指定.shukuYoが算出される", typeof withoutEpoch.shukuYo === "string", true);
check("epochJdn未指定.lodgeIndexが算出される", typeof withoutEpoch.lodgeIndex === "number", true);
check("epochJdn未指定.yuanが算出される", typeof withoutEpoch.yuan === "number", true);

// ── CalendarEngine 統合: epochJdn 指定時、日柱と同じ日境界(子初23:00)で1日1宿進む ──
// 任意の epochJdn（テスト専用の仮値。本番用の確定基準日ではない）を使い、
// 連続する2日で宿が1つ進むこと・23:00境界で日付が繰り上がることだけを確認する。
const TEST_EPOCH_JDN = 2451545; // J2000.0（テスト専用の仮の基準点）

const day1 = calculate({ year: 2026, month: 3, day: 10, hour: 12, minute: 0, epochJdn: TEST_EPOCH_JDN });
const day2 = calculate({ year: 2026, month: 3, day: 11, hour: 12, minute: 0, epochJdn: TEST_EPOCH_JDN });
check(
  "連続日で宿が1進む",
  mod28Diff(day2.lodgeIndex, day1.lodgeIndex),
  1,
);

// 23:00以降は翌日の宿になる（日柱と同じ子初23:00ルール）
const before2300 = calculate({ year: 2026, month: 3, day: 10, hour: 22, minute: 59, epochJdn: TEST_EPOCH_JDN });
const after2300 = calculate({ year: 2026, month: 3, day: 10, hour: 23, minute: 0, epochJdn: TEST_EPOCH_JDN });
check(
  "23:00で宿が繰り上がる",
  mod28Diff(after2300.lodgeIndex, before2300.lodgeIndex),
  1,
);

function mod28Diff(a: number | undefined, b: number | undefined): number {
  if (a === undefined || b === undefined) return NaN;
  return ((a - b) % 28 + 28) % 28;
}

console.log("[区分B] ロジック単体テスト（二十八宿暦・宿値日）");
console.log("根拠: 依頼メッセージで指定された固定順序・七曜配当・周期定義\n");
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
