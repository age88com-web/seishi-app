// src/lib/auth/safeRedirect.ts
//
// 役割:
//   /login?next=... の next パラメータを、同一サイト内の安全な相対パスだけに
//   限定する（open redirect対策）。http(s)://、//evil.example、\evil.example
//   等はすべて拒否して "/" にフォールバックする。

export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/";
  // 単一の "/" で始まる相対パスのみ許可。
  if (!next.startsWith("/")) return "/";
  // "//evil.example" のようなプロトコル相対URLを拒否。
  if (next.startsWith("//")) return "/";
  // "/\evil.example" のようなバックスラッシュ経由の解釈を拒否。
  if (next.startsWith("/\\")) return "/";
  // "https://..." 等が紛れ込んでいないか（先頭以外に紛れ込むケースも含め）念のため拒否。
  if (next.includes("://")) return "/";
  return next;
}
