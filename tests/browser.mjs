// Isolated Chromium with synthetic fixtures. No user browser profile or login.
import { chromium } from "playwright";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { watchDownloads } from "./downloads.mjs";
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
let failFileRead = false;
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
  const page = await ctx.newPage();
  const downloads = await watchDownloads(ctx, page, "tmp/downloads");
  const nextDownload = (target) => downloads.next(target);
  await ctx.route("https://files.deepseeksvc.com/**", (r) =>
    r.fulfill({
      contentType: r.request().url().includes("demo-image")
        ? "image/png"
        : "application/octet-stream",
      body: failFileRead
        ? Buffer.from("broken")
        : r.request().url().includes("demo-image")
          ? pixel
          : Buffer.from("abc"),
    }),
  );
  await ctx.route("https://chat.deepseek.com/**", async (r) => {
    if (r.request().url().includes("/a/chat/selectors"))
      return r.fulfill({
        contentType: "text/html; charset=utf-8",
        body: await readFile("tests/fixtures/chat-selectors.html", "utf8"),
      });
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
  await page.locator("#ai-exporter-buttons").waitFor();
  assert.ok(
    await page.evaluate(
      () =>
        document.querySelector("#ai-exporter-buttons").getBoundingClientRect()
          .right <=
        document.querySelector("main").getBoundingClientRect().right + 1,
    ),
  );
  await page.getByRole("button", { name: "导出对话", exact: true }).click();
  await page.locator(".round-list .item").first().waitFor();
  assert.equal(await page.locator(".round-list .item").count(), 3);
  assert.equal(await page.locator("#title").inputValue(), "DeepSeek 对话记录");
  assert.equal(await page.locator("#thinking").isChecked(), false);
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
  // Share title editing changes the filename only, never the fixed document H1.
  await page.locator("#title").fill("分享测试");
  await page.locator("#from").fill("2");
  await page.locator("#to").fill("3");
  await page.getByRole("button", { name: "选中范围" }).click();
  await page.getByRole("button", { name: "导出Markdown", exact: true }).click();
  const shareDownload = await nextDownload("output/功能验收.zip");
  assert.match(
    shareDownload.suggestedFilename,
    /^分享测试_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.zip$/,
  );
  let zipped = unzipSync(await readFile("output/功能验收.zip")),
    md = strFromU8(zipped["对话.md"]);
  assert.match(md, /^# DeepSeek 对话记录\n/);
  assert.doesNotMatch(md, /## 第 1 轮/);
  assert.match(md, /## 第 2 轮/);
  assert.match(md, /## 第 3 轮/);
  assert.doesNotMatch(md, /先确认区间边界|工具调用/);
  assert.doesNotMatch(md, /> \*先确认/);
  assert.equal(strFromU8(zipped["assets/001-示例.md"]), "abc");
  assert.deepEqual(Buffer.from(zipped["assets/002-示例图-预览.png"]), pixel);
  await page.locator("#thinking").check();
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
    "DeepSeek 对话记录",
  );
  assert.match(
    await preview.title(),
    /^分享测试_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/,
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
  assert.match(
    await page.locator(".file-list").textContent(),
    /原上传大小12\.1KB/,
  );
  await page.screenshot({ path: "docs/images/files-dark.png" });
  const beforeBatch = downloads.count;
  await page.getByRole("button", { name: "打包下载所选文件" }).click();
  await page
    .locator(".status")
    .filter({ hasText: "ZIP已生成：2个文件" })
    .waitFor({ timeout: 20000 });
  await nextDownload("output/附件批量验收.zip");
  assert.equal(downloads.count - beforeBatch, 1);
  const batch = unzipSync(await readFile("output/附件批量验收.zip"));
  assert.equal(strFromU8(batch["assets/001-示例.md"]), "abc");
  assert.deepEqual(Buffer.from(batch["assets/002-示例图-预览.png"]), pixel);
  assert.equal(batch["对话.md"], undefined);
  // Selecting only one file must produce raw bytes, not an archive.
  const fileChecks = page.locator(".file-list input[type=checkbox]");
  await fileChecks.nth(1).uncheck();
  await page.getByRole("button", { name: "下载所选文件", exact: true }).click();
  const single = await nextDownload("output/单文件验收.md");
  assert.equal(single.suggestedFilename, "示例.md");
  assert.equal(await readFile("output/单文件验收.md", "utf8"), "abc");
  await fileChecks.nth(0).uncheck();
  await fileChecks.nth(1).check();
  await page.getByRole("button", { name: "下载所选文件", exact: true }).click();
  const singleImage = await nextDownload("output/单图片验收.png");
  assert.equal(singleImage.suggestedFilename, "示例图-预览.png");
  assert.deepEqual(await readFile("output/单图片验收.png"), pixel);
  assert.equal(downloads.count - beforeBatch, 3);
  await fileChecks.nth(1).uncheck();
  assert.equal(
    await page
      .getByRole("button", { name: "下载所选文件", exact: true })
      .isDisabled(),
    true,
  );
  await fileChecks.nth(0).check();
  failFileRead = true;
  await page.getByRole("button", { name: "下载所选文件", exact: true }).click();
  await page
    .locator(".status")
    .filter({ hasText: "未作为原文件保存" })
    .waitFor();
  assert.equal(
    downloads.count - beforeBatch,
    3,
    "a failed single file must not download a fake file or a ZIP",
  );
  failFileRead = false;
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.goto("https://chat.deepseek.com/a/chat/fixture");
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  // Composer hydration happens after the initial toolbar, including after reload.
  const mountComposer = async () => {
    await page.evaluate(() => {
      const composer = document.createElement("form");
      composer.id = "composer";
      composer.style.cssText =
        "position:fixed;bottom:20px;left:220px;width:760px;background:#eee;padding:10px";
      composer.innerHTML =
        '<textarea style="width:95%;height:60px" placeholder="给DeepSeek发送消息"></textarea><div id="controls" style="display:flex;justify-content:flex-end"><button type="submit" aria-label="发送" style="height:40px">发送</button></div>';
      document.body.append(composer);
    });
    await page.waitForFunction(
      () =>
        document.querySelector("#ai-exporter-buttons")?.dataset.placement ===
        "row",
    );
    assert.equal(await page.locator("#ai-exporter-buttons").count(), 1);
  };
  await mountComposer();
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  await mountComposer();
  await page.screenshot({ path: "output/chat-toolbar.png" });
  await page.getByRole("button", { name: "导出对话", exact: true }).click();
  await page.locator(".round-list .item").first().waitFor();
  assert.equal(await page.locator("#thinking").isChecked(), false);
  await page.getByRole("button", { name: "导出Markdown", exact: true }).click();
  const chatDownload = await nextDownload("output/chat-仅正文验收.md");
  assert.match(
    chatDownload.suggestedFilename,
    /^区间合并与文件导出_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.md$/,
  );
  assert.match(
    await readFile("output/chat-仅正文验收.md", "utf8"),
    /^# 区间合并与文件导出\n/,
  );
  assert.doesNotMatch(
    await readFile("output/chat-仅正文验收.md", "utf8"),
    /先确认区间边界|工具调用/,
  );
  await page.locator("#thinking").check();
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
  await page.goto("https://chat.deepseek.com/a/chat/selectors");
  await page.getByRole("button", { name: "导出对话", exact: true }).click();
  await page.locator(".round-list .item").first().waitFor();
  assert.equal(await page.locator("body").getAttribute("data-clicks"), null);
  await page.locator("#thinking").check();
  await page.getByRole("button", { name: "导出Markdown", exact: true }).click();
  await nextDownload("output/chat-工具顺序验收.md");
  const orderedMD = await readFile("output/chat-工具顺序验收.md", "utf8");
  const ordered = [
    "先搜索资料",
    "https://example.org/search",
    "再核对原文",
    "https://example.org/a",
    "最后整理答案",
  ].map((s) => orderedMD.indexOf(s));
  assert.ok(
    ordered.every((p, i) => p >= 0 && (!i || p > ordered[i - 1])),
    ordered.join(","),
  );
  assert.match(orderedMD, /https:\/\/example.org\/b/);
  assert.equal(
    await page.locator("#toggle").getAttribute("aria-expanded"),
    "false",
  );
  const selectorPreviewing = ctx.waitForEvent("page");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const selectorPreview = await selectorPreviewing;
  await selectorPreview.waitForFunction(
    () => document.querySelector("#print")?.disabled === false,
  );
  const quoted = await selectorPreview
    .locator("#document blockquote")
    .innerText();
  assert.ok(quoted.indexOf("再核对原文") < quoted.indexOf("原文A"));
  assert.ok(quoted.indexOf("原文A") < quoted.indexOf("最后整理答案"));
  assert.equal(
    await selectorPreview.locator("#document blockquote a").count(),
    3,
  );
  assert.deepEqual(errors, []);
  const result = {
    share: true,
    chatHistoryBridge: true,
    chatFragmentSelectorsAndToolOrder: true,
    chatToolsInMDAndPDF: true,
    collapsedThinking: true,
    selection: true,
    title: true,
    attachments: true,
    attachmentBatchOneDownload: true,
    singleAttachmentDirect: true,
    shareFixedHeadingAndTimestampedFiles: true,
    chatTitleAndTimestampedFiles: true,
    defaultThinkingOff: true,
    toolbarReanchorsAfterHydrationAndReload: true,
    shareToolbarAlignedWithContent: true,
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
