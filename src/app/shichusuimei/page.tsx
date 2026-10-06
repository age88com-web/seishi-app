"use client";

// src/app/shichusuimei/page.tsx
//
// 四柱推命 Phase 1 の検証用 UI（本番デザインではない）。
// 計算ロジックは持たず、src/lib/shichusuimei の calculateShichusuimei() を呼んで
// 補正情報・四柱・大運・蔵干・通変星・神煞（各柱・各大運に表示）・干支関係を表示する。

import { useMemo, useState } from "react";
import AppSwitcher from "@/components/AppSwitcher";
import NatalProfileForm from "@/components/NatalProfileForm";
import { getNatalProfile, useNatalProfile } from "@/lib/natalProfile/store";
import { calculateShichusuimei } from "@/lib/shichusuimei";
import type {
  Relation,
  ShichusuimeiInput,
  ShichusuimeiResult,
  TimeCorrection,
} from "@/lib/shichusuimei";
import { assessKakkyoku, EMPTY_DECISION } from "@/lib/shichusuimei/kakkyoku";
import type { PractitionerDecision } from "@/lib/shichusuimei/kakkyoku";
import { GENDER_LABEL } from "@/lib/natalProfile/types";
import type { CommonNatalProfile } from "@/lib/natalProfile/types";
import KakkyokuView from "./KakkyokuView";
import { DaiunView, PillarsView } from "./MeishikiParts";
import ShichusuimeiChartPrint from "./print/ShichusuimeiChartPrint";
import { PrintRoot, usePrintMode, type PrintHeaderInfo } from "@/components/print/PrintRoot";
import "@/components/print/print.css";
import { p22NameForBirthPlace, profileToShichusuimeiInput, shichusuimeiSettings } from "./profileAdapter";
import "./shichusuimei.css";
import "./print.css";

type Computed = { result: ShichusuimeiResult } | { error: string };

function compute(input: ShichusuimeiInput): Computed {
  try {
    return { result: calculateShichusuimei(input) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** "YYYY-MM-DDTHH:mm:ss" → "YYYY-MM-DD HH:mm" */
const wallTime = (s: string) => `${s.slice(0, 10)} ${s.slice(11, 16)}`;

/** 入力した現地の時計の時刻（出生の瞬間＋法定オフセット） */
function legalLocalTime(tc: TimeCorrection): string {
  const d = new Date(Date.parse(tc.utc) + tc.legalOffsetMinutes * 60_000);
  return wallTime(d.toISOString());
}

function relationLabel(x: Relation): string {
  return x.members.map((m) => `${m.pillar}${m.part}${m.value}`).join("・");
}

export default function ShichusuimeiPage() {
  // 人物情報・出生地は共通プロフィール（3術共通）、標準時オフセットは四柱推命固有の設定
  const { profile, hydrated, revision } = useNatalProfile();
  const settings = shichusuimeiSettings.useSettings();
  // 計算ボタン（または顧客の読み込み）時点の入力。null は未計算
  const [submitted, setSubmitted] = useState<ReturnType<typeof profileToShichusuimeiInput> | null>(null);
  // 計算時点の人物情報（印刷ヘッダー用。計算後に入力欄を編集しても印刷内容と命式がずれないように）
  const [submittedProfile, setSubmittedProfile] = useState<CommonNatalProfile | null>(null);
  // 術者の最終格局（KD19）。命式を計算し直したらリセットする。永続保存はしない
  const [decision, setDecision] = useState<PractitionerDecision>(EMPTY_DECISION);
  const computed = useMemo<Computed | null>(
    () => (submitted === null ? null : "error" in submitted ? submitted : compute(submitted.input)),
    [submitted],
  );
  const submit = () => {
    setSubmitted(profileToShichusuimeiInput(getNatalProfile(), shichusuimeiSettings.get()));
    setSubmittedProfile(getNatalProfile());
    setDecision(EMPTY_DECISION);
  };

  // ページを開いたとき・顧客を読み込んだとき（revision が変わったとき）は、その入力で計算する
  const [autoSubmittedRevision, setAutoSubmittedRevision] = useState<number | null>(null);
  if (hydrated && autoSubmittedRevision !== revision) {
    setAutoSubmittedRevision(revision);
    setSubmitted(profileToShichusuimeiInput(profile, settings));
    setSubmittedProfile(profile);
    setDecision(EMPTY_DECISION);
  }
  // 地域時差の求め方（表示のみ。計算は profileToShichusuimeiInput → エンジン）
  const p22Name = p22NameForBirthPlace(profile.birthPlace);
  const printAs = usePrintMode();

  return (
    <>
      <AppSwitcher />
      <main className="sc-page">
        <h1 className="sc-h1 sc-no-print">四柱推命</h1>

        {/* 1. 共通人物入力UI */}
        <NatalProfileForm timeLabel="出生時刻（現地の時計）" />

        {/* 2. 四柱推命固有の設定 */}
        <form
          className="sc-form sc-no-print"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="sc-field">
            標準時UTCオフセット（時間）
            <input
              className="sc-input"
              inputMode="decimal"
              placeholder="Asia/Tokyo は空欄で +9"
              value={settings.standardOffset}
              onChange={(e) => shichusuimeiSettings.set({ standardOffset: e.target.value })}
            />
          </label>
          <button className="sc-button" type="submit">
            計算
          </button>
        </form>
        {hydrated && profile.birthPlace.trim() !== "" && (
          <p className="sc-note sc-no-print">
            地域時差：
            {p22Name
              ? `講座p22の表「${p22Name}」の値`
              : profile.longitude !== null
                ? `出生地の経度（${profile.longitude >= 0 ? "東経" : "西経"}${Math.abs(profile.longitude).toFixed(2)}°）から計算`
                : "出生地を候補から選んでください"}
          </p>
        )}
        <p className="sc-note sc-no-print">
          海外出生は標準時UTCオフセットが必須です。
        </p>

        {/* 3. 計算・鑑定結果 */}
        {computed === null ? null : "error" in computed ? (
          <div className="sc-error">{computed.error}</div>
        ) : (
          <>
            <div className="sc-print-bar sc-no-print">
              <button className="sc-print-button" type="button" onClick={() => printAs("chart")}>
                命式を印刷
              </button>
            </div>
            <ResultView r={computed.result} decision={decision} onDecisionChange={setDecision} />
            {/* 印刷専用レイアウト（画面には出さない） */}
            {submittedProfile && (
              <PrintRoot kind="chart" page="size: A4 portrait; margin: 30mm 22mm 30mm 22mm;">
                <ShichusuimeiChartPrint
                  info={printInfoOf(submittedProfile)}
                  r={computed.result}
                  k={assessKakkyoku(computed.result.meishiki.pillars)}
                />
              </PrintRoot>
            )}
          </>
        )}
      </main>
    </>
  );
}

/** 印刷の見出し用の基本情報（計算時点の人物情報） */
function printInfoOf(p: CommonNatalProfile): PrintHeaderInfo {
  return {
    name: p.name.trim() || null,
    birthDate: p.birthDate.replaceAll("-", "/"),
    birthTime: p.birthTimeUnknown ? "不明" : p.birthTime,
    sex: GENDER_LABEL[p.gender],
    place: p.birthPlace.trim(),
  };
}

function ResultView({
  r,
  decision,
  onDecisionChange,
}: {
  r: ShichusuimeiResult;
  decision: PractitionerDecision;
  onDecisionChange: (d: PractitionerDecision) => void;
}) {
  const tc = r.meishiki.timeCorrection;
  return (
    <>
      <div className="sc-layout">
        <div className="sc-main">
          <PillarsView r={r} />
          <DaiunView r={r} />

          <KakkyokuView k={assessKakkyoku(r.meishiki.pillars)} decision={decision} onDecisionChange={onDecisionChange} />
        </div>

        <aside className="sc-side">
          <section className="sc-section">
            <h2 className="sc-h2">補正情報</h2>
            {tc ? (
              <table className="sc-kv">
                <tbody>
                  <tr><th>入力時刻</th><td>{legalLocalTime(tc)}</td></tr>
                  <tr><th>地方真太陽時</th><td><b>{wallTime(tc.localApparentSolarTime)}</b></td></tr>
                  {tc.dstMinutes !== 0 ? <tr><th>DST補正</th><td>あり</td></tr> : null}
                  {tc.dayChangedAt23 ? <tr><th>23:00換日</th><td>あり（日柱は翌日）</td></tr> : null}
                </tbody>
              </table>
            ) : (
              <p className="sc-note">時刻不明のため補正なし（時柱なし）。</p>
            )}
          </section>
        </aside>
      </div>

      <section className="sc-section">
        <h2 className="sc-h2">干支関係（存在検出のみ）</h2>
        {r.relations.length === 0 ? (
          <p className="sc-note">該当なし</p>
        ) : (
          <div className="sc-scroll">
            <table className="sc-grid">
              <thead>
                <tr><th>種類</th><th>該当</th><th>備考</th></tr>
              </thead>
              <tbody>
                {r.relations.map((x, i) => (
                  <tr key={i}>
                    <td>{x.type}</td>
                    <td>{relationLabel(x)}</td>
                    <td className="sc-muted">
                      {x.tableElement ? `表の化・局: ${x.tableElement}` : ""}
                      {x.complete !== undefined ? (x.complete ? "3支そろう" : "2支のみ") : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
