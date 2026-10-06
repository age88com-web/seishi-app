// tests/takujitsu_kichijin_group3.manual.ts
//
// 目的:
//   擇日「日家吉神」第3グループ（三合・六合・五合・鳴吠・鳴吠對）の
//   5神殺を、docs/source/擇日実例.pdf の吉凶神煞一覧表と全件照合する
//   回帰テスト。
//
//   三合・六合は「月令（月建）＋日辰（日干支）」で決まり、五合・鳴吠・
//   鳴吠對は月令に関係なく資料に列挙された固定の日干支のみで決まるが、
//   いずれも実例PDFの一覧表（月支×60干支）と全件照合できるため区分Aとして
//   扱う。
//
// 検証データ:
//   tests/fixtures/takujitsu_kichijin_group3.json
//   ── docs/source/擇日実例.pdf（吉凶神煞一覧表）から機械的に転記した
//      「検証専用 fixture」。仕様ではない。擇日ロジックの逆算・変更には
//      使わない。生成手順は tests/fixtures/gen_takujitsu_kichijin_group3.py
//      参照。
//
// 既知の差異（推測でロジックを合わせず、切り分けて記録する。実例PDFの
// 原本画像を目視確認済み。詳細は fixture の _meta.notes も参照）:
//   1) 三月(辰)戊寅: 擇日テキストp.9の三合表では辰の三合会局は申子辰の
//      ため寅日は対象外だが、実例PDFにはこの1行だけ「三合」が掲載されて
//      いる。同じ行で第2グループの王日も欠落しており（前回報告済み）、
//      実例PDF内のこの1行だけの孤立した不整合と判断する。
//   2) 三月(辰)癸卯・十二月(丑)庚寅: 擇日テキストp.11の表では鳴吠對日
//      だが、実例PDFの原本画像には「鳴吠封」と印字されている（「封」は
//      擇日テキストに無い文字。文字化けではなく実際にそう印字されている
//      ことを画像で確認済み）。
//   3) 七月(申)乙卯・十月(亥)丙子: 擇日テキストp.11の表では鳴吠對日だが、
//      実例PDFの原本画像には「對」の付かない単独の「鳴吠」と印字されて
//      いる（画像で確認済み）。
//   4) 九月(戌)丁卯: 擇日テキストp.11の表では鳴吠對日だが、実例PDFの
//      原本画像には「吠」が抜けた「鳴對」と印字されている（画像で確認済み）。
//   唯一の仕様書である擇日テキスト.pdfの記述を優先し、ロジックは変更して
//   いない。これらの合計6行は EXCLUDED_MISMATCHES として明示的に除外し、
//   別枠で表示する。それ以外の714行は完全一致を要求する。
//
// 実行:
//   npx tsx tests/takujitsu_kichijin_group3.manual.ts
//
// 終了コード: 除外分を除く714行が全一致なら 0、1件でも不一致なら 1。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveKichijinGroup3 } from "../src/lib/takujitsu";

interface FixtureRow {
  monthLabel: string;
  monthBranch: string;
  ganzhi: string;
  dayStem: string;
  dayBranch: string;
  expectedKichijin: string[];
}

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures", "takujitsu_kichijin_group3.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  _meta: unknown;
  rows: FixtureRow[];
};
const rows = fixture.rows;

// 既知の差異として切り分け済みの行（上記コメント参照）。monthBranch:干支 をキーにする。
const EXCLUDED_MISMATCHES: Record<string, string> = {
  "辰:戊寅": "三合：辰の三合会局(申子辰)に寅は含まれないが、実例PDFのこの1行だけ「三合」が掲載されている（第2グループの王日欠落と同じ行の孤立した不整合）",
  "辰:癸卯": "鳴吠對：実例PDF原本は「鳴吠封」と印字（擇日テキストに無い表記、画像確認済み）",
  "丑:庚寅": "鳴吠對：実例PDF原本は「鳴吠封」と印字（擇日テキストに無い表記、画像確認済み）",
  "申:乙卯": "鳴吠對：実例PDF原本は「對」の無い単独の「鳴吠」と印字（画像確認済み）",
  "亥:丙子": "鳴吠對：実例PDF原本は「對」の無い単独の「鳴吠」と印字（画像確認済み）",
  "戌:丁卯": "鳴吠對：実例PDF原本は「吠」が抜けた「鳴對」と印字（画像確認済み）",
};

interface Mismatch {
  monthLabel: string;
  monthBranch: string;
  dayStem: string;
  dayBranch: string;
  expected: string;
  actual: string;
}

const mismatches: Mismatch[] = [];
const excluded: (Mismatch & { reason: string })[] = [];
let pass = 0;
let fail = 0;

for (const row of rows) {
  const result = resolveKichijinGroup3({
    // 第3グループはいずれも yearStem を使わないため、ダミー値で十分。
    yearStem: "甲",
    monthBranch: row.monthBranch,
    dayStem: row.dayStem,
    dayBranch: row.dayBranch,
  });
  const actual = [...result.kichijin].sort();
  const expected = [...row.expectedKichijin].sort();

  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass += 1;
    continue;
  }

  const key = `${row.monthBranch}:${row.dayStem}${row.dayBranch}`;
  const reason = EXCLUDED_MISMATCHES[key];
  const record: Mismatch = {
    monthLabel: row.monthLabel,
    monthBranch: row.monthBranch,
    dayStem: row.dayStem,
    dayBranch: row.dayBranch,
    expected: JSON.stringify(expected),
    actual: JSON.stringify(actual),
  };

  if (reason) {
    excluded.push({ ...record, reason });
  } else {
    fail += 1;
    mismatches.push(record);
  }
}

console.log("[区分A] 実例PDF照合テスト（第3グループ：三合・六合・五合・鳴吠・鳴吠對）");
console.log("検証データ: tests/fixtures/takujitsu_kichijin_group3.json（擇日実例.pdf からの機械転記・検証専用）");
console.log("照合: 三合 / 六合 / 五合 / 鳴吠 / 鳴吠對\n");

console.log(`完全一致（既知差異を除く）: ${pass} / ${rows.length - excluded.length}`);
console.log(`不一致（未診断・要調査）:   ${fail} / ${rows.length - excluded.length}`);
console.log(`既知の差異（除外・別枠報告）: ${excluded.length} 件`);

if (excluded.length > 0) {
  console.log("\n--- 既知の差異明細（対象日相当／期待神殺／実測神殺／理由）---");
  for (const e of excluded) {
    console.log(
      `  対象=${e.monthLabel}(monthBranch=${e.monthBranch}) ${e.dayStem}${e.dayBranch} | ` +
        `期待=${e.expected} | 実測=${e.actual} | 理由=${e.reason}`,
    );
  }
}

if (fail > 0) {
  console.log("\n--- 未診断の不一致明細（対象日相当／monthBranch(月令=月建)／dayStem・dayBranch(日令=日辰)／期待神殺／実測神殺）---");
  for (const m of mismatches) {
    console.log(
      `  対象=${m.monthLabel}(monthBranch=${m.monthBranch}) ${m.dayStem}${m.dayBranch} | ` +
        `期待=${m.expected} | 実測=${m.actual}`,
    );
  }
  console.log(`\n${fail} 件の未診断の不一致 FAIL`);
  process.exit(1);
}

console.log(`\n${pass} / ${rows.length - excluded.length} PASS（既知の差異 ${excluded.length} 件は別枠）`);
process.exit(0);
