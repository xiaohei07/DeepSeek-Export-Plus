import { acceptPrivacy } from "./consent-helper.mjs";
// Optional private sample replay: node tests/replay.mjs <share-json> <attachment-directory>
// Input captures and output artifacts are ignored by Git and never uploaded.
import { chromium } from "playwright";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { watchDownloads } from "./downloads.mjs";
const [jsonPath, assetsPath, outputPath = "output"] = process.argv.slice(2);
const output = (...parts) => resolve(outputPath, ...parts);
if (!jsonPath || !assetsPath)
  throw new Error(
    "Usage: node tests/replay.mjs <share-json> <attachment-directory>",
  );
const source = JSON.parse(
  (await readFile(jsonPath, "utf8")).replace(/^\uFEFF/, ""),
);
const files = source.data.biz_data.messages.flatMap((m) =>
  m.fragments.filter((f) => f.type === "FILE").flatMap((f) => f.files),
);
const buffers = new Map();
for (const file of files)
  buffers.set(
    file.id,
    await readFile(
      resolve(assetsPath, file.is_image ? file.id + ".jpg" : file.file_name),
    ),
  );
await mkdir("tmp", { recursive: true });
await mkdir("tmp/replay-downloads", { recursive: true });
await mkdir(output("pdf"), { recursive: true });
const ctx = await chromium.launchPersistentContext(
  await mkdtemp("tmp/replay-"),
  {
    headless: true,
    channel: process.env.DSX_TEST_BROWSER ? undefined : "chromium",
    executablePath: process.env.DSX_TEST_BROWSER || undefined,
    args: [
      `--disable-extensions-except=${resolve("dist")}`,
      `--load-extension=${resolve("dist")}`,
    ],
    viewport: { width: 1200, height: 1000 },
  },
);
const errors = [];
ctx.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
try {
  await acceptPrivacy(ctx);
  const page = await ctx.newPage();
  const downloads = await watchDownloads(ctx, page, "tmp/replay-downloads");
  await ctx.route("https://files.deepseeksvc.com/**", (route) => {
    const id =
      "file-" + new URL(route.request().url()).searchParams.get("file_id");
    const file = files.find((f) => f.id === id);
    if (!file) throw new Error("Unknown sample attachment");
    return route.fulfill({
      contentType: file.is_image ? "image/jpeg" : "application/octet-stream",
      body: buffers.get(id),
    });
  });
  await ctx.route("https://chat.deepseek.com/**", (route) =>
    route.fulfill(
      route.request().url().includes("/api/v0/share/content")
        ? { contentType: "application/json", body: JSON.stringify(source) }
        : {
            contentType: "text/html; charset=utf-8",
            body: '<!doctype html><meta charset="utf-8"><title>附件说明与多语言测试 - DeepSeek</title><style>body{background:#fff}</style><p>用户分享样例的本地回放</p>',
          },
    ),
  );
  await page.goto("https://chat.deepseek.com/share/wwcwocs4nett58pwcl");
  await page.getByRole("button", { name: "导出对话", exact: true }).click();
  await page.locator(".round-list .item").first().waitFor();
  assert.equal(await page.locator("#thinking").isChecked(), false);
  await page.locator("#thinking").check();
  await page.getByRole("button", { name: "导出Markdown", exact: true }).click();
  await page
    .locator(".status")
    .filter({ hasText: "已保存" })
    .waitFor({ timeout: 60000 });
  await downloads.next(output("真实分享验收.zip"));
  const zip = unzipSync(await readFile(output("真实分享验收.zip"))),
    manifest = JSON.parse(strFromU8(zip["附件清单.json"]));
  assert.equal(manifest.length, files.length);
  assert.equal(manifest.filter((f) => f.error).length, 0);
  for (const entry of manifest) {
    const file = files.find((f) => f.file_name === entry.originalFilename);
    assert.deepEqual(Buffer.from(zip[entry.savedAs]), buffers.get(file.id));
  }
  const md = strFromU8(zip["对话.md"]);
  await writeFile(output("真实分享验收.md"), md);
  assert.match(md, /^# DeepSeek 对话记录\n/);
  const rounds = source.data.biz_data.messages.filter(
    (m) => m.role === "USER",
  ).length;
  assert.equal((md.match(/^## 第 /gm) || []).length, rounds);
  assert.match(md, /> \*\*工具调用/);
  const results = [];
  for (const thinking of [false, true]) {
    await page.locator("#thinking").setChecked(thinking);
    const creating = ctx.waitForEvent("page");
    await page.getByRole("button", { name: "PDF", exact: true }).click();
    const preview = await creating;
    await preview.waitForFunction(
      () => document.querySelector("#print")?.disabled === false,
      null,
      { timeout: 60000 },
    );
    assert.equal(await preview.locator("#document h2").count(), rounds);
    assert.equal(
      await preview.locator("#document h1").textContent(),
      "DeepSeek 对话记录",
    );
    assert.match(
      await preview.title(),
      /^DeepSeek 对话记录_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/,
    );
    assert.equal(
      await preview.locator("#document img").count(),
      files.filter((f) => f.is_image).length,
    );
    if (thinking)
      assert.ok(
        (await preview
          .locator("#document blockquote")
          .filter({ hasText: "工具调用" })
          .count()) > 0,
      );
    const name = "真实分享验收-" + (thinking ? "含思考" : "仅对话");
    await preview.pdf({
      path: output("pdf", name + ".pdf"),
      preferCSSPageSize: true,
      printBackground: true,
    });
    if (thinking)
      await preview.screenshot({ path: output("真实分享预览.png") });
    results.push({
      thinking,
      images: await preview.locator("#document img").count(),
    });
    await preview.close();
  }
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "导出对话内文件" }).click();
  await page.locator(".file-list .item").first().waitFor();
  assert.equal(await page.locator(".file-list .item").count(), files.length);
  await page.getByRole("button", { name: "取消全选", exact: true }).click();
  const checks = page.locator(".file-list input[type=checkbox]");
  const beforeDirect = downloads.count;
  await mkdir(output("single"), { recursive: true });
  for (let i = 0; i < files.length; i++) {
    await checks.nth(i).check();
    await page
      .getByRole("button", { name: "下载所选文件", exact: true })
      .click();
    const target = output("single", String(i + 1));
    const download = await downloads.next(target);
    assert.deepEqual(await readFile(target), buffers.get(files[i].id));
    if (files[i].is_image)
      assert.match(download.suggestedFilename, /-预览\.jpg$/);
    else assert.equal(download.suggestedFilename, files[i].file_name);
    await checks.nth(i).uncheck();
  }
  assert.equal(downloads.count - beforeDirect, files.length);
  assert.deepEqual(errors, []);
  const result = {
    rounds,
    attachments: manifest.length,
    allAttachmentBytesMatch: true,
    singleAttachmentBytesMatch: files.length,
    fixedShareHeading: true,
    pdf: results,
    errors,
  };
  await writeFile(
    output("replay-results.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(result);
} finally {
  await ctx.close();
}
