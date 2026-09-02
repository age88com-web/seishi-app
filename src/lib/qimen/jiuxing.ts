// src/lib/qimen/jiuxing.ts
//
// 役割:
//   奇門遁甲「九星」— 地盤・liuyi(六甲の隠れている六儀)・時干から、
//   値符と九星9個すべての配置を求める。八門・八神・格局判定は行わない。
//
// 仕様の出典:
//   docs/source/奇門遁甲講義案26.pdf（地盤・天盤・九星の配置の実例図、
//   上元丙寅日・辛卯時・陽一局）
//   docs/source/奇門遁甲講義案九星例外.pdf（27ページ、旬首中宮・時干中宮の
//   例外の文章と実例図、丙寅時・陰五局／辛巳時・陰八局）
//   の2つのPDFのみを根拠とする。docs/qimen-spec/07_九星.md より優先。
//   それ以外の理論は追加しない。1080局からの逆算は行わない。
//
// 配置規則の導出（26ページの実例から再構成。以下のいずれも実例と完全一致することを確認済み）:
//   ・値符 = 地盤上でliuyiが置かれた宮の「定位九星」（NATAL[P_liuyi]）。
//     P_liuyi=5（中宮）のときは NATAL[5]=天禽 となる。
//   ・天禽は独立して飛泊せず、常に天芮と同じ宮に同居する（26ページ・27ページの
//     「禽芮」「芮禽」表記、および27ページ「天禽は坤宮の天芮と同宮する原則」より）。
//   ・残り8星（天禽を除く）は、洛書九宮の外周8宮を時計回りにたどる環
//     [巽4→離9→坤2→兌7→乾6→坎1→艮8→震3→(巽4)] 上で、
//     「値符（またはP_liuyi=5のときは天芮）が定位からどれだけ環上を移動したか」
//     と同じ歩数だけ、他の全星も定位から同じ向き・同じ歩数だけ移動する。
//   ・通常時、値符（またはP_liuyi=5のときの天芮）の移動先は「地盤の時干の宮」。
//   ・例外2（時干が中宮になる場合）は、移動先を「坤宮(2)」に固定する
//     （27ページ「時干が中宮になる場合、坤宮に直符を置く」「天柱を坤宮に奇宮」より）。
//   ・26ページの実例（P_liuyi=3≠5, P_hour=4≠5）、27ページの2実例
//     （旬首中宮＝P_liuyi=5の例、時干中宮＝P_hour=5の例）の3例すべてで、
//     この規則により9宮全ての九星配置が実例の図と完全一致することを確認済み。
//
// 時干＝甲（遁甲）の扱い（2026-09-02 追加）:
//   地盤に甲は無い。時干が甲のときは甲は旬首の六儀(liuyi)の宮に隠遁しているので、
//   P_hour ＝ P_liuyi。docs/source/1080.pdf の甲時108件で確認済み。
//
// 旬首・時干がともに中宮(5)になる場合（2026-09-02 実装）:
//   直符(天禽)は中宮に置けないため坤宮(2)へ奇宮する（p.23 の奇宮原則）。
//   結果として anchorNatal=2 / anchorTarget=2 → delta=0 で九星は定位のまま、
//   値符(天禽)は坤2。1080.pdf の該当24件（非甲12＋甲時12）で確認済み。
//   （1080.pdf は検証にのみ使用し、アルゴリズムの逆算には使っていない。）

import type { DiPanResult, DiPanStem } from "./dipan";
import type { Stem } from "../eto";

export type JiuXingStar =
  | "天蓬"
  | "天芮"
  | "天沖"
  | "天輔"
  | "天禽"
  | "天心"
  | "天柱"
  | "天任"
  | "天英";

/** 九星の定位（洛書後天数の宮に対する固定の対応）。 */
const STAR_NATAL_POSITION: Record<number, JiuXingStar> = {
  1: "天蓬",
  2: "天芮",
  3: "天沖",
  4: "天輔",
  5: "天禽",
  6: "天心",
  7: "天柱",
  8: "天任",
  9: "天英",
};

/** 洛書九宮の外周8宮を時計回りにたどった順（中宮5は環に含まれない）。 */
const RING: readonly number[] = [4, 9, 2, 7, 6, 1, 8, 3];

/** 中宮(5)を除く、独立して飛泊する9星のうちの8星（天禽は天芮と同居するため除く）。 */
const RING_STAR_INDICES: readonly number[] = [1, 2, 3, 4, 6, 7, 8, 9];

export interface JiuXingInput {
  diPan: DiPanResult;
  liuyi: DiPanStem;
  hourStem: Stem;
}

export interface ZhiFuResult {
  star: JiuXingStar;
  palace: number;
}

export interface JiuXingResult {
  zhifu: ZhiFuResult;
  /** 九宮(1〜9)→そこに配置される九星（通常1件、天芮の宮のみ天禽と合わせて2件、中宮は常に0件）。 */
  jiuXing: Record<number, JiuXingStar[]>;
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
 * 九星: 地盤・liuyi・時干から値符と九星9個すべての配置を求める。
 * 八門・八神・格局判定は行わない。
 */
export function resolveJiuXing(input: JiuXingInput): JiuXingResult {
  const { diPan, liuyi, hourStem } = input;

  const liuyiPalace = findPalace(diPan, liuyi);
  if (liuyiPalace === undefined) {
    throw new Error(`地盤にliuyiが見つかりません: ${liuyi}`);
  }

  let hourStemPalace = findPalace(diPan, hourStem);
  if (hourStemPalace === undefined) {
    if (hourStem === "甲") {
      // 遁甲: 時干が甲のとき、甲は旬首の六儀(liuyi)の宮に隠遁している。
      // p.23「時間の干支から旬首を割り出し、六甲の隠れている六儀の天干を割り出す」
      // より、時干＝甲の宮は liuyi の宮と一致する。
      hourStemPalace = liuyiPalace;
    } else {
      throw new Error(`地盤に時干が見つかりません: ${hourStem}`);
    }
  }

  const zhifuStar = STAR_NATAL_POSITION[liuyiPalace];

  // 環上を移動する基準（アンカー）の「定位」と「移動先」を決める。
  let anchorNatalPalace: number;
  let anchorTargetPalace: number;

  if (liuyiPalace === 5) {
    // 例外1（旬首中宮）: 値符=天禽は天芮と同宮するため、天芮の定位(坤2)を基準に環を回す。
    anchorNatalPalace = 2;
  } else {
    anchorNatalPalace = liuyiPalace;
  }

  if (hourStemPalace === 5) {
    // 例外2（時干が中宮。旬首・時干がともに中宮の場合を含む）:
    //   直符は中宮に置けないため坤宮(2)へ奇宮する
    //   （p.23「中宮の天禽は坤に寄宮」と同一の奇宮原則）。
    //   旬首・時干がともに中宮のときは anchorNatal=2 / anchorTarget=2 で delta=0、
    //   九星は定位のまま、値符(天禽)は坤2。docs/source/1080.pdf の該当24件で確認済み。
    anchorTargetPalace = 2;
  } else {
    // 通常時／時干非中宮: 値符を地盤の時干宮へ配置する。
    anchorTargetPalace = hourStemPalace;
  }

  const delta = mod8(ringIndexOf(anchorTargetPalace) - ringIndexOf(anchorNatalPalace));

  const jiuXing: Record<number, JiuXingStar[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] };

  for (const starIndex of RING_STAR_INDICES) {
    const newRingIndex = mod8(ringIndexOf(starIndex) + delta);
    const newPalace = RING[newRingIndex];
    jiuXing[newPalace].push(STAR_NATAL_POSITION[starIndex]);
    if (starIndex === 2) {
      // 天禽は天芮と同宮する。
      jiuXing[newPalace].push(STAR_NATAL_POSITION[5]);
    }
  }

  return {
    zhifu: { star: zhifuStar, palace: anchorTargetPalace },
    jiuXing,
  };
}
