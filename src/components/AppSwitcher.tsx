"use client";

// src/components/AppSwitcher.tsx
//
// 占術切替ナビゲーション（全占術ページ共通の唯一のナビ）。
//   画面上部に表示し、クリックで占術を切り替える。
//   Next.js の <Link> を使うのでページ全体の再読み込みは発生しない。
//   印刷時は AppSwitcher.css の @media print で非表示。
//
// どのページでも同じ構成・同じ見た目で表示する（開いているページで変わるのは active 表示だけ）:
//   命術       [七政四餘][紫微斗数][四柱推命][顧客管理]   ※顧客管理は命術専用の管理ページ
//   その他の術 [擇日][奇門遁甲][六壬神課]
//
// 排盤ロジック・CalendarEngine・剋應データ・各ページUIの内部は変更しない。

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./AppSwitcher.css";

type SwitcherItem = { href: string; label: string };
type SwitcherGroup = { label: string; items: readonly SwitcherItem[] };

// 追加占術は該当グループの items へ 1 行足すだけ。
const GROUPS: readonly SwitcherGroup[] = [
  {
    label: "命術",
    items: [
      { href: "/", label: "七政四餘" },
      { href: "/ziwei", label: "紫微斗数" },
      { href: "/shichusuimei", label: "四柱推命" },
      { href: "/clients", label: "顧客管理" },
    ],
  },
  {
    label: "その他の術",
    items: [
      { href: "/takujitsu", label: "擇日" },
      { href: "/qimen", label: "奇門遁甲" },
      { href: "/liuren", label: "六壬神課" },
    ],
  },
];

/** "/" は完全一致、それ以外はそのパス自身か配下（例: /qimen/search は奇門遁甲） */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppSwitcher() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="app-switcher" aria-label="占術切替">
      {GROUPS.map((group) => (
        <div key={group.label} className="app-switcher-group" role="group" aria-label={group.label}>
          <span className="app-switcher-group-label">{group.label}</span>
          {group.items.map((item) => {
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
        </div>
      ))}
    </nav>
  );
}
