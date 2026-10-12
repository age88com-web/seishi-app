// src/lib/print/palacePrint.ts
//
// 命術の解釈印刷で使う「1宮分の印刷用鑑定データ」の共通型（七政四餘・紫微斗数）。
// 各術は既存の計算・象意の結果からこの形を作り、印刷専用レイアウト（components/print/PalacePrint.tsx）が並べる。
// 画面の詳細パネルの DOM は使わない。

/** 見出し付きの文章・箇条・表のまとまり */
export type PrintBlock = {
  heading?: string;
  /** 見出しに添える小さな補足（星の古名・宿など） */
  sub?: string;
  rows?: [string, string][];
  paragraphs?: { label?: string; text: string }[];
  items?: string[];
};

/** 鑑定書の節（■ 見出し） */
export type PalacePrintSection = { title: string; blocks: PrintBlock[] };

/** 1宮分の印刷用鑑定データ */
export type PalacePrintData = {
  /** 宮の見出し（例: 命宮） */
  palaceName: string;
  /** 見出しに添える支など（例: 巳） */
  titleSub?: string;
  isShenPalace: boolean;
  /** 先頭の基本情報一覧表（存在する項目だけ） */
  summaryTable: [string, string][];
  /** 空の節は入れない */
  sections: PalacePrintSection[];
};

/** 空のブロック・空の節を除く */
export function compactSections(sections: PalacePrintSection[]): PalacePrintSection[] {
  return sections
    .map((s) => ({
      ...s,
      blocks: s.blocks.filter((b) => (b.rows?.length ?? 0) + (b.paragraphs?.length ?? 0) + (b.items?.length ?? 0) > 0),
    }))
    .filter((s) => s.blocks.length > 0);
}
