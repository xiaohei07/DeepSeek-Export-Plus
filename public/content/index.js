import { createButtons } from "./ui.js";
import { syncTheme } from "./dialog.js";
function init() {
  createButtons();
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
    if (!document.hidden) createButtons();
  }, 1500);
  let layoutFrame;
  const resize = () => {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(createButtons);
  };
  addEventListener("resize", resize);
  addEventListener(
    "pagehide",
    () => {
      clearInterval(timer);
      cancelAnimationFrame(layoutFrame);
      removeEventListener("resize", resize);
      theme.disconnect();
    },
    { once: true },
  );
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
