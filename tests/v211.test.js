import test from "node:test";
import assert from "node:assert/strict";
import { formatConversation } from "../public/content/markdown.js";
import {
  documentTitle,
  timestampedFilename,
} from "../public/content/conversation.js";
import { prepareSingleAttachment } from "../public/content/exportBundle.js";

test("share API and DOM fallback use a fixed H1, without altering prompt content", () => {
  for (const source of ["dom", "share-api"]) {
    const data = {
      title: "这是一段很长的提示词".repeat(30),
      url: "https://chat.deepseek.com/share/abc/?foo=bar",
      source,
      messages: [{ role: "user", content: "保留这段原始提示词" }],
    };
    assert.equal(documentTitle(data), "DeepSeek 对话记录");
    assert.match(formatConversation(data), /^# DeepSeek 对话记录\n/);
    assert.doesNotMatch(formatConversation(data), /这是一段很长的提示词/);
    assert.match(formatConversation(data), /保留这段原始提示词/);
    data.url = "https://chat.deepseek.com/a/chat/abc";
    data.title = "自定义chat标题";
    assert.match(formatConversation(data), /^# 自定义chat标题\n/);
  }
});

test("filenames retain local export time to seconds after long/special titles", () => {
  const date = new Date(2026, 9, 23, 8, 9, 6, 7);
  assert.equal(
    timestampedFilename("测试", "md", date),
    "测试_2026-10-23_08-09-06.md",
  );
  assert.match(
    timestampedFilename("很长".repeat(100), "zip", date),
    /_2026-10-23_08-09-06\.zip$/,
  );
  assert.equal(
    timestampedFilename("CON", "md", date),
    "_CON_2026-10-23_08-09-06.md",
  );
  assert.notEqual(
    timestampedFilename("测试", "md", date),
    timestampedFilename("测试", "md", new Date(date.getTime() + 1000)),
  );
  assert.doesNotMatch(
    timestampedFilename("错误:/\\标题", "pdf", date),
    /[<>:"/\\|?*]/,
  );
});

test("single attachment keeps original bytes and extension, handles empty files and image previews", async () => {
  const doc = await prepareSingleAttachment(
    { filename: "文档".repeat(100) + ".pptx", size: 3 },
    { read: async () => "data:application/octet-stream;base64,YWJj" },
  );
  assert.equal(new TextDecoder().decode(doc.bytes), "abc");
  assert.match(doc.filename, /\.pptx$/);
  assert.ok(doc.filename.length < 160);
  const empty = await prepareSingleAttachment(
    { filename: "空白.md", size: 0 },
    { read: async () => "data:text/plain;base64," },
  );
  assert.equal(empty.bytes.length, 0);
  const image = await prepareSingleAttachment(
    { filename: "图片.webp", isImage: true, preview: true, size: 999 },
    { read: async () => "data:image/png;base64,YWJj" },
  );
  assert.equal(image.filename, "图片-预览.png");
  const reserved = await prepareSingleAttachment(
    { filename: "CON.md" },
    { read: async () => "data:text/plain;base64,YWJj" },
  );
  assert.equal(reserved.filename, "_CON.md");
  const dotfile = await prepareSingleAttachment(
    { filename: ".env" },
    { read: async () => "data:text/plain;base64,YWJj" },
  );
  assert.equal(dotfile.filename, ".env");
});

test("direct download rejects wrong bytes, bad image MIME and cancellation", async () => {
  await assert.rejects(
    prepareSingleAttachment(
      { filename: "文档.md", size: 4 },
      { read: async () => "data:text/plain;base64,YWJj" },
    ),
    /大小不符/,
  );
  await assert.rejects(
    prepareSingleAttachment(
      { filename: "图片.png", isImage: true },
      { read: async () => "data:text/html;base64,YWJj" },
    ),
    /未返回可嵌入的图片/,
  );
  const controller = new AbortController();
  await assert.rejects(
    prepareSingleAttachment(
      { filename: "文档.md" },
      {
        signal: controller.signal,
        read: async () => {
          controller.abort();
          return "data:text/plain;base64,YWJj";
        },
      },
    ),
    { name: "AbortError" },
  );
});
