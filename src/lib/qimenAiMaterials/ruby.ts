// src/lib/qimenAiMaterials/ruby.ts
//
// 役割:
//   剋應本文（剋應.pdf 由来）に独立した行として混入しているルビ（ふりがな）を、
//   AI 入力を作るときだけ取り除く。元データ（kokuo/data/*.json）は変更しない。
//
// ルビと判定する行（すべてを満たすものだけ）:
//   1. 行がひらがな（U+3041〜U+309F）と空白だけで構成され、ひらがなを1字以上含む
//      （漢字・カタカナ・句読点・記号・数字を1字でも含む行は本文として残す）
//   2. 空行を飛ばして最も近い上の行または下の行に漢字がある
//      （ルビは読みを振る漢字の行に隣接して抽出されている）
//   判定できない行は削除しない。本文行の中の空白（ルビが占めていた位置の空き）や
//   改行位置は変更せず、前後の行の結合もしない。
//
// 確認済みの事実（2026-09-29 時点の剋應データ）:
//   本文中の「ひらがなと空白だけの行」は 368 行で、カタカナ等を含むものは無く、
//   すべて隣接する漢字の読み（例: にっきふくぎん・あんぶんしゅき）だった。

const HIRAGANA_ONLY_LINE = /^[\sぁ-ゟ]+$/;
const HAS_HIRAGANA = /[ぁ-ゟ]/;
const HAS_KANJI = /[㐀-䶿一-鿿豈-﫿]/;

function nearestNonEmpty(lines: string[], from: number, step: 1 | -1): string | undefined {
  for (let i = from + step; i >= 0 && i < lines.length; i += step) {
    if (lines[i].trim() !== "") return lines[i];
  }
  return undefined;
}

export interface RubyStripResult {
  /** ルビ行を除いた本文 */
  text: string;
  /** 除去した行（元の文字列のまま・出現順） */
  removedLines: string[];
}

/** 本文からルビ行だけを取り除く。 */
export function stripRubyLines(text: string): RubyStripResult {
  const lines = text.split("\n");
  const kept: string[] = [];
  const removedLines: string[] = [];
  lines.forEach((line, i) => {
    const isRuby =
      HAS_HIRAGANA.test(line) &&
      HIRAGANA_ONLY_LINE.test(line) &&
      [nearestNonEmpty(lines, i, -1), nearestNonEmpty(lines, i, 1)].some(
        (l) => l !== undefined && HAS_KANJI.test(l),
      );
    if (isRuby) removedLines.push(line);
    else kept.push(line);
  });
  return { text: kept.join("\n"), removedLines };
}
