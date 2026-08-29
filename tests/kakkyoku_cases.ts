import { evalKakkyoku } from "@/lib/kakkyoku_engine";
import { KakkyokuContext } from "@/lib/types";

export const CASE_SHINKYO_ZAIHAKU: KakkyokuContext = {
  sex: "M",
  isDayBirth: true,
  monthBranch: "寅",
  mingBranch: "子",

  bodies: [
    // 命宮主星（例）
    { key: "命主", label: "命主", lon: 0, palace: "子" },

    // 身宮主星が財帛宮に入る
    { key: "身主", label: "身主", lon: 30, palace: "丑" },

    // 必要最小限の七政
    { key: "日", label: "日", lon: 10, palace: "卯" },
    { key: "月", label: "月", lon: 40, palace: "辰" },
    { key: "木", label: "木", lon: 70, palace: "巳" },
    { key: "火", label: "火", lon: 100, palace: "午" },
    { key: "土", label: "土", lon: 130, palace: "未" },
    { key: "金", label: "金", lon: 160, palace: "申" },
    { key: "水", label: "水", lon: 190, palace: "酉" },
  ],
};

// 実行確認
console.log(evalKakkyoku(CASE_SHINKYO_ZAIHAKU));