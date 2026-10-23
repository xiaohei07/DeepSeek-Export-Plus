// One title/round model shared by the document, filename and export picker.
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
export function safeFilename(title) {
  const text =
    String(title || "")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/[. ]+$/, "")
      .slice(0, 100) || "DeepSeek 对话记录";
  return /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(text)
    ? "_" + text
    : text;
}
