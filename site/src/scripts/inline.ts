import { highlightNodes, normalize, scrollBehavior } from "./search";

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
  const scopeKeywordEl = root.querySelector<HTMLElement>("[data-scope-keyword]");
  const scopeActEl = root.querySelector<HTMLElement>("[data-scope-act]");
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
  /** 本轮关键词是否已经为「滚到结果区」让过位，避免边打字边跳。 */
  let scrolledForQuery = false;

  /* ---------- URL ---------- */
  function readUrl() {
    const p = new URLSearchParams(location.search);
    const c = p.get("category") ?? "all";
    const valid = c !== "all" && catName.has(c);
    cat = valid ? c : "all";
    q = (p.get("q") ?? "").trim();
    scrolledForQuery = Boolean(q);
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

  /**
   * 业务范围块的收起态。
   * 选品类与输入关键词都会收起——搜索时它挡在结果上面太占地方；
   * 收起后留一行摘要，随时能点回去。
   */
  function setScopeCollapsed(collapsed: boolean) {
    const isCollapsed = collapsed && (cat !== "all" || Boolean(q));
    if (scopeGrid) scopeGrid.hidden = isCollapsed;
    if (scopeCollapsed) scopeCollapsed.hidden = !isCollapsed;

    if (!isCollapsed) return;

    const count =
      cat !== "all"
        ? catTotal.get(cat) ?? 0
        : [...catTotal.values()].reduce((sum, n) => sum + n, 0);

    if (scopeNameEl) scopeNameEl.textContent = cat !== "all" ? catName.get(cat) ?? "" : "全部品类";
    if (scopeCountEl) scopeCountEl.textContent = `${count} 条`;

    if (scopeKeywordEl) {
      const on = Boolean(q);
      scopeKeywordEl.hidden = !on;
      scopeKeywordEl.textContent = on ? `搜索「${q}」` : "";
    }
    if (scopeActEl) scopeActEl.textContent = q ? "清空搜索" : "换品类";
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

  /* ---------- 结果渲染 ---------- */

  /** 把分组标题按关键词重绘；query 为空时还原纯文本。 */
  function paintGroupName(g: HTMLElement, query: string) {
    const el = g.querySelector<HTMLElement>(".group-name");
    if (!el) return;
    const name = catName.get(g.dataset.group!) ?? el.textContent ?? "";
    const key = `${name}::${query}`;
    if (el.dataset.painted === key) return;
    el.replaceChildren(...highlightNodes(name, query));
    el.dataset.painted = key;
  }

  /**
   * 把一条链条重绘成「名称 + 可选别名说明」。
   * 别名命中时（如搜「螺纹钢」命中「钢材（含螺纹钢）」），链条名里看不到关键词，
   * 补一句「别名：螺纹钢」并高亮，否则结果看起来像没命中。
   */
  function paintChain(a: HTMLAnchorElement, query: string) {
    const name = a.dataset.name ?? a.textContent ?? "";
    const aliases = (a.dataset.alias ?? "").split(" ").filter(Boolean);
    const aliasHit = query && aliases.some((x) => normalize(x).includes(normalize(query)));

    const key = `${name}::${query}::${aliasHit ? "alias" : ""}`;
    if (a.dataset.painted === key) return;

    const frag: Node[] = highlightNodes(name, query);
    if (aliasHit) {
      const note = document.createElement("span");
      note.className = "chain-alias";
      note.append(document.createTextNode("别名："));
      for (const x of aliases) {
        if (normalize(x).includes(normalize(query))) {
          note.append(...highlightNodes(x, query));
          break;
        }
      }
      frag.push(note);
    }

    a.replaceChildren(...frag);
    a.dataset.painted = key;
  }

  function render() {
    const nq = normalize(q);
    let total = 0;

    for (const g of groups) {
      const items = [...g.querySelectorAll<HTMLElement>("[data-chain]")];
      const isCat = cat === "all" || g.dataset.group === cat;

      // 关键词命中品类名 → 该品类整体命中（显示全部链条）
      const catHit = Boolean(nq) && normalize(g.dataset.catName ?? "").includes(nq);

      let shown = 0;
      for (const li of items) {
        const a = li.querySelector<HTMLAnchorElement>(".chain");
        const hay = `${a?.dataset.name ?? li.dataset.chain ?? ""} ${a?.dataset.alias ?? li.dataset.alias ?? ""}`;
        const ok = isCat && (catHit || !nq || normalize(hay).includes(nq));
        li.hidden = !ok;
        if (ok) {
          shown++;
          if (a) paintChain(a, q);
        }
      }

      total += shown;
      g.hidden = shown === 0;
      g.dataset.open = String(isCat || Boolean(nq));

      // 品类名命中时高亮分组标题；否则还原为纯文本
      if (shown > 0) paintGroupName(g, catHit ? q : "");

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

    setScopeCollapsed(cat !== "all" || Boolean(q));
    syncScopeMore();
  }

  /* ---------- 状态变更 ---------- */
  function setState(
    patch: Partial<{ cat: string; q: string }>,
    opts: { focusSearch?: boolean; scrollToResults?: boolean } = {}
  ) {
    if ("cat" in patch && patch.cat !== undefined) cat = patch.cat;
    if ("q" in patch && patch.q !== undefined) q = patch.q;
    if (!q) scrolledForQuery = false;

    writeUrl();
    render();

    if (opts.focusSearch) search?.focus();

    if (opts.scrollToResults && anchor) {
      anchor.scrollIntoView({ block: "start", behavior: scrollBehavior() });
      anchor.focus({ preventScroll: true });
    }
  }

  /**
   * 开始搜索时把结果区送到吸附层下方一次。
   * 只在关键词从无到有时触发，之后继续打字不再跳，免得边打字边滚。
   */
  function revealResultsOnce() {
    if (scrolledForQuery || !q || !anchor) return;
    scrolledForQuery = true;
    anchor.scrollIntoView({ block: "start", behavior: scrollBehavior() });
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
    if (cat === "all" && !q) {
      anchor?.scrollIntoView({ block: "start", behavior: scrollBehavior() });
      return;
    }
    scopeExpanded = false;
    setState({ cat: "all", q: "" }, { scrollToResults: true });
  });

  // 收起条：有关键词时点它清空关键词，否则展开网格
  scopeCollapsed?.addEventListener("click", () => {
    if (q) {
      setState({ q: "" }, { focusSearch: true });
      return;
    }
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
      revealResultsOnce();
    });
    search.addEventListener("input", () => {
      if (composing) return;
      setState({ q: search.value.trim() });
      revealResultsOnce();
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
    b.addEventListener("click", () =>
      setState({ cat: "all", q: "" }, { focusSearch: true })
    );
  }

  readUrl();
  render();
  window.addEventListener("popstate", () => {
    readUrl();
    render();
  });
}
