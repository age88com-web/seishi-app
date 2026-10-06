// src/app/takujitsu/layout.tsx
//
// /takujitsu セグメントのメタデータ。
//   ルート layout の title は「七政四餘」。/takujitsu では
//   「擇日」で上書きする（他ページのタイトルは変更しない）。

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "擇日",
  description: "擇日 暦情報・神殺・十二建除・二十八宿・用途判定",
};

export default function TakujitsuLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
