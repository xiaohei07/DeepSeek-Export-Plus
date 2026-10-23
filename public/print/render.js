import { Marked } from "marked";
import createDOMPurify from "dompurify";
import katex from "katex";

const escapeHtml = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const parser = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html: ({ text }) => escapeHtml(text),
    image: ({ href, text }) =>
      /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(href)
        ? `<img src="${href}" alt="${escapeHtml(text || "图片")}" />`
        : `<a href="${escapeHtml(href)}">[${escapeHtml(text || "图片")}：查看原图]</a>`,
  },
});
const mathHtml = (text, displayMode) =>
  katex.renderToString(text, {
    displayMode,
    throwOnError: false,
    trust: false,
    strict: "ignore",
    output: "htmlAndMathml",
  });
parser.use({
  extensions: [
    {
      name: "blockMath",
      level: "block",
      start: (src) => src.indexOf("$$"),
      tokenizer(src) {
        const match = /^\$\$[ \t]*\n([\s\S]+?)\n\$\$(?:[ \t]*\n|$)/.exec(src);
        if (match) return { type: "blockMath", raw: match[0], text: match[1] };
      },
      renderer: (token) => mathHtml(token.text, true),
    },
    {
      name: "inlineMath",
      level: "inline",
      start: (src) => src.indexOf("$"),
      tokenizer(src) {
        const match = /^\$(?!\$|\s)((?:\\.|[^$\n])+?)(?<!\s)\$(?!\d)/.exec(src);
        if (match) return { type: "inlineMath", raw: match[0], text: match[1] };
      },
      renderer: (token) => mathHtml(token.text, false),
    },
  ],
});

export function renderMarkdown(markdown, windowObject = window) {
  const purifier = createDOMPurify(windowObject);
  // Conversation HTML is untrusted. Keep math markup, remove active content and forms.
  return purifier.sanitize(parser.parse(markdown), {
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
}
