// src/app/takujitsu/resolutionDisplayText.ts
//
// 役割（OUTPUT層・表示専用）:
//   擇日の神殺解除・軽減・増悪・判断保留を、専門用 /takujitsu の利用者向け
//   文章へ変換する。2026-10-31 監修確定の文面。
//
// 設計原則:
//   ・resolution/rules.ts の note（原典根拠・監修決定・保留理由・実装理由）は
//     内部情報として保持し、画面には出さない。ここでは ruleId から表示文を引くだけ。
//   ・判定ロジック（rules.ts／resolve.ts／evaluateActivities.ts）には一切関与しない。
//   ・各神殺の「本来〜を忌む」は ActivityProfile の忌の一覧の要約。忌の登録が
//     無い神殺（八風）は意味を書き足さない。
//   ・「赦願」はUIで使わず「天赦・天願」と書く。増悪は「凶作用が強まるとされます」
//     で統一する（判定上、通常の忌より段階が下がるわけではないため）。

import { ACTIVITY_BY_ID, getActivityProfile } from "@/lib/takujitsu/activity";
import type { UnresolvedActivityRestriction } from "@/lib/takujitsu/activity";
import type { ResolvedShinsatsuEntry } from "@/lib/takujitsu";

type DisplayFn = (name: string) => string;

/** 各凶神が本来忌む用事の要約（ActivityProfile の忌の一覧による）。 */
const MEANING: Record<string, string> = {
  月刑: "多くの用事",
  遊禍: "祈福・子授け・治療・お祓い",
  四撃: "出陣・防備",
  四忌: "結婚・埋葬",
  四窮: "結婚・葬儀・財の出し入れ・開業など",
  五虚: "倉庫・財の出し入れ・栽種など",
  四耗: "財の出し入れ・取引・開業など",
  月厭: "多くの用事",
  厭對: "乗船・漁・結婚",
  土符: "土を動かす工事・栽種など",
  地嚢: "土を動かす工事・栽種など",
  氣往亡: "赴任・移転・結婚・治療など",
  往亡: "赴任・移転・結婚・治療など",
  觸水龍: "乗船・渡水・漁",
  四離: "多くの用事",
  四絶: "多くの用事",
  八節日: "結婚",
  "八節日（二至二分）": "赴任・移転・結婚・開業・取引など",
  "八節日（冬至）": "伐木",
  土王用事: "土を動かす工事・栽種など",
  小耗: "財の出し入れ・取引・開業など",
  血支: "鍼灸・治療・祭祀・結婚・開業など",
  九空: "財の出し入れ・取引・開業など",
  五墓: "結婚・葬儀・建築・移転・開業など",
  八専: "結婚・出軍など",
  天狗: "祭祀・祈福",
  復日: "破土・埋葬・改葬",
  重日: "破土・埋葬・改葬",
  五離: "結婚・契約・宴会など",
};

/** 「凶神」以外の呼び方をする対象（日・期間）。 */
const KIND_WORD: Record<string, string> = {
  八節日: "日",
  "八節日（二至二分）": "日",
  "八節日（冬至）": "日",
  土王用事: "期間",
};

function meaningSentence(name: string): string {
  return `${name}は本来、${MEANING[name]}を忌む${KIND_WORD[name] ?? "凶神"}です。`;
}

/** 解除（cancel）。condition は「〜と重なる」「〜が重なる」まで含めた句。 */
function cancel(condition: string, extra = ""): DisplayFn {
  return (name) =>
    `${meaningSentence(name)}ただし、${condition}場合は凶作用を解除します${extra}。` +
    `この日は解除条件が成立しているため、${name}の凶作用は適用されません。`;
}

/** 軽減（reduce）。remaining は条件成立後も忌が残る用事。 */
function reduce(condition: string, remaining: string, label?: string): DisplayFn {
  return (name) =>
    `この日は${label ?? name}に該当しますが、${condition}が重なるため凶作用が弱められています。` +
    `ただし、${remaining}の忌は残ります。`;
}

/** 増悪（aggravate）。 */
function aggravate(condition: string): DisplayFn {
  return (name) =>
    `${meaningSentence(name)}${condition}が重なると、かえって凶作用が強まるとされます。この日はその条件が成立しています。`;
}

/**
 * resolution ルールID → 利用者向け表示文。
 * resolution/rules.ts の全ルールと1対1（テストで網羅を確認する）。
 */
export const RESOLUTION_DISPLAY_TEXT: Readonly<Record<string, DisplayFn>> = {
  "3": reduce("天徳・月徳（およびその合）・天赦・月恩・四相のいずれか", "修造・動土・伐木", "小時（月建）"),
  "9a": cancel("徳合と重なる"),
  "9b": aggravate("月破"),
  "10": reduce("徳合または天赦", "開市・取引（立券交易）"),
  "11": () =>
    "遊禍は本来、祈福・子授け・治療・お祓いを忌む凶神です。徳合や天赦は通常は凶神を解除しますが、" +
    "遊禍の場合はかえって凶作用が強まるとされます。この日はその条件が成立しています。",
  "13b": cancel("徳合または六合と重なる"),
  "13c": cancel("徳合と三合の両方が重なる"),
  "16": () =>
    "八風は凶神ですが、徳合または六合と重なる場合は凶作用を解除します。" +
    "この日は解除条件が成立しているため、八風の凶作用は適用されません。",
  "8": cancel("徳合と、天赦または天願が同時に重なる"),
  "12": aggravate("徳合と、天赦または天願が同時に"),
  "14": aggravate("徳合、または天赦・天願"),
  "17": aggravate("徳合または天願"),
  "18": aggravate("徳合と天願が同時に"),
  "20": aggravate("徳合と、天赦または天願が同時に"),
  "21": aggravate("徳合と、天赦または天願が同時に"),
  "22": cancel("徳合または天願と重なる"),
  "24": reduce("徳合", "祭祀と解除（厄除け・お祓い）"),
  "7": cancel("歳徳・月徳（およびその合）、または天赦・天願と重なる"),
  "19": cancel("六合・月建（小時）・徳合のいずれかと重なる"),
  "15": cancel("午月・子月に月徳と重なる"),
  "25": reduce("徳合", "治療・医療（求医療病）"),
  "26": cancel("天願と重なる", "（徳合では解除しません）"),
  "6": cancel("歳徳または月徳と重なる"),
  "27": cancel("徳合・天赦・六合のいずれかと重なる"),
  "28": cancel("徳合・天赦・六合のいずれかと重なる"),
};

/** 判断保留（解除と増悪の条件が同時に成立）。 */
export function pendingDisplayText(name: string): string {
  return (
    `この日は${name}に該当し、凶作用を解除する条件と強める条件が同時に成立しています。` +
    `どちらを優先するか定まっていないため、${name}は凶神として扱います（判断保留）。`
  );
}

/** ルール別の表示文が見つからない場合の定型文（内部情報は含めない）。 */
const GENERIC_TEXT: Partial<Record<ResolvedShinsatsuEntry["status"], DisplayFn>> = {
  cancelled: (name) => `この日は${name}に該当しますが、解除条件が成立しているため、${name}の凶作用は適用されません。`,
  reduced: (name) => `この日は${name}に該当しますが、条件により凶作用が弱められています。ただし、用事によっては忌が残る場合があります。`,
  aggravated: (name) => `この日は${name}に該当し、凶作用が強まるとされる条件が成立しています。`,
  pending: pendingDisplayText,
};

/**
 * 解決済み神殺1件の利用者向け説明文。active（変化なし）は undefined。
 * 成立した確定ルール（pending:false）の ruleId から表示文を引く。
 */
export function resolutionDisplayText(entry: ResolvedShinsatsuEntry): string | undefined {
  if (entry.status === "active") return undefined;
  if (entry.status === "pending") return pendingDisplayText(entry.name);

  const texts: string[] = [];
  for (const r of entry.appliedRules ?? []) {
    if (r.pending) continue;
    const fn = RESOLUTION_DISPLAY_TEXT[r.ruleId];
    if (!fn) continue;
    const text = fn(entry.name);
    if (!texts.includes(text)) texts.push(text);
  }
  if (texts.length > 0) return texts.join("");
  return GENERIC_TEXT[entry.status]?.(entry.name);
}

/**
 * 「用途限定の残存忌」1件の利用者向け説明文。ルールの note は使わず、
 * ActivityProfile に残存する用事が登録されていればその用事名だけを示す。
 */
export function restrictionDisplayText(r: UnresolvedActivityRestriction): string {
  const ids = getActivityProfile(r.sourceType, r.sourceName)?.reducedStillUnfavorableActivityIds ?? [];
  const names = [...new Set(ids.map((id) => ACTIVITY_BY_ID[id]?.canonicalName ?? id))];
  if (names.length > 0) return `次の用事の忌は残ります：${names.join("・")}`;
  return "凶作用は弱められていますが、用事によっては忌が残る場合があります。";
}
