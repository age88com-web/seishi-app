// src/lib/liuren/interpretation/transmissionPassage.ts
//
// 役割（Phase 5A で追加した最小の中立 FACT）:
//   三伝が一歩ごとに「通り過ぎる支」（TransmissionPassage）。
//   『六壬断案２』例53「初伝辰から中伝午へ遷るのに、巳（丙日干）を通り過ぎてしまう」（訳注）の構造を表すためのもの。
//     向き … 既存の movementPattern（Phase 3B）が 進茹・進間 なら forward、退茹・退間 なら reverse。それ以外は一直線に動かないので null
//     支   … 各歩（初→中・中→末）で、その向きに進むときに間にはさまれる支（端は含まない。進茹・退茹では空）
//   どの支を通ったら何を意味するかは持たない（判断は DOMAIN 層）。吉凶は持たない。

import { shiftBranch } from "../relations";
import type { Branch } from "../types";
import type { MovementPattern, Triple } from "./types";

export interface TransmissionPassageStep {
  from: Branch;
  to: Branch;
  /** その向きに進むときに間にはさまれる支（端は含まない） */
  passed: readonly Branch[];
}

export interface TransmissionPassage {
  direction: "forward" | "reverse";
  steps: readonly [TransmissionPassageStep, TransmissionPassageStep];
}

/** 三伝の支と既存の movementPattern → 通り過ぎる支（一直線に動かない三伝は null） */
export function transmissionPassageOf(branches: Triple<Branch>, movementPattern: MovementPattern): TransmissionPassage | null {
  const direction = movementPattern === "進茹" || movementPattern === "進間" ? "forward"
    : movementPattern === "退茹" || movementPattern === "退間" ? "reverse" : null;
  if (!direction) return null;
  const unit = direction === "forward" ? 1 : -1;
  const step = (from: Branch, to: Branch): TransmissionPassageStep => {
    const passed: Branch[] = [];
    for (let b = shiftBranch(from, unit); b !== to; b = shiftBranch(b, unit)) passed.push(b);
    return { from, to, passed };
  };
  return { direction, steps: [step(branches.initial, branches.middle), step(branches.middle, branches.final)] };
}
