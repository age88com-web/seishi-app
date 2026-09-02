// src/lib/qimen/bashen.ts
//
// 役割:
//   奇門遁甲「八神」(神盤) — 地盤・時干支から、直符(値符)を割り出し、
//   九宮それぞれに八神（直符・騰蛇・太陰・六合・勾陳・朱雀・九地・九天）を
//   配置すること。格局判定は行わない。
//
// 仕様の出典:
//   元Keynote「奇門遁甲講義案N.key」のスライド「神盤の配置」
//   （Index/Slide-2879）・「神盤配置の実際」（Index/Slide-2928）の本文を
//   直接デコードして確認した。docs/qimen-spec/09_八神.md は補助資料とし、
//   この2スライドの本文を最優先の仕様とする。
//   それ以外の理論は追加しない。1080局からの逆算は行わない。
//
// 「神盤の配置」スライド本文（該当部分）:
//   神盤は陽遁と陰遁の配列がある。陽遁時は順行し、陰遁時は逆行するのである。
//   陽遁となる八神の原始位置は、直符が坎一宮となり以下の順で活盤する。
//   ①直符→②騰蛇→③太陰→④六合→⑤勾陳→⑥朱雀→⑦九地→⑧九天
//   陰遁となる八神の原始位置は、直符が離九宮となり、逆行で活盤する。
//
// 「神盤配置の実際」スライド本文（該当部分、2012年3月6日卯刻・上元丙寅日・
// 辛卯時・陽一局の例）:
//   直符の位置を割り出す。用事の時干と同じ地盤干の宮に値符を置く。
//   直符を基準に陽遁は時計回り、陰遁は反時計回りに八神を配置する。
//   陽一局なので、巽四宮から時計回りに活盤させる。
//   ※時干地盤宮が値符が中宮となるとき、値符を坤に奇宮して活盤する。
//
// 時干＝甲（遁甲）の扱い（2026-09-02 追加）:
//   地盤に甲は無い。時干が甲のときは甲は旬首の六儀(liuyi)の宮に隠遁しているので、
//   「時干の宮」＝ liuyi の宮とする。そのため入力に liuyi を追加した。
//   六儀が中宮のときは既存の中宮例外どおり坤宮(2)へ奇宮する。
//   docs/source/1080.pdf の甲時108件で確認済み（1080.pdf は検証にのみ使用）。
//
// 配置規則:
//   ・直符 = 地盤上で時干が置かれた宮（時干＝甲なら liuyi の宮。
//     中宮のときは例外で坤宮(2)に奇宮）。
//   ・洛書九宮の外周8宮を時計回りにたどる環
//     [巽4→離9→坤2→兌7→乾6→坎1→艮8→震3→(巽4)] 上で、直符の宮を起点に、
//     陽遁は時計回り(+1)・陰遁は反時計回り(-1)で
//     直符→騰蛇→太陰→六合→勾陳→朱雀→九地→九天 の順に1宮ずつ配置する。
//     中宮(5)は常に無位。
//   ・「九星の配置」の「それを基準に他の九星を時計回りに配置する」と
//     全く同じ言い回しであり、九星（講義資料26ページ・27ページの実例で
//     この環による回転が確認済み）と同一の環・同一の意味で用いられている
//     と判断し、同じ環を用いた。

import type { DiPanResult, DiPanStem } from "./dipan";
import type { Dun } from "./dingju";
import type { Stem } from "../eto";

export type BaShenName =
  | "直符"
  | "騰蛇"
  | "太陰"
  | "六合"
  | "勾陳"
  | "朱雀"
  | "九地"
  | "九天";

/** 直符→騰蛇→太陰→六合→勾陳→朱雀→九地→九天 の固定順。 */
const SEQUENCE: readonly BaShenName[] = [
  "直符",
  "騰蛇",
  "太陰",
  "六合",
  "勾陳",
  "朱雀",
  "九地",
  "九天",
];

/** 洛書九宮の外周8宮を時計回りにたどった順（中宮5は環に含まれない）。 */
const RING: readonly number[] = [4, 9, 2, 7, 6, 1, 8, 3];

export interface BaShenInput {
  diPan: DiPanResult;
  dun: Dun;
  hourStem: Stem;
  /**
   * 旬首の六儀(liuyi)。時干＝甲（遁甲）のときに、甲が隠遁している宮を特定するために使う。
   * xunshou.ts の resolveXunShou().liuyi をそのまま渡す。
   * 時干が甲以外なら未参照。
   */
  liuyi: DiPanStem;
}

export interface ZhiFuBaShenResult {
  god: "直符";
  palace: number;
}

export interface BaShenResult {
  zhifu: ZhiFuBaShenResult;
  /** 九宮(1〜9)→そこに配置される八神（通常1件、中宮は常に空配列）。 */
  baShen: Record<number, BaShenName[]>;
}

function findPalace(diPan: DiPanResult, stem: string): number | undefined {
  for (let palace = 1; palace <= 9; palace += 1) {
    if (diPan[palace] === stem) return palace;
  }
  return undefined;
}

function mod8(n: number): number {
  return ((n % 8) + 8) % 8;
}

function ringIndexOf(palace: number): number {
  const idx = RING.indexOf(palace);
  if (idx === -1) {
    throw new Error(`宮${palace}は洛書九宮の外周環に含まれません（中宮など）`);
  }
  return idx;
}

/**
 * 八神(神盤): 地盤・時干支から直符(値符)と八神の配置を求める。
 * 格局判定は行わない。
 */
export function resolveBaShen(input: BaShenInput): BaShenResult {
  const { diPan, dun, hourStem, liuyi } = input;

  let hourStemPalace = findPalace(diPan, hourStem);
  if (hourStemPalace === undefined) {
    if (hourStem === "甲") {
      // 遁甲: 時干が甲のとき、甲は旬首の六儀(liuyi)の宮に隠遁している。
      // 「用事の時と同じ地盤宮に値符を置く」の「時干の宮」＝ liuyi の宮。
      // docs/source/1080.pdf の甲時108件で確認済み。
      hourStemPalace = findPalace(diPan, liuyi);
    }
    if (hourStemPalace === undefined) {
      throw new Error(`地盤に時干が見つかりません: ${hourStem}`);
    }
  }

  // ※時干地盤宮が中宮となるとき、値符を坤に奇宮する。
  // （時干＝甲 かつ 六儀が中宮のときもここで坤2へ奇宮される。1080.pdf で確認済み。）
  const zhifuPalace = hourStemPalace === 5 ? 2 : hourStemPalace;

  const direction = dun === "陽遁" ? 1 : dun === "陰遁" ? -1 : null;
  if (direction === null) {
    throw new Error(`未知の遁です: ${dun}`);
  }

  const startRingIndex = ringIndexOf(zhifuPalace);

  const baShen: Record<number, BaShenName[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] };
  for (let i = 0; i < SEQUENCE.length; i += 1) {
    const ringIndex = mod8(startRingIndex + direction * i);
    const palace = RING[ringIndex];
    baShen[palace].push(SEQUENCE[i]);
  }

  return {
    zhifu: { god: "直符", palace: zhifuPalace },
    baShen,
  };
}
