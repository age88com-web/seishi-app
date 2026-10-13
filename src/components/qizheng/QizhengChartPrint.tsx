"use client";

// src/components/qizheng/QizhengChartPrint.tsx
//
// 七政四餘の「盤を印刷」（A4縦1枚）。基本情報（2行）・星盤・変曜・星一覧表・格局一覧（名前だけ）を出す。
// 解釈・詳細説明の文章は出さない。星盤は画面と同じ ChartSVG を、宮クリック機能なしで描く（盤の内容は変えない）。
//
// ChartSVG は円盤の右に変曜・星一覧表を並べた横長の1枚（viewBox 1540×980）で、A4縦の幅に合わせると円盤が小さくなる。
// そこで印刷用には、画面外に描いた ChartSVG を複製して「円盤」「変曜」「星一覧表」の3つの表示に分け、
// それぞれの viewBox を描かれた範囲に合わせる。円盤は紙面の幅いっぱい、変曜・星一覧表は円盤と同じ縮尺で円盤の下に置く。
// 複製は表示だけで、ChartSVG の計算・描画内容には触れない（元の ChartSVG が描き直されたら複製し直す）。

import dynamic from "next/dynamic";
import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { PrintSheet, type PrintHeaderInfo } from "@/components/print/PrintRoot";
import "./qizheng-print.css";

const ChartSVG = dynamic(() => import("@/components/ChartSVG"), { ssr: false });

export type QizhengChartProps = Omit<ComponentProps<typeof import("@/components/ChartSVG").default>, "palaceDetail" | "interpretationOnly">;

/** 円盤の印刷幅（mm）。変曜・星一覧表はこれと同じ縮尺（mm／SVG単位）で描く */
const CHART_WIDTH_MM = 174;
/** 切り出し範囲の余白（SVG単位） */
const PAD = 4;

type Box = { x: number; y: number; w: number; h: number };

/** 要素の描かれた範囲を、SVG の座標（viewBox の単位）で返す */
function boxOf(svg: SVGSVGElement, el: Element): Box | null {
  const ctm = svg.getScreenCTM();
  const r = el.getBoundingClientRect();
  if (!ctm || (r.width === 0 && r.height === 0)) return null;
  const inv = ctm.inverse();
  const a = new DOMPoint(r.left, r.top).matrixTransform(inv);
  const b = new DOMPoint(r.right, r.bottom).matrixTransform(inv);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

function union(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** svg を複製し、keep(子の番号) が真の直下の子だけを残して、viewBox を box に合わせる */
function cropClone(svg: SVGSVGElement, keep: (i: number) => boolean, box: Box, widthMm: number): SVGSVGElement {
  const c = svg.cloneNode(true) as SVGSVGElement;
  Array.from(c.children).forEach((ch, i) => {
    if (!keep(i)) ch.remove();
  });
  c.setAttribute("viewBox", `${box.x - PAD} ${box.y - PAD} ${box.w + PAD * 2} ${box.h + PAD * 2}`);
  c.removeAttribute("width");
  c.removeAttribute("height");
  c.style.width = `${widthMm}mm`;
  c.style.height = "auto";
  c.style.display = "block";
  return c;
}

/** 直下の <g> のうち、直下の <text> が test に合うもの（変曜・星一覧表の見出しで探す） */
function findGroup(svg: SVGSVGElement, test: (t: string) => boolean): number {
  return Array.from(svg.children).findIndex(
    (ch) => ch.tagName.toLowerCase() === "g" && Array.from(ch.children).some((t) => t.tagName.toLowerCase() === "text" && test((t.textContent ?? "").trim())),
  );
}

export default function QizhengChartPrint({
  info,
  extra,
  chart,
  good,
  bad,
}: {
  info: PrintHeaderInfo;
  /** 盤の理解に最低限必要な付随情報（昼夜・命宮方式・命宮・身宮・命度） */
  extra: [string, string][];
  chart: QizhengChartProps;
  /** 格局一覧（名前だけ。画面の格局一覧と同じもの） */
  good: string[];
  bad: string[];
}) {
  const srcRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const henyouRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const src = srcRef.current;
    if (!src) return;
    const rebuild = () => {
      const svg = src.querySelector("svg");
      const slots = [mainRef.current, henyouRef.current, tableRef.current];
      slots.forEach((s) => s?.replaceChildren());
      if (!svg || slots.some((s) => !s)) return;
      const kids = Array.from(svg.children);
      const iHenyou = findGroup(svg, (t) => t === "変曜");
      const iTable = findGroup(svg, (t) => t.startsWith("星名"));
      const isSide = (i: number) => i === iHenyou || i === iTable;
      const mainBox = union(kids.flatMap((k, i) => (isSide(i) ? [] : [boxOf(svg, k)].filter((b): b is Box => !!b))));
      if (!mainBox) return;
      const k = CHART_WIDTH_MM / (mainBox.w + PAD * 2); // mm／SVG単位
      slots[0]!.append(cropClone(svg, (i) => !isSide(i), mainBox, CHART_WIDTH_MM));
      [
        [iHenyou, slots[1]!],
        [iTable, slots[2]!],
      ].forEach(([i, slot]) => {
        const idx = i as number;
        const box = idx >= 0 ? boxOf(svg, kids[idx]) : null;
        if (box) (slot as HTMLDivElement).append(cropClone(svg, (j) => j === idx, box, (box.w + PAD * 2) * k));
      });
    };
    rebuild();
    const mo = new MutationObserver(rebuild);
    mo.observe(src, { subtree: true, childList: true, attributes: true, characterData: true });
    return () => mo.disconnect();
  }, []);

  const head: [string, string][] = [
    ["生年月日", info.birthDate],
    ["出生時刻", info.birthTime],
    ["性別", info.sex],
    ["出生地", info.place || "—"],
  ];
  const item = ([k, v]: [string, string]) => (
    <span key={k}>
      <span className="print-key">{k}</span>
      {v}
    </span>
  );

  return (
    <PrintSheet className="qz-chart-sheet">
      <header className="qzc-head">
        <div className="qzc-line1">
          {/* タイトルは「七政四餘」だけ（氏名はタイトル横に出さない） */}
          <span className="qzc-title">七政四餘</span>
          {head.map(item)}
        </div>
        <div className="qzc-line2">{extra.map(item)}</div>
      </header>
      {/* 複製元（画面外・不可視）。印刷には出さない */}
      <div ref={srcRef} className="qzc-src">
        <ChartSVG {...chart} />
      </div>
      <div ref={mainRef} className="qzc-main" />
      <div className="qzc-sub">
        <div ref={henyouRef} className="qzc-henyou" />
        <div ref={tableRef} className="qzc-table" />
      </div>
      <div className="qzc-kk">
        <div>
          <span className="print-key">吉格</span>
          {good.length > 0 ? good.join("、") : "なし"}
        </div>
        <div>
          <span className="print-key">凶格</span>
          {bad.length > 0 ? bad.join("、") : "なし"}
        </div>
      </div>
    </PrintSheet>
  );
}
