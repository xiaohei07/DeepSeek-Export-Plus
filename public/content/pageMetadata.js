// Executed in MAIN world by the extension worker, scoped to one mounted message.
export function readMountedMetadata(marker) {
  const root = document.querySelector(`[data-dsx-message="${marker}"]`);
  if (!root) return { files: [], tools: [] };
  const files = new Map(),
    tools = new Map(),
    sources = new Map(),
    visited = new Set(),
    objects = new Set();
  let message = null,
    id = root.getAttribute("data-message-id");
  const toolType = (type) =>
    typeof type === "string" &&
    (type.startsWith("TOOL_") || ["SEARCH", "READ_LINK"].includes(type));
  const cleanSource = (s) => ({ title: s?.title, url: s?.url });
  const cleanFile = (f) => ({
    id: f.id,
    fileName: f.fileName || f.file_name,
    signedPath: f.signedPath || f.signed_path,
    fileSize: f.fileSize ?? f.file_size,
    isImage: f.isImage ?? f.is_image,
  });
  const cleanFragment = (f) => ({
    id: f.id,
    type: f.type,
    content: typeof f.content === "string" ? f.content : "",
    status: f.status,
    references: (f.references || []).map((r) => ({
      id: r.id,
      type: r.type,
      url: r.url,
    })),
    queries: (f.queries || []).map((q) =>
      typeof q === "string" ? q : { query: q.query },
    ),
    results: (f.results || []).map(cleanSource),
    result: f.result ? cleanSource(f.result) : null,
    files: (f.files || []).map(cleanFile),
  });
  const inspect = (value, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 3 || objects.has(value))
      return;
    objects.add(value);
    if (Array.isArray(value)) {
      value.slice(0, 500).forEach((v) => inspect(v, depth + 1));
      return;
    }
    if (
      Array.isArray(value.fragments) &&
      ["USER", "ASSISTANT"].includes(String(value.role).toUpperCase())
    ) {
      const candidateId = value.id ?? value.message_id;
      if (!id || String(candidateId) === String(id))
        message = {
          message_id: candidateId,
          role: String(value.role).toUpperCase(),
          fragments: value.fragments
            .filter((f) => typeof f?.type === "string")
            .map(cleanFragment),
        };
    }
    if (
      (value.fileName || value.file_name) &&
      (value.signedPath || value.signed_path)
    ) {
      const f = cleanFile(value);
      files.set(f.id || f.signedPath, f);
    }
    if (toolType(value.type))
      tools.set(
        value.id ?? JSON.stringify(value.queries || value.results),
        cleanFragment(value),
      );
    if (
      typeof value.url === "string" &&
      /^https?:\/\//.test(value.url) &&
      typeof value.title === "string"
    )
      sources.set(value.url, cleanSource(value));
    // React snapshots and useMemo tuples, never arbitrary object graphs or stores.
    for (const field of [
      "value",
      "current",
      "message",
      "fragment",
      "fragments",
      "file",
      "files",
      "results",
    ])
      inspect(value[field], depth + 1);
  };
  for (const node of [root, ...root.querySelectorAll("*")].slice(0, 6000)) {
    const key = Object.keys(node).find((k) => k.startsWith("__reactFiber$"));
    let fiber = key && node[key];
    for (
      let i = 0;
      fiber && i < 30 && !visited.has(fiber);
      i++, fiber = fiber.return
    ) {
      if (fiber.stateNode instanceof Element && !root.contains(fiber.stateNode))
        break;
      visited.add(fiber);
      const props = fiber.memoizedProps;
      if (props && typeof props === "object") {
        if (props.messageId != null && !id) id = props.messageId;
        inspect(props);
      }
      let hook = fiber.memoizedState;
      for (let h = 0; hook && h < 50; h++, hook = hook.next) {
        inspect(hook.memoizedState);
        inspect(hook.queue);
      }
    }
  }
  const cached =
    id != null
      ? globalThis[Symbol.for("deepseek-export-plus.history")]?.read(id)
      : null;
  // A live mounted message wins over the earlier history response after regeneration.
  if (!message && cached) message = cached;
  if (!tools.size && sources.size)
    tools.set("sources", {
      type: "SEARCH",
      label: "网页来源",
      results: [...sources.values()],
    });
  return { files: [...files.values()], tools: [...tools.values()], message };
}

export async function messageMetadata(element) {
  if (!globalThis.chrome?.runtime?.sendMessage) return { files: [], tools: [] };
  const marker = crypto.randomUUID();
  element.dataset.dsxMessage = marker;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "READ_MESSAGE_METADATA",
      marker,
    });
    return response?.success
      ? response.data
      : { files: [], tools: [], unavailable: true };
  } catch {
    return { files: [], tools: [], unavailable: true };
  } finally {
    delete element.dataset.dsxMessage;
  }
}
