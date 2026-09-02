// src/lib/qimen/tianpan.ts
//
// 役割:
//   奇門遁甲「天盤」— 地盤・時干・旬首の六儀(liuyi)から、
//   九宮それぞれの天盤干を求める。
//   九星・八門・八神・格局判定は行わない。
//
// 仕様の出典（一次資料）:
//   元Keynote「奇門遁甲講義案N.key」＝ docs/source/奇門遁甲講義案N.pdf の
//   「天盤干の配列」(p.20)・「天盤の例外」(p.21)・「天盤の例外２」(p.22)・
//   「九星を配置２」(p.24)・「地盤・天盤・九星の配置」(p.25) の本文と完成図のみ。
//   1080局データ(docs/source/1080.pdf)は検証にのみ使用し、
//   アルゴリズムの逆算には使っていない。
//
// 回転規則（2026-09-02 修正: 九星と同一のリング回転へ）:
//   p.20「その六儀を起点に、地盤と同じ干の配列を回転させる」、
//   p.24「地盤上の時干の位置に直符を置き九星を配列 … それを基準に他の九星を
//   時計回りに配置する」より、天盤干は九星と一体で回る。
//   すなわち jiuxing.ts と同一に、
//     ・直符（旬首六儀の定位九星）を「地盤の時干の宮」へ動かす
//     ・洛書外周8宮のリング [巽4→離9→坤2→兌7→乾6→坎1→艮8→震3] 上を
//       直符の移動歩数(delta)だけ、地盤の各外周干を一斉に回す
//     ・中宮(5)は回転に含めない。中宮の地盤干（天禽が帯同する干）は据え置き
//   p.20・p.21・p.22・p.25 の完成図4例すべてで、この規則が図と一致することを
//   確認済み（旧実装の mod9 巡回シフトはいずれの図とも一致しなかった）。
//
// 中宮例外（p.21 / p.22 の本文と完成図）:
//   ・六儀が中宮になる場合  → 坤2へ奇宮（アンカーの定位を坤2にする）
//   ・時干が中宮になる場合  → 坤2へ奇宮（アンカーの移動先を坤2にする）
//   ・旬首の宮と時干の宮がともに中宮  → 上記2規則を両方適用（定位・移動先とも坤2、
//     delta＝0、天盤＝地盤）。docs/source/1080.pdf の該当12件で確認済み。
//   いずれも jiuxing.ts の例外処理と同一。
//
// 時干＝甲（遁甲）の扱い:
//   地盤に甲は無い。p.20「六甲の隠れている六儀」より、時干が甲のときは甲は
//   旬首の六儀(liuyi)の宮に隠遁しているので、時干の宮＝liuyiの宮。
//   よって回転量 delta＝0、天盤＝地盤。1080.pdf の甲時108件で確認済み。
//
// 利用するモジュール: dingju.ts / dipan.ts / xunshou.ts のみ
//   （本ファイルは dipan.ts の型 DiPanResult のみ利用する。
//   dingju.ts / xunshou.ts の出力は呼び出し側で resolveTianPan の入力に変換して渡す想定）。

import type { DiPanResult, DiPanStem } from "./dipan";
import type { Stem } from "../eto";

export interface TianPanInput {
  diPan: DiPanResult;
  hourStem: Stem;
  liuyi: DiPanStem;
}

export type TianPanResult = Record<number, DiPanStem>;

/** 洛書九宮の外周8宮を時計回りにたどった順（jiuxing.ts の RING の再掲。中宮5は含まない）。 */
const RING: readonly number[] = [4, 9, 2, 7, 6, 1, 8, 3];
/** 中宮(5)を除く外周8宮。 */
const OUTER: readonly number[] = [1, 2, 3, 4, 6, 7, 8, 9];

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

function findPalace(diPan: DiPanResult, stem: string): number | undefined {
  for (let palace = 1; palace <= 9; palace += 1) {
    if (diPan[palace] === stem) return palace;
  }
  return undefined;
}

/**
 * 天盤: 地盤・時干・liuyi(六甲の隠れている六儀)から、九宮それぞれの天盤干を求める。
 * 九星と同一のリング回転で、地盤の干配列を回転させる。
 * 九星・八門・八神・格局判定は行わない。
 */
export function resolveTianPan(input: TianPanInput): TianPanResult {
  const { diPan, hourStem, liuyi } = input;

  // ① liuyi は呼び出し側（xunshou.ts の resolveXunShou）から受け取る。

  // ② 地盤で liuyi が存在する宮を取得
  const liuyiPalace = findPalace(diPan, liuyi);
  if (liuyiPalace === undefined) {
    throw new Error(`地盤にliuyiが見つかりません: ${liuyi}`);
  }

  // 遁甲: 時干が甲のとき、甲は liuyi の宮に隠遁しており、回転量は 0。天盤 = 地盤。
  if (hourStem === "甲") {
    return { ...diPan };
  }

  // ③ 地盤で hourStem が存在する宮を取得
  const hourStemPalace = findPalace(diPan, hourStem);
  if (hourStemPalace === undefined) {
    // 地盤には六儀三奇(戊己庚辛壬癸丁丙乙)の9干のみが存在する。
    // 甲は上で処理済みのため、ここに来ることは通常無いが、念のため停止する。
    throw new Error(`地盤に時干が見つかりません: ${hourStem}`);
  }

  // ④ 回転のアンカー（定位＝六儀の宮、移動先＝時干の宮）を決める。
  //   例外1（p.22「天盤の例外」）: 六儀が中宮に来る場合、坤(2)に中宮の地盤干を寄せる。
  //     ＝六儀の宮（定位アンカー）を坤(2)とする。
  //   例外2（p.22「天盤の例外２」）: 時干が中宮に来る場合、坤(2)に六儀を置き、
  //     その六儀を時干の代用として天盤を配列する。
  //     ＝時干の宮（移動先アンカー）を坤(2)とする。
  //   旬首の宮と時干の宮がともに中宮の場合は上記2規則を両方適用し、
  //     定位・移動先ともに坤(2)となる（回転量 delta＝0、天盤＝地盤）。
  //     jiuxing.ts の同ケースと一致する。
  const anchorNatalPalace = liuyiPalace === 5 ? 2 : liuyiPalace;
  const anchorTargetPalace = hourStemPalace === 5 ? 2 : hourStemPalace;

  const delta = mod8(ringIndexOf(anchorTargetPalace) - ringIndexOf(anchorNatalPalace));

  // ⑤ 地盤の外周8干を、九星と同じ向き・歩数だけリング上を回す。
  const result: TianPanResult = {};
  for (const palace of OUTER) {
    const stem = diPan[palace];
    if (stem === undefined) continue;
    result[RING[mod8(ringIndexOf(palace) + delta)]] = stem;
  }
  // 中宮の地盤干（天禽が帯同する干）は回転させず据え置く。
  if (diPan[5] !== undefined) {
    result[5] = diPan[5];
  }

  return result;
}
