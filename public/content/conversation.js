// Shared pages lack a reliable conversation title; do not promote a prompt to H1.
export function isSharedConversation(conversation) {
  if (!conversation.url) return conversation.source === "share-api";
  try {
    const url = new URL(conversation.url);
    return (
      url.hostname === "chat.deepseek.com" &&
      /^\/share\/[^/]+\/?$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}
export function documentTitle(conversation) {
  return isSharedConversation(conversation)
    ? "DeepSeek 对话记录"
    : String(conversation.title || "DeepSeek 对话记录")
        .replace(/[\r\n]/g, " ")
        .trim();
}
export function timestampedFilename(title, extension = "", date = new Date()) {
  const pad = (number, length = 2) => String(number).padStart(length, "0");
  const time = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  return `${safeFilename(title)}_${time}${extension ? "." + extension : ""}`;
}

// Resolve chat titles and preserve original round numbers for partial exports.
export function conversationTitle(title, messages = [], pageTitle = "") {
  const clean = (value) =>
    String(value || "")
      .replace(/\s*[-—|]\s*DeepSeek.*$/i, "")
      .replace(/[\r\n]+/g, " ")
      .trim();
  const generic =
    /^(?:DeepSeek(?:\s*对话记录)?(?:\s*[-—|]\s*探索未至之境)?|Shared Conversation|探索未至之境)$/i;
  for (const value of [title, pageTitle]) {
    const text = clean(value);
    if (text && !generic.test(text)) return text.slice(0, 150);
  }
  const first = messages.find((m) => m.role === "user" && m.content?.trim());
  return first
    ? first.content
        .trim()
        .split("\n")[0]
        .replace(/^#+\s*/, "")
        .slice(0, 60)
    : "DeepSeek 对话记录";
}
export function conversationRounds(messages) {
  const rounds = [];
  for (const message of messages) {
    if (message.role === "user" || !rounds.length)
      rounds.push({ number: message.round || rounds.length + 1, messages: [] });
    rounds.at(-1).messages.push({ ...message, round: rounds.at(-1).number });
  }
  return rounds;
}
export function selectRounds(conversation, numbers) {
  const selected = new Set(numbers);
  return {
    ...conversation,
    messages: conversationRounds(conversation.messages)
      .filter((r) => selected.has(r.number))
      .flatMap((r) => r.messages),
  };
}
export function safeFilename(title, maximum = 100) {
  const text =
    String(title || "")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/[. ]+$/, "")
      .slice(0, maximum)
      .replace(/[. ]+$/, "") || "DeepSeek 对话记录";
  return /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(text)
    ? "_" + text
    : text;
}
