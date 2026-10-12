// src/lib/ziwei/meanings/sentenceContext.ts
//
// 前の文（または次の文）がないと意味が通らない文の判定と、その前後の文の取得。docs/ziwei-basic-spec.md §21.10。
//
// 判定:
//   - 前文依存: 文の書き出しが前の文を受ける接続語（いずれにせよ・また・しかし・ただし など）で、かつ
//     同じ資料・同じ節（見出し）に直前の文がある場合だけ。語句だけでは決めず、前後関係を資料の並び順で確かめる。
//   - 後続依存: 文が「、」「：」で終わる、または「次のような」「以下のような」などで後の文を予告しており、かつ
//     同じ資料・同じ節に直後の文がある場合だけ。
//   - 前の文もまた前文依存なら、さらに1つ前まで遡る（最大 MAX_PREVIOUS 文）。
// 資料の並び順は、資料の文の順に収録している stars・transformations・palaces・starPalace・themes の各データの順。
// 組み合わせデータ（combinations）は抜き出したものなので、同じ資料・同じ文の元の記述の位置で前後を見る。
// 書き出しの接続語・後の文への続き・同じ原文かどうかは、原文から計算した凍結メタデータ（opener・continuesToNext・
// textKey。build_meanings.py §35）で見る（表示文は書き直してあるため、表示文からは判定しない）。

import {
  COMBINATION_MEANINGS,
  PALACE_MEANINGS,
  STAR_MEANINGS,
  STAR_PALACE_MEANINGS,
  THEME_MEANINGS,
  TRANSFORMATION_MEANINGS,
} from "./store";
import type { TextMeta, SourceRef } from "./types";

/** 前後の文の判定に使う項目（判定に表示文は使わない。text はテーマ別データにはない） */
export type SentenceEntry = TextMeta & { id: string; ref: SourceRef; text?: string; condition?: string };
type Entry = SentenceEntry;

/** 前の文を受ける書き出し（文頭の語）。これだけでは決めず、同じ資料・同じ節の直前の文があるかも確かめる */
export const PREVIOUS_DEPENDENT_OPENERS: readonly string[] = [
  "いずれにせよ",
  "また",
  "そのため",
  "したがって",
  "しかし",
  "この場合",
  "このように",
  "前述のように",
  "これにより",
  "一方で",
  "さらに",
  "ただし",
  "と言っても",
  "ですから",
  "それゆえ",
  "そこで",
  "なお",
  "とはいえ",
  "ところが",
  "そして",
];


/** 前の文を最大いくつまで遡るか（必要最小限） */
export const MAX_PREVIOUS = 2;

/** 資料の文の順に並んだデータ。同じ ID は1か所 */
const ORDERED_FILES: readonly (readonly Entry[])[] = [
  STAR_MEANINGS,
  TRANSFORMATION_MEANINGS,
  PALACE_MEANINGS,
  STAR_PALACE_MEANINGS,
  THEME_MEANINGS,
];

const POSITION = new Map<string, { list: readonly Entry[]; index: number }>();
const BY_TEXT = new Map<string, Entry>();
for (const list of ORDERED_FILES) {
  list.forEach((e, index) => {
    if (!POSITION.has(e.id)) POSITION.set(e.id, { list, index });
    if (!BY_TEXT.has(e.textKey)) BY_TEXT.set(e.textKey, e);
  });
}
const COMBINATION_IDS = new Set(COMBINATION_MEANINGS.map((e) => e.id));

/** 前後を見る位置（組み合わせデータは、同じ資料・同じ文の元の記述の位置） */
function positionOf(e: Entry): { list: readonly Entry[]; index: number } | undefined {
  const direct = POSITION.get(e.id);
  if (direct && !COMBINATION_IDS.has(e.id)) return direct;
  const original = BY_TEXT.get(e.textKey);
  return original ? POSITION.get(original.id) : direct;
}

const sameSection = (a: Entry, b: Entry) => a.ref.source === b.ref.source && a.ref.section === b.ref.section;

/** 書き出しが前の文を受ける接続語か（原文の書き出し。凍結メタデータ） */
export function opensWithConnective(e: Entry): string | null {
  return e.opener && PREVIOUS_DEPENDENT_OPENERS.includes(e.opener) ? e.opener : null;
}

/** 同じ資料・同じ節の直前の文 */
export function previousInSection(e: Entry): Entry | null {
  const pos = positionOf(e);
  if (!pos || pos.index === 0) return null;
  const prev = pos.list[pos.index - 1];
  return sameSection(prev, e) ? prev : null;
}

/** 同じ資料・同じ節の直後の文 */
export function nextInSection(e: Entry): Entry | null {
  const pos = positionOf(e);
  if (!pos || pos.index + 1 >= pos.list.length) return null;
  const next = pos.list[pos.index + 1];
  return sameSection(next, e) ? next : null;
}

export interface SentenceDependency {
  /** 古い順。直前の文が最後 */
  previous: Entry[];
  next: Entry[];
  reason: string;
}

/** 前後の文がないと意味が通らない文なら、その前後の文（必要最小限）。独立した文は null */
export function sentenceDependency(e: Entry): SentenceDependency | null {
  const previous: Entry[] = [];
  const reasons: string[] = [];
  let cur: Entry = e;
  for (let depth = 0; depth < MAX_PREVIOUS; depth += 1) {
    const opener = opensWithConnective(cur);
    if (!opener) break;
    const prev = previousInSection(cur);
    if (!prev) break;
    previous.unshift(prev);
    reasons.push(`${cur === e ? "本文" : "前文"}が「${opener}」で始まり、同じ節の直前の文を受ける`);
    cur = prev;
  }
  const next: Entry[] = [];
  if (e.continuesToNext) {
    const nx = nextInSection(e);
    if (nx) {
      next.push(nx);
      reasons.push("本文が後の文へ続く（「、」「：」で終わる、または後の文を予告する）");
    }
  }
  if (previous.length === 0 && next.length === 0) return null;
  return { previous, next, reason: reasons.join("。") };
}
