import "./index.css";
import { consentKey, hasConsent } from "./consent.js";
const status = document.querySelector("#status");
async function refresh() {
  const granted = hasConsent(
    (await chrome.storage.local.get(consentKey))[consentKey],
  );
  document.querySelector("#allow").hidden = granted;
  document.querySelector("#deny").hidden = granted;
  document.querySelector("#revoke").hidden = !granted;
  status.textContent = granted
    ? "已启用。回到 DeepSeek 页面，刷新后即可导出。"
    : "尚未启用。插件不会读取或暂存对话内容。";
}
for (const id of ["allow", "deny", "revoke"])
  document.getElementById(id).onclick = async () => {
    document.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      const response = await chrome.runtime.sendMessage({
        type: "SET_CONSENT",
        granted: id === "allow",
      });
      if (!response?.success)
        throw new Error(response?.error || "设置未保存，请重试");
      await refresh();
      if (id !== "allow")
        status.textContent =
          "已停止读取并清理缓存。需要导出时，可在这里重新同意。";
    } catch (error) {
      status.textContent = "没有完成：" + error.message;
    } finally {
      document.querySelectorAll("button").forEach((b) => (b.disabled = false));
    }
  };
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[consentKey]) refresh();
});
refresh();
