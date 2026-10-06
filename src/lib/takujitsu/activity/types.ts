// src/lib/takujitsu/activity/types.ts
//
// 役割:
//   用途判定フェーズで使う「用事」（活動）の辞書エントリの型。
//   docs/takujitsu_activity_rules.md（吉神Group1〜6・凶神Group1〜6・
//   十二建除・二十八宿の宜/忌棚卸し）に登場する用事語を、原典表記のまま
//   idとして安定化させたもの。
//
// 唯一の仕様根拠:
//   docs/takujitsu_activity_rules.md（今回の棚卸し結果）
//   docs/source/用事便覧.pdf（現代語訳・説明の出典。約50語のみ対応）
//   外部資料・一般知識・推測による補完は禁止。
//
// 方針（ユーザー指示、2026-09-09）:
//   用事便覧に対応する主要な約50用事だけ、現代語訳・説明を紐づける。
//   それ以外の用事は無理に正規化・現代語化せず、原典表記をそのまま
//   canonicalNameとして採用する（意味が似ているだけの語は統合しない。
//   独自の大分類は作らない）。今回の目的は辞書を完全に整理することでは
//   なく、各神殺・十二建除・二十八宿の象意から吉用事・凶用事を導出
//   できる状態にすること。

/** 用事（活動）1件のマスタデータ。 */
export interface ActivityDefinition {
  /** 安定的な内部ID。canonicalNameと同じ文字列を使う（原典表記をそのまま安定化）。 */
  id: string;
  /**
   * 擇日テキスト.pdf／12建除.pdf／擇日象意.pdfに実際に登場する表記。
   * 用事便覧に対応が無い語は、これがそのまま最終的な表示名になる
   * （現代語化しない）。
   */
  canonicalName: string;
  /**
   * 用事便覧.pdfの読み（ふりがな）。対応がある約50語のみ設定する。
   * 現代語の「訳」に相当するものが用事便覧側に無いため、読みを
   * modernNameとして保持する（原語と別の現代語の言い換えが存在する
   * 語は無かった）。
   */
  modernName?: string;
  /** 用事便覧.pdfの説明文（現代語）。対応がある約50語のみ設定する。 */
  description?: string;
  /** 用事便覧.pdfの通し番号（1〜93、20番は原本の欠番）。対応がある語のみ設定する。 */
  youjibinranNo?: number;
  /**
   * 用事詳細画面に表示する「現代語訳」（表示専用、短いフレーズ）。
   * 2026-09-11追記（用事詳細・現代語訳フェーズ）: canonical id/canonicalName
   * は変更せず、UI表示だけを補う目的で追加。用事便覧.pdf／神殺象意.pdf／
   * 擇日テキスト.pdf／12建除.pdf、またはプロジェクト内の既存description
   * から直接確認できた語だけに設定する（一般知識による推測補完はしない）。
   * ActivityProfile／宜忌判定ロジック／検索ロジックはこのフィールドを
   * 一切参照しない。未設定＝資料上の意味を確認できず保留中の語
   * （docs/takujitsu_activity_modern_label_review.md参照）。
   */
  modernLabel?: string;
}

// ---------------------------------------------------------------------------
// 用途判定engine 第1フェーズ（2026-09-09追加）
//
// 役割:
//   その日に成立している吉神・凶神・十二建除・二十八宿の象意
//   （docs/takujitsu_activity_rules.md）から、各用事について「宜とする
//   根拠」「忌とする根拠」を集約するための型。
//
// 唯一の仕様根拠:
//   docs/takujitsu_activity_rules.md（十二建除12・二十八宿28・吉神44・
//   凶神53の宜/忌棚卸し）
//   docs/takujitsu_resolution_rules.md（凶神の解除・相殺・増悪ルール）
//
// 重要な方針（ユーザー指示、2026-09-09）:
//   ・「吉神だから全用事に吉」「凶神だから全用事に凶」としない。
//     原典に明記された具体的な用事だけをActivityProfileへ反映する
//     （象意不明・保留のものは空配列）。
//   ・positiveSources/negativeSourcesは sourceType ではなく原典の象意
//     そのもので判定する。凶神でも明示的な宜があればpositiveSourcesへ、
//     吉神でも明示的な忌があればnegativeSourcesへ入れる。
//   ・positive/negativeの件数比較による多数決はしない。今回は独自の
//     総合吉凶ルール・優先順位・点数化を作らない。
// ---------------------------------------------------------------------------

/** 象意の出典種別。 */
export type ActivitySourceType = "kichijin" | "kyojin" | "jianchu" | "shuku28";

/**
 * 宜/忌の記述方式（2026-09-09追加、神殺象意.pdfの原本確認により判明した
 * 2つの構造に対応する）。
 *   "list"       : 明示列挙された用事だけが宜/忌（従来どおりの方式）。
 *   "all_except" : 「諸事皆宜／餘事皆忌」＝原則としてActivityDefinition
 *                  全件が宜/忌で、exceptionActivityIds（例外）だけが
 *                  対象外になる、という構造（docs/takujitsu_except_resolution_final.md
 *                  1〜7章で原本画像により確認済み）。
 */
export type ActivityPolarityMode = "list" | "all_except";

/**
 * 1つの神殺・十二建除・二十八宿が持つ象意（宜/忌）のプロファイル。
 * docs/takujitsu_activity_rules.md・docs/source/神殺象意.pdf の宜/忌欄を
 * ActivityDefinitionのidへ接続したもの。
 */
export interface ActivityProfile {
  sourceType: ActivitySourceType;
  /**
   * occurrence名（吉神・凶神は src/lib/takujitsu/shinsatsu/*.ts が
   * kichijin[]/kyojin[] に積む文字列と同一。十二建除は JianchuResult.name、
   * 二十八宿は Shuku28Info.lodge と同一）。
   */
  sourceName: string;
  /**
   * 宜の記述方式。既定は"list"。"all_except"は神殺象意.pdfが「諸事皆宜、
   * 惟忌〜」と明記する6吉神（天徳・月徳・天徳合・月徳合・天赦・天願）
   * だけに使う（docs/takujitsu_except_resolution_final.md 5章）。
   */
  positiveMode?: ActivityPolarityMode;
  /** 宜とする用事のActivityDefinition id配列（positiveMode==="list"のとき使用。本文に明記が無ければ空配列）。 */
  favorableActivityIds: string[];
  /**
   * positiveMode==="all_except"のとき、ActivityDefinition全件のうち
   * この配列に含まれる用事だけが宜から除外される（＝忌のまま、または
   * 中立）。これは「例外的に忌のまま」という意味であり、それ以外の
   * 全用事が宜になる（例：天徳等の「惟忌敗獵取魚」＝畋獵・取魚だけが
   * 例外）。
   */
  positiveExceptionActivityIds?: string[];
  /**
   * 忌の記述方式。既定は"list"。"all_except"は神殺象意.pdfが「止不忌〜、
   * 餘事皆忌」と明記する11凶神（月破・死神・劫殺・災殺・月殺・月刑・
   * 月厭・四廢・上朔・四離・四絶）だけに使う
   * （docs/takujitsu_except_resolution_final.md 1〜4章）。
   */
  negativeMode?: ActivityPolarityMode;
  /** 忌とする用事のActivityDefinition id配列（negativeMode==="list"のとき使用。本文に明記が無ければ空配列）。 */
  unfavorableActivityIds: string[];
  /**
   * negativeMode==="all_except"のとき、ActivityDefinition全件のうち
   * この配列に含まれる用事だけが忌から除外される（＝不忌。「宜」では
   * ない点に注意。他に宜の根拠が無ければpositiveにはならない）。
   * それ以外の全用事が忌になる（原文「止不忌A・B・C、餘事皆忌」）。
   */
  exceptionActivityIds?: string[];
  /**
   * resolutionが"reduced"になった際、原典が「一部の用事だけは引き続き
   * 忌のまま残る」と明記している場合に使う（例：小時＝月建の
   * 「與徳合等併、止忌動土、餘則不忌」＝修造動土・伐木だけが残る）。
   * 指定が無い場合、reduced状態ではunfavorableActivityIds全体を
   * 反映しない（従来どおりの挙動）。指定がある場合、この配列に含まれる
   * id（かつ元々unfavorableActivityIdsに含まれるid）だけを反映する。
   */
  reducedStillUnfavorableActivityIds?: string[];
  /**
   * 特定の二十四節気区間でのみ追加される宜/忌（2026-09-09、十二建除
   * 執・危・収 季節条件完成フェーズで追加）。神殺象意.pdfが「霜降後，
   * 立春前，宜畋獵」のように、通常の宜/忌とは別に季節限定の宜/忌を
   * 明記している場合に使う。favorableActivityIds/unfavorableActivityIds
   * （通常宜忌）とは独立に評価され、互いを上書きしない（同じ用事に
   * 通常忌と季節宜が同時に成立する場合はmixedになる。原典に優先関係の
   * 明記が無い限り、勝手に優先順位を作らない）。
   */
  seasonalRules?: ActivitySeasonalRule[];
  /**
   * COMPOSITE型（六黄道。2026-09-10、六黄道COMPOSITE本番実装フェーズで追加）。
   * neta：神殺象意.pdf「〔青龍〕〔明堂〕〔寶光〕〔玉堂〕〔司命〕爲六黄道日，
   * 與吉神併，則從所宜，與凶神併，則從所忌」。原文に明記された5神のうち
   * 青龍・明堂・寶光・玉堂の4神に true を立てる（司命は監修確定 2026-10-06 により
   * 一般的な吉日を示す吉神として扱い、立てない。generalAuspiciousDay 参照）。金匱は原文の
   * 列挙に含まれないため立てない（docs/takujitsu_liuhuangdao_composite_analysis.md 2章）。
   *
   * true の場合、evaluateActivities() の第2パスで、同日に成立している
   * 他の吉神（kichijin）・凶神（kyojin）由来の有効な宜/忌を、この神殺
   * 自身の宜/忌としても追従させる（「與吉神併，則從所宜」「與凶神併，
   * 則從所忌」）。追従対象は resolution 適用後の有効な忌のみ
   * （cancelled凶神の忌は復活させない）。十二建除・二十八宿は追従対象外。
   * 他のCOMPOSITE型神を再帰的に追従することもない。
   *
   * このフラグは追加機能であり、favorableActivityIds／unfavorableActivityIds
   * （既存LIST型データ。5神も金匱も「家族会議」「遠行」を保持する）を
   * 置換しない。第1パスでは他の吉神と同様にLIST型として評価される。
   */
  composite?: boolean;
  /**
   * 一般的な吉日を示す吉神（監修確定 2026-10-06。現在は司命のみ）。
   * 特定の用事に個別の宜忌を与えず、その日が一般的に吉であることを示す日次評価の要素として保持する。
   * evaluateActivities() は個別用事の宜忌に展開しない（favorable/unfavorable は空、composite も立てない）。
   */
  generalAuspiciousDay?: boolean;
  /**
   * docs/takujitsu_activity_rules.mdで「保留」「本文中に見当たらず」等と
   * 確認済みの理由、または表構造上の注記（自由文）。favorable/unfavorable
   * が空配列である理由の説明に使う。
   */
  notes?: string;
}

/**
 * 特定の二十四節気区間でのみ成立する宜/忌の条件付きルール
 * （2026-09-09、十二建除 執・危・収 季節条件完成フェーズで追加）。
 * 神殺象意.pdfの季節限定宜忌（例：執日「霜降後，立春前，宜畋獵。雨水後，
 * 立夏前，宜取魚」）をそのまま表現する。
 */
export interface ActivitySeasonalRule {
  /**
   * 人が読める条件の説明（例：「霜降後、立春前」）。ActivitySource.note
   * にそのまま入り、後からUIで「執日（霜降後、立春前）」のように
   * 説明できる。過剰な文言は作らず、原文の期間表現をそのまま使う。
   */
  label: string;
  /**
   * この条件が成立する二十四節気名の集合（src/lib/calendar/types.tsの
   * SOLAR_TERMSに実在する名称のみを使う）。CalendarResult.solarTermが
   * この集合に含まれる日だけ、このルールのfavorable/unfavorableを
   * 反映する。monthBranch・lunarMonthは使わない（原文が節気の名称
   * そのもので期間を指定しているため）。
   */
  solarTerms: string[];
  /** この条件下でのみ追加される宜（通常のfavorableActivityIdsとは別集計）。 */
  favorableActivityIds?: string[];
  /** この条件下でのみ追加される忌（通常のunfavorableActivityIdsとは別集計）。 */
  unfavorableActivityIds?: string[];
}

/** resolution層のstatus（src/lib/takujitsu/resolution/types.tsのResolutionStatusと同じ値）。 */
export type ResolutionStatusLike = "active" | "cancelled" | "reduced" | "aggravated" | "pending";

/**
 * 1つの用事について、なぜ「宜」または「忌」になったかを説明する出典1件。
 * UIで「なぜこの用事が宜／忌になったか」を後から神殺名まで遡って
 * 説明できるように、名前だけでなく判定過程の情報を保持する。
 */
export interface ActivitySource {
  sourceType: ActivitySourceType;
  sourceName: string;
  /**
   * 凶神（kyojin）のみ、resolution適用後のstatusを保持する。
   * 吉神・十二建除・二十八宿はresolution（解除・相殺・増悪）の対象外
   * のため常にundefined。
   */
  resolutionStatus?: ResolutionStatusLike;
  /** ActivityProfile.notes、またはresolutionのreason/noteなど、人が読める補足。 */
  note?: string;
  /**
   * reduced状態で、原典に用途限定の残存忌が記載されているが、具体的な
   * ActivityDefinitionへの対応がまだ確定していない場合の生テキスト
   * （例：No.10大時・天吏の「攻めのビジネスは凶のまま」）。
   * 勝手に既存用事へマッピングしないため、情報を失わずここに保持する。
   */
  unresolvedActivityRestriction?: string;
}

/**
 * verdictの候補。今回は単純な事実分類のみ（独自の優先順位・点数化はしない）。
 *   good    : positiveSourcesのみ非空
 *   bad     : negativeSourcesのみ非空
 *   mixed   : 両方非空（勝手に相殺しない。多数決もしない）
 *   neutral : どちらも空
 * pendingはverdictの値にはせず、hasPendingSourceフラグとして独立に保持する
 * （pendingな凶神のstatusを理由に、確定した宜/忌の事実分類を覆さないため）。
 */
export type ActivityVerdict = "good" | "bad" | "mixed" | "neutral";

/** 1つの用事についての、その日の宜/忌根拠の集約結果。 */
export interface ActivityEvaluation {
  activityId: string;
  /** その用事を「宜」と明示している、その日成立した神殺・十二建除・二十八宿。 */
  positiveSources: ActivitySource[];
  /** その用事を「忌」と明示している、その日成立した神殺・十二建除・二十八宿。 */
  negativeSources: ActivitySource[];
  verdict: ActivityVerdict;
  /**
   * positiveSources・negativeSourcesのいずれかに resolutionStatus==="pending"
   * の出典が含まれる場合true。verdict自体はpositive/negativeの事実（件数の
   * 有無）だけで決まるため、pendingな出典があっても上書きしない
   * （情報を失わないための独立フラグ）。
   */
  hasPendingSource: boolean;
}

/** 用事便覧に対応の無い用事へのunresolvedActivityRestriction（No.10大時・天吏など）。 */
export interface UnresolvedActivityRestriction {
  sourceType: ActivitySourceType;
  sourceName: string;
  resolutionStatus: ResolutionStatusLike;
  /** ResolvedShinsatsuEntry.reason（適用ルールのnote）をそのまま保持する。 */
  description: string;
}

/**
 * evaluateActivities() の第1.5パスで抑制された吉神positiveの説明情報
 * （2026-09-10、月破・徳神positive抑制フェーズで追加）。
 *
 * 神殺象意.pdf月破「德神臨此失力、不能爲福、故即與德合併、猶忌」＝月破成立日は
 * 指定した徳神（天徳・天徳合・月徳・月徳合・天赦・天願）の「福をなす力」が
 * 失われる。その日の evaluation 上でだけ徳神の宜(positive)を無効化し、
 * raw occurrence（ShinsatsuResult.kichijin）からは削除しない（二層構造）。
 * UIで「天徳（月破により失力）」のように説明できるよう、何が・何によって・
 * なぜ抑制されたかを保持する。詳細は
 * docs/takujitsu_geppo_deity_suppression_analysis.md。
 */
export interface ActivitySuppression {
  /** 抑制された吉神の種別（現状は "kichijin" のみ）。 */
  sourceType: ActivitySourceType;
  /** 抑制された吉神名（例: "天徳"）。ShinsatsuResult.kichijin には残っている。 */
  sourceName: string;
  /** 抑制の原因となった神殺の種別（現状は "kyojin"）。 */
  suppressedByType: ActivitySourceType;
  /** 抑制の原因となった神殺名（現状は "月破"）。 */
  suppressedByName: string;
  /** 人が読める理由（原典の文言）。 */
  reason: string;
  /**
   * この吉神×この神殺の組で抑制された用事id（第1パスでその吉神が
   * favorable(宜)として生成していたもの）。ActivityDefinition id の配列。
   */
  activityIds: string[];
}

/** evaluateActivities() の戻り値。 */
export interface ActivityEvaluationResult {
  evaluations: ActivityEvaluation[];
  /** 具体的な用事へマッピングできなかった用途限定の残存忌の一覧（No.10等）。 */
  unresolvedRestrictions: UnresolvedActivityRestriction[];
  /**
   * 第1.5パスで抑制された吉神positiveの説明情報（月破・徳神失力）。
   * 抑制が無かった日は空配列。
   */
  suppressions: ActivitySuppression[];
}
