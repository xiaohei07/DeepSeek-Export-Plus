import { chromium } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { acceptPrivacy } from "./consent-helper.mjs";

await mkdir("output/v221/toolbar", { recursive: true });
const ctx = await chromium.launchPersistentContext(
  await mkdtemp("tmp/toolbar-"),
  {
    headless: true,
    channel: process.env.DSX_TEST_BROWSER ? undefined : "chromium",
    executablePath: process.env.DSX_TEST_BROWSER || undefined,
    args: [
      `--disable-extensions-except=${resolve("dist")}`,
      `--load-extension=${resolve("dist")}`,
    ],
    viewport: { width: 1200, height: 850 },
  },
);
const results = [];
const composer = `<form id="composer" style="position:fixed;bottom:24px;left:200px;width:800px;padding:12px;background:#ddd;border-radius:20px"><textarea style="width:100%;height:80px" placeholder="给 DeepSeek 发送消息"></textarea><div style="display:flex;justify-content:space-between"><button type="button">深度思考</button><div><button type="button">上传</button><button type="button">发送</button></div></div></form>`;
try {
  await acceptPrivacy(ctx);
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  await page.route("https://chat.deepseek.com/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><style>#composer button{height:40px}header{position:fixed;inset:0 0 auto;height:60px;background:white;z-index:1000}</style><header>固定页头</header><main><h1>正在加载对话</h1></main>",
    }),
  );
  for (const route of ["a/chat/fixture", "share/fixture"]) {
    await page.goto("https://chat.deepseek.com/" + route);
    const bar = page.locator("#ai-exporter-buttons");
    await bar.waitFor();
    const initial = await bar.boundingBox();
    assert.ok(
      initial.y > 200 && initial.x < 32,
      "missing composer must not jump to the page header",
    );
    assert.equal(await page.locator("main #ai-exporter-buttons").count(), 0);
    // Native header must not intercept a normal pointer click (no force/Tab).
    await page.getByRole("button", { name: "导出对话", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    await page.evaluate(
      (html) => document.body.insertAdjacentHTML("beforeend", html),
      composer,
    );
    await page.waitForFunction(
      () =>
        document.querySelector("#ai-exporter-buttons").dataset.placement ===
        "row",
    );
    const normal = await bar.boundingBox();
    await page.evaluate(() => {
      const dialog = document.createElement("div");
      dialog.id = "native-share";
      dialog.setAttribute("role", "dialog");
      dialog.style.cssText =
        "position:fixed;inset:100px;background:white;z-index:2000";
      dialog.innerHTML =
        '<textarea style="width:850px;height:400px">分享说明</textarea><button>确认</button>';
      document.body.append(dialog);
    });
    await bar.waitFor({ state: "hidden" });
    await page.locator("#native-share").evaluate((el) => el.remove());
    await bar.waitFor({ state: "visible" });
    assert.deepEqual(await bar.boundingBox(), normal);
    await page.locator("#composer").evaluate((el) => el.remove());
    await page.waitForFunction(
      () =>
        document.querySelector("#ai-exporter-buttons").dataset.placement ===
        "dock",
    );
    await page.evaluate((html) => {
      document.body.insertAdjacentHTML("beforeend", html);
      history.pushState({}, "", "/a/chat/replaced");
    }, composer);
    await page.waitForFunction(
      () =>
        document.querySelector("#ai-exporter-buttons").dataset.placement ===
        "row",
    );
    assert.deepEqual(await bar.boundingBox(), normal);
    assert.equal(await bar.count(), 1);
    await page.reload();
    await bar.waitFor();
    const reloaded = await bar.boundingBox();
    assert.ok(reloaded.y > 200 && reloaded.x < 32);
    results.push({
      route,
      initial,
      normal,
      reloaded,
      modalHidden: true,
      replacement: true,
    });
  }
  await page.screenshot({ path: "output/v221/toolbar/no-composer.png" });
  await writeFile(
    `output/v221/toolbar/results-${process.env.DSX_TEST_BROWSER ? "edge" : "chromium"}.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(
    "chat/share: delayed composer, native share dialog, replacement, SPA navigation and reload passed",
  );
} finally {
  await ctx.close();
}
