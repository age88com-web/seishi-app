// src/lib/shichusuimei/tsuhensei.ts
//
// 通変星（D2・D16）と五神（p57）。
// 日主と対象干の「五行の生剋関係」と「陰陽の同異」で決める（p105 の甲日主表の一般化）。
//
// | 関係（日主から見て） | 陰陽が同じ | 陰陽が異なる |
// | 同じ五行             | 比肩       | 劫財         |
// | 日主が生じる         | 食神       | 傷官         |
// | 日主が剋す           | 偏財       | 正財         |
// | 日主を剋す           | 偏官       | 正官         |
// | 日主を生じる         | 偏印       | 印綬         |

import type { Element, GoshinName, Stem, TsuhenName } from "./types";
import { STEM_ELEMENT, STEM_YINYANG, GENERATES, CONTROLS } from "./data";

/** 日主の五行から見た対象の五行の五神（p57） */
export function goshinOfElement(dayStem: Stem, element: Element): GoshinName {
  const self = STEM_ELEMENT[dayStem];
  if (element === self) return "比劫";
  if (GENERATES[self] === element) return "食傷";
  if (CONTROLS[self] === element) return "財";
  if (CONTROLS[element] === self) return "官";
  if (GENERATES[element] === self) return "印";
  throw new Error(`no relation between ${self} and ${element}`);
}

const TSUHEN: Readonly<Record<GoshinName, readonly [TsuhenName, TsuhenName]>> = {
  // [陰陽が同じ, 陰陽が異なる]
  比劫: ["比肩", "劫財"],
  食傷: ["食神", "傷官"],
  財: ["偏財", "正財"],
  官: ["偏官", "正官"],
  印: ["偏印", "印綬"],
};

export function tsuhenOf(dayStem: Stem, target: Stem): TsuhenName {
  const goshin = goshinOfElement(dayStem, STEM_ELEMENT[target]);
  const sameYinYang = STEM_YINYANG[dayStem] === STEM_YINYANG[target];
  return TSUHEN[goshin][sameYinYang ? 0 : 1];
}
