// src/app/liuren/personInputs.ts
//
// 六壬神課 総合解釈の追加情報の入力基盤（Phase 5U）。画面の入力値を、既存の InterpretationContext に変換するだけ。
// 人物・本命・行年・類神の型と算法は既存のものを使う（新しい人物モデル・算法・対応表は作らない）:
//   人物 … InterpretationPerson（id・natalYear）。ID は画面側で決めた固定値で、利用者には入力させず表示もしない
//   本命 … natalYearStateOf（生年干支を明示入力。生年月日からの換算はしない。六十干支だけを選ばせる）
//   行年 … XingNianInput（personId・sex・reckonedAge）。数え年は明示入力だけ（生年月日から計算しない）。
//          女性・性別未指定・数え年なしの扱いは xingNian.ts のまま（男性の算法を当てはめない。DOMAIN が不足として返す）
//   類神 … TargetSymbol（天将か支を明示指定。自動では決めない）
//   太歳 … taiSui.ts は暦の年干支を使わない方針。行人の規則は太歳を使わないので、今回は入力欄を出さない
//
// 占的ごとの入力項目は DOMAIN_INPUT_SPECS に置く（使う占的の欄だけを出す）。今回あるのは行人だけ。
//   行人: 外出中の人（travelerPersonId）の本命・性別・数え年、類神。問う人（subjectPersonId）は、利用者が
//         「行人は問う人本人」と明示したときだけ、行人と同じ人物 ID にする（既定は別人物で、問う人の情報は入れない）。
//         行人 DOMAIN は問う人の本命を行人の読みに使わないので、問う人の本命は入力させない。

import type { Branch, Stem } from "@/lib/liuren";
import { BRANCHES, STEMS } from "@/lib/eto";
import { natalYearStateOf } from "@/lib/liuren/interpretation/natalYear";
import type { InterpretationContext, InterpretationPerson, PersonContextId, TargetSymbol } from "@/lib/liuren/interpretation/roles";
import type { XingNianInput } from "@/lib/liuren/interpretation/xingNian";
import type { HeavenlyGeneral } from "@/lib/liuren";

/** 画面で扱う人物の枠（context の人物 ID の項目に対応する。今回の画面で使うのは traveler だけ） */
export type PersonSlot = "subject" | "traveler" | "counterparty" | "patient" | "wealthSeeker" | "litigant" | "owner" | "pregnant";

/** 人物の枠 → InterpretationContext の人物 ID の項目（roles.ts のとおり） */
export const SLOT_CONTEXT_FIELD = {
  subject: "subjectPersonId", traveler: "travelerPersonId", counterparty: "counterpartyPersonId", patient: "patientPersonId",
  wealthSeeker: "wealthSeekerPersonId", litigant: "litigantPersonId", owner: "ownerPersonId", pregnant: "pregnantPersonId",
} as const satisfies Record<PersonSlot, keyof InterpretationContext>;

/** 人物の枠の内部 ID（画面側で固定。利用者には見せない） */
const SLOT_ID: Record<PersonSlot, PersonContextId> = {
  subject: "p-subject", traveler: "p-traveler", counterparty: "p-counterparty", patient: "p-patient",
  wealthSeeker: "p-wealth-seeker", litigant: "p-litigant", owner: "p-owner", pregnant: "p-pregnant",
};

/** 1人分の入力（空文字は未入力） */
export interface PersonFormEntry {
  /** 生年干支（本命）。"" は未入力 */
  natal: string;
  /** 性別（行年の算法の選択だけに使う）。"" は未入力 */
  sex: "" | "male" | "female";
  /** 数え年（文字列のまま持ち、変換時に検査する）。"" は未入力 */
  reckonedAge: string;
}

export interface QuestionInputs {
  persons: Partial<Record<PersonSlot, PersonFormEntry>>;
  /** 問う人と、占的の対象人物（行人など）が同一人物と、利用者が明示したか */
  subjectIsTarget: boolean;
  /** 類神。"" は未指定。"general:天后" または "branch:子" */
  symbol: string;
}

export const EMPTY_PERSON: PersonFormEntry = { natal: "", sex: "", reckonedAge: "" };
export const EMPTY_INPUTS: QuestionInputs = { persons: {}, subjectIsTarget: false, symbol: "" };

/** 占的ごとの入力項目（画面に出す欄） */
export interface DomainInputSpec {
  /** 占断の対象人物の枠と、その表示名 */
  target: { slot: PersonSlot; label: string };
  /** 対象人物の本命・行年を入力させるか（その占的の規則が使うものだけ） */
  natal: boolean;
  xingNian: boolean;
  /** 「問う人本人」と明示できるようにするか */
  subjectIsTargetOption: boolean;
  /** 類神を指定できるようにするか */
  targetSymbol: boolean;
}

export const DOMAIN_INPUT_SPECS: Readonly<Partial<Record<InterpretationContext["domain"], DomainInputSpec>>> = {
  traveler: { target: { slot: "traveler", label: "行人（外出中の人）" }, natal: true, xingNian: true, subjectIsTargetOption: true, targetSymbol: true },
};

export const SIXTY: readonly string[] = Array.from({ length: 60 }, (_, i) => `${STEMS[i % 10]}${BRANCHES[i % 12]}`);
export const GENERALS: readonly HeavenlyGeneral[] = ["貴人", "螣蛇", "朱雀", "六合", "勾陳", "青龍", "天空", "白虎", "太常", "玄武", "太陰", "天后"];

/** 入力の問題（画面に日本語で出す。問題のある値は使わない） */
export interface InputWarning {
  field: "natal" | "reckonedAge" | "symbol";
  message: string;
}

/** 数え年: 1 以上 150 以下の整数だけを使う */
export function parseReckonedAge(s: string): number | null | "invalid" {
  const t = s.trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (t === "") return null;
  if (!/^\d+$/.test(t)) return "invalid";
  const n = Number(t);
  return n >= 1 && n <= 150 ? n : "invalid";
}

function symbolOf(s: string): TargetSymbol | null | "invalid" {
  if (s === "") return null;
  const [kind, v] = s.split(":");
  if (kind === "general" && (GENERALS as readonly string[]).includes(v)) return { kind: "general", general: v as HeavenlyGeneral };
  if (kind === "branch" && (BRANCHES as readonly string[]).includes(v)) return { kind: "branch", branch: v as Branch };
  return "invalid";
}

/**
 * 入力値 → InterpretationContext（base に人物・本命・行年・類神を足す）。未入力の項目は入れない（補完しない）。
 * 問題のある値は使わず、warnings に理由を返す。占的の入力項目がない DOMAIN では base をそのまま返す。
 */
export function contextWithInputs(base: InterpretationContext, inputs: QuestionInputs): { context: InterpretationContext; warnings: InputWarning[] } {
  const spec = DOMAIN_INPUT_SPECS[base.domain];
  const warnings: InputWarning[] = [];
  if (!spec) return { context: base, warnings };
  const entry = inputs.persons[spec.target.slot] ?? EMPTY_PERSON;
  const targetId = inputs.subjectIsTarget && spec.subjectIsTargetOption ? SLOT_ID.subject : SLOT_ID[spec.target.slot];
  const person: InterpretationPerson = { id: targetId };
  if (spec.natal && entry.natal) {
    if (SIXTY.includes(entry.natal)) person.natalYear = natalYearStateOf(entry.natal[0] as Stem, entry.natal[1] as Branch);
    else warnings.push({ field: "natal", message: "本命（生年干支）は一覧から選んでください（入力は使っていません）" });
  }
  const xingNianInputs: XingNianInput[] = [];
  if (spec.xingNian) {
    const age = parseReckonedAge(entry.reckonedAge);
    if (age === "invalid") warnings.push({ field: "reckonedAge", message: "数え年は1以上150以下の整数で入力してください（入力は使っていません）" });
    const x: XingNianInput = { personId: targetId, ...(entry.sex ? { sex: entry.sex } : {}), ...(typeof age === "number" ? { reckonedAge: age } : {}) };
    if (x.sex !== undefined || x.reckonedAge !== undefined) xingNianInputs.push(x);
  }
  // 人物の情報が一つも入力されていなければ、人物を作らない（未入力時の Context は従来と同じ）
  const hasPerson = person.natalYear !== undefined || xingNianInputs.length > 0 || (inputs.subjectIsTarget && spec.subjectIsTargetOption);
  const ctx: InterpretationContext = !hasPerson ? { ...base } : {
    ...base,
    persons: [person],
    [SLOT_CONTEXT_FIELD[spec.target.slot]]: targetId,
    ...(inputs.subjectIsTarget && spec.subjectIsTargetOption ? { subjectPersonId: targetId } : {}),
    ...(xingNianInputs.length ? { xingNianInputs } : {}),
  };
  if (spec.targetSymbol) {
    const sym = symbolOf(inputs.symbol);
    if (sym === "invalid") warnings.push({ field: "symbol", message: "類神は一覧から選んでください（入力は使っていません）" });
    else if (sym) ctx.targetSymbol = sym;
  }
  return { context: ctx, warnings };
}

/**
 * 数え年の再確認（入力確認のためだけ）: 数え年を入力したときの日時入力の西暦年と、いまの日時入力の西暦年が両方分かり、
 * 違うときだけ文を返す。数え年は計算も変更もしない。干支の年・立春などの年の境界は使わない（六壬の太歳・行年の年境界は未確定）。
 * どちらかの年が分からない（日干支の直接指定など）・数え年がないときは null（推測しない）。
 */
export function reckonedAgeYearNotice(enteredYear: number | null, currentYear: number | null, reckonedAge: string): string | null {
  if (enteredYear === null || currentYear === null || reckonedAge.trim() === "" || enteredYear === currentYear) return null;
  return `数え年を入力したときと占う年（西暦${enteredYear}年→${currentYear}年）が変わっています。数え年を確認してください（自動では変えません）。`;
}

/** 通常表示に出す入力の要約（日本語。内部 ID は出さない） */
export function inputSummary(base: InterpretationContext, inputs: QuestionInputs): { label: string; value: string }[] {
  const spec = DOMAIN_INPUT_SPECS[base.domain];
  if (!spec) return [];
  const e = inputs.persons[spec.target.slot] ?? EMPTY_PERSON, age = parseReckonedAge(e.reckonedAge), out: { label: string; value: string }[] = [];
  if (spec.subjectIsTargetOption) out.push({ label: "問う人", value: inputs.subjectIsTarget ? `${spec.target.label.replace(/（.*）$/, "")}本人` : `${spec.target.label.replace(/（.*）$/, "")}とは別の人（情報は使いません）` });
  if (spec.natal) out.push({ label: `${spec.target.label.replace(/（.*）$/, "")}の本命`, value: SIXTY.includes(e.natal) ? e.natal : "未入力" });
  if (spec.xingNian) out.push({ label: `${spec.target.label.replace(/（.*）$/, "")}の性別・数え年`, value: `${e.sex === "male" ? "男性" : e.sex === "female" ? "女性" : "性別未入力"}・${typeof age === "number" ? `数え${age}歳` : "数え年未入力"}` });
  if (spec.targetSymbol) { const s = symbolOf(inputs.symbol); out.push({ label: "類神", value: s && s !== "invalid" ? (s.kind === "general" ? s.general : s.branch) : "指定なし" }); }
  return out;
}
