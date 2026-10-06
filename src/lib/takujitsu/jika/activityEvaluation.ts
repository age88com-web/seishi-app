// src/lib/takujitsu/jika/activityEvaluation.ts
//
// 役割:
//   擇時（時家）・用事別吉凶判定エンジンの第1段階。
//   日干支＋時支 → 720表引き（getJikaEntry） → 該当時家神殺 →
//   時家神殺宜忌マスター（data/jika_yiji.json） →
//   109用事mapping（data/jika_activity_mapping.json） →
//   指定した109用事について宜／忌の存在状態を抽出する。
//
// 唯一の仕様根拠:
//   docs/takujitsu_jika_720_master.md（720表引きエンジン、PASS）
//   docs/takujitsu_jika_yiji_master.md（時家宜忌マスター、PASS）
//   docs/takujitsu_jika_activity_mapping_audit.md（mapping監査、完了）
//
// 方針（ユーザー指示、逸脱禁止・今回のスコープ外）:
//   ・発生公式の再構築はしない。720表を唯一の正解として表引きするのみ。
//   ・mappingClass A（直接一致）・C（包含・近接対応）のみを判定材料とする。
//     B（0件）・D（保留2語）・F（意味不明1語）は自動mappingしない。
//     E（16語）は時家独自語彙として保持するが109用事へは対応させない。
//   ・判定結果は「吉／凶／吉凶混合／該当なし」の4状態のみ。点数化・
//     ランキング・相殺・優先順位づけは行わない（宜と忌が両方あっても
//     「吉凶混合」を返すだけで、どちらが勝つかを決めない）。
//   ・勿用（isMuyo）は判定結果とは独立したフラグとして返す。
//     「勿用なら全用事が凶」というルールは実装しない。
//   ・UI・擇日画面接続・奇門遁甲接続は行わない。

import jikaYijiFile from "./data/jika_yiji.json";
import jikaMappingFile from "./data/jika_activity_mapping.json";
import { getJikaEntry } from "./index";
import { getActivityDefinition } from "../activity/activityDefinitions";
import type {
  JikaActivityEvaluation,
  JikaActivityEvidence,
  JikaActivityUnmapped,
  JikaActivityVerdict,
} from "./types";

export type {
  JikaActivityEvaluation,
  JikaActivityEvidence,
  JikaActivityUnmapped,
  JikaActivityVerdict,
} from "./types";

// --- data/jika_yiji.json の型 ---------------------------------------------

interface YijiRecord {
  shinsatsu: string[];
  direction: "yi" | "ji";
  sourceTerm: string;
  rawText: string;
  confidence: string;
  notes: string | null;
}

interface YijiFile {
  schema_version: number;
  record_count: number;
  records: YijiRecord[];
}

// --- data/jika_activity_mapping.json の型 ---------------------------------

type MappingClass = "A" | "B" | "C" | "D" | "E" | "F";

interface MappingRecord {
  sourceTerm: string;
  sourceDirections: ("yi" | "ji")[];
  sourceShinsatsu: string[];
  mappingClass: MappingClass;
  targetActivityId: string | null;
  targetActivityCandidates?: string[];
  relation?: string;
  unmappedReason?: string;
  evidence?: string;
  notes?: string;
}

interface MappingFile {
  schema_version: number;
  record_count: number;
  records: MappingRecord[];
}

const yijiData = jikaYijiFile as YijiFile;
const mappingData = jikaMappingFile as MappingFile;

/** sourceTerm → mapping本番データ の索引（初回参照時に1回だけ構築）。 */
const mappingBySourceTerm: Map<string, MappingRecord> = new Map(
  mappingData.records.map((r) => [r.sourceTerm, r]),
);

/**
 * 時家神殺名 → その神殺が含まれる宜忌グループ行 の索引。
 * 1つの神殺名は複数グループ行（宜1行・忌1行など）にヒットしうる。
 */
const yijiByShinsatsu: Map<string, YijiRecord[]> = new Map();
for (const rec of yijiData.records) {
  for (const name of rec.shinsatsu) {
    const list = yijiByShinsatsu.get(name);
    if (list) {
      list.push(rec);
    } else {
      yijiByShinsatsu.set(name, [rec]);
    }
  }
}

const MAPPED_CLASSES: ReadonlySet<MappingClass> = new Set(["A", "C"]);

/**
 * 日干支＋時支＋109用事id を指定し、時家神殺の宜忌に基づく吉凶判定を行う。
 *
 * 判定パス: 日干支＋時支 → getJikaEntry（720表引き） → 該当時家神殺 →
 * 宜忌マスター（data/jika_yiji.json） → activity mapping（data/jika_activity_mapping.json、
 * A・Cクラスのみ） → 指定activityIdについて宜／忌の存在状態を抽出。
 *
 * 発生公式の再構築は行わない。720表・宜忌マスター・mappingマスターの
 * 表引きのみで完結する純粋関数。
 *
 * @param dayGanzhi 日干支（例: "甲子"）。
 * @param hourBranch 時支（例: "子"）。
 * @param activityId 109用事id（activityDefinitions.ts の id）。
 * @returns 判定結果。favorable/unfavorable/unmapped の各要素は原文（rawText）・
 *   神殺・mappingClassを保持し、UIで「なぜ」を後から説明できる。
 * @throws 720表に存在しない日干支・時支の組み合わせ、または存在しない
 *   activityId が渡された場合（本来あり得ない入力エラー）。
 */
export function evaluateJikaActivity(
  dayGanzhi: string,
  hourBranch: string,
  activityId: string,
): JikaActivityEvaluation {
  const entry = getJikaEntry(dayGanzhi, hourBranch);
  if (!entry) {
    throw new Error(
      `時家720表に存在しない日干支・時支の組み合わせです: ${dayGanzhi}/${hourBranch}`,
    );
  }

  if (!getActivityDefinition(activityId)) {
    throw new Error(`存在しない109用事idです: ${activityId}`);
  }

  const favorable: JikaActivityEvidence[] = [];
  const unfavorable: JikaActivityEvidence[] = [];
  const unmapped: JikaActivityUnmapped[] = [];

  const seenEvidence = new Set<string>();
  const seenUnmapped = new Set<string>();

  for (const shinsatsuName of entry.normalizedTerms) {
    const yijiRows = yijiByShinsatsu.get(shinsatsuName);
    if (!yijiRows) continue;

    for (const row of yijiRows) {
      const mapping = mappingBySourceTerm.get(row.sourceTerm);
      if (!mapping) continue;

      // 同一グループ内の複数神殺が同じマスに同時出現する場合、同じ行を
      // 複数回ヒットしうる（例: 長生・帝旺が同じマスに揃って出現）。
      // 原典上は同一の記述なので、二重計上せず1件として扱う。
      const dedupeKey = `${row.direction}|${row.sourceTerm}|${row.shinsatsu.join(",")}`;

      if (MAPPED_CLASSES.has(mapping.mappingClass) && mapping.targetActivityId === activityId) {
        if (seenEvidence.has(dedupeKey)) continue;
        seenEvidence.add(dedupeKey);

        const evidence: JikaActivityEvidence = {
          shinsatsu: row.shinsatsu,
          sourceTerm: row.sourceTerm,
          mappingClass: mapping.mappingClass as "A" | "C",
          rawText: row.rawText,
        };

        if (row.direction === "yi") {
          favorable.push(evidence);
        } else {
          unfavorable.push(evidence);
        }
      } else if (!MAPPED_CLASSES.has(mapping.mappingClass)) {
        // B（0件）・D・E・F：109用事へは自動mappingしない。
        // 削除も無視もせず、「時家神殺には対応する用事語があるが、
        // 109用事としては未対応」という事実を保持する。
        if (seenUnmapped.has(dedupeKey)) continue;
        seenUnmapped.add(dedupeKey);

        unmapped.push({
          shinsatsu: row.shinsatsu,
          sourceTerm: row.sourceTerm,
          mappingClass: mapping.mappingClass as "B" | "D" | "E" | "F",
          rawText: row.rawText,
          unmappedReason: mapping.unmappedReason,
        });
      }
      // mappingClass が A/C だが targetActivityId が今回指定のactivityIdと
      // 異なる場合は、この用事の判定には無関係なので何もしない。
    }
  }

  let verdict: JikaActivityVerdict;
  if (favorable.length > 0 && unfavorable.length > 0) {
    verdict = "吉凶混合";
  } else if (favorable.length > 0) {
    verdict = "吉";
  } else if (unfavorable.length > 0) {
    verdict = "凶";
  } else {
    verdict = "該当なし";
  }

  return {
    dayGanzhi: entry.dayGanzhi,
    hourBranch: entry.hourBranch,
    hourGanzhi: entry.hourGanzhi,
    activityId,
    favorable,
    unfavorable,
    unmapped,
    verdict,
    isMuyo: entry.isMuyo,
  };
}
