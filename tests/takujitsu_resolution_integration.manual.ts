// tests/takujitsu_resolution_integration.manual.ts
//
// 目的:
//   calculateTakujitsu() に追加した resolution フィールドが、既存の
//   shinsatsu（occurrence detectionの生の結果）を一切変更せずに
//   組み込まれていることを確認する統合テスト。
//
// 実行:
//   npx tsx tests/takujitsu_resolution_integration.manual.ts

import { calculateTakujitsu } from "../src/lib/takujitsu";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function checkTrue(label: string, condition: boolean) {
  if (condition) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  [${label}]`);
  }
}

console.log("[統合テスト] calculateTakujitsu() への resolution 統合確認\n");

// 既存フィールド（shinsatsu・buildingDay・shuku28）の形が変わっていないこと、
// かつ resolution が追加されていることを確認する。
const result = calculateTakujitsu({ year: 2024, month: 2, day: 5, hour: 12, minute: 0 });

checkTrue("shinsatsu フィールドが存在する", Array.isArray(result.shinsatsu.kichijin) && Array.isArray(result.shinsatsu.kyojin));
checkTrue("buildingDay フィールドが存在する（既存のまま）", typeof result.buildingDay?.name === "string");
checkTrue("resolution フィールドが追加されている", result.resolution !== undefined);
checkTrue(
  "resolution.raw が shinsatsu と同一参照（rawが変更されていない）",
  result.resolution.raw === result.shinsatsu,
);
checkTrue(
  "resolution.kyojin の件数が shinsatsu.kyojin と一致する（何も削除されていない）",
  result.resolution.kyojin.length === result.shinsatsu.kyojin.length,
);
checkTrue(
  "resolution.kichijin の件数が shinsatsu.kichijin と一致する",
  result.resolution.kichijin.length === result.shinsatsu.kichijin.length,
);
checkTrue(
  "resolution.kyojin の各要素名が shinsatsu.kyojin と同じ集合",
  JSON.stringify([...result.resolution.kyojin.map((e) => e.name)].sort()) ===
    JSON.stringify([...result.shinsatsu.kyojin].sort()),
);

// 別の日付でも壊れずに動くことを確認（クラッシュしないことの簡易確認）。
for (const d of [
  { year: 2024, month: 1, day: 1, hour: 0, minute: 0 },
  { year: 2024, month: 6, day: 15, hour: 23, minute: 59 },
  { year: 2025, month: 12, day: 31, hour: 12, minute: 0 },
]) {
  const r = calculateTakujitsu(d);
  checkTrue(
    `複数日付での動作確認 ${d.year}-${d.month}-${d.day}`,
    r.resolution.kyojin.length === r.shinsatsu.kyojin.length &&
      r.resolution.kichijin.length === r.shinsatsu.kichijin.length,
  );
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
