// src/lib/qimen/index.ts
//
// 役割:
//   奇門遁甲モジュールの公開窓口。呼び出し側は本ファイルからのみ import する。
//   内部モジュール（dingju / dipan / xunshou / tianpan / jiuxing / bamen /
//   bashen / jikaku / kyokaku）へ直接依存させない。
//
// 公開方針:
//   - 統合エンジン calculate() と、その入出力型のみを再 export する。
//   - calculate() の戻り値 QimenResult に格局判定（jikaku / kyokaku）を含む。
//   - 排盤だけ済ませた QimenResult から格局のみ再計算したい場合のために、
//     jikaku.ts / kyokaku.ts の *FromQimen ラッパも公開する。

export { calculate } from "./qimenEngine";
export type {
  QimenResult,
  PalaceSummary,
} from "./qimenEngine";

// 中宮寄宮: 寄宮情報と、通常干・寄宮干を区別して取り出す参照関数（格局判定には未適用）。
export {
  CURRENT_POLICY,
  makeStemPolicy,
  tianPanStems,
  diPanStems,
  roleStems,
  stemPairs,
  scanPalaces,
  judgedPalaces,
} from "./stemAccess";
export type {
  CenterLodging,
  LodgedStem,
  LodgingKind,
  StemEntry,
  StemOrigin,
  StemPair,
  StemPolicy,
} from "./stemAccess";

export { resolveJikakuFromQimen } from "./jikaku";
export type {
  JikakuResult,
  JikakuMatch,
} from "./jikaku";

export { resolveKyokakuFromQimen, PALACE_TRIGRAM } from "./kyokaku";
export type {
  KyokakuResult,
  KyokakuMatch,
} from "./kyokaku";

// 剋應（こくおう）: 算出済み QimenResult から剋應データを引くだけの参照層。
export { lookupKokuo, resolveKokuoForPalace } from "./kokuo";
export type {
  KokuoCategory,
  KokuoEntry,
  KokuoLookupInput,
  KokuoResult,
} from "./kokuo";
