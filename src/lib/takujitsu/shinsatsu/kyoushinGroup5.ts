// src/lib/takujitsu/shinsatsu/kyoushinGroup5.ts
//
// 役割:
//   擇日「日家凶神」第5グループ。これまで保留してきた凶神のうち、
//   二十四節気・節入り時刻（CalendarEngine の共通暦情報）を基準に
//   判定するものをまとめて実装する。
//
// 唯一の仕様根拠:
//   docs/source/擇日テキスト.pdf「日家凶神」章（このPDF以外は一切参照していない）。
//     ・18）四撃〜五虚の段落中に埋め込まれた「氣往望」の規定    p.25-26
//       （「氣往望」は同テキストp.49の洪氏錦嚢解説内で明確に
//       「気往亡」と印字されていることから、フォントのCID起因の
//       異体字（亡→望）と判断し、コード上は「氣往亡」を採用する）
//     ・26）四離・四絶                                    p.30
//     ・30）八節日                                        p.31
//     ・31）土王用事（土用）                              p.31
//   要約・補完・推測はしていない。
//
// 章全体の確認について（依頼どおり、候補4項目を決め打ちせず確認した）:
//   日家凶神章（1〜53番）を最後まで通読し、二十四節気・節入り時刻を
//   基準とする項目を洗い出した結果、上記4項目（四離・四絶・八節日・
//   土王用事・氣往亡）以外に該当するものは無かった。
//   検討したが対象外と判断した項目:
//     ・32）伏社: 夏至後の庚日（初伏・中伏・末伏）、二分前後の戊日
//       （春社・秋社）という「節気を起点に十干を数える」規定はあるが、
//       本文に「忌：」の記載が一切なく、凶神としての判定式
//       （何をもって凶とするか）が確定できないため対象外（保留）。
//     ・33）朔・弦・望・十五日: 「忌：求医療病」はあるが、上弦・下弦・
//       望は太陰太陽暦の朔（newMoonTime）だけでは求まらない月相角度
//       （90度・180度・270度）を要し、二十四節気とは別系統（太陰の
//       位相）の暦情報のため今回のグループの対象外（将来の別グループ
//       で扱う）。
//     ・49）天乙絶気: 月建の地支を酉まで逆算する固定表（正6,二7…）で、
//       節気・節入り時刻ではなく月令（monthBranch）だけで確定できる
//       ため、このグループの対象ではない（別グループ候補）。
//   17）往亡（月建ごとの固定地支表、凶神第3グループで実装済み）とは
//   別概念。18）の「氣往亡」は節気起点＋日数オフセットで判定するため
//   混同していない。
//
// 判定に必要な暦情報とCalendarEngineの利用方法（重要）:
//   ShinsatsuInput（yearStem/monthBranch/dayStem/dayBranch等）だけでは
//   「対象日の前日・N日後が特定の節気の節入り日か」を判定できない
//   （ShinsatsuInput は年月日そのものを持たない薄い型のため）。
//   一方で CalendarEngine の calculate()（src/lib/calendar の唯一の
//   公開関数）は、既に「対象時刻が属する節気名（solarTerm）」と
//   「その節気の節入り日時（solarTermDateTime、UTC ISO文字列）」を
//   常に返している。このグループは CalendarEngine を変更せず、
//   calculate() を「対象日からN日ずらした日」に対して複数回呼び出す
//   ことで、既に内部に存在する節気情報を公開している範囲だけで
//   判定する（新しいCalendarEngine APIの追加は不要だった）。
//   そのため本グループの入力は他グループと異なり ShinsatsuInput ではなく
//   CalendarInput（年月日時）を直接受け取る。calculateShinsatsu/
//   calculateTakujitsu からのみ呼び出す（他グループの呼び出し経路には
//   一切影響しない）。
//
// 日付境界について（重要。一般知識で決め打ちしていない）:
//   「前日」「N日後」は、日柱（干支日）の子初23:00切替とは無関係な
//   「対象日の暦通りの年月日（input.year/month/day）」を基準に加減算
//   する。節気の節入り自体は瞬間（時刻）だが、「その節気が入る日」は
//   対象日の現地（timezone）正午の時刻でCalendarEngineを呼び、その
//   瞬間に属する節気の節入り日時（solarTermDateTime）を現地の暦日に
//   変換して対象日と一致するかで判定する（節気は約15日に1回しか
//   起きないため、正午の代表点で「その暦日に節入りが起きたか」を
//   一意に判定できる）。農暦日（朔基準・0:00）や日柱（23:00切替）の
//   基準は一切使っていない。
//
// 解除条件として記録した事項（今回は実装しない。将来の「神殺解除・相殺」
// フェーズ用の記録のみ）:
//   ・26）四離・四絶: 「徳合と天願がきたら尚忌む」（p.30本文）。
//   ・30）八節日: 「徳合・赦願があわさると尚忌む」（p.31本文）。
//   ・31）土王用事: 「徳合・赦願があわさると尚忌む」（p.31本文）。
//   ・氣往亡: 「徳合・赦願が来たら更に忌む」（p.26本文）。
//
// 「土旺」と「土王用事」の関係について（本文だけから調査。確定できない
// ため実装では結びつけていない）:
//   ・p.4（母倉、吉神第2グループで実装済み）に「土王用事つまり土用の後は
//     必ず巳午となる」とあり、本文中で「土王用事＝土用」であることは
//     明記されている。
//   ・p.25（項目18、四撃〜五虚）の「土旺が重なると更に忌む」、および
//     p.32（伏社）の「社とは、土旺のことを指す」という記述から、
//     「土旺」は土気が旺じる期間を指す言葉として使われており、
//     「土王用事（土用）」と同じ現象を指している可能性が高いと考えられる。
//   ・しかし本文はどこにも「土旺＝土王用事」と明示する一文がなく、
//     項目18の「土旺が重なる」がどの具体的な期間・判定式を指すかの
//     記述も無い。そのため、項目18の四撃〜五虚と本グループの土王用事を
//     ロジック上で結びつけることはせず（推測になるため）、項目18側の
//     「土旺が重なると更に忌む」は解除条件と同様、記録のみに留める。
//   ・31）土王用事（土用）自体は本文に明確な判定式（四立の18日前）が
//     あるため、独立した凶神として実装する。
//   → 監修確定（2026-10-06）で上記の保留を解消:
//     ・「土旺」＝「土王用事（土用）」とする。
//     ・土王用事は「四立の18日前」の当日だけでなく、その日から四立の前日までの期間とする
//       （isDoyouPeriod）。
//     ・四撃〜五虚の「土旺が重なると更に忌む」は、この期間に重なるとき増悪
//       （resolution/rules.ts No.13a）。母倉の「土用の後は巳午」もこの期間を使う。
//
// 検証区分:
//   docs/source/擇日実例.pdf の吉凶神煞一覧表は「月令＋日辰（60干支）」
//   だけで構成された抽象的な参照表であり、実際の年月日（節気の実日付）
//   を持たない。四離・四絶・八節日・土王用事・氣往亡のいずれも
//   実例.pdf 全24ページに一度も出現しない（grep 済み、0件）ため、
//   本グループは全項目が区分B（擇日テキストの規定そのものを期待値と
//   した単体テストのみで検証）となる。

import { calculate as calculateCalendar, DEFAULT_TIMEZONE } from "@/lib/calendar";
import type { CalendarInput } from "@/lib/calendar";
import type { ShinsatsuResult } from "../types";

const MS_PER_DAY = 86_400_000;

/** 二至二分（四離の基準となる4つの中気）。 */
const NIJI_NIBUN: readonly string[] = ["冬至", "夏至", "春分", "秋分"];
/** 四立（四絶・八節日・土王用事の基準となる4つの節）。 */
const SHI_RITSU: readonly string[] = ["立春", "立夏", "立秋", "立冬"];

/**
 * 氣往亡（p.25-26、原文表記は「氣往望」＝「氣往亡」の異体字）の
 * 12組（節気名, その節入りからの経過日数）。数値はテキストのまま
 * （立春=7・啓蟄=14・清明=21 のように春=7の倍数、夏=8の倍数、
 * 秋=9の倍数、冬=10の倍数という規則性が本文の数字自体から確認できる）。
 */
const KI_OUBOU_TABLE: readonly { term: string; offsetDays: number }[] = [
  { term: "立春", offsetDays: 7 },
  { term: "啓蟄", offsetDays: 14 },
  { term: "清明", offsetDays: 21 },
  { term: "立夏", offsetDays: 8 },
  { term: "芒種", offsetDays: 16 },
  { term: "小暑", offsetDays: 24 },
  { term: "立秋", offsetDays: 9 },
  { term: "白露", offsetDays: 18 },
  { term: "寒露", offsetDays: 27 },
  { term: "立冬", offsetDays: 10 },
  { term: "大雪", offsetDays: 20 },
  { term: "小寒", offsetDays: 30 },
];

/** 対象日（input.year/month/day）を deltaDays 日ずらした暦日（Y/M/D）を返す。 */
function shiftYmd(
  input: CalendarInput,
  deltaDays: number,
): { year: number; month: number; day: number } {
  const base = Date.UTC(input.year, input.month - 1, input.day);
  const shifted = new Date(base + deltaDays * MS_PER_DAY);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function ymdKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** UTC ISO 日時文字列を timeZone の現地暦日（YYYY-MM-DD）に変換する。 */
function localDateKey(utcIso: string, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(new Date(utcIso));
}

/**
 * 対象日から deltaDays 日ずらした暦日に、節気の節入りが起きているかを
 * 判定する。起きていればその節気名を、起きていなければ undefined を返す。
 * 対象日の現地23:59:59（timezone基準。当日の最後の瞬間）を代表点として
 * CalendarEngine の calculate() を呼び、その瞬間が属する節気の節入り
 * 日時（solarTermDateTime）を現地暦日に変換して、代表点自身の暦日と
 * 一致するかで判定する（節気は約15日に1回しか起きないため、当日の
 * 最後の瞬間を見れば「その日のどこかで節入りが起きたか」を一意に
 * 判定できる）。日の途中（正午など）を代表点にすると、正午より後に
 * 節入りが起きた場合に見逃すため、必ず当日の最後の瞬間を使う。
 */
// 節気サンプル（当日23:59:59）のメモ化。
//
// solarTermStartingOn() は calculateCalendar(対象日 23:59:59) を呼び、その結果の
// solarTerm / solarTermDateTime だけを使う。同一の (year, month, day, timezone) が
//   ・同じ日の複数チェック（四離/四絶/八節日/土王用事/氣往亡の 12+3 本）
//   ・期間検索での隣接日どうしのオフセット重複（D日の +1 = D+1日の +0 など）
// で何度も要求されるため、solarTerm / solarTermDateTime をメモ化する。
//
// キャッシュキーの監査（2026-09-10、擇日UI 第3.5フェーズで正式採用）:
//   ・solarTerm / solarTermDateTime は resolveSolarTerm(utcDate) が UTC 瞬間だけ
//     から求める（src/lib/calendar/solarTerm.ts・calendarEngine.ts で確認）。
//     UTC 瞬間 = (year, month, day, hour, minute, second, timezone)。
//     hour/minute/second は本関数内で 23/59/59 に固定するため可変なのは
//     **year, month, day, timezone のみ** → これらをキーに含める（0埋め）。
//   ・longitude / latitude：resolveSolarTerm には渡されない（太陽黄経は地心量で
//     観測地に依存しない）→ 結果に影響せず、キー不要。
//   ・epochJdn：二十八宿暦アンカー専用（lodge28 のみに影響）→ 結果に影響せず不要。
//   ・lunisolarConfig：農暦の暦法（lunarMonth/lunarDay のみ）→ 結果に影響せず不要。
//   ・timezone 未指定は DEFAULT_TIMEZONE に正規化してからキー化するため、
//     指定あり/なしで同じ既定TZなら正しく同一キーになる。
//   ・キャッシュする値は毎回新規生成した小さなオブジェクト（{solarTerm,
//     solarTermDateTime}）で、呼び出し側へは string|undefined しか返さない
//     ＝後からミューテーションされない。
//   ・判定式（startKey === ymdKey で solarTerm を返すか undefined か）は不変。
const SOLAR_TERM_SAMPLE_CACHE = new Map<string, { solarTerm: string; solarTermDateTime: string }>();

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function solarTermStartingOn(input: CalendarInput, deltaDays: number): string | undefined {
  const timeZone = input.timezone ?? DEFAULT_TIMEZONE;
  const { year, month, day } = shiftYmd(input, deltaDays);

  const cacheKey = `${year}-${pad2(month)}-${pad2(day)}|${timeZone}`;
  let sample = SOLAR_TERM_SAMPLE_CACHE.get(cacheKey);
  if (!sample) {
    const full = calculateCalendar({ ...input, year, month, day, hour: 23, minute: 59, second: 59 });
    sample = { solarTerm: full.solarTerm, solarTermDateTime: full.solarTermDateTime };
    if (SOLAR_TERM_SAMPLE_CACHE.size >= 4096) SOLAR_TERM_SAMPLE_CACHE.clear();
    SOLAR_TERM_SAMPLE_CACHE.set(cacheKey, sample);
  }

  const startKey = localDateKey(sample.solarTermDateTime, timeZone);
  return startKey === ymdKey(year, month, day) ? sample.solarTerm : undefined;
}

/** 土王用事（土用）の期間の日数（四立の18日前〜四立の前日）。 */
export const DOYOU_PERIOD_DAYS = 18;

/**
 * 対象日が土王用事（土用）の期間に入っているか。
 * 期間は「四立（立春・立夏・立秋・立冬）の18日前の日」から「四立の節入り日の前日」まで
 * （原文 p.34「四立の18日前」。監修訂正 2026-10-06 により当日だけでなく期間とする）。
 * 1〜18日後のいずれかの日に四立の節入りがあれば期間内。
 * 母倉（吉神第2グループ、p.7「土王用事つまり土用の後は必ず巳午」）と、
 * 四撃〜五虚の増悪（p.28「土旺が重なると更に忌む」、resolution No.13a）も同じ期間を使う。
 */
export function isDoyouPeriod(input: CalendarInput): boolean {
  for (let k = 1; k <= DOYOU_PERIOD_DAYS; k += 1) {
    const term = solarTermStartingOn(input, k);
    if (term !== undefined && SHI_RITSU.includes(term)) return true;
  }
  return false;
}

/**
 * 「日家凶神」第5グループ（四離・四絶・八節日・土王用事・氣往亡）を
 * 判定する。吉神は今回対象外のため kichijin は常に空配列。
 *
 * 他グループと異なり、ShinsatsuInput ではなく CalendarInput
 * （年月日時。CalendarEngine の入力そのもの）を直接受け取る。
 * calculateShinsatsu / calculateTakujitsu からのみ呼び出す。
 */
export function resolveKyoushinGroup5(input: CalendarInput): ShinsatsuResult {
  const kyojin: string[] = [];

  // 26）四離・四絶：二至二分／四立の「一日前」＝翌日（+1日）が
  // 二至二分／四立の節入り日であるかで判定する。
  const tomorrowTerm = solarTermStartingOn(input, 1);
  if (tomorrowTerm !== undefined) {
    if (NIJI_NIBUN.includes(tomorrowTerm)) kyojin.push("四離");
    if (SHI_RITSU.includes(tomorrowTerm)) kyojin.push("四絶");
  }

  // 30）八節日：二至二分／四立「当日」（+0日）。
  const todayTerm = solarTermStartingOn(input, 0);
  if (todayTerm !== undefined && (NIJI_NIBUN.includes(todayTerm) || SHI_RITSU.includes(todayTerm))) {
    kyojin.push("八節日");
  }

  // 31）土王用事（土用）：四立の18日前から四立の前日までの期間（監修訂正 2026-10-06。
  // 原文 p.34「四立の18日前」を、監修により「その日だけでなく期間」と確定）。
  if (isDoyouPeriod(input)) {
    kyojin.push("土王用事");
  }

  // 氣往亡：対象の節気から offsetDays 日後＝対象日から見て
  // offsetDays 日前（-offsetDays日）がその節気の節入り日であるかで判定する。
  for (const { term, offsetDays } of KI_OUBOU_TABLE) {
    const pastTerm = solarTermStartingOn(input, -offsetDays);
    if (pastTerm === term) {
      kyojin.push("氣往亡");
      break;
    }
  }

  return { kichijin: [], kyojin };
}
