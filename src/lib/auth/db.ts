// src/lib/auth/db.ts
//
// 役割:
//   認証層（ユーザー・セッション）専用の better-sqlite3 接続とクエリ。
//   占術エンジンの計算結果・fixtureとは完全に無関係の独立DB。
//
// 配置:
//   DBファイルの絶対パスは環境変数 DB_PATH で指定する（必須）。
//   本番ではリポジトリ外（rsyncの対象外）のディレクトリに置くこと。
//   public/ 配下へ置いてはならない（Webから直接読み出せてしまう）。
//   開発環境では .env.local（.gitignore 済み・コミットしない）で
//   リポジトリ外のパス（例: ~/seishi-app-data/auth.dev.sqlite3）を指定する。

import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { SessionRow, UserRow } from "./types";

let dbInstance: Database.Database | null = null;

function resolveDbPath(): string {
  const dbPath = process.env.DB_PATH;
  if (!dbPath || dbPath.trim() === "") {
    throw new Error(
      "DB_PATH が設定されていません。認証DBの絶対パスを環境変数 DB_PATH に設定してください" +
        "（例: .env.local に DB_PATH=/Users/xxx/seishi-app-data/auth.dev.sqlite3）。" +
        "public/ 配下や git 管理下のパスは指定しないこと。",
    );
  }
  return dbPath;
}

function initSchema(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      trial_started_at TEXT,
      trial_ends_at TEXT,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  `);
}

/** モジュール内シングルトン。プロセス内で1接続を使い回す。 */
export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = resolveDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  initSchema(db);
  dbInstance = db;
  return db;
}

// ---- users ----------------------------------------------------------------

export function getUserByEmail(email: string): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email) as UserRow | undefined;
}

export function getUserById(id: number): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id) as UserRow | undefined;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  isAdmin: boolean;
}

/**
 * 通常ユーザー・管理者ともに trial_started_at / trial_ends_at は NULL のまま作成する。
 * （通常ユーザー: 初回ログイン成功時にだけ設定する。管理者: 期限判定自体を行わないため常にNULLのまま）
 */
export function createUser(input: CreateUserInput): number {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `INSERT INTO users (email, password_hash, is_admin, status, trial_started_at, trial_ends_at, created_at, last_login_at)
       VALUES (?, ?, ?, 'active', NULL, NULL, ?, NULL)`,
    )
    .run(input.email, input.passwordHash, input.isAdmin ? 1 : 0, now);
  return Number(result.lastInsertRowid);
}

const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7日間

/**
 * 初回ログイン成功時にだけ試用期間を開始する。
 *
 * 重要（二重初期化防止）: 「NULLかどうかをSELECTで確認してからUPDATEする」のではなく、
 * `WHERE trial_started_at IS NULL` を条件に含めた単一のUPDATE文にすることで、
 * better-sqlite3（同期・単一接続・プロセス内シリアル実行）上で
 * チェックと更新の間に他のリクエストが割り込む余地をなくしている。
 * 2回目以降のログインではこのUPDATEは0行しか更新せず、既存の値はそのまま残る。
 *
 * 戻り値は「実際に採用された」trial_started_at/trial_ends_at
 * （このリクエストで設定したとは限らない。並行リクエストが先に設定していた場合は
 * その値を読み直して返す）。
 */
export function startTrialIfNeeded(userId: number): { trialStartedAt: string; trialEndsAt: string } {
  const now = new Date();
  const startedAt = now.toISOString();
  const endsAt = new Date(now.getTime() + TRIAL_DURATION_MS).toISOString();

  getDb()
    .prepare(
      `UPDATE users SET trial_started_at = ?, trial_ends_at = ?
       WHERE id = ? AND trial_started_at IS NULL`,
    )
    .run(startedAt, endsAt, userId);

  // 実際にDBへ入っている値を読み直す（並行リクエストが先に確定させていた場合も
  // 正しい「最初の1回」の値を返すため）。
  const row = getUserById(userId);
  if (!row || !row.trial_started_at || !row.trial_ends_at) {
    throw new Error(`trial start failed to persist for user ${userId}`);
  }
  return { trialStartedAt: row.trial_started_at, trialEndsAt: row.trial_ends_at };
}

export function updateLastLogin(userId: number): void {
  getDb()
    .prepare("UPDATE users SET last_login_at = ? WHERE id = ?")
    .run(new Date().toISOString(), userId);
}

// ---- sessions ---------------------------------------------------------------

/** セッションの有効期間。試用期間(7日間)とは別軸で、こまめな再ログインを求める短めの値。 */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24時間

export function createSession(userId: number): SessionRow {
  const id = randomBytes(32).toString("hex"); // 256bit・推測不可能
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const row: SessionRow = {
    id,
    user_id: userId,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };
  getDb()
    .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(row.id, row.user_id, row.created_at, row.expires_at);
  return row;
}

export function getSessionWithUser(sessionId: string): { session: SessionRow; user: UserRow } | undefined {
  const session = getDb()
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(sessionId) as SessionRow | undefined;
  if (!session) return undefined;
  const user = getUserById(session.user_id);
  if (!user) return undefined;
  return { session, user };
}

export function deleteSession(sessionId: string): void {
  getDb().prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

/** 期限切れセッションの掃除（任意。ログイン時などに日和見的に呼ぶ）。 */
export function deleteExpiredSessions(): void {
  getDb()
    .prepare("DELETE FROM sessions WHERE expires_at < ?")
    .run(new Date().toISOString());
}
