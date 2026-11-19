/** 检索归一化：去掉空白、间隔符与大小写差异。 */
const SEP = /[\s\u00b7\u2027\u30fb.\-\u2013\u2014_/、,，·]+/g;

export const normalize = (s: string): string => String(s).toLowerCase().replace(SEP, "");

/** 偏好减少动效时返回 auto。 */
export const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
