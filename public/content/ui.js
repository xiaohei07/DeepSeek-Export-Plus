import { openExportDialog, syncTheme } from "./dialog.js";
import { resolveComposerAnchor, hasNativeDialog } from "./selectors.js";

export function createButtons() {
  const existing = document.getElementById("ai-exporter-buttons");
  if (existing) return placeButtons(existing);
  const container = document.createElement("div");
  container.id = "ai-exporter-buttons";
  container.className = "dsx-positioned-toolbar";
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", "DeepSeek 导出工具");
  container.dataset.route = location.pathname;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ai-exporter-btn";
  button.id = "export-conversation-btn";
  button.setAttribute("aria-label", "导出对话");
  button.title = "导出对话";
  button.innerHTML = `<img src="${chrome.runtime.getURL("icons/fish-48.png")}" alt=""><span>导出</span>`;
  button.onclick = () => openExportDialog();
  const files = document.createElement("button");
  files.type = "button";
  files.className = "ai-exporter-btn";
  files.id = "export-files-btn";
  files.innerHTML = `<svg class="dsx-file-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 12v4a4 4 0 0 0 8 0V7a3 3 0 0 0-6 0v9a1 1 0 0 0 2 0V8"/></svg><span>附件</span>`;
  files.setAttribute("aria-label", "导出对话内文件");
  files.title = "导出对话内文件";
  files.onclick = () => openExportDialog("files");
  container.append(button, files);
  document.body.append(container);
  return placeButtons(container);
}

function placeButtons(container) {
  container.dataset.route = location.pathname;
  syncTheme(container);
  // A native share/settings dialog is not the conversation composer. Keep our
  // floating controls out of its way, then restore the normal row after closing.
  container.style.visibility = hasNativeDialog() ? "hidden" : "visible";
  container.classList.remove("dsx-side-toolbar");
  let composer;
  try {
    const size = container.getBoundingClientRect();
    const anchor = resolveComposerAnchor(size.width || 164, size.height || 36);
    composer = anchor?.composer;
    if (anchor && anchor.mode !== "dock") {
      container.classList.add("dsx-positioned-toolbar");
      container.classList.toggle("dsx-side-toolbar", anchor.mode === "side");
      container.dataset.placement = anchor.mode;
      container.style.left = anchor.x + "px";
      container.style.top = anchor.y + "px";
      if (container.parentElement !== document.body)
        document.body.append(container);
      return composer;
    }
  } catch {
    /* Keep a small independent dock when the site's composer is unavailable. */
  }
  // Refresh, SPA replacement and read-only share pages may have no composer.
  // Never prepend into the site's layout (the previous top-right fallback).
  container.classList.add("dsx-positioned-toolbar", "dsx-side-toolbar");
  container.dataset.placement = "dock";
  container.style.left = "8px";
  container.style.top =
    Math.max(8, Math.min(innerHeight * 0.6, innerHeight - 76)) + "px";
  if (container.parentElement !== document.body)
    document.body.append(container);
  return composer;
}
