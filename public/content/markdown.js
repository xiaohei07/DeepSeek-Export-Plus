import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { marked } from "marked";
import { attachmentMarkdown, markdownLabel } from "./attachments.js";
import { toolMarkdown } from "./tools.js";

const LANGUAGE = /^[a-z0-9][a-z0-9_+#.-]*$/i;
export function codeFence(code, language = "text") {
  const runs = String(code).match(/`+/g) || [];
  const fence = "`".repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
  const lang = LANGUAGE.test(language) ? language.toLowerCase() : "text";
  const body = String(code).replace(/\r\n?/g, "\n");
  return `${fence}${lang}\n${body}${body.endsWith("\n") ? "" : "\n"}${fence}`;
}

export function getTextContent(element) {
  if (!element) return "";
  const clone = element.cloneNode(true);
  // DeepSeek puts the language and actions in siblings of <pre>, not in its class.
  for (const block of clone.querySelectorAll(".md-code-block")) {
    const banner = block.querySelector(".md-code-block-banner");
    const language =
      block.querySelector(".md-code-block-infostring")?.textContent.trim() ||
      [...(banner?.querySelectorAll("span") || [])]
        .filter((el) => !el.closest('button, [role="button"]'))
        .map((el) => el.textContent.trim())
        .find((text) => LANGUAGE.test(text));
    if (language)
      block.querySelector("pre")?.setAttribute("data-language", language);
  }
  clone
    .querySelectorAll(
      "script, style, noscript, button, svg, .md-code-block-banner-wrap, .md-code-block-banner, .md-code-block-footer, .ds-markdown-code-copy-button, [data-dsx-control]",
    )
    .forEach((n) => n.remove());
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
  });
  service.use(gfm);
  service.addRule("codeBlocks", {
    filter: "pre",
    replacement: (_content, node) => {
      const code = node.querySelector("code") || node;
      let language = "text";
      for (const el of [code, node]) {
        const hint =
          el.getAttribute("data-language") ||
          el.getAttribute("lang") ||
          String(el.className).match(/(?:language|lang)-([^\s]+)/)?.[1];
        if (hint) {
          language = hint;
          break;
        }
      }
      return `\n\n${codeFence(code.textContent, language)}\n\n`;
    },
  });
  service.addRule("math", {
    filter: (node) =>
      node.matches(".katex-display, .katex, .math") &&
      !!node.querySelector('annotation[encoding="application/x-tex"]'),
    replacement: (_content, node) => {
      const latex = node.querySelector(
        'annotation[encoding="application/x-tex"]',
      ).textContent;
      return node.matches(".katex-display, .display") ||
        node.closest(".katex-display")
        ? `\n\n$$\n${latex}\n$$\n\n`
        : `$${latex}$`;
    },
  });
  service.addRule("safeImages", {
    filter: "img",
    replacement: (_content, node) => {
      const src =
        node.getAttribute("src") || node.getAttribute("data-src") || "";
      const alt = (node.getAttribute("alt") || "图片").replace(
        /[\[\]\n]/g,
        " ",
      );
      return /^(https?:|blob:|data:image\/)/i.test(src)
        ? `![${alt}](<${src.replace(/[<>]/g, "")}>)`
        : `[${alt}，网页未提供图片地址]`;
    },
  });
  // Root DIV wrappers and their whitespace must be processed as a whole.
  return service.turndown(clone).trim();
}

/** Rebase body headings beneath their section without rewriting code or inline Markdown. */
export function nestMarkdown(markdown, parentLevel) {
  const tokens = marked.lexer(String(markdown || "").replace(/\r\n?/g, "\n"));
  const levels = tokens.filter((t) => t.type === "heading").map((t) => t.depth);
  const minimum = levels.length ? Math.min(...levels) : 1;
  let output = "";
  for (const token of tokens) {
    if (token.type === "heading") {
      const level = parentLevel + 1 + token.depth - minimum;
      output +=
        level <= 6
          ? `${"#".repeat(level)} ${token.text}\n\n`
          : `**${token.text}**\n\n`;
    } else if (token.type === "code") {
      output += `${codeFence(token.text, token.lang?.split(/\s/)[0] || "text")}\n\n`;
    } else if (token.type !== "space" || !output.endsWith("\n\n")) {
      output += token.raw;
    }
  }
  return output.trim();
}

export function formatThinking(markdown) {
  const text = nestMarkdown(markdown, 4);
  return text
    .trim()
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

export function formatConversation(conversation, includeThinking = true) {
  const title = String(conversation.title || "DeepSeek 对话记录")
    .replace(/[\r\n]/g, " ")
    .trim();
  const chunks = [`# ${markdownLabel(title)}`];
  if (conversation.url)
    chunks.push(`来源：<${conversation.url.replace(/[<>\s]/g, "")}>`);
  if (
    conversation.messages.some((m) =>
      m.attachments?.some((f) => f.url && !f.localPath),
    )
  )
    chunks.push(
      "> 附件在线链接可能过期；需要离线保留原文件时，请使用含图片与附件的 ZIP 导出。",
    );
  for (const warning of conversation.warnings || [])
    chunks.push(`> 导出提示：${warning}`);
  let round = 0;
  for (const message of conversation.messages) {
    if (
      message.role === "user" ||
      round === 0 ||
      (message.round && message.round !== round)
    ) {
      round = message.round || round + 1;
      chunks.push(`## 第 ${round} 轮`);
    }
    chunks.push(`### ${message.role === "user" ? "用户" : "DeepSeek"}`);
    if (message.attachments?.length)
      chunks.push(attachmentMarkdown(message.attachments));
    if (message.role === "assistant") {
      if (includeThinking && (message.thinking || message.reasoning?.length)) {
        chunks.push("#### 思考过程");
        const reasoning = message.reasoning?.length
          ? message.reasoning
          : [{ kind: "thinking", content: message.thinking }];
        chunks.push(
          formatThinking(
            reasoning
              .map((part) =>
                part.kind === "tool" ? toolMarkdown(part) : part.content,
              )
              .filter(Boolean)
              .join("\n\n"),
          ),
        );
      }
      if (message.content)
        chunks.push("#### 回答", nestMarkdown(message.content, 4));
      else chunks.push("> 本条消息没有可提取的最终回答。");
    } else chunks.push(nestMarkdown(message.content, 3));
  }
  return chunks.filter(Boolean).join("\n\n") + "\n";
}
