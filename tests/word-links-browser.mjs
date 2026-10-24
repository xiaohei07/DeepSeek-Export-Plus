import { chromium } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { Document, Packer, Paragraph } from "docx";
import { unzipSync, strFromU8 } from "fflate";
import { JSDOM } from "jsdom";

const out = "output/v221/word-links/regression";
await mkdir(`${out}/assets`, { recursive: true });
const names = [
  "001-说明.docx",
  "002-附件 中文 #1 100% & 😀.docx",
  "003-%E8%AF%B4.docx",
];
for (const name of names)
  await writeFile(
    `${out}/assets/${name}`,
    await Packer.toBuffer(
      new Document({
        sections: [{ children: [new Paragraph("ATTACHMENT-LINK-END")] }],
      }),
    ),
  );
const ctx = await chromium.launchPersistentContext(
  await mkdtemp("tmp/word-links-"),
  {
    headless: true,
    channel: process.env.DSX_TEST_BROWSER ? undefined : "chromium",
    executablePath: process.env.DSX_TEST_BROWSER || undefined,
    args: [
      `--disable-extensions-except=${resolve("dist")}`,
      `--load-extension=${resolve("dist")}`,
    ],
  },
);
try {
  const worker =
    ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker"));
  const page = await ctx.newPage();
  await page.goto(
    `chrome-extension://${new URL(worker.url()).hostname}/privacy/index.html`,
  );
  const bytes = await page.evaluate(async (names) => {
    const { renderBinaryDocuments } = await import("../export/binary.js");
    const files = await renderBinaryDocuments({
      title: "附件链接验证",
      formats: ["docx"],
      markdown:
        "# 附件链接验证\n\n" +
        names
          .map((name) => `[${name}](assets/${encodeURIComponent(name)})`)
          .join("\n\n") +
        "\n\n[在线链接](https://example.org/%E8%AF%B4#section)",
    });
    return Array.from(files["对话.docx"]);
  }, names);
  await writeFile(`${out}/对话.docx`, Uint8Array.from(bytes));
  const files = unzipSync(Uint8Array.from(bytes));
  const parser = new new JSDOM("").window.DOMParser();
  const rels = parser.parseFromString(
    strFromU8(files["word/_rels/document.xml.rels"]),
    "application/xml",
  );
  assert.equal(rels.querySelector("parsererror"), null);
  const targets = [...rels.querySelectorAll("Relationship")]
    .filter((r) => r.getAttribute("Type").endsWith("/hyperlink"))
    .map((r) => r.getAttribute("Target"));
  assert.ok(targets.includes("assets/001-说明.docx"));
  assert.ok(
    targets.includes("assets/002-附件%20中文%20%231%20100%25%20%26%20😀.docx"),
  );
  assert.ok(targets.includes("assets/003-%25E8%25AF%25B4.docx"));
  assert.ok(targets.includes("https://example.org/%E8%AF%B4"));
  console.log(
    "Word local attachment relationships passed; fixtures ready for Microsoft Word",
  );
} finally {
  await ctx.close();
}
