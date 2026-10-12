// src/lib/ziwei/sanfang.ts
//
// 三方四正（本宮・対宮・三合2宮）。十二支の番号から機械的に求める:
//   対宮（対冲）＝6支先、三合＝4支先と4支前（基礎編 S16「対冲にある宮」「四つづつ進んだ三合となる宮」）。
// 作盤の計算には使わない（/ziwei の強調表示と象意コンテキストの取得で共用する）。

import type { Branch } from "./types";
import { branchAt, branchIndex } from "./data";

export interface Sanfang {
  self: Branch;
  opposite: Branch;
  trines: [Branch, Branch];
}

export function sanfangSizheng(b: Branch): Sanfang {
  const i = branchIndex(b);
  return {
    self: b,
    opposite: branchAt(i + 6),
    trines: [branchAt(i + 4), branchAt(i - 4)],
  };
}
