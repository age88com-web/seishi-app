// src/lib/liuren/index.ts
//
// 役割:
//   六壬神課 起課エンジンの公開窓口。UI・API・古典実例照合は本ファイルから import する。

export { calculateLiuren, calculateLiurenAt } from "./liurenEngine";
export type { LiurenDateTimeInput, LiurenDateTimeResult } from "./liurenEngine";
export { resolveMonthGeneral } from "./yuejiang";
export { buildPlate } from "./tiandipan";
export { buildFourLessons } from "./sike";
export { placeGenerals } from "./tianjiang";
export { resolveSanchuan, shehaiPath } from "./sanchuan";
export { JIGONG, GENERALS } from "./constants";
export type * from "./types";
