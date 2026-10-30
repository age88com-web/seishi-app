// src/lib/qimenClassics/index.ts
//
// 奇門遁甲の原典解釈データの公開窓口（Phase 5B・2026-10-19）。
//   格局の成立判定・排盤・検索・表示からは呼ばれない独立した参照データ。
//   将来、宮で成立した現行格局（名称）や剋應（ID）から原典の記述を引くための参照関数だけを持つ。
//   干の組み合わせから原典の格局を引く関数（＝成立判定に当たるもの）は、上下関係・甲の扱い・
//   中宮寄宮が原典で確定するまで用意しない。
//   Phase 5C（2026-10-23）: 影印本の段（凡例・歌訣注）・甲申旬の例外・『奇門法竅』の見解を引く関数を追加。
//   甲申旬の例外も成立判定・検索・吉凶評価には接続しない。

import { BAOJIAN_CRITIQUES, BAOJIAN_RULES, BAOJIAN_SECTIONS } from "./baojian";
import { BAOJIAN_EXCEPTIONS, BAOJIAN_PASSAGES, FACSIMILE_431 } from "./baojianFacsimile";
import { FAQIAO_VIEWS } from "./faqiao";
import type {
  ClassicCritique,
  ClassicExceptionRule,
  ClassicOtherSourceView,
  ClassicPassage,
  ClassicRule,
  ClassicSection,
} from "./types";

export { BAOJIAN_CRITIQUES, BAOJIAN_EXCEPTIONS, BAOJIAN_PASSAGES, BAOJIAN_RULES, BAOJIAN_SECTIONS, FACSIMILE_431, FAQIAO_VIEWS };
export type * from "./types";

/** 節 ID から原典の節を引く。 */
export function lookupClassicSection(id: string): ClassicSection | undefined {
  return BAOJIAN_SECTIONS.find((s) => s.id === id);
}

/** 現行格局名（jikaku.ts / kyokaku.ts の name）に対応関係を持つ原典の規則（関係の種類つき）。 */
export function lookupClassicRulesByAppKaku(name: string): { rule: ClassicRule; relation: ClassicRule["appRelations"][number] }[] {
  return BAOJIAN_RULES.flatMap((rule) =>
    rule.appRelations.filter((r) => r.kind === "現行格局" && r.target === name).map((relation) => ({ rule, relation })),
  );
}

/** 剋應 ID に対応関係を持つ原典の規則（関係の種類つき）。 */
export function lookupClassicRulesByKokuoId(id: string): { rule: ClassicRule; relation: ClassicRule["appRelations"][number] }[] {
  return BAOJIAN_RULES.flatMap((rule) =>
    rule.appRelations.filter((r) => r.kind === "剋應" && r.target === id).map((relation) => ({ rule, relation })),
  );
}

/** 現行格局名を批判の対象に含む原典の箇所。 */
export function lookupClassicCritiquesByAppKaku(name: string): ClassicCritique[] {
  return BAOJIAN_CRITIQUES.filter((c) => c.affectedAppKaku.includes(name));
}

/** 段 ID から原典の段（凡例・歌訣注など。Phase 5C）を引く。 */
export function lookupClassicPassage(id: string): ClassicPassage | undefined {
  return BAOJIAN_PASSAGES.find((p) => p.id === id);
}

/** 現行格局名に対応関係を持つ原典の例外・注意（甲申旬の例外など。関係の種類つき）。 */
export function lookupClassicExceptionsByAppKaku(
  name: string,
): { exception: ClassicExceptionRule; relation: ClassicExceptionRule["appRelations"][number] }[] {
  return BAOJIAN_EXCEPTIONS.flatMap((exception) =>
    exception.appRelations.filter((r) => r.kind === "現行格局" && r.target === name).map((relation) => ({ exception, relation })),
  );
}

/** 『寶鑑』の例外規則に関係する他資料の見解（『奇門法竅』など。『寶鑑』の規則としては扱わない）。 */
export function lookupOtherSourceViewsByException(exceptionId: string): ClassicOtherSourceView[] {
  return FAQIAO_VIEWS.filter((v) => v.relatedExceptionIds.includes(exceptionId));
}
