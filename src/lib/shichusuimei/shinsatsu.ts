// src/lib/shichusuimei/shinsatsu.ts
//
// 神煞 13種（p79〜99、D1・D5・D24）。三煞（p100）は方位用のため判定しない。
//
// - 「年干または日干」「年支または日支」は年柱側・日柱側を独立に判定し、
//   成立根拠を matchedBy に持つ（D24）。同じ位置の同じ神煞は1件にまとめる。
// - 大運にも当てはめるのは講座に記載のある 貴人・驛馬・桃花・亡神（spec §10.1 appliesTo）。
//   文昌は命式内のみ。その他は命式の干支のみ。

import { STEMS } from "../eto";
import type {
  Branch,
  Pillar,
  PillarKey,
  ShinsatsuHit,
  ShinsatsuMatchedBy,
  ShinsatsuPosition,
  Stem,
} from "./types";
import {
  KIJIN,
  TENTOKU,
  GETTOKU,
  EKIBA,
  TOKA,
  BUNSHO,
  KAGAI,
  KOSHIN_KASHUKU,
  ROKU,
  YOJIN,
  TENRA_CHIMO,
  KAIKO,
  BOJIN,
} from "./data";

export interface ShinsatsuInput {
  pillars: { 時: Pillar | null; 日: Pillar; 月: Pillar; 年: Pillar };
  /** 大運の干支（第1大運から）。不要なら省略 */
  luck?: readonly Pillar[];
}

const PILLAR_KEYS: readonly PillarKey[] = ["時", "日", "月", "年"];
const MATCHED_BY_ORDER: readonly ShinsatsuMatchedBy[] = [
  "yearStem", "dayStem", "yearBranch", "dayBranch", "monthBranch", "dayPillar", "anyBranch",
];

interface Key<T> {
  value: T;
  by: ShinsatsuMatchedBy;
}

export function judgeShinsatsu(input: ShinsatsuInput): ShinsatsuHit[] {
  const { pillars } = input;
  const luck = input.luck ?? [];
  const hits = new Map<string, ShinsatsuHit>();

  const add = (
    id: string,
    name: string,
    subType: string | null,
    position: ShinsatsuPosition,
    by: ShinsatsuMatchedBy,
  ) => {
    const posKey =
      position.kind === "pillar" ? `${position.pillar}${position.part}` : `luck${position.luckIndex}`;
    const key = `${id}|${subType ?? ""}|${posKey}`;
    const hit = hits.get(key) ?? { id, name, subType, position, matchedBy: [] };
    if (!hit.matchedBy.includes(by)) hit.matchedBy.push(by);
    hits.set(key, hit);
  };

  const presentPillars = PILLAR_KEYS.filter((k) => pillars[k] !== null);

  const markBranch = (
    id: string,
    name: string,
    target: Branch,
    by: ShinsatsuMatchedBy,
    includeLuck: boolean,
    subType: string | null = null,
  ) => {
    for (const k of presentPillars) {
      if (pillars[k]!.branch === target) add(id, name, subType, { kind: "pillar", pillar: k, part: "支" }, by);
    }
    if (includeLuck) {
      luck.forEach((p, luckIndex) => {
        if (p.branch === target) add(id, name, subType, { kind: "luck", luckIndex, branch: p.branch }, by);
      });
    }
  };

  const markStem = (id: string, name: string, target: Stem, by: ShinsatsuMatchedBy) => {
    for (const k of presentPillars) {
      if (pillars[k]!.stem === target) add(id, name, null, { kind: "pillar", pillar: k, part: "干" }, by);
    }
  };

  const stemKeys: Key<Stem>[] = [
    { value: pillars.年.stem, by: "yearStem" },
    { value: pillars.日.stem, by: "dayStem" },
  ];
  const branchKeys: Key<Branch>[] = [
    { value: pillars.年.branch, by: "yearBranch" },
    { value: pillars.日.branch, by: "dayBranch" },
  ];
  const monthBranch = pillars.月.branch;

  // 1 貴人（年干・日干、大運にも）
  for (const k of stemKeys) for (const b of KIJIN[k.value]) markBranch("kijin", "貴人", b, k.by, true);

  // 2 天徳（月支 → 干または支）
  const tentoku = TENTOKU[monthBranch];
  if ((STEMS as readonly string[]).includes(tentoku)) markStem("tentoku", "天徳", tentoku as Stem, "monthBranch");
  else markBranch("tentoku", "天徳", tentoku as Branch, "monthBranch", false);

  // 3 月徳（月支 → 干）
  markStem("gettoku", "月徳", GETTOKU[monthBranch], "monthBranch");

  // 4 驛馬・5 桃花（年支・日支、大運にも）
  for (const k of branchKeys) {
    markBranch("ekiba", "驛馬", EKIBA[k.value], k.by, true);
    markBranch("toka", "桃花", TOKA[k.value], k.by, true);
  }

  // 6 文昌（年干・日干、命式内のみ）
  for (const k of stemKeys) markBranch("bunsho", "文昌", BUNSHO[k.value], k.by, false);

  // 7 華蓋・8 弧辰寡宿（年支・日支）
  for (const k of branchKeys) {
    markBranch("kagai", "華蓋", KAGAI[k.value], k.by, false);
    for (const b of KOSHIN_KASHUKU[k.value]) markBranch("koshin_kashuku", "弧辰寡宿", b, k.by, false);
  }

  // 9 禄（年干・日干）
  for (const k of stemKeys) markBranch("roku", "禄", ROKU[k.value], k.by, false);

  // 10 羊刃（日干のみ。陰干は講座に記載なし）
  const yojin = YOJIN[pillars.日.stem];
  if (yojin) markBranch("yojin", "羊刃", yojin, "dayStem", false);

  // 11 天羅・地網（命式内の地支どれでも）
  for (const [subType, b] of TENRA_CHIMO) markBranch("tenra_chimo", "天羅地網", b, "anyBranch", false, subType);

  // 12 魁罡（日柱）
  if (KAIKO.includes(`${pillars.日.stem}${pillars.日.branch}`)) {
    add("kaiko", "魁罡", null, { kind: "pillar", pillar: "日", part: "柱" }, "dayPillar");
  }

  // 13 亡神（年支、大運にも）
  markBranch("bojin", "亡神", BOJIN[pillars.年.branch], "yearBranch", true);

  const result = [...hits.values()];
  for (const h of result) {
    h.matchedBy.sort((a, b) => MATCHED_BY_ORDER.indexOf(a) - MATCHED_BY_ORDER.indexOf(b));
  }
  return result;
}
