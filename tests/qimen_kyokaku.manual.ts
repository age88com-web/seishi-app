// tests/qimen_kyokaku.manual.ts
//
// 奇門遁甲 凶格（src/lib/qimen/kyokaku.ts）の監修確定事項（2026-10-06）の回帰テスト。
// 実行: npx tsx tests/qimen_kyokaku.manual.ts
//
// 対象（監修確定事項）:
//   1. 大格 ＝ 天盤庚が地盤癸に臨む（庚加癸）。太白入熒 ＝ 庚加丙。
//   2. 伏吟格・反吟格の三種は 九星／八門／直符。
//        直符伏吟 ＝ 地盤と天盤の奇子が同じ / 直符反吟 ＝ 地盤上の奇子と天盤上の奇子が対宮。
//      「値符伏吟／値符反吟」という名称は使わない。
//   3. 時格の別名 ＝ 時干格（凶格８の伏吟格とは別物）。
//
// 検証データ:
//   ・tests/fixtures/qimen1080.json        … 1080局の排盤（局・時干支から排盤モジュールを駆動）
//   ・tests/fixtures/qimen1080_labels.json … 1080.pdf の縦書き格局名ラベルを位置情報から再構成したもの
//     （tests/fixtures/gen_qimen1080_labels.py で生成）。
//   【位置付け】ラベル fixture は検証データであり仕様ではない。講義資料（奇門遁甲講義案N.pdf）と
//   監修確定事項が上位の仕様であり、ラベル fixture を根拠に格局ロジックを変更しない。
//   ラベルの再構成は経験的処理のため、照合は「判定が成立した局に、1080.pdf の該当ラベルがある」
//   の一方向のみとする（逆方向は中宮の干の扱いの差などで一致しないことが分かっている）。
//
// 凶格判定には年干・月干・日干も入力されるが、1080.pdf の各局は (局, 時干支) が索引で年月日を
// 持たないため空文字を渡す。本テストの対象（大格・太白入熒・時格・伏吟格・反吟格）は年月日干に依らない。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveDiPan } from "../src/lib/qimen/dipan";
import { resolveXunShou } from "../src/lib/qimen/xunshou";
import { resolveTianPan } from "../src/lib/qimen/tianpan";
import { resolveJiuXing } from "../src/lib/qimen/jiuxing";
import { resolveBaMen } from "../src/lib/qimen/bamen";
import { resolveBaShen } from "../src/lib/qimen/bashen";
import { resolveKyokaku } from "../src/lib/qimen/kyokaku";
import type { KyokakuResult } from "../src/lib/qimen/kyokaku";
import type { PalaceSummary } from "../src/lib/qimen/qimenEngine";
import type { DiPanStem } from "../src/lib/qimen/dipan";
import type { Dun } from "../src/lib/qimen/dingju";
import type { Stem, Branch } from "../src/lib/eto";

interface Chart {
  no: number;
  title: string;
  dun: Dun;
  ju: number;
  hourStem: string;
  hourBranch: string;
}
interface LabelChart {
  no: number;
  title: string;
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

check("fixture 件数", charts.length, 1080);
check("ラベル fixture 件数", labelCharts.length, 1080);
check("fixture の局順が一致", charts.every((c, i) => labelCharts[i]?.title === c.title), true);

const RING = [4, 9, 2, 7, 6, 1, 8, 3];
const OUTER = [1, 2, 3, 4, 6, 7, 8, 9];
const ALL9 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const opposite = (p: number) => RING[(RING.indexOf(p) + 4) % 8];

interface Row {
  chart: Chart;
  labels: string;
  palaces: Record<number, PalaceSummary>;
  result: KyokakuResult;
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
  const palaces: Record<number, PalaceSummary> = {};
  for (let p = 1; p <= 9; p += 1) {
    palaces[p] = {
      diPanStem: diPan[p],
      tianPanStem: tianPan[p],
      jiuXing: jiuXing.jiuXing[p] ?? [],
      baMen: baMen.baMen[p] ?? [],
      baShen: baShen.baShen[p] ?? [],
    };
  }
  const result = resolveKyokaku({
    palaces,
    dun: c.dun,
    yearStem: "",
    monthStem: "",
    dayStem: "",
    hourStem: c.hourStem,
    hourGanzhi: `${c.hourStem}${c.hourBranch}`,
    zhifuPalace: jiuXing.zhifu.palace,
  });
  return { chart: c, labels: labelCharts[i].labels.map((l) => l.text).join("|"), palaces, result };
});

const find = (r: Row, name: string) => r.result.matches.find((m) => m.name === name);
const pairOuter = (r: Row, t: string, d: string) =>
  OUTER.filter((p) => r.palaces[p].tianPanStem === t && r.palaces[p].diPanStem === d);

// ---- 1. 大格 ＝ 庚加癸 / 太白入熒 ＝ 庚加丙 ----
{
  console.log("1. 大格（庚加癸）・太白入熒（庚加丙）");
  let daige = 0, daigeLabel = 0, taibai = 0, taibaiLabel = 0, daigeOnBing = 0;
  for (const r of rows) {
    const m = find(r, "大格");
    const expected = pairOuter(r, "庚", "癸");
    check(`${r.chart.title} 大格の宮`, JSON.stringify(m?.palaces ?? []), JSON.stringify(expected));
    if (m) {
      daige += 1;
      if (r.labels.includes("大格")) daigeLabel += 1;
      if (pairOuter(r, "庚", "丙").length > 0 && pairOuter(r, "庚", "癸").length === 0) daigeOnBing += 1;
    }
    const t = find(r, "太白入熒");
    check(`${r.chart.title} 太白入熒の宮`, JSON.stringify(t?.palaces ?? []), JSON.stringify(pairOuter(r, "庚", "丙")));
    if (t) {
      taibai += 1;
      if (r.labels.includes("太白入熒")) taibaiLabel += 1;
    }
  }
  check("大格 成立局数", daige, 92);
  check("大格 成立局のうち 1080.pdf に「大格」", daigeLabel, 92);
  check("大格 が庚加丙だけで成立した局", daigeOnBing, 0);
  check("太白入熒 成立局数", taibai, 92);
  check("太白入熒 成立局のうち 1080.pdf に「太白入熒」", taibaiLabel, 92);
}

// ---- 2. 直符伏吟・直符反吟 ----
{
  console.log("2. 直符伏吟（天盤＝地盤）・直符反吟（天盤＝対宮の地盤）");
  let fu = 0, fan = 0, fuYin = 0, fanYin = 0, jiaFu = 0, jia = 0;
  for (const r of rows) {
    const p = r.palaces;
    const stemFu = OUTER.every((x) => p[x].tianPanStem === p[x].diPanStem);
    const stemFan = OUTER.every((x) => p[x].tianPanStem === p[opposite(x)].diPanStem);
    const fuMatch = find(r, "伏吟格");
    const fanMatch = find(r, "反吟格");
    const fuDetail = fuMatch?.detail ?? "";
    const fanDetail = fanMatch?.detail ?? "";
    check(`${r.chart.title} 直符伏吟`, fuDetail.includes("直符伏吟"), stemFu);
    check(`${r.chart.title} 直符反吟`, fanDetail.includes("直符反吟"), stemFan);
    check(`${r.chart.title} 値符表記なし`, /値符伏吟|値符反吟/.test(fuDetail + fanDetail), false);
    if (stemFu) fu += 1;
    if (stemFan) fan += 1;
    if (fuMatch) fuYin += 1;
    if (fanMatch) fanYin += 1;
    if (r.chart.hourStem === "甲") {
      jia += 1;
      if (fuDetail.includes("直符伏吟")) jiaFu += 1;
    }
    // 天盤干は九星に帯同するため、直符伏吟／反吟は九星伏吟／反吟と同じ局で成立する（構造上の帰結）
    check(`${r.chart.title} 直符伏吟⇔九星伏吟`, fuDetail.includes("直符伏吟"), fuDetail.includes("九星伏吟"));
    check(`${r.chart.title} 直符反吟⇔九星反吟`, fanDetail.includes("直符反吟"), fanDetail.includes("九星反吟"));
  }
  check("直符伏吟 成立局数", fu, 240);
  check("直符反吟 成立局数", fan, 120);
  check("甲時の局数", jia, 108);
  check("甲時はすべて直符伏吟", jiaFu, 108);
  check("伏吟格 成立局数", fuYin, 346);
  check("反吟格 成立局数", fanYin, 220);
}

// ---- 3. 時格の別名 ＝ 時干格 ----
{
  console.log("3. 時格（庚加時干）の別名 ＝ 時干格");
  // kyokaku.ts は中宮(5)も含めて走査する（中宮の干の扱いは今回変更しない）。期待値も同じ走査で求める。
  // 1080.pdf との照合は、外周8宮で成立した局に限る。
  let n = 0, outer = 0, label = 0;
  for (const r of rows) {
    const m = find(r, "時格");
    const expected = ALL9.filter(
      (p) => r.palaces[p].tianPanStem === "庚" && r.palaces[p].diPanStem === r.chart.hourStem,
    );
    check(`${r.chart.title} 時格の宮`, JSON.stringify(m?.palaces ?? []), JSON.stringify(expected));
    if (m) {
      n += 1;
      check(`${r.chart.title} 時格 detail`, m.detail, "別名: 時干格");
    }
    if (pairOuter(r, "庚", r.chart.hourStem).length > 0) {
      outer += 1;
      if (r.labels.includes("時干格")) label += 1;
    }
  }
  check("時格 成立局数（中宮を含む）", n, 148);
  check("時格 外周8宮で成立した局数", outer, 136);
  check("時格 外周成立局のうち 1080.pdf に「時干格」", label, 136);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
