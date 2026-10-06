// src/lib/auth/session.ts
//
// 役割:
//   セッション検証・ログイン・ログアウトの本体ロジック。
//   src/proxy.ts と src/app/api/auth/* から呼ばれる、認証層の中核。
//   占術エンジン（qimen/calendar/takujitsu/七政四餘）からは一切参照されない。
//
// 将来WordPress認証へ切り替える際の境界:
//   このファイルの validateSessionId() / login() / logout() の3関数の
//   シグネチャさえ保てば、内部実装（DBセッション → WordPress Cookie/REST照会等）を
//   差し替えるだけで済むように設計している。

import {
  createSession,
  deleteExpiredSessions,
  deleteSession,
  getSessionWithUser,
  getUserByEmail,
  startTrialIfNeeded,
  updateLastLogin,
} from "./db";
import { hashPassword, verifyPassword } from "./password";
import type { AuthContext, LoginResult, UserRow } from "./types";

export const SESSION_COOKIE_NAME = "__Host-session";

// 存在しないemailの場合に verifyPassword を丸ごとスキップすると、
// scryptの計算コストぶん応答が速くなり、タイミングでemailの存在有無が
// 推測できてしまう。存在しない場合もダミーハッシュに対して検証を実行し、
// 応答時間を揃える（結果は使い捨て）。
const DUMMY_PASSWORD_HASH = hashPassword(randomDummySecret());
function randomDummySecret(): string {
  // モジュール読み込み時に1回だけ生成する固定のダミー値（値自体に意味はない）。
  return `timing-safety-dummy-${Date.now()}-${Math.random()}`;
}

/** 管理者は無期限。通常ユーザーは trial_ends_at を過ぎていないことを要求する。 */
function isWithinTrialOrAdmin(user: UserRow): boolean {
  if (user.is_admin) return true;
  if (!user.trial_ends_at) return false; // 通常ユーザーでまだ試用未開始（＝未ログイン状態のはず）
  return new Date(user.trial_ends_at).getTime() > Date.now();
}

/**
 * セッションIDから認可コンテキストを求める。
 * 無効・期限切れ・ユーザー無効化・（通常ユーザーの）試用期限切れ、いずれの場合も null。
 * DBへ毎回問い合わせる（トークンに埋め込まず、その場の最新状態を見る）ことで、
 * 管理者によるユーザー無効化や試用期限切れが次のリクエストで即座に反映される。
 */
export function validateSessionId(sessionId: string): AuthContext | null {
  if (!sessionId) return null;

  const found = getSessionWithUser(sessionId);
  if (!found) return null;
  const { session, user } = found;

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    deleteSession(session.id);
    return null;
  }

  if (user.status !== "active") return null;
  if (!isWithinTrialOrAdmin(user)) return null;

  return { userId: user.id, email: user.email, isAdmin: Boolean(user.is_admin) };
}

/**
 * ログイン処理本体。
 * 失敗理由は呼び出し側（route handler）が「メールアドレスまたはパスワードが
 * 正しくありません」等の共通文言へマッピングする（ここでは理由を区別して返すが、
 * ユーザー存在有無を推測させる詳細はHTTPレスポンスに出さないこと）。
 */
export function login(email: string, password: string): LoginResult {
  deleteExpiredSessions(); // 日和見的な掃除

  const user = getUserByEmail(email.trim().toLowerCase());
  if (!user) {
    verifyPassword(password, DUMMY_PASSWORD_HASH); // タイミング差を埋めるためのダミー検証
    return { ok: false, reason: "invalid_credentials" };
  }
  if (!verifyPassword(password, user.password_hash)) {
    return { ok: false, reason: "invalid_credentials" };
  }

  if (user.status !== "active") {
    return { ok: false, reason: "disabled" };
  }

  // 初回ログイン成功時点でだけ試用期間を開始する（2回目以降は startTrialIfNeeded が
  // 何もしない＝既存の trial_started_at / trial_ends_at をそのまま使う）。
  // 管理者は is_admin により期限判定そのものをスキップするが、
  // trial_started_at 自体は記録しても判定に使われないため、通常ユーザーと同じ経路で問題ない。
  if (!user.is_admin && !user.trial_started_at) {
    startTrialIfNeeded(user.id);
  }

  // 最新状態を読み直してから期限判定する（上のstartTrialIfNeededで更新された可能性があるため）。
  const fresh = getUserByEmail(email.trim().toLowerCase())!;
  if (!isWithinTrialOrAdmin(fresh)) {
    return { ok: false, reason: "trial_expired" };
  }

  const session = createSession(fresh.id);
  updateLastLogin(fresh.id);

  return { ok: true, sessionId: session.id, expiresAt: new Date(session.expires_at) };
}

export function logout(sessionId: string | undefined): void {
  if (!sessionId) return;
  deleteSession(sessionId); // Cookie削除だけでなく、サーバー側の行自体を消す
}
