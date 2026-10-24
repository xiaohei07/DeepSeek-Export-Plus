import { chromium } from "playwright";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { JSDOM } from "jsdom";

// Public synthetic formulas: never commit a captured conversation or signed URL.
const markdown =
  String.raw`# 公式图片回归

行内说明：$\text{hello world}$，比较：$a < b \quad \text{A \& B}$。

$$
f(x)=\begin{cases}x^2 & \text{if } x>0 \\0 & \text{otherwise}\end{cases}
$$

$$
\begin{aligned}a&=b+c\\&=d\end{aligned}
$$

$$
\text{当 x 大于 0 时}\quad x=\frac{-b+\sqrt{b^2-4ac}}{2a}
$$

$$
\underbrace{a+b+\cdots+z}_{26\text{ letters}}
$$

结束标记 MATH-IMAGE-END
` +
  "\n\n> 思考控制字符：前\f后\u000b，中文与emoji😀保留。\n\n```text\ncode\u0001END\n```\n";
const out = "output/v221/decode-fix";
await mkdir(out, { recursive: true });
await mkdir("tmp", { recursive: true });
const ctx = await chromium.launchPersistentContext(
  await mkdtemp("tmp/math-image-"),
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
const errors = [],
  requests = [];
ctx.on("page", (page) => {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
});
try {
  const worker =
    ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker"));
  const page = await ctx.newPage();
  await page.goto(
    `chrome-extension://${new URL(worker.url()).hostname}/privacy/index.html`,
  );
  const files = await page.evaluate(async (markdown) => {
    const { renderBinaryDocuments } = await import("../export/binary.js");
    const result = await renderBinaryDocuments({
      markdown,
      title: "公式图片回归\f",
      formats: ["docx", "png"],
    });
    return Object.fromEntries(
      Object.entries(result).map(([name, bytes]) => [name, Array.from(bytes)]),
    );
  }, markdown);
  const word = unzipSync(Uint8Array.from(files["对话.docx"]));
  const parser = new new JSDOM("").window.DOMParser();
  for (const [name, bytes] of Object.entries(word)) {
    if (!/\.(xml|rels)$/.test(name)) continue;
    const parsed = parser.parseFromString(strFromU8(bytes), "application/xml");
    assert.equal(
      parsed.querySelector("parsererror"),
      null,
      `invalid DOCX part: ${name}`,
    );
  }
  const xml = strFromU8(word["word/document.xml"]);
  assert.ok(xml.includes("前\\u000c后\\u000b"));
  assert.ok(xml.includes("code\\u0001END"));
  assert.ok(xml.includes("😀"));
  assert.match(xml, /MATH-IMAGE-END/);
  assert.match(xml, /hello world/);
  assert.match(xml, /当 x 大于 0 时/);
  assert.ok(
    Object.keys(word).filter((n) => n.startsWith("word/media/")).length >= 6,
  );
  const pngs = Object.entries(files).filter(([name]) => name.endsWith(".png"));
  assert.ok(pngs.length > 0);
  for (const [name, bytes] of Object.entries(files)) {
    assert.ok(bytes.length > 10000, name);
    await writeFile(`${out}/synthetic-${name}`, Uint8Array.from(bytes));
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  const result = {
    browser: ctx.browser().version(),
    formulaKinds: 6,
    docx: true,
    pngPages: pngs.length,
    errors,
    requests,
  };
  await writeFile(
    `${out}/regression-${process.env.DSX_TEST_BROWSER ? "edge" : "chromium"}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await ctx.close();
}
