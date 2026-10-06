// src/lib/takujitsu/jika/index.ts
//
// 役割:
//   擇時（時家）720表引きモジュールの公開窓口。
//   日干支＋時支 をキーに、完成済み720表（data/jika_720.json）から
//   該当する1マスをそのまま返す「純粋な検索処理」のみを行う。
//
// 方針（重要）:
//   docs/takujitsu_jika_720_master.md の結論（720マスター本転記・検証 PASS）
//   により、時家吉凶.pdf は60日干支×12時辰＝720通りを完全に網羅している。
//   実際に発生する日干支＋時支の組み合わせは必ずこの720通りのいずれかに
//   一致するため、神殺ごとの発生公式を再構築しない。一般的な時家理論からの
//   再計算、日家神殺ロジックの流用も行わない（原表の表引きのみ）。
//
// データの分離:
//   本番用データは data/jika_720.json（本ファイル専用の複製）。
//   tests/fixtures/jika_720_master.json はテスト用フィクスチャであり、
//   本番コードはこちらを直接参照しない（tests/jika_720.manual.ts が
//   両者の一致を回帰テストとして固定する）。
//
// 今回のスコープ外（まだ実装しない）:
//   用事別吉凶判定・109用事mapping・点数化・ランキング・UI・擇日画面接続・
//   奇門遁甲接続。本モジュールは「日干支＋時支 → 1マスの取得」のみを行う。

import jika720File from "./data/jika_720.json";
import type { JikaEntry } from "./types";

export type { JikaEntry } from "./types";
export type {
  JikaActivityEvaluation,
  JikaActivityEvidence,
  JikaActivityUnmapped,
  JikaActivityVerdict,
} from "./types";
export { evaluateJikaActivity } from "./activityEvaluation";
export type { ShinsatsuProfile } from "./shinsatsuLookup";
export { lookupShinsatsuProfile } from "./shinsatsuLookup";

/** data/jika_720.json 内の1レコードの型（720マスター生データ）。 */
interface RawJikaRecord {
  dayGanzhi: string;
  hourBranch: string;
  hourGanzhi: string;
  rawText: string | null;
  normalizedTerms: string[];
  status: string;
  sourcePage: string | null;
  unresolved: string[];
}

interface JikaDataFile {
  schema_version: number;
  record_count: number;
  records: RawJikaRecord[];
}

const jika720 = jika720File as JikaDataFile;

/** 「日干支＋時支」→ レコード の検索用インデックス（初回参照時に1回だけ構築）。 */
const index: Map<string, RawJikaRecord> = new Map(
  jika720.records.map((r) => [r.dayGanzhi + r.hourBranch, r]),
);

const MUYO = "勿用";

/**
 * 日干支＋時支 をキーに、720表から該当する1マスを取得する。
 *
 * @param dayGanzhi 日干支（例: "甲子"）。CalendarResult.dayStem + dayBranch を渡す。
 * @param hourBranch 時支（例: "子"）。CalendarResult.hourBranch をそのまま渡す。
 * @returns 該当マス。720表に存在しない組み合わせ（本来あり得ない）の場合は null。
 */
export function getJikaEntry(
  dayGanzhi: string,
  hourBranch: string,
): JikaEntry | null {
  const rec = index.get(dayGanzhi + hourBranch);
  if (!rec) return null;

  const isMuyo = rec.normalizedTerms.length === 1 && rec.normalizedTerms[0] === MUYO;

  return {
    dayGanzhi: rec.dayGanzhi,
    hourBranch: rec.hourBranch,
    hourGanzhi: rec.hourGanzhi,
    rawText: rec.rawText ?? "",
    normalizedTerms: isMuyo ? [] : rec.normalizedTerms,
    isMuyo,
  };
}

/** 720表の総レコード数（回帰テスト用に公開）。 */
export function getJikaRecordCount(): number {
  return jika720.records.length;
}
