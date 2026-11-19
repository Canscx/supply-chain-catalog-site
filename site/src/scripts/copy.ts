const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-copy-value]")];
const toast = document.querySelector<HTMLElement>("[data-copy-toast]");
let toastTimer = 0;

function announce(message: string) {
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.visible = "true";
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.dataset.visible = "false";
  }, 1800);
}

function legacyCopy(value: string): boolean {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
  document.body.append(area);
  area.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  area.remove();
  active?.focus({ preventScroll: true });
  return copied;
}

async function writeClipboard(value: string) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  if (!legacyCopy(value)) throw new Error("copy failed");
}

for (const button of buttons) {
  const originalLabel = button.getAttribute("aria-label") ?? "";
  let resetTimer = 0;

  button.addEventListener("click", async () => {
    const value = button.dataset.copyValue ?? "";
    const kind = button.dataset.copyKind ?? "内容";
    if (!value) return;

    try {
      await writeClipboard(value);
      button.dataset.copied = "true";
      button.setAttribute("aria-label", `已复制${kind}：${value}`);
      announce(`${kind}已复制`);

      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        delete button.dataset.copied;
        button.setAttribute("aria-label", originalLabel);
      }, 1600);
    } catch {
      announce("复制失败，请手动选择文本");
    }
  });
}