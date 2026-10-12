// src/lib/qimenMaterials/palaceMaterials.ts
//
// 役割:
//   排盤済みの QimenResult と宮番号から、その宮について既存データに登録済みの
//   判断材料（盤の事実・単体象意・剋應・格局・伏吟反吟の吉凶文）を集めるだけの層。
//   要約・再解釈・新しい判定ルールは持たない。
//
// 独立性・変更禁止事項の遵守:
//   排盤（qimenEngine.ts）・格局判定（jikaku.ts / kyokaku.ts）・剋應（qimen/kokuo/）・
//   象意DB（qimenMeaning/）は呼び出す／読むだけで、一切変更しない。
//   剋應は resolveKokuoForPalace() の結果をそのまま使い、同じ id の元データ(JSON)から
//   公開型 KokuoEntry に載っていない項目を値のまま写すだけ（検索し直さない）。
//
// 取得しないもの（omitted に理由を載せる）:
//   ・方位・宮名ラベル … src/app/qimen/page.tsx（UI）の内部定数にしか存在しない。
//   ・八門の旺衰／九星の旺相休囚死の「現在の段階」 … 選択ロジックが未確定。表のみ渡す。
//   ・十干剋應の一覧表(summary_tables_raw) … 1つの長文で、組合せ単位の切り出しに
//     本文の解析が必要なため。
//   ・直符伏吟／直符反吟への図版吉凶文の紐付け … 図版の定義と判定コードの定義が異なる。
//
// 伏吟・反吟の紐付け方針:
//   凶格「伏吟格」「反吟格」の detail に入る下位分類のうち、判定コードの成立条件が
//   図版（docs/source/反吟伏吟.png）の説明を満たすことが条件の文言から直接言えるものだけ
//   紐付ける。
//     ・九星伏吟: 判定は「外周8宮すべてに定位の九星がある」。図版は「天盤の九星が
//       定位となる。つまり地盤定位の九星と重なる」。判定成立 ⇒ 図版の状態。
//     ・八門伏吟: 判定は「外周8宮すべてに定位の八門がある」。図版は「人盤の八門が
//       定位となる」。判定成立 ⇒ 図版の状態。
//     ・九星反吟: 判定は「外周8宮すべてに対宮の定位の九星がある」。図版は「地盤定位の
//       九星と天盤の九星が相対する」。判定成立 ⇒ 図版の状態。
//     ・八門反吟: 判定は「外周8宮すべてに対宮の定位の八門がある」。図版は「地盤定位の
//       八門と人盤の八門が対宮」。判定成立 ⇒ 図版の状態。
//     ・直符伏吟／直符反吟: 判定は八神「直符」の位置、図版は「地盤と天盤の奇子」の
//       関係で、判定成立から図版の状態は導けないため紐付けない。

import { resolveKokuoForPalace, PALACE_TRIGRAM } from "@/lib/qimen";
import type { QimenResult, KokuoEntry, KokuoResult } from "@/lib/qimen";
import {
  lookupMeaning,
  lookupBaMenMeaning,
  BAMEN_WANGSHUAI,
  BAMEN_WANGSHUAI_STAGES,
  BAMEN_WANGSHUAI_SOURCE_PAGE,
  SOLAR_SEGMENTS,
  lookupJiuXingMeaning,
  lookupJiuXingWangShuai,
  JIUXING_WANGSHUAI_SOURCE_PAGE,
  JIUXING_WANGSHUAI_EFFECT,
  lookupBaShenMeaning,
  lookupBaShenPalaceFortune,
  BASHEN_PALACE_FORTUNE_SOURCE_PAGE,
  lookupSanQiLiuYiMeaning,
  lookupFuYinFanYinMeaning,
  FUYIN_FANYIN_SOURCE_DOCUMENT,
} from "@/lib/qimenMeaning";

import jikkanFile from "@/lib/qimen/kokuo/data/jikkan.json";
import hachimonFile from "@/lib/qimen/kokuo/data/hachimon.json";
import kyuseiFile from "@/lib/qimen/kokuo/data/kyusei_jichi.json";
import sankiFile from "@/lib/qimen/kokuo/data/sanki_tokyu.json";

import type {
  ElementMaterial,
  FuYinFanYinMaterial,
  GateNoteMaterial,
  KakuMaterial,
  KokuoMaterial,
  KyuseiContextMaterial,
  MaterialSource,
  OmittedMaterial,
  QimenPalaceMaterials,
} from "./types";

// ---- 出典ファイル --------------------------------------------------------

const LECTURE_PDF = "docs/source/奇門遁甲講義案N.pdf";
const F = {
  baMen: "src/lib/qimenMeaning/baMenMeaning.ts",
  jiuXing: "src/lib/qimenMeaning/jiuXingMeaning.ts",
  baShen: "src/lib/qimenMeaning/baShenMeaning.ts",
  sanQiLiuYi: "src/lib/qimenMeaning/sanQiLiuYiMeaning.ts",
  kakuMeaning: "src/lib/qimenMeaning/data.ts",
  fuYinFanYin: "src/lib/qimenMeaning/fuYinFanYinMeaning.ts",
  jikaku: "src/lib/qimen/jikaku.ts",
  kyokaku: "src/lib/qimen/kyokaku.ts",
  kokuo: {
    jikkan: "src/lib/qimen/kokuo/data/jikkan.json",
    hachimon: "src/lib/qimen/kokuo/data/hachimon.json",
    kyusei: "src/lib/qimen/kokuo/data/kyusei_jichi.json",
    sanki: "src/lib/qimen/kokuo/data/sanki_tokyu.json",
  },
} as const;

// ---- 剋應の元データ（読むだけ） ---------------------------------------------

type RawRecord = Record<string, unknown> & { id: string };

const RAW_BY_ID = new Map<string, RawRecord>(
  [
    ...(jikkanFile as { entries: RawRecord[] }).entries,
    ...(hachimonFile as { entries: RawRecord[] }).entries,
    ...(kyuseiFile as { entries: RawRecord[] }).entries,
    ...(sankiFile as { entries: RawRecord[] }).entries,
  ].map((e) => [e.id, e]),
);

/** 系統ごとに、KokuoEntry に載っていない元データの項目名。 */
const RAW_FIELDS: Record<KokuoEntry["category"], readonly string[]> = {
  jikkan: ["fortune_raw", "fortune_label"],
  hachimon_gate: ["distances", "fortune_mentions"],
  hachimon_wonder: ["distances", "fortune_mentions"],
  kyusei_jichi: [
    "heading_raw", "source_group_id", "shared_heading",
    "fortune_mentions", "application_mentions", "five_tone_mentions",
  ],
  sanki_tokyu: [
    "heading_raw", "name_raw", "fortune_raw", "fortune_code", "omen_body",
    "result_body", "time_expressions", "direction_mentions", "five_tone_mentions", "notes_raw",
  ],
};

const KOKUO_DATASET: Record<KokuoEntry["category"], { dataset: string; file: string }> = {
  jikkan: { dataset: "十干剋應", file: F.kokuo.jikkan },
  hachimon_gate: { dataset: "八門剋應（門×門）", file: F.kokuo.hachimon },
  hachimon_wonder: { dataset: "八門剋應（門×三奇）", file: F.kokuo.hachimon },
  sanki_tokyu: { dataset: "三奇到宮剋應", file: F.kokuo.sanki },
  kyusei_jichi: { dataset: "九星値時剋應", file: F.kokuo.kyusei },
};

interface RawGateNote {
  gate: string;
  static_intro_raw: string;
  dynamic_intro_raw: string;
  dynamic_tail_note_raw: string;
}
const GATE_NOTES = (hachimonFile as unknown as { gate_notes: RawGateNote[] }).gate_notes;

interface RawContextBlock { heading: string; body: string }
const KYUSEI_CONTEXT = (kyuseiFile as unknown as {
  context_blocks: Record<string, RawContextBlock[]>;
}).context_blocks;
/** 星別の総論を持つ典拠（遁甲演義系の context_blocks は本文が見出しのみのため対象外）。 */
const KYUSEI_CONTEXT_TRADITION = "kimon_tonkou_hiketsu_taizen";

function kokuoMaterial(entry: KokuoEntry): KokuoMaterial {
  const rec = RAW_BY_ID.get(entry.id);
  const raw: Record<string, unknown> = {};
  if (rec) {
    for (const f of RAW_FIELDS[entry.category]) {
      if (f in rec) raw[f] = rec[f];
    }
  }
  const ds = KOKUO_DATASET[entry.category];
  return {
    entry,
    raw,
    source: {
      dataset: ds.dataset,
      file: ds.file,
      document: entry.source.document,
      location: entry.source.printedPages,
    },
  };
}

/**
 * 九星値時剋應の星別総論（秘笈大全系）。見出しは「n.天蓬星」形式。
 * 星名の別表記（例: 天衝＝天沖）は、同じ典拠・同じ値符星の剋應レコードの
 * heading_raw に「天衝（天沖）星が…」とデータ自身が併記しているものだけを使う。
 */
function kyuseiContext(entries: KokuoEntry[], star: string): KyuseiContextMaterial[] {
  const names = new Set<string>([star]);
  for (const e of entries) {
    if (e.sourceTradition !== KYUSEI_CONTEXT_TRADITION) continue;
    const heading = RAW_BY_ID.get(e.id)?.heading_raw;
    if (typeof heading !== "string") continue;
    const m = heading.match(/^(.+?)（(.+?)）星/);
    if (m && m[2] === star) names.add(m[1]);
  }
  const blocks = KYUSEI_CONTEXT[KYUSEI_CONTEXT_TRADITION] ?? [];
  return blocks
    .filter((b) => {
      const bare = b.heading.replace(/^\d+\./, "").replace(/星$/, "");
      return names.has(bare);
    })
    .map((b) => ({
      sourceTradition: KYUSEI_CONTEXT_TRADITION,
      heading: b.heading,
      body: b.body,
      source: {
        dataset: "九星値時剋應（星別総論）",
        file: F.kokuo.kyusei,
        document: "剋應.pdf",
      },
    }));
}

// ---- 単体象意 --------------------------------------------------------------

function lecture(dataset: string, file: string, page: number | string): MaterialSource {
  return { dataset, file, document: LECTURE_PDF, location: `p.${page}` };
}

function baMenElement(door: string): ElementMaterial {
  const m = lookupBaMenMeaning(door);
  // 旺衰表（p.37）は「門」を付けない一字で値を持つ（UI の読み替えと同じ）。
  const bare = door.endsWith("門") ? door.slice(0, -1) : door;
  const table = SOLAR_SEGMENTS.map((segment) => ({
    segment,
    stage: BAMEN_WANGSHUAI_STAGES.find((st) => BAMEN_WANGSHUAI[st][segment] === bare) ?? null,
  }));
  return {
    role: "八門",
    name: door,
    items: [
      ...(m ? [{ kind: "基本象意", data: m, source: lecture("八門象意", F.baMen, m.sourcePage) }] : []),
      {
        kind: "旺衰表",
        data: table,
        source: lecture("八門旺衰", F.baMen, BAMEN_WANGSHUAI_SOURCE_PAGE),
        note: "節気区分ごとの段階を表から読んだもの。現在の節気区分は選択していない。",
      },
    ],
  };
}

function jiuXingElement(star: string): ElementMaterial {
  const m = lookupJiuXingMeaning(star);
  const w = lookupJiuXingWangShuai(star);
  return {
    role: "九星",
    name: star,
    items: [
      ...(m ? [{ kind: "基本象意", data: m, source: lecture("九星象意", F.jiuXing, m.sourcePage) }] : []),
      ...(w
        ? [{
            kind: "旺相休囚死表",
            data: w,
            source: lecture("九星旺衰", F.jiuXing, JIUXING_WANGSHUAI_SOURCE_PAGE),
            note: "表の当該星の行。現在の段階は判定していない。",
          }]
        : []),
      {
        kind: "旺相休囚死の凡例",
        data: JIUXING_WANGSHUAI_EFFECT,
        source: lecture("九星旺衰", F.jiuXing, JIUXING_WANGSHUAI_SOURCE_PAGE),
        note: "凡例の全体。この星の吉星／凶星の別は選択していない。",
      },
    ],
  };
}

function baShenElement(god: string, palace: number): ElementMaterial {
  const m = lookupBaShenMeaning(god);
  const fortune = lookupBaShenPalaceFortune(god, palace);
  return {
    role: "八神",
    name: god,
    items: [
      ...(m ? [{ kind: "基本象意", data: m, source: lecture("八神象意", F.baShen, m.sourcePage) }] : []),
      ...(fortune !== undefined
        ? [{
            kind: "宮位吉凶",
            data: { palace, fortune },
            source: lecture("八神宮位吉凶", F.baShen, BASHEN_PALACE_FORTUNE_SOURCE_PAGE),
          }]
        : []),
    ],
  };
}

function stemElement(role: "天盤干" | "地盤干", stem: string): ElementMaterial {
  const m = lookupSanQiLiuYiMeaning(stem);
  return {
    role,
    name: stem,
    items: m
      ? [{ kind: "三奇六儀象意", data: m, source: lecture("三奇六儀象意", F.sanQiLiuYi, m.sourcePage) }]
      : [],
  };
}

// ---- 格局 ------------------------------------------------------------------

function kakuSources(category: "吉格" | "凶格", source: string, hasMeaningDb: boolean): MaterialSource[] {
  const judge: MaterialSource = {
    dataset: category === "吉格" ? "吉格判定" : "凶格判定",
    file: category === "吉格" ? F.jikaku : F.kyokaku,
    document: LECTURE_PDF,
    location: source,
  };
  if (!hasMeaningDb) return [judge];
  return [
    judge,
    {
      dataset: "格局象意",
      file: F.kakuMeaning,
      document: LECTURE_PDF,
      location: category === "吉格" ? "p.47-51" : "p.52-61",
    },
  ];
}

function collectKaku(result: QimenResult, palace: number): KakuMaterial[] {
  const out: KakuMaterial[] = [];
  // 吉格: JikakuMatch.palaces が空になる場合の意味は既存コードに定義が無い。
  for (const m of result.jikaku.matches) {
    const scope = m.palaces.length === 0 ? "scope判定不能" : "palace";
    if (scope === "palace" && !m.palaces.includes(palace)) continue;
    const db = lookupMeaning(m.name) ?? null;
    out.push({
      category: "吉格",
      name: m.name,
      scope,
      palaces: m.palaces,
      judgeMeaning: m.meaning,
      meaningDb: db,
      sources: kakuSources("吉格", m.source, db !== null),
    });
  }
  // 凶格: KyokakuMatch.palaces は「盤全体で成立する格は空配列」と定義されている。
  for (const m of result.kyokaku.matches) {
    const scope = m.palaces.length === 0 ? "whole_chart" : "palace";
    if (scope === "palace" && !m.palaces.includes(palace)) continue;
    const db = lookupMeaning(m.name) ?? null;
    out.push({
      category: "凶格",
      name: m.name,
      scope,
      palaces: m.palaces,
      ...(m.detail !== undefined ? { detail: m.detail } : {}),
      judgeMeaning: m.meaning,
      meaningDb: db,
      sources: kakuSources("凶格", m.source, db !== null),
    });
  }
  return out;
}

// ---- 伏吟・反吟 --------------------------------------------------------------

const FUYIN_JUDGE: Record<string, "伏吟" | "反吟"> = { 伏吟格: "伏吟", 反吟格: "反吟" };
/** 判定成立 ⇒ 図版の状態 が条件の文言から言える下位分類（冒頭コメント参照）。 */
const LINKABLE_SUBTYPES = new Set(["九星伏吟", "八門伏吟", "九星反吟", "八門反吟"]);
const UNLINKED_REASON: Record<string, string> = {
  直符伏吟:
    "判定コードは八神「直符」が定位にあることで判定し、図版は「地盤と天盤の奇子が同じになること」と定義しており、判定成立から図版の状態を導けないため紐付けない。",
  直符反吟:
    "判定コードは八神「直符」が定位の対宮にあることで判定し、図版は「地盤上の奇子と天盤上の奇子が対宮する」と定義しており、判定成立から図版の状態を導けないため紐付けない。",
};

function collectFuYinFanYin(result: QimenResult): FuYinFanYinMaterial[] {
  const out: FuYinFanYinMaterial[] = [];
  for (const m of result.kyokaku.matches) {
    const kind = FUYIN_JUDGE[m.name];
    if (!kind || m.palaces.length !== 0 || !m.detail) continue;
    const entry = lookupFuYinFanYinMeaning(kind);
    if (!entry) continue;
    const linked: { name: string; description: string[] }[] = [];
    const unlinked: { name: string; reason: string }[] = [];
    for (const name of m.detail.split("・")) {
      const sub = entry.subtypes.find((s) => s.name === name);
      if (sub && LINKABLE_SUBTYPES.has(name)) {
        linked.push({ name: sub.name, description: sub.description });
      } else {
        unlinked.push({
          name,
          reason: UNLINKED_REASON[name] ?? "図版に同名の下位分類が無い、または紐付け対象として確認していないため紐付けない。",
        });
      }
    }
    out.push({
      kind,
      judgeName: m.name,
      judgeDetail: m.detail,
      linkedSubtypes: linked,
      unlinkedSubtypes: unlinked,
      fortuneHeading: linked.length > 0 ? entry.fortuneHeading : null,
      fortuneText: linked.length > 0 ? entry.fortuneText : null,
      source: {
        dataset: "伏吟・反吟の分類と吉凶文",
        file: F.fuYinFanYin,
        document: FUYIN_FANYIN_SOURCE_DOCUMENT,
      },
    });
  }
  return out;
}

// ---- 本体 ------------------------------------------------------------------

/**
 * 排盤済みの QimenResult と宮番号(1〜9)から、その宮の判断材料を集める。
 * QimenResult は読むだけ。値は既存データのまま返す。
 */
export function buildQimenPalaceMaterials(result: QimenResult, palace: number): QimenPalaceMaterials {
  if (!Number.isInteger(palace) || palace < 1 || palace > 9) {
    throw new Error(`宮番号は1〜9で指定してください: ${palace}`);
  }
  const p = result.palaces[palace] ?? { jiuXing: [], baMen: [], baShen: [] };
  const isCenter = palace === 5;
  const omitted: OmittedMaterial[] = [
    { item: "方位", reason: "src/app/qimen/page.tsx（UI）の内部定数 DIRECTION にしか存在しないため取得しない。" },
    { item: "宮名ラベル（例: 坎一宮）", reason: "src/app/qimen/page.tsx（UI）の内部定数 PALACE_LABEL にしか存在しないため取得しない。" },
    { item: "八門の旺衰・九星の旺相休囚死の現在の段階", reason: "段階を選ぶロジックが未確定のため、表のみ渡し段階は選択しない。" },
    { item: "十干剋應の一覧表（summary_tables_raw）", reason: "1つの長文で、組合せ単位に切り出すには本文の解析が必要なため取得しない。" },
  ];

  // 剋應（既存検索の結果そのまま。中宮は既存仕様で全て空）
  const kokuo: KokuoResult = resolveKokuoForPalace(result, palace);
  const natalGate = kokuo.hachimonGate[0]?.key.counterpart ?? null;
  if (!isCenter && natalGate === null) {
    omitted.push({ item: "地盤八門（NATAL_GATE）", reason: "八門剋應（門×門）が得られず、剋應検索が使った地盤八門を確認できないため。" });
  }

  const humanGate = p.baMen[0];
  const gateNotes: GateNoteMaterial[] =
    kokuo.hachimonGate.length + kokuo.hachimonWonder.length > 0 && humanGate
      ? GATE_NOTES.filter((g) => g.gate === humanGate).map((g) => ({
          ...g,
          source: { dataset: "八門剋應（門ごとの共通注記）", file: F.kokuo.hachimon, document: "剋應.pdf" },
          note: "占身命（本命による判断）と年月日時の条件は原文のまま。本命・年月日時との照合はしていない。",
        }))
      : [];

  const chiefStar = result.jiuXing?.zhifu.star;
  const kyuseiContextList =
    kokuo.kyuseiJichi.length > 0 && chiefStar ? kyuseiContext(kokuo.kyuseiJichi, chiefStar) : [];
  if (!isCenter && kokuo.kyuseiJichi.length === 0) {
    omitted.push({ item: "九星値時剋應・星別総論", reason: "この宮に値符星が無い（既存の検索条件を満たさない）ため取得しない。" });
  }

  // 単体象意（その宮に配置されている要素だけ）
  const elements: ElementMaterial[] = [
    ...p.baMen.map((d) => baMenElement(d)),
    ...p.jiuXing.map((s) => jiuXingElement(s)),
    ...p.baShen.map((g) => baShenElement(g, palace)),
    ...(p.tianPanStem ? [stemElement("天盤干", p.tianPanStem)] : []),
    ...(p.diPanStem ? [stemElement("地盤干", p.diPanStem)] : []),
  ];

  const fuYinFanYin = collectFuYinFanYin(result);
  for (const f of fuYinFanYin) {
    for (const u of f.unlinkedSubtypes) {
      omitted.push({ item: `${f.kind}の吉凶文（${u.name}）`, reason: u.reason });
    }
  }

  const c = result.calendar;
  return {
    palace: {
      number: palace,
      isCenter,
      trigram: PALACE_TRIGRAM[palace] ?? null,
      natalGate,
    },
    facts: p,
    chart: {
      calendar: {
        solarTerm: c.solarTerm,
        yearStem: c.yearStem, yearBranch: c.yearBranch,
        monthStem: c.monthStem, monthBranch: c.monthBranch,
        dayStem: c.dayStem, dayBranch: c.dayBranch,
        hourStem: c.hourStem, hourBranch: c.hourBranch,
      },
      dingju: result.dingju,
      xunShou: result.xunShou,
      zhifuStar: result.jiuXing?.zhifu ?? null,
      zhishi: result.baMen?.zhishi ?? null,
      zhifuGod: result.baShen?.zhifu ?? null,
      errors: {
        tianPan: result.tianPanError,
        jiuXing: result.jiuXingError,
        baMen: result.baMenError,
        baShen: result.baShenError,
      },
      kakuUnavailable: {
        jikaku: [...result.jikaku.unavailable],
        kyokaku: [...result.kyokaku.unavailable],
      },
    },
    elements,
    kokuo: {
      jikkan: kokuo.jikkan.map(kokuoMaterial),
      hachimonGate: kokuo.hachimonGate.map(kokuoMaterial),
      hachimonWonder: kokuo.hachimonWonder.map(kokuoMaterial),
      sankiTokyu: kokuo.sankiTokyu.map(kokuoMaterial),
      kyuseiJichi: kokuo.kyuseiJichi.map(kokuoMaterial),
      notFound: kokuo.notFound,
      gateNotes,
      kyuseiContext: kyuseiContextList,
    },
    kaku: collectKaku(result, palace),
    fuYinFanYin,
    omitted,
  };
}
