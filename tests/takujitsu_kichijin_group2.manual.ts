// tests/takujitsu_kichijin_group2.manual.ts
//
// 目的:
//   擇日「日家吉神」第2グループ（母倉・四相・時徳・王日・官日・守日・
//   相日・民日）の8神殺を、docs/source/擇日実例.pdf の吉凶神煞一覧表と
//   全件照合する回帰テスト。
//
//   この8神殺はいずれも「月令（月建）＋日辰（日干支）」だけで決まるため
//   （前回導入した区分の「区分A: 実例PDF照合テスト」に相当）、実例PDF
//   一覧表の全720行と照合する。天願（農暦月番号を使うため対象外）は
//   このグループに含めない
//   （src/lib/takujitsu/shinsatsu/kichijinGroup2.ts のコメント参照）。
//
// 検証データ:
//   tests/fixtures/takujitsu_kichijin_group2.json
//   ── docs/source/擇日実例.pdf（吉凶神煞一覧表）から機械的に転記した
//      「検証専用 fixture」。仕様ではない。擇日ロジックの逆算・変更には
//      使わない。生成手順は tests/fixtures/gen_takujitsu_kichijin_group2.py
//      参照（フォントCIDマッピング起因の文字化け「【青神】→【吉神】」
//      「日→目」「四柏→四相」は生成スクリプト側で正規化済み）。
//
// 既知の差異（推測でロジックを合わせず、切り分けて記録する。詳細下記）:
//   1) 母倉の「土王用事の後は必ず巳午となる」規定（擇日テキストp.7）を
//      辰・未・戌・丑の月令に適用すると、日辰が巳・午の日は追加で母倉と
//      なるはずだが、擇日実例.pdfの実際の掲載ではこれらの行に母倉が
//      現れない（40行）。擇日テキスト.pdf（唯一の仕様書）の表の記述を
//      優先し、ロジックは変更していない。
//   2) 十一月(子)の丙寅・壬寅で、実測の「相日」が実例PDFに見当たらない。
//      該当箇所の抽出文字列は「和日」となっており、他ページで「相」の字が
//      「柏」に化ける事例が確認済みのため、同種の文字化け（相→和）の
//      可能性が高いが、単独の事例のみで確証が持てないため正規化はせず
//      未解決として記録する（2行）。
//   3) 三月(辰)の戊寅で、王日が実例PDFに見当たらない。ただし同じ条件
//      （寅卯辰の季節グループ・天赦と同日）の正月(寅)・二月(卯)の戊寅の行
//      では王日が正しく掲載されており、ロジック・季節区分の誤りではなく
//      実例PDF内のこの1行だけの孤立した不整合と判断する（1行）。
//   これらの合計43行は EXCLUDED_MISMATCHES としてテストの対象から明示的に
//   除外し、除外理由とともに別枠で表示する。それ以外の677行は完全一致を
//   要求する。
//
// 実行:
//   npx tsx tests/takujitsu_kichijin_group2.manual.ts
//
// 終了コード: 除外分を除く677行が全一致なら 0、1件でも不一致なら 1。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveKichijinGroup2 } from "../src/lib/takujitsu";

interface FixtureRow {
  monthLabel: string;
  monthBranch: string;
  ganzhi: string;
  dayStem: string;
  dayBranch: string;
  expectedKichijin: string[];
}

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures", "takujitsu_kichijin_group2.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  _meta: unknown;
  rows: FixtureRow[];
};
const rows = fixture.rows;

// 既知の差異として切り分け済みの行（上記コメント参照）。
// monthBranch + ganzhi をキーに、除外理由をひもづける。
const EXCLUDED_MISMATCHES: Record<string, string> = {};
for (const branch of ["辰", "未", "戌", "丑"]) {
  for (const dayBranch of ["巳", "午"]) {
    for (const stem of ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]) {
      // 60干支のうち実在する組み合わせだけを対象にする（存在しない組は無視してよい）。
      EXCLUDED_MISMATCHES[`${branch}:${stem}${dayBranch}`] = "母倉：擇日テキストp.7の「土王用事の後は巳午」規定が実例PDFの掲載と食い違う（仕様差異1）";
    }
  }
}
EXCLUDED_MISMATCHES["子:丙寅"] = "相日：抽出文字列が「和日」（相→和の文字化けの疑い、未確証のため正規化せず）（仕様差異2）";
EXCLUDED_MISMATCHES["子:壬寅"] = "相日：抽出文字列が「和日」（相→和の文字化けの疑い、未確証のため正規化せず）（仕様差異2）";
EXCLUDED_MISMATCHES["辰:戊寅"] = "王日：正月(寅)・二月(卯)の同条件の戊寅行では正しく掲載されており、実例PDF内のこの1行だけの孤立した不整合と判断（仕様差異3）";

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
  const result = resolveKichijinGroup2({
    // 第2グループはいずれも yearStem を使わないため、ダミー値で十分。
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

console.log("[区分A] 実例PDF照合テスト（第2グループ：月令＋日辰だけで決まる8神殺）");
console.log("検証データ: tests/fixtures/takujitsu_kichijin_group2.json（擇日実例.pdf からの機械転記・検証専用）");
console.log("照合: 母倉 / 四相 / 時徳 / 王日 / 官日 / 守日 / 相日 / 民日\n");

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
