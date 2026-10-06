// tests/takujitsu_kichijin_unit.manual.ts
//
// 目的:
//   [区分B: ロジック単体テスト] 年干など、「月令（月建）＋日辰（日干支）」
//   だけでは決まらない神殺（歳徳・歳徳合）を検証する。
//
//   docs/source/擇日実例.pdf の吉凶神煞一覧表は月令×60干支の一覧表であり
//   年を特定しないため、年干に依存する歳徳・歳徳合はこの一覧表には
//   一度も出現しない。これは実例PDF側の一次資料としての構造上の理由で
//   あって、歳徳・歳徳合のロジックが誤っている根拠にはならない。
//   そのため実例PDFとの自動照合（tests/takujitsu_kichijin.manual.ts）
//   の対象からは除外し、本ファイルで
//     A) 擇日テキスト.pdf p.5 の年干10種の表そのもの
//     B) 擇日テキスト.pdf p.5 実例1・実例2（辛未年）
//   を根拠に個別に検証する。
//
// 唯一の仕様根拠:
//   docs/source/擇日テキスト.pdf p.5（年干 → 歳徳 → 歳徳合の対応表、
//   および実例1・実例2の本文）。このPDF以外は一切参照していない。
//
// 実行:
//   npx tsx tests/takujitsu_kichijin_unit.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import { resolveKichijin } from "../src/lib/takujitsu";

// 月令（月建）・日令（日辰）は歳徳・歳徳合の判定に無関係なので、
// 固定のダミー値を使う（区分Aの神殺が同時に成立するかどうかはこの
// テストでは検証しないため問わない）。
const DUMMY_MONTH_BRANCH = "辰";
const DUMMY_DAY_BRANCH = "辰";

interface Mismatch {
  label: string;
  yearStem: string;
  dayStem: string;
  expected: string;
  actual: string[];
}

const mismatches: Mismatch[] = [];
let pass = 0;
let fail = 0;

function check(label: string, yearStem: string, dayStem: string, expectPresent: string, expectAbsent: string[]) {
  const result = resolveKichijin({
    yearStem,
    monthBranch: DUMMY_MONTH_BRANCH,
    dayStem,
    dayBranch: DUMMY_DAY_BRANCH,
  });
  const ok =
    result.kichijin.includes(expectPresent) &&
    expectAbsent.every((n) => !result.kichijin.includes(n));
  if (ok) {
    pass += 1;
  } else {
    fail += 1;
    mismatches.push({
      label,
      yearStem,
      dayStem,
      expected: `${expectPresent} を含み、[${expectAbsent.join(",")}] を含まない`,
      actual: result.kichijin,
    });
  }
}

/** 歳徳・歳徳合のどちらも成立しないことだけを確認する（否定ケース専用）。 */
function checkNoneOf(label: string, yearStem: string, dayStem: string, forbidden: string[]) {
  const result = resolveKichijin({
    yearStem,
    monthBranch: DUMMY_MONTH_BRANCH,
    dayStem,
    dayBranch: DUMMY_DAY_BRANCH,
  });
  const ok = forbidden.every((n) => !result.kichijin.includes(n));
  if (ok) {
    pass += 1;
  } else {
    fail += 1;
    mismatches.push({
      label,
      yearStem,
      dayStem,
      expected: `[${forbidden.join(",")}] のいずれも含まない`,
      actual: result.kichijin,
    });
  }
}

console.log("[区分B] ロジック単体テスト（年干など、月令＋日辰だけでは決まらない神殺）\n");

// --- A) 擇日テキスト.pdf p.5 の年干10種の表そのもの --------------------
//   年干 → 歳徳 → 歳徳合（原文の表を1行ずつ転記）
const SUIDE_TABLE: { yearStem: string; suide: string; suidehe: string }[] = [
  { yearStem: "甲", suide: "甲", suidehe: "己" },
  { yearStem: "乙", suide: "乙", suidehe: "庚" },
  { yearStem: "丙", suide: "丙", suidehe: "辛" },
  { yearStem: "丁", suide: "丁", suidehe: "壬" },
  { yearStem: "戊", suide: "戊", suidehe: "癸" },
  { yearStem: "己", suide: "己", suidehe: "甲" },
  { yearStem: "庚", suide: "庚", suidehe: "乙" },
  { yearStem: "辛", suide: "辛", suidehe: "丙" },
  { yearStem: "壬", suide: "壬", suidehe: "丁" },
  { yearStem: "癸", suide: "癸", suidehe: "戊" },
];

console.log("--- 歳徳（年干=日干のとき成立） ---");
for (const row of SUIDE_TABLE) {
  check(
    `歳徳 年干${row.yearStem} 日干${row.suide}`,
    row.yearStem,
    row.suide,
    "歳徳",
    ["歳徳合"],
  );
}

console.log("--- 歳徳合（年干の表の値=日干のとき成立） ---");
for (const row of SUIDE_TABLE) {
  check(
    `歳徳合 年干${row.yearStem} 日干${row.suidehe}`,
    row.yearStem,
    row.suidehe,
    "歳徳合",
    ["歳徳"],
  );
}

console.log("--- 否定ケース（年干と無関係な日干では成立しない） ---");
for (const row of SUIDE_TABLE) {
  // 歳徳（=年干自身）にも歳徳合（表の値）にも一致しない日干を選ぶ。
  const wrongStem = [row.suide, row.suidehe].includes("甲") ? "乙" : "甲";
  checkNoneOf(
    `歳徳/歳徳合 不成立 年干${row.yearStem} 日干${wrongStem}`,
    row.yearStem,
    wrongStem,
    ["歳徳", "歳徳合"],
  );
}

// --- B) 擇日テキスト.pdf p.5 実例1・実例2（辛未年） ---------------------
console.log("--- 実例1・実例2（擇日テキスト.pdf p.5） ---");
check("実例1: 辛未年 丙辰日 → 歳徳合", "辛", "丙", "歳徳合", ["歳徳"]);
check("実例2: 辛未年 丙寅日 → 歳徳合", "辛", "丙", "歳徳合", ["歳徳"]);

console.log(`\n完全一致: ${pass} / ${pass + fail}`);
console.log(`不一致:   ${fail} / ${pass + fail}`);

if (fail > 0) {
  console.log("\n--- 不一致明細 ---");
  for (const m of mismatches) {
    console.log(
      `  ${m.label} | yearStem=${m.yearStem} dayStem=${m.dayStem} | 期待=${m.expected} | 実測=${JSON.stringify(m.actual)}`,
    );
  }
  process.exit(1);
}

console.log(`\n${pass} / ${pass} PASS`);
process.exit(0);
