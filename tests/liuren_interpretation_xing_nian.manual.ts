// tests/liuren_interpretation_xing_nian.manual.ts
//
// 六壬神課 Phase 5N（行年 xingNian.ts と contextBranch の personXingNian）のテスト。
// 実行: npx tsx tests/liuren_interpretation_xing_nian.manual.ts
//
//   1. 起例: 一歳＝丙寅（『指南』割注）・寅上起一歳（『心鏡』）。数え年ごとに六十干支を順行し、61歳で丙寅に戻る
//   2. 原典の例を層ごとに分けて固定する
//        原文（『断案２』邵先生の判断）… 年齢と行年（または行年の上神）が書かれた例。盤上の上神もエンジンで確かめる
//        原注（『指南』の割注）・注解（『指南』の現代の注解）・訳注（『断案２』の訳者）… 別に数える
//        規則の出典（『指南』武挙章 占験四）は独立した検証に数えない。不一致（『断案２』例46・『指南』の注解の周延儒）は記録する
//   3. 『断案２』の年齢が「占年の干支 − 生年の干支 ＋ 1」の数え年と一致する（年齢の数え方の確認。年の境界は決めない）
//   4. 女性・性別なし・数え年なしは求めない（理由つき）。人物 ID があるだけでは求めない。女性の例は記録だけ
//   5. 人物 ID つきの入力（XingNianInput）で人物ごとに求め、本命・太歳とは別の値。InterpretationPerson・ContextBranchSource は変えない

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { maleXingNianOf, xingNianOfPerson } from "../src/lib/liuren/interpretation/xingNian";
import { readFileSync, readdirSync } from "node:fs";
import { resolveContextBranch } from "../src/lib/liuren/interpretation/contextBranch";
import { natalYearStateOf } from "../src/lib/liuren/interpretation/natalYear";
import { taiSuiStateOf } from "../src/lib/liuren/interpretation/taiSui";
import type { InterpretationContext } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const gz = (i: number) => `${STEMS[((i % 60) + 60) % 10]}${BRANCHES[((i % 60) + 60) % 12]}`;
const idx = (s: string) => Array.from({ length: 60 }, (_, i) => i).find((i) => gz(i) === s)!;
const xn = (age: number) => { const x = maleXingNianOf(age); return `${x.stem}${x.branch}`; };
const heavenOn = (day: string, jiang: Branch, shi: Branch, b: Branch) =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang })).plate.heavenOn[b];

// ---- 1. 起例 ----
{
  check("一歳＝丙寅（『指南』「一歲起丙寅」）・支は寅から（『心鏡』「只以寅上起一歲」）", xn(1) === "丙寅" && maleXingNianOf(1).branch === "寅");
  check("数え年ごとに六十干支を順行する（2歳 丁卯・12歳 丁丑・13歳 戊寅）", xn(2) === "丁卯" && xn(12) === "丁丑" && xn(13) === "戊寅");
  check("61歳で丙寅に戻る（六十干支の循環）", xn(61) === "丙寅" && Array.from({ length: 120 }, (_, k) => k + 1).every((a) => xn(a) === xn(a + 60)));
  check("1 以上の整数でない数え年は例外（推測で丸めない）", [0, -1, 1.5, NaN, Infinity].every((a) => { try { maleXingNianOf(a); return false; } catch { return true; } }));
  // 60歳を超える年齢・60年周期を複数回またぐ年齢（121歳・181歳は丙寅、74歳は己卯、134歳は己卯）
  check("60歳を超える年齢と、60年周期を複数回またぐ年齢（61・121・181歳＝丙寅、74・134・194歳＝己卯）",
    [61, 121, 181].every((a) => xn(a) === "丙寅") && [74, 134, 194].every((a) => xn(a) === "己卯") && xn(60) === "乙丑" && xn(120) === "乙丑");
  // 干と支を別々に検算する（干は丙から10年周期、支は寅から12年周期）
  check("干と支を別々に検算しても一致（1〜240歳。干＝丙から10年周期・支＝寅から12年周期）",
    Array.from({ length: 240 }, (_, k) => k + 1).every((a) => { const x = maleXingNianOf(a); return x.stem === STEMS[(2 + a - 1) % 10] && x.branch === BRANCHES[(2 + a - 1) % 12] && x.reckonedAge === a; }));
  const code = readFileSync("src/lib/liuren/interpretation/xingNian.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  check("生年月日・日時から数え年を求めない（Date・暦の関数を使わない）", !/Date|calendar|natalYear|taiSui/.test(code));
}

// ---- 2. 原典の例 ----
type Ex = { layer: "原文" | "原注" | "注解" | "訳注"; source: string; age: number; expect: string; upper?: { day: string; jiang: Branch; shi: Branch; branch: Branch }; independent: boolean; note?: string };
const D2 = "『六壬断案２』";
const EX: Ex[] = [
  { layer: "原注", source: "『指南』武挙章第十四 占験四 割注（戊戌年生・丁丑年）", age: 40, expect: "巳", independent: false, note: "規則（一歲起丙寅）の出典そのもの" },
  { layer: "原文", source: `${D2} 例32（丙申生74歳）「行年上巳…卯の上に臨む」`, age: 74, expect: "卯", upper: { day: "戊申", jiang: "巳", shi: "卯", branch: "巳" }, independent: true },
  { layer: "原文", source: `${D2} 例43（丁卯生42歳）「日禄扶身、行年ともに白虎」（行年上は干上と同じ 午）`, age: 42, expect: "未", upper: { day: "丁丑", jiang: "午", shi: "未", branch: "午" }, independent: true },
  { layer: "原文", source: `${D2} 例50（45歳。来年46歳）「来年の行年亥上には子」`, age: 46, expect: "亥", upper: { day: "戊寅", jiang: "申", shi: "未", branch: "子" }, independent: true },
  { layer: "原文", source: `${D2} 例50（49歳）「４９歳は寅上に卯」`, age: 49, expect: "寅", upper: { day: "戊寅", jiang: "申", shi: "未", branch: "卯" }, independent: true },
  { layer: "原文", source: `${D2} 例51（戊辰生41歳）「行年午上に申が乗じ」`, age: 41, expect: "午", upper: { day: "癸亥", jiang: "未", shi: "巳", branch: "申" }, independent: true },
  { layer: "原文", source: `${D2} 例55（庚辰生30歳）「行年の上は申」`, age: 30, expect: "未", upper: { day: "戊申", jiang: "酉", shi: "申", branch: "申" }, independent: true },
  { layer: "原注", source: "『指南』占訟章第十八 占験五 割注「行年必在戌」（己丑年生・癸酉年＝数え45）", age: 45, expect: "戌", independent: true },
  { layer: "注解", source: "『指南』仕宦章 占験二 注解「本命戊子，行年在卯」（丁丑年＝数え50）", age: 50, expect: "卯", independent: true },
  { layer: "注解", source: "『指南』隠遁章 占験十八 注解「本命午，行年酉」（丁丑年。支の差から数え ≡ 8）", age: 56, expect: "酉", independent: true, note: "生年の干は書かれず、支の差だけで確かめる" },
  { layer: "訳注", source: `${D2} 例32 訳注「７４歳で行年は卯」`, age: 74, expect: "卯", independent: true },
  { layer: "訳注", source: `${D2} 例44 訳注「５９歳の行年は甲子」`, age: 59, expect: "甲子", independent: true },
  { layer: "訳注", source: `${D2} 例44 訳注「５７歳の行年は戌」`, age: 57, expect: "戌", independent: true },
  { layer: "訳注", source: `${D2} 例34 訳注「己未年の行年は亥」（甲戌生）`, age: (idx("己未") - idx("甲戌") + 60) % 60 + 1, expect: "亥", independent: true },
  { layer: "訳注", source: `${D2} 例34 訳注「庚申年は行年が子」（甲戌生）`, age: (idx("庚申") - idx("甲戌") + 60) % 60 + 1, expect: "子", independent: true },
  { layer: "訳注", source: `${D2} 例56 訳注「行年午」（辛巳生29歳）`, age: 29, expect: "午", independent: true },
];
const MISMATCH: Ex[] = [
  { layer: "原文", source: `${D2} 例46（辛卯生18歳）「４５、６歳のときは行年は子丑に至り」`, age: 45, expect: "子", independent: true, note: "算法では45歳 戌・46歳 亥（子丑は47・48歳）。年齢の数え方（数え年は例46の18歳でも一致）・年の境界では2年ずれない。女性の起例（資料にない）でもない。中国語原文が手元になく異文か確認できない" },
  { layer: "注解", source: "『指南』仕宦章 占験十一の注解「生年己丑…癸酉年行年在午」", age: (idx("癸酉") - idx("己丑") + 60) % 60 + 1, expect: "午", independent: true, note: "己丑生なら数え45で戌。同じ人物・同じ年を占訟章 占験五の原注は「行年必在戌」とし、算法と一致する。注解の生年と行年の組が合わない" },
];
const lines: string[] = [];
{
  let ok = true, upperOk = true;
  for (const e of EX) {
    const got = e.expect.length === 2 ? xn(e.age) : maleXingNianOf(e.age).branch;
    if (got !== e.expect) ok = false;
    let up = "";
    if (e.upper) {
      const u = heavenOn(e.upper.day, e.upper.jiang, e.upper.shi, maleXingNianOf(e.age).branch);
      if (u !== e.upper.branch) upperOk = false;
      up = `｜行年の上神 ${u}（原典 ${e.upper.branch}）`;
    }
    lines.push(`一致｜${e.layer}｜${e.source}｜数え${e.age}歳 → ${xn(e.age)}${up}${e.independent ? "" : "｜規則の出典（独立した検証ではない）"}`);
  }
  for (const e of MISMATCH) lines.push(`不一致｜${e.layer}｜${e.source}｜数え${e.age}歳 → ${xn(e.age)}（原典 ${e.expect}）｜${e.note}`);
  check(`原典の例 ${EX.length}件が算法と一致（原文6・原注2・注解2・訳注6）`, ok && EX.filter((e) => e.layer === "原文").length === 6 && EX.filter((e) => e.layer === "原注").length === 2);
  check("原文の例のうち上神が書かれた6件は、エンジンの天地盤で行年の上神も一致", upperOk);
  check("規則の出典（武挙章 占験四）は独立した検証に数えない", EX.filter((e) => !e.independent).length === 1);
  check("不一致の2件（『断案２』例46の原文・『指南』注解の周延儒）は算法を変えずに記録する", MISMATCH.every((e) => maleXingNianOf(e.age).branch !== e.expect));
  // 例46 の不一致の原因の候補を個別に確かめる（どれでも子丑にならない）
  const asYearOffset = [-1, 0, 1].map((d) => maleXingNianOf(45 + d).branch + maleXingNianOf(46 + d).branch);
  check("例46: 数え年の±1（年齢の数え方・年の境界）では子丑にならない", !asYearOffset.includes("子丑"), asYearOffset.join(","));
}

// ---- 3. 年齢の数え方 ----
{
  // [生年, 年齢, 占年]（『断案２』の見出し）
  const H: [string, number, string][] = [["丙申", 74, "己酉"], ["癸丑", 57, "己酉"], ["甲戌", 36, "己酉"], ["丁卯", 42, "戊申"], ["己未", 51, "己酉"], ["辛卯", 18, "戊申"], ["戊辰", 41, "戊申"], ["庚辰", 30, "己酉"], ["辛巳", 29, "己酉"]];
  check("『断案２』の見出し9例の年齢は、すべて「占年の干支 − 生年の干支 ＋ 1」の数え年（60年の倍数を除き）", H.every(([b, a, y]) => (idx(y) - idx(b) + 60) % 60 + 1 === ((a - 1) % 60) + 1));
}

// ---- 4. 入力不足・女性 ----
{
  const c0 = { domain: "career", persons: [{ id: "A", natalYear: natalYearStateOf("戊", "戌") }] } as unknown as InterpretationContext;
  const reason = (x: ReturnType<typeof xingNianOfPerson>) => (x.status === "unresolved" ? x.reason : null);
  check("人物 ID が persons になければ求めない", reason(xingNianOfPerson(c0, { personId: "Z", sex: "male", reckonedAge: 40 })) === "personNotFound");
  check("性別がなければ求めない（男性の算法を当てはめない）", reason(xingNianOfPerson(c0, { personId: "A", reckonedAge: 40 })) === "sexMissing");
  check("女性は起例が資料にないので求めない", reason(xingNianOfPerson(c0, { personId: "A", sex: "female", reckonedAge: 40 })) === "sexUnsupported");
  check("数え年がなければ求めない（本命があっても年齢を推測しない）", reason(xingNianOfPerson(c0, { personId: "A", sex: "male" })) === "reckonedAgeMissing");
  const r = xingNianOfPerson(c0, { personId: "A", sex: "male", reckonedAge: 40 });
  check("性別（男）と数え年が明示されたときだけ求める", r.status === "resolved" && r.state.branch === "巳" && r.state.reckonedAge === 40 && r.state.method === "maleFromBingYin");
  // 女性の例（記録だけ。実装しない）: 『指南』仕宦章 占験三十三「母年生於甲子…因子命行年到申」（壬午年＝数え79）
  // 干支の差は 18 年（数え19）か 78 年（数え79）。原文「壽合九九之數」（高齢）から 79 をとる（どちらでも支は同じ）
  const mother = (idx("壬午") - idx("甲子") + 60) % 60 + 1 + 60;
  lines.push(`女性の例（記録のみ）｜『指南』仕宦章 占験三十三 原文「母年生於甲子…子命行年到申」｜数え${mother}歳。男性と同じ丙寅順行なら ${maleXingNianOf(mother).branch}（原典 申）。明示の起例ではないので女性には実装しない`);
  lines.push("女性の例（記録のみ）｜『指南』疾病章 占験二「三兒婦…丁未、壬子、甲寅，余以行年推之，丁未生女，余二皆男」（己卯年）｜行年が臨む地盤の陰陽で読むと、丙寅順行で3人とも原典と合うが、算法の別の仮定でも同じになり区別できない");
  check("女性の例: 仕宦章 占験三十三の母（数え79）は男性と同じ算法で申になる（記録。実装の根拠にはしない）", mother === 79 && maleXingNianOf(mother).branch === "申");
  // 疾病章 占験二（己卯年六月 己酉日 辰時。原典の「巳午落空」から月将は 未）: 丙寅順行の行年が臨む地盤の陰陽が、原典の男女と合う（記録）
  const f2 = buildInterpretationFacts(calculateLiuren({ dayStem: "己", dayBranch: "酉", divinationBranch: "辰", monthGeneral: "未" }));
  const yang = (b: Branch) => BRANCHES.indexOf(b) % 2 === 0;
  const sexOf = (birth: string) => { const x = maleXingNianOf((idx("己卯") - idx(birth) + 60) % 60 + 1).branch; return yang(f2.plate.earthUnder[x]) ? "男" : "女"; };
  check("女性の例: 疾病章 占験二の三人（丁未・壬子・甲寅）は、丙寅順行の行年が臨む地盤の陰陽で原典の女・男・男と合う（記録。実装の根拠にはしない）",
    sexOf("丁未") === "女" && sexOf("壬子") === "男" && sexOf("甲寅") === "男");
}

// ---- 6. DOMAIN との分離 ----
{
  const dir = "src/lib/liuren/interpretation";
  // Phase 5O から: xingNian.ts を import するのは roles.ts（入力の型）と xingNianPlacement.ts（盤上の位置）だけ。DOMAIN は xingNianPlacement を使う
  const users = readdirSync(dir).filter((x) => x.endsWith(".ts") && x !== "xingNian.ts" && /from "\.\/xingNian"/.test(readFileSync(`${dir}/${x}`, "utf8")));
  check("xingNian.ts を import するのは roles.ts（入力の型）と xingNianPlacement.ts だけ（IdentityLink・既存 FACT は使わない）", users.sort().join(",") === "roles.ts,xingNianPlacement.ts", users.join(","));
}

// ---- 5. 人物ごとの入力（XingNianInput） ----
{
  const ctx = {
    domain: "career", taiSui: taiSuiStateOf("丑"),
    persons: [{ id: "A", natalYear: natalYearStateOf("戊", "戌") }, { id: "B", natalYear: natalYearStateOf("甲", "子") }, { id: "C", natalYear: natalYearStateOf("丙", "申") }],
    subjectPersonId: "A",
  } as unknown as InterpretationContext;
  const inputs = [{ personId: "A", sex: "male" as const, reckonedAge: 40 }, { personId: "B", sex: "female" as const, reckonedAge: 79 }, { personId: "C" }];
  const [a, b, c] = inputs.map((x) => xingNianOfPerson(ctx, x));
  check("人物 A（男・数え40）の行年は 巳、本命 戌・太歳 丑 とは別の値", a.status === "resolved" && a.personId === "A" && a.state.branch === "巳" &&
    (resolveContextBranch(ctx, { kind: "personNatalYear", personId: "A" }) as { branch: string }).branch === "戌" && (resolveContextBranch(ctx, { kind: "taiSui" }) as { branch: string }).branch === "丑");
  check("人物ごとに別々に求め、女性・性別なしは理由つきで求めない", b.status === "unresolved" && b.reason === "sexUnsupported" && c.status === "unresolved" && c.reason === "sexMissing");
  check("同じ入力で同じ結果", JSON.stringify(xingNianOfPerson(ctx, inputs[0])) === JSON.stringify(a));
  check("人物 ID だけの入力では求めない（本命・太歳・質問者があっても）", (() => { const x = xingNianOfPerson(ctx, { personId: "A" }); return x.status === "unresolved" && x.reason === "sexMissing"; })());
  const before = JSON.stringify(ctx);
  inputs.forEach((x) => xingNianOfPerson(ctx, x));
  check("行年を求めても CONTEXT（人物・本命・太歳）を書き換えない", JSON.stringify(ctx) === before);
  const roles = readFileSync("src/lib/liuren/interpretation/roles.ts", "utf8"), cb = readFileSync("src/lib/liuren/interpretation/contextBranch.ts", "utf8");
  check("InterpretationPerson・ContextBranchSource（Phase 4M・4N の確定構造）を変えない", !/reckonedAge|personXingNian|sex\?:/.test(roles + cb));
}

console.log("行年の例（層・一致／不一致）:");
for (const l of lines) console.log(`  ${l}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
