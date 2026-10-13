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
 */
export type QimenSearchMatchMode = "OR" | "AND";

/**
 * 結果の並び順。今回は "score" 固定。将来 sortMode を増やせるよう
 * union 型として持つ（■第3段階を見越す）。
 *   "score" … 成立格局数の多い順 → 日時の早い順。
 */
export type QimenSearchSortMode = "score";

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
  /** 結果の並び順。未指定時は "score"（今回は実質これのみ実装）。 */
  sortMode?: QimenSearchSortMode;
  /**
   * true のとき、result.kyokaku.matches が1件以上ある日時を候補から除外する
   * （吉格のOR/AND判定より先に行う）。個々の凶格名は問わない
   * （kyokaku.ts の判定結果が1件でもあれば除外＝名前の固定リストを持たない）。
   * 未指定時は除外なし。
   */
  excludeAllKyokaku?: boolean;
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
}

/** runQimenSearch の途中経過・完了通知。 */
export interface QimenSearchProgress {
  scanned: number;
  total: number;
  hits: QimenSearchHit[];
  done: boolean;
}
