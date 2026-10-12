"use client";

// src/app/ziwei/page.tsx
//
// 紫微斗数 Phase 1 の検証用 UI（本番デザインではない）。
// 計算ロジックは持たず、src/lib/ziwei の calculateZiweiChart() の結果を十二宮の盤面に並べるだけ。
// 出生地は共通の出生地UIで市区町村を選び、その経度で時差を補正する（紫微斗数エンジン。海外出生は対象外）。

import { useMemo, useState } from "react";
import AppSwitcher from "@/components/AppSwitcher";
import NatalProfileForm from "@/components/NatalProfileForm";
import { getNatalProfile, useNatalProfile } from "@/lib/natalProfile/store";
import {
  calculateZiweiChart,
  calculateChartPower,
  starPowerOf,
  starStrengthOf,
  sanfangSizheng,
  MAIN_STARS,
  STRENGTH_SHORT,
} from "@/lib/ziwei";
import type {
  Branch,
  ChartPower,
  Palace,
  PlacedStar,
  TransformationKind,
  ZiweiChart,
  ZiweiInput,
} from "@/lib/ziwei";
import { buildPalaceMeaningContext } from "@/lib/ziwei/meanings";
import { calculateMinorStars } from "@/lib/ziwei/minorStars";
import type { MinorStarChart, MinorStarPlacement } from "@/lib/ziwei/minorStars";
import InterpretationPanel from "./InterpretationPanel";
import MinorStarPanel from "./MinorStarPanel";
import PowerPanel from "./PowerPanel";
import PatternPanel from "./PatternPanel";
import AdvancedPanel from "./AdvancedPanel";
import FortuneStarPanel from "./FortuneStarPanel";
import FortunePanel from "./FortunePanel";
import {
  buildFortuneContextFor,
  parseAppraisalDate,
  selectionFromDate,
  todayInJapan,
  withMajor,
  withMinor,
} from "@/lib/ziwei/fortune";
import type { FortuneSelection } from "@/lib/ziwei/fortune";
import { profileToZiweiInput } from "./profileAdapter";
import "./ziwei.css";
import "./print.css";
import ZiweiChartPrint from "./print/ZiweiChartPrint";
import ZiweiInterpretationPrint from "./print/ZiweiInterpretationPrint";
import { PrintRoot, usePrintMode } from "@/components/print/PrintRoot";
import "@/components/print/print.css";
import { buildZiweiPrintData } from "@/lib/ziwei/print/printData";
import { buildZiweiFortunePrintData } from "@/lib/ziwei/print/fortunePrintData";

type Computed = { chart: ZiweiChart } | { error: string };

function compute(input: ZiweiInput): Computed {
  try {
    return { chart: calculateZiweiChart(input) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** 盤面の外周（4×4 の格子）。中央 2×2 は空ける。 */
const GRID_POSITION: Readonly<Record<Branch, { row: number; col: number }>> = {
  巳: { row: 1, col: 1 },
  午: { row: 1, col: 2 },
  未: { row: 1, col: 3 },
  申: { row: 1, col: 4 },
  辰: { row: 2, col: 1 },
  酉: { row: 2, col: 4 },
  卯: { row: 3, col: 1 },
  戌: { row: 3, col: 4 },
  寅: { row: 4, col: 1 },
  丑: { row: 4, col: 2 },
  子: { row: 4, col: 3 },
  亥: { row: 4, col: 4 },
};

/**
 * 三方四正の線の端点（盤面を 0〜400 の座標にしたとき）。
 * 各宮の中央欄に面した辺の中点（四隅の宮は中央欄に接する角）にして、線が中央の空白を通るようにする。
 */
const ANCHOR: Readonly<Record<Branch, readonly [number, number]>> = {
  巳: [100, 100],
  午: [150, 100],
  未: [250, 100],
  申: [300, 100],
  辰: [100, 150],
  酉: [300, 150],
  卯: [100, 250],
  戌: [300, 250],
  寅: [100, 300],
  丑: [150, 300],
  子: [250, 300],
  亥: [300, 300],
};

const MAIN_SET = new Set<PlacedStar>(MAIN_STARS);

const pad2 = (n: number) => String(n).padStart(2, "0");
const offsetLabel = (sec: number) =>
  `${sec < 0 ? "−" : "+"}${pad2(Math.floor(Math.abs(sec) / 60))}分${pad2(Math.abs(sec) % 60)}秒`;
const kindLabel = (k: TransformationKind) => k.replace("星", "");

function lunarLabel(c: ZiweiChart): string {
  const l = c.lunar;
  const base = `${c.yearStem}${c.yearBranch}年 ${l.isLeapMonth ? "閏" : ""}${l.month}月${l.day}日`;
  if (!c.leapHalf) return base;
  return `${base}（閏月${c.leapHalf} → ${c.birthMonth}月${c.birthDay}日生まれ扱い）`;
}

/** 三方四正の強調: 選択宮・対冲宮・三合宮 */
type Highlight = "selected" | "opposite" | "trine" | null;

/** 丙級（十二神等）の並び: 命宮基準・空亡系を左、博士十二神・長生十二星を右に固定 */
const CYCLE_RIGHT = new Set(["boshi", "changsheng"]);

function PalaceCell({
  palace,
  chart,
  minors,
  power,
  highlight,
  onSelect,
  fortuneHua,
  isMajorSelected,
  isMinorSelected,
  selectedMinorAge,
  onSelectMajor,
}: {
  palace: Palace;
  chart: ZiweiChart;
  /** 新規諸星（既存34星とは別。乙級＝雑曜、丙級＝十二神等） */
  minors: MinorStarPlacement[];
  power: ChartPower;
  highlight: Highlight;
  onSelect: (b: Branch) => void;
  /** 選択中の大限・小限の四化（星 → 四化）。生年四化とは別の層 */
  fortuneHua: { major: Map<PlacedStar, TransformationKind[]>; minor: Map<PlacedStar, TransformationKind[]> };
  isMajorSelected: boolean;
  isMinorSelected: boolean;
  selectedMinorAge: number | null;
  onSelectMajor: (startAge: number) => void;
}) {
  const pos = GRID_POSITION[palace.branch];
  const pp = power.byBranch[palace.branch];
  const kindsOf = (star: PlacedStar) =>
    chart.transformations.filter((t) => t.star === star).map((t) => t.kind);
  const mains = palace.stars.filter((s) => MAIN_SET.has(s));
  const subs = palace.stars.filter((s) => !MAIN_SET.has(s));
  const starItem = (s: PlacedStar, main: boolean) => {
    // 旺衰（§20）: 星名＋宮の地支で参照。旺衰表がない星・空欄は表示しない。
    const strength = starStrengthOf(s, palace.branch);
    // 力量（§22）: 表13の値。天馬・天姚・紅鸞は力量を無視するため表示しない
    const pw = starPowerOf(s, palace.branch);
    return (
      <li key={s} className={main ? "zw-star zw-main" : "zw-star"}>
        {s}
        {strength && (
          <span className="zw-strength" title={strength}>
            {STRENGTH_SHORT[strength]}
          </span>
        )}
        {pw !== null && (
          <span className="zw-power" title={`力量 ${pw}`}>
            {pw}
          </span>
        )}
        {kindsOf(s).map((k) => (
          <span key={k} className="zw-hua" title={`${k} 力量 ${starPowerOf(k, palace.branch)}`}>
            {kindLabel(k)}
          </span>
        ))}
        {/* 大限四化・小限四化（選択中の行運）。生年四化とは別に、重なっても1つずつ出す */}
        {(fortuneHua.major.get(s) ?? []).map((k) => (
          <span key={`M${k}`} className="zw-fhua zw-fhua-major" title={`大限${kindLabel(k)}`}>
            大{kindLabel(k).replace(/^化/, "")}
          </span>
        ))}
        {(fortuneHua.minor.get(s) ?? []).map((k) => (
          <span key={`m${k}`} className="zw-fhua zw-fhua-minor" title={`小限${kindLabel(k)}`}>
            小{kindLabel(k).replace(/^化/, "")}
          </span>
        ))}
      </li>
    );
  };
  return (
    <div
      className={[
        "zw-cell",
        palace.name === "命宮" ? "zw-ming" : "",
        isMajorSelected ? "zw-major-sel" : "",
        isMinorSelected ? "zw-minor-sel" : "",
        highlight === "selected"
          ? "zw-sel"
          : highlight === "opposite"
            ? "zw-opp"
            : highlight === "trine"
              ? "zw-trine"
              : "",
      ].join(" ")}
      style={{ gridRow: pos.row, gridColumn: pos.col }}
      role="button"
      tabIndex={0}
      aria-pressed={highlight === "selected"}
      onClick={() => onSelect(palace.branch)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(palace.branch);
        }
      }}
    >
      <ul className="zw-stars">{mains.map((s) => starItem(s, true))}</ul>
      <ul className="zw-stars zw-subs">
        {subs.map((s) => starItem(s, false))}
      </ul>
      {/* 新規諸星（§37）: 雑曜（乙級）は副星より小さく、十二神等（丙級）は最下段にさらに小さく */}
      <ul className="zw-stars zw-minors">
        {minors
          .filter((m) => m.tier === "minor")
          .map((m) => (
            <li key={m.id} className="zw-mstar">
              {m.name}
            </li>
          ))}
      </ul>
      <div className="zw-cycles">
        {minors
          .filter((m) => m.tier === "cycle" && !CYCLE_RIGHT.has(m.family))
          .map((m) => (
            <span key={m.id} className="zw-cstar">
              {m.name}
            </span>
          ))}
        <span className="zw-cycle-right">
          {minors
            .filter((m) => m.tier === "cycle" && CYCLE_RIGHT.has(m.family))
            .map((m) => (
              <span key={m.id} className="zw-cstar">
                {m.name}
              </span>
            ))}
        </span>
      </div>
      <div className="zw-foot">
        <div className="zw-name">
          {palace.name}
          {palace.isShenPalace && <span className="zw-shen">身宮</span>}
          <span className="zw-pidx" title={`宮の運命指数 ${pp.index.toFixed(1)} ${pp.grade}`}>
            {pp.index.toFixed(1)} {pp.grade}
          </span>
          <span className="zw-branch">{palace.branch}</span>
        </div>
        {/* 大限の年齢は選択用（宮のクリック＝三方四正・解釈とは別の操作。伝播を止める）。
            小限は行運欄のプルダウンで選び、盤面には選択中の小限の宮にだけ年齢を出す（§28.5） */}
        <div className="zw-limit-row">
          <button
            type="button"
            className={isMajorSelected ? "zw-limit-btn zw-limit-major is-active" : "zw-limit-btn zw-limit-major"}
            aria-pressed={isMajorSelected}
            title="この大限を選ぶ"
            onClick={(e) => {
              e.stopPropagation();
              onSelectMajor(palace.dayun.startAge);
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            大限 {palace.dayun.startAge}–{palace.dayun.endAge}
            {isMajorSelected && <span className="zw-limit-tag zw-limit-tag-major">選択中</span>}
          </button>
          {isMinorSelected && selectedMinorAge !== null && <span className="zw-minor-label">小限 {selectedMinorAge}歳</span>}
        </div>
      </div>
    </div>
  );
}

export default function ZiweiPage() {
  // 人物情報・出生地は共通プロフィール（3術共通）
  const { profile, hydrated, revision } = useNatalProfile();
  // 作盤ボタン（または顧客の読み込み）時点の入力。null は未作盤
  const [submitted, setSubmitted] = useState<ReturnType<typeof profileToZiweiInput> | null>(null);
  const computed = useMemo<Computed | null>(
    () => (submitted === null ? null : "error" in submitted ? submitted : compute(submitted.input)),
    [submitted],
  );
  const submit = () => setSubmitted(profileToZiweiInput(getNatalProfile()));
  // ページを開いたとき・顧客を読み込んだとき（revision が変わったとき）は、その入力で作盤する
  const [autoSubmittedRevision, setAutoSubmittedRevision] = useState<number | null>(null);
  if (hydrated && autoSubmittedRevision !== revision) {
    setAutoSubmittedRevision(revision);
    setSubmitted(profileToZiweiInput(profile));
  }
  // 三方四正の表示中の宮（同じ宮をもう一度押すと解除）
  const [selected, setSelected] = useState<Branch | null>(null);
  const toggleSelected = (b: Branch) =>
    setSelected((cur) => (cur === b ? null : b));
  const relation = selected ? sanfangSizheng(selected) : null;
  const highlightOf = (b: Branch): Highlight =>
    !relation
      ? null
      : b === selected
        ? "selected"
        : b === relation.opposite
          ? "opposite"
          : relation.trines.includes(b)
            ? "trine"
            : null;

  const chart = computed && "chart" in computed ? computed.chart : null;
  // 行運の選択状態（§28）: 鑑定日・選択中の大限・選択中の小限は別の状態。宮クリック（selected）とも別。
  // 作盤し直したときは、鑑定日に同期し直す
  const [fortuneState, setFortuneState] = useState<{ chart: ZiweiChart | null; sel: FortuneSelection }>(() => ({
    chart: null,
    sel: { appraisalDate: todayInJapan(), majorStartAge: null, minorAge: null },
  }));
  if (chart && fortuneState.chart !== chart) setFortuneState({ chart, sel: selectionFromDate(chart, fortuneState.sel.appraisalDate) });
  const fortuneSel = fortuneState.sel;
  const fortune = useMemo(() => {
    const d = parseAppraisalDate(fortuneSel.appraisalDate);
    return chart && d ? buildFortuneContextFor(chart, d, fortuneSel) : null;
  }, [chart, fortuneSel]);
  const fortuneHua = useMemo(() => {
    const toMap = (ts: { star: PlacedStar; kind: TransformationKind }[]) => {
      const m = new Map<PlacedStar, TransformationKind[]>();
      for (const t of ts) m.set(t.star, [...(m.get(t.star) ?? []), t.kind]);
      return m;
    };
    return { major: toMap(fortune?.majorTransformations ?? []), minor: toMap(fortune?.minorTransformations ?? []) };
  }, [fortune]);
  const updateFortune = (f: (c: ZiweiChart, s: FortuneSelection) => FortuneSelection) =>
    setFortuneState((cur) => (chart ? { chart, sel: f(chart, cur.sel) } : cur));
  // 印刷用データ（既存の作盤・力量・格局・応用編・解釈〔standard〕の結果を集めるだけ）
  const printData = useMemo(() => {
    if (!chart || !submitted || !("input" in submitted)) return null;
    const b = submitted.input.birth;
    const tc = chart.timeCorrection;
    return buildZiweiPrintData(chart, {
      name: profile.name.trim() || null,
      birthDate: `${b.year}年${b.month}月${b.day}日`,
      birthTime: `${pad2(b.hour)}:${pad2(b.minute)}`,
      sex: submitted.input.sex === "male" ? "男" : "女",
      // 作盤時に共通の出生地UIで確定していた正式な地点名
      place: tc.place,
      lunar: lunarLabel(chart),
      mingPalace: `${chart.mingPalace}`,
      shenPalace: `${chart.shenPalace}（${chart.palaces.find((p) => p.isShenPalace)?.name}）`,
      bureau: chart.bureau.name,
    });
  }, [chart, submitted, profile.name]);
  const chartPower = useMemo(() => (chart ? calculateChartPower(chart) : null), [chart]);
  // 新規諸星（本命盤のみ。作盤結果・力量・格局には入れない）
  const minorChart = useMemo<MinorStarChart | null>(() => (chart ? calculateMinorStars(chart) : null), [chart]);
  const printAs = usePrintMode();
  // 解釈印刷の運命指数・大限・小限（12宮・全大限は選択中の宮・大限に関係なく作る。小限の解釈は鑑定日の小限）
  const fortunePrint = useMemo(
    () => (chart ? buildZiweiFortunePrintData(chart, fortuneSel.appraisalDate) : null),
    [chart, fortuneSel.appraisalDate],
  );

  // 宮クリック時: 全件の象意コンテキスト（資料ベース解釈・力量・象意確認で共用）
  const meaningContext = useMemo(
    () => (chart && selected ? buildPalaceMeaningContext(chart, selected) : null),
    [chart, selected],
  );

  return (
    <>
      <AppSwitcher />
      <main className="zw-page">
        {/* 見出し・入力欄・盤面で画面の高さを使い切る（盤面が残りの高さに伸びる） */}
        <div className="zw-fit">
          <h1 className="zw-h1">紫微斗数命盤</h1>

          <div className="zw-top">
            <div>
              {/* 1. 共通人物入力UI */}
              <NatalProfileForm timeLabel="出生時刻（法定時刻）" />
              {/* 2. 作盤・印刷（紫微斗数固有の入力はない） */}
              <form
                className="zw-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <button className="zw-button" type="submit">
                  作盤
                </button>
                {chart && printData && (
                  <>
                    <button className="zw-button zw-print-button" type="button" onClick={() => printAs("chart")}>
                      盤を印刷
                    </button>
                    <button className="zw-button zw-print-button" type="button" onClick={() => printAs("interpretation")}>
                      解釈を印刷
                    </button>
                  </>
                )}
              </form>
            </div>

            {chart && (
              <dl className="zw-info">
                <div>
                  <dt>作盤日</dt>
                  <dd>
                    {chart.chartDate.year}/{pad2(chart.chartDate.month)}/
                    {pad2(chart.chartDate.day)}
                    {chart.advancedAt23 ? "（23時日替わり）" : ""}
                  </dd>
                </div>
                <div>
                  <dt>時差</dt>
                  <dd title={`${chart.timeCorrection.place}（東経${chart.timeCorrection.longitude ?? "—"}°）`}>
                    {offsetLabel(chart.timeCorrection.placeOffsetSeconds)}
                    {chart.timeCorrection.summerTimeApplied ? "・夏時間−1時間" : ""}
                  </dd>
                </div>
                <div>
                  <dt>陰暦</dt>
                  <dd>{lunarLabel(chart)}</dd>
                </div>
                <div>
                  <dt>年干支</dt>
                  <dd>
                    {chart.yearStem}
                    {chart.yearBranch}
                  </dd>
                </div>
                <div>
                  <dt>生時支</dt>
                  <dd>{chart.hourBranch}時</dd>
                </div>
                <div>
                  <dt>命宮</dt>
                  <dd>{chart.mingPalace}</dd>
                </div>
                <div>
                  <dt>身宮</dt>
                  <dd>
                    {chart.shenPalace}（
                    {chart.palaces.find((p) => p.isShenPalace)?.name}）
                  </dd>
                </div>
                <div>
                  <dt>五行局</dt>
                  <dd>{chart.bureau.name}</dd>
                </div>
                <div>
                  <dt>性別</dt>
                  <dd>
                    {chart.dayun.yinYang}（大限 {chart.dayun.direction}）
                  </dd>
                </div>
                <div>
                  <dt>小限</dt>
                  <dd>
                    1歳 {chart.xiaoxian.startBranch}宮・
                    {chart.xiaoxian.direction}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {computed && "error" in computed && (
            <div className="zw-error">{computed.error}</div>
          )}

          {chart && chartPower && minorChart && (
            <div className="zw-board-scroll">
              <div className="zw-board">
                {chart.palaces.map((p) => (
                  <PalaceCell
                    key={p.branch}
                    palace={p}
                    chart={chart}
                    minors={minorChart.byBranch[p.branch]}
                    power={chartPower}
                    highlight={highlightOf(p.branch)}
                    fortuneHua={fortuneHua}
                    isMajorSelected={fortune?.majorLimit?.palaceBranch === p.branch}
                    isMinorSelected={fortune?.minorLimit?.palaceBranch === p.branch}
                    selectedMinorAge={fortuneSel.minorAge}
                    onSelectMajor={(start) => updateFortune((c, sl) => withMajor(c, sl, start))}
                    onSelect={toggleSelected}
                  />
                ))}
                <div
                  className="zw-center"
                  style={{ gridRow: "2 / 4", gridColumn: "2 / 4" }}
                >
                  {/* 命主・身主（表20・表21）は宮に置く星ではないため中央に別表示 */}
                  <dl className="zw-masters">
                    <div>
                      <dt>命主</dt>
                      <dd>{minorChart.mingZhu}</dd>
                    </div>
                    <div>
                      <dt>身主</dt>
                      <dd>{minorChart.shenZhu}</dd>
                    </div>
                  </dl>
                </div>
                {selected && relation && (
                  <svg
                    className="zw-lines"
                    viewBox="0 0 400 400"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {/* 対冲線: 選択宮 → 対冲宮 */}
                    <line
                      className="zw-line-opposite"
                      x1={ANCHOR[selected][0]}
                      y1={ANCHOR[selected][1]}
                      x2={ANCHOR[relation.opposite][0]}
                      y2={ANCHOR[relation.opposite][1]}
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* 三合線: 三合3宮（選択宮・三合宮A・三合宮B）を相互に結ぶ三角形 */}
                    {(
                      [
                        [selected, relation.trines[0]],
                        [selected, relation.trines[1]],
                        [relation.trines[0], relation.trines[1]],
                      ] as const
                    ).map(([from, to]) => (
                      <line
                        key={`${from}${to}`}
                        className="zw-line-trine"
                        x1={ANCHOR[from][0]}
                        y1={ANCHOR[from][1]}
                        x2={ANCHOR[to][0]}
                        y2={ANCHOR[to][1]}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </svg>
                )}
              </div>
            </div>
          )}
        </div>

        {chart && <PatternPanel chart={chart} />}
        {chart && (
          <FortunePanel
            chart={chart}
            fortune={fortune}
            selection={fortuneSel}
            onDateChange={(text) => updateFortune((c) => selectionFromDate(c, text))}
            onMinorChange={(age) => updateFortune((c, sl) => withMinor(c, sl, age))}
            onReset={() => updateFortune((c, sl) => selectionFromDate(c, sl.appraisalDate))}
          />
        )}
        {chart && meaningContext?.palace.name === "命宮" && <AdvancedPanel chart={chart} />}
        {meaningContext && <InterpretationPanel ctx={meaningContext} />}
        {minorChart && selected && <MinorStarPanel branch={selected} palaceName={chart?.palaces.find((p) => p.branch === selected)?.name ?? ""} minors={minorChart.byBranch[selected]} />}
        {chart && <FortuneStarPanel chart={chart} selection={fortuneSel} />}
        {meaningContext && <PowerPanel ctx={meaningContext} />}

        {/* 印刷専用レイアウト（画面には出さない）：盤＝A4横1枚／解釈＝A4縦・文章のみ・複数ページ */}
        {printData && (
          <>
            <PrintRoot kind="chart" className="zw-print-landscape" page="size: A4 landscape; margin: 10mm;">
              <ZiweiChartPrint data={printData} />
            </PrintRoot>
            {fortunePrint && (
              <PrintRoot kind="interpretation" page="size: A4 portrait; margin: 30mm 22mm 30mm 22mm;">
                <ZiweiInterpretationPrint data={printData} fortune={fortunePrint} />
              </PrintRoot>
            )}
          </>
        )}
      </main>
    </>
  );
}
