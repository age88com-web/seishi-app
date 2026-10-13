// src/lib/liuren/interpretation/movementFacts.ts
//
// 役割（Phase 5C）:
//   行人・出行の DOMAIN 判断が読む「移動の構造」の FACT。既存の FACT（干上・支上・三伝・空亡・坐空・驛馬・旬丁・天地盤・天将・課体）を
//   参照して並べるだけで、帰る・行ける などの判断や吉凶は持たない。
//   新しく求めるのは、資料の条件をそのまま盤の値にしたものだけ:
//     - 天罡（辰）・河魁（戌）が加わる地盤支と、その孟仲季（『御定六壬直指』行人「視天罡之下神加孟…加仲…加季」）
//     - 発用が日支の前か後か（『六壬心鏡』行人門 注引『入式』「如子日丑寅為前，戌亥為後」。資料の例の±1・±2だけ）
//     - 逆十二格（『六壬大全』逆十二格。三伝の並びそのもの）
//     - 鋳印（三伝 巳戌卯。『六壬断案』例1・『大六壬指南』出行章 増補占例二）

import { BRANCH_ELEMENT, MENG, ZHONG } from "../constants";
import type { Branch, HeavenlyGeneral, SanchuanMethod } from "../types";
import { dayMarkersOf } from "./markers";
import type { DomainBoardInput } from "./domainBoardInput";
import type { MovementPattern, TransmissionPosition, Triple } from "./types";

const TRANSMISSIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];
const BRANCHES: readonly Branch[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

export type BranchClass = "孟" | "仲" | "季";
export const branchClassOf = (b: Branch): BranchClass => (MENG.includes(b) ? "孟" : ZHONG.includes(b) ? "仲" : "季");

/** 『六壬大全』逆十二格のうち、行人・出行に言及のある格（三伝の並び） */
export type ReverseTwelvePattern = "冥陰格" | "偃蹇格" | "悖戻格" | "凝陽格" | "顧祖格" | "渉疑格" | "極陰格" | "時遁格" | "励明格" | "回明格" | "転悖格" | "断澗格";
const REVERSE_TWELVE: Record<ReverseTwelvePattern, readonly [Branch, Branch, Branch]> = {
  冥陰格: ["寅", "子", "戌"], 偃蹇格: ["子", "戌", "申"], 悖戻格: ["戌", "申", "午"], 凝陽格: ["申", "午", "辰"],
  顧祖格: ["午", "辰", "寅"], 渉疑格: ["辰", "寅", "子"], 極陰格: ["丑", "亥", "酉"], 時遁格: ["亥", "酉", "未"],
  励明格: ["酉", "未", "巳"], 回明格: ["未", "巳", "卯"], 転悖格: ["巳", "卯", "丑"], 断澗格: ["卯", "丑", "亥"],
};

/** 盤上の1支の移動に関わる位置 */
export interface MovementBranchPlacement {
  branch: Branch;
  /** その支（天盤）が加わる地盤支 */
  earth: Branch;
  isVoid: boolean;
  atStemUpper: boolean;
  atSiteUpper: boolean;
  /** その支が上神の課（重複課はすべて） */
  lessons: readonly (1 | 2 | 3 | 4)[];
  transmissions: readonly TransmissionPosition[];
  /** その支に乗る天将 */
  general: HeavenlyGeneral;
}

export interface MovementFacts {
  isYangDay: boolean;
  lodgingBranch: Branch;
  dayBranch: Branch;
  stemUpper: Branch;
  siteUpper: Branch;
  divinationBranch: Branch;
  transmissions: Triple<Branch>;
  /** 各伝が加わる地盤支 */
  transmissionEarth: Triple<Branch>;
  movementPattern: MovementPattern;
  method: SanchuanMethod;
  pattern: string | null;
  /** 驛馬（日支基準）・旬丁の位置 */
  yima: MovementBranchPlacement;
  xunDing: MovementBranchPlacement;
  /** 天罡（辰）・河魁（戌）の位置と、加わる地盤支の孟仲季 */
  tianGang: MovementBranchPlacement & { earthClass: BranchClass };
  heKui: MovementBranchPlacement & { earthClass: BranchClass };
  /** 発用（初伝）の支 − 日支（mod 12、−5〜+6） */
  initialOffsetFromDayBranch: number;
  reverseTwelve: ReverseTwelvePattern | null;
  /** 三伝が 巳→戌→卯（鋳印） */
  zhuYin: boolean;
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const signedOffset = (from: Branch, to: Branch) => { const d = mod12(BRANCHES.indexOf(to) - BRANCHES.indexOf(from)); return d > 6 ? d - 12 : d; };

/** 移動 FACT を組み立てる（既存の FACT を参照するだけ） */
export function movementFactsOf(i: DomainBoardInput): MovementFacts {
  const f = i.facts;
  const t: Triple<Branch> = { initial: i.comparison.path.initial.branch, middle: i.comparison.path.middle.branch, final: i.comparison.path.final.branch };
  const stemUpper = f.lessons[0].upper, siteUpper = f.lessons[2].upper;
  const placement = (b: Branch): MovementBranchPlacement => ({
    branch: b, earth: f.plate.earthUnder[b], isVoid: f.xun.voidBranches.includes(b),
    atStemUpper: stemUpper === b, atSiteUpper: siteUpper === b,
    lessons: ([1, 2, 3, 4] as const).filter((n) => f.lessons[n - 1].upper === b),
    transmissions: TRANSMISSIONS.filter((p) => t[p] === b),
    general: f.generals.generalOn[b],
  });
  const markers = dayMarkersOf(f);
  const tg = placement("辰"), hk = placement("戌");
  const seq = [t.initial, t.middle, t.final].join("");
  const reverseTwelve = (Object.keys(REVERSE_TWELVE) as ReverseTwelvePattern[]).find((k) => REVERSE_TWELVE[k].join("") === seq) ?? null;
  return {
    isYangDay: "甲丙戊庚壬".includes(f.basic.dayStem),
    lodgingBranch: i.lodgingBranch, dayBranch: f.basic.dayBranch, stemUpper, siteUpper, divinationBranch: f.basic.divinationBranch,
    transmissions: t,
    transmissionEarth: { initial: f.plate.earthUnder[t.initial], middle: f.plate.earthUnder[t.middle], final: f.plate.earthUnder[t.final] },
    movementPattern: i.comparison.movementPattern,
    method: f.sanchuan.method, pattern: f.sanchuan.status === "determined" ? f.sanchuan.pattern : null,
    yima: placement(markers.yima.branch), xunDing: placement(markers.xunDing.branch),
    tianGang: { ...tg, earthClass: branchClassOf(tg.earth) }, heKui: { ...hk, earthClass: branchClassOf(hk.earth) },
    initialOffsetFromDayBranch: signedOffset(f.basic.dayBranch, t.initial),
    reverseTwelve, zhuYin: seq === "巳戌卯",
  };
}

/** 支の五行（起課エンジンの表） */
export const branchElement = (b: Branch) => BRANCH_ELEMENT[b];
