"use server";

// src/lib/luckyDay/actions.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）のServer Actions。
//   無料/有料の「入力可能範囲」をサーバー側で強制する唯一の場所。
//
// 重要（ユーザー指示、2026-09-19。セキュリティ）:
//   Client Component側でactiveを見てボタンを隠すだけの実装にしない。
//   DayDetailCard・「目的から吉日を探す」は、この Server Action 経由でのみ
//   calculateTakujitsuFull()/searchTakujitsuDays()（既存エンジン、一切
//   変更しない）を呼ぶ。日付・期間の許可判定は、クライアントから渡された
//   フラグを一切信用せず、常にサーバー側で
//   getCurrentTakujitsuMember()（既存、セッションcookieから検証）を
//   呼び直して確認する。これにより、URL/パラメータやReact state を
//   直接操作しても、無料ユーザーが366日検索・任意日付詳細を取得すること
//   はできない（Server Actionは常にサーバー側で実行され、クライアント
//   コードから実装を書き換えることはできない）。
//
//   判定ロジック自体（good/neutral/mixed/bad、神殺・十二建除・宿値日・
//   吉凶方位等）はここでは一切変更しない。「許可された日付/期間かどうか」
//   だけをここで判定し、許可された場合のみ既存エンジンをそのまま呼ぶ。
//
// 吉凶方位の個別ゲート（2026-09-19、仕様修正）:
//   無料ユーザーは「今日」の吉凶方位だけが利用可能で、30日以内の検索結果
//   から開いた今日以外の日については、擇日判定・詳細暦等は表示してよいが
//   吉凶方位は有料会員限定（isDateAllowedForDetailとisDirectionAllowedは
//   別判定）。単にCSS等で隠すのではなく、許可されない場合は
//   calculateDailyDirections()自体をサーバー側で呼ばず、
//   directionMarkers を null のままクライアントへ返す
//   （＝不要な方位データをクライアントへ渡さない）。
//   dailyDirections.ts・calculateTakujitsuFull() 自体は一切変更しない。

import { calculateTakujitsuFull, searchTakujitsuDays } from "@/lib/takujitsu";
import type { TakujitsuFullResult, TakujitsuSearchResult } from "@/lib/takujitsu";
import { calculateDailyDirections } from "@/lib/takujitsu/dailyDirections";
import type { PersonalTakujitsuResult } from "@/lib/takujitsu/personal";
import { getCurrentTakujitsuMember } from "./auth/member";
import { getTodayInTokyo, parseIsoDate } from "./today";
import { isDateAllowedForDetail, isDirectionAllowed, isSearchRangeAllowed } from "./accessControl";
import { buildDirectionWheelMarkers } from "./directionWheel";
import type { DirectionMarker, DirectionWheelSlot } from "./directionWheel";
import { computePersonalResultForDay, isValidLuckyDayBirthInput } from "./personalJudgment";
import type { LuckyDayBirthInput } from "./personalJudgment";
import { getSupportStatus, submitSupportQuestion } from "./auth/wordpress";
import type { SupportStatus } from "./auth/wordpress";
import {
  isValidIdempotencyKey,
  isValidSupportQuestionText,
  sanitizeSupportQuestionContext,
} from "./support";
import type { SupportQuestionContextInput } from "./support";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type DirectionMarkersBySlot = Record<DirectionWheelSlot, DirectionMarker[]>;
export type { LuckyDayBirthInput } from "./personalJudgment";
export type { PersonalTakujitsuResult, PersonalAvoidReason, PersonalAvoidType } from "@/lib/takujitsu/personal";
export type { SupportStatus } from "./auth/wordpress";
export type { SupportQuestionContextInput } from "./support";

/**
 * クライアントから受け取った生年月日を検証する共通ヘルパー。
 * 未指定はnull（個人判定を行わない）、形式が不正な値もnullとして扱う
 * （不正な入力でエラーにはせず、通常の擇日判定自体は従来どおり続行する）。
 */
function sanitizeBirthInput(birth: unknown): LuckyDayBirthInput | null {
  if (birth == null) return null;
  return isValidLuckyDayBirthInput(birth) ? birth : null;
}

export type DayDetailActionResult =
  | {
      ok: true;
      data: TakujitsuFullResult;
      directionMarkers: DirectionMarkersBySlot | null;
      /**
       * 生年月日による個人忌日判定（相冲・三殺・三刑・箭刃）。
       * null＝個人判定を行っていない（無料/未ログイン、または生年月日未指定/不正）。
       * 有料会員＋有効な生年月日が指定された場合のみ、既存
       * evaluatePersonalForBirth()（src/lib/takujitsu/personal、無変更）の
       * 結果（status: "clear" | "avoid" | "undetermined"）をそのまま返す。
       */
      personal: PersonalTakujitsuResult | null;
    }
  | { ok: false; reason: "invalid_date" | "not_allowed" | "calc_error" };

/**
 * 指定日の暦・63/109活動等（TakujitsuFullResult一式）と、許可されていれば
 * 吉凶方位（directionMarkers）を取得する。
 *
 * 無料/未ログインの場合:
 *   ・今日〜今日+30日の範囲外の日付は not_allowed を返す（詳細一式ごと
 *     拒否。calculateTakujitsuFull()自体を呼ばない、既存どおりの制御）。
 *   ・範囲内でも「今日」以外の日は directionMarkers を null にする
 *     （calculateDailyDirections()自体を呼ばず、方位データを計算しない
 *     ＝クライアントへ渡さない。data本体＝擇日判定・詳細暦は返す）。
 * 有料会員は常にすべて許可する。
 *
 * 個人忌日判定（personal、ユーザー指示 2026-09-20追加）:
 *   有料会員（member.active）かつ birth が有効な場合のみ、
 *   computePersonalResultForDay() 経由で既存 evaluatePersonalForBirth()
 *   （src/lib/takujitsu/personal、無変更）を実行する。無料/未ログインの
 *   場合は birth の値に関わらず必ず personal: null を返す（＝計算自体を
 *   行わない。クライアントが直接生年月日を送っても結果を取得できない）。
 *   通常の擇日判定（activities）には一切影響しない、完全に別レイヤーの値。
 */
export async function getDayDetailAction(
  dateIso: string,
  birth?: unknown,
): Promise<DayDetailActionResult> {
  if (typeof dateIso !== "string" || !ISO_DATE_PATTERN.test(dateIso)) {
    return { ok: false, reason: "invalid_date" };
  }

  const member = await getCurrentTakujitsuMember();
  const today = getTodayInTokyo();
  if (!isDateAllowedForDetail(dateIso, today.iso, member.active)) {
    return { ok: false, reason: "not_allowed" };
  }

  try {
    const { year, month, day } = parseIsoDate(dateIso);
    const data = calculateTakujitsuFull({
      year,
      month,
      day,
      hour: 12,
      minute: 0,
      timezone: "Asia/Tokyo",
    });

    let directionMarkers: DirectionMarkersBySlot | null = null;
    if (isDirectionAllowed(dateIso, today.iso, member.active)) {
      const dayGanzhi = `${data.calendar.dayStem}${data.calendar.dayBranch}`;
      directionMarkers = buildDirectionWheelMarkers(calculateDailyDirections(dayGanzhi));
    }

    const personal = computePersonalResultForDay(member.active, sanitizeBirthInput(birth), data.calendar.dayBranch);

    return { ok: true, data, directionMarkers, personal };
  } catch {
    return { ok: false, reason: "calc_error" };
  }
}

export interface SearchDaysActionParams {
  activityId: string;
  from: string;
  to: string;
  /** 有料会員向け「生年月日による個人忌日判定」の入力（省略可）。 */
  birth?: unknown;
}

/** "YYYY-MM-DD" キーで日ごとの個人忌日判定結果を引けるマップ。 */
export type PersonalResultByDate = Record<string, PersonalTakujitsuResult>;

export type SearchDaysActionResult =
  | {
      ok: true;
      data: TakujitsuSearchResult;
      /**
       * null＝個人判定を行っていない（無料/未ログイン、または生年月日
       * 未指定/不正）。有料会員＋有効な生年月日が指定された場合のみ、
       * data.days の各日について個人忌日判定を行い、日付（"YYYY-MM-DD"）
       * ごとの結果をここに入れる。good/neutral/mixed/bad（既存の擇日判定）
       * とは統合しない、完全に別レイヤーの値。
       */
      personalByDate: PersonalResultByDate | null;
    }
  | { ok: false; reason: "invalid_input" | "not_allowed" | "search_error"; message?: string };

/**
 * 「目的から吉日を探す」の検索を実行する。
 * 無料/未ログインの場合、開始日<今日、または終了日>今日+30日であれば
 * not_allowed を返す（searchTakujitsuDays()自体は呼ばない）。
 * 有料会員は既存の366日上限のみ適用する。
 *
 * 個人忌日判定（personalByDate、ユーザー指示 2026-09-20追加）:
 *   有料会員（member.active）かつ birth が有効な場合のみ、既存
 *   searchTakujitsuDays()（無変更）の結果を取得した「後」に、各日の
 *   dayBranch から computePersonalResultForDay() 経由で既存
 *   evaluatePersonalForBirth()（src/lib/takujitsu/personal、無変更）を
 *   呼ぶ。無料/未ログインの場合は birth の値に関わらず必ず
 *   personalByDate: null を返す。既存の verdict（good/neutral/mixed/bad）
 *   や日付の並び順・件数には一切影響しない、完全に別レイヤーの付加情報。
 */
export async function searchDaysAction(params: SearchDaysActionParams): Promise<SearchDaysActionResult> {
  const { activityId, from, to, birth } = params;

  if (
    typeof activityId !== "string" ||
    activityId.length === 0 ||
    activityId.length > 100 ||
    typeof from !== "string" ||
    !ISO_DATE_PATTERN.test(from) ||
    typeof to !== "string" ||
    !ISO_DATE_PATTERN.test(to)
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const member = await getCurrentTakujitsuMember();
  const today = getTodayInTokyo();
  const check = isSearchRangeAllowed(from, to, today.iso, member.active);
  if (!check.allowed) {
    if (check.reason === "invalid_range") {
      return { ok: false, reason: "invalid_input", message: "終了日は開始日と同じか、それより後の日付にしてください。" };
    }
    if (check.reason === "range_too_long") {
      return { ok: false, reason: "invalid_input", message: "検索期間の上限を超えています。" };
    }
    return { ok: false, reason: "not_allowed" };
  }

  try {
    const data = searchTakujitsuDays({ activityId, from, to, timezone: "Asia/Tokyo" });

    const sanitizedBirth = sanitizeBirthInput(birth);
    let personalByDate: PersonalResultByDate | null = null;
    if (member.active && sanitizedBirth) {
      personalByDate = {};
      for (const d of data.days) {
        const result = computePersonalResultForDay(member.active, sanitizedBirth, d.dayBranch);
        if (!result) continue; // 暦として無効な生年月日等（既存エンジン側のエラー）の場合はその日を含めない
        const iso = `${String(d.year).padStart(4, "0")}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
        personalByDate[iso] = result;
      }
    }

    return { ok: true, data, personalByDate };
  } catch (e) {
    return { ok: false, reason: "search_error", message: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// 会員専用 質問サポート（2026-09-20追加）。
//
// 重要（ユーザー指示。セキュリティ）:
//   ブラウザからWordPress REST APIを直接呼ばせない。必ずこのServer Action
//   経由でのみ src/lib/luckyDay/auth/wordpress.ts の
//   getSupportStatus()/submitSupportQuestion() を呼ぶ。
//   user_id はクライアントから一切受け取らず、他のServer Actionと同じく
//   getCurrentTakujitsuMember() が返す（署名済みセッション由来の）
//   member.userId だけを使う（他人になりすましてuser_idを指定することは
//   できない）。
//
//   月3回の上限判定・当月（Asia/Tokyo基準）の算出・同一idempotency_keyの
//   二重送信防止・PMPro levelId 2/3 の再確認・wp_mail()送信は、すべて
//   WordPress側のREST APIが行う唯一の正であり、ここでは一切実装しない
//   （このNext.js側は「有料会員でなければWordPressへ問い合わせ自体を
//   行わない」というゲートと、明らかに不正な形の入力を弾くバリデーション
//   だけを担当する）。
// ---------------------------------------------------------------------------

export type SupportStatusActionResult =
  | { ok: true; data: SupportStatus }
  | { ok: false; reason: "not_allowed" | "unavailable" };

/**
 * 会員専用 質問サポートの当月利用状況（0/3等）を取得する。
 * 有料会員（member.active）でない場合は、WordPressへ問い合わせること
 * 自体を一切行わず not_allowed を返す。
 */
export async function getSupportStatusAction(): Promise<SupportStatusActionResult> {
  const member = await getCurrentTakujitsuMember();
  if (!member.active || !member.userId) {
    return { ok: false, reason: "not_allowed" };
  }

  const status = await getSupportStatus(member.userId);
  if (!status) {
    return { ok: false, reason: "unavailable" };
  }
  return { ok: true, data: status };
}

export interface SubmitSupportQuestionActionParams {
  /** クライアント（ブラウザ）が生成した冪等キー（二重送信防止用）。 */
  idempotencyKey: string;
  questionText: string;
  /** 質問回数には影響しない参考情報（省略可）。 */
  context?: unknown;
}

export type SubmitSupportQuestionActionResult =
  | { ok: true; used: number; limit: number; remaining: number }
  | {
      ok: false;
      reason: "not_allowed" | "invalid_input" | "limit_reached" | "mail_failed" | "duplicate" | "network_error";
    };

/**
 * 会員専用 質問サポートの質問を送信する。
 * 有料会員（member.active）でない場合は、WordPressへ問い合わせること
 * 自体を一切行わず not_allowed を返す（画面上でボタンを隠すだけでなく、
 * 送信時にも必ずここで再確認する）。
 * questionText/idempotencyKeyの形式が明らかに不正な場合も、WordPressへは
 * 送らずinvalid_inputを返す（本文はここでもログへ出さない）。
 */
export async function submitSupportQuestionAction(
  params: SubmitSupportQuestionActionParams,
): Promise<SubmitSupportQuestionActionResult> {
  const member = await getCurrentTakujitsuMember();
  if (!member.active || !member.userId) {
    return { ok: false, reason: "not_allowed" };
  }

  const { idempotencyKey, questionText, context } = params;
  if (!isValidIdempotencyKey(idempotencyKey) || !isValidSupportQuestionText(questionText)) {
    return { ok: false, reason: "invalid_input" };
  }

  const sanitizedContext: SupportQuestionContextInput | undefined =
    sanitizeSupportQuestionContext(context) ?? undefined;

  const result = await submitSupportQuestion(member.userId, idempotencyKey, questionText.trim(), sanitizedContext);
  if (result.ok) {
    return { ok: true, used: result.used, limit: result.limit, remaining: result.remaining };
  }
  return { ok: false, reason: result.reason };
}
