import { highlightNodes, normalize } from "./search";

const root = document.querySelector<HTMLElement>("[data-catalog]");

if (root) {
  const search = root.querySelector<HTMLInputElement>("[data-search]");
  const clearBtn = root.querySelector<HTMLButtonElement>("[data-search-clear]");
  const field = root.querySelector<HTMLElement>(".field");
  const groups = [...root.querySelectorAll<HTMLElement>("[data-group]")];
  const railBtns = [...root.querySelectorAll<HTMLButtonElement>("[data-cat]")];
  const select = root.querySelector<HTMLSelectElement>("[data-cat-select]");
  const countEl = root.querySelector<HTMLElement>("[data-count]");
  const resetBtns = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-reset]"),
    ...root.querySelectorAll<HTMLButtonElement>("[data-reset-empty]"),
  ];
  const emptyEl = root.querySelector<HTMLElement>("[data-empty]");

  const catIds = new Set(groups.map((g) => g.dataset.group!));

  let state: { cat: string; q: string } = { cat: "all", q: "" };

  function readUrl() {
    const p = new URLSearchParams(location.search);
    const c = p.get("category") ?? "all";
    const valid = c === "all" || catIds.has(c);
    state = { cat: valid ? c : "all", q: (p.get("q") ?? "").trim() };
  }

  function writeUrl() {
    const p = new URLSearchParams(location.search);
    if (state.cat === "all") p.delete("category");
    else p.set("category", state.cat);
    if (state.q) p.set("q", state.q);
    else p.delete("q");
    const qs = p.toString();
    history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
  }

  function matched(): Map<string, { name: string; base: string; aliases: string[] }[]> {
    const nq = normalize(state.q);
    const out = new Map<string, { name: string; base: string; aliases: string[] }[]>();

    for (const g of groups) {
      const id = g.dataset.group!;
      if (state.cat !== "all" && state.cat !== id) continue;

      const items = [...g.querySelectorAll<HTMLAnchorElement>(".chain")].map((a) => ({
        name: a.dataset.name ?? a.textContent ?? "",
        base: a.dataset.base ?? "",
        aliases: (a.dataset.alias ?? "").split(" ").filter(Boolean),
      }));

      const hits = nq
        ? items.filter((it) => normalize(`${it.name} ${it.aliases.join(" ")} 链条`).includes(nq))
        : items;

      if (hits.length) out.set(id, hits);
    }
    return out;
  }

  function render() {
    const hits = matched();
    const total = [...hits.values()].reduce((n, a) => n + a.length, 0);
    const filtering = Boolean(state.q) || state.cat !== "all";

    for (const g of groups) {
      const id = g.dataset.group!;
      const chains = hits.get(id) ?? [];
      g.hidden = chains.length === 0;
      if (!chains.length) continue;

      const open = Boolean(state.q) || state.cat !== "all";
      g.dataset.open = String(open);

      const toggle = g.querySelector<HTMLButtonElement>(".group-toggle");
      if (toggle) {
        toggle.disabled = open;
        toggle.setAttribute("aria-expanded", String(open));
      }
      const n = g.querySelector<HTMLElement>(".group-n");
      if (n) n.textContent = String(chains.length);

      const list = g.querySelector<HTMLElement>(".chain-list");
      if (list) {
        const key = `${chains.map((c) => c.name).join("|")}::${state.q}`;
        if (list.dataset.rendered !== key) {
          list.replaceChildren(
            ...chains.map((c) => {
              const li = document.createElement("li");
              const a = document.createElement("a");
              a.className = "chain";
              a.href = `./catalog.html?category=${encodeURIComponent(id)}&q=${encodeURIComponent(c.base)}`;
              a.dataset.name = c.name;
              a.dataset.base = c.base;
              a.dataset.alias = c.aliases.join(" ");
              a.append(...highlightNodes(c.name, state.q));
              li.append(a);
              return li;
            })
          );
          list.dataset.rendered = key;
        }
      }
    }

    if (countEl) {
      countEl.replaceChildren("共 ", Object.assign(document.createElement("b"), { textContent: String(total) }), " 条链条");
    }
    if (emptyEl) emptyEl.hidden = total > 0;
    for (const b of resetBtns) b.hidden = !filtering;

    for (const btn of railBtns) btn.setAttribute("aria-current", String(btn.dataset.cat === state.cat));
    if (select) select.value = state.cat;
    if (field) field.dataset.filled = String(Boolean(state.q));
    if (search && search.value !== state.q) search.value = state.q;
  }

  function setState(patch: Partial<{ cat: string; q: string }>, opts: { focusSearch?: boolean } = {}) {
    state = { ...state, ...patch };
    writeUrl();
    render();
    if (opts.focusSearch) search?.focus();
  }

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

  for (const btn of railBtns) {
    btn.addEventListener("click", () => setState({ cat: btn.dataset.cat! }));
  }
  select?.addEventListener("change", () => setState({ cat: select.value }));

  for (const g of groups) {
    g.querySelector(".group-toggle")?.addEventListener("click", (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      if (btn.disabled) return;
      g.dataset.open = g.dataset.open === "true" ? "false" : "true";
      btn.setAttribute("aria-expanded", g.dataset.open);
    });
  }

  for (const b of resetBtns) {
    b.addEventListener("click", () => {
      setState({ cat: "all", q: "" }, { focusSearch: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  readUrl();
  render();
  window.addEventListener("popstate", () => {
    readUrl();
    render();
  });
}
