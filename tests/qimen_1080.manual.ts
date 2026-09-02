// tests/qimen_1080.manual.ts
//
// 目的:
//   奇門遁甲の排盤エンジンが「1080局すべて 1080.pdf と完全一致」する状態を
//   自動回帰テストとして固定する。今後の変更でこの一致が壊れたら失敗する。
//
// 検証データ:
//   tests/fixtures/qimen1080.json
//   ── docs/source/1080.pdf（呉煒維 制作／山道帰一 監修）から機械的に転記した
//      「検証専用 fixture」。仕様ではない。奇門遁甲ロジックの逆算・変更には使わない。
//      生成手順は tests/fixtures/gen_qimen1080.py と qimen1080.json の _meta を参照。
//
// 照合対象（局・時干支を直接入力して排盤モジュールを駆動する）:
//   dipan.ts  … 地盤（9宮）
//   xunshou.ts … 旬首（1080.pdf に明示欄が無いため、時干支から60干支の旬の先頭
//                として算出した期待値と照合する）
//   tianpan.ts … 天盤（9宮）
//   jiuxing.ts … 九星（9宮、集合比較）＋ 値符（星・宮）
//   bamen.ts  … 八門（外周8宮）＋ 値使（門・宮）
//   bashen.ts … 八神（外周8宮）
//   ※ dingju.ts / CalendarEngine / qimenEngine.ts は「日時→局」あるいは
//     「日時→排盤」の入口であり、1080.pdf は (局, 時干支) を索引に持つため
//     この fixture からは直接駆動できない。qimenEngine.calculate() は上記
//     6モジュールをこの順で呼び出す薄い統合層であり、本テストはその中核部分を
//     全数で固定する。日時→排盤の疎通は tests/calendarEngine.manual.ts ほかで担保。
//
// 実行:
//   npx tsx tests/qimen_1080.manual.ts
//   （tsx 未導入でも `npx tsx` が都度取得して実行する。既存の *.manual.ts と同じ）
//
// 終了コード: 全一致なら 0（"1080 / 1080 PASS" を表示）、1件でも不一致なら 1。
//   不一致時は「局番号・項目・期待値・実測値」を一覧表示する。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveDiPan } from "../src/lib/qimen/dipan";
import { resolveXunShou } from "../src/lib/qimen/xunshou";
import { resolveTianPan } from "../src/lib/qimen/tianpan";
import { resolveJiuXing } from "../src/lib/qimen/jiuxing";
import { resolveBaMen } from "../src/lib/qimen/bamen";
import { resolveBaShen } from "../src/lib/qimen/bashen";
import type { DiPanResult, DiPanStem } from "../src/lib/qimen/dipan";
import type { Dun } from "../src/lib/qimen/dingju";
import type { Stem, Branch } from "../src/lib/eto";

// --- fixture 読み込み -----------------------------------------------------

interface Chart {
  no: number;
  title: string;
  dun: "陽遁" | "陰遁";
  ju: number;
  hourStem: string;
  hourBranch: string;
  dipan: Record<string, string>;
  tianpan: Record<string, string>;
  jiuxing: Record<string, string[]>;
  bamen: Record<string, string>;
  bashen: Record<string, string>;
  zhifuStar: string;
  zhifuPalace: number;
  zhishiMen: string;
  zhishiPalace: number;
}

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures", "qimen1080.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  _meta: unknown;
  charts: Chart[];
};
const charts = fixture.charts;

// --- 旬首の期待値（60干支の旬の先頭。1080.pdf の項目ではなく定義から算出）------

const STEMS10 = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES12 = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

function ganzhiIndex60(stem: string, branch: string): number {
  const si = STEMS10.indexOf(stem);
  const bi = BRANCHES12.indexOf(branch);
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === si && i % 12 === bi) return i;
  }
  throw new Error(`invalid ganzhi: ${stem}${branch}`);
}

function expectedXunShou(stem: string, branch: string): string {
  const i = ganzhiIndex60(stem, branch);
  const head = i - (i % 10);
  return STEMS10[head % 10] + BRANCHES12[head % 12];
}

// --- 比較ユーティリティ --------------------------------------------------

const OUTER = [1, 2, 3, 4, 6, 7, 8, 9];
const ALL9 = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface Mismatch {
  no: number;
  title: string;
  item: string;
  expected: string;
  actual: string;
}

const mismatches: Mismatch[] = [];
let pass = 0;
let fail = 0;

function fmtMap(m: Record<number, unknown>, keys: number[]): string {
  return keys.map((k) => `${k}:${JSON.stringify(m[k] ?? null)}`).join(" ");
}

function sortedArr(a: readonly string[] | undefined): string {
  return JSON.stringify([...(a ?? [])].sort());
}

function runChart(c: Chart): boolean {
  const dun = c.dun as Dun;
  const hourStem = c.hourStem as Stem;
  const hourBranch = c.hourBranch as Branch;
  const local: Mismatch[] = [];
  const add = (item: string, expected: string, actual: string) =>
    local.push({ no: c.no, title: c.title, item, expected, actual });

  // 地盤
  let diPan: DiPanResult;
  try {
    diPan = resolveDiPan({ dun, ju: c.ju });
    for (const p of ALL9) {
      const exp = c.dipan[String(p)];
      const act = diPan[p];
      if (exp !== act) add(`地盤[${p}]`, exp, String(act));
    }
  } catch (e) {
    add("地盤", "(値あり)", `例外: ${(e as Error).message}`);
    mismatches.push(...local);
    return false;
  }

  // 旬首
  let liuyi: DiPanStem;
  try {
    const xs = resolveXunShou({ hourStem, hourBranch });
    liuyi = xs.liuyi as DiPanStem;
    const expXun = expectedXunShou(c.hourStem, c.hourBranch);
    if (xs.xunShou !== expXun) add("旬首", expXun, xs.xunShou);
  } catch (e) {
    add("旬首", "(値あり)", `例外: ${(e as Error).message}`);
    mismatches.push(...local);
    return false;
  }

  // 天盤
  try {
    const tp = resolveTianPan({ diPan, hourStem, liuyi });
    for (const p of ALL9) {
      const exp = c.tianpan[String(p)];
      const act = tp[p];
      if (exp !== act) add(`天盤[${p}]`, exp, String(act));
    }
  } catch (e) {
    add("天盤", `全宮=${fmtMap(c.tianpan as unknown as Record<number, unknown>, ALL9)}`, `例外: ${(e as Error).message}`);
  }

  // 九星 ＋ 値符
  try {
    const jx = resolveJiuXing({ diPan, liuyi, hourStem });
    for (const p of ALL9) {
      const exp = sortedArr(c.jiuxing[String(p)]);
      const act = sortedArr(jx.jiuXing[p]);
      if (exp !== act) add(`九星[${p}]`, exp, act);
    }
    if (jx.zhifu.star !== c.zhifuStar || jx.zhifu.palace !== c.zhifuPalace) {
      add("値符", `${c.zhifuStar}@${c.zhifuPalace}`, `${jx.zhifu.star}@${jx.zhifu.palace}`);
    }
  } catch (e) {
    add("九星", "(値あり)", `例外: ${(e as Error).message}`);
  }

  // 八門 ＋ 値使
  try {
    const bm = resolveBaMen({ diPan, dun, liuyi, xunShou: resolveXunShou({ hourStem, hourBranch }).xunShou, hourStem, hourBranch });
    for (const p of OUTER) {
      const exp = c.bamen[String(p)];
      const act = bm.baMen[p]?.[0];
      if (exp !== act) add(`八門[${p}]`, exp, String(act));
    }
    if (bm.zhishi.men !== c.zhishiMen || bm.zhishi.palace !== c.zhishiPalace) {
      add("値使", `${c.zhishiMen}@${c.zhishiPalace}`, `${bm.zhishi.men}@${bm.zhishi.palace}`);
    }
  } catch (e) {
    add("八門", "(値あり)", `例外: ${(e as Error).message}`);
  }

  // 八神
  try {
    const bs = resolveBaShen({ diPan, dun, hourStem, liuyi });
    for (const p of OUTER) {
      const exp = c.bashen[String(p)];
      const act = bs.baShen[p]?.[0];
      if (exp !== act) add(`八神[${p}]`, exp, String(act));
    }
  } catch (e) {
    add("八神", "(値あり)", `例外: ${(e as Error).message}`);
  }

  if (local.length > 0) {
    mismatches.push(...local);
    return false;
  }
  return true;
}

// --- 実行 -------------------------------------------------------------

console.log(`検証データ: tests/fixtures/qimen1080.json（1080.pdf からの機械転記・検証専用）`);
console.log(`照合: 地盤 / 旬首 / 天盤 / 九星 / 八門 / 八神（+ 値符・値使）\n`);

if (charts.length !== 1080) {
  console.error(`FAIL: fixture の局数が ${charts.length}（1080 のはず）`);
  process.exit(1);
}

for (const c of charts) {
  if (runChart(c)) pass += 1;
  else fail += 1;
}

console.log(`完全一致: ${pass} / ${charts.length}`);
console.log(`不一致:   ${fail} / ${charts.length}`);

if (fail > 0) {
  console.log(`\n--- 不一致明細（局番号・項目・期待値・実測値）---`);
  const LIMIT = 200;
  for (const m of mismatches.slice(0, LIMIT)) {
    console.log(`  局#${m.no} ${m.title} | ${m.item} | 期待=${m.expected} | 実測=${m.actual}`);
  }
  if (mismatches.length > LIMIT) {
    console.log(`  … ほか ${mismatches.length - LIMIT} 件`);
  }
  console.log(`\n${fail} / ${charts.length} FAIL`);
  process.exit(1);
}

console.log(`\n1080 / 1080 PASS`);
process.exit(0);
