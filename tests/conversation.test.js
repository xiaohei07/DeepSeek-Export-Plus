import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  extractMessage,
  withExpandedThinking,
  detectRole,
} from "../public/content/extractor.js";
import {
  formatConversation,
  nestMarkdown,
} from "../public/content/markdown.js";
import {
  parseShareData,
  fetchShareConversation,
} from "../public/content/share.js";
import { renderMarkdown } from "../public/print/render.js";
import {
  scrollToLoadAllMessages,
  findMainScrollContainer,
} from "../public/utils/scrollLoader.js";

function page(html) {
  const dom = new JSDOM(html, { url: "https://chat.deepseek.com/a/chat/test" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Node: dom.window.Node,
    getComputedStyle: dom.window.getComputedStyle,
  });
  return dom.window.document.querySelector(".ds-message");
}
test("all thought fragments are separated from all answer fragments", () => {
  const msg = page(
    '<div class="ds-message"><div class="ds-think-content"><div class="ds-markdown">思考一</div></div><div class="ds-think-content"><div class="ds-markdown">思考二</div></div><div class="ds-markdown ds-assistant-message-main-content">回答一</div><div class="ds-markdown ds-assistant-message-main-content">回答二</div></div>',
  );
  const record = extractMessage(msg, 0);
  assert.equal(record.role, "assistant");
  assert.equal(record.content, "回答一\n\n回答二");
  assert.equal(record.thinking, "思考一\n\n思考二");
  assert.equal(extractMessage(msg, 0, false).thinking, "");
});
test("collapsed asynchronous thinking is expanded and restored", async () => {
  const msg = page(
    '<div class="ds-message"><button aria-expanded="false">已思考（用时 12 秒）</button><div class="ds-markdown ds-assistant-message-main-content">最终回答</div></div>',
  );
  const button = msg.querySelector("button");
  let clicks = 0;
  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") === "false";
    button.setAttribute("aria-expanded", String(open));
    clicks++;
    if (open)
      setTimeout(
        () =>
          button.insertAdjacentHTML(
            "afterend",
            '<div class="ds-think-content"><div class="ds-markdown">思考一</div><div class="ds-markdown">思考二</div></div>',
          ),
        10,
      );
    else msg.querySelector(".ds-think-content")?.remove();
  });
  const result = await withExpandedThinking(msg, () => extractMessage(msg), {
    timeout: 500,
    stableFor: 30,
    interval: 10,
  });
  assert.equal(result.thinking, "思考一\n\n思考二");
  assert.equal(result.content, "最终回答");
  assert.equal(clicks, 2);
  assert.equal(button.getAttribute("aria-expanded"), "false");
});
test("already expanded thinking is not toggled; explicit user role takes priority", async () => {
  const msg = page(
    '<div class="ds-message" data-role="user"><button aria-expanded="true">思考过程</button><div class="ds-think-content">可见</div></div>',
  );
  let clicks = 0;
  msg.querySelector("button").onclick = () => clicks++;
  assert.equal(detectRole(msg, 1), "user");
  await withExpandedThinking(msg, () => ({ content: "x" }));
  assert.equal(clicks, 0);
});
test("timeout is visible and controls are restored", async () => {
  const msg = page(
    '<div class="ds-message"><button aria-expanded="false">思考过程</button><div class="ds-markdown">回答</div></div>',
  );
  const button = msg.querySelector("button");
  button.onclick = () =>
    button.setAttribute(
      "aria-expanded",
      String(button.getAttribute("aria-expanded") === "false"),
    );
  const result = await withExpandedThinking(msg, () => extractMessage(msg), {
    timeout: 30,
    interval: 10,
  });
  assert.match(result.warnings.join("\n"), /思考过程未能加载/);
  assert.equal(button.getAttribute("aria-expanded"), "false");
});
test("share raw data includes every THINK and RESPONSE in order", () => {
  const json = {
    code: 0,
    data: {
      biz_code: 0,
      biz_data: {
        title: "test",
        messages: [
          {
            message_id: 1,
            role: "USER",
            fragments: [{ type: "REQUEST", content: "问题" }],
          },
          {
            message_id: 2,
            role: "ASSISTANT",
            fragments: [
              { type: "THINK", content: "一" },
              { type: "TOOL_SEARCH", content: "tool" },
              { type: "THINK", content: "二" },
              { type: "RESPONSE", content: "答" },
            ],
          },
        ],
      },
    },
  };
  const data = parseShareData(json, "https://chat.deepseek.com/share/test");
  assert.equal(data.messages[1].thinking, "一\n\n二");
  assert.equal(data.messages[1].content, "答");
  const result = formatConversation(data);
  assert.match(result, /## 第 1 轮\n\n### 用户/);
  assert.match(result, /### DeepSeek\n\n#### 思考过程\n\n> 一/);
  assert.match(result, /> 二\n\n#### 回答\n\n答/);
  assert.doesNotMatch(formatConversation(data, false), /思考过程|tool/);
  assert.throws(() => parseShareData({ code: 1 }, "x"), /不可用/);
});
test("chat route never calls share endpoint", async () => {
  assert.equal(
    await fetchShareConversation("https://chat.deepseek.com/a/chat/abc"),
    null,
  );
});
test("headings are nested without changing code or losing ordering", () => {
  assert.equal(
    nestMarkdown("### A\n\n#### B\n\n```python\n# code\n```\n\nend", 4),
    "##### A\n\n###### B\n\n```python\n# code\n```\n\nend",
  );
});
test("print renders code and math, sanitizes active HTML and remote images", () => {
  const window = new JSDOM("").window;
  const html = renderMarkdown(
    "```python\nprint(1)\n```\n\n$x^2$\n\n$$\nx^2\n$$\n\n<script>alert(1)</script>\n\n![image](https://example.com/track.png)\n\n[bad](javascript:alert(1))",
    window,
  );
  const doc = new JSDOM(html).window.document;
  assert.equal(
    doc.querySelector("code.language-python").textContent.trim(),
    "print(1)",
  );
  assert.equal(doc.querySelectorAll(".katex").length, 2);
  assert.equal(
    doc.querySelectorAll('script, img, iframe, a[href^="javascript:"]').length,
    0,
  );
});

test("virtualized history is collected top to bottom without dropping repeated messages", async () => {
  page(
    '<aside style="overflow:auto"></aside><div id="scroll" style="overflow-y:auto"></div>',
  );
  const scroller = document.querySelector("#scroll");
  let top = 400;
  const render = () => {
    const first = Math.min(6, Math.floor(top / 200) * 2);
    scroller.innerHTML = [first, first + 1]
      .map(
        (i) =>
          `<div data-virtual-list-item-key="${i}"><div class="ds-message">重复内容</div></div>`,
      )
      .join("");
  };
  Object.defineProperties(scroller, {
    scrollTop: {
      get: () => top,
      set: (value) => {
        top = Math.max(0, Math.min(600, value));
        render();
      },
    },
    scrollHeight: { get: () => 800 },
    clientHeight: { get: () => 200 },
  });
  render();
  assert.equal(findMainScrollContainer(), scroller);
  const captured = new Map();
  await scrollToLoadAllMessages({
    visit: (node, key) => {
      assert.equal(node.isConnected, true);
      captured.set(key, node.textContent);
    },
  });
  assert.deepEqual(
    [...captured.keys()],
    Array.from({ length: 8 }, (_, i) => `virtual:${i}:0`),
  );
  assert.equal(top, 400);
});

test("plain user input keeps literal Markdown and line breaks", () => {
  const msg = page(
    '<div class="ds-message" data-role="user">hello\n```python\nprint(1)\n```</div>',
  );
  assert.equal(extractMessage(msg).content, "hello\n```python\nprint(1)\n```");
});

test("current DeepSeek hashed thinking disclosure is recognized", async () => {
  const msg = page(
    '<div class="ds-message"><div class="_245c867"><span>已思考（用时 3 秒）</span><i class="_3d79d66"></i></div><div class="ds-assistant-message-main-content ds-markdown">正文</div></div>',
  );
  const toggle = msg.querySelector("._245c867");
  toggle.onclick = () => {
    if (toggle.querySelector("._3d79d66")) {
      toggle.querySelector("i").className = "";
      toggle.insertAdjacentHTML(
        "afterend",
        '<div class="ds-think-content"><div class="ds-markdown">完整思考</div></div>',
      );
    } else {
      toggle.querySelector("i").className = "_3d79d66";
      msg.querySelector(".ds-think-content").remove();
    }
  };
  const result = await withExpandedThinking(msg, () => extractMessage(msg), {
    timeout: 100,
    stableFor: 20,
    interval: 10,
  });
  assert.equal(result.thinking, "完整思考");
  assert.ok(toggle.querySelector("._3d79d66"));
});
