// Reproduce the narrow send-button wrapper from the reported composer layout.
import { chromium } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
await mkdir("output/2.1.1", { recursive: true });
const context = await chromium.launchPersistentContext(
  await mkdtemp("tmp/layout-"),
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
const results = [];
try {
  const page = await context.newPage();
  await page.route("https://chat.deepseek.com/**", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><meta charset="utf-8"><title>布局测试 - DeepSeek</title>
    <style>body{margin:0;background:#111;color:#eee;font:16px system-ui}main{max-width:872px;margin:40px auto}#composer{box-sizing:border-box;position:fixed;bottom:24px;left:50%;transform:translateX(-50%);width:calc(100% - 48px);max-width:872px;padding:14px;border:1px solid #383838;border-radius:28px;background:#2b2b2d}textarea{box-sizing:border-box;width:100%;height:88px;background:transparent;border:0;resize:none;color:inherit;font:18px system-ui}#controls{display:flex;align-items:center;justify-content:space-between}#features,#right{display:flex;align-items:center;gap:10px;flex-shrink:0}.native{box-sizing:border-box;height:40px;border-radius:20px;border:1px solid #5675b8;background:transparent;color:#8daeff;font:14px system-ui;padding:0 12px}#upload,#send{width:40px;padding:0}#send{background:#4268b2;color:white}#send-wrap{width:40px;flex-shrink:0}body.light{background:#fff;color:#202124}body.light #composer{background:#f4f4f4;border-color:#ddd}</style>
    <main><h1>对话区域</h1><p>发送按钮应保持原位，导出按钮不能挤动输入框。</p></main>
    <form id="composer"><textarea placeholder="给 DeepSeek 发送消息"></textarea><div id="controls"><div id="features"><button type="button" class="native">深度思考</button><button type="button" class="native">智能搜索</button></div><div id="right"><button type="button" class="native" id="upload" aria-label="添加附件">＋</button><div id="send-wrap"><button type="submit" class="native" id="send" aria-label="发送">↑</button></div></div></div></form>
    <script>const down=document.createElement('button');down.id='native-down';down.type='button';down.textContent='↓';down.setAttribute('aria-label','回到底部');down.style.cssText='position:absolute;right:0;bottom:calc(100% + 8px);width:40px;height:40px;border-radius:20px';down.onclick=()=>document.body.dataset.downClicked='true';document.querySelector('#composer').append(down);const height=Number(new URL(location.href).searchParams.get('controlHeight'))||40;document.querySelectorAll('.native').forEach(el=>el.style.height=height+'px');window.originalHeight=document.querySelector('#composer').getBoundingClientRect().height;</script>`,
    }),
  );
  for (const route of ["a/chat/fixture", "share/fixture"]) {
    for (const height of [40, 36]) {
      for (const width of [1200, 983, 600, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(
          "https://chat.deepseek.com/" + route + "?controlHeight=" + height,
        );
        await page.locator("#ai-exporter-buttons").waitFor();
        for (const theme of ["dark", "light"]) {
          await page.evaluate(
            (light) => document.body.classList.toggle("light", light),
            theme === "light",
          );
          await page.waitForFunction(
            (scheme) =>
              document.querySelector("#ai-exporter-buttons").style
                .colorScheme === scheme,
            theme,
          );
          const state = await page.evaluate(() => {
            const rect = (id) =>
              document.getElementById(id).getBoundingClientRect().toJSON();
            return {
              toolbar: rect("ai-exporter-buttons"),
              send: rect("send"),
              upload: rect("upload"),
              composer: rect("composer"),
              down: rect("native-down"),
              originalHeight: window.originalHeight,
              parent: document.getElementById("ai-exporter-buttons")
                .parentElement.id,
            };
          });
          const name = `${route.startsWith("share") ? "share" : "chat"}-${width}-${theme}${height === 36 ? "-36px" : ""}`;
          const overlaps = (a, b) =>
            a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
          await page.screenshot({ path: `output/2.1.1/${name}.png` });
          if (
            ((width === 983 && theme === "dark" && height === 36) ||
              (width === 390 && theme === "light" && height === 40)) &&
            route.startsWith("a/")
          ) {
            await page.screenshot({
              path: `docs/images/toolbar-${width === 983 ? "wide" : "narrow"}.png`,
              clip: {
                x: Math.max(0, state.composer.x - 8),
                y: state.down.top - 8,
                width: state.composer.width + 16,
                height: state.composer.bottom - state.down.top + 16,
              },
            });
          }
          assert.ok(
            !overlaps(state.toolbar, state.down),
            `${name}: toolbar covers the native scroll-to-bottom button`,
          );
          if (width >= 600)
            assert.ok(
              Math.abs(state.composer.height - state.originalHeight) < 1,
              `${name}: toolbar changed composer height (${state.originalHeight} → ${state.composer.height})`,
            );
          assert.ok(
            Math.abs(state.send.y - state.upload.y) < 1,
            `${name}: send and upload no longer aligned`,
          );
          assert.ok(
            state.toolbar.x >= 0 && state.toolbar.right <= width,
            `${name}: toolbar outside viewport`,
          );
          assert.ok(
            !overlaps(state.toolbar, state.send) &&
              !overlaps(state.toolbar, state.upload),
            `${name}: toolbar overlaps native buttons`,
          );
          if (width >= 600) {
            assert.equal(
              state.parent,
              "controls",
              `${name}: insert in the wide controls row`,
            );
            assert.ok(
              state.upload.x - state.toolbar.right >= 7 &&
                state.upload.x - state.toolbar.right <= 9,
              `${name}: toolbar should sit beside attachment controls`,
            );
          } else {
            assert.ok(
              state.toolbar.top > state.composer.top &&
                state.toolbar.bottom < state.upload.top,
              `${name}: narrow layout should reserve a separate row inside composer`,
            );
            assert.equal(state.parent, "composer");
          }
          await page.getByRole("button", { name: "回到底部" }).click();
          assert.equal(
            await page.locator("body").getAttribute("data-down-clicked"),
            "true",
          );
          results.push({ name, ...state });
        }
      }
    }
  }
  // Resizing the same composer must move the toolbar out and back without reflow.
  await page.setViewportSize({ width: 1200, height: 844 });
  await page.waitForFunction(
    () =>
      document.getElementById("ai-exporter-buttons").parentElement.id ===
      "controls",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () =>
      document.getElementById("ai-exporter-buttons").parentElement.id ===
      "composer",
  );
  assert.equal(await page.locator("#ai-exporter-buttons").count(), 1);
  await page.reload();
  await page.locator("#ai-exporter-buttons").waitFor();
  assert.equal(await page.locator("#ai-exporter-buttons").count(), 1);
  await writeFile(
    "output/2.1.1/layout-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    `${results.length} chat/share, light/dark and viewport layout checks passed; resize/reload passed.`,
  );
} finally {
  await context.close();
}
