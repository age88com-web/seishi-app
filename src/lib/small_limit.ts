// src/lib/small_limit.ts
// 七政四余：小限
// 規則（『七政四餘鑑定用資料』小限法）：生まれた年（0歳）＝命宮、1歳＝財帛宮、2歳＝兄弟宮…と1年1宮で進み、12歳で命宮に戻る。
//   進行方向は従来どおり（BRANCHES_B の並びで命宮から逆方向）。男女による順逆はない。
//   当宮の k = (命宮位置 − 当宮位置 + 12) % 12、当宮の小限年齢は k, 12+k, 24+k, …
//   （2026-10-01 修正：従来は 1+k 起点＝1歳が命宮で、資料と1年ずれていた）

export type Branch =
  | "子" | "丑" | "寅" | "卯" | "辰" | "巳" | "午" | "未" | "申" | "酉" | "戌" | "亥";

// B基準（0°=戌）十二支順（ChartSVG・big_limit と同じ並び）
const BRANCHES_B: Branch[] = ["戌","亥","子","丑","寅","卯","辰","巳","午","未","申","酉"];

function indexOfBranchB(br: string): number {
  const i = BRANCHES_B.indexOf(br as Branch);
  return i >= 0 ? i : 0; // ChartSVG の既存実装と同じく、見つからない場合は 0
}

/** 当宮の小限ステップ k（0..11） */
export function smallLimitStep(mingBranch: string, branch: string): number {
  return (indexOfBranchB(mingBranch) - indexOfBranchB(branch) + 12) % 12;
}

/** 当宮の小限年齢（S ラベル用）：k, 12+k, 24+k …（命宮は S0, S12, S24） */
export function smallLimitAgesForBranch(mingBranch: string, branch: string, count = 3): number[] {
  const k = smallLimitStep(mingBranch, branch);
  return Array.from({ length: count }, (_, n) => 12 * n + k);
}

/** 指定年齢（targetAge、0歳から）の小限宮。S ラベル「S{targetAge}」が付く宮（0歳＝命宮） */
export function getCurrentSmallLimitBranch(mingBranch: string, targetAge: number): Branch | null {
  if (!Number.isInteger(targetAge) || targetAge < 0) return null;
  const k = targetAge % 12;
  return BRANCHES_B[(indexOfBranchB(mingBranch) - k + 12) % 12];
}
