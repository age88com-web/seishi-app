// src/lib/qimenSearch/types.ts
//
// 役割:
//   吉格日時検索エンジンの入出力型。
//   排盤・格局判定ロジックには一切関与せず、qimenEngine.calculate() の
//   結果（result.jikaku.matches / result.kyokaku.matches）を読み取るだけ。
//
// 拡張方針（■第3段階のため）:
//   QimenSearchCriteria は今後
//     ・期間プリセット（第3段階。UI 側で startDate/endDate に変換して渡す）
//     ・用途／成立宮／陽遁陰遁／局／優先順位（将来予定）
//   を追加していく前提のフィールド構成にしている。既存フィールドの意味は変えない。

import type { PalaceSummaryInfo } from "./candidateInfo";

/** 格局の種別。吉格＝jikaku.ts、凶格＝kyokaku.ts の判定結果に対応する。 */
export type QimenFormatCategory = "jikaku" | "kyokaku";

/** 検索対象として選択する 1 つの格局。 */
export interface QimenFormatOption {
  category: QimenFormatCategory;
  name: string;
}

/** category:name の一意キー。選択状態の管理と AND 判定の両方で使う共通キー。 */
export function formatKey(f: QimenFormatOption): string {
  return `${f.category}:${f.name}`;
}

/**
 * 複数格局の組み合わせ方。
 *   "OR"  … 選択した格局のどれか1つでも成立していればヒット（第1段階）。
 *   "AND" … 選択した格局が全て、同じ日時の盤で成立していればヒット
 *           （成立宮は格局ごとに異なってよい）（第2段階）。
 *   "TWO_PLUS" … 二つ以上成立（2026-10-16）。選択した格局のうち異なる2種類以上が、同じ日時の
 *           同じ宮で成立していればヒット。別々の宮に1格ずつの成立は対象外。同じ格局は1種類と数え、
 *           選択していない格局は数えない。結果の成立宮は、この条件を満たした宮だけになる。
 */
export type QimenSearchMatchMode = "OR" | "AND" | "TWO_PLUS";

/**
 * 結果の並び順。
 *   "datetime" … 日時の早い順（既定。Phase 4A・2026-10-16 から。格局の成立数による順位付けはしない）。
 *   "score"    … 成立格局数の多い順 → 日時の早い順（旧既定。互換のため残す）。
 */
export type QimenSearchSortMode = "datetime" | "score";

/** 検索条件。 */
export interface QimenSearchCriteria {
  /** "YYYY-MM-DD" */
  startDate: string;
  /** "YYYY-MM-DD"（この日を含む） */
  endDate: string;
  /** IANA タイムゾーン名。未指定時は "Asia/Tokyo"。 */
  timezone?: string;
  /**
   * 検索間隔（時間）。第1段階では 2 固定。
   * 型としては拡張余地を残すが、第1段階の検索エンジンは 2 以外を渡されても
   * 常に 2 として扱う（■開発方針: 検索間隔は2時間固定）。
   */
  intervalHours?: number;
  /** 検索する格局（複数選択可）。空配列なら該当なし。 */
  formats: QimenFormatOption[];
  /** 複数格局の組み合わせ方。未指定時は "OR"。 */
  matchMode?: QimenSearchMatchMode;
  /** 結果の並び順。未指定時は "datetime"（日時順）。 */
  sortMode?: QimenSearchSortMode;
  /**
   * 方位指定（宮番号の配列。八方位＝1・2・3・4・6・7・8・9）。Phase 4A・2026-10-16。
   * 検索結果の絞り込み条件で、格局の成立条件には影響しない。成立宮のうち指定した宮だけを残し、
   * 残る宮が無い格局は成立していないものとして扱う（その後で OR/AND を判定する）。
   * 未指定・空配列なら八方位すべてが対象（従来どおり）。
   */
  directionPalaces?: number[];
  // 旧項目 excludeAllKyokaku（凶格除外）は 2026-10-16 に撤廃した。検索エンジンは参照しない。
}

/** 1 日時で成立した 1 格局分。 */
export interface QimenFormatMatch {
  category: QimenFormatCategory;
  /** 成立した格局名（jikaku.ts / kyokaku.ts の match.name）。 */
  name: string;
  /** 成立宮（match.palaces）。盤全体成立（空配列）はこの検索では除外済み。 */
  palaces: number[];
}

/**
 * 1件の成立ヒット（1 日時の盤）。
 * OR/AND いずれの場合も、その日時で実際に成立した格局を matches に列挙する
 * （AND の場合は選択した格局の全件が matches に入ることになる）。
 */
export interface QimenSearchHit {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timezone: string;
  /** その日時で成立した格局（選択した格局のうち実際に成立したものだけ）。 */
  matches: QimenFormatMatch[];
  /**
   * その日時の盤で実際に成立した凶格の全件（検索条件のformatsに関係なく、
   * result.kyokaku.matches をそのまま持つ）。「凶格なし」表示の判定
   * （成立した吉格と同一宮に凶格が無いか）に使う。盤全体成立（palaces=[]、
   * 五不遇時・伏吟格・反吟格）は palaces.includes() が常に false になるため、
   * 同一宮判定には自然に加算されない。
   */
  allKyokakuMatches: QimenFormatMatch[];
  /**
   * 成立宮（方位指定で残った宮。matches の palaces の和集合・昇順）ごとの要約
   * （方位・八門・九星・八神・天盤干・地盤干（寄宮干を含む）・その宮の吉格・凶格）。Phase 4A。
   */
  palaceSummaries: PalaceSummaryInfo[];
  /** 盤全体で成立した凶格（伏吟格・反吟格・五不遇時など。detail を括弧で併記）。Phase 4A。 */
  boardWideKyokaku: string[];
}

/** runQimenSearch の途中経過・完了通知。 */
export interface QimenSearchProgress {
  scanned: number;
  total: number;
  hits: QimenSearchHit[];
  done: boolean;
}
