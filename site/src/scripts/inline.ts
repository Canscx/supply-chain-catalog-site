import { normalize } from "./search";

const root = document.querySelector<HTMLElement>("[data-inline]");
const counters = document.querySelectorAll<HTMLElement>("[data-count-up]");

if (counters.length && "IntersectionObserver" in window &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const duration = 1400;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue;

      const counter = entry.target as HTMLElement;
      observer.unobserve(counter);
      const target = Number(counter.dataset.target);
      if (!Number.isFinite(target) || target < 0) continue;

      let startedAt: number | undefined;
      const tick = (now: number) => {
        startedAt ??= now;
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - (1 - progress) ** 3;
        counter.textContent = String(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    }
  }, { threshold: 0.5 });

  for (const counter of counters) {
    observer.observe(counter);
  }
}

if (root) {
  const search = root.querySelector<HTMLInputElement>("[data-search]");
  const clearBtn = root.querySelector<HTMLButtonElement>("[data-search-clear]");
  const field = root.querySelector<HTMLElement>(".field");
  const scopeGrid = root.querySelector<HTMLElement>("[data-scope-grid]");
  const scopeCells = [...root.querySelectorAll<HTMLAnchorElement>("[data-scope-cat]")];
  const scopeAll = root.querySelector<HTMLAnchorElement>("[data-scope-all]");
  const scopeNote = root.querySelector<HTMLElement>("[data-scope-search-note]");

  let q = "";

  function readUrl() {
    const p = new URLSearchParams(location.search);
    q = (p.get("q") ?? "").trim();
  }

  function writeUrl() {
    const url = new URL(location.href);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    history.replaceState(history.state, "", url);
  }

  function applyFilter() {
    const nq = normalize(q);
    let categories = 0;
    let chains = 0;

    for (const cell of scopeCells) {
      const hit = !nq || normalize(cell.dataset.scopeSearch ?? "").includes(nq);
      cell.hidden = !hit;
      if (!hit) continue;
      categories += 1;
      chains += Number(cell.dataset.chainCount ?? 0);
    }

    if (scopeAll) scopeAll.hidden = Boolean(nq);
    if (scopeGrid) scopeGrid.dataset.filtered = String(Boolean(nq));
    if (scopeNote) {
      scopeNote.hidden = !nq;
      scopeNote.textContent = !nq
        ? ""
        : categories
          ? `匹配 ${categories} 个品类 · ${chains} 条产品链条`
          : "未找到匹配品类";
    }
    if (field) field.dataset.filled = String(Boolean(q));
    if (search && search.value !== q) search.value = q;
  }

  function setQuery(next: string, focus = false) {
    q = next.trim();
    writeUrl();
    applyFilter();
    if (focus) search?.focus();
  }

  const nav = document.querySelector<HTMLElement>(".nav");
  const tools = root.querySelector<HTMLElement>(".inline-tools");
  const scopeTargets = new Map(scopeCells.map((cell) => [cell.id, cell]));
  let jumpEpoch = 0;
  let highlighted: HTMLElement | undefined;
  let highlightTimer = 0;

  function clearHighlight() {
    highlighted?.classList.remove("scope-cell--highlighted");
    highlighted = undefined;
    window.clearTimeout(highlightTimer);
  }

  function jumpToScope(cell: HTMLAnchorElement) {
    const currentJump = ++jumpEpoch;
    clearHighlight();
    if (cell.hidden) setQuery("");
    // Skip the grid’s reveal transform so it cannot shift the measured landing point.
    scopeGrid?.removeAttribute("data-reveal");

    const url = new URL(location.href);
    url.hash = cell.id;
    if (url.href !== location.href) history.pushState(history.state, "", url);

    const fixedHeight = (nav?.getBoundingClientRect().height ?? 0) + (tools?.getBoundingClientRect().height ?? 0);
    const requestedTop = cell.getBoundingClientRect().top + window.scrollY - fixedHeight - 16;
    const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const destination = Math.min(maxTop, Math.max(0, requestedTop));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: destination, behavior: reduce ? "instant" : "smooth" });

    const deadline = performance.now() + 1600;
    const waitForArrival = (now: number) => {
      if (currentJump !== jumpEpoch) return;
      const bounds = cell.getBoundingClientRect();
      const atDestination = Math.abs(window.scrollY - destination) <= 2;
      if (!atDestination && now < deadline) {
        requestAnimationFrame(waitForArrival);
        return;
      }
      if (cell.hidden || bounds.top < fixedHeight || bounds.top >= window.innerHeight - 32) return;
      cell.focus({ preventScroll: true });
      highlighted = cell;
      cell.classList.add("scope-cell--highlighted");
      // Leave time for both 560 ms outline pulses, including the final fade.
      highlightTimer = window.setTimeout(clearHighlight, 1160);
    };
    requestAnimationFrame(waitForArrival);
  }

  for (const card of root.querySelectorAll<HTMLAnchorElement>("[data-catalog-card]")) {
    card.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const cell = scopeTargets.get(card.hash.slice(1));
      if (!cell) return;
      event.preventDefault();
      jumpToScope(cell);
    });
  }

  if (search) {
    let composing = false;
    search.addEventListener("compositionstart", () => {
      composing = true;
    });
    search.addEventListener("compositionend", () => {
      composing = false;
      setQuery(search.value);
    });
    search.addEventListener("input", () => {
      if (composing) return;
      setQuery(search.value);
    });
  }

  clearBtn?.addEventListener("click", () => setQuery("", true));

  readUrl();
  applyFilter();
  window.addEventListener("popstate", () => {
    jumpEpoch++;
    clearHighlight();
    readUrl();
    applyFilter();
  });
}
