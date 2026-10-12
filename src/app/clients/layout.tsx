// src/app/clients/layout.tsx
//
// /clients セグメントのメタデータ（他ページのタイトルは変更しない）。

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "顧客管理",
  description: "命術（七政四餘・紫微斗数・四柱推命）の顧客名簿",
};

export default function ClientsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
