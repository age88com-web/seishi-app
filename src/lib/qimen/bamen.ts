// src/lib/qimen/bamen.ts
//
// 役割:
//   奇門遁甲「八門」(人盤) — 地盤・旬首・時干支から、値使を割り出し、
//   九宮それぞれに八門（休門・生門・傷門・杜門・景門・死門・驚門・開門）を
//   配置すること。九星・八神・格局判定は行わない。
//
// 仕様の出典:
//   docs/source/奇門遁甲講義案N.pdf（＝元Keynote）の「人盤（八門）の配置」(p.27)・
//   「八門の配置」(p.28)・「八門の例外」(p.29)・「八門の例外２」(p.30)、
//   および「九星の配置」(p.23) の中宮寄宮の記述のみを根拠とする。
//   docs/qimen-spec/08_八門.md より本PDFを優先する。
//   それ以外の理論は追加しない。1080局データ(docs/source/1080.pdf)は
//   検証にのみ使用し、アルゴリズムの逆算には使わない。
//
// 配置規則の導出（28〜29ページの実例、上元丙寅日・辛卯時・陽一局から再構成。
// 実例の結果図と完全一致することを確認済み）:
//   ①②地盤上でliuyiが置かれた宮(P_liuyi)を求め、その宮の定位八門が値使となる。
//   ③旬首の干支から、用事の時刻（時干支）まで、六十干支の順を１から数える
//     （旬首自身を1とする）。
//   ④値使の宮(P_liuyi)から、陽遁は順行(+1)・陰遁は逆行(-1)で、
//     ③で求めた数から1引いた歩数だけ洛書数を進めた宮が、値使の実際の位置となる。
//   ⑤値使が実際の位置へ移動したのと同じ向き・同じ歩数だけ、
//     洛書九宮の外周8宮を時計回りにたどる環
//     [巽4→離9→坤2→兌7→乾6→坎1→艮8→震3→(巽4)] 上で、
//     残り7門も定位から一斉に移動する（中宮5は常に無位）。
//
// 例外（p.29 / p.30 の本文。八門側には結果図が無いため、p.28 の具体例の
// 言い回しと、九星・八神で明記された奇宮原則の範囲でのみ実装する）:
//   ・例外1（六儀＝liuyiの宮が中宮になる場合、p.29）:
//     「坤に中宮の地盤干を寄せる（奇宮）」。中宮は無位（定位八門が無い）ため、
//       - 値使門の名称 ＝ 奇宮先 坤宮(2) の定位八門（死門）
//       - ⑤の他門の回転基準(delta) ＝ 坤宮(2) を基準
//     とする。一方、④の「値使の位置を数える起点」は、p.28 の具体例
//     「甲申の六儀庚は震三宮にある。飛宮し進む」に従い、六儀の実際の洛書位置
//     （中宮＝5）のままとする（奇宮は名称・回転基準にのみ効かせる）。
//     ※この counting 起点の扱いは八門側に結果図が無く、上記具体例の言い回しに
//       基づく解釈。1080.pdf の当該75件で一致することを事後確認した。
//   ・例外2（時干が中宮になる場合、p.30）:
//     本文の処置は天盤側（時干の代用として六儀を坤に置き回転）であり、八門の
//     算出式（②③④⑤）は「時干の宮」そのものを数値として使わないため、
//     八門の計算には影響しない（存在チェックのみ）。
//   ・時干＝甲（遁甲、2026-09-02 実装）:
//     甲は地盤に無く、旬首の六儀に隠遁している。八門は「時干の宮」を使わず、
//     用事の時干支＝旬首（count=1）として通常どおり進める。1080.pdf の甲時
//     108件で確認済み。
//   ・値使が中宮(5)に落ちる場合:
//     九星（p.23「中宮の天禽は坤に寄宮」）・八神（「値符を坤に奇宮」）と同一の
//     奇宮原則で、値使を坤宮(2)へ寄せてから配盤する。
//     （中宮は環に含まれず delta を計算できないため。）

import type { DiPanResult, DiPanStem } from "./dipan";
import type { Dun } from "./dingju";
import { STEMS, BRANCHES } from "../eto";
import type { Stem, Branch } from "../eto";

export type BaMenName =
  | "休門"
  | "生門"
  | "傷門"
  | "杜門"
  | "景門"
  | "死門"
  | "驚門"
  | "開門";

/** 八門の定位（洛書後天数の宮に対する固定の対応）。中宮(5)は無位。 */
const BAMEN_NATAL_POSITION: Record<number, BaMenName> = {
  1: "休門",
  2: "死門",
  3: "傷門",
  4: "杜門",
  6: "開門",
  7: "驚門",
  8: "生門",
  9: "景門",
};

/** 洛書九宮の外周8宮を時計回りにたどった順（中宮5は環に含まれない）。 */
const RING: readonly number[] = [4, 9, 2, 7, 6, 1, 8, 3];

export interface BaMenInput {
  diPan: DiPanResult;
  dun: Dun;
  liuyi: DiPanStem;
  /** 旬首の干支（例: "甲申"）。xunshou.ts の resolveXunShou().xunShou をそのまま渡す。 */
  xunShou: string;
  /** 用事の時刻（時干支）。 */
  hourStem: Stem;
  hourBranch: Branch;
}

export interface ZhiShiResult {
  men: BaMenName;
  palace: number;
}

export interface BaMenResult {
  zhishi: ZhiShiResult;
  /** 九宮(1〜9)→そこに配置される八門（中宮は常に空配列）。 */
  baMen: Record<number, BaMenName[]>;
}

function findPalace(diPan: DiPanResult, stem: string): number | undefined {
  for (let palace = 1; palace <= 9; palace += 1) {
    if (diPan[palace] === stem) return palace;
  }
  return undefined;
}

function mod9(n: number): number {
  return ((n - 1) % 9 + 9) % 9 + 1;
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

function ganzhiIndex(stem: Stem, branch: Branch): number {
  const stemIndex = STEMS.indexOf(stem);
  const branchIndex = BRANCHES.indexOf(branch);
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === stemIndex && i % 12 === branchIndex) return i;
  }
  throw new Error(`invalid ganzhi combination: ${stem}${branch}`);
}

function parseGanzhi(ganzhi: string): { stem: Stem; branch: Branch } {
  const stem = ganzhi[0] as Stem;
  const branch = ganzhi[1] as Branch;
  if (!STEMS.includes(stem) || !BRANCHES.includes(branch)) {
    throw new Error(`invalid ganzhi string: ${ganzhi}`);
  }
  return { stem, branch };
}

/**
 * 八門(人盤): 地盤・旬首・時干支から値使と八門の配置を求める。
 * 九星・八神・格局判定は行わない。
 */
export function resolveBaMen(input: BaMenInput): BaMenResult {
  const { diPan, dun, liuyi, xunShou, hourStem, hourBranch } = input;

  const originalLiuyiPalace = findPalace(diPan, liuyi);
  if (originalLiuyiPalace === undefined) {
    throw new Error(`地盤にliuyiが見つかりません: ${liuyi}`);
  }

  // 時干＝甲（遁甲）のとき、甲は旬首の六儀(liuyi)の宮に隠遁しているので
  //   時干の宮 ＝ 六儀の宮。八門の算出式（②③④⑤）は時干の宮そのものを数値として
  //   使わず、④の数える起点は六儀の実位置 originalLiuyiPalace なので、
  //   甲時は 用事の時干支＝旬首（count=1）として通常どおり進めればよい。
  //   docs/source/1080.pdf の甲時108件で確認済み。
  const hourStemPalace = findPalace(diPan, hourStem);
  if (hourStemPalace === undefined && hourStem !== "甲") {
    throw new Error(`地盤に時干が見つかりません: ${hourStem}`);
  }

  // 例外1: 六儀(liuyi)の宮が中宮になる場合、坤宮(2)に奇宮する（八門の例外・p.29）。
  //   中宮は無位（定位八門が無い）ため、値使門の名称と、⑤の他門の回転基準(delta)は
  //   奇宮先の坤宮(2)の定位八門（死門）を用いる。
  //   一方、④の「値使の位置を数える起点」は、p.28 の具体例
  //   「甲申の六儀庚は震三宮にある。飛宮し進む」に従い、六儀の実際の洛書位置
  //   （中宮＝5）のままとする（奇宮は名称・回転基準にのみ効かせる）。
  const liuyiPalace = originalLiuyiPalace === 5 ? 2 : originalLiuyiPalace;

  // 例外2: 時干が中宮になる場合の文章上の処置は天盤側のものであり、
  // 八門の算出式（下記）は時干の宮そのものを使わないため、無処理でよい。

  // ③旬首の干支から、用事の時刻まで、六十干支の順を1から数える。
  const xunShouGanzhi = parseGanzhi(xunShou);
  const xunShouIndex = ganzhiIndex(xunShouGanzhi.stem, xunShouGanzhi.branch);
  const hourIndex = ganzhiIndex(hourStem, hourBranch);
  const count = ((hourIndex - xunShouIndex) % 60 + 60) % 60 + 1;

  // ④値使の宮から、陽遁は順行・陰遁は逆行で、(count-1)歩進めた宮が値使の実際の位置。
  //   数える起点は六儀の実位置(originalLiuyiPalace)。
  const direction = dun === "陽遁" ? 1 : dun === "陰遁" ? -1 : null;
  if (direction === null) {
    throw new Error(`未知の遁です: ${dun}`);
  }
  let zhishiPalace = mod9(originalLiuyiPalace + direction * (count - 1));

  // 値使が中宮(5)に落ちる場合、坤宮(2)に奇宮する。
  //   九星（p.23「中宮の天禽は坤に寄宮」）・八神（「値符を坤に奇宮」）と同一の奇宮原則。
  //   中宮は環に含まれず delta を計算できないため、坤宮に寄せてから配盤する。
  if (zhishiPalace === 5) {
    zhishiPalace = 2;
  }

  const zhishiMen = BAMEN_NATAL_POSITION[liuyiPalace];

  // ⑤値使が定位から実際の位置へ移動したのと同じ向き・歩数だけ、
  // 環上で残り7門も一斉に移動する。
  const delta = mod8(ringIndexOf(zhishiPalace) - ringIndexOf(liuyiPalace));

  const baMen: Record<number, BaMenName[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] };
  for (const natalPalace of RING) {
    const newRingIndex = mod8(ringIndexOf(natalPalace) + delta);
    const newPalace = RING[newRingIndex];
    baMen[newPalace].push(BAMEN_NATAL_POSITION[natalPalace]);
  }

  return {
    zhishi: { men: zhishiMen, palace: zhishiPalace },
    baMen,
  };
}
