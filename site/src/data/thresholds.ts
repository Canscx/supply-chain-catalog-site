import raw from "./thresholds.json";

/** 银行分级的一档。 */
export interface ThresholdTier {
  label: string;
  text: string;
}

/** 「对盾的要求」：要么是银行分级表，要么是若干条文字要求。 */
export interface ThresholdShield {
  title: string;
  /** 分级表的小标题，如「合作银行分级标准」。 */
  tiersTitle?: string;
  tiers?: ThresholdTier[];
  notes?: string[];
}

/** 一类链条的准入门槛。 */
export interface ThresholdSection {
  id: string;
  name: string;
  /** 材料清单，编号由页面生成。 */
  items: string[];
  shield: ThresholdShield;
}

export interface Thresholds {
  version: string;
  sections: ThresholdSection[];
}

export const thresholds = raw as Thresholds;

/** 全部材料条数，用于区块导语。 */
export const thresholdItemCount = thresholds.sections.reduce(
  (total, section) => total + section.items.length,
  0
);
