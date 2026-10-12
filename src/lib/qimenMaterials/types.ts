// src/lib/qimenMaterials/types.ts
//
// 役割:
//   一宮分の判断材料（buildQimenPalaceMaterials の戻り値）の型定義。
//   値はすべて既存の排盤結果・象意DB・剋應DBから取得したもので、
//   要約・再解釈・新規計算した値は含まない。

import type { QimenResult, KokuoEntry, KokuoCategory } from "@/lib/qimen";

/** 判断材料の出典。AI へ渡した後でも由来を追跡できるようにする。 */
export interface MaterialSource {
  /** データ種別（例: 八門象意・十干剋應・凶格判定） */
  dataset: string;
  /** 取得元ファイル（プロジェクト内パス） */
  file: string;
  /** 既存データが持つ出典資料名（原文のまま。無ければ省略） */
  document?: string;
  /** 既存データが持つ出典箇所（ページ・スライド等。原文のまま。無ければ省略） */
  location?: string;
}

/** 宮に配置された要素1件の単体象意。 */
export interface ElementMaterial {
  role: "八門" | "九星" | "八神" | "天盤干" | "地盤干";
  /** 排盤結果に入っている名称（そのまま） */
  name: string;
  items: ElementMaterialItem[];
}

export interface ElementMaterialItem {
  /** 何のデータか（例: 基本象意・旺衰表・宮位吉凶） */
  kind: string;
  /** 既存データの値（そのまま） */
  data: unknown;
  source: MaterialSource;
  /** 取得上の注意（選択していない・判定していない等） */
  note?: string;
}

/** 剋應1件。既存の KokuoEntry に、剋應データ(JSON)の同一レコードの未公開項目を添える。 */
export interface KokuoMaterial {
  entry: KokuoEntry;
  /** 同じ id の元データから、指定した項目だけを値のまま写したもの。 */
  raw: Record<string, unknown>;
  source: MaterialSource;
}

/** 八門剋應の門ごとの共通注記（hachimon.json の gate_notes 1件をそのまま）。 */
export interface GateNoteMaterial {
  gate: string;
  static_intro_raw: string;
  dynamic_intro_raw: string;
  dynamic_tail_note_raw: string;
  source: MaterialSource;
  note: string;
}

/** 九星値時剋應の星別総論（kyusei_jichi.json の context_blocks 1件をそのまま）。 */
export interface KyuseiContextMaterial {
  sourceTradition: string;
  heading: string;
  body: string;
  source: MaterialSource;
}

export type KakuScope = "palace" | "whole_chart" | "scope判定不能";

/** 成立済みの吉格・凶格1件。 */
export interface KakuMaterial {
  category: "吉格" | "凶格";
  name: string;
  scope: KakuScope;
  /** 判定結果の palaces（そのまま） */
  palaces: number[];
  /** 判定結果の detail（凶格のみ・あれば） */
  detail?: string;
  /** 判定コードが持つ象意文（jikaku.ts / kyokaku.ts の meaning・原文のまま） */
  judgeMeaning: string;
  /** 象意DB（qimenMeaning/data.ts）の同名格局の象意。無ければ null */
  meaningDb: string[] | null;
  sources: MaterialSource[];
}

/** 伏吟／反吟の資料由来吉凶文（fuYinFanYinMeaning.ts）の紐付け結果。 */
export interface FuYinFanYinMaterial {
  kind: "伏吟" | "反吟";
  /** 紐付けの元になった凶格（伏吟格／反吟格）と、その detail */
  judgeName: string;
  judgeDetail: string;
  /** 紐付けた下位分類（図版の分類名・説明文をそのまま） */
  linkedSubtypes: { name: string; description: string[] }[];
  /** 紐付けなかった下位分類とその理由 */
  unlinkedSubtypes: { name: string; reason: string }[];
  /** 図版の吉凶欄（紐付けた下位分類が1つ以上あるときだけ入る。無ければ null） */
  fortuneHeading: string | null;
  fortuneText: string[] | null;
  source: MaterialSource;
}

/** 意図的に取得しなかった項目と理由。 */
export interface OmittedMaterial {
  item: string;
  reason: string;
}

export interface QimenPalaceMaterials {
  palace: {
    number: number;
    isCenter: boolean;
    /** PALACE_TRIGRAM（src/lib/qimen/kyokaku.ts）の値。中宮は null */
    trigram: string | null;
    /** 剋應検索（resolveKokuoForPalace）が使った地盤八門（NATAL_GATE）。得られない場合は null */
    natalGate: string | null;
  };
  /** result.palaces[n] そのまま */
  facts: QimenResult["palaces"][number];
  chart: {
    calendar: {
      solarTerm: string;
      yearStem: string; yearBranch: string;
      monthStem: string; monthBranch: string;
      dayStem: string; dayBranch: string;
      hourStem: string; hourBranch: string;
    };
    dingju: QimenResult["dingju"];
    xunShou: QimenResult["xunShou"];
    /** 値符（九星）。未算出なら null */
    zhifuStar: NonNullable<QimenResult["jiuXing"]>["zhifu"] | null;
    /** 値使（八門）。未算出なら null */
    zhishi: NonNullable<QimenResult["baMen"]>["zhishi"] | null;
    /** 直符（八神）。未算出なら null */
    zhifuGod: NonNullable<QimenResult["baShen"]>["zhifu"] | null;
    errors: {
      tianPan: string | null;
      jiuXing: string | null;
      baMen: string | null;
      baShen: string | null;
    };
    kakuUnavailable: { jikaku: string[]; kyokaku: string[] };
  };
  elements: ElementMaterial[];
  kokuo: {
    jikkan: KokuoMaterial[];
    hachimonGate: KokuoMaterial[];
    hachimonWonder: KokuoMaterial[];
    sankiTokyu: KokuoMaterial[];
    kyuseiJichi: KokuoMaterial[];
    notFound: KokuoCategory[];
    gateNotes: GateNoteMaterial[];
    kyuseiContext: KyuseiContextMaterial[];
  };
  kaku: KakuMaterial[];
  fuYinFanYin: FuYinFanYinMaterial[];
  omitted: OmittedMaterial[];
}
