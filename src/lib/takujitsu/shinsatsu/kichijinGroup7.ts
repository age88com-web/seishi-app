// src/lib/takujitsu/shinsatsu/kichijinGroup7.ts
//
// 役割:
//   未解決神殺の資料研究フェーズ（2026-10-26 監修決定）で成立条件が確定した
//   日家吉神（顕星・曲星・傅星・除神）を判定する。他グループのファイルは変更していない。
//
// 仕様根拠:
//   ・顕星・曲星・傅星：docs/source/擇日テキスト.pdf（43）p.19 の表をそのまま転記した
//     （3表×［四季月・四仲月・四孟月］の各列。原本画像で列・行を確認済み。傅星の
//     四季月だけ7件で、四仲月・四孟月は6件）。宜は「造葬、修造、上官、試験、嫁娶、
//     その他百事に良い」を監修決定（Q5＝B）で ALL型として扱う（activityProfiles.ts）。
//     3星は同じ月区分の中で同じ日に重ならない。
//   ・除神：『協紀辨方書』卷五〈五離〉考原「通書以申酉日為除神」（監修決定 Q1＝A で
//     外部資料を成立条件の出典として採用）。宜は神殺象意〔解神〕〔除神〕による。
//
// 検証区分:
//   ・除神は月令＋日支で決まるため擇日実例.pdf と照合できる（120行すべて一致）。
//   ・顕星・曲星・傅星は擇日実例.pdf に掲載が無いため、表との単体照合だけで検証する
//     （tests/takujitsu_unresolved_shinsatsu_unit.manual.ts）。

import type { ShinsatsuInput, ShinsatsuResult } from "../types";

type MonthClass = "孟" | "仲" | "季";

const MONTH_CLASS: Record<string, MonthClass> = {
  寅: "孟", 申: "孟", 巳: "孟", 亥: "孟",
  子: "仲", 午: "仲", 卯: "仲", 酉: "仲",
  辰: "季", 戌: "季", 未: "季", 丑: "季",
};

/** ［区分B］顕星（p.19）。月区分ごとの日干支。 */
const XIANXING: Record<MonthClass, readonly string[]> = {
  季: ["乙丑", "甲戌", "癸未", "壬辰", "辛丑", "庚戌", "己未"],
  仲: ["丙寅", "乙亥", "甲申", "癸巳", "壬寅", "辛亥", "庚申"],
  孟: ["丁卯", "丙子", "乙酉", "甲午", "癸卯", "壬子", "辛酉"],
};

/** ［区分B］曲星（p.19）。月区分ごとの日干支。 */
const QUXING: Record<MonthClass, readonly string[]> = {
  季: ["丙寅", "乙亥", "甲申", "癸巳", "壬寅", "辛亥", "庚申"],
  仲: ["丁卯", "丙子", "乙酉", "甲午", "癸卯", "壬子", "辛酉"],
  孟: ["戊辰", "丁丑", "丙戌", "乙未", "甲辰", "癸丑", "壬戌"],
};

/** ［区分B］傅星（輔星、p.19）。月区分ごとの日干支（四季月7件・四仲月6件・四孟月6件）。 */
const FUXING: Record<MonthClass, readonly string[]> = {
  季: ["己巳", "戊寅", "丁亥", "丙申", "乙巳", "甲寅", "癸亥"],
  仲: ["庚午", "己卯", "戊子", "丁酉", "丙午", "乙卯"],
  孟: ["辛未", "庚辰", "己丑", "戊戌", "丁未", "丙辰"],
};

/**
 * 顕星・曲星・傅星・除神を判定する。凶神は対象外のため kyojin は常に空配列。
 */
export function resolveKichijinGroup7(input: ShinsatsuInput): ShinsatsuResult {
  const { monthBranch, dayStem, dayBranch } = input;
  const kichijin: string[] = [];
  const dayGanzhi = `${dayStem}${dayBranch}`;
  const cls = MONTH_CLASS[monthBranch];

  if (cls) {
    if (XIANXING[cls].includes(dayGanzhi)) kichijin.push("顕星");
    if (QUXING[cls].includes(dayGanzhi)) kichijin.push("曲星");
    if (FUXING[cls].includes(dayGanzhi)) kichijin.push("傅星");
  }
  // ［区分A］除神：申酉の日（月令に依らない）。
  if (dayBranch === "申" || dayBranch === "酉") kichijin.push("除神");

  return { kichijin, kyojin: [] };
}
