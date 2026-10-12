// src/lib/qimenAiMaterials/displayText.ts
//
// 役割:
//   PDF 抽出で語の途中に入った改行（例:「大きく発展す\nる」「わきま\nえて」）だけを、
//   表示用文字列でつなげる。原文（raw）は変更せず、表示用（display）を別に返す。
//   ルビ除去（ruby.ts）とは別の処理で、入力はルビ除去後の本文を想定する。
//
// つなげる改行（すべて満たす場合だけ。何も挟まずに連結する）:
//   1. 直前の行が全角換算 34 字以上（PDF の1行の幅いっぱい。ASCII は 0.5 字と数える）
//   2. 直前の行（末尾の空白を除く）が文末記号 。 」 』 ） ) ！ ？ ! ? で終わらない
//   3. 次の行が空行でなく、字下げ（半角・全角の空白）や「※」で始まらない
//   上以外の改行（段落の字下げ・句点で終わる行のあと・※注記・空行・幅いっぱいでない行）は残す。
//
// 根拠（2026-09-29 時点の剋應データ全件の改行の分類）:
//   直前の行の幅は 34〜36 字に集中し、条件 1〜3 をすべて満たす改行は語の途中の折り返しだった。

/** PDF の1行の幅とみなす全角換算の最小字数。 */
export const PDF_FULL_LINE_WIDTH = 34;

const SENTENCE_END = /[。」』）)！？!?]$/;
const NEXT_LINE_KEEP = /^[\s　※]/;

function lineWidth(line: string): number {
  let w = 0;
  for (const ch of line) w += (ch.codePointAt(0) ?? 0) < 0x7f ? 0.5 : 1;
  return w;
}

export interface DisplayText {
  /** 原文（入力そのまま） */
  raw: string;
  /** 表示用（語中の改行だけをつないだもの） */
  display: string;
  /** つないだ改行の数 */
  joinedLineBreaks: number;
}

/** 語の途中に入った PDF 由来の改行だけをつないだ表示用文字列を作る。 */
export function toDisplayText(raw: string): DisplayText {
  const lines = raw.split("\n");
  let display = lines[0] ?? "";
  let joined = 0;
  for (let i = 1; i < lines.length; i += 1) {
    const prev = lines[i - 1];
    const next = lines[i];
    const prevTrim = prev.replace(/\s+$/, "");
    const isWrap =
      prevTrim !== "" &&
      next !== "" &&
      lineWidth(prev) >= PDF_FULL_LINE_WIDTH &&
      !SENTENCE_END.test(prevTrim) &&
      !NEXT_LINE_KEEP.test(next);
    if (isWrap) joined += 1;
    display += (isWrap ? "" : "\n") + next;
  }
  return { raw, display, joinedLineBreaks: joined };
}
