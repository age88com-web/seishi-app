// src/lib/auth/types.ts
//
// 役割:
//   認証層（テスト用ログイン＋7日間試用期間）の型定義。
//   占術エンジン（src/lib/qimen, src/lib/calendar, src/lib/takujitsu, 七政四餘関連）
//   からは一切参照されない、独立したモジュール。

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  is_admin: 0 | 1;
  status: "active" | "disabled";
  trial_started_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface SessionRow {
  id: string;
  user_id: number;
  created_at: string;
  expires_at: string;
}

/** validateSession() が返す、認可済みリクエストのコンテキスト。 */
export interface AuthContext {
  userId: number;
  email: string;
  isAdmin: boolean;
}

export type LoginFailureReason =
  | "invalid_credentials"
  | "disabled"
  | "trial_expired";

export type LoginResult =
  | { ok: true; sessionId: string; expiresAt: Date }
  | { ok: false; reason: LoginFailureReason };
