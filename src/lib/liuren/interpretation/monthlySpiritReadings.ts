// src/lib/liuren/interpretation/monthlySpiritReadings.ts
//
// 役割（Phase 5L）:
//   DOMAIN の要約に、月建の神煞（monthlySpirits.ts）を使った読みを別の段として並べる。新しい判断はしない。
//   神煞を使った読み＝evidence の fact が "monthlySpirit." で始まる読み（各 DOMAIN の規則が、参照した神煞をそこに書く）。
//     象意（向きなし）・実現を助ける条件（favoring）・妨げる条件（hindering）・判断が相反する事項・判断できない事項に分ける。
//   既存の読み・要約は書き換えず、行を加えるだけ。

import type { Branch } from "../types";
import type { DomainReading } from "./domainResult";
import { MONTHLY_SPIRIT_DEFINITIONS } from "./monthlySpirits";
import type { MonthlySpiritKind, MonthlySpiritsState } from "./monthlySpirits";
import { SECONDARY_SPIRIT_DEFINITIONS } from "./secondarySpirits";
import type { SecondarySpiritKind, SecondarySpiritsState } from "./secondarySpirits";

const PREFIX = "monthlySpirit.";

/** evidence に書く fact 名（例: "monthlySpirit.tianMa"） */
export const spiritFact = (kind: MonthlySpiritKind) => `${PREFIX}${kind}`;

/** 月建の神煞を使った読みか */
export const isMonthlySpiritReading = (r: DomainReading) => r.evidence.some((e) => e.fact.startsWith(PREFIX));

/** 要約に加える行。unresolved は、この DOMAIN で神煞を使うが判断しない規則（理由つき） */
export function monthlySpiritSummaryLines(
  readings: readonly DomainReading[], spirits: MonthlySpiritsState | null, monthBranch: Branch | null | undefined, unresolved: readonly string[],
): string[] {
  if (!monthBranch || !spirits) {
    return ["月建の神煞による読み: 月支がないので、月建の神煞を使う読みは判断しない（推測しない）"];
  }
  const rs = readings.filter(isMonthlySpiritReading);
  const used = [...new Set(rs.flatMap((r) => r.evidence.filter((e) => e.fact.startsWith(PREFIX)).map((e) => e.fact.slice(PREFIX.length) as MonthlySpiritKind)))];
  const list = (d: DomainReading["direction"]) => rs.filter((r) => r.direction === d).map((r) => r.detected);
  const conflicts = [...new Set(rs.flatMap((r) => (r.direction === "neutral" ? [] : readings.filter((x) => x !== r && x.topic === r.topic && x.direction !== "neutral" && x.direction !== r.direction)
    .map(() => `「${r.label}」と同じ段階の他の読みが逆向き`))))];
  return [
    `月建の神煞による読み（月支 ${monthBranch}${used.length ? `。${used.map((k) => `${MONTHLY_SPIRIT_DEFINITIONS[k].name} ${spirits[k].branch}`).join("・")}` : ""}）:`,
    `・神煞が示す象意: ${rs.length ? list("neutral").join("。") || "なし" : "なし（この盤では神煞を使う規則が成立しない。吉凶を示すものではない）"}`,
    `・実現を助ける条件: ${list("favoring").join("。") || "なし"}`,
    `・実現を妨げる条件: ${list("hindering").join("。") || "なし"}`,
    `・判断が相反する事項: ${conflicts.length ? `${conflicts.join("・")}（相殺しない）` : "なし"}`,
    `・判断できない事項: ${unresolved.length ? unresolved.join("・") : "なし"}`,
  ];
}

const LESSON_LABEL: Record<1 | 2 | 3 | 4, string> = { 1: "干上", 2: "二課上神", 3: "支上", 4: "四課上神" };
const TRANSMISSION_LABEL = { initial: "初伝", middle: "中伝", final: "末伝" } as const;

// ---- Phase 5M: 太歳・第2群の神煞（secondarySpirits.ts）を使った読みの段 ----
const SECONDARY_PREFIX = "secondarySpirit.";
/** evidence に書く fact 名（例: "secondarySpirit.bingFu"） */
export const secondarySpiritFact = (kind: SecondarySpiritKind) => `${SECONDARY_PREFIX}${kind}`;

/** 要約に加える行（太歳・第2群の神煞）。basesMissing は基準（太歳・月支）がなくて判断しない神煞の説明 */
export function secondarySpiritSummaryLines(readings: readonly DomainReading[], spirits: SecondarySpiritsState, basesMissing: readonly string[], unresolved: readonly string[]): string[] {
  const rs = readings.filter((r) => r.evidence.some((e) => e.fact.startsWith(SECONDARY_PREFIX)));
  const used = [...new Set(rs.flatMap((r) => r.evidence.filter((e) => e.fact.startsWith(SECONDARY_PREFIX)).map((e) => e.fact.slice(SECONDARY_PREFIX.length) as SecondarySpiritKind)))];
  const list = (d: DomainReading["direction"]) => rs.filter((r) => r.direction === d).map((r) => r.detected);
  const conflicts = [...new Set(rs.flatMap((r) => (r.direction === "neutral" ? [] : readings.filter((x) => x !== r && x.topic === r.topic && x.direction !== "neutral" && x.direction !== r.direction)
    .map(() => `「${r.label}」と同じ段階の他の読みが逆向き`))))];
  return [
    `太歳・第2群の神煞による読み${used.length ? `（${used.map((k) => `${SECONDARY_SPIRIT_DEFINITIONS[k].name} ${spirits[k]!.branch}`).join("・")}）` : ""}:`,
    `・神煞が示す象意: ${rs.length ? list("neutral").join("。") || "なし" : "なし（この盤では太歳・第2群の神煞を使う規則が成立しない。吉凶を示すものではない）"}`,
    `・実現を助ける条件: ${list("favoring").join("。") || "なし"}`,
    `・実現を妨げる条件: ${list("hindering").join("。") || "なし"}`,
    `・判断が相反する事項: ${conflicts.length ? `${conflicts.join("・")}（相殺しない）` : "なし"}`,
    `・判断できない事項: ${[...basesMissing, ...unresolved].join("・") || "なし"}`,
  ];
}

/** 神煞の支が課伝のどこにあるか（どこにもなければ「課伝の外」）。位置の説明だけで判断はしない */
export function spiritPositionText(p: MonthlySpiritsState[MonthlySpiritKind]): string {
  const at = [...new Set(p.lessons.map((l) => LESSON_LABEL[l.index]))].concat((p.transmissions ?? []).map((t) => TRANSMISSION_LABEL[t.position]));
  return at.length ? at.join("・") : "課伝の外";
}
