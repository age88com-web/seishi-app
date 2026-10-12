"use client";

// src/app/clients/page.tsx
//
// 顧客管理（顧客名簿）。ログイン中ユーザーの顧客だけを一覧表示する（API 側で user_id を絞る）。
// 各行の [七政四餘] [紫微斗数] [四柱推命] で、その占術ページを ?clientId=… 付きで開く。
// 開いたページの共通入力UI（NatalProfileForm）が顧客情報をDBから取得して共通プロフィールへ読み込み、
// そのまま既存の計算を行う。
// 削除: 各行のチェックボックス（ヘッダーで全選択／全解除）で選び「選択した顧客を削除」、または各行の「削除」。
//   必ず確認ダイアログを出してから DELETE /api/clients（API 側で user_id を条件に削除）。編集は今後追加する。

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppSwitcher from "@/components/AppSwitcher";
import { forgetDeletedClients } from "@/lib/natalProfile/store";
import { GENDER_LABEL } from "@/lib/natalProfile/types";
import type { ClientRecord } from "@/lib/clients/types";
import "./clients.css";

const ARTS = [
  { href: "/", label: "七政四餘" },
  { href: "/ziwei", label: "紫微斗数" },
  { href: "/shichusuimei", label: "四柱推命" },
] as const;

const pad2 = (n: number) => String(n).padStart(2, "0");
function localDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

type Load = { kind: "loading" } | { kind: "error"; text: string } | { kind: "ok"; clients: ClientRecord[] };

type Message = { kind: "ok" | "error"; text: string } | null;

/** 全選択チェックボックス（一部だけ選ばれているときは indeterminate 表示） */
function SelectAllCheckbox({ total, selected, onToggle }: { total: number; selected: number; onToggle: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = selected > 0 && selected < total;
  }, [selected, total]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="全選択"
      checked={total > 0 && selected === total}
      onChange={onToggle}
    />
  );
}

export default function ClientsPage() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  // 選択中の顧客 id（画面だけの状態）
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const fetchClients = useCallback(async (): Promise<Load> => {
    try {
      const r = await fetch("/api/clients", { cache: "no-store" });
      if (r.status === 401) throw new Error("ログインが必要です（/login からログインしてください）");
      if (!r.ok) throw new Error("顧客一覧を読み込めませんでした");
      const j = (await r.json()) as { clients: ClientRecord[] };
      return { kind: "ok", clients: j.clients };
    } catch (e) {
      return { kind: "error", text: e instanceof Error ? e.message : String(e) };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchClients().then((l) => {
      if (!cancelled) setLoad(l);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchClients]);

  const clients = load.kind === "ok" ? load.clients : [];
  // 一覧にない id（再取得で消えたもの）は選択から外して数える
  const selectedIds = clients.filter((c) => selected.has(c.id)).map((c) => c.id);

  const toggle = (id: number) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(selectedIds.length === clients.length ? new Set() : new Set(clients.map((c) => c.id)));

  async function remove(ids: number[], label: string) {
    if (ids.length === 0 || deleting) return;
    if (!window.confirm(`${label}を削除します。\nこの操作は元に戻せません。よろしいですか？`)) return;
    setDeleting(true);
    setMessage(null);
    try {
      const r = await fetch("/api/clients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const j = (await r.json().catch(() => ({}))) as { deletedIds?: number[]; error?: string };
      if (!r.ok) throw new Error(r.status === 401 ? "ログインが必要です（/login からログインしてください）" : (j.error ?? "削除に失敗しました"));
      const deletedIds = j.deletedIds ?? [];
      // 入力欄に読み込み中の顧客を削除した場合は、次の保存が新規登録になるよう client_id を外す
      forgetDeletedClients(deletedIds);
      setMessage({ kind: "ok", text: `${deletedIds.length}件削除しました` });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSelected(new Set());
      setLoad(await fetchClients());
      setDeleting(false);
    }
  }

  return (
    <>
      <AppSwitcher />
      <main className="cl-page">
        <h1 className="cl-h1">顧客管理</h1>
        <p className="cl-note">
          顧客は七政四餘・紫微斗数・四柱推命の共通入力欄の「保存」で登録されます。各ボタンでその占術の画面を開き、顧客情報を入力欄へ読み込みます。
        </p>

        <div className="cl-toolbar">
          <button
            className="cl-danger-button"
            type="button"
            disabled={selectedIds.length === 0 || deleting}
            onClick={() => remove(selectedIds, `選択した${selectedIds.length}件の顧客`)}
          >
            {deleting ? "削除中…" : `選択した顧客を削除${selectedIds.length > 0 ? `（${selectedIds.length}件）` : ""}`}
          </button>
          {message && <span className={message.kind === "ok" ? "cl-msg-ok" : "cl-msg-error"}>{message.text}</span>}
        </div>

        {load.kind === "loading" && <p className="cl-note">読み込み中…</p>}
        {load.kind === "error" && <div className="cl-error">{load.text}</div>}
        {load.kind === "ok" && load.clients.length === 0 && <p className="cl-note">保存された顧客はまだありません。</p>}
        {load.kind === "ok" && load.clients.length > 0 && (
          <div className="cl-scroll">
            <table className="cl-table">
              <thead>
                <tr>
                  <th className="cl-check">
                    <SelectAllCheckbox total={clients.length} selected={selectedIds.length} onToggle={toggleAll} />
                  </th>
                  <th>姓名</th>
                  <th>生年月日</th>
                  <th>出生時刻</th>
                  <th>性別</th>
                  <th>出生地</th>
                  <th>更新日時</th>
                  <th>鑑定</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {load.clients.map((c) => (
                  <tr key={c.id} className={selected.has(c.id) ? "is-selected" : undefined}>
                    <td className="cl-check">
                      <input
                        type="checkbox"
                        aria-label={`${c.name}を選択`}
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                    </td>
                    <td className="cl-name">{c.name}</td>
                    <td>{c.birthDate.replaceAll("-", "/")}</td>
                    <td>{c.birthTimeUnknown ? "不明" : c.birthTime}</td>
                    <td>{GENDER_LABEL[c.gender]}</td>
                    <td>{c.birthPlace || "—"}</td>
                    <td className="cl-muted">{localDateTime(c.updatedAt)}</td>
                    <td>
                      <span className="cl-actions">
                        {ARTS.map((a) => (
                          <Link key={a.href} className="cl-button" href={`${a.href}?clientId=${c.id}`}>
                            {a.label}
                          </Link>
                        ))}
                      </span>
                    </td>
                    <td>
                      <button
                        className="cl-row-delete"
                        type="button"
                        disabled={deleting}
                        onClick={() => remove([c.id], `「${c.name}」`)}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
