// src/lib/luckyDay/hourlyFortune.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）の有料会員向け「時間の吉凶」
//   （1日12時辰の吉凶記号）を組み立てる（ユーザー指示、2026-10-14）。
//
// 重要（新しい時家計算は作らない）:
//   月間行動予定（src/lib/takujitsu/monthly/buildMonthlySchedule.ts の
//   hourCell()）と同じ既存関数を、同じ順番で呼ぶだけ。いずれも変更していない。
//     ・getJikaEntry()      … 時家720表（日干支＋時支 → 1マス）
//     ・classifyJikaTerm()  … 時家神殺の吉神／凶神の分類
//     ・hourSymbol()        … 吉神・凶神の件数比較による記号
//   記号の規則は docs/monthly-action-schedule-engine-mapping.md §9.2 の
//   確定仕様のまま。点数化・重み付けはしない。
//
// 勿用の表示（人間側決定、2026-10-14）:
//   一般向け /lucky-day では、勿用マス（hourSymbol() が「用いてもよい」を
//   返すマス）を記号「勿用」・説明「使用を避ける時間」と表示する。
//   これは一般向けの表示文言だけの読み替えであり、時家720の原データ・
//   神殺・吉凶判定・専門版 /takujitsu・月間行動予定（「用いてもよい」の
//   まま）は変更しない。
//
// 日付境界（§9.1、専門版エンジンに従う）:
//   カレンダーエンジンは子初23:00で日干支を切り替える。日付Dの
//   「23:00〜1:00」は、前日23:00からD当日1:00までのDの子時であり、
//   Dの日干支で引く（月間行動予定の1行目と同じ）。D当日23:00からの
//   子時は翌日の日干支になるため、ここには含めない（12行）。
//
// 会員権限:
//   computeHourlyFortuneForDay() は isPaid===false なら計算自体をせず
//   null を返す。isPaid は呼び出し側（actions.ts の getDayDetailAction、
//   "use server"）が getCurrentTakujitsuMember() を毎回呼び直して確定した
//   member.active をそのまま渡す（personalJudgment.ts と同じ方式）。
//
// 返す内容:
//   時間帯・時支・記号・説明だけ。神殺名・件数は返さない
//   （画面に常時表示しないため、クライアントへ渡す必要がない）。

import { getJikaEntry } from "@/lib/takujitsu/jika";
import { classifyJikaTerm } from "@/lib/takujitsu/jika/hourClassification";
import { hourSymbol } from "@/lib/takujitsu/monthly";
import type { MonthlyHourSymbol } from "@/lib/takujitsu/monthly";

/** 一般向けの表示記号。勿用マスだけ「勿用」と表示する（月間行動予定の「用いてもよい」に当たる）。 */
export type LuckyDayHourSymbol = Exclude<MonthlyHourSymbol, "用いてもよい"> | "勿用";

/** 月間行動予定と同じ hourSymbol() の結果を、一般向けの表示記号へ読み替える（表示文言のみ）。 */
export function toLuckyDayHourSymbol(symbol: MonthlyHourSymbol): LuckyDayHourSymbol {
  return symbol === "用いてもよい" ? "勿用" : symbol;
}

export interface LuckyDayHourFortune {
  /** 表示用の時間帯（例 "23:00〜1:00"）。 */
  range: string;
  /** 時支（子〜亥）。 */
  hourBranch: string;
  symbol: LuckyDayHourSymbol;
  /** 一般向けの簡潔な説明（記号の定義を言い換えたもの）。 */
  description: string;
}

/** 12時辰の表示順（子＝前日23:00〜当日1:00 から始まる）。 */
export const LUCKY_DAY_HOUR_SLOTS: readonly { range: string; hourBranch: string }[] = [
  { range: "23:00〜1:00", hourBranch: "子" },
  { range: "1:00〜3:00", hourBranch: "丑" },
  { range: "3:00〜5:00", hourBranch: "寅" },
  { range: "5:00〜7:00", hourBranch: "卯" },
  { range: "7:00〜9:00", hourBranch: "辰" },
  { range: "9:00〜11:00", hourBranch: "巳" },
  { range: "11:00〜13:00", hourBranch: "午" },
  { range: "13:00〜15:00", hourBranch: "未" },
  { range: "15:00〜17:00", hourBranch: "申" },
  { range: "17:00〜19:00", hourBranch: "酉" },
  { range: "19:00〜21:00", hourBranch: "戌" },
  { range: "21:00〜23:00", hourBranch: "亥" },
];

/**
 * 記号ごとの説明。§9.2 の条件（吉神・凶神の件数比較）を一般向けに
 * 言い換えただけで、新しい判定や解釈は加えない。
 * 勿用マスは人間側決定（2026-10-14）の表示文言「使用を避ける時間」。
 */
export const LUCKY_DAY_HOUR_DESCRIPTIONS: Readonly<Record<LuckyDayHourSymbol, string>> = {
  "◎": "吉の働きだけがある時間",
  "○": "吉の働きが凶より多い時間",
  "△": "吉と凶の働きが同じ数の時間",
  "▽": "凶の働きが吉より多い時間",
  "▼": "凶の働きだけがある時間",
  "勿用": "使用を避ける時間",
};

/**
 * 日干支（例 "甲子"）から12時辰の時間の吉凶を作る。
 * 時家720表に無い組み合わせ（本来あり得ない）は例外にする（月間行動予定と同じ）。
 */
export function buildLuckyDayHourlyFortune(dayGanzhi: string): LuckyDayHourFortune[] {
  return LUCKY_DAY_HOUR_SLOTS.map(({ range, hourBranch }) => {
    const entry = getJikaEntry(dayGanzhi, hourBranch);
    if (!entry) throw new Error(`時家720表に存在しない組み合わせです: ${dayGanzhi}/${hourBranch}`);
    const kichi = entry.normalizedTerms.filter((t) => classifyJikaTerm(t) === "吉").length;
    const kyo = entry.normalizedTerms.filter((t) => classifyJikaTerm(t) === "凶").length;
    const symbol = toLuckyDayHourSymbol(hourSymbol(kichi, kyo, entry.isMuyo));
    return { range, hourBranch, symbol, description: LUCKY_DAY_HOUR_DESCRIPTIONS[symbol] };
  });
}

/**
 * 有料会員の場合だけ時間の吉凶を返すゲート。
 * isPaid===false（未ログイン・無料会員）のときは計算せず null を返す。
 */
export function computeHourlyFortuneForDay(isPaid: boolean, dayGanzhi: string): LuckyDayHourFortune[] | null {
  if (!isPaid) return null;
  return buildLuckyDayHourlyFortune(dayGanzhi);
}
