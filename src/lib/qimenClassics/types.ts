// src/lib/qimenClassics/types.ts
//
// 奇門遁甲の原典解釈データの型（Phase 5B・2026-10-19）。
//   格局の成立判定（src/lib/qimen/jikaku.ts・kyokaku.ts）とは独立した参照データで、
//   排盤・格局判定・検索・表示からは呼ばれない。将来、宮の格局（現行格局名）や剋應（ID）から
//   原典の記述を引けるよう、対応関係（appRelations）を持たせる。
//   吉凶の自動評価・成立判定は行わない（autoJudgement.enabled は常に false）。

/** 原典の1節。原文と現代語訳は段落ごとに対応させる（同じ添字が同じ段落）。 */
export interface ClassicSection {
  id: string;
  /** 節名（繁體字表示） */
  title: string;
  /** 節名（取得元の簡体字） */
  titleSimplified: string;
  /** 巻・位置 */
  location: string;
  /** 原文（取得元の簡体字。ウィキソースの原データのまま） */
  originalSimplified: string[];
  /** 原文（繁體字表示。ウィキソースの自動変換。独立した底本ではない） */
  originalTraditional: string[];
  /** 現代日本語訳（直訳。〔　〕は文法上の補い、【訳注】は訳者の注記） */
  translationJa: string[];
  /** 文字の異同・疑義 */
  textNotes: ClassicTextNote[];
  sources: ClassicSource[];
  /** 確認状況 */
  verification: string;
  /** 影印本による照合（Phase 5C）。originalSimplified / originalTraditional は電子テキストのまま変えない */
  facsimile?: ClassicFacsimileReading;
}

export interface ClassicSource {
  label: string;
  url: string;
  /** 取得・照合の状況 */
  status: string;
}

export interface ClassicTextNote {
  /** 該当箇所（繁體字表示の文字列） */
  location: string;
  simplified: string;
  traditionalDisplay: string;
  note: string;
}

/**
 * 干の組み合わせ。
 *   上加下 … 原文が「A加B」（A が B に加わる）と書く。上＝加わる側、下＝加えられる側。
 *            天盤・地盤の語は当該節に無い（天盤A・地盤B とみなすかは確認状況に記す）。
 *   相加   … 原文が「A B 相加」と書く。上下関係は原典だけでは確定しない。
 */
export interface ClassicStemCombination {
  order: "上加下" | "相加（上下未確定）";
  /** 上加下のときは加わる側、相加のときは原文で先に書かれた干 */
  first: string;
  /** 上加下のときは加えられる側、相加のときは原文で後に書かれた干 */
  second: string;
}

/** 現行アプリ（格局・剋應）との対応。名称だけで同一視しないため、関係の種類を明示する。 */
export interface ClassicAppRelation {
  kind: "現行格局" | "剋應";
  /** 現行格局名（jikaku.ts / kyokaku.ts の name）または剋應 ID（src/lib/qimen/kokuo/data） */
  target: string;
  relation:
    | "同じ干の組み合わせ（上下も一致）"
    | "同じ干の組み合わせ（原典の上下が未確定）"
    | "一部が同じ干の組み合わせ"
    | "甲を戊とみなした場合の組み合わせ（剋應の正規化）"
    | "甲を旬首六儀とみなせば構造が近い（未確定）"
    | "名称のみ共通（定義が異なる）"
    | "原典が名称・定義を批判";
  note: string;
}

/** 原典に記された格局・規則1件。 */
export interface ClassicRule {
  id: string;
  sectionId: string;
  /** 原典の格局名（繁體字表示） */
  name: string;
  /** 原典に記された別名 */
  aliases: string[];
  /** 原典の分類（節内の区分） */
  category: string;
  combination: ClassicStemCombination;
  /** 根拠となる原文の句（繁體字表示） */
  originalPhrase: string;
  /** 原典の吉凶分類。原文に吉凶の語が無い場合は「記載なし」 */
  fortune: "吉" | "凶" | "不利" | "記載なし";
  /** 吉凶の根拠となる原文の句（記載なしは null） */
  fortunePhrase: string | null;
  /** 原典の注意事項（原文の句と訳） */
  cautions: { original: string; ja: string }[];
  appRelations: ClassicAppRelation[];
  /** 自動成立判定。今回は登録しない（理由を明記） */
  autoJudgement: { enabled: false; reason: string };
  /** 確認状況 */
  status: string;
}

/** 原典が他書の説を批判している箇所。 */
export interface ClassicCritique {
  id: string;
  sectionId: string;
  /** 批判されている説（諸書の説） */
  criticizedView: string;
  originalPhrase: string;
  ja: string;
  /** 批判の対象と同じ考え方で定義されている現行格局 */
  affectedAppKaku: string[];
}

// --- Phase 5C（2026-10-23）: 影印本照合・甲申旬の例外・他資料の見解 ---------------------------

/** 影印本（故宮珍本叢刊）の所在。丁数は版心に刻記が無いため、巻首からの葉数（推定）で記す。 */
export interface ClassicFacsimileRef {
  /** 例: "故宮珍本叢刊 第431冊（御定奇門寶鑑 第一冊）" */
  volume: string;
  /** 原本 PDF のファイル名（~/Desktop/古典資料/ 以下。参照のみ） */
  file: string;
  /** PDF 頁（＝影印本の印刷頁番号）。範囲は "19〜20" のように書く */
  pdfPage: string;
  /** 頁内の位置（上段・下段、右半＝表・左半＝裏） */
  position: string;
  /** 巻・葉（推定。例: "巻一 第4葉表（推定）"） */
  leaf: string;
}

/** 電子テキストと影印本の異同1件。 */
export interface ClassicCollationNote {
  /** 電子テキスト側の文字列（繁體字表示）。電子テキストに無い箇所は null */
  electronic: string | null;
  /** 影印本の読み */
  facsimile: string;
  /** 判断（どちらを採るか・未解消か） */
  judgement: string;
  /** 異同の種類 */
  kind: "同じ（疑義は未解消）" | "字形判別不能（未解消）" | "電子テキストの誤り" | "電子テキストの脱文" | "異体字・表記の揺れ" | "句読の違い";
}

/** 影印本による照合結果（節・段落ごと）。電子テキストの原文は上書きせず、影印本の読みを別に持つ。 */
export interface ClassicFacsimileReading {
  ref: ClassicFacsimileRef;
  /** 影印本の翻字（段落ごと。圏点は「。」で写す） */
  text: string[];
  collation: ClassicCollationNote[];
  /** 照合日 */
  checkedAt: string;
}

/**
 * 原典の1段（節に属さない凡例・歌訣注など）。影印本を第一資料とし、
 * 電子テキストは照合用に保持する（電子テキストが無い段は null）。
 */
export interface ClassicPassage {
  id: string;
  /** 巻・部（例: "巻一 凡例十則"） */
  location: string;
  title: string;
  facsimile: ClassicFacsimileReading;
  /** ウィキソースの電子テキスト（繁體字表示。docs/source/baojian の取得テキストと一致）。未取得は null */
  electronicTraditional: string[] | null;
  /** 現代日本語訳（影印本の読みに基づく直訳） */
  translationJa: string[];
}

/** 原典の条件を分解した1項目と、その確認状況。 */
export interface ClassicCondition {
  /** 条件の内容 */
  item: string;
  status: "原文で確定" | "原文と整合（明記なし）" | "未確定";
  /** 根拠の原文（ClassicPassage / ClassicSection の id と句） */
  evidence: { passageId: string; phrase: string }[];
  note: string;
}

/**
 * 原典が既存の格局に付けた例外・注意（成立判定ではない）。
 *   effect は原典の書き方（使用上の禁忌か・成立の取り消しか）を分けて記録する。
 */
export interface ClassicExceptionRule {
  id: string;
  /** 対象となる原典の格局名（原典の表記） */
  targetNames: string[];
  title: string;
  conditions: ClassicCondition[];
  /** 原典が述べる効果 */
  effect: {
    original: string;
    ja: string;
    /** 原典の書き方の分類 */
    kind: "使用上の禁忌（成立の取り消しは明記なし）";
  };
  cautions: { passageId: string; original: string; ja: string }[];
  appRelations: (Omit<ClassicAppRelation, "relation"> & {
    relation:
      | "甲申旬ではこの格局がそのまま例外の対象"
      | "甲申旬では同じ干の組み合わせ（上下も一致）"
      | "名称のみ共通（定義が異なる）";
  })[];
  autoJudgement: { enabled: false; reason: string };
  status: string;
}

/** 他の古典の見解（『寶鑑』の規則としては登録しない）。 */
export interface ClassicOtherSourceView {
  id: string;
  /** 資料名 */
  work: string;
  /** 巻・節 */
  location: string;
  source: ClassicSource;
  /** 原文（取得したまま） */
  original: string[];
  translationJa: string[];
  /** 比較項目ごとの見解（topic は比較表の項目名） */
  views: { topic: string; original: string; ja: string }[];
  /** 『寶鑑』の例外規則との関係 */
  relatedExceptionIds: string[];
}
