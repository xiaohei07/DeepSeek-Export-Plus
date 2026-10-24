import test from "node:test";
import assert from "node:assert/strict";
import { wordText } from "../public/export/wordText.js";

test("Word text preserves printable Unicode and escapes XML 1.0 forbidden characters", () => {
  const text = "中文 <&> \t\r\n 😀 𝑥";
  assert.equal(wordText(text), text);
  assert.equal(
    wordText("思考\f公式\u000b\u0001"),
    "思考\\u000c公式\\u000b\\u0001",
  );
  assert.equal(
    wordText("\ud800x\udfff\ufffe\uffff"),
    "\\ud800x\\udfff\\ufffe\\uffff",
  );
  for (let c = 0; c < 32; c++) {
    assert.equal(
      wordText(String.fromCharCode(c)),
      [9, 10, 13].includes(c)
        ? String.fromCharCode(c)
        : `\\u${c.toString(16).padStart(4, "0")}`,
    );
  }
});
