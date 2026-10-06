// src/lib/takujitsu/monthly/monthlySchedulePdf.ts
//
// 役割:
//   月間行動予定の PDF を作る（A4横・1週間＝1ページ・タイトル「○月の行動予定」）。
//   計算はしない。buildMonthlySchedule() の結果を monthlyDayDisplay() で文字列にし、
//   画面と同じ内容を表に描くだけ。
//
// 仕様: docs/monthly-action-schedule-pdf-spec.md §0（2026-09-27 確定・同日改定）
//   ・掲載: タイトル・日付・曜日・吉用事・凶用事（上側を大きく）、
//           吉方位・凶方位・吉凶時間（下側にコンパクトに）
//   ・非掲載: 判定不能・mixed・neutral・神殺詳細・確認用の情報・表示対象外の用事
//   ・方位と時間は画面と同じ計算結果（MonthlyDay.goodDirections・badDirections・hours）
//     をそのまま描く。PDF 専用の計算はしない。
//   ・レイアウトは元PDF（docs/source/4月行動予定.pdf）を参考にする
//     （タイトルは上部中央、見出し行はグレー地に白文字、凶用事の行は薄いグレー、
//       左端に行見出し、右に日曜〜土曜の7列、時間の行は白と薄いグレーの交互）
//
// 日本語フォント:
//   jsPDF の標準フォントは日本語を含まないため、BIZ UDPゴシック（SIL Open Font
//   License 1.1。public/fonts/）を呼び出し側から base64 で受け取り、PDF に埋め込む。
//   jsPDF は実際に使った文字だけを埋め込む（サブセット化）。OS のフォントには依存しない
//   ため、Mac 以外（VPS 等）でも同じ PDF になる。

import { jsPDF } from "jspdf";
import type { MonthlyDay, MonthlySchedule } from "./buildMonthlySchedule";
import { monthlyDayDisplay, monthlyDirectionLines } from "./monthlyDisplay";
import type { MonthlyDisplayToken } from "./monthlyDisplay";

export interface MonthlyPdfFonts {
  /** BIZUDPGothic-Regular.ttf の base64。 */
  regular: string;
  /** BIZUDPGothic-Bold.ttf の base64。 */
  bold: string;
}

const FONT = "BIZUDPGothic";
const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

// レイアウト（pt。A4横 = 842 × 595）
const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 28;
const TABLE_X = MARGIN;
const TABLE_W = PAGE_W - MARGIN * 2;
const TITLE_BASELINE = 38;
const TITLE_SIZE = 22;
const TABLE_TOP = 52;
const TABLE_BOTTOM = PAGE_H - 18;
const LABEL_COL_W = 64;
const DAY_COL_W = (TABLE_W - LABEL_COL_W) / 7;
const HEADER_ROW_H = 22;
const HEADER_SIZE = 11;
const LABEL_SIZE = 11;
const CELL_PAD = 6;
const BODY_SIZE_MAX = 10.5;
const BODY_SIZE_MIN = 7;
const LINE_RATIO = 1.5;
/** 吉用事の行に割り当てる高さの目安（上側の残りの高さに対する割合）。 */
const GOOD_ROW_SHARE = 0.58;
// 下側（方位・時間）はコンパクトに固定の高さで置く。
const SMALL_SIZE = 8;
const SMALL_LINE = 10;
const DIR_ROW_H = SMALL_LINE * 2 + 6;
const HOUR_ROW_H = 11.2;
const HOUR_SIZE = 8.5;

type Rgb = [number, number, number];
const C_TITLE: Rgb = [85, 85, 85];
const C_HEADER_BG: Rgb = [166, 166, 166];
const C_WHITE: Rgb = [255, 255, 255];
const C_LABEL_BG: Rgb = [250, 250, 250];
const C_BAD_BG: Rgb = [244, 244, 244];
const C_BORDER: Rgb = [200, 200, 200];
const C_TEXT: Rgb = [34, 34, 34];
const C_GOOD_LABEL: Rgb = [68, 68, 68];
const C_BAD_LABEL: Rgb = [208, 2, 27];
const C_MUTED: Rgb = [150, 150, 150];
const C_NANIGOTO: Rgb = [176, 42, 55];

/** ファイル名（例: monthly-action-schedule-2025-04.pdf）。 */
export function monthlySchedulePdfFileName(year: number, month: number): string {
  return `monthly-action-schedule-${year}-${String(month).padStart(2, "0")}.pdf`;
}

/** タイトル（例: 4月の行動予定）。年は入れない。月をまたぐ週のページも対象月のタイトルにする。 */
export function monthlySchedulePdfTitle(month: number): string {
  return `${month}月の行動予定`;
}

/** 日付見出し（画面と同じ。1日だけ「月/日」）。 */
function dayHeading(d: MonthlyDay): string {
  const md = d.day === 1 ? `${d.month}/${d.day}` : `${d.day}`;
  return `${md}（${WEEKDAY[d.weekday]}）`;
}

function styleOf(kind: MonthlyDisplayToken["kind"]): { bold: boolean; color: Rgb } {
  switch (kind) {
    case "nanigoto":
      return { bold: true, color: C_NANIGOTO };
    case "sonota":
      return { bold: true, color: C_TEXT };
    case "none":
    case "nanigoto-note":
      return { bold: false, color: C_MUTED };
    default:
      return { bold: false, color: C_TEXT };
  }
}

interface Segment {
  text: string;
  kind: MonthlyDisplayToken["kind"];
}
type Line = Segment[];

/**
 * セル内の折り返し。用事名は途中で切らずに行を送る（用事1件が1行より長い場合だけ
 * 文字単位で分ける）。区切りは画面と同じ「、」。
 */
function layoutCell(doc: jsPDF, tokens: MonthlyDisplayToken[], maxW: number, size: number): Line[] {
  const measure = (s: Segment) => {
    doc.setFont(FONT, styleOf(s.kind).bold ? "bold" : "normal");
    doc.setFontSize(size);
    return doc.getTextWidth(s.text);
  };
  const lines: Line[] = [];
  let cur: Line = [];
  let curW = 0;
  const push = () => {
    if (cur.length > 0) lines.push(cur);
    cur = [];
    curW = 0;
  };
  tokens.forEach((t, i) => {
    const seg: Segment = { text: i < tokens.length - 1 && t.kind === "item" ? `${t.text}、` : t.text, kind: t.kind };
    const w = measure(seg);
    if (curW + w <= maxW) {
      cur.push(seg);
      curW += w;
      return;
    }
    push();
    if (w <= maxW) {
      cur.push(seg);
      curW = w;
      return;
    }
    // 1行に収まらない長い語は文字単位で分ける。
    let buf = "";
    for (const ch of Array.from(seg.text)) {
      const next = buf + ch;
      if (measure({ text: next, kind: seg.kind }) > maxW && buf) {
        cur.push({ text: buf, kind: seg.kind });
        push();
        buf = ch;
      } else {
        buf = next;
      }
    }
    if (buf) {
      cur.push({ text: buf, kind: seg.kind });
      curW = measure({ text: buf, kind: seg.kind });
    }
  });
  push();
  return lines;
}

interface WeekLayout {
  size: number;
  lineH: number;
  goodLines: Line[][];
  badLines: Line[][];
  goodH: number;
  badH: number;
}

/** 1週分の文字サイズと行の高さを決める。はみ出す場合は文字サイズを 0.5pt ずつ下げる。 */
function layoutWeek(doc: jsPDF, week: MonthlyDay[]): WeekLayout {
  const displays = week.map(monthlyDayDisplay);
  const avail = TABLE_BOTTOM - TABLE_TOP - HEADER_ROW_H - DIR_ROW_H * 2 - HOUR_ROW_H * week[0].hours.length;
  const maxW = DAY_COL_W - CELL_PAD * 2;
  for (let size = BODY_SIZE_MAX; size >= BODY_SIZE_MIN; size -= 0.5) {
    const lineH = size * LINE_RATIO;
    const goodLines = displays.map((x) => layoutCell(doc, x.good, maxW, size));
    const badLines = displays.map((x) => layoutCell(doc, x.bad, maxW, size));
    const need = (ls: Line[][]) => Math.max(...ls.map((l) => l.length)) * lineH + CELL_PAD * 2;
    const needGood = need(goodLines);
    const needBad = need(badLines);
    if (needGood + needBad > avail) continue;
    // 上側（吉用事・凶用事）の余りを配分し、表がページの下まで届くようにする。
    let goodH = Math.max(needGood, avail * GOOD_ROW_SHARE);
    let badH = avail - goodH;
    if (badH < needBad) {
      badH = needBad;
      goodH = avail - badH;
    }
    return { size, lineH, goodLines, badLines, goodH, badH };
  }
  throw new Error("月間行動予定PDF: 用事が多すぎて1ページの表に収まりません");
}

function setFill(doc: jsPDF, c: Rgb) {
  doc.setFillColor(c[0], c[1], c[2]);
}
function setText(doc: jsPDF, c: Rgb) {
  doc.setTextColor(c[0], c[1], c[2]);
}

function drawCellLines(doc: jsPDF, lines: Line[], x: number, y: number, size: number, lineH: number) {
  lines.forEach((line, li) => {
    let cx = x + CELL_PAD;
    const baseline = y + CELL_PAD + size + li * lineH;
    for (const seg of line) {
      const st = styleOf(seg.kind);
      doc.setFont(FONT, st.bold ? "bold" : "normal");
      doc.setFontSize(size);
      setText(doc, st.color);
      doc.text(seg.text, cx, baseline);
      cx += doc.getTextWidth(seg.text);
    }
  });
}

function drawWeekPage(doc: jsPDF, week: MonthlyDay[], title: string) {
  const L = layoutWeek(doc, week);

  // タイトル（上部中央）
  doc.setFont(FONT, "bold");
  doc.setFontSize(TITLE_SIZE);
  setText(doc, C_TITLE);
  doc.text(title, PAGE_W / 2, TITLE_BASELINE, { align: "center" });

  const rowGoodY = TABLE_TOP + HEADER_ROW_H;
  const rowBadY = rowGoodY + L.goodH;
  const rowGoodDirY = rowBadY + L.badH;
  const rowBadDirY = rowGoodDirY + DIR_ROW_H;
  const hoursY = rowBadDirY + DIR_ROW_H;
  const hourCount = week[0].hours.length;
  const tableBottom = hoursY + HOUR_ROW_H * hourCount;
  const colX = (i: number) => TABLE_X + LABEL_COL_W + DAY_COL_W * i;
  const labelCenter = TABLE_X + LABEL_COL_W / 2;

  // 背景
  setFill(doc, C_HEADER_BG);
  doc.rect(TABLE_X, TABLE_TOP, TABLE_W, HEADER_ROW_H, "F");
  setFill(doc, C_LABEL_BG);
  doc.rect(TABLE_X, rowGoodY, LABEL_COL_W, L.goodH, "F");
  setFill(doc, C_BAD_BG);
  doc.rect(TABLE_X, rowBadY, TABLE_W, L.badH, "F");
  setFill(doc, C_LABEL_BG);
  doc.rect(TABLE_X, rowGoodDirY, LABEL_COL_W, DIR_ROW_H * 2, "F");
  for (let h = 0; h < hourCount; h++) {
    if (h % 2 === 1) {
      setFill(doc, C_BAD_BG);
      doc.rect(TABLE_X, hoursY + HOUR_ROW_H * h, TABLE_W, HOUR_ROW_H, "F");
    }
  }

  // 見出し行: 左端「日付」、各列「30（日）」
  doc.setFont(FONT, "bold");
  doc.setFontSize(HEADER_SIZE);
  setText(doc, C_WHITE);
  const headerBaseline = TABLE_TOP + HEADER_ROW_H / 2 + HEADER_SIZE * 0.35;
  doc.text("日付", labelCenter, headerBaseline, { align: "center" });
  week.forEach((d, i) => {
    doc.text(dayHeading(d), colX(i) + DAY_COL_W / 2, headerBaseline, { align: "center" });
  });

  // 行見出し（上側）
  doc.setFontSize(LABEL_SIZE);
  setText(doc, C_GOOD_LABEL);
  doc.text("吉用事", labelCenter, rowGoodY + CELL_PAD + LABEL_SIZE, { align: "center" });
  setText(doc, C_BAD_LABEL);
  doc.text("凶用事", labelCenter, rowBadY + CELL_PAD + LABEL_SIZE, { align: "center" });

  // 本文（上側）
  week.forEach((_, i) => {
    drawCellLines(doc, L.goodLines[i], colX(i), rowGoodY, L.size, L.lineH);
    drawCellLines(doc, L.badLines[i], colX(i), rowBadY, L.size, L.lineH);
  });

  // 方位（下側）: 「喜神：東北」「財神：北東」／「太歳遊方：西」「五鬼：南東」
  const dirBaseline = (rowY: number, li: number) => rowY + 3 + SMALL_SIZE + li * SMALL_LINE;
  doc.setFont(FONT, "bold");
  doc.setFontSize(SMALL_SIZE + 1);
  setText(doc, C_GOOD_LABEL);
  doc.text("吉方位", labelCenter, rowGoodDirY + DIR_ROW_H / 2 + 3, { align: "center" });
  setText(doc, C_BAD_LABEL);
  doc.text("凶方位", labelCenter, rowBadDirY + DIR_ROW_H / 2 + 3, { align: "center" });
  doc.setFont(FONT, "normal");
  doc.setFontSize(SMALL_SIZE);
  week.forEach((d, i) => {
    monthlyDirectionLines(d.goodDirections).forEach((t, li) => {
      setText(doc, C_TEXT);
      doc.text(t, colX(i) + CELL_PAD, dirBaseline(rowGoodDirY, li));
    });
    d.badDirections.forEach((x, li) => {
      setText(doc, x.direction ? C_TEXT : C_MUTED);
      doc.text(monthlyDirectionLines([x])[0], colX(i) + CELL_PAD, dirBaseline(rowBadDirY, li));
    });
  });

  // 吉凶時間（下側）: 左端に時刻、各日に記号（◎○△▽▼、勿用は「用いてもよい」）
  const hourBaseline = (h: number) => hoursY + HOUR_ROW_H * h + HOUR_ROW_H / 2 + HOUR_SIZE * 0.35;
  week[0].hours.forEach((cell, h) => {
    doc.setFont(FONT, "normal");
    doc.setFontSize(SMALL_SIZE);
    setText(doc, C_MUTED);
    doc.text(cell.label, TABLE_X + LABEL_COL_W - CELL_PAD, hourBaseline(h), { align: "right" });
  });
  doc.setFontSize(HOUR_SIZE);
  setText(doc, C_TEXT);
  week.forEach((d, i) => {
    d.hours.forEach((cell, h) => {
      doc.setFontSize(cell.isMuyo ? SMALL_SIZE : HOUR_SIZE);
      doc.text(cell.symbol, colX(i) + DAY_COL_W / 2, hourBaseline(h), { align: "center" });
    });
  });

  // 罫線
  doc.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2]);
  doc.setLineWidth(0.6);
  doc.rect(TABLE_X, TABLE_TOP, TABLE_W, tableBottom - TABLE_TOP, "S");
  for (const y of [rowGoodY, rowBadY, rowGoodDirY, rowBadDirY, hoursY]) doc.line(TABLE_X, y, TABLE_X + TABLE_W, y);
  doc.setLineWidth(0.3);
  for (let h = 1; h < hourCount; h++) {
    doc.line(TABLE_X, hoursY + HOUR_ROW_H * h, TABLE_X + TABLE_W, hoursY + HOUR_ROW_H * h);
  }
  doc.setLineWidth(0.6);
  for (let i = 0; i < 7; i++) doc.line(colX(i), TABLE_TOP, colX(i), tableBottom);
}

/**
 * 月間行動予定の PDF を作る。対象月の全週（4〜6週）を、1週1ページで出力する。
 */
export function createMonthlySchedulePdf(schedule: MonthlySchedule, fonts: MonthlyPdfFonts): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
  doc.addFileToVFS("BIZUDPGothic-Regular.ttf", fonts.regular);
  doc.addFont("BIZUDPGothic-Regular.ttf", FONT, "normal");
  doc.addFileToVFS("BIZUDPGothic-Bold.ttf", fonts.bold);
  doc.addFont("BIZUDPGothic-Bold.ttf", FONT, "bold");

  const title = monthlySchedulePdfTitle(schedule.month);
  doc.setProperties({ title });
  schedule.weeks.forEach((week, i) => {
    if (i > 0) doc.addPage("a4", "landscape");
    drawWeekPage(doc, week, title);
  });
  return doc;
}
