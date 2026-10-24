import html2canvas from "html2canvas";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  ExternalHyperlink,
  InternalHyperlink,
  Bookmark,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  ShadingType,
} from "docx";
import { renderMarkdown } from "../print/render.js";
import { htmlStyle } from "../content/formats.js";
import mathCSS from "dsx:math-css";
import { formulaSvg } from "./formulaSvg.js";
import { wordText } from "./wordText.js";
import { wordAttachmentTarget } from "../content/assetPaths.js";

const width = 900,
  maxPageHeight = 1800,
  scale = 1.5;
const rasterCSS = `
html{background:white;color-scheme:light}body{width:900px;margin:0;background:white;color:#242b36}
main{width:900px;max-width:none;margin:0;padding:32px 36px;font-size:17px;line-height:1.8}
pre{white-space:pre-wrap;overflow-wrap:anywhere;overflow:visible}table{display:table;width:100%;table-layout:fixed}th,td{overflow-wrap:anywhere}a{text-decoration:none}
img{max-width:100%;max-height:1400px;object-fit:contain}blockquote{font-style:normal}
.katex-display{overflow:visible;padding:8px 0}.katex{white-space:normal}.katex-html{white-space:nowrap}
`;
async function canvasBytes(canvas) {
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("图片生成失败，请减少导出轮次");
  return new Uint8Array(await blob.arrayBuffer());
}

async function formulaCanvas(el, doc) {
  // Let Chromium paint KaTeX's nested baselines/SVG, which DOM canvas libraries
  // approximate incorrectly for fractions, radicals and stretchy delimiters.
  const original = el.getAttribute("style");
  try {
    el.style.display = "inline-block";
    el.style.padding = "6px 3px";
    const rect = el.getBoundingClientRect();
    const w = Math.ceil(rect.width),
      h = Math.ceil(rect.height);
    const svg = formulaSvg(el, mathCSS, w, h);
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await img.decode();
    const canvas = doc.createElement("canvas");
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    // Reading now surfaces a tainted canvas instead of silently omitting formulas.
    canvas.toDataURL("image/png");
    return canvas;
  } finally {
    if (original === null) el.removeAttribute("style");
    else el.setAttribute("style", original);
  }
}

// The frame contains only our sanitized document, embedded fonts and data images.
// No site CSS, remote image, script, external font or conversion service is used.
async function renderSurface(markdown, assets, signal) {
  const template = document.createElement("template");
  template.innerHTML = renderMarkdown(markdown, window, {
    standalone: true,
    mathOutput: "htmlAndMathml",
  });
  for (const img of template.content.querySelectorAll("img")) {
    const src = img.getAttribute("src");
    if (assets[src]) img.src = assets[src];
    else if (!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(src || ""))
      img.replaceWith(
        document.createTextNode(`[图片未附带：${img.alt || "图片"}]`),
      );
  }
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.style.cssText =
    "position:fixed!important;left:-12000px!important;top:0!important;width:900px!important;height:1800px!important;border:0!important;visibility:hidden!important;pointer-events:none!important";
  document.body.append(frame);
  const cleanup = () => frame.remove();
  signal?.addEventListener("abort", cleanup, { once: true });
  try {
    const doc = frame.contentDocument;
    doc.open();
    doc.write(
      '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; font-src data:; style-src \'unsafe-inline\'"></head><body><main></main></body></html>',
    );
    doc.close();
    const style = doc.createElement("style");
    style.textContent = htmlStyle + mathCSS + rasterCSS;
    doc.head.append(style);
    doc.querySelector("main").append(doc.importNode(template.content, true));
    await Promise.all(
      [...doc.images].map((img) =>
        img.decode().catch(() => {
          img.replaceWith(
            doc.createTextNode(`[图片解码失败：${img.alt || "图片"}]`),
          );
        }),
      ),
    );
    // fonts.ready only includes fonts which have participated in layout.
    doc.body.getBoundingClientRect();
    await doc.fonts.ready;
    for (const formula of [...doc.querySelectorAll(".katex")]) {
      signal?.throwIfAborted();
      const latex =
        formula.querySelector("annotation")?.textContent || formula.textContent;
      const canvas = await formulaCanvas(formula, doc);
      const img = doc.createElement("img");
      img.alt = latex;
      img.src = canvas.toDataURL("image/png");
      img.style.cssText = `display:inline-block;vertical-align:middle;margin:0;width:${canvas.width / 2}px;height:auto`;
      img.dataset.formula = "true";
      formula.replaceWith(img);
      await img.decode();
      canvas.width = canvas.height = 0;
    }
    signal?.throwIfAborted();
    return {
      frame,
      doc,
      dispose() {
        signal?.removeEventListener("abort", cleanup);
        cleanup();
      },
    };
  } catch (error) {
    signal?.removeEventListener("abort", cleanup);
    cleanup();
    throw error;
  }
}

async function capture(element, options = {}) {
  return html2canvas(element, {
    backgroundColor: "#ffffff",
    scale,
    logging: false,
    useCORS: false,
    allowTaint: false,
    imageTimeout: 15000,
    windowWidth: width,
    windowHeight: maxPageHeight,
    scrollX: 0,
    scrollY: 0,
    ...options,
  });
}

// Prefer a block boundary; for a tall paragraph, avoid splitting through a text line.
function pageCuts(doc, height) {
  const safe = [0, height];
  for (const element of doc.querySelector("main").children) {
    const rect = element.getBoundingClientRect();
    safe.push(Math.floor(rect.top), Math.ceil(rect.bottom));
  }
  const protectedRects = [];
  const walker = doc.createTreeWalker(
    doc.querySelector("main"),
    NodeFilter.SHOW_TEXT,
  );
  while (walker.nextNode()) {
    if (
      !walker.currentNode.textContent.trim() ||
      walker.currentNode.parentElement.closest(".katex-mathml")
    )
      continue;
    const range = doc.createRange();
    range.selectNodeContents(walker.currentNode);
    for (const r of range.getClientRects())
      protectedRects.push([r.top, r.bottom]);
  }
  for (const el of doc.querySelectorAll("img,.katex-display")) {
    const r = el.getBoundingClientRect();
    protectedRects.push([r.top, r.bottom]);
  }
  const cuts = [0];
  while (cuts.at(-1) < height) {
    const start = cuts.at(-1),
      target =
        height - start <= maxPageHeight + 120 ? height : start + maxPageHeight;
    let end = target;
    if (end < height) {
      const boundary = safe
        .filter((y) => y > start + 900 && y <= target)
        .sort((a, b) => b - a)[0];
      if (boundary) end = boundary;
      let collision;
      while (
        (collision = protectedRects.find(
          ([a, b]) => a < end && b > end && a > start + 40,
        ))
      )
        end = Math.floor(collision[0]);
    }
    cuts.push(Math.max(start + 1, end));
    if (cuts.length > 80) throw new Error("PNG超过80张，请减少导出轮次后重试");
  }
  return cuts;
}

async function pngPages(doc, signal, progress) {
  const height = Math.ceil(
    doc.querySelector("main").getBoundingClientRect().height,
  );
  if (height > 100000) throw new Error("对话过长，请分批选择轮次导出PNG");
  const cuts = pageCuts(doc, height),
    pages = {};
  for (let i = 0; i < cuts.length - 1; i++) {
    signal?.throwIfAborted();
    progress(`正在生成PNG（${i + 1}/${cuts.length - 1}）…`);
    const canvas = await capture(doc.body, {
      x: 0,
      y: cuts[i],
      width,
      height: cuts[i + 1] - cuts[i],
    });
    signal?.throwIfAborted();
    pages[
      cuts.length === 2
        ? "对话.png"
        : `对话-${String(i + 1).padStart(3, "0")}.png`
    ] = await canvasBytes(canvas);
    canvas.width = canvas.height = 0;
  }
  return pages;
}

async function wordDocument(doc, title, signal, progress) {
  const image = (bytes, w, h, alt) => {
    const ratio = Math.min(1, 610 / Math.max(1, w), 850 / Math.max(1, h));
    return new ImageRun({
      type: "png",
      data: bytes,
      transformation: {
        width: Math.max(1, Math.round(w * ratio)),
        height: Math.max(1, Math.round(h * ratio)),
      },
      altText: {
        title: "公式或图片",
        description: wordText(alt),
        name: wordText([...alt].slice(0, 80).join("")),
      },
    });
  };
  // Normalize all browser-supported image types to PNG for Word/WPS compatibility.
  const images = new Map();
  for (const img of doc.images) {
    signal?.throwIfAborted();
    const canvas = doc.createElement("canvas");
    const ratio = Math.min(
      1,
      2400 / Math.max(img.naturalWidth, img.naturalHeight),
    );
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    images.set(
      img,
      image(await canvasBytes(canvas), img.width, img.height, img.alt),
    );
    canvas.width = canvas.height = 0;
  }
  const run = (text, styles = {}) =>
    new TextRun({ text: wordText(text), ...styles });
  const anchors = new Map(
    [...doc.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h, i) => [
      h.id,
      `heading_${i + 1}`,
    ]),
  );
  function inline(node, styles = {}) {
    if (node.nodeType === 3) return [run(node.textContent, styles)];
    if (node.nodeType !== 1) return [];
    if (node.tagName === "IMG")
      return images.has(node)
        ? [images.get(node)]
        : [run(`[图片：${node.alt}]`, styles)];
    if (node.tagName === "BR") return [new TextRun({ break: 1 })];
    const extra = { ...styles };
    if (["STRONG", "B"].includes(node.tagName)) extra.bold = true;
    if (["EM", "I"].includes(node.tagName)) extra.italics = true;
    if (["DEL", "S"].includes(node.tagName)) extra.strike = true;
    if (node.tagName === "A") extra.color = "2357AE";
    if (node.tagName === "CODE")
      Object.assign(extra, {
        font: "Consolas",
        size: 20,
        shading: { type: ShadingType.CLEAR, fill: "F1F4F9" },
      });
    const children = [...node.childNodes].flatMap((child) =>
      inline(child, extra),
    );
    if (node.tagName === "A") {
      const href = node.getAttribute("href") || "";
      if (/^(https?:\/\/|mailto:|assets\/)/i.test(href))
        return [
          new ExternalHyperlink({
            children,
            link: wordText(wordAttachmentTarget(href)),
          }),
        ];
      if (href.startsWith("#") && anchors.has(href.slice(1)))
        return [
          new InternalHyperlink({
            children,
            anchor: anchors.get(href.slice(1)),
          }),
        ];
    }
    return children;
  }
  const para = (children, options = {}) =>
    new Paragraph({ spacing: { after: 140, line: 300 }, children, ...options });
  function blocks(parent, quote = false, depth = 0) {
    const result = [];
    const quoted = quote
      ? {
          indent: { left: 360 },
          shading: { type: ShadingType.CLEAR, fill: "F1F4F9" },
        }
      : {};
    for (const node of parent.childNodes) {
      signal?.throwIfAborted();
      if (node.nodeType === 3) {
        if (node.textContent.trim())
          result.push(para([run(node.textContent)], quoted));
        continue;
      }
      if (node.nodeType !== 1) continue;
      if (node.tagName === "BLOCKQUOTE") {
        result.push(...blocks(node, true, depth));
        continue;
      }
      if (node.tagName === "TABLE") {
        const rows = [...node.rows].map(
          (row, index) =>
            new TableRow({
              tableHeader: index === 0,
              children: [...row.cells].map(
                (cell) =>
                  new TableCell({
                    children: [para(inline(cell), { spacing: { after: 60 } })],
                    shading: index === 0 ? { fill: "E8EDF5" } : undefined,
                    margins: { top: 80, bottom: 80, left: 100, right: 100 },
                  }),
              ),
            }),
        );
        if (rows.length)
          result.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows,
            }),
          );
        result.push(para([]));
        continue;
      }
      if (["UL", "OL"].includes(node.tagName)) {
        let number = Number(node.getAttribute("start")) || 1;
        for (const li of node.children) {
          const prefix = node.tagName === "OL" ? `${number++}. ` : "• ";
          const lines = [...li.childNodes].filter(
            (n) => !["UL", "OL"].includes(n.tagName),
          );
          result.push(
            para([run(prefix), ...lines.flatMap((n) => inline(n))], {
              ...quoted,
              indent: { left: 300 * (depth + 1), hanging: 220 },
            }),
          );
          for (const nested of [...li.children].filter((n) =>
            ["UL", "OL"].includes(n.tagName),
          )) {
            result.push(...blocks({ childNodes: [nested] }, quote, depth + 1));
          }
        }
        continue;
      }
      if (node.tagName === "PRE") {
        const lang = node
          .querySelector("code")
          ?.className.replace("language-", "");
        if (lang)
          result.push(
            para([run(`代码 · ${lang}`, { size: 18, color: "465467" })], {
              ...quoted,
              keepNext: true,
            }),
          );
        node.textContent
          .replace(/\n$/, "")
          .split("\n")
          .forEach((line) =>
            result.push(
              para([run(line || " ", { font: "Consolas", size: 18 })], {
                ...quoted,
                spacing: { after: 0, line: 240 },
                shading: { fill: "F1F4F9" },
              }),
            ),
          );
        result.push(para([]));
        continue;
      }
      if (node.tagName === "HR") {
        result.push(para([]));
        continue;
      }
      const heading = /^H([1-6])$/.exec(node.tagName);
      const content =
        heading && anchors.has(node.id)
          ? [new Bookmark({ id: anchors.get(node.id), children: inline(node) })]
          : inline(node);
      result.push(
        para(content, {
          ...quoted,
          ...(heading
            ? {
                heading:
                  heading[1] === "1"
                    ? HeadingLevel.TITLE
                    : HeadingLevel[
                        `HEADING_${Math.min(5, Number(heading[1]) - 1)}`
                      ],
                keepNext: true,
                spacing: { before: 260, after: 160 },
              }
            : {}),
        }),
      );
    }
    return result;
  }
  progress("正在生成Word文档…");
  const children = blocks(doc.querySelector("main"));
  const document = new Document({
    creator: "DeepSeek Export Plus",
    title: wordText(title),
    description: "本地导出的DeepSeek对话；公式以图片保存，替代文本保留LaTeX。",
    styles: {
      default: {
        document: {
          run: { font: "Microsoft YaHei", size: 22, color: "242B36" },
        },
        title: { run: { color: "000000", size: 36, bold: true } },
        heading1: { run: { color: "000000", size: 30, bold: true } },
        heading2: { run: { color: "000000", size: 26, bold: true } },
        heading3: { run: { color: "000000", size: 24, bold: true } },
        heading4: {
          run: { color: "000000", size: 22, bold: true, italics: false },
        },
        heading5: {
          run: { color: "000000", size: 22, bold: true, italics: false },
        },
        heading6: {
          run: { color: "000000", size: 22, bold: true, italics: false },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 },
          },
        },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(document);
  signal?.throwIfAborted();
  return new Uint8Array(await blob.arrayBuffer());
}

export async function renderBinaryDocuments({
  markdown,
  title,
  formats,
  assets = {},
  signal,
  onProgress = () => {},
}) {
  signal?.throwIfAborted();
  const surface = await renderSurface(markdown, assets, signal);
  try {
    const files = {};
    if (formats.includes("docx"))
      files["对话.docx"] = await wordDocument(
        surface.doc,
        title,
        signal,
        onProgress,
      );
    if (formats.includes("png"))
      Object.assign(files, await pngPages(surface.doc, signal, onProgress));
    return files;
  } finally {
    surface.dispose();
  }
}
