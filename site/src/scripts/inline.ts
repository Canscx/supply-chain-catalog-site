import { normalize, scrollBehavior } from "./search";

const root = document.querySelector<HTMLElement>("[data-inline]");

if (root) {
  const search = root.querySelector<HTMLInputElement>("[data-search]");
  const clearBtn = root.querySelector<HTMLButtonElement>("[data-search-clear]");
  const field = root.querySelector<HTMLElement>(".field");
  const groups = [...root.querySelectorAll<HTMLElement>("[data-group]")];
  const countEl = root.querySelector<HTMLElement>("[data-count]");
  const anchor = root.querySelector<HTMLElement>("[data-anchor]");
  const emptyEl = root.querySelector<HTMLElement>("[data-empty]");
  const resetBtns = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-reset]"),
    ...root.querySelectorAll<HTMLButtonElement>("[data-reset-empty]"),
  ];

  const scopeGrid = root.querySelector<HTMLElement>("[data-scope-grid]");
  const scopeCells = [...root.querySelectorAll<HTMLButtonElement>("[data-scope-cat]")];
  const scopeAll = root.querySelector<HTMLButtonElement>("[data-scope-all]");
  const scopeCollapsed = root.querySelector<HTMLButtonElement>("[data-scope-expand]");
  const scopeNameEl = root.querySelector<HTMLElement>("[data-scope-name]");
  const scopeCountEl = root.querySelector<HTMLElement>("[data-scope-count]");
  const scopeMore = root.querySelector<HTMLButtonElement>("[data-scope-more]");
  const scopeMoreLabel = root.querySelector<HTMLElement>("[data-scope-more-label]");

  /** 手机端折叠时露出多少个品类。 */
  const SCOPE_CHUNK = 8;

  const catName = new Map<string, string>();
  const catTotal = new Map<string, number>();
  for (const g of groups) {
    catName.set(g.dataset.group!, g.querySelector(".group-name")!.textContent!.trim());
    catTotal.set(g.dataset.group!, g.querySelectorAll("[data-chain]").length);
  }

  let cat = "all";
  let q = "";
  let scopeExpanded = false;

  /* ---------- URL ---------- */
  function readUrl() {
    const p = new URLSearchParams(location.search);
    const c = p.get("category") ?? "all";
    const valid = c !== "all" && catName.has(c);
    cat = valid ? c : "all";
    q = (p.get("q") ?? "").trim();
  }

  function writeUrl() {
    const p = new URLSearchParams(location.search);
    if (cat === "all") p.delete("category");
    else p.set("category", cat);
    if (q) p.set("q", q);
    else p.delete("q");
    const qs = p.toString();
    history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
  }

  /* ---------- 业务范围块 ---------- */
  function setScopeCollapsed(collapsed: boolean) {
    const isCollapsed = collapsed && cat !== "all";
    if (scopeGrid) scopeGrid.hidden = isCollapsed;
    if (scopeCollapsed) scopeCollapsed.hidden = !isCollapsed;
    if (isCollapsed) {
      if (scopeNameEl) scopeNameEl.textContent = catName.get(cat) ?? "";
      if (scopeCountEl) scopeCountEl.textContent = `${catTotal.get(cat) ?? 0} 条`;
    }
  }

  function syncScopeMore() {
    if (!scopeGrid) return;
    // 已选品类必须可见，否则用户看不到当前筛选来源
    const expand = scopeExpanded || cat !== "all";
    scopeGrid.dataset.expanded = String(expand);
    if (scopeMore) {
      scopeMore.setAttribute("aria-expanded", String(expand));
      if (scopeMoreLabel) {
        scopeMoreLabel.textContent = expand
          ? "收起，只看常看品类"
          : `展开全部 ${scopeCells.length} 个品类`;
      }
    }
  }

  /* ---------- 渲染 ---------- */
  function render() {
    const nq = normalize(q);
    let total = 0;

    for (const g of groups) {
      const items = [...g.querySelectorAll<HTMLElement>("[data-chain]")];
      const isCat = cat === "all" || g.dataset.group === cat;
      let shown = 0;

      for (const it of items) {
        const hay = normalize(`${it.dataset.chain ?? ""} ${it.dataset.alias ?? ""}`);
        const ok = isCat && (!nq || hay.includes(nq));
        it.hidden = !ok;
        if (ok) shown++;
      }

      total += shown;
      g.hidden = shown === 0;
      g.dataset.open = String(isCat || Boolean(nq));

      const toggle = g.querySelector<HTMLButtonElement>(".group-toggle");
      if (toggle) {
        toggle.disabled = Boolean(nq) || cat !== "all";
        toggle.setAttribute("aria-expanded", g.dataset.open);
      }
      const n = g.querySelector<HTMLElement>(".group-n");
      if (n) n.textContent = String(shown);
    }

    for (const c of scopeCells) {
      c.setAttribute("aria-current", String(cat !== "all" && c.dataset.scopeCat === cat));
    }
    if (scopeAll) scopeAll.setAttribute("aria-current", String(cat === "all"));

    if (countEl) {
      countEl.replaceChildren("共 ", Object.assign(document.createElement("b"), { textContent: String(total) }), " 条链条");
    }
    if (emptyEl) emptyEl.hidden = total > 0;

    const filtering = Boolean(q) || cat !== "all";
    for (const b of resetBtns) b.hidden = !filtering;

    if (field) field.dataset.filled = String(Boolean(q));
    if (search && search.value !== q) search.value = q;

    setScopeCollapsed(cat !== "all");
    syncScopeMore();
  }

  /* ---------- 状态变更 ---------- */
  function setState(patch: Partial<{ cat: string; q: string }>, opts: { focusSearch?: boolean; scrollToResults?: boolean } = {}) {
    if ("cat" in patch && patch.cat !== undefined) cat = patch.cat;
    if ("q" in patch && patch.q !== undefined) q = patch.q;
    writeUrl();
    render();

    if (opts.focusSearch) search?.focus();

    if (opts.scrollToResults && anchor) {
      anchor.scrollIntoView({ block: "start", behavior: scrollBehavior() });
      anchor.focus({ preventScroll: true });
    }
  }

  /* ---------- 品类选择 ---------- */
  const jumpToCat = (id: string) => {
    if (id === cat) {
      anchor?.scrollIntoView({ block: "start", behavior: scrollBehavior() });
      return;
    }
    setState({ cat: id }, { scrollToResults: true });
  };

  for (const c of scopeCells) {
    c.addEventListener("click", () => jumpToCat(c.dataset.scopeCat!));
  }

  scopeAll?.addEventListener("click", () => {
    if (cat === "all") {
      anchor?.scrollIntoView({ block: "start", behavior: scrollBehavior() });
      return;
    }
    scopeExpanded = false;
    setState({ cat: "all" }, { scrollToResults: true });
  });

  scopeCollapsed?.addEventListener("click", () => {
    scopeExpanded = true;
    setScopeCollapsed(false);
    syncScopeMore();
    scopeCells.find((c) => c.dataset.scopeCat === cat)?.focus({ preventScroll: true });
  });

  scopeMore?.addEventListener("click", () => {
    scopeExpanded = !scopeExpanded;
    syncScopeMore();
    if (!scopeExpanded) scopeGrid?.scrollIntoView({ block: "nearest" });
  });

  /* ---------- 搜索 ---------- */
  if (search) {
    let composing = false;
    search.addEventListener("compositionstart", () => {
      composing = true;
    });
    search.addEventListener("compositionend", () => {
      composing = false;
      setState({ q: search.value.trim() });
    });
    search.addEventListener("input", () => {
      if (composing) return;
      setState({ q: search.value.trim() });
    });
  }

  clearBtn?.addEventListener("click", () => setState({ q: "" }, { focusSearch: true }));

  /* ---------- 分组折叠 ---------- */
  for (const g of groups) {
    g.querySelector(".group-toggle")?.addEventListener("click", (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      if (btn.disabled) return;
      g.dataset.open = g.dataset.open === "true" ? "false" : "true";
      btn.setAttribute("aria-expanded", g.dataset.open);
    });
  }

  /* ---------- 清空 ---------- */
  for (const b of resetBtns) {
    b.addEventListener("click", () => setState({ cat: "all", q: "" }, { focusSearch: true }));
  }

  readUrl();
  render();
  window.addEventListener("popstate", () => {
    readUrl();
    render();
  });
}
