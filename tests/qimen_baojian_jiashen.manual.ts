// tests/qimen_baojian_jiashen.manual.ts
//
// 奇門遁甲 Phase 5C『御定奇門寶鑑』影印本照合と、青龍返首・飛鳥跌穴の甲申旬の例外（src/lib/qimenClassics）の確認。
//   ・影印本の読み（節・段）が翻字ファイル（docs/source/baojian/…影印本翻字.md）と一致する。
//   ・電子テキストの原文は上書きしていない（Phase 5B の取得テキストと一致したまま）。異同の両側の文字列が実在する。
//   ・例外規則の根拠の句が影印本の読みにあり、成立判定には接続していない（autoJudgement.enabled は false）。
//   ・『奇門法竅』の見解は別資料として保持し、取得テキストと一致する。『寶鑑』の規則・例外に混ぜていない。
//   ・1080局: 青龍返首120宮・飛鳥跌穴130宮、甲申旬はそれぞれ20宮で、天盤庚×地盤丙／天盤丙×地盤庚、
//     太白入熒／熒入太白と全宮で同宮。歌訣注の例（陽遁三局丁卯時・陽遁一局丙寅時）を再現する。
//   ・格局判定（src/lib/qimen）から qimenClassics を参照していない。
// 実行: npx tsx tests/qimen_baojian_jiashen.manual.ts

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  BAOJIAN_EXCEPTIONS,
  BAOJIAN_PASSAGES,
  BAOJIAN_RULES,
  BAOJIAN_SECTIONS,
  FAQIAO_VIEWS,
  lookupClassicExceptionsByAppKaku,
  lookupClassicPassage,
  lookupClassicRulesByAppKaku,
  lookupOtherSourceViewsByException,
} from "@/lib/qimenClassics";
import { JIKAKU_NAMES, KYOKAKU_NAMES } from "@/lib/qimenSearch/formats";
import { resolveDiPan } from "../src/lib/qimen/dipan";
import { resolveXunShou } from "../src/lib/qimen/xunshou";
import { resolveTianPan } from "../src/lib/qimen/tianpan";
import { resolveJiuXing } from "../src/lib/qimen/jiuxing";
import { resolveCenterLodging, lodgedStemsAt, resolveQinCompanion, qinCompanionAt } from "../src/lib/qimen/stemAccess";
import { resolveKyokaku } from "../src/lib/qimen/kyokaku";
import { resolveJikaku } from "../src/lib/qimen/jikaku";
import type { PalaceSummary } from "../src/lib/qimen";
import type { Stem, Branch } from "../src/lib/eto";

let checks = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (!ok) failures.push(`${label} ${detail}`);
}

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const facsimileDoc = read("docs/source/baojian/御定奇門寶鑑_故宮珍本叢刊431_影印本翻字.md").replace(/〔※〕/g, "");
const wikisource = read("docs/source/baojian/奇門寶鑑御定_巻一_格局3節_wikisource.md");
const wikiB = wikisource.slice(wikisource.indexOf("## B."), wikisource.indexOf("## 参考"));
const wikiRef = wikisource.slice(wikisource.indexOf("## 参考"));
const faqiaoDoc = read("docs/source/faqiao/奇門法竅_卷二_37-38_ichingtrilogy.md");
const appKaku = new Set([...JIKAKU_NAMES, ...KYOKAKU_NAMES]);
/** 異同表の注記（〔…〕）と「（全文）」を除いた影印本の文字列 */
const bare = (s: string) => s.replace(/〔[^〕]*〕/g, "");

// 1) 節（Phase 5B）の影印本照合
check("3節すべてに影印本照合", BAOJIAN_SECTIONS.every((s) => s.facsimile !== undefined));
for (const s of BAOJIAN_SECTIONS) {
  const f = s.facsimile!;
  check(`${s.title} 電子テキストの原文は変えていない`, s.originalTraditional.every((p) => wikiB.includes(p)));
  check(`${s.title} 影印本の出典`, s.sources.some((x) => x.label.includes("故宮珍本叢刊")) && f.ref.file === "GGZBCK431_御定奇門寶鑒.pdf" && f.ref.leaf.includes("推定"));
  for (const p of f.text) check(`${s.title} 影印本の読みが翻字ファイルと一致`, facsimileDoc.includes(p), p.slice(0, 20));
  const electronic = s.originalTraditional.join("");
  const fac = f.text.join("");
  for (const c of f.collation) {
    if (c.electronic !== null) check(`${s.title} 異同（電子側）が原文にある`, electronic.includes(c.electronic), c.electronic);
    if (c.facsimile !== "（全文）") check(`${s.title} 異同（影印側）が読みにある`, fac.includes(bare(c.facsimile).replace(/。$/, "")), c.facsimile);
  }
}
const xingPo = BAOJIAN_SECTIONS.find((s) => s.id === "baojian-1-gengbing-xing-po")!;
check("同刑異破 脱文を記録", xingPo.facsimile!.collation.some((c) => c.kind === "電子テキストの脱文" && c.facsimile.includes("丙所加者寅。寅與午三合。")));
check("同刑異破 電子テキストに脱文の句が無い", !xingPo.originalTraditional.join("").includes("丙所加者寅"));
check("同刑異破 陰干は影印本で確定", xingPo.facsimile!.collation.some((c) => c.electronic === "陰乾以前四支為破" && c.kind === "電子テキストの誤り"));
check("同刑異破 丙加巳は未解消", xingPo.facsimile!.collation.some((c) => c.electronic === "丙加巳為第四干" && c.kind === "字形判別不能（未解消）"));
const bogeCol = BAOJIAN_SECTIONS.find((s) => s.id === "baojian-1-bogefeifu")!.facsimile!.collation;
check("勃格飛伏 庚・反首は影印本も同じ", ["干者；庚為歲月日時干也", "是以反首跌穴"].every((e) => bogeCol.some((c) => c.electronic === e && c.kind === "同じ（疑義は未解消）")));

// 2) 段（凡例・釋直符直使・歌訣注）
check("段4件", BAOJIAN_PASSAGES.length === 4 && new Set(BAOJIAN_PASSAGES.map((p) => p.id)).size === 4);
for (const p of BAOJIAN_PASSAGES) {
  for (const t of p.facsimile.text) check(`${p.title} 影印本の読みが翻字ファイルと一致`, facsimileDoc.includes(t), t.slice(0, 20));
  check(`${p.title} 訳の段落数`, p.translationJa.length === p.facsimile.text.length);
  if (p.electronicTraditional !== null) {
    check(`${p.title} 電子テキストの段落数`, p.electronicTraditional.length === p.facsimile.text.length);
    for (const e of p.electronicTraditional) check(`${p.title} 電子テキストが取得テキストにある`, wikiRef.includes(e), e.slice(0, 20));
  }
  const electronic = (p.electronicTraditional ?? []).join("");
  const fac = p.facsimile.text.join("");
  for (const c of p.facsimile.collation) {
    if (c.electronic !== null) check(`${p.title} 異同（電子側）`, electronic.includes(c.electronic), c.electronic);
    if (c.facsimile !== "（全文）") check(`${p.title} 異同（影印側）`, fac.includes(bare(c.facsimile).replace(/。$/, "")), c.facsimile);
  }
}
const fanli = lookupClassicPassage("baojian-1-fanli-geju")!;
check("凡例の所在", fanli.facsimile.ref.pdfPage === "4" && fanli.facsimile.text[0].includes("如逢庚為直符。則為格勃勃格。又不可用。"));
const gejue = lookupClassicPassage("baojian-1-gejue-bobing-gengge")!;
check("歌訣注の所在", gejue.facsimile.ref.pdfPage === "27" && gejue.facsimile.text[1].includes("但甲申直符帶庚。加十干時。俱不吉。"));

// 3) 甲申旬の例外
check("例外1件", BAOJIAN_EXCEPTIONS.length === 1);
const passageText = (id: string) =>
  (BAOJIAN_PASSAGES.find((p) => p.id === id)?.facsimile.text ?? BAOJIAN_SECTIONS.find((s) => s.id === id)?.facsimile?.text ?? []).join("");
for (const ex of BAOJIAN_EXCEPTIONS) {
  check(`${ex.id} 成立判定に接続しない`, ex.autoJudgement.enabled === false && ex.autoJudgement.reason.length > 0);
  check(`${ex.id} 効果の句`, passageText("baojian-1-fanli-geju").includes(ex.effect.original));
  check(`${ex.id} 使用上の禁忌として記録`, ex.effect.kind.startsWith("使用上の禁忌"));
  for (const c of ex.conditions) {
    check(`${ex.id} 条件に根拠`, c.evidence.length > 0, c.item);
    for (const e of c.evidence) check(`${ex.id} 根拠の句が影印本にある`, passageText(e.passageId).includes(e.phrase), e.phrase);
  }
  check(`${ex.id} 未確定の条件を残す`, ex.conditions.filter((c) => c.status === "未確定").length >= 3);
  for (const c of ex.cautions) for (const part of c.original.split("……")) check(`${ex.id} 注意の句`, passageText(c.passageId).includes(part), part);
  for (const a of ex.appRelations) check(`${ex.id} 現行格局 ${a.target} が存在`, appKaku.has(a.target));
}
check("青龍返首 → 例外", lookupClassicExceptionsByAppKaku("青龍返首").length === 1 && lookupClassicExceptionsByAppKaku("飛鳥跌穴").length === 1);
check("Phase 5B の規則は名称で結び付けないまま", lookupClassicRulesByAppKaku("青龍返首").length === 0 && BAOJIAN_RULES.length === 16);

// 4) 『奇門法竅』
check("法竅2節", FAQIAO_VIEWS.length === 2 && FAQIAO_VIEWS.every((v) => v.work === "奇門法竅"));
for (const v of FAQIAO_VIEWS) {
  for (const o of v.original) check(`${v.location} 原文が取得テキストと一致`, faqiaoDoc.includes(o), o.slice(0, 20));
  check(`${v.location} 訳の段落数`, v.translationJa.length === v.original.length);
  for (const w of v.views) for (const part of w.original.split("……")) check(`${v.location} 見解の句`, v.original.join("").includes(part), part);
  for (const id of v.relatedExceptionIds) check(`${v.location} 例外IDが存在`, BAOJIAN_EXCEPTIONS.some((e) => e.id === id));
}
check("法竅は寶鑑の規則・例外に混ぜない", ![...BAOJIAN_RULES, ...BAOJIAN_EXCEPTIONS].some((r) => r.id.startsWith("faqiao")) && !BAOJIAN_PASSAGES.some((p) => p.id.startsWith("faqiao")));
check("例外 → 法竅", lookupOtherSourceViewsByException("baojian-exception-longniao-geng-zhifu").length === 2);
check("法竅の甲申旬の見解", FAQIAO_VIEWS[0].original[1].includes("誰云甲申旬之龍鳥吉格不堪取用乎"));

// 5) 1080局の集計（判定は変更しない。現状の成立宮を固定する）
interface Chart { no: number; title: string; dun: "陽遁" | "陰遁"; ju: number; hourStem: string; hourBranch: string; zhishiPalace: number; bamen: Record<string, string>; bashen: Record<string, string> }
const charts = (JSON.parse(read("tests/fixtures/qimen1080.json")) as { charts: Chart[] }).charts;
const tally = { 青龍返首: { all: 0, jiashen: 0, pair: 0, over: 0 }, 飛鳥跌穴: { all: 0, jiashen: 0, pair: 0, over: 0 } };
const examples: string[] = [];
for (const c of charts) {
  const diPan = resolveDiPan({ dun: c.dun, ju: c.ju });
  const xs = resolveXunShou({ hourStem: c.hourStem as Stem, hourBranch: c.hourBranch as Branch });
  const liuyi = xs.liuyi as (typeof diPan)[number];
  const tianPan = resolveTianPan({ diPan, hourStem: c.hourStem as Stem, liuyi });
  const jiuXing = resolveJiuXing({ diPan, liuyi, hourStem: c.hourStem as Stem });
  const lod = resolveCenterLodging({ diPan });
  const qin = resolveQinCompanion({ diPan, jiuXing });
  const palaces: Record<number, PalaceSummary> = {};
  for (let p = 1; p <= 9; p += 1) {
    palaces[p] = { diPanStem: diPan[p], tianPanStem: tianPan[p], jiuXing: jiuXing.jiuXing[p], baMen: c.bamen[String(p)] ? [c.bamen[String(p)]] : [], baShen: c.bashen[String(p)] ? [c.bashen[String(p)]] : [], ...lodgedStemsAt(lod, p), ...qinCompanionAt(qin, p) } as PalaceSummary;
  }
  const hz = c.hourStem + c.hourBranch;
  const jk = resolveJikaku({ palaces, liuyi, zhishiPalace: c.zhishiPalace, xunShou: xs.xunShou, hourGanzhi: hz });
  const ky = resolveKyokaku({ palaces, dun: c.dun, yearStem: "", monthStem: "", dayStem: "", hourStem: c.hourStem, hourGanzhi: hz, zhifuPalace: jiuXing.zhifu.palace, xunShou: xs.xunShou, liuyi });
  const stemsOf = (p: number, side: "tian" | "di") => {
    const s = palaces[p];
    const lodged = side === "tian" ? s.qinCompanion : s.diPanLodged;
    return [side === "tian" ? s.tianPanStem : s.diPanStem, ...(lodged ? [lodged.stem] : [])];
  };
  for (const [name, up, down, overName] of [["青龍返首", "庚", "丙", "太白入熒"], ["飛鳥跌穴", "丙", "庚", "熒入太白"]] as const) {
    for (const p of jk.matches.find((m) => m.name === name)?.palaces ?? []) {
      tally[name].all += 1;
      if (xs.xunShou !== "甲申") continue;
      tally[name].jiashen += 1;
      if (stemsOf(p, "tian").includes(up) && stemsOf(p, "di").includes(down)) tally[name].pair += 1;
      if (ky.matches.find((m) => m.name === overName)?.palaces.includes(p)) tally[name].over += 1;
    }
  }
  if (c.title === "陽遁三局甲己日丁卯時" && jk.matches.find((m) => m.name === "飛鳥跌穴")?.palaces.includes(3)) examples.push("鳥跌穴");
  if (c.title === "陽遁一局甲己日丙寅時" && jk.matches.find((m) => m.name === "青龍返首")?.palaces.includes(8)) examples.push("龍返首");
}
check("青龍返首 120宮・甲申20", tally.青龍返首.all === 120 && tally.青龍返首.jiashen === 20, JSON.stringify(tally.青龍返首));
// 天盤丙は天禽帯同干（格局判定専用・2026-10-30 監修者決定）も含む。
check("飛鳥跌穴 130宮・甲申20", tally.飛鳥跌穴.all === 130 && tally.飛鳥跌穴.jiashen === 20, JSON.stringify(tally.飛鳥跌穴));
check("甲申旬の青龍返首は天盤庚×地盤丙・太白入熒と同宮", tally.青龍返首.pair === 20 && tally.青龍返首.over === 20);
check("甲申旬の飛鳥跌穴は天盤丙×地盤庚・熒入太白と同宮", tally.飛鳥跌穴.pair === 20 && tally.飛鳥跌穴.over === 20);
check("歌訣注の2例を再現（陽三丁卯 震三宮・陽一丙寅 艮八宮）", examples.includes("鳥跌穴") && examples.includes("龍返首"), examples.join());

// 6) 格局判定から参照していない
const qimenDir = join(ROOT, "src/lib/qimen");
check("格局判定から参照していない", readdirSync(qimenDir).filter((f) => f.endsWith(".ts")).every((f) => !readFileSync(join(qimenDir, f), "utf8").includes("qimenClassics")));

if (failures.length > 0) {
  console.error(failures.slice(0, 30).join("\n"));
  console.error(`FAIL ${failures.length} / ${checks}`);
  process.exit(1);
}
console.log(`${checks} checks PASS 段=${BAOJIAN_PASSAGES.length} 例外=${BAOJIAN_EXCEPTIONS.length} 法竅=${FAQIAO_VIEWS.length} 青龍返首=${tally.青龍返首.all}(甲申${tally.青龍返首.jiashen}) 飛鳥跌穴=${tally.飛鳥跌穴.all}(甲申${tally.飛鳥跌穴.jiashen})`);
