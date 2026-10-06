// src/lib/auth/rateLimit.ts
//
// 役割:
//   /api/auth/login への連続試行を軽く制限する。単一VPS・少人数のテスト運用向けの
//   最小限の対策で、Redis等の外部ストアは使わずプロセス内メモリで完結させる。
//
// 制約（意図的な割り切り）:
//   - プロセス内メモリのみ。PM2をクラスタモード（複数プロセス）で動かす場合は
//     インスタンスごとに別カウントになる（今回はシングルインスタンス運用を想定）。
//   - サーバー再起動でカウントはリセットされる。
//   - 対象は「ログインの総当たり攻撃を遅くする」ことであり、分散DDoS対策ではない
//     （それはNginx/インフラ側の役割）。

const WINDOW_MS = 10 * 60 * 1000; // 10分
const MAX_ATTEMPTS_PER_WINDOW = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15分ロック

interface Entry {
  count: number;
  windowStart: number;
  lockedUntil: number;
}

const attempts = new Map<string, Entry>();

// Mapが際限なく肥大化しないよう、一定件数を超えたら期限切れエントリを掃除する。
const PRUNE_THRESHOLD = 5000;

function pruneIfNeeded(now: number): void {
  if (attempts.size < PRUNE_THRESHOLD) return;
  for (const [key, entry] of attempts) {
    if (entry.lockedUntil < now && now - entry.windowStart > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

export interface RateLimitCheck {
  allowed: boolean;
  retryAfterMs?: number;
}

/** ログイン試行を許可してよいか（ロック中でないか）を確認する。カウントは進めない。 */
export function checkRateLimit(key: string): RateLimitCheck {
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && entry.lockedUntil > now) {
    return { allowed: false, retryAfterMs: entry.lockedUntil - now };
  }
  return { allowed: true };
}

/** 失敗試行を記録する。閾値を超えたら一定時間ロックする。 */
export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  pruneIfNeeded(now);

  let entry = attempts.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { count: 0, windowStart: now, lockedUntil: 0 };
  }
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS_PER_WINDOW) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  attempts.set(key, entry);
}

/** ログイン成功時にそのキーのカウントをリセットする。 */
export function recordSuccessfulAttempt(key: string): void {
  attempts.delete(key);
}

/** リクエストからレート制限キー（IP + email）を組み立てる。 */
export function rateLimitKeyFor(ip: string, email: string): string {
  return `${ip}:${email.trim().toLowerCase()}`;
}
