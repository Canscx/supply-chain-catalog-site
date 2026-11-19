import raw from "./catalog.json";

/** 一条产品链条。name 是展示名，直接用产品名（如「PCB电路板」）。 */
export interface Chain {
  id: string;
  name: string;
  /** 检索与链接用的标准名；当前与 name 相同。 */
  base: string;
  /** 其他叫法，只参与搜索匹配，不渲染。 */
  aliases: string[];
  /** 该链条在原始报价表里能对应上的环节；为空表示无证据。 */
  stages: string[];
}

export interface Category {
  id: string;
  name: string;
  chains: Chain[];
}

export interface Stage {
  id: string;
  name: string;
}

export interface Catalog {
  version: string;
  totals: { chains: number; categories: number };
  stages: Stage[];
  categories: Category[];
}

export const catalog = raw as Catalog;

/** 全部链条的扁平列表。 */
export const allChains: Chain[] = catalog.categories.flatMap((c) => c.chains);

/** 品类 id → 品类，用于 URL 参数校验。 */
export const categoryById = new Map(catalog.categories.map((c) => [c.id, c]));

/** 检索归一化：去掉空白、间隔符与大小写差异。 */
const SEP = /[\s\u00b7\u2027\u30fb.\-\u2013\u2014_/、,，·]+/g;
export const normalize = (s: string): string => String(s).toLowerCase().replace(SEP, "");

/** 一条链条参与检索的全部文本；末尾的「链条」只是隐藏检索词，不展示。 */
export const searchText = (c: Chain): string => normalize([c.name, ...c.aliases, "链条"].join(" "));
