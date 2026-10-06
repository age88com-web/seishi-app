// src/lib/takujitsu/shinsatsu/excludedShinsatsu.ts
//
// 役割:
//   原資料（docs/source/擇日テキスト.pdf など）には記載があるが、監修判断により
//   擇日アプリでは採用しない神殺の記録。
//   ここに載せた神殺は、発動判定（occurrence）・resolution・用事判定・画面表示の
//   いずれにも出さない。資料そのものは変更しない。
//   tests/takujitsu_excluded_shinsatsu_unit.manual.ts が、ここに載せた名前が
//   神殺判定の出力・用事判定プロファイル・原文訂正台帳に現れないことを確認する。

export interface ExcludedShinsatsu {
  readonly name: string;
  /** 吉神か凶神か（原資料上の区分）。 */
  readonly kind: "kichijin" | "kyojin";
  /** 原資料での位置（印刷ページと項目番号）。 */
  readonly location: string;
  /** 原資料の起法（記録用）。 */
  readonly sourceRule: string;
  /** 不採用の理由。 */
  readonly reason: string;
  /** 監修判断の日付。 */
  readonly decidedAt: string;
  readonly note?: string;
}

export const EXCLUDED_SHINSATSU: readonly ExcludedShinsatsu[] = [
  {
    name: "神在",
    kind: "kichijin",
    location: "擇日テキスト.pdf p.18 (40)",
    sourceRule: "固定の日干支35件の列挙（月令に関係ない）",
    reason: "監修判断により不採用。該当件数が多すぎるため（本文も「これも多すぎるため使えない神殺といえる」と記す）。",
    decidedAt: "2026-10-06",
    note: "原文の列挙に干支として成り立たない「庚戊」が含まれるが、神在自体を不採用としたため訂正の対象から外す。",
  },
  {
    name: "七聖",
    kind: "kichijin",
    location: "擇日テキスト.pdf p.18 (41)",
    sourceRule: "固定の日干支37件の列挙（月令に関係ない）",
    reason: "監修判断により不採用。該当件数が多すぎるため（本文も「これも多すぎるため考慮しなくても良い」と記す）。",
    decidedAt: "2026-10-06",
    note: "原文の列挙に「乙末」（乙未の字形誤り）が含まれるが、七聖自体を不採用としたため台帳から外す。",
  },
];

/** 不採用の神殺名の集合。 */
export const EXCLUDED_SHINSATSU_NAMES: ReadonlySet<string> = new Set(EXCLUDED_SHINSATSU.map((e) => e.name));
