import {
  ds,
  findFirst,
  findAllFirstMatch,
  queryAllUnion,
} from "./selectors.js";
import {
  isGeneratingResponse,
  waitUntilOrNull,
  waitUntilStable,
} from "../utils/helpers.js";
import { scrollToLoadAllMessages } from "../utils/scrollLoader.js";
import { getTextContent, formatConversation } from "./markdown.js";
import { fetchShareConversation, parseShareData } from "./share.js";
import { domImages, fileFromMetadata } from "./attachments.js";
import { messageMetadata } from "./pageMetadata.js";
import { conversationTitle } from "./conversation.js";
export { getTextContent } from "./markdown.js";

const THINK =
  '.ds-think-content, [data-thinking-content], [class*="ds-think-content"]';
const THINK_LABEL =
  /^(?:已(?:深度)?思考|深度思考|思考过程|已停止|Thought for|Thinking|Stopped)/i;
function topLevel(nodes) {
  return nodes.filter(
    (n) => !nodes.some((other) => other !== n && other.contains(n)),
  );
}

export function detectRole(message, index = 0) {
  const explicit = (
    message.getAttribute("data-message-author-role") ||
    message.getAttribute("data-role") ||
    ""
  ).toLowerCase();
  if (["user", "assistant"].includes(explicit)) return explicit;
  if (
    message.querySelector(".ds-assistant-message-main-content") ||
    message.querySelector(THINK) ||
    thinkingToggles(message).length
  )
    return "assistant";
  if (message.querySelector('[data-role="user"], .ds-user-message'))
    return "user";
  if (message.querySelector(".ds-markdown")) return "assistant";
  return index % 2 ? "assistant" : "user";
}

export function thinkingToggles(message) {
  // Hashed fallback from public frontend commit ed5773f3 (2026-10-23).
  const candidates = Array.from(
    message.querySelectorAll(
      'button, [role="button"], [aria-expanded], summary, ._245c867',
    ),
  );
  return topLevel(
    candidates.filter(
      (el) =>
        !el.closest(".ds-markdown, pre, code") &&
        THINK_LABEL.test(
          (el.textContent || el.getAttribute("aria-label") || "").trim(),
        ),
    ),
  );
}
function isCollapsed(toggle, message) {
  if (toggle.tagName === "SUMMARY") return !toggle.parentElement.open;
  const expanded = toggle.getAttribute("aria-expanded");
  if (expanded != null) return expanded === "false";
  if (toggle.matches("._245c867")) return !!toggle.querySelector("._3d79d66");
  const content = message.querySelector(THINK);
  return (
    !content ||
    !!content.closest('[hidden], [aria-hidden="true"]') ||
    getComputedStyle(content).display === "none"
  );
}

export async function withExpandedThinking(message, capture, options = {}) {
  const {
    timeout = 7000,
    stableFor = 400,
    interval = 100,
    assertCurrent = () => {},
  } = options;
  const changed = [];
  const warnings = [];
  try {
    for (const toggle of thinkingToggles(message)) {
      assertCurrent();
      if (!isCollapsed(toggle, message)) continue;
      toggle.click();
      changed.push(toggle);
      try {
        await waitUntilStable(
          () => {
            assertCurrent();
            const regions = Array.from(message.querySelectorAll(THINK));
            if (
              !regions.length ||
              regions.some((el) =>
                el.querySelector('[aria-busy="true"], .ds-skeleton'),
              )
            )
              return null;
            const text = regions.map((el) => el.textContent).join("\n");
            return text.trim() ? text : null;
          },
          { timeout, stableFor, interval, label: "等待思考过程加载" },
        );
      } catch {
        warnings.push(
          "部分思考过程未能加载，请重试或检查网页是否提供了该内容。",
        );
      }
    }
    assertCurrent();
    const result = await capture();
    return { ...result, warnings: [...(result.warnings || []), ...warnings] };
  } finally {
    for (const toggle of changed.reverse()) {
      if (toggle.isConnected && !isCollapsed(toggle, message)) toggle.click();
    }
  }
}

export function extractMessage(
  message,
  index = 0,
  includeThinking = true,
  metadata = {},
) {
  if (metadata.message) {
    try {
      return parseShareData(
        {
          code: 0,
          data: { biz_code: 0, biz_data: { messages: [metadata.message] } },
        },
        "",
        includeThinking,
      ).messages[0];
    } catch (error) {
      console.warn("[DSX] 消息快照解析失败，回退页面内容：", error.message);
    }
  }
  const role = detectRole(message, index);
  const files = (metadata.files || []).map(fileFromMetadata).filter(Boolean);
  const images = domImages(message).filter(
    (image) =>
      !files.some((file) => file.isImage && file.filename === image.filename),
  );
  const attachments = [...files, ...images];
  if (role === "user") {
    const clone = message.cloneNode(true);
    clone
      .querySelectorAll('button, svg, script, style, img, [aria-hidden="true"]')
      .forEach((n) => n.remove());
    // File cards are represented by the attachment list, not duplicated as body prose.
    for (const file of files)
      for (const el of [
        ...clone.querySelectorAll('[tabindex], [role="button"]'),
      ]) {
        if (el.textContent.includes(file.filename)) el.remove();
      }
    const content = clone.querySelector(
      ".ds-markdown, pre, p, table, ul, ol, img",
    )
      ? getTextContent(clone)
      : clone.textContent.trim();
    return { role, content, thinking: "", attachments };
  }
  const regions = topLevel(Array.from(message.querySelectorAll(THINK)));
  const thinking = includeThinking
    ? regions
        .map((region) => {
          const parts = topLevel(findAllFirstMatch(ds.aiContent, region));
          return parts.length
            ? parts.map(getTextContent).join("\n\n")
            : getTextContent(region);
        })
        .filter(Boolean)
        .join("\n\n")
    : "";
  const main = queryAllUnion(
    [".ds-assistant-message-main-content", "[data-answer-content]"],
    message,
  );
  const markdowns = main.length
    ? main
    : findAllFirstMatch(ds.aiContent, message);
  const answers = topLevel(markdowns.filter((n) => !n.closest(THINK)));
  let content = answers.map(getTextContent).filter(Boolean).join("\n\n");
  if (!content) {
    const clone = message.cloneNode(true);
    clone.querySelectorAll(THINK).forEach((n) => n.remove());
    thinkingToggles(clone).forEach((n) => n.remove());
    content = getTextContent(clone);
  }
  const tools = (metadata.tools || []).map((tool) => ({
    kind: "tool",
    ...tool,
  }));
  // DOM does not always expose source payloads. Retain visible calls and links as a fallback.
  if (!tools.length && includeThinking) {
    const candidates = [
      ...message.querySelectorAll(
        '[data-tool-call], button, [role="button"], div',
      ),
    ].filter(
      (el) =>
        el.hasAttribute("data-tool-call") ||
        (el.textContent.length < 250 &&
          /^(?:已搜索|搜索到|已浏览|已阅读|已查看|已访问|搜索了|找到\s*\d+|Found \d+ web pages|Searched|Read \d+)/i.test(
            el.textContent.trim(),
          )),
    );
    for (const el of topLevel(
      candidates.filter((el) => !el.closest(".ds-markdown")),
    )) {
      tools.push({
        kind: "tool",
        label: el.getAttribute("data-tool-call") || "网页工具",
        content: el.textContent.trim(),
        results: [...el.querySelectorAll("a[href]")].map((a) => ({
          title: a.textContent,
          url: a.href,
        })),
      });
    }
  }
  return {
    role,
    content,
    thinking,
    attachments: attachments.map((file) => ({
      ...file,
      inlineInContent: !!file.url && content.includes(file.url),
    })),
    reasoning:
      includeThinking && tools.length
        ? [{ kind: "thinking", content: thinking }, ...tools]
        : undefined,
    warnings: includeThinking
      ? [
          "部分聊天消息使用页面内容提取，工具记录可能不完整；若有遗漏，请刷新网页重试或使用分享页导出。",
        ]
      : [],
  };
}

let extracting = false;
export async function extractConversationData(
  includeThinking = true,
  { onProgress = () => {}, signal } = {},
) {
  if (extracting) throw new Error("已有导出正在进行，请等待完成");
  extracting = true;
  const url = location.href;
  const assertCurrent = () => {
    signal?.throwIfAborted();
    if (location.href !== url)
      throw new Error("对话页面已切换，请在当前页面重新导出");
    if (isGeneratingResponse())
      throw new Error("请等待 DeepSeek 回复完成后再导出");
  };
  try {
    assertCurrent();
    const warnings = [];
    try {
      onProgress("正在读取对话…");
      const shared = await fetchShareConversation(url, includeThinking, {
        signal,
      });
      assertCurrent();
      if (shared) return shared;
    } catch (error) {
      assertCurrent();
      console.warn("[DSX] 分享原始数据读取失败，改用页面提取:", error.message);
      warnings.push("分享原始数据暂不可用，本次使用页面内容提取。");
    }
    await waitUntilOrNull(() => findFirst(ds.messageContainer), {
      timeout: 4000,
      interval: 150,
    });
    const records = new Map();
    await scrollToLoadAllMessages({
      assertCurrent,
      visit: async (node, key, index) => {
        if (records.has(key)) return;
        assertCurrent();
        onProgress(
          "正在提取第 " +
            (index + 1) +
            " 条消息" +
            (includeThinking ? "及思考过程" : "") +
            "…",
        );
        const metadata = await messageMetadata(node);
        const capture = async () =>
          extractMessage(
            node,
            index,
            includeThinking,
            metadata.message ? metadata : await messageMetadata(node),
          );
        const record =
          includeThinking &&
          !metadata.message &&
          detectRole(node, index) === "assistant"
            ? await withExpandedThinking(node, capture, { assertCurrent })
            : extractMessage(node, index, includeThinking, metadata);
        warnings.push(...(record.warnings || []));
        records.set(key, record);
      },
    });
    assertCurrent();
    const messages = [...records.values()].filter(
      (m) => m.content || m.thinking || m.attachments?.length,
    );
    if (!messages.length)
      throw new Error("当前没有可导出的对话，或网页结构已发生变化");
    return {
      title: conversationTitle("", messages, document.title),
      url,
      messages,
      warnings: [...new Set(warnings)],
      source: "dom",
    };
  } finally {
    extracting = false;
  }
}
export async function extractConversation(includeThinking = true, options) {
  return formatConversation(
    await extractConversationData(includeThinking, options),
    includeThinking,
  );
}
