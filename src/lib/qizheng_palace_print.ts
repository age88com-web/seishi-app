// src/lib/qizheng_palace_print.ts
//
// 七政四餘の解釈印刷：1宮分の「印刷用鑑定データ」。
// 画面の宮詳細パネル（PalaceDetailPanel）の DOM は使わず、同じ組み立て結果（buildQzPalaceReading）と
// 同じ資料関数から、鑑定書の並び（基本情報表 → 鑑定要約 → 宮の解釈 → 星の解釈 → 変曜・神殺・補足）に整理する。
// 新しい文は作らない。画面で同じ資料が複数の欄に出ているものは、印刷では1か所にまとめる:
//   - 宮の基本意味 … 鑑定要約の要約文を外し「宮の解釈」の全文だけ
//   - 宮主の所在・状態 … 鑑定要約の文・宮主の状態欄を外し、基本情報表だけ
//   - 宮主星・入宮星の張果星宗の層 … 鑑定要約の冒頭抜粋を外し、各層の全文（宮の解釈・星の解釈）だけ
//   - 変曜・神殺 … 鑑定要約の一覧と変曜欄・神殺欄を、意味と成立した条件をまとめた1つの一覧に
//   - 資料ルールの該当 … 鑑定要約の「該当する判断」に1回だけ（宮主欄・その他の該当判断欄の同じ規則は外す）
//   - 盤全体の格局 … 各宮には出さない（印刷の先頭の格局欄に1回）
// 印刷物に要らない画面向けの注記（「該当データなし」「成立条件を確認できないため表示しない」の層・出典の系統名など）は出さない。

import { getZgStarLayers, toZgPalace, toZgStarKey, type ZgRecord } from "@/lib/zhangguo_interpretations";
import { getStarSupplements, rolesOfStar } from "@/lib/qizheng_interpretations";
import { qzDisplayDecision } from "@/lib/qizheng_display_conditions";
import {
  buildQzPalaceReading,
  displayCtxFor,
  firstSentence,
  gateZgLayers,
  MOTION_LABEL,
  starName,
  stateText,
} from "@/lib/qizheng_palace_reading";
import type { PalaceDetail, PalaceDetailStar } from "@/components/PalaceDetailPanel";

import { compactSections, type PalacePrintData, type PalacePrintSection, type PrintBlock } from "@/lib/print/palacePrint";

const lordWhere = (detail: PalaceDetail, b: PalaceDetailStar | null | undefined) =>
  b ? `${detail.palaceNameByBranch[b.branch] ?? ""}（${b.branch}）・${b.mansion}宿・${stateText(b) || "旺廟陥の該当なし"}` : "盤上に宮主星が見つからない";

export function buildQzPalacePrintData(detail: PalaceDetail): PalacePrintData {
  const r = buildQzPalaceReading(detail);
  const { P, lord, lb, lordName, lordInThisPalace, hasStars } = r;

  // ① 基本情報一覧表（存在しない項目は出さない）
  const table: [string, string][] = [
    ["宮名", `${P}${detail.isShenPalace ? "（身宮）" : ""}`],
    ["宮位置", detail.branch],
    ["在宮星", hasStars ? detail.stars.map((s) => starName(s.label)).join("・") : "なし（十一曜は入っていない）"],
  ];
  if (hasStars) table.push(["星の状態", detail.stars.map((s) => `${starName(s.label)}：${[`${s.mansion}宿`, stateText(s)].filter(Boolean).join("・")}`).join("　")]);
  if (lord) {
    table.push(["宮主", lordName]);
    table.push(["宮主の所在", lordInThisPalace ? `この宮（${lordWhere(detail, lb)}）` : lordWhere(detail, lb)]);
  }
  if (r.isMing || detail.isShenPalace) {
    for (const [k, l] of [["命主", detail.mingLord], ["身主", detail.shenLord]] as const) {
      if (l) table.push([k, `${starName(l.lordLabel)}　${lordWhere(detail, l.body)}`]);
    }
  }
  if (detail.henyou.length || detail.henyou2.length) {
    table.push(["変曜", [...detail.henyou.map((h) => `${h.name}（${h.starLabel}）`), ...detail.henyou2.map((h) => `${h.name}（${h.starLabel}）`)].join("・")]);
  }
  if (detail.shensha.length) table.push(["神殺", detail.shensha.map((s) => s.name).join("・")]);

  const sections: PalacePrintSection[] = [];

  // ② 鑑定要約（入宮星の有無の文と、この宮・宮主に該当する資料の判断。ほかの要約文は下の節の全文と重なるので出さない）
  const summaryBlocks: PrintBlock[] = [];
  const presence = r.summary.filter((b) => b.tag === "starsPresence" && b.kind === "p").map((b) => (b.kind === "p" ? b.text : ""));
  if (presence.length) summaryBlocks.push({ paragraphs: presence.map((text) => ({ text })) });
  if (r.judgmentLines.length) summaryBlocks.push({ heading: r.judgmentTitle, items: r.judgmentLines });
  if (summaryBlocks.length) sections.push({ title: "鑑定要約", blocks: summaryBlocks });

  // ③ 宮の解釈
  const palaceBlocks: PrintBlock[] = [];
  if (r.meaning?.interpretation) palaceBlocks.push({ heading: "宮の基本意味", paragraphs: [{ text: r.meaning.interpretation }] });
  // 入宮星がある宮：宮主に関する資料ルール（入宮星のない宮では鑑定要約の「該当する判断」に同じ規則が入っている）
  if (hasStars && r.lordMatchedCount > 0) {
    palaceBlocks.push({
      heading: "宮主に関する資料ルール",
      items: [
        ...r.tenLords.flatMap((t) => t.ev.matched.map((m) => `専論十主（${t.rec.name}）：${m.rule.source_fragment}［一致：${m.reason}］`)),
        ...r.guard.map((g) => `主星守宮歌：${g.rule.source_fragment}［一致：${g.matched}］`),
        ...r.lordCondLines,
        ...r.lordStarRules.map((m) => `${m.rec.name}：${m.rule.source_fragment}［一致：${lordName}が${lb?.branch}宮］`),
      ],
    });
  }
  // 入宮星のない宮：宮主星の象意（張果星宗の層）と専論十主の一般原則
  if (!hasStars && r.lordLayers && lb) {
    const ly = r.lordLayers;
    const paras = ([
      ["総論", ly.general],
      [`十二支宮（${lb.branch}）`, ly.branch],
      [`躔宿（${lb.mansion || "—"}）`, ly.mansion],
      [`照宮（${toZgPalace(r.lordPalaceName) ?? r.lordPalaceName}）`, ly.palace],
    ] as [string, ZgRecord | null][]).filter(([, rec]) => rec).map(([label, rec]) => ({ label, text: rec!.modern_japanese }));
    if (paras.length) palaceBlocks.push({ heading: `宮主星（${lordName}）の象意`, sub: "張果星宗（所在の十二支・宿・宮で参照）", paragraphs: paras });
  }
  if (!hasStars && r.tenLordPrinciples.length) {
    palaceBlocks.push({
      heading: "専論十主の一般原則",
      items: r.tenLordPrinciples.flatMap((t) => t.ev.principles.map((p) => `${t.rec.name}：${p.source_fragment}`)),
    });
  }
  if (palaceBlocks.length) sections.push({ title: "宮の解釈", blocks: palaceBlocks });

  // ④ 星の解釈（入宮星ごと。画面の「星の象意」と同じ層・補助資料。表示条件も同じ）＋同宮の象意
  const starBlocks: PrintBlock[] = [];
  const zgPalace = toZgPalace(P);
  for (const s of detail.stars) {
    const key = toZgStarKey(s.key) ?? toZgStarKey(s.label);
    const dctx = displayCtxFor(detail, s, detail.branch);
    const raw = key ? getZgStarLayers({ star: key, branch: s.branch, mansion: s.mansion, palace: zgPalace }) : null;
    const ly = raw ? gateZgLayers(raw, dctx).layers : null;
    const paras = ly
      ? ([
          ["星の総論", ly.general],
          [`${s.branch}宮にある場合`, ly.branch],
          [`${s.mansion}宿にある場合`, ly.mansion],
          [`${P}にある場合`, ly.palace],
        ] as [string, ZgRecord | null][]).filter(([, rec]) => rec).map(([label, rec]) => ({ label, text: rec!.modern_japanese }))
      : [];
    const supplements = key
      ? getStarSupplements({ star: key, branch: detail.branch, mansion: s.mansion, chartPalaceName: P })
          .filter((x) => qzDisplayDecision(x.rec.id, dctx).show)
          .filter((x) => x.rec.interpretation)
          .map((x) => ({ label: `補助資料・${x.label}`, text: x.rec.interpretation! }))
      : [];
    if (paras.length || supplements.length) {
      starBlocks.push({
        heading: starName(s.label),
        sub: [raw?.general?.classical_name !== starName(s.label) ? raw?.general?.classical_name : "", s.mansion ? `${s.mansion}宿` : "", MOTION_LABEL[s.motion] ?? ""].filter(Boolean).join("　"),
        paragraphs: [...paras, ...supplements],
      });
    }
  }
  if (r.conj.length) {
    starBlocks.push({
      heading: "同宮の象意",
      items: r.conj.filter((c) => c.interpretation).map((c) => `${(c.members ?? []).map((k) => r.starLabelByKey.get(k) ?? k).join("＋")}：${c.interpretation}`),
    });
  }
  if (starBlocks.length) sections.push({ title: "星の解釈", blocks: starBlocks });

  // ⑤ 変曜・神殺・補足（意味と、この宮で成立した条件を1つの一覧に）
  const extraBlocks: PrintBlock[] = [];
  if (r.henyouLines.length) extraBlocks.push({ heading: "変曜", items: r.henyouLines });
  if (r.shenshaLines.length) extraBlocks.push({ heading: "神殺", items: r.shenshaLines });
  if (r.roles?.roles) {
    const rows: [string, string][] = [["当宮の主星・喜忌（資料の表）", Object.entries(r.roles.roles).map(([k, v]) => `${k} ${v.raw}`).join("　")]];
    if (hasStars) {
      rows.push(["入宮星の役割", detail.stars.map((s) => {
        const ro = rolesOfStar(r.roles!, toZgStarKey(s.key) ?? s.key);
        return `${s.label}＝${ro.length ? ro.join("・") : "表に該当なし"}`;
      }).join("　")]);
    }
    extraBlocks.push({ heading: "主星・喜忌", rows, paragraphs: r.roleRule?.interpretation ? [{ text: r.roleRule.interpretation }] : undefined });
  }
  // 二十四要法のうち、条件文のないもの（条件文のあるものは鑑定要約の「該当する判断」に入っている）
  const m24NoRule = r.m24.filter((m) => !m.rule).map((m) => `${m.rec.name}（${m.reason}）：${firstSentence((m.rec.interpretation ?? "").split("\n").slice(1).join("").trim())}`);
  if (m24NoRule.length) extraBlocks.push({ heading: "二十四要法", items: m24NoRule });
  if (extraBlocks.length) sections.push({ title: "変曜・神殺・補足", blocks: extraBlocks });

  return { palaceName: P, titleSub: detail.branch, isShenPalace: detail.isShenPalace, summaryTable: table, sections: compactSections(sections) };
}
