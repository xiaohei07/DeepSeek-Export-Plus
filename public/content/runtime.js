export const refreshMessage = "扩展已更新或重新加载，请刷新当前页面后再导出。";
let invalidated = false;
const cleanup = new Set();

export function runtimeAvailable() {
  try {
    return !invalidated && !!globalThis.chrome?.runtime?.id;
  } catch {
    return false;
  }
}

export function isContextInvalidated(error) {
  return (
    /extension context invalidated/i.test(String(error?.message || error)) ||
    !runtimeAvailable()
  );
}

export function onContextInvalidated(callback) {
  cleanup.add(callback);
  return () => cleanup.delete(callback);
}

function notice(message) {
  if (document.getElementById("dsx-runtime-notice")) return;
  const host = document.createElement("div");
  host.id = "dsx-runtime-notice";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>:host{color-scheme:light dark}dialog{box-sizing:border-box;max-width:min(420px,90vw);padding:24px;border:1px solid GrayText;border-radius:16px;background:Canvas;color:CanvasText;font:16px/1.7 system-ui,"Microsoft YaHei",sans-serif}dialog::backdrop{background:#0005}p{margin:0 0 18px}nav{display:flex;gap:12px;justify-content:flex-end}button{font:inherit;padding:6px 14px;border:1px solid GrayText;border-radius:8px;background:Canvas;color:CanvasText;cursor:pointer}</style><dialog aria-label="DeepSeek 导出提示"><p role="alert"></p><nav><button id="later">关闭</button><button id="refresh">刷新页面</button></nav></dialog>`;
  root.querySelector("p").textContent = message;
  document.body.append(host);
  const dialog = root.querySelector("dialog");
  root.querySelector("#later").onclick = () => dialog.close();
  root.querySelector("#refresh").onclick = () => location.reload();
  dialog.addEventListener("close", () => host.remove(), { once: true });
  dialog.showModal();
}

export function handleContextInvalidation() {
  if (!invalidated) {
    invalidated = true;
    for (const callback of cleanup) {
      try {
        callback();
      } catch {
        /* The old extension API may already be gone. */
      }
    }
    cleanup.clear();
  }
  notice(refreshMessage);
}

// Catch synchronous API throws as well as rejected promises at UI boundaries.
export async function runExtensionAction(action, onError) {
  try {
    if (!runtimeAvailable()) return handleContextInvalidation();
    return await action();
  } catch (error) {
    if (isContextInvalidated(error)) handleContextInvalidation();
    else if (onError) onError(error);
    else
      notice("没有完成：" + (error?.message || String(error)) + "。请重试。");
  }
}
