"use client";

// src/components/NatalProfileForm.tsx
//
// 命術3種（七政四餘・紫微斗数・四柱推命）共通の人物入力UI（紫微斗数の入力欄のデザインを基準）。
//   - 値はすべて共通プロフィールストア（src/lib/natalProfile/store.ts）に直接書く。
//     ページごとの入力 state は持たないので、どのページで入力しても他の2ページへ反映される。
//   - 「保存」で顧客DBへ保存する（client_id なし→新規登録、あり→同じ client_id を更新。
//     処理は src/lib/natalProfile/saveClient.ts。四柱推命の「命式を印刷」も同じ処理を使う）。
//   - URL の ?clientId=12 があれば、その顧客をDBから取得して共通プロフィールへ読み込む
//     （顧客管理ページからの呼び出し）。URL から clientId を外すのは読み込みに成功した後だけ
//     （失敗時は残す）。React Strict Mode の effect 再実行でも取得は1回・読み込みは1回になるよう、
//     同じ clientId の取得は1つの Promise を共有する。
//   - 生年月日はカレンダー（type="date"）に加えて「西暦年」欄でも変えられる（birthDate と双方向に同期）。
//     西暦年欄は入力途中の文字列を保持し、4桁の年になった時点で birthDate の年だけを差し替える（月・日は維持。
//     うるう年の2/29など存在しない日になるときは、その月の最終日に丸める）。
//   - 出生地は共通の出生地UI（BirthplaceInput）で市区町村を検索・選択して確定する（地点名・緯度・経度）。
//     時差補正は占術ごとに別の既存処理（七政四餘・紫微斗数・四柱推命）で、ここでは計算しない。
//   - 各占術固有の設定（標準時オフセット・昼夜・命宮方式など）はここに置かず、各ページ側に置く。

import { useEffect, useState } from "react";
import {
  loadNatalProfile,
  resetNatalProfile,
  updateNatalProfile,
  useNatalProfile,
} from "@/lib/natalProfile/store";
import type { NatalGender } from "@/lib/natalProfile/types";
import { readError, saveNatalProfileToClients } from "@/lib/natalProfile/saveClient";
import { CLIENT_NAME_MAX, recordToProfile } from "@/lib/clients/types";
import type { ClientRecord } from "@/lib/clients/types";
import BirthplaceInput from "./BirthplaceInput";
import "./NatalProfileForm.css";

const TIME_ZONES = [
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Vienna",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Sydney",
  "Asia/Shanghai",
  "Asia/Seoul",
  "Asia/Taipei",
];

type Status = { kind: "ok" | "error" | "info"; text: string } | null;

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** birthDate（YYYY-MM-DD）の年。読めなければ "" */
function yearOf(birthDate: string): string {
  return YMD.exec(birthDate)?.[1] ?? "";
}

/**
 * birthDate の年だけを year に差し替える（月・日は維持）。存在しない日（2/29 → 平年）はその月の最終日に丸める。
 * birthDate が未入力・不正なら null（月日が無いので差し替えない）。
 */
export function replaceBirthYear(birthDate: string, year: number): string | null {
  const m = YMD.exec(birthDate);
  if (!m) return null;
  const day = Math.min(Number(m[3]), daysInMonth(year, Number(m[2])));
  return `${String(year).padStart(4, "0")}-${m[2]}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31;
}

/** 取得中の顧客（clientId → 取得の Promise）。effect が再実行されても同じ取得を待つ */
const clientFetches = new Map<number, Promise<ClientRecord>>();
function fetchClientOnce(id: number): Promise<ClientRecord> {
  let p = clientFetches.get(id);
  if (!p) {
    p = (async () => {
      const r = await fetch(`/api/clients/${id}`, { cache: "no-store" });
      if (!r.ok) throw new Error(await readError(r, "顧客情報を読み込めませんでした"));
      return ((await r.json()) as { client: ClientRecord }).client;
    })();
    clientFetches.set(id, p);
    // 終わったら外す（失敗後の再読み込み・同じ顧客の再呼び出しで取り直せるように）
    p.finally(() => clientFetches.delete(id)).catch(() => {});
  }
  return p;
}

/** URL から clientId を外す（他のクエリ・ハッシュは残す） */
function removeClientIdFromUrl(raw: string): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get("clientId") !== raw) return;
  params.delete("clientId");
  const rest = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
}

export default function NatalProfileForm({ timeLabel = "出生時刻" }: { timeLabel?: string }) {
  const { profile, hydrated } = useNatalProfile();
  const [status, setStatus] = useState<Status>(null);
  const [saving, setSaving] = useState(false);

  // 西暦年欄（入力途中の文字列）。birthDate がカレンダー・顧客読み込みなどで変わったら年を追随する
  const [yearStr, setYearStr] = useState(() => yearOf(profile.birthDate));
  const [yearSyncedDate, setYearSyncedDate] = useState(profile.birthDate);
  if (yearSyncedDate !== profile.birthDate) {
    setYearSyncedDate(profile.birthDate);
    setYearStr(yearOf(profile.birthDate));
  }
  const changeYear = (v: string) => {
    const digits = v.replace(/[^\d]/g, "").slice(0, 4);
    setYearStr(digits);
    if (!/^\d{4}$/.test(digits) || Number(digits) < 1) return;
    const next = replaceBirthYear(profile.birthDate, Number(digits));
    if (next === null || next === profile.birthDate) return;
    // 自分で書いた birthDate では年欄を上書きしない（入力中の文字列のまま）
    setYearSyncedDate(next);
    updateNatalProfile({ birthDate: next });
  };

  // 顧客管理ページからの呼び出し（?clientId=12）
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("clientId");
    if (raw === null) return;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      setStatus({ kind: "error", text: "顧客IDが不正です" });
      return;
    }
    // Strict Mode では「実行 → cleanup → 再実行」になる。cleanup 済みの1回目は何もせず、
    // 再実行側が同じ取得（fetchClientOnce）の結果で読み込む。URL の clientId は読み込み成功後に外す
    let cancelled = false;
    setStatus({ kind: "info", text: "顧客情報を読み込み中…" });
    fetchClientOnce(id)
      .then((client) => {
        if (cancelled) return;
        loadNatalProfile(recordToProfile(client));
        removeClientIdFromUrl(raw);
        setStatus({ kind: "ok", text: `「${client.name}」を読み込みました` });
      })
      .catch((e: unknown) => {
        if (!cancelled) setStatus({ kind: "error", text: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canSave = hydrated && profile.name.trim() !== "" && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setStatus(null);
    try {
      const { created } = await saveNatalProfileToClients();
      setStatus({ kind: "ok", text: created ? "新規保存しました" : "更新しました" });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="np-box" aria-label="人物情報">
      <div className="np-form">
        <label className="np-field">
          姓名
          <input
            className="np-input np-name"
            value={profile.name}
            maxLength={CLIENT_NAME_MAX}
            placeholder="山田太郎"
            onChange={(e) => updateNatalProfile({ name: e.target.value })}
          />
        </label>
        <label className="np-field">
          生年月日
          <input
            className="np-input"
            type="date"
            value={profile.birthDate}
            onChange={(e) => updateNatalProfile({ birthDate: e.target.value })}
          />
        </label>
        <label className="np-field">
          西暦年
          <input
            className="np-input np-year"
            type="number"
            inputMode="numeric"
            min={1}
            max={9999}
            step={1}
            value={yearStr}
            disabled={yearOf(profile.birthDate) === ""}
            onChange={(e) => changeYear(e.target.value)}
            // 4桁にならないまま離れたら、生年月日の年に戻す
            onBlur={() => setYearStr(yearOf(profile.birthDate))}
          />
        </label>
        <label className="np-field">
          {timeLabel}
          <input
            className="np-input"
            type="time"
            value={profile.birthTime}
            disabled={profile.birthTimeUnknown}
            onChange={(e) => updateNatalProfile({ birthTime: e.target.value })}
          />
        </label>
        <label className="np-check">
          <input
            type="checkbox"
            checked={profile.birthTimeUnknown}
            onChange={(e) => updateNatalProfile({ birthTimeUnknown: e.target.checked })}
          />
          時刻不明
        </label>
        <label className="np-field">
          性別
          <select
            className="np-input"
            value={profile.gender}
            onChange={(e) => updateNatalProfile({ gender: e.target.value as NatalGender })}
          >
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
        </label>
        {/* 出生地: 市区町村を検索して候補から確定（地点名・緯度・経度。時差の計算は各占術の既存処理） */}
        <BirthplaceInput
          value={profile.birthPlace}
          onSelect={(p) =>
            updateNatalProfile({
              birthPlace: p.displayName,
              latitude: p.latitude,
              longitude: p.longitude,
              // 国内の地点は日本標準時。海外はタイムゾーン欄で指定する
              ...(p.countryCode === "JP" ? { timeZone: "Asia/Tokyo" } : {}),
            })
          }
        />
        <label className="np-field">
          タイムゾーン
          <input
            className="np-input np-tz"
            list="np-tz"
            value={profile.timeZone}
            onChange={(e) => updateNatalProfile({ timeZone: e.target.value })}
          />
          <datalist id="np-tz">
            {TIME_ZONES.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </label>
        <span className="np-actions">
          <button className="np-button" type="button" onClick={save} disabled={!canSave}>
            {saving ? "保存中…" : "保存"}
          </button>
          <button
            className="np-sub-button"
            type="button"
            onClick={() => {
              resetNatalProfile();
              setStatus(null);
            }}
          >
            新規入力
          </button>
        </span>
      </div>
      <div className="np-status">
        <span className="np-muted">
          {profile.clientId === null ? "未保存の新規入力" : `顧客ID ${profile.clientId} を編集中（保存で上書き）`}
        </span>
        {status && <span className={`np-msg np-msg-${status.kind}`}>{status.text}</span>}
      </div>
    </section>
  );
}
