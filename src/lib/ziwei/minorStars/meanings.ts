// src/lib/ziwei/minorStars/meanings.ts
//
// 新規諸星の基本象意。紫微諸星.pdf「諸星の南北斗五行陰陽化吉凶一覧表」（p.179〜181）から
// 五行・陰陽と、性情欄の意味だけを取り出し、アプリ用の独自の短文に書き直したもの（原文は表示しない）。
// 資料の範囲（吉凶・性質・代表する事柄と、資料にある宮の喜忌）だけで、宮別の象意は足さない。
// 吉凶の語は資料に「平凶」「半吉」とあるもの（小耗・将軍）だけ。それ以外は吉凶を断定しない。
// 将前十二神・歳前十二神は配置規則がないため象意も登録しない。

import type { MinorStarId } from "./types";

export interface MinorStarMeaning {
  id: MinorStarId;
  /** 五行（資料に記載がなければ null） */
  element: "木" | "火" | "土" | "金" | "水" | null;
  /** 陰陽（資料に記載がなければ null） */
  yinYang: "陰" | "陽" | null;
  /** アプリ用の独自の短文 */
  text: string;
  /** 抽出元（表示しない） */
  sourceRef: string;
}

const P179 = "紫微諸星 p.179";
const P180 = "紫微諸星 p.180";
const P181 = "紫微諸星 p.180〜181";

const m = (id: string, element: MinorStarMeaning["element"], yinYang: MinorStarMeaning["yinYang"], text: string, sourceRef: string): MinorStarMeaning => ({
  id: id as MinorStarId,
  element,
  yinYang,
  text,
  sourceRef,
});

export const MINOR_STAR_MEANINGS: readonly MinorStarMeaning[] = [
  // 時系
  m("birth_hour/台輔", "土", "陽", "重要な地位にある人や実力者、名の知られた人と出会う縁を示します。", P179),
  m("birth_hour/封誥", "土", "陰", "表彰や受賞など、評価や名誉を得ることに関わる星です。", P179),
  // 月系
  m("birth_month/天刑", "火", "陽", "孤独や衝突の性質をもち、法律や医療・薬に関わる事柄を表します。", P179),
  m("birth_month/解神", null, null, "災いや凶事をやわらげ、悪いものを良い方向へ転じる働きがあります。", P179),
  m("birth_month/天巫", null, null, "昇進や地位の上昇を早める働きがあります。", P179),
  m("birth_month/天月", null, null, "病気に関わる星です。", P180),
  m("birth_month/陰煞", null, null, "目下の者や小人による妨害、見えないところで受ける災難を表します。", P180),
  // 日系
  m("birth_day/三台", "土", "陽", "貴の星で、乗り物や交通に関わる事柄を表します。", P179),
  m("birth_day/八座", "土", "陰", "貴の星で、三台と同じく乗り物や交通に関わる事柄を表します。", P179),
  m("birth_day/恩光", "火", "陽", "思いがけない幸運や、特別な引き立て・援助を表します。", P179),
  m("birth_day/天貴", "土", "陽", "事業が伸びることや、物事の進展を表します。", P179),
  // 年干系
  m("year_stem/天官", "土", "陽", "昇進や地位が上がることを表します。", P179),
  m("year_stem/天福", "土", "陽", "福や禄に恵まれ、栄えることを表します。", P179),
  // 年支系
  m("year_branch/天哭", "金", "陽", "刑剋の性質をもち、悲しみや憂い、心の痛みを表します。", P179),
  m("year_branch/天虚", "土", "陰", "空しさの性質をもち、天哭と同じく悲しみや憂いを表します。", P179),
  m("year_branch/龍池", "水", "陽", "試験や、耳に関わる事柄を表します。", P179),
  m("year_branch/鳳閣", "土", "陽", "試験や、口元（くちばし・唇・歯）に関わる事柄を表します。", P179),
  m("year_branch/天喜", "水", "陽", "紅鸞と同じく、結婚やお祝いごとを表します。", P179),
  m("year_branch/孤辰", "火", "陽", "肉親との縁が薄いことを表し、父母宮に入るのを嫌います。", P179),
  m("year_branch/寡宿", "火", "陰", "肉親との縁が薄いことを表し、夫妻宮に入るのを嫌います。", P179),
  m("year_branch/蜚廉", "火", null, "孤立の性質をもち、物が壊れることを表します。", P179),
  m("year_branch/破碎", "火", "陰", "損失や消耗を表します。", P179),
  m("year_branch/天才", "木", "陰", "才能や知恵を表します。", P179),
  m("year_branch/天寿", "土", "陽", "長寿を表します。", P179),
  // 命宮基準
  m("ming_shen/天傷", "水", "陽", "消耗の性質をもち、損失や浪費を表します。", P179),
  m("ming_shen/天使", "水", "陰", "災いや禍を表します。", P179),
  // 空亡系
  m("other/截空", null, null, "空しさや消えてなくなることを表します。命宮・身宮に入るのを嫌い、疾厄宮に入るのを喜びます。", P180),
  m("other/旬空", null, null, "截空と同じく、空しさや消えてなくなることを表します。", P180),
  // 博士十二神
  m("boshi/博士", "水", null, "聡明さや長寿、権威を表します。", P180),
  m("boshi/力士", "火", null, "権力や勢いを表します。", P180),
  m("boshi/青龍", "水", null, "お祝いごとや財が入ることを表します。", P180),
  m("boshi/小耗", "火", null, "やや凶。小さな損失や出費を表します。", P180),
  m("boshi/将軍", "木", null, "半ば吉。勇ましさと気性の荒さを表します。", P180),
  m("boshi/奏書", "金", null, "文書に関わる喜びごとを表します。", P180),
  m("boshi/飛廉", "火", null, "肉親との縁が薄いことを表し、命宮・身宮・父母宮に入るのを嫌います。", P180),
  m("boshi/喜神", "火", null, "めでたいことやお祝いごとを表します。", P180),
  m("boshi/病符", "水", null, "病気を表します。", P180),
  m("boshi/大耗", "火", null, "大きな損失や出費を表します。", P180),
  m("boshi/伏兵", "火", null, "口論やもめごと、対立を表します。", P180),
  m("boshi/官府", "火", null, "口論や訴訟、対立を表します。", P180),
  // 五行長生十二星
  m("changsheng/長生", null, null, "生気がみなぎる状態を表し、凶星があっても嫌いません。空亡に入るのは嫌います。", P180),
  m("changsheng/沐浴", null, null, "恋愛や情事を表します。夫妻宮に入るのを喜び、空亡と重なるのも喜びます。", P180),
  m("changsheng/冠帯", null, null, "お祝いごとを表します。", P180),
  m("changsheng/臨官", null, null, "冠帯と同じく、お祝いごとを表します。", P180),
  m("changsheng/帝旺", null, null, "運気がもっとも盛んな状態を表します。", P180),
  m("changsheng/衰", null, null, "勢いが下り坂に向かうことを表し、幼少期の運に入るのを嫌います。", P180),
  m("changsheng/病", null, null, "病気を表します。幼少期の運や疾厄宮に入るのを嫌います。", P180),
  m("changsheng/死", null, null, "幼少期・中年期の運に入るのを嫌います。", P180),
  m("changsheng/墓", null, null, "蔵や金庫のように蓄える意味をもち、財帛宮・官禄宮では喜び、命宮・身宮では嫌います。", P180),
  m("changsheng/絶", null, null, "消滅や断絶を表します。疾厄宮に入るのを喜び、命宮・身宮・子女宮に入るのを嫌います。", P181),
  m("changsheng/胎", null, null, "喜びごとを表し、夫妻宮・子女宮では喜びます。疾厄宮や晩年の運に入るのは嫌います。", P181),
  m("changsheng/養", null, null, "平穏と福を表し、どの宮でも吉とされます。", P181),
];

export const MINOR_STAR_MEANING_BY_ID: ReadonlyMap<MinorStarId, MinorStarMeaning> = new Map(MINOR_STAR_MEANINGS.map((x) => [x.id, x]));
