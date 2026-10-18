// src/app/liuren/LiurenQuestionInputs.tsx
//
// 六壬神課 総合解釈の追加情報の入力欄（Phase 5U）。値はページ側が持ち、この部品は描画と変更の通知だけ（hooks なし）。
// 占的の入力項目（personInputs.ts の DOMAIN_INPUT_SPECS）にある欄だけを出す。項目名は日本語で、内部 ID は出さない。
// すべて任意で、未入力は「未入力」のまま（補完しない）。使わなかった入力は理由を日本語で出す。

import { BRANCHES } from "@/lib/eto";
import type { InterpretationContext } from "@/lib/liuren/interpretation/roles";
import { DOMAIN_INPUT_SPECS, EMPTY_PERSON, GENERALS, SIXTY } from "./personInputs";
import type { InputWarning, PersonFormEntry, QuestionInputs } from "./personInputs";

export default function LiurenQuestionInputs({ domain, value, warnings, onChange, ageNotice = null }: {
  domain: InterpretationContext["domain"]; value: QuestionInputs; warnings: readonly InputWarning[]; onChange: (v: QuestionInputs) => void;
  /** 数え年の再確認の文（personInputs.reckonedAgeYearNotice。なければ null） */
  ageNotice?: string | null;
}) {
  const spec = DOMAIN_INPUT_SPECS[domain];
  if (!spec) return null;
  const slot = spec.target.slot, who = spec.target.label.replace(/（.*）$/, "");
  const e = value.persons[slot] ?? EMPTY_PERSON;
  const setPerson = (patch: Partial<PersonFormEntry>) => onChange({ ...value, persons: { ...value.persons, [slot]: { ...e, ...patch } } });
  const warn = (f: InputWarning["field"]) => warnings.filter((w) => w.field === f).map((w, i) => <p key={i} className="lr-warn">{w.message}</p>);
  return (
    <fieldset className="lr-extra" data-testid="liuren-extra-inputs">
      <legend>追加情報（すべて任意）</legend>
      <p className="lr-extra-note">入力した情報だけを使います。分からない項目は空欄のままにしてください（推測で補いません）。</p>
      {spec.subjectIsTargetOption && (
        <label className="lr-extra-check">
          <input type="checkbox" checked={value.subjectIsTarget} onChange={(ev) => onChange({ ...value, subjectIsTarget: ev.target.checked })} data-testid="liuren-subject-is-target" />
          問う人が{who}本人である
        </label>
      )}
      <div className="lr-extra-grid">
        {spec.natal && (
          <label className="lr-field">
            {who}の本命（生年干支・任意）
            <select value={SIXTY.includes(e.natal) ? e.natal : ""} onChange={(ev) => setPerson({ natal: ev.target.value })} className="lr-input" data-testid="liuren-target-natal">
              <option value="">未入力</option>
              {SIXTY.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
        )}
        {spec.xingNian && (
          <>
            <label className="lr-field">
              {who}の性別（行年用・任意）
              <select value={e.sex} onChange={(ev) => setPerson({ sex: ev.target.value as PersonFormEntry["sex"] })} className="lr-input" data-testid="liuren-target-sex">
                <option value="">未入力</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
              </select>
            </label>
            <label className="lr-field">
              {who}の数え年（行年用・任意）
              <input type="text" inputMode="numeric" value={e.reckonedAge} onChange={(ev) => setPerson({ reckonedAge: ev.target.value })} className="lr-input lr-extra-age" placeholder="例: 38" data-testid="liuren-target-age" />
            </label>
          </>
        )}
        {spec.targetSymbol && (
          <label className="lr-field">
            類神（任意）
            <select value={value.symbol} onChange={(ev) => onChange({ ...value, symbol: ev.target.value })} className="lr-input" data-testid="liuren-symbol">
              <option value="">指定なし</option>
              <optgroup label="天将">{GENERALS.map((g) => <option key={g} value={`general:${g}`}>{g}</option>)}</optgroup>
              <optgroup label="支">{BRANCHES.map((b) => <option key={b} value={`branch:${b}`}>{b}</option>)}</optgroup>
            </select>
          </label>
        )}
      </div>
      {spec.xingNian && <p className="lr-extra-note">行年は、男性で数え年がある場合だけ求めます（女性の行年の算法は資料で確定していないため使いません）。数え年は生年月日から計算しません。</p>}
      {spec.targetSymbol && <p className="lr-extra-note">類神は、問う対象を表す天将または支を自分で選びます（自動では決めません）。</p>}
      {ageNotice && <p className="lr-warn" data-testid="liuren-age-notice">{ageNotice}</p>}
      {warn("natal")}{warn("reckonedAge")}{warn("symbol")}
    </fieldset>
  );
}
