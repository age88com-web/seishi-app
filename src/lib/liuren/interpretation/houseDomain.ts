// src/lib/liuren/interpretation/houseDomain.ts
//
// 役割（Phase 5B）:
//   家宅（house。residence＝今の住居・moving＝転居・新宅）の DOMAIN 判断。
//   基本は『六壬神課講座』p67「六壬家宅占の基本は、日干を住んでいる人…日支を家とする。それらの表象はそれぞれ一課、三課」
//   （干＝人、支＝宅。干上＝一課上神、宅上（支上）＝三課上神）。家宅 DOMAIN の中での意味で、SemanticRole には固定しない。
//     人と宅の関係: 支来干上（日支が干上に来る。『六壬断案』例21「支が干に加わり」）・干来支上（日干の寄宮が支上に来る。
//       例16「日が宅に加わった」・例23「人が来て宅に就く」・例5「日干は日支上にある」）・干支の生剋（向きを区別）・三伝を通した生の流れ
//     家・人・財・家族の読みは topic で分け、家そのものの読みに混ぜない
//   ルールは『六壬断案』『六壬断案２』の原文・訳注と講座に根拠があるものだけ。干支・天将・墓・空亡に固定の吉凶は付けず、
//   subtype・goal・位置・組合せで向きを決める。風水（坐向・巒頭など）は扱わない。行年は使わない（不足として出す）。
//
//   資料との不一致・保留（Phase 5B で確定。実装しない）:
//     - 『六壬断案２』例42 訳注「干支上神は空亡」: 盤の干上・支上は未で旬空・坐空ではない（訳注と盤の不一致）。旬空・坐空の規則は変えない
//     - 例42「凶を免れた」: 翌年の引越しという事後経過。空亡そのものを吉とせず、天網自裏を移転の追い風にも一般化しない
//     - 例42「井戸は未で人を剋す」: 根拠未確定のため保留
//     - 例32「家は進まない」: 判断根拠未確定のため保留
//     - 例32「寅は日徳」: 既存の日徳表（戊は巳）と不一致。日徳表は変えない
//     - 行年・応期: 未実装

import { ELEMENT_CONTROLS, ELEMENT_GENERATES, STEM_ELEMENT } from "../constants";
import { elementOf } from "../relations";
import type { Branch } from "../types";
import { buildDomainBoardInput } from "./domainBoardInput";
import type { DomainBoardInput } from "./domainBoardInput";
import { derivedBranchDayStemStateOf } from "./derivedBranchDayStem";
import { evaluateDomainRules, summarizeDomainReadings } from "./domainResult";
import { monthlySpiritSummaryLines, spiritFact, spiritPositionText } from "./monthlySpiritReadings";
import type { DomainCitation, DomainDirection, DomainEvidenceItem, DomainResult, DomainRule } from "./domainResult";
import { relationBetween, threeHarmonyOf } from "./relations";
import type { InterpretationContext, InterpretationGoal } from "./roles";
import { elementTombOf } from "./states";
import type { DayStemStandingState, InterpretationFacts, TransmissionDayStemState, TransmissionPosition } from "./types";

type Input = DomainBoardInput;
type Rule = DomainRule<Input>;
const TRANSMISSIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];
const LABEL: Record<TransmissionPosition, string> = { initial: "初伝", middle: "中伝", final: "末伝" };

const D1 = (locator: string, layer: "原文" | "訳注", quote: string): DomainCitation => ({ source: "『六壬断案』", locator, layer, quote });
const D2 = (locator: string, layer: "原文" | "訳注", quote: string): DomainCitation => ({ source: "『六壬断案２』", locator, layer, quote });
const ZN = (layer: "原文" | "注", quote: string): DomainCitation => ({ source: "『大六壬指南』", locator: "陽宅章第三", layer, quote });
const KOZA = (locator: string, quote: string): DomainCitation => ({ source: "『六壬神課講座』", locator, layer: "講座", quote });
const P67 = KOZA("p67", "六壬家宅占の基本は、日干を住んでいる人、特に世帯主、日支を家とする。それらの表象はそれぞれ一課、三課とする。一課と日支、三課と日干、および発用と日干支の関係をみるのがよい");
const ev = (fact: string, detail: string): DomainEvidenceItem => ({ fact, detail });

// ---- 盤の読み取り（既存の FACT を参照するだけ） ----
const stemUpper = (i: Input) => i.ctx.fourLessons.lessons[0].upper;   // 干上（一課上神）
const siteUpper = (i: Input) => i.ctx.fourLessons.lessons[2].upper;   // 宅上（支上・三課上神）
const isEmpty = (s: DayStemStandingState | TransmissionDayStemState) => s.isVoid || s.isSeatedOnVoid;
const emptyText = (s: DayStemStandingState | TransmissionDayStemState) => (s.isVoid ? "旬空" : s.isSeatedOnVoid ? "坐空" : "");
const path = (i: Input, p: TransmissionPosition) => i.comparison.path[p];
/** 日支（宅）→ 日干（人）の五行関係（Phase 4K） */
const houseToPerson = (i: Input) => derivedBranchDayStemStateOf(i.facts, i.facts.basic.dayBranch).relationToDayStem;
const linkAt = (i: Input, derivation: string, position: string) =>
  i.subjectLinks.find((l) => l.source.derivation === derivation && l.anchor.kind === "position" && l.anchor.position === position) ?? null;
const stemComesToBranch = (i: Input) => siteUpper(i).branch === i.lodgingBranch;

// ---- 向き ----
/** 今の家を離れたい問い（release・separate・avoid、今の住居での move） */
const wantsToLeave = (subtype: string | undefined, goal: InterpretationGoal | undefined) =>
  goal === "release" || goal === "separate" || goal === "avoid" || (goal === "move" && subtype !== "moving");
/** 新しい家に入りたい問い（転居 moving・acquire） */
const wantsNewHome = (subtype: string | undefined, goal: InterpretationGoal | undefined) => subtype === "moving" || goal === "acquire";
const neutral = (note: string) => ({ direction: "neutral" as DomainDirection, note });
const hindering = () => ({ direction: "hindering" as DomainDirection });
const favoring = () => ({ direction: "favoring" as DomainDirection });

const HOUSE_RULES: readonly Rule[] = [
  // ===== 人と宅の関係（relation） =====
  {
    id: "house.branchComesToStem", when: { domain: "house" },
    reading: { axis: "relation", topic: "relation", key: "branchComesToStem", label: "支来干上（宅が人の側へ来る）", level: "direct",
      citations: [D1("例21", "原文", "この課は支が干に加わり、上門乱首課という"), P67] },
    conditions: (i) => stemUpper(i).branch === i.facts.basic.dayBranch
      ? { detected: `日支 ${i.facts.basic.dayBranch} が干上（一課上神）に来ている（宅が人の側へ来る）`, evidence: [ev("lesson1.upper", stemUpper(i).branch), ev("dayBranch", i.facts.basic.dayBranch)] } : null,
    assess: () => neutral("宅が人の側へ来ている構造。向きは干支の生剋・空亡と組んで決まる"),
  },
  {
    id: "house.stemComesToBranch", when: { domain: "house" },
    reading: { axis: "relation", topic: "relation", key: "stemComesToBranch", label: "干来支上（人が宅に入る）", level: "direct",
      citations: [D1("例23", "原文", "この課は人が来て宅に就く、まさに新宅の課である"), D1("例16", "原文", "これが日が宅に加わったことによるもの"), D1("例5", "原文", "日干は日支上にある"), P67] },
    conditions: (i) => stemComesToBranch(i)
      ? { detected: `日干の寄宮 ${i.lodgingBranch} が支上（三課上神）に来ている（人が宅に入る）`, evidence: [ev("lesson3.upper", siteUpper(i).branch), ev("lodgingBranch", i.lodgingBranch)] } : null,
    assess: (_, subtype, goal) => wantsNewHome(subtype, goal)
      ? { direction: "favoring", note: "新宅に入る問いでは「新宅の課」（例23）" }
      : neutral("人が宅に入っている構造。今の住居では向きは他の要素と組んで決まる"),
  },
  {
    id: "house.houseOvercomesPerson", when: { domain: "house" },
    reading: { axis: "obstruction", topic: "relation", key: "houseOvercomesPerson", label: "宅が人を剋す（支が干を剋す）", level: "direct",
      citations: [D1("例21", "原文", "支が干を剋し…これは凶課である"), D1("例21", "訳注", "これは支が日干を犯したため、すなわち下が上を犯したということ")] },
    conditions: (i) => houseToPerson(i) === "transmissionOvercomesDayStem"
      ? { detected: `日支 ${i.facts.basic.dayBranch}（${elementOf(i.facts.basic.dayBranch)}）が日干 ${i.facts.basic.dayStem}（${STEM_ELEMENT[i.facts.basic.dayStem]}）を剋す（宅→人の剋）`, evidence: [ev("relation", "日支→日干 剋")] } : null,
    assess: (_, subtype, goal) => wantsToLeave(subtype, goal) ? neutral("離れたい問いでの読みは資料にない") : hindering(),
  },
  {
    id: "house.personOvercomesHouse", when: { domain: "house" },
    reading: { axis: "relation", topic: "relation", key: "personOvercomesHouse", label: "人が宅を剋す（干が支を制す・贅婿課）", level: "direct",
      citations: [D1("例4", "原文", "この課は干が支を制する。贅婿課という"), D1("例16", "原文", "ただし宅が人を剋しているわけではないので、これは自発的に出て行くとみる")] },
    conditions: (i) => houseToPerson(i) === "dayStemOvercomesTransmission"
      ? { detected: `日干 ${i.facts.basic.dayStem}（${STEM_ELEMENT[i.facts.basic.dayStem]}）が日支 ${i.facts.basic.dayBranch}（${elementOf(i.facts.basic.dayBranch)}）を剋す（人→宅の剋。宅は人を剋さない）`, evidence: [ev("relation", "日干→日支 剋")] } : null,
    assess: () => neutral("干が支を制す構造（贅婿課）。宅が人を剋さないので、人が出るなら自発的（例16）"),
  },
  {
    id: "house.personGeneratesHouse", when: { domain: "house" },
    reading: { axis: "relation", topic: "relation", key: "personGeneratesHouse", label: "人が宅を生ず（干が支を生ず）", level: "inferred", citations: [P67] },
    conditions: (i) => houseToPerson(i) === "dayStemGeneratesTransmission"
      ? { detected: `日干 ${i.facts.basic.dayStem} が日支 ${i.facts.basic.dayBranch} を生ず（人→宅の生）`, evidence: [ev("relation", "日干→日支 生")] } : null,
    assess: () => neutral("干支の生の向きだけを記録（資料に単独の判断はない）"),
  },
  {
    id: "house.houseGeneratesPerson", when: { domain: "house" },
    reading: { axis: "relation", topic: "relation", key: "houseGeneratesPerson", label: "宅が人を生ず（支が干を生ず）", level: "inferred", citations: [P67] },
    conditions: (i) => houseToPerson(i) === "transmissionGeneratesDayStem"
      ? { detected: `日支 ${i.facts.basic.dayBranch} が日干 ${i.facts.basic.dayStem} を生ず（宅→人の生）`, evidence: [ev("relation", "日支→日干 生")] } : null,
    assess: () => neutral("干支の生の向きだけを記録（資料に単独の判断はない）"),
  },
  {
    id: "house.personHouseSame", when: { domain: "house" },
    reading: { axis: "relation", topic: "relation", key: "personHouseSame", label: "人と宅が比和", level: "inferred", citations: [P67] },
    conditions: (i) => houseToPerson(i) === "sameElement"
      ? { detected: `日干 ${i.facts.basic.dayStem} と日支 ${i.facts.basic.dayBranch} が同じ五行（${elementOf(i.facts.basic.dayBranch)}）`, evidence: [ev("relation", "比和")] } : null,
    assess: () => neutral("干支が比和であることだけを記録（資料に単独の判断はない）"),
  },
  // 三伝を通した生の流れ（例3・例11）: 家と人を別の読みにする
  ...([
    ["house", "flowToHouse.house", "家に利（人の気が三伝を通って宅へ流れる）", "favoring"],
    ["person", "flowToHouse.person", "人に利なし（人の気が宅へ洩れる）", "hindering"],
  ] as const).map(([topic, key, label, dir]): Rule => ({
    id: `house.${key}`, when: { domain: "house" },
    reading: { axis: "trajectory", topic, key, label, level: "combined",
      citations: [D1("例3", "原文", "家に利があり人に利がない。干上が発用で支上が末伝で末伝は干から生じられ支を生じている")] },
    conditions: (i) => {
      const p = TRANSMISSIONS.find((x) => relationBetween(i.facts.basic.dayStem, path(i, x).branch).relations.includes("generates") &&
        relationBetween(path(i, x).branch, i.facts.basic.dayBranch).relations.includes("generates"));
      return p ? { detected: `日干 ${i.facts.basic.dayStem} が${LABEL[p]} ${path(i, p).branch} を生じ、${path(i, p).branch} が日支 ${i.facts.basic.dayBranch} を生ず`, evidence: [ev("relation", `日干→${LABEL[p]}→日支 生`)] } : null;
    },
    assess: () => ({ direction: dir }),
  })),
  ...([
    ["person", "flowToPerson.person", "人が興る（三伝の局が人を生じる）", "favoring"],
    ["house", "flowToPerson.house", "宅が狭い（宅の気が三伝の局へ洩れる）", "hindering"],
  ] as const).map(([topic, key, label, dir]): Rule => ({
    id: `house.${key}`, when: { domain: "house" },
    reading: { axis: "trajectory", topic, key, label, level: "direct",
      citations: [D1("例11", "原文", "この課は人は多く宅は狭い、人興って宅替わる"), D1("例11", "訳注", "巳酉丑の金局で癸が生じ、丑は金によって洩らされるため")] },
    conditions: (i) => {
      const h = threeHarmonyOf([path(i, "initial").branch, path(i, "middle").branch, path(i, "final").branch]);
      if (!h.complete) return null;
      const stemEl = STEM_ELEMENT[i.facts.basic.dayStem], branchEl = elementOf(i.facts.basic.dayBranch);
      // 局の五行が日干を生じ、日支が局の五行を生ずる（起課エンジンの五行表 ELEMENT_GENERATES）
      if (!(ELEMENT_GENERATES[h.element] === stemEl && ELEMENT_GENERATES[branchEl] === h.element)) return null;
      return { detected: `三伝が${h.element}局で、日支（${branchEl}）が局を生じ、局が日干（${stemEl}）を生ず`, evidence: [ev("threeHarmony", `${h.element}局`), ev("relation", "日支→局→日干 生")] };
    },
    assess: () => ({ direction: dir }),
  })),
  {
    id: "house.personLeaves", when: { domain: "house" },
    reading: { axis: "trajectory", topic: "relation", key: "personLeaves", label: "宅上が発用で日上が中伝（人が宅に居られず出る）", level: "combined",
      citations: [D1("例16", "原文", "宅上が発用であり、日上が中伝にある。これは宅に多くの人が居られず出ることになる")] },
    conditions: (i) => path(i, "initial").branch === siteUpper(i).branch && path(i, "middle").branch === stemUpper(i).branch
      ? { detected: `初伝が宅上 ${siteUpper(i).branch}、中伝が干上 ${stemUpper(i).branch}（宅から発して人へ向かう）`, evidence: [ev("initial", siteUpper(i).branch), ev("middle", stemUpper(i).branch)] } : null,
    assess: (_, subtype, goal) => wantsToLeave(subtype, goal) || wantsNewHome(subtype, goal)
      ? { direction: "favoring", note: "家を出る・移る問いでは、出る流れ" }
      : goal === "maintain" || goal === "preserve" ? { direction: "hindering", note: "住み続けたい問いでは、宅に居られない流れ" } : neutral("人が宅から出る流れ。向きは問いの目的による"),
  },
  // ===== 人（person） =====
  {
    id: "house.stemUpperDrains", when: { domain: "house" },
    reading: { axis: "obstruction", topic: "person", key: "stemUpperDrains", label: "日上が日干を洩らす（盗気・脱気）", level: "direct",
      citations: [D1("例20", "原文", "日上の子は盗気で天空を見る…子供たちが財をかすめとり"), D1("例19", "訳注", "日上天后が寅に乗じて脱神（洩らされる）")] },
    conditions: (i) => stemUpper(i).relationToDayStem === "dayStemGeneratesTransmission"
      ? { detected: `干上 ${stemUpper(i).branch} は日干 ${i.facts.basic.dayStem} に生じられ、日干の気を洩らす`, evidence: [ev("lesson1.upper.relationToDayStem", "日干→干上 生")] } : null,
    assess: hindering,
  },
  {
    id: "house.stemUpperTomb", when: { domain: "house" },
    reading: { axis: "obstruction", topic: "person", key: "stemUpperTomb", label: "日上が日干の墓（遅滞）", level: "direct",
      citations: [D1("例18", "原文", "日上上は墓で天后、遅滞であり、時運はいまだ通らず")] },
    conditions: (i) => stemUpper(i).growthStage === "墓"
      ? { detected: `干上 ${stemUpper(i).branch} が日干 ${i.facts.basic.dayStem} の墓`, evidence: [ev("lesson1.upper.growthStage", "墓")] } : null,
    assess: hindering,
  },
  {
    id: "house.stemUpperOvercomesStem", when: { domain: "house" },
    reading: { axis: "obstruction", topic: "person", key: "stemUpperOvercomesStem", label: "日上神が日干を剋す", level: "direct",
      citations: [KOZA("p67", "日上神（すなわち一課）を旧宅…日上神が日干を剋せば旧宅に問題あり"), D2("例41", "原文", "日上神は空亡で日を剋し勾陳である。旧事がいろいろと出てきてことごとく身にふりかかる")] },
    conditions: (i) => stemUpper(i).relationToDayStem === "transmissionOvercomesDayStem"
      ? { detected: `干上 ${stemUpper(i).branch} が日干 ${i.facts.basic.dayStem} を剋す`, evidence: [ev("lesson1.upper.relationToDayStem", "干上→日干 剋")] } : null,
    assess: (_, subtype) => subtype === "moving" ? { direction: "hindering", note: "転居では旧宅に問題（講座 p67）" } : hindering(),
  },
  // 本命（例42）
  {
    id: "house.natalTombAtStanding", when: { domain: "house" },
    reading: { axis: "obstruction", topic: "person", key: "natalTombAtStanding", label: "本命が墓から来て身となる（天網自裏）", level: "direct",
      citations: [D2("例42", "原文", "本命は墓から来て身となり、これを天網自裏という"), D2("例42", "訳注", "本命が未で日干の墓となります"),
        D2("例42", "原文", "もし引越ししなければ１２年たって死亡する")] },
    conditions: (i) => {
      const l = linkAt(i, "self", "standing");
      return l && i.comparison.standing.growthStage === "墓"
        ? { detected: `本人の本命 ${l.branch} が干上にあり、日干 ${i.facts.basic.dayStem} の墓`, evidence: [ev("identityLink", `本命 self → 干上 ${l.branch}`), ev("standing.growthStage", "墓")] } : null;
    },
    // 盤から導けるのは「住み続ければ凶」まで。例42 の引越しで凶を免れたのは事後経過（訳者の推測を含む）なので、
    // 離れる・移る問いの追い風には一般化しない
    assess: (_, subtype, goal) => wantsToLeave(subtype, goal) || wantsNewHome(subtype, goal)
      ? neutral("離れる・移る問いでの判断は資料にない（例42 の翌年の引越しで凶を免れたのは事後経過で、一般の規則ではない）")
      : { direction: "hindering", note: "住み続ける問いでは凶（例42「もし引越ししなければ１２年たって死亡する」）" },
  },
  {
    id: "house.natalUpperInitialEmpty", when: { domain: "house" },
    reading: { axis: "actualization", topic: "person", key: "natalUpperInitialEmpty", label: "本命上が発用で空（星運は不利）", level: "direct",
      citations: [D2("例42", "原文", "また本命上が発用となり、空亡である。中伝は空亡に臨むのでやはり空…きっと星運は不利である"),
        D2("例42", "訳注", "青龍は仕官を示しますが空亡であり、中伝に至っても先々いいことがありません")] },
    conditions: (i) => {
      const l = linkAt(i, "heavenOn", "initial");
      const n = path(i, "initial");
      if (!l || !isEmpty(n)) return null;
      const mid = path(i, "middle");
      return { detected: `本人の本命 ${l.baseBranch} の上 ${l.branch} が初伝で${emptyText(n)}${isEmpty(mid) ? `、中伝 ${mid.branch} も${emptyText(mid)}` : ""}`,
        evidence: [ev("identityLink", `本命 heavenOn → 初伝 ${l.branch}`), ev("initial", emptyText(n)), ...(isEmpty(mid) ? [ev("middle", emptyText(mid))] : [])] };
    },
    assess: hindering,
  },
  // ===== 家（house） =====
  {
    id: "house.siteUpperEmpty", when: { domain: "house" },
    reading: { axis: "actualization", topic: "house", key: "siteUpperEmpty", label: "支上が空（宅が得られていない）", level: "direct",
      citations: [D1("例9", "原文", "支上が空亡なので宅は得られていない図である"), D1("例9", "訳注", "宅を見るには支を見て、支上が空ならいまだ宅基はないとする")] },
    conditions: (i) => isEmpty(siteUpper(i)) ? { detected: `支上 ${siteUpper(i).branch} が${emptyText(siteUpper(i))}`, evidence: [ev("lesson3.upper", emptyText(siteUpper(i)))] } : null,
    assess: (_, subtype, goal) => wantsNewHome(subtype, goal) ? hindering()
      : wantsToLeave(subtype, goal) ? neutral("離れたい問いでの読みは資料にない") : { direction: "hindering", note: "今の家では、宅の実が乏しい" },
  },
  {
    id: "house.bothUppersEmpty", when: { domain: "house" },
    reading: { axis: "actualization", topic: "house", key: "bothUppersEmpty", label: "干支上神がともに空（今の家は得るものがない）", level: "combined",
      citations: [D2("例42", "訳注", "干支上神は空亡であり、いまの家は得るものがないということになります")] },
    conditions: (i) => isEmpty(stemUpper(i)) && isEmpty(siteUpper(i))
      ? { detected: `干上 ${stemUpper(i).branch}（${emptyText(stemUpper(i))}）と支上 ${siteUpper(i).branch}（${emptyText(siteUpper(i))}）がともに空`, evidence: [ev("lesson1.upper", emptyText(stemUpper(i))), ev("lesson3.upper", emptyText(siteUpper(i)))] } : null,
    assess: hindering,
  },
  {
    id: "house.middleLongLife", when: { domain: "house" },
    reading: { axis: "opportunity", topic: "house", key: "middleLongLife", label: "中伝に長生（新宅を求める状況）", level: "combined",
      citations: [D1("例9", "訳注", "かえって中伝に長生をみれば、新宅を求める状況で、この方が生旺ならばそうであるとみる")] },
    conditions: (i) => path(i, "middle").growthStage === "長生" ? { detected: `中伝 ${path(i, "middle").branch} が日干の長生`, evidence: [ev("middle.growthStage", "長生")] } : null,
    assess: (_, subtype, goal) => wantsNewHome(subtype, goal) ? favoring() : neutral("新宅を求める問いでの読み"),
  },
  {
    id: "house.siteUpperInitiates", when: { domain: "house" },
    reading: { axis: "trajectory", topic: "house", key: "siteUpperInitiates", label: "宅上が発用（事が宅から起こる）", level: "combined",
      citations: [D1("例16", "原文", "宅上が発用であり"), D1("例20", "原文", "支上は破砕で発用であり"), D1("例6", "原文", "初伝の辰は宅上から出て卯にもどる")] },
    conditions: (i) => path(i, "initial").branch === siteUpper(i).branch ? { detected: `初伝が宅上 ${siteUpper(i).branch}（事が宅から起こる）`, evidence: [ev("initial", siteUpper(i).branch)] } : null,
    assess: () => neutral("事の起点が宅にあることだけを記録"),
  },
  {
    id: "house.siteFirstThenEmpty", when: { domain: "house" },
    reading: { axis: "trajectory", topic: "house", key: "siteFirstThenEmpty", label: "宅上から発して中末伝が空（うまくいかない）", level: "combined",
      citations: [D1("例20", "訳注", "初伝は宅上で、中末伝は空、これはうまくいかない")] },
    conditions: (i) => path(i, "initial").branch === siteUpper(i).branch && isEmpty(path(i, "middle")) && isEmpty(path(i, "final"))
      ? { detected: `初伝が宅上 ${siteUpper(i).branch} で、中伝 ${path(i, "middle").branch}（${emptyText(path(i, "middle"))}）・末伝 ${path(i, "final").branch}（${emptyText(path(i, "final"))}）が空`, evidence: [ev("middle", emptyText(path(i, "middle"))), ev("final", emptyText(path(i, "final")))] } : null,
    assess: hindering,
  },
  {
    id: "house.initialHarmsSiteUpper", when: { domain: "house" },
    reading: { axis: "obstruction", topic: "house", key: "initialHarmsSiteUpper", label: "発用が支上と六害（障害が多い）", level: "combined",
      citations: [D1("例8", "訳注", "発用子は支上未と六害であり、障害が多い"), D2("例42", "訳注", "子と未は害ですから、このままでは家族の体調不良を招きます")] },
    conditions: (i) => relationBetween(path(i, "initial").branch, siteUpper(i).branch).relations.includes("harms")
      ? { detected: `発用 ${path(i, "initial").branch} が支上 ${siteUpper(i).branch} と六害`, evidence: [ev("relation", "初伝・支上 害")] } : null,
    assess: hindering,
  },
  {
    id: "house.siteUpperOvercomesBranch", when: { domain: "house" },
    reading: { axis: "obstruction", topic: "house", key: "siteUpperOvercomesBranch", label: "支上神が日支を剋す", level: "direct",
      citations: [KOZA("p67", "支上神（すなわち三課）を新宅とする…支上神が日支を剋せば新宅に問題ありとして、とくに後者の場合は引越ししても長くは住めない"),
        D2("例41", "訳注", "日支申は支上午螣蛇に剋されますから、家は早晩争いごとになり、バラバラになる")] },
    conditions: (i) => relationBetween(siteUpper(i).branch, i.facts.basic.dayBranch).relations.includes("overcomes")
      ? { detected: `支上 ${siteUpper(i).branch} が日支 ${i.facts.basic.dayBranch} を剋す`, evidence: [ev("relation", "支上→日支 剋")] } : null,
    assess: (_, subtype) => subtype === "moving" ? { direction: "hindering", note: "転居では新宅に問題、引越しても長くは住めない（講座 p67）" } : hindering(),
  },
  {
    id: "house.siteUpperLongLife", when: { domain: "house" },
    reading: { axis: "support", topic: "house", key: "siteUpperLongLife", label: "宅上が日干の長生", level: "direct",
      citations: [D1("例18", "原文", "幸い宅の六儀は長生で引進")] },
    conditions: (i) => siteUpper(i).growthStage === "長生" ? { detected: `宅上 ${siteUpper(i).branch} が日干の長生`, evidence: [ev("lesson3.upper.growthStage", "長生")] } : null,
    assess: favoring,
  },
  {
    id: "house.siteUpperCombinesBranch", when: { domain: "house" },
    reading: { axis: "support", topic: "house", key: "siteUpperCombinesBranch", label: "宅上が日支と合", level: "direct",
      citations: [D1("例18", "原文", "また宅と合である")] },
    conditions: (i) => relationBetween(siteUpper(i).branch, i.facts.basic.dayBranch).relations.includes("combines")
      ? { detected: `宅上 ${siteUpper(i).branch} が日支 ${i.facts.basic.dayBranch} と六合`, evidence: [ev("relation", "支上・日支 合")] } : null,
    assess: favoring,
  },
  {
    id: "house.taiSuiEntersHouse", when: { domain: "house" },
    reading: { axis: "obstruction", topic: "house", key: "taiSuiEntersHouse", label: "太歳が宅に入り宅を剋す", level: "direct",
      citations: [D1("例4", "原文", "太歳が宅に入り宅を剋する。六年のうちに家屋は破損して墓地となるであろう")] },
    conditions: (i) => {
      const t = i.taiSuiBranch;
      if (!t || siteUpper(i).branch !== t || !relationBetween(t, i.facts.basic.dayBranch).relations.includes("overcomes")) return null;
      return { detected: `太歳 ${t} が宅上にあり、日支 ${i.facts.basic.dayBranch} を剋す`, evidence: [ev("taiSui", t), ev("lesson3.upper", t), ev("relation", "太歳→日支 剋")] };
    },
    assess: hindering,
  },
  // ===== 家族・財（family・wealth。家そのものの読みとは分ける） =====
  {
    id: "house.siteUpperSiblingXuanwu", when: { domain: "house" },
    reading: { axis: "obstruction", topic: "family", key: "siteUpperSiblingXuanwu", label: "宅上に兄弟・玄武（家族が家を出て財を持ち出す）", level: "combined",
      citations: [D2("例32", "原文", "宅上の戌は玄武であるから子供らは家を出ていき、それぞれが財産を取っていく")] },
    conditions: (i) => siteUpper(i).sixRelation === "兄弟" && i.facts.generals.generalOn[siteUpper(i).branch] === "玄武"
      ? { detected: `宅上 ${siteUpper(i).branch} が兄弟で玄武が乗る`, evidence: [ev("lesson3.upper.sixRelation", "兄弟"), ev("heavenlyGeneral", "玄武")] } : null,
    assess: hindering,
  },
  {
    id: "house.standingSiblingTianKong", when: { domain: "house" },
    reading: { axis: "obstruction", topic: "family", key: "standingSiblingTianKong", label: "身の上に親族（兄弟）で天空（親族が減る）", level: "combined",
      citations: [D2("例32", "原文", "身の上に親族がある"), D2("例32", "訳注", "基本的には未を親族と見れば天空がついており、親族が徐々に減るのはわかります")] },
    conditions: (i) => stemUpper(i).sixRelation === "兄弟" && i.facts.generals.generalOn[stemUpper(i).branch] === "天空"
      ? { detected: `干上 ${stemUpper(i).branch} が兄弟（親族）で天空が乗る`, evidence: [ev("lesson1.upper.sixRelation", "兄弟"), ev("heavenlyGeneral", "天空")] } : null,
    assess: hindering,
  },
  {
    id: "house.initialXuanwuShadow", when: { domain: "house" },
    reading: { axis: "obstruction", topic: "family", key: "initialXuanwuShadow", label: "宅上玄武の陰神（四課）が発用（家人が賊）", level: "direct",
      citations: [D2("例32", "原文", "四課が発用であり、これは玄武の陰神である。すなわち子孫が賊である")] },
    conditions: (i) => i.facts.generals.generalOn[siteUpper(i).branch] === "玄武" && path(i, "initial").branch === i.ctx.fourLessons.lessons[3].upper.branch
      ? { detected: `宅上 ${siteUpper(i).branch} に玄武が乗り、その陰神（四課上神）${path(i, "initial").branch} が初伝`, evidence: [ev("heavenlyGeneral", `玄武 ${siteUpper(i).branch}`), ev("initial", `四課上神 ${path(i, "initial").branch}`)] } : null,
    assess: hindering,
  },
  // ===== 月建の神煞（Phase 5L。『大六壬指南』陽宅章） =====
  {
    id: "house.dragonOnShengQi", when: { domain: "house" },
    reading: { axis: "support", topic: "house", key: "dragonOnShengQi", label: "青龍が生気に乗る（家が日に昌える）", level: "direct",
      citations: [ZN("原文", "虎入宅凶蛇冲吉，龙乘生气家日昌")] },
    // 原文は位置を指定しない（「虎入宅」と違い宅上に限らない）。位置は detected に書くだけで条件にしない
    conditions: (i) => {
      const sp = i.monthlySpirits?.shengQi;
      return sp && sp.general === "青龍" ? { detected: `青龍が生気 ${sp.branch}（月支 ${sp.monthBranch}）に乗る（位置: ${spiritPositionText(sp)}）`, evidence: [ev(spiritFact("shengQi"), sp.branch), ev("heavenlyGeneral", "青龍")] } : null;
    },
    assess: (_, subtype, goal) => wantsToLeave(subtype, goal)
      ? neutral("家を離れたい問いでの読みは資料にない") : { direction: "favoring", note: "原文は青龍の位置を指定しない（盤上のどこでも読む）" },
  },
  {
    id: "house.taichangSiQiOnSite", when: { domain: "house" },
    reading: { axis: "obstruction", topic: "family", key: "taichangSiQiOnSite", label: "宅上（支上）に太常が死気に乗って臨む（孝服）", level: "direct",
      citations: [ZN("原文", "支乘常死孝服招"), ZN("注", "太常乘死气临支主有孝服")] },
    conditions: (i) => {
      const sp = i.monthlySpirits?.siQi;
      return sp && siteUpper(i).branch === sp.branch && sp.general === "太常"
        ? { detected: `宅上（支上）${sp.branch} が死気（月支 ${sp.monthBranch}）で、太常が乗る`, evidence: [ev(spiritFact("siQi"), sp.branch), ev("lesson3.upper", sp.branch), ev("heavenlyGeneral", "太常")] } : null;
    },
    assess: () => ({ direction: "hindering", note: "古典の象意（孝服＝喪に服す）で、家族の死亡を予測しない" }),
  },
  {
    id: "house.wealthVaultEmpty", when: { domain: "house" },
    reading: { axis: "actualization", topic: "wealth", key: "wealthVaultEmpty", label: "財庫が三伝で空（財はもはやない）", level: "direct",
      citations: [D2("例32", "原文", "辰は財庫だがすでに空である。財はもはやない")] },
    conditions: (i) => {
      const vault = elementTombOf(ELEMENT_CONTROLS[STEM_ELEMENT[i.facts.basic.dayStem]]).branch;
      const p = TRANSMISSIONS.find((x) => path(i, x).branch === vault && isEmpty(path(i, x)));
      return p ? { detected: `財の墓庫 ${vault} が${LABEL[p]}にあり${emptyText(path(i, p))}`, evidence: [ev("elementTomb", `財の庫 ${vault}`), ev(p, emptyText(path(i, p)))] } : null;
    },
    assess: hindering,
  },
];

/** 家宅の DOMAIN 判断 */
export function evaluateHouseDomain(facts: InterpretationFacts, context: InterpretationContext, monthBranch?: Branch | null): DomainResult {
  if (context.domain !== "house") throw new Error(`家宅以外の DOMAIN です: ${context.domain}`);
  const subject = context.subtype === "moving" ? "転居・新宅" : "家宅";
  const { input, missing } = buildDomainBoardInput(facts, context, monthBranch);
  const lead = [{ topic: "relation", label: "人と宅の関係" }];
  if (!input) return summarizeDomainReadings("house", context.subtype, context.goal, [], missing, subject, lead);
  missing.push({ key: "xingNian", detail: "行年は規則が未確定なので、行年を使う読み（例32「行年上には破敗」など）は未対応" });
  missing.push({ key: "timing", detail: "時期（応期・年数）の読みは未対応" });
  const readings = evaluateDomainRules(HOUSE_RULES, input, "house", context.subtype, context.goal);
  const r = summarizeDomainReadings("house", context.subtype, context.goal, readings, missing, subject, lead);
  return { ...r, summary: [r.summary, ...monthlySpiritSummaryLines(readings, input.monthlySpirits, monthBranch, HOUSE_SPIRIT_UNRESOLVED)].join("\n") };
}
/** 家宅で神煞を使うが判断しない句（Phase 5L） */
const HOUSE_SPIRIT_UNRESOLVED = [
  "『直指』宅舍「日辰傳命，大綱要有生氣旺氣」は生気と旺気の両方が要るのか一方か、見る位置（日辰そのものか上神か）が確定しないので読まない",
  "『大全』血厭克宅格「天后乘血支，血忌作月厭臨支克支」は句読（天后が乗るのが血支か血忌か、月厭が必須か）が確定しないので読まない",
  "『指南』「血忌支厭煞入宅」は「支厭」「入宅」の位置が確定しないので読まない",
];

/** 監査用: ルールの一覧 */
export const HOUSE_DOMAIN_RULES: readonly Pick<Rule, "id" | "when" | "reading">[] = HOUSE_RULES.map(({ id, when, reading }) => ({ id, when, reading }));
