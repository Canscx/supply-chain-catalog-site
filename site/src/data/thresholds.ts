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

/** 材料项附带的模板下载。 */
export interface ThresholdDownload {
  /** 按钮文案，如「下载开票信息模版」。 */
  label: string;
  /** 站点 public/downloads 下的文件名（ASCII，避免 URL 编码）。 */
  file: string;
  /** 下载后保存的文件名，由 download 属性还原中文名。 */
  saveAs: string;
  /** 格式说明，如 Word / Excel，只用于辅助说明与无障碍标签。 */
  format?: string;
}

/** 一条材料：纯文本，或带模板下载的条目。 */
export interface ThresholdItem {
  text: string;
  downloads?: ThresholdDownload[];
}

/** 一类链条的准入门槛。 */
export interface ThresholdSection {
  id: string;
  name: string;
  /** 材料清单，编号由页面生成；字符串即纯文本条目。 */
  items: Array<string | ThresholdItem>;
  shield: ThresholdShield;
}

export interface Thresholds {
  version: string;
  sections: ThresholdSection[];
}

export const thresholds = raw as Thresholds;
