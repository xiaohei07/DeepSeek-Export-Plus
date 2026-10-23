import { openExportDialog, syncTheme } from "./dialog.js";
import { resolveComposerAnchor } from "./selectors.js";

export function createButtons() {
  const existing = document.getElementById("ai-exporter-buttons");
  if (existing) return placeButtons(existing);
  const container = document.createElement("div");
  container.id = "ai-exporter-buttons";
  container.dataset.route = location.pathname;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ai-exporter-btn";
  button.id = "export-conversation-btn";
  button.setAttribute("aria-label", "导出对话");
  button.innerHTML = `<img src="${chrome.runtime.getURL("icons/fish-48.png")}" alt="">导出`;
  button.onclick = () => openExportDialog();
  const files = document.createElement("button");
  files.type = "button";
  files.className = "ai-exporter-btn";
  files.id = "export-files-btn";
  files.textContent = "附件";
  files.setAttribute("aria-label", "导出对话内文件");
  files.onclick = () => openExportDialog("files");
  container.append(button, files);
  return placeButtons(container);
}

function placeButtons(container) {
  container.dataset.route = location.pathname;
  syncTheme(container);
  try {
    const anchor = resolveComposerAnchor();
    if (anchor) {
      container.classList.remove("dsx-floating");
      if (
        container.parentElement !== anchor.root ||
        container.nextElementSibling !== anchor.before
      )
        anchor.root.insertBefore(container, anchor.before);
      if (container.getBoundingClientRect().height) return true;
    }
  } catch {
    /* Compact floating fallback is available on every route. */
  }
  container.classList.add("dsx-floating");
  let bounds = [...document.querySelectorAll(".ds-message")]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 250 && r.right > 0 && r.right <= innerWidth);
  if (!bounds.length)
    bounds = [...document.querySelectorAll('main, [role="main"]')]
      .map((el) => el.getBoundingClientRect())
      .filter(
        (r) =>
          r.width > 250 &&
          r.width < innerWidth - 32 &&
          r.right > 0 &&
          r.right <= innerWidth,
      );
  const right = bounds.length
    ? Math.max(16, innerWidth - Math.max(...bounds.map((r) => r.right)))
    : 20;
  container.style.setProperty("--dsx-floating-right", right + "px");
  if (container.parentElement !== document.body)
    document.body.append(container);
  return true;
}
