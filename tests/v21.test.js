import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { unzipSync, strFromU8 } from "fflate";
import { readMountedMetadata } from "../public/content/pageMetadata.js";
import { extractMessage } from "../public/content/extractor.js";
import { formatConversation } from "../public/content/markdown.js";
import { scrollToLoadAllMessages } from "../public/utils/scrollLoader.js";
import * as bundle from "../public/content/exportBundle.js";

function mount(html) {
  const dom = new JSDOM(html, {
    url: "https://chat.deepseek.com/a/chat/regression",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    Node: dom.window.Node,
    getComputedStyle: dom.window.getComputedStyle,
  });
  return document.querySelector(".ds-message");
}

test("long fully mounted history finishes without walking every screen", async () => {
  mount(
    '<div id="scroll" style="overflow-y:auto">' +
      Array.from(
        { length: 12 },
        (_, i) =>
          `<div class="ds-message" data-message-id="${i}">message ${i}</div>`,
      ).join("") +
      "</div>",
  );
  const scroller = document.querySelector("#scroll");
  let top = 12000,
    moves = 0;
  Object.defineProperties(scroller, {
    scrollHeight: { get: () => 30000 },
    clientHeight: { get: () => 600 },
    scrollTop: {
      get: () => top,
      set: (v) => {
        top = Math.min(29400, Math.max(0, v));
        moves++;
      },
    },
  });
  const seen = [],
    progress = [];
  await scrollToLoadAllMessages({
    maxSteps: 8,
    visit: (node) => seen.push(node.dataset.messageId),
    onProgress: (text) => progress.push(text),
  });
  assert.deepEqual(
    seen,
    Array.from({ length: 12 }, (_, i) => String(i)),
  );
  assert.ok(moves <= 7, `unnecessary scrolls: ${moves}`);
  assert.equal(top, 12000);
  assert.ok(progress.some((text) => /检查|加载/.test(text)));
});

test("scoped React selector snapshots recover interleaved thinking and grouped open URLs", () => {
  mount(
    '<div class="ds-message" data-dsx-message="m"><div id="groups"></div><div id="think1"></div><div id="search"></div><div id="think2"></div><div id="open"></div></div>',
  );
  const fiber = (id, props, value) => {
    document.getElementById(id).__reactFiber$test = {
      memoizedProps: { messageId: 2, ...props },
      memoizedState: { memoizedState: { value } },
    };
  };
  fiber("groups", {}, [
    { type: "generalFragment", id: 2, fragmentType: "THINK" },
    { type: "parallelGroup", ids: [3], toolType: "TOOL_SEARCH" },
    { type: "generalFragment", id: 4, fragmentType: "THINK" },
    { type: "parallelGroup", ids: [5, 6], toolType: "TOOL_OPEN" },
  ]);
  fiber(
    "think1",
    { fragmentId: 2 },
    { type: "THINK", id: 2, content: "before search" },
  );
  fiber(
    "search",
    { ids: [3] },
    {
      status: "detailed",
      results: {
        queries: [{ query: "test query" }],
        results: [{ title: "Search", url: "https://example.org/search" }],
      },
    },
  );
  fiber(
    "think2",
    { fragmentId: 4 },
    { type: "THINK", id: 4, content: "before open" },
  );
  fiber("open", { ids: [5, 6] }, [
    { title: "Opened A", url: "https://example.org/a" },
    { title: "Opened B", url: "https://example.org/b" },
  ]);
  const metadata = readMountedMetadata("m");
  assert.deepEqual(
    metadata.reasoning.map((p) => (p.kind === "thinking" ? "THINK" : p.type)),
    ["THINK", "TOOL_SEARCH", "THINK", "TOOL_OPEN"],
  );
  assert.equal(metadata.reasoning[1].queries[0].query, "test query");
  assert.deepEqual(
    metadata.reasoning[3].results.map((s) => s.url),
    ["https://example.org/a", "https://example.org/b"],
  );
});

test("DOM fallback retains tool links between thinking fragments rather than appending tools", () => {
  const root = mount(
    '<div class="ds-message" data-role="assistant"><div class="ds-think-content"><div class="ds-markdown">先查资料</div></div><div data-tool-call="搜索网页"><a href="https://example.org/search">搜索结果</a></div><div class="ds-think-content"><div class="ds-markdown">核对资料</div></div><div class="tool-open"><span>阅读了2个网页</span><a href="https://example.org/a">资料A</a><a href="https://example.org/b">资料B</a></div><div class="ds-think-content"><div class="ds-markdown">得到结论</div></div><div class="ds-assistant-message-main-content ds-markdown">答案</div></div>',
  );
  const record = extractMessage(root);
  const md = formatConversation({ messages: [record] });
  const offsets = [
    "先查资料",
    "https://example.org/search",
    "核对资料",
    "https://example.org/a",
    "得到结论",
  ].map((x) => md.indexOf(x));
  assert.ok(
    offsets.every((v, i) => v >= 0 && (!i || v > offsets[i - 1])),
    offsets.join(","),
  );
  assert.match(md, /https:\/\/example.org\/b/);
  assert.doesNotMatch(record.content, /阅读了|工具调用/);
});

test("available message sources survive answer-only DOM export", () => {
  const root = mount(
    '<div class="ds-message" data-role="assistant"><div class="ds-assistant-message-main-content ds-markdown">答案</div></div>',
  );
  const record = extractMessage(root, 0, false, {
    sources: [{ title: "Reference", url: "https://example.org/ref" }],
  });
  assert.match(record.content, /https:\/\/example.org\/ref/);
  assert.equal(record.thinking, "");
});

test("file selection produces one archive, unique filenames and a partial failure report", async () => {
  assert.equal(typeof bundle.prepareAttachmentArchive, "function");
  const result = await bundle.prepareAttachmentArchive(
    [
      { filename: "demo.md", url: "a", size: 3 },
      { filename: "demo.md", url: "b", size: 3 },
      { filename: "failed.pptx", url: "bad" },
    ],
    {
      read: async (f) => {
        if (f.url === "bad") throw new Error("expired");
        return "data:text/plain;base64,YWJj";
      },
    },
  );
  const files = unzipSync(result.zip);
  assert.equal(strFromU8(files["assets/001-demo.md"]), "abc");
  assert.equal(strFromU8(files["assets/002-demo.md"]), "abc");
  assert.equal(
    Object.keys(files).filter((k) => k.startsWith("assets/")).length,
    2,
  );
  assert.equal(result.saved, 2);
  assert.equal(result.failed, 1);
  assert.match(strFromU8(files["附件清单.json"]), /expired/);
  assert.equal(files["对话.md"], undefined);
});
