// tests/takujitsu_excluded_shinsatsu_unit.manual.ts
//
// 目的:
//   監修判断により擇日アプリで採用しない神殺（src/lib/takujitsu/shinsatsu/excludedShinsatsu.ts。
//   現在は神在・七聖）が、次のどこにも現れないことを確認する。
//     ・神殺の発動判定（全グループ。月令12 × 60干支 × 年干10 × 旧暦日30 の範囲）
//     ・resolution のルール（対象・条件）
//     ・用事判定のプロファイル（ACTIVITY_PROFILES）
//     ・原文訂正の台帳（SOURCE_CORRECTIONS）
//
// 実行:
//   npx tsx tests/takujitsu_excluded_shinsatsu_unit.manual.ts

import { resolveAllShinsatsu, RESOLUTION_RULES } from "../src/lib/takujitsu";
import { ACTIVITY_PROFILES } from "../src/lib/takujitsu/activity";
import { SOURCE_CORRECTIONS } from "../src/lib/takujitsu/shinsatsu/sourceCorrections";
import { EXCLUDED_SHINSATSU, EXCLUDED_SHINSATSU_NAMES } from "../src/lib/takujitsu/shinsatsu/excludedShinsatsu";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else {
    fail += 1;
    failures.push(`  [${label}] ${detail}`);
  }
}

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const GANZHI60 = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12]);

console.log("[区分B] 監修判断により不採用の神殺（神在・七聖）が出力されないことの確認\n");

check("不採用リストに神在・七聖がある", EXCLUDED_SHINSATSU_NAMES.has("神在") && EXCLUDED_SHINSATSU_NAMES.has("七聖"));
for (const e of EXCLUDED_SHINSATSU) {
  check(`${e.name}: 記録に原資料の位置・理由・日付がある`, e.location !== "" && e.reason !== "" && e.decidedAt !== "");
}

// 発動判定（全グループ）
let found: string[] = [];
for (const monthBranch of BRANCHES) {
  for (const g of GANZHI60) {
    for (const yearStem of STEMS) {
      for (const lunarDay of [1, 8, 15, 23, 30]) {
        const r = resolveAllShinsatsu({
          yearStem, yearBranch: "子", monthBranch, dayStem: g[0], dayBranch: g[1],
          lunarMonth: 1, lunarDay, lodge28: "奎", isDoyou: true,
        });
        for (const n of [...r.kichijin, ...r.kyojin]) {
          if (EXCLUDED_SHINSATSU_NAMES.has(n)) found.push(`${monthBranch}月 ${g} 年干${yearStem}: ${n}`);
        }
      }
    }
  }
}
check("発動判定の出力に不採用の神殺が無い", found.length === 0, found.slice(0, 5).join(" / "));

// resolution のルール
found = RESOLUTION_RULES.flatMap((r) =>
  [...r.targets, ...r.requires.flatMap((q) => q.names)].filter((n) => EXCLUDED_SHINSATSU_NAMES.has(n)).map((n) => `${r.id}: ${n}`),
);
check("resolution のルールに不採用の神殺が無い", found.length === 0, found.join(" / "));

// 用事判定のプロファイル
found = ACTIVITY_PROFILES.filter((p) => EXCLUDED_SHINSATSU_NAMES.has(p.sourceName)).map((p) => p.sourceName);
check("用事判定のプロファイルに不採用の神殺が無い", found.length === 0, found.join(" / "));

// 原文訂正の台帳
found = SOURCE_CORRECTIONS.filter((c) => EXCLUDED_SHINSATSU_NAMES.has(c.shinsatsu)).map((c) => c.id);
check("原文訂正の台帳に不採用の神殺が無い", found.length === 0, found.join(" / "));

console.log(`一致: ${pass} / ${pass + fail}`);
if (fail > 0) {
  console.log("\n--- 不一致 ---");
  for (const f of failures) console.log(f);
  console.log(`\n${fail} 件 FAIL`);
  process.exit(1);
}
console.log(`\n${pass} / ${pass + fail} PASS`);
process.exit(0);
