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
//   - matchMode "OR"/"AND" の分岐は、1スロット分の成立格局（matched）を
//     先に集めてから判定する共通処理にまとめてあり、格局判定ロジック自体には
//     触れない（result.jikaku.matches / result.kyokaku.matches を読むだけ）。
//   - sortMode は将来の追加を見越して union 型にしてあるが、今回は "score" 固定
//     （■第3段階を見越す）。
//   - 凶格除外（「すべての凶格を除外」）: 盤内に凶格が1件でもあれば日時全体を
//     落とすのではなく、選択した吉格候補ごとに「同じ宮に凶格が成立しているか」
//     だけを見て、その吉格候補だけを個別に除外する（1スロットごとに）:
//       1. calculate()
//       2. collectMatchedFormats() で選択した格局のうち成立したものを集める
//       3. excludeAllKyokaku が true なら、matched のうち category==="jikaku"
//          の候補について、成立宮の中から result.kyokaku.matches と同宮の
//          ものを除いた「残り宮」を求め、残り宮が無くなった候補は matched
//          から取り除く（盤全体成立=palaces=[]の凶格が1件でもあれば、その
//          スロットの吉格候補は全宮とも除外扱いにする）。category==="kyokaku"
//          の候補（凶格そのものを検索条件に選んだ場合）はこの除外の対象外。
//       4. 除外後の matched で、従来どおり formats を OR/AND 判定
//     個々の凶格名は問わない＝固定リストを持たず、kyokaku.ts の判定結果を
//     そのまま使う（将来ルールが追加されても自動的に対象になる）。
//     同宮判定のロジックは、既存の吉格日時検索UI（qimen/search/page.tsx の
//     hasCleanJikaku）で使っていたものと同じ考え方を検索エンジン側に集約した
//     もので、重複した別ロジックは作っていない。
//     凶格の成立判定ロジックは既存の kyokaku.ts の結果をそのまま使い、
//     ここでは一切再計算しない。

import { calculate } from "@/lib/qimen";
import type { QimenResult } from "@/lib/qimen";
import {
  formatKey,
  type QimenFormatMatch,
  type QimenFormatOption,
  type QimenSearchCriteria,
  type QimenSearchHit,
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
 * 「すべての凶格を除外」＝吉格候補ごとの同宮除外。
 * matched のうち category==="jikaku" の候補について、その成立宮から
 * result.kyokaku.matches と同宮のものを取り除いた「残り宮」を求める。
 * 残り宮が1つも無くなった候補（＝どの成立宮も凶格と同宮）は matched から
 * 除く。盤全体成立の凶格（palaces=[]。五不遇時・伏吟格・反吟格など）が
 * 1件でもあれば、そのスロットの吉格候補は全宮とも凶格と同宮しているものと
 * 扱い、残り宮を必ず空にする。category==="kyokaku" の候補（凶格そのものを
 * 検索条件に選んだ場合）は対象外でそのまま残す。
 */
function applySamePalaceKyokakuFilter(
  matched: QimenFormatMatch[],
  result: QimenResult,
): QimenFormatMatch[] {
  const allKyokaku = result.kyokaku.matches;
  const boardWideExists = allKyokaku.some((m) => m.palaces.length === 0);
  const kyokakuPalaces = new Set(allKyokaku.flatMap((m) => m.palaces));

  const out: QimenFormatMatch[] = [];
  for (const m of matched) {
    if (m.category !== "jikaku") {
      out.push(m);
      continue;
    }
    if (boardWideExists) continue;
    const remaining = m.palaces.filter((p) => !kyokakuPalaces.has(p));
    if (remaining.length > 0) out.push({ ...m, palaces: remaining });
  }
  return out;
}

/**
 * matchMode に応じて、そのスロットをヒットとして採用するか判定する。
 *   OR  … matched が 1 件以上あれば採用。
 *   AND … 選択した格局が「全て」matched に含まれていれば採用
 *         （成立宮は格局ごとに異なってよい＝ここでは名前の一致だけを見る）。
 */
function isHit(
  matched: QimenFormatMatch[],
  formats: QimenFormatOption[],
  matchMode: "OR" | "AND",
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
    case "score":
    default:
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
 * （複数選択可、matchMode="OR"|"AND"）が成立する日時だけを抽出して返す。
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
  const sortMode = criteria.sortMode ?? "score";
  const excludeAllKyokaku = criteria.excludeAllKyokaku ?? false;
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

      let matched = collectMatchedFormats(result, criteria.formats);
      if (excludeAllKyokaku) {
        matched = applySamePalaceKyokakuFilter(matched, result);
      }
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
