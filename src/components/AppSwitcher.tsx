"use client";

// src/components/AppSwitcher.tsx
//
// 占術切替ナビゲーション（共通コンポーネント）。
//   画面上部に表示し、七政四餘 / 奇門遁甲 をクリックで切り替える。
//   Next.js の <Link> を使うのでページ全体の再読み込みは発生しない。
//   将来「擇日」「六壬神課」等を ITEMS へ追加するだけで拡張できる。
//   印刷時は AppSwitcher.css の @media print で非表示。
//
// 排盤ロジック・CalendarEngine・剋應データ・各ページUIの内部は変更しない。

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./AppSwitcher.css";

type SwitcherItem = { href: string; label: string };

// 追加占術はここへ 1 行足すだけ（例: { href: "/takujitsu", label: "擇日" }）。
const ITEMS: readonly SwitcherItem[] = [
  { href: "/", label: "七政四餘" },
  { href: "/qimen", label: "奇門遁甲" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppSwitcher() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="app-switcher" aria-label="占術切替">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "app-switcher-item is-active" : "app-switcher-item"}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
