// src/lib/ziwei/minorStars/master.ts
//
// 新規諸星の星マスター（既存34星は含めない。既存34星の系列メタデータは existingStars.ts）。
// canonical name は依頼の星名一覧の表記、資料側の表記は aliases に持つ。
// 星級（甲・乙・丙）は資料の各表の「星級」欄。盤面の表示階層は 乙級＝minor（雑曜）、丙級＝cycle（十二神等）。
// 将前十二神・歳前十二神は紫微諸星.pdf に象意（p.181〜182）はあるが、どの資料にも配置の表・規則がないため
// source_insufficient として登録だけし、配置しない（基礎編 S19 命盤Bの表示から規則を推測しない）。

import type { MinorStarDef, MinorStarId, SourceStatus, StarBasis, StarFamily, StarGrade } from "./types";
import { TABLE13_BOSHI_ORDER, TABLE16_CHANGSHENG_ORDER } from "./tables";

const REF_HOUR = "表9 時系諸星表（追加画像 IMG_1352）";
const REF_MONTH = "紫微諸星１ p.113 表10 月系諸星表";
const REF_DAY = "紫微諸星１ p.113 表11 日系諸星表";
const REF_STEM = "紫微諸星１ p.120 表12 年干系諸星表";
const REF_BRANCH = "紫微諸星１ p.123 表15 年支系諸星表";
const REF_BOSHI = "紫微諸星１ p.121 表13 生年博士十二星法・表14 十干所属表";
const REF_CS = "紫微諸星１ p.129 表16 五行長生十二星表";
const REF_JIE = "紫微諸星１ p.130 表17 截路空亡表";
const REF_XUN = "紫微諸星１ p.130 表18 旬中空之表（旬空）";
const REF_SHANG = "紫微諸星１ p.131 表19 天傷、天使表";
const REF_MEANING_ONLY = "紫微諸星 p.181〜182（象意のみ。配置の表・規則なし）";

function def(
  family: StarFamily,
  name: string,
  o: {
    basis: StarBasis;
    grade: StarGrade | null;
    ref: string;
    aliases?: string[];
    officialName?: string;
    cycle?: boolean;
    multi?: boolean;
    status?: SourceStatus;
    note?: string;
  },
): MinorStarDef {
  const status = o.status ?? "confirmed";
  const d: MinorStarDef = {
    id: `${family}/${name}` as MinorStarId,
    name,
    aliases: o.aliases ?? [],
    officialName: o.officialName ?? name,
    family,
    basis: o.basis,
    isMajor: false,
    isTransformation: false,
    isCycleStar: o.cycle ?? false,
    multiPalace: o.multi ?? false,
    grade: o.grade,
    tier: o.grade === "丙" || o.cycle ? "cycle" : "minor",
    sourceStatus: status,
    sourceRef: o.ref,
    implemented: status !== "source_insufficient",
  };
  if (o.note) d.note = o.note;
  return d;
}

const JIANGQIAN_NAMES: readonly [string, string[]][] = [
  ["将星", []], ["攀鞍", []], ["歳駅", []], ["息神", []], ["華蓋", []], ["劫煞", ["劫殺"]],
  ["災煞", ["災殺"]], ["天煞", ["天殺"]], ["指背", []], ["咸池", []], ["月煞", ["月殺"]], ["亡神", []],
];
const SUIQIAN_NAMES: readonly [string, string[]][] = [
  ["歳建", []], ["晦気", []], ["喪門", []], ["貫索", []], ["官符", []], ["小耗", []],
  ["大耗", []], ["龍徳", ["竜徳"]], ["白虎", []], ["天徳", []], ["弔客", []], ["病符", []],
];
const NO_RULE_NOTE = "象意（紫微諸星 p.181〜182）はあるが、配置の表・規則がどの資料にもない";

export const MINOR_STARS: readonly MinorStarDef[] = [
  // G 時系（表9）
  def("birth_hour", "台輔", { basis: "birthHourBranch", grade: "乙", ref: REF_HOUR, aliases: ["台輔星"] }),
  def("birth_hour", "封誥", { basis: "birthHourBranch", grade: "乙", ref: REF_HOUR, aliases: ["封誥星"] }),
  // E 月系（表10）
  def("birth_month", "天刑", { basis: "birthMonth", grade: "乙", ref: REF_MONTH, aliases: ["天刑星"] }),
  def("birth_month", "解神", { basis: "birthMonth", grade: "乙", ref: REF_MONTH, aliases: ["解神星"] }),
  def("birth_month", "天巫", { basis: "birthMonth", grade: "乙", ref: REF_MONTH, aliases: ["天巫星"] }),
  def("birth_month", "天月", { basis: "birthMonth", grade: "乙", ref: REF_MONTH, aliases: ["天月星"] }),
  def("birth_month", "陰煞", { basis: "birthMonth", grade: "乙", ref: REF_MONTH, aliases: ["陰殺", "陰煞星"] }),
  // F 日系（表11。前段の星の宮から陰暦生日で数える）
  def("birth_day", "三台", { basis: "birthDay+左輔", grade: "乙", ref: REF_DAY, aliases: ["三台星"] }),
  def("birth_day", "八座", { basis: "birthDay+右弼", grade: "乙", ref: REF_DAY, aliases: ["八座星"] }),
  def("birth_day", "恩光", { basis: "birthDay+文昌", grade: "乙", ref: REF_DAY, aliases: ["恩光星"] }),
  def("birth_day", "天貴", { basis: "birthDay+文曲", grade: "乙", ref: REF_DAY, aliases: ["天貴星"] }),
  // C 年干系（表12）
  def("year_stem", "天官", { basis: "birthYearStem", grade: "乙", ref: REF_STEM, aliases: ["天官星"] }),
  def("year_stem", "天福", { basis: "birthYearStem", grade: "乙", ref: REF_STEM, aliases: ["天福星"] }),
  // D 年支系（表15）
  def("year_branch", "天哭", { basis: "birthYearBranch", grade: "乙", ref: REF_BRANCH, aliases: ["天哭星"] }),
  def("year_branch", "天虚", { basis: "birthYearBranch", grade: "乙", ref: REF_BRANCH, aliases: ["天虚星"] }),
  def("year_branch", "龍池", { basis: "birthYearBranch", grade: "乙", ref: REF_BRANCH, aliases: ["竜池", "竜池星", "龍池星"] }),
  def("year_branch", "鳳閣", { basis: "birthYearBranch", grade: "乙", ref: REF_BRANCH, aliases: ["鳳閣星"] }),
  def("year_branch", "天喜", { basis: "birthYearBranch", grade: "乙", ref: REF_BRANCH, aliases: ["天喜星"] }),
  def("year_branch", "孤辰", { basis: "birthYearBranch", grade: "乙", ref: REF_BRANCH, aliases: ["孤辰星"] }),
  def("year_branch", "寡宿", { basis: "birthYearBranch", grade: "乙", ref: REF_BRANCH, aliases: ["寡宿星"] }),
  def("year_branch", "蜚廉", { basis: "birthYearBranch", grade: "乙", ref: REF_BRANCH, aliases: ["蜚廉星"] }),
  def("year_branch", "破碎", { basis: "birthYearBranch", grade: "乙", ref: REF_BRANCH, aliases: ["破砕", "破砕星"] }),
  def("year_branch", "天才", { basis: "mingPalace+birthYearBranch", grade: "乙", ref: REF_BRANCH, aliases: ["天才星"] }),
  def("year_branch", "天寿", { basis: "shenPalace+birthYearBranch", grade: "乙", ref: REF_BRANCH, aliases: ["天寿星"] }),
  // L 命宮基準（表19）
  def("ming_shen", "天傷", { basis: "mingPalace", grade: "丙", ref: REF_SHANG, aliases: ["天傷星"] }),
  def("ming_shen", "天使", { basis: "mingPalace", grade: "丙", ref: REF_SHANG, aliases: ["天使星"] }),
  // M 空亡系（表17・表18）
  def("other", "截空", {
    basis: "birthYearStem",
    grade: "丙",
    ref: REF_JIE,
    aliases: ["截路", "截路空亡"],
    officialName: "截路空亡",
    status: "source_conflict",
    note: "表17は年干ごとに1宮（甲→申）。基礎編 S19 命盤B（甲年）は申と酉の2宮に截空を表示。表17のとおり1宮に置く",
  }),
  def("other", "旬空", {
    basis: "birthYearStemBranch",
    grade: "丙",
    ref: REF_XUN,
    aliases: ["旬中空亡", "旬中空"],
    officialName: "旬中空亡",
    multi: true,
  }),
  // H 五行長生十二星（表16）
  ...TABLE16_CHANGSHENG_ORDER.map((n) => def("changsheng", n, { basis: "bureau+yinYangSex", grade: "丙", ref: REF_CS, cycle: true })),
  // I 生年博士十二星（表13）
  ...TABLE13_BOSHI_ORDER.map((n) =>
    def("boshi", n === "青竜" ? "青龍" : n, {
      basis: "禄存+yinYangSex",
      grade: "丙",
      ref: REF_BOSHI,
      cycle: true,
      aliases: n === "青竜" ? ["青竜"] : [],
    }),
  ),
  // J 将前十二神・K 歳前十二神（配置規則なし）
  ...JIANGQIAN_NAMES.map(([n, al]) =>
    def("jiangqian", n, { basis: "none", grade: null, ref: REF_MEANING_ONLY, cycle: true, aliases: al, status: "source_insufficient", note: NO_RULE_NOTE }),
  ),
  ...SUIQIAN_NAMES.map(([n, al]) =>
    def("suiqian", n, { basis: "none", grade: null, ref: REF_MEANING_ONLY, cycle: true, aliases: al, status: "source_insufficient", note: NO_RULE_NOTE }),
  ),
];

export const MINOR_STAR_BY_ID: ReadonlyMap<MinorStarId, MinorStarDef> = new Map(MINOR_STARS.map((d) => [d.id, d]));

export const IMPLEMENTED_MINOR_STARS: readonly MinorStarDef[] = MINOR_STARS.filter((d) => d.implemented);

export function minorStarDef(id: MinorStarId): MinorStarDef {
  const d = MINOR_STAR_BY_ID.get(id);
  if (!d) throw new Error(`諸星マスターにない星ID: ${id}`);
  return d;
}

/** 資料の表記（別名）→ 星ID。同名異系列（小耗・大耗・病符）は1つに決められないため複数返す */
export function findMinorStarsByName(name: string): MinorStarDef[] {
  return MINOR_STARS.filter((d) => d.name === name || d.aliases.includes(name));
}
