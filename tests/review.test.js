import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  getTextContent,
  formatConversation,
} from "../public/content/markdown.js";
import { parseShareData } from "../public/content/share.js";
import { renderMarkdown } from "../public/print/render.js";
import { prepareExport } from "../public/content/exportBundle.js";
import { unzipSync, strFromU8 } from "fflate";
import { readMountedMetadata } from "../public/content/pageMetadata.js";

const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=";

test("new code banner preserves language without copy/download labels", () => {
  const dom = new JSDOM(
    '<div class="md-code-block"><div class="md-code-block-banner"><div><span>python</span></div><div><button>复制</button><button>下载</button></div></div><pre>print(1)</pre></div>',
  );
  assert.equal(
    getTextContent(dom.window.document.body),
    "```python\nprint(1)\n```",
  );
});

test("offline ZIP contains exact attachment bytes, images and portable relative links", async () => {
  const conversation = {
    messages: [
      {
        role: "user",
        content: "图片",
        attachments: [
          { filename: "../demo.md", size: 3, url: "https://example.org/md" },
          {
            filename: "image.png",
            isImage: true,
            url: "https://example.org/img",
          },
        ],
      },
    ],
  };
  const result = await prepareExport(conversation, {
    offline: true,
    read: async (file) =>
      file.isImage ? pixel : "data:application/octet-stream;base64,YWJj",
  });
  const files = unzipSync(result.zip);
  assert.equal(strFromU8(files["assets/001-.._demo.md"]), "abc");
  assert.ok(files["assets/002-image.png"]);
  assert.match(
    strFromU8(files["对话.md"]),
    /!\[image.png\]\(<assets\/002-image.png>\)/,
  );
  assert.equal(result.warnings.length, 0);
});

test("failed attachments are listed without inventing an original file", async () => {
  const result = await prepareExport(
    {
      messages: [
        {
          role: "user",
          content: "a",
          attachments: [{ filename: "a.pptx", size: 99, url: "x" }],
        },
      ],
    },
    { offline: true, read: async () => "data:text/plain;base64,YWJj" },
  );
  const files = unzipSync(result.zip);
  assert.deepEqual(
    Object.keys(files).sort(),
    ["对话.md", "附件清单.json"].sort(),
  );
  assert.match(result.markdown, /文件大小不符/);
});

test("PDF embeds loaded images and leaves remote images as explicit links", async () => {
  const result = await prepareExport(
    {
      messages: [
        {
          role: "assistant",
          content:
            "![图](https://example.org/image)\n\n```text\n![图](https://example.org/image)\n```",
        },
      ],
    },
    { forPrint: true, read: async () => pixel },
  );
  const doc = new JSDOM(renderMarkdown(result.markdown, new JSDOM("").window))
    .window.document;
  assert.equal(doc.querySelectorAll("img").length, 1);
  assert.match(
    doc.querySelector("pre").textContent,
    /https:\/\/example.org\/image/,
  );
});

test("page metadata is scoped to mounted message and only returns attachment fields", () => {
  const dom = new JSDOM(
    '<div data-dsx-message="demo"><span id="file">demo.pptx</span></div><div id="other"></div>',
  );
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  document.querySelector("#file").__reactFiber$test = {
    memoizedProps: {
      file: {
        fileName: "demo.pptx",
        signedPath: "/file?file_id=1",
        fileSize: 8,
        secret: "never return",
      },
    },
  };
  document.querySelector("#other").__reactFiber$test = {
    memoizedProps: {
      file: { fileName: "other.pptx", signedPath: "/file?file_id=2" },
    },
  };
  const result = readMountedMetadata("demo");
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].fileName, "demo.pptx");
  assert.ok(!JSON.stringify(result).includes("never return"));
});

test("mounted message snapshot retains collapsed thinking and full tool order", () => {
  const dom = new JSDOM(
    '<div data-dsx-message="demo" data-message-id="2"><span id="answer">回答</span></div>',
  );
  Object.assign(globalThis, {
    document: dom.window.document,
    Element: dom.window.Element,
  });
  document.querySelector("#answer").__reactFiber$test = {
    memoizedProps: {},
    memoizedState: {
      memoizedState: {
        value: {
          id: 2,
          role: "assistant",
          fragments: [
            { type: "THINK", content: "折叠思考" },
            {
              type: "TOOL_SEARCH",
              queries: [{ query: "查证" }],
              results: [{ title: "出处", url: "https://example.org" }],
            },
            { type: "RESPONSE", content: "回答" },
          ],
          secret: "never serialize",
        },
      },
    },
  };
  const result = readMountedMetadata("demo");
  assert.deepEqual(
    result.message.fragments.map((f) => f.type),
    ["THINK", "TOOL_SEARCH", "RESPONSE"],
  );
  assert.ok(!JSON.stringify(result).includes("never serialize"));
});
test("thinking is a plain quote and fenced code stays code", () => {
  const md = formatConversation({
    messages: [
      {
        role: "assistant",
        thinking: "思考 **重点** 与 `code`。\n\n```python\nx=1\n```",
        content: "正文",
      },
    ],
  });
  const dom = new JSDOM(renderMarkdown(md, new JSDOM("").window));
  assert.equal(dom.window.document.querySelector("blockquote em"), null);
  assert.match(
    dom.window.document.querySelector("blockquote").textContent,
    /思考 重点/,
  );
  assert.equal(
    dom.window.document.querySelector("blockquote pre code").textContent.trim(),
    "x=1",
  );
});
test("share keeps files, tool order, search group sources and null tool result", () => {
  const json = {
    code: 0,
    data: {
      biz_code: 0,
      biz_data: {
        messages: [
          {
            role: "USER",
            fragments: [
              {
                type: "FILE",
                files: [
                  {
                    id: "file-1",
                    file_name: "a.md",
                    file_size: 3,
                    signed_path: "/file?file_id=1&state=demo",
                    is_image: false,
                  },
                ],
              },
            ],
          },
          {
            role: "ASSISTANT",
            fragments: [
              { type: "THINK", content: "先查资料" },
              {
                id: 2,
                type: "TOOL_SEARCH",
                queries: [{ query: "query" }],
                results: [
                  { title: "source", url: "https://example.org/source" },
                ],
              },
              { type: "THINK", content: "再思考" },
              { id: 4, type: "TOOL_OPEN", result: null },
              {
                type: "RESPONSE",
                content: "结果[reference:0]",
                references: [{ id: 2, type: "TOOL_SEARCH" }],
              },
            ],
          },
        ],
      },
    },
  };
  const data = parseShareData(json, "https://chat.deepseek.com/share/test");
  assert.equal(data.messages[0].attachments[0].filename, "a.md");
  const md = formatConversation(data);
  assert.ok(md.indexOf("先查资料") < md.indexOf("query"));
  assert.ok(md.indexOf("query") < md.indexOf("再思考"));
  assert.match(md, /https:\/\/example.org\/source/);
  assert.match(md, /未返回可导出的结果/);
  assert.match(
    formatConversation(data, false),
    /https:\/\/example.org\/source/,
  );
});
