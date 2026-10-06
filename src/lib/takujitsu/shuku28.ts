// src/lib/takujitsu/shuku28.ts
//
// 役割:
//   二十八宿の象意データと lookup API。
//   二十八宿そのものの判定ロジック（宿値日・七曜配当・84日小周・420日大周）は
//   既に src/lib/calendar/shukuYo.ts に実装済みであり、本ファイルは一切
//   変更・再実装しない（LODGE_28 / SEVEN_LUMINARIES / resolveShukuYo を
//   そのまま re-export・利用するのみ）。今回追加するのは象意データと、
//   それを宿名から引く lookup 関数だけ。
//
//   神殺（shinsatsu/）とは別の独立モジュールとして実装する
//   （神殺モジュールへは組み込まない）。
//
// 唯一の仕様根拠:
//   docs/source/12建除.pdf（ファイル名は「12建徐.pdf」）の後半（p.10-11）。
//   28宿.pdf という別ファイルは存在しない。
//   外部資料・一般知識・推測による補完は禁止。
//
// epoch（基準日）について:
//   基準日は src/lib/calendar/shukuYoAnchor.ts で確定済み（2025-12-21＝虚、
//   現代通書実データで検証済み）。CalendarEngine.calculate() は
//   epochJdn 未指定時にこの既定アンカーを使って常に宿値日を算出する。
//   本ファイルは「宿名 → 象意」の lookup と、CalendarResult / ShukuYoResult に
//   象意を付加するラッパーのみを提供し、宿値日の計算ロジック自体は
//   shukuYo.ts・shukuYoAnchor.ts のものをそのまま使う（再実装しない）。

import {
  LODGE_28,
  SEVEN_LUMINARIES,
  resolveShukuYo,
  type Lodge28,
  type SevenLuminary,
  type ShukuYoResult,
} from "../calendar";

export { LODGE_28, SEVEN_LUMINARIES, resolveShukuYo };
export type { Lodge28, SevenLuminary, ShukuYoResult };

/** 読み。p.10-11より。 */
export const LODGE28_READINGS: Record<Lodge28, string> = {
  角: "かく", 亢: "こう", 氐: "てい", 房: "ぼう", 心: "しん", 尾: "び", 箕: "き",
  斗: "と", 牛: "ぎゅう", 女: "じょ", 虚: "きょ", 危: "き", 室: "しつ", 壁: "へき",
  奎: "けい", 婁: "ろう", 胃: "い", 昴: "ぼう", 畢: "ひつ", 觜: "し", 参: "しん",
  井: "せい", 鬼: "き", 柳: "りゅう", 星: "せい", 張: "ちょう", 翼: "よく", 軫: "しん",
};

/** 象意。p.10-11より全文をそのまま転記。 */
export const LODGE28_MEANINGS: Record<Lodge28, string> = {
  角: "衣類裁断、柱建て、酒造り、井戸掘りなど吉。埋葬は凶",
  亢: "結納、婚礼、種まき、縫製など吉。造作は凶",
  氐: "婚礼、酒造り、移転、種まきなど吉。造作、着始めなど凶",
  房: "婚礼、旅行、神事、造作、衣類裁断など大吉",
  心: "神事、仏事、移転、旅行など吉。造作は大凶。盗難に注意",
  尾: "婚礼、開店、移転、造作など凶。衣類裁断は凶",
  箕: "造作は大吉。酒造り、財産の収蔵など吉。婚礼は大凶。葬式は凶",
  斗: "動土、造作は吉",
  牛: "「鬼」に告ぐ大吉日。正午付近の時刻を除き全て大吉",
  女: "髪すきなどを除き凶。葬式は大凶",
  虚: "入学など吉。造作、相談事など大凶",
  危: "壁塗り、かまど作り、出行など吉。衣類の裁断等は凶",
  室: "祭祀、祈願、婚礼、船乗り、造作など吉",
  壁: "造作、婚礼、衣類裁断など大吉",
  奎: "造作、上棟式、井戸掘り、旅立ちなど万に大吉",
  婁: "婚礼、造作などに大吉。",
  胃: "就職、婚礼、造作に吉、衣類の裁断は大凶",
  昴: "神仏への祈願、手斧始め、造作など吉",
  畢: "神事、祭礼、造作、不動産の取得など吉、婚礼は凶",
  觜: "入学のみ吉。造作を行えば家財を失う",
  参: "財を求める、養子を取る、造作、遠出など吉",
  井: "神事、種まきなどに吉",
  鬼: "二十八宿中で最大吉日。全てにおいて大吉",
  柳: "造作に凶。造作を行えば不幸が重なる",
  星: "療養を始める日。乗馬などに吉。婚礼、葬儀は凶",
  張: "出行、就職、婚礼など吉、種まき、養蚕などを行えば利益が大いに上がる",
  翼: "種まき、出行などに吉。この日の婚礼は離婚に至る",
  軫: "全てに吉。ただし衣類裁断のみは火災の難に注意",
};

export interface Shuku28Info {
  lodge: Lodge28;
  reading: string;
  meaning: string;
  /** 当該宿の七曜属性（木金土日月火水）。現代の曜日とは別概念。 */
  shukuYo: SevenLuminary;
}

/** 宿名から象意・読み・七曜属性を引く。 */
export function getShuku28Info(lodge: Lodge28): Shuku28Info {
  const lodgeIndex = LODGE_28.indexOf(lodge);
  return {
    lodge,
    reading: LODGE28_READINGS[lodge],
    meaning: LODGE28_MEANINGS[lodge],
    shukuYo: SEVEN_LUMINARIES[lodgeIndex % 7],
  };
}

/**
 * 基準日からの日数差（dayCount）から、宿・七曜・周期位置に象意を付加して返す。
 * resolveShukuYo() 自体は calendar/shukuYo.ts のロジックをそのまま使う
 * （本ファイルでの再実装はしない）。epoch が未確定な間は、dayCount を
 * 算出できる場合のみ呼び出し側がこの関数を使う。
 */
export function resolveShuku28(dayCount: number): ShukuYoResult & { meaning: string; reading: string } {
  const base = resolveShukuYo(dayCount);
  return {
    ...base,
    reading: LODGE28_READINGS[base.lodge],
    meaning: LODGE28_MEANINGS[base.lodge],
  };
}
