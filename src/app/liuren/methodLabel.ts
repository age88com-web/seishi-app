// src/app/liuren/methodLabel.ts
//
// 課体の表示名（UI 専用）。エンジンの三伝結果（method / pattern）はそのまま使い、
// 画面に出すときだけ「九宗法の法名（課名）」の形に組み立てる。
//   例: method=元首 → 賊剋（元首課）、method=涉害・pattern=見機格 → 涉害（見機格）
// 計算ロジック・内部の課体判定には関与しない。

import type { SanchuanMethod, SanchuanResult } from "@/lib/liuren";

export interface MethodLabel {
  /** 九宗法の法名（例: 賊剋） */
  law: string;
  /** 課名・格名（例: 元首課）。ないときは null */
  kaku: string | null;
}

/** エンジンの method → 九宗法の法名 */
const LAW_OF: Record<SanchuanMethod, string> = {
  重審: "賊剋", 元首: "賊剋", 比用: "比用", 涉害: "涉害", 遥剋: "遥剋",
  昴星: "昴星", 別責: "別責", 八専: "八専", 伏吟: "伏吟", 返吟: "返吟",
};

/** pattern がないときに method から補う課名 */
const KAKU_OF_METHOD: Partial<Record<SanchuanMethod, string>> = {
  重審: "重審課", 元首: "元首課",
};

/**
 * 比用で決まった課が、下賊・上剋のどちらの複数候補からだったか。
 * 判定過程（trace）の「比用」段階の記録（「下賊が複数…」「上剋が複数…」）から読むだけで、計算はしない。
 */
function biyongKind(s: SanchuanResult): "下賊" | "上剋" | null {
  const step = s.trace.find((t) => t.stage === "比用" && /^(下賊|上剋)が複数/.test(t.detail));
  if (!step) return null;
  return step.detail.startsWith("下賊") ? "下賊" : "上剋";
}

export function methodLabel(s: SanchuanResult): MethodLabel {
  const law = LAW_OF[s.method];
  if (s.status === "undetermined") return { law, kaku: "三伝未確定" };
  if (s.method === "比用") {
    // 下賊上の複数候補から＝比用課、上剋下の複数候補から＝知一課（九宗法一覧 docs/source/九相門.jpg）
    const kind = biyongKind(s);
    return { law, kaku: kind === "上剋" ? "知一課" : kind === "下賊" ? "比用課" : null };
  }
  // 計算理由の補足（例:「不虞格（初伝自刑）」の「（初伝自刑）」）は画面に出さない
  const pattern = s.pattern ? s.pattern.replace(/（.+）$/, "") : null;
  return { law, kaku: pattern ?? KAKU_OF_METHOD[s.method] ?? null };
}

/** 画面表示用の文字列（例: 賊剋（元首課）） */
export function methodLabelText(s: SanchuanResult): string {
  const { law, kaku } = methodLabel(s);
  return kaku ? `${law}（${kaku}）` : law;
}
