"use client";

// src/components/BirthplaceInput.tsx
//
// 共通の出生地入力UI（七政四餘・紫微斗数・四柱推命）。
//   市区町村まで文字入力 → 入力途中で候補（/api/places）を表示 → 候補を選ぶと地点が確定する。
//   確定した地点情報（BirthplaceInfo: 表示名・都道府県・市区町村・緯度・経度・国）を onSelect で返すだけで、
//   時差の計算はしない（七政四餘・紫微斗数・四柱推命はそれぞれの既存の補正処理で使う）。
//   候補を選ばずに入力欄を離れた場合は、確定済みの地点名に戻す（地点名と緯度経度が食い違わないように）。

import { useEffect, useRef, useState } from "react";
import type { BirthplaceInfo } from "@/lib/places/types";
import "./BirthplaceInput.css";

const DEBOUNCE_MS = 300;
const JAPANESE = /[぀-ヿ㐀-鿿]/;

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error"; text: string } | { kind: "empty" };

export default function BirthplaceInput({
  value,
  onSelect,
  label = "出生地",
}: {
  /** 確定済みの地点名（共通プロフィールの birthPlace） */
  value: string;
  onSelect: (place: BirthplaceInfo) => void;
  label?: string;
}) {
  const [text, setText] = useState(value);
  const [shownValue, setShownValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<BirthplaceInfo[]>([]);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [query, setQuery] = useState<string | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 外から確定地点が変わったら（顧客の読み込み・新規入力・ハイドレーション）入力欄も合わせる
  if (value !== shownValue) {
    setShownValue(value);
    setText(value);
  }

  // 入力が止まってから検索する（1文字の地名もあるため日本語は1文字から、それ以外は2文字から）
  useEffect(() => {
    if (query === null) return;
    const q = query.trim();
    if (q.length < (JAPANESE.test(q) ? 1 : 2)) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setStatus({ kind: "loading" });
      try {
        const r = await fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal: ctrl.signal, cache: "no-store" });
        const j = (await r.json()) as { places?: BirthplaceInfo[]; error?: string };
        if (!r.ok) throw new Error(r.status === 401 ? "ログインが必要です" : (j.error ?? "地名検索に失敗しました"));
        const places = j.places ?? [];
        setCandidates(places);
        setActive(places.length > 0 ? 0 : -1);
        setStatus(places.length > 0 ? { kind: "idle" } : { kind: "empty" });
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setCandidates([]);
        setStatus({ kind: "error", text: e instanceof Error ? e.message : String(e) });
      }
    }, DEBOUNCE_MS);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const choose = (p: BirthplaceInfo) => {
    onSelect(p);
    setText(p.displayName);
    setOpen(false);
    setQuery(null);
    setCandidates([]);
    setStatus({ kind: "idle" });
  };

  const editing = text !== value;
  const showList = open && editing && query !== null && query.trim() !== "";

  return (
    <label className="bp-field">
      {label}
      <span className="bp-wrap">
        <input
          className="bp-input"
          value={text}
          placeholder="例：名古屋市中区 / 岐阜市 / London"
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          aria-controls="bp-listbox"
          onChange={(e) => {
            setText(e.target.value);
            setQuery(e.target.value);
            setOpen(true);
            if (e.target.value.trim() === "") {
              setCandidates([]);
              setStatus({ kind: "idle" });
            }
          }}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setOpen(true);
          }}
          onBlur={() => {
            // 候補のクリックを先に処理させてから閉じる。未確定の入力は確定済みの地点名に戻す
            blurTimer.current = setTimeout(() => {
              setOpen(false);
              setText(value);
              setQuery(null);
              setCandidates([]);
              setStatus({ kind: "idle" });
            }, 150);
          }}
          onKeyDown={(e) => {
            if (!showList) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(candidates.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (candidates[active]) choose(candidates[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {showList && (
          <ul className="bp-list" id="bp-listbox" role="listbox">
            {status.kind === "loading" && candidates.length === 0 && <li className="bp-note">検索中…</li>}
            {status.kind === "empty" && <li className="bp-note">候補が見つかりません</li>}
            {status.kind === "error" && <li className="bp-note bp-error">{status.text}</li>}
            {candidates.map((p, i) => (
              <li
                key={`${p.displayName}|${p.latitude}|${p.longitude}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? "bp-option is-active" : "bp-option"}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(p)}
              >
                {p.displayName}
              </li>
            ))}
          </ul>
        )}
      </span>
      {editing && <span className="bp-hint">候補から選ぶと出生地が確定します</span>}
    </label>
  );
}
