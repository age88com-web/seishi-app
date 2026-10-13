// src/app/qimen/search/layout.tsx
//
// /qimen/search セグメントのメタデータ。

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "奇門遁甲 吉格日時検索",
  description: "奇門遁甲 吉格日時検索",
};

export default function QimenSearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
