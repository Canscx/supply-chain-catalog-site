type ConsultField =
  | "company"
  | "categories"
  | "custom_chain"
  | "demand"
  | "invoice"
  | "contact"
  | "phone"
  | "agree";

const dialog = document.querySelector<HTMLDialogElement>("#consult-dialog");
const form = document.querySelector<HTMLFormElement>("[data-consult-form]");

if (dialog && form) {
  const openers = Array.from(document.querySelectorAll<HTMLElement>("[data-consult-open]"));
  const closeButtons = Array.from(document.querySelectorAll<HTMLElement>("[data-consult-close]"));
  const companyInput = form.querySelector<HTMLInputElement>("#consult-company");
  const categoriesInput = form.querySelector<HTMLInputElement>("#consult-categories");
  const customToggle = form.querySelector<HTMLButtonElement>("[data-consult-custom-toggle]");
  const customBox = form.querySelector<HTMLElement>("[data-consult-custom]");
  const customTextarea = form.querySelector<HTMLTextAreaElement>("#consult-custom-chain");
  const demandInput = form.querySelector<HTMLInputElement>("#consult-demand");
  const invoiceInput = form.querySelector<HTMLInputElement>("#consult-invoice");
  const contactInput = form.querySelector<HTMLInputElement>("#consult-contact");
  const phoneInput = form.querySelector<HTMLInputElement>("#consult-phone");
  const agreeInput = form.querySelector<HTMLInputElement>("#consult-agree");
  const submitButton = form.querySelector<HTMLButtonElement>("[data-consult-submit]");
  const successPanel = document.querySelector<HTMLElement>("[data-consult-success]");
  const globalError = document.querySelector<HTMLElement>("[data-consult-error]");
  const honeypot = form.querySelector<HTMLInputElement>("#consult-website");
  const chips = Array.from(form.querySelectorAll<HTMLButtonElement>("[data-consult-chip]"));

  if (
    !companyInput ||
    !categoriesInput ||
    !customToggle ||
    !customBox ||
    !customTextarea ||
    !demandInput ||
    !invoiceInput ||
    !contactInput ||
    !phoneInput ||
    !agreeInput ||
    !submitButton ||
    !successPanel ||
    !globalError ||
    !honeypot
  ) {
    // 页面结构不完整时不绑定任何行为，避免半套交互。
  } else {
    let lastTrigger: HTMLElement | null = null;
    let customActive = false;
    let submitting = false;

    const splitCategories = (value: string): string[] =>
      value
        .split(/[、,，\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);

    const syncChips = (): void => {
      const selected = splitCategories(categoriesInput.value);
      chips.forEach((chip) => {
        const value = chip.dataset.consultChip || "";
        chip.setAttribute("aria-pressed", selected.includes(value) ? "true" : "false");
      });
    };

    const setCategories = (values: string[]): void => {
      const unique: string[] = [];
      values.forEach((value) => {
        if (value && !unique.includes(value)) unique.push(value);
      });
      categoriesInput.value = unique.join("、");
      syncChips();
    };

    const fieldWrap = (name: string): HTMLElement | null =>
      form.querySelector<HTMLElement>('[data-field="' + name + '"]');

    const fieldError = (name: string): HTMLElement | null =>
      form.querySelector<HTMLElement>('[data-error-for="' + name + '"]');

    const fieldInput = (name: string): HTMLInputElement | HTMLTextAreaElement | null => {
      if (name === "categories") return categoriesInput;
      if (name === "custom_chain") return customTextarea;
      if (name === "agree") return agreeInput;
      return form.elements.namedItem(name) as HTMLInputElement | null;
    };

    const clearFieldError = (name: string): void => {
      const error = fieldError(name);
      if (error) {
        error.textContent = "";
        error.hidden = true;
      }
      fieldWrap(name)?.classList.remove("consult-field--invalid");
      fieldInput(name)?.removeAttribute("aria-invalid");
      fieldInput(name)?.removeAttribute("aria-describedby");
    };

    const showFieldError = (name: string, message: string): void => {
      const error = fieldError(name);
      if (error) {
        if (!error.id) error.id = "consult-error-" + name;
        error.textContent = message;
        error.hidden = false;
        fieldInput(name)?.setAttribute("aria-describedby", error.id);
      }
      fieldWrap(name)?.classList.add("consult-field--invalid");
      fieldInput(name)?.setAttribute("aria-invalid", "true");
    };

    const clearGlobalError = (): void => {
      globalError.textContent = "";
      globalError.hidden = true;
    };

    const showGlobalError = (message: string): void => {
      globalError.textContent = message;
      globalError.hidden = false;
    };

    const clearAllErrors = (): void => {
      form.querySelectorAll<HTMLElement>("[data-error-for]").forEach((error) => {
        error.textContent = "";
        error.hidden = true;
      });
      form.querySelectorAll<HTMLElement>(".consult-field--invalid").forEach((field) => {
        field.classList.remove("consult-field--invalid");
      });
      form.querySelectorAll<HTMLElement>("[aria-invalid]").forEach((field) => {
        field.removeAttribute("aria-invalid");
        field.removeAttribute("aria-describedby");
      });
      clearGlobalError();
    };

    const resetForm = (): void => {
      form.reset();
      customActive = false;
      customToggle.setAttribute("aria-pressed", "false");
      customBox.hidden = true;
      chips.forEach((chip) => chip.setAttribute("aria-pressed", "false"));
      form.hidden = false;
      successPanel.hidden = true;
      clearAllErrors();
    };

    const openDialog = (event: Event): void => {
      event.preventDefault();
      lastTrigger = event.currentTarget as HTMLElement | null;
      if (!dialog.open) {
        resetForm();
        if (typeof dialog.showModal === "function") {
          dialog.showModal();
        } else {
          dialog.setAttribute("open", "");
        }
      }
      document.body.classList.add("consult-open");
      window.setTimeout(() => companyInput.focus(), 30);
    };

    const closeDialog = (): void => {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
      document.body.classList.remove("consult-open");
      lastTrigger?.focus();
    };

    const showSuccess = (): void => {
      form.hidden = true;
      successPanel.hidden = false;
      dialog.scrollTop = 0;
      const panel = dialog.querySelector<HTMLElement>(".consult-panel");
      if (panel) panel.scrollTop = 0;
    };

    openers.forEach((opener) => opener.addEventListener("click", openDialog));
    closeButtons.forEach((button) => button.addEventListener("click", closeDialog));

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    });

    dialog.addEventListener("close", () => {
      document.body.classList.remove("consult-open");
    });

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const value = chip.dataset.consultChip || "";
        const selected = splitCategories(categoriesInput.value);
        const index = selected.indexOf(value);
        if (index === -1) {
          selected.push(value);
        } else {
          selected.splice(index, 1);
        }
        setCategories(selected);
        clearFieldError("categories");
        categoriesInput.focus();
      });
    });

    categoriesInput.addEventListener("input", () => {
      syncChips();
      clearFieldError("categories");
    });

    customToggle.addEventListener("click", () => {
      customActive = !customActive;
      customToggle.setAttribute("aria-pressed", customActive ? "true" : "false");
      customBox.hidden = !customActive;
      if (customActive) {
        clearFieldError("custom_chain");
        window.setTimeout(() => customTextarea.focus(), 20);
      } else {
        clearFieldError("custom_chain");
      }
    });

    customTextarea.addEventListener("input", () => clearFieldError("custom_chain"));

    [companyInput, demandInput, invoiceInput, contactInput, phoneInput].forEach((input) => {
      input.addEventListener("input", () => {
        clearFieldError(input.name);
        clearGlobalError();
      });
    });

    agreeInput.addEventListener("change", () => {
      clearFieldError("agree");
      clearGlobalError();
    });

    const getSource = (): string => {
      const file = window.location.pathname.split("/").pop() || "index.html";
      return file === "catalog.html" ? "catalog.html" : "index.html";
    };

    const makeRequestId = (): string => {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
      return "req-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
    };

    const validate = (): Record<string, unknown> | null => {
      clearAllErrors();

      const company = companyInput.value.trim();
      const contact = contactInput.value.trim();
      const phone = phoneInput.value.replace(/[\s-]+/g, "");
      const categories = categoriesInput.value.trim();
      const custom = customActive ? customTextarea.value.trim() : "";
      const demand = demandInput.value.trim();
      const invoice = invoiceInput.value.trim();
      const errors: Partial<Record<ConsultField, string>> = {};

      if (company.length < 2) errors.company = "请填写公司名字（2–60 字）";
      if (contact === "") errors.contact = "请填写联系人";
      if (!/^1[3-9]\d{9}$/.test(phone)) errors.phone = "请输入正确的 11 位手机号码";
      if (categories === "" && custom === "") errors.categories = "请选择或填写供应链品类";
      if (customActive && custom === "") errors.custom_chain = "请描述你想要的链条";
      if (!/^\d+(\.\d{1,2})?$/.test(demand) || Number(demand) <= 0) {
        errors.demand = "请填写大于 0 的数字金额";
      }
      if (invoice === "") errors.invoice = "请填写目前发票额度";
      if (!agreeInput.checked) errors.agree = "请先勾选同意声明";

      const names = Object.keys(errors) as ConsultField[];
      if (names.length > 0) {
        names.forEach((name) => showFieldError(name, errors[name] as string));
        showGlobalError("请检查标红的字段。");
        fieldInput(names[0])?.focus();
        return null;
      }

      return {
        company,
        contact,
        phone,
        categories,
        custom_chain: custom,
        custom_requested: customActive,
        demand,
        invoice,
        agree: true,
        source: getSource(),
        request_id: makeRequestId(),
        website: honeypot.value,
      };
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitting) return;

      const payload = validate();
      if (!payload) return;

      submitting = true;
      submitButton.disabled = true;
      const originalLabel = submitButton.textContent || "提交需求";
      submitButton.textContent = "提交中…";

      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch("api/consult.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          fields?: Record<string, string>;
          message?: string;
        };

        if (!response.ok || !data.ok) {
          if (data.fields && typeof data.fields === "object") {
            const names = Object.keys(data.fields);
            names.forEach((name) => showFieldError(name, String(data.fields?.[name] ?? "请检查此项")));
            showGlobalError("请检查标红的字段。");
            if (names[0]) fieldInput(names[0])?.focus();
          } else {
            showGlobalError(data.message || "提交失败，请稍后重试。");
          }
          return;
        }

        showSuccess();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          showGlobalError("提交超时，请稍后重试。");
        } else {
          showGlobalError("网络异常，请检查网络后重试。");
        }
      } finally {
        window.clearTimeout(timer);
        submitting = false;
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
    });

    resetForm();
  }
}
