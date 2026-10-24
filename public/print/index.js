import { renderMarkdown } from "./render.js";
import "katex/dist/katex.min.css";
import "./style.css";
import { consentKey, hasConsent } from "../privacy/consent.js";
import { safeFilename } from "../content/conversation.js";

const status = document.querySelector("#status");
const button = document.querySelector("#print");
let revoked = false;
const downloadURLs = new Set();
function clearPreview() {
  revoked = true;
  document.querySelector("#document").replaceChildren();
  document.title = "PDF预览已清理";
  button.disabled = true;
  status.textContent = "已撤回同意，临时预览已清理。";
  for (const url of downloadURLs) URL.revokeObjectURL(url);
  downloadURLs.clear();
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    changes[consentKey] &&
    !hasConsent(changes[consentKey].newValue)
  )
    clearPreview();
});
button.addEventListener("click", () => window.print());
async function init() {
  try {
    if (!hasConsent((await chrome.storage.local.get(consentKey))[consentKey])) {
      clearPreview();
      return;
    }
    const token = new URLSearchParams(location.search).get("token");
    if (!token || !/^[a-f0-9-]{36}$/i.test(token))
      throw new Error("预览标识无效，请重新导出");
    const key = `print:${token}`;
    const saved = (await chrome.storage.session.get(key))[key];
    if (revoked) return;
    if (!saved) throw new Error("预览已过期，请回到 DeepSeek 页面重新导出");
    const content = document.querySelector("#document");
    content.innerHTML = renderMarkdown(saved.markdown);
    document.title = saved.title || "DeepSeek 对话记录";
    await Promise.all(
      [...content.querySelectorAll("img")].map((img) =>
        img.decode().catch(() => {
          img.replaceWith(
            document.createTextNode(
              `[${img.alt || "图片"}：解码失败，请查看 ZIP 中的图片文件]`,
            ),
          );
        }),
      ),
    );
    const files = new Map((saved.files || []).map((file) => [file.url, file]));
    let hasAttachments = false;
    content.querySelectorAll("a").forEach((a) => {
      a.rel = "noreferrer noopener";
      if (!files.has(a.href)) return;
      hasAttachments = true;
      let downloading = false;
      a.addEventListener("click", async (event) => {
        event.preventDefault();
        if (downloading || revoked) return;
        downloading = true;
        a.setAttribute("aria-busy", "true");
        status.textContent = `正在下载：${files.get(a.href).filename}…`;
        try {
          const result = await chrome.runtime.sendMessage({
            type: "READ_PRINT_ATTACHMENT",
            token,
            url: a.href,
          });
          if (revoked) return;
          if (!result?.success)
            throw new Error(result?.error || "附件下载失败");
          const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(result.dataURL);
          if (!match) throw new Error("附件数据无效");
          const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: match[1] });
          const url = URL.createObjectURL(blob);
          downloadURLs.add(url);
          const link = document.createElement("a");
          const extension =
            result.filename.match(/\.[a-z0-9]{1,12}$/i)?.[0] || "";
          const stem = extension
            ? result.filename.slice(0, -extension.length)
            : result.filename;
          link.download = safeFilename(stem, 140) + extension;
          link.href = url;
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => {
            URL.revokeObjectURL(url);
            downloadURLs.delete(url);
          }, 60000);
          status.textContent = `已发送下载：${link.download}。可以继续打印 / 保存为PDF。`;
        } catch (error) {
          if (!revoked) status.textContent = `附件未下载：${error.message}`;
        } finally {
          downloading = false;
          a.removeAttribute("aria-busy");
        }
      });
    });
    if (hasAttachments) {
      const note = document.createElement("p");
      note.className = "attachment-note";
      note.textContent =
        "附件建议从原对话的“附件”窗口下载，以保留文件名和后缀；PDF中的在线链接下载后可能需按链接文字重命名。";
      const heading = content.querySelector("h1");
      if (heading) heading.after(note);
      else content.prepend(note);
    }
    await document.fonts.ready;
    if (revoked) return;
    status.textContent =
      "在打印窗口中选择“另存为 PDF”，建议使用 A4 并关闭浏览器页眉页脚。";
    button.disabled = false;
  } catch (error) {
    status.textContent = error.message;
  }
}
init();
