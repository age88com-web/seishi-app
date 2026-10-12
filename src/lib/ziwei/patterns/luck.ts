// src/lib/ziwei/patterns/luck.ts
//
// 吉星・凶星・平星の分類（入門 p.15「諸星曜」の34星の一覧の区分をそのまま転記）。
// 格局の「吉星」はこの吉星、「煞星」はこの凶星として判定する（2026-09-30 ユーザー確定、docs/ziwei-basic-spec.md §23.4）。

import type { PlacedStar, TransformationKind } from "../types";

export type LuckClass = "吉星" | "凶星" | "平星";

/** 入門 p.15（PDF 16）の分類。四化4星を含む34星 */
export const STAR_LUCK: Readonly<Record<PlacedStar | TransformationKind, LuckClass>> = {
  紫微星: "吉星",
  天機星: "吉星",
  太陽星: "吉星",
  武曲星: "吉星",
  天同星: "吉星",
  廉貞星: "凶星",
  天府星: "吉星",
  太陰星: "吉星",
  貪狼星: "凶星",
  巨門星: "凶星",
  天相星: "吉星",
  天梁星: "吉星",
  七殺星: "凶星",
  破軍星: "凶星",
  文昌星: "吉星",
  文曲星: "吉星",
  左輔星: "吉星",
  右弼星: "吉星",
  天魁星: "吉星",
  天鉞星: "吉星",
  禄存星: "吉星",
  擎羊星: "凶星",
  陀羅星: "凶星",
  火星: "凶星",
  鈴星: "凶星",
  化禄星: "吉星",
  化権星: "吉星",
  化科星: "吉星",
  化忌星: "凶星",
  天馬星: "吉星",
  地劫星: "凶星",
  天空星: "凶星",
  天姚星: "平星",
  紅鸞星: "吉星",
};

export const LUCK_SOURCE = { source: "紫微斗数入門", page: "p.15", heading: "諸星曜（34の星曜の名称と意味）" } as const;

export const isLucky = (s: PlacedStar | TransformationKind): boolean => STAR_LUCK[s] === "吉星";
/** 格局の「煞星」＝入門の凶星 */
export const isMalefic = (s: PlacedStar | TransformationKind): boolean => STAR_LUCK[s] === "凶星";
