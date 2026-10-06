"use client";

// src/lib/natalProfile/pageSettings.ts
//
// 各占術固有の設定（共通プロフィールに含めないもの）をページ単位で保持する小さなストア。
// 共通プロフィールと同じく localStorage に残し、ページ遷移・再読み込み後も選択を保つ。
// 復元は getSnapshot 内で同期的に行うので、ハイドレーション直後の計算でも復元済みの値を使える。

import { useSyncExternalStore } from "react";

export interface PageSettingsStore<T> {
  useSettings: () => T;
  get: () => T;
  set: (patch: Partial<T>) => void;
}

export function createPageSettings<T extends object>(
  storageKey: string,
  defaults: T,
  sanitize: (saved: Record<string, unknown>, defaults: T) => T,
): PageSettingsStore<T> {
  let value: T | null = null;
  const listeners = new Set<() => void>();

  const get = (): T => {
    if (value) return value;
    value = defaults;
    try {
      const s = localStorage.getItem(storageKey);
      if (s) {
        const o = JSON.parse(s);
        if (o && typeof o === "object") value = sanitize(o as Record<string, unknown>, defaults);
      }
    } catch {}
    return value;
  };

  const set = (patch: Partial<T>): void => {
    value = { ...get(), ...patch };
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {}
    for (const l of listeners) l();
  };

  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };

  return {
    useSettings: () => useSyncExternalStore(subscribe, get, () => defaults),
    get,
    set,
  };
}
