/** 检索归一化：去掉空白、间隔符与大小写差异。 */
const SEP = /[\s\u00b7\u2027\u30fb.\-\u2013\u2014_/、,，·]+/g;

export const normalize = (s: string): string => String(s).toLowerCase().replace(SEP, "");

/** 偏好减少动效时返回 auto。 */
export const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

/**
 * 在原文下标出匹配片段，返回可安全挂到 DOM 的节点数组。
 *
 * 匹配走归一化文本，但返回的是原文的切片 —— 所以「玉米.链条」能高亮出原文里的
 * 「玉米·链条」，分隔符差异不会让高亮跑偏。找不到命中就原样返回一个文本节点。
 */
export function highlightNodes(text: string, query: string): Node[] {
  const plain = [document.createTextNode(text)];
  const nq = normalize(query);
  if (!nq) return plain;

  // 归一化后的每个字符，记住它来自原文的哪个下标。
  // 分隔符（会被归一化成空串）在这里不占位 —— 否则映射表会比归一化文本长，
  // 命中下标换算回原文时整体偏移，高亮会落到隔壁的字上。
  const map: number[] = [];
  let normed = "";
  for (let i = 0; i < text.length; i++) {
    const keep = normalize(text[i]);
    for (let k = 0; k < keep.length; k++) map.push(i);
    normed += keep;
  }

  const at = normed.indexOf(nq);
  if (at < 0) return plain;

  const start = map[at];
  const end = map[Math.min(at + nq.length - 1, map.length - 1)] + 1;

  const frag: Node[] = [];
  if (start > 0) frag.push(document.createTextNode(text.slice(0, start)));
  frag.push(
    Object.assign(document.createElement("mark"), { textContent: text.slice(start, end) })
  );
  if (end < text.length) frag.push(document.createTextNode(text.slice(end)));
  return frag;
}

/** 归一化后的检索文本是否包含关键词（关键词需已 normalize）。 */
export const matchText = (haystack: string, normalizedQuery: string): boolean =>
  !normalizedQuery || normalize(haystack).includes(normalizedQuery);
