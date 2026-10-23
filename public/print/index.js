import { renderMarkdown } from "./render.js";
import "katex/dist/katex.min.css";
import "./style.css";

const status = document.querySelector("#status");
const button = document.querySelector("#print");
button.addEventListener("click", () => window.print());
async function init() {
  try {
    const token = new URLSearchParams(location.search).get("token");
    if (!token || !/^[a-f0-9-]{36}$/i.test(token))
      throw new Error("预览标识无效，请重新导出");
    const key = `print:${token}`;
    const saved = (await chrome.storage.session.get(key))[key];
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
    content.querySelectorAll("a").forEach((a) => {
      a.rel = "noreferrer noopener";
    });
    await document.fonts.ready;
    status.textContent =
      "在打印窗口中选择“另存为 PDF”，建议使用 A4 并关闭浏览器页眉页脚。";
    button.disabled = false;
  } catch (error) {
    status.textContent = error.message;
  }
}
init();
