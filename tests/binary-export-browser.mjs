import { chromium } from "playwright";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { watchDownloads } from "./downloads.mjs";

const out = "output/v221";
await mkdir(out, { recursive: true });
await mkdir("tmp", { recursive: true });
const ctx = await chromium.launchPersistentContext(await mkdtemp("tmp/v221-"), {
  headless: true,
  channel: process.env.DSX_TEST_BROWSER ? undefined : "chromium",
  executablePath: process.env.DSX_TEST_BROWSER || undefined,
  args: [
    `--disable-extensions-except=${resolve("dist")}`,
    `--load-extension=${resolve("dist")}`,
  ],
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
const errors = [],
  requests = [];
ctx.on("page", (p) => {
  p.on("pageerror", (e) => errors.push(e.stack));
  p.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
});
const answer =
  "## 代码、表格与公式\n\n中文正文，可编辑。English text with **bold** and *emphasis*.\n\n```python\ncount += delta\nif count == 1:\n    start = pos\n```\n\n| 名称 | 数量 |\n| --- | --- |\n| 样例甲 | 3 |\n| 样例乙 | 5 |\n\n行内公式：$a^2+b^2=c^2$。\n\n$$\n\\int_0^1 x^2\\,dx=\\frac{1}{3}\n$$\n\n$$\nA=\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix},\\quad x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}\n$$\n\n[官方资料](https://www.python.org/)\n\n1. 第一项\n2. 第二项\n   - 子项\n\n结束标记END-221";
let messages = [
  {
    role: "USER",
    message_id: 1,
    fragments: [
      {
        type: "REQUEST",
        content: "这轮不应出现在选择第二轮的导出里 ROUND-ONE-ONLY",
      },
    ],
  },
  {
    role: "ASSISTANT",
    message_id: 2,
    fragments: [{ type: "RESPONSE", content: "第一轮回答" }],
  },
  {
    role: "USER",
    message_id: 3,
    fragments: [
      { type: "REQUEST", content: "导出验收第二轮" },
      {
        type: "FILE",
        files: [
          {
            id: "picture",
            file_name: "测试 #1.png",
            is_image: true,
            signed_path: "/file?file_id=picture",
          },
        ],
      },
    ],
  },
  {
    role: "ASSISTANT",
    message_id: 4,
    fragments: [
      { type: "THINK", content: "THOUGHT-221 思考先于搜索" },
      {
        type: "SEARCH",
        queries: [{ query: "QUERY-221" }],
        results: [{ title: "Python", url: "https://www.python.org/" }],
      },
      { type: "THINK", content: "THOUGHT-AFTER-221" },
      { type: "RESPONSE", content: answer },
    ],
  },
];
let shareReads = 0,
  assetReads = 0;
const png = await readFile("public/icons/fish-128.png");
try {
  await ctx.route("https://files.deepseeksvc.com/**", (r) => {
    assetReads++;
    return r.fulfill({ contentType: "image/png", body: png });
  });
  await ctx.route("https://chat.deepseek.com/**", (r) => {
    if (r.request().url().includes("/api/v0/share/content")) {
      shareReads++;
      return r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          data: { biz_code: 0, biz_data: { messages } },
        }),
      });
    }
    if (r.request().url().includes("/api/v0/chat/history_messages"))
      return r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          data: { biz_code: 0, biz_data: { chat_messages: messages } },
        }),
      });
    return r.fulfill({
      contentType: "text/html; charset=utf-8",
      body: '<!doctype html><meta charset="utf-8"><title>公开验收对话 - DeepSeek</title><style>body{background:#fff;color:#202124;font:16px system-ui}main{margin:80px auto;max-width:800px}</style><main><h1>导出验收</h1><p>由测试代码生成的公开数据。</p></main>',
    });
  });
  const worker =
    ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker"));
  const origin = `chrome-extension://${new URL(worker.url()).hostname}`;
  const page = await ctx.newPage();
  const downloads = await watchDownloads(ctx, page, "tmp/v221-downloads");
  await page.goto("https://chat.deepseek.com/share/v221");
  assert.equal(
    await page.evaluate(
      () => !!globalThis[Symbol.for("deepseek-export-plus.history")],
    ),
    false,
  );
  await page.getByRole("button", { name: "导出对话", exact: true }).click();
  assert.equal(await page.locator("#dsx-dialog-host").count(), 0);
  assert.equal(shareReads, 0);
  const privacy = await ctx.newPage();
  await privacy.goto(origin + "/privacy/index.html");
  await privacy.locator("#deny").click();
  await privacy.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("已停止"),
  );
  assert.equal(
    await worker
      .evaluate(() => chrome.scripting.getRegisteredContentScripts())
      .then((x) => x.length),
    0,
  );
  await privacy.screenshot({
    path: out + "/privacy-light.png",
    fullPage: true,
  });
  await privacy.emulateMedia({ colorScheme: "dark" });
  await privacy.setViewportSize({ width: 390, height: 844 });
  await privacy.screenshot({
    path: out + "/privacy-dark-narrow.png",
    fullPage: true,
  });
  await privacy.locator("#allow").click();
  await privacy.waitForFunction(
    () =>
      !document.querySelector("#revoke").hidden &&
      !document.querySelector("#revoke").disabled,
  );
  await page.reload();
  const open = async () => {
    await page.getByRole("button", { name: "导出对话", exact: true }).click();
    await page.locator("input[name=format]").first().waitFor();
  };
  await open();
  assert.equal(await page.locator("#thinking").isChecked(), false);
  await page.locator("#from").fill("2");
  await page.getByRole("button", { name: "选中范围" }).click();
  const setFormats = async (values) => {
    for (const check of await page.locator("input[name=format]").all())
      await check.setChecked(
        values.includes(await check.getAttribute("value")),
      );
  };
  await page.locator("#offline").uncheck();
  await setFormats(["docx"]);
  await page.getByRole("button", { name: "导出Word", exact: true }).click();
  await downloads.next(out + "/single.docx");
  const word = unzipSync(await readFile(out + "/single.docx"));
  const xml = strFromU8(word["word/document.xml"]);
  assert.match(xml, /END-221/);
  assert.match(xml, /count \+= delta/);
  assert.match(xml, /<w:tbl>/);
  assert.doesNotMatch(xml, /ROUND-ONE-ONLY|THOUGHT-221|QUERY-221/);
  assert.match(xml, /frac/);
  assert.ok(
    Object.keys(word).filter((n) => n.startsWith("word/media/")).length >= 3,
  );
  assert.equal(assetReads, 0);
  await setFormats(["png"]);
  await page.getByRole("button", { name: "导出PNG", exact: true }).click();
  const short = await downloads.next(out + "/short-image-download");
  if (short.suggestedFilename.endsWith(".zip")) {
    const files = unzipSync(await readFile(out + "/short-image-download"));
    for (const [name, bytes] of Object.entries(files))
      await writeFile(out + "/" + name, bytes);
  } else
    await writeFile(
      out + "/short.png",
      await readFile(out + "/short-image-download"),
    );
  await setFormats(["md", "html", "txt", "json", "docx", "png"]);
  await page.locator("#thinking").check();
  await page.locator("#offline").check();
  const before = assetReads;
  await page.getByRole("button", { name: "打包导出（6种格式）" }).click();
  await downloads.next(out + "/six-formats.zip");
  assert.equal(assetReads - before, 1);
  const bundle = unzipSync(await readFile(out + "/six-formats.zip"));
  for (const format of ["md", "html", "txt", "json", "docx"])
    assert.ok(bundle[`对话.${format}`]);
  assert.ok(
    Object.keys(bundle).some(
      (n) => n.endsWith(".png") && !n.startsWith("assets/"),
    ),
  );
  const bundledWord = unzipSync(bundle["对话.docx"]);
  assert.match(strFromU8(bundledWord["word/document.xml"]), /THOUGHT-221/);
  await writeFile(out + "/with-thinking.docx", bundle["对话.docx"]);
  await page.locator("#thinking").uncheck();
  await page.locator("#offline").uncheck();
  await setFormats(["docx"]);
  await page.getByRole("button", { name: "导出Word", exact: true }).click();
  await downloads.next(out + "/after-uncheck.docx");
  assert.doesNotMatch(strFromU8(unzipSync(await readFile(out + "/after-uncheck.docx"))["word/document.xml"]), /THOUGHT-221|QUERY-221/);
  for (const [name, bytes] of Object.entries(bundle).filter(
    ([n]) => n.endsWith(".png") && !n.startsWith("assets/"),
  ))
    await writeFile(out + "/bundle-" + name, bytes);
  const previewPromise = ctx.waitForEvent("page");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const preview = await previewPromise;
  const printPage =
    preview || ctx.pages().find((p) => p.url().includes("/print/index.html"));
  await printPage.locator("#print").waitFor({ state: "visible" });
  await printPage.waitForFunction(
    () => !document.querySelector("#print").disabled,
  );
  await privacy.locator("#revoke").click();
  await privacy.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("已停止"),
  );
  await page.waitForFunction(() => !document.querySelector("#dsx-dialog-host"));
  await printPage.waitForFunction(
    () =>
      document.querySelector("#document").textContent === "" &&
      document.querySelector("#print").disabled,
  );
  assert.deepEqual(
    await worker.evaluate(() => chrome.storage.session.get(null)),
    {},
  );
  assert.equal(
    await page.evaluate(
      () => !!globalThis[Symbol.for("deepseek-export-plus.history")],
    ),
    false,
  );
  assert.equal(
    (
      await worker.evaluate(() =>
        chrome.scripting.getRegisteredContentScripts(),
      )
    ).length,
    0,
  );
  // Verify a newly opened page is also uninstrumented after revocation.
  const fresh = await ctx.newPage();
  await fresh.goto("https://chat.deepseek.com/a/chat/v221");
  assert.equal(
    await fresh.evaluate(
      () => !!globalThis[Symbol.for("deepseek-export-plus.history")],
    ),
    false,
  );
  await privacy.locator("#allow").click();
  await privacy.waitForFunction(
    () =>
      !document.querySelector("#revoke").hidden &&
      !document.querySelector("#revoke").disabled,
  );
  await fresh.evaluate(() =>
    fetch("/api/v0/chat/history_messages?chat_session_id=v221"),
  );
  await fresh.waitForFunction(() =>
    globalThis[Symbol.for("deepseek-export-plus.history")]?.read(4),
  );
  await privacy.locator("#revoke").click();
  await fresh.waitForFunction(
    () => !globalThis[Symbol.for("deepseek-export-plus.history")],
  );
  await privacy.locator("#allow").click();
  await privacy.waitForFunction(
    () =>
      !document.querySelector("#revoke").hidden &&
      !document.querySelector("#revoke").disabled,
  );
  messages = [
    {
      role: "USER",
      message_id: 1,
      fragments: [{ type: "REQUEST", content: "长图分页验收" }],
    },
    {
      role: "ASSISTANT",
      message_id: 2,
      fragments: [
        {
          type: "RESPONSE",
          content: Array.from(
            { length: 65 },
            (_, i) =>
              `第${i + 1}段 START-${i + 1}。中文分页内容，检查每一段是否完整、前后顺序是否连续。此段用来验证分页不会截掉文字。END-${i + 1}。`,
          ).join("\n\n"),
        },
      ],
    },
  ];
  await page.reload();
  await open();
  await setFormats(["png"]);
  await page.locator("#offline").uncheck();
  await page.getByRole("button", { name: "导出PNG", exact: true }).click();
  await downloads.next(out + "/long-png.zip");
  const long = unzipSync(await readFile(out + "/long-png.zip"));
  assert.ok(Object.keys(long).length >= 3);
  for (const [name, bytes] of Object.entries(long)) {
    assert.ok(bytes.length > 10000, "no empty tail image");
    await writeFile(out + "/long-" + name, bytes);
  }
  assert.deepEqual(errors, []);
  const unexpected = requests.filter(
    (url) =>
      !url.startsWith("https://chat.deepseek.com/") &&
      !url.startsWith("https://files.deepseeksvc.com/"),
  );
  assert.deepEqual(unexpected, []);
  const resultPath = process.env.DSX_TEST_BROWSER ? "/results-edge.json" : "/results-chromium.json";
  await writeFile(
    out + resultPath,
    JSON.stringify(
      {
        browserVersion: ctx.browser()?.version(),
        consentBeforeRead: true,
        deny: true,
        revokeClearsCacheAndPDF: true,
        reenable: true,
        docx: true,
        png: true,
        sixFormats: true,
        oneAssetRead: true,
        selectedRounds: true,
        noThinkingByDefault: true,
        noThinkingAfterUncheck: true,
        longPNGPagination: Object.keys(long).length,
        pdfPrintPreserved: true,
        unexpectedRequests: unexpected,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "2.2.1 consent, DOCX, PNG, six-format ZIP and PDF checks passed.",
  );
} catch (error) {
  console.error(errors);
  for (const [i, p] of ctx.pages().entries()) {
    if (p.url().includes("chat.deepseek.com"))
      console.error(await p.locator(".status").allTextContents());
  }
  throw error;
} finally {
  await ctx.close();
}
