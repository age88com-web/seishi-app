"use client";

// src/app/lucky-day/LuckyDayClient.tsx
//
// 一般向け擇日サービス（トップページ、Client Component本体）。
//
// 2026-09-19（WordPress会員認証追加）:
//   これまで src/app/lucky-day/page.tsx がClient Componentそのものだったが、
//   会員状態（getCurrentTakujitsuMember()、Server専用・next/headersのcookies()を
//   使う）をpage.tsx側（Server Component）で取得してpropsとして渡す構成に
//   変更した。既存のUI・状態・ロジックは一切変更せず、
//   ①ファイル名とexport名の変更、②memberStatus propの追加と最上部の
//   小さな会員状態表示、の2点だけを加えている。
//
// 重要（ユーザー指示、2026-09-18／2026-09-19）:
//   ・既存の専門家向け /takujitsu（src/app/takujitsu/page.tsx）とは
//     完全に別ページ・別UI。専門家向け画面をコピー・流用しない。
//   ・判定ロジックは一切持たない。既存 calculateTakujitsuFull() /
//     searchTakujitsuDays()（src/lib/takujitsu/full.ts）の結果をそのまま
//     一般向けに表示するだけで、一般版独自の吉凶ロジックは作らない。
//     スコア・順位付け・重み付けもしない。
//   ・「今日」は Asia/Tokyo の暦日として扱う（getTodayInTokyo()。
//     ブラウザのローカルタイムゾーン・単純なUTC日付は使わない）。
//   ・neutral は「用いて良いこと（用いて良い日）」という積極的な判定として
//     表示する（「判定なし」等にしない）。
//
// 画面構成（2026-09-19 UI改善）:
//   PC（十分な横幅）は左右2カラム、スマホは縦一列（横スクロール無し）。
//     左カラム：「今日の吉凶」（初期値は今日。任意日にも変更可能）
//     右カラム：「吉日を調べる」タブ（A. 日付から調べる／B. 目的から探す）
//   「今日」「日付から調べた日」「目的検索結果から開いた日」の3箇所は、
//   すべて同一の DayDetailCard コンポーネントを再利用する（入力する日付
//   だけが異なる）。将来「その日の吉凶方位」を追加する際も、この1箇所に
//   追加すれば3箇所すべてに反映される構造にしてある（今回は方位判定・
//   円盤描画は実装しない）。
//
// 年命（生年月日・性別・出生時刻）・personal判定は今回実装しない。
//
// 無料/有料の機能制限（2026-09-19追加）:
//   無料版と有料版で擇日判定ロジックは分岐させない。同じ
//   calculateTakujitsuFull()/searchTakujitsuDays()（既存エンジン、一切
//   変更しない）を使い、「入力可能範囲」だけを会員状態で制御する。
//   重要（セキュリティ）: この制御はClient Component側で active を見て
//   ボタンを隠すだけにはしていない。DayDetailCard・「目的から吉日を探す」は
//   src/lib/luckyDay/actions.ts の Server Action（getDayDetailAction /
//   searchDaysAction）経由でのみ既存エンジンを呼ぶ。Server Action は常に
//   サーバー側で getCurrentTakujitsuMember() を呼び直して会員状態を
//   確認するため、React state やURL/パラメータをクライアント側で
//   直接書き換えても、無料ユーザーが366日検索・任意日付詳細を取得する
//   ことはできない（クライアント側の isPaid はUIヒント・見た目の制御に
//   しか使わない）。

import { useEffect, useMemo, useState } from "react";
import type { TakujitsuFullResult, TakujitsuSearchResult, TakujitsuSearchDay } from "@/lib/takujitsu";
import { getDayDetailAction, searchDaysAction, getSupportStatusAction, submitSupportQuestionAction } from "@/lib/luckyDay/actions";
import { TAKUJITSU_SEARCH_MAX_DAYS } from "@/lib/takujitsu";
import { ACTIVITY_DEFINITIONS } from "@/lib/takujitsu/activity";
import type { ActivityEvaluation, ActivityVerdict } from "@/lib/takujitsu/activity";
import {
  getTodayInTokyo,
  addDaysToIso,
  addMonthsToIso,
  parseIsoDate,
  weekdayOfIso,
  formatIso,
  WEEKDAY_JA_SHORT,
  LUCKY_DAY_VERDICT_LABELS,
  LUCKY_DAY_VERDICT_ORDER,
  LUCKY_DAY_SEARCH_VERDICT_LABELS,
  getLuckyDayActivityLabel,
  LUCKY_DAY_PRIMARY_ACTIVITY_IDS,
  LUCKY_DAY_CATEGORY_GROUPS,
  getLuckyDayPurposes,
  LUCKY_DAY_ACTIVITY_GROUPS,
  getActivityGroup,
  DIRECTION_WHEEL_SLOTS,
  DIRECTION_SLOT_LABEL,
  getFreeMaxDateIso,
  isSearchRangeAllowed,
  FREE_DAYS_AHEAD,
} from "@/lib/luckyDay";
import type { LuckyDayPurpose, LuckyDayActivityGroup, DirectionWheelSlot, DirectionMarker } from "@/lib/luckyDay";
// 型のみのimport（コンパイル時に消去されるため、server-only の実体は
// Client Componentのバンドルには一切含まれない）。
import type { TakujitsuMemberStatus } from "@/lib/luckyDay/auth/member";
// 講座案内の表示判定（ID 2・3だけ、2026-10-20追加）。表示判定のみの純関数。
import { LUCKY_DAY_COURSE_URL, shouldShowCourseInvitation } from "@/lib/luckyDay/courseInvitation";
// GA4カスタムイベント（2026-10-20追加）。イベント名だけを送る（個人情報・検索条件は送らない）。
import { sendTakujitsuEvent } from "@/lib/luckyDay/analytics";
import {
  LUCKY_DAY_DOYO_NOTICE,
  isDoyoDayFromKyojin,
  splitDoyoRecommendedDays,
  splitDoyoRecommendedIds,
} from "@/lib/luckyDay/doyoRecommendation";
// 吉凶方位（directionMarkers）は Server Action（getDayDetailAction）側で
// 許可判定込みで計算・返却される。ここでは戻り値の型だけをimportする
// （calculateDailyDirections・buildDirectionWheelMarkersはクライアントでは
// 一切呼ばない。"use server"ファイルの型のみimportなので実体はバンドルに
// 含まれない）。
import type { DirectionMarkersBySlot } from "@/lib/luckyDay/actions";
// 生年月日による個人忌日判定（2026-09-20追加）。実際の判定
// （evaluatePersonalForBirth、src/lib/takujitsu/personal）は
// Server Action（getDayDetailAction/searchDaysAction）側でのみ呼ばれる。
// ここでは戻り値の型と、クライアントから送る生年月日の入力型だけを
// importする（型のみのimportなので実体はバンドルに含まれない）。
import type { LuckyDayBirthInput, PersonalTakujitsuResult, PersonalResultByDate } from "@/lib/luckyDay/actions";
// 会員専用 質問サポート（2026-09-20追加）。実際の月3回判定・二重送信防止・
// PMPro再確認・メール送信はすべてServer Action経由でWordPress側が行う
// （src/lib/luckyDay/actions.ts の getSupportStatusAction/
// submitSupportQuestionAction）。ここでは戻り値の型だけをimportする。
import type { SupportStatus, SupportQuestionContextInput } from "@/lib/luckyDay/actions";
// 時間の吉凶（ユーザー指示、2026-10-14）。型だけを import する
// （計算・時家720表はServer Action側だけで使い、クライアントへは結果だけを渡す）。
import type { LuckyDayHourFortune, LuckyDayHourSymbol } from "@/lib/luckyDay/actions";

// ---------------------------------------------------------------------------
// 既存 evaluateActivities() の evaluations には、その日その用事について
// 「宜」「忌」いずれかの根拠が1件以上ある場合のみエントリが入る（型定義
// ActivityEvaluation の docstring どおり neutral は「どちらも空」の状態）。
// つまり、あるactivityIdがevaluationsに存在しないこと自体が
// 「その日、その用事に関する宜/忌の根拠が既存エンジン上に一切無い」＝
// neutral（用いて良い）を意味する。これは新しい判定ロジックではなく、
// 既存 ActivityEvaluationResult の構造をそのまま読んだ結果であり、
// evaluateActivities() 自体は一切変更していない。
// ---------------------------------------------------------------------------
type VerdictGroups = Record<ActivityVerdict, string[]>;

function buildVerdictGroups(
  ids: readonly string[],
  evalById: Map<string, ActivityEvaluation>,
): VerdictGroups {
  const groups: VerdictGroups = { good: [], neutral: [], mixed: [], bad: [] };
  for (const id of ids) {
    const verdict = evalById.get(id)?.verdict ?? "neutral";
    groups[verdict].push(id);
  }
  return groups;
}

/** verdict別のidを、さらに表示専用グループ（activityGroups.ts）で束ねる。判定は変更しない。 */
type GroupedVerdict = { group: LuckyDayActivityGroup; ids: string[] }[];
type GroupedVerdictGroups = Record<ActivityVerdict, GroupedVerdict>;

function buildGroupedVerdictGroups(
  ids: readonly string[],
  evalById: Map<string, ActivityEvaluation>,
): GroupedVerdictGroups {
  const flat = buildVerdictGroups(ids, evalById);
  const result: GroupedVerdictGroups = { good: [], neutral: [], mixed: [], bad: [] };
  for (const v of LUCKY_DAY_VERDICT_ORDER) {
    const byGroup = new Map<LuckyDayActivityGroup, string[]>();
    for (const id of flat[v]) {
      const g = getActivityGroup(id);
      const arr = byGroup.get(g) ?? [];
      arr.push(id);
      byGroup.set(g, arr);
    }
    result[v] = LUCKY_DAY_ACTIVITY_GROUPS.filter((g) => byGroup.has(g)).map((g) => ({
      group: g,
      ids: byGroup.get(g)!,
    }));
  }
  return result;
}

// 通常表示（主要63活動）での各分類の初期表示件数。
// 「今日の吉凶をすべて見る」（109活動全体・用途グループ表示）ではこの
// 上限を適用しない（truncatable=false で呼び出す）。
const VERDICT_SECTION_INITIAL_LIMIT = 4;

function VerdictSection({
  verdict,
  ids,
  truncatable,
  expanded,
  onToggleExpand,
  grouped,
  notice,
}: {
  verdict: ActivityVerdict;
  /** 件数表示・truncate判定用の対象id一覧。 */
  ids: readonly string[];
  /** true の間だけ、4件超過時に「ほか○件を見る」で折りたたむ。 */
  truncatable: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  /**
   * 指定時は用途グループ別（見出し＋リスト）で表示する
   * （「109活動をすべて見る」時のみ使用。truncateはしない）。
   */
  grouped?: GroupedVerdict;
  /** 見出しの直下に出す注意文（土用中の推薦除外が1件以上あったときだけ渡す）。 */
  notice?: string;
}) {
  if (grouped) {
    return (
      <div className="ld-verdict-block" data-verdict={verdict}>
        <h3 className="ld-verdict-title">
          {LUCKY_DAY_VERDICT_LABELS[verdict]}（{ids.length}件）
        </h3>
        {notice && <p className="ld-doyo-note">{notice}</p>}
        {grouped.length === 0 ? (
          <p className="ld-verdict-empty">該当する項目はありません</p>
        ) : (
          grouped.map(({ group, ids: groupIds }) => (
            <div className="ld-verdict-subgroup" key={group}>
              <h4 className="ld-verdict-subgroup-title">{group}</h4>
              <ul className="ld-verdict-list">
                {groupIds.map((id) => (
                  <li key={id}>{getLuckyDayActivityLabel(id)}</li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    );
  }

  const shouldTruncate = truncatable && ids.length > VERDICT_SECTION_INITIAL_LIMIT;
  const visibleIds = shouldTruncate && !expanded ? ids.slice(0, VERDICT_SECTION_INITIAL_LIMIT) : ids;
  // 「ほか○件」の件数は常に実際の件数から算出する（ハードコードしない）。
  const hiddenCount = ids.length - VERDICT_SECTION_INITIAL_LIMIT;

  return (
    <div className="ld-verdict-block" data-verdict={verdict}>
      <h3 className="ld-verdict-title">{LUCKY_DAY_VERDICT_LABELS[verdict]}</h3>
      {notice && <p className="ld-doyo-note">{notice}</p>}
      {ids.length === 0 ? (
        <p className="ld-verdict-empty">該当する項目はありません</p>
      ) : (
        <>
          <ul className="ld-verdict-list">
            {visibleIds.map((id) => (
              <li key={id}>{getLuckyDayActivityLabel(id)}</li>
            ))}
          </ul>
          {shouldTruncate && (
            <button type="button" className="ld-expand-btn" onClick={onToggleExpand}>
              {expanded ? "閉じる" : `ほか${hiddenCount}件を見る`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 吉凶方位（八方位＋中宮の円盤）。
//
// calculateDailyDirections() の戻り値（DailyDirections）をそのまま受け取り、
// buildDirectionWheelMarkers()（src/lib/luckyDay/directionWheel.ts、表示専用の
// 区画対応づけ）で組み立てた9区画分のマーカーを描画するだけ。新しい方位判定・
// 統合・優先順位付け・点数化は一切行わない（同じ区画に吉凶両方のバッジが
// あれば両方そのまま表示する）。
// 円盤の見た目の配置（北を上に、時計回りに8方位、中央に中宮）だけがこの
// コンポーネントの責務で、CSS側は角度から算出した固定の座標（%）を使う。
// ---------------------------------------------------------------------------
// 八方位の「区画境界」の角度（北=0°を基準に時計回り。各方位の中心角
// 0/45/90/…/315°の中間＝22.5°刻みのオフセット）。方位の中心に線を引く
// のではなく、方位と方位の境界に引く、というユーザー指示に対応する。
const DIRECTION_BOUNDARY_ANGLES = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];

function DirectionWheel({
  markersBySlot,
}: {
  markersBySlot: Record<DirectionWheelSlot, DirectionMarker[]>;
}) {
  return (
    <div className="ld-dwheel-wrap">
      <div className="ld-dwheel" role="img" aria-label="吉凶方位（八方位盤）">
        <div className="ld-dwheel-ring" />
        <div className="ld-dwheel-spokes">
          {DIRECTION_BOUNDARY_ANGLES.map((angle) => (
            <div key={angle} className="ld-dwheel-spoke" style={{ transform: `rotate(${angle}deg)` }} />
          ))}
        </div>
        <div className="ld-dwheel-center-circle" />
        {DIRECTION_WHEEL_SLOTS.map((slot) => {
          const markers = markersBySlot[slot];
          return (
            <div key={slot} className="ld-dwheel-cell" data-slot={slot}>
              <div className="ld-dwheel-name">{DIRECTION_SLOT_LABEL[slot]}</div>
              {markers.length > 0 && (
                <div className="ld-dwheel-markers">
                  {markers.map((m, i) => (
                    <span key={i} className={`ld-dwheel-marker ld-dwheel-marker-${m.tone}`}>
                      {m.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="ld-dwheel-note">
        喜神・財神はその日の吉方位、太歳・五鬼は避けたい方位として表示しています。同じ方位に吉と凶が重なる場合は、どちらも表示します。
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 有料機能の案内（ユーザー指示、2026-09-19）。
// エラーではなく「この機能は有料会員でご利用いただけます」という趣旨を
// 分かりやすく表示し、既存のWordPress会員ログイン入口への導線を出す。
// すでに認証済み（無料会員）か未ログインかで文言を分け、
// 既存 MemberStatusBar の設計（ログイン導線の出し分け）を踏襲する。
// 価格は月額980円（税込）・年額8,800円（税込）固定（ユーザー指示の値）。
// ---------------------------------------------------------------------------
const MEMBER_LOGIN_URL = "https://fengshui.jp/?takujitsu_app_login=1";
// 新規会員登録・プラン確認の導線（ユーザー指示、2026-09-19）。
// 決済機能はNext.js側に実装せず、WordPress側の既存プランページへ誘導するだけ。
const MEMBER_SIGNUP_URL = "https://fengshui.jp/membership-levels";

function PaywallNotice({
  memberStatus,
  message = "この機能は有料会員でご利用いただけます。",
  variant = "full",
}: {
  memberStatus: TakujitsuMemberStatus;
  /** 案内文言（省略時は汎用文言）。用途に応じて具体的な文言を渡せる。 */
  message?: string;
  /**
   * "full"（既定）: 案内文＋価格一覧＋CTA（未ログイン時は「会員ログイン」、
   *   ログイン済み無料会員時は「会員プランを確認する」）。従来どおりの
   *   フル表示で、DayDetailCard全体の非表示時・検索結果の非表示時に使う。
   * "signupOnly": 未ログイン時だけ、案内文＋「新規会員登録・プランを見る」
   *   （価格一覧・「会員ログイン」は出さない。ページ上部に既に会員ログイン
   *   導線があるため重複させない、というユーザー指示、2026-09-19）。
   *   吉凶方位の無料版制限表示だけに使う。ログイン済み（無料会員）の
   *   場合は"full"と同じ表示にフォールバックする（未ログイン時の仕様
   *   のみ指定されているため）。
   */
  variant?: "full" | "signupOnly";
}) {
  if (variant === "signupOnly" && !memberStatus.authenticated) {
    return (
      <div className="ld-paywall">
        <p className="ld-paywall-text">{message}</p>
        <a className="ld-paywall-link" href={MEMBER_SIGNUP_URL} onClick={() => sendTakujitsuEvent("takujitsu_plan_click")}>
          新規会員登録・プランを見る
        </a>
      </div>
    );
  }

  return (
    <div className="ld-paywall">
      <p className="ld-paywall-text">{message}</p>
      <ul className="ld-paywall-plans">
        <li>月額 980円（税込）</li>
        <li>年額 8,800円（税込）</li>
      </ul>
      <a
        className="ld-paywall-link"
        href={MEMBER_LOGIN_URL}
        // 「会員プランを確認する」（ログイン済み無料会員）のときだけプランへのリンクとして計測する
        onClick={memberStatus.authenticated ? () => sendTakujitsuEvent("takujitsu_plan_click") : undefined}
      >
        {memberStatus.authenticated ? "会員プランを確認する" : "会員ログイン"}
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 婚姻系・葬墓系の「専門家への相談を促す注意情報」（ユーザー指示、
// 2026-09-20）。
//
// これは擇日判定ロジックではない。good/neutral/mixed/bad・個人忌日判定・
// 検索結果の件数や並び順・検索範囲には一切影響させない、表示のみの注意文。
// 無料/有料・生年月日入力の有無に関わらず、対象の目的が選ばれている間は
// 常に表示する。
//
// 対象範囲の決定方法（ユーザー指示、2026-09-20訂正）:
//   カテゴリー単位（life-marriage/other-funeral全体）の一括判定はやめ、
//   婚姻特有・葬墓特有の細かな忌日/凶殺の確認が必要な行為だけを、
//   activityId単位の明示的な集合で指定する。表示名の文字列検索はしない。
//
// 【婚姻系】結婚姻・嫁娶・納采・結婚納采のみを対象とする。
//   安床（新婚生活の寝床を整える）は対象から除外する（婚姻専用の行為では
//   ないため、life-marriageカテゴリーに属することだけを理由に婚姻専門
//   注意を表示してはいけない、というユーザー指示）。
//   嫁娶はsrc/lib/takujitsu/activity/activityDefinitions.tsには存在する
//   （id:"嫁娶"）が、src/lib/luckyDay/purposeMapping.tsには現時点で
//   対応する一般向け選択肢が存在しない（一般ユーザーはこのactivityIdを
//   選択できない）。新しく選択肢を追加することはせず、対象集合には
//   含めておく（一般向けUIに追加された時点で自動的に注意表示の対象になる）。
const MARRIAGE_ADVISORY_ACTIVITY_IDS = new Set(["結婚姻", "嫁娶", "納采", "結婚納采"]);

// 【葬墓系】安葬・破土・啓攢・啓墳のみを対象とする。
//   掃舎宇（墓を掃除する）・斎醮（供養を行う）は対象から除外する
//   （葬墓特有の細かな忌日・凶殺まで確認して実際の日取りを決定する必要が
//   ある行為＝葬儀・埋葬・火葬・破土・改葬・墓を開くこと、に限定し、
//   日常的な掃除・供養の儀式までは対象にしない、というユーザー指示）。
//   「墓の建立・改修・墓石工事」に明確に対応するactivityIdは、
//   activityDefinitions.ts（109項目）・purposeMapping.ts（一般向け目的
//   マッピング）のいずれにも見当たらなかった（啓墳＝「墓を開くこと」、
//   破土＝「埋葬のための穴を掘ること」であり、いずれも新規の墓の建立・
//   改修工事そのものを指す語ではない）。名称からの推測で新しい対応関係を
//   作ることはせず、対象には含めていない（詳細はチャット報告を参照）。
//   啓墳も嫁娶と同様、purposeMapping.tsには現時点で対応する一般向け
//   選択肢が存在しない（一般ユーザーは選択できない）。
const FUNERAL_ADVISORY_ACTIVITY_IDS = new Set(["安葬", "破土", "啓攢", "啓墳"]);

type ProfessionalAdvisoryKind = "marriage" | "funeral";

function getProfessionalAdvisoryKind(activityId: string | null | undefined): ProfessionalAdvisoryKind | null {
  if (!activityId) return null;
  if (MARRIAGE_ADVISORY_ACTIVITY_IDS.has(activityId)) return "marriage";
  if (FUNERAL_ADVISORY_ACTIVITY_IDS.has(activityId)) return "funeral";
  return null;
}

// 相談導線について（ユーザー指示、2026-09-20）: 既存サイト内に個別擇日の
// 相談・問い合わせ専用の導線（お問い合わせページ等）がコード上で確認できな
// かったため、今回は文章表示のみとし、リンクは付けない
// （MEMBER_LOGIN_URL・MEMBER_SIGNUP_URLはいずれも会員ログイン・プラン確認
// 導線であり、個別相談導線ではないため転用しない）。
const PROFESSIONAL_ADVISORY_TEXT: Record<ProfessionalAdvisoryKind, { title: string; body: string }> = {
  marriage: {
    title: "婚姻の日取りは、さらに詳しい確認をおすすめします",
    body: "結婚式や結納など婚姻に関する擇日では、この検索で確認している吉凶のほかにも、婚姻特有の細かな忌日や凶殺を避ける必要があります。実際の日取りを決める場合は、伝統風水師 秀山にご相談ください。",
  },
  funeral: {
    title: "葬儀・お墓の日取りは専門的な擇日が必要です",
    body: "葬儀・埋葬・改葬・お墓に関する工事などでは、この検索で確認している吉凶のほかにも、葬墓に関する細かな忌日や凶殺を避ける必要があります。実際の日取りを決める場合は、伝統風水師 秀山にご相談ください。",
  },
};

function ProfessionalAdvisoryNotice({ kind }: { kind: ProfessionalAdvisoryKind }) {
  const { title, body } = PROFESSIONAL_ADVISORY_TEXT[kind];
  return (
    <div className="ld-pro-advisory">
      <p className="ld-pro-advisory-title">{title}</p>
      <p className="ld-pro-advisory-text">{body}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 個人判定（生年月日による個人忌日判定、ユーザー指示 2026-09-20追加）。
//
// 表示する内容は既存 evaluatePersonalForBirth()（src/lib/takujitsu/
// personal、無変更）が返す status（"clear" | "avoid" | "undetermined"）を
// そのまま反映するだけで、新しい判定文言・新しい分類は作らない。
//   - "avoid"        : 該当した本命殺（相冲・三殺・三刑・箭刃）の名称を
//                       reasons からそのまま列挙する（既存の名称を変更しない）。
//   - "clear"        : 「該当しません」の趣旨を表示する。
//   - "undetermined" : 立春境界等で年命を確定できない、既存ロジックの
//                       判定不能状態をそのまま表示する（「問題なし」等の
//                       clear相当の文言に変換しては絶対にならない、という
//                       ユーザー指示に対応）。
// good/neutral/mixed/bad（通常の擇日判定）とは別ブロックとして表示し、
// 統合・スコア化はしない。
// ---------------------------------------------------------------------------
function PersonalJudgmentSection({ personal }: { personal: PersonalTakujitsuResult }) {
  return (
    <div className="ld-personal-block">
      <h3 className="ld-verdict-title ld-personal-heading">個人判定</h3>
      {personal.status === "avoid" && (
        <div className="ld-personal-avoid">
          <p className="ld-personal-avoid-title">本人には避けたい日</p>
          <ul className="ld-personal-reason-list">
            {personal.reasons.map((r, i) => (
              <li key={i}>{r.type}</li>
            ))}
          </ul>
        </div>
      )}
      {personal.status === "clear" && (
        <p className="ld-personal-clear">この生年月日による個人の忌日には該当しません。</p>
      )}
      {personal.status === "undetermined" && (
        <p className="ld-personal-undetermined">
          出生時刻の情報だけでは、この生年月日の年命（生まれ年の干支）を一意に確定できないため、個人の忌日判定はできません（立春の前後にあたる生年月日の可能性があります）。
        </p>
      )}
    </div>
  );
}

/**
 * 検索結果一覧の1日ぶんに付ける個人判定の小さな識別マーク（ユーザー指示、
 * 2026-09-20）。「本人には避けたい日」に該当する日を、通常の擇日判定
 * （good/neutral/mixed/bad）から消してしまうのではなく、明確に識別できる
 * ようにするためのもの。理由は既存 evaluatePersonalHonmeisatsu() が返す
 * type（相冲・三殺・三刑・箭刃）をそのまま列挙する。
 * personal未指定（＝個人判定を行っていない）・status==="clear"の場合は
 * 何も表示しない（一覧が煩雑にならないようにする。非該当の判定結果は
 * 日付詳細＝PersonalJudgmentSectionの方で確認できる）。
 */
function PersonalDayMarker({ personal }: { personal: PersonalTakujitsuResult | undefined }) {
  if (!personal) return null;
  if (personal.status === "avoid") {
    return (
      <div className="ld-result-personal ld-result-personal-avoid">
        本人には避けたい日（{personal.reasons.map((r) => r.type).join("・")}）
      </div>
    );
  }
  if (personal.status === "undetermined") {
    return <div className="ld-result-personal ld-result-personal-undetermined">個人判定：確認できません</div>;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 日別吉凶表示（今日／任意日／目的検索結果から開いた日、共通コンポーネント）
//
// 外部から制御するのは dateIso（表示対象日）とその変更通知だけ。
// 表示のオン/オフ（すべて見る・詳しい暦・日付選択欄の開閉、分類ごとの
// 「ほか○件」展開）はコンポーネント内部の状態として自己完結させる
// （「入力する日付だけを変える構造」というユーザー指示に対応）。
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 時間の吉凶（有料会員向け、ユーザー指示 2026-10-14）。
// hours は Server Action（getDayDetailAction）が有料会員のときだけ返す
// 12時辰の結果をそのまま表示する（記号・説明はサーバー側で確定済み）。
// 色だけに頼らず、必ず記号と説明を並べる。神殺名は表示しない。
// スマホ（900px未満）は2列のカード、PCは時間・記号・説明の一覧表にする。
// ---------------------------------------------------------------------------
const HOUR_SYMBOL_TONE: Readonly<Record<LuckyDayHourSymbol, "good" | "even" | "bad">> = {
  "◎": "good",
  "○": "good",
  "△": "even",
  "▽": "bad",
  "▼": "bad",
};

function HourlyFortuneSection({ hours }: { hours: LuckyDayHourFortune[] }) {
  return (
    <div className="ld-hours-block">
      <h3 className="ld-verdict-title ld-hours-heading">時間の吉凶</h3>
      <ul className="ld-hours-list">
        {hours.map((h) => (
          <li
            key={h.hourBranch}
            className="ld-hours-item"
            data-tone={HOUR_SYMBOL_TONE[h.symbol]}
            data-muyo={h.isMuyo ? "true" : undefined}
          >
            <span className="ld-hours-range">{h.range}</span>
            <span className="ld-hours-symbol" aria-hidden="true">
              {h.symbol}
            </span>
            <span className="ld-hours-desc">
              <span className="ld-visually-hidden">{`${h.symbol}：`}</span>
              {h.description}
            </span>
          </li>
        ))}
      </ul>
      <p className="ld-hours-note">
        23:00〜1:00 は、前日の23時から始まるこの日の最初の時間です。
        記号は、その時間にある吉神と凶神の数を比べたものです。
      </p>
    </div>
  );
}

/** 無料・未ログイン向けの簡潔な案内（時間の吉凶のデータはサーバーから受け取っていない）。 */
function HourlyFortuneLockedNotice() {
  return (
    <div className="ld-hours-block">
      <h3 className="ld-verdict-title ld-hours-heading">時間の吉凶</h3>
      <div className="ld-hours-locked">
        <p className="ld-hours-locked-text">1日12の時間帯ごとの吉凶は、有料会員向けの機能です。</p>
        <a className="ld-upsell-link" href={MEMBER_SIGNUP_URL} onClick={() => sendTakujitsuEvent("takujitsu_plan_click")}>
          会員プランを見る
        </a>
      </div>
    </div>
  );
}

function DayDetailCard({
  dateIso,
  onDateChange,
  memberStatus,
  birth,
  dateRole = "auto",
}: {
  dateIso: string;
  onDateChange: (iso: string) => void;
  memberStatus: TakujitsuMemberStatus;
  /**
   * 生年月日による個人忌日判定の入力（ユーザー指示、2026-09-20追加）。
   * null＝未入力。実際にServer Action側で計算されるかどうか
   * （有料会員かどうか）はここでは判定しない（サーバー側の
   * computePersonalResultForDay()が唯一の判定箇所）。
   */
  birth: LuckyDayBirthInput | null;
  /**
   * 見出し（「今日の吉凶」等）の文言をどう決めるか（ユーザー指示、
   * 2026-09-20回帰修正）。
   *   "auto"（既定・左カラム＝今日の吉凶で使用、現状どおり変更なし）:
   *     dateIso===today なら「今日」、それ以外は「この日」。
   *     日付を実際に変更できる左カラムでは、この自動判定のままでよい。
   *   "selected"（右カラム＝目的から吉日を探す、検索結果から開いた日の
   *     詳細表示でのみ使用）:
   *     dateIsoが今日と一致するかどうかに関わらず、常に「選択した日」に
   *     固定する。検索結果から選んだ日をたまたま今日の日付を検索して
   *     開いた場合でも「今日の吉凶」という見出しにならないようにする
   *     （左カラム「今日の吉凶」との混同を防ぐため。役割はどちらの
   *     カラム／文脈で表示しているかで決まるのであって、日付が今日と
   *     一致するかどうかでは決まらない、という区別）。
   */
  dateRole?: "auto" | "selected";
}) {
  const today = useMemo(() => getTodayInTokyo(), []);
  const isToday = dateIso === today.iso;
  const dayContextLabel = dateRole === "selected" ? "選択した日" : isToday ? "今日" : "この日";
  // 有料会員判定は既存仕様どおり memberStatus.active のみを見る
  // （active===true は既に levelId∈{2,3,4,5} を意味する、既存の唯一の判定）。
  // ここでの isPaid はUI（日付ピッカーの表示/非表示等）の制御にしか使わない。
  // 実際のアクセス許可はServer Action（getDayDetailAction）がサーバー側で
  // 再判定するため、この値を書き換えても取得できるデータは変わらない。
  const isPaid = memberStatus.active;

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [expandedVerdicts, setExpandedVerdicts] = useState<Record<ActivityVerdict, boolean>>({
    good: false,
    neutral: false,
    mixed: false,
    bad: false,
  });
  function toggleVerdictExpand(v: ActivityVerdict) {
    setExpandedVerdicts((prev) => ({ ...prev, [v]: !prev[v] }));
  }

  // データ取得はServer Action（getDayDetailAction）経由に統一する
  // （calculateTakujitsuFull()自体は変更しないが、呼び出しは常にサーバー側。
  // 無料ユーザーが許可範囲外の日付を指定した場合はdenied状態になり、
  // 既存エンジンは呼ばれない＝計算結果を一切受け取れない）。
  //
  // 吉凶方位（directionMarkers）は data 本体とは別に許可判定される
  // （ユーザー指示、2026-09-19仕様修正）: 無料ユーザーは「今日」だけ許可。
  // 30日以内の検索結果から開いた今日以外の日は、data（擇日判定・詳細暦）は
  // 返るが directionMarkers は null になる。これは表示側で隠しているのでは
  // なく、Server Action（getDayDetailAction）側で許可されない場合は
  // calculateDailyDirections()自体を呼ばずnullを返す＝方位データそのものが
  // クライアントに渡らない構造になっている。
  type FetchState =
    | { status: "loading" }
    | {
        status: "ok";
        data: TakujitsuFullResult;
        directionMarkers: DirectionMarkersBySlot | null;
        /** null＝個人判定を行っていない（無料/未ログイン、または生年月日未入力）。 */
        personal: PersonalTakujitsuResult | null;
        /** null＝時間の吉凶を受け取っていない（未ログイン・無料会員）。 */
        hours: LuckyDayHourFortune[] | null;
      }
    | { status: "denied" }
    | { status: "error"; message: string };
  const [fetchState, setFetchState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setFetchState({ status: "loading" });
    getDayDetailAction(dateIso, birth ?? undefined)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setFetchState({
            status: "ok",
            data: res.data,
            directionMarkers: res.directionMarkers,
            personal: res.personal,
            hours: res.hours,
          });
        } else if (res.reason === "not_allowed") {
          setFetchState({ status: "denied" });
        } else {
          setFetchState({ status: "error", message: "この日の情報を取得できませんでした。" });
        }
      })
      .catch(() => {
        if (!cancelled) setFetchState({ status: "error", message: "通信に失敗しました。時間をおいて再度お試しください。" });
      });
    return () => {
      cancelled = true;
    };
  }, [dateIso, birth]);

  const data = fetchState.status === "ok" ? fetchState.data : null;
  const directionMarkers = fetchState.status === "ok" ? fetchState.directionMarkers : null;
  const personal = fetchState.status === "ok" ? fetchState.personal : null;
  const hours = fetchState.status === "ok" ? fetchState.hours : null;

  const evalById = useMemo(() => {
    const map = new Map<string, ActivityEvaluation>();
    if (data) for (const e of data.activities.evaluations) map.set(e.activityId, e);
    return map;
  }, [data]);

  // 一般向けの土用推薦除外（doyoRecommendation.ts、2026-10-24）。土用にかかる日
  // （その日の凶神に土王用事がある日）は、建築・工事系の対象用事を「適したこと」から
  // 外す。凶へは移さず、元の判定（evalById）はそのまま。
  const isDoyoDay = isDoyoDayFromKyojin(data?.shinsatsu.kyojin ?? []);
  const primaryGroups = useMemo(() => {
    const groups = buildVerdictGroups(LUCKY_DAY_PRIMARY_ACTIVITY_IDS, evalById);
    const { kept, excluded } = splitDoyoRecommendedIds(groups.good, isDoyoDay);
    return { groups: { ...groups, good: kept }, doyoExcludedCount: excluded.length };
  }, [evalById, isDoyoDay]);
  const allGroupedByVerdict = useMemo(() => {
    const grouped = buildGroupedVerdictGroups(ACTIVITY_DEFINITIONS.map((d) => d.id), evalById);
    const good = grouped.good
      .map(({ group, ids }) => ({ group, ids: splitDoyoRecommendedIds(ids, isDoyoDay).kept }))
      .filter(({ ids }) => ids.length > 0);
    return { ...grouped, good };
  }, [evalById, isDoyoDay]);
  const allFlatCounts = useMemo(() => {
    const groups = buildVerdictGroups(ACTIVITY_DEFINITIONS.map((d) => d.id), evalById);
    const { kept, excluded } = splitDoyoRecommendedIds(groups.good, isDoyoDay);
    return { groups: { ...groups, good: kept }, doyoExcludedCount: excluded.length };
  }, [evalById, isDoyoDay]);
  const doyoExcludedCount = showAll ? allFlatCounts.doyoExcludedCount : primaryGroups.doyoExcludedCount;

  const dateParts = parseIsoDate(dateIso);
  const dateLabel = `${dateParts.year}年${dateParts.month}月${dateParts.day}日（${WEEKDAY_JA_SHORT[weekdayOfIso(dateIso)]}）`;

  // 「主な吉神・主な凶神」: 既存 resolution 結果のうち、凶意が解除
  // （cancelled）されていないものだけを表示する。resolution自体の
  // ロジック・判定は一切変更していない（表示用のフィルタのみ）。
  const activeKichijin = data?.resolution.kichijin.filter((e) => e.status !== "cancelled") ?? [];
  const activeKyojin = data?.resolution.kyojin.filter((e) => e.status !== "cancelled") ?? [];

  function statusNote(status: string): string | null {
    if (status === "reduced") return "軽減";
    if (status === "aggravated") return "増悪";
    if (status === "pending") return "要確認";
    return null;
  }

  return (
    <div className="ld-daycard">
      <h2 className="ld-section-title">{dayContextLabel}の吉凶</h2>

      {fetchState.status === "loading" && <p className="ld-loading">読み込み中…</p>}
      {fetchState.status === "error" && <p className="ld-error">{fetchState.message}</p>}
      {fetchState.status === "denied" && <PaywallNotice memberStatus={memberStatus} />}

      {data && (
        <>
          <div className="ld-date-row">
            <p className="ld-date">{dateLabel}</p>
            {/*
              「日付を変更する」「今日に戻る」（有料）・「任意の日付は
              有料会員限定」（無料）は、いずれも“任意の日付を自由に選び直す”
              ための導線であり、左カラム「今日の吉凶」（dateRole="auto"）
              専用の機能である（ユーザー指示、2026-09-20回帰修正）。
              検索結果から開いた「選択した日の吉凶」（dateRole="selected"）
              では、ここで別の日付へ切り替えることはせず、
              「← 吉日検索の結果に戻る」（呼び出し側のボタン、状態は
              保持されたまま）→一覧から選び直す、という流れに一本化する。
              以前この区別がなく isPaid だけで判定していたため、検索結果
              詳細にも「日付を変更する」「今日に戻る」が意図せず出ていた
              （dateRoleは見出し文言の切替にしか使っていなかった）。
            */}
            {dateRole !== "selected" &&
              (isPaid ? (
                <div className="ld-date-actions">
                  <button
                    type="button"
                    className="ld-link-btn ld-link-btn-small"
                    onClick={() => setShowDatePicker((s) => !s)}
                  >
                    {showDatePicker ? "日付選択を閉じる" : "日付を変更する"}
                  </button>
                  {!isToday && (
                    <button
                      type="button"
                      className="ld-link-btn ld-link-btn-small"
                      onClick={() => onDateChange(today.iso)}
                    >
                      今日に戻る
                    </button>
                  )}
                </div>
              ) : (
                // 無料ユーザーには「任意日付の直接指定」自体を提供しない
                // （ユーザー指示）。実際のアクセス制御はServer Action側だが、
                // UI上もこの導線を出さないことで無料/有料の違いを明確にする。
                <a className="ld-upsell-link" href="https://fengshui.jp/?takujitsu_app_login=1">
                  任意の日付は有料会員限定
                </a>
              ))}
          </div>

          {dateRole !== "selected" && isPaid && showDatePicker && (
            <input
              type="date"
              className="ld-date-input"
              value={dateIso}
              onChange={(e) => e.target.value && onDateChange(e.target.value)}
            />
          )}

          <p className="ld-cal-brief">
            日干支：{data.calendar.dayStem}
            {data.calendar.dayBranch}／十二直：{data.buildingDay.name}
            {data.shuku28 ? `／二十八宿：${data.shuku28.lodge}宿` : ""}
          </p>

          <h3 className="ld-verdict-title ld-dwheel-heading">吉凶方位</h3>
          {directionMarkers ? (
            <DirectionWheel markersBySlot={directionMarkers} />
          ) : (
            // 無料ユーザーが「今日」以外の日（30日以内の検索結果から開いた日等）を
            // 見ている場合。directionMarkersはServer Action側で最初から
            // null として返されており（計算自体を行っていない）、ここは
            // その事実をそのまま表示するだけ。
            // variant="signupOnly"（ユーザー指示、2026-09-19）: ページ上部に
            // 既に「会員ログイン」導線があるため、ここでは重複させず、
            // 未ログイン時は案内文＋「新規会員登録・プランを見る」だけを出す。
            <PaywallNotice
              memberStatus={memberStatus}
              message="会員になると吉凶方位をご利用いただけます。"
              variant="signupOnly"
            />
          )}

          {/*
            時間の吉凶（ユーザー指示、2026-10-14追加）。吉凶方位の直後に置く。
            hours は Server Action側で有料会員のときだけ計算される（null の
            場合はデータ自体を受け取っていない）。表示の出し分けは isPaid では
            なく hours の有無で行う（サーバーが返した事実だけを表示する）。
          */}
          {hours ? <HourlyFortuneSection hours={hours} /> : <HourlyFortuneLockedNotice />}

          {/*
            個人判定（ユーザー指示、2026-09-20追加）。通常の擇日判定
            （「適した日」「用いて良い日」「注意点のある日」「避けたい日」）
            とは別レイヤーとして表示する。personal は Server Action側で
            有料会員＋有効な生年月日が指定された場合のみ計算される
            （null＝個人判定を行っていない。無料/未ログイン・生年月日未入力
            のいずれの場合もこの節自体を表示しない）。
          */}
          {personal && <PersonalJudgmentSection personal={personal} />}

          {LUCKY_DAY_VERDICT_ORDER.map((v) => (
            <VerdictSection
              key={v}
              verdict={v}
              ids={showAll ? allFlatCounts.groups[v] : primaryGroups.groups[v]}
              truncatable={!showAll}
              expanded={expandedVerdicts[v]}
              onToggleExpand={() => toggleVerdictExpand(v)}
              grouped={showAll ? allGroupedByVerdict[v] : undefined}
              notice={v === "good" && doyoExcludedCount > 0 ? LUCKY_DAY_DOYO_NOTICE : undefined}
            />
          ))}

          <div className="ld-today-actions">
            <button type="button" className="ld-link-btn" onClick={() => setShowAll((s) => !s)}>
              {showAll ? "主要な項目だけ表示する" : `${dayContextLabel}の吉凶をすべて見る`}
            </button>
            <button type="button" className="ld-link-btn" onClick={() => setShowDetail((s) => !s)}>
              {showDetail ? "詳しい暦を閉じる" : `${dayContextLabel}の詳しい暦を見る`}
            </button>
          </div>

          {showDetail && (
            <div className="ld-detail">
              <dl className="ld-detail-list">
                <dt>日干支</dt>
                <dd>
                  {data.calendar.dayStem}
                  {data.calendar.dayBranch}
                </dd>

                <dt>十二建除</dt>
                <dd>
                  {data.buildingDay.name}（{data.buildingDay.reading}）
                </dd>

                {data.shuku28 && (
                  <>
                    <dt>二十八宿</dt>
                    <dd>
                      {data.shuku28.lodge}宿（{data.shuku28.reading}・{data.shuku28.shukuYo}）
                    </dd>
                  </>
                )}

                <dt>主な吉神</dt>
                <dd>
                  {activeKichijin.length === 0
                    ? "特にありません"
                    : activeKichijin
                        .map((e) => (statusNote(e.status) ? `${e.name}（${statusNote(e.status)}）` : e.name))
                        .join("・")}
                </dd>

                <dt>主な凶神</dt>
                <dd>
                  {activeKyojin.length === 0
                    ? "特にありません"
                    : activeKyojin
                        .map((e) => (statusNote(e.status) ? `${e.name}（${statusNote(e.status)}）` : e.name))
                        .join("・")}
                </dd>
              </dl>
            </div>
          )}

          {/*
            将来拡張ポイント（今回は未実装、ユーザー指示 2026-09-19）:
            「その日の吉凶方位」（八方位盤）をここに追加すると、
            今日／任意日／目的検索結果から開いた日のすべてに自動的に
            反映される（dateIso を渡すだけで済む構造）。
            方位判定ロジック・円盤描画は今回一切実装していない。
          */}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 「大切な日の選定について」の補足説明（ユーザー指示、2026-09-20）。
// 無料版だけに表示する注記。無料版の判定結果を否定・警告するものではなく、
// 「暦から見た吉凶」と「使用する人の生年月日との関係」は別の観点である
// ことを補足するだけの説明文（文言のみの追加）。
// 生年月日の入力欄・個人別忌日判定は今回実装しない。将来の有料機能を
// 示すボタンや「近日公開」等も追加しない（ユーザー指示）。
// 有料会員（memberStatus.active）には表示しない。
// ---------------------------------------------------------------------------
function TakujitsuAdvisoryNotice() {
  return (
    <div className="ld-advisory">
      <h2 className="ld-advisory-title">大切な日の選定について</h2>
      <p className="ld-advisory-text">
        この無料版では、暦から見た日の吉凶を表示しています。実際の擇日では、これに加えて使用する人の生年月日との関係を調べ、本人にとって避けるべき日を除外していきます。そのため、結婚・新築・入居・開業など重要な日を選ぶ場合には、暦だけではなく個人との関係まで含めた判断が必要です。
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 会員状態の小さな表示（ユーザー指示、2026-09-19）。
// デザインの大改修はせず、ページ上部に控えめに表示するだけ。
// 実際の無料/有料の機能制限は DayDetailCard・「目的から吉日を探す」側
// （Server Action経由）で行う。ここは表示のみ。
// ---------------------------------------------------------------------------
function MemberStatusBar({ memberStatus }: { memberStatus: TakujitsuMemberStatus }) {
  if (!memberStatus.authenticated) {
    return (
      <div className="ld-member-status">
        <a className="ld-member-link" href={MEMBER_LOGIN_URL}>
          会員ログイン
        </a>
        <a className="ld-member-signup-link" href={MEMBER_SIGNUP_URL} onClick={() => sendTakujitsuEvent("takujitsu_plan_click")}>
          新規会員登録・プランを見る
        </a>
      </div>
    );
  }

  const label = memberStatus.active
    ? `有料会員${memberStatus.levelId === 2 ? "（月額）" : memberStatus.levelId === 3 ? "（年額）" : ""}`
    : "ログイン済み";

  return (
    <div className="ld-member-status">
      <span className={`ld-member-badge${memberStatus.active ? " ld-member-badge-paid" : ""}`}>{label}</span>
      <form method="POST" action="/lucky-day/logout" className="ld-member-logout-form">
        <button type="submit" className="ld-member-logout-btn">
          ログアウト
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 擇日入門通信講座の案内（ユーザー指示、2026-10-20）。
// 月額（ID 2）・年額（ID 3）会員だけに、控えめに出す（2026-10-20 配置再修正）。
//   PC（900px以上）: 右側「目的から吉日を探す」パネル内の一番下（placement="pc"）。
//   スマホ: ページ全体の最下部（placement="sp"）。
//   両方を描画し、CSS（.ld-course-invite-pc / -sp）で画面幅に応じて片方だけを表示する。
// 講座会員（ID 4・5）・無料会員・未ログインには出さない
// （判定は shouldShowCourseInvitation()、src/lib/luckyDay/courseInvitation.ts）。
// ---------------------------------------------------------------------------
function CourseInvitation({ placement }: { placement: "pc" | "sp" }) {
  return (
    <aside className={`ld-course-invite ld-course-invite-${placement}`} aria-label="擇日入門通信講座のご案内">
      <p className="ld-course-invite-title">通書を使って擇日を学んでみませんか？</p>
      <p className="ld-course-invite-text">台湾の通書を教材に、十二建除・二十八宿・神殺などを学ぶ通信講座です。</p>
      <a className="ld-course-invite-link" href={LUCKY_DAY_COURSE_URL} onClick={() => sendTakujitsuEvent("takujitsu_course_click")}>
        擇日入門通信講座の詳細を見る
      </a>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// 生年月日専用カレンダー入力（ユーザー指示、2026-09-20。標準
// <input type="date"> はSafariで年の直接選択がしづらく、数十年前まで
// 遡る生年月日入力には不向きなため、軽量な自前カレンダーUIに変更する）。
//
// 外部DatePickerライブラリは使わず、既存のReact/TypeScript/CSSのみで
// 実装する。擇日計算・暦計算（CalendarEngine・astro.ts等）は一切参照
// しない、単純なグレゴリオ暦のカレンダー描画（表示専用のUI部品）。
//
// 年（1900〜今日の年）・月（1〜12）はプルダウンで直接選択でき、
// 一操作で数十年前へ移動できる。日はカレンダーからクリックして選ぶ。
// 年月プルダウンは「表示中の年月」を切り替えるだけの状態であり、
// birthIso（実際に確定した生年月日）とは独立している＝日をクリックする
// まで birthIso は空のまま（ユーザー指示: 生年月日を勝手に設定しない）。
// ---------------------------------------------------------------------------
function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}
function firstWeekdayOfMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12 - 1, 1).getDay();
}
function isoOfYmd(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function BirthCalendarPicker({
  value,
  onChange,
  maxIso,
}: {
  /** "YYYY-MM-DD"、または未選択を表す空文字。 */
  value: string;
  onChange: (iso: string) => void;
  /** 選択可能な最終日（今日、Asia/Tokyo）。これより後の日はクリック不可にする。 */
  maxIso: string;
}) {
  const maxYear = Number(maxIso.slice(0, 4));
  const maxMonth = Number(maxIso.slice(5, 7));
  const parsedValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseIsoDate(value) : null;

  // 表示中の年月（＝カレンダーがどの月を表示しているか）。生年月日が
  // 未選択の間は、操作しやすい適切な初期値（今日の年-30・今日の月）を
  // 表示するだけで、これ自体はbirthIsoの確定を意味しない。
  const [viewYear, setViewYear] = useState(parsedValue?.year ?? maxYear - 30);
  const [viewMonth, setViewMonth] = useState(parsedValue?.month ?? maxMonth);

  const yearOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYear; y >= 1900; y--) arr.push(y);
    return arr;
  }, [maxYear]);

  function goToPrevMonth() {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function goToNextMonth() {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const firstWeekday = firstWeekdayOfMonth(viewYear, viewMonth);
  const totalDays = daysInMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedLabel = parsedValue
    ? `${parsedValue.year}年${parsedValue.month}月${parsedValue.day}日`
    : null;

  return (
    <div className="ld-birth-calendar">
      <div className="ld-birth-calendar-controls">
        <button type="button" className="ld-birth-calendar-navbtn" onClick={goToPrevMonth} aria-label="前月">
          ‹
        </button>
        <select
          className="ld-birth-calendar-select"
          value={viewYear}
          onChange={(e) => setViewYear(Number(e.target.value))}
          aria-label="生年（年）"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
        <select
          className="ld-birth-calendar-select"
          value={viewMonth}
          onChange={(e) => setViewMonth(Number(e.target.value))}
          aria-label="生年月日（月）"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}月
            </option>
          ))}
        </select>
        <button type="button" className="ld-birth-calendar-navbtn" onClick={goToNextMonth} aria-label="翌月">
          ›
        </button>
      </div>

      <div className="ld-birth-calendar-weekdays">
        {WEEKDAY_JA_SHORT.map((w) => (
          <div key={w} className="ld-birth-calendar-weekday">
            {w}
          </div>
        ))}
      </div>

      <div className="ld-birth-calendar-grid">
        {cells.map((d, i) => {
          if (d === null) {
            return <div key={i} className="ld-birth-calendar-cell ld-birth-calendar-cell-empty" />;
          }
          const iso = isoOfYmd(viewYear, viewMonth, d);
          const isFuture = iso > maxIso;
          const isSelected = value === iso;
          const isTodayCell = iso === maxIso;
          return (
            <button
              type="button"
              key={i}
              className={`ld-birth-calendar-cell${isSelected ? " is-selected" : ""}${isTodayCell ? " is-today" : ""}`}
              disabled={isFuture}
              onClick={() => onChange(iso)}
            >
              {d}
            </button>
          );
        })}
      </div>

      {selectedLabel && <p className="ld-birth-calendar-selected">選択中：{selectedLabel}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 生年月日による個人忌日判定の入力（有料会員限定、ユーザー指示 2026-09-20）。
//
// 「今日の吉凶」「目的から吉日を探す」いずれの操作も邪魔しないよう、
// ページ最上部（MemberStatusBarの直後・スマホタブより前）に1つだけ置く
// 共通入力。実際にここへ入力しても、無料/未ログインユーザーは
// evaluatePersonalForBirth() の結果を一切取得できない（Server Action側の
// computePersonalResultForDay()がisPaidを再確認するため。ここでの表示制御は
// あくまでUI上の案内であり、セキュリティ境界ではない）。
//
// 無料/未ログイン: 入力欄そのものを表示しない（操作可能にしない、という
// ユーザー指示）。既存のPaywallNotice（価格・会員ログイン導線）をそのまま
// 再利用し、新しい価格表示・導線は作らない。
// ---------------------------------------------------------------------------
function PersonalBirthInputCard({
  memberStatus,
  birthIso,
  onChangeBirthIso,
}: {
  memberStatus: TakujitsuMemberStatus;
  /** "YYYY-MM-DD"、または未入力を表す空文字。 */
  birthIso: string;
  onChangeBirthIso: (v: string) => void;
}) {
  const isPaid = memberStatus.active;
  // 生年月日なので未来日は選択不可（ユーザー指示、2026-09-20）。
  // カレンダーUI側の disabled はあくまで補助的な制約にすぎず、
  // 実際の拒否は Server Action 側（isValidLuckyDayBirthInput）が行う。
  const today = useMemo(() => getTodayInTokyo(), []);

  // カレンダーの開閉状態（ユーザー指示、2026-09-20：常時表示だと大きすぎる
  // ため、未設定時は「生年月日を選択」ボタン、選択済みは確定値＋「変更」
  // ボタンの表示にし、カレンダー自体は必要な時だけ開く）。
  const [isOpen, setIsOpen] = useState(false);
  const parsedBirth = /^\d{4}-\d{2}-\d{2}$/.test(birthIso) ? parseIsoDate(birthIso) : null;
  const birthLabel = parsedBirth ? `${parsedBirth.year}年${parsedBirth.month}月${parsedBirth.day}日` : null;

  function handleSelectDate(iso: string) {
    onChangeBirthIso(iso);
    setIsOpen(false); // 選択した瞬間にカレンダーを閉じ、確定値の表示へ切り替える
  }

  return (
    <section className="ld-card ld-personal-input-card">
      <h2 className="ld-section-title">生年月日から個人の忌日を除外</h2>
      <p className="ld-personal-input-desc">
        生年月日をもとに、一般的には使用できる日でも、本人にとって避けたほうがよい日を確認できます。
      </p>
      {isPaid ? (
        <div className="ld-personal-input-field">
          <span className="ld-personal-input-label">生年月日</span>

          {!isOpen && (
            <div className="ld-birth-summary">
              {birthLabel ? (
                <>
                  <span className="ld-birth-summary-value">{birthLabel}</span>
                  <button type="button" className="ld-link-btn ld-link-btn-small" onClick={() => setIsOpen(true)}>
                    変更
                  </button>
                </>
              ) : (
                <button type="button" className="ld-link-btn" onClick={() => setIsOpen(true)}>
                  生年月日を選択
                </button>
              )}
            </div>
          )}

          {isOpen && <BirthCalendarPicker value={birthIso} onChange={handleSelectDate} maxIso={today.iso} />}
        </div>
      ) : (
        <PaywallNotice memberStatus={memberStatus} message="生年月日による個人判定は有料会員でご利用いただけます。" />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 会員専用 質問サポート（有料会員限定、ユーザー指示 2026-09-20）。
//
// 対象は「擇日アプリの使い方・擇日の考え方や技法・表示された吉凶の意味・
// 表示結果の見方」であり、個別の事情を踏まえて具体的な案件の最適日時を
// 選定する「個別擇日」は対象外（案内文で伝えるだけで、機械的な内容判定は
// しない）。
//
// 重要（セキュリティ、既存の設計を踏襲）:
//   月3回の上限・当月（Asia/Tokyo基準）の算出・冪等キーによる二重送信
//   防止・PMPro会員（levelId 2/3）の再確認・wp_mail()送信は、すべて
//   Server Action（getSupportStatusAction/submitSupportQuestionAction）
//   経由でWordPress側が行う唯一の正である。ここではisPaidをUI表示の
//   ヒントとしてのみ使い（フォーム自体を出す/出さない）、実際の送信可否は
//   Server Action側が毎回getCurrentTakujitsuMember()を呼び直して独立に
//   再判定する。ブラウザからWordPress REST APIを直接呼ぶことはない。
//   会員のWordPress登録メールアドレスはNext.js/ブラウザには一切渡さない
//   （WordPress側がget_userdata()から取得し、管理者メールのReply-Toに
//   設定するだけ）。
//
// 冪等キー（二重送信防止、ユーザー指示）:
//   フォームを開いた時点で1回だけ crypto.randomUUID() を生成し、送信
//   ボタンの連打・通信リトライはすべて同じキーで送る。送信成功後は
//   次の質問のために新しいキーを発行し直す。実際の重複排除は
//   WordPress側が原子的に行う（このキーはあくまでその照合用の値）。
// ---------------------------------------------------------------------------
function SupportQuestionCard({
  memberStatus,
  context,
}: {
  memberStatus: TakujitsuMemberStatus;
  /**
   * 質問回数には一切影響しない参考情報（省略可）。ユーザーが「目的から
   * 吉日を探す」で検索結果の日付詳細を見ている場合にだけ、呼び出し側
   * （LuckyDayClient本体）が現在の日付・カテゴリー・用事から組み立てて
   * 渡す。それ以外の通常画面では undefined（＝参考情報なしで質問できる）。
   */
  context?: SupportQuestionContextInput;
}) {
  const isPaid = memberStatus.active;

  type StatusState =
    | { phase: "loading" }
    | { phase: "ok"; data: SupportStatus }
    | { phase: "error" };
  const [statusState, setStatusState] = useState<StatusState>({ phase: "loading" });

  const [questionText, setQuestionText] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  type SubmitState =
    | { phase: "idle" }
    | { phase: "submitting" }
    | { phase: "success"; message: string }
    | { phase: "error"; message: string };
  const [submitState, setSubmitState] = useState<SubmitState>({ phase: "idle" });

  useEffect(() => {
    if (!isPaid) return;
    let cancelled = false;
    setStatusState({ phase: "loading" });
    getSupportStatusAction()
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setStatusState({ phase: "ok", data: res.data });
        } else {
          setStatusState({ phase: "error" });
        }
      })
      .catch(() => {
        if (!cancelled) setStatusState({ phase: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [isPaid]);

  if (!isPaid) {
    return (
      <section className="ld-card ld-support-card">
        <h2 className="ld-support-title">会員専用 質問サポート</h2>
        <PaywallNotice memberStatus={memberStatus} message="質問サポートは有料会員でご利用いただけます。" />
      </section>
    );
  }

  async function handleSubmit() {
    if (submitState.phase === "submitting") return;
    if (questionText.trim().length === 0) return;
    setSubmitState({ phase: "submitting" });
    try {
      const res = await submitSupportQuestionAction({ idempotencyKey, questionText, context });
      if (res.ok) {
        setStatusState((prev) => ({
          phase: "ok",
          data: {
            used: res.used,
            limit: res.limit,
            remaining: res.remaining,
            month: prev.phase === "ok" ? prev.data.month : "",
          },
        }));
        setQuestionText("");
        // 次の質問のために新しい冪等キーを発行する（前回のキーは
        // 「送信済み」としてWordPress側に記録されたまま残る）。
        setIdempotencyKey(crypto.randomUUID());
        setSubmitState({ phase: "success", message: "質問を受け付けました。" });
        return;
      }
      if (res.reason === "limit_reached") {
        setSubmitState({
          phase: "error",
          message: "今月の質問サポートは3回ご利用済みです。翌月から再びご利用いただけます。",
        });
      } else if (res.reason === "invalid_input") {
        setSubmitState({ phase: "error", message: "質問内容をご確認のうえ、再度お試しください。" });
      } else if (res.reason === "not_allowed") {
        setSubmitState({ phase: "error", message: "この機能は有料会員でご利用いただけます。" });
      } else if (res.reason === "duplicate") {
        setSubmitState({ phase: "error", message: "この質問は処理中、または既に送信済みです。" });
      } else {
        // mail_failed / network_error
        setSubmitState({ phase: "error", message: "送信に失敗しました。時間をおいて再度お試しください。" });
      }
    } catch {
      setSubmitState({ phase: "error", message: "送信に失敗しました。時間をおいて再度お試しください。" });
    }
  }

  const limitReached = statusState.phase === "ok" && statusState.data.remaining <= 0;

  return (
    <section className="ld-card ld-support-card">
      <h2 className="ld-support-title">会員専用 質問サポート</h2>

      {statusState.phase === "loading" && <p className="ld-loading">読み込み中…</p>}
      {statusState.phase === "error" && (
        <p className="ld-error">利用状況を取得できませんでした。時間をおいて再度お試しください。</p>
      )}

      {statusState.phase === "ok" && (
        <>
          <p className="ld-support-usage">
            今月の質問利用回数　{statusState.data.used} / {statusState.data.limit}回
          </p>
          <p className="ld-support-desc">
            アプリの使い方や表示された吉凶についてご質問いただけます。具体的な案件の最適日時を選定する個別擇日は対象外です。
          </p>

          {limitReached ? (
            <p className="ld-support-limit-reached">
              今月の質問サポートは3回ご利用済みです。翌月から再びご利用いただけます。
            </p>
          ) : (
            <>
              <textarea
                className="ld-support-textarea"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="質問内容をご記入ください"
                disabled={submitState.phase === "submitting"}
              />
              <button
                type="button"
                className="ld-search-btn"
                onClick={handleSubmit}
                disabled={submitState.phase === "submitting" || questionText.trim().length === 0}
              >
                {submitState.phase === "submitting" ? "送信中…" : "質問を送信"}
              </button>
            </>
          )}

          {submitState.phase === "success" && <p className="ld-support-success">{submitState.message}</p>}
          {submitState.phase === "error" && <p className="ld-error">{submitState.message}</p>}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
/** takujitsu_app_open を送信済みか（ページ読み込みごとに false から始まる）。 */
let appOpenSent = false;

export default function LuckyDayClient({
  memberStatus,
  devModeActive = false,
}: {
  memberStatus: TakujitsuMemberStatus;
  /**
   * 開発専用オーバーライドが有効かどうか（ユーザー指示、2026-09-20）。
   * page.tsx（Server Component）がisDevPaidMemberOverrideEnabled()
   * （src/lib/luckyDay/auth/member.ts）の結果をそのまま渡す。
   * 本番ビルド・本番環境では常にfalseになる
   * （NODE_ENV==="development"かつTAKUJITSU_DEV_PAID_MEMBER==="true"の
   * 両方を満たすローカル開発環境限定）。表示用の値であり、実際の
   * アクセス許可はServer Action側が独立に再確認する。
   */
  devModeActive?: boolean;
}) {
  const today = useMemo(() => getTodayInTokyo(), []);

  // GA4: アプリの表示（ページ読み込み1回につき1回だけ。再描画・開発時の二重マウントでは送らない）。
  useEffect(() => {
    if (appOpenSent) return;
    appOpenSent = true;
    sendTakujitsuEvent("takujitsu_app_open");
  }, []);

  // 「今日の吉凶」（PC・スマホとも常時1つだけ表示。初期値は今日。任意日にも変更可能）。
  const [leftDateIso, setLeftDateIso] = useState(() => today.iso);

  // スマホ（900px未満）専用のタブ状態。「今日の吉凶」／「目的から吉日を
  // 探す」のどちらを表示するか。PC（900px以上）ではCSS側で両方を常時
  // 表示するため、この状態は参照されない（2カラムのまま変更なし）。
  const [mobileTab, setMobileTab] = useState<"today" | "purpose">("today");

  // 目的検索結果から開いた指定日詳細（非nullの間は目的検索UIの代わりに
  // これを表示する。DayDetailCardは通常画面では左に1つだけ表示し、
  // ここでは検索結果を開いている間だけ一時的に表示する＝同時に2つ
  // 表示することはない）。
  const [resultDetailIso, setResultDetailIso] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // 生年月日による個人忌日判定（ユーザー指示、2026-09-20追加。2026-09-20
  // カレンダー入力UIへ変更）。
  // ページ全体で1つだけ保持する共有の入力（「今日の吉凶」「目的から吉日を
  // 探す」いずれの DayDetailCard・検索にも同じ値を渡す）。DBへの恒久保存は
  // 行わない（ページを開くたびに入力する方式。ユーザー指示）。
  // input type="date" が扱う "YYYY-MM-DD" 形式の文字列をそのまま状態として
  // 持つ（未入力は空文字）。有効な生年月日として揃った場合だけ
  // birthInput（LuckyDayBirthInput）を組み立てる。未来日を含む妥当性検証
  // 自体は行わない（クライアント側はUIヒントにすぎず、実際の拒否は
  // Server Action側のisValidLuckyDayBirthInputが行う。ユーザー指示）。
  const [birthIso, setBirthIso] = useState("");
  const birthInput: LuckyDayBirthInput | null = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthIso)) return null;
    const { year, month, day } = parseIsoDate(birthIso);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    return { year, month, day };
  }, [birthIso]);

  // ---------------------------------------------------------------------------
  // 「目的から吉日を探す」（①大カテゴリー→②具体的目的→③検索期間→④検索→⑤結果）
  // ---------------------------------------------------------------------------
  const [selectedCategoryItemId, setSelectedCategoryItemId] = useState<string | null>(null);
  const [selectedPurposeId, setSelectedPurposeId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(() => today.iso);
  const [toDate, setToDate] = useState(() => addDaysToIso(today.iso, 30));
  const [searchResult, setSearchResult] = useState<{
    data: TakujitsuSearchResult | null;
    error: string | null;
    /** 無料ユーザーの許可範囲外だった場合はtrue（エラー文言ではなく有料案内を表示する）。 */
    denied: boolean;
    /** null＝個人判定を行っていない（無料/未ログイン、または生年月日未入力）。 */
    personalByDate: PersonalResultByDate | null;
    /** 検索期間のうち土用にかかる日（"YYYY-MM-DD"）。一般向けの土用推薦除外だけに使う。 */
    doyoDates?: string[];
  }>({
    data: null,
    error: null,
    denied: false,
    personalByDate: null,
  });
  const [searchLoading, setSearchLoading] = useState(false);

  // 有料会員判定は既存仕様どおり memberStatus.active のみ（DayDetailCardと同じ）。
  // 日付入力のmin/max属性・クイックボタンの有効/無効はここでのUIヒントに
  // すぎず、実際の許可判定はSearver Action（searchDaysAction）がサーバー側で
  // 独立に再実行する。
  const isPaid = memberStatus.active;
  const freeMaxDateIso = getFreeMaxDateIso(today.iso);

  const purposesForSelectedCategory: readonly LuckyDayPurpose[] = selectedCategoryItemId
    ? getLuckyDayPurposes(selectedCategoryItemId)
    : [];
  const selectedPurpose: LuckyDayPurpose | null =
    purposesForSelectedCategory.find((p) => p.id === selectedPurposeId) ?? null;

  // 会員専用 質問サポートへ添付する「参考情報」（ユーザー指示、
  // 2026-09-20）。ユーザーが「目的から吉日を探す」で検索結果の日付詳細
  // （resultDetailIso）を見ている場合にだけ、現在の日付・選択カテゴリー・
  // 選択した用事を組み立てる。それ以外（通常画面・検索結果一覧表示中等）
  // では undefined にし、参考情報なしで質問できるようにする
  // （質問回数には一切影響しない付加情報）。
  const selectedCategoryLabel = useMemo(() => {
    if (!selectedCategoryItemId) return undefined;
    for (const group of LUCKY_DAY_CATEGORY_GROUPS) {
      const item = group.items.find((i) => i.id === selectedCategoryItemId);
      if (item) return item.label;
    }
    return undefined;
  }, [selectedCategoryItemId]);
  const supportContext: SupportQuestionContextInput | undefined = resultDetailIso
    ? { dateIso: resultDetailIso, categoryLabel: selectedCategoryLabel, purposeLabel: selectedPurpose?.label }
    : undefined;

  // ①大カテゴリー（カテゴリー項目）選択: 以前選択していた②具体的目的を解除し、
  // 古い検索結果も消す（ユーザー指示: 別カテゴリー選択時に具体的目的を解除する）。
  function handleSelectCategoryItem(itemId: string) {
    setSelectedCategoryItemId((cur) => (cur === itemId ? null : itemId));
    setSelectedPurposeId(null);
    setSearchResult({ data: null, error: null, denied: false, personalByDate: null });
  }

  // ②具体的目的の選択・変更: 古い検索結果を消す（ユーザー指示）。
  function handleSelectPurpose(purposeId: string) {
    setSelectedPurposeId((cur) => (cur === purposeId ? null : purposeId));
    setSearchResult({ data: null, error: null, denied: false, personalByDate: null });
  }

  // ③検索期間の変更: 条件が変わるため、古い検索結果を消す。
  function handleFromDateChange(v: string) {
    setFromDate(v);
    setSearchResult({ data: null, error: null, denied: false, personalByDate: null });
  }
  function handleToDateChange(v: string) {
    setToDate(v);
    setSearchResult({ data: null, error: null, denied: false, personalByDate: null });
  }
  // クイックボタン: 開始日を基準に終了日を自動計算する（入力補助。
  // 終了日はこの後も手動で変更できる＝期間を固定しない）。
  // 1ヶ月・3ヶ月は無料ユーザーには無効化して出す（下のJSX側）ため、
  // ここでは特に会員判定はしない（無効化されたボタンはそもそも押せない）。
  function applyQuickPeriod(days: number | null, months: number | null) {
    const computedTo = months != null ? addMonthsToIso(fromDate, months) : addDaysToIso(fromDate, days! - 1);
    handleToDateChange(computedTo);
  }

  // ④検索: 既存 searchTakujitsuDays() は Server Action（searchDaysAction）
  // 経由でのみ呼ぶ（独自ロジック無し。判定ロジックは一切変更しない）。
  // ここでの isSearchRangeAllowed() 呼び出しは即時フィードバック用の
  // UIヒントにすぎない。実際のアクセス許可はサーバー側で
  // getCurrentTakujitsuMember() を呼び直して独立に再判定するため、
  // この呼び出し自体を省略・改ざんしても366日検索や過去日検索を
  // 突破することはできない。
  async function runSearch() {
    if (!selectedPurpose) return;

    const clientCheck = isSearchRangeAllowed(fromDate, toDate, today.iso, isPaid);
    if (!clientCheck.allowed) {
      if (clientCheck.reason === "invalid_range") {
        setSearchResult({ data: null, error: "終了日は開始日と同じか、それより後の日付にしてください。", denied: false, personalByDate: null });
        return;
      }
      if (clientCheck.reason === "range_too_long") {
        setSearchResult({ data: null, error: `検索期間は${TAKUJITSU_SEARCH_MAX_DAYS}日以内にしてください。`, denied: false, personalByDate: null });
        return;
      }
      // past_start / too_far_ahead: 無料ユーザーの許可範囲外＝有料案内。
      setSearchResult({ data: null, error: null, denied: true, personalByDate: null });
      return;
    }

    // GA4: 目的を指定した検索を実行したとき（入力チェック通過後）だけ送る。検索条件は送らない。
    sendTakujitsuEvent("takujitsu_date_search");
    setSearchLoading(true);
    try {
      // timezone: Asia/Tokyo。baseHour/baseMinuteは指定せず、既存の
      // 既定値（12:00・子刻の日柱境界を跨がない正午基準）をそのまま使う。
      // birth: isPaidでない場合もそのまま渡してよい（サーバー側の
      // searchDaysAction/computePersonalResultForDayがmember.activeを
      // 独立に再判定し、無料ユーザーには常にpersonalByDate: nullを返す）。
      const res = await searchDaysAction({
        activityId: selectedPurpose.activityId,
        from: fromDate,
        to: toDate,
        birth: birthInput ?? undefined,
      });
      if (res.ok) {
        setSearchResult({ data: res.data, error: null, denied: false, personalByDate: res.personalByDate, doyoDates: res.doyoDates });
      } else if (res.reason === "not_allowed") {
        setSearchResult({ data: null, error: null, denied: true, personalByDate: null });
      } else {
        setSearchResult({ data: null, error: res.message ?? "検索に失敗しました。", denied: false, personalByDate: null });
      }
    } catch (e) {
      setSearchResult({ data: null, error: e instanceof Error ? e.message : String(e), denied: false, personalByDate: null });
    } finally {
      setSearchLoading(false);
    }
  }

  // ⑤結果: good/neutral/mixed/bad を統合せず、別々の配列のまま分類する
  // （既存 TakujitsuSearchDay.verdict をそのまま読むだけ。日ごとの
  // フォールバック ?? "neutral" は searchTakujitsuDays() 側で既に適用済み）。
  // 一般向けの土用推薦除外（doyoRecommendation.ts）：対象用事の検索では、土用にかかる日を
  // 「適した日」から外し、外した日数だけを表示する（凶へは移さない）。
  const { searchResultGroups, searchDoyoExcludedCount } = useMemo(() => {
    const groups: Record<ActivityVerdict, TakujitsuSearchDay[]> = { good: [], neutral: [], mixed: [], bad: [] };
    for (const d of searchResult.data?.days ?? []) {
      groups[d.verdict].push(d);
    }
    if (!searchResult.data) return { searchResultGroups: groups, searchDoyoExcludedCount: 0 };
    const { kept, excludedCount } = splitDoyoRecommendedDays(
      groups.good,
      searchResult.data.activityId,
      new Set(searchResult.doyoDates ?? []),
    );
    return { searchResultGroups: { ...groups, good: kept }, searchDoyoExcludedCount: excludedCount };
  }, [searchResult.data, searchResult.doyoDates]);

  // 検索結果の日付／カードをクリック → 指定日詳細（DayDetailCard）へ。
  // カテゴリー・具体的目的・期間・検索結果はすべて上の state に残ったまま
  // なので、「← 吉日検索の結果に戻る」で再検索せずに戻れる。
  // スマホで「今日の吉凶」タブを見ている状態から検索結果を開く、という
  // 状況は起こり得ない（検索結果自体が「目的から吉日を探す」タブの中に
  // しかない）が、念のため「目的から吉日を探す」タブへ切り替えておく。
  function openResultDayDetail(d: TakujitsuSearchDay) {
    setResultDetailIso(formatIso(d.year, d.month, d.day));
    setMobileTab("purpose");
  }

  return (
    <main className="ld-page">
      <style>{CSS}</style>

      {/*
        開発専用オーバーライドの表示（ユーザー指示、2026-09-20）。
        devModeActiveはローカル開発環境（NODE_ENV==="development"かつ
        TAKUJITSU_DEV_PAID_MEMBER==="true"）でのみtrueになり、本番
        ビルド・本番環境では常にfalseのためこのバナー自体が出ない。
      */}
      {devModeActive && <div className="ld-dev-banner">開発モード：有料会員</div>}

      <header className="ld-hero">
        <h1 className="ld-hero-title">吉日を調べる</h1>
        <p className="ld-hero-lead">
          伝統的な擇日の考え方をもとに、今日の吉凶や、目的に合った日を調べることができます。
        </p>
      </header>

      <MemberStatusBar memberStatus={memberStatus} />

      {/*
        「生年月日から個人の忌日を除外」ブロックは有料会員（isPaid、
        levelId∈{2,3,4,5}）にだけ表示する（ユーザー指示、2026-09-20。ID 4・5は2026-10-09追加）。
        無料/未ログインでは見出し・説明文・価格案内・会員ログイン
        ボタンを含めブロック自体を一切描画しない（PersonalBirthInputCard
        自体をマウントしない）。ページ上部から「今日の吉凶」「目的から
        吉日を探す」へ自然につながるようにするための表示条件変更のみで、
        右上の会員ログイン・新規会員登録導線（MemberStatusBar）は
        無料/未ログインでも従来どおり表示され続ける。
        isPaid は memberStatus.active（既存の唯一の有料判定、devPaidMember
        オーバーライド適用時も含む）をそのまま使う。
      */}
      {isPaid && (
        <PersonalBirthInputCard memberStatus={memberStatus} birthIso={birthIso} onChangeBirthIso={setBirthIso} />
      )}

      {/*
        スマホ（900px未満）専用タブ。「今日の吉凶」⇔「目的から吉日を探す」の
        切替をページ最上部（導入文の直後・DayDetailCardより前）に置き、
        長くスクロールしなくても目的検索へ切り替えられるようにする。
        PC（900px以上）ではCSSで非表示にする（2カラム構成は変更しない）。
      */}
      <div className="ld-mobile-tabs">
        <button
          type="button"
          className={`ld-mobile-tab${mobileTab === "today" ? " is-active" : ""}`}
          onClick={() => setMobileTab("today")}
        >
          今日の吉凶
        </button>
        <button
          type="button"
          className={`ld-mobile-tab${mobileTab === "purpose" ? " is-active" : ""}`}
          onClick={() => setMobileTab("purpose")}
        >
          目的から吉日を探す
        </button>
      </div>

      <div className="ld-layout">
        {/*
          今日の吉凶（PC・スマホとも常時1つだけ表示する主機能）。
          DayDetailCardは通常画面ではここに1つだけ置く（右側に複製しない）。
          スマホでは ld-mobile-tabs の選択に応じて ld-mobile-hidden で
          表示/非表示を切り替える（display:noneだけで、アンマウントはしない
          ＝内部state・日付選択は保持される）。PCでは常に表示する。
        */}
        <div className={`ld-col-left${mobileTab === "today" ? "" : " ld-mobile-hidden"}`}>
          <section className="ld-card">
            <DayDetailCard dateIso={leftDateIso} onDateChange={setLeftDateIso} memberStatus={memberStatus} birth={birthInput} />
          </section>
        </div>

        {/*
          目的から吉日を探す。
          スマホでは ld-mobile-tabs の選択に応じて表示/非表示（上と同様、
          display:noneのみでstateは保持される）。PCでは常に表示する
          （旧・開閉スイッチは廃止。今回のユーザー指示により削除）。
        */}
        <div className={`ld-col-right${mobileTab === "purpose" ? "" : " ld-mobile-hidden"}`}>
          <section className="ld-card ld-purpose-panel">
            <h2 className="ld-section-title">目的から吉日を探す</h2>

            <div className="ld-purpose-body">
              {resultDetailIso ? (
                <>
                  <button
                    type="button"
                    className="ld-back-btn"
                    onClick={() => setResultDetailIso(null)}
                  >
                    ← 吉日検索の結果に戻る
                  </button>
                  <DayDetailCard
                    dateIso={resultDetailIso}
                    onDateChange={setResultDetailIso}
                    memberStatus={memberStatus}
                    birth={birthInput}
                    dateRole="selected"
                  />
                </>
              ) : (
                <>
                  <p className="ld-search-lead">
                    引越し、新築、開業、結婚など、予定していることに適した日を探せます。
                  </p>

                  {/* ①大カテゴリーを選ぶ */}
                  <h3 className="ld-step-title">カテゴリーを選ぶ</h3>
                  {LUCKY_DAY_CATEGORY_GROUPS.map((group) => (
                    <div className="ld-cat-group" key={group.id}>
                      <h4 className="ld-cat-group-title">{group.title}</h4>
                      <div className="ld-cat-items">
                        {group.items.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            className={`ld-cat-item${selectedCategoryItemId === item.id ? " is-selected" : ""}`}
                            onClick={() => handleSelectCategoryItem(item.id)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* ②具体的な目的を選ぶ */}
                  {selectedCategoryItemId && (
                    <div className="ld-purpose-group">
                      <h3 className="ld-step-title">具体的な目的を選ぶ</h3>
                      {purposesForSelectedCategory.length === 0 ? (
                        <p className="ld-search-note">より専門的な目的については、今後追加予定です。</p>
                      ) : (
                        <div className="ld-cat-items">
                          {purposesForSelectedCategory.map((p) => (
                            <button
                              type="button"
                              key={p.id}
                              className={`ld-cat-item${selectedPurposeId === p.id ? " is-selected" : ""}`}
                              onClick={() => handleSelectPurpose(p.id)}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ③検索期間を選ぶ・④検索する */}
                  {selectedPurpose && (
                    <div className="ld-period-group">
                      {/*
                        婚姻系・葬墓系の専門家相談の注意情報（ユーザー指示、
                        2026-09-20）。擇日判定ロジックではなく、選択した目的の
                        activityIdが対象集合に含まれる間は無料/有料・生年月日
                        入力の有無に関わらず常に表示する。検索条件（検索期間を
                        選ぶ）の直前に配置する。
                      */}
                      {getProfessionalAdvisoryKind(selectedPurpose.activityId) && (
                        <ProfessionalAdvisoryNotice kind={getProfessionalAdvisoryKind(selectedPurpose.activityId)!} />
                      )}

                      <h3 className="ld-step-title">検索期間を選ぶ</h3>

                      <div className="ld-quick-period-buttons">
                        <button
                          type="button"
                          className="ld-quick-period-btn"
                          onClick={() => applyQuickPeriod(3, null)}
                        >
                          3日間
                        </button>
                        <button
                          type="button"
                          className="ld-quick-period-btn"
                          onClick={() => applyQuickPeriod(7, null)}
                        >
                          1週間
                        </button>
                        <button
                          type="button"
                          className="ld-quick-period-btn"
                          disabled={!isPaid}
                          title={isPaid ? undefined : "1ヶ月検索は有料会員限定です"}
                          onClick={() => applyQuickPeriod(null, 1)}
                        >
                          1ヶ月
                        </button>
                        <button
                          type="button"
                          className="ld-quick-period-btn"
                          disabled={!isPaid}
                          title={isPaid ? undefined : "3ヶ月検索は有料会員限定です"}
                          onClick={() => applyQuickPeriod(null, 3)}
                        >
                          3ヶ月
                        </button>
                      </div>
                      {!isPaid && (
                        <p className="ld-search-note">
                          無料版で検索できるのは今日から{FREE_DAYS_AHEAD}日先までです。1ヶ月・3ヶ月検索や過去日の検索は
                          <a className="ld-upsell-link" href={MEMBER_LOGIN_URL}>
                            有料会員
                          </a>
                          でご利用いただけます。
                        </p>
                      )}

                      <div className="ld-period-inputs">
                        <label className="ld-period-field">
                          開始日
                          <input
                            type="date"
                            className="ld-date-input"
                            value={fromDate}
                            min={isPaid ? undefined : today.iso}
                            max={isPaid ? undefined : freeMaxDateIso}
                            onChange={(e) => handleFromDateChange(e.target.value)}
                          />
                        </label>
                        <label className="ld-period-field">
                          終了日
                          <input
                            type="date"
                            className="ld-date-input"
                            value={toDate}
                            min={isPaid ? undefined : today.iso}
                            max={isPaid ? undefined : freeMaxDateIso}
                            onChange={(e) => handleToDateChange(e.target.value)}
                          />
                        </label>
                      </div>

                      <button type="button" className="ld-search-btn" onClick={runSearch} disabled={searchLoading}>
                        {searchLoading ? "検索中…" : "この目的の吉日を探す"}
                      </button>

                      {searchResult.error && <p className="ld-error">{searchResult.error}</p>}
                      {searchResult.denied && <PaywallNotice memberStatus={memberStatus} />}
                    </div>
                  )}

                  {/* ⑤結果表示 */}
                  {searchResult.data && (
                    <div className="ld-result-group">
                      <h3 className="ld-step-title">「{selectedPurpose?.label}」に適した日</h3>

                      {/* 検索結果の分かりやすい位置にも同じ注意情報を表示する（ユーザー指示）。 */}
                      {getProfessionalAdvisoryKind(selectedPurpose?.activityId) && (
                        <ProfessionalAdvisoryNotice kind={getProfessionalAdvisoryKind(selectedPurpose?.activityId)!} />
                      )}

                      {LUCKY_DAY_VERDICT_ORDER.map((v) => (
                        <div className="ld-result-verdict" data-verdict={v} key={v}>
                          <h4 className="ld-result-verdict-title">
                            {LUCKY_DAY_SEARCH_VERDICT_LABELS[v]}（{searchResultGroups[v].length}件）
                          </h4>
                          {v === "good" && searchDoyoExcludedCount > 0 && (
                            <p className="ld-doyo-note">土用期間のためおすすめ対象外：{searchDoyoExcludedCount}日</p>
                          )}
                          {searchResultGroups[v].length === 0 ? (
                            <p className="ld-verdict-empty">該当する日はありません</p>
                          ) : (
                            <ul className="ld-result-list">
                              {searchResultGroups[v].map((d) => (
                                <li key={`${d.year}-${d.month}-${d.day}`}>
                                  <button
                                    type="button"
                                    className="ld-result-day"
                                    onClick={() => openResultDayDetail(d)}
                                  >
                                    <div className="ld-result-day-date">
                                      {d.year}年{d.month}月{d.day}日（{WEEKDAY_JA_SHORT[d.weekday]}）・
                                      {LUCKY_DAY_SEARCH_VERDICT_LABELS[v]}
                                    </div>
                                    <div className="ld-result-day-info">
                                      日干支：{d.dayStem}
                                      {d.dayBranch}／十二直：{d.buildingDay}
                                      {d.shuku28 ? `／二十八宿：${d.shuku28}宿` : ""}
                                    </div>
                                    <PersonalDayMarker personal={searchResult.personalByDate?.[formatIso(d.year, d.month, d.day)]} />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 講座案内（PC）。検索・検索結果・日の詳細のどの表示でも、右側パネルの一番下。 */}
            {shouldShowCourseInvitation(memberStatus) && <CourseInvitation placement="pc" />}
          </section>
        </div>
      </div>

      {/*
        「会員専用 質問サポート」（ユーザー指示、2026-09-20：ページ下部へ
        移動）。擇日アプリの主要機能（今日の吉凶／目的から吉日を探す）より
        後ろに置く補助機能として、有料会員（isPaid）にだけ表示する。
        無料/未ログインでは見出しごとブロック自体を描画しない。
        月3回制限・WordPress API呼び出し・冪等キーによる送信処理・
        有料会員表示条件はいずれも変更していない（配置だけの変更）。
      */}
      {isPaid && <SupportQuestionCard memberStatus={memberStatus} context={supportContext} />}

      {/*
        「大切な日の選定について」（ユーザー指示、2026-09-20）。
        今日の吉凶・吉凶方位・目的から吉日を探す、いずれの操作の間にも
        挟まず、ページ最下部（両カラムの外側）に置く。スマホでどちらの
        タブを見ていても両カラムの下に表示され、検索結果や日の詳細を
        確認したあとに自然に目に入る位置になる。無料版（isPaid===false）
        だけに表示し、有料会員には表示しない。
      */}
      {!isPaid && <TakujitsuAdvisoryNotice />}

      {/* 講座案内（スマホ）。どちらのタブを表示していても、ページ全体の最下部。 */}
      {shouldShowCourseInvitation(memberStatus) && <CourseInvitation placement="sp" />}
    </main>
  );
}

// ---------------------------------------------------------------------------
// スタイル（一般向け・スマホ最優先。専門家向け画面の盤・専門ツール的な
// 見た目はコピーしない。白基調・落ち着いた和の雰囲気・過度な装飾なし。
// 吉凶は色だけに依存せず、必ず文字ラベルを併記する。
// PC（min-width: 900px）では左右2カラム。スマホは縦一列・横スクロール無し。）
// ---------------------------------------------------------------------------
const CSS = `
.ld-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 20px 16px 48px;
  background: #faf9f5;
  color: #2c2a26;
  font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif;
  line-height: 1.7;
}

/*
  開発専用オーバーライドの表示（ユーザー指示、2026-09-20）。目立ちすぎず
  かつ「本番の実際の会員状態ではない」ことが分かる配色（既存の有料バッジ
  ld-member-badge-paidとは別の、注意喚起寄りの配色）にする。
*/
.ld-dev-banner {
  margin: 0 0 12px;
  padding: 4px 10px;
  border-radius: 6px;
  background: #fdf3d9;
  color: #7a5b0a;
  font-size: 11px;
  font-weight: 700;
  display: inline-block;
}

.ld-hero { margin-bottom: 20px; }
.ld-hero-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: #263a33;
}
.ld-hero-lead { margin: 0; font-size: 14px; color: #55524b; }

/* 会員状態の小さな表示（ユーザー指示、2026-09-19）。デザインの大改修はしない。 */
.ld-member-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin: -6px 0 16px;
  font-size: 12px;
}
.ld-member-link {
  color: #3a5568;
  text-decoration: underline;
}
.ld-member-link:hover { color: #263a33; }
/* 「新規会員登録・プランを見る」: 未ログイン時だけ表示する、やや目立つ
   導線（既存の.ld-search-btn等と同系統のダーク塗りピル）。既存の
   「会員ログイン」（控えめなテキストリンク）とは視覚的に役割を分ける。
   決済機能はここでは実装せず、WordPress側の既存プランページへ
   リンクするだけ（href="https://fengshui.jp/membership-levels"）。 */
.ld-member-signup-link {
  padding: 4px 12px;
  border-radius: 999px;
  background: #263a33;
  color: #ffffff;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}
.ld-member-signup-link:hover { background: #1c2c27; }
.ld-member-badge {
  padding: 3px 10px;
  border-radius: 999px;
  background: #f1efe6;
  color: #6a675e;
  font-weight: 700;
}
.ld-member-badge-paid { background: #e6f4ea; color: #1a7f37; }
.ld-member-logout-form { margin: 0; }
.ld-member-logout-btn {
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  font-size: 12px;
  color: #8a8677;
  text-decoration: underline;
  cursor: pointer;
}
.ld-member-logout-btn:hover { color: #263a33; }

/* 擇日入門通信講座の案内（ID 2・3だけ、2026-10-20）。操作の邪魔にならない控えめな枠。 */
.ld-course-invite {
  margin: 0 0 12px;
  padding: 8px 14px;
  border: 1px solid #e3dfd2;
  border-radius: 10px;
  background: #faf8f2;
  font-size: 13px;
  color: #55524b;
}
.ld-course-invite-title {
  margin: 0 0 2px;
  font-size: 14px;
  font-weight: 700;
  color: #263a33;
}
.ld-course-invite-text { margin: 0; line-height: 1.6; }
.ld-course-invite-link {
  display: inline-block;
  margin-top: 2px;
  color: #3a5568;
  font-weight: 700;
  text-decoration: underline;
}
.ld-course-invite-link:hover { color: #263a33; }
/* 配置（2026-10-20）: スマホはページ最下部（-sp）、PCは右側パネルの一番下（-pc）だけを表示する。 */
.ld-course-invite-pc { display: none; }
.ld-course-invite-sp { margin: 16px 0 0; }
@media (min-width: 900px) {
  .ld-course-invite-pc { display: block; margin: 20px 0 0; }
  .ld-course-invite-sp { display: none; }
}

/*
  スマホ専用タブ（「今日の吉凶」⇔「目的から吉日を探す」）。
  2つとも同じ幅（flex:1）で横並びにし、選択中のタブは塗りつぶしで
  明確に区別する。900px以上（PC）ではCSSで非表示にする。
*/
.ld-mobile-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}
.ld-mobile-tab {
  flex: 1 1 0;
  min-width: 0;
  appearance: none;
  background: #f1efe6;
  border: 1px solid #d9d4c4;
  border-radius: 8px;
  padding: 12px 8px;
  font-size: 14px;
  font-weight: 700;
  color: #6a675e;
  cursor: pointer;
  text-align: center;
}
.ld-mobile-tab:hover { background: #e9e5d7; }
.ld-mobile-tab.is-active {
  background: #263a33;
  border-color: #263a33;
  color: #ffffff;
}
.ld-mobile-tab.is-active:hover { background: #1c2c27; }

.ld-layout {
  display: block;
  min-width: 0;
}
.ld-col-left, .ld-col-right {
  min-width: 0;
}
/* スマホでは選択されていない側を非表示にする（displayのみ。
   コンポーネントはアンマウントしないため内部state・検索結果は保持される）。
   PCでは @media (min-width: 900px) で常時表示に戻す。 */
.ld-mobile-hidden { display: none; }

.ld-card {
  background: #ffffff;
  border: 1px solid #e7e3d9;
  border-radius: 12px;
  padding: 18px 16px;
  margin-bottom: 20px;
  min-width: 0;
}

.ld-section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 700;
  color: #263a33;
  border-left: 4px solid #7a8f7c;
  padding-left: 10px;
}

/* 「具体的な目的を選ぶ」「検索期間を選ぶ」などの操作ステップ見出し。
   カテゴリー名（ld-cat-group-title、小さく控えめ）とは明確に区別する。 */
.ld-step-title {
  margin: 18px 0 10px;
  font-size: 15px;
  font-weight: 700;
  color: #263a33;
  padding-left: 8px;
  border-left: 3px solid #a9bcac;
}
.ld-step-title:first-of-type { margin-top: 4px; }

.ld-back-btn {
  appearance: none;
  background: none;
  border: none;
  padding: 0 0 14px;
  font-size: 13px;
  color: #3a5568;
  text-decoration: underline;
  cursor: pointer;
  display: block;
}
.ld-back-btn:hover { color: #263a33; }

.ld-date-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.ld-date { margin: 0; font-size: 17px; font-weight: 700; }
.ld-date-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.ld-link-btn-small { padding: 6px 10px; font-size: 12px; }
.ld-cal-brief { margin: 10px 0 16px; font-size: 13px; color: #6a675e; }
.ld-daycard .ld-date-input { display: block; margin: 8px 0 4px; }

/*
  吉凶方位（八方位＋中宮の円盤）。専門家版 /takujitsu の3×3表とは違い、
  一般向けに「方位を見る」ことが直感的に分かる円形レイアウトにする。
  座標（%）は円周上の8方位（北=0°として時計回りに45°刻み）を
  x=50+r*sin(θ), y=50-r*cos(θ)（r≈42）で算出した固定値。
  白基調・落ち着いた配色を維持し、吉＝緑系／凶＝赤系のみで色分けする。
*/
.ld-dwheel-heading { margin-top: 18px; }
.ld-dwheel-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 6px 0 18px;
}
.ld-dwheel {
  position: relative;
  width: 100%;
  max-width: 300px;
  aspect-ratio: 1 / 1;
}
.ld-dwheel-ring {
  position: absolute;
  inset: 9%;
  border-radius: 50%;
  border: 1px solid #e2ded2;
  background: #fbfaf5;
}

/*
  八方位の区画境界線（ユーザー指示、2026-09-19）。方位の中心（0/45/90…°）
  ではなく、方位と方位の境界（22.5°刻みのオフセット）に線を引く。
  中宮の円（ld-dwheel-center-circle）の外周から、外周円（ld-dwheel-ring）の
  外周までだけを描画し、中宮の内部は線が通らないようにする（各スポークの
  linear-gradientで中心寄りの前半を透明にすることで実現。中宮の円自体も
  スポークの上に重ねて描画し、二重に中宮内部を隠す）。
*/
.ld-dwheel-spokes {
  position: absolute;
  inset: 9%; /* ld-dwheel-ringと同じ円（外周半径の基準）を共有する */
}
.ld-dwheel-spoke {
  position: absolute;
  left: 50%;
  bottom: 50%;
  width: 1px;
  margin-left: -0.5px;
  height: 50%; /* ld-dwheel-spokes自身の半径ぶん（＝外周円の半径） */
  transform-origin: bottom center;
  /* 前半（中宮寄り）は透明にし、外周円の半径のうち中宮より外側だけを
     細い線として描画する（中宮の半径 ÷ 外周円の半径 ≈ 0.49 のため50%）。 */
  background: linear-gradient(
    to top,
    transparent 0%,
    transparent 50%,
    rgba(138, 134, 119, 0.45) 50%,
    rgba(138, 134, 119, 0.45) 100%
  );
}
.ld-dwheel-center-circle {
  position: absolute;
  inset: 30%; /* 外周円（inset 9%）の内側に収まる、中宮専用の円 */
  border-radius: 50%;
  border: 1px solid #e2ded2;
  background: #fbfaf5;
}
.ld-dwheel-cell {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 30%;
  text-align: center;
}
.ld-dwheel-cell[data-slot="CENTER"] { width: 34%; }
.ld-dwheel-cell[data-slot="N"]  { left: 50%; top: 8%; }
.ld-dwheel-cell[data-slot="NE"] { left: 79%; top: 21%; }
.ld-dwheel-cell[data-slot="E"]  { left: 92%; top: 50%; }
.ld-dwheel-cell[data-slot="SE"] { left: 79%; top: 79%; }
.ld-dwheel-cell[data-slot="S"]  { left: 50%; top: 92%; }
.ld-dwheel-cell[data-slot="SW"] { left: 21%; top: 79%; }
.ld-dwheel-cell[data-slot="W"]  { left: 8%; top: 50%; }
.ld-dwheel-cell[data-slot="NW"] { left: 21%; top: 21%; }
.ld-dwheel-cell[data-slot="CENTER"] { left: 50%; top: 50%; }

.ld-dwheel-name {
  font-size: 11px;
  font-weight: 700;
  color: #6a675e;
}
.ld-dwheel-cell[data-slot="CENTER"] .ld-dwheel-name { color: #8a8677; }

.ld-dwheel-markers {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-top: 2px;
}
.ld-dwheel-marker {
  display: inline-block;
  font-size: 9.5px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 8px;
  white-space: nowrap;
}
.ld-dwheel-marker-good { color: #1a7f37; background: #e6f4ea; }
.ld-dwheel-marker-bad { color: #b02a37; background: #fbeaec; }

.ld-dwheel-note {
  margin: 0;
  font-size: 12px;
  color: #8a8677;
  text-align: center;
  max-width: 320px;
}

.ld-error { color: #8a3b2b; font-size: 14px; }
.ld-loading { color: #8a8677; font-size: 13px; }

/* 無料版では「任意の日付の直接指定」自体を提供しない導線（DayDetailCard内）。 */
.ld-upsell-link {
  font-size: 12px;
  color: #3a5568;
  text-decoration: underline;
}
.ld-upsell-link:hover { color: #263a33; }

/*
  有料機能の案内（ユーザー指示、2026-09-19）。エラー表示ではなく、
  「有料会員でご利用いただけます」という趣旨を分かりやすく伝えるための
  専用ブロック。白基調・落ち着いた配色を維持し、派手な演出はしない。
*/
.ld-paywall {
  margin: 10px 0;
  padding: 14px 16px;
  border: 1px solid #e2ded2;
  border-radius: 10px;
  background: #fbfaf5;
}
.ld-paywall-text {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: #263a33;
}
.ld-paywall-plans {
  margin: 0 0 10px;
  padding-left: 18px;
  font-size: 12px;
  color: #6a675e;
}
.ld-paywall-plans li { margin-bottom: 2px; }
.ld-paywall-link {
  display: inline-block;
  padding: 7px 14px;
  border-radius: 999px;
  background: #263a33;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}
.ld-paywall-link:hover { background: #1c2c27; }

.ld-verdict-block { margin-bottom: 14px; }
.ld-verdict-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 700;
  color: #3c3a34;
}
.ld-verdict-block[data-verdict="good"] .ld-verdict-title { color: #2f5f45; }
.ld-verdict-block[data-verdict="neutral"] .ld-verdict-title { color: #3a5568; }
.ld-verdict-block[data-verdict="mixed"] .ld-verdict-title { color: #8a6a1f; }
.ld-verdict-block[data-verdict="bad"] .ld-verdict-title { color: #8a3b2b; }

.ld-verdict-subgroup { margin: 8px 0 12px 4px; }
.ld-verdict-subgroup-title {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 700;
  color: #8a8677;
}

.ld-verdict-list {
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
}
.ld-verdict-list li { margin-bottom: 2px; }
.ld-doyo-note {
  margin: 0 0 8px;
  font-size: 13px;
  color: #6b5a2e;
}
.ld-verdict-empty {
  margin: 0;
  font-size: 13px;
  color: #9a9689;
}

.ld-expand-btn {
  appearance: none;
  background: none;
  border: none;
  padding: 4px 0 0;
  margin-top: 2px;
  font-size: 13px;
  color: #3a5568;
  text-decoration: underline;
  cursor: pointer;
}
.ld-expand-btn:hover { color: #263a33; }

.ld-today-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}
.ld-link-btn {
  appearance: none;
  background: #f1efe6;
  border: 1px solid #d9d4c4;
  border-radius: 8px;
  padding: 9px 14px;
  font-size: 13px;
  color: #2c2a26;
  cursor: pointer;
}
.ld-link-btn:hover { background: #e9e5d7; }

.ld-detail {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #ece8dd;
}
.ld-detail-list {
  margin: 0;
  display: grid;
  grid-template-columns: 88px 1fr;
  row-gap: 8px;
  column-gap: 10px;
  font-size: 13px;
}
.ld-detail-list dt { color: #6a675e; }
.ld-detail-list dd { margin: 0; }

.ld-search-lead { margin: 0 0 16px; font-size: 14px; color: #55524b; }

.ld-cat-group { margin-bottom: 16px; }
.ld-cat-group-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: #6a675e;
}
.ld-cat-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ld-cat-item {
  appearance: none;
  background: #ffffff;
  border: 1px solid #d9d4c4;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 13px;
  color: #2c2a26;
  cursor: pointer;
}
.ld-cat-item:hover { background: #f4f2e9; }
.ld-cat-item.is-selected {
  background: #263a33;
  border-color: #263a33;
  color: #ffffff;
}

.ld-search-note {
  margin: 14px 0 0;
  font-size: 13px;
  color: #6a675e;
}

.ld-purpose-group,
.ld-period-group,
.ld-result-group {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid #ece8dd;
}

.ld-quick-period-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.ld-quick-period-btn {
  appearance: none;
  background: #f1efe6;
  border: 1px solid #d9d4c4;
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 12px;
  color: #2c2a26;
  cursor: pointer;
}
.ld-quick-period-btn:hover { background: #e9e5d7; }
.ld-quick-period-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.ld-quick-period-btn:disabled:hover { background: #f1efe6; }

.ld-period-inputs {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 14px;
}
.ld-period-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #6a675e;
}
.ld-date-input {
  font-size: 14px;
  padding: 7px 8px;
  border: 1px solid #d9d4c4;
  border-radius: 6px;
  color: #2c2a26;
  background: #ffffff;
}

.ld-search-btn {
  appearance: none;
  background: #263a33;
  border: 1px solid #263a33;
  border-radius: 8px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  cursor: pointer;
}
.ld-search-btn:hover { background: #1c2c27; }
.ld-search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ld-result-verdict { margin-bottom: 16px; }
.ld-result-verdict-title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: #3c3a34;
}
.ld-result-verdict[data-verdict="good"] .ld-result-verdict-title { color: #2f5f45; }
.ld-result-verdict[data-verdict="neutral"] .ld-result-verdict-title { color: #3a5568; }
.ld-result-verdict[data-verdict="mixed"] .ld-result-verdict-title { color: #8a6a1f; }
.ld-result-verdict[data-verdict="bad"] .ld-result-verdict-title { color: #8a3b2b; }

.ld-result-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ld-result-day {
  appearance: none;
  display: block;
  width: 100%;
  text-align: left;
  background: #ffffff;
  border: 1px solid #ece8dd;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.ld-result-day:hover { background: #f4f2e9; border-color: #d9d4c4; }
.ld-result-day-date { font-size: 13px; font-weight: 700; }
.ld-result-day-info { font-size: 12px; color: #6a675e; margin-top: 2px; }

/*
  検索結果一覧の個人判定マーク（ユーザー指示、2026-09-20）。「本人には
  避けたい日」を通常のgood/neutral/mixed/badの一覧から消さず、明確に
  識別できるようにするための小さな注記。警告色（強い赤）は使わず、
  既存の凶側配色（.ld-verdict-block[data-verdict="bad"]と同系統の
  落ち着いた色）にとどめる。
*/
.ld-result-personal {
  font-size: 11.5px;
  font-weight: 700;
  margin-top: 4px;
}
.ld-result-personal-avoid { color: #8a3b2b; }
.ld-result-personal-undetermined { color: #8a8677; }

/*
  個人判定（生年月日による個人忌日判定、ユーザー指示 2026-09-20）。
  通常の擇日判定（good/neutral/mixed/bad）のブロックとは別に、独立した
  節として表示する。
*/
.ld-personal-block {
  margin: 18px 0;
  padding-top: 14px;
  border-top: 1px solid #ece8dd;
}
.ld-personal-heading { margin-bottom: 8px; }
.ld-personal-avoid-title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: #8a3b2b;
}
.ld-personal-reason-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: #6a675e;
}
.ld-personal-reason-list li { margin-bottom: 2px; }
.ld-personal-clear {
  margin: 0;
  font-size: 13px;
  color: #6a675e;
}
.ld-personal-undetermined {
  margin: 0;
  font-size: 13px;
  color: #8a6a1f;
}

/*
  会員専用 質問サポート（ユーザー指示、2026-09-20：ページ下部の補助機能
  として控えめな見た目に調整）。既存の.ld-cardをベースにしつつ、背景を
  ページ地色と同じクリーム系にし、見出しも「今日の吉凶」等の主要機能
  （.ld-section-title）より小さく・控えめな配色にする（.ld-step-titleと
  同系統）。強い強調色・派手な装飾は使わない。機能・文言・送信処理は
  無変更（見た目の調整のみ）。
*/
.ld-support-card {
  margin-bottom: 20px;
  margin-top: 4px;
  background: #faf9f5;
}
.ld-support-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: #3c3a34;
  border-left: 3px solid #c9c2ac;
  padding-left: 8px;
}
.ld-support-usage {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: #55524b;
}
.ld-support-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #55524b;
}
.ld-support-limit-reached {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid #e2ded2;
  border-radius: 10px;
  background: #fbfaf5;
  font-size: 13px;
  color: #6a675e;
}
.ld-support-textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-height: 110px;
  padding: 10px 12px;
  margin-bottom: 10px;
  font-size: 15px; /* iOS Safariでのフォーカス時自動ズームを防ぐ16px未満は避ける */
  font-family: inherit;
  border: 1px solid #d9d4c4;
  border-radius: 8px;
  background: #ffffff;
  color: #2c2a26;
  resize: vertical;
}
.ld-support-success {
  margin: 10px 0 0;
  font-size: 13px;
  font-weight: 700;
  color: #2f5f45;
}

/*
  生年月日の入力欄（ユーザー指示、2026-09-20）。目的選択・検索の流れを
  邪魔しない、既存の.ld-cardと同じ落ち着いたデザインの小さなカード。
  「有料会員だから特別」という派手な装飾はしない。
*/
.ld-personal-input-card { margin-bottom: 20px; }
.ld-personal-input-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #55524b;
}
.ld-personal-input-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #6a675e;
}
.ld-personal-input-label {
  font-size: 13px;
  font-weight: 700;
  color: #263a33;
}

/*
  生年月日専用カレンダー（ユーザー指示、2026-09-20）。標準
  input type="date" はSafariで年の直接選択がしづらく、数十年前まで
  遡る生年月日入力に不向きなため、軽量な自前カレンダーUIに置き換えた。
  外部DatePickerライブラリは使わない。年・月プルダウンで一操作で
  数十年前へ移動でき、日はカレンダーのマス目をクリックして選ぶ。
  日付セルは最低44px角のタップ領域を確保する。
*/
.ld-birth-calendar {
  max-width: 320px;
}
.ld-birth-calendar-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}
.ld-birth-calendar-select {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 44px;
  padding: 6px 8px;
  font-size: 15px;
  border: 1px solid #d9d4c4;
  border-radius: 6px;
  background: #ffffff;
  color: #2c2a26;
}
.ld-birth-calendar-navbtn {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  appearance: none;
  border: 1px solid #d9d4c4;
  border-radius: 6px;
  background: #f1efe6;
  color: #2c2a26;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.ld-birth-calendar-navbtn:hover { background: #e9e5d7; }
.ld-birth-calendar-weekdays,
.ld-birth-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
}
.ld-birth-calendar-weekday {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: #8a8677;
  padding: 4px 0;
}
.ld-birth-calendar-cell {
  appearance: none;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #ffffff;
  min-height: 44px;
  font-size: 14px;
  color: #2c2a26;
  cursor: pointer;
}
.ld-birth-calendar-cell:hover:not(:disabled) { background: #f4f2e9; border-color: #d9d4c4; }
.ld-birth-calendar-cell:disabled {
  color: #c8c4b6;
  cursor: not-allowed;
  background: #faf9f5;
}
.ld-birth-calendar-cell-empty {
  background: transparent;
  min-height: 44px;
}
.ld-birth-calendar-cell.is-today {
  border-color: #a9bcac;
  font-weight: 700;
}
.ld-birth-calendar-cell.is-selected {
  background: #263a33;
  border-color: #263a33;
  color: #ffffff;
  font-weight: 700;
}
.ld-birth-calendar-cell.is-selected:hover { background: #1c2c27; }
.ld-birth-calendar-selected {
  margin: 10px 0 0;
  font-size: 13px;
  font-weight: 700;
  color: #263a33;
}

/*
  未設定時「生年月日を選択」ボタン／選択済み確定値＋「変更」ボタン
  （ユーザー指示、2026-09-20：常時カレンダーを表示すると大きすぎるため、
  必要な時だけ開く方式に変更）。
*/
.ld-birth-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.ld-birth-summary-value {
  font-size: 15px;
  font-weight: 700;
  color: #2c2a26;
}

/*
  PC幅ではカレンダー全体をコンパクトにする（ユーザー指示、2026-09-20）。
  スマホ（900px未満）は操作性を優先し、上記の基本サイズ（日付セル最低
  44px角）のままにする。
*/
@media (min-width: 900px) {
  .ld-birth-calendar { max-width: 310px; }
  .ld-birth-calendar-select { min-height: 38px; font-size: 13px; padding: 4px 6px; }
  .ld-birth-calendar-navbtn { width: 30px; height: 30px; font-size: 14px; }
  .ld-birth-calendar-cell, .ld-birth-calendar-cell-empty { min-height: 38px; font-size: 13px; }
}

/*
  婚姻系・葬墓系の専門家相談の注意情報（ユーザー指示、2026-09-20）。
  擇日判定ロジックではなく表示のみの注意情報のため、警告・エラーのような
  強い赤色にはせず、既存の.ld-advisoryと同系統の落ち着いたトーンにする。
*/
.ld-pro-advisory {
  margin: 0 0 16px;
  padding: 14px 16px;
  border: 1px solid #e2ded2;
  border-radius: 10px;
  background: #fbfaf5;
}
.ld-pro-advisory-title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: #263a33;
}
.ld-pro-advisory-text {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.8;
  color: #6a675e;
}

/*
  「大切な日の選定について」（ユーザー指示、2026-09-20）。無料版だけに
  表示する補足説明。.ld-paywall（有料誘導・CTA付き）とは役割が異なるため
  別クラスにする。CTAリンク・価格・ボタンは一切置かない、文章だけの
  控えめな案内ボックス（白基調、既存デザインに合わせる）。
*/
.ld-advisory {
  margin: 24px 0 0;
  padding: 16px;
  border: 1px solid #e7e3d9;
  border-radius: 10px;
  background: #f6f5ef;
}
.ld-advisory-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
  color: #263a33;
  border-left: 3px solid #a9bcac;
  padding-left: 8px;
}
.ld-advisory-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: #55524b;
}

@media (min-width: 640px) {
  .ld-page { padding-top: 32px; }
  .ld-hero-title { font-size: 26px; }
}

/*
  時間の吉凶（有料会員向け、ユーザー指示 2026-10-14）。
  スマホは2列のカード、PC（900px以上）は時間・記号・説明の一覧表。
  色は補助で、記号と説明を必ず併記する（色だけに頼らない）。
*/
.ld-hours-block {
  margin: 18px 0;
  padding-top: 14px;
  border-top: 1px solid #ece8dd;
}
.ld-hours-heading { margin-bottom: 10px; }
.ld-hours-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.ld-hours-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas: "range range" "symbol desc";
  align-items: center;
  column-gap: 8px;
  row-gap: 4px;
  min-width: 0;
  padding: 10px;
  border: 1px solid #e7e3d9;
  border-radius: 10px;
  background: #ffffff;
}
.ld-hours-range {
  grid-area: range;
  font-size: 12px;
  font-weight: 700;
  color: #55524b;
  font-variant-numeric: tabular-nums;
}
.ld-hours-symbol {
  grid-area: symbol;
  font-size: 22px;
  line-height: 1;
  font-weight: 700;
  min-width: 1.2em;
  text-align: center;
}
.ld-hours-desc {
  grid-area: desc;
  font-size: 12px;
  line-height: 1.5;
  color: #55524b;
  min-width: 0;
  overflow-wrap: anywhere;
}
.ld-hours-item[data-tone="good"] { background: #f3f8f3; border-color: #cfe0cf; }
.ld-hours-item[data-tone="good"] .ld-hours-symbol { color: #2f6b3a; }
.ld-hours-item[data-tone="bad"] { background: #fbf3f1; border-color: #ead2cc; }
.ld-hours-item[data-tone="bad"] .ld-hours-symbol { color: #8a3b2b; }
.ld-hours-item[data-tone="even"] .ld-hours-symbol { color: #55524b; }
.ld-hours-note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: #8a8677;
}
.ld-hours-locked {
  padding: 12px 14px;
  border: 1px solid #e2ded2;
  border-radius: 10px;
  background: #fbfaf5;
}
.ld-hours-locked-text {
  margin: 0 0 6px;
  font-size: 13px;
  color: #263a33;
}
.ld-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (min-width: 900px) {
  .ld-hours-list {
    grid-template-columns: 1fr;
    gap: 0;
    border: 1px solid #e7e3d9;
    border-radius: 10px;
    overflow: hidden;
  }
  .ld-hours-item {
    grid-template-columns: 7.5em 5.5em minmax(0, 1fr);
    grid-template-areas: "range symbol desc";
    padding: 7px 12px;
    border: none;
    border-radius: 0;
    border-top: 1px solid #ece8dd;
  }
  .ld-hours-item:first-child { border-top: none; }
  .ld-hours-range { font-size: 13px; }
  .ld-hours-symbol { font-size: 18px; }
  .ld-hours-desc { font-size: 13px; }
}

/* PC: 十分な横幅がある画面のみ左右2カラム（スマホは縦一列のまま）。 */
@media (min-width: 900px) {
  .ld-page { max-width: 1120px; }
  /* PCではスマホ専用タブを出さず、2カラムを常時両方表示する（変更しない）。 */
  .ld-mobile-tabs { display: none; }
  .ld-mobile-hidden { display: block; }
  .ld-layout {
    display: grid;
    grid-template-columns: minmax(380px, 1fr) minmax(420px, 1.1fr);
    gap: 24px;
    align-items: start;
  }
  .ld-col-left .ld-card, .ld-col-right .ld-card { margin-bottom: 0; }
}
`;
