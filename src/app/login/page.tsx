// src/app/login/page.tsx
//
// 役割:
//   テスト用ログインページ。占術ロジックとは無関係の独立ページ。
//   公開登録リンク（新規登録・無料登録等）は意図的に置かない。
//   フォームは通常のPOST（JS不要）で /api/auth/login へ送信する。

import type { Metadata } from "next";
import { safeNextPath } from "@/lib/auth/safeRedirect";

export const metadata: Metadata = {
  title: "占術アプリ ログイン",
  description: "占術アプリ ログイン",
};

type ErrorCode =
  | "invalid_credentials"
  | "disabled"
  | "trial_expired"
  | "rate_limited"
  | "invalid_request";

function errorMessage(code: string | undefined): string | null {
  switch (code as ErrorCode) {
    case "invalid_credentials":
      return "メールアドレスまたはパスワードが正しくありません。";
    case "disabled":
      return "このアカウントは現在利用できません。管理者にお問い合わせください。";
    case "trial_expired":
      return "試用期間が終了しています。";
    case "rate_limited":
      return "試行回数が多すぎます。しばらく待ってから再度お試しください。";
    case "invalid_request":
      return "リクエストが正しくありません。もう一度お試しください。";
    default:
      return null;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  const message = errorMessage(sp.error);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "min(360px, 90vw)",
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: "32px 28px",
        }}
      >
        <h1 style={{ fontSize: 18, margin: "0 0 20px" }}>占術アプリ ログイン</h1>

        {message && (
          <p
            role="alert"
            style={{
              color: "#b00020",
              background: "#fdeaea",
              border: "1px solid #f3c2c2",
              borderRadius: 4,
              padding: "8px 10px",
              fontSize: 13,
              margin: "0 0 16px",
            }}
          >
            {message}
          </p>
        )}

        <form method="POST" action="/api/auth/login">
          <input type="hidden" name="next" value={next} />

          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            メールアドレス
          </label>
          <input
            type="email"
            name="email"
            required
            autoFocus
            autoComplete="username"
            style={inputStyle}
          />

          <label style={{ display: "block", fontSize: 13, margin: "14px 0 4px" }}>
            パスワード
          </label>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            style={inputStyle}
          />

          <button type="submit" style={buttonStyle}>
            ログイン
          </button>
        </form>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  fontSize: 14,
  border: "1px solid #ccc",
  borderRadius: 4,
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 20,
  padding: "10px 0",
  fontSize: 14,
  fontWeight: 600,
  color: "#fff",
  background: "#333",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};
