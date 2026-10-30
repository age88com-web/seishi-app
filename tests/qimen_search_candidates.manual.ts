// tests/qimen_search_candidates.manual.ts
//
// 奇門遁甲 吉格日時検索 Phase 4A（方位指定・日時順・成立宮の要約・候補の鑑定情報）の確認。
//   ・方位未指定の結果は、検索した格局の成立をそのまま集めたもの（calculate() と一致）で日時順。
//   ・方位指定の結果は、未指定の結果を指定宮で絞り込んだものと一致し、指定外の宮を含まない。
//   ・成立宮の要約（八門・九星・八神・天盤干・地盤干・寄宮干・吉格・凶格）が calculate() の値と一致。
//   ・吉格と凶格が同宮しても両方残る。盤全体の凶格を持つ。
//   ・候補の鑑定情報（剋應・婚姻に関する参考情報）は既存の剋應参照・象意データの値だけ。
//   ・二つ以上成立（TWO_PLUS）は、選択した格局のうち異なる2種類以上が同じ宮で成立した宮だけを返す
//     （1種類だけ・別々の宮に1格ずつは対象外、同じ格局の重複選択は1種類、方位指定と併用可）。
// 実行: npx tsx tests/qimen_search_candidates.manual.ts

import { calculate, resolveKokuoForPalace } from "@/lib/qimen";
import { runQimenSearch } from "@/lib/qimenSearch/searchEngine";
import { JIKAKU_NAMES, KYOKAKU_NAMES } from "@/lib/qimenSearch/formats";
import {
  buildCandidateDetail,
  flattenKokuo,
  MARRIAGE_KEYWORDS,
} from "@/lib/qimenSearch/candidateInfo";
import type { QimenFormatOption, QimenSearchHit } from "@/lib/qimenSearch/types";

let checks = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (!ok) failures.push(`${label} ${detail}`);
}

const base = { startDate: "2026-04-01", endDate: "2026-04-30" };
const JI: QimenFormatOption[] = JIKAKU_NAMES.map((name) => ({ category: "jikaku", name }));
const KY: QimenFormatOption[] = KYOKAKU_NAMES.map((name) => ({ category: "kyokaku", name }));
const dt = (h: QimenSearchHit) => [h.year, h.month, h.day, h.hour].map((x) => String(x).padStart(2, "0")).join("-");

(async () => {
  for (const [label, formats] of [["吉格26", JI], ["凶格38", KY]] as const) {
    const all = await runQimenSearch({ ...base, formats: [...formats] });
    // 日時順
    check(`${label} 日時順`, all.every((h, i) => i === 0 || dt(all[i - 1]) < dt(h)));
    // calculate() と一致・要約が一致
    let sameCount = 0;
    for (const h of all) {
      const r = calculate({ year: h.year, month: h.month, day: h.day, hour: h.hour, minute: 0, timezone: "Asia/Tokyo" });
      const src = formats[0].category === "jikaku" ? r.jikaku.matches : r.kyokaku.matches;
      const expected = src.filter((m) => m.palaces.length > 0).map((m) => `${m.name}${JSON.stringify(m.palaces)}`);
      check(`${label} ${dt(h)} 成立格局`, JSON.stringify(h.matches.map((m) => `${m.name}${JSON.stringify(m.palaces)}`)) === JSON.stringify(expected));
      const palaces = [...new Set(h.matches.flatMap((m) => m.palaces))].sort((a, b) => a - b);
      check(`${label} ${dt(h)} 要約の宮`, JSON.stringify(h.palaceSummaries.map((s) => s.palace)) === JSON.stringify(palaces));
      for (const s of h.palaceSummaries) {
        const p = r.palaces[s.palace];
        check(`${label} ${dt(h)} 宮${s.palace} 要約`,
          JSON.stringify(s.baMen) === JSON.stringify(p.baMen) && JSON.stringify(s.jiuXing) === JSON.stringify(p.jiuXing)
          && JSON.stringify(s.baShen) === JSON.stringify(p.baShen) && s.tianPanStem === (p.tianPanStem ?? null)
          && s.diPanStem === (p.diPanStem ?? null) && !("tianPanLodged" in s) && !("qinCompanion" in s)
          && s.diPanLodged === (p.diPanLodged?.stem ?? null)
          && JSON.stringify(s.jikaku) === JSON.stringify(r.jikaku.matches.filter((m) => m.palaces.includes(s.palace)).map((m) => m.name))
          && s.kyokaku.length === r.kyokaku.matches.filter((m) => m.palaces.includes(s.palace)).length);
        if (s.jikaku.length > 0 && s.kyokaku.length > 0) sameCount += 1;
      }
      check(`${label} ${dt(h)} 盤全体の凶格`, h.boardWideKyokaku.length === r.kyokaku.matches.filter((m) => m.palaces.length === 0).length);
    }
    if (label === "吉格26") check("吉格と凶格の同宮が要約に残る", sameCount > 0, String(sameCount));

    // 方位指定: 未指定の結果を指定宮で絞り込んだものと一致
    for (const dirs of [[1], [2, 8], [3, 4, 6, 7, 9]]) {
      const got = await runQimenSearch({ ...base, formats: [...formats], directionPalaces: dirs });
      const expected = all
        .map((h) => ({ h, ms: h.matches.map((m) => ({ ...m, palaces: m.palaces.filter((p) => dirs.includes(p)) })).filter((m) => m.palaces.length > 0) }))
        .filter((x) => x.ms.length > 0)
        .map((x) => `${dt(x.h)}${JSON.stringify(x.ms)}`);
      check(`${label} 方位${dirs.join(",")} 絞り込み`, JSON.stringify(got.map((h) => `${dt(h)}${JSON.stringify(h.matches)}`)) === JSON.stringify(expected), `${got.length} / ${expected.length}`);
      check(`${label} 方位${dirs.join(",")} 指定外の宮なし`, got.every((h) => h.palaceSummaries.every((s) => dirs.includes(s.palace))));
    }
    // 八方位すべてを指定しても未指定と同じ
    const eight = await runQimenSearch({ ...base, formats: [...formats], directionPalaces: [1, 2, 3, 4, 6, 7, 8, 9] });
    check(`${label} 八方位指定＝未指定`, JSON.stringify(eight) === JSON.stringify(all));
  }

  // AND 検索と方位指定
  const and = await runQimenSearch({ ...base, matchMode: "AND", directionPalaces: [4], formats: [{ category: "jikaku", name: "青龍返首" }, { category: "kyokaku", name: "飛悖格" }] });
  check("AND＋方位 巽四宮", and.every((h) => h.matches.length === 2 && h.matches.every((m) => JSON.stringify(m.palaces) === "[4]")), String(and.length));

  // 二つ以上成立（TWO_PLUS）: 選択した格局のうち異なる2種類以上が同じ宮で成立した宮だけ
  {
    const scen = { same2: 0, single: 0, diffPalace: 0, threeSelTwo: 0 };
    for (const sel of [
      ["jikaku:青龍返首", "jikaku:飛鳥跌穴"],
      ["jikaku:飛鳥跌穴", "jikaku:丙奇得使", "kyokaku:熒入太白"],
      ["jikaku:乙奇得使", "jikaku:乙奇升殿", "kyokaku:三奇受刑", "kyokaku:乙奇入墓"],
      ["jikaku:青龍返首", "jikaku:青龍返首", "kyokaku:飛悖格"],
    ]) {
      const formats: QimenFormatOption[] = sel.map((k) => ({ category: k.split(":")[0] as "jikaku" | "kyokaku", name: k.split(":")[1] }));
      const got = await runQimenSearch({ ...base, matchMode: "TWO_PLUS", formats });
      const or = await runQimenSearch({ ...base, matchMode: "OR", formats });
      const selKinds = new Set(sel);
      const expected: string[] = [];
      for (const h of or) {
        const kinds = new Map<number, Set<string>>();
        for (const m of h.matches) for (const p of m.palaces) {
          if (!kinds.has(p)) kinds.set(p, new Set());
          kinds.get(p)!.add(`${m.category}:${m.name}`);
        }
        const ok = [...kinds].filter(([, k]) => k.size >= 2).map(([p]) => p);
        const allPalaces = [...kinds.keys()];
        if (ok.length > 0) {
          expected.push(`${dt(h)}${JSON.stringify(h.matches.map((m) => ({ ...m, palaces: m.palaces.filter((p) => ok.includes(p)) })).filter((m) => m.palaces.length > 0))}`);
          scen.same2 += 1;
          if (selKinds.size >= 3 && ok.some((p) => kinds.get(p)!.size === 2)) scen.threeSelTwo += 1;
        } else if (new Set(h.matches.map((m) => m.name)).size >= 2 && allPalaces.length >= 2) {
          scen.diffPalace += 1; // 別々の宮に1格ずつ → 対象外
        } else {
          scen.single += 1; // 1種類だけ → 対象外
        }
      }
      check(`TWO_PLUS ${sel.join("+")}`, JSON.stringify(got.map((h) => `${dt(h)}${JSON.stringify(h.matches)}`)) === JSON.stringify(expected), `${got.length} / ${expected.length}`);
      check(`TWO_PLUS ${sel.join("+")} 要約は条件を満たした宮だけ`, got.every((h) => h.palaceSummaries.every((s2) => h.matches.filter((m) => m.palaces.includes(s2.palace)).length >= 2)));
      check(`TWO_PLUS ${sel.join("+")} 日時順`, got.every((h, i) => i === 0 || dt(got[i - 1]) < dt(h)));
      // 方位指定との併用
      const dir = await runQimenSearch({ ...base, matchMode: "TWO_PLUS", formats, directionPalaces: [2, 8] });
      check(`TWO_PLUS ${sel.join("+")} 方位指定`, dir.every((h) => h.palaceSummaries.every((s2) => [2, 8].includes(s2.palace))) && dir.length <= got.length);
    }
    check("TWO_PLUS 同宮2種類でヒット・1種類・別宮の例がある", scen.same2 > 0 && scen.single > 0 && scen.diffPalace > 0 && scen.threeSelTwo > 0, JSON.stringify(scen));
    // 同じ格局の重複選択は1種類と数える（青龍返首を2回選んでも、飛悖格が無い宮は対象外）
    const dup = await runQimenSearch({ ...base, matchMode: "TWO_PLUS", formats: [{ category: "jikaku", name: "青龍返首" }, { category: "jikaku", name: "青龍返首" }] });
    check("TWO_PLUS 同じ格局を重複カウントしない", dup.length === 0, String(dup.length));
  }

  // 候補の鑑定情報（2025-06-30 0:00 陰遁3局丙子 坤二宮: 寄宮干・吉格と凶格の同宮）
  const r = calculate({ year: 2025, month: 6, day: 30, hour: 0, minute: 0, timezone: "Asia/Tokyo" });
  const d = buildCandidateDetail(r, 2);
  // 天禽帯同干（丙）は候補一覧に表示しない（2026-10-30 監修者決定）。格局判定には使うので符勃格・飛鳥跌穴は成立する。
  check("候補 坤二宮 寄宮干", d.tianPanStem === "己" && !("tianPanLodged" in d) && !("qinCompanion" in d) && d.diPanStem === "己" && d.diPanLodged === "丙");
  check("候補 符勃格は天禽帯同干による成立（内部識別）", JSON.stringify(r.kyokaku.matches.find((m) => m.name === "符勃格")?.qinCompanionPalaces) === "[2]");
  check("候補 坤二宮 吉格・凶格の同宮", d.jikaku.includes("青龍返首") && d.jikaku.includes("飛鳥跌穴") && d.kyokaku.includes("符勃格") && d.kyokaku.includes("飛悖格"));
  check("候補 盤全体の凶格", d.boardWide.some((x) => x.startsWith("伏吟格")));
  check("候補 剋應は既存の参照と同じ", JSON.stringify(flattenKokuo(d.kokuo)) === JSON.stringify(flattenKokuo(resolveKokuoForPalace(r, 2))));
  // 婚姻に関する参考情報は語を含む記述だけ・全文と出典つき
  let refCount = 0;
  for (let day = 1; day <= 30; day += 1) {
    for (let hour = 0; hour < 24; hour += 2) {
      const rr = calculate({ year: 2026, month: 4, day, hour, minute: 0, timezone: "Asia/Tokyo" });
      for (const p of [1, 2, 3, 4, 6, 7, 8, 9]) {
        for (const ref of buildCandidateDetail(rr, p).marriage) {
          refCount += 1;
          check("参考情報 語を含む", ref.matchedTexts.length > 0 && ref.matchedTexts.every((t) => MARRIAGE_KEYWORDS.some((w) => t.includes(w)) && ref.texts.includes(t)));
          check("参考情報 出典あり", ref.source.length > 0 && !ref.source.includes("undefined"));
        }
      }
    }
  }
  check("参考情報が出る", refCount > 0, String(refCount));

  if (failures.length > 0) {
    console.error(failures.slice(0, 20).join("\n"));
    console.error(`FAIL ${failures.length} / ${checks}`);
    process.exit(1);
  }
  console.log(`${checks} checks PASS`);
})();
