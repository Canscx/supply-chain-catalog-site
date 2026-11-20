/**
 * 滚动显现：进入视口的元素从下方淡入。
 * 只使用 IntersectionObserver，不依赖第三方动画库。
 */
document.documentElement.classList.add("js");

const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

if (targets.length) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const showAll = () => targets.forEach((el) => el.classList.add("is-revealed"));

  if (reduced.matches || !("IntersectionObserver" in window)) {
    showAll();
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    targets.forEach((el) => observer.observe(el));

    reduced.addEventListener?.("change", (event) => {
      if (!event.matches) return;
      observer.disconnect();
      showAll();
    });
  }
}
