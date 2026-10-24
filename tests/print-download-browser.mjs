import { chromium } from "playwright";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { acceptPrivacy } from "./consent-helper.mjs";
import { watchDownloads } from "./downloads.mjs";

const output = "output/v221/print-download";
await mkdir(output, { recursive: true });
await mkdir("tmp", { recursive: true });
const bytes = Buffer.from("# 附件内容\n\nPRINT-FILE-END\n");
const fileURL = "https://files.deepseeksvc.com/api/file?file_id=named&ty=r";
const ctx = await chromium.launchPersistentContext(
  await mkdtemp("tmp/print-download-"),
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
const errors = [];
ctx.on("page", (page) =>
  page.on("pageerror", (error) => errors.push(error.message)),
);
try {
  await acceptPrivacy(ctx);
  const messages = [
    {
      role: "USER",
      message_id: 1,
      fragments: [
        { type: "REQUEST", content: "请说明这两个附件" },
        {
          type: "FILE",
          files: [
            {
              id: "named",
              file_name: "记录 #1.md",
              file_size: bytes.length,
              signed_path: "/file?file_id=named",
              is_image: false,
            },
            {
              id: "missing",
              file_name: "不可用.xlsx",
              file_size: 10,
              signed_path: "/file?file_id=missing",
              is_image: false,
            },
          ],
        },
      ],
    },
    {
      role: "ASSISTANT",
      message_id: 2,
      fragments: [{ type: "RESPONSE", content: "PDF-PRINT-END" }],
    },
  ];
  await ctx.route("https://chat.deepseek.com/**", (route) =>
    route.fulfill(
      route.request().url().includes("/api/v0/share/content")
        ? {
            contentType: "application/json",
            body: JSON.stringify({
              code: 0,
              data: { biz_code: 0, biz_data: { messages } },
            }),
          }
        : {
            contentType: "text/html; charset=utf-8",
            body: "<!doctype html><meta charset=utf-8><p>公开测试数据</p>",
          },
    ),
  );
  await ctx.route("https://files.deepseeksvc.com/**", (route) =>
    route.fulfill(
      route.request().url() === fileURL
        ? { contentType: "application/octet-stream", body: bytes }
        : { status: 404, body: "" },
    ),
  );
  const page = await ctx.newPage();
  await page.goto("https://chat.deepseek.com/share/print-download");
  await page.getByRole("button", { name: "导出对话", exact: true }).click();
  await page.locator("input[name=format]").first().waitFor();
  const nextPage = ctx.waitForEvent("page");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const preview = await nextPage;
  await preview.waitForFunction(
    () => !document.querySelector("#print")?.disabled,
  );
  const downloads = await watchDownloads(ctx, preview, "tmp/print-downloads");
  const link = preview.getByRole("link", { name: "记录 #1.md", exact: true });
  await link.click();
  const download = await downloads.next(`${output}/named.md`);
  assert.equal(download.suggestedFilename, "记录 #1.md");
  assert.deepEqual(await readFile(`${output}/named.md`), bytes);
  assert.equal(
    await link.getAttribute("href"),
    fileURL,
    "printed PDF keeps the source URL, not an expiring blob",
  );
  assert.match(
    await preview.locator(".attachment-note").textContent(),
    /PDF.*重命名/,
  );
  await preview.getByRole("link", { name: "不可用.xlsx", exact: true }).click();
  await preview.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("HTTP 404"),
  );
  assert.match(
    await preview.locator("#status").textContent(),
    /分享页.*原chat/,
  );
  assert.equal(downloads.count, 1);
  const denied = await preview.evaluate(async () =>
    chrome.runtime.sendMessage({
      type: "READ_PRINT_ATTACHMENT",
      token: new URLSearchParams(location.search).get("token"),
      url: "https://files.deepseeksvc.com/api/file?file_id=not-selected&ty=r",
    }),
  );
  assert.equal(denied.success, false);
  assert.match(denied.error, /不在本次导出/);
  await preview.pdf({
    path: `${output}/preview.pdf`,
    printBackground: true,
    preferCSSPageSize: true,
  });
  await preview.screenshot({ path: `${output}/preview.png`, fullPage: true });
  assert.deepEqual(errors, []);
  const result = {
    browser: ctx.browser().version(),
    originalFilename: true,
    bytesMatch: true,
    share404: true,
    unselectedFileDenied: true,
    pdfCreated: true,
    errors,
  };
  await writeFile(
    `${output}/results-${process.env.DSX_TEST_BROWSER ? "edge" : "chromium"}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await ctx.close();
}
