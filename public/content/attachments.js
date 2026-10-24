import { marked } from "marked";
// The public DeepSeek frontend uses files.deepseeksvc.com/api + signed_path.
// 'r' serves document bytes; images use 'p' (the site's preview, not the upload).
export function fileFromMetadata(file) {
  const filename = file.file_name || file.fileName;
  if (!filename) return null;
  const isImage = file.is_image ?? file.isImage ?? false;
  const signed = file.signed_path || file.signedPath;
  let url = "";
  if (signed) {
    try {
      const parsed = new URL(
        signed.startsWith("/") ? `/api${signed}` : signed,
        "https://files.deepseeksvc.com",
      );
      if (
        parsed.origin === "https://files.deepseeksvc.com" &&
        parsed.pathname === "/api/file"
      ) {
        parsed.searchParams.set("ty", isImage ? "p" : "r");
        if (isImage) parsed.searchParams.set("fmt", "jpeg");
        url = parsed.href;
      }
    } catch {
      /* Keep the filename even when its URL cannot be used. */
    }
  }
  return {
    id: file.id || filename,
    filename,
    originalFilename: filename,
    size: file.file_size ?? file.fileSize,
    isImage,
    type: isImage ? "image" : "document",
    url,
    canExport: !!url,
    needsClick: false,
    preview: isImage,
  };
}

export function markdownLabel(text) {
  return String(text || "")
    .replace(/[\\[\]<>*_`]/g, "\\$&")
    .replace(/[\r\n]/g, " ");
}
export function markdownURL(url) {
  return String(url).replace(/[<>\s]/g, (c) => encodeURIComponent(c));
}
export function attachmentMarkdown(files = []) {
  files = files.filter((file) => !file.inlineInContent);
  if (!files.length) return "";
  return (
    "**附件**\n\n" +
    files
      .map((file) => {
        const name = markdownLabel(file.filename);
        const target = file.localPath || file.url;
        const note = file.error
          ? `（未打包：${markdownLabel(file.error)}）`
          : file.preview
            ? "（网页预览图）"
            : "";
        if (!target) return `- ${name}（网页未提供下载地址）`;
        const link = `[${name}](<${markdownURL(target)}>)`;
        return file.isImage && !file.error
          ? `!${link}\n\n${note}`
          : `- ${link}${note}`;
      })
      .join("\n\n")
  );
}

export function inlineImages(markdown = "") {
  const files = new Map();
  marked.walkTokens(marked.lexer(markdown), (token) => {
    if (
      token.type !== "image" ||
      !/^(https?:|blob:|data:image\/)/i.test(token.href)
    )
      return;
    files.set(token.href, {
      id: token.href,
      url: token.href,
      filename: token.text || "正文图片",
      isImage: true,
      inlineInContent: true,
      canExport: true,
    });
  });
  return [...files.values()];
}

export function domImages(root) {
  return [...root.querySelectorAll("img")]
    .filter(
      (img) =>
        !/avatar|site-icons|favicon|logo/i.test(img.src) &&
        !img.closest("[data-dsx-control]"),
    )
    .map((img, index) => ({
      id: img.getAttribute("src") || `image-${index}`,
      filename: img.alt || `图片-${index + 1}`,
      originalFilename: img.alt || `图片-${index + 1}`,
      isImage: true,
      type: "image",
      url: img.currentSrc || img.src || img.dataset.src || "",
      element: img,
      needsClick: false,
      canExport: true,
    }))
    .filter((file) => /^(https?:|blob:|data:image\/)/i.test(file.url));
}

export function blobDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(blob);
  });
}
export async function readAttachment(file, { signal } = {}) {
  signal?.throwIfAborted();
  if (!file.url) throw new Error("网页未提供下载地址");
  if (file.url.startsWith("https://files.deepseeksvc.com/")) {
    const result = await chrome.runtime.sendMessage({
      type: "READ_ATTACHMENT",
      url: file.url,
      expectedSize:
        !file.isImage && typeof file.size === "number" ? file.size : undefined,
      isImage: !!file.isImage,
    });
    if (!result?.success) throw new Error(result?.error || "附件读取失败");
    return result.dataURL;
  }
  if (/^(blob:|data:image\/(png|jpeg|gif|webp);base64,)/i.test(file.url)) {
    const response = await fetch(file.url, { signal });
    const blob = await response.blob();
    if (blob.size > 40 * 1024 * 1024)
      throw new Error("文件超过 40 MB，请单独下载");
    return blobDataURL(blob);
  }
  // Ordinary web images retain their original link if the server disallows CORS.
  const response = await fetch(file.url, {
    credentials: "omit",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size > 40 * 1024 * 1024)
    throw new Error("不是可读取的图片或文件过大");
  return blobDataURL(blob);
}
