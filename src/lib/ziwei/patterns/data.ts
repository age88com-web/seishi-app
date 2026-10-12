// src/lib/ziwei/patterns/data.ts
//
// 基礎２ 本編33格（S2〜S33）の判定条件。docs/ziwei-basic-spec.md §23.4。
// 資料の文（条件・象意）は data/sourceText.json（docs/ziwei-patterns-candidate.json から生成）をそのまま使い、
// ここでは各格局の成立条件・破格・注意を、資料の文の範囲だけで判定する関数と、資料上の問題（sourceIssues）を持つ。
// 列挙された星の AND / OR は格局ごとに原文から決め、全格局共通の規則は作らない。
// 全書52格（S34・S35）は referenceOnly で判定しない。

import type { Branch, PlacedStar, TransformationKind } from "../types";
import type { AnyStar, ChartView } from "./chartView";
import { BRANCHES_ALL } from "./chartView";
import type { BreakCheck, EnhancementCheck, PatternCheck, SourceIssue, WarningCheck } from "./types";
import type { MinorStarId } from "../minorStars/types";
import { STAR_LUCK } from "./luck";
import { BRANCH_PO_SOURCE, chongOf, poOf } from "../branchRelations";

export interface EvalOutcome {
  /** 条件に一致したか（null は判定できない） */
  matched: boolean | null;
  /** 条件を満たした基準宮 */
  palaces: Branch[];
  checks: PatternCheck[];
  breaks?: BreakCheck[];
  warnings?: WarningCheck[];
  /** 補足（成立条件ではない吉意。状態を変えない） */
  enhancements?: EnhancementCheck[];
  /** 成立した宮とは別に、格の影響が及ぶ宮（成立判定はしない。資料の関連記述） */
  affected?: { branch: Branch; from: Branch; note: string }[];
}

export interface PatternRule {
  id: string;
  /** 資料上の問題。blocking: true があると conditionMatched でも needs_review */
  sourceIssues: SourceIssue[];
  evaluate(v: ChartView): EvalOutcome;
}

// ---------------------------------------------------------------------------
// 共通の部品（条件の読みは格局ごとに呼び分ける）
// ---------------------------------------------------------------------------

const ck = (text: string, result: boolean | null, detail: string): PatternCheck => ({ text, result, detail });
const short = (s: AnyStar) => s.replace(/星$/, "");
const list = (xs: { star: AnyStar; branch: Branch }[]) => xs.map((x) => `${short(x.star)}（${x.branch}）`).join("・");

/** 命宮の支が候補にあるか */
function mingIn(v: ChartView, branches: readonly Branch[]): PatternCheck {
  const ok = branches.includes(v.mingBranch);
  return ck(`命宮が${branches.join("・")}`, ok, `命宮は${v.mingBranch}`);
}
/** 宮に星がすべてある（同宮） */
function allAt(v: ChartView, b: Branch, stars: readonly AnyStar[], where: string): PatternCheck {
  const missing = stars.filter((s) => !v.has(b, s));
  return ck(
    `${where}に${stars.map(short).join("・")}`,
    missing.length === 0,
    missing.length === 0 ? `${v.label(b)}に${stars.map(short).join("・")}` : `${v.label(b)}に${missing.map(short).join("・")}がない`,
  );
}
/** 星がすべて基準宮の三方四正（加会）にある */
function allJiahui(v: ChartView, b: Branch, stars: readonly AnyStar[], text: string): PatternCheck {
  const found = stars.map((s) => ({ s, at: v.jiahui(b, s) }));
  const miss = found.filter((f) => !f.at);
  return ck(
    text,
    miss.length === 0,
    `${v.label(b)}の三方四正（${v.sanfangSizheng(b).join("・")}）に ${found.map((f) => `${short(f.s)}${f.at ? `＝${f.at}` : "なし"}`).join("・")}`,
  );
}
/** 基準宮の三方四正に吉星が加会するか（除外する星は条件の主体の星） */
function luckyJiahui(v: ChartView, b: Branch, text: string, exclude: readonly AnyStar[] = []): PatternCheck {
  const xs = v.luckyIn(v.sanfangSizheng(b), exclude);
  return ck(text, xs.length > 0, xs.length > 0 ? `加会する吉星: ${list(xs)}` : `${v.label(b)}の三方四正に吉星なし`);
}
const allTrue = (cs: PatternCheck[]): boolean | null =>
  cs.some((c) => c.result === false) ? false : cs.every((c) => c.result === true) ? true : null;
const out = (checks: PatternCheck[], palaces: Branch[], extra: Partial<EvalOutcome> = {}): EvalOutcome => {
  const matched = allTrue(checks);
  return { matched, palaces: matched ? palaces : [], checks, ...extra };
};
/** 命宮の支と命宮の同宮の星だけで決まる格局 */
function mingPattern(branches: readonly Branch[] | null, stars: readonly AnyStar[]) {
  return (v: ChartView): EvalOutcome => {
    const m = v.mingBranch;
    const checks = [...(branches ? [mingIn(v, branches)] : []), allAt(v, m, stars, "命宮")];
    return out(checks, [m]);
  };
}
/** 宮の指定がない格局: 12宮を走査して、条件を満たす宮をすべて返す */
function scan(v: ChartView, text: string, test: (b: Branch) => { ok: boolean; detail: string }): EvalOutcome {
  const hits = BRANCHES_ALL.map((b) => ({ b, ...test(b) })).filter((x) => x.ok);
  return {
    matched: hits.length > 0,
    palaces: hits.map((h) => h.b),
    checks: [ck(text, hits.length > 0, hits.length > 0 ? hits.map((h) => `${v.label(h.b)}: ${h.detail}`).join("／") : "条件を満たす宮なし")],
  };
}

const TENMA_ISSUE: SourceIssue = {
  kind: "sourceDifference",
  blocking: true,
  note: "天馬の位置に資料差がある（§18 U10。入門 表9は月系。基礎２ S38・S39 の命盤と基礎編 S19 の命盤は天馬だけがエンジンと違う）。天馬が条件に直接入るため成立と断定しない",
};
const S37_HUA_ISSUE = (stem: string): SourceIssue => ({
  kind: "sourceDifference",
  blocking: false,
  note: `四化表の差: 基礎２ S37 は ${stem}。既存の入門 表10 を正本として維持（§23.4 確定 7）`,
});

// ---------------------------------------------------------------------------
// 33格
// ---------------------------------------------------------------------------

export const PATTERN_RULES: readonly PatternRule[] = [
  {
    id: "K2-01", // 紫府同宮格
    sourceIssues: [],
    evaluate: mingPattern(["寅", "申"], ["紫微星", "天府星"]),
  },
  {
    id: "K2-02", // 府相朝垣格: 天府星、天相星が三方から命宮に加会
    sourceIssues: [
      { kind: "sourceDifference", blocking: false, note: "全書（referenceOnly）の府相朝垣は「命宮無主星」を加える。基礎２の本文と S3 の図（命宮に武曲）は主星の有無を問わない" },
    ],
    evaluate: (v) => out([allJiahui(v, v.mingBranch, ["天府星", "天相星"], "天府・天相が三方から命宮に加会")], [v.mingBranch]),
  },
  {
    id: "K2-03", // 紫府朝垣格
    sourceIssues: [
      { kind: "notation", blocking: false, note: "条件１と条件２は OR（2026-10-01 ユーザー確定）。S4 の図三（命宮辰・紫微天府 申・天相 子・命宮に武曲）は条件１で一致する" },
      { kind: "ambiguity", blocking: false, note: "条件２の「紫微星が辰に入宮し…」も「申宮が命宮となり」に続く文として、命宮申で判定する" },
      { kind: "sourceDifference", blocking: false, note: "全書（referenceOnly）の紫府朝垣は「寅安命午戌紫府來朝」" },
    ],
    evaluate: (v) => {
      const m = v.mingBranch;
      const area = [m, ...v.sanfangSizheng(m)];
      const inArea = (s: PlacedStar) => area.includes(v.posOf(s));
      const others = v.luckyIn(area, ["紫微星", "天府星", "天相星"]);
      const c1 = inArea("紫微星") && inArea("天府星") && inArea("天相星") && others.length > 0;
      const c2a = m === "申" && v.posOf("紫微星") === "子" && inArea("天相星") && inArea("天府星");
      const c2b = m === "申" && v.posOf("紫微星") === "辰" && inArea("天相星") && inArea("天府星") && inArea("武曲星");
      const checks = [
        ck("条件１: 命宮と三合四正に紫微・天府・天相・その他吉星が加会", c1, `命宮と三方四正（${area.join("・")}）: 紫微 ${v.posOf("紫微星")}・天府 ${v.posOf("天府星")}・天相 ${v.posOf("天相星")}、その他吉星 ${list(others) || "なし"}`),
        ck("条件２: 申宮命宮で紫微 子（天相・天府が三合四正）、または紫微 辰（天相・天府・武曲が三合四正）", c2a || c2b, `命宮 ${m}・紫微 ${v.posOf("紫微星")}`),
      ];
      const matched = c1 || c2a || c2b;
      return { matched, palaces: matched ? [m] : [], checks };
    },
  },
  {
    id: "K2-04", // 明珠出海格
    sourceIssues: [
      { kind: "notation", blocking: false, note: "「吉星が加会する」は入門 p.15 の吉星をそのまま使い、太陽・太陰も除かない（2026-10-01 ユーザー確定）。命宮未のとき太陽・太陰は三合宮にあるため、この項目は太陽・太陰の位置で満たされる" },
      { kind: "sourceDifference", blocking: false, note: "全書（referenceOnly）の明珠出海は「日月同居廟旺會命垣」" },
    ],
    evaluate: (v) => {
      const m = v.mingBranch;
      return out(
        [
          mingIn(v, ["未"]),
          ck("太陽が卯", v.posOf("太陽星") === "卯", `太陽 ${v.posOf("太陽星")}`),
          ck("太陰が亥", v.posOf("太陰星") === "亥", `太陰 ${v.posOf("太陰星")}`),
          luckyJiahui(v, m, "吉星が加会する"),
        ],
        [m],
      );
    },
  },
  {
    id: "K2-05", // 日月並明格
    sourceIssues: [
      { kind: "sourceDifference", blocking: false, note: "全書（referenceOnly）の日月並明は条件の書き方が違う" },
    ],
    evaluate: (v) => {
      const m = v.mingBranch;
      const sf = v.sanfangSizheng(m);
      const res = (["太陽星", "太陰星"] as const).map((s) => {
        const st = v.strengthOf(s);
        return ck(
          `${short(s)}が廟旺の宮にあり命宮の三方・対宮にある`,
          sf.includes(v.posOf(s)) && (st === "廟" || st === "旺"),
          `${short(s)} ${v.posOf(s)}（${st ?? "旺衰なし"}）・命宮の三方四正 ${sf.join("・")}`,
        );
      });
      return out(res, [m]);
    },
  },
  { id: "K2-06", sourceIssues: [], evaluate: mingPattern(["卯"], ["太陽星", "天梁星"]) }, // 日照雷門格
  {
    id: "K2-07", // 月朗天門格
    sourceIssues: [{ kind: "notation", blocking: false, note: "全書（referenceOnly）「月落亥宮」が「又名月朗天門」と別名を明記" }],
    evaluate: mingPattern(["亥"], ["太陰星"]),
  },
  {
    id: "K2-08", // 巨機同臨格
    sourceIssues: [{ kind: "notation", blocking: false, note: "「酉命宮のほうが良い格」は同じ格局の中の記述（順位付けに使わない）。全書の巨機居卯は referenceOnly" }],
    evaluate: mingPattern(["卯", "酉"], ["天機星", "巨門星"]),
  },
  {
    id: "K2-09", // 機月同梁格: 天機星、太陰星、天梁星、天同星が三方に会合（宮の指定なし）
    sourceIssues: [
      { kind: "ambiguity", blocking: false, note: "「三方」は S10 の図九（本宮 申に天機太陰、三合の辰に天同・子に天梁）に従い本宮＋三合2宮として読む" },
    ],
    evaluate: (v) =>
      scan(v, "天機・太陰・天梁・天同が三方に会合", (b) => {
        const area = v.sanfangWithSelf(b);
        const ok = (["天機星", "太陰星", "天梁星", "天同星"] as const).every((s) => area.includes(v.posOf(s)));
        return { ok, detail: `三方（${area.join("・")}）に天機・太陰・天梁・天同` };
      }),
  },
  {
    id: "K2-10", // 石中隠玉格
    sourceIssues: [
      { kind: "notation", blocking: false, note: "「左輔、右弼、文昌、天魁、天鉞に会う」は5星すべて必要（「いずれか」「等」がないため。2026-10-01 ユーザー確定）。「会う」は同宮または加会" },
    ],
    evaluate: (v) => {
      const m = v.mingBranch;
      const kinds = v.chart.transformations.filter((t) => t.star === "巨門星").map((t) => t.kind);
      const hua = kinds.includes("化禄星") || kinds.includes("化権星");
      const partners: PlacedStar[] = ["左輔星", "右弼星", "文昌星", "天魁星", "天鉞星"];
      const met = partners.map((s) => ({ s, at: v.meets(m, s) }));
      return out(
        [
          mingIn(v, ["子", "午"]),
          allAt(v, m, ["巨門星"], "命宮"),
          ck("対宮に天機", v.has(v.opposite(m), "天機星"), `対宮 ${v.opposite(m)}`),
          ck("巨門に化禄または化権", hua, `巨門の四化: ${kinds.map(short).join("・") || "なし"}`),
          ck("左輔・右弼・文昌・天魁・天鉞に会う", met.every((x) => x.at), met.map((x) => `${short(x.s)}${x.at ? `＝${x.at}` : "なし"}`).join("・")),
        ],
        [m],
      );
    },
  },
  {
    id: "K2-11", // 巨日同宮格
    sourceIssues: [],
    // 成立条件は従来どおり（命宮 寅・申に太陽・巨門）。本文「三台・八座が加会するを喜ぶ」は成立条件にせず補足として持つ（§37.5）。
    // 加会は他の格局と同じ三方四正（三合2宮＋対宮）。三台・八座は新規諸星の日系（星IDで引く）
    evaluate: (v) => {
      const r = mingPattern(["寅", "申"], ["太陽星", "巨門星"])(v);
      const m = v.mingBranch;
      r.enhancements = (["birth_day/三台", "birth_day/八座"] as const satisfies readonly MinorStarId[]).map((id): EnhancementCheck => {
        const at = v.minorJiahui(m, id);
        const name = id.split("/")[1];
        return {
          text: `${name}が加会`,
          result: at ? "applies" : "clear",
          detail: at ? `${name}（${at}）が${v.label(m)}に加会` : `${v.label(m)}の三方四正（${v.sanfangSizheng(m).join("・")}）に${name}なし（${name}は${v.minor.positions[id]!.join("・")}）`,
        };
      });
      return r;
    },
  },
  {
    id: "K2-12", // 月生滄海格: 命宮または田宅宮が子、太陰・天同が同宮、吉星が加会
    sourceIssues: [{ kind: "sourceDifference", blocking: false, note: "全書（referenceOnly）の月生滄海は田宅宮だけ" }],
    evaluate: (v) => {
      const cands = (["命宮", "田宅宮"] as const).map((name) => {
        const b = v.branchOfPalace(name);
        const cs = [
          ck(`${name}が子`, b === "子", `${name}は${b}`),
          allAt(v, b, ["太陰星", "天同星"], name),
          luckyJiahui(v, b, `${name}に吉星が加会`),
        ];
        return { b, cs, ok: allTrue(cs) === true };
      });
      const hit = cands.filter((c) => c.ok);
      return {
        matched: hit.length > 0,
        palaces: hit.map((c) => c.b),
        checks: [ck("命宮または田宅宮のどちらか", hit.length > 0, cands.map((c) => `${v.label(c.b)}: ${c.cs.map((x) => `${x.text}${x.result ? "○" : "×"}`).join("、")}`).join("／"))],
      };
    },
  },
  {
    id: "K2-13", // 日月照壁格: 丑、未宮が田宅宮で太陽、太陰が同宮、吉星と加会することが条件
    sourceIssues: [{ kind: "sourceDifference", blocking: false, note: "全書（referenceOnly）は「喜居墓庫」" }],
    evaluate: (v) => {
      const b = v.branchOfPalace("田宅宮");
      return out(
        [ck("田宅宮が丑・未", b === "丑" || b === "未", `田宅宮は${b}`), allAt(v, b, ["太陽星", "太陰星"], "田宅宮"), luckyJiahui(v, b, "吉星と加会")],
        [b],
      );
    },
  },
  {
    id: "K2-14", // 貧武同行格
    sourceIssues: [{ kind: "notation", blocking: false, note: "原文「貧武同行格」「貧狼星」は貪狼星（S15 図十五・S38 は「貪武同行」）" }],
    evaluate: mingPattern(["丑", "未"], ["貪狼星", "武曲星"]),
  },
  {
    id: "K2-15", // 日月夾命格
    sourceIssues: [
      { kind: "sourceConflict", blocking: true, note: "S38 の命盤は「日月夾命」と印字するが、命宮丑に天府がない（武曲・貪狼）。本文条件と命例が合わない（§23.4 確定 9。条件は書き換えない）" },
    ],
    evaluate: (v) => {
      const m = v.mingBranch;
      const idx = BRANCHES_ALL.indexOf(m);
      const nb = [BRANCHES_ALL[(idx + 11) % 12], BRANCHES_ALL[(idx + 1) % 12]];
      const sun = v.posOf("太陽星");
      const moon = v.posOf("太陰星");
      return out(
        [
          mingIn(v, ["丑", "未"]),
          allAt(v, m, ["天府星"], "命宮"),
          ck("太陽と太陰に挟まれる", nb.includes(sun) && nb.includes(moon) && sun !== moon, `命宮の前後 ${nb.join("・")}／太陽 ${sun}・太陰 ${moon}`),
        ],
        [m],
      );
    },
  },
  {
    id: "K2-16", // 英星入廟格
    sourceIssues: [
      {
        kind: "notation",
        blocking: false,
        note: `破格は煞星（入門の凶星。破軍自身を除く）が命宮に同宮・命宮と冲・命宮と破の位置のいずれか（2026-10-01 ユーザー確定）。冲は対宮（基礎編 S16「対冲」）、破は ${BRANCH_PO_SOURCE}`,
      },
    ],
    evaluate: (v) => {
      const m = v.mingBranch;
      const base = out([mingIn(v, ["子", "午"]), allAt(v, m, ["破軍星"], "命宮")], [m]);
      if (base.matched !== true) return base;
      const same = v.maleficIn([m], ["破軍星"]);
      const opp = chongOf(m);
      const chong = v.maleficIn([opp]);
      const po = poOf(m);
      const poStars = v.maleficIn([po]);
      const breaks: BreakCheck[] = [
        {
          text: "煞星・冲・破があると格が崩れる（煞星が命宮に同宮）",
          result: same.length > 0 ? "broken" : "clear",
          detail: same.length > 0 ? `命宮の煞星（破軍自身を除く）: ${list(same)}` : "命宮に煞星なし（破軍自身を除く）",
        },
        {
          text: "煞星・冲・破があると格が崩れる（煞星が命宮と冲）",
          result: chong.length > 0 ? "broken" : "clear",
          detail: chong.length > 0 ? `冲（対宮 ${v.label(opp)}）の煞星: ${list(chong)}` : `冲（対宮 ${v.label(opp)}）に煞星なし`,
        },
        {
          text: "煞星・冲・破があると格が崩れる（煞星が命宮と破）",
          result: poStars.length > 0 ? "broken" : "clear",
          detail: poStars.length > 0 ? `破（${v.label(po)}）の煞星: ${list(poStars)}` : `破（${v.label(po)}）に煞星なし`,
        },
      ];
      return { ...base, breaks };
    },
  },
  {
    id: "K2-17", // 七殺朝斗格: 吉星に会って七殺が吉となれば成格
    sourceIssues: [
      { kind: "notation", blocking: false, note: "「吉星に会って七殺が吉となれば成格」は、吉星と加会することで七殺が吉となる一続きの条件として判定（2026-10-01 ユーザー確定）" },
      { kind: "sourceDifference", blocking: false, note: "全書（referenceOnly）は寅申子午。基礎２は午を挙げない" },
    ],
    evaluate: (v) => {
      const m = v.mingBranch;
      return out([mingIn(v, ["寅", "申", "子"]), allAt(v, m, ["七殺星"], "命宮"), luckyJiahui(v, m, "吉星と加会して七殺が吉となる")], [m]);
    },
  },
  {
    id: "K2-18", // 馬頭帯箭格
    sourceIssues: [
      {
        kind: "sourceConflict",
        blocking: true,
        note: "S19 の図十九は命宮午に擎羊だけで、天同は対宮（子）。確定条件（命宮に貪狼または天同）では図が成立しない",
      },
      { kind: "sourceDifference", blocking: false, note: "全書（referenceOnly）「馬頭帯剣（…不是居午格）」は名称と午の扱いが違う" },
      { kind: "notation", blocking: false, note: "原文「擎羊」＝擎羊星、「貧狼」＝貪狼星" },
    ],
    // 命宮=午 かつ 命宮に（貪狼 または 天同） かつ （化禄 または 擎羊）が命宮に同宮 または 命宮の三方四正に加会（2026-10-01 ユーザー確定）
    evaluate: (v) => {
      const m = v.mingBranch;
      const main = (["貪狼星", "天同星"] as const).filter((s) => v.has(m, s));
      const partners = (["化禄星", "擎羊星"] as const).map((s) => ({ s, at: v.meets(m, s) }));
      const hit = partners.filter((x) => x.at);
      return out(
        [
          mingIn(v, ["午"]),
          ck("命宮に貪狼または天同", main.length > 0, main.length ? `命宮に${main.map(short).join("・")}` : `貪狼 ${v.posOf("貪狼星")}・天同 ${v.posOf("天同星")}`),
          ck(
            "化禄または擎羊が命宮に同宮・または三方四正から加会",
            hit.length > 0,
            partners.map((x) => `${short(x.s)}${x.at ? `＝${x.at}（${x.at === m ? "同宮" : "加会"}）` : "なし"}`).join("・"),
          ),
        ],
        [m],
      );
    },
  },
  {
    id: "K2-19", // 三奇嘉會格
    sourceIssues: [
      {
        kind: "notation",
        blocking: false,
        note: "成立を探す範囲は基準宮（命宮または身宮）そのもの＋その三方四正の4宮（2026-10-01 ユーザー確定。共通の三方四正の定義は変えない）。S20 の図二十（命宮子に化禄）・S38 の命盤（命宮丑に化科）とも一致",
      },
      { kind: "notation", blocking: false, note: "表記: 三奇嘉會（S20）・三奇嘉会（S38 本文）・三奇加会（S38 盤面）" },
      S37_HUA_ISSUE("戊の化科＝太陽・壬の化科＝天府（入門は右弼・左輔）"),
    ],
    evaluate: (v) => {
      const bases: { name: string; b: Branch }[] = [
        { name: "命宮", b: v.mingBranch },
        { name: "身宮", b: v.shenBranch },
      ].filter((x, i, a) => a.findIndex((y) => y.b === x.b) === i);
      const three: TransformationKind[] = ["化禄星", "化権星", "化科星"];
      const per = bases.map(({ name, b }) => {
        const area = [b, ...v.sanfangSizheng(b)];
        const found = three.map((k) => ({ k, at: area.find((x) => v.has(x, k)) ?? null }));
        const c = ck(
          `${name}とその三方四正に化禄・化権・化科が揃う`,
          found.every((f) => f.at),
          `${v.label(b)}と三方四正（${area.join("・")}）に ${found.map((f) => `${short(f.k)}${f.at ? `＝${f.at}` : "なし"}`).join("・")}`,
        );
        return { name, b, c };
      });
      const hits = per.filter((p) => p.c.result === true);
      const checks = [ck("命宮または身宮のどちらかで成立", hits.length > 0, per.map((p) => `${p.name}: ${p.c.result ? "○" : "×"} ${p.c.detail}`).join("／"))];
      if (hits.length === 0) return { matched: false, palaces: [], checks };
      const ji = v.huaOf("化忌星");
      const jiNote = hits.some((h) => v.sanfangSizheng(h.b).includes(ji.branch) || h.b === ji.branch)
        ? `化忌（${short(ji.star)}・${ji.branch}）が同宮・加会しているが、資料「化忌が同宮しても成格」により成立`
        : "";
      if (jiNote) checks.push(ck("化忌が同宮しても成格", true, jiNote));
      const warnings: WarningCheck[] = hits.flatMap((h) => {
        const g = v.gradeOf(h.b);
        const sat = v.maleficIn(v.sanfangSizheng(h.b));
        return [
          {
            text: "基準の宮の力量が弱いと格が崩れやすい",
            result: g === "弱" || g === "最弱" ? "applies" : "clear",
            detail: `${v.label(h.b)}の運命指数 ${v.power.byBranch[h.b].index.toFixed(1)}（${g}）`,
          },
          {
            text: "煞星が加会すると格が崩れやすい",
            result: sat.length > 0 ? "applies" : "clear",
            detail: sat.length > 0 ? `${v.label(h.b)}に加会する煞星: ${list(sat)}` : `${v.label(h.b)}に加会する煞星なし`,
          },
        ] as WarningCheck[];
      });
      return { matched: true, palaces: hits.map((h) => h.b), checks, warnings };
    },
  },
  { id: "K2-20", sourceIssues: [], evaluate: mingPattern(["申"], ["廉貞星"]) }, // 雄宿朝垣格
  {
    id: "K2-21", // 禄合鴛鴦格
    sourceIssues: [
      {
        kind: "sourceConflict",
        blocking: true,
        note: "S22 の命例（命宮卯に禄存・天機化禄）は三合宮 亥に地空・地劫があり、煞星＝入門の凶星（§23.4 確定 4）では「煞星と加会しない」を満たさず不成立。命例と合わない",
      },
      { kind: "sourceDifference", blocking: false, note: "全書（referenceOnly）の鴛鴦禄會は内容が近いが名称が違う" },
    ],
    evaluate: (v) => {
      const names = ["命宮", "身宮", "財帛宮"] as const;
      const bs = [...new Set(names.map((n) => (n === "身宮" ? v.shenBranch : v.branchOfPalace(n))))];
      const same = bs.filter((b) => v.has(b, "禄存星") && v.has(b, "化禄星"));
      const clean = same.filter((b) => v.maleficIn(v.sanfangSizheng(b)).length === 0);
      const checks = [
        ck("命宮・身宮・財帛宮のいずれかに禄存・化禄が同宮", same.length > 0, same.length ? same.map((b) => v.label(b)).join("・") : `禄存 ${v.posOf("禄存星")}・化禄 ${v.huaOf("化禄星").branch}`),
        ck(
          "煞星と加会しない",
          same.length === 0 ? null : clean.length > 0,
          same.map((b) => `${v.label(b)}に加会する煞星（入門の凶星）: ${list(v.maleficIn(v.sanfangSizheng(b))) || "なし"}`).join("／") || "（同宮の宮なし）",
        ),
      ];
      const matched = same.length === 0 ? false : clean.length > 0;
      return { matched, palaces: clean, checks };
    },
  },
  {
    id: "K2-22", // 双禄朝垣格: 化禄星と禄存星が対宮、三合宮に入宮（宮の指定なし）
    sourceIssues: [],
    evaluate: (v) => {
      const lu = v.huaOf("化禄星").branch;
      const cun = v.posOf("禄存星");
      return scan(v, "化禄と禄存が対宮・三合宮に入宮", (b) => {
        const sf = v.sanfangSizheng(b);
        return { ok: sf.includes(lu) && sf.includes(cun), detail: `三方四正（${sf.join("・")}）に化禄 ${lu}・禄存 ${cun}` };
      });
    },
  },
  {
    id: "K2-23", // 禄馬交馳格: 寅申巳亥に天馬、天馬の対宮に化禄か禄存（宮の指定なし）
    sourceIssues: [TENMA_ISSUE],
    evaluate: (v) => {
      const ma = v.posOf("天馬星");
      const opp = v.opposite(ma);
      const hit = v.has(opp, "化禄星") || v.has(opp, "禄存星");
      return {
        matched: ["寅", "申", "巳", "亥"].includes(ma) && hit,
        palaces: hit ? [ma] : [],
        checks: [
          ck("寅・申・巳・亥に天馬", ["寅", "申", "巳", "亥"].includes(ma), `天馬 ${v.label(ma)}`),
          ck("天馬の対宮に化禄か禄存", hit, `対宮 ${v.label(opp)}: ${v.starsAt(opp).map(short).join("・") || "星なし"}`),
        ],
      };
    },
  },
  {
    id: "K2-24", // 坐貴向貴格: 天魁星、天鉞星が命宮、遷移宮に入宮
    sourceIssues: [
      { kind: "notation", blocking: false, note: "S38 の命盤は同じ配置を「天乙拱命」と印字（基礎２に記載なし）。全書（referenceOnly）は命・身" },
    ],
    evaluate: (v) => {
      const m = v.mingBranch;
      const q = v.branchOfPalace("遷移宮");
      const kui = v.posOf("天魁星");
      const yue = v.posOf("天鉞星");
      const ok = (kui === m && yue === q) || (kui === q && yue === m);
      return out([ck("天魁・天鉞が命宮・遷移宮に入宮", ok, `天魁 ${kui}・天鉞 ${yue}／命宮 ${m}・遷移宮 ${q}`)], [m, q]);
    },
  },
  {
    id: "K2-25", // 君臣慶會格
    sourceIssues: [
      {
        kind: "sourceConflict",
        blocking: true,
        note: "S26 の命例（命宮午 紫微）は文昌が辰で三方四正の外。本文の列挙（左輔星、右弼星、文昌星、文曲星が…加会）を4星すべてとして判定すると命例と合わない",
      },
      { kind: "sourceDifference", blocking: false, note: "全書（referenceOnly）の君臣慶會は「紫微左右同守命」" },
    ],
    evaluate: (v) => {
      const m = v.mingBranch;
      return out([allAt(v, m, ["紫微星"], "命宮"), allJiahui(v, m, ["左輔星", "右弼星", "文昌星", "文曲星"], "左輔・右弼・文昌・文曲が三方四正に加会")], [m]);
    },
  },
  {
    id: "K2-26", // 日月同臨格
    sourceIssues: [
      { kind: "sourceConflict", blocking: true, note: "S27 の命例は命宮戌で、太陽・太陰は未（子女宮）。本文条件（丑・未の命宮）と合わない（§23.4 確定 9。条件は書き換えない）" },
    ],
    evaluate: (v) => {
      const m = v.mingBranch;
      return out([mingIn(v, ["丑", "未"]), allAt(v, m, ["太陽星", "太陰星"], "命宮"), luckyJiahui(v, m, "吉星と加会")], [m]);
    },
  },
  {
    id: "K2-27", // 日月蔵輝格: 太陽、太陰星が落陥し巨門星と加会する（宮の指定なし）
    sourceIssues: [
      { kind: "ambiguity", blocking: false, note: "「巨門星と加会」は S28 の図（命宮戌に太陽、太陰 辰、巨門 午）に従い、基準宮の本宮と三方四正に太陽・太陰・巨門がそろうこととして判定" },
    ],
    evaluate: (v) => {
      const fall = (s: PlacedStar) => {
        const st = v.strengthOf(s);
        return st === "不得地" || st === "陥";
      };
      const sun = v.posOf("太陽星");
      const moon = v.posOf("太陰星");
      const both = fall("太陽星") && fall("太陰星");
      const r = scan(v, "落陥の太陽・太陰と巨門が加会", (b) => {
        const area = [b, ...v.sanfangSizheng(b)];
        const ok = both && area.includes(sun) && area.includes(moon) && area.includes(v.posOf("巨門星"));
        return { ok, detail: `太陽 ${sun}・太陰 ${moon}・巨門 ${v.posOf("巨門星")}` };
      });
      r.checks.unshift(
        ck("太陽・太陰が落陥（不得地または陥）", both, `太陽 ${sun}（${v.strengthOf("太陽星")}）・太陰 ${moon}（${v.strengthOf("太陰星")}）`),
      );
      return r;
    },
  },
  { id: "K2-28", sourceIssues: [], evaluate: mingPattern(["午"], ["紫微星"]) }, // 極響離命格
  {
    id: "K2-29", // 化煞為権格: 巳、亥宮で紫微星と七殺星が同宮（宮の指定なし）
    sourceIssues: [{ kind: "notation", blocking: false, note: "見出し「化煞為権」・本文「化殺為権」" }],
    evaluate: (v) =>
      scan(v, "巳・亥で紫微・七殺が同宮", (b) => ({
        ok: (b === "巳" || b === "亥") && v.has(b, "紫微星") && v.has(b, "七殺星"),
        detail: "紫微・七殺が同宮",
      })),
  },
  { id: "K2-30", sourceIssues: [], evaluate: mingPattern(["午"], ["天梁星"]) }, // 壽星入廟格
  {
    id: "K2-31", // 桃花犯主格
    sourceIssues: [
      {
        kind: "ambiguity",
        blocking: true,
        note: "紅鸞・天喜（年支系）・沐浴（長生十二星）は判定する（§37.5）。咸地（咸池）は将前十二神で配置規則が資料になく、天桃は配置規則がない。「など」で範囲も確定しないため、いずれもなければ判定できない",
      },
    ],
    evaluate: (v) => {
      const m = v.mingBranch;
      const sat = v.maleficIn([m, ...v.sanfangSizheng(m)], ["貪狼星"]);
      const hong = v.jiahui(m, "紅鸞星");
      // 天喜・沐浴は星ID（系列）で引く。沐浴は長生十二星の沐浴（同名の他系列と混同しない）
      const tianxi = v.minorJiahui(m, "year_branch/天喜");
      const muyu = v.minorJiahui(m, "changsheng/沐浴");
      const found = [hong && `紅鸞 ${hong}`, tianxi && `天喜 ${tianxi}`, muyu && `沐浴 ${muyu}`].filter(Boolean);
      return out(
        [
          mingIn(v, ["卯", "酉"]),
          allAt(v, m, ["紫微星", "貪狼星"], "命宮"),
          ck("煞星に会う（同宮または加会。貪狼自身を除く）", sat.length > 0, sat.length ? list(sat) : "煞星なし"),
          ck(
            "紅鸞・天喜・咸池・天桃・沐浴などに加会",
            found.length > 0 ? true : null,
            found.length > 0 ? `加会: ${found.join("・")}` : "紅鸞・天喜・沐浴は加会なし。咸池・天桃は判定できない",
          ),
        ],
        [m],
      );
    },
  },
  {
    id: "K2-32", // 羊陀夾忌格: 禄存星が入宮する宮に化忌星が同宮（宮の指定なし）
    sourceIssues: [
      {
        kind: "notation",
        blocking: false,
        note: "S38 本文「対宮となる疾厄宮も同じ格に属す」は、成立した宮の格の影響が対宮にも及ぶ関連情報として affectedPalaces に入れる（対宮で別の成立判定はしない。2026-10-01 ユーザー確定）",
      },
    ],
    evaluate: (v) => {
      const r = scan(v, "禄存の宮に化忌が同宮", (b) => ({
        ok: v.has(b, "禄存星") && v.has(b, "化忌星"),
        detail: `禄存・化忌（${short(v.huaOf("化忌星").star)}）が同宮`,
      }));
      r.affected = r.palaces.map((b) => ({ branch: v.opposite(b), from: b, note: "対宮もこの格の影響を受ける" }));
      return r;
    },
  },
  {
    id: "K2-33", // 刑忌夾印格: 天相星が命宮、巨門星が入宮する宮に化忌星が同宮
    sourceIssues: [{ kind: "notation", blocking: false, note: "S38 は大限で父母宮の天相に適用（大限は対象外）。「刑」は天梁の別名、「印星」は天相（S33）" }],
    evaluate: (v) => {
      const m = v.mingBranch;
      const ju = v.posOf("巨門星");
      return out([allAt(v, m, ["天相星"], "命宮"), ck("巨門の宮に化忌が同宮", v.has(ju, "化忌星"), `巨門 ${ju}・化忌 ${v.huaOf("化忌星").branch}（${short(v.huaOf("化忌星").star)}）`)], [m]);
    },
  },
];

/** 吉星・凶星の分類の件数（テスト用） */
export const LUCK_COUNTS = Object.values(STAR_LUCK).reduce<Record<string, number>>((a, c) => ({ ...a, [c]: (a[c] ?? 0) + 1 }), {});
