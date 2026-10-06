// src/lib/takujitsu/jianchu.ts
//
// 役割:
//   十二建除（十二直）。神殺（shinsatsu/）とは別の独立モジュールとして
//   実装する（神殺モジュールへは組み込まない）。
//   CalendarEngine（src/lib/calendar/）が返す暦情報のうち、
//   monthBranch（月令＝月建）と dayBranch（日令＝日辰）だけを使って判定する。
//   CalendarEngine 自体は一切変更しない。
//
// 唯一の仕様根拠:
//   docs/source/12建除.pdf（ファイル名は「12建徐.pdf」だが内容は12建除）
//   外部資料・一般知識・推測による補完は禁止。
//
// 判定ロジック（p.4-6の表より）:
//   節月ごとに、月建と同じ地支の最初の日を「建」とし、以後、地支の並び
//   （子丑寅卯辰巳午未申酉戌亥）の順に「除満平定執破危成収開閉」を配置する。
//   p.5の表を全12ヶ月分検算した結果、
//     statusIndex = mod(地支序数(dayBranch) - 地支序数(monthBranch), 12)
//     name = JIANCHU_NAMES[statusIndex]
//   という単純な式で表の全行を再現できることを確認済み（式はこのファイル内で
//   自己完結しており、表そのものを別途データとして持つ必要はない）。
//
// 未実装（範囲外・明記）:
//   p.4に「毎月の節入り日のみ、その前日と同じ十二直を配するのを原則とする」
//   という例外規定があるが、これは「対象日が節入り日そのものかどうか」を
//   必要とし、monthBranch・dayBranch だけからは判定できない
//   （节入り時刻・前日の十二直という追加情報が要る）。今回はこの例外を
//   実装しない（依頼で「monthBranch・dayBranchだけで判定」と明示されているため）。

import { BRANCHES } from "../eto";

/** 十二直の固定順序（建から閉まで）。 */
export const JIANCHU_NAMES = [
  "建", "除", "満", "平", "定", "執", "破", "危", "成", "収", "開", "閉",
] as const;

export type JianchuName = (typeof JIANCHU_NAMES)[number];

/** 読み。p.6-8の見出しより。 */
export const JIANCHU_READINGS: Record<JianchuName, string> = {
  建: "たつじつ",
  除: "のぞくじつ",
  満: "みつじつ",
  平: "たいらじつ",
  定: "ていじつ",
  執: "しゅうじつ",
  破: "はじつ",
  危: "あやぶじつ",
  成: "なるじつ",
  収: "しゅうじつ",
  開: "かいじつ",
  // 閉日の読み: 資料原文では「①閉日(かいじつ)」と、番号・読みとも
  // 直前の「⑪開日(かいじつ)」と同一のまま記載されている（原本画像で
  // 確認済み・PDF抽出の文字化けではなく原本自体の誤植の可能性が高い）。
  // 推測で「へいじつ」等に補正せず、原文の読みをそのまま採用する。
  閉: "かいじつ",
} as const;

/** 象意。p.7-8より全文をそのまま転記。 */
export const JIANCHU_MEANINGS: Record<JianchuName, string> = {
  建:
    "非常に旺の気が強い日である。月建との兼ね合いをみて使わなければいけない。" +
    "冲刑害などにあわなければ良い。木を切るのは良くない日である。",
  除:
    "除には取り除くという意味があり、ふるい現象を新しく改めるに良い日である。" +
    "解除、治療、沐浴などによい。解除とは厄除け、お祓いなども含まれる。治病" +
    "とは病気を治す開始の日を意味する。衣替えや開運祈願などにも良い。",
  満:
    "満には豊かなという意味がある。養子を迎える、出産後退院して家に帰るなど。" +
    "ビジネスの開始、店舗のオープンなど。契約を結ぶ、お金を回収する、倉庫を" +
    "なおす、友達と会って宴会をする、などに良い。ただし、動土や埋葬は凶。",
  平: "何にでも良い日である。特に良いのは家のリフォームなど。",
  定:
    "十二長生でいう臨官であり、最も勢いがあるが臨死位、つまりもっとも死に近" +
    "いという意味もある。死気ともいわれ、使いにくい日である。" +
    "月建と合すると良い日となる。冲する場合は使えない。出かける、引越しは凶",
  執: "執着する日なので魚釣・漁業、狩猟に吉",
  破:
    "破れるという意味でありすべてに良くない日とされるが、逆に悪い方が良い場" +
    "合もある。医者を捜したり入院、診察などに良い。また家の取り壊しに吉。た" +
    "だし月建から冲されたり、月建からみて十二長生の絶となる場合は使えない。",
  危:
    "危険な日でありリスクの高いことはしない。特に乗船は凶。ベッドの買い替え" +
    "設置や移動、子作りに吉。",
  成: "全てに吉。特に婚姻・結婚・結納に良い",
  収: "埋葬、出かける、結婚式、ビジネスに吉",
  開:
    "門の設置、水口の設置に良い日である。風水の造作に良い。放水に吉。埋葬、" +
    "魚釣・漁業・狩猟は凶",
  閉:
    "固くなる日と考えられ埋葬に最も良い日。堤防を築いたり、垣根の穴をふさぐ" +
    "なども良い。治療(特に眼科・鍼灸)は凶、新しい部署に移動、ビジネス、結婚な" +
    "ど全てにおいて凶",
};

export interface JianchuInput {
  /** 月令（＝月建）。CalendarResult.monthBranch をそのまま渡す（string 型）。 */
  monthBranch: string;
  /** 日令（＝日辰）。CalendarResult.dayBranch をそのまま渡す（string 型）。 */
  dayBranch: string;
}

export interface JianchuResult {
  name: JianchuName;
  reading: string;
  meaning: string;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * monthBranch（月令＝月建）・dayBranch（日令＝日辰）から当日の十二直を判定する。
 */
export function resolveJianchu(input: JianchuInput): JianchuResult {
  const branches: readonly string[] = BRANCHES;
  const monthIndex = branches.indexOf(input.monthBranch);
  const dayIndex = branches.indexOf(input.dayBranch);
  if (monthIndex === -1 || dayIndex === -1) {
    throw new Error(
      `resolveJianchu: invalid branch (monthBranch=${input.monthBranch}, dayBranch=${input.dayBranch})`,
    );
  }
  const statusIndex = mod(dayIndex - monthIndex, 12);
  const name = JIANCHU_NAMES[statusIndex];
  return {
    name,
    reading: JIANCHU_READINGS[name],
    meaning: JIANCHU_MEANINGS[name],
  };
}
