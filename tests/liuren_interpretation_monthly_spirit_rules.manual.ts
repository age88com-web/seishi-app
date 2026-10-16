// tests/liuren_interpretation_monthly_spirit_rules.manual.ts
//
// 六壬神課 Phase 5L（月建の神煞を使う DOMAIN 規則）のテスト。
// 実行: npx tsx tests/liuren_interpretation_monthly_spirit_rules.manual.ts
//
//   1. 行人の二馬: 驛馬（日支基準）と天馬（月建基準）を別々に見て detected・evidence を分ける。驛馬だけの盤の読みは従来どおり成立し、
//      天馬は月支がなければ見ない。空は旬空だけ（坐空では成立しない）。出行の「馬」は驛馬だけのまま
//   2. 家宅・疾病・求財・妊娠の新しい規則（最終監査で保留にした疾病の生龍・妊娠の月厭煞は出さない）が、原文の条件（神煞＋天将・位置・胎神・年命など）と720課×十二月で完全に一致して成立し、
//      神煞があるだけでは成立しない
//   3. 妊娠: 胎財生気・胎財死気の日と月が『大全』の一覧と一致、戊己日は出さない、二血法の空亡・坐空の例外
//   4. 古典の例: 『指南』孕産章 占験三（独立した検証）・占験五（不一致の記録）、『大全』の例（規則の出典で独立した検証ではない）
//   5. 要約に神煞の段（象意・助ける条件・妨げる条件・相反・判断できない事項）を加え、月支がなければ判断しないと書く。同じ入力で同じ結果

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { STEM_ELEMENT } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { yimaOf } from "../src/lib/liuren/interpretation/markers";
import { monthlySpiritsOf } from "../src/lib/liuren/interpretation/monthlySpirits";
import { natalYearStateOf } from "../src/lib/liuren/interpretation/natalYear";
import { growthStageOf } from "../src/lib/liuren/interpretation/states";
import { relationBetween } from "../src/lib/liuren/interpretation/relations";
import { evaluateTravelerDomain } from "../src/lib/liuren/interpretation/travelerDomain";
import { evaluateTravelDomain } from "../src/lib/liuren/interpretation/travelDomain";
import { evaluateHouseDomain } from "../src/lib/liuren/interpretation/houseDomain";
import { evaluateIllnessDomain } from "../src/lib/liuren/interpretation/illnessDomain";
import { evaluateWealthDomain } from "../src/lib/liuren/interpretation/wealthDomain";
import { evaluatePregnancyDomain } from "../src/lib/liuren/interpretation/pregnancyDomain";
import type { DomainResult } from "../src/lib/liuren/interpretation/domainResult";
import type { InterpretationContext } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const factsOf = (day: string, jiang: Branch, shi: Branch = "子") =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
type F = ReturnType<typeof factsOf>;
const reading = (r: DomainResult, key: string) => r.readings.find((x) => x.key === key) ?? null;
const monthOf = (n: number): Branch => BRANCHES[(n + 1) % 12] as Branch;
const overcomes = (a: Branch | Stem, b: Branch | Stem) => relationBetween(a, b).relations.includes("overcomes");
const riding = (f: F, g: string) => (BRANCHES as readonly Branch[]).find((b) => f.generals.generalOn[b] === g)!;
const TAI: Record<string, Branch | null> = { 木: "酉", 火: "子", 金: "卯", 水: "午", 土: null };

// 盤×月の走査（60日×12月将×12月支。占時は子）
type Board = { day: string; f: F; mb: Branch };
const BOARDS: Board[] = [];
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
  const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`, f = factsOf(day, BRANCHES[o] as Branch);
  for (const mb of BRANCHES) BOARDS.push({ day, f, mb: mb as Branch });
}

// ---- 1. 行人の二馬 ----
{
  const trav = (f: F, mb: Branch | null) => evaluateTravelerDomain(f, { domain: "traveler", subtype: "return", goal: "return" } as InterpretationContext, mb);
  let ok = true, onlyTianMa = 0, onlyYima = 0, bothSeen = 0, noMonthOk = true, seatedOnly = 0, seatedOk = true, evidenceOk = true, suffixGone = true;
  for (const { f, mb } of BOARDS) {
    const r = trav(f, mb), s = monthlySpiritsOf(f, mb)!.tianMa, y = yimaOf(f.basic.dayBranch);
    const yUp = (n: 1 | 3) => f.lessons[n - 1].upper === y;
    const tUp = (n: 1 | 3) => s.lessons.some((l) => l.index === n);
    const yT = f.transmissions!.some((t) => t.branch === y), tT = (s.transmissions ?? []).length > 0;
    const expect = {
      yimaInTransit: [yT || yUp(1), tT || tUp(1)],
      yimaAtSite: [yUp(3), tUp(3)],
      tigerOnYima: [f.generals.generalOn[y] === "白虎", s.general === "白虎"],
      yimaVoid: [f.xun.voidBranches.includes(y), s.isVoid],
    } as const;
    for (const [key, [ey, et]] of Object.entries(expect)) {
      const x = reading(r, key);
      if (!!x !== (ey || et)) ok = false;
      if (x) {
        if (x.detected.includes("驛馬") !== ey || x.detected.includes("天馬") !== et) ok = false;
        if (x.evidence.some((e) => e.fact === "yima") !== ey || x.evidence.some((e) => e.fact === "monthlySpirit.tianMa") !== et) evidenceOk = false;
        if (x.detected.includes("未対応")) suffixGone = false;
        if (!ey && et) onlyTianMa += 1;
        if (ey && !et) onlyYima += 1;
        if (ey && et) bothSeen += 1;
      }
    }
    if (!s.isVoid && f.xun.voidBranches.includes(s.earthUnder) && !f.xun.voidBranches.includes(y)) { seatedOnly += 1; if (reading(r, "yimaVoid")) seatedOk = false; }
  }
  check("二馬の4規則（途中・臨支・虎乗・空）が、驛馬・天馬それぞれの条件と720課×十二月で完全に一致", ok);
  check("当たった馬を detected・evidence に分けて書く（驛馬＝yima、天馬＝monthlySpirit.tianMa）", evidenceOk);
  check("天馬だけ・驛馬だけ・両方で成立する盤がそれぞれある（二馬の部分実装からの移行）", onlyTianMa > 0 && onlyYima > 0 && bothSeen > 0, `${onlyTianMa}/${onlyYima}/${bothSeen}`);
  check("detected から「（天馬は未対応）」が消えている", suffixGone);
  check("天馬が坐空（地盤が旬空）なだけでは「二馬が空」にしない（旬空だけ）", seatedOnly > 0 && seatedOk);
  for (let i = 0; i < 60 && noMonthOk; i++) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, "卯"), r = trav(f, null);
    if (r.readings.some((x) => x.detected.includes("天馬")) || !r.missing.some((m) => m.key === "tianMa") || !r.summary.includes("月支がないので、月建の神煞を使う読みは判断しない")) noMonthOk = false;
  }
  check("月支がなければ天馬を見ず、不足と要約に書く（二馬は驛馬だけ）", noMonthOk);
  const f = factsOf("甲子", "卯");
  check("郇注「凡驛馬在傳」は驛馬だけの句として引用を残す（天馬の detected は『入式』の「二馬」によると書く）",
    BOARDS.some(({ f: g, mb }) => reading(trav(g, mb), "yimaInTransit")?.detected.includes("天馬") && reading(trav(g, mb), "yimaInTransit")!.detected.includes("『入式』の「二馬」による")) && !!f);
  let travelOk = true;
  for (const { f: g, mb } of BOARDS.filter((_, k) => k % 7 === 0)) {
    const r = evaluateTravelDomain(g, { domain: "travel", subtype: "departure", goal: "move" } as InterpretationContext, mb);
    if (r.readings.some((x) => x.detected.includes("天馬"))) travelOk = false;
  }
  check("出行の「馬」の規則は驛馬だけのまま（天馬を加えない）", travelOk);
}

// ---- 2. 家宅・疾病・求財 ----
{
  let houseOk = true, illHeld = true, ghostOk = true, wealthOk = true, siteNoTaichang = 0, dragonNotFixed = 0, leaveNeutral = true;
  for (const { f, mb } of BOARDS) {
    const s = monthlySpiritsOf(f, mb)!;
    const h = evaluateHouseDomain(f, { domain: "house", subtype: "residence" } as InterpretationContext, mb);
    if (!!reading(h, "dragonOnShengQi") !== (s.shengQi.general === "青龍")) houseOk = false;
    const site = f.lessons[2].upper;
    const tc = site === s.siQi.branch && s.siQi.general === "太常";
    if (!!reading(h, "taichangSiQiOnSite") !== tc) houseOk = false;
    if (site === s.siQi.branch && s.siQi.general !== "太常") siteNoTaichang += 1;
    if (s.shengQi.general === "青龍" && s.shengQi.lessons.length === 0 && (s.shengQi.transmissions ?? []).length === 0) dragonNotFixed += 1;
    if (s.shengQi.general === "青龍") {
      const leave = evaluateHouseDomain(f, { domain: "house", subtype: "residence", goal: "release" } as InterpretationContext, mb);
      if (reading(leave, "dragonOnShengQi")?.direction !== "neutral") leaveNeutral = false;
    }
    const il = evaluateIllnessDomain(f, { domain: "illness" } as InterpretationContext, mb);
    if (reading(il, "dragonOnShengQi")) illHeld = false;
    const up = f.lessons[0].upper;
    const gt = up === s.shengQi.branch && overcomes(up, f.basic.dayStem) && growthStageOf(STEM_ELEMENT[f.basic.dayStem], up) === "墓";
    if (!!reading(il, "ghostTombOnStemShengQi") !== gt) ghostOk = false;
    if (gt && (!"壬癸".includes(f.basic.dayStem) || up !== "辰" || mb !== "午")) ghostOk = false;
    const w = evaluateWealthDomain(f, { domain: "wealth", subtype: "trading" } as InterpretationContext, mb);
    const ws = evaluateWealthDomain(f, { domain: "wealth", subtype: "seekingWealth" } as InterpretationContext, mb);
    if (!!reading(w, "dragonOnShengQi") !== (s.shengQi.general === "青龍") || reading(ws, "dragonOnShengQi")) wealthOk = false;
  }
  check("家宅: 青龍が生気に乗る（位置を問わない）・宅上が死気で太常が乗る、の条件と完全に一致", houseOk);
  check("家宅: 宅上が死気でも太常が乗らなければ成立しない（神煞の存在だけで成立しない）", siteNoTaichang > 0);
  check("家宅: 青龍が生気に乗るのが課伝の外の盤もある（原文が位置を指定しないので位置を条件にしない）", dragonNotFixed > 0);
  check("家宅: 家を離れたい問いでは青龍・生気の読みは向きを決めない", leaveNeutral);
  check("疾病: 『指南』「沉疴之際看生龍」は沈痾という条件を区別できないので出さず、要約の判断できない事項に書く（最終監査で保留）",
    illHeld && evaluateIllnessDomain(factsOf("甲子", "卯"), { domain: "illness" } as InterpretationContext, "寅").summary.includes("沉疴之際看生龍"));
  check("疾病: 鬼墓が日に臨んで生気は、壬癸日の干上 辰（官鬼・墓）で午月（生気 辰）だけ成立", ghostOk && BOARDS.some(({ f, mb }) => reading(evaluateIllnessDomain(f, { domain: "illness" } as InterpretationContext, mb), "ghostTombOnStemShengQi")));
  check("求財: 青龍が生気に乗る（『指南』買賣章）は売買だけで読み、求財では出さない", wealthOk);
}

// ---- 3. 妊娠・出産 ----
{
  const preg = (f: F, sub: "conception" | "maintain" | "delivery", mb: Branch | null, natal?: [Stem, Branch]) =>
    evaluatePregnancyDomain(f, { domain: sub === "delivery" ? "childbirth" : "pregnancy", subtype: sub,
      ...(natal ? { persons: [{ id: "A" }, { id: "M", natalYear: natalYearStateOf(natal[0], natal[1]) }], subjectPersonId: "A", pregnantPersonId: "M" } : {}) } as InterpretationContext, mb);
  const caiDays = new Set<string>(), siDays = new Set<string>();
  let caiOk = true, siOk = true, worryOk = true, yyHeld = true, bloodOk = true, earthOk = true, bloodVoid = 0, bloodSeatedVoid = 0;
  for (const { day, f, mb } of BOARDS) {
    const s = monthlySpiritsOf(f, mb)!, tai = TAI[STEM_ELEMENT[f.basic.dayStem]];
    const c = preg(f, "conception", mb), m = preg(f, "maintain", mb);
    const natal: [Stem, Branch] = [STEMS[(STEMS.indexOf(day[0] as Stem) + BRANCHES.indexOf(mb)) % 10] as Stem, f.plate.earthUnder[s.yueYan.branch]];
    // 生年干支は六十干支になるよう干を合わせる（支は月厭の地盤＝当たる側の盤も作る）
    const natalFixed: [Stem, Branch] = [STEMS.find((x, k) => (k - BRANCHES.indexOf(natal[1])) % 2 === 0)! as Stem, natal[1]];
    const d = preg(f, "delivery", mb, natalFixed), dNo = preg(f, "delivery", mb);
    const cai = !!tai && s.shengQi.branch === tai && overcomes(f.basic.dayStem, tai);
    if (!!reading(c, "taiCaiShengQi") !== cai) caiOk = false;
    if (cai) caiDays.add(`${f.basic.dayStem}${mb}`);
    const si = !!tai && s.siQi.branch === tai;
    if (!!reading(m, "taiSiQi") !== si) siOk = false;
    if (si) siDays.add(`${f.basic.dayStem}${mb}`);
    const q = riding(f, "天后");
    if (!!reading(d, "motherWorryTianhou") !== (q === s.siQi.branch && ["辰", "戌", "丑", "未"].includes(q))) worryOk = false;
    // 月厭煞は当事者の本命が月厭の地盤に当たる盤でも出さない（最終監査で保留）
    if (d.readings.some((x) => x.key.startsWith("yueYan")) || dNo.readings.some((x) => x.key.startsWith("yueYan"))) yyHeld = false;
    const yang = tai ? (BRANCHES as readonly Branch[]).find((b) => growthStageOf(STEM_ELEMENT[f.basic.dayStem], b) === "養")! : null;
    const blood = !!tai && s.xueZhi.branch === s.xueJi.branch && (s.xueZhi.branch === tai || (s.xueZhi.branch === yang && overcomes(yang!, tai)));
    const bm = reading(m, "twoBloodMaintain"), bd = reading(d, "twoBloodDelivery");
    if (!!bm !== blood || !!bd !== blood) bloodOk = false;
    if (blood) {
      const v = s.xueJi.isVoid || f.xun.voidBranches.includes(s.xueJi.earthUnder);
      if ((bm!.direction === "neutral") !== v || (bd!.direction === "neutral") !== v) bloodOk = false;
      if (v) bloodVoid += 1;
      if (v && !s.xueJi.isVoid) bloodSeatedVoid += 1;
      if (!"丙丁".includes(f.basic.dayStem) || !["寅", "丑"].includes(mb)) bloodOk = false;
    }
    if (!tai && ["taiCaiShengQi", "taiSiQi", "twoBloodMaintain", "twoBloodDelivery"].some((k) => reading(c, k) || reading(m, k) || reading(d, k))) earthOk = false;
  }
  check("胎財生気格: 胎神が妻財で月の生気、と完全に一致（向きなし）", caiOk);
  check("胎財生気格の日と月は 壬癸日の七月（午）・庚辛日の四月（卯）だけ（『大全』「五壬日，七月占皆同」「六庚六辛日，四月占皆然」。戊己日は出さない）",
    [...caiDays].sort().join(",") === ["壬申", "癸申", "庚巳", "辛巳"].sort().join(","), [...caiDays].join(","));
  check("胎財死気: 胎神が月の死気、と完全に一致", siOk);
  check("胎財死気の日と月は『大全』の一覧（甲乙 四月酉・丙丁 七月子・庚辛 十月卯・壬癸 正月午。戊己は出さない）と一致",
    [...siDays].sort().join(",") === ["甲巳", "乙巳", "丙申", "丁申", "庚亥", "辛亥", "壬寅", "癸寅"].sort().join(","), [...siDays].join(","));
  check("忧母格: 天后が月の死気（土）に乗る、と完全に一致", worryOk);
  check("月厭煞は「母年命」が本命だけか行年を含むかが確定しないので出さず、要約の判断できない事項に書く（最終監査で保留）",
    yyHeld && preg(factsOf("癸卯", "申", "午"), "delivery", "巳").summary.includes("月厭煞「申加母年命上」"));
  check("生養神二血法: 血支・血忌が同じ支で胎神か養神（胎神を剋す）、と完全に一致。丙丁日の正月・十二月だけ。血忌が旬空・坐空なら向きなし", bloodOk);
  check("二血法の例外は原文の「坐空鄉」を坐空として見る（旬空でない坐空の盤がある）", bloodVoid > 0 && bloodSeatedVoid > 0, `${bloodVoid}/${bloodSeatedVoid}`);
  check("戊己日（胎神が二説）は胎神を使う神煞の格を出さない", earthOk);
  // 段階を混ぜない
  const all = BOARDS.slice(0, 2000);
  let stageOk = true;
  for (const { f, mb } of all) {
    if (preg(f, "conception", mb).readings.some((x) => ["taiSiQi", "twoBloodMaintain", "motherWorryTianhou"].includes(x.key))) stageOk = false;
    if (preg(f, "maintain", mb).readings.some((x) => ["taiCaiShengQi", "twoBloodDelivery", "motherWorryTianhou"].includes(x.key))) stageOk = false;
  }
  check("妊娠の兆候・胎の経過・出産の規則を混ぜない（占的ごとの規則表）", stageOk);
}

// ---- 4. 古典の例 ----
const caseLines: string[] = [];
{
  // 『大六壬指南』孕産章 占験三（丁丑年四月 乙酉日 酉時 酉将）: 割注「酉为日之胎鬼死气」。規則の出典（『大全』）と別の書なので独立した検証
  const f3 = factsOf("乙酉", "酉", "酉");
  const m3 = evaluatePregnancyDomain(f3, { domain: "pregnancy", subtype: "maintain" } as InterpretationContext, "巳");
  check("『指南』占験三（四月 乙酉日）: 胎神 酉 が四月の死気で胎財死気（胎鬼）が成立（原典「酉為日之胎鬼死氣」と一致。独立した検証）",
    reading(m3, "taiSiQi")?.detected.includes("胎鬼") === true);
  caseLines.push("『指南』孕産章 占験三（四月 乙酉日 酉将 酉時）｜四課・三伝は原典と一致（Phase 5I）、天将は不一致｜胎財死気（胎鬼・死気 酉）が成立｜原典の割注「酉為日之胎鬼死氣」と一致（独立した検証）。原典の「末傳卯作支之胎神生氣」（日支の胎神が生気）は『直指』毕法賦の別の句で、今回は規則にしていない");
  // 占験五（癸卯日 午時 申将・月 巳）: 割注は「胎財生氣妻懷孕」を引くが、四月の生気は 卯 で胎神 午 と一致しない
  const f5 = factsOf("癸卯", "申", "午");
  const c5 = evaluatePregnancyDomain(f5, { domain: "pregnancy", subtype: "conception" } as InterpretationContext, "巳");
  check("『指南』占験五（四月 癸卯日）: 割注は「胎財生氣」を引くが、四月の生気 卯 は胎神 午 と違うので胎財生気格は成立しない（不一致として記録）", !reading(c5, "taiCaiShengQi"));
  caseLines.push("『指南』孕産章 占験五（四月 癸卯日 申将 午時）｜四課・三伝・天将は原典と一致（Phase 5I）｜胎財生気格は不成立（四月の生気は卯、癸の胎神は午）｜原典の割注は占時 午 を「癸之胎財」とし毕法の「胎財生氣」を引く。生気の月が合わないので不一致として記録（規則は変えない）");
  // 『大全』の例（規則の出典そのもの。独立した検証ではない）
  const fz = factsOf("壬寅", "卯");
  check("『大全』の例「壬寅日，七月占」で胎財生気格が成立（規則の出典の例）", !!reading(evaluatePregnancyDomain(fz, { domain: "pregnancy", subtype: "conception" } as InterpretationContext, "申"), "taiCaiShengQi"));
  caseLines.push("『大全』卷九の例（壬寅日七月の胎財生気・各格の月の一覧）｜規則の出典そのものなので独立した検証ではない（月と日の一覧は上で完全一致を確認）");
}

// ---- 5. 要約・決定性 ----
{
  const f = factsOf("癸卯", "申", "午");
  const doms: [string, (mb: Branch | null) => DomainResult][] = [
    ["traveler", (mb) => evaluateTravelerDomain(f, { domain: "traveler", subtype: "return" } as InterpretationContext, mb)],
    ["travel", (mb) => evaluateTravelDomain(f, { domain: "travel", subtype: "departure" } as InterpretationContext, mb)],
    ["house", (mb) => evaluateHouseDomain(f, { domain: "house", subtype: "residence" } as InterpretationContext, mb)],
    ["illness", (mb) => evaluateIllnessDomain(f, { domain: "illness" } as InterpretationContext, mb)],
    ["wealth", (mb) => evaluateWealthDomain(f, { domain: "wealth", subtype: "trading" } as InterpretationContext, mb)],
    ["pregnancy", (mb) => evaluatePregnancyDomain(f, { domain: "childbirth", subtype: "delivery" } as InterpretationContext, mb)],
  ];
  let lines = true, noMonth = true, det = true;
  for (const [, ev] of doms) {
    const s = ev("巳").summary;
    if (!["月建の神煞による読み（月支 巳", "・神煞が示す象意:", "・実現を助ける条件:", "・実現を妨げる条件:", "・判断が相反する事項:", "・判断できない事項:"].every((x) => s.includes(x))) lines = false;
    if (!ev(null).summary.includes("月支がないので、月建の神煞を使う読みは判断しない")) noMonth = false;
    if (JSON.stringify(ev("巳")) !== JSON.stringify(ev("巳"))) det = false;
  }
  check("要約に神煞の段（象意・助ける条件・妨げる条件・相反・判断できない事項）を加える", lines);
  check("月支がなければ、要約に「月建の神煞を使う読みは判断しない」と書く", noMonth);
  check("同じ入力で同じ結果", det);
  const h = evaluatePregnancyDomain(f, { domain: "childbirth", subtype: "delivery" } as InterpretationContext, "巳").summary;
  check("妊娠・出産の要約は判断できない神煞の句（忧子格・生神など）を書く", h.includes("忧子格") && h.includes("生神"));
}

console.log("古典の例:");
for (const l of caseLines) console.log(`  ${l}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
