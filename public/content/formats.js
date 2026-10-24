import { marked } from "marked";
import { renderMarkdown } from "../print/render.js";
import { conversationRounds, documentTitle } from "./conversation.js";
import { readableAssetPath } from "./assetPaths.js";

export const exportFormats = Object.freeze({
  md: { label: "Markdown", mime: "text/markdown;charset=utf-8" },
  html: { label: "HTML", mime: "text/html;charset=utf-8" },
  txt: { label: "TXT", mime: "text/plain;charset=utf-8" },
  json: { label: "JSON", mime: "application/json;charset=utf-8" },
  docx: {
    label: "Word",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  png: { label: "PNG", mime: "image/png" },
});

export function validateFormats(formats) {
  if (
    !Array.isArray(formats) ||
    !formats.length ||
    formats.some((format) => !Object.hasOwn(exportFormats, format))
  )
    throw new Error("请选择支持的导出格式");
  return [...new Set(formats)];
}

const text = (value) => (typeof value === "string" ? value : "");
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

// Keep code literally; only remove formatting represented by Markdown tokens.
export function markdownToText(markdown) {
  const inline = (tokens = []) =>
    tokens
      .map((token) => {
        switch (token.type) {
          case "link":
            return `${inline(token.tokens) || token.href} (${readableAssetPath(token.href)})`;
          case "image":
            return `[图片：${token.text || "图片"}] (${readableAssetPath(token.href)})`;
          case "br":
            return "\n";
          default:
            return token.tokens
              ? inline(token.tokens)
              : (token.text ?? token.raw ?? "");
        }
      })
      .join("");
  const blocks = (tokens = []) =>
    tokens
      .map((token) => {
        switch (token.type) {
          case "space":
            return "";
          case "hr":
            return "────────────────────\n\n";
          case "code":
            return `${token.lang ? `[代码 · ${token.lang}]\n` : "[代码]\n"}${token.text}\n[代码结束]\n\n`;
          case "blockquote":
            return (
              blocks(token.tokens)
                .trimEnd()
                .split("\n")
                .map((line) => "> " + line)
                .join("\n") + "\n\n"
            );
          case "list":
            return (
              token.items
                .map((item, i) => {
                  const prefix =
                    (token.ordered ? `${Number(token.start) + i}. ` : "• ") +
                    (item.task ? (item.checked ? "[x] " : "[ ] ") : "");
                  return (
                    prefix +
                    blocks(item.tokens).trimEnd().replace(/\n/g, "\n  ")
                  );
                })
                .join("\n") + "\n\n"
            );
          case "table":
            return (
              [token.header, ...token.rows]
                .map((row) => row.map((cell) => inline(cell.tokens)).join("\t"))
                .join("\n") + "\n\n"
            );
          default:
            return (
              (token.tokens
                ? inline(token.tokens)
                : (token.text ?? token.raw ?? "")) + "\n\n"
            );
        }
      })
      .join("");
  return blocks(marked.lexer(markdown)).trimEnd() + "\n";
}

// A versioned, explicit public schema: never serialize raw page/React objects.
export function conversationJSON(
  conversation,
  { includeThinking = false, exportedAt = new Date() } = {},
) {
  const source = (value) => ({
    title: text(value?.title),
    url: text(value?.url),
  });
  const reasoning = (part) =>
    part.kind === "tool"
      ? {
          kind: "tool",
          type: text(part.type),
          label: text(part.label),
          status: text(part.status),
          queries: (part.queries || []).map((q) =>
            typeof q === "string" ? q : text(q?.query),
          ),
          sources: (part.results?.length
            ? part.results
            : part.result
              ? [part.result]
              : []
          ).map(source),
          content: text(part.content),
        }
      : { kind: "thinking", contentMarkdown: text(part.content) };
  return (
    JSON.stringify(
      {
        schemaVersion: 1,
        title: documentTitle(conversation),
        sourceUrl: text(conversation.url),
        exportedAt: exportedAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
        includesThinking: !!includeThinking,
        warnings: (conversation.warnings || []).map(text),
        rounds: conversationRounds(conversation.messages).map((round) => ({
          number: round.number,
          messages: round.messages.map((message) => ({
            role: message.role === "user" ? "user" : "assistant",
            name: message.role === "user" ? "用户" : "DeepSeek",
            contentMarkdown: text(message.content),
            attachments: (message.attachments || []).map((file) => ({
              name: text(file.filename),
              ...(Number.isFinite(Number(file.size))
                ? { size: Number(file.size) }
                : {}),
              isImage: !!file.isImage,
              imagePreview: !!file.preview,
              ...(file.localPath
                ? {
                    path: text(file.localPath),
                    localPath: readableAssetPath(file.localPath),
                  }
                : { url: text(file.url) }),
              ...(file.error ? { error: text(file.error) } : {}),
            })),
            ...(includeThinking && message.role !== "user"
              ? {
                  reasoning: message.reasoning?.length
                    ? message.reasoning.map(reasoning)
                    : message.thinking
                      ? [
                          {
                            kind: "thinking",
                            contentMarkdown: text(message.thinking),
                          },
                        ]
                      : [],
                }
              : {}),
          })),
        })),
      },
      null,
      2,
    ) + "\n"
  );
}

export const htmlStyle = `
:root{color-scheme:light;--ink:#242b36;--muted:#465467;--line:#dce2ea;--soft:#f4f6fa;--link:#2357ae}
*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--ink);font:16px/1.8 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
main{max-width:880px;margin:48px auto 80px;padding:0 28px;overflow-wrap:anywhere}
h1,h2,h3,h4,h5,h6{line-height:1.45}h1{font-size:30px;margin:0 0 24px}h2{font-size:23px;margin:44px 0 20px;padding-bottom:10px;border-bottom:1px solid var(--line)}h3{font-size:20px;margin:28px 0 12px}h4{font-size:17px;margin:22px 0 10px}
a{color:var(--link);text-decoration-thickness:1px;text-underline-offset:3px}a:focus-visible{outline:2px solid var(--link);outline-offset:3px}
pre,code{font-family:ui-monospace,Consolas,"Cascadia Code",monospace;font-size:.9em}code{background:var(--soft);padding:2px 4px;border-radius:3px}pre{padding:18px;background:var(--soft);border:1px solid var(--line);border-radius:8px;overflow:auto;line-height:1.6}pre code{padding:0;background:none;font-size:1em}
blockquote{margin:18px 0;padding:8px 18px;border-left:3px solid #8b9bb4;background:var(--soft);color:var(--muted);font-style:normal}blockquote p:first-child{margin-top:4px}blockquote p:last-child{margin-bottom:4px}
img{display:block;max-width:100%;height:auto;margin:16px 0}table{display:block;overflow:auto;border-collapse:collapse;max-width:100%;margin:20px 0}th,td{border:1px solid var(--line);padding:8px 12px;text-align:left}th{background:var(--soft)}math[display="block"]{overflow:auto;padding:12px 0}
footer{max-width:824px;margin:0 auto 24px;padding:16px 28px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
@media(max-width:600px){main{margin:24px auto 40px;padding:0 18px}h1{font-size:25px}pre{padding:12px}}
@media print{main{max-width:none;margin:0;padding:0}pre{white-space:pre-wrap;overflow-wrap:anywhere}h1,h2,h3,h4{break-after:avoid}img{max-height:90vh;object-fit:contain}footer{display:none}}
`;

export function conversationHTML(conversation, markdown, windowObject) {
  const body = renderMarkdown(markdown, windowObject, { standalone: true });
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(documentTitle(conversation))}</title><style>${htmlStyle}</style></head>
<body><main>${body}</main><footer>由 DeepSeek Export Plus 在本地导出。网页图片可能为预览版；在线链接可能失效。</footer></body></html>\n`;
}

export function renderDocuments(conversation, markdown, formats, options = {}) {
  const renderers = {
    md: () => markdown,
    html: () => conversationHTML(conversation, markdown, options.windowObject),
    txt: () => markdownToText(markdown),
    json: () => conversationJSON(conversation, options),
  };
  return Object.fromEntries(
    validateFormats(formats)
      .filter((format) => renderers[format])
      .map((format) => [format, renderers[format]()]),
  );
}
