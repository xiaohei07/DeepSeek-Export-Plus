import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import {
  conversationTitle,
  selectRounds,
  safeFilename,
} from "../public/content/conversation.js";
import { formatConversation } from "../public/content/markdown.js";
import { parseShareData } from "../public/content/share.js";
import { readMountedMetadata } from "../public/content/pageMetadata.js";
import { renderMarkdown } from "../public/print/render.js";
import { prepareExport } from "../public/content/exportBundle.js";

test("selected rounds retain original indexes and assistant context", () => {
  const data = {
    title: "测试",
    messages: Array.from({ length: 6 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: String(i),
    })),
  };
  const selected = selectRounds(data, [2, 3]);
  assert.deepEqual(
    selected.messages.map((m) => m.content),
    ["2", "3", "4", "5"],
  );
  const md = formatConversation(selected);
  assert.match(md, /## 第 2 轮/);
  assert.match(md, /## 第 3 轮/);
  assert.doesNotMatch(md, /## 第 1 轮/);
  assert.equal(selectRounds(data, []).messages.length, 0);
});
test("title resolver uses actual title then first prompt; filename handles Windows devices", () => {
  assert.equal(conversationTitle("", [], "区间合并 - DeepSeek"), "区间合并");
  assert.equal(
    conversationTitle(
      "Shared Conversation",
      [{ role: "user", content: "这是问题\n下一行" }],
      "DeepSeek - 探索未至之境",
    ),
    "这是问题",
  );
  assert.equal(safeFilename("CON"), "_CON");
  assert.equal(safeFilename("例:子?"), "例_子_");
});
test("ordinary SEARCH and TOOL_OPEN remain in the same plain blockquote as thinking", () => {
  const data = parseShareData(
    {
      code: 0,
      data: {
        biz_code: 0,
        biz_data: {
          messages: [
            {
              role: "ASSISTANT",
              fragments: [
                { type: "THINK", content: "先查证。" },
                {
                  type: "SEARCH",
                  id: 1,
                  queries: ["example"],
                  results: [{ url: "https://example.org", title: "出处" }],
                },
                { type: "THINK", content: "对照结果。" },
                {
                  type: "TOOL_OPEN",
                  result: { url: "https://example.org/page", title: "页面" },
                },
                { type: "RESPONSE", content: "回答。" },
              ],
            },
          ],
        },
      },
    },
    "",
  );
  const md = formatConversation(data),
    dom = new JSDOM(renderMarkdown(md, new JSDOM("").window));
  assert.equal(dom.window.document.querySelectorAll("blockquote").length, 1);
  assert.equal(dom.window.document.querySelectorAll("blockquote a").length, 2);
  assert.equal(dom.window.document.querySelectorAll("blockquote em").length, 0);
  assert.ok(
    md.indexOf("先查证") < md.indexOf("搜索网页") &&
      md.indexOf("搜索网页") < md.indexOf("对照结果"),
  );
});
test("scoped React array snapshots include ordinary SEARCH with no secret fields", () => {
  const dom = new JSDOM(
    '<div data-dsx-message="m"><span id="child"></span></div>',
  );
  Object.assign(globalThis, {
    document: dom.window.document,
    Element: dom.window.Element,
  });
  document.querySelector("#child").__reactFiber$x = {
    memoizedProps: {},
    memoizedState: {
      memoizedState: {
        value: [
          {
            id: 4,
            type: "SEARCH",
            queries: ["查证"],
            results: [
              { title: "出处", url: "https://example.org", secret: "private" },
            ],
          },
        ],
      },
    },
  };
  const result = readMountedMetadata("m");
  assert.equal(result.tools[0].type, "SEARCH");
  assert.equal(result.tools[0].queries[0], "查证");
  assert.ok(!JSON.stringify(result).includes("private"));
});
test("ordinary search citations become links; inline images appear once and literal code stays intact", async () => {
  const data = parseShareData(
    {
      code: 0,
      data: {
        biz_code: 0,
        biz_data: {
          messages: [
            {
              role: "ASSISTANT",
              fragments: [
                {
                  type: "SEARCH",
                  results: [
                    { title: "资料", url: "https://example.org/source" },
                  ],
                },
                {
                  type: "RESPONSE",
                  content:
                    "来源[citation:1]\n\n![图片](https://example.org/image)\n\n`[citation:1]`\n\n```text\n![例子](https://example.org/not-image)\n```",
                },
              ],
            },
          ],
        },
      },
    },
    "",
  );
  assert.equal(data.messages[0].attachments.length, 1);
  const result = await prepareExport(data, { includeThinking: false });
  assert.equal((result.markdown.match(/!\[图片\]/g) || []).length, 1);
  assert.match(result.markdown, /\[\[1\]\]\(<https:\/\/example.org\/source>\)/);
  assert.match(result.markdown, /`\[citation:1\]`/);
});
test("history observer captures only active-session message fields and leaves fetch response intact", async () => {
  const raw = {
    code: 0,
    data: {
      biz_code: 0,
      biz_data: {
        secret: "account secret",
        chat_messages: [
          {
            message_id: 2,
            role: "ASSISTANT",
            fragments: [
              { type: "THINK", content: "隐藏思考" },
              {
                type: "SEARCH",
                results: [{ url: "https://example.org", title: "来源" }],
              },
              { type: "RESPONSE", content: "正文" },
            ],
          },
        ],
      },
    },
  };
  class XHR {
    open() {}
    send() {}
    addEventListener() {}
  }
  const context = vm.createContext({
    URL,
    Symbol,
    Map,
    WeakMap,
    JSON,
    Reflect,
    XMLHttpRequest: XHR,
    location: {
      href: "https://chat.deepseek.com/a/chat/a",
      origin: "https://chat.deepseek.com",
      pathname: "/a/chat/a",
    },
    fetch: async () => new Response(JSON.stringify(raw)),
  });
  vm.runInContext(
    await readFile(
      new URL("../public/content/historyBridge.js", import.meta.url),
      "utf8",
    ),
    context,
  );
  const response = await context.fetch(
    "https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=a",
  );
  assert.equal((await response.json()).data.biz_data.secret, "account secret");
  await new Promise((resolve) => setTimeout(resolve, 20));
  const message = vm.runInContext(
    "globalThis[Symbol.for('deepseek-export-plus.history')].read(2)",
    context,
  );
  assert.deepEqual(
    Array.from(message.fragments, (f) => f.type),
    ["THINK", "SEARCH", "RESPONSE"],
  );
  assert.ok(!JSON.stringify(message).includes("account secret"));
  context.location.pathname = "/a/chat/b";
  assert.equal(
    vm.runInContext(
      "globalThis[Symbol.for('deepseek-export-plus.history')].read(2)",
      context,
    ),
    null,
  );
  context.location.pathname = "/a/chat/a";
  const originalMessages = raw.data.biz_data.chat_messages;
  raw.data.biz_data.cache_control = "MERGE";
  raw.data.biz_data.chat_messages = [];
  await context.fetch(
    "https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=a",
  );
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(
    vm.runInContext(
      "globalThis[Symbol.for('deepseek-export-plus.history')].read(2)",
      context,
    ),
  );
  raw.data.biz_data.cache_control = "REPLACE";
  await context.fetch(
    "https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=a",
  );
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(
    vm.runInContext(
      "globalThis[Symbol.for('deepseek-export-plus.history')].read(2)",
      context,
    ),
    null,
  );
  raw.data.biz_data.chat_messages = originalMessages;
  await context.fetch(
    "https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=a",
  );
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(
    vm.runInContext(
      "globalThis[Symbol.for('deepseek-export-plus.history')].read(2)",
      context,
    ),
  );
  await context.fetch("https://chat.deepseek.com/api/v0/chat/completion");
  assert.equal(
    vm.runInContext(
      "globalThis[Symbol.for('deepseek-export-plus.history')].read(2)",
      context,
    ),
    null,
  );
});
