// src/lib/luckyDay/verdictLabels.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）専用の表示ラベル層。
//   既存 ActivityVerdict（good/neutral/mixed/bad。
//   src/lib/takujitsu/activity/types.ts）の値・判定ロジックは一切変更しない。
//   ここでは表示文言だけを定義する。
//
// 表示方針（ユーザー指示、2026-09-18）:
//   good    → 「適したこと」
//   neutral → 「用いて良いこと」
//   mixed   → 「注意点のあること」
//   bad     → 「避けたいこと」
//   重要: neutral を「判定なし」「どちらでもない」「不明」等にしない。
//   neutral は「用いて良い」という積極的な判定である。

import type { ActivityVerdict } from "@/lib/takujitsu/activity";

export const LUCKY_DAY_VERDICT_LABELS: Record<ActivityVerdict, string> = {
  good: "適したこと",
  neutral: "用いて良いこと",
  mixed: "注意点のあること",
  bad: "避けたいこと",
};

/** 一般画面での表示順。 */
export const LUCKY_DAY_VERDICT_ORDER: readonly ActivityVerdict[] = ["good", "neutral", "mixed", "bad"];

/**
 * 「目的から吉日を探す」の検索結果（日単位の判定）での表示文言
 * （ユーザー指示、2026-09-19）。「今日の吉凶」（用事単位の判定を表す
 * LUCKY_DAY_VERDICT_LABELS）とは意図的に別の文言。値・判定ロジックは
 * 同じ ActivityVerdict をそのまま使う（表示文言だけが別）。
 *   good    → 「適した日」
 *   neutral → 「用いて良い日」
 *   mixed   → 「注意点のある日」
 *   bad     → 「避けたい日」
 */
export const LUCKY_DAY_SEARCH_VERDICT_LABELS: Record<ActivityVerdict, string> = {
  good: "適した日",
  neutral: "用いて良い日",
  mixed: "注意点のある日",
  bad: "避けたい日",
};
