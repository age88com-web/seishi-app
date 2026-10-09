// src/lib/luckyDay/auth/member.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）の「現在の会員状態」を取得するサーバー
//   専用関数。Next.jsセッション（session.ts）の検証結果と、WordPress
//   （PMPro）の会員状態（wordpress.ts）を組み合わせて最終判断する、唯一の
//   決定ポイント。
//
// 重要（ユーザー指示、2026-09-19）:
//   ・ID 2（月額）・ID 3（年額）・ID 4（擇日入門通信講座 通常版）・
//     ID 5（同 DVD版）以外はfullAccess（有料会員）にしない
//     （ID 4・5の追加はユーザー指示、2026-10-09）。
//     この判定はここ1箇所だけで行う（wordpress.tsはWordPressの生の値を
//     返すだけで、2〜5判定はしない）。
//   ・会員資格の有効期限はWordPress（PMPro）側の active 判定に従う
//     （Next.js側では期限日を独自に判定しない）。
//   ・WordPress API通信に失敗した場合も、この関数を経由する限り
//     fullAccessへは倒れない（wordpress.ts側が既にfail-safeだが、
//     ここでも levelId が 2〜5 以外なら active にしないダブルチェックを行う）。
//   ・今回はまだ無料/有料の機能制限は実装しない（この関数はあくまで
//     状態を返すだけで、呼び出し側の表示・機能を制限する処理はまだ無い）。

import "server-only";
import { cookies } from "next/headers";
import { TAKUJITSU_MEMBER_SESSION_COOKIE, verifyMemberSessionToken } from "./session";
import { getMembershipStatus } from "./wordpress";

export type TakujitsuPaidLevelId = 2 | 3 | 4 | 5;

export interface TakujitsuMemberStatus {
  /** Next.jsセッションが有効（WordPressログイン経由の本人認証が成立している）か。 */
  authenticated: boolean;
  /** ID 2〜5 の有効な会員か（fullAccess判定はこの値だけを見ればよい）。 */
  active: boolean;
  /** active===true のときだけ 2〜5 のいずれか。それ以外は常に null。 */
  levelId: TakujitsuPaidLevelId | null;
  /**
   * WordPressのuser_id（会員専用 質問サポート機能、2026-09-20追加）。
   * authenticated===true の場合のみセッションに署名済みで保存されている
   * userIdをそのまま返す（active/levelIdの判定には一切影響しない、
   * 既存のフィールドを書き換えるものではなく追加フィールド）。
   * 未認証の場合は常にnull。WordPress REST API（support-status/
   * support-question）をuser_id付きで呼ぶために使う。
   */
  userId: number | null;
}

const UNAUTHENTICATED_STATUS: TakujitsuMemberStatus = {
  authenticated: false,
  active: false,
  levelId: null,
  userId: null,
};

/**
 * ID 2（月額）・3（年額）・4（講座 通常版）・5（講座 DVD版）だけを
 * 有料会員として認める、唯一の判定箇所。
 * テスト（tests/lucky_day_member_auth.manual.ts）から直接検証できるよう
 * exportする（cookies()を呼ぶgetCurrentTakujitsuMember()自体はNext.jsの
 * リクエストスコープ外からは呼べないため、この純粋な判定部分だけを
 * 単体テスト可能にしている）。
 */
export function isPaidLevelId(levelId: number | null): levelId is TakujitsuPaidLevelId {
  return levelId === 2 || levelId === 3 || levelId === 4 || levelId === 5;
}

// ---------------------------------------------------------------------------
// 開発専用「有料会員として動作させる」オーバーライド（ユーザー指示、
// 2026-09-20）。
//
// 目的:
//   本番のWordPress認証フロー（ログイン後 https://app.fengshui.jp/lucky-day/auth
//   へリダイレクト）はローカル開発環境（localhost）からは完了できないため、
//   ローカルで有料会員向けUI（生年月日入力・個人判定・目的別検索への
//   個人判定反映・婚姻/葬墓の専門注意）を動作確認する手段が無かった。
//   このオーバーライドは、その動作確認だけを目的とする。
//
// 安全条件（両方を満たす場合のみ有効。ユーザー指示どおりAND条件）:
//   1. process.env.NODE_ENV === "development"
//      （`next dev` 実行時にNext.js自身が設定する値。`next build`/
//      `next start`＝本番運用時は常に "production" になり、アプリコード側
//      から書き換える手段はない）。
//   2. process.env.TAKUJITSU_DEV_PAID_MEMBER === "true"
//      （文字列 "true" との完全一致のみ。大文字・"1"・truthyな値全般では
//      有効にならない。.env.local にだけ設定する想定で、.env.production・
//      .env.production.local には絶対に追加しない）。
//   NEXT_PUBLIC_* は使わない（クライアントバンドルに含まれる形の環境変数は
//   誰でも参照できてしまうため）。この判定は"server-only"のこのファイル
//   （member.ts）の中でしか行わない。
//
// 万一この環境変数が本番環境に誤って存在しても、NODE_ENVが
// "production"である限りオーバーライドは有効にならない（AND条件の
// 片方が常に不成立になるため）。
//
// 本番のWordPress認証・PMPro連携・Stripe決済・セッション検証
// （session.ts・wordpress.ts）・通常の会員判定ロジックは一切変更していない
// （このオーバーライドはgetCurrentTakujitsuMember()の先頭で早期returnする
// だけで、既存のcookie検証・WordPress API呼び出しのコード自体には
// 触れていない）。
export function isDevPaidMemberOverrideEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.TAKUJITSU_DEV_PAID_MEMBER === "true";
}

/**
 * 開発オーバーライド用の仮のuser_id（2026-09-20追加）。実在のWordPress
 * ユーザーとは対応しない、ローカルUI動作確認専用の固定値。会員専用
 * 質問サポート機能はこのuser_idで実際のWordPress REST APIを呼ぶため、
 * 開発オーバーライド中は（対応するWordPress側テストユーザーを別途
 * 用意しない限り）support-status/support-question の呼び出し自体は
 * 失敗しうる（ネットワーク/404等）。これは想定内の制約であり、UI表示
 * （有料会員として画面が出ること）自体の確認は引き続き可能。
 */
const DEV_PAID_MEMBER_USER_ID = 1;

/** 開発オーバーライド有効時に返す固定の会員状態（月額会員相当、levelId=2）。 */
const DEV_PAID_MEMBER_STATUS: TakujitsuMemberStatus = {
  authenticated: true,
  active: true,
  levelId: 2,
  userId: DEV_PAID_MEMBER_USER_ID,
};

/**
 * 現在のリクエストの会員状態を取得する。
 * 0. isDevPaidMemberOverrideEnabled()がtrueの場合（ローカル開発環境限定）は、
 *    以下の本番ロジックを一切実行せず、固定の有料会員状態を返す。
 * 1. Next.jsセッションcookie（takujitsu_member_session）を検証する。
 * 2. 無効・期限切れ・未ログインなら { authenticated:false, active:false, levelId:null, userId:null }。
 * 3. 有効なら userId で WordPress の membership API を毎回問い合わせる
 *    （level_id/activeをセッションに固定保存しないため、常に最新の
 *    WordPress側の状態を反映する）。
 * 4. WordPressが active:true を返し、かつ level_id が 2〜5 の場合だけ
 *    active:true とする（有効期限切れの判定はWordPress側の active に従う）。
 *    userIdはactive/levelIdの判定に関わらず、認証済みであれば常に返す
 *    （2026-09-20追加。会員専用 質問サポート機能がWordPress REST API
 *    呼び出しに使う）。
 */
export async function getCurrentTakujitsuMember(): Promise<TakujitsuMemberStatus> {
  if (isDevPaidMemberOverrideEnabled()) {
    return DEV_PAID_MEMBER_STATUS;
  }

  const store = await cookies();
  const token = store.get(TAKUJITSU_MEMBER_SESSION_COOKIE)?.value;
  const session = verifyMemberSessionToken(token);
  if (!session) {
    return UNAUTHENTICATED_STATUS;
  }

  const membership = await getMembershipStatus(session.userId);
  if (membership.active && isPaidLevelId(membership.levelId)) {
    return { authenticated: true, active: true, levelId: membership.levelId, userId: session.userId };
  }
  return { authenticated: true, active: false, levelId: null, userId: session.userId };
}
