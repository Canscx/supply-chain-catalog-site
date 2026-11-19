/**
 * 右侧尺规式章节导航（电脑端）。
 *
 * 判定法：以「视口顶部下方 probe 处」为探针，取最后一个顶部越过探针的章节。
 * probe 会算上吸附导航的高度，首页再多让开吸附搜索栏，保证「视线刚进入章节」就切。
 *
 * 无 JS 时不加 html.js，CSS 里整层保持 display:none。
 */

document.documentElement.classList.add("js");

const DESKTOP = "(min-width: 1200px)";
/** 探针相对吸附层的额外偏移。 */
const PROBE_OFFSET = 20;

const layer = document.querySelector<HTMLElement>("[data-ruler-layer]");
const ruler = layer?.querySelector<HTMLElement>(".ruler") ?? null;
const track = layer?.querySelector<HTMLElement>(".ruler__track") ?? null;
const cursor = layer?.querySelector<HTMLElement>(".ruler__cursor") ?? null;

if (layer && ruler && track && cursor) {
  interface Entry {
    id: string;
    item: HTMLElement;
    tick: HTMLAnchorElement;
    target: HTMLElement;
  }

  const entries: Entry[] = [];

  for (const item of track.querySelectorAll<HTMLElement>("[data-ruler-target]")) {
    const id = item.dataset.rulerTarget;
    const tick = item.querySelector<HTMLAnchorElement>(".ruler__tick");
    const target = id ? document.getElementById(id) : null;

    // 目标缺失（文案或结构改过）就摘掉这个刻度，避免死链。
    if (!id || !tick || !target) {
      item.remove();
      continue;
    }

    target.setAttribute("data-ruler-anchor", "");
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");

    entries.push({ id, item, tick, target });
  }

  const navEl = document.querySelector<HTMLElement>(".nav");
  const toolsEl = document.querySelector<HTMLElement>(".inline-tools");

  /** 吸附层总高度：导航 + 首页吸附搜索栏（无则 0）。 */
  function stickyOffset(): number {
    const navH = navEl ? navEl.getBoundingClientRect().height : 0;
    const toolsH = toolsEl ? toolsEl.getBoundingClientRect().height : 0;
    return navH + (toolsH > 0 ? toolsH : 0);
  }

  /** 章节是否真的可达（被品类筛选掉或折叠时高度为 0）。 */
  function isReachable(el: HTMLElement): boolean {
    if (el.hidden || el.closest("[hidden]")) return false;
    return el.offsetHeight > 0;
  }

  let activeId = "";
  /** 上一次的可见状态，避免每帧都动 DOM。 */
  let reachKey = "";

  /**
   * 把不可达章节的刻度隐藏，尺子只保留能跳的项。
   * 依赖 offsetTop 定位游标，所以必须先同步可见性。
   */
  function syncReachable(): Entry[] {
    const reachable: Entry[] = [];
    for (const e of entries) {
      const on = isReachable(e.target);
      if (e.item.hidden === on) e.item.hidden = !on;
      if (on) reachable.push(e);
    }

    const key = reachable.map((e) => e.id).join("|");
    if (key !== reachKey) reachKey = key;
    return reachable;
  }

  /**
   * 游标位置：track 顶部 + 该行中心。
   * track 是 offsetParent（position: relative），item.offsetTop 已是相对 track 的值，
   * 再加 track 相对尺子的偏移，整体才跟着尺子自身的滚动一起动。
   */
  function setCursor(item: HTMLElement) {
    const y = track!.offsetTop + item.offsetTop + item.offsetHeight / 2 - 1;
    const max = track!.offsetTop + track!.offsetHeight - 2;
    cursor!.style.transform = `translateY(${Math.round(Math.min(Math.max(y, 0), max))}px)`;
  }

  function render(active: Entry | null) {
    const nextId = active?.id ?? "";
    if (nextId === activeId) return;

    activeId = nextId;
    for (const e of entries) e.tick.setAttribute("aria-current", String(e.id === nextId));
    if (active) setCursor(active.item);
  }

  /** 当前章节：可见目标里，顶部最后一个越过探针的。 */
  function pick(reachable: Entry[]): Entry | null {
    if (!reachable.length) return null;

    // 顶部：第一项；到底：最后一项。短尾页不会卡在前一章。
    if (window.scrollY < 8) return reachable[0];

    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atBottom) return reachable[reachable.length - 1];

    const probe = window.scrollY + stickyOffset() + PROBE_OFFSET;
    let found: Entry | null = null;

    for (const e of reachable) {
      if (e.target.getBoundingClientRect().top + window.scrollY <= probe) found = e;
      else break;
    }
    return found ?? reachable[0];
  }

  let ticking = false;

  function update() {
    ticking = false;
    const reachable = syncReachable();
    render(pick(reachable));
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  /* ---------- 点击刻度 ---------- */
  for (const e of entries) {
    e.tick.addEventListener("click", (ev) => {
      ev.preventDefault();
      e.target.scrollIntoView({ block: "start", behavior: behavior() });
      e.target.focus({ preventScroll: true });
      try {
        history.replaceState(null, "", `#${e.id}`);
      } catch {
        /* file:// 下可能失败，忽略 */
      }
      syncReachable();
      render(e);
    });
  }

  function behavior(): ScrollBehavior {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }

  /* ---------- 视口切换 ---------- */
  const mq = window.matchMedia(DESKTOP);

  function refresh() {
    if (!mq.matches) {
      for (const e of entries) {
        e.tick.setAttribute("aria-current", "false");
        e.item.hidden = false;
      }
      activeId = "";
      return;
    }

    // 锚点让位量：吸附层高度 + 一点余量，供 scroll-margin 使用（仅桌面生效）。
    document.documentElement.style.setProperty(
      "--ruler-anchor",
      `${Math.round(stickyOffset() + PROBE_OFFSET)}px`
    );

    ticking = false;
    update();
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });

  if (typeof mq.addEventListener === "function") mq.addEventListener("change", refresh);
  else mq.addListener(refresh);

  refresh();

  /* ---------- 哈希直达：等布局稳定后补一次，抵消字体加载位移 ---------- */
  const hashId = location.hash.slice(1);
  const hit = hashId ? entries.find((e) => e.id === hashId) : null;

  if (hit && mq.matches) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        hit.target.scrollIntoView({ block: "start", behavior: "auto" });
        syncReachable();
        render(hit);
      });
    });
  }
}
