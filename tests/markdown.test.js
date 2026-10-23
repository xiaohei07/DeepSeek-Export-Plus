import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { getTextContent } from "../public/content/markdown.js";
function convert(html) {
  const dom = new JSDOM(`<main>${html}</main>`);
  globalThis.Node = dom.window.Node;
  return getTextContent(dom.window.document.querySelector("main"));
}

test("DeepSeek code banner supplies language but is not body text", () => {
  const result = convert(
    '<div class="md-code-block"><div class="md-code-block-banner"><div class="md-code-block-infostring">python</div><div>复制下载</div></div><pre><span>print(1)</span></pre></div><p>后文</p>',
  );
  assert.match(result, /```python\nprint\(1\)\n```\n\n后文/);
  assert.doesNotMatch(result, /复制|下载/);
});
test("unknown language is text; nested wrappers preserve closing fence boundary", () => {
  const result = convert("<div><pre>x = 1</pre></div><p>后文</p>");
  assert.match(result, /```text\nx = 1\n```\n\n后文/);
});
test("fences longer than backticks inside code preserve Markdown examples", () => {
  const result = convert(
    '<pre><code class="language-markdown">```python\nx\n```</code></pre><p>end</p>',
  );
  assert.match(result, /````markdown\n```python\nx\n```\n````\n\nend/);
});
test("inline formatting preserves meaningful spaces", () => {
  assert.equal(
    convert("<p>hello <strong>bold</strong> world <code>a`b</code>.</p>"),
    "hello **bold** world ``a`b``.",
  );
});
test("display math uses double dollars once", () => {
  assert.equal(
    convert(
      '<span class="katex-display"><span class="katex"><math><annotation encoding="application/x-tex">x^2</annotation></math><span class="katex-html">duplicate</span></span></span>',
    ),
    "$$\nx^2\n$$",
  );
});
