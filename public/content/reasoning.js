import { getTextContent } from "./markdown.js";

const THINK = ".ds-think-content, [data-thinking-content]";
const ANSWER = ".ds-assistant-message-main-content, [data-answer-content]";
const LABEL =
  /^(?:已搜索|搜索到|已浏览|已阅读|已查看|已访问|搜索了|阅读了|浏览了|打开了|正在搜索|找到\s*\d+|Found \d+|Searched|Read \d+)/i;
const top = (nodes) =>
  nodes.filter((n) => !nodes.some((p) => p !== n && p.contains(n)));

/** Keep tools next to their actual rendered thinking fragments, never append
 * every search to the end merely because no full message snapshot is present. */
export function domReasoning(message, metadata = {}) {
  const elements = [message, ...message.querySelectorAll("*")];
  const positions = new Map(elements.map((el, i) => [el, i]));
  const events = top([...message.querySelectorAll(THINK)]).map((node) => ({
    node,
    part: { kind: "thinking", content: getTextContent(node) },
  }));
  const tools = [];
  for (const entry of metadata.positionedTools || []) {
    const node = elements[entry.nodeIndex];
    if (
      !node ||
      node === message ||
      node.closest(ANSWER) ||
      node.querySelector(THINK)
    )
      continue;
    tools.push({ node, part: entry.tool });
  }
  const candidates = top(
    elements.filter(
      (el) =>
        el !== message &&
        !el.closest(`${THINK}, ${ANSWER}, .ds-markdown`) &&
        !el.querySelector(`${THINK}, ${ANSWER}`) &&
        (el.hasAttribute("data-tool-call") ||
          ((el.textContent || "").length < 600 &&
            LABEL.test(el.textContent.trim()))),
    ),
  );
  for (const node of candidates) {
    if (tools.some((t) => t.node === node || t.node.contains(node))) continue;
    const text = node.getAttribute("data-tool-call") || node.textContent.trim();
    tools.push({
      node,
      part: {
        kind: "tool",
        type: /搜索|search|found/i.test(text) ? "SEARCH" : "TOOL_OPEN",
        content: text,
        results: [...node.querySelectorAll("a[href]")].map((a) => ({
          title: a.textContent.trim(),
          url: a.href,
        })),
      },
    });
  }
  // Open-page chips can be plain links, without a role=button or the word "已".
  for (const node of message.querySelectorAll("a[href]")) {
    if (
      node.closest(`${THINK}, ${ANSWER}, .ds-markdown`) ||
      !/^https?:/.test(node.href) ||
      tools.some((t) => t.node.contains(node))
    )
      continue;
    tools.push({
      node,
      part: {
        kind: "tool",
        type: "TOOL_OPEN",
        result: { title: node.textContent.trim(), url: node.href },
      },
    });
  }
  events.push(...tools);
  events.sort((a, b) => positions.get(a.node) - positions.get(b.node));
  const seen = new Set();
  return events
    .filter(({ part }) => {
      if (part.kind === "thinking") return !!part.content;
      const key = JSON.stringify([
        part.type,
        part.ids,
        part.id,
        part.queries,
        part.results,
        part.result,
        part.content,
      ]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((event) => event.part);
}
