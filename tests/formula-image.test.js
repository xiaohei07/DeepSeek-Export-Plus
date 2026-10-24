import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderMarkdown } from "../public/print/render.js";
import { formulaSvg } from "../public/export/formulaSvg.js";

test("formula SVG is valid XML with text spaces, comparisons, Chinese and nested math namespaces", () => {
  const window = new JSDOM("").window;
  const formula = String.raw`f(x)=\begin{cases}\sqrt{x} & \text{当 x > 0 时} \\ 0 & \text{A \& B}\end{cases}`;
  window.document.body.innerHTML = renderMarkdown(
    `$$\n${formula}\n$$`,
    window,
    {
      standalone: true,
      mathOutput: "htmlAndMathml",
    },
  );
  const element = window.document.querySelector(".katex");
  assert.match(
    element.outerHTML,
    /&nbsp;/,
    "fixture must exercise the old HTML entity bug",
  );
  const css = '.test::before{content:"A & B < C"}';
  const result = formulaSvg(element, css, 900, 200);
  const parsed = new window.DOMParser().parseFromString(
    result,
    "image/svg+xml",
  );
  assert.equal(parsed.querySelector("parsererror"), null);
  assert.equal(
    parsed.documentElement.namespaceURI,
    "http://www.w3.org/2000/svg",
  );
  assert.equal(
    parsed.querySelector("div").namespaceURI,
    "http://www.w3.org/1999/xhtml",
  );
  assert.equal(
    parsed.querySelector("math").namespaceURI,
    "http://www.w3.org/1998/Math/MathML",
  );
  assert.equal(
    parsed.querySelector("path").namespaceURI,
    "http://www.w3.org/2000/svg",
  );
  assert.equal(parsed.querySelector("style").textContent, css);
  assert.ok(parsed.querySelector("math").textContent.includes(formula));
  assert.equal(parsed.querySelector(".katex").textContent, element.textContent);
  assert.ok(!result.includes("&nbsp;"));
});
