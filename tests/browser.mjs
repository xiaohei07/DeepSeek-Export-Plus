// Isolated Chromium with synthetic fixtures. No user browser profile or login.
import { chromium } from "playwright";
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  copyFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
await mkdir("tmp", { recursive: true });
await mkdir("output/pdf", { recursive: true });
await mkdir("docs/images", { recursive: true });
const ctx = await chromium.launchPersistentContext(await mkdtemp("tmp/e2e-"), {
  headless: true,
  channel: process.env.DSX_TEST_BROWSER ? undefined : "chromium",
  executablePath: process.env.DSX_TEST_BROWSER || undefined,
  args: [
    `--disable-extensions-except=${resolve("dist")}`,
    `--load-extension=${resolve("dist")}`,
  ],
  viewport: { width: 1200, height: 960 },
  acceptDownloads: true,
});
const errors = [];
ctx.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=",
  "base64",
);
const source = {
  code: 0,
  data: {
    biz_code: 0,
    biz_data: { title: "区间合并与文件导出", messages: [] },
  },
};
let delayNextShare = false;
for (let i = 0; i < 3; i++)
  source.data.biz_data.messages.push(
    {
      message_id: i * 2 + 1,
      role: "USER",
      fragments: [
        {
          type: "REQUEST",
          content: [
            "请解释区间合并，给出Python示例。",
            "能保留搜索来源和思考过程吗？",
            "把图片和附件一起保存。",
          ][i],
        },
        ...(i === 2
          ? [
              {
                type: "FILE",
                files: [
                  {
                    id: "f1",
                    file_name: "示例.md",
                    file_size: 3,
                    signed_path: "/file?file_id=demo-md",
                    is_image: false,
                  },
                  {
                    id: "f2",
                    file_name: "示例图.png",
                    file_size: 12345,
                    signed_path: "/file?file_id=demo-image",
                    is_image: true,
                  },
                ],
              },
            ]
          : []),
      ],
    },
    {
      message_id: i * 2 + 2,
      role: "ASSISTANT",
      fragments: [
        { type: "THINK", content: "先确认区间边界，再整理步骤。" },
        {
          id: 4,
          type: "SEARCH",
          queries: [{ query: "Python sorting" }],
          results: [
            {
              title: "Python官方文档",
              url: "https://docs.python.org/3/howto/sorting.html",
            },
          ],
        },
        { type: "THINK", content: "结合排序结果分析。" },
        {
          type: "RESPONSE",
          content:
            "## 处理步骤\n\n先排序，然后合并重叠区间。\n\n```python\nintervals.sort()\nprint(intervals)\n```\n\n代码之后仍然是正文。\n\n公式：$a^2+b^2=c^2$",
        },
      ],
    },
  );
try {
  const worker =
    ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker"));
  await worker.evaluate(() => {
    globalThis.downloadRequests = [];
    const original = chrome.downloads.download.bind(chrome.downloads);
    chrome.downloads.download = (options, callback) => {
      downloadRequests.push({ filename: options.filename });
      return original(options, callback);
    };
  });
  let lastId = -1;
  const nextDownload = async (target) => {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const [item] = await worker.evaluate(() =>
        chrome.downloads.search({ limit: 1, orderBy: ["-startTime"] }),
      );
      if (item && item.id > lastId && item.state === "complete") {
        lastId = item.id;
        await copyFile(item.filename, target);
        return;
      }
      if (item && item.id > lastId && item.state === "interrupted")
        throw new Error(item.error);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Download timeout");
  };
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await mkdir("tmp/downloads", { recursive: true });
  await cdp.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: resolve("tmp/downloads"),
    eventsEnabled: true,
  });
  await ctx.route("https://files.deepseeksvc.com/**", (r) =>
    r.fulfill({
      contentType: r.request().url().includes("demo-image")
        ? "image/png"
        : "application/octet-stream",
      body: r.request().url().includes("demo-image")
        ? pixel
        : Buffer.from("abc"),
    }),
  );
  await ctx.route("https://chat.deepseek.com/**", async (r) => {
    if (r.request().url().includes("/api/v0/share/content")) {
      if (delayNextShare) {
        delayNextShare = false;
        await new Promise((resolve) => setTimeout(resolve, 1800));
      }
      return r.fulfill({
        contentType: "application/json",
        body: JSON.stringify(source),
      });
    }
    if (r.request().url().includes("/api/v0/chat/history_messages"))
      return r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          data: {
            biz_code: 0,
            biz_data: {
              chat_messages: source.data.biz_data.messages.slice(0, 2),
            },
          },
        }),
      });
    const chat = r.request().url().includes("/chat/");
    return r.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><meta charset="utf-8"><title>区间合并与文件导出 - DeepSeek</title><style>body{margin:0;background:#fff;color:#24272e;font:16px/1.8 system-ui}main{max-width:760px;margin:64px auto}body.dark{background:#202124;color:#eee}.ds-message{padding:20px 0}h1{font-size:26px}</style><main><h1>区间合并与文件导出</h1><p>DeepSeek Export Plus · 界面演示</p>${chat ? '<div class="ds-message" data-message-id="1">请解释区间合并，给出Python示例。</div><div class="ds-message" data-message-id="2"><button aria-expanded="false">已思考</button><div class="ds-markdown">先排序，然后合并重叠区间。</div></div>' : "<p>请解释区间合并，给出Python示例。</p><p>先排序，然后合并重叠区间。</p>"}</main>${chat ? '<script>fetch("/api/v0/chat/history_messages?chat_session_id=fixture").then(r=>r.json()).then(()=>document.body.dataset.ready="true")</script>' : ""}`,
    });
  });
  await page.goto("https://chat.deepseek.com/share/fixture");
  await page.getByRole("button", { name: "导出对话", exact: true }).click();
  await page.locator(".round-list .item").first().waitFor();
  assert.equal(await page.locator(".round-list .item").count(), 3);
  assert.equal(await page.locator("#title").inputValue(), "区间合并与文件导出");
  assert.match(await page.locator(".notice").textContent(), /并非原始上传文件/);
  await page.screenshot({ path: "docs/images/export-light.png" });
  await page.evaluate(() => document.body.classList.add("dark"));
  await page.waitForFunction(
    () =>
      document.querySelector("#dsx-dialog-host").style.colorScheme === "dark",
  );
  assert.equal(
    await page.locator("dialog").evaluate((e) => getComputedStyle(e).color),
    "rgb(240, 242, 245)",
  );
  await page.screenshot({ path: "docs/images/export-dark.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page
      .locator("dialog")
      .evaluate((e) => e.getBoundingClientRect().right <= innerWidth),
  );
  await page.screenshot({ path: "docs/images/export-narrow.png" });
  await page.setViewportSize({ width: 1200, height: 960 });
  await page.locator("#from").fill("2");
  await page.locator("#to").fill("3");
  await page.getByRole("button", { name: "选中范围" }).click();
  await page.getByRole("button", { name: "导出Markdown", exact: true }).click();
  await nextDownload("output/功能验收.zip");
  let zipped = unzipSync(await readFile("output/功能验收.zip")),
    md = strFromU8(zipped["对话.md"]);
  assert.doesNotMatch(md, /## 第 1 轮/);
  assert.match(md, /## 第 2 轮/);
  assert.match(md, /## 第 3 轮/);
  assert.match(md, /> \*\*工具调用 · 搜索网页/);
  assert.doesNotMatch(md, /> \*先确认/);
  assert.equal(strFromU8(zipped["assets/001-示例.md"]), "abc");
  assert.deepEqual(Buffer.from(zipped["assets/002-示例图-预览.png"]), pixel);
  await page.locator("#from").fill("1");
  await page.getByRole("button", { name: "选中范围" }).click();
  const previewing = ctx.waitForEvent("page");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const preview = await previewing;
  await preview.waitForFunction(
    () => document.querySelector("#print")?.disabled === false,
  );
  assert.equal(
    await preview.locator("#document h1").textContent(),
    "区间合并与文件导出",
  );
  assert.equal(await preview.locator("#document h2").count(), 3);
  assert.equal(await preview.locator("#document .katex").count(), 3);
  assert.ok(
    await preview.evaluate(() =>
      [...document.fonts].some(
        (f) => f.family.includes("KaTeX") && f.status === "loaded",
      ),
    ),
  );
  assert.equal(await preview.locator("#document blockquote em").count(), 0);
  assert.equal(await preview.locator("#document blockquote a").count(), 3);
  assert.equal(await preview.locator("#document img").count(), 1);
  await preview.pdf({
    path: "output/pdf/功能验收.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
  await preview.screenshot({ path: "docs/images/pdf-preview.png" });
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  delayNextShare = true;
  await page.getByRole("button", { name: "导出对话内文件" }).click();
  await page.locator(".loading").waitFor();
  await page.screenshot({ path: "docs/images/files-loading.png" });
  await page.locator(".file-list .item").first().waitFor();
  assert.equal(await page.locator(".file-list .item").count(), 2);
  assert.match(await page.locator(".file-list").textContent(), /原上传大小12\.1KB/);
  await page.screenshot({ path: "docs/images/files-dark.png" });
  await page.getByRole("button", { name: "下载所选文件" }).click();
  await page
    .locator(".status")
    .filter({ hasText: "已下载2个文件" })
    .waitFor({ timeout: 20000 });
  const downloads = await worker.evaluate(() =>
    chrome.downloads.search({ limit: 10, orderBy: ["-startTime"] }),
  );
  // CDP redirects data-URL downloads to generic names. Assert the requested names
  // and actual saved bytes independently instead of depending on CDP filenames.
  const requested = await worker.evaluate(() => downloadRequests);
  assert.ok(requested.some((d) => d.filename.endsWith("示例.md")));
  assert.ok(requested.some((d) => d.filename.endsWith("示例图-预览.png")));
  const saved = await Promise.all(
    downloads
      .filter((d) => d.state === "complete")
      .map((d) => readFile(d.filename)),
  );
  assert.ok(saved.some((bytes) => bytes.equals(Buffer.from("abc"))));
  assert.ok(saved.some((bytes) => bytes.equals(pixel)));
  lastId = Math.max(...downloads.map((d) => d.id));
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.goto("https://chat.deepseek.com/a/chat/fixture");
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  await page.getByRole("button", { name: "导出对话", exact: true }).click();
  await page.locator(".round-list .item").first().waitFor();
  await page.getByRole("button", { name: "导出Markdown", exact: true }).click();
  await nextDownload("output/chat-功能验收.md");
  md = await readFile("output/chat-功能验收.md", "utf8");
  assert.match(md, /> 先确认区间边界/);
  assert.match(md, /> \*\*工具调用 · 搜索网页/);
  assert.match(md, /docs.python.org/);
  assert.match(md, /```python/);
  assert.equal(
    await page.locator("[aria-expanded]").getAttribute("aria-expanded"),
    "false",
  );
  const chatPreviewing = ctx.waitForEvent("page");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const chatPreview = await chatPreviewing;
  await chatPreview.waitForFunction(
    () => document.querySelector("#print")?.disabled === false,
  );
  assert.match(
    await chatPreview.locator("#document blockquote").textContent(),
    /工具调用 · 搜索网页/,
  );
  assert.deepEqual(errors, []);
  const result = {
    share: true,
    chatHistoryBridge: true,
    chatToolsInMDAndPDF: true,
    collapsedThinking: true,
    selection: true,
    title: true,
    attachments: true,
    previewNotice: true,
    lightDarkNarrow: true,
    errors,
  };
  await writeFile(
    "output/browser-results.json",
    JSON.stringify(result, null, 2),
  );
  console.log(result);
} finally {
  await ctx.close();
}
