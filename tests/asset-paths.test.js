import test from "node:test";
import assert from "node:assert/strict";
import {
  readableAssetPath,
  wordAttachmentTarget,
} from "../public/content/assetPaths.js";

test("Word local links preserve Unicode while keeping ASCII URL delimiters escaped", () => {
  const name = "001-说明 中文 #1 100% & 😀.docx";
  const uri = "assets/" + encodeURIComponent(name);
  assert.equal(readableAssetPath(uri), "assets/" + name);
  assert.equal(
    wordAttachmentTarget(uri),
    "assets/001-说明%20中文%20%231%20100%25%20%26%20😀.docx",
  );
  // A literal percent-encoded-looking filename must not be decoded twice.
  assert.equal(
    wordAttachmentTarget("assets/%25E8%25AF%25B4.txt"),
    "assets/%25E8%25AF%25B4.txt",
  );
});

test("path conversion does not rewrite web URLs, malformed paths or traversal", () => {
  for (const path of [
    "https://example.org/%E8%AF%B4?x=%20#y",
    "assets/%FF.txt",
    "assets/%2e%2e/x",
    "assets/%2e%2e",
    "assets/a%2Fb",
    "assets/a%5Cb",
    "assets/%00x",
    "assets/a#b",
  ]) {
    assert.equal(readableAssetPath(path), path);
    assert.equal(wordAttachmentTarget(path), path);
  }
});
