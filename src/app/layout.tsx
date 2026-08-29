// src/app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "七政四餘",
  description: "七政四餘 星盤",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
