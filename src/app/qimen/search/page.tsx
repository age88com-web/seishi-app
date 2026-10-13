"use client";

// src/app/qimen/search/page.tsx
//
// 吉格日時検索（第1段階: OR検索の土台／第2段階: AND検索を追加）。
// 排盤ロジックは一切持たず、src/lib/qimenSearch/searchEngine.ts の
// runQimenSearch()（＝ qimenEngine.calculate() を2時間刻みで繰り返し呼ぶだけの層）
// を呼び出して結果を一覧表示するだけの UI。
//
// 結果クリック時は /qimen へ ?date=&time= を付けて遷移する（/qimen 側で自動入力）。

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppSwitcher from "@/components/AppSwitcher";
import { runQimenSearch, countSlots } from "@/lib/qimenSearch/searchEngine";
import { JIKAKU_FORMAT_OPTIONS, KYOKAKU_FORMAT_OPTIONS } from "@/lib/qimenSearch/formats";
import { formatKey } from "@/lib/qimenSearch/types";
import type { QimenFormatOption, QimenSearchHit, QimenSearchMatchMode } from "@/lib/qimenSearch/types";
import { QIMEN_SEARCH_PRESETS, resolvePreset } from "@/lib/qimenSearch/datePresets";
import type { QimenSearchPresetId } from "@/lib/qimenSearch/datePresets";
import { PURPOSE_EVALUATIONS, resolveKakuAliases } from "@/lib/qimenPurpose";
import { PALACE_TRIGRAM } from "@/lib/qimen";
import "./print.css";

type SearchMode = "kaku" | "purpose";

// 「盤へ移動 → 戻る」往復のための検索状態の保持（sessionStorageのみ・タブ内限定）。
//   排盤ロジック・検索ロジックには一切関与しない、UI状態の一時保存にすぎない。
//   保存するのは検索条件・検索結果（再検索を避けるため）・戻ったときのスクロール位置のみ。
const SEARCH_STATE_KEY = "qimenSearch:lastState";

interface SavedSearchState {
  startDate: string;
  endDate: string;
  matchMode: QimenSearchMatchMode;
  searchMode: SearchMode;
  selectedPurpose: string;
  selected: string[];
  excludeAllKyokaku: boolean;
  hits: QimenSearchHit[] | null;
  scrollY: number;
}

function saveSearchState(state: SavedSearchState) {
  try {
    sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage が使えない環境（プライベートモード等）では諦める。往復機能が
    // 使えなくなるだけで、検索そのものには影響しない。
  }
}

function loadSearchState(): SavedSearchState | null {
  try {
    const raw = sessionStorage.getItem(SEARCH_STATE_KEY);
    return raw ? (JSON.parse(raw) as SavedSearchState) : null;
  } catch {
    return null;
  }
}

function pad(x: number): string {
  return String(x).padStart(2, "0");
}
function hitDateTime(hit: QimenSearchHit): string {
  return `${hit.year}-${pad(hit.month)}-${pad(hit.day)} ${pad(hit.hour)}:${pad(hit.minute)}`;
}
// 宮番号→後天八卦は src/lib/qimen の PALACE_TRIGRAM（既存定義）をそのまま使う。
// 中宮(5)だけは後天八卦を持たないため、表示上「中」を補う。
function palaceLabel(p: number): string {
  return `${p}宮 ${PALACE_TRIGRAM[p] ?? (p === 5 ? "中" : "")}`.trim();
}

// 「成立した格局：〇〇（9宮 離）、△△（3宮 震）」の表示を、画面用カードと
// 印刷用一覧の両方で共有する（同じ組み立てロジックを重複させない）。
// palaceClassName を渡すと、宮ラベル（例:「9宮 離」）に nowrap 用のクラスを付ける。
function KakuMatchesText({
  matches,
  palaceClassName,
}: {
  matches: QimenSearchHit["matches"];
  palaceClassName?: string;
}) {
  if (matches.length === 0) return <>—</>;
  return (
    <>
      {matches.map((m, mi) => (
        <span key={mi}>
          {mi > 0 && "、"}
          {m.name}（
          {m.palaces.length === 0
            ? "—"
            : m.palaces.map((p, pi) => (
                <span key={pi}>
                  {pi > 0 && "・"}
                  {/* 「9宮 離」のような宮番号＋後天卦の間で改行させない */}
                  <span className={palaceClassName} style={palaceClassName ? undefined : S.palaceLabel}>
                    {palaceLabel(p)}
                  </span>
                </span>
              ))}
          ）
        </span>
      ))}
    </>
  );
}

/**
 * この検索結果に「凶格なし」と表示してよいかどうかを判定する。
 *
 * 2026-09-13の調査で判明した不整合の修正（第1弾）:
 *   旧実装は hit.matches（＝検索条件として選んだformatsのうち成立したもの）
 *   に category==="kyokaku" が1件でもあるかだけを見ており、「盤に実在する
 *   凶格」を全く見ていなかった。
 *
 * 2026-09-13追記（第2弾・盤全体凶格の反映）:
 *   palaces=[] で返る「盤全体成立の凶格」（五不遇時・伏吟格・反吟格など。
 *   名前をハードコードせず hit.allKyokakuMatches の palaces.length===0 で
 *   判定する）が1件でも成立していれば、同一宮判定の結果に関わらず
 *   「凶格なし」にはしない（＝ hasCleanJikaku は false）。
 *
 * 正式仕様（A かつ B）:
 *   A. 成立した吉格（hit.matches の category==="jikaku"）のうち少なくとも
 *      1つが、成立している宮と同一の宮に宮別凶格（hit.allKyokakuMatches の
 *      palaces に当該宮を含むもの）を持たない。
 *   B. その時刻の盤全体凶格（hit.allKyokakuMatches の palaces.length===0）
 *      が1件も無い。
 *   吉格が1つも成立していない場合（凶格だけを検索条件にした等）は、
 *   同一宮の比較対象が無いため、この判定の対象外とする。
 */
function hasCleanJikaku(hit: QimenSearchHit): boolean {
  const jikakuMatches = hit.matches.filter((m) => m.category === "jikaku");
  if (jikakuMatches.length === 0) return false;

  // B: 盤全体凶格が1件でもあれば、どの吉格についても「凶格なし」にしない。
  const hasBoardWideKyokaku = hit.allKyokakuMatches.some((km) => km.palaces.length === 0);
  if (hasBoardWideKyokaku) return false;

  // A: 少なくとも1つの吉格が、同一宮に宮別凶格を持たない。
  return jikakuMatches.some((jm) =>
    jm.palaces.every(
      (palace) => !hit.allKyokakuMatches.some((km) => km.palaces.includes(palace)),
    ),
  );
}

export default function QimenSearchPage() {
  const router = useRouter();

  const initialRange = useMemo(() => resolvePreset("1w"), []);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [matchMode, setMatchMode] = useState<QimenSearchMatchMode>("OR");

  function applyPreset(id: QimenSearchPresetId) {
    const range = resolvePreset(id);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }
  const [searchMode, setSearchMode] = useState<SearchMode>("kaku");
  const [selectedPurpose, setSelectedPurpose] = useState<string>(PURPOSE_EVALUATIONS[0]?.purpose ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [excludeAllKyokaku, setExcludeAllKyokaku] = useState(true);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ scanned: number; total: number } | null>(null);
  const [hits, setHits] = useState<QimenSearchHit[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 盤画面から「← 検索結果に戻る」で戻ってきた（?restore=1）場合、保存済みの
  // 検索条件・検索結果を復元する（再検索はしない）。復元後にスクロール位置も戻す。
  const pendingScrollY = useRef<number | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("restore") !== "1") return;
    const saved = loadSearchState();
    if (!saved) return;

    setStartDate(saved.startDate);
    setEndDate(saved.endDate);
    setMatchMode(saved.matchMode);
    setSearchMode(saved.searchMode);
    setSelectedPurpose(saved.selectedPurpose);
    setSelected(new Set(saved.selected));
    setExcludeAllKyokaku(saved.excludeAllKyokaku);
    setHits(saved.hits);
    pendingScrollY.current = saved.scrollY;

    // URLの ?restore=1 は復元専用の一回きりの指示なので、履歴を汚さないよう消しておく。
    router.replace("/qimen/search");
    // 初回マウント時のみ実行（依存配列は意図的に空）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // hits が復元によって描画された直後に、保存しておいたスクロール位置へ戻す。
  useEffect(() => {
    if (pendingScrollY.current === null) return;
    const y = pendingScrollY.current;
    pendingScrollY.current = null;
    // 一覧の描画（グリッドの高さ確定）を待ってからスクロールする。
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [hits]);

  // 格局検索モード: チェックボックスで直接選んだ格局。
  const kakuSelectedFormats = useMemo<QimenFormatOption[]>(() => {
    const all = [...JIKAKU_FORMAT_OPTIONS, ...KYOKAKU_FORMAT_OPTIONS];
    return all.filter((f) => selected.has(formatKey(f)));
  }, [selected]);

  // 用途検索モード: 用途 → PurposeEvaluation → resolveKakuAliases() →
  //   既存の検索エンジンが読める QimenFormatOption[] へ変換する。
  //   検索エンジン自体の判定ロジックは変更しない（呼び出し方が違うだけ）。
  const purposeSelectedFormats = useMemo<QimenFormatOption[]>(() => {
    const evaluation = PURPOSE_EVALUATIONS.find((e) => e.purpose === selectedPurpose);
    if (!evaluation) return [];
    return resolveKakuAliases(evaluation.kaku).map((name) => ({
      category: "jikaku" as const,
      name,
    }));
  }, [selectedPurpose]);

  const selectedFormats = searchMode === "purpose" ? purposeSelectedFormats : kakuSelectedFormats;

  const estimatedSlots = useMemo(() => countSlots({ startDate, endDate }), [startDate, endDate]);

  function toggle(f: QimenFormatOption) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = formatKey(f);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onSearch() {
    setErrorMsg(null);
    if (startDate > endDate) {
      setErrorMsg("開始日は終了日以前にしてください");
      return;
    }
    if (selectedFormats.length === 0) {
      setErrorMsg(searchMode === "purpose" ? "用途を選択してください" : "格局を1つ以上選択してください");
      return;
    }
    if (matchMode === "AND" && selectedFormats.length < 2) {
      setErrorMsg("すべて成立（AND）は格局を2つ以上選択してください");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setHits(null);
    setProgress({ scanned: 0, total: estimatedSlots });

    const result = await runQimenSearch(
      {
        startDate,
        endDate,
        formats: selectedFormats,
        matchMode,
        excludeAllKyokaku,
      },
      (p) => setProgress({ scanned: p.scanned, total: p.total }),
      controller.signal,
    );

    setHits(result);
    setRunning(false);
  }

  function onCancel() {
    abortRef.current?.abort();
  }

  function onResultClick(hit: QimenSearchHit) {
    // 盤画面から「← 検索結果に戻る」で戻れるよう、検索条件・検索結果・
    // 現在のスクロール位置を保存してから遷移する（?restore=1 で読み戻す）。
    saveSearchState({
      startDate,
      endDate,
      matchMode,
      searchMode,
      selectedPurpose,
      selected: Array.from(selected),
      excludeAllKyokaku,
      hits,
      scrollY: window.scrollY,
    });

    const date = `${hit.year}-${pad(hit.month)}-${pad(hit.day)}`;
    const time = `${pad(hit.hour)}:${pad(hit.minute)}`;
    const timezone = encodeURIComponent(hit.timezone);
    router.push(`/qimen?date=${date}&time=${time}&timezone=${timezone}&from=search`);
  }

  return (
    <>
      <AppSwitcher />
      <main style={S.page} className="qms-main">
        <div style={S.headRow}>
          <h1 style={S.h1}>奇門遁甲 吉格日時検索</h1>
          <a href="/qimen" style={S.backLink}>← 排盤に戻る</a>
        </div>

        <section style={S.formatSection}>
          <h2 style={S.h2}>検索方法</h2>
          <div style={S.radioRow}>
            <label style={S.radioLabel}>
              <input
                type="radio"
                name="searchMode"
                checked={searchMode === "purpose"}
                onChange={() => setSearchMode("purpose")}
              />
              用途検索
            </label>
            <label style={S.radioLabel}>
              <input
                type="radio"
                name="searchMode"
                checked={searchMode === "kaku"}
                onChange={() => setSearchMode("kaku")}
              />
              格局検索
            </label>
          </div>
        </section>

        <section style={S.formatSection}>
          <h2 style={S.h2}>検索条件</h2>
          <div style={S.radioRow}>
            <label style={S.radioLabel}>
              <input
                type="radio"
                name="matchMode"
                checked={matchMode === "OR"}
                onChange={() => setMatchMode("OR")}
              />
              いずれか成立（OR）
            </label>
            <label style={S.radioLabel}>
              <input
                type="radio"
                name="matchMode"
                checked={matchMode === "AND"}
                onChange={() => setMatchMode("AND")}
              />
              すべて成立（AND）
            </label>
          </div>
        </section>

        <section style={S.presetSection}>
          <div style={S.presetRow}>
            {QIMEN_SEARCH_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                style={S.presetBtn}
                onClick={() => applyPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        <section style={S.inputs}>
          <label style={S.field}>
            開始日
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={S.input}
            />
          </label>
          <label style={S.field}>
            終了日
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={S.input}
            />
          </label>
          <div style={S.field}>
            検索間隔
            <div style={S.staticValue}>2時間ごと（固定）／対象スロット数: 約{estimatedSlots}件</div>
          </div>
        </section>

        {searchMode === "purpose" ? (
          <section style={S.formatSection}>
            <h2 style={S.h2}>用途</h2>
            <select
              value={selectedPurpose}
              onChange={(e) => setSelectedPurpose(e.target.value)}
              style={S.input}
            >
              {PURPOSE_EVALUATIONS.map((e) => (
                <option key={e.purpose} value={e.purpose}>{e.purpose}</option>
              ))}
            </select>
            <div style={S.staticValue}>
              検索する格局：{purposeSelectedFormats.map((f) => f.name).join("・") || "—"}
            </div>
          </section>
        ) : (
          <section style={S.formatSection}>
            <h2 style={S.h2}>格局（複数選択可）</h2>
            <div style={S.formatGroups}>
              <div style={S.formatGroup}>
                <div style={S.formatGroupTitle}>吉格</div>
                <div style={S.formatList}>
                  {JIKAKU_FORMAT_OPTIONS.map((f) => (
                    <label key={formatKey(f)} style={S.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={selected.has(formatKey(f))}
                        onChange={() => toggle(f)}
                      />
                      {f.name}
                    </label>
                  ))}
                </div>
              </div>
              <div style={S.formatGroup}>
                <div style={S.formatGroupTitle}>凶格</div>
                <div style={S.formatList}>
                  {KYOKAKU_FORMAT_OPTIONS.map((f) => (
                    <label key={formatKey(f)} style={S.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={selected.has(formatKey(f))}
                        onChange={() => toggle(f)}
                      />
                      {f.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section style={S.formatSection}>
          <h2 style={S.h2}>除外する凶格</h2>
          <div style={S.formatList}>
            <label style={S.checkboxLabel}>
              <input
                type="checkbox"
                checked={excludeAllKyokaku}
                onChange={() => setExcludeAllKyokaku((prev) => !prev)}
              />
              すべての凶格を除外
            </label>
          </div>
        </section>

        {errorMsg && <div style={S.error}>{errorMsg}</div>}

        <section style={S.actions}>
          <button type="button" style={S.btnPrimary} onClick={onSearch} disabled={running}>
            検索
          </button>
          {running && (
            <button type="button" style={S.btn} onClick={onCancel}>
              中止
            </button>
          )}
          {progress && (
            <span style={S.progressText}>
              {progress.scanned} / {progress.total} 件走査
              {running ? "…" : "（完了）"}
            </span>
          )}
        </section>

        {hits && (
          <section>
            <div style={S.resultHeadRow}>
              <h2 style={S.h2}>検索結果（{hits.length}件）</h2>
              {hits.length > 0 && (
                <button type="button" style={S.btn} onClick={() => window.print()}>
                  印刷
                </button>
              )}
            </div>
            {hits.length === 0 ? (
              <p style={S.staticValue}>該当する日時はありませんでした。</p>
            ) : (
              <div style={S.hitList}>
                {hits.map((hit, i) => {
                  // 「凶格なし」＝成立した吉格と同一宮に、盤に実在する凶格が
                  // 1件も無いこと（検索条件に凶格を選んだかどうかは無関係）。
                  const clean = hasCleanJikaku(hit);
                  return (
                    <div key={i} style={S.hitCard} onClick={() => onResultClick(hit)}>
                      <div style={S.hitHead}>
                        <span style={S.hitDateTime}>{hitDateTime(hit)}</span>
                        <span style={clean ? S.noKyokakuTag : S.kyokakuTag}>
                          凶格{clean ? "なし" : "あり"}
                        </span>
                      </div>
                      <div style={S.hitKakuList}>
                        成立した格局：
                        <KakuMatchesText matches={hit.matches} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ---- 印刷専用: 検索格局／検索期間／検索結果一覧の3点だけ。画面では非表示。 ---- */}
      <div className="qms-print-doc">
        <h1>奇門遁甲 吉格日時検索</h1>

        <h2>検索格局</h2>
        <ul className="qms-format-list">
          {selectedFormats.length === 0 ? (
            <li>—</li>
          ) : (
            selectedFormats.map((f) => <li key={formatKey(f)}>{f.name}</li>)
          )}
        </ul>

        <h2>検索期間</h2>
        <div className="qms-period">
          {startDate.replaceAll("-", "/")} ～ {endDate.replaceAll("-", "/")}
        </div>

        <h2>検索結果</h2>
        <ul className="qms-result-list">
          {!hits || hits.length === 0 ? (
            <li>該当する日時はありませんでした。</li>
          ) : (
            hits.map((hit, i) => (
              <li key={i}>
                <div className="qms-result-dt">{hitDateTime(hit)}</div>
                <div className="qms-result-kaku">
                  <KakuMatchesText matches={hit.matches} palaceClassName="qms-palace" />
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { fontFamily: "system-ui, 'Hiragino Sans', sans-serif", padding: 24, color: "#222", maxWidth: 1100 },
  headRow: { display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" },
  resultHeadRow: { display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 },
  h1: { fontSize: 20, margin: 0 },
  h2: { fontSize: 15, margin: "0 0 8px" },
  // 上部の七政四餘／奇門遁甲／擇日ボタン（AppSwitcher）と揃えた枠付きボタン。
  // 主操作ではないため、強調色や太字は使わない。
  backLink: { display: "inline-block", fontSize: 13, padding: "5px 14px", border: "1px solid #ccc", borderRadius: 4, background: "#fff", color: "#555", textDecoration: "none" },
  radioRow: { display: "flex", gap: 20 },
  radioLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 13 },
  presetSection: { marginBottom: 8 },
  presetRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  presetBtn: { fontSize: 13, padding: "5px 12px", border: "1px solid #999", borderRadius: 4, background: "#f5f5f5", cursor: "pointer" },
  inputs: { display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 },
  field: { display: "flex", flexDirection: "column", fontSize: 12, color: "#555", gap: 4 },
  input: { fontSize: 14, padding: "4px 6px", border: "1px solid #bbb", borderRadius: 4 },
  staticValue: { fontSize: 13, color: "#333" },
  formatSection: { marginBottom: 16 },
  formatGroups: { display: "flex", gap: 32, flexWrap: "wrap" },
  formatGroup: { minWidth: 220 },
  formatGroupTitle: { fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#444" },
  formatList: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto", paddingRight: 8 },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 13 },
  actions: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  btn: { fontSize: 13, padding: "5px 12px", border: "1px solid #999", borderRadius: 4, background: "#f5f5f5", cursor: "pointer" },
  btnPrimary: { fontSize: 13, padding: "6px 16px", border: "1px solid #2a5", borderRadius: 4, background: "#e6f7ec", cursor: "pointer", fontWeight: 600 },
  progressText: { fontSize: 12, color: "#666" },
  error: { background: "#fdecec", border: "1px solid #e0b4b4", color: "#a33", padding: "8px 12px", borderRadius: 4, marginBottom: 16 },
  // PC: カード幅を保ったまま auto-fit で 3〜5列程度に自動折り返し。
  // スマホ等の狭い画面では、1カード分の幅も確保できず自然に1列（必要幅次第で2列）になる
  // （メディアクエリを使わず minmax の下限だけで両方満たす）。
  hitList: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 },
  hitCard: { border: "1px solid #ddd", borderRadius: 6, padding: "10px 14px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 },
  hitHead: { display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 8 },
  hitDateTime: { fontSize: 14, fontWeight: 600 },
  kyokakuTag: { fontSize: 12, color: "#b42318", fontWeight: 600 },
  noKyokakuTag: { fontSize: 12, color: "#2a5", fontWeight: 600 },
  hitKakuList: { fontSize: 13, color: "#444", lineHeight: 1.6 },
  // 「9宮 離」のような宮番号＋後天卦のまとまりの途中では改行させない。
  palaceLabel: { whiteSpace: "nowrap" },
};
