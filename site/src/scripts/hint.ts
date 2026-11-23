/**
 * 首屏下滑提示：进入增量品类明细后淡出，回到首屏附近再出现。
 * 纯锚点可用，脚本只负责显隐，不接管跳转。
 */
const hint = document.querySelector<HTMLElement>("[data-scroll-hint]");
const scope = document.getElementById("scope");

if (hint && scope) {
  let ticking = false;

  const update = () => {
    ticking = false;
    const top = scope.getBoundingClientRect().top;
    hint.classList.toggle("is-hidden", top < window.innerHeight * 0.8);
  };

  const schedule = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
}
