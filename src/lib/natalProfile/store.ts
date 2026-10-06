"use client";

// src/lib/natalProfile/store.ts
//
// 共通プロフィールの唯一の状態（モジュール単位のストア＋localStorage）。
//   - 3術ページはすべてここを読み書きする（ページごとの useState は持たない）。
//   - クライアント側のページ遷移ではモジュールの状態がそのまま残り、
//     再読み込み時は localStorage から復元する。
//   - 顧客DBから読み込んだプロフィールも loadNatalProfile() で同じ状態へ入る。
//
// revision は「外部から丸ごと読み込まれた回数」（顧客の呼び出し・新規入力・別タブでの変更）。
// 各ページは revision の変化で計算をやり直す（入力欄の編集では増えない）。

import { useSyncExternalStore } from "react";
import { DEFAULT_NATAL_PROFILE } from "./types";
import type { CommonNatalProfile, NatalGender } from "./types";

const STORAGE_KEY = "seishi_natal_profile_v1";
/** 共通化前に七政四餘ページが使っていたキー（初回だけ引き継ぐ） */
const LEGACY_QIZHENG_KEY = "seishi_inputs";

export interface NatalProfileState {
  profile: CommonNatalProfile;
  /** localStorage からの復元が済んだか（サーバー描画・ハイドレーション中は false） */
  hydrated: boolean;
  revision: number;
}

const SERVER_STATE: NatalProfileState = {
  profile: DEFAULT_NATAL_PROFILE,
  hydrated: false,
  revision: 0,
};

let state: NatalProfileState | null = null;
const listeners = new Set<() => void>();

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";

/** 保存値を検証しながら既定値に重ねる（壊れた値・古い形式で落ちないように） */
function sanitize(v: unknown): CommonNatalProfile {
  const p = { ...DEFAULT_NATAL_PROFILE };
  if (!v || typeof v !== "object") return p;
  const o = v as Record<string, unknown>;
  if (o.clientId === null || (isNum(o.clientId) && Number.isInteger(o.clientId) && o.clientId > 0)) {
    p.clientId = o.clientId as number | null;
  }
  if (isStr(o.name)) p.name = o.name;
  if (isStr(o.birthDate)) p.birthDate = o.birthDate;
  if (isStr(o.birthTime)) p.birthTime = o.birthTime;
  if (typeof o.birthTimeUnknown === "boolean") p.birthTimeUnknown = o.birthTimeUnknown;
  if (o.gender === "male" || o.gender === "female") p.gender = o.gender as NatalGender;
  if (isStr(o.birthPlace)) p.birthPlace = o.birthPlace;
  if (o.latitude === null || isNum(o.latitude)) p.latitude = o.latitude as number | null;
  if (o.longitude === null || isNum(o.longitude)) p.longitude = o.longitude as number | null;
  if (isStr(o.timeZone) && o.timeZone.trim() !== "") p.timeZone = o.timeZone;
  return p;
}

function readStorage(): CommonNatalProfile {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return sanitize(JSON.parse(s));
    const legacy = localStorage.getItem(LEGACY_QIZHENG_KEY);
    if (legacy) {
      const v = JSON.parse(legacy) as Record<string, unknown>;
      return sanitize({
        birthDate: v.date,
        birthTime: v.time,
        birthPlace: v.place,
        latitude: v.lat,
        longitude: v.lon,
      });
    }
  } catch {}
  return { ...DEFAULT_NATAL_PROFILE };
}

function writeStorage(p: CommonNatalProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {}
}

function getState(): NatalProfileState {
  if (state) return state;
  state = { profile: readStorage(), hydrated: true, revision: 0 };
  // 別タブでの変更も反映する
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || e.newValue === null) return;
    try {
      setState({ profile: sanitize(JSON.parse(e.newValue)), bump: true, persist: false });
    } catch {}
  });
  return state;
}

function setState({
  profile,
  bump,
  persist = true,
}: {
  profile: CommonNatalProfile;
  bump: boolean;
  persist?: boolean;
}): void {
  const cur = getState();
  state = { profile, hydrated: true, revision: bump ? cur.revision + 1 : cur.revision };
  if (persist) writeStorage(profile);
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---- 操作 -------------------------------------------------------------------

export function getNatalProfile(): CommonNatalProfile {
  return getState().profile;
}

/** 入力欄の編集（revision は増やさない＝計算はページ側の操作で行う） */
export function updateNatalProfile(patch: Partial<CommonNatalProfile>): void {
  setState({ profile: { ...getState().profile, ...patch }, bump: false });
}

/** 顧客DBなど外部からプロフィールを丸ごと読み込む（各ページは再計算する） */
export function loadNatalProfile(profile: CommonNatalProfile): void {
  setState({ profile: sanitize(profile), bump: true });
}

/** 保存成功後に client_id だけを設定する（再計算はしない） */
export function setNatalClientId(clientId: number): void {
  setState({ profile: { ...getState().profile, clientId }, bump: false });
}

/**
 * 顧客が削除されたとき: 読み込み中の顧客が削除対象なら client_id だけ外す
 * （入力値は残す。次の「保存」は新規登録になる）。
 */
export function forgetDeletedClients(deletedIds: readonly number[]): void {
  const cur = getState().profile;
  if (cur.clientId !== null && deletedIds.includes(cur.clientId)) {
    setState({ profile: { ...cur, clientId: null }, bump: false });
  }
}

/** 新規入力に戻す（既定値・client_id なし） */
export function resetNatalProfile(): void {
  setState({ profile: { ...DEFAULT_NATAL_PROFILE }, bump: true });
}

export function useNatalProfile(): NatalProfileState {
  return useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
}
