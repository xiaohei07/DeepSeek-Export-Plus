import { Marked } from "marked";
import createDOMPurify from "dompurify";
import katex from "katex";

const escapeHtml = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
function isLocalAsset(href) {
  try {
    // Only one filename beneath assets/. Encoded spaces/Chinese/# are valid.
    const decoded = decodeURIComponent(href);
    return (
      /^assets\/[^/\\\x00-\x1f]+$/.test(decoded) &&
      !/^assets\/(?:\.|\.\.)$/.test(decoded) &&
      !/[?#]/.test(href)
    );
  } catch {
    return false;
  }
}
function createParser({ standalone = false } = {}) {
  const parser = new Marked({
    gfm: true,
    breaks: false,
    renderer: {
      html: ({ text }) => escapeHtml(text),
      image: ({ href, text }) =>
        /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(href) ||
        (standalone && isLocalAsset(href))
          ? `<img src="${escapeHtml(href)}" alt="${escapeHtml(text || "图片")}" />`
          : `<a href="${escapeHtml(href)}">[${escapeHtml(text || "图片")}：查看原图]</a>`,
    },
  });
  const mathHtml = (text, displayMode) =>
    katex.renderToString(text, {
      displayMode,
      throwOnError: false,
      trust: false,
      strict: "ignore",
      output: standalone ? "mathml" : "htmlAndMathml",
    });
  parser.use({
    extensions: [
      {
        name: "blockMath",
        level: "block",
        start: (src) => src.indexOf("$$"),
        tokenizer(src) {
          const match = /^\$\$[ \t]*\n([\s\S]+?)\n\$\$(?:[ \t]*\n|$)/.exec(src);
          if (match)
            return { type: "blockMath", raw: match[0], text: match[1] };
        },
        renderer: (token) => mathHtml(token.text, true),
      },
      {
        name: "inlineMath",
        level: "inline",
        start: (src) => src.indexOf("$"),
        tokenizer(src) {
          const match = /^\$(?!\$|\s)((?:\\.|[^$\n])+?)(?<!\s)\$(?!\d)/.exec(
            src,
          );
          if (match)
            return { type: "inlineMath", raw: match[0], text: match[1] };
        },
        renderer: (token) => mathHtml(token.text, false),
      },
    ],
  });
  return parser;
}

export function renderMarkdown(markdown, windowObject = window, options = {}) {
  const purifier = createDOMPurify(windowObject);
  // Conversation HTML is untrusted. Keep math markup, remove active content and forms.
  const cleaned = purifier.sanitize(createParser(options).parse(markdown), {
    USE_PROFILES: { html: true, mathMl: true },
    FORBID_TAGS: [
      "style",
      "input",
      "form",
      "button",
      "textarea",
      "iframe",
      "object",
      "embed",
    ],
    FORBID_ATTR: ["srcset"],
  });
  if (!options.standalone) return cleaned;
  const fragment = windowObject.document.createElement("template");
  fragment.innerHTML = cleaned;
  // Restore ordinary Markdown heading anchors in the standalone document.
  const ids = new Set();
  for (const heading of fragment.content.querySelectorAll(
    "h1,h2,h3,h4,h5,h6",
  )) {
    const base =
      heading.textContent
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "")
        .replace(/\s+/g, "-") || "section";
    let id = base,
      suffix = 0;
    while (ids.has(id)) id = `${base}-${++suffix}`;
    heading.id = id;
    ids.add(id);
  }
  for (const link of fragment.content.querySelectorAll("a")) {
    const href = link.getAttribute("href") || "";
    if (!/^(?:https?:\/\/|mailto:|#)/i.test(href) && !isLocalAsset(href))
      link.removeAttribute("href");
    link.setAttribute("rel", "noopener noreferrer");
  }
  return fragment.innerHTML;
}
