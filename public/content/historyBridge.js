// MAIN world, document_start. Observe only responses the page already requested.
// No extra authenticated request, token, cookie, header or persistent storage access.
const key = Symbol.for("deepseek-export-plus.history");
if (!globalThis[key]) {
  let session = "",
    messages = new Map();
  const current = () => location.pathname.match(/\/chat\/([^/]+)/)?.[1] || "";
  const isHistory = (input) => {
    try {
      const url = new URL(
        typeof input === "string" ? input : input.url,
        location.href,
      );
      return url.origin === location.origin &&
        url.pathname === "/api/v0/chat/history_messages"
        ? url.searchParams.get("chat_session_id")
        : null;
    } catch {
      return null;
    }
  };
  const source = (value) =>
    value ? { title: value.title, url: value.url } : null;
  const invalidateIfChanging = (input) => {
    try {
      const url = new URL(
        typeof input === "string" ? input : input.url,
        location.href,
      );
      if (
        url.origin === location.origin &&
        /^\/api\/v0\/chat\/(completion|regenerate|continue|resume_stream|edit_message)$/.test(
          url.pathname,
        )
      )
        messages.clear();
    } catch {
      /* No access to request bodies or authentication headers. */
    }
  };
  const accept = (id, json) => {
    if (!id || id !== current()) return;
    const data = json?.data?.biz_data;
    if (
      json?.code !== 0 ||
      json?.data?.biz_code !== 0 ||
      !Array.isArray(data?.chat_messages)
    )
      return;
    if (session !== id) {
      session = id;
      messages.clear();
    }
    for (const item of data.chat_messages) {
      if (
        !["USER", "ASSISTANT"].includes(item.role) ||
        !Array.isArray(item.fragments)
      )
        continue;
      // Copy only the export model; never retain a response object or chat-account state.
      const message = {
        message_id: item.message_id,
        role: item.role,
        fragments: item.fragments.map((f) => ({
          id: f.id,
          type: f.type,
          content: typeof f.content === "string" ? f.content : "",
          status: f.status,
          queries: (f.queries || []).map((q) =>
            typeof q === "string" ? q : { query: q.query },
          ),
          results: (f.results || []).map(source),
          result: source(f.result),
          references: (f.references || []).map((r) => ({
            id: r.id,
            type: r.type,
            url: r.url,
          })),
          files: (f.files || []).map((file) => ({
            id: file.id,
            file_name: file.file_name,
            signed_path: file.signed_path,
            file_size: file.file_size,
            is_image: file.is_image,
          })),
        })),
      };
      if (JSON.stringify(message).length < 2_000_000)
        messages.set(String(item.message_id), message);
    }
    // Bound memory, keep most recently read messages. Missing ones use the mounted DOM.
    let size = 0;
    for (const [id, message] of [...messages].reverse()) {
      size += JSON.stringify(message).length;
      if (size > 8_000_000 || messages.size > 500) messages.delete(id);
    }
  };
  Object.defineProperty(globalThis, key, {
    value: {
      read(id) {
        return current() === session ? messages.get(String(id)) || null : null;
      },
    },
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = function (...args) {
    invalidateIfChanging(args[0]);
    const id = isHistory(args[0]);
    const promise = Reflect.apply(originalFetch, this, args);
    if (id)
      promise
        .then((response) => {
          if (response.ok)
            response
              .clone()
              .text()
              .then((text) => {
                if (text.length <= 10_000_000) accept(id, JSON.parse(text));
              })
              .catch(() => {});
        })
        .catch(() => {});
    return promise;
  };
  // DeepSeek releases may use either fetch or XMLHttpRequest for history.
  const requests = new WeakMap(),
    open = XMLHttpRequest.prototype.open,
    send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (...args) {
    invalidateIfChanging(String(args[1]));
    requests.set(this, isHistory(String(args[1])));
    return Reflect.apply(open, this, args);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    const id = requests.get(this);
    if (id)
      this.addEventListener(
        "load",
        () => {
          try {
            if (this.status !== 200) return;
            if (this.responseType === "json") accept(id, this.response);
            else if (
              (!this.responseType || this.responseType === "text") &&
              this.responseText.length <= 10_000_000
            )
              accept(id, JSON.parse(this.responseText));
          } catch {
            /* Site transport must remain unaffected. */
          }
        },
        { once: true },
      );
    return Reflect.apply(send, this, args);
  };
}
