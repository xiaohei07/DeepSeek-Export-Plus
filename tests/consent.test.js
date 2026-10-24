import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { hasConsent } from "../public/privacy/consent.js";
import { renderMarkdown } from "../public/print/render.js";

test("consent requires an explicit current-version grant; history is not a static script", async () => {
  for (const value of [
    undefined,
    null,
    true,
    { granted: true },
    { version: 0, granted: true },
    { version: 1, granted: false },
  ])
    assert.equal(hasConsent(value), false);
  assert.equal(hasConsent({ version: 1, granted: true }), true);
  const manifest = JSON.parse(
    await readFile(new URL("../public/manifest.json", import.meta.url), "utf8"),
  );
  assert.ok(
    !manifest.content_scripts.some((s) =>
      s.js?.includes("content/historyBridge.js"),
    ),
  );
  assert.equal(manifest.options_page, "privacy/index.html");
});

test("revocation clears retained history, restores transport and ignores late fetch/XHR responses", async () => {
  const handlers = new Map();
  class XHR {
    open() {}
    send() {}
    addEventListener(type, handler) {
      handlers.set(this, handler);
    }
  }
  const originalOpen = XHR.prototype.open,
    originalSend = XHR.prototype.send;
  let finish;
  const originalFetch = () => new Promise((resolve) => (finish = resolve));
  const context = vm.createContext({
    URL,
    Symbol,
    Map,
    WeakMap,
    JSON,
    Reflect,
    XMLHttpRequest: XHR,
    fetch: originalFetch,
    location: {
      href: "https://chat.deepseek.com/a/chat/a",
      origin: "https://chat.deepseek.com",
      pathname: "/a/chat/a",
    },
  });
  const code = await readFile(
    new URL("../public/content/historyBridge.js", import.meta.url),
    "utf8",
  );
  const install = () => vm.runInContext(`(()=>{${code}})()`, context);
  const key = Symbol.for("deepseek-export-plus.history");
  const payload = {
    code: 0,
    data: {
      biz_code: 0,
      biz_data: {
        chat_messages: [
          {
            message_id: 1,
            role: "ASSISTANT",
            fragments: [{ type: "THINK", content: "cache" }],
          },
        ],
      },
    },
  };
  install();
  const bridge = context[key];
  const request = context.fetch(
    "/api/v0/chat/history_messages?chat_session_id=a",
  );
  const xhr = new XHR();
  xhr.open("GET", "/api/v0/chat/history_messages?chat_session_id=a");
  xhr.send();
  bridge.stop();
  assert.equal(context.fetch, originalFetch);
  assert.equal(XHR.prototype.open, originalOpen);
  assert.equal(XHR.prototype.send, originalSend);
  finish(new Response(JSON.stringify(payload)));
  await request;
  xhr.status = 200;
  xhr.responseType = "json";
  xhr.response = payload;
  handlers.get(xhr)();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(bridge.read(1), null);
  assert.equal(context[key], undefined);
  install();
  const active = context[key];
  const next = context.fetch("/api/v0/chat/history_messages?chat_session_id=a");
  finish(new Response(JSON.stringify(payload)));
  await next;
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(active.read(1).fragments[0].content, "cache");
  active.stop();
  assert.equal(active.read(1), null);
});

test("math SVG strokes survive sanitization while conversation HTML remains inert", () => {
  const windowObject = new JSDOM("").window;
  const rendered = renderMarkdown(
    "$\\sqrt{x^2+1}$\n\n<svg onload=alert(1)><script>alert(2)</script></svg>",
    windowObject,
  );
  const doc = new JSDOM(rendered).window.document;
  assert.ok(doc.querySelector(".katex svg path"));
  assert.equal(doc.querySelectorAll("script,[onload]").length, 0);
});
