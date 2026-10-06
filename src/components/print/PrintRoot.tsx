"use client";

// src/components/print/PrintRoot.tsx
//
// 命術（七政四餘・紫微斗数・四柱推命）の印刷専用レイアウトの共通部品。
//   - 印刷物は画面のDOMとは別に、document.body 直下へポータルで置く（.print-root）。
//   - 印刷の種類は2つだけ：kind="chart"（盤・命式。A4縦1枚）／kind="interpretation"（文章。複数ページ可）。
//   - どちらを印刷するかは <html data-print-mode> で決める（usePrintMode().print(mode)）。
//     ボタン以外（Cmd+P など）から印刷した場合は "chart" を印刷する。
//   - 通常画面では印刷用DOMを見せない（print.css 参照。CSS は利用する各ページで import する）。
//   - 用紙（@page）は印刷の種類ごと。PrintRoot の page（既定は A4縦・余白 15/22/18/22mm）を、印刷する直前に
//     1つの <style> へ書き込む（盤だけA4横、などを他の種類・他の術に影響させずに切り替える）。

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export type PrintMode = "chart" | "interpretation";

const ATTR = "printMode";
const DEFAULT_PAGE = "size: A4 portrait; margin: 15mm 22mm 18mm 22mm;";
const STYLE_ID = "print-root-page";
/** 表示中の PrintRoot が登録した、印刷の種類ごとの @page の中身 */
const pageByKind = new Map<PrintMode, string>();

/** 印刷する種類の @page を有効にする（body の末尾に置き、各ページの print.css の @page より優先させる） */
function applyPage(mode: PrintMode) {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
  }
  document.body.appendChild(el);
  el.textContent = `@page { ${pageByKind.get(mode) ?? DEFAULT_PAGE} }`;
}

/**
 * 印刷ボタン用。mode を決めてから window.print() する。
 * defaultMode はボタン以外（Cmd+P など）から印刷したときの種類（省略時は "chart"＝従来どおり）。
 */
export function usePrintMode(defaultMode: PrintMode = "chart"): (mode: PrintMode) => void {
  useEffect(() => {
    const html = document.documentElement;
    const before = () => {
      if (!html.dataset[ATTR]) html.dataset[ATTR] = defaultMode;
      applyPage(html.dataset[ATTR] as PrintMode);
    };
    const after = () => {
      delete html.dataset[ATTR];
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
      delete html.dataset[ATTR];
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [defaultMode]);
  return useCallback((mode: PrintMode) => {
    document.documentElement.dataset[ATTR] = mode;
    applyPage(mode);
    window.print();
  }, []);
}

const noopSubscribe = () => () => {};

/** 印刷物のルート（body 直下へポータル）。page はこの種類の @page の中身（省略時は A4縦・既定の余白） */
export function PrintRoot({ kind, className, page = DEFAULT_PAGE, children }: { kind: PrintMode; className?: string; page?: string; children: React.ReactNode }) {
  // ポータル先の document.body はクライアントだけにある（サーバー描画では何も出さない）
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  useEffect(() => {
    pageByKind.set(kind, page);
    return () => {
      if (pageByKind.get(kind) === page) pageByKind.delete(kind);
    };
  }, [kind, page]);
  if (!isClient) return null;
  return createPortal(
    <div className={`print-root print-root-${kind}${className ? ` ${className}` : ""}`} data-print-kind={kind} aria-hidden="true">
      {children}
    </div>,
    document.body,
  );
}

/**
 * 盤・命式の1枚（A4縦の本文領域 166mm×264mm）。
 * 中身が本文領域より高い場合だけ、全体を縮小して必ず1枚に収める（盤のデザイン自体は変えない）。
 */
export function PrintSheet({ children, className }: { children: React.ReactNode; className?: string }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    const body = bodyRef.current;
    if (!sheet || !body) return;
    const fit = () => {
      const h = body.scrollHeight;
      // 縮小できる高さ＝シートの内側の高さ（シート側の上下 padding＝固定の空白帯は縮小の対象外）。padding 0 なら従来と同じ
      const st = getComputedStyle(sheet);
      const max = sheet.clientHeight - (parseFloat(st.paddingTop) || 0) - (parseFloat(st.paddingBottom) || 0);
      setScale(h > max && h > 0 ? max / h : 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(body);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={sheetRef} className={className ? `print-sheet ${className}` : "print-sheet"}>
      <div ref={bodyRef} className="print-sheet-body" style={scale < 1 ? { transform: `scale(${scale})` } : undefined}>
        {children}
      </div>
    </div>
  );
}

export type PrintHeaderInfo = {
  name: string | null;
  birthDate: string;
  birthTime: string;
  sex: string;
  place: string;
};

/** 印刷物の見出し（タイトル・姓名・生年月日・出生時刻・性別・出生地）＋術ごとの付随情報 */
export function PrintHeader({
  title,
  info,
  extra = [],
}: {
  title: string;
  info: PrintHeaderInfo;
  extra?: [string, string][];
}) {
  const rows: [string, string][] = [
    ["生年月日", info.birthDate],
    ["出生時刻", info.birthTime],
    ["性別", info.sex],
    ["出生地", info.place || "—"],
  ];
  return (
    <header className="print-header">
      <div className="print-title-row">
        <div className="print-title">{title}</div>
        {info.name && <div className="print-name">{info.name}</div>}
      </div>
      <div className="print-info">
        {rows.map(([k, v]) => (
          <span key={k}>
            <span className="print-key">{k}</span>
            {v}
          </span>
        ))}
      </div>
      {extra.length > 0 && (
        <div className="print-info print-info-extra">
          {extra.map(([k, v]) => (
            <span key={k}>
              <span className="print-key">{k}</span>
              {v}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}
