// src/lib/qimen/stemAccess.ts
//
// 役割:
//   奇門遁甲の「中宮寄宮」を、格局判定などから参照するための共通データと参照関数。
//   (1) 中五宮の干がどの宮へ寄宮するか（寄宮情報）を、排盤結果から導くだけで求める。
//   (2) 宮ごとの干を「通常干」と「寄宮干」に区別して取り出す関数を、判定方針
//       （StemPolicy）付きで提供する。
//   天盤・地盤の配置計算（dipan.ts / tianpan.ts / jiuxing.ts）は一切変更しない。
//   既存の diPanStem / tianPanStem は上書きせず、寄宮干は別の項目として持つ。
//
// 仕様の出典（一次資料）:
//   ・docs/source/奇門遁甲講義案N.pdf p.10「中五は無位で坤二に奇宮する」
//   ・同 p.22「天盤の例外」: 六儀が中宮に来る場合、坤に中宮の地盤干を寄せる。
//     例1（己巳 陰五局）の完成図では坤二宮の地盤を「辛(戊)」と併記する。
//   ・同 p.24「中宮の天禽は坤に寄宮し天芮と同宮し芮禽と表記する」
//   ・同 p.27「旬首が中宮に配置される場合、定位の中宮である天禽星を直符とする」
//   ・docs/source/1080.pdf: 芮禽の同居宮に、天芮の天盤干と天禽の天盤干（＝中五宮の干）を
//     併記する（例: 陽遁三局丙戌時の坎一宮「庚 禽／乙 芮」）。
//     tests/fixtures/qimen1080.json は天禽側の干を tianpan["5"] に転記しており、
//     tianpan.ts の result[5]（中宮の地盤干を据え置いたもの）と全1080局で一致する。
//
// 適用範囲:
//   Phase 1: 寄宮情報と参照関数を追加。既定の方針 CURRENT_POLICY は、Phase 1 時点の
//     格局判定と同じ動作（通常干のみ・中五宮も判定・寄宮干を使わない）。
//   Phase 2（2026-10-15）: 吉格・凶格の宮走査（jikaku.ts / kyokaku.ts の scan）に
//     KAKU_SCAN_POLICY（中五宮を判定しない・通常干のみ）を適用。寄宮干はまだ使わない。
//   Phase 3A（2026-10-16）: 凶格の基本6格局（青龍逃走・白虎猖狂・朱雀投江・騰蛇夭矯・
//     熒入太白・太白入熒）に限り、BASIC_PAIR_POLICY で寄宮干を含めて天盤干×地盤干を判定する
//     （寄宮干どうしの自己組み合わせは除外・中五宮は判定しない）。他の格局は KAKU_SCAN_POLICY のまま。
//   Phase 3B（2026-10-16）: 刑格にも BASIC_PAIR_POLICY を適用。
//   Phase 3C（2026-10-16）: 上格・奇格・戦格にも BASIC_PAIR_POLICY を適用。
//   Phase 3D（2026-10-16）: 吉格の三奇得使・三奇升殿（jikaku.ts）にも BASIC_PAIR_POLICY を適用。
//   Phase 3E（2026-10-16）: 吉格の五遁（天遁・地遁・人遁・神遁・鬼遁）・三詐（真詐・重詐・休詐）にも適用。
//   Phase 3F（2026-10-16）: 吉格の四遁（風遁・雲遁・龍遁・虎遁）・五假（天假・地假・人假・神假・鬼假）にも適用。
//   Phase 3G（2026-10-16）: 青龍返首・飛鳥跌穴・玉女守門に XUNSHOU_ROLE_POLICY を適用（役割を天盤・地盤で区別）。
//   Phase 3I（2026-10-16）: 凶格の乙奇入墓・丙奇入墓・丁奇入墓・三奇受刑・六儀撃刑に、BASIC_PAIR_POLICY の
//     天盤側（芮禽同居宮の天盤寄宮干）を適用。地盤干を条件に含まないため地盤寄宮干は参照しない。
//   Phase 3J-2（2026-10-16）: 凶格の大格（天盤庚×地盤癸に訂正）に BASIC_PAIR_POLICY、
//     伏宮格天乙格（天盤庚×地盤の旬首六儀）に FUGONG_POLICY、飛宮格天乙太白（天盤の旬首六儀×地盤庚）に
//     XUNSHOU_ROLE_POLICY を適用。寄宮干どうしの組み合わせを認めるのは伏宮格だけ（FUGONG_POLICY）。

import type { DiPanResult, DiPanStem } from "./dipan";
import type { TianPanResult } from "./tianpan";
import type { JiuXingResult } from "./jiuxing";
import type { PalaceSummary } from "./qimenEngine";

/** 中五宮の宮番号。 */
export const CENTER_PALACE = 5;
/** 地盤の寄宮先（坤二宮）。 */
export const DIPAN_LODGING_PALACE = 2;

/** 寄宮干の種類。 */
export type LodgingKind =
  /** 地盤: 中五宮の地盤干を坤二宮へ寄せる（講義案 p.10・p.22）。 */
  | "地盤中五寄坤"
  /** 天盤: 天禽が帯同する中五宮の干を、天禽・天芮の同居宮に置く（講義案 p.24・1080.pdf）。 */
  | "天盤天禽帯同";

/** 宮に付く寄宮干（元の干とは別に持つ）。 */
export interface LodgedStem {
  /** 寄宮した干（中五宮の干）。 */
  stem: DiPanStem;
  /** 寄宮元の宮。常に中五宮。 */
  fromPalace: typeof CENTER_PALACE;
  kind: LodgingKind;
}

/** 盤全体の寄宮情報。 */
export interface CenterLodging {
  /** 地盤: 中五宮の地盤干と、寄宮先（坤二宮）。 */
  diPan: { stem: DiPanStem; fromPalace: typeof CENTER_PALACE; toPalace: typeof DIPAN_LODGING_PALACE };
  /**
   * 天盤: 中五宮の天盤干（天禽が帯同する干）と、寄宮先（天禽・天芮が同居する宮）。
   * 天盤・九星のどちらかが未算出なら null。
   */
  tianPan: { stem: DiPanStem; fromPalace: typeof CENTER_PALACE; toPalace: number } | null;
}

/**
 * 排盤結果から寄宮情報を求める（配置計算はしない。既存の結果を読むだけ）。
 *   ・地盤: diPan[5] を坤二宮へ。
 *   ・天盤: tianPan[5]（＝中宮の地盤干。天禽が帯同する干）を、九星で天禽が置かれた宮へ。
 */
export function resolveCenterLodging(input: {
  diPan: DiPanResult;
  tianPan: TianPanResult | null;
  jiuXing: JiuXingResult | null;
}): CenterLodging {
  const { diPan, tianPan, jiuXing } = input;
  let tian: CenterLodging["tianPan"] = null;
  if (tianPan && jiuXing && tianPan[CENTER_PALACE] !== undefined) {
    const qinPalace = Object.keys(jiuXing.jiuXing)
      .map(Number)
      .find((p) => p !== CENTER_PALACE && jiuXing.jiuXing[p].includes("天禽"));
    if (qinPalace !== undefined) {
      tian = { stem: tianPan[CENTER_PALACE], fromPalace: CENTER_PALACE, toPalace: qinPalace };
    }
  }
  return {
    diPan: { stem: diPan[CENTER_PALACE], fromPalace: CENTER_PALACE, toPalace: DIPAN_LODGING_PALACE },
    tianPan: tian,
  };
}

/** 寄宮情報から、宮 palace に付く地盤・天盤の寄宮干を返す（無ければ undefined）。 */
export function lodgedStemsAt(
  lodging: CenterLodging,
  palace: number,
): { diPanLodged?: LodgedStem; tianPanLodged?: LodgedStem } {
  const out: { diPanLodged?: LodgedStem; tianPanLodged?: LodgedStem } = {};
  if (palace === lodging.diPan.toPalace) {
    out.diPanLodged = { stem: lodging.diPan.stem, fromPalace: CENTER_PALACE, kind: "地盤中五寄坤" };
  }
  if (lodging.tianPan && palace === lodging.tianPan.toPalace) {
    out.tianPanLodged = { stem: lodging.tianPan.stem, fromPalace: CENTER_PALACE, kind: "天盤天禽帯同" };
  }
  return out;
}

// ---- 判定方針と参照関数 ------------------------------------------------------

/** 干の由来。native＝その宮の本来の干、lodged＝中五宮から寄宮した干。 */
export type StemOrigin = "native" | "lodged";

export interface StemEntry {
  stem: DiPanStem;
  origin: StemOrigin;
}

export interface StemPolicy {
  /** 天盤: 通常干のみ／寄宮干を含む。 */
  tianPan: "native" | "withLodged";
  /** 地盤: 通常干のみ／寄宮干を含む。 */
  diPan: "native" | "withLodged";
  /** 中五宮そのものを成立宮として判定するか。 */
  centerPalace: "judge" | "skip";
  /** 天盤寄宮干と地盤寄宮干（どちらも中五宮の干）の自己組み合わせを許すか。 */
  lodgedSelfPair: "allow" | "deny";
  /**
   * 値符・旬首六儀の「役割」として寄宮干を使うか（roleStems で参照）。
   * boolean は天盤・地盤共通。層ごとに分ける場合は { tianPan, diPan } で指定する（Phase 3G）。
   */
  roleUsesLodged: boolean | Readonly<{ tianPan: boolean; diPan: boolean }>;
}

/** 現在の格局判定と同じ動作（通常干のみ・中五宮も判定・寄宮干を使わない）。 */
export const CURRENT_POLICY: Readonly<StemPolicy> = Object.freeze({
  tianPan: "native",
  diPan: "native",
  centerPalace: "judge",
  lodgedSelfPair: "deny",
  roleUsesLodged: false,
});

/** 既定値 CURRENT_POLICY に、指定した項目だけを上書きした方針を作る。 */
export function makeStemPolicy(overrides: Partial<StemPolicy> = {}): StemPolicy {
  return { ...CURRENT_POLICY, ...overrides };
}

/**
 * 吉格（jikaku.ts）・凶格（kyokaku.ts）の宮走査で使う方針（Phase 2・2026-10-15）。
 * 講義案 p.10「中五は無位で坤二に寄宮する」により、中五宮を独立した成立宮にしない。
 * 干は通常干のみ（寄宮干はまだ格局判定に使わない）。
 */
export const KAKU_SCAN_POLICY: Readonly<StemPolicy> = Object.freeze(
  makeStemPolicy({ centerPalace: "skip" }),
);

/**
 * 凶格の基本6格局（Phase 3A）・刑格（Phase 3B）・上格・奇格・戦格（Phase 3C）・三奇入墓・三奇受刑・六儀撃刑（Phase 3I。天盤側のみ）・大格（Phase 3J-2）、吉格の三奇得使・三奇升殿（Phase 3D）・五遁・三詐（Phase 3E）・四遁・五假（Phase 3F）で使う方針（天盤干×地盤干の組み合わせだけで成立する格。2026-10-16）。
 *   判定する組み合わせ: 通常天盤干×通常地盤干／通常天盤干×地盤寄宮干／天盤寄宮干×通常地盤干。
 *   天盤寄宮干×地盤寄宮干（どちらも中五宮の干）は除外。中五宮は成立宮にしない。
 */
export const BASIC_PAIR_POLICY: Readonly<StemPolicy> = Object.freeze(
  makeStemPolicy({ tianPan: "withLodged", diPan: "withLodged", centerPalace: "skip", lodgedSelfPair: "deny" }),
);

/**
 * 旬首六儀を役割に使う吉格（青龍返首・飛鳥跌穴・玉女守門）の方針（Phase 3G・2026-10-16）。
 * 凶格の飛宮格天乙太白（Phase 3J-2）にも使う。
 * 干は BASIC_PAIR_POLICY と同じく寄宮干を含めるが、役割は層ごとに分ける。
 *   ・天盤の旬首六儀: 寄宮干（天禽が帯同する中五宮の干）を使わない。
 *     1080.pdf は旬首六儀が中五宮の盤で青龍返首を付けず、講義案にも天盤側の根拠が無い。
 *   ・地盤の旬首六儀: 坤二宮の寄宮干を使う（講義案 p.22 の坤二宮「辛(戊)」）。
 */
export const XUNSHOU_ROLE_POLICY: Readonly<StemPolicy> = Object.freeze(
  makeStemPolicy({
    tianPan: "withLodged",
    diPan: "withLodged",
    centerPalace: "skip",
    lodgedSelfPair: "deny",
    roleUsesLodged: Object.freeze({ tianPan: false, diPan: true }),
  }),
);

/**
 * 凶格の伏宮格天乙格（天盤庚×地盤の旬首六儀）専用の方針（Phase 3J-2・2026-10-16）。
 * XUNSHOU_ROLE_POLICY と同じく天盤庚は芮禽同居宮の寄宮干を、地盤の旬首六儀は坤二宮の寄宮干を含める。
 * 1080.pdf は旬首が甲申で庚が中五宮にある盤の坤二宮（天盤寄宮の庚×地盤寄宮の庚）にも伏宮格を付けるため、
 * この格に限り寄宮干どうしの組み合わせを認める（lodgedSelfPair: allow）。他の格局には使わない。
 */
export const FUGONG_POLICY: Readonly<StemPolicy> = Object.freeze(
  makeStemPolicy({
    tianPan: "withLodged",
    diPan: "withLodged",
    centerPalace: "skip",
    lodgedSelfPair: "allow",
    roleUsesLodged: Object.freeze({ tianPan: false, diPan: true }),
  }),
);

/** 宮の天盤干（通常干＋方針に応じて寄宮干）。 */
export function tianPanStems(
  p: PalaceSummary | undefined,
  policy: StemPolicy = CURRENT_POLICY,
): StemEntry[] {
  if (!p) return [];
  const out: StemEntry[] = [];
  if (p.tianPanStem !== undefined) out.push({ stem: p.tianPanStem, origin: "native" });
  if (policy.tianPan === "withLodged" && p.tianPanLodged) {
    out.push({ stem: p.tianPanLodged.stem, origin: "lodged" });
  }
  return out;
}

/** 宮の地盤干（通常干＋方針に応じて寄宮干）。 */
export function diPanStems(
  p: PalaceSummary | undefined,
  policy: StemPolicy = CURRENT_POLICY,
): StemEntry[] {
  if (!p) return [];
  const out: StemEntry[] = [];
  if (p.diPanStem !== undefined) out.push({ stem: p.diPanStem, origin: "native" });
  if (policy.diPan === "withLodged" && p.diPanLodged) {
    out.push({ stem: p.diPanLodged.stem, origin: "lodged" });
  }
  return out;
}

/**
 * 値符・旬首六儀の「役割」で見る天盤干／地盤干。
 * roleUsesLodged が false（その層について false）なら通常干のみ（天盤・地盤の方針が withLodged でも
 * 寄宮干を使わない）。
 */
export function roleStems(
  p: PalaceSummary | undefined,
  layer: "tianPan" | "diPan",
  policy: StemPolicy = CURRENT_POLICY,
): StemEntry[] {
  const r = policy.roleUsesLodged;
  const uses = typeof r === "boolean" ? r : r[layer];
  const effective = uses ? policy : { ...policy, [layer]: "native" as const };
  return layer === "tianPan" ? tianPanStems(p, effective) : diPanStems(p, effective);
}

/** 判定対象の宮（centerPalace が skip なら中五宮を除く）。 */
export function judgedPalaces(policy: StemPolicy = CURRENT_POLICY): number[] {
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  return policy.centerPalace === "skip" ? all.filter((p) => p !== CENTER_PALACE) : all;
}

/** 天盤干と地盤干の組み合わせ。 */
export interface StemPair {
  tian: StemEntry;
  di: StemEntry;
}

/**
 * 宮の天盤干×地盤干の組み合わせのうち、条件を満たすものを返す。
 * 寄宮干どうしの組み合わせは lodgedSelfPair が deny なら除く。
 */
export function stemPairs(
  p: PalaceSummary | undefined,
  match: (tian: DiPanStem, di: DiPanStem) => boolean,
  policy: StemPolicy = CURRENT_POLICY,
): StemPair[] {
  const out: StemPair[] = [];
  for (const tian of tianPanStems(p, policy)) {
    for (const di of diPanStems(p, policy)) {
      if (policy.lodgedSelfPair === "deny" && tian.origin === "lodged" && di.origin === "lodged") continue;
      if (match(tian.stem, di.stem)) out.push({ tian, di });
    }
  }
  return out;
}

/** 方針に従って判定対象の宮を走査し、pred を満たす宮番号を昇順で返す。 */
export function scanPalaces(
  palaces: Record<number, PalaceSummary>,
  pred: (p: PalaceSummary | undefined, palace: number) => boolean,
  policy: StemPolicy = CURRENT_POLICY,
): number[] {
  return judgedPalaces(policy).filter((palace) => pred(palaces[palace], palace));
}
