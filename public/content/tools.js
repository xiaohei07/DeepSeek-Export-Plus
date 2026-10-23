import { markdownLabel, markdownURL } from "./attachments.js";

export function sourceLink(source, index) {
  const url = source?.url;
  return /^https?:\/\//i.test(url || "")
    ? `[${markdownLabel(source.title || url)}](<${markdownURL(url)}>)`
    : `来源 ${index + 1}（未提供链接）`;
}
export const isToolType = (type) =>
  typeof type === "string" &&
  (type.startsWith("TOOL_") || ["SEARCH", "READ_LINK"].includes(type));
export function toolMarkdown(tool) {
  const label = ["SEARCH", "TOOL_SEARCH"].includes(tool.type)
    ? "搜索网页"
    : ["READ_LINK", "TOOL_OPEN"].includes(tool.type)
      ? "打开网页"
      : tool.label || tool.type || "工具调用";
  const chunks = [`**工具调用 · ${markdownLabel(label)}**`];
  if (tool.status && tool.status !== "FINISHED")
    chunks.push(`状态：${markdownLabel(tool.status)}`);
  if (tool.queries?.length)
    chunks.push(
      "检索词：" +
        tool.queries
          .map((q) => markdownLabel(typeof q === "string" ? q : q.query))
          .join("；"),
    );
  const sources = tool.results?.length
    ? tool.results
    : tool.result
      ? [tool.result]
      : [];
  if (sources.length)
    chunks.push(
      sources.map((s, i) => `${i + 1}. ${sourceLink(s, i)}`).join("\n"),
    );
  else
    chunks.push(
      tool.content ? markdownLabel(tool.content) : "未返回可导出的结果。",
    );
  return chunks.join("\n\n");
}
