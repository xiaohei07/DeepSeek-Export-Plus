import { createButtons } from "./ui.js";
import { syncTheme } from "./dialog.js";
import { NATIVE_DIALOG_SELECTOR, isOwnUI } from "./selectors.js";
import {
  runtimeAvailable,
  handleContextInvalidation,
  onContextInvalidated,
} from "./runtime.js";
function init() {
  if (!runtimeAvailable()) {
    handleContextInvalidation();
    return;
  }
  let layoutFrame, composer;
  const update = () => {
    if (!runtimeAvailable()) {
      handleContextInvalidation();
      return;
    }
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
  // React can replace the input or mount a share dialog without resizing the
  // existing composer. Filter structural changes so streaming text stays cheap.
  const structural = `textarea, [contenteditable="true"], ${NATIVE_DIALOG_SELECTOR}`;
  const affectsLayout = (el) =>
    el.nodeType === 1 &&
    !isOwnUI(el) &&
    (el.matches(structural) || !!el.querySelector(structural));
  const structure = new MutationObserver((records) => {
    if (
      records.some((r) =>
        r.type === "childList"
          ? [...r.addedNodes, ...r.removedNodes].some(affectsLayout)
          : !isOwnUI(r.target) &&
            (r.target.matches(structural) ||
              (composer && r.target.contains(composer))),
      )
    )
      schedule();
  });
  structure.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style", "class", "hidden", "aria-hidden", "open"],
  });
  // Avoid observing every token in a streaming answer; skip hidden tabs.
  const timer = setInterval(() => {
    if (!document.hidden) update();
  }, 1500);
  addEventListener("resize", schedule);
  addEventListener("scroll", schedule, { capture: true, passive: true });
  document.addEventListener("input", schedule, true);
  document.addEventListener("visibilitychange", schedule);
  const dispose = () => {
    clearInterval(timer);
    cancelAnimationFrame(layoutFrame);
    removeEventListener("resize", schedule);
    removeEventListener("scroll", schedule, true);
    document.removeEventListener("input", schedule, true);
    document.removeEventListener("visibilitychange", schedule);
    geometry.disconnect();
    theme.disconnect();
    structure.disconnect();
  };
  onContextInvalidated(dispose);
  addEventListener("pagehide", dispose, { once: true });
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
