// src/lib/qimenMeaning/index.ts
//
// 役割:
//   象意データベースの公開窓口。格局名・剋應名・八門・九星・八神・三奇六儀の
//   名称から象意を引くだけの独立した参照モジュール。用途検索・点数付けは
//   行わない（将来予定）。
//
// 独立性:
//   排盤ロジック（qimenEngine.ts）・CalendarEngine・格局判定
//   （jikaku.ts / kyokaku.ts）・剋應（src/lib/qimen/kokuo/）には
//   一切依存せず、変更もしない。呼び出し側が名称文字列を渡すだけの
//   完全に独立したデータベースとして実装する。
//
// データが無い場合:
//   各 lookup 関数は undefined を返す。呼び出し側で「—」を表示する。

import { MEANING_DATA } from "./data";

export interface QimenMeaningEntry {
  name: string;
  meanings: string[];
}

/** 名称（格局名・剋應名）から象意（箇条書き）を引く。データが無ければ undefined。 */
export function lookupMeaning(name: string): string[] | undefined {
  return MEANING_DATA[name];
}

// 八門（基本象意・旺衰）
export {
  BAMEN_MEANING,
  BAMEN_WANGSHUAI,
  BAMEN_WANGSHUAI_STAGES,
  SOLAR_SEGMENTS,
  BAMEN_WANGSHUAI_SOURCE_PAGE,
  lookupBaMenMeaning,
  lookupBaMenWangShuai,
} from "./baMenMeaning";
export type { BaMenMeaningEntry, BaMenWangShuaiStage, SolarSegmentLabel } from "./baMenMeaning";

// 九星（基本象意・旺相休囚死）
export {
  JIUXING_MEANING,
  JIUXING_WANGSHUAI,
  JIUXING_WANGSHUAI_SOURCE_PAGE,
  JIUXING_WANGSHUAI_EFFECT,
  lookupJiuXingMeaning,
  lookupJiuXingWangShuai,
} from "./jiuXingMeaning";
export type { JiuXingMeaningEntry, JiuXingWangShuaiRow } from "./jiuXingMeaning";

// 八神（基本象意・宮位吉凶）
export {
  BASHEN_MEANING,
  BASHEN_PALACES,
  BASHEN_PALACE_FORTUNE,
  BASHEN_PALACE_FORTUNE_SOURCE_PAGE,
  lookupBaShenMeaning,
  lookupBaShenPalaceFortune,
} from "./baShenMeaning";
export type { BaShenMeaningEntry } from "./baShenMeaning";

// 三奇・六儀（象意）
export { SANQI_MEANING, LIUYI_MEANING, lookupSanQiLiuYiMeaning } from "./sanQiLiuYiMeaning";
export type { SanQiLiuYiEntry } from "./sanQiLiuYiMeaning";

// 用途 → 使用する格局（検索ロジックへの組み込みは今回対象外）
export { PURPOSE_FORMATS, lookupPurposeFormats } from "./purposeMeaning";
export type { PurposeFormatEntry } from "./purposeMeaning";

// 伏吟・反吟（分類・吉凶文。docs/source/反吟伏吟.png 由来。data.ts の伏吟格／反吟格とは別資料）
export {
  FUYIN_FANYIN_MEANING,
  FUYIN_FANYIN_SOURCE_DOCUMENT,
  lookupFuYinFanYinMeaning,
} from "./fuYinFanYinMeaning";
export type {
  FuYinFanYinKind,
  FuYinFanYinSubtypeEntry,
  FuYinFanYinMeaningEntry,
} from "./fuYinFanYinMeaning";
