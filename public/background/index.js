import { readMountedMetadata } from "../content/pageMetadata.js";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[AI Exporter] 后台收到消息:", request.type);

  if (request.type === "READ_MESSAGE_METADATA") {
    if (
      !isDeepSeekSender(sender) ||
      !/^[a-f0-9-]{36}$/.test(request.marker || "")
    )
      return false;
    chrome.scripting
      .executeScript({
        target: { tabId: sender.tab.id, frameIds: [sender.frameId || 0] },
        world: "MAIN",
        func: readMountedMetadata,
        args: [request.marker],
      })
      .then(
        (results) =>
          sendResponse({
            success: true,
            data: results[0]?.result || { files: [], tools: [] },
          }),
        (error) => sendResponse({ success: false, error: error.message }),
      );
    return true;
  }
  if (request.type === "READ_ATTACHMENT") {
    if (!isDeepSeekSender(sender)) return false;
    readFileURL(request.url, request.expectedSize, request.isImage).then(
      (dataURL) => sendResponse({ success: true, dataURL }),
      (error) => sendResponse({ success: false, error: error.message }),
    );
    return true;
  }

  if (request.type === "OPEN_PRINT_PREVIEW") {
    openPrintPreview(request, sender).then(
      () => sendResponse({ success: true }),
      (error) => sendResponse({ success: false, error: error.message }),
    );
    return true;
  }

  sendResponse({ success: false, error: "未知消息类型" });
  return false;
});

function isDeepSeekSender(sender) {
  return (
    sender.id === chrome.runtime.id &&
    sender.url?.startsWith("https://chat.deepseek.com/")
  );
}
async function readFileURL(url, expectedSize, isImage) {
  const parsed = new URL(url);
  if (
    parsed.origin !== "https://files.deepseeksvc.com" ||
    parsed.pathname !== "/api/file"
  )
    throw new Error("不支持的附件地址");
  const response = await fetch(parsed.href, {
    credentials: "omit",
    signal: AbortSignal.timeout(60000),
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(
      `附件服务返回 HTTP ${response.status}，地址可能已过期或无权访问`,
    );
  const max = 40 * 1024 * 1024;
  if (Number(response.headers.get("content-length")) > max)
    throw new Error("附件超过 40 MB，请单独下载");
  const reader = response.body.getReader(),
    chunks = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) {
      await reader.cancel();
      throw new Error("附件超过 40 MB，请单独下载");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const type = (
    response.headers.get("content-type") || "application/octet-stream"
  ).split(";")[0];
  if (
    Number.isSafeInteger(expectedSize) &&
    expectedSize > 0 &&
    length !== expectedSize
  )
    throw new Error("附件字节数与网页记录不符，未作为原文件保存");
  if (isImage && !/^image\/(png|jpeg|webp|gif)$/.test(type))
    throw new Error("附件服务没有返回可嵌入的图片");
  return `data:${type};base64,${bytesToBase64(bytes)}`;
}

async function openPrintPreview(request, sender) {
  if (
    sender.id !== chrome.runtime.id ||
    !sender.url?.startsWith("https://chat.deepseek.com/")
  )
    throw new Error("仅支持从 DeepSeek 页面导出");
  if (typeof request.markdown !== "string" || !request.markdown.trim())
    throw new Error("没有可打印的对话");
  const now = Date.now();
  const old = await chrome.storage.session.get(null);
  await chrome.storage.session.remove(
    Object.keys(old).filter(
      (key) =>
        key.startsWith("print:") && now - old[key].createdAt > 30 * 60 * 1000,
    ),
  );
  const token = crypto.randomUUID();
  const key = `print:${token}`;
  const value = {
    markdown: request.markdown,
    title: String(request.title || "DeepSeek 对话记录"),
    createdAt: now,
  };
  // Keep the temporary session below Chrome's 10 MB quota. Older previews
  // already rendered in open tabs keep working; reloading an evicted one asks to export again.
  let size = JSON.stringify(value).length * 2;
  if (size > 9 * 1024 * 1024)
    throw new Error("PDF预览内容超过临时存储限制，请减少轮次或使用ZIP");
  const retained = await chrome.storage.session.get(null);
  const entries = Object.entries(retained)
    .filter(([key]) => key.startsWith("print:"))
    .sort((a, b) => b[1].createdAt - a[1].createdAt);
  for (const [oldKey, oldValue] of entries) {
    size += JSON.stringify(oldValue).length * 2;
    if (size > 9 * 1024 * 1024) await chrome.storage.session.remove(oldKey);
  }
  await chrome.storage.session.set({ [key]: value });
  try {
    const tab = await chrome.tabs.create({
      url: chrome.runtime.getURL(`print/index.html?token=${token}`),
    });
    await chrome.storage.session.set({ [key]: { ...value, tabId: tab.id } });
  } catch (error) {
    await chrome.storage.session.remove(key);
    throw error;
  }
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const values = await chrome.storage.session.get(null);
  const keys = Object.keys(values).filter(
    (key) => key.startsWith("print:") && values[key].tabId === tabId,
  );
  if (keys.length) await chrome.storage.session.remove(keys);
});

function bytesToBase64(bytes) {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
