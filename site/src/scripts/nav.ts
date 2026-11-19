const nav = document.querySelector(".nav");

if (nav) {
  let ticking = false;

  const update = () => {
    nav.setAttribute("data-scrolled", String(window.scrollY > 4));
    ticking = false;
  };

  update();
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
}
