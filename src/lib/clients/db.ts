// src/lib/clients/db.ts
//
// 役割:
//   顧客（clients）テーブルのスキーマとクエリ。認証DB（src/lib/auth/db.ts の getDb()、DB_PATH）と
//   同じSQLiteファイルに置き、users(id) へ外部キーで紐づける。
//   既存の users / sessions テーブルと認証処理には手を加えない（ここで CREATE TABLE IF NOT EXISTS するだけ）。
//
// データ分離（重要）:
//   すべてのクエリに user_id = ? を含める。id だけで顧客を取得・更新する関数は作らない。
//   他ユーザーの id を指定した場合は「存在しない」と同じ扱い（undefined）になる。
//
// 将来の拡張:
//   鑑定履歴などは clients(id) を参照する別テーブルとして追加する（このテーブルには計算結果を入れない）。

import type Database from "better-sqlite3";
import { getDb } from "../auth/db";
import type { ClientInput, ClientRow } from "./types";

let schemaReady = false;

function db(): Database.Database {
  const d = getDb();
  if (!schemaReady) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        birth_date TEXT NOT NULL,
        birth_time TEXT,
        birth_time_unknown INTEGER NOT NULL DEFAULT 0,
        gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
        birth_place TEXT NOT NULL DEFAULT '',
        latitude REAL,
        longitude REAL,
        time_zone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_clients_user_updated ON clients(user_id, updated_at);
    `);
    schemaReady = true;
  }
  return d;
}

export function listClients(userId: number): ClientRow[] {
  return db()
    .prepare("SELECT * FROM clients WHERE user_id = ? ORDER BY updated_at DESC, id DESC")
    .all(userId) as ClientRow[];
}

export function getClient(userId: number, id: number): ClientRow | undefined {
  return db()
    .prepare("SELECT * FROM clients WHERE id = ? AND user_id = ?")
    .get(id, userId) as ClientRow | undefined;
}

export function createClient(userId: number, c: ClientInput): ClientRow {
  const now = new Date().toISOString();
  const result = db()
    .prepare(
      `INSERT INTO clients (user_id, name, birth_date, birth_time, birth_time_unknown, gender, birth_place,
                            latitude, longitude, time_zone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      c.name,
      c.birthDate,
      c.birthTime,
      c.birthTimeUnknown ? 1 : 0,
      c.gender,
      c.birthPlace,
      c.latitude,
      c.longitude,
      c.timeZone,
      now,
      now,
    );
  return getClient(userId, Number(result.lastInsertRowid))!;
}

/** 自分の顧客だけを更新する。該当なし（存在しない・他ユーザーの顧客）は undefined */
export function updateClient(userId: number, id: number, c: ClientInput): ClientRow | undefined {
  const result = db()
    .prepare(
      `UPDATE clients
          SET name = ?, birth_date = ?, birth_time = ?, birth_time_unknown = ?, gender = ?, birth_place = ?,
              latitude = ?, longitude = ?, time_zone = ?, updated_at = ?
        WHERE id = ? AND user_id = ?`,
    )
    .run(
      c.name,
      c.birthDate,
      c.birthTime,
      c.birthTimeUnknown ? 1 : 0,
      c.gender,
      c.birthPlace,
      c.latitude,
      c.longitude,
      c.timeZone,
      new Date().toISOString(),
      id,
      userId,
    );
  if (result.changes === 0) return undefined;
  return getClient(userId, id);
}

/** 一度に削除できる件数の上限（API の入力検証でも使う） */
export const DELETE_CLIENTS_MAX = 500;

/**
 * 自分の顧客をまとめて削除する（顧客の削除処理はこの関数だけ）。
 *   - 必ず user_id = ? を条件にする。他ユーザーの id・存在しない id は削除されず、戻り値にも入らない。
 *   - 対象は clients テーブルだけ（users・sessions には触れない）。
 *   - 将来、鑑定履歴など clients(id) を参照するテーブルを追加したら、このトランザクション内で
 *     同じ「自分の顧客の id」に絞って先に削除する（または ON DELETE CASCADE を付ける）。
 * 戻り値は実際に削除した id（昇順）。
 */
export function deleteClients(userId: number, ids: readonly number[]): number[] {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  if (unique.length > DELETE_CLIENTS_MAX) throw new RangeError(`一度に削除できるのは${DELETE_CLIENTS_MAX}件までです`);
  const d = db();
  const placeholders = unique.map(() => "?").join(", ");
  return d.transaction(() => {
    const owned = (
      d
        .prepare(`SELECT id FROM clients WHERE user_id = ? AND id IN (${placeholders}) ORDER BY id`)
        .all(userId, ...unique) as { id: number }[]
    ).map((r) => r.id);
    if (owned.length === 0) return owned;
    const ownedPlaceholders = owned.map(() => "?").join(", ");
    d.prepare(`DELETE FROM clients WHERE user_id = ? AND id IN (${ownedPlaceholders})`).run(userId, ...owned);
    return owned;
  })();
}
