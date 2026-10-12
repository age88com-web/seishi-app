// src/lib/ziwei/meanings/advanced/data.ts
//
// 応用編・144命宮配置解釈のデータ（docs/source/ziwei_ouyou_rewritten.md を scripts/ziwei/extract_ouyou.py で変換）。
// 本文は資料の文のまま。主キーは 紫微星の支 × 命宮の支。「# 処理記録」は ADVANCED_SOURCE_META にだけ入れる。

import type { Branch } from "../../types";
import raw from "./data/ouyou.json";
import type { AdvancedItem } from "./types";

export const ADVANCED_ITEMS = raw.items as unknown as AdvancedItem[];

/** 資料の処理記録（本文解釈ではない。利用者向けの解釈文に使わない） */
export const ADVANCED_SOURCE_META = raw.meta as {
  source: string;
  title: string;
  note: string;
  processingRecord: string;
  numberingNote: string;
};

export const ADVANCED_SOURCE_LABEL = "紫微斗数応用編";

const BY_KEY = new Map<string, AdvancedItem>(ADVANCED_ITEMS.map((i) => [`${i.ziweiBranch}|${i.mingBranch}`, i]));

/** 紫微星の支 × 命宮の支 から項目を引く */
export function getAdvancedItem(ziweiBranch: Branch, mingBranch: Branch): AdvancedItem | null {
  return BY_KEY.get(`${ziweiBranch}|${mingBranch}`) ?? null;
}
