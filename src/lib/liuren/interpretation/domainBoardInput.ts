// src/lib/liuren/interpretation/domainBoardInput.ts
//
// 役割（Phase 5B。Phase 5A の careerDomain から共通部分を切り出したもの）:
//   DOMAIN 判断が共通に使う盤の入力（干上と三伝の比較・三伝が通り過ぎる支・昼夜貴人支・日干の寄宮・
//   本人の本命と IdentityLink・太歳の IdentityLink と上の支）を、既存の FACT から組み立てる。新しい計算はしない。
//   本命・太歳がないときは null や空にして、不足として返す（判断は止めない）。

import type { Branch } from "../types";
import { anchorResolutionContextOf } from "./anchorResolver";
import type { AnchorResolutionContext } from "./anchorResolver";
import { resolveContextBranch } from "./contextBranch";
import { resolveDerivedContextBranch } from "./contextBranchDerivation";
import { dayNightNobleBranchPairStateOf } from "./dayNightNobleBranchPair";
import type { DomainMissingFact } from "./domainResult";
import { collectIdentityLinks } from "./identityLink";
import type { IdentityLink } from "./identityLink";
import type { ContextBranchSource, InterpretationContext } from "./roles";
import { transmissionPassageOf } from "./transmissionPassage";
import type { TransmissionPassage } from "./transmissionPassage";
import type { DayNightNobleBranchPairState, InterpretationFacts, StandingPathComparison } from "./types";

export interface DomainBoardInput {
  facts: InterpretationFacts;
  ctx: AnchorResolutionContext;
  comparison: StandingPathComparison;
  /** 三伝が通り過ぎる支（一直線に動かなければ null） */
  passage: TransmissionPassage | null;
  noblePair: DayNightNobleBranchPairState;
  /** 日干の寄宮支（一課の地盤支） */
  lodgingBranch: Branch;
  /** subject の人物の本命の支（なければ null）と、その盤とのつながり */
  subjectNatalBranch: Branch | null;
  subjectLinks: readonly IdentityLink[];
  /** 太歳の支・盤とのつながり・太歳の上（heavenOn）の支（なければ null・空） */
  taiSuiBranch: Branch | null;
  taiSuiLinks: readonly IdentityLink[];
  taiSuiHeavenOn: Branch | null;
}

/** 盤の入力を組み立てる。三伝が未確定なら input は null */
export function buildDomainBoardInput(
  facts: InterpretationFacts, context: InterpretationContext, monthBranch?: Branch | null,
): { input: DomainBoardInput | null; missing: DomainMissingFact[] } {
  const missing: DomainMissingFact[] = [];
  const ctx = anchorResolutionContextOf(facts, monthBranch);
  const comparison = ctx.comparison;
  if (!comparison) return { input: null, missing: [{ key: "transmissions", detail: "三伝が未確定なので判断できない" }] };
  let subjectNatalBranch: Branch | null = null;
  let subjectLinks: readonly IdentityLink[] = [];
  if (context.subjectPersonId !== undefined) {
    const src: ContextBranchSource = { kind: "personNatalYear", personId: context.subjectPersonId };
    const r = resolveContextBranch(context, src);
    if (r.status === "resolved") {
      subjectNatalBranch = r.branch;
      subjectLinks = collectIdentityLinks(ctx, context, [src]).links;
    } else missing.push({ key: "natalYear", detail: `本人の本命・年命がない（${r.reason}）ので年命の読みは省略` });
  } else missing.push({ key: "natalYear", detail: "本人（subjectPersonId）の本命・年命がないので年命の読みは省略" });
  let taiSuiLinks: readonly IdentityLink[] = [];
  let taiSuiHeavenOn: Branch | null = null;
  if (context.taiSui) {
    const src: ContextBranchSource = { kind: "taiSui" };
    taiSuiLinks = collectIdentityLinks(ctx, context, [src]).links;
    const on = resolveDerivedContextBranch(facts, context, { source: src, derivation: "heavenOn" });
    taiSuiHeavenOn = on.status === "resolved" ? on.branch : null;
  } else missing.push({ key: "taiSui", detail: "太歳がないので太歳の読みは省略" });
  return {
    input: {
      facts, ctx, comparison,
      passage: transmissionPassageOf({ initial: comparison.path.initial.branch, middle: comparison.path.middle.branch, final: comparison.path.final.branch }, comparison.movementPattern),
      noblePair: dayNightNobleBranchPairStateOf(facts),
      lodgingBranch: facts.lessons[0].lowerBranch,
      subjectNatalBranch, subjectLinks,
      taiSuiBranch: context.taiSui?.branch ?? null, taiSuiLinks, taiSuiHeavenOn,
    },
    missing,
  };
}
