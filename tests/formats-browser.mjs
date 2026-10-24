import { acceptPrivacy } from "./consent-helper.mjs";
import { chromium } from "playwright";
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  copyFile,
} from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { watchDownloads } from "./downloads.mjs";

const out = "output/formats";
await mkdir("tmp", { recursive: true });
await mkdir(out, { recursive: true });
await mkdir("docs/store/images", { recursive: true });
const ctx = await chromium.launchPersistentContext(
  await mkdtemp("tmp/formats-"),
  {
    headless: true,
    channel: process.env.DSX_TEST_BROWSER ? undefined : "chromium",
    executablePath: process.env.DSX_TEST_BROWSER || undefined,
    args: [
      `--disable-extensions-except=${resolve("dist")}`,
      `--load-extension=${resolve("dist")}`,
    ],
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true,
  },
);
const errors = [];
ctx.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
let reads = 0;
const mascot = await readFile("public/icons/fish-128.png");
const messages = [
  {
    role: "USER",
    message_id: 1,
    fragments: [{ type: "REQUEST", content: "给我一份区间合并的阅读笔记。" }],
  },
  {
    role: "ASSISTANT",
    message_id: 2,
    fragments: [
      { type: "RESPONSE", content: "先按左端点排序，再依次合并重叠区间。" },
    ],
  },
  {
    role: "USER",
    message_id: 3,
    fragments: [
      {
        type: "REQUEST",
        content: "补充Python示例和资料来源，把示例图一起保存。",
      },
      {
        type: "FILE",
        files: [
          {
            id: "demo",
            file_name: "小肥鱼 #1 %.png",
            is_image: true,
            signed_path: "/file?file_id=store-demo",
          },
        ],
      },
    ],
  },
  {
    role: "ASSISTANT",
    message_id: 4,
    fragments: [
      { type: "THINK", content: "先检查边界条件。" },
      {
        type: "SEARCH",
        queries: [{ query: "Python sorting" }],
        results: [
          {
            title: "Python排序指南",
            url: "https://docs.python.org/3/howto/sorting.html",
          },
        ],
      },
      { type: "THINK", content: "找到资料后整理示例。" },
      {
        type: "RESPONSE",
        content:
          "## 合并步骤\n\n1. 按左端点排序。\n2. 与上一个区间比较，重叠时更新右端点。\n\n```python\nintervals.sort()\nmerged = []\nfor start, end in intervals:\n    if merged and start <= merged[-1][1]:\n        merged[-1][1] = max(merged[-1][1], end)\n    else:\n        merged.append([start, end])\n```\n\n排序的时间复杂度为$O(n \\log n)$。\n\n| 输入 | 输出 |\n| --- | --- |\n| [1, 3], [2, 6] | [1, 6] |\n\n参考：[Python排序指南](https://docs.python.org/3/howto/sorting.html)",
      },
    ],
  },
];
try {
  await acceptPrivacy(ctx);
  await ctx.route("https://files.deepseeksvc.com/**", (r) => {
    reads++;
    return r.fulfill({ contentType: "image/png", body: mascot });
  });
  await ctx.route("https://chat.deepseek.com/**", (r) => {
    if (r.request().url().includes("/api/v0/share/content"))
      return r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          data: {
            biz_code: 0,
            biz_data: { title: "区间合并阅读笔记", messages },
          },
        }),
      });
    return r.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><meta charset="utf-8"><title>区间合并阅读笔记 - DeepSeek</title><style>body{margin:0;background:#fff;color:#24272e;font:16px/1.8 system-ui}main{max-width:820px;margin:40px auto}body.dark{background:#202124;color:#eee}h1{font-size:26px}</style><main><h1>区间合并阅读笔记</h1><p>DeepSeek Export Plus · 功能演示</p><p>先按左端点排序，再依次合并重叠区间。</p></main>`,
    });
  });
  const page = await ctx.newPage();
  const downloads = await watchDownloads(ctx, page, "tmp/formats-downloads");
  const open = async () => {
    await page.getByRole("button", { name: "导出对话", exact: true }).click();
    await page
      .getByRole("button", {
        name: /导出Markdown|打包导出|导出HTML|导出TXT|导出JSON/,
      })
      .waitFor();
  };
  await page.goto("https://chat.deepseek.com/share/format-demo");
  await open();
  assert.equal(await page.locator("#thinking").isChecked(), false);
  const formats = async (values) => {
    for (const value of ["md", "html", "txt", "json"])
      await page
        .locator(`input[name=format][value=${value}]`)
        .setChecked(values.includes(value));
  };
  await page.locator("#from").fill("2");
  await page.getByRole("button", { name: "选中范围" }).click();
  await page.locator("#offline").uncheck();
  for (const format of ["md", "html", "txt", "json"]) {
    await formats([format]);
    const label = format === "md" ? "Markdown" : format.toUpperCase();
    await page
      .getByRole("button", { name: `导出${label}`, exact: true })
      .click();
    const item = await downloads.next(`${out}/单格式.${format}`);
    assert.ok(item.suggestedFilename.endsWith(`.${format}`));
    assert.match(
      item.suggestedFilename,
      /_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\./,
    );
    const file = await readFile(`${out}/单格式.${format}`, "utf8");
    assert.doesNotMatch(file, /先检查边界|找到资料后|检索词/);
    assert.match(file, /intervals\.sort/);
    if (format === "json")
      assert.deepEqual(
        JSON.parse(file).rounds.map((r) => r.number),
        [2],
      );
  }
  assert.equal(reads, 0, "online-link exports must not fetch images");
  await formats([]);
  assert.equal(
    await page.getByRole("button", { name: "选择导出格式" }).isDisabled(),
    true,
  );
  assert.equal(
    await page.getByRole("button", { name: "复制Markdown" }).isEnabled(),
    true,
  );
  await formats(["md", "html", "txt", "json"]);
  await page.locator("#offline").check();
  await page.locator("#thinking").check();
  const before = downloads.count;
  await page.getByRole("button", { name: "打包导出（4种格式）" }).click();
  await downloads.next(`${out}/多格式与附件.zip`);
  assert.equal(downloads.count - before, 1);
  assert.equal(reads, 1);
  const files = unzipSync(await readFile(`${out}/多格式与附件.zip`));
  assert.equal(
    Object.keys(files).filter((f) => f.startsWith("assets/")).length,
    1,
  );
  const json = JSON.parse(strFromU8(files["对话.json"]));
  assert.equal(json.rounds[0].number, 2);
  assert.deepEqual(
    json.rounds[0].messages[1].reasoning.map((p) => p.kind),
    ["thinking", "tool", "thinking"],
  );
  await page.locator("#thinking").uncheck();
  await page.getByRole("button", { name: "打包导出（4种格式）" }).click();
  await downloads.next(`${out}/取消思考后.zip`);
  for (const [name, bytes] of Object.entries(
    unzipSync(await readFile(`${out}/取消思考后.zip`)),
  ))
    if (name.startsWith("对话."))
      assert.doesNotMatch(
        strFromU8(bytes),
        /先检查边界|找到资料后|检索词|"reasoning"/,
      );
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await open();
  assert.equal(await page.locator("input[name=format]:checked").count(), 4);
  assert.equal(await page.locator("#thinking").isChecked(), false);
  await page.locator(".options").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "docs/store/images/formats-light.png" });
  await page.evaluate(() => document.body.classList.add("dark"));
  await page.waitForFunction(
    () =>
      document.querySelector("#dsx-dialog-host").style.colorScheme === "dark",
  );
  await page.screenshot({ path: "docs/store/images/formats-dark.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page
      .locator("dialog")
      .evaluate((e) => e.getBoundingClientRect().right <= innerWidth),
  );
  for (const check of await page.locator("input[name=format]").all()) {
    await check.scrollIntoViewIfNeeded();
    assert.ok(await check.isVisible());
  }
  await page.screenshot({ path: `${out}/formats-narrow.png` });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "导出对话内文件" }).click();
  await page.locator(".file-list .item").first().waitFor();
  await page.screenshot({ path: "docs/store/images/attachments.png" });
  // Re-open a real file:// export with the ZIP's sibling assets, no network.
  const unpacked = resolve(out, "解压示例");
  for (const [name, bytes] of Object.entries(files)) {
    const dest = resolve(unpacked, name);
    assert.ok(
      dest.startsWith(unpacked + "/") || dest.startsWith(unpacked + "\\"),
    );
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, bytes);
  }
  const html = await ctx.newPage();
  const network = [];
  html.on("request", (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  await html.goto(pathToFileURL(resolve(unpacked, "对话.html")).href);
  assert.equal(
    await html.locator("main h1").textContent(),
    "DeepSeek 对话记录",
  );
  assert.equal(await html.locator("main h2").textContent(), "第 2 轮");
  await html.waitForFunction(() =>
    [...document.images].every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
  );
  assert.equal(await html.locator("main img").count(), 1);
  assert.equal(await html.locator("math").count(), 1);
  assert.equal(await html.locator("blockquote em").count(), 0);
  assert.equal(
    await html.locator("pre code").textContent(),
    "intervals.sort()\nmerged = []\nfor start, end in intervals:\n    if merged and start <= merged[-1][1]:\n        merged[-1][1] = max(merged[-1][1], end)\n    else:\n        merged.append([start, end])\n",
  );
  await html.locator("main h3").last().scrollIntoViewIfNeeded();
  await html.screenshot({ path: "docs/store/images/html-export.png" });
  await html
    .locator("main h4")
    .last()
    .evaluate((el) => el.scrollIntoView());
  await html.screenshot({ path: "docs/store/images/html-content.png" });
  assert.deepEqual(network, []);
  assert.deepEqual(errors, []);
  await copyFile("public/icons/fish-128.png", "docs/store/images/icon-128.png");
  await writeFile(
    `${out}/formats-browser-results.json`,
    JSON.stringify(
      {
        singleFormats: 4,
        oneDownloadForBundle: true,
        oneReadPerAsset: true,
        thinkingOmittedAfterUncheck: true,
        roundSelection: true,
        formatPreference: true,
        thinkingNotRemembered: true,
        offlineHTML: true,
        encodedAssetFilename: true,
        nativeMathML: true,
        externalRequests: network,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Multi-format browser checks passed: four direct downloads, ZIP, thinking toggle, preferences, offline HTML, screenshots.",
  );
} finally {
  await ctx.close();
}
