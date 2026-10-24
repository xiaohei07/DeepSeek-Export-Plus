import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

for (const mode of ["sync", "async"])
  test(`context invalidation catches ${mode} errors and cleans up once`, async () => {
    const dom = new JSDOM("<body></body>");
    globalThis.document = dom.window.document;
    dom.window.HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    globalThis.chrome = { runtime: { id: "fixture" } };
    const runtime = await import(`../public/content/runtime.js?case=${mode}`);
    let cleaned = 0,
      ordinaryError;
    runtime.onContextInvalidated(() => cleaned++);
    await runtime.runExtensionAction(
      () => {
        throw new Error("network failure");
      },
      (e) => (ordinaryError = e),
    );
    assert.equal(ordinaryError.message, "network failure");
    assert.equal(cleaned, 0);
    await runtime.runExtensionAction(
      mode === "sync"
        ? () => {
            throw new Error("Extension context invalidated.");
          }
        : () => Promise.reject(new Error("Extension context invalidated.")),
    );
    assert.equal(cleaned, 1);
    assert.equal(document.querySelectorAll("#dsx-runtime-notice").length, 1);
    assert.match(
      document.querySelector("#dsx-runtime-notice").shadowRoot.textContent,
      /刷新当前页面/,
    );
    await runtime.runExtensionAction(() =>
      Promise.reject(new Error("Extension context invalidated.")),
    );
    assert.equal(cleaned, 1);
    assert.equal(document.querySelectorAll("#dsx-runtime-notice").length, 1);
    delete globalThis.document;
    delete globalThis.chrome;
    dom.window.close();
  });
