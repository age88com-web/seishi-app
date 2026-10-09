// src/lib/luckyDay/index.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）専用レイヤーの公開窓口。
//   呼び出し側（src/app/lucky-day/ 配下）は本ファイルからのみ import する。
//   既存の擇日エンジン（src/lib/takujitsu/）は「利用する側」として参照する
//   だけで、一切変更しない。一般版独自の吉凶判定ロジックはここには無い
//   （表示ラベル・UI用データのみ）。

export {
  getTodayInTokyo,
  WEEKDAY_JA_SHORT,
  addDaysToIso,
  addMonthsToIso,
  diffDaysInclusive,
  parseIsoDate,
  weekdayOfIso,
  formatIso,
} from "./today";
export type { TokyoToday } from "./today";

export {
  LUCKY_DAY_ACTIVITY_GROUPS,
  ACTIVITY_GROUP_BY_ID,
  getActivityGroup,
} from "./activityGroups";
export type { LuckyDayActivityGroup } from "./activityGroups";

export {
  LUCKY_DAY_VERDICT_LABELS,
  LUCKY_DAY_VERDICT_ORDER,
  LUCKY_DAY_SEARCH_VERDICT_LABELS,
} from "./verdictLabels";

export { getLuckyDayActivityLabel, LUCKY_DAY_PRIMARY_ACTIVITY_IDS } from "./activityDisplay";

export { LUCKY_DAY_CATEGORY_GROUPS } from "./categories";
export type { LuckyDayCategoryGroup, LuckyDayCategoryItem } from "./categories";

export { LUCKY_DAY_PURPOSES_BY_CATEGORY, getLuckyDayPurposes } from "./purposeMapping";
export type { LuckyDayPurpose } from "./purposeMapping";

export {
  DIRECTION_WHEEL_SLOTS,
  DIRECTION_SLOT_LABEL,
  buildDirectionWheelMarkers,
} from "./directionWheel";
export type { DirectionWheelSlot, DirectionMarker, DirectionMarkerTone } from "./directionWheel";

// 無料/有料の入力可能範囲（純粋関数。"server-only"ではない＝Client Component
// のUIヒントにも使う。実際のセキュリティ境界は src/lib/luckyDay/actions.ts の
// Server Action側。actions.ts自体は "use server" ファイルのため、
// このbarrelからは再exportせず、呼び出し側が直接importする
// （Next.jsのServer Actionsの標準的な扱い）。
export {
  FREE_DAYS_AHEAD,
  getFreeMaxDateIso,
  isDateAllowedForDetail,
  isDirectionAllowed,
  isSearchRangeAllowed,
} from "./accessControl";
export type { SearchRangeCheck } from "./accessControl";
