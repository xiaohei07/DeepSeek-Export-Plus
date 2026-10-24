import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { unzipSync, strFromU8 } from "fflate";
import { prepareExport } from "../public/content/exportBundle.js";
import { conversationJSON, markdownToText } from "../public/content/formats.js";
import { selectRounds } from "../public/content/conversation.js";

const windowObject = new JSDOM("").window;
const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=";
const conversation = {
  title: "恶意</title><script>alert(1)</script>",
  url: "https://chat.deepseek.com/share/example",
  privateState: "DO_NOT_EXPORT",
  messages: [
    { role: "user", content: "第一轮" },
    { role: "assistant", content: "第一条回答" },
    { role: "user", content: "第二轮" },
    {
      role: "assistant",
      content:
        "## 正文标题\n\n```python\ncount += delta\nprint('a_*')\n```\n\n[文档](https://example.org/docs)\n\n公式：$a^2+b^2=c^2$\n\n| 名称 | 数量 |\n| --- | --- |\n| A | 3 |",
      secret: "DO_NOT_EXPORT",
      thinking: "不公开的思考",
      reasoning: [
        { kind: "thinking", content: "先思考", secret: "DO_NOT_EXPORT" },
        {
          kind: "tool",
          type: "SEARCH",
          queries: [{ query: "检索词", secret: "DO_NOT_EXPORT" }],
          results: [
            {
              title: "来源",
              url: "https://example.org/source",
              secret: "DO_NOT_EXPORT",
            },
          ],
        },
        { kind: "thinking", content: "再思考" },
      ],
    },
  ],
};

test("JSON omits unselected thinking and internal fields, keeps original rounds and ordered tools when requested", () => {
  const selected = selectRounds(conversation, [2]);
  const without = conversationJSON(selected);
  assert.doesNotMatch(without, /DO_NOT_EXPORT|reasoning|先思考|检索词|不公开/);
  const json = JSON.parse(without);
  assert.equal(json.title, "DeepSeek 对话记录");
  assert.deepEqual(
    json.rounds.map((r) => r.number),
    [2],
  );
  assert.equal(json.rounds[0].messages[1].name, "DeepSeek");
  const withThinking = conversationJSON(selected, { includeThinking: true });
  assert.doesNotMatch(withThinking, /DO_NOT_EXPORT/);
  assert.deepEqual(
    JSON.parse(withThinking).rounds[0].messages[1].reasoning.map((p) => p.kind),
    ["thinking", "tool", "thinking"],
  );
  assert.match(JSON.parse(withThinking).exportedAt, /\d{2}:\d{2}:\d{2}Z$/);
});

test("TXT preserves code literals, tables, lists, links and quote boundaries", () => {
  const md =
    "# 标题\n\n**加粗**与`a_b`。\n\n```python\ncount += delta\na_* = '## literal'\n```\n\n> 思考\n>\n> [来源](https://example.org)\n\n3. 第三项\n4. 第四项\n\n| 名称 | 数量 |\n| --- | --- |\n| A | 3 |\n\n![图](assets/p.png)";
  const txt = markdownToText(md);
  assert.match(txt, /加粗与a_b/);
  assert.match(txt, /count \+= delta\na_\* = '## literal'/);
  assert.match(txt, /> 来源 \(https:\/\/example.org\)/);
  assert.match(txt, /3\. 第三项\n4\. 第四项/);
  assert.match(txt, /名称\t数量\nA\t3/);
  assert.match(txt, /\[图片：图\] \(assets\/p.png\)/);
  assert.doesNotMatch(txt, /```|\*\*加粗/);
});

test("each single format is a direct document when no assets are requested", async () => {
  for (const format of ["md", "html", "txt", "json"]) {
    const result = await prepareExport(selectRounds(conversation, [2]), {
      formats: [format],
      windowObject,
    });
    assert.equal(result.zip, null);
    assert.equal(result.extension, format);
    assert.ok(result.content.length > 100);
    assert.doesNotMatch(result.content, /先思考|检索词|DO_NOT_EXPORT/);
    assert.equal(Object.keys(result.documents).length, 1);
  }
});

test("HTML uses native MathML, plain thinking quotes and no executable conversation HTML or remote image loads", async () => {
  const data = structuredClone(conversation);
  data.url = "https://chat.deepseek.com/a/chat/example";
  data.messages.at(-1).content +=
    '\n\n<img src="https://example.org/track" onerror="alert(1)"><script>alert(1)</script>\n\n[bad](javascript:alert%281%29)\n\n![remote](https://example.org/p.png)\n\n![traversal](assets/%2e%2e%2fsecret.png)\n\n[返回正文](#正文标题)\n\n## 正文标题\n\n重复标题';
  const result = await prepareExport(data, {
    formats: ["html"],
    includeThinking: true,
    windowObject,
  });
  const doc = new JSDOM(result.content).window.document;
  assert.equal(doc.title, data.title);
  assert.equal(
    doc.querySelectorAll("script,iframe,form,object,embed,link").length,
    0,
  );
  assert.equal(doc.querySelectorAll("[onerror], [onclick],img").length, 0);
  assert.ok(doc.querySelector("math"));
  assert.ok(doc.querySelector('[id="正文标题"]'));
  assert.ok(doc.querySelector('[id="正文标题-1"]'));
  assert.equal(
    [...doc.querySelectorAll("a")].find(
      (link) =>
        decodeURIComponent(link.getAttribute("href") || "") === "#正文标题",
    ).textContent,
    "返回正文",
  );
  assert.equal(doc.querySelectorAll("blockquote em").length, 0);
  assert.ok(
    doc.querySelector('blockquote a[href="https://example.org/source"]'),
  );
  assert.equal(doc.querySelector('a[href^="javascript:"]'), null);
  assert.equal(doc.querySelector('a[href^="assets/%2e"]'), null);
  assert.match(
    doc.querySelector('[http-equiv="Content-Security-Policy"]').content,
    /default-src 'none'/,
  );
});

test("multi-format ZIP fetches shared assets once, handles encoded filenames and never mutates source", async () => {
  const data = structuredClone(conversation);
  const original = structuredClone(data);
  data.messages[2].attachments = [
    {
      filename: "图 #1 %.png",
      isImage: true,
      preview: true,
      url: "https://example.org/p.png",
    },
  ];
  data.messages[3].content += "\n\n![图](https://example.org/p.png)";
  let reads = 0;
  const result = await prepareExport(selectRounds(data, [2]), {
    formats: ["md", "html", "txt", "json", "json"],
    offline: true,
    windowObject,
    read: async () => {
      reads++;
      return pixel;
    },
  });
  const files = unzipSync(result.zip);
  assert.equal(reads, 1);
  assert.deepEqual(
    Object.keys(files)
      .filter((name) => name.startsWith("对话."))
      .sort(),
    ["对话.html", "对话.json", "对话.md", "对话.txt"],
  );
  assert.equal(
    Object.keys(files).filter((name) => name.startsWith("assets/")).length,
    1,
  );
  const json = JSON.parse(strFromU8(files["对话.json"]));
  const path = json.rounds[0].messages[0].attachments[0].path;
  assert.ok(files[decodeURIComponent(path)]);
  assert.ok(path.includes("%23"));
  assert.equal(
    json.rounds[0].messages[0].attachments[0].localPath,
    decodeURIComponent(path),
  );
  assert.ok(strFromU8(files["对话.txt"]).includes(decodeURIComponent(path)));
  const doc = new JSDOM(strFromU8(files["对话.html"])).window.document;
  assert.equal(doc.querySelector("img").getAttribute("src"), path);
  assert.equal(data.messages[2].attachments[0].localPath, undefined);
  assert.deepEqual(data.messages[3].reasoning, original.messages[3].reasoning);
});

test("multi-format ZIP without assets and failed attachment reports remain usable", async () => {
  const result = await prepareExport(conversation, {
    formats: ["txt", "json"],
  });
  assert.deepEqual(Object.keys(unzipSync(result.zip)).sort(), [
    "对话.json",
    "对话.txt",
  ]);
  const failed = await prepareExport(
    {
      messages: [
        {
          role: "user",
          content: "失败样例",
          attachments: [{ filename: "f.md", url: "x" }],
        },
      ],
    },
    {
      formats: ["html", "json"],
      offline: true,
      windowObject,
      read: async () => {
        throw new Error("链接已过期");
      },
    },
  );
  const files = unzipSync(failed.zip);
  assert.match(strFromU8(files["附件清单.json"]), /链接已过期/);
  assert.match(strFromU8(files["对话.html"]), /链接已过期/);
  assert.equal(
    JSON.parse(strFromU8(files["对话.json"])).rounds[0].messages[0]
      .attachments[0].error,
    "链接已过期",
  );
});

test("invalid formats and aborted tasks fail before reading attachments", async () => {
  let reads = 0;
  for (const formats of [[], ["pdf"], ["__proto__"], "html"]) {
    await assert.rejects(
      prepareExport(conversation, {
        formats,
        read: async () => {
          reads++;
          return pixel;
        },
      }),
      /格式/,
    );
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    prepareExport(conversation, { signal: controller.signal }),
    { name: "AbortError" },
  );
  assert.equal(reads, 0);
});

test("extension invalidation stops attachment export rather than recording an ordinary file failure", async () => {
  await assert.rejects(
    prepareExport(
      {
        messages: [
          {
            role: "user",
            content: "test",
            attachments: [{ filename: "中文.txt", url: "fixture" }],
          },
        ],
      },
      {
        offline: true,
        read: async () => {
          throw new Error("Extension context invalidated.");
        },
      },
    ),
    /Extension context invalidated/,
  );
});
