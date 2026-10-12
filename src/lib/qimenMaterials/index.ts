// src/lib/qimenMaterials/index.ts
//
// 役割:
//   一宮分の判断材料集約レイヤーの公開窓口。排盤済みの QimenResult と宮番号から、
//   既存の象意DB・剋應DB・格局判定の結果を集めるだけ（要約・再解釈・AI接続はしない）。

export { buildQimenPalaceMaterials } from "./palaceMaterials";
export type {
  ElementMaterial,
  ElementMaterialItem,
  FuYinFanYinMaterial,
  GateNoteMaterial,
  KakuMaterial,
  KakuScope,
  KokuoMaterial,
  KyuseiContextMaterial,
  MaterialSource,
  OmittedMaterial,
  QimenPalaceMaterials,
} from "./types";
