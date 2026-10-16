// src/lib/qimenSearch/searchEngine.ts
//
// 役割:
//   吉格日時検索の検索エンジン（第1段階: OR検索の土台／第2段階: AND検索を追加）。
//   排盤ロジックには一切踏み込まず、既存の qimenEngine.calculate() を
//   2時間刻みで繰り返し呼び出し、result.jikaku.matches / result.kyokaku.matches
//   の中から検索条件に一致する成立だけを抽出する「呼び出すだけ」の層。
//
// 変更禁止事項の遵守:
//   src/lib/qimen/ 配下・src/lib/calendar/ 配下・格局判定ロジックは
//   一切変更していない（import して呼び出すのみ）。
//
// 設計メモ:
//   - 検索間隔は仕様により 2 時間固定（criteria.intervalHours は無視する）。
//   - 1 回の calculate() が例外を投げても検索全体は止めず、その日時だけ
//     スキップする（qimenEngine.ts の tryRun と同じ「壊れた箇所だけ落とす」方針）。
//   - 長期間の検索でも UI をブロックしないよう、一定件数ごとに
//     イベントループへ制御を返し、onProgress で途中経過を通知する。
//   - AbortSignal で途中キャンセルできる。
//   - matchMode "OR"/"AND"/"TWO_PLUS"（二つ以上成立・同じ宮）の分岐は、1スロット分の成立格局（matched）を
//     先に集めてから判定する共通処理にまとめてあり、格局判定ロジック自体には
//     触れない（result.jikaku.matches / result.kyokaku.matches を読むだけ）。
//   - 並び順は既定で日時順（sortMode "datetime"。Phase 4A・2026-10-16）。旧既定の "score"
//     （成立格局数の多い順）は互換のため残すが、検索画面からは使わない。
//   - 方位指定（criteria.directionPalaces。Phase 4A）は結果の絞り込みだけを行う。成立宮のうち
//     指定した宮だけを残し、残らない格局は matched から外してから OR/AND を判定する。
//     格局の成立判定そのものには触れない。
//   - 各ヒットに、成立宮ごとの要約（candidateInfo.ts の buildPalaceSummary）と
//     盤全体の凶格を持たせる。吉格・凶格は検索条件に関係なく全件を載せ、どちらも削除しない。
//   - 凶格除外（「すべての凶格を除外」）は 2026-10-16 に撤廃した。吉格と凶格が同じ宮に
//     成立していても吉格の成立結果をそのまま返す（同宮の解釈は後段の解釈処理で行う）。
//     criteria に旧項目 excludeAllKyokaku が残っていても参照しない。
//     各ヒットには、その日時の盤に成立した凶格の全件（allKyokakuMatches）を従来どおり持たせる。

import { calculate } from "@/lib/qimen";
import type { QimenResult } from "@/lib/qimen";
import { buildPalaceSummary, boardWideKyokaku } from "./candidateInfo";
import {
  formatKey,
  type QimenFormatMatch,
  type QimenFormatOption,
  type QimenSearchCriteria,
  type QimenSearchHit,
  type QimenSearchMatchMode,
  type QimenSearchProgress,
  type QimenSearchSortMode,
} from "./types";

/** 検索間隔（時間）。仕様により固定。 */
export const SEARCH_INTERVAL_HOURS = 2;

/** 1 チャンクあたりの計算件数。この件数ごとに UI へ制御を戻す。 */
const CHUNK_SIZE = 40;

function parseYmd(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

/**
 * startDate〜endDate（両端含む）の日付を、タイムゾーンに依存しない
 * 暦日の連続として列挙する。時刻の解釈（真太陽時・タイムゾーン変換等）は
 * 一切行わない ── それは既存の CalendarEngine / qimenEngine の役割。
 */
export function enumerateDates(
  startDate: string,
  endDate: string,
): { year: number; month: number; day: number }[] {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  const startMs = Date.UTC(start.y, start.m - 1, start.d);
  const endMs = Date.UTC(end.y, end.m - 1, end.d);
  const out: { year: number; month: number; day: number }[] = [];
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) return out;

  for (let t = startMs; t <= endMs; t += 86_400_000) {
    const dt = new Date(t);
    out.push({ year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() });
  }
  return out;
}

/** 検索条件が対象とする全時刻スロット（2時間刻み）を列挙する。 */
export function enumerateSlots(
  criteria: Pick<QimenSearchCriteria, "startDate" | "endDate">,
): { year: number; month: number; day: number; hour: number }[] {
  const dates = enumerateDates(criteria.startDate, criteria.endDate);
  const slots: { year: number; month: number; day: number; hour: number }[] = [];
  for (const d of dates) {
    for (let hour = 0; hour < 24; hour += SEARCH_INTERVAL_HOURS) {
      slots.push({ ...d, hour });
    }
  }
  return slots;
}

/** 検索対象スロットの総数（進捗表示・所要時間の目安に使う）。 */
export function countSlots(
  criteria: Pick<QimenSearchCriteria, "startDate" | "endDate">,
): number {
  return enumerateDates(criteria.startDate, criteria.endDate).length * (24 / SEARCH_INTERVAL_HOURS);
}

/**
 * 1 スロット分の calculate() 結果から、選択した格局のうち実際に成立した
 * ものだけを集める（盤全体成立 = palaces=[] はここで除外）。
 * 1 つの格局につき、result.jikaku/kyokaku.matches 側は通常 0 or 1 件だが、
 * 万一複数件あっても全て拾う。
 */
function collectMatchedFormats(
  result: QimenResult,
  formats: QimenFormatOption[],
): QimenFormatMatch[] {
  const out: QimenFormatMatch[] = [];
  for (const format of formats) {
    const matches = format.category === "jikaku" ? result.jikaku.matches : result.kyokaku.matches;
    for (const m of matches) {
      if (m.name !== format.name) continue;
      if (m.palaces.length === 0) continue;
      out.push({ category: format.category, name: m.name, palaces: m.palaces });
    }
  }
  return out;
}

/**
 * 方位指定による絞り込み。成立宮のうち指定した宮だけを残し、残らない格局は除く。
 * 指定が無ければ（未指定・空配列）そのまま返す。
 */
function filterByDirection(matched: QimenFormatMatch[], directionPalaces: number[] | undefined): QimenFormatMatch[] {
  if (!directionPalaces || directionPalaces.length === 0) return matched;
  const allowed = new Set(directionPalaces);
  const out: QimenFormatMatch[] = [];
  for (const m of matched) {
    const palaces = m.palaces.filter((p) => allowed.has(p));
    if (palaces.length > 0) out.push({ ...m, palaces });
  }
  return out;
}

/**
 * 「二つ以上成立」（matchMode "TWO_PLUS"）の絞り込み。選択した格局のうち異なる2種類以上が
 * 同じ宮で成立している宮だけを残し、残らない格局は除く。同じ格局（category:name）は1種類と数える。
 * matched は選択した格局だけを集めたものなので、選択していない格局は数に入らない。
 */
function filterSamePalaceTwoPlus(matched: QimenFormatMatch[]): QimenFormatMatch[] {
  const kinds = new Map<number, Set<string>>();
  for (const m of matched) {
    for (const p of m.palaces) {
      if (!kinds.has(p)) kinds.set(p, new Set());
      kinds.get(p)!.add(formatKey(m));
    }
  }
  const ok = new Set([...kinds].filter(([, k]) => k.size >= 2).map(([p]) => p));
  const out: QimenFormatMatch[] = [];
  for (const m of matched) {
    const palaces = m.palaces.filter((p) => ok.has(p));
    if (palaces.length > 0) out.push({ ...m, palaces });
  }
  return out;
}

/**
 * matchMode に応じて、そのスロットをヒットとして採用するか判定する。
 *   OR  … matched が 1 件以上あれば採用。
 *   AND … 選択した格局が「全て」matched に含まれていれば採用
 *         （成立宮は格局ごとに異なってよい＝ここでは名前の一致だけを見る）。
 *   TWO_PLUS … filterSamePalaceTwoPlus で絞り込んだ後に 1 件以上残っていれば採用。
 */
function isHit(
  matched: QimenFormatMatch[],
  formats: QimenFormatOption[],
  matchMode: QimenSearchMatchMode,
): boolean {
  if (matchMode === "AND") {
    const matchedKeys = new Set(matched.map((m) => formatKey(m)));
    return formats.every((f) => matchedKeys.has(formatKey(f)));
  }
  return matched.length > 0;
}

function compareByDateTime(a: QimenSearchHit, b: QimenSearchHit): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day !== b.day) return a.day - b.day;
  if (a.hour !== b.hour) return a.hour - b.hour;
  return a.minute - b.minute;
}

/**
 * 結果の並び替え。第1段階からの拡張（■第3段階を見越す）: sortMode を
 * 増やす場合はここに case を足すだけでよい設計にしてある。
 */
function sortHits(hits: QimenSearchHit[], sortMode: QimenSearchSortMode): QimenSearchHit[] {
  switch (sortMode) {
    case "datetime":
      return [...hits].sort(compareByDateTime);
    case "score":
      // 成立格局数の多い順 → 日時の早い順
      return [...hits].sort((a, b) => {
        const scoreDiff = b.matches.length - a.matches.length;
        if (scoreDiff !== 0) return scoreDiff;
        return compareByDateTime(a, b);
      });
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * 吉格日時検索を実行する。
 *
 * 指定期間の各2時間ごとに calculate() を呼び出し、選択された格局
 * （複数選択可、matchMode="OR"|"AND"|"TWO_PLUS"）が成立する日時だけを抽出して返す。
 * onProgress が渡されていれば、チャンクごとに途中経過を通知する。
 * signal.aborted が true になった時点で処理を打ち切る（打ち切り時点までの
 * ヒットを返す）。
 * 結果は sortMode（未指定時 "score"）に従って並び替え済みで返す。
 */
export async function runQimenSearch(
  criteria: QimenSearchCriteria,
  onProgress?: (progress: QimenSearchProgress) => void,
  signal?: AbortSignal,
): Promise<QimenSearchHit[]> {
  const timezone = criteria.timezone ?? "Asia/Tokyo";
  const matchMode = criteria.matchMode ?? "OR";
  const sortMode = criteria.sortMode ?? "datetime";
  const slots = enumerateSlots(criteria);
  const total = slots.length;
  const hits: QimenSearchHit[] = [];

  if (criteria.formats.length === 0 || total === 0) {
    onProgress?.({ scanned: total, total, hits, done: true });
    return hits;
  }

  for (let i = 0; i < slots.length; i += 1) {
    if (signal?.aborted) break;

    const slot = slots[i];
    try {
      const result = calculate({
        year: slot.year,
        month: slot.month,
        day: slot.day,
        hour: slot.hour,
        minute: 0,
        timezone,
      });

      const directed = filterByDirection(collectMatchedFormats(result, criteria.formats), criteria.directionPalaces);
      const matched = matchMode === "TWO_PLUS" ? filterSamePalaceTwoPlus(directed) : directed;
      if (isHit(matched, criteria.formats, matchMode)) {
        hits.push({
          year: slot.year,
          month: slot.month,
          day: slot.day,
          hour: slot.hour,
          minute: 0,
          timezone,
          matches: matched,
          // 検索条件（criteria.formats）に関係なく、この日時の盤に実際に
          // 成立した凶格の全件をそのまま持たせる（「凶格なし」表示の
          // 同一宮判定用）。result.kyokaku.matches 自体はここでしか
          // 読んでおらず、判定ロジックは一切変更していない。
          allKyokakuMatches: result.kyokaku.matches.map((m) => ({
            category: "kyokaku" as const,
            name: m.name,
            palaces: m.palaces,
          })),
          palaceSummaries: [...new Set(matched.flatMap((m) => m.palaces))]
            .sort((a, b) => a - b)
            .map((p) => buildPalaceSummary(result, p)),
          boardWideKyokaku: boardWideKyokaku(result),
        });
      }
    } catch {
      // この日時だけ算出不能。検索全体は継続する（排盤ロジックは変更しない）。
    }

    const scanned = i + 1;
    if (scanned % CHUNK_SIZE === 0 || scanned === total) {
      onProgress?.({ scanned, total, hits: sortHits(hits, sortMode), done: false });
      await yieldToEventLoop();
    }
  }

  const sorted = sortHits(hits, sortMode);
  onProgress?.({ scanned: Math.min(total, slots.length), total, hits: sorted, done: true });
  return sorted;
}
