// src/app/qimen/layout.tsx
//
// /qimen セグメントのメタデータ。
//   ルート layout の title は「七政四餘」。/qimen では PDF 保存時などに
//   旧タイトルが使われないよう「奇門遁甲 排盤」で上書きする。
//   七政四餘側（ルート）のタイトルは変更しない。

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "奇門遁甲 排盤",
  description: "奇門遁甲 排盤",
};

export default function QimenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
