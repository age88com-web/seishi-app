// tests/qimen_jikaku.manual.ts
//
// 奇門遁甲 吉格（src/lib/qimen/jikaku.ts）の回帰テスト。
// 実行: npx tsx tests/qimen_jikaku.manual.ts
//
// 対象（監修確定事項・監修原則、いずれも 2026-10-06）:
//   A. 中宮の寄宮: 吉格も外周8宮＋寄宮後の有効配置（effectivePalaces.ts）で判定し、中宮5では判定しない。
//   B. 青龍返首: 天盤の旬首六儀は、時干の宮へ実際に転動された天盤干に限る（芮禽宮へ寄宮した
//      中宮由来の干は使わない）。地盤丙は坤二宮の寄宮干を含む。
//   C. 虎遁: docs/source/虎遁、龍遁.png（表 No.13）本文「休門と天盤乙奇が地盤辛儀に臨む。或いは艮八宮に臨む」
//      → 休門＋天盤乙＋（地盤辛 または 艮八宮）。講義PDF p49 の「生門」は採用しない。
//   D. 龍遁: docs/source/虎遁、龍遁.png（表 No.12）の注記『御定奇門寶鑑』
//      「三吉門＋天盤乙＋（地盤癸 または 坎一宮）」を正式仕様として維持（1080.pdf との既知の定義差）。
//   E. 五假: docs/source/五か.png（表 No.23〜27）＝講義PDF p51 の定義を維持（1080.pdf との既知の定義差）。
//
// 検証データ:
//   ・tests/fixtures/qimen1080.json        … 1080局の排盤（局・時干支から排盤モジュールを駆動）
//   ・tests/fixtures/qimen1080_labels.json … 1080.pdf の縦書き格局名ラベルを位置情報から再構成したもの
//   【位置付け】ラベル fixture は検証データであり仕様ではない。講義資料・source 資料・監修確定事項が上位。
//   1080.pdf の表記差: 升殿→「昇殿」、真詐→「眞詐」。1080.pdf の「物假」と鬼假の対応は未確定（照合しない）。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveDiPan } from "../src/lib/qimen/dipan";
import { resolveXunShou } from "../src/lib/qimen/xunshou";
import { resolveTianPan } from "../src/lib/qimen/tianpan";
import { resolveJiuXing } from "../src/lib/qimen/jiuxing";
import { resolveBaMen } from "../src/lib/qimen/bamen";
import { resolveBaShen } from "../src/lib/qimen/bashen";
import { resolveJikaku } from "../src/lib/qimen/jikaku";
import type { JikakuResult } from "../src/lib/qimen/jikaku";
import { resolveEffectivePalaces, OUTER_PALACES } from "../src/lib/qimen/effectivePalaces";
import type { EffectivePalace } from "../src/lib/qimen/effectivePalaces";
import type { PalaceSummary } from "../src/lib/qimen/qimenEngine";
import type { DiPanStem } from "../src/lib/qimen/dipan";
import type { Dun } from "../src/lib/qimen/dingju";
import type { Stem, Branch } from "../src/lib/eto";

interface Chart { no: number; title: string; dun: Dun; ju: number; hourStem: string; hourBranch: string }
interface LabelChart {
  no: number;
  title: string;
  palaces: Record<string, [number, number]>;
  labels: { text: string; x: number; y: number }[];
}

const here = dirname(fileURLToPath(import.meta.url));
const charts = (JSON.parse(readFileSync(join(here, "fixtures", "qimen1080.json"), "utf8")) as { charts: Chart[] }).charts;
const labelCharts = (JSON.parse(readFileSync(join(here, "fixtures", "qimen1080_labels.json"), "utf8")) as { charts: LabelChart[] }).charts;

let pass = 0;
let fail = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  if (actual === expected) {
    pass += 1;
  } else {
    fail += 1;
    console.log(`  FAIL ${label}: got ${String(actual)}, want ${String(expected)}`);
  }
}

check("fixture の局順が一致", charts.every((c, i) => labelCharts[i]?.title === c.title), true);

/** ラベルを最寄りの宮名へ割り当て、宮ごとの文字列（区切りあり＋区切りなし連結）を返す。 */
function labelsByPalace(lc: LabelChart): Record<number, string> {
  const parts: Record<number, string[]> = {};
  for (const w of lc.labels) {
    let best = 0;
    let bestD = Infinity;
    for (const [k, [x, y]] of Object.entries(lc.palaces)) {
      const d = Math.hypot(x - w.x, y - w.y);
      if (d < bestD) {
        bestD = d;
        best = Number(k);
      }
    }
    (parts[best] ??= []).push(w.text);
  }
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(parts)) out[Number(k)] = `${v.join("/")}|${v.join("")}`;
  return out;
}

interface Row {
  chart: Chart;
  labels: Record<number, string>;
  eff: Record<number, EffectivePalace>;
  centerStem: DiPanStem | null;
  liuyi: DiPanStem;
  zhishiPalace: number;
  result: JikakuResult;
}

const rows: Row[] = charts.map((c, i) => {
  const hourStem = c.hourStem as Stem;
  const hourBranch = c.hourBranch as Branch;
  const diPan = resolveDiPan({ dun: c.dun, ju: c.ju });
  const xs = resolveXunShou({ hourStem, hourBranch });
  const liuyi = xs.liuyi as DiPanStem;
  const tianPan = resolveTianPan({ diPan, hourStem, liuyi });
  const jiuXing = resolveJiuXing({ diPan, liuyi, hourStem });
  const baMen = resolveBaMen({ diPan, dun: c.dun, liuyi, xunShou: xs.xunShou, hourStem, hourBranch });
  const baShen = resolveBaShen({ diPan, dun: c.dun, hourStem, liuyi });
  const raw: Record<number, PalaceSummary> = {};
  for (let p = 1; p <= 9; p += 1) {
    raw[p] = {
      diPanStem: diPan[p],
      tianPanStem: tianPan[p],
      jiuXing: jiuXing.jiuXing[p] ?? [],
      baMen: baMen.baMen[p] ?? [],
      baShen: baShen.baShen[p] ?? [],
    };
  }
  const eff = resolveEffectivePalaces(raw);
  const result = resolveJikaku({
    palaces: eff.palaces,
    liuyi,
    zhishiPalace: baMen.zhishi.palace,
  });
  return { chart: c, labels: labelsByPalace(labelCharts[i]), eff: eff.palaces, centerStem: eff.centerStem, liuyi, zhishiPalace: baMen.zhishi.palace, result };
});

const palacesOf = (r: Row, name: string) => new Set(r.result.matches.find((m) => m.name === name)?.palaces ?? []);

/** 宮単位で「一致/判定のみ/ラベルのみ」を返す。pred を渡すと jikaku.ts の代わりにその条件で数える。 */
function compare(
  name: string,
  label: string,
  pred?: (p: EffectivePalace, palace: number, r: Row) => boolean,
): string {
  let a = 0, b = 0, c = 0;
  for (const r of rows) {
    const P = pred ? new Set(OUTER_PALACES.filter((p) => pred(r.eff[p], p, r))) : palacesOf(r, name);
    const L = new Set(Object.entries(r.labels).filter(([, s]) => s.includes(label)).map(([p]) => Number(p)));
    for (const p of P) if (L.has(p)) a += 1; else b += 1;
    for (const p of L) if (!P.has(p)) c += 1;
  }
  return `${a}/${b}/${c}`;
}

// ---- A. 中宮5では判定しない ----
{
  console.log("A. 中宮5で成立した吉格は無い");
  check("中宮5での成立", rows.filter((r) => r.result.matches.some((m) => m.palaces.includes(5))).length, 0);
}

// ---- B. 1080.pdf と宮単位で完全一致する吉格 ----
{
  console.log("B. 1080.pdf と宮単位で完全一致（一致/判定のみ/ラベルのみ）");
  const exact: [string, string, number][] = [
    ["青龍返首", "青龍返首", 120],
    ["飛鳥跌穴", "飛鳥跌穴", 130],
    ["天遁", "天遁", 28],
    ["地遁", "地遁", 19],
    ["人遁", "人遁", 12],
    ["神遁", "神遁", 20],
    ["虎遁", "虎遁", 26],
    ["玉女守門", "玉女守門", 136],
    ["乙奇升殿", "乙奇昇殿", 135],
    ["丙奇升殿", "丙奇昇殿", 136],
    ["丁奇升殿", "丁奇昇殿", 135],
    ["真詐", "眞詐", 167],
    ["重詐", "重詐", 148],
    ["休詐", "休詐", 154],
  ];
  for (const [name, label, n] of exact) check(`${name}`, compare(name, label), `${n}/0/0`);
}

// ---- C. 青龍返首: 芮禽宮へ寄宮した中宮由来の干は天盤六儀として使わない ----
{
  console.log("C. 青龍返首（旬首六儀が中宮の局では寄宮した天盤干を使わない）");
  const QLFS_EXCLUDED = [43, 93, 143, 191, 193, 196, 243, 533, 581, 583, 589, 633, 683, 733, 783, 1073];
  // 寄宮した天盤干まで含めると成立してしまう局（＝本規則で除外される局）
  const wouldMatch = rows
    .filter((r) => OUTER_PALACES.some((p) => r.eff[p].tianPanStems.includes(r.liuyi) && r.eff[p].diPanStems.includes("丙")))
    .filter((r) => palacesOf(r, "青龍返首").size === 0)
    .map((r) => r.chart.no);
  check("寄宮天盤干を含めた場合にだけ成立する局", wouldMatch.join(), QLFS_EXCLUDED.join());
  check("除外局はすべて旬首六儀が中宮", QLFS_EXCLUDED.every((no) => rows[no - 1].liuyi === rows[no - 1].centerStem), true);
}

// ---- D. 虎遁: 生門では成立しない ----
{
  console.log("D. 虎遁は休門のみ");
  check("虎遁の宮に休門", rows.every((r) => [...palacesOf(r, "虎遁")].every((p) => r.eff[p].baMen.includes("休門"))), true);
  check("講義PDF p49（生門を含む）なら判定のみが出る", compare("虎遁", "虎遁", (p, palace) =>
    ((p.baMen.includes("休門") || p.baMen.includes("生門")) && p.tianPanStems.includes("乙") && p.diPanStems.includes("辛")) ||
    (palace === 8 && p.baMen.includes("休門") && p.tianPanStems.includes("乙"))), "26/16/0");
}

// ---- D2. 玉女守門: 値使門の宮の地盤丁（坤二宮の寄宮丁を含む）。旬ごとの時干支表は掛けない ----
{
  console.log("D2. 玉女守門（値使門の宮の地盤丁。寄宮丁を含み、旬表は掛けない）");
  check("玉女守門の宮＝値使門の宮", rows.every((r) => [...palacesOf(r, "玉女守門")].every((p) => p === r.zhishiPalace)), true);
  // 坤二宮の寄宮干（中宮から寄宮した地盤丁）だけで成立する宮
  const viaJigong = rows.filter((r) => palacesOf(r, "玉女守門").has(2) && r.eff[2].diPanStems[0] !== "丁");
  check("寄宮丁だけで成立する局", viaJigong.length, 26);
  check("その26局すべて 1080.pdf の坤二宮に玉女守門ラベル", viaJigong.every((r) => (r.labels[2] ?? "").includes("玉女守門")), true);
  // 旧実装（旬ごとの時干支表を追加条件として掛ける）では成立しない宮が出る
  const XUN_TABLE: Record<string, string> = { 甲子: "庚午", 甲戌: "己卯", 甲申: "戊子", 甲午: "丁酉", 甲辰: "丙午", 甲寅: "乙卯" };
  check("参考: 旬表を掛けた旧実装", compare("玉女守門", "玉女守門", (p, palace, r) => {
    const hs = r.chart.hourStem as Stem, hb = r.chart.hourBranch as Branch;
    return palace === r.zhishiPalace && p.diPanStems.includes("丁") &&
      XUN_TABLE[resolveXunShou({ hourStem: hs, hourBranch: hb }).xunShou] === `${hs}${hb}`;
  }), "108/0/28");
}

// ---- E. 1080.pdf との既知の定義差（定義は変えずに固定） ----
{
  console.log("E. 1080.pdf との既知の定義差");
  // 龍遁:『寶鑑』（三吉門）を維持。1080.pdf は休門のみで一致する。
  check("龍遁（寶鑑・三吉門）", compare("龍遁", "龍遁"), "44/56/0");
  check("参考: 龍遁を休門のみにした場合", compare("龍遁", "龍遁", (p, palace) => p.baMen.includes("休門") && p.tianPanStems.includes("乙") &&
    (p.diPanStems.includes("癸") || palace === 1)), "44/0/0");
  // 五假: source 資料＝講義PDF の定義を維持。1080.pdf の五假ラベルは限定的。
  check("天假", compare("天假", "天假"), "1/58/0");
  check("地假", compare("地假", "地假"), "1/147/0");
  check("人假", compare("人假", "人假"), "0/11/1");
  check("神假", compare("神假", "神假"), "0/87/1");
  // 監修判断が未了の定義差（現状の定義のまま固定）
  check("鬼遁", compare("鬼遁", "鬼遁"), "19/27/0");
  check("風遁", compare("風遁", "風遁"), "36/0/41");
  check("雲遁", compare("雲遁", "雲遁"), "45/11/42");
  // 三奇得使: 講義の片方向定義を正式仕様として維持（監修確定 2026-10-06）。1080.pdf は双方向の別系統。
  check("乙奇得使", compare("乙奇得使", "乙奇得使"), "238/0/241");
  check("丙奇得使", compare("丙奇得使", "丙奇得使"), "239/0/243");
  check("丁奇得使", compare("丁奇得使", "丁奇得使"), "232/0/243");
  // 参考（異説・実装しない）: 1080.pdf で三奇得使と呼ばれている別系統の規則（奇と対応儀が天盤・地盤どちら向きでも同宮）。
  // 『寶鑑御定』の三奇得使・三奇游六儀のいずれとも一致しない（docs/qimen-spec/11_格局（吉格）.md 参考資料・異説の記録）。
  const PAIR: Record<string, string[]> = { 乙: ["己", "辛"], 丙: ["戊", "庚"], 丁: ["壬", "癸"] };
  const want: Record<string, string> = { 乙: "479/0/0", 丙: "482/0/0", 丁: "475/0/0" };
  for (const [q, ys] of Object.entries(PAIR)) {
    check(`参考: 1080.pdf 系統の${q}奇得使（双方向）`, compare(`${q}奇得使`, `${q}奇得使`, (p) =>
      (p.tianPanStems.includes(q as DiPanStem) && ys.some((y) => p.diPanStems.includes(y as DiPanStem))) ||
      (p.diPanStems.includes(q as DiPanStem) && ys.some((y) => p.tianPanStems.includes(y as DiPanStem)))), want[q]);
  }
}

// ---- F. 各吉格の成立局数（回帰固定） ----
{
  console.log("F. 各吉格の成立局数");
  const expected: Record<string, number> = {
    青龍返首: 120, 飛鳥跌穴: 130, 玉女守門: 136, 天遁: 28, 地遁: 19, 人遁: 12, 神遁: 20,
    鬼遁: 46, 風遁: 36, 雲遁: 56, 龍遁: 100, 虎遁: 26, 乙奇得使: 238, 丙奇得使: 239, 丁奇得使: 232,
    乙奇升殿: 135, 丙奇升殿: 136, 丁奇升殿: 135, 真詐: 167, 重詐: 148, 休詐: 154,
    天假: 59, 地假: 148, 人假: 11, 神假: 87, 鬼假: 53,
  };
  for (const [name, n] of Object.entries(expected)) {
    check(`${name} 成立局数`, rows.filter((r) => palacesOf(r, name).size > 0).length, n);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
