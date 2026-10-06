// src/lib/auth/password.ts
//
// 役割:
//   パスワードのハッシュ化・検証。Node.js 標準の crypto.scrypt のみを使用し、
//   新規npm依存を追加しない（占術エンジンとは無関係の独立モジュール）。
//   平文パスワードは保存しない・ログに出力しない。

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384; // CPU/メモリコスト（2^14。Node公式ドキュメント推奨値）
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * "scrypt:N:r:p:saltHex:hashHex" 形式の自己記述的な文字列を返す。
 * パラメータ自体も保存しておくことで、将来コストパラメータを変更しても
 * 既存ハッシュの検証を壊さずに済む。
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

/**
 * timingSafeEqual による定数時間比較でパスワードを検証する。
 * 形式が不正な場合は false を返す（例外を投げて内部情報を漏らさない）。
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const n = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = scryptSync(password, salt, expected.length, { N: n, r, p });
  } catch {
    return false;
  }

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
