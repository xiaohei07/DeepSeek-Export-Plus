// Executed in MAIN world by the extension worker, scoped to one mounted message.
export function readMountedMetadata(marker) {
  const root = document.querySelector(`[data-dsx-message="${marker}"]`);
  if (!root) return { files: [], tools: [] };
  const files = new Map(),
    tools = new Map(),
    sources = new Map(),
    visited = new Set(),
    objects = new Set();
  const fragments = new Map(),
    contexts = [];
  let groups = [],
    inspected = 0;
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
  const inspect = (value, depth = 0, context = null) => {
    const seen = context?.seen || objects;
    if (
      !value ||
      typeof value !== "object" ||
      value instanceof Element ||
      depth > 6 ||
      seen.has(value) ||
      ++inspected > 60000
    )
      return;
    seen.add(value);
    if (Array.isArray(value)) {
      const layout = value.filter(
        (v) =>
          v &&
          ["generalFragment", "parallelGroup", "searchGroup"].includes(v.type),
      );
      if (layout.length > groups.length)
        groups = layout.map((v) => ({
          type: v.type,
          id: v.id,
          ids: v.ids,
          fragmentType: v.fragmentType,
          toolType: v.toolType,
        }));
      if (context && value.length && value.every((v) => typeof v === "string"))
        context.strings.push(...value.slice(0, 100));
      value.slice(0, 500).forEach((v) => inspect(v, depth + 1, context));
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
        value.type +
          ":" +
          (value.id ??
            JSON.stringify([value.queries, value.results, value.result])),
        cleanFragment(value),
      );
    if (
      value.id != null &&
      (toolType(value.type) ||
        ["THINK", "RESPONSE", "REQUEST"].includes(value.type))
    )
      fragments.set(value.type + ":" + value.id, cleanFragment(value));
    if (context && Array.isArray(value.queries))
      context.queries.push(
        ...value.queries
          .map((q) =>
            typeof q === "string" ? { query: q } : { query: q?.query },
          )
          .filter((q) => typeof q.query === "string"),
      );
    if (
      typeof value.url === "string" &&
      /^https?:\/\//.test(value.url) &&
      typeof value.title === "string"
    ) {
      sources.set(value.url, cleanSource(value));
      context?.sources.set(value.url, cleanSource(value));
    }
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
      "result",
      "queries",
      "sources",
    ])
      inspect(value[field], depth + 1, context);
  };
  const elements = [root, ...root.querySelectorAll("*")].slice(0, 6000);
  for (const [nodeIndex, node] of elements.entries()) {
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
      if (
        props?.messageId != null &&
        id != null &&
        String(props.messageId) !== String(id)
      )
        break;
      const context = {
        nodeIndex,
        ids: Array.isArray(props?.ids)
          ? props.ids
          : Array.isArray(props?.fragmentIds)
            ? props.fragmentIds
            : props?.fragmentId != null
              ? [props.fragmentId]
              : [],
        sources: new Map(),
        queries: [],
        strings: [],
        seen: new Set(),
      };
      contexts.push(context);
      if (props && typeof props === "object") {
        if (props.messageId != null && !id) id = props.messageId;
        inspect(props, 0, context);
      }
      let hook = fiber.memoizedState;
      for (let h = 0; hook && h < 50; h++, hook = hook.next) {
        inspect(hook.memoizedState, 0, context);
        inspect(hook.queue, 0, context);
      }
    }
  }
  const cached =
    id != null
      ? globalThis[Symbol.for("deepseek-export-plus.history")]?.read(id)
      : null;
  // A live mounted message wins over the earlier history response after regeneration.
  if (!message && cached) message = cached;
  const reasoning = [],
    positionedTools = [];
  let reasoningComplete = groups.length > 0;
  for (const group of groups) {
    const type =
      group.fragmentType ||
      group.toolType ||
      (group.type === "searchGroup" ? "SEARCH" : "");
    const ids = group.ids || [group.id];
    const found = ids
      .map((id) => fragments.get(type + ":" + id))
      .filter(Boolean);
    if (type === "THINK") {
      if (found.length && found.every((f) => f.content))
        reasoning.push(...found.map((f) => ({ kind: "thinking", ...f })));
      else reasoningComplete = false;
      continue;
    }
    if (!toolType(type)) continue;
    const matching = contexts.filter(
      (c) => c.ids.length && c.ids.every((id) => ids.includes(id)),
    );
    const groupSources = new Map(),
      queries = new Map();
    for (const c of matching) {
      for (const [url, s] of c.sources) groupSources.set(url, s);
      for (const q of c.queries) queries.set(q.query, q);
      if (["SEARCH", "TOOL_SEARCH"].includes(type) && !c.queries.length)
        for (const q of c.strings)
          if (!/^https?:/.test(q)) queries.set(q, { query: q });
    }
    const parts =
      found.length === ids.length
        ? found
        : [
            {
              type,
              ids,
              queries: [...queries.values()],
              results: [...groupSources.values()],
            },
          ];
    for (const part of parts) {
      const tool = { kind: "tool", ...part };
      reasoning.push(tool);
      if (matching.length)
        positionedTools.push({
          nodeIndex: Math.min(...matching.map((c) => c.nodeIndex)),
          tool,
        });
      if (
        !part.results?.length &&
        !part.result &&
        !part.content &&
        part.status !== "FAILED"
      )
        reasoningComplete = false;
    }
  }
  return {
    files: [...files.values()],
    tools: [...tools.values()],
    sources: [...sources.values()],
    message,
    reasoning,
    reasoningComplete,
    positionedTools,
  };
}

export async function messageMetadata(element) {
  if (!globalThis.chrome?.runtime?.sendMessage) return { files: [], tools: [] };
  const marker = crypto.randomUUID();
  element.dataset.dsxMessage = marker;
  let timer;
  try {
    const response = await Promise.race([
      chrome.runtime.sendMessage({
        type: "READ_MESSAGE_METADATA",
        marker,
      }),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), 5000);
      }),
    ]);
    return response?.success
      ? response.data
      : { files: [], tools: [], unavailable: true };
  } catch {
    return { files: [], tools: [], unavailable: true };
  } finally {
    clearTimeout(timer);
    delete element.dataset.dsxMessage;
  }
}
