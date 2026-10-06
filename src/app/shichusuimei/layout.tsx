// src/app/shichusuimei/layout.tsx
//
// /shichusuimei セグメントのメタデータ（他ページのタイトルは変更しない）。

import type { Metadata } from "next";

export const metadata: Metadata = {
  // 印刷時にブラウザがページ上端へ出すタイトルにもなるため「検証」等は付けない
  title: "四柱推命",
  description: "四柱推命（命式・大運・蔵干・通変星・神煞・干支関係・強弱・格局）",
};

export default function ShichusuimeiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
