// src/lib/ziwei/strength.ts
//
// §20 星の旺衰（廟旺利陥）。星名＋宮の地支 → 旺衰 の参照だけを行う（作盤ロジックには関与しない）。
// 正本: docs/ziwei-basic-spec.md §20
//
// 表は 入門 p.36 ＝ 基礎編 S14（全252セル一致）を資料の略記のまま転記し、正式名称に変換して持つ。
//   資料の略記: 廟・旺・地・利・平・不・陥（地＝得地、利＝利益、平＝平和、不＝不得地）
//   資料の誤植: 表の見出しの「羊」は「未」。羊刃系の行名は 入門「羊星」／基礎編「敬羊星」（値の違いはない）。作盤エンジンの星名は擎羊星。
// 表に行がない13星（左輔・右弼・天魁・天鉞・天空・地劫・天姚・天馬・紅鸞、および四化4星）と、
// 表の空欄（その星が入らない支）は旺衰なし（null）。
// 命盤A（入門 p.16・基礎編 S3）の火星・巳の「廟」は表（得地）と合わない資料不整合（needs_review）。表を正とする。

import type { Branch, PlacedStar, StarStrength } from "./types";
import { BRANCHES } from "./data";

/** 旺衰の7区分（強い順。§20.2） */
export const STAR_STRENGTHS: readonly StarStrength[] = ["廟", "旺", "得地", "利益", "平和", "不得地", "陥"];

/** 資料の表・命盤で使われている1字の略記 → 正式名称 */
export const SOURCE_STRENGTH_CHAR: Readonly<Record<string, StarStrength>> = {
  廟: "廟",
  旺: "旺",
  地: "得地",
  利: "利益",
  平: "平和",
  不: "不得地",
  陥: "陥",
};

/** 命盤上の1字表示（得＝得地、利＝利益、平＝平和、不＝不得地） */
export const STRENGTH_SHORT: Readonly<Record<StarStrength, string>> = {
  廟: "廟",
  旺: "旺",
  得地: "得",
  利益: "利",
  平和: "平",
  不得地: "不",
  陥: "陥",
};

/** 旺衰表（子〜亥の順。資料の略記のまま。「・」は資料の空欄） */
const SOURCE_TABLE: Readonly<Partial<Record<PlacedStar, string>>> = {
  紫微星: "平廟旺旺地旺廟廟旺旺地旺",
  天機星: "廟陥地旺利平廟陥地旺利平",
  太陽星: "陥不旺廟旺旺旺地地平不陥",
  武曲星: "旺廟地利廟平旺廟地利廟平",
  天同星: "旺不利平平廟陥不旺平平廟",
  廉貞星: "平利廟平利陥平利廟平利陥",
  天府星: "廟廟廟地廟地旺廟地旺廟地",
  太陰星: "廟廟旺陥陥陥不不利旺旺廟",
  貪狼星: "旺廟平利廟陥旺廟平利廟陥",
  巨門星: "旺不廟廟陥旺旺不廟廟陥旺",
  天相星: "廟廟廟陥地地廟地廟陥地地",
  天梁星: "廟旺廟廟廟陥廟旺陥地廟陥",
  七殺星: "旺廟廟旺廟平旺廟廟旺廟平",
  破軍星: "廟旺地陥旺平廟旺地陥旺平",
  文昌星: "地廟陥利地廟陥利地廟陥利",
  文曲星: "地廟平旺地廟陥旺地廟陥旺",
  禄存星: "廟・廟廟・廟廟・廟廟・廟",
  擎羊星: "陥廟・陥廟・陥廟・陥廟・",
  陀羅星: "・廟陥・廟陥・廟陥・廟陥",
  火星: "陥地廟利陥地廟利陥地廟利",
  鈴星: "陥地廟利陥地廟利陥地廟利",
};

/** STAR_STRENGTH[星名][地支] → 旺衰（正式名称）。表にない星・空欄はキーなし。 */
export const STAR_STRENGTH: Readonly<Partial<Record<PlacedStar, Partial<Record<Branch, StarStrength>>>>> =
  Object.fromEntries(
    Object.entries(SOURCE_TABLE).map(([star, row]) => [
      star,
      Object.fromEntries(
        BRANCHES.flatMap((b, i) => (row![i] === "・" ? [] : [[b, SOURCE_STRENGTH_CHAR[row![i]]]])),
      ),
    ]),
  );

/** 星と宮の地支から旺衰。旺衰表がない星・表の空欄は null。 */
export function starStrengthOf(star: PlacedStar, branch: Branch): StarStrength | null {
  return STAR_STRENGTH[star]?.[branch] ?? null;
}
