import { zipSync, strToU8 } from "fflate";
import { marked } from "marked";
import { readAttachment } from "./attachments.js";
import { formatConversation } from "./markdown.js";
import { safeFilename } from "./conversation.js";
import { exportFormats, renderDocuments, validateFormats } from "./formats.js";

function decode(dataURL) {
  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(dataURL);
  if (!match) throw new Error("附件数据格式无效");
  return {
    type: match[1],
    bytes: Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0)),
  };
}
function filenameFor(file, type) {
  const original = String(file.filename || "附件");
  const extension = original.match(/.+(\.[a-z0-9]{1,12})$/i)?.[1] || "";
  let name =
    safeFilename(
      extension ? original.slice(0, -extension.length) : original,
      140,
    ) + extension;
  if (file.isImage) {
    const ext = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    }[type];
    if (!ext) throw new Error("不支持嵌入此图片格式");
    name =
      name.replace(/\.[a-z0-9]+$/i, "") +
      (file.preview ? "-预览" : "") +
      "." +
      ext;
  }
  return name;
}

/** Read and validate once, shared by direct downloads and ZIP/PDF assets. */
export async function prepareSingleAttachment(
  file,
  { read = readAttachment, signal, onProgress = () => {} } = {},
) {
  signal?.throwIfAborted();
  onProgress(`正在下载：${file.filename}…`);
  const dataURL = await read(file);
  signal?.throwIfAborted();
  const { type, bytes } = decode(dataURL);
  if (file.isImage && !/^image\/(png|jpeg|webp|gif)$/.test(type))
    throw new Error("图片服务未返回可嵌入的图片");
  if (
    !file.isImage &&
    Number(file.size) > 0 &&
    bytes.length !== Number(file.size)
  )
    throw new Error("文件大小不符，未作为原文件保存");
  return { bytes, type, filename: filenameFor(file, type), dataURL };
}

export async function prepareExport(
  conversation,
  {
    includeThinking = false,
    formats = ["md"],
    offline = false,
    forPrint = false,
    attachmentsOnly = false,
    read = readAttachment,
    onProgress = () => {},
    signal,
    windowObject,
    exportedAt,
  } = {},
) {
  const chosenFormats = validateFormats(
    forPrint || attachmentsOnly ? ["md"] : formats,
  );
  signal?.throwIfAborted();
  const data = {
    ...conversation,
    warnings: [...(conversation.warnings || [])],
    messages: conversation.messages.map((m) => ({
      ...m,
      attachments: (m.attachments || []).map((f) => ({ ...f })),
    })),
  };
  const archive = {},
    manifest = [],
    cached = new Map();
  let total = 0,
    count = 0;
  const load = async (file) => {
    signal?.throwIfAborted();
    if (cached.has(file.url)) return cached.get(file.url);
    onProgress(`正在保存图片与附件（${++count}）…`);
    const {
      dataURL,
      bytes,
      filename: name,
    } = await prepareSingleAttachment(file, { read, signal });
    if (total + bytes.length > (forPrint ? 5 : 100) * 1024 * 1024)
      throw new Error(
        forPrint
          ? "预览图片总量超过 5 MB，请使用 ZIP 导出"
          : "附件总量超过 100 MB，请分批导出文件",
      );
    total += bytes.length;
    const path = `assets/${String(Object.keys(archive).length + 1).padStart(3, "0")}-${name}`;
    if (offline && !forPrint) archive[path] = bytes;
    const result = {
      localPath: forPrint
        ? dataURL
        : path.split("/").map(encodeURIComponent).join("/"),
      bytes: bytes.length,
      filename: name,
    };
    cached.set(file.url, result);
    manifest.push({
      originalFilename: file.filename,
      savedAs: forPrint ? name : path,
      bytes: bytes.length,
      imagePreview: !!file.preview,
    });
    return result;
  };
  for (const message of data.messages) {
    signal?.throwIfAborted();
    for (const file of message.attachments) {
      if (!(offline || (forPrint && file.isImage))) continue;
      if (forPrint && !file.isImage) continue;
      try {
        const loaded = await load(file);
        file.localPath = loaded.localPath;
      } catch (error) {
        signal?.throwIfAborted();
        file.error = error.message;
        manifest.push({
          originalFilename: file.filename,
          error: error.message,
        });
        data.warnings.push(`附件“${file.filename}”未保存：${error.message}`);
      }
    }
    // Also preserve images embedded in answer/thinking Markdown at their original positions.
    const localize = async (markdown) => {
      const blocks = marked.lexer(markdown || "");
      const output = [];
      for (const block of blocks) {
        let raw = block.raw;
        if (!["code", "html"].includes(block.type)) {
          const images = [];
          marked.walkTokens([block], (token) => {
            if (token.type === "image") images.push(token);
          });
          for (const image of images) {
            try {
              const file = {
                filename: image.text || "图片",
                isImage: true,
                url: image.href,
              };
              const loaded = await load(file);
              raw = raw.replace(
                image.raw,
                `![${image.text.replace(/[\[\]\n]/g, " ")}](<${loaded.localPath}>)`,
              );
            } catch (error) {
              signal?.throwIfAborted();
              data.warnings.push(`正文图片未保存：${error.message}`);
            }
          }
        }
        output.push(raw);
      }
      return output.join("");
    };
    if (offline || forPrint) {
      message.content = await localize(message.content);
      if (includeThinking) {
        if (message.reasoning?.length) {
          const parts = [];
          for (const part of message.reasoning)
            parts.push(
              part.kind === "thinking"
                ? { ...part, content: await localize(part.content) }
                : part,
            );
          message.reasoning = parts;
        } else message.thinking = await localize(message.thinking);
      }
    }
  }
  data.warnings = [...new Set(data.warnings)];
  const markdown = formatConversation(data, includeThinking);
  const documents = attachmentsOnly
    ? {}
    : renderDocuments(data, markdown, chosenFormats, {
        includeThinking,
        windowObject,
        exportedAt,
      });
  const hasAssets = manifest.length > 0;
  const zip =
    !forPrint && (chosenFormats.length > 1 || (offline && hasAssets))
      ? zipSync(
          {
            ...Object.fromEntries(
              Object.entries(documents).map(([format, content]) => [
                `对话.${format}`,
                strToU8(content),
              ]),
            ),
            ...(hasAssets
              ? { "附件清单.json": strToU8(JSON.stringify(manifest, null, 2)) }
              : {}),
            ...archive,
          },
          { level: 0 },
        )
      : null;
  const extension = chosenFormats[0];
  return {
    markdown,
    documents,
    content: documents[extension],
    extension,
    mime: exportFormats[extension].mime,
    zip,
    manifest,
    warnings: data.warnings,
  };
}

/** One selected batch = one browser download, including a readable failure list. */
export async function prepareAttachmentArchive(files, options = {}) {
  const result = await prepareExport(
    { messages: [{ role: "user", content: "", attachments: files }] },
    {
      ...options,
      includeThinking: false,
      offline: true,
      forPrint: false,
      attachmentsOnly: true,
    },
  );
  return {
    ...result,
    saved: result.manifest.filter((f) => !f.error).length,
    failed: result.manifest.filter((f) => f.error).length,
  };
}
