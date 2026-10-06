// tests/qimen_kyokaku.manual.ts
//
// 奇門遁甲 凶格（src/lib/qimen/kyokaku.ts）の回帰テスト。
// 実行: npx tsx tests/qimen_kyokaku.manual.ts
//
// 対象（監修確定事項・監修原則、いずれも 2026-10-06）:
//   A. 中宮の寄宮（effectivePalaces.ts）:
//      地盤原盤は中宮5を保持する。天盤以降・格局判定では中宮5を独立した宮として扱わず、
//      中宮の地盤干は坤二宮の寄宮干、中宮由来の天盤干は芮禽宮の天盤干として扱う。
//   B. 遁甲: 時干が甲なら旬首の六儀、日干が甲なら戊として判定する。
//   C. 大格 ＝ 庚加癸（太白入熒 ＝ 庚加丙）／時格の別名 ＝ 時干格／
//      伏吟格・反吟格の三種 ＝ 九星・八門・直符（直符伏吟＝天盤干と地盤干が同じ、直符反吟＝対宮）。
//
// 検証データ:
//   ・tests/fixtures/qimen1080.json        … 1080局の排盤（局・時干支から排盤モジュールを駆動）
//   ・tests/fixtures/qimen1080_labels.json … 1080.pdf の縦書き格局名ラベルを位置情報から再構成したもの
//     （tests/fixtures/gen_qimen1080_labels.py で生成）。ラベルの宮は最寄りの宮名で割り当てる。
//   【位置付け】ラベル fixture は検証データであり仕様ではない。講義資料（奇門遁甲講義案N.pdf）と
//   監修確定事項・監修原則が上位の仕様であり、ラベル fixture を根拠に格局ロジックを変更しない。
//
// 1080.pdf との既知の差（KNOWN_DIFFS、61件）:
//   坤二宮の寄宮干（中宮から寄宮した地盤干）が時干・日干と同じ局で、本実装は時格・伏干格（日格）・
//   時悖格を判定するが、1080.pdf の該当宮にラベルが無い。寄宮原則を優先する本実装と 1080.pdf との
//   既知の差として固定する（どちらが誤りとも断定しない）。
//
// 凶格判定には年干・月干も入力されるが、1080.pdf の各局は (局, 時干支) が索引で年月を持たないため
// 空文字を渡す。日干は題名の「〇〇日」の2干それぞれで判定する（日干に依存する格は 2160 通り）。

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
import {
  resolveEffectivePalaces,
  concealJiaDayStem,
  concealJiaHourStem,
  OUTER_PALACES,
} from "../src/lib/qimen/effectivePalaces";
import type { EffectivePalacesResult } from "../src/lib/qimen/effectivePalaces";
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
  dipan: Record<string, string>;
  tianpan: Record<string, string>;
  jiuxing: Record<string, string[]>;
}
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

check("fixture 件数", charts.length, 1080);
check("ラベル fixture 件数", labelCharts.length, 1080);
check("fixture の局順が一致", charts.every((c, i) => labelCharts[i]?.title === c.title), true);

const RING = [4, 9, 2, 7, 6, 1, 8, 3];
const opposite = (p: number) => RING[(RING.indexOf(p) + 4) % 8];

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
  day: string;
  first: boolean; // 日干に依存しない格は各局1回（first）だけ数える
  labels: Record<number, string>;
  raw: Record<number, PalaceSummary>;
  eff: EffectivePalacesResult;
  /** 遁甲変換後の時干（甲→旬首の六儀）。 */
  effHour: string;
  result: KyokakuResult;
}

const rows: Row[] = [];
charts.forEach((c, i) => {
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
  const labels = labelsByPalace(labelCharts[i]);
  const days = c.title.match(/局(.)(.)日/)!.slice(1, 3);
  days.forEach((day, k) => {
    const result = resolveKyokaku({
      palaces: eff.palaces,
      dun: c.dun,
      yearStem: "",
      monthStem: "",
      dayStem: day,
      hourStem: c.hourStem,
      effectiveDayStem: concealJiaDayStem(day),
      effectiveHourStem: concealJiaHourStem(c.hourStem, liuyi),
      hourGanzhi: `${c.hourStem}${c.hourBranch}`,
      zhifuPalace: jiuXing.zhifu.palace,
    });
    rows.push({ chart: c, day, first: k === 0, labels, raw, eff, effHour: concealJiaHourStem(c.hourStem, liuyi), result });
  });
});

const find = (r: Row, name: string) => r.result.matches.find((m) => m.name === name);
const palacesOf = (r: Row, name: string) => new Set(find(r, name)?.palaces ?? []);

// ---- A. 寄宮後の有効配置 ----
{
  console.log("A. 寄宮後の有効配置（地盤原盤は中宮5を保持／天盤以降は寄宮）");
  let tianOk = 0;
  for (const r of rows.filter((x) => x.first)) {
    const c = r.chart;
    check(`${c.title} 地盤原盤の中宮5`, r.raw[5].diPanStem, c.dipan["5"]);
    check(`${c.title} 有効配置に中宮5が無い`, r.eff.palaces[5], undefined);
    check(`${c.title} 坤二宮の地盤干`, r.eff.palaces[2].diPanStems.join(), [c.dipan["2"], c.dipan["5"]].join());
    // 1080.pdf の天盤表示: 中宮由来の天盤干は天禽と同じ位置（芮禽宮）に描かれている
    const ruiQin = Number(Object.keys(c.jiuxing).find((k) => c.jiuxing[k].includes("天禽")));
    let ok = true;
    for (const p of OUTER_PALACES) {
      const expected = p === ruiQin ? [c.tianpan[String(p)], c.tianpan["5"]] : [c.tianpan[String(p)]];
      if (r.eff.palaces[p].tianPanStems.join() !== expected.join()) ok = false;
    }
    if (ok) tianOk += 1;
  }
  check("有効配置の天盤 ＝ 1080.pdf の天盤表示（芮禽宮に中宮由来の干）", tianOk, 1080);
  check("中宮5で成立した凶格", rows.filter((r) => r.result.matches.some((m) => m.palaces.includes(5))).length, 0);
}

// ---- 1080.pdf ラベルとの宮単位照合 ----
interface Tally { match: number; judgedOnly: string[]; labelOnly: string[] }
function compare(name: string, label: string, perDay: boolean): Tally {
  const t: Tally = { match: 0, judgedOnly: [], labelOnly: [] };
  for (const r of rows) {
    if (!perDay && !r.first) continue;
    const ln = label.replace("{D}", r.day);
    const P = palacesOf(r, name);
    const L = new Set(Object.entries(r.labels).filter(([, s]) => s.includes(ln)).map(([p]) => Number(p)));
    const key = (p: number) => `${r.chart.no}:${perDay ? r.day : "-"}:${name}:${p}`;
    for (const p of P) {
      if (L.has(p)) t.match += 1;
      else t.judgedOnly.push(key(p));
    }
    for (const p of L) if (!P.has(p)) t.labelOnly.push(key(p));
  }
  return t;
}

// ---- B. 干の組合せで決まる格・六儀撃刑・飛干格は 1080.pdf と宮単位で完全一致 ----
{
  console.log("B. 1080.pdf と宮単位で完全一致する格");
  const exact: [string, string, boolean, number][] = [
    ["青龍逃走", "青龍逃走", false, 120],
    ["白虎猖狂", "白虎猖狂", false, 122],
    ["朱雀投江", "朱雀投江", false, 114],
    ["騰蛇夭矯", "螣蛇夭矯", false, 124],
    ["熒入太白", "熒入太白", false, 120],
    ["太白入熒", "太白入熒", false, 120],
    ["大格", "大格", false, 134],
    ["上格", "小格", false, 119],
    ["刑格", "刑格", false, 124],
    ["六儀撃刑", "六儀擊刑", false, 809],
    ["飛干格", "{D}日飛干", true, 272],
  ];
  for (const [name, label, perDay, n] of exact) {
    const t = compare(name, label, perDay);
    check(`${name} 一致（宮）`, t.match, n);
    check(`${name} 判定のみ`, t.judgedOnly.length, 0);
    check(`${name} ラベルのみ`, t.labelOnly.length, 0);
  }
}

// ---- C. 時格・伏干格（日格）・時悖格: ラベルのみ 0、判定のみ ＝ 既知の差 61件 ----
const KNOWN_DIFFS: readonly string[] = [
  "29:-:時格:2", "45:壬:伏干格:2", "85:辛:伏干格:2", "88:-:時格:2", "88:辛:伏干格:2",
  "136:庚:伏干格:2", "141:-:時格:2", "141:庚:伏干格:2", "142:庚:伏干格:2", "147:-:時格:2",
  "189:己:伏干格:2", "191:-:時悖格:2", "196:-:時悖格:2", "206:-:時格:2", "249:甲:伏干格:2",
  "265:-:時格:2", "296:戊:伏干格:2", "314:乙:伏干格:2", "322:-:時格:2", "322:乙:伏干格:2",
  "383:-:時格:2", "389:丙:伏干格:2", "396:丙:伏干格:2", "403:-:時悖格:2", "444:-:時格:2",
  "459:丁:伏干格:2", "463:丁:伏干格:2", "510:-:時格:2", "529:癸:伏干格:2", "531:-:時格:2",
  "531:癸:伏干格:2", "537:癸:伏干格:2", "540:-:時格:2", "540:癸:伏干格:2", "569:-:時格:2",
  "577:壬:伏干格:2", "581:-:時悖格:2", "585:壬:伏干格:2", "589:-:時悖格:2", "628:-:時格:2",
  "628:辛:伏干格:2", "676:庚:伏干格:2", "681:-:時格:2", "681:庚:伏干格:2", "687:-:時格:2",
  "717:-:時格:2", "723:己:伏干格:2", "746:-:時格:2", "789:甲:伏干格:2", "805:-:時格:2",
  "832:戊:伏干格:2", "856:乙:伏干格:2", "861:乙:伏干格:2", "862:-:時格:2", "862:乙:伏干格:2",
  "913:-:時悖格:2", "923:-:時格:2", "926:丙:伏干格:2", "984:-:時格:2", "1050:-:時格:2",
  "1077:癸:伏干格:2",
];
{
  console.log("C. 時格・伏干格・時悖格（1080.pdf との既知の差 61件）");
  check("既知の差 件数", KNOWN_DIFFS.length, 61);
  const tallies: [string, Tally, number][] = [
    ["時格", compare("時格", "時干格", false), 177],
    ["伏干格", compare("伏干格", "{D}日伏干", true), 232],
    // 1080.pdf の「時勃」を講義の時悖格に対応づける（名称からの対応）
    ["時悖格", compare("時悖格", "時勃", false), 34],
  ];
  const judgedOnly: string[] = [];
  for (const [name, t, n] of tallies) {
    check(`${name} 一致（宮）`, t.match, n);
    check(`${name} ラベルのみ`, t.labelOnly.length, 0);
    judgedOnly.push(...t.judgedOnly);
  }
  check("判定のみ ＝ 既知の差", judgedOnly.sort().join(), [...KNOWN_DIFFS].sort().join());
  // 既知の差はすべて「坤二宮の寄宮干が（遁甲変換後の）時干・日干と同じ」局
  for (const k of KNOWN_DIFFS) {
    const [no, day, name, palace] = k.split(":");
    const r = rows.find((x) => x.chart.no === Number(no) && (day === "-" ? x.first : x.day === day))!;
    const key = name === "伏干格" ? concealJiaDayStem(r.day) : r.effHour;
    check(`${k} 坤二宮`, palace, "2");
    check(`${k} 寄宮干＝時干・日干`, r.eff.palaces[2].diPanStems[1], key);
    check(`${k} 本来の地盤干≠時干・日干`, r.eff.palaces[2].diPanStems[0] !== key, true);
  }
  // 日格は伏干格と同条件
  check("日格＝伏干格", rows.every((r) => [...palacesOf(r, "日格")].join() === [...palacesOf(r, "伏干格")].join()), true);
}

// ---- D. 遁甲（甲の変換） ----
{
  console.log("D. 遁甲: 時干甲→旬首の六儀、日干甲→戊");
  check("時干変換 甲（甲申旬）→庚", concealJiaHourStem("甲", "庚"), "庚");
  check("時干変換 甲以外はそのまま", concealJiaHourStem("丙", "庚"), "丙");
  check("日干変換 甲→戊", concealJiaDayStem("甲"), "戊");
  check("日干変換 甲以外はそのまま", concealJiaDayStem("乙"), "乙");
  // No.21 陽遁一局乙庚日甲申時: 甲申→庚、天盤庚が地盤庚の震三宮で時格
  const r21 = rows.find((r) => r.chart.no === 21 && r.first)!;
  check("No.21 甲申時の時格（震三宮）", [...palacesOf(r21, "時格")].join(), "3");
  // 五不遇時は時干支の対応表なので変換前の日干で引く（戊日甲寅時は戊日のみ）
  const jiayin = rows.filter((r) => r.chart.title.endsWith("甲寅時") && r.chart.title.includes("戊癸日"));
  check("戊癸日甲寅時: 戊日は五不遇時", jiayin.filter((r) => r.day === "戊").every((r) => !!find(r, "五不遇時")), true);
  check("戊癸日甲寅時: 癸日は五不遇時でない", jiayin.filter((r) => r.day === "癸").every((r) => !find(r, "五不遇時")), true);
}

// ---- E. 監修確定事項（大格・時格の別名・直符伏吟/反吟） ----
{
  console.log("E. 大格（庚加癸）・時格の別名・直符伏吟／反吟");
  let fu = 0, fan = 0, jia = 0, jiaFu = 0;
  for (const r of rows.filter((x) => x.first)) {
    const P = r.eff.palaces;
    const has = (p: number, t: string, d: string) => P[p].tianPanStems.includes(t as DiPanStem) && P[p].diPanStems.includes(d as DiPanStem);
    check(`${r.chart.title} 大格の宮`, [...palacesOf(r, "大格")].join(), OUTER_PALACES.filter((p) => has(p, "庚", "癸")).join());
    check(`${r.chart.title} 太白入熒の宮`, [...palacesOf(r, "太白入熒")].join(), OUTER_PALACES.filter((p) => has(p, "庚", "丙")).join());
    const tm = find(r, "時格");
    if (tm) check(`${r.chart.title} 時格 detail`, tm.detail, "別名: 時干格");
    const fuDetail = find(r, "伏吟格")?.detail ?? "";
    const fanDetail = find(r, "反吟格")?.detail ?? "";
    check(`${r.chart.title} 値符表記なし`, /値符伏吟|値符反吟/.test(fuDetail + fanDetail), false);
    check(`${r.chart.title} 直符伏吟⇔九星伏吟`, fuDetail.includes("直符伏吟"), fuDetail.includes("九星伏吟"));
    check(`${r.chart.title} 直符反吟⇔九星反吟`, fanDetail.includes("直符反吟"), fanDetail.includes("九星反吟"));
    const stemFan = OUTER_PALACES.every((p) => P[p].tianPanStems[0] === P[opposite(p)].diPanStems[0]);
    check(`${r.chart.title} 直符反吟（本来の干）`, fanDetail.includes("直符反吟"), stemFan);
    if (fuDetail.includes("直符伏吟")) fu += 1;
    if (fanDetail.includes("直符反吟")) fan += 1;
    if (r.chart.hourStem === "甲") {
      jia += 1;
      if (fuDetail.includes("直符伏吟")) jiaFu += 1;
    }
  }
  check("直符伏吟 成立局数", fu, 240);
  check("直符反吟 成立局数", fan, 120);
  check("甲時はすべて直符伏吟", `${jiaFu}/${jia}`, "108/108");
}

// ---- F. 各凶格の成立件数（回帰固定） ----
{
  console.log("F. 各凶格の成立件数（日干に依存する格は 2160 通り、その他は 1080 局）");
  const DAY_DEP = new Set(["日格", "日悖格", "伏干格", "飛干格"]);
  const expected: Record<string, number> = {
    青龍逃走: 120, 白虎猖狂: 122, 朱雀投江: 114, 騰蛇夭矯: 124,
    熒入太白: 120, 太白入熒: 120, 大格: 134, 上格: 119,
    刑格: 124, 奇格: 374, 日格: 264, 時格: 200,
    日悖格: 243, 時悖格: 40, 五不遇時: 90, 時干入墓: 12,
    伏干格: 264, 飛干格: 272, 伏宮格天乙格: 200, 飛宮格天乙太白: 152, 戦格: 240,
    符勃格: 40, 飛悖格: 136, 乙奇入墓: 270, 丙奇入墓: 136, 丁奇入墓: 136,
    三奇受刑: 469, 六儀撃刑: 572, 伏吟格: 346, 反吟格: 220, 天網四張: 200,
    地網遮蔽: 200, 門迫: 720, 宮迫: 720,
  };
  for (const [name, n] of Object.entries(expected)) {
    const got = rows.filter((r) => (DAY_DEP.has(name) || r.first) && !!find(r, name)).length;
    check(`${name} 成立件数`, got, n);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
