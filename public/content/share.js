import { marked } from "marked";
import { fileFromMetadata, inlineImages } from "./attachments.js";
import { sourceLink, isToolType } from "./tools.js";
import { conversationTitle } from "./conversation.js";

function referenceMarkdown(fragment, fragments) {
  const refs = fragment.references || [];
  const searchSources = fragments
    .filter((f) => f.type === "SEARCH")
    .flatMap((f) => f.results || []);
  // Leave fenced and inline code untouched; reference indexes are local to a fragment.
  return marked
    .lexer(fragment.content || "")
    .map((token) => {
      if (token.type === "code" || token.type === "html") return token.raw;
      return token.raw
        .split(/(`+[^`]*`+)/g)
        .map((part, i) =>
          i % 2
            ? part
            : part
                .replace(/\[citation:(\d+)\]/g, (original, index) => {
                  const source = searchSources[Number(index) - 1];
                  return source?.url && /^https?:\/\//i.test(source.url)
                    ? `[[${index}]](<${source.url.replace(/[<>\s]/g, (c) => encodeURIComponent(c))}>)`
                    : original;
                })
                .replace(/\[reference:(\d+)\]/g, (original, index) => {
                  const ref = refs[Number(index)];
                  if (!ref) return original;
                  const target = fragments.find(
                    (f) => f.id === ref?.id && f.type === ref?.type,
                  );
                  const url = ref?.url || target?.result?.url;
                  if (/^https?:\/\//i.test(url || ""))
                    return `[[${Number(index) + 1}]](<${url.replace(/[<>\s]/g, (c) => encodeURIComponent(c))}>)`;
                  const sources =
                    target?.results?.filter((s) =>
                      /^https?:\/\//i.test(s.url || ""),
                    ) || [];
                  if (sources.length)
                    return `[来源组 ${refs.findIndex((r) => r.id === ref.id && r.type === ref.type) + 1}，见本条回答末尾]`;
                  return `[来源 ${Number(index) + 1}：未提供单独链接]`;
                }),
        )
        .join("");
    })
    .join("")
    .trim();
}

export function parseShareData(json, url, includeThinking = true) {
  const data = json?.data?.biz_data;
  if (
    json?.code !== 0 ||
    json?.data?.biz_code !== 0 ||
    !Array.isArray(data?.messages) ||
    !data.messages.length
  )
    throw new Error("分享数据不可用");
  const warnings = [];
  const messages = data.messages.map((message) => {
    if (
      !["USER", "ASSISTANT"].includes(message.role) ||
      !Array.isArray(message.fragments)
    )
      throw new Error("分享数据结构已变化");
    const role = message.role === "USER" ? "user" : "assistant";
    const fragments = message.fragments;
    const responseFragments = fragments.filter(
      (f) => f.type === (role === "user" ? "REQUEST" : "RESPONSE"),
    );
    let content = responseFragments
      .map((f) => referenceMarkdown(f, fragments))
      .join("\n\n");
    const groups = new Map();
    for (const f of responseFragments)
      for (const [index, ref] of (f.references || []).entries()) {
        const target = fragments.find(
          (t) => t.id === ref.id && t.type === ref.type,
        );
        if (target?.results?.length)
          groups.set(
            f.references.findIndex(
              (r) => r.id === ref.id && r.type === ref.type,
            ) + 1,
            target.results,
          );
      }
    if (groups.size)
      content +=
        "\n\n**正文引用来源**\n\n" +
        [...groups]
          .map(
            ([n, sources]) =>
              `来源组 ${n}（网页未指定其中哪一项，保留整组）：\n\n` +
              sources.map((s, i) => `${i + 1}. ${sourceLink(s, i)}`).join("\n"),
          )
          .join("\n\n");
    const thinking = includeThinking
      ? fragments
          .filter((f) => f.type === "THINK")
          .map((f) => referenceMarkdown(f, fragments))
          .join("\n\n")
      : "";
    const reasoning = includeThinking
      ? fragments
          .filter((f) => f.type === "THINK" || isToolType(f.type))
          .map((f) =>
            f.type === "THINK"
              ? { kind: "thinking", content: referenceMarkdown(f, fragments) }
              : { kind: "tool", ...f },
          )
      : [];
    const attachments = fragments
      .filter((f) => f.type === "FILE")
      .flatMap((f) => (f.files || []).map(fileFromMetadata))
      .filter(Boolean);
    for (const file of inlineImages(content))
      if (!attachments.some((f) => f.url === file.url)) attachments.push(file);
    if (!content && !thinking && !attachments.length && !reasoning.length)
      throw new Error("分享消息包含尚不支持的内容，改用页面提取");
    if (message.status && message.status !== "FINISHED")
      warnings.push(
        `消息 ${message.message_id} 的状态为 ${message.status}，可能未完成。`,
      );
    return {
      id: String(message.message_id),
      role,
      content,
      thinking,
      reasoning,
      attachments,
    };
  });
  return {
    title: conversationTitle(data.title, messages, globalThis.document?.title),
    url,
    messages,
    warnings,
    source: "share-api",
  };
}

export async function fetchShareConversation(
  url,
  includeThinking = true,
  { signal } = {},
) {
  const location = new URL(url);
  const id = location.pathname.match(/^\/share\/([a-z0-9_-]+)\/?$/i)?.[1];
  if (location.hostname !== "chat.deepseek.com" || !id) return null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(
      `${location.origin}/api/v0/share/content?share_id=${encodeURIComponent(id)}`,
      { credentials: "omit", signal: controller.signal },
    );
    if (!response.ok)
      throw new Error(`分享读取失败（HTTP ${response.status}）`);
    return parseShareData(await response.json(), url, includeThinking);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
