const THEME_KEY = "supply-chain-theme";

const root = document.documentElement;
const btn = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");

if (btn) {
  const sync = () => {
    const dark = root.getAttribute("data-theme") === "dark";
    btn.setAttribute("aria-pressed", String(dark));
    btn.setAttribute("aria-label", dark ? "切换到浅色模式" : "切换到深色模式");
  };

  sync();

  btn.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* 存储不可用时仅当页生效 */
    }
    sync();
  });
}
