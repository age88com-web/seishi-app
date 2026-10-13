// src/lib/qizheng_palace_reading.ts
//
// 七政四餘：宮詳細（PalaceDetailPanel）の鑑定内容の組み立て（React なし・純粋関数）。
// 画面の宮詳細パネルと解釈印刷（qizheng_palace_print.ts）の両方がこの結果を使う。
// 中身は従来 PalaceDetailPanel の中にあった計算をそのまま移したもの（判定・文言・順序は変えていない）。
// 盤全体の格局の要約文（鑑定要約の末尾）は、格局データの読み込みが要るためパネル側で足す。

import {
  getZgStarLayers,
  toZgPalace,
  toZgStarKey,
  type ZgStarLayers,
} from "@/lib/zhangguo_interpretations";
import {
  conditionalParts,
  evaluateTenLord,
  findConjunctions,
  getHenyouMeaning,
  getPalaceMeaning,
  getPalaceStarRoles,
  getRoleGeneralRule,
  getTenLordsForPalace,
  lookupShensha,
  match24ForPalace,
  matchConditionalRules,
  matchGuardRules,
  matchPalaceStarRules,
  type QzMatchContext,
  type QzRecord,
  type QzRule,
  type ShenshaOrigin,
} from "@/lib/qizheng_interpretations";
import { HENYOU_MARK_TO_LABEL } from "@/lib/henyou";
import { qzDisplayDecision, type QzDisplayContext } from "@/lib/qizheng_display_conditions";
import { PALACE_MAIN_STAR } from "@/lib/kakkyoku_engine";
import type { PalaceDetail, PalaceDetailStar } from "@/components/PalaceDetailPanel";

export const MOTION_LABEL: Record<string, string> = { "+": "順行", "-": "逆行", "*": "留" };
export const ORIGIN_LABEL: Record<string, string> = {
  year_stem: "年干神殺", year_branch: "年支神殺", month_branch: "月支神殺",
  henyou2_year_branch: "年支神殺（星に付く）", henyou2_stem_ming: "年干命宮神殺",
};
export const SEVEN_KEYS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];
export const starName = (mark: string) => HENYOU_MARK_TO_LABEL[mark as keyof typeof HENYOU_MARK_TO_LABEL] ?? mark;
export const firstSentence = (s: string | null | undefined) => {
  if (!s) return "";
  const i = s.indexOf("。");
  return i >= 0 ? s.slice(0, i + 1) : s;
};
export const stateText = (s: PalaceDetailStar | null | undefined) =>
  s ? [s.status, MOTION_LABEL[s.motion], s.extra].filter(Boolean).join("・") : "";

// ---------- 解釈本文の表示条件（lib/qizheng_display_conditions.ts）----------
// 対象星 s が十二支 branch にあるとして、盤の既存値から判定用の値を集める（s が null なら星に依らない条件だけ判定できる）
export function displayCtxFor(detail: PalaceDetail, s: PalaceDetailStar | null, branch: string): QzDisplayContext {
  const zk = (x: PalaceDetailStar) => toZgStarKey(x.key) ?? toZgStarKey(x.label) ?? x.key;
  return {
    star: s ? { key: zk(s), motion: s.motion, status: s.status } : null,
    palaceName: detail.palaceNameByBranch[branch] ?? "",
    isShenPalace: !!detail.shenBranch && branch === detail.shenBranch,
    starsInPalace: detail.allStars.filter((x) => x.branch === branch).map(zk),
    statusOf: (k) => detail.allStars.find((x) => zk(x) === k)?.status ?? "",
    isDayBirth: detail.isDayBirth,
    sex: detail.sex,
    yearStem: detail.yearStem,
    yearBranch: detail.yearBranch,
    roles: detail.henyou2All.map((h) => ({ name: h.name, starKey: h.starKey })),
  };
}
/** 成立条件を満たさない層は null にし、その条件の説明を hidden に残す */
export type ZgHidden = Partial<Record<keyof ZgStarLayers, string>>;
export function gateZgLayers(layers: ZgStarLayers, dctx: QzDisplayContext): { layers: ZgStarLayers; hidden: ZgHidden } {
  const out: ZgStarLayers = { ...layers };
  const hidden: ZgHidden = {};
  for (const k of ["general", "branch", "mansion", "palace"] as const) {
    const rec = layers[k];
    if (!rec) continue;
    const d = qzDisplayDecision(rec.id, dctx);
    if (!d.show) { out[k] = null; hidden[k] = d.rule?.conditions ?? ""; }
  }
  return { layers: out, hidden };
}
export const hiddenNote = (cond: string) => `資料の成立条件（${cond}）をこの盤で確認できないため表示しない`;

// ---------- 鑑定要約の文の整形（従来のパネル内の関数） ----------
// 先頭から n 文（長すぎる場合は 1 文）
export const sentences = (src: string | null | undefined, n: number) => {
  if (!src) return "";
  const xs = src.split("。").filter((x) => x.trim()).map((x) => x + "。");
  let out = xs.slice(0, n).join("");
  if (n > 1 && out.length > 140) out = xs[0] ?? "";
  return out.replace(/。$/, "");
};
const shortMeaning = (x: string | null | undefined) => (x ?? "").replace(/。$/, "");
// 要約に載せる資料本文の表示整形（出典紹介の言い回しだけを外す。データは変更しない）
export const plain = (x: string) => x.replace(/原典には/g, "").replace(/とされるが/g, "だが");

/**
 * 鑑定要約の1ブロック。tag は印刷で重複を整理するための出どころ（画面は tag に関係なく全部を順に出す）:
 *   palaceMeaning … 宮の基本意味の要約（「2. 宮の基本意味」と同じ資料）
 *   lordFact      … 宮主の所在・状態（一覧表と同じ事実）
 *   lordLayer     … 宮主星の張果星宗の層の冒頭（宮主星の象意と同じ資料）
 *   starsPresence … 入宮星の有無
 *   starLayer     … 入宮星の張果星宗の層の冒頭（星の象意と同じ資料）
 *   henyou        … この宮の変曜（意味と成立した条件）
 *   shensha       … この宮の神殺（意味と成立した条件）
 *   judgments     … この宮・宮主に該当する資料の判断
 *   kakkyoku      … 盤全体の格局（パネル側で足す）
 */
export type QzSummaryTag = "palaceMeaning" | "lordFact" | "lordLayer" | "starsPresence" | "starLayer" | "henyou" | "shensha" | "judgments" | "kakkyoku";
export type QzSumBlock = ({ kind: "p"; text: string } | { kind: "list"; title: string; items: string[] }) & { tag: QzSummaryTag };

/** 宮詳細の鑑定内容（従来 PalaceDetailPanel 内で計算していたもの） */
export function buildQzPalaceReading(detail: PalaceDetail) {
  const P = detail.palaceName;
  const meaning = getPalaceMeaning(P);
  const starKeys = detail.stars.map((s) => toZgStarKey(s.key) ?? s.key);
  const ctx: QzMatchContext = { chartPalaceName: P, isShenPalace: detail.isShenPalace, sex: detail.sex, starsInPalace: starKeys, isDayBirth: detail.isDayBirth };

  // ----- 宮主（既存の宮主表 PALACE_MAIN_STAR）-----
  const lord = detail.lord;
  const lb = lord?.body ?? null;
  const lordName = lord ? starName(lord.lordLabel) : "";
  const lordKey = lb ? toZgStarKey(lb.key) : null;
  const lordPalaceName = lb ? detail.palaceNameByBranch[lb.branch] ?? "" : "";
  const lordInThisPalace = !!lb && lb.branch === detail.branch;
  const starsAtLord = lb ? detail.allStars.filter((s) => s.branch === lb.branch) : [];
  const lordCtx: QzMatchContext = {
    chartPalaceName: lordPalaceName,
    isShenPalace: !!lb && lb.branch === detail.shenBranch,
    sex: detail.sex,
    starsInPalace: starsAtLord.map((s) => toZgStarKey(s.key) ?? s.key),
    isDayBirth: detail.isDayBirth,
  };
  const lordHenyou = lb ? (detail.henyouByBranch[lb.branch] ?? []).filter((h) => h.starLabel === lordName) : [];
  const lordHenyou2 = lord ? detail.henyou2All.filter((h) => h.mark === lord.lordLabel) : [];
  // 宮主星の解釈本文の表示条件は、宮主星の所在（宮・同宮星・旺廟陥など）で判定する
  const lordGated = lordKey && lb
    ? gateZgLayers(getZgStarLayers({ star: lordKey, branch: lb.branch, mansion: lb.mansion, palace: toZgPalace(lordPalaceName) }), displayCtxFor(detail, lb, lb.branch))
    : null;
  const lordLayers = lordGated?.layers ?? null;
  const lordStarRules = lb && lordKey
    ? matchPalaceStarRules(lb.branch, lordCtx.starsInPalace, detail.isDayBirth).filter((m) => m.star === lordKey)
    : [];

  // 専論十主（条件付き項目は既存結果で成立を確認できたものだけ。一般原則（A）だけを条件判定なしで折りたたみ表示）
  const findLabel = (label: string) => detail.allStars.find((s) => s.label === label);
  const tenLords = getTenLordsForPalace(P, detail.isShenPalace).map((rec) => ({
    rec,
    ev: lord
      ? evaluateTenLord(rec, {
          lordLabel: lord.lordLabel,
          lordBranch: lb?.branch ?? "",
          lordStatus: lb?.status ?? "",
          mingBranch: detail.mingBranch,
          palaceLordOf: (b) => String(PALACE_MAIN_STAR[b] ?? ""),
          starBranchOf: (l) => findLabel(l)?.branch ?? "",
          starStatusOf: (l) => findLabel(l)?.status ?? "",
          palaceNameOf: (b) => detail.palaceNameByBranch[b] ?? "",
        })
      : { matched: [] as { rule: QzRule; reason: string }[], principles: [] as QzRule[] },
  }));
  const tenLordPrinciples = tenLords.filter((t) => t.ev.principles.length > 0);
  const guard = matchGuardRules({
    chartPalaceName: P,
    isShenPalace: detail.isShenPalace,
    mingLordInThisPalace: detail.mingLord?.body?.branch === detail.branch,
    shenLordInThisPalace: detail.shenLord?.body?.branch === detail.branch,
    thisLordInMingPalace: !!lb && lb.branch === detail.mingBranch,
    mingLordInShenPalace: !!detail.shenBranch && detail.mingLord?.body?.branch === detail.shenBranch,
    shenLordInMingPalace: !!detail.mingBranch && detail.shenLord?.body?.branch === detail.mingBranch,
  });

  // ----- その他 -----
  // 同宮の象意のうち、昼夜などの成立条件があるものは成立を確認できたときだけ
  const conjDctx = displayCtxFor(detail, null, detail.branch);
  const conj = findConjunctions(starKeys).filter((c) => qzDisplayDecision(c.id, conjDctx).show);
  const roles = getPalaceStarRoles(detail.branch);
  const roleRule = getRoleGeneralRule();
  const starRuleMatches = matchPalaceStarRules(detail.branch, starKeys, detail.isDayBirth);
  const m24 = match24ForPalace({ chartPalaceName: P, isShenPalace: detail.isShenPalace, shenshaNames: detail.shensha.map((s) => s.name) });
  const starLabelByKey = new Map(detail.stars.map((s) => [toZgStarKey(s.key) ?? s.key, s.label]));
  const isMing = P === "命宮";

  // ----- 鑑定要約（資料の内容を定型文で整理。吉凶の総合判定・新しい因果づけはしない）-----
  const summary: QzSumBlock[] = [];
  const para = (text: string, tag: QzSummaryTag) => summary.push({ kind: "p", text, tag });
  const list = (title: string, items: string[], tag: QzSummaryTag) => { if (items.length) summary.push({ kind: "list", title, items, tag }); };
  // 張果星宗の1層を鑑定文として置く。本文が星名で始まらない場合だけ「○星が△にある。」を前置きする
  const STAR_HEADS = ["太陽", "太陰", "木星", "火星", "土星", "金星", "水星", "紫炁", "紫気", "紫氣", "月孛", "羅喉", "羅睺", "計都"];
  const layerText = (star: string, where: string, src: string | null | undefined, n: number) => {
    const t = plain(sentences(src, n));
    if (!t) return "";
    return (STAR_HEADS.some((h) => t.startsWith(h)) ? "" : `${star}が${where}にある。`) + `${t}。`;
  };

  // 1. 宮の基本意味
  if (meaning?.interpretation) para(`${P}（${detail.branch}）は、${shortMeaning(meaning.interpretation)}を見る宮。`, "palaceMeaning");

  // 2・3. 宮主と、その所在宮・宿・旺廟陥・順逆（入宮星がある宮では宮主名の事実だけ）
  const hasStars = detail.stars.length > 0;
  if (hasStars) {
    if (lord) para(`宮主は${lordName}。`, "lordFact");
  } else if (lord && lb) {
    const st = [
      lb.status ? `旺廟陥は「${lb.status}」` : "旺廟陥の該当はなく",
      MOTION_LABEL[lb.motion] ? `${MOTION_LABEL[lb.motion]}している` : "",
    ].filter(Boolean).join("、");
    para(`${P}の宮主は${lordName}。${lordName}は${lordPalaceName}（${lb.branch}）・${lb.mansion}宿にあり、${st}。` +
      (lb.extra ? `付記として「${lb.extra}」がある。` : ""), "lordFact");
  } else {
    para(`${P}の宮主は既存の宮主表から求められない。`, "lordFact");
  }

  // 4. 宮主の主要な解釈（空宮のときだけ。入宮星がある宮では入宮星の解釈を主とし、宮主の解釈文は出さない）
  if (lordLayers && !lordInThisPalace && !hasStars) {
    if (lordLayers.palace) para(layerText(lordName, lordPalaceName, lordLayers.palace.modern_japanese, 2), "lordLayer");
    if (lordLayers.branch) para(layerText(lordName, `${lb?.branch}宮`, lordLayers.branch.modern_japanese, 1), "lordLayer");
  }

  // 5. クリック中の宮に入っている星
  if (detail.stars.length === 0) {
    para(`${P}には十一曜が入っていないため、宮主である${lordName}の状態と所在を中心に見る。`, "starsPresence");
  } else {
    para(`${P}には${detail.stars.map((s) => starName(s.label)).join("・")}が入っている。` +
      (lordInThisPalace ? `宮主${lordName}自身もこの宮にある。` : ""), "starsPresence");
  }

  // 6. クリック中の宮に直接関係する主要解釈（入宮星の十二支宮・二十八宿・宮位／この宮の変曜／この宮の神殺）
  //    入宮星は「5. 星の象意」と同じ getZgStarLayers（星の実際の支・宿と選択宮位）で引き、
  //    十二支宮 → 二十八宿 → 宮位 の順に各層の冒頭の文を鑑定文として並べる（総論は詳細欄に任せる）
  for (const s of detail.stars) {
    const k = toZgStarKey(s.key) ?? toZgStarKey(s.label);
    if (!k) continue;
    const ly = gateZgLayers(getZgStarLayers({ star: k, branch: s.branch, mansion: s.mansion, palace: toZgPalace(P) }), displayCtxFor(detail, s, detail.branch)).layers;
    const nm = starName(s.label);
    const t = [
      ly.branch ? layerText(nm, `${s.branch}宮`, ly.branch.modern_japanese, 2) : "",
      ly.mansion ? layerText(nm, `${s.mansion}宿`, ly.mansion.modern_japanese, 2) : "",
      ly.palace ? layerText(nm, P, ly.palace.modern_japanese, 2) : "",
    ].join("");
    if (t) para(t, "starLayer");
  }
  // summary=false は「3. 宮主の状態」の別枠用（従来の文言のまま）
  const condText = (c: QzRecord, palaceLabel: string, summary = true) => {
    const cp = conditionalParts(c);
    const cc = c.conditions as Record<string, unknown>;
    const byPalace = !!(cc.palace_terms_raw || ((cc.palace_in as string[]) ?? []).length || ((cc.palace_not_in as string[]) ?? []).length);
    if (!summary) {
      return byPalace
        ? `この宮（${palaceLabel}）は資料の条件「${cp.cond}」に当たり、「${cp.result}」とされる`
        : `資料の条件「${cp.cond}」に該当し、「${cp.result}」とされる`;
    }
    return byPalace
      ? `この宮（${palaceLabel}）は「${cp.cond}」に当たり、${plain(cp.result)}`
      : `「${cp.cond}」に該当し、${plain(cp.result)}`;
  };
  const henyouItem = (name: string, star: string, meaningText: string | null | undefined, conds: QzRecord[], palaceLabel: string) => {
    let t = `${name}（${star}）：${meaningText ? shortMeaning(meaningText) : "意味の記載なし"}`;
    for (const c of conds) t += `　→ ${condText(c, palaceLabel)}`;
    return t;
  };
  const henyouLines = [
    ...detail.henyou.map((h) => henyouItem(h.name, h.starLabel, getHenyouMeaning(h.name)?.interpretation, matchConditionalRules("henyou", h.name, ctx), P)),
    ...detail.henyou2.map((h) => {
      const st = detail.stars.find((x) => x.key === h.starKey);
      const lk = lookupShensha(h.name, [h.origin]);
      const conds = matchConditionalRules("shensha", h.name, ctx, { motion: SEVEN_KEYS.includes(h.starKey) ? st?.motion : undefined, status: st?.status });
      const dctx = displayCtxFor(detail, st ?? null, detail.branch);
      const shown = lk.records.filter((r) => qzDisplayDecision(r.id, dctx).show);
      return henyouItem(h.name, h.starLabel, shown.map((r) => r.interpretation).filter(Boolean).join("／"), conds, P);
    }),
  ];
  list(`この宮（${P}・${detail.branch}）の変曜には次がある。`, henyouLines, "henyou");
  // 神殺：クリック中の宮そのものの神殺のみ（宮主の所在宮の神殺は使わない。宮別解釈は作らない）
  const shenshaDctx = displayCtxFor(detail, null, detail.branch);
  const shenshaLines = detail.shensha.map((s) => {
    const lk = lookupShensha(s.name, s.origins as ShenshaOrigin[]);
    // 条件付きの意味（例：太陽「男に吉」）は成立を確認できたものだけ
    const shown = lk.records.filter((r) => qzDisplayDecision(r.id, shenshaDctx).show);
    let m = shown.length
      ? shown.map((r) => (r.interpretation ? shortMeaning(r.interpretation) : "意味の記載なし")).join("／")
      : lk.records.length ? "成立条件を確認できないため意味は表示しない"
      : lk.candidates.length ? `系統未確定（候補：${lk.candidates.map((c) => c.interpretation ?? "記載なし").join("／")}）` : "意味の記載なし";
    for (const c of matchConditionalRules("shensha", s.name, ctx)) {
      const cp = conditionalParts(c);
      m += `　→ 「${cp.cond}」に当たり、${plain(cp.result)}`;
    }
    return `${s.name}：${m}`;
  });
  const shenshaRows: string[] = [];
  for (let k = 0; k < shenshaLines.length; k += 3) shenshaRows.push(shenshaLines.slice(k, k + 3).join("　／　"));
  list(`この宮（${P}・${detail.branch}）の神殺には次がある。`, shenshaRows, "shensha");

  // 7. 成立している具体的な条件ルール
  //    宮主に付く変曜は一覧にせず、資料の条件付きルールに該当したものだけを判断文として載せる
  const buildLordCondLines = (summary: boolean) => lordInThisPalace ? [] : [
    ...lordHenyou.flatMap((h) => matchConditionalRules("henyou", h.name, lordCtx).map((c) => `宮主${lordName}に付く${h.name}は、${condText(c, lordPalaceName, summary)}`)),
    ...lordHenyou2.flatMap((h) => matchConditionalRules("shensha", h.name, lordCtx, { motion: lb?.motion, status: lb?.status })
      .map((c) => `宮主${lordName}に付く${h.name}は、${condText(c, lordPalaceName, summary)}`)),
  ];
  const lordCondLines = buildLordCondLines(false);
  // 入宮星がある宮では、宮主由来のルール（専論十主・主星守宮歌・宮主の宮位ルール・宮主の変曜条件）は要約に出さない
  //（「3. 宮主の状態」の「宮主に関する資料ルールの該当」に別枠で表示）
  const judgmentTitle = hasStars ? "この宮に該当する判断" : "宮主・宮位に該当する判断";
  const judgmentLines = [
    ...(hasStars ? [] : [
      ...tenLords.flatMap((t) => t.ev.matched.map((m) => `専論十主（${t.rec.name}）：${m.reason}ことから、${plain(m.rule.source_fragment)}`)),
      ...guard.map((g) => `主星守宮歌：${g.matched}ことから、${plain(g.rule.source_fragment)}`),
      ...lordStarRules.map((m) => `${m.rec.name}：宮主${lordName}が${lb?.branch}宮にあり、${plain(m.rule.source_fragment)}${m.rule.source_fragment.includes(m.rule.result) ? "" : `（${m.rule.result}）`}`),
      ...buildLordCondLines(true),
    ]),
    ...starRuleMatches.map((m) => `${m.rec.name}：${starName(starLabelByKey.get(m.star) ?? m.star)}がこの宮にあり、${plain(m.rule.source_fragment)}${m.rule.source_fragment.includes(m.rule.result) ? "" : `（${m.rule.result}）`}`),
    ...m24.filter((m) => m.rule).map((m) => `二十四要法（${m.rec.name}）：${m.reason}。${plain(m.rule!.source_fragment)}`),
  ];
  list(judgmentTitle, judgmentLines, "judgments");

  const lordMatchedCount = tenLords.reduce((n, t) => n + t.ev.matched.length, 0) + guard.length + lordCondLines.length + lordStarRules.length;

  return {
    P, meaning, ctx, lord, lb, lordName, lordKey, lordPalaceName, lordInThisPalace, lordGated, lordLayers, lordStarRules,
    tenLords, tenLordPrinciples, guard, conj, roles, roleRule, starRuleMatches, m24, starLabelByKey, isMing, hasStars,
    summary, henyouLines, shenshaLines, judgmentTitle, judgmentLines, lordCondLines, lordMatchedCount,
  };
}
export type QzPalaceReading = ReturnType<typeof buildQzPalaceReading>;
