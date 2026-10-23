// Reproduce the narrow send-button wrapper from the reported composer layout.
import { chromium } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
await mkdir("output/2.1.2", { recursive: true });
await mkdir("tmp", { recursive: true });
await mkdir("docs/images", { recursive: true });
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
  await page.bringToFront();
  await page.route("https://chat.deepseek.com/**", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><meta charset="utf-8"><title>布局测试 - DeepSeek</title>
    <style>body{margin:0;background:#111;color:#eee;font:16px system-ui}main{max-width:872px;margin:40px auto}#composer{box-sizing:border-box;position:fixed;bottom:24px;left:50%;transform:translateX(-50%);width:calc(100% - 48px);max-width:872px;padding:14px;border:1px solid #383838;border-radius:28px;background:#2b2b2d}textarea{box-sizing:border-box;width:100%;height:88px;background:transparent;border:0;resize:none;color:inherit;font:18px system-ui}#controls{display:flex;align-items:center;justify-content:space-between}#features,#right{display:flex;align-items:center;gap:10px;flex-shrink:0}.native{box-sizing:border-box;height:40px;border-radius:20px;border:1px solid #5675b8;background:transparent;color:#8daeff;font:14px system-ui;padding:0 12px}#upload,#send{width:40px;padding:0}#send{background:#4268b2;color:white}#send-wrap{width:40px;flex-shrink:0}body.light{background:#fff;color:#202124}body.light #composer{background:#f4f4f4;border-color:#ddd}</style>
    <main><h1>对话区域</h1><p>发送按钮应保持原位，导出按钮不能挤动输入框。</p></main>
    <form id="composer"><textarea placeholder="给 DeepSeek 发送消息"></textarea><div id="controls"><div id="features"><button type="button" class="native">深度思考</button><button type="button" class="native">智能搜索</button></div><div id="right"><button type="button" class="native" id="upload" aria-label="添加附件">＋</button><div id="send-wrap"><button type="submit" class="native" id="send" aria-label="发送">↑</button></div></div></div></form>
    <script>const down=document.createElement('button');down.id='native-down';down.type='button';down.textContent='↓';down.setAttribute('aria-label','回到底部');down.style.cssText='position:absolute;right:0;bottom:calc(100% + 8px);width:40px;height:40px;border-radius:20px';down.onclick=()=>document.body.dataset.downClicked='true';document.querySelector('#composer').append(down);const height=Number(new URL(location.href).searchParams.get('controlHeight'))||40;document.querySelectorAll('.native').forEach(el=>el.style.height=height+'px');const layout=new URL(location.href).searchParams.get('layout');if(layout==='grid')document.querySelector('#controls').style.cssText='display:grid;grid-template-columns:1fr auto;align-items:center';if(layout==='grow')document.querySelector('#features').style.flex='1';window.originalHeight=document.querySelector('#composer').getBoundingClientRect().height;window.baseline=Object.fromEntries(['composer','upload','send','features','native-down'].map(id=>[id,document.getElementById(id).getBoundingClientRect().toJSON()]));document.querySelector('#upload').onclick=()=>document.body.dataset.uploadClicked='true';document.querySelector('#composer').onsubmit=e=>{e.preventDefault();document.body.dataset.sendClicked='true'};</script>`,
    }),
  );
  for (const layout of ["grid", "grow", "flex"]) {
    for (const route of ["a/chat/fixture", "share/fixture"]) {
      for (const height of [40, 36]) {
        for (const width of [1200, 983, 600, 390]) {
          await page.setViewportSize({ width, height: 844 });
          await page.goto(
            "https://chat.deepseek.com/" +
              route +
              "?controlHeight=" +
              height +
              "&layout=" +
              layout,
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
                baseline: window.baseline,
                features: rect("features"),
                placement: document.getElementById("ai-exporter-buttons")
                  .dataset.placement,
                parent: document.getElementById("ai-exporter-buttons")
                  .parentElement.id,
              };
            });
            const name = `${layout}-${route.startsWith("share") ? "share" : "chat"}-${width}-${theme}${height === 36 ? "-36px" : ""}`;
            const overlaps = (a, b) =>
              a.x < b.right &&
              a.right > b.x &&
              a.y < b.bottom &&
              a.bottom > b.y;
            await page.screenshot({
              path: `output/2.1.2/${name}.png`,
            });
            if (
              ((width === 983 && theme === "dark" && height === 36) ||
                (width === 390 && theme === "light" && height === 40)) &&
              route.startsWith("a/")
            ) {
              await page.screenshot({
                path: `docs/images/toolbar-${width === 983 ? "wide" : "narrow"}.png`,
                clip: {
                  x: 0,
                  y: state.down.top - 8,
                  width,
                  height: state.composer.bottom - state.down.top + 16,
                },
              });
            }
            assert.ok(
              !overlaps(state.toolbar, state.down),
              `${name}: toolbar covers the native scroll-to-bottom button`,
            );
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
            for (const id of [
              "composer",
              "upload",
              "send",
              "features",
              "native-down",
            ]) {
              const current = await page.locator("#" + id).boundingBox();
              for (const key of ["x", "y", "width", "height"])
                assert.ok(
                  Math.abs(current[key] - state.baseline[id][key]) < 1,
                  `${name}: native ${id}.${key} changed`,
                );
            }
            if (width >= 600) {
              assert.equal(
                state.placement,
                "row",
                `${name}: place in the visible controls row`,
              );
              assert.ok(
                Math.abs(
                  state.toolbar.y +
                    state.toolbar.height / 2 -
                    state.upload.y -
                    state.upload.height / 2,
                ) < 1,
                `${name}: align with native control centers`,
              );
              assert.ok(
                state.toolbar.left >= state.features.left + 190 &&
                  state.toolbar.right < state.upload.left,
                `${name}: use middle gap`,
              );
              if (width >= 983)
                assert.ok(
                  Math.abs(
                    state.toolbar.x +
                      state.toolbar.width / 2 -
                      state.composer.x -
                      state.composer.width / 2,
                  ) < 1,
                  `${name}: center horizontally`,
                );
            } else {
              assert.equal(state.placement, "side");
              assert.ok(
                !overlaps(state.toolbar, state.composer),
                `${name}: side toolbar must stay outside composer`,
              );
            }
            await page
              .getByRole("button", { name: "添加附件", exact: true })
              .click();
            await page
              .getByRole("button", { name: "发送", exact: true })
              .click();
            assert.equal(
              await page.locator("body").getAttribute("data-upload-clicked"),
              "true",
            );
            assert.equal(
              await page.locator("body").getAttribute("data-send-clicked"),
              "true",
            );
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
  }
  // Resizing the same composer must move the toolbar out and back without reflow.
  await page.setViewportSize({ width: 1200, height: 844 });
  await page.waitForFunction(
    () =>
      document.getElementById("ai-exporter-buttons").dataset.placement ===
      "row",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () =>
      document.getElementById("ai-exporter-buttons").dataset.placement ===
      "side",
  );
  assert.equal(await page.locator("#ai-exporter-buttons").count(), 1);
  await page.reload();
  await page.locator("#ai-exporter-buttons").waitFor();
  assert.equal(await page.locator("#ai-exporter-buttons").count(), 1);
  // Both compact side buttons still open the same accessible dialogs.
  for (const name of ["导出对话", "导出对话内文件"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "关闭", exact: true }).click();
  }
  // Composer size changes must update the independent toolbar, including a
  // contenteditable input. Native row coordinates are the reference.
  await page.setViewportSize({ width: 983, height: 844 });
  await page.evaluate(() => {
    const form = document.getElementById("composer");
    form.style.bottom = "auto";
    form.style.top = "200px";
    const textarea = form.querySelector("textarea");
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    editable.style.cssText = "width:100%;height:180px";
    textarea.replaceWith(editable);
  });
  const aligned = () => {
    const bar = document
      .getElementById("ai-exporter-buttons")
      .getBoundingClientRect();
    const send = document.getElementById("send").getBoundingClientRect();
    return Math.abs(bar.top + bar.height / 2 - send.top - send.height / 2) < 1;
  };
  await page.waitForFunction(aligned);
  await page
    .locator('[contenteditable="true"]')
    .evaluate((el) => (el.style.height = "250px"));
  await page.waitForFunction(aligned);
  // No side gutter: fall back to the conversation header without input reflow.
  await page.evaluate(() => {
    const form = document.getElementById("composer");
    form.style.width = "100%";
    form.style.maxWidth = "none";
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.waitForFunction(
    () =>
      document.getElementById("ai-exporter-buttons").dataset.placement ===
      "page",
  );
  assert.equal(await page.locator("#composer #ai-exporter-buttons").count(), 0);
  await writeFile(
    "output/2.1.2/layout-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    `${results.length} chat/share, light/dark and viewport layout checks passed; resize/reload, compact dialogs, contenteditable, dynamic height and edge-to-edge fallback passed.`,
  );
} finally {
  await context.close();
}
