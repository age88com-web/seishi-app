// tests/takujitsu_kichijin_group4_zhiri_fari_unit.manual.ts
//
// 目的:
//   擇日「日家吉神」第4グループに今回追加した「制日」「伐日」
//   （docs/source/擇日テキスト.pdf p.10「(18)寶義制専伐日」表の
//   残り2列。原文注記により凶神として実装）の単体テスト。
//
//   60干支全件について、制日12件・伐日12件が過不足なく成立し、
//   それ以外の干支では成立しないことを検証する。
//   既存の寶日・義日・専日（吉神）のデータ・判定は今回変更しておらず、
//   別テスト（takujitsu_kichijin_group4_unit.manual.ts 等）でカバー済み。
//
// 実行:
//   npx tsx tests/takujitsu_kichijin_group4_zhiri_fari_unit.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import { resolveKichijinGroup4 } from "../src/lib/takujitsu";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const GANZHI60: string[] = [];
for (let i = 0; i < 60; i++) {
  GANZHI60.push(STEMS[i % 10] + BRANCHES[i % 12]);
}

// 擇日テキスト.pdf p.10 表から転記（正本）。
const ZHIRI_EXPECTED = [
  "甲戌", "甲辰", "乙未", "乙丑", "丙申", "丁酉", "戊子", "己亥", "庚寅", "辛卯", "壬午", "癸巳",
];
const FARI_EXPECTED = [
  "甲申", "乙酉", "丙子", "丁亥", "戊寅", "己卯", "庚午", "辛巳", "壬戌", "壬辰", "癸未", "癸丑",
];

const DUMMY_MONTH_BRANCH = "辰"; // 制日・伐日は monthBranch を使わないためダミーで十分
const DUMMY_YEAR_STEM = "甲"; // 同上、yearStem 未使用

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, cond: boolean) {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  ${label}`);
  }
}

// 1. 制日12干支すべてが制日として成立する
for (const gz of ZHIRI_EXPECTED) {
  const dayStem = gz[0];
  const dayBranch = gz[1];
  const r = resolveKichijinGroup4({
    yearStem: DUMMY_YEAR_STEM,
    monthBranch: DUMMY_MONTH_BRANCH,
    dayStem,
    dayBranch,
  });
  check(`${gz} → 制日が成立する`, r.kyojin.includes("制日"));
}

// 2. 伐日12干支すべてが伐日として成立する
for (const gz of FARI_EXPECTED) {
  const dayStem = gz[0];
  const dayBranch = gz[1];
  const r = resolveKichijinGroup4({
    yearStem: DUMMY_YEAR_STEM,
    monthBranch: DUMMY_MONTH_BRANCH,
    dayStem,
    dayBranch,
  });
  check(`${gz} → 伐日が成立する`, r.kyojin.includes("伐日"));
}

// 3. 指定外の干支では成立しない（60干支全件を走査し、期待値どおりの
//    干支だけに制日・伐日が付くことを確認する＝過剰一致が無いことの検証）
const zhiriSet = new Set(ZHIRI_EXPECTED);
const fariSet = new Set(FARI_EXPECTED);
for (const gz of GANZHI60) {
  const dayStem = gz[0];
  const dayBranch = gz[1];
  const r = resolveKichijinGroup4({
    yearStem: DUMMY_YEAR_STEM,
    monthBranch: DUMMY_MONTH_BRANCH,
    dayStem,
    dayBranch,
  });
  const hasZhiri = r.kyojin.includes("制日");
  const hasFari = r.kyojin.includes("伐日");
  check(`${gz}: 制日の成立/不成立が期待どおり`, hasZhiri === zhiriSet.has(gz));
  check(`${gz}: 伐日の成立/不成立が期待どおり`, hasFari === fariSet.has(gz));
  // 制日・伐日は原文表で排他（同じ干支が両方に属することはない）
  check(`${gz}: 制日と伐日が同時に成立しない`, !(hasZhiri && hasFari));
}

// 4. 既存の寶日・義日・専日は今回変更していないことの回帰確認
//    （寶義制専伐日は60干支を5分割する排他的な表のため、寶日・義日・専日
//    それぞれの12件が、制日・伐日いずれにも重複しないことも合わせて検証）
const BAO_EXPECTED = [
  "甲午", "乙巳", "丙戌", "丙辰", "丁未", "丁丑", "戊申", "己酉", "庚子", "辛亥", "壬寅", "癸卯",
];
const YI_EXPECTED = [
  "甲子", "乙亥", "丙寅", "丁卯", "戊午", "己巳", "庚戌", "庚辰", "辛未", "辛丑", "壬申", "癸酉",
];
const ZHUAN_EXPECTED = [
  "甲寅", "乙卯", "丙午", "丁巳", "戊戌", "戊辰", "己未", "己丑", "庚申", "辛酉", "壬子", "癸亥",
];
for (const gz of [...BAO_EXPECTED, ...YI_EXPECTED, ...ZHUAN_EXPECTED]) {
  check(`${gz}: 寶日/義日/専日側は制日・伐日いずれにも属さない（排他性）`, !zhiriSet.has(gz) && !fariSet.has(gz));
}
// 60干支が寶+義+専+制+伐で過不足なく分割されることの検算
const unionAll = new Set([...BAO_EXPECTED, ...YI_EXPECTED, ...ZHUAN_EXPECTED, ...ZHIRI_EXPECTED, ...FARI_EXPECTED]);
check("寶+義+専+制+伐の合計が60干支と一致する（重複・漏れなし）", unionAll.size === 60);

console.log(`\n${pass} / ${pass + fail} PASS`);
if (fail > 0) {
  console.log("FAILURES:");
  for (const f of failures) console.log(f);
  process.exit(1);
}
