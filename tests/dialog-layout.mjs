import { chromium } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

await mkdir("tmp", { recursive: true });
await mkdir("output/dialog-layout", { recursive: true });
const ctx = await chromium.launchPersistentContext(
  await mkdtemp("tmp/dialog-"),
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
  const page = await ctx.newPage();
  const messages = Array.from({ length: 6 }, (_, i) => ({
    message_id: i + 1,
    role: i % 2 ? "ASSISTANT" : "USER",
    fragments: [
      {
        type: i % 2 ? "RESPONSE" : "REQUEST",
        content:
          i % 2
            ? "示例回答正文。"
            : "请说明导出结果如何保存，并保留对话里的代码和资料来源。".repeat(
                3,
              ),
      },
    ],
  }));
  await ctx.route("https://chat.deepseek.com/**", (route) =>
    route.request().url().includes("/api/v0/share/content")
      ? route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            code: 0,
            data: { biz_code: 0, biz_data: { messages } },
          }),
        })
      : route.fulfill({
          contentType: "text/html; charset=utf-8",
          body: '<!doctype html><meta charset="utf-8"><title>导出布局检查 - DeepSeek</title><style>body{margin:0;background:white;color:#24272e;font:16px/1.8 system-ui}body.dark{background:#151515;color:#eee}main{max-width:800px;margin:40px auto}</style><main><h1>导出布局检查</h1><p>三轮对话，长预览文字。</p></main>',
        }),
  );
  const worker =
    ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker"));
  const cases = [
    [1280, 1200, 1, "dark"],
    [1920, 1440, 1, "light"],
    [1920, 2160, 1, "dark"],
    [1280, 800, 1, "light"],
    [1280, 1200, 1.25, "dark"],
    [1280, 1200, 0.8, "light"],
    [1280, 720, 1.5, "dark"],
    [600, 900, 1, "light"],
    [390, 844, 1, "dark"],
  ];
  const results = [];
  for (const [width, height, zoom, theme] of cases) {
    await page.setViewportSize({ width, height });
    await page.goto("https://chat.deepseek.com/share/dialog-layout");
    await worker.evaluate(async (factor) => {
      const tabs = await chrome.tabs.query({
        url: "https://chat.deepseek.com/share/dialog-layout",
      });
      await chrome.tabs.setZoom(tabs[0].id, factor);
    }, zoom);
    await page.evaluate(
      (dark) => document.body.classList.toggle("dark", dark),
      theme === "dark",
    );
    await page.getByRole("button", { name: "导出对话", exact: true }).click();
    await page
      .getByRole("button", { name: "导出Markdown", exact: true })
      .waitFor();
    const measurements = await page.locator("dialog").evaluate((dialog) => {
      const root = dialog.getRootNode();
      const rect = (el) => el.getBoundingClientRect().toJSON();
      return {
        dialog: rect(dialog),
        shell: rect(root.querySelector(".shell")),
        footer: rect(root.querySelector("footer")),
        viewport: { width: innerWidth, height: innerHeight },
        actions: [...root.querySelectorAll("footer button")].map((button) => {
          const r = rect(button),
            target = root.elementFromPoint(
              r.x + r.width / 2,
              r.y + r.height / 2,
            );
          return {
            name: button.textContent,
            rect: r,
            hit: target === button || button.contains(target),
          };
        }),
      };
    });
    const name = `${width}x${height}-${zoom}-${theme}`;
    results.push({ name, ...measurements });
    await writeFile(
      "output/dialog-layout/results.json",
      JSON.stringify(results, null, 2),
    );
    if ((width === 1280 && height === 1200 && zoom === 1) || width === 390)
      await page.screenshot({ path: `output/dialog-layout/${name}.png` });
    assert.ok(
      measurements.shell.bottom <= measurements.dialog.bottom + 1,
      `${name}: shell bottom ${measurements.shell.bottom} exceeds dialog bottom ${measurements.dialog.bottom}`,
    );
    for (const action of measurements.actions) {
      assert.ok(
        action.rect.top >= measurements.dialog.top &&
          action.rect.bottom <= measurements.dialog.bottom + 1,
        `${name}: ${action.name} clipped`,
      );
      assert.ok(action.hit, `${name}: ${action.name} cannot receive a click`);
    }
    if (zoom === 1.25) {
      const next = ctx.waitForEvent("page");
      await page.getByRole("button", { name: "PDF", exact: true }).click();
      const preview = await next;
      await preview.waitForFunction(
        () => document.querySelector("#print")?.disabled === false,
      );
      await preview.close();
    }
    await page.getByRole("button", { name: "关闭", exact: true }).click();
  }
  console.log(
    `${results.length} dialog viewport/zoom checks passed; PDF preview opens from the visible footer.`,
  );
} finally {
  await ctx.close();
}
