// src/lib/liuren/interpretation/facts.ts
//
// 役割:
//   起課結果 LiurenChart から、解釈で使う盤上の事実（InterpretationFacts）を取り出す。
//   解釈エンジンの唯一の入口。副作用なし・UI非依存。意味・吉凶の判断はしない。
//
//   起課エンジンの値はそのまま転記する（三伝・空亡・天地盤・天将・課体）。
//   新たに求めるのは四課の2項目だけで、どちらも起課エンジンの既存関数を使う:
//     四課上神の六親 … sixRelation(日干, 上神)（三伝の六親と同じ関数・同じ基準）
//     四課の剋関係   … isZei / isKe（三伝の賊剋判定と同じ関数）
//
// 三伝未確定（sanchuan.status = "undetermined"）では chart.transmissions が null なので、
// transmissions: null のまま返す。

import { sixRelation } from "../relations";
import { isZei, isKe } from "../sanchuan/context";
import type { Lesson, LiurenChart, HeavenlyGeneral } from "../types";
import type { InterpretationFacts, LessonFact, LessonZeike } from "./types";

function lessonZeike(l: Lesson): LessonZeike {
  if (isZei(l)) return "下賊";
  if (isKe(l)) return "上剋";
  return "無剋";
}

function lessonFact(chart: LiurenChart, l: Lesson, general: HeavenlyGeneral): LessonFact {
  return {
    index: l.index,
    upper: l.upper,
    lower: l.lower,
    lowerBranch: l.lowerBranch,
    general,
    relation: sixRelation(chart.input.dayStem, l.upper),
    zeike: lessonZeike(l),
  };
}

export function buildInterpretationFacts(chart: LiurenChart): InterpretationFacts {
  const { input, lessons: ls, lessonGenerals: gs } = chart;
  return {
    basic: {
      dayStem: input.dayStem,
      dayBranch: input.dayBranch,
      divinationBranch: input.divinationBranch,
      monthGeneral: input.monthGeneral,
    },
    lessons: [
      lessonFact(chart, ls[0], gs[0]),
      lessonFact(chart, ls[1], gs[1]),
      lessonFact(chart, ls[2], gs[2]),
      lessonFact(chart, ls[3], gs[3]),
    ],
    transmissions: chart.transmissions ?? null,
    xun: chart.xun,
    plate: chart.plate,
    generals: chart.generals,
    sanchuan: chart.sanchuan,
  };
}
