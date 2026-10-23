import { createButtons } from "./ui.js";
import { syncTheme } from "./dialog.js";
function init() {
  let layoutFrame, composer;
  const update = () => {
    const nextComposer = createButtons();
    if (nextComposer !== composer) {
      geometry.disconnect();
      composer = nextComposer;
      if (composer) geometry.observe(composer);
    }
  };
  const schedule = () => {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(update);
  };
  const geometry = new ResizeObserver(schedule);
  update();
  const theme = new MutationObserver(() => {
    const host = document.getElementById("ai-exporter-buttons");
    if (host) syncTheme(host);
  });
  for (const el of [document.documentElement, document.body])
    theme.observe(el, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
  // Avoid observing every token in a streaming answer; skip hidden tabs.
  const timer = setInterval(() => {
    if (!document.hidden) update();
  }, 1500);
  addEventListener("resize", schedule);
  addEventListener("scroll", schedule, { capture: true, passive: true });
  document.addEventListener("input", schedule, true);
  document.addEventListener("visibilitychange", schedule);
  addEventListener(
    "pagehide",
    () => {
      clearInterval(timer);
      cancelAnimationFrame(layoutFrame);
      removeEventListener("resize", schedule);
      removeEventListener("scroll", schedule, true);
      document.removeEventListener("input", schedule, true);
      document.removeEventListener("visibilitychange", schedule);
      geometry.disconnect();
      theme.disconnect();
    },
    { once: true },
  );
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
