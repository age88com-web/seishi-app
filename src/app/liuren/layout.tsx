// src/app/liuren/layout.tsx
//
// /liuren セグメントのメタデータ。
//   ルート layout の title は「七政四餘」。/liuren では「六壬神課 課式」で上書きする
//   （他ページのタイトルは変更しない）。

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "六壬神課 課式",
  description: "六壬神課 課式作成（天地盤・四課・三伝）",
};

export default function LiurenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
