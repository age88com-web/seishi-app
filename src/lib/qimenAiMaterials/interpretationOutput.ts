// src/lib/qimenAiMaterials/interpretationOutput.ts
//
// 役割:
//   確定資料（confirmedMaterials）と AI 統合解説（aiSynthesis）を、完全に分けた1つの出力にまとめる。
//   AI が未実行・空回答・時間切れ・検証失敗のどれでも、確定資料はそのまま全部残る。
//   AI の文は確定資料に書き込まない。AI の呼び出しそのものはこの層では行わない。
//
// aiSynthesis.status:
//   ok        … 回答があり、検証を通過した（text に本文が入る）
//   none      … 未実行・空回答・時間切れ・呼び出し失敗（text は null）
//   rejected  … 回答はあったが検証で却下（text は null。回答は rawText に残す）

import type { ConfirmedMaterials } from "./confirmedMaterials";
import type { QimenSynthesisInput } from "./synthesisInput";
import { validateSynthesis } from "./synthesisValidation";
import type { SynthesisValidation } from "./synthesisValidation";

/** AI 呼び出しの結果（呼び出す側が渡す）。 */
export interface SynthesisRunResult {
  /** 最終回答（Thinking を含めない）。未実行・失敗なら null */
  text: string | null;
  /** 未実行・時間切れ・呼び出し失敗などの理由 */
  failure?: "not_run" | "timeout" | "error";
  errorMessage?: string;
  /** 比較実験用の記録（モデル・パラメータ・think・入力ハッシュ・所要時間など） */
  run?: Record<string, unknown>;
}

export interface AiSynthesis {
  status: "ok" | "none" | "rejected";
  /** status が ok のときだけ入る */
  text: string | null;
  /** AI の回答そのもの（rejected の確認用。未実行なら null） */
  rawText: string | null;
  /** none の理由 */
  noneReason: "not_run" | "empty" | "timeout" | "error" | null;
  citedIds: string[];
  validation: SynthesisValidation | null;
  run: Record<string, unknown> | null;
}

export interface QimenInterpretationOutput {
  confirmedMaterials: ConfirmedMaterials;
  aiSynthesis: AiSynthesis;
}

/** 確定資料と AI 統合解説をまとめる。result を省略すると未実行（none）として扱う。 */
export function buildInterpretationOutput(
  confirmedMaterials: ConfirmedMaterials,
  input: QimenSynthesisInput,
  result: SynthesisRunResult = { text: null, failure: "not_run" },
): QimenInterpretationOutput {
  const run = result.run ?? null;
  const none = (noneReason: AiSynthesis["noneReason"]): QimenInterpretationOutput => ({
    confirmedMaterials,
    aiSynthesis: { status: "none", text: null, rawText: result.text, noneReason, citedIds: [], validation: null, run },
  });
  if (result.failure === "timeout") return none("timeout");
  if (result.failure === "error") return none("error");
  if (result.text === null || result.failure === "not_run") return none("not_run");
  if (result.text.trim() === "") return none("empty");

  const validation = validateSynthesis(result.text, input);
  return {
    confirmedMaterials,
    aiSynthesis: {
      status: validation.passed ? "ok" : "rejected",
      text: validation.passed ? result.text : null,
      rawText: result.text,
      noneReason: null,
      citedIds: validation.citedIds,
      validation,
      run,
    },
  };
}
