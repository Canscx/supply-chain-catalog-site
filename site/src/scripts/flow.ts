type RoutePoint = { x: number; y: number; distance: number };

function initFlow(map: HTMLElement) {
  const motion = map.querySelector<HTMLElement>(".flow-motion");
  const desktopTrack = map.querySelector<SVGSVGElement>(".flow-track--desktop");
  const mobileTrack = map.querySelector<SVGSVGElement>(".flow-track--mobile");
  if (!motion || !desktopTrack || !mobileTrack) return;

  const steps = Array.from(map.querySelectorAll<HTMLElement>(".flow-step"));
  const desktop = window.matchMedia("(min-width: 740px)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const particles = [
    { size: 2, opacity: 0.15 },
    { size: 2, opacity: 0.24 },
    { size: 2.5, opacity: 0.34 },
    { size: 3, opacity: 0.48 },
    { size: 4, opacity: 0.68 },
    { size: 6, opacity: 1 },
  ].map(({ size, opacity }) => {
    const element = document.createElement("span");
    element.className = "flow-spark";
    element.style.width = `${size}px`;
    element.style.height = `${size}px`;
    motion.append(element);
    return { element, size, opacity };
  });

  function measureRoute(track: SVGSVGElement | null) {
    if (!track) return;
    const path = track.querySelector<SVGPathElement>(".flow-line");
    const matrix = track.getScreenCTM();
    if (!path || !matrix) return;

    const bounds = map.getBoundingClientRect();
    const pathLength = path.getTotalLength();
    const samples: RoutePoint[] = [];
    let distance = 0;
    // 按屏幕上的轨迹长度采样，使光点经过拉伸后的折返段时仍保持匀速。
    for (let index = 0; index <= 256; index++) {
      const point = path.getPointAtLength(pathLength * index / 256).matrixTransform(matrix);
      const x = point.x - bounds.left;
      const y = point.y - bounds.top;
      const previous = samples.at(-1);
      if (previous) distance += Math.hypot(x - previous.x, y - previous.y);
      samples.push({ x, y, distance });
    }
    const nodes = steps.flatMap((step) => {
      const number = step.querySelector(".flow-num")?.getBoundingClientRect();
      if (!number) return [];
      return [{ step, x: number.left + number.width / 2 - bounds.left, y: number.top + number.height / 2 - bounds.top }];
    });
    return { samples, distance, nodes };
  }

  function pointAt(samples: RoutePoint[], distance: number) {
    let low = 0;
    let high = samples.length - 1;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (samples[middle].distance < distance) low = middle;
      else high = middle;
    }
    const from = samples[low];
    const to = samples[high];
    const mix = (distance - from.distance) / (to.distance - from.distance);
    return { x: from.x + (to.x - from.x) * mix, y: from.y + (to.y - from.y) * mix };
  }

  let route: ReturnType<typeof measureRoute>;
  let animationFrame = 0;
  let loopStart = 0;
  let passing: HTMLElement | undefined;
  let inView = !("IntersectionObserver" in window);

  function markPassing(step?: HTMLElement) {
    if (step === passing) return;
    passing?.classList.remove("is-passing");
    passing = step;
    passing?.classList.add("is-passing");
  }

  function draw(now: number) {
    if (!route?.distance) return;
    const cycle = desktop.matches ? 9000 : 6400;
    const elapsed = (now - loopStart) % cycle;
    const distance = Math.min(elapsed / (cycle - 290), 1) * route.distance;
    const fade = Math.min(elapsed / 190, (cycle - elapsed) / 290, 1);
    const spacing = desktop.matches ? 6 : 4;
    const samples = route.samples;
    particles.forEach(({ element, size, opacity }, index) => {
      const offset = distance - (particles.length - 1 - index) * spacing;
      const { x, y } = pointAt(samples, Math.max(0, offset));
      element.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`;
      element.style.opacity = String(offset < 0 ? 0 : opacity * fade);
    });
    const head = pointAt(samples, distance);
    const node = route.nodes.find(({ x, y }) => Math.hypot(head.x - x, head.y - y) < 22);
    markPassing(fade > 0.25 ? node?.step : undefined);
    animationFrame = requestAnimationFrame(draw);
  }

  function syncMotion() {
    cancelAnimationFrame(animationFrame);
    markPassing();
    particles.forEach(({ element }) => { element.style.opacity = "0"; });
    if (!inView || reducedMotion.matches) return;

    animationFrame = requestAnimationFrame((now) => {
      route = measureRoute(desktop.matches ? desktopTrack : mobileTrack);
      loopStart = now;
      draw(now);
    });
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      if (inView && !reducedMotion.matches) route = measureRoute(desktop.matches ? desktopTrack : mobileTrack);
    }).observe(map);
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncMotion();
    }).observe(map);
  }
  desktop.addEventListener("change", syncMotion);
  reducedMotion.addEventListener("change", syncMotion);
  syncMotion();
}

document.querySelectorAll<HTMLElement>("[data-flow-map]").forEach(initFlow);
