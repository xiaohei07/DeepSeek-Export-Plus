import { chromium } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { acceptPrivacy } from "./consent-helper.mjs";

const out = "output/v221/runtime";
await mkdir(out, { recursive: true });
const ctx = await chromium.launchPersistentContext(
  await mkdtemp("tmp/runtime-"),
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
ctx.setDefaultTimeout(15000);
ctx.on("page", (page) => page.on("pageerror", (e) => errors.push(e.message)));
const messages = [
  {
    role: "USER",
    message_id: 1,
    fragments: [
      { type: "REQUEST", content: "分享附件验收" },
      {
        type: "FILE",
        files: [
          {
            id: "sheet",
            file_name: "数量样例.xlsx",
            signed_path: "/file?file_id=sheet",
            is_image: false,
          },
        ],
      },
    ],
  },
  {
    role: "ASSISTANT",
    message_id: 2,
    fragments: [{ type: "RESPONSE", content: "运行时重载验收" }],
  },
];
try {
  await ctx.route("https://chat.deepseek.com/**", (r) =>
    r.fulfill(
      r.request().url().includes("/api/v0/share/content")
        ? {
            contentType: "application/json",
            body: JSON.stringify({
              code: 0,
              data: { biz_code: 0, biz_data: { messages } },
            }),
          }
        : {
            contentType: "text/html",
            body: '<!doctype html><meta charset="utf-8"><main>测试对话</main>',
          },
    ),
  );
  const worker = await acceptPrivacy(ctx);
  // CLI loading bypasses developer-mode checks only on first install. Enable
  // it in this disposable profile, as the README instructs human users.
  const manager = await ctx.newPage();
  await manager.goto("chrome://extensions");
  await manager.evaluate(() =>
    chrome.developerPrivate.updateProfileConfiguration({
      inDeveloperMode: true,
    }),
  );
  await manager.close();
  const pages = [await ctx.newPage(), await ctx.newPage()];
  for (const page of pages) {
    await page.goto("https://chat.deepseek.com/share/runtime");
    await page.locator("#export-conversation-btn").waitFor();
  }
  const active = pages[1];
  await active.locator("#export-files-btn").click();
  await active.locator("#share-excel-note").waitFor();
  assert.match(
    await active.locator("#share-excel-note").innerText(),
    /原chat.*404/,
  );
  await active.getByRole("button", { name: "关闭", exact: true }).click();
  await active.locator("#export-conversation-btn").click();
  await active.locator("#share-excel-note").waitFor();
  console.log("Fixture dialogs and Excel notice ready; reloading extension");
  await worker.evaluate(() => {
    setTimeout(() => chrome.runtime.reload(), 20);
  });
  // Old content scripts survive reload; both an open dialog and a fresh click
  // must give a refresh action, without using the invalidated Chrome API again.
  await active.locator("#dsx-runtime-notice #refresh").waitFor();
  console.log("Invalidation notice received; checking refresh recovery");
  assert.equal(await active.locator("#dsx-dialog-host").count(), 0);
  const idle = pages[0];
  await idle.bringToFront();
  if (!(await idle.locator("#dsx-runtime-notice").count()))
    await idle.locator("#export-conversation-btn").click();
  await idle.locator("#dsx-runtime-notice #refresh").waitFor();
  await active.screenshot({ path: `${out}/refresh-notice.png` });
  await Promise.all([
    idle.waitForEvent("load"),
    idle.getByRole("button", { name: "刷新页面", exact: true }).click(),
  ]);
  await idle.locator("#export-conversation-btn").click();
  await idle.locator("#share-excel-note").waitFor();
  assert.equal(await idle.locator("#dsx-runtime-notice").count(), 0);
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/results-${process.env.DSX_TEST_BROWSER ? "edge" : "chromium"}.json`,
    JSON.stringify(
      {
        browser: ctx.browser().version(),
        realExtensionReload: true,
        openDialogCleanup: true,
        refreshedExport: true,
        shareExcelNotice: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Real extension reload, refresh recovery and share Excel notice passed",
  );
} finally {
  await ctx.close();
}
