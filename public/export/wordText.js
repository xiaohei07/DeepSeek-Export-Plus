// XML 1.0 cannot represent these characters, even as numeric entities.
// Keep them visible as Unicode escapes instead of corrupting the whole DOCX or
// silently dropping characters from quoted reasoning/code. /u keeps emoji pairs.
export function wordText(value = "") {
  return String(value).replace(
    /[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}
