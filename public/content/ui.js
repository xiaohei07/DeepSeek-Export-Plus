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
    const anchor = resolveComposerAnchor(
      container.getBoundingClientRect().width || 164,
    );
    if (anchor?.root) {
      container.classList.remove("dsx-page-toolbar");
      container.classList.toggle("dsx-separate-row", !!anchor.separateRow);
      if (
        container.parentElement !== anchor.root ||
        container.nextElementSibling !== anchor.before
      )
        anchor.root.insertBefore(container, anchor.before);
      if (container.getBoundingClientRect().height) return true;
    }
  } catch {
    /* A normal document row is safer than covering the page's own controls. */
  }
  container.classList.remove("dsx-separate-row");
  container.classList.add("dsx-page-toolbar");
  const column = document.querySelector('main, [role="main"]') || document.body;
  if (
    container.parentElement !== column ||
    column.firstElementChild !== container
  )
    column.prepend(container);
  return true;
}
