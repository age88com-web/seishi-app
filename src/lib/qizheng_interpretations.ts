// src/lib/qizheng_interpretations.ts
// 『七政四餘鑑定用資料』由来の鑑定用補助データ（docs/source/qizheng_*_v1.json）の型定義と lookup。
// - 既存エンジンの計算結果をキーに、該当レコードを引くだけ（判定の再計算はしない）
// - reference_only のデータ（qizheng_reference_tables / qizheng_nayin_juniun）は読み込まない
// - データ内容はここで加工しない

import palaceMeaningsJson from "../../docs/qizheng-data/qizheng_palace_meanings_v1.json";
import starBasicsJson from "../../docs/qizheng-data/qizheng_star_basics_v1.json";
import starBranchJson from "../../docs/qizheng-data/qizheng_star_branch_v1.json";
import starPalaceJson from "../../docs/qizheng-data/qizheng_star_palace_v1.json";
import mansionGroupJson from "../../docs/qizheng-data/qizheng_star_mansion_group_v1.json";
import conjunctionJson from "../../docs/qizheng-data/qizheng_star_conjunction_v1.json";
import henyouJson from "../../docs/qizheng-data/qizheng_henyou_v1.json";
import shenshaJson from "../../docs/qizheng-data/qizheng_shensha_v1.json";
import conditionalJson from "../../docs/qizheng-data/qizheng_conditional_rules_v1.json";
import combinationJson from "../../docs/qizheng-data/qizheng_combination_rules_v1.json";
import palaceRelationsJson from "../../docs/qizheng-data/qizheng_palace_relations_v1.json";
import lordRulesJson from "../../docs/qizheng-data/qizheng_lord_rules_v1.json";
import methods24Json from "../../docs/qizheng-data/qizheng_24_methods_v1.json";
import type { ZgStarKey } from "@/lib/zhangguo_interpretations";

export type QzSourceKind =
  | "classical" | "qizheng_secondary" | "western_comparison"
  | "author_commentary" | "shichusuimei_comparison" | "unspecified";

export interface QzRule {
  condition: Record<string, unknown>;
  result: string;
  effect: "good" | "bad" | "mitigate" | "conditional" | null;
  source_fragment: string;
  note?: string;
}

export interface QzRecord {
  id: string;
  category: string;
  name: string;
  target: string | string[] | null;
  conditions: Record<string, unknown>;
  interpretation: string | null;
  source_text: string;
  source_ref: { file: string; section?: string; table?: number | null; row?: number | null; column?: string | null };
  source_kind: QzSourceKind;
  related_ids: string[];
  notes: string[];
  // カテゴリ別の追加項目
  star?: string;
  members?: string[];
  members_raw?: string[];
  mansions_raw?: string[];
  group?: string;
  rules?: QzRule[];
  roles?: Record<string, { raw: string; stars: string[] }>;
  subject_palace?: string;
  classical_text?: { text: string; source_kind: QzSourceKind };
  shensha_table?: string;
  shensha_table_label?: string;
  names_in_row?: string[];
  row_meaning?: string;
  subject_type?: string;
  result?: string;
  effect?: QzRule["effect"];
  [k: string]: unknown;
}

type QzFile = { records: QzRecord[] };
const recs = (j: unknown) => (j as QzFile).records;

const PALACE_MEANINGS = recs(palaceMeaningsJson);
const STAR_BASICS = recs(starBasicsJson);
const STAR_BRANCH = recs(starBranchJson);
const STAR_PALACE = recs(starPalaceJson);
const MANSION_GROUP = recs(mansionGroupJson);
const CONJUNCTIONS = recs(conjunctionJson);
const HENYOU = recs(henyouJson);
const SHENSHA = recs(shenshaJson);
const CONDITIONAL = recs(conditionalJson);
const COMBINATION = recs(combinationJson);
const PALACE_RELATIONS = recs(palaceRelationsJson);
const LORD_RULES = recs(lordRulesJson);
const METHODS_24 = recs(methods24Json);

const BY_ID: ReadonlyMap<string, QzRecord> = new Map(
  [
    ...PALACE_MEANINGS, ...STAR_BASICS, ...STAR_BRANCH, ...STAR_PALACE, ...MANSION_GROUP,
    ...CONJUNCTIONS, ...HENYOU, ...SHENSHA, ...CONDITIONAL, ...COMBINATION,
    ...PALACE_RELATIONS, ...LORD_RULES, ...METHODS_24,
  ].map((r) => [r.id, r] as const)
);

export function getQzById(id: string): QzRecord | null {
  return BY_ID.get(id) ?? null;
}

/** related_ids のうち、補助データ内に存在するものを解決（張果星宗IDは文字列のまま返す） */
export function resolveRelated(rec: QzRecord): { qz: QzRecord[]; zhangguoIds: string[] } {
  const qz: QzRecord[] = [];
  const zhangguoIds: string[] = [];
  for (const id of rec.related_ids ?? []) {
    const r = BY_ID.get(id);
    if (r) qz.push(r);
    else if (/^(sun|moon|jupiter|mars|saturn|venus|mercury|ziqi|yuebo|rahu|ketu)_/.test(id)) zhangguoIds.push(id);
  }
  return { qz, zhangguoIds };
}

// ---------- 宮の基本象意 ----------
/** 星盤の宮名（命宮・夫妻宮・官禄宮・福徳宮…）で引く。資料と星盤は同じ表記 */
export function getPalaceMeaning(chartPalaceName: string): QzRecord | null {
  return BY_ID.get(`qz_palace_${chartPalaceName}`) ?? null;
}

// ---------- 星の補助資料（張果星宗とは別枠） ----------
export type QzSupplement = { label: string; rec: QzRecord };

export function getStarSupplements(args: {
  star: ZgStarKey;
  branch: string;
  mansion: string;
  chartPalaceName: string;
}): QzSupplement[] {
  const out: QzSupplement[] = [];
  const add = (label: string, id: string) => {
    const r = BY_ID.get(id);
    if (r && r.source_kind !== "western_comparison") out.push({ label, rec: r });
  };
  add("七政四餘の基本象意", `qz_star_${args.star}`);
  add("日宮推命法（星曜入宮歌）", `qz_starbranch_${args.star}_${args.branch}`);
  add("日宮推命法（象意等）", `qz_starbranch_${args.star}_${args.branch}_shoui`);
  add("七政四餘と命宮（星曜照宮歌）", `qz_starpalace_${args.star}_${args.chartPalaceName}`);
  // 宿グループ：定義の宿名と星盤の宿名が一致するものだけ（欠字表記 [ﾃｲ] は照合しない）
  const def = MANSION_GROUP.find(
    (r) => r.category === "mansion_group_definition" && (r.mansions_raw ?? []).includes(args.mansion)
  );
  if (def) add(`七政と宿度（${def.name}）`, `qz_mgroup_${args.star}_${def.name}`);
  return out;
}

// ---------- 限度主（宿 → 七政） ----------
// 既存の「七政と宿度」定義（日度：房虚昴星 …）をそのまま使う。
// データ上の欠字表記「[ﾃｲ]」は、『張果星宗』入門看法の度主「氐、女、胃、柳度土」により氐として扱う。
const MANSION_GROUP_ALIAS: Record<string, string> = { "[ﾃｲ]": "氐" };
export type MansionDegreeLord = { groupName: string; star: string };
export function getMansionDegreeLord(mansion: string | null | undefined): MansionDegreeLord | null {
  if (!mansion) return null;
  const def = MANSION_GROUP.find(
    (r) => r.category === "mansion_group_definition" &&
      ((r.mansions_raw as string[] | undefined) ?? []).some((m) => (MANSION_GROUP_ALIAS[m] ?? m) === mansion)
  );
  return def ? { groupName: String(def.name), star: String(def.group_star) } : null;
}

// ---------- 同宮 ----------
/** 宮内の星の集合に、構成星がすべて含まれる同宮レコード（データにあるものだけ。順序違いは別レコードのまま） */
export function findConjunctions(starsInPalace: string[]): QzRecord[] {
  const set = new Set(starsInPalace);
  if (set.size < 2) return [];
  return CONJUNCTIONS.filter((r) => {
    const m = r.members ?? [];
    return m.length >= 2 && new Set(m).size === m.length && m.every((k) => set.has(k));
  });
}

// ---------- 変曜 ----------
export function getHenyouMeaning(name: string): QzRecord | null {
  return BY_ID.get(`qz_henyou_${name}`) ?? null;
}

// ---------- 条件付きルール ----------
export type QzMatchContext = {
  chartPalaceName: string;      // 選択宮の宮名（星盤表記）
  isShenPalace: boolean;        // 選択宮が身宮か
  sex?: "男" | "女";
  starsInPalace: string[];      // 選択宮の星（star キー）
  isDayBirth?: boolean;
};

// 判定用の宮名正規化（JSON は変更しない）。資料の十二宮（「十二宮」節・十二宮とハウスの対応表）に「疾病宮」は無く、
// 疾病を見る宮は「疾厄宮：疾病、傷害、災難など」だけであるため、「疾病宮」は疾厄宮として判定する
const PALACE_NAME_ALIAS: Record<string, string> = { 疾病宮: "疾厄宮" };
export const normalizePalaceName = (p: string): string => PALACE_NAME_ALIAS[p] ?? p;
// palace_terms_raw が宮の範囲ではなく旺廟陥の語（例：地元「廟旺に吉」）のときは、宮の条件として扱わない（status で判定する）
const isStatusTerm = (raw: unknown, status: string[]) =>
  typeof raw === "string" && /^[旺廟陥]+$/.test(raw) && status.length > 0 && [...raw].every((ch) => status.includes(ch));

// 同宮星を「いずれか一星と同宮」で判定するルール（ユーザー確認済み）。
// 天暗「日月と同宮を忌む」＝太陽と同宮 OR 太陰と同宮。他の同宮・同躔・会舎条件は AND のまま
const WITH_STARS_ANY = new Set(["qz_cond_henyou_天暗_2"]);

/** 条件項目がすべて判定可能かつ一致した場合だけ true。判定できない項目を含むルールは false（表示しない） */
function conditionalMatches(
  c: Record<string, unknown>,
  ctx: QzMatchContext,
  subjectStar?: { motion?: string; status?: string },
  ruleId?: string
): boolean {
  const palaceIn = ((c.palace_in as string[]) ?? []).map(normalizePalaceName);
  const palaceNotIn = ((c.palace_not_in as string[]) ?? []).map(normalizePalaceName);
  const withStars = (c.with_stars as string[]) ?? [];
  const motion = (c.motion as string[]) ?? [];
  const status = (c.status as string[]) ?? [];
  const sex = (c.sex as string | null) ?? null;

  // 強宮・弱宮など範囲が資料に明記されていない（旺廟陥の語は宮の条件ではないので除く）
  if (palaceIn.length === 0 && c.palace_terms_raw && !isStatusTerm(c.palace_terms_raw, status)) return false;
  if (palaceIn.length > 0) {
    const hit = palaceIn.some((p) => p === ctx.chartPalaceName || (p === "身宮" && ctx.isShenPalace));
    if (!hit) return false;
  }
  if (palaceNotIn.length > 0 && palaceNotIn.includes(ctx.chartPalaceName)) return false;
  // 同宮星は原文に OR の明示が無いため AND（列挙した星がすべて同宮）で判定する。WITH_STARS_ANY のルールだけ OR
  if (withStars.length > 0) {
    const inPalace = (s: string) => ctx.starsInPalace.includes(s);
    const ok = ruleId && WITH_STARS_ANY.has(ruleId) ? withStars.some(inPalace) : withStars.every(inPalace);
    if (!ok) return false;
  }
  if (sex && sex !== ctx.sex) return false;
  if (motion.length > 0) {
    // 既存の順逆記号（+ / - / *）を資料の「順・逆・留」に対応づける。七政以外は判定しない
    const m = subjectStar?.motion;
    const label = m === "+" ? "順" : m === "-" ? "逆" : m === "*" ? "留" : null;
    if (!label || !motion.includes(label)) return false;
    if (status.length > 0) return false; // 「逆・留・陥」の組み合わせ方が資料上不明確なため判定しない
  } else if (status.length > 0) {
    const st = subjectStar?.status ?? "";
    if (!st || !status.includes(st)) return false;
  }
  return true;
}

/** subject（変曜名・神殺名）について、現在の盤で条件が一致した条件付きルールだけ返す */
export function matchConditionalRules(
  subjectType: "henyou" | "shensha",
  name: string,
  ctx: QzMatchContext,
  subjectStar?: { motion?: string; status?: string }
): QzRecord[] {
  return CONDITIONAL.filter(
    (r) => r.subject_type === subjectType && r.name === name && conditionalMatches(r.conditions, ctx, subjectStar, r.id)
  );
}

/** 条件付きルールの表示文（source_text は使わず、条件項目と result から組み立てる） */
const STAR_JA: Record<string, string> = {
  sun: "太陽", moon: "太陰", jupiter: "木星", mars: "火星", saturn: "土星", venus: "金星",
  mercury: "水星", ziqi: "紫炁", yuebo: "月孛", rahu: "羅喉", ketu: "計都",
};
/** 条件付きルールの条件部分と結果部分（要約の文章化用。source_text は使わない） */
export function conditionalParts(rec: QzRecord): { cond: string; result: string } {
  const s = describeConditionalRule(rec);
  const i = s.indexOf("：");
  return { cond: s.slice(0, i), result: s.slice(i + 1) };
}

export function describeConditionalRule(rec: QzRecord): string {
  const c = rec.conditions as Record<string, unknown>;
  const parts: string[] = [];
  const pin = (c.palace_in as string[]) ?? [];
  const pnot = (c.palace_not_in as string[]) ?? [];
  if (c.palace_terms_raw && !isStatusTerm(c.palace_terms_raw, (c.status as string[]) ?? [])) parts.push(`${String(c.palace_terms_raw)}にある`);
  else if (pin.length) parts.push(`${pin.join("・")}にある`);
  if (pnot.length) parts.push(`${pnot.join("・")}以外にある`);
  const ws = (c.with_stars as string[]) ?? [];
  if (ws.length) parts.push(`${ws.map((s) => STAR_JA[s] ?? s).join("・")}と同宮`);
  const mo = (c.motion as string[]) ?? [];
  if (mo.length) parts.push(mo.join("・"));
  const st = (c.status as string[]) ?? [];
  if (st.length) parts.push(st.join("・"));
  if (c.sex) parts.push(`${String(c.sex)}命`);
  const cond = parts.length ? parts.join("・") : "常に";
  return `${cond}：${rec.result ?? rec.interpretation ?? ""}`;
}

// ---------- 神殺 ----------
/** 神殺エンジンの出どころ → 資料の神殺表コード */
export type ShenshaOrigin = "year_stem" | "year_branch" | "month_branch" | "henyou2_year_branch" | "henyou2_stem_ming";
const ORIGIN_TO_TABLE: Record<ShenshaOrigin, string> = {
  year_stem: "ys_branch",          // 年干神殺 その２（十二支につく）＝ YEAR_STEM_TO_PALACE
  year_branch: "yb_palace",        // 年支神殺 その２（十二宮位につく）＝ YEAR_BRANCH_TO_PALACE
  month_branch: "mb",              // 月支神殺 ＝ MONTH_BRANCH_TO_PALACE
  henyou2_year_branch: "yb_star",  // 年支神殺 その１（星曜につく）＝ getHenyou2ByYearBranch
  henyou2_stem_ming: "ym",         // 年干命宮神殺 ＝ getHenyou2ByStemAndMing
};

export type ShenshaLookup = {
  name: string;
  origins: ShenshaOrigin[];
  /** 出どころの表で一致したレコード（確定） */
  records: QzRecord[];
  /** 出どころの表では見つからず、他の表に同名がある場合の候補（未確定） */
  candidates: QzRecord[];
  /** 「玉堂_歳合」のような連結名を資料の同一行の名称に対応させた場合の注記 */
  mappingNote?: string;
};

export function lookupShensha(name: string, origins: ShenshaOrigin[]): ShenshaLookup {
  const tables = origins.map((o) => ORIGIN_TO_TABLE[o]);
  const exact = (n: string) => SHENSHA.filter((r) => r.name === n);
  let records = exact(name).filter((r) => tables.includes(String(r.shensha_table)));
  let candidates: QzRecord[] = records.length ? [] : exact(name);
  let mappingNote: string | undefined;

  if (records.length === 0 && candidates.length === 0 && name.includes("_")) {
    // エンジン側の連結名（例：玉堂_歳合）→ 資料で同じ行に並ぶ名称のレコード
    const parts = name.split("_");
    const sameRow = SHENSHA.filter(
      (r) => tables.includes(String(r.shensha_table)) && parts.includes(r.name) &&
        parts.every((p) => (r.names_in_row ?? []).includes(p))
    );
    if (sameRow.length) {
      records = sameRow;
      mappingNote = `神殺エンジンの名称「${name}」を、資料で同じ行に並ぶ「${parts.join("・")}」に対応させて表示`;
    }
  }
  return { name, origins, records, candidates, mappingNote };
}

// ---------- 宮主・主星（宮位関係） ----------
/** 選択宮（十二支）の主星・難星・仇星・恩星・用星（資料の表） */
export function getPalaceStarRoles(branch: string): QzRecord | null {
  return PALACE_RELATIONS.find((r) => r.category === "palace_star_roles" && r.name.includes(branch)) ?? null;
}

export function getRoleGeneralRule(): QzRecord | null {
  return BY_ID.get("qz_prel_role_general") ?? null;
}

/** 星の役割（資料の表で、その星が当宮の何星にあたるか） */
export function rolesOfStar(rolesRec: QzRecord | null, star: string): string[] {
  if (!rolesRec?.roles) return [];
  return Object.entries(rolesRec.roles).filter(([, v]) => v.stars.includes(star)).map(([k]) => k);
}

export type QzRuleMatch = { rec: QzRecord; rule: QzRule; star: string };

const SUPPORTED_RULE_KEYS = new Set(["star", "stars", "palace", "palaces", "birth", "with_stars"]);

/** 「星×十二支」系ルール（例外・歩天経訣・忌断躔・四刑忌）を、判定可能な条件だけで照合 */
function matchStarBranchRules(
  rec: QzRecord,
  branch: string,
  starsInPalace: string[],
  isDayBirth: boolean | undefined,
  sectionBranches?: string[]
): QzRuleMatch[] {
  const out: QzRuleMatch[] = [];
  for (const rule of rec.rules ?? []) {
    const c = rule.condition as Record<string, unknown>;
    if (Object.keys(c).some((k) => !SUPPORTED_RULE_KEYS.has(k))) continue; // 判定できない条件を含む
    const pals: string[] = (c.palaces as string[]) ?? (c.palace ? [String(c.palace)] : sectionBranches ?? []);
    if (!pals.includes(branch)) continue;
    if (c.birth) {
      if (isDayBirth === undefined) continue;
      if ((c.birth === "day") !== isDayBirth) continue;
    }
    const withStars = (c.with_stars as string[]) ?? [];
    // 同宮星は原文に OR の明示が無いため AND（列挙した星がすべて同宮）で判定する
    if (withStars.length && !withStars.every((s) => starsInPalace.includes(s))) continue;
    const ruleStars: string[] = (c.stars as string[]) ?? (c.star ? [String(c.star)] : []);
    for (const s of ruleStars) if (starsInPalace.includes(s)) out.push({ rec, rule, star: s });
  }
  return out;
}

/** 当宮の星について一致した宮位ルール（例外①〜⑥・歩天経訣・二十四要法の忌断躔／四刑忌） */
export function matchPalaceStarRules(branch: string, starsInPalace: string[], isDayBirth?: boolean): QzRuleMatch[] {
  const out: QzRuleMatch[] = [];
  for (const r of PALACE_RELATIONS) {
    if (r.category === "palace_star_exception") out.push(...matchStarBranchRules(r, branch, starsInPalace, isDayBirth));
    if (r.category === "butian_jingjue") {
      const sec = [...r.name].filter((ch) => "子丑寅卯辰巳午未申酉戌亥".includes(ch));
      out.push(...matchStarBranchRules(r, branch, starsInPalace, isDayBirth, sec));
    }
  }
  for (const id of ["qz_m24_09", "qz_m24_16"]) {
    const r = BY_ID.get(id);
    if (r) out.push(...matchStarBranchRules(r, branch, starsInPalace, isDayBirth));
  }
  return out;
}

// ---------- 宮主ルール（専論十主・主星守宮歌） ----------
const TEN_LORD_BY_PALACE: Record<string, string[]> = {
  命宮: ["qz_lord_命主", "qz_lord_恩主", "qz_lord_難主"],
  財帛宮: ["qz_lord_財主"],
  田宅宮: ["qz_lord_田主"],
  夫妻宮: ["qz_lord_妻主"],
  男女宮: ["qz_lord_男主"],
  福徳宮: ["qz_lord_福主"],
  官禄宮: ["qz_lord_禄主"],
};

/** 選択宮を対象とする専論十主（身宮なら身主も）。条件の成否は判定しない（資料の記述として表示） */
export function getTenLordsForPalace(chartPalaceName: string, isShenPalace: boolean): QzRecord[] {
  const ids = [...(TEN_LORD_BY_PALACE[chartPalaceName] ?? []), ...(isShenPalace ? ["qz_lord_身主"] : [])];
  return ids.map((id) => BY_ID.get(id)).filter((r): r is QzRecord => !!r);
}

/**
 * 主星守宮歌：既存の宮主表で求めた命主・身主・各宮主の所在が、資料の条件（「命主身主が○宮」「○宮の主星が命宮」等）と一致した文だけ返す。
 * matched は一致した条件の説明。
 */
export function matchGuardRules(args: {
  chartPalaceName: string;
  isShenPalace: boolean;
  mingLordInThisPalace: boolean;
  shenLordInThisPalace: boolean;
  thisLordInMingPalace: boolean;
  mingLordInShenPalace: boolean;
  shenLordInMingPalace: boolean;
}): { rec: QzRecord; rule: QzRule; matched: string }[] {
  const out: { rec: QzRecord; rule: QzRule; matched: string }[] = [];
  const P = args.chartPalaceName;
  // 「吉星があっても」等の付帯（even_with）は成立条件ではないので照合対象外。それ以外の未対応キーがあれば判定しない
  const onlyKeys = (c: Record<string, unknown>, keys: string[]) =>
    Object.keys(c).every((k) => keys.includes(k) || k === "even_with");
  for (const r of LORD_RULES) {
    if (r.category !== "lord_guard_palace") continue;
    for (const rule of r.rules ?? []) {
      const c = rule.condition as Record<string, unknown>;
      if (c["命主_in"] === "身宮" && c["身主_in"] === "命宮") {
        if ((P === "命宮" || args.isShenPalace) && args.mingLordInShenPalace && args.shenLordInMingPalace) {
          out.push({ rec: r, rule, matched: "命主が身宮に、身主が命宮にある" });
        }
        continue;
      }
      if (c["命主身主_in"] === P && onlyKeys(c, ["命主身主_in"]) && (args.mingLordInThisPalace || args.shenLordInThisPalace)) {
        const who = [args.mingLordInThisPalace ? "命主" : "", args.shenLordInThisPalace ? "身主" : ""].filter(Boolean).join("・");
        out.push({ rec: r, rule, matched: `${who}が当宮（${P}）にある（資料の条件は「命主身主」）` });
      }
      if (c["命主_in"] === P && onlyKeys(c, ["命主_in"]) && args.mingLordInThisPalace) {
        out.push({ rec: r, rule, matched: `命主が当宮（${P}）にある` });
      }
      if (c[`${P}主_in`] === "命宮" && onlyKeys(c, [`${P}主_in`]) && args.thisLordInMingPalace) {
        out.push({ rec: r, rule, matched: `${P}の主星が命宮にある` });
      }
    }
  }
  return out;
}

/**
 * 専論十主の各項目の分類（本文の内容で判断。rec.id#rules の添字）
 * - A 一般原則（無条件表示してよい）：該当なし（全項目が「〜なら」の条件付き判断）
 * - B 特定条件が成立したときだけ使う個別判断（evaluateTenLord で成立したときだけ表示。判定できないものは表示しない）
 * - C 条件が曖昧（強・弱・貴格・悪い神殺・恩用・躔度経度など範囲が資料に無い）→ 表示しない
 */
export const TEN_LORD_RULE_CLASS: Readonly<Record<string, { cls: "A" | "B" | "C"; note: string }>> = {
  "qz_lord_命主#0": { cls: "C", note: "命主が強（強の範囲が未定義）" },
  "qz_lord_命主#1": { cls: "C", note: "命主が弱（弱の範囲が未定義）" },
  "qz_lord_命主#2": { cls: "C", note: "貴格を得る（貴格の範囲が未定義）" },
  "qz_lord_命主#3": { cls: "C", note: "弱 かつ 悪い神殺等（範囲が未定義）" },
  "qz_lord_身主#0": { cls: "B", note: "身主が七強宮（原詩「七強」：命・官禄・夫妻・田宅・男女・福徳・財帛）または閑宮（兄弟宮）にある" },
  "qz_lord_身主#1": { cls: "C", note: "計都月孛が来る（来るの範囲・両星か一方か不明）" },
  "qz_lord_身主#2": { cls: "C", note: "躔度経度が正しい（判定方法が未定義）" },
  "qz_lord_恩主#0": { cls: "B", note: "命宮の恩星が恩地にある" },
  "qz_lord_恩主#1": { cls: "B", note: "命宮の恩星が仇郷にある" },
  "qz_lord_恩主#2": { cls: "C", note: "福徳・官禄に悪い神殺がない かつ 行限が至る（悪い神殺の範囲が未定義）" },
  "qz_lord_難主#0": { cls: "B", note: "難星が難地 かつ 大限がその宮に至る（大限の到来は宮詳細では判定しない）" },
  "qz_lord_難主#1": { cls: "B", note: "難星が陥 かつ 用地にある" },
  "qz_lord_財主#0": { cls: "B", note: "財主が帰垣" },
  "qz_lord_財主#1": { cls: "B", note: "財主が陥 または 空（陥で判定）" },
  "qz_lord_財主#2": { cls: "C", note: "財主が恩用（恩用の定義が無い）" },
  "qz_lord_田主#0": { cls: "B", note: "田主が帰垣" },
  "qz_lord_田主#1": { cls: "B", note: "田主が空亡 または 陥（陥で判定）" },
  "qz_lord_妻主#0": { cls: "C", note: "妻主が強（強の範囲が未定義）" },
  "qz_lord_妻主#1": { cls: "B", note: "妻主が陥 または 地喪星（陥で判定）" },
  "qz_lord_男主#0": { cls: "C", note: "太陽のみ・月孛のみで金水がない（男女宮の入宮星か男主か不明）" },
  "qz_lord_男主#1": { cls: "C", note: "天狗星がある（どこにあるかが不明）" },
  "qz_lord_男主#2": { cls: "C", note: "恩地 かつ 悪い神殺がない（男主の恩地・悪い神殺の範囲が未定義）" },
  "qz_lord_禄主#0": { cls: "C", note: "恩地 かつ 天厨星（禄主の恩地・天厨の位置が未定義）" },
  "qz_lord_禄主#1": { cls: "C", note: "禄主が弱（弱の範囲が未定義）" },
};
const SEVEN_STRONG = ["命宮", "官禄宮", "夫妻宮", "田宅宮", "男女宮", "福徳宮", "財帛宮"];

/**
 * 専論十主の各ルールを、既存結果だけで判定できるものに限って評価する。
 * - 帰垣：資料の定義「その主が主星となる十二宮位に入ること」→ 既存の宮主表（palaceLordOf）で判定
 * - 陥：既存の旺廟陥（status）が「陥」
 * - 恩地・仇郷・用地：資料の定義と「十二宮位と七政四餘」の表（七政をとる）で判定
 * - 身主の七強宮・閑宮：資料の定義（七強＝命宮・官禄・夫妻・田宅・男女・福徳・財帛、閑宮＝兄弟宮）と既存の宮名で判定
 * 強・弱・空亡・貴格・悪い神殺・大限などは判定しない。
 * principles は TEN_LORD_RULE_CLASS で A（一般原則）の項目だけ（条件付き・曖昧な項目は返さない）
 */
export function evaluateTenLord(
  rec: QzRecord,
  args: {
    lordLabel: string;                         // 当該の主（例：財主＝財帛宮の宮主）
    lordBranch: string;                        // その所在の十二支
    lordStatus: string;                        // 既存の旺廟陥
    mingBranch: string;
    palaceLordOf: (branch: string) => string;  // 既存の宮主表（PALACE_MAIN_STAR）
    starBranchOf: (label: string) => string;   // 星の所在の十二支（既存結果）
    starStatusOf: (label: string) => string;   // 星の旺廟陥（既存結果）
    palaceNameOf?: (branch: string) => string; // 十二支 → 宮名（既存結果）
  }
): { matched: { rule: QzRule; reason: string }[]; principles: QzRule[] } {
  const matched: { rule: QzRule; reason: string }[] = [];
  const principles: QzRule[] = [];
  const MARK_JA: Record<string, string> = { 日: "太陽", 月: "太陰", 木: "木星", 火: "火星", 土: "土星", 金: "金星", 水: "水星" };
  const nm = (x: string | null) => (x ? MARK_JA[x] ?? x : "");
  const BR = [..."子丑寅卯辰巳午未申酉戌亥"];
  const SEVEN = "日月木火土金水";
  const sevenOf = (raw: string | undefined) => {
    const xs = [...(raw ?? "")].filter((ch) => SEVEN.includes(ch));
    return xs.length === 1 ? xs[0] : null; // 七政が一つに定まらない場合は判定しない
  };
  const roleStar = (branch: string, role: string) => sevenOf(getPalaceStarRoles(branch)?.roles?.[role]?.raw);
  const landsOf = (lord: string | null) => (lord ? BR.filter((b) => args.palaceLordOf(b) === lord) : []);

  (rec.rules ?? []).forEach((rule, idx) => {
    const c = rule.condition as Record<string, unknown>;
    const keys = Object.keys(c);
    const cls = TEN_LORD_RULE_CLASS[`${rec.id}#${idx}`]?.cls ?? "C"; // 未分類は曖昧扱い
    let reason: string | null = null;
    if (cls !== "B") {
      // A は無条件で原則として返す。C は判定・表示しない
    } else if (rec.name === "身主" && keys.length === 1 && c.palace_raw === "七宮や兄弟宮") {
      const pn = args.palaceNameOf?.(args.lordBranch) ?? "";
      if (pn && [...SEVEN_STRONG, "兄弟宮"].includes(pn)) {
        reason = `身主${nm(args.lordLabel)}が${pn}（${SEVEN_STRONG.includes(pn) ? "七強宮" : "閑宮"}）にある`;
      }
    } else if (keys.length === 1 && c.state === "帰垣") {
      if (args.palaceLordOf(args.lordBranch) === args.lordLabel) reason = `${nm(args.lordLabel)}が自らを主星とする${args.lordBranch}宮にある（帰垣）`;
    } else if (keys.length === 1 && Array.isArray(c.state) && (c.state as string[]).includes("陥")) {
      if (args.lordStatus === "陥") reason = `${nm(args.lordLabel)}が陥（資料の条件「${(c.state as string[]).join("・")}」のうち陥に該当）`;
    } else if (keys.length === 2 && c.state === "陥" && "or_with" in c) {
      if (args.lordStatus === "陥") reason = `${nm(args.lordLabel)}が陥（資料の条件は「陥、または${String(c.or_with)}」）`;
    } else if (rec.name === "恩主" && keys.length === 1 && (c.in === "恩地" || c.in === "仇郷")) {
      const en = roleStar(args.mingBranch, "恩星");
      const enLands = landsOf(en);
      if (en && enLands.length) {
        const enAt = args.starBranchOf(en);
        if (c.in === "恩地" && enLands.includes(enAt)) reason = `命宮の恩星${nm(en)}が恩地（${enLands.join("")}）の${enAt}宮にある`;
        if (c.in === "仇郷") {
          const qiu = roleStar(enLands[0], "仇星");
          const qiuLands = landsOf(qiu);
          if (qiu && qiuLands.includes(enAt)) reason = `命宮の恩星${nm(en)}が仇郷（${qiuLands.join("")}）の${enAt}宮にある`;
        }
      }
    } else if (rec.name === "難主" && c.state === "陥" && c.in === "用地") {
      const nan = roleStar(args.mingBranch, "難星");
      const yong = roleStar(args.mingBranch, "用星");
      const yongLands = landsOf(yong);
      if (nan && yong) {
        const at = args.starBranchOf(nan);
        if (args.starStatusOf(nan) === "陥" && yongLands.includes(at)) reason = `命宮の難星${nm(nan)}が陥で、用地（${yongLands.join("")}）の${at}宮にある`;
      }
    }
    if (reason) matched.push({ rule, reason });
    else if (cls === "A") principles.push(rule);
  });
  return { matched, principles };
}

// ---------- 二十四要法等（神殺名・宮で明確に判定できるもの） ----------
export type Qz24Match = { rec: QzRecord; reason: string; rule?: QzRule };

export function match24ForPalace(args: {
  chartPalaceName: string;
  isShenPalace: boolean;
  shenshaNames: string[];
}): Qz24Match[] {
  const out: Qz24Match[] = [];
  const m01 = BY_ID.get("qz_m24_01");
  if (m01 && (args.chartPalaceName === "命宮" || args.isShenPalace)) {
    out.push({ rec: m01, reason: `当宮が${args.chartPalaceName === "命宮" ? "命宮" : "身宮"}（三主に関わる宮）` });
  }
  const m07 = BY_ID.get("qz_m24_07");
  if (m07) {
    for (const rule of m07.rules ?? []) {
      const ex = ((rule.condition as Record<string, unknown>).examples as string[]) ?? [];
      const hit = ex.filter((n) => args.shenshaNames.includes(n));
      if (hit.length) out.push({ rec: m07, rule, reason: `当宮に${hit.join("・")}がある` });
    }
  }
  const m11 = BY_ID.get("qz_m24_11");
  if (m11 && args.shenshaNames.includes("歳破")) out.push({ rec: m11, rule: m11.rules?.[0], reason: "当宮に歳破がある" });
  return out;
}

export function getCombinationRule(id: string): QzRecord | null {
  return BY_ID.get(id) ?? null;
}

export const QZ_SOURCE_KIND_LABEL: Record<QzSourceKind, string> = {
  classical: "原詩（古典）",
  qizheng_secondary: "七政四餘書（資料の説明）",
  western_comparison: "西洋占星術比較",
  author_commentary: "著者見解",
  shichusuimei_comparison: "四柱推命比較",
  unspecified: "出典明記なし",
};

// =====================================================================
// 格局（現代日本語データ）— 既存格局エンジンの成立結果に、対応表（qizheng_kakkyoku_mapping_v1.json）の A・B の格局だけを接続する
// - qizheng_kakkyoku_v1_ja_v2.json（約1.4MB）はパネル表示時に動的 import する
// - C（manual_review）・D（app_only）・E（source_only）は接続しない
// - 吉凶は既存エンジンの値を使い、データ側で再判定しない
// =====================================================================
export interface QzKakkyokuRecord {
  id: string;
  name: string;
  section: string;
  entry_type: string;
  polarity: "good" | "bad" | "mixed" | null;
  app_related_name: string | null;
  match_status: string;
  display_summary: string | null;
  modern_japanese: string | null;
  conditions_modern_japanese: string | null;
}
export interface QzKakkyokuGeneralRule {
  id: string;
  rule_type: string;
  name: string;
  modern_japanese: string | null;
  applies_to_section?: string | null;
}
type MappingRow = { app_name: string; class: "A" | "B" | "M" | "C" | "D"; source_ids?: string[]; candidate_names?: string[] };

export type QzKakkyokuData = {
  connectedByAppName: Map<string, QzKakkyokuRecord[]>; // A・B・M のみ
  classByAppName: Map<string, "A" | "B" | "M" | "C" | "D">;
  generalRules: QzKakkyokuGeneralRule[];
};

let kakkyokuDataPromise: Promise<QzKakkyokuData> | null = null;

export function loadKakkyokuData(): Promise<QzKakkyokuData> {
  if (!kakkyokuDataPromise) {
    kakkyokuDataPromise = Promise.all([
      import("../../docs/qizheng-data/qizheng_kakkyoku_v1_ja_v2.json"), // 最新版（成立条件の未翻訳部分を修正したもの）
      import("../../docs/qizheng-data/qizheng_kakkyoku_mapping_v1.json"),
      import("../../docs/qizheng-data/qizheng_kakkyoku_general_rules_v1_ja.json"),
    ]).then(([kk, mp, gr]) => {
      const recs = ((kk as any).default ?? kk).records as QzKakkyokuRecord[];
      const rows = ((mp as any).default ?? mp).records as MappingRow[];
      const general = ((gr as any).default ?? gr).records as QzKakkyokuGeneralRule[];
      const byId = new Map(recs.map((r) => [r.id, r]));
      const connectedByAppName = new Map<string, QzKakkyokuRecord[]>();
      const classByAppName = new Map<string, "A" | "B" | "M" | "C" | "D">();
      for (const row of rows) {
        classByAppName.set(row.app_name, row.class);
        // A：完全一致／B：表記差のみ／M：人が確認した対応（mapping に明記されたもの）だけを接続する
        if (row.class !== "A" && row.class !== "B" && row.class !== "M") continue;
        // 対応表（mapping）を正式な接続元とし、記録された source_ids のレコードだけを取得する
        // （名称での全件検索はしない。日本語データ側の app_related_name は接続条件にしない）
        const list = (row.source_ids ?? [])
          .map((id) => byId.get(id))
          .filter((r): r is QzKakkyokuRecord => !!r);
        if (list.length) connectedByAppName.set(row.app_name, list);
      }
      return { connectedByAppName, classByAppName, generalRules: general };
    });
  }
  return kakkyokuDataPromise;
}

/** 表示用テキスト（display_summary → modern_japanese → conditions_modern_japanese。重複は出さない） */
export function kakkyokuDisplayTexts(r: QzKakkyokuRecord): { meaning: string | null; condition: string | null } {
  const norm = (s: string) => s.replace(/[。\s]/g, "");
  const ds = r.display_summary?.trim() || null;
  const mj = r.modern_japanese?.trim() || null;
  const cj = r.conditions_modern_japanese?.trim() || null;
  if (mj) {
    // display_summary と modern_japanese がほぼ同じなら短い方
    let meaning = mj;
    if (ds) {
      const a = norm(ds), b = norm(mj);
      meaning = a === b || a.includes(b) || b.includes(a) ? (ds.length <= mj.length ? ds : mj) : ds;
    }
    const condition = cj && !norm(meaning).includes(norm(cj)) ? cj : null;
    return { meaning, condition };
  }
  // 個別象意なし：成立条件を表示（意味は作らない）。成立条件もない場合は display_summary
  if (cj) return { meaning: null, condition: cj };
  return { meaning: ds, condition: null };
}

/** 格局総論：格局一般の原則と、特定格局（成立時のみ）・節の総括（成立格局の節のみ） */
const KK_GENERAL_IDS = ["kkg_012", "kkg_013", "kkg_014", "kkg_015", "kkg_016", "kkg_017", "kkg_019", "kkg_020", "kkg_022", "kkg_023", "kkg_024", "kkg_053"];
const KK_SPECIFIC_RULES: Record<string, string[]> = {
  kkg_001: ["太乙抱蟾"], kkg_002: ["木羅會舍"], kkg_003: ["火氣職權"], kkg_004: ["木孛符印"],
  kkg_009: ["羅計攔截"], kkg_010: ["羅計截斷"],
};
export function selectKakkyokuGeneralRules(data: QzKakkyokuData, connected: QzKakkyokuRecord[]): QzKakkyokuGeneralRule[] {
  if (connected.length === 0) return [];
  const names = new Set(connected.map((r) => r.name));
  const sections = new Set(connected.map((r) => r.section));
  return data.generalRules.filter((g) => {
    if (!g.modern_japanese) return false;
    if (KK_GENERAL_IDS.includes(g.id)) return true;
    if (KK_SPECIFIC_RULES[g.id]) return KK_SPECIFIC_RULES[g.id].some((n) => names.has(n));
    if (g.rule_type === "section_principle" && g.applies_to_section) return sections.has(g.applies_to_section);
    return false;
  });
}
