// src/lib/takujitsu/jika/shinsatsuLookup.ts
//
// 役割:
//   720表に現れる時家神殺名（正式名称・略記・複合表記を含む）から、
//   時家宜忌マスター（data/jika_yiji.json の groups.yi／groups.ji）上の
//   対応する神殺グループ（原文rawText付き）を検索する。
//
// 唯一の仕様根拠:
//   docs/takujitsu_jika_shinsatsu_names_audit.md（略記・複合表記対応、13.3節・15章）
//   src/lib/takujitsu/jika/data/jika_yiji.json（groups.yi／groups.ji）
//
// 方針（重要）:
//   一般知識・推測から象意・宜忌の文章を新規作成することは一切行わない。
//   既存の宜忌マスター（原文rawText）をそのまま返すだけの検索処理。
//   「貴人（種別未特定）」「黃道（種別未特定）」「黑道（種別未特定）」は、
//   対応しうる正式名称のグループが複数存在し、どのグループかを720表側の
//   情報だけでは一意に特定できないため、ここでは解決しない（null を返す。
//   推測で埋めない）。「五符（種別未特定）」は國印五符・唐符五符の
//   2名称がいずれも同一の1列に属するため、一意に解決できる。

import jikaYijiFile from "./data/jika_yiji.json";

interface YijiGroupRaw {
  column: string;
  names: string[];
  rawText: string;
  confidence: string;
}
interface YijiFileShape {
  groups: { yi: YijiGroupRaw[]; ji: YijiGroupRaw[] };
}
const yijiData = jikaYijiFile as unknown as YijiFileShape;

export interface ShinsatsuProfile {
  /** この情報が対応する神殺グループの正式名称一覧（併記列の場合は複数）。 */
  names: string[];
  direction: "yi" | "ji";
  /** 原文（時家吉凶.pdf の該当列をそのまま引用）。 */
  rawText: string;
  confidence: string;
}

// 720表側の略記・複合表記 → 正式名称（1つのグループに一意に定まるもののみ）。
// docs/takujitsu_jika_shinsatsu_names_audit.md 13.3節・15章の確定内容。
const ALIAS_TO_NAME: Record<string, string> = {
  "右弼→左輔": "左輔",
  "左輔(右弼)": "左輔",
  "退時→大退時": "大退時",
  "羅天大進(大進)": "羅天大進",
  "國印五符(國印)": "國印五符",
  "唐符五符(唐符)": "唐符五符",
  // 國印五符・唐符五符はいずれも同一列（吉神列11）のため代表名で引ける。
  "五符(種別未特定)": "國印五符",
  // 天狗凶時・下食凶時はいずれも同一列（凶神列4）のため代表名で引ける。
  "天狗凶時+下食凶時(狗食)": "天狗凶時",
  // 寶光黃道・天德黃道はいずれも同一列（吉神列15）のため代表名で引ける。
  "寶光黃道／天德黃道(要再確認)": "寶光黃道",
};

// 対応しうる正式名称のグループが複数あり、720表側の情報だけでは
// 一意に特定できないため解決しない「種別未特定」の総称表現。
const UNRESOLVABLE = new Set(["貴人(種別未特定)", "黃道(種別未特定)", "黑道(種別未特定)"]);

let cachedIndex: Map<string, ShinsatsuProfile> | null = null;
function getIndex(): Map<string, ShinsatsuProfile> {
  if (cachedIndex) return cachedIndex;
  const map = new Map<string, ShinsatsuProfile>();
  for (const g of yijiData.groups.yi) {
    for (const n of g.names) {
      map.set(n, { names: g.names, direction: "yi", rawText: g.rawText, confidence: g.confidence });
    }
  }
  for (const g of yijiData.groups.ji) {
    for (const n of g.names) {
      map.set(n, { names: g.names, direction: "ji", rawText: g.rawText, confidence: g.confidence });
    }
  }
  cachedIndex = map;
  return map;
}

/**
 * 720表に現れる神殺名（正式名称・略記・複合表記を含む）から、
 * 時家宜忌マスターの対応グループ（原文rawText）を取得する。
 * 「種別未特定」の総称表現など、複数グループ候補があり一意に特定できない
 * 場合、および独立時家用語（宜忌記載なし）の場合は null を返す。
 */
export function lookupShinsatsuProfile(term: string): ShinsatsuProfile | null {
  if (UNRESOLVABLE.has(term)) return null;
  const canonical = ALIAS_TO_NAME[term] ?? term;
  return getIndex().get(canonical) ?? null;
}
