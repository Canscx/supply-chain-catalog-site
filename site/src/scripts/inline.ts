import { normalize } from "./search";

const root = document.querySelector<HTMLElement>("[data-inline]");
const counter = document.querySelector<HTMLElement>("[data-count-up]");

if (counter) {
  const target = Number(counter.dataset.target);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (Number.isFinite(target) && target >= 0) {
    if (reducedMotion || !("IntersectionObserver" in window)) {
      counter.textContent = `${target}+`;
    } else {
      counter.textContent = "0+";
      const duration = 1400;
      let startedAt = 0;

      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const tick = (now: number) => {
          if (!startedAt) startedAt = now;
          const progress = Math.min((now - startedAt) / duration, 1);
          const eased = 1 - (1 - progress) ** 3;
          counter.textContent = `${Math.round(target * eased)}+`;
          if (progress < 1) requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      }, { threshold: 0.5 });

      observer.observe(counter);
    }
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
    const p = new URLSearchParams(location.search);
    if (q) p.set("q", q);
    else p.delete("q");
    const qs = p.toString();
    history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
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
    readUrl();
    applyFilter();
  });
}
