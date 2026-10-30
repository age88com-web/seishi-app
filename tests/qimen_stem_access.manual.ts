// tests/qimen_stem_access.manual.ts
//
// 奇門遁甲 中宮寄宮（src/lib/qimen/stemAccess.ts と qimenEngine.ts の寄宮項目）の確認。
//   1) 1080.pdf（tests/fixtures/qimen1080.json）: 天盤の寄宮干・寄宮先（天禽・天芮の同居宮）が
//      1080.pdf の「禽」の天盤干と位置に全1080局で一致。地盤の寄宮干は中五宮の地盤干で坤二宮。
//   2) 講義案N.pdf p.22 例1（己巳 陰五局）: 坤二宮の地盤が「辛(戊)」。p.23 例2（辛巳 陰八局）。
//   3) calculate(): 2026-04-01〜09-30 の全時刻（4392盤＝1080局すべてを含む）で、
//      寄宮項目が該当する宮にだけ付き、既存の diPanStem / tianPanStem を上書きしない。
//      寄宮項目を取り除いて格局を再判定しても、寄宮対応格局（凶格の基本6格局・刑格・上格・奇格・戦格・入墓3格・三奇受刑・六儀撃刑、吉格の三奇得使・三奇升殿・五遁・三詐・四遁・五假・青龍返首・飛鳥跌穴・玉女守門＝全吉格）以外は完全に同じ（＝未参照）。
//      寄宮対応格局は、寄宮項目を除いた結果が現在の結果に含まれる（寄宮干で成立宮が増えるだけ）。
//      陽遁3局丙戌の坎一宮（天盤 乙＋寄宮 庚）、陽遁3局戊子の坤二宮（地盤 乙＋寄宮 庚）。
//   4) 参照関数: 既定方針（CURRENT_POLICY）は通常干のみ・中五宮も判定。
//      寄宮干の区別、中五宮の除外、寄宮干どうしの自己組み合わせの除外、役割の寄宮干の扱い。
//   5) Phase 3A 基本6格局（青龍逃走・白虎猖狂・朱雀投江・騰蛇夭矯・熒入太白・太白入熒）:
//      1080.pdf の盤（芮禽宮の天盤2干・坤二宮の地盤寄宮干）から直接求めた成立宮と全1080局で一致。
//      成立局数 120/122/114/124/120/120（1080.pdf の格局ラベルの局数と同じ）。
//      陽遁3局辛未 坤二宮 熒入太白（天盤丙×地盤寄宮庚）、陽遁3局乙丑 坎一宮 太白入熒（天盤寄宮庚×地盤丙）。
//   6) Phase 3B 刑格: 5) と同じ照合で全1080局一致・124局（1080.pdf「刑格」の局数・宮数と同じ）。
//      陽遁3局丙寅 巽四宮（天盤寄宮庚×地盤己）、陽遁4局壬申 坤二宮（天盤庚×地盤寄宮己）。
//   7) Phase 3C 上格・奇格・戦格: 5) と同じ照合で全1080局一致。上格119局（1080.pdf「小格」と同数）、
//      奇格374局、戦格213局（寄宮干どうしの庚×庚を除くため、通常干のみの成立宮と同じ）。
//   8) Phase 3D 吉格の三奇得使・三奇升殿: 1080.pdf の盤から講義案の条件で直接求めた成立宮と全1080局一致。
//      乙/丙/丁奇得使 238/239/232局、乙/丙/丁奇升殿 135/136/135局（升殿は 1080.pdf「昇殿」と同数）。
//      陽遁2局己巳 坤二宮 乙奇得使（天盤乙×地盤寄宮）、陽遁6局辛未 震三宮 乙奇升殿（天盤寄宮乙）。
//   9) Phase 3E 吉格の五遁・三詐: 1080.pdf の盤（天盤・地盤・八門・八神）から講義案の条件で直接求めた成立宮と
//      全1080局一致。天遁28・地遁19・人遁12・神遁20・鬼遁46・真詐167・重詐148・休詐154局。
//      地盤寄宮干は地盤干を条件に含む天遁・地遁だけで参照する。
//   10) Phase 3F 吉格の四遁・五假: 同じ照合で全1080局一致。風遁36・雲遁56・龍遁100・虎遁42・天假59・地假148・
//      人假11（寄宮で変化なし）・神假87・鬼假53局。地盤寄宮干は雲遁・龍遁・虎遁だけで参照する。
//   11) Phase 3G 青龍返首・飛鳥跌穴・玉女守門（XUNSHOU_ROLE_POLICY）: 同じ照合で全1080局一致。
//      青龍返首120（天盤の旬首六儀は通常干のみ・地盤丙は寄宮干も）、飛鳥跌穴130（天盤丙・地盤の旬首六儀とも寄宮干も）、
//      玉女守門108（値使門の宮の地盤丁は寄宮干も・旬条件は維持）。
//      陽遁7局丙寅 坤二宮 青龍返首（天盤戊×地盤寄宮丙）、陽遁7局乙丑 兌七宮 飛鳥跌穴（天盤寄宮丙×地盤戊）、
//      陽遁1局丙午 坤二宮 飛鳥跌穴（天盤丙×地盤寄宮壬＝中五宮の旬首六儀）、陽遁8局庚午 坤二宮 玉女守門（地盤寄宮丁）。
//      旬首六儀が中五宮の盤では、天禽が帯同する旬首六儀で青龍返首を成立させない。
//   12) Phase 3I 凶格の乙奇入墓・丙奇入墓・丁奇入墓・三奇受刑・六儀撃刑（天盤干と宮だけで成立）:
//      1080.pdf の盤（芮禽宮の天盤2干）から講義案の条件で直接求めた成立宮と全1080局一致。
//      六儀撃刑572・乙奇入墓270・丙奇入墓136・丁奇入墓136・三奇受刑469局。地盤寄宮干は参照しない。
//      陽遁1局丁卯 巽四宮 壬儀撃刑（天盤己＋寄宮壬）、陽遁6局甲子 坤二宮・陽遁6局庚午 乾六宮 乙奇入墓（寄宮乙）、
//      陽遁7局辛未 乾六宮 丙奇入墓（寄宮丙）、陽遁8局丁卯 艮八宮 丁奇入墓（寄宮丁）。
//
// 実行: npx tsx tests/qimen_stem_access.manual.ts

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveDiPan } from "../src/lib/qimen/dipan";
import { resolveXunShou } from "../src/lib/qimen/xunshou";
import { resolveTianPan } from "../src/lib/qimen/tianpan";
import { resolveJiuXing } from "../src/lib/qimen/jiuxing";
import {
  calculate,
  resolveJikakuFromQimen,
  resolveKyokakuFromQimen,
  CURRENT_POLICY,
  makeStemPolicy,
  tianPanStems,
  diPanStems,
  roleStems,
  stemPairs,
  scanPalaces,
  judgedPalaces,
} from "../src/lib/qimen";
import type { PalaceSummary, QimenResult } from "../src/lib/qimen";
import { resolveCenterLodging, lodgedStemsAt, resolveQinCompanion, qinCompanionAt, BASIC_PAIR_POLICY, XUNSHOU_ROLE_POLICY } from "../src/lib/qimen/stemAccess";
import { resolveKyokaku } from "../src/lib/qimen/kyokaku";
import { resolveJikaku } from "../src/lib/qimen/jikaku";
import type { Stem, Branch } from "../src/lib/eto";

let failed = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) {
    failed += 1;
    console.log(`FAIL ${label}${detail ? " — " + detail : ""}`);
  }
}

// ---- 1) 1080.pdf との照合 ---------------------------------------------------
interface Chart {
  title: string;
  dun: "陽遁" | "陰遁";
  ju: number;
  hourStem: string;
  hourBranch: string;
  zhishiPalace: number;
  dipan: Record<string, string>;
  bamen: Record<string, string>;
  bashen: Record<string, string>;
  tianpan: Record<string, string>;
  jiuxing: Record<string, string[]>;
}
const here = dirname(fileURLToPath(import.meta.url));
const charts = (JSON.parse(readFileSync(join(here, "fixtures", "qimen1080.json"), "utf8")) as { charts: Chart[] }).charts;
let n1080 = 0;
const SIX: readonly [string, string, string | readonly string[]][] = [
  ["青龍逃走", "乙", "辛"], ["白虎猖狂", "辛", "乙"], ["朱雀投江", "丁", "癸"],
  ["騰蛇夭矯", "癸", "丁"], ["熒入太白", "丙", "庚"], ["太白入熒", "庚", "丙"],
  ["刑格", "庚", "己"],
  ["上格", "庚", "壬"], ["奇格", "庚", ["乙", "丙", "丁"]], ["戦格", "庚", "庚"],
  ["大格", "庚", "癸"],
];
/** 寄宮対応の凶格（Phase 3J-2）。旬首六儀を値符の役割に使う。 */
const KY_ROLE = ["伏宮格天乙格", "飛宮格天乙太白"] as const;
const kyRoleCount: Record<string, number> = Object.fromEntries(KY_ROLE.map((n) => [n, 0]));
/** 寄宮対応の凶格（Phase 3L）。値符の九星の宮で天盤丙／地盤丙を見る。 */
const KY_ZHIFU = ["符勃格", "飛悖格"] as const;
const kyZhifuCount: Record<string, number> = Object.fromEntries(KY_ZHIFU.map((n) => [n, 0]));
/** 寄宮対応の凶格（Phase 4C）。天盤丙（芮禽宮の寄宮干を含む）×地盤の用事の干（通常干のみ）。 */
const KY_HAI = ["年悖格", "月悖格", "日悖格", "時悖格"] as const;
const kyHaiCount: Record<string, number> = Object.fromEntries(KY_HAI.map((n) => [n, 0]));
/** 寄宮対応の凶格（Phase 3I）。天盤干と宮だけで成立。[名称, 条件(天盤干, 宮)] */
const SIX_YI_XING: Record<string, number> = { 戊: 3, 己: 2, 庚: 8, 辛: 9, 壬: 4, 癸: 4 };
const KY_TIAN: readonly [string, (t: string, palace: number) => boolean][] = [
  ["乙奇入墓", (t, p) => t === "乙" && (p === 2 || p === 6)],
  ["丙奇入墓", (t, p) => t === "丙" && p === 6],
  ["丁奇入墓", (t, p) => t === "丁" && p === 8],
  ["三奇受刑", (t, p) => (t === "乙" && (p === 6 || p === 2)) || (t === "丙" && p === 6) || (t === "丁" && p === 8)],
  ["六儀撃刑", (t, p) => SIX_YI_XING[t] === p],
];
const kyTianCount: Record<string, number> = Object.fromEntries(KY_TIAN.map(([n]) => [n, 0]));
const SIX_NAMES = new Set([...SIX.map(([n]) => n), ...KY_TIAN.map(([n]) => n), ...KY_ROLE, ...KY_ZHIFU, ...KY_HAI]);
/** 寄宮対応の吉格（Phase 3D）。[名称, 天盤干, 地盤干（null＝地盤を問わない）, 宮（null＝問わない）] */
const JI: readonly [string, string, readonly string[] | null, number | null][] = [
  ["乙奇得使", "乙", ["己", "辛"], null], ["丙奇得使", "丙", ["戊", "庚"], null], ["丁奇得使", "丁", ["壬", "癸"], null],
  ["乙奇升殿", "乙", null, 3], ["丙奇升殿", "丙", null, 9], ["丁奇升殿", "丁", null, 7],
];
/**
 * 寄宮対応の吉格（Phase 3E 五遁・三詐）。[名称, 条件(天盤干, 地盤干, 門, 神), 地盤干を条件に含むか]。
 * 地盤干を条件に含まない格は、地盤寄宮干を参照しない。
 */
const SANKICHI = ["休門", "開門", "生門"];
const JI2: readonly [string, (t: string, d: string, men: string, shen: string, palace: number) => boolean, boolean][] = [
  ["天遁", (t, d, men) => men === "生門" && t === "丙" && (d === "丁" || d === "戊"), true],
  ["地遁", (t, d, men) => men === "開門" && t === "乙" && d === "己", true],
  ["人遁", (t, _d, men, shen) => men === "休門" && t === "丁" && shen === "太陰", false],
  ["神遁", (t, _d, men, shen) => men === "生門" && t === "丙" && shen === "九天", false],
  ["鬼遁", (t, _d, men, shen) => shen === "九地" && ((men === "杜門" && t === "丁") || (men === "開門" && t === "乙") || (men === "休門" && t === "丁")), false],
  ["真詐", (t, _d, men, shen) => SANKICHI.includes(men) && ["乙", "丙", "丁"].includes(t) && shen === "太陰", false],
  ["重詐", (t, _d, men, shen) => SANKICHI.includes(men) && ["乙", "丙", "丁"].includes(t) && shen === "九地", false],
  ["休詐", (t, _d, men, shen) => SANKICHI.includes(men) && ["乙", "丙", "丁"].includes(t) && shen === "六合", false],
  // Phase 3F 四遁・五假（龍遁・虎遁はユーザー確定の条件A・B）
  ["風遁", (t, _d, men, _s, p) => p === 4 && SANKICHI.includes(men) && t === "乙", false],
  ["雲遁", (t, d, men, _s, p) => (SANKICHI.includes(men) && t === "乙" && d === "辛") || (p === 2 && t === "乙" && men === "開門"), true],
  ["龍遁", (t, d, men, _s, p) => (SANKICHI.includes(men) && t === "乙" && d === "癸") || (p === 1 && SANKICHI.includes(men) && t === "乙"), true],
  ["虎遁", (t, d, men, _s, p) => ((men === "休門" || men === "生門") && t === "乙" && d === "辛") || (p === 8 && men === "休門" && t === "乙"), true],
  ["天假", (t, _d, men, shen) => men === "景門" && ["乙", "丙", "丁"].includes(t) && shen === "九天", false],
  ["地假", (t, _d, men, shen) => men === "杜門" && ["丁", "己", "癸"].includes(t) && ["九地", "太陰", "六合"].includes(shen), false],
  ["人假", (t, _d, men, shen) => men === "驚門" && t === "壬" && shen === "九天", false],
  ["神假", (t, _d, men, shen) => men === "傷門" && ["丁", "己", "癸"].includes(t) && ["九地", "六合"].includes(shen), false],
  ["鬼假", (t, _d, men, shen) => men === "死門" && ["丁", "己", "癸"].includes(t) && shen === "九地", false],
];
const GYOJO_XUN: Record<string, string> = { 甲子: "庚午", 甲戌: "己卯", 甲申: "戊子", 甲午: "丁酉", 甲辰: "丙午", 甲寅: "乙卯" };
const JI3 = ["青龍返首", "飛鳥跌穴", "玉女守門"] as const;
const ji3Count: Record<string, number> = Object.fromEntries(JI3.map((n) => [n, 0]));
const JI_NAMES = new Set([...JI.map(([n]) => n), ...JI2.map(([n]) => n), ...JI3]);
const ji2Count: Record<string, number> = Object.fromEntries(JI2.map(([n]) => [n, 0]));
const jiCount: Record<string, number> = Object.fromEntries(JI.map(([n]) => [n, 0]));
const seenEx = new Set<string>();
const sixCount: Record<string, number> = Object.fromEntries(SIX.map(([n]) => [n, 0]));
for (const c of charts) {
  const diPan = resolveDiPan({ dun: c.dun, ju: c.ju });
  const xs = resolveXunShou({ hourStem: c.hourStem as Stem, hourBranch: c.hourBranch as Branch });
  const liuyi = xs.liuyi as typeof diPan[number];
  const tianPan = resolveTianPan({ diPan, hourStem: c.hourStem as Stem, liuyi });
  const jiuXing = resolveJiuXing({ diPan, liuyi, hourStem: c.hourStem as Stem });
  const lod = resolveCenterLodging({ diPan });
  const qin = resolveQinCompanion({ diPan, jiuXing });
  // 1080.pdf: 天禽の天盤干（fixture は tianpan["5"] に転記）と、天禽が置かれた宮
  const pdfQin = Object.keys(c.jiuxing).map(Number).find((p) => p !== 5 && c.jiuxing[String(p)].includes("天禽"));
  check(`${c.title} 地盤寄宮干`, lod.diPan.stem === c.dipan["5"] && lod.diPan.toPalace === 2, JSON.stringify(lod.diPan));
  check(
    `${c.title} 天盤寄宮干・寄宮先`,
    qin !== null && qin.stem === c.tianpan["5"] && qin.palace === pdfQin,
    `${JSON.stringify(qin)} 1080.pdf 禽=${c.tianpan["5"]}@${pdfQin}`,
  );
  // 寄宮干が付く宮はちょうど1宮ずつ・中五宮には付かない
  const dCount = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((p) => lodgedStemsAt(lod, p).diPanLodged).length;
  const tCount = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((p) => qinCompanionAt(qin, p).qinCompanion).length;
  check(`${c.title} 寄宮干の宮数`, dCount === 1 && tCount === 1 && !lodgedStemsAt(lod, 5).diPanLodged && !qinCompanionAt(qin, 5).qinCompanion);
  n1080 += 1;

  // 5) 寄宮対応格局: 1080.pdf の盤から直接求めた成立宮と一致
  const palaces: Record<number, PalaceSummary> = {};
  for (let p = 1; p <= 9; p += 1) {
    palaces[p] = { diPanStem: diPan[p], tianPanStem: tianPan[p], jiuXing: jiuXing.jiuXing[p], baMen: c.bamen[String(p)] ? [c.bamen[String(p)]] : [], baShen: c.bashen[String(p)] ? [c.bashen[String(p)]] : [], ...lodgedStemsAt(lod, p), ...qinCompanionAt(qin, p) } as PalaceSummary;
  }
  const ky = resolveKyokaku({
    palaces, dun: c.dun, yearStem: "", monthStem: "", dayStem: "", hourStem: c.hourStem,
    hourGanzhi: c.hourStem + c.hourBranch, zhifuPalace: jiuXing.zhifu.palace, xunShou: xs.xunShou, liuyi: xs.liuyi as typeof diPan[number],
  });
  // 8) 寄宮対応の吉格: 1080.pdf の盤から講義案の条件で直接求めた成立宮と一致
  const jk = resolveJikaku({
    palaces, liuyi: xs.liuyi as typeof diPan[number], zhishiPalace: c.zhishiPalace,
    xunShou: xs.xunShou, hourGanzhi: c.hourStem + c.hourBranch,
  });
  for (const [name, t, ds, palaceOnly] of JI) {
    const expected = [1, 2, 3, 4, 6, 7, 8, 9].filter((p) => {
      if (palaceOnly !== null && p !== palaceOnly) return false;
      const tian = [{ s: c.tianpan[String(p)], l: false }, ...(p === pdfQin ? [{ s: c.tianpan["5"], l: true }] : [])];
      const di = [{ s: c.dipan[String(p)], l: false }, ...(p === 2 ? [{ s: c.dipan["5"], l: true }] : [])];
      return tian.some((x) => x.s === t && (ds === null || di.some((y) => !(x.l && y.l) && ds.includes(y.s))));
    });
    const got = jk.matches.find((m) => m.name === name)?.palaces ?? [];
    check(`${c.title} ${name}`, JSON.stringify(got) === JSON.stringify(expected), `${JSON.stringify(got)} 1080.pdf盤=${JSON.stringify(expected)}`);
    if (got.length > 0) jiCount[name] += 1;
    const hz0 = c.hourStem + c.hourBranch;
    if (c.dun === "陽遁" && c.ju === 2 && hz0 === "己巳" && name === "乙奇得使") {
      seenEx.add(name);
      check("陽遁2局己巳 坤二宮 乙奇得使（天盤乙×地盤寄宮）", got.includes(2) && tianPan[2] === "乙" && ["己", "辛"].includes(lod.diPan.stem) && !["己", "辛"].includes(diPan[2]));
    }
    if (c.dun === "陽遁" && c.ju === 6 && hz0 === "辛未" && name === "乙奇升殿") {
      seenEx.add(name);
      check("陽遁6局辛未 震三宮 乙奇升殿（天盤寄宮乙）", got.includes(3) && qin?.palace === 3 && qin.stem === "乙" && tianPan[3] !== "乙");
    }
  }
  // 11) 青龍返首・飛鳥跌穴・玉女守門（1080.pdf の盤から直接求める）
  {
    const liuyi = xs.liuyi as string;
    const tianAt = (p: number, roleOnly: boolean) => [{ s: c.tianpan[String(p)], l: false }, ...(!roleOnly && p === pdfQin ? [{ s: c.tianpan["5"], l: true }] : [])];
    const diAt = (p: number) => [{ s: c.dipan[String(p)], l: false }, ...(p === 2 ? [{ s: c.dipan["5"], l: true }] : [])];
    const pairOk = (p: number, roleTian: boolean, f: (t: string, d: string) => boolean) =>
      tianAt(p, roleTian).some((x) => diAt(p).some((y) => !(x.l && y.l) && f(x.s, y.s)));
    const outer = [1, 2, 3, 4, 6, 7, 8, 9];
    const expected: Record<string, number[]> = {
      青龍返首: outer.filter((p) => pairOk(p, true, (t, d) => t === liuyi && d === "丙")),
      飛鳥跌穴: outer.filter((p) => pairOk(p, false, (t, d) => t === "丙" && d === liuyi)),
      玉女守門:
        outer.includes(c.zhishiPalace) && diAt(c.zhishiPalace).some((y) => y.s === "丁") && GYOJO_XUN[xs.xunShou] === c.hourStem + c.hourBranch
          ? [c.zhishiPalace]
          : [],
    };
    for (const name of JI3) {
      const got = jk.matches.find((m) => m.name === name)?.palaces ?? [];
      check(`${c.title} ${name}`, JSON.stringify(got) === JSON.stringify(expected[name]), `${JSON.stringify(got)} 1080.pdf盤=${JSON.stringify(expected[name])}`);
      if (got.length > 0) ji3Count[name] += 1;
    }
    const hz2 = c.hourStem + c.hourBranch;
    const got = (n: string) => jk.matches.find((m) => m.name === n)?.palaces ?? [];
    if (c.dun === "陽遁" && c.ju === 7 && hz2 === "丙寅") {
      seenEx.add("青龍返首");
      check("陽遁7局丙寅 坤二宮 青龍返首（天盤戊×地盤寄宮丙）", got("青龍返首").includes(2) && tianPan[2] === liuyi && diPan[2] !== "丙" && lod.diPan.stem === "丙");
    }
    if (c.dun === "陽遁" && c.ju === 7 && hz2 === "乙丑") {
      seenEx.add("飛鳥跌穴1");
      check("陽遁7局乙丑 兌七宮 飛鳥跌穴（天盤寄宮丙×地盤戊）", got("飛鳥跌穴").includes(7) && qin?.palace === 7 && qin.stem === "丙" && diPan[7] === liuyi);
    }
    if (c.dun === "陽遁" && c.ju === 1 && hz2 === "丙午") {
      seenEx.add("飛鳥跌穴2");
      check("陽遁1局丙午 坤二宮 飛鳥跌穴（天盤丙×地盤寄宮の旬首六儀壬）", got("飛鳥跌穴").includes(2) && tianPan[2] === "丙" && lod.diPan.stem === liuyi && diPan[5] === liuyi);
      // 旬首六儀が中五宮: 天禽が帯同する壬（艮八宮）×地盤丙でも青龍返首にしない
      check("陽遁1局丙午 艮八宮 青龍返首なし（天禽帯同の旬首六儀は役割に使わない）", qin?.palace === 8 && diPan[8] === "丙" && !got("青龍返首").includes(8));
    }
    if (c.dun === "陽遁" && c.ju === 8 && hz2 === "庚午") {
      seenEx.add("玉女守門");
      check("陽遁8局庚午 坤二宮 玉女守門（値使門の宮に地盤寄宮丁）", got("玉女守門").includes(2) && c.zhishiPalace === 2 && diPan[2] !== "丁" && lod.diPan.stem === "丁");
    }
  }
  for (const [name, cond, usesDi] of JI2) {
    const expected = [1, 2, 3, 4, 6, 7, 8, 9].filter((p) => {
      const tian = [{ s: c.tianpan[String(p)], l: false }, ...(p === pdfQin ? [{ s: c.tianpan["5"], l: true }] : [])];
      const di = [{ s: c.dipan[String(p)], l: false }, ...(usesDi && p === 2 ? [{ s: c.dipan["5"], l: true }] : [])];
      return tian.some((x) => di.some((y) => !(x.l && y.l) && cond(x.s, y.s, c.bamen[String(p)] ?? "", c.bashen[String(p)] ?? "", p)));
    });
    const got = jk.matches.find((m) => m.name === name)?.palaces ?? [];
    check(`${c.title} ${name}`, JSON.stringify(got) === JSON.stringify(expected), `${JSON.stringify(got)} 1080.pdf盤=${JSON.stringify(expected)}`);
    if (got.length > 0) ji2Count[name] += 1;
    const hz1 = c.hourStem + c.hourBranch;
    if (c.dun === "陰遁" && c.ju === 3 && hz1 === "丙戌" && name === "天遁") {
      seenEx.add(name);
      check("陰遁3局丙戌 震三宮 天遁（生門・天盤寄宮丙×地盤戊）", got.includes(3) && qin?.palace === 3 && qin.stem === "丙" && tianPan[3] !== "丙" && diPan[3] === "戊" && c.bamen["3"] === "生門");
    }
    if (c.dun === "陰遁" && c.ju === 6 && hz1 === "丙申" && name === "地遁") {
      seenEx.add(name);
      check("陰遁6局丙申 坤二宮 地遁（開門・天盤乙×地盤寄宮己）", got.includes(2) && tianPan[2] === "乙" && diPan[2] !== "己" && lod.diPan.stem === "己" && c.bamen["2"] === "開門");
    }
    if (c.dun === "陰遁" && c.ju === 8 && hz1 === "丙戌" && name === "雲遁") {
      seenEx.add(name);
      check("陰遁8局丙戌 坤二宮 雲遁（生門・天盤乙×地盤寄宮辛）", got.includes(2) && tianPan[2] === "乙" && diPan[2] !== "辛" && lod.diPan.stem === "辛" && c.bamen["2"] === "生門");
    }
    if (c.dun === "陰遁" && c.ju === 4 && hz1 === "辛亥" && name === "虎遁") {
      seenEx.add(name);
      check("陰遁4局辛亥 艮八宮 虎遁（休門・天盤寄宮乙）", got.includes(8) && qin?.palace === 8 && qin.stem === "乙" && tianPan[8] !== "乙" && c.bamen["8"] === "休門");
    }
    if (c.dun === "陰遁" && c.ju === 2 && hz1 === "丙子" && name === "休詐") {
      seenEx.add(name);
      check("陰遁2局丙子 坎一宮 休詐（開門・天盤寄宮丁・六合）", got.includes(1) && qin?.palace === 1 && qin.stem === "丁" && c.bashen["1"] === "六合");
    }
  }
  // 15) 年・月・日・時悖格（1080.pdf の盤から直接求める。年・月・日干は十干すべてで確認）
  {
    const tianBing = (p: number) => [c.tianpan[String(p)], ...(p === pdfQin ? [c.tianpan["5"]] : [])].includes("丙");
    const expectedFor = (stem: string) => [1, 2, 3, 4, 6, 7, 8, 9].filter((p) => tianBing(p) && c.dipan[String(p)] === stem);
    const got = ky.matches.find((m) => m.name === "時悖格")?.palaces ?? [];
    check(`${c.title} 時悖格`, JSON.stringify(got) === JSON.stringify(expectedFor(c.hourStem)), `${JSON.stringify(got)} 1080.pdf盤=${JSON.stringify(expectedFor(c.hourStem))}`);
    if (got.length > 0) kyHaiCount["時悖格"] += 1;
    for (const st of ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]) {
      const k2 = resolveKyokaku({
        palaces, dun: c.dun, yearStem: st, monthStem: st, dayStem: st, hourStem: c.hourStem,
        hourGanzhi: c.hourStem + c.hourBranch, zhifuPalace: jiuXing.zhifu.palace, xunShou: xs.xunShou, liuyi: xs.liuyi as typeof diPan[number],
      });
      for (const name of ["年悖格", "月悖格", "日悖格"] as const) {
        const g = k2.matches.find((m) => m.name === name)?.palaces ?? [];
        check(`${c.title} ${name} 干${st}`, JSON.stringify(g) === JSON.stringify(expectedFor(st)), `${JSON.stringify(g)} 1080.pdf盤=${JSON.stringify(expectedFor(st))}`);
        kyHaiCount[name] += g.length;
      }
    }
    if (c.dun === "陽遁" && c.ju === 7 && c.hourStem + c.hourBranch === "丁未") {
      seenEx.add("時悖格");
      check("凶格例.pdf 190〜191頁 陽遁7局丁未 巽四宮 時悖格（天禽帯同の天盤丙×地盤丁）", JSON.stringify(got) === "[4]" && tianPan[4] !== "丙" && qin?.palace === 4 && qin.stem === "丙" && diPan[4] === "丁"
        && JSON.stringify(ky.matches.find((m) => m.name === "時悖格")?.qinCompanionPalaces) === "[4]");
    }
  }
  // 14) 値符の九星の宮で判定する凶格（1080.pdf の盤から直接求める。凶格例.pdf 192〜194頁）
  //   値符の九星＝地盤の旬首六儀の宮の定位星（六儀が中五宮なら天禽）。その星が 1080.pdf の盤で置かれた宮。
  //   符勃格: その宮の天盤丙（芮禽宮の寄宮干を含む）。飛悖格: その宮の地盤丙（坤二宮の寄宮干を含む）。
  {
    const NATAL_STAR: Record<number, string> = { 1: "天蓬", 2: "天芮", 3: "天沖", 4: "天輔", 5: "天禽", 6: "天心", 7: "天柱", 8: "天任", 9: "天英" };
    const lyPalace = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((p) => c.dipan[String(p)] === xs.liuyi)!;
    const star = NATAL_STAR[lyPalace];
    const zp = [1, 2, 3, 4, 6, 7, 8, 9].find((p) => c.jiuxing[String(p)].includes(star))!;
    check(`${c.title} 値符の九星の宮`, jiuXing.zhifu.palace === zp, `${jiuXing.zhifu.palace} 1080.pdf=${zp}`);
    const tianHas = [c.tianpan[String(zp)], ...(zp === pdfQin ? [c.tianpan["5"]] : [])].includes("丙");
    const diHas = [c.dipan[String(zp)], ...(zp === 2 ? [c.dipan["5"]] : [])].includes("丙");
    const expected: Record<string, number[]> = { 符勃格: tianHas ? [zp] : [], 飛悖格: diHas ? [zp] : [] };
    for (const name of KY_ZHIFU) {
      const got = ky.matches.find((m) => m.name === name)?.palaces ?? [];
      check(`${c.title} ${name}`, JSON.stringify(got) === JSON.stringify(expected[name]), `${JSON.stringify(got)} 1080.pdf盤=${JSON.stringify(expected[name])}`);
      if (got.length > 0) kyZhifuCount[name] += 1;
    }
    const hz = c.hourStem + c.hourBranch;
    const fu = ky.matches.find((m) => m.name === "符勃格")?.palaces ?? [];
    const fei = ky.matches.find((m) => m.name === "飛悖格")?.palaces ?? [];
    if (c.dun === "陰遁" && c.ju === 3 && hz === "丙子") {
      seenEx.add("符勃格");
      check("凶格例.pdf 193頁 陰遁3局丙子 坤二宮 符悖格（値符天芮・天禽帯同の天盤丙）", JSON.stringify(fu) === "[2]" && xs.xunShou === "甲戌" && jiuXing.zhifu.star === "天芮" && tianPan[2] !== "丙" && qin?.palace === 2 && qin.stem === "丙"
        && JSON.stringify(ky.matches.find((m) => m.name === "符勃格")?.qinCompanionPalaces) === "[2]");
    }
    if (c.dun === "陽遁" && c.ju === 1 && hz === "丙午") {
      seenEx.add("飛悖格");
      check("凶格例.pdf 194頁 陽遁1局丙午 艮八宮 飛悖格（値符天禽・天芮同居宮の地盤丙）", JSON.stringify(fei) === "[8]" && xs.xunShou === "甲辰" && jiuXing.zhifu.star === "天禽" && diPan[8] === "丙" && jiuXing.jiuXing[8].includes("天芮"));
    }
  }
  // 13) 旬首六儀を値符の役割に使う凶格（1080.pdf の盤から直接求める）
  //   伏宮格: 天盤庚（芮禽宮の寄宮干を含む）×地盤の旬首六儀（坤二宮の寄宮干を含む）。寄宮干どうしも成立。
  //   飛宮格: 天盤の旬首六儀（通常干のみ）×地盤庚（坤二宮の寄宮干を含む）。
  {
    const ly = xs.liuyi;
    const tianOf = (p: number) => [{ s: c.tianpan[String(p)], l: false }, ...(p === pdfQin ? [{ s: c.tianpan["5"], l: true }] : [])];
    const diOf = (p: number) => [{ s: c.dipan[String(p)], l: false }, ...(p === 2 ? [{ s: c.dipan["5"], l: true }] : [])];
    const expected: Record<string, number[]> = {
      伏宮格天乙格: [1, 2, 3, 4, 6, 7, 8, 9].filter((p) => tianOf(p).some((x) => x.s === "庚") && diOf(p).some((y) => y.s === ly)),
      飛宮格天乙太白: [1, 2, 3, 4, 6, 7, 8, 9].filter((p) => c.tianpan[String(p)] === ly && diOf(p).some((y) => y.s === "庚")),
    };
    const hz = c.hourStem + c.hourBranch;
    const ex = (key: string, label: string, ok: boolean) => { seenEx.add(key); check(label, ok); };
    for (const name of KY_ROLE) {
      const got = ky.matches.find((m) => m.name === name)?.palaces ?? [];
      check(`${c.title} ${name}`, JSON.stringify(got) === JSON.stringify(expected[name]), `${JSON.stringify(got)} 1080.pdf盤=${JSON.stringify(expected[name])}`);
      if (got.length > 0) kyRoleCount[name] += 1;
    }
    const fu = ky.matches.find((m) => m.name === "伏宮格天乙格")?.palaces ?? [];
    const fei = ky.matches.find((m) => m.name === "飛宮格天乙太白")?.palaces ?? [];
    const da = ky.matches.find((m) => m.name === "大格")?.palaces ?? [];
    if (c.dun === "陽遁" && c.ju === 3 && hz === "甲申")
      ex("伏宮格1", "陽遁3局甲申 坤二宮 伏宮格（天盤寄宮庚×地盤寄宮庚＝旬首六儀）", fu.includes(2) && tianPan[2] !== "庚" && diPan[2] !== "庚" && qin?.palace === 2 && qin.stem === "庚" && lod.diPan.stem === "庚");
    if (c.dun === "陽遁" && c.ju === 1 && hz === "戊申")
      ex("伏宮格2", "陽遁1局戊申 坤二宮 伏宮格（天盤庚×地盤寄宮の旬首六儀）", fu.includes(2) && tianPan[2] === "庚" && lod.diPan.stem === ly && diPan[2] !== ly);
    if (c.dun === "陽遁" && c.ju === 3 && hz === "乙丑")
      ex("飛宮格1", "陽遁3局乙丑 坤二宮 飛宮格（天盤の旬首六儀×地盤寄宮庚）", fei.includes(2) && tianPan[2] === ly && lod.diPan.stem === "庚" && diPan[2] !== "庚");
    if (c.dun === "陽遁" && c.ju === 1 && hz === "庚戌")
      ex("飛宮格2", "陽遁1局庚戌 震三宮 飛宮格なし（天禽帯同の旬首六儀には役割を付けない）", !fei.includes(3) && qin?.palace === 3 && qin.stem === ly && diPan[3] === "庚");
    if (c.dun === "陽遁" && c.ju === 3 && hz === "壬申")
      ex("大格1", "陽遁3局壬申 艮八宮 大格（天盤寄宮庚×地盤癸）", da.includes(8) && qin?.palace === 8 && qin.stem === "庚" && diPan[8] === "癸");
    if (c.dun === "陽遁" && c.ju === 9 && hz === "甲子")
      ex("大格2", "陽遁9局甲子 坤二宮 大格（天盤庚×地盤寄宮癸）", da.includes(2) && tianPan[2] === "庚" && lod.diPan.stem === "癸" && diPan[2] !== "癸");
  }
  // 12) 天盤干と宮だけで成立する凶格（1080.pdf の盤から直接求める。地盤寄宮干は使わない）
  for (const [name, f] of KY_TIAN) {
    const expected = [1, 2, 3, 4, 6, 7, 8, 9].filter((p) =>
      [c.tianpan[String(p)], ...(p === pdfQin ? [c.tianpan["5"]] : [])].some((t) => f(t, p)),
    );
    const m = ky.matches.find((x) => x.name === name);
    const got = m?.palaces ?? [];
    check(`${c.title} ${name}`, JSON.stringify(got) === JSON.stringify(expected), `${JSON.stringify(got)} 1080.pdf盤=${JSON.stringify(expected)}`);
    if (got.length > 0) kyTianCount[name] += 1;
    const ex = (key: string, label: string, ok: boolean) => { seenEx.add(key); check(label, ok); };
    const hz = c.hourStem + c.hourBranch;
    if (c.dun === "陽遁" && c.ju === 1 && hz === "丁卯" && name === "六儀撃刑")
      ex("六儀撃刑", "陽遁1局丁卯 巽四宮 壬儀撃刑（天盤己＋寄宮壬）", got.includes(4) && tianPan[4] === "己" && qin?.palace === 4 && qin.stem === "壬" && m?.detail === "壬儀撃刑");
    if (c.dun === "陽遁" && c.ju === 6 && hz === "甲子" && name === "乙奇入墓")
      ex("乙奇入墓1", "陽遁6局甲子 坤二宮 乙奇入墓（天盤癸＋寄宮乙）", got.includes(2) && tianPan[2] === "癸" && qin?.palace === 2 && qin.stem === "乙");
    if (c.dun === "陽遁" && c.ju === 6 && hz === "庚午" && name === "乙奇入墓")
      ex("乙奇入墓2", "陽遁6局庚午 乾六宮 乙奇入墓（天盤癸＋寄宮乙）", got.includes(6) && tianPan[6] === "癸" && qin?.palace === 6 && qin.stem === "乙");
    if (c.dun === "陽遁" && c.ju === 7 && hz === "辛未" && name === "丙奇入墓")
      ex("丙奇入墓", "陽遁7局辛未 乾六宮 丙奇入墓（天盤壬＋寄宮丙）", got.includes(6) && tianPan[6] === "壬" && qin?.palace === 6 && qin.stem === "丙");
    if (c.dun === "陽遁" && c.ju === 8 && hz === "丁卯" && name === "丁奇入墓")
      ex("丁奇入墓", "陽遁8局丁卯 艮八宮 丁奇入墓（天盤辛＋寄宮丁）", got.includes(8) && tianPan[8] === "辛" && qin?.palace === 8 && qin.stem === "丁");
  }
  for (const [name, t, d] of SIX) {
    const expected = [1, 2, 3, 4, 6, 7, 8, 9].filter((p) => {
      const tian = [{ s: c.tianpan[String(p)], l: false }, ...(p === pdfQin ? [{ s: c.tianpan["5"], l: true }] : [])];
      const di = [{ s: c.dipan[String(p)], l: false }, ...(p === 2 ? [{ s: c.dipan["5"], l: true }] : [])];
      return tian.some((x) => di.some((y) => !(x.l && y.l) && x.s === t && (typeof d === "string" ? y.s === d : d.includes(y.s))));
    });
    const got = ky.matches.find((m) => m.name === name)?.palaces ?? [];
    check(`${c.title} ${name}`, JSON.stringify(got) === JSON.stringify(expected), `${JSON.stringify(got)} 1080.pdf盤=${JSON.stringify(expected)}`);
    if (got.length > 0) sixCount[name] += 1;
    // 戦格: 寄宮で新しい成立宮ができない（通常干だけで求めた宮と同じ）
    if (name === "戦格") {
      const native = [1, 2, 3, 4, 6, 7, 8, 9].filter((p) => c.tianpan[String(p)] === "庚" && c.dipan[String(p)] === "庚");
      check(`${c.title} 戦格は通常干のみの成立宮と同じ`, JSON.stringify(got) === JSON.stringify(native), JSON.stringify(got));
    }
    const ex = (key: string, label: string, ok: boolean) => { seenEx.add(key); check(label, ok); };
    const hz = c.hourStem + c.hourBranch;
    if (c.dun === "陽遁" && c.ju === 1 && hz === "辛未" && name === "上格") ex("上格1", "陽遁1局辛未 坤二宮 上格（天盤庚×地盤寄宮壬）", got.includes(2) && tianPan[2] === "庚" && lod.diPan.stem === "壬");
    if (c.dun === "陽遁" && c.ju === 3 && hz === "己巳" && name === "上格") ex("上格2", "陽遁3局己巳 兌七宮 上格（天盤寄宮庚×地盤壬）", got.includes(7) && qin?.palace === 7 && qin.stem === "庚" && diPan[7] === "壬");
    if (c.dun === "陽遁" && c.ju === 3 && hz === "甲子" && name === "奇格") ex("奇格1", "陽遁3局甲子 坤二宮 奇格（天盤寄宮庚×地盤乙）", got.includes(2) && qin?.palace === 2 && qin.stem === "庚" && diPan[2] === "乙");
    if (c.dun === "陽遁" && c.ju === 6 && hz === "丙寅" && name === "奇格") ex("奇格2", "陽遁6局丙寅 坤二宮 奇格（天盤庚×地盤寄宮）", got.includes(2) && tianPan[2] === "庚" && ["乙", "丙", "丁"].includes(lod.diPan.stem));
    if (c.title === "陽遁三局甲己日辛未時" && name === "熒入太白") {
      seenEx.add(name);
      check("陽遁3局辛未 坤二宮 熒入太白（天盤丙×地盤寄宮庚）", got.includes(2) && tianPan[2] === "丙" && diPan[2] === "乙" && lod.diPan.stem === "庚");
    }
    if (c.dun === "陽遁" && c.ju === 3 && c.hourStem + c.hourBranch === "丙寅" && name === "刑格") {
      seenEx.add("刑格1");
      check("陽遁3局丙寅 巽四宮 刑格（天盤寄宮庚×地盤己）", got.includes(4) && qin?.palace === 4 && qin.stem === "庚" && diPan[4] === "己");
    }
    if (c.dun === "陽遁" && c.ju === 4 && c.hourStem + c.hourBranch === "壬申" && name === "刑格") {
      seenEx.add("刑格2");
      check("陽遁4局壬申 坤二宮 刑格（天盤庚×地盤寄宮己）", got.includes(2) && tianPan[2] === "庚" && lod.diPan.stem === "己");
    }
    if (c.title === "陽遁三局甲己日乙丑時" && name === "太白入熒") {
      seenEx.add(name);
      check("陽遁3局乙丑 坎一宮 太白入熒（天盤寄宮庚×地盤丙）", got.includes(1) && qin?.palace === 1 && qin.stem === "庚" && diPan[1] === "丙");
    }
  }
}
check("1080局すべてを照合", n1080 === 1080, String(n1080));
check(
  "寄宮対応吉格（青龍返首・飛鳥跌穴・玉女守門）の成立局数",
  JSON.stringify(ji3Count) === JSON.stringify({ 青龍返首: 120, 飛鳥跌穴: 130, 玉女守門: 108 }),
  JSON.stringify(ji3Count),
);
check(
  "寄宮対応吉格（五遁・三詐）の成立局数",
  JSON.stringify(ji2Count) === JSON.stringify({ 天遁: 28, 地遁: 19, 人遁: 12, 神遁: 20, 鬼遁: 46, 真詐: 167, 重詐: 148, 休詐: 154, 風遁: 36, 雲遁: 56, 龍遁: 100, 虎遁: 42, 天假: 59, 地假: 148, 人假: 11, 神假: 87, 鬼假: 53 }),
  JSON.stringify(ji2Count),
);
check(
  "寄宮対応吉格の成立局数",
  JSON.stringify(jiCount) === JSON.stringify({ 乙奇得使: 238, 丙奇得使: 239, 丁奇得使: 232, 乙奇升殿: 135, 丙奇升殿: 136, 丁奇升殿: 135 }),
  JSON.stringify(jiCount),
);
check("寄宮対応格局の具体例を検証", seenEx.size === 33, String(seenEx.size));
check(
  "寄宮対応凶格（悖格）の成立数（時悖格は局数、年・月・日悖格は1080局×十干の宮数）",
  JSON.stringify(kyHaiCount) === JSON.stringify({ 年悖格: 1080, 月悖格: 1080, 日悖格: 1080, 時悖格: 32 }),
  JSON.stringify(kyHaiCount),
);
check(
  "寄宮対応凶格（符勃格・飛悖格）の成立局数",
  JSON.stringify(kyZhifuCount) === JSON.stringify({ 符勃格: 40, 飛悖格: 136 }),
  JSON.stringify(kyZhifuCount),
);
check(
  "寄宮対応凶格（伏宮格・飛宮格）の成立局数",
  JSON.stringify(kyRoleCount) === JSON.stringify({ 伏宮格天乙格: 142, 飛宮格天乙太白: 134 }),
  JSON.stringify(kyRoleCount),
);
check(
  "寄宮対応凶格（入墓・受刑・撃刑）の成立局数",
  JSON.stringify(kyTianCount) === JSON.stringify({ 乙奇入墓: 270, 丙奇入墓: 136, 丁奇入墓: 136, 三奇受刑: 469, 六儀撃刑: 572 }),
  JSON.stringify(kyTianCount),
);
check(
  "寄宮対応格局の成立局数",
  JSON.stringify(sixCount) === JSON.stringify({ 青龍逃走: 120, 白虎猖狂: 122, 朱雀投江: 114, 騰蛇夭矯: 124, 熒入太白: 120, 太白入熒: 120, 刑格: 124, 上格: 119, 奇格: 374, 戦格: 213, 大格: 134 }),
  JSON.stringify(sixCount),
);

// ---- 2) 講義案 p.22 例1・p.23 例2 ----------------------------------------------
function lectureBoard(dun: "陽遁" | "陰遁", ju: number, hs: Stem, hb: Branch) {
  const diPan = resolveDiPan({ dun, ju });
  const liuyi = resolveXunShou({ hourStem: hs, hourBranch: hb }).liuyi as typeof diPan[number];
  const tianPan = resolveTianPan({ diPan, hourStem: hs, liuyi });
  const jiuXing = resolveJiuXing({ diPan, liuyi, hourStem: hs });
  return { diPan, tianPan, lod: resolveCenterLodging({ diPan }) };
}
{
  // 例1 己巳 陰五局 旬首戊: 坤二宮の地盤「辛(戊)」・時干の巽四宮に天盤「辛」
  const b = lectureBoard("陰遁", 5, "己", "巳");
  check("p.22 例1 坤二宮の地盤 辛(戊)", b.diPan[2] === "辛" && lodgedStemsAt(b.lod, 2).diPanLodged?.stem === "戊");
  check("p.22 例1 巽四宮の天盤 辛（通常干は上書きしない）", b.tianPan[4] === "辛");
  check("p.22 例1 中五宮の地盤 戊・天盤の中宮に干なし", b.diPan[5] === "戊" && b.tianPan[5] === undefined);
  // 例2 辛巳 陰八局 旬首己: 時干中宮のため坤二宮に六儀己（天盤）
  const b2 = lectureBoard("陰遁", 8, "辛", "巳");
  check("p.23 例2 坤二宮の天盤 己", b2.tianPan[2] === "己" && b2.diPan[2] === "丁");
  check("p.23 例2 中五宮の元データ 辛", b2.diPan[5] === "辛" && lodgedStemsAt(b2.lod, 2).diPanLodged?.stem === "辛");
}

// ---- 3) calculate() の全時刻 ----------------------------------------------------
function stripLodging(r: QimenResult): QimenResult {
  const palaces: Record<number, PalaceSummary> = {};
  for (let p = 1; p <= 9; p += 1) {
    const { diPanLodged: _d, qinCompanion: _q, ...rest } = r.palaces[p];
    palaces[p] = rest;
  }
  return { ...r, palaces };
}
const boards = new Set<string>();
let slots = 0;
let seenBing = false;
let seenWuzi = false;
for (let t = Date.UTC(2026, 3, 1); t <= Date.UTC(2026, 8, 30); t += 86400000) {
  const d = new Date(t);
  for (let h = 0; h < 24; h += 1) {
    const r = calculate({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: h, minute: 0, timezone: "Asia/Tokyo" });
    const key = `${r.dingju.dun}${r.dingju.ju}局${r.calendar.hourStem}${r.calendar.hourBranch}`;
    const label = `${d.toISOString().slice(0, 10)} ${h}:00 ${key}`;
    boards.add(key);
    slots += 1;
    // 既存の干を上書きしない
    for (let p = 1; p <= 9; p += 1) {
      check(`${label} 宮${p} 地盤干不変`, r.palaces[p].diPanStem === r.diPan[p]);
      check(`${label} 宮${p} 天盤干不変`, r.palaces[p].tianPanStem === r.tianPan?.[p]);
    }
    // 寄宮項目は該当する宮にだけ
    const dP = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((p) => r.palaces[p].diPanLodged);
    const tP = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((p) => r.palaces[p].qinCompanion);
    const qin = [1, 2, 3, 4, 6, 7, 8, 9].find((p) => r.palaces[p].jiuXing.includes("天禽"));
    check(`${label} 地盤寄宮は坤二宮だけ`, dP.length === 1 && dP[0] === 2 && r.palaces[2].diPanLodged?.stem === r.diPan[5]);
    check(`${label} 天禽帯同干は芮禽宮だけ（値＝中五宮の地盤干・格局判定専用）`, tP.length === 1 && tP[0] === qin && r.palaces[qin!].qinCompanion?.stem === r.diPan[5]
      && r.palaces[qin!].qinCompanion?.use === "格局判定専用" && r.qinCompanion?.palace === qin);
    check(`${label} 天盤に寄宮干・中宮干なし`, [1, 2, 3, 4, 5, 6, 7, 8, 9].every((p) => !("tianPanLodged" in r.palaces[p])) && r.tianPan?.[5] === undefined && r.palaces[5].tianPanStem === undefined);
    check(`${label} centerLodging`, r.centerLodging.diPan.toPalace === 2 && !("tianPan" in r.centerLodging));
    // 天禽帯同干だけで成立した宮は qinCompanionPalaces に入り、通常干で成立する宮は入らない
    for (const m of [...r.jikaku.matches, ...r.kyokaku.matches]) {
      for (const p of m.qinCompanionPalaces ?? []) check(`${label} ${m.name} 宮${p} 天禽帯同干による成立`, p === qin && m.palaces.includes(p));
    }
    // 寄宮項目を参照するのは凶格の寄宮対応格局だけ（取り除いて再判定すると、他は同じ・寄宮対応格局は部分集合）
    const s = stripLodging(r);
    const sj = resolveJikakuFromQimen(s);
    const jiOthers = (j: typeof sj) => JSON.stringify(j.matches.filter((m) => !JI_NAMES.has(m.name)));
    check(`${label} 吉格（寄宮対応吉格以外）不変`, jiOthers(sj) === jiOthers(r.jikaku) && JSON.stringify(sj.unavailable) === JSON.stringify(r.jikaku.unavailable));
    for (const m of sj.matches.filter((m) => JI_NAMES.has(m.name))) {
      const full = r.jikaku.matches.find((x) => x.name === m.name)?.palaces ?? [];
      check(`${label} ${m.name} 通常干の成立宮を含む`, m.palaces.every((p) => full.includes(p)));
    }
    for (const m of r.jikaku.matches) check(`${label} ${m.name} 中五宮なし`, !m.palaces.includes(5));
    const sk = resolveKyokakuFromQimen(s);
    const others = (k: typeof sk) => JSON.stringify(k.matches.filter((m) => !SIX_NAMES.has(m.name)));
    check(`${label} 凶格（寄宮対応格局以外）不変`, others(sk) === others(r.kyokaku) && JSON.stringify(sk.unavailable) === JSON.stringify(r.kyokaku.unavailable));
    for (const m of sk.matches.filter((m) => SIX_NAMES.has(m.name))) {
      const full = r.kyokaku.matches.find((x) => x.name === m.name)?.palaces ?? [];
      check(`${label} ${m.name} 通常干の成立宮を含む`, m.palaces.every((p) => full.includes(p)));
    }
    for (const m of r.kyokaku.matches) check(`${label} ${m.name} 中五宮なし`, !m.palaces.includes(5));
    // 検証盤
    if (key === "陽遁3局丙戌") {
      seenBing = true;
      check(`${label} 坎一宮 天盤 乙＋天禽帯同干 庚（判定専用）`, r.palaces[1].tianPanStem === "乙" && r.palaces[1].qinCompanion?.stem === "庚"
        && r.palaces[1].jiuXing.includes("天芮") && r.palaces[1].jiuXing.includes("天禽"));
      // 1080.pdf の「太白入熒」（禽の庚×地盤丙）が天禽帯同干による成立として識別される
      check(`${label} 坎一宮 太白入熒は天禽帯同干による成立`, JSON.stringify(r.kyokaku.matches.find((m) => m.name === "太白入熒")?.qinCompanionPalaces) === "[1]");
    }
    if (key === "陽遁3局戊子") {
      seenWuzi = true;
      check(`${label} 坤二宮 地盤 乙＋寄宮 庚`, r.palaces[2].diPanStem === "乙" && r.palaces[2].diPanLodged?.stem === "庚");
    }
  }
}
check("全時刻 4392盤", slots === 4392, String(slots));
check("全1080局を含む", boards.size === 1080, String(boards.size));
check("陽遁3局丙戌を検証", seenBing);
check("陽遁3局戊子を検証", seenWuzi);

// ---- 4) 参照関数（人工の宮で確認）------------------------------------------------
const P = (o: Partial<PalaceSummary>): PalaceSummary => ({ jiuXing: [], baMen: [], baShen: [], ...o });
const lodgedBoth = P({
  diPanStem: "乙",
  tianPanStem: "乙",
  diPanLodged: { stem: "庚", fromPalace: 5, kind: "地盤中五寄坤" },
  qinCompanion: { stem: "庚", fromPalace: 5, palace: 2, use: "格局判定専用" },
});
const stems = (xs: { stem: string; origin: string }[]) => xs.map((x) => `${x.stem}:${x.origin}`).join(",");
// 既定値＝現在の動作
check("CURRENT_POLICY の値", JSON.stringify(CURRENT_POLICY) === JSON.stringify({ tianPan: "native", diPan: "native", centerPalace: "judge", lodgedSelfPair: "deny", roleUsesLodged: false }));
check("makeStemPolicy() は既定値", JSON.stringify(makeStemPolicy()) === JSON.stringify(CURRENT_POLICY));
check("既定: 天盤は通常干のみ", stems(tianPanStems(lodgedBoth)) === "乙:native");
check("既定: 地盤は通常干のみ", stems(diPanStems(lodgedBoth)) === "乙:native");
check("既定: 中五宮も判定", judgedPalaces().join() === "1,2,3,4,5,6,7,8,9");
// 通常干と寄宮干の区別
const withL = makeStemPolicy({ tianPan: "withQinCompanion", diPan: "withLodged" });
check("天禽帯同干込み: 天盤", stems(tianPanStems(lodgedBoth, withL)) === "乙:native,庚:qinCompanion");
check("寄宮込み: 地盤", stems(diPanStems(lodgedBoth, withL)) === "乙:native,庚:lodged");
check("寄宮干の無い宮", stems(tianPanStems(P({ tianPanStem: "丙", diPanStem: "丁" }), withL)) === "丙:native");
check("未定義の宮", tianPanStems(undefined, withL).length === 0);
// 中五宮の除外
check("中五宮を判定しない", judgedPalaces(makeStemPolicy({ centerPalace: "skip" })).join() === "1,2,3,4,6,7,8,9");
const pal: Record<number, PalaceSummary> = {};
for (let p = 1; p <= 9; p += 1) pal[p] = P({ tianPanStem: "庚", diPanStem: p === 5 ? "庚" : "乙" });
check("scanPalaces 既定は中五宮を含む", scanPalaces(pal, (p) => p?.tianPanStem === "庚" && p.diPanStem === "庚").join() === "5");
check("scanPalaces skip は中五宮を除く", scanPalaces(pal, (p) => p?.tianPanStem === "庚" && p.diPanStem === "庚", makeStemPolicy({ centerPalace: "skip" })).length === 0);
// 自己組み合わせ（天禽帯同干×地盤寄宮干）
const gengGeng = (t: string, d: string) => t === "庚" && d === "庚";
check("自己組み合わせ deny で除外", stemPairs(lodgedBoth, gengGeng, withL).length === 0);
check("自己組み合わせ allow で成立", stemPairs(lodgedBoth, gengGeng, makeStemPolicy({ tianPan: "withQinCompanion", diPan: "withLodged", lodgedSelfPair: "allow" })).length === 1);
const pairs = stemPairs(lodgedBoth, (t, d) => t === "庚" && d === "乙", withL);
check("天禽帯同干×通常干は成立し由来が残る", pairs.length === 1 && pairs[0].tian.origin === "qinCompanion" && pairs[0].di.origin === "native");
check("既定方針では寄宮干の組み合わせなし", stemPairs(lodgedBoth, (t, d) => t === "庚" && d === "乙").length === 0);
check("BASIC_PAIR_POLICY の値", JSON.stringify(BASIC_PAIR_POLICY) === JSON.stringify({ tianPan: "withQinCompanion", diPan: "withLodged", centerPalace: "skip", lodgedSelfPair: "deny", roleUsesLodged: false }));
check("XUNSHOU_ROLE_POLICY の値", JSON.stringify(XUNSHOU_ROLE_POLICY) === JSON.stringify({ tianPan: "withQinCompanion", diPan: "withLodged", centerPalace: "skip", lodgedSelfPair: "deny", roleUsesLodged: { tianPan: false, diPan: true } }));
check("役割: 層別指定で天盤は通常干のみ", stems(roleStems(lodgedBoth, "tianPan", XUNSHOU_ROLE_POLICY)) === "乙:native");
check("役割: 層別指定で地盤は寄宮干も", stems(roleStems(lodgedBoth, "diPan", XUNSHOU_ROLE_POLICY)) === "乙:native,庚:lodged");
check("BASIC_PAIR_POLICY は自己組み合わせを除く", stemPairs(lodgedBoth, gengGeng, BASIC_PAIR_POLICY).length === 0);
// 役割（値符・旬首六儀）
check("役割: roleUsesLodged=false は通常干のみ", stems(roleStems(lodgedBoth, "tianPan", withL)) === "乙:native");
check("役割: roleUsesLodged=true は天禽帯同干も", stems(roleStems(lodgedBoth, "tianPan", makeStemPolicy({ tianPan: "withQinCompanion", roleUsesLodged: true }))) === "乙:native,庚:qinCompanion");
check("役割: 層の方針が native なら寄宮干は使わない", stems(roleStems(lodgedBoth, "diPan", makeStemPolicy({ roleUsesLodged: true }))) === "乙:native");

// ---- 5) 天禽帯同干を表示・剋應に使わない（ソース走査）--------------------------------
{
  const root = join(here, "..");
  const files = [
    "src/app/qimen/page.tsx", "src/app/qimen/search/CandidateViews.tsx", "src/lib/qimenSearch/candidateInfo.ts",
    "src/lib/qimen/kokuo/index.ts", "src/lib/qimenMaterials/palaceMaterials.ts", "src/lib/qimenAiMaterials/serialize.ts",
  ];
  for (const f of files) check(`${f} は天禽帯同干を参照しない`, !readFileSync(join(root, f), "utf8").includes("qinCompanion"));
  check("盤面・検索候補に天盤の括弧表示（天盤寄宮）なし", !readFileSync(join(root, "src/app/qimen/page.tsx"), "utf8").includes("tianPanLodged")
    && !readFileSync(join(root, "src/lib/qimenSearch/candidateInfo.ts"), "utf8").includes("tianPanLodged"));
}

if (failed > 0) {
  console.log(`\n${failed} 件 FAIL`);
  process.exit(1);
}
console.log(`PASS 1080局照合=${n1080} 全時刻=${slots}盤（${boards.size}局） 講義案 p.22・p.23 参照関数 寄宮対応格局=${JSON.stringify(sixCount)} 寄宮対応凶格(天盤)=${JSON.stringify(kyTianCount)} 寄宮対応凶格(旬首六儀)=${JSON.stringify(kyRoleCount)} 寄宮対応凶格(値符の九星)=${JSON.stringify(kyZhifuCount)} 寄宮対応凶格(悖格)=${JSON.stringify(kyHaiCount)} 寄宮対応吉格=${JSON.stringify(jiCount)} ${JSON.stringify(ji2Count)} ${JSON.stringify(ji3Count)}`);
process.exit(0);
