(() => {
  const preview = document.querySelector("[data-hero-prototype]");
  const variantPanels = [...preview.querySelectorAll("[data-hp-variant]")];
  const switcher = preview.querySelector("[data-hp-switch]");
  const variantLabel = preview.querySelector("[data-hp-variant-label]");
  const readVariant = () => new URLSearchParams(location.search).get("variant");
  let activeVariant = 0;
  let blueprintOpened = false;

  function showVariant(id) {
    const index = variantPanels.findIndex((panel) => panel.dataset.hpVariant === id);
    activeVariant = Math.max(0, index);
    variantPanels.forEach((panel, position) => { panel.hidden = position !== activeVariant; });

    const panel = variantPanels[activeVariant];
    variantLabel.textContent = `${panel.dataset.hpVariant.toUpperCase()} · ${panel.dataset.name}`;
    if (panel.dataset.hpVariant === "b") {
      panel.classList.toggle("hp-draw", !blueprintOpened);
      blueprintOpened = true;
    }
  }

  function stepVariant(step) {
    const nextIndex = (activeVariant + step + variantPanels.length) % variantPanels.length;
    const id = variantPanels[nextIndex].dataset.hpVariant;
    const url = new URL(location.href);
    url.searchParams.set("variant", id);
    history.replaceState(history.state, "", url);
    showVariant(id);
  }

  switcher.querySelectorAll("[data-hp-variant-step]").forEach((button) => {
    button.addEventListener("click", () => stepVariant(Number(button.dataset.hpVariantStep)));
  });
  switcher.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    stepVariant(event.key === "ArrowLeft" ? -1 : 1);
  });
  window.addEventListener("popstate", () => showVariant(readVariant()));
  showVariant(readVariant());
  switcher.hidden = false;

  const nodes = [...preview.querySelectorAll("[data-hp-node]")];
  const details = [...preview.querySelectorAll("[data-hp-details]")];
  nodes.forEach((button) => {
    button.addEventListener("click", () => {
      nodes.forEach((node) => node.setAttribute("aria-pressed", String(node === button)));
      details.forEach((detail) => { detail.hidden = detail.dataset.hpDetails !== button.dataset.hpNode; });
    });
  });

  const sheets = [...preview.querySelectorAll("[data-hp-sheet]")];
  const pageNumber = preview.querySelector("[data-hp-page-number]");
  let page = 0;
  preview.querySelectorAll("[data-hp-page-step]").forEach((button) => {
    button.addEventListener("click", () => {
      if (sheets.length < 2) return;
      sheets[page].hidden = true;
      page = (page + Number(button.dataset.hpPageStep) + sheets.length) % sheets.length;
      sheets[page].hidden = false;
      pageNumber.textContent = `${page + 1} / ${sheets.length}`;
      pageNumber.setAttribute("aria-label", `第 ${page + 1} 页，共 ${sheets.length} 页`);
    });
  });
})();
