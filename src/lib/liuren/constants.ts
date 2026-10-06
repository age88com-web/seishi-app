// src/lib/liuren/constants.ts
//
// 役割:
//   六壬神課の定数表。すべて『六壬神課講座』の該当ページから転記し、
//   ページを併記する。講座にない表は追加しない。
//
// 干支名 STEMS / BRANCHES と型は既存 src/lib/eto.ts を再利用する（奇門遁甲と同じ）。

import { STEMS, BRANCHES } from "../eto";
import type { Stem, Branch, Element, HeavenlyGeneral } from "./types";

export { STEMS, BRANCHES };

/** 十干寄宮（講座 p5。p26・p28〜31・p43 にも同じ表） */
export const JIGONG: Record<Stem, Branch> = {
  甲: "寅", 乙: "辰", 丙: "巳", 丁: "未", 戊: "巳",
  己: "未", 庚: "申", 辛: "戌", 壬: "亥", 癸: "丑",
};

/**
 * 十干の五行。講座には独立表がないため、p56 の十二天将「所属干支」
 * （己丑土・丁巳火・丙午火・乙卯木・戊辰土・甲寅木・戊戌土・庚申金・
 *   己未土・癸亥水・辛酉金・壬子水）から全十干を読み取った値。
 */
export const STEM_ELEMENT: Record<Stem, Element> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土",
  己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};

/** 十二支の五行（出典は STEM_ELEMENT と同じ p56 の所属干支） */
export const BRANCH_ELEMENT: Record<Branch, Element> = {
  子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火",
  午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水",
};

/** 五行の相剋（A が剋す相手）。講座 p51「剋は五行関係でいう剋と同じ」 */
export const ELEMENT_CONTROLS: Record<Element, Element> = {
  木: "土", 土: "水", 水: "火", 火: "金", 金: "木",
};

/** 五行の相生（A が生ずる相手）。講座 p55 の六親の定義で使う */
export const ELEMENT_GENERATES: Record<Element, Element> = {
  木: "火", 火: "土", 土: "金", 金: "水", 水: "木",
};

/**
 * 陰陽。
 *   十二支: 講座 p16「子は陽、丑は陰、寅は陽、卯は陰と交互」＝ BRANCHES の偶数番目が陽。
 *   十干:   講座 p16・p22 等の例示（甲・丙・戊・庚・壬＝陽、乙・丁・己・辛・癸＝陰）。
 *           STEMS の偶数番目が陽。
 */
export function isYangStem(s: Stem): boolean {
  return STEMS.indexOf(s) % 2 === 0;
}
export function isYangBranch(b: Branch): boolean {
  return BRANCHES.indexOf(b) % 2 === 0;
}

/** 昼貴人・夜貴人（講座 p8・p42） */
export const NOBLE_DAY: Record<Stem, Branch> = {
  甲: "未", 乙: "申", 丙: "酉", 丁: "亥", 戊: "丑",
  己: "子", 庚: "丑", 辛: "寅", 壬: "卯", 癸: "巳",
};
export const NOBLE_NIGHT: Record<Stem, Branch> = {
  甲: "丑", 乙: "子", 丙: "亥", 丁: "酉", 戊: "未",
  己: "申", 庚: "未", 辛: "午", 壬: "巳", 癸: "卯",
};

/** 昼占となる占時（講座 p8：卯の刻〜申の刻）。それ以外（酉〜寅）は夜占 */
export const DAY_BRANCHES: readonly Branch[] = ["卯", "辰", "巳", "午", "未", "申"];

/** 貴人の位置がこの地盤支なら順布、それ以外（巳〜戌）は逆布（講座 p9・p42） */
export const FORWARD_POSITIONS: readonly Branch[] = ["亥", "子", "丑", "寅", "卯", "辰"];

/** 十二天将の順序（講座 p9「貴蛇雀合陳龍　空虎常武陰后」） */
export const GENERALS: readonly HeavenlyGeneral[] = [
  "貴人", "螣蛇", "朱雀", "六合", "勾陳", "青龍",
  "天空", "白虎", "太常", "玄武", "太陰", "天后",
];

/** 刑（講座 p32・p52） */
export const XING: Record<Branch, Branch> = {
  子: "卯", 丑: "戌", 寅: "巳", 卯: "子", 辰: "辰", 巳: "申",
  午: "午", 未: "丑", 申: "寅", 酉: "酉", 戌: "未", 亥: "亥",
};

/** 冲（講座 p32・p53） */
export const CHONG: Record<Branch, Branch> = {
  子: "午", 丑: "未", 寅: "申", 卯: "酉", 辰: "戌", 巳: "亥",
  午: "子", 未: "丑", 申: "寅", 酉: "卯", 戌: "辰", 亥: "巳",
};

/** 駅馬（講座 p40） */
export const YIMA: Record<Branch, Branch> = {
  子: "寅", 丑: "亥", 寅: "申", 卯: "巳", 辰: "寅", 巳: "亥",
  午: "申", 未: "巳", 申: "寅", 酉: "亥", 戌: "申", 亥: "巳",
};

/** 孟仲季（講座 p19〜21 の図・p63） */
export const MENG: readonly Branch[] = ["寅", "巳", "申", "亥"];
export const ZHONG: readonly Branch[] = ["子", "卯", "午", "酉"];

/**
 * 月将（講座 p4）。中気の太陽黄経 → 月将。
 * 「月将は中気から中気まで」。冬至(270°)＝丑 から 30° ごとに逆行する。
 */
export const MONTH_GENERAL_BY_ZHONGQI: readonly { term: string; longitude: number; general: Branch }[] = [
  { term: "冬至", longitude: 270, general: "丑" },
  { term: "大寒", longitude: 300, general: "子" },
  { term: "雨水", longitude: 330, general: "亥" },
  { term: "春分", longitude: 0, general: "戌" },
  { term: "穀雨", longitude: 30, general: "酉" },
  { term: "小満", longitude: 60, general: "申" },
  { term: "夏至", longitude: 90, general: "未" },
  { term: "大暑", longitude: 120, general: "午" },
  { term: "処暑", longitude: 150, general: "巳" },
  { term: "秋分", longitude: 180, general: "辰" },
  { term: "霜降", longitude: 210, general: "卯" },
  { term: "小雪", longitude: 240, general: "寅" },
];

/**
 * 返吟・無親格で、賊剋がないとき初伝を「巳」とする日（講座 p40）。
 * 辛未・辛丑・丁丑・己丑は日支の駅馬を初伝とする（同 p40）。
 */
export const FANYIN_NO_ZEIKE_SI_DAYS: readonly string[] = ["丁未", "己未"];
export const FANYIN_NO_ZEIKE_YIMA_DAYS: readonly string[] = ["辛未", "辛丑", "丁丑", "己丑"];

/**
 * 十干の干合（別責・陽日で使う。初伝＝干合する干の寄宮支の上神）。
 * 根拠: 規則は講座 p26、例は p27 の「戊 → 癸」。講座に表はないため、
 *   対応表はユーザー確認済みの確定仕様（2026-09-25）: 甲己・乙庚・丙辛・丁壬・戊癸（逆方向も同じ）。
 */
export const GANHE: Record<Stem, Stem> = {
  甲: "己", 乙: "庚", 丙: "辛", 丁: "壬", 戊: "癸",
  己: "甲", 庚: "乙", 辛: "丙", 壬: "丁", 癸: "戊",
};

/**
 * 三合局（講座 p54。生・旺・墓の順）。別責・陰日の「日支の三合局のなかでつぎの支」で使う。
 * 生→旺→墓→生と循環する（墓の次は生）。循環はユーザー確認済みの確定仕様（2026-09-25）。
 */
export const SANHE: readonly (readonly [Branch, Branch, Branch])[] = [
  ["亥", "卯", "未"], // 木局
  ["寅", "午", "戌"], // 火局
  ["巳", "酉", "丑"], // 金局
  ["申", "子", "辰"], // 水局
];

/**
 * 伏吟で干上神（一課）を初伝とする日干。それ以外（丁・己・辛）は支上神（三課）。
 * 乙・癸は陰日だが、伏吟でも一課に剋がある（乙が辰を剋す／丑が癸を剋す）ため一課を取る。
 * 根拠: 講座 p32〜35 と、ユーザー確認済みの確定仕様（2026-09-25）。
 */
export const FUYIN_GAN_FIRST: readonly Stem[] = ["甲", "乙", "丙", "戊", "庚", "壬", "癸"];
