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

export { resolveJikakuFromQimen } from "./jikaku";
export type {
  JikakuResult,
  JikakuMatch,
} from "./jikaku";

export { resolveKyokakuFromQimen } from "./kyokaku";
export type {
  KyokakuResult,
  KyokakuMatch,
} from "./kyokaku";
