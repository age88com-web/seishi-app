// src/lib/liuren/interpretation/identityLink.ts
//
// 役割（Phase 4R）:
//   IDENTITY 層。人物・時間の盤外の支（ContextBranchSource とその一段の派生）が、盤上のどの位置とつながっているか（IdentityLink）を束ねる。
//   つながりは Phase 4P の compareBoardDerivedContextBranch で matches: true になった組だけ（比較そのものは Phase 4O・4P の API で引ける）。
//     出典     … 呼び出し側が明示的に渡す（subjectPersonId・counterpartyPersonId・太歳を自動では選ばない）
//     派生     … self・heavenOn・earthUnder（Phase 4P）
//     盤の位置 … Phase 4O で比べられる RelationAnchor 12種（日干・一課の下神は干なので含めない。干上と一課上神は別の位置として両方持つ）
//     順序     … 出典の入力順 → 派生（self・heavenOn・earthUnder）→ 盤の位置（IDENTITY_LINK_ANCHORS の順）。同じ組は二重に作らない
//   解決できない出典（personNotFound など）はつながりにせず、出典ごとに1件だけ unresolved に入れる（不一致とは区別する）。
//   六親・十二長生・天将・空亡・驛馬・吉凶・ROLE・DOMAIN・時期は持たない（つながり先の FACT は既存の関数で引く）。

import type { Branch } from "../types";
import type { AnchorResolutionContext, RelationAnchor } from "./anchorResolver";
import { compareBoardDerivedContextBranch } from "./contextBranchDerivation";
import type { ContextBranchDerivation, DerivedContextBranchSource } from "./contextBranchDerivation";
import type { ContextBranchSource, ContextBranchUnresolved, InterpretationContext } from "./roles";

/** 盤の位置（Phase 4O で支を比べられるもの。この順でつながりを並べる） */
export const IDENTITY_LINK_ANCHORS: readonly RelationAnchor[] = [
  { kind: "dayBranch" },
  { kind: "lesson", index: 1, part: "upper" },
  { kind: "lesson", index: 2, part: "upper" }, { kind: "lesson", index: 2, part: "lower" },
  { kind: "lesson", index: 3, part: "upper" }, { kind: "lesson", index: 3, part: "lower" },
  { kind: "lesson", index: 4, part: "upper" }, { kind: "lesson", index: 4, part: "lower" },
  { kind: "position", position: "standing" },
  { kind: "position", position: "initial" }, { kind: "position", position: "middle" }, { kind: "position", position: "final" },
];

const DERIVATIONS: readonly ContextBranchDerivation[] = ["self", "heavenOn", "earthUnder"];

/** 盤外の支（出典と派生）と盤上の位置のつながり */
export interface IdentityLink {
  source: DerivedContextBranchSource;
  anchor: RelationAnchor;
  /** 盤外の支（派生前） */
  baseBranch: Branch;
  /** つながっている支（派生後＝盤上の位置の支） */
  branch: Branch;
}

export interface IdentityLinkCollection {
  links: readonly IdentityLink[];
  /** 解決できなかった出典（出典ごとに1件） */
  unresolved: readonly { source: ContextBranchSource; reason: ContextBranchUnresolved["reason"] }[];
  /** 盤側で支が得られなかった位置（三伝未確定のときの干上・三伝など。位置ごとに1件） */
  unavailableAnchors: readonly RelationAnchor[];
}

const keyOf = (x: unknown) => JSON.stringify(x);

/** 指定した出典について、盤上の位置とのつながりを集める */
export function collectIdentityLinks(
  ctx: AnchorResolutionContext, context: InterpretationContext, sources: readonly ContextBranchSource[],
): IdentityLinkCollection {
  const links: IdentityLink[] = [];
  const unresolved: { source: ContextBranchSource; reason: ContextBranchUnresolved["reason"] }[] = [];
  const unavailable: RelationAnchor[] = [];
  const seen = new Set<string>();
  const seenSources = new Set<string>();
  const seenAnchors = new Set<string>();
  for (const source of sources) {
    if (seenSources.has(keyOf(source))) continue;
    seenSources.add(keyOf(source));
    let sourceUnresolved = false;
    for (const derivation of DERIVATIONS) {
      if (sourceUnresolved) break;
      const derived: DerivedContextBranchSource = { source, derivation };
      for (const anchor of IDENTITY_LINK_ANCHORS) {
        const c = compareBoardDerivedContextBranch(anchor, derived, ctx, context);
        if (c.status === "unresolved") {
          if (c.contextReason) {
            unresolved.push({ source, reason: c.contextReason });
            sourceUnresolved = true;
            break;
          }
          if (c.boardReason && !seenAnchors.has(keyOf(anchor))) {
            seenAnchors.add(keyOf(anchor));
            unavailable.push(anchor);
          }
          continue;
        }
        if (!c.matches) continue;
        const k = keyOf([source, derivation, anchor]);
        if (seen.has(k)) continue;
        seen.add(k);
        links.push({ source: derived, anchor, baseBranch: c.baseBranch, branch: c.contextBranch });
      }
    }
  }
  return { links, unresolved, unavailableAnchors: unavailable };
}
