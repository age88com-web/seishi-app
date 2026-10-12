// src/app/ziwei/layout.tsx
//
// /ziwei セグメントのメタデータ（他ページのタイトルは変更しない）。

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "紫微斗数 検証",
  description: "紫微斗数 Phase 1 作盤の検証用ページ（十二宮・34星・四化・大限・小限）",
};

export default function ZiweiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
