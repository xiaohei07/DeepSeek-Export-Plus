/**
 * DeepSeek 选择器与结构解析器 —— 单一事实来源
 *
 * 维护指南：
 * - 当 DeepSeek 更新页面结构导致插件失效时，优先在此文件调整。
 * - 每组选择器是一个「候选链」数组，按优先级从高到低排列：
 *   结构/语义（aria-label、role、tabindex、相对位置）在前，动态哈希类名兜底。
 * - 不要直接删除仍可能有效的候选——新增候选放前面，失效候选往后降级。
 * - 命中回退项时控制台输出 [DSX][selector] 日志（Verbose 级别可见），
 *   用于在真实站点上确认哪条候选在生效。
 *
 * DeepSeek 使用动态哈希类名（如 _5cadb25、bf38813a），随前端更新而变化；
 * ds-* 前缀是设计系统类名，相对稳定，优先使用。
 *
 * 结构定位回归：2026-10-23（独立浏览器测试）
 */

/** 插件自身 UI 的根节点，所有查询都要排除它们 */
export const OWN_UI_SELECTOR =
  "#ai-exporter-buttons, #file-export-modal, #dsx-dialog-host, #dsx-runtime-notice, .ai-exporter-toast";

export const NATIVE_DIALOG_SELECTOR =
  '[role="dialog"], [aria-modal="true"], .ds-modal, [popover]:popover-open';

export function hasNativeDialog() {
  return [...document.querySelectorAll(NATIVE_DIALOG_SELECTOR)].some(
    (el) => !isOwnUI(el) && isVisible(el),
  );
}

export const ds = {
  // ----- 消息 -----
  messageContainer: [
    ".ds-message",
    '[class*="ds-message"]',
    "[data-message-id]",
  ],
  skeleton: [".ds-skeleton", '[class*="skeleton"]'],

  // ----- 消息内容 -----
  aiContent: [
    ".ds-markdown",
    ".ds-markdown.ds-markdown--block",
    '[class*="ds-markdown"]',
  ],
  thinkContent: [
    ".ds-think-content",
    '[class*="ds-think-content"]',
    '[class*="ds-think"]',
  ],

  // ----- 滚动容器 -----
  scrollArea: [
    '[class*="scroll-area"]:not([class*="gutter"])',
    ".ds-scroll-area",
  ],

  // ----- 输入区（composerAnchor 仅作字面兜底，优先用 resolveComposerAnchor 结构定位）-----
  composerAnchor: [".ec4f5d61", ".bf38813a", "._77cefa5", "._24fad49"],
  sendButton: [
    'button[type="submit"]',
    'button[aria-label="发送"], button[aria-label="Send"]',
    'button[aria-label*="发送"], button[aria-label*="Send" i]',
    '[class*="ds-icon-button"][role="button"]',
    ".bf38813a",
  ],

  // ----- 生成状态 -----
  stopButton: [
    'button[aria-label="停止生成"], button[aria-label="Stop generating"]',
    'button[aria-label*="停止"]',
    'button[aria-label*="Stop" i]',
  ],
  streamingCursor: [".ds-markdown + .cursor", '[class*="cursor"].streaming'],

  // ----- 文件（前两条为实测有效选择器，保留在链首）-----
  fileArea: ['[class*="_5cadb25"]:not([class*="_76cd190"])'],
  fileItem: [
    '[class*="_76cd190"][tabindex="0"]',
    // 新版文件卡片容器（精确于通用候选；docx 等不可预览的卡片没有 tabindex，
    // 若排在 [tabindex] 之后会被通用候选抢先、导致 docx 卡片进不了候选集）
    '[class*="_25c7358"]',
    '[tabindex="0"]',
    "[tabindex]",
    '[role="button"]',
    "button",
    '[class*="file"]',
    "[onclick]",
  ],

  // ----- 预览面板 -----
  previewPanel: [
    '[class*="_519be07"]',
    '[class*="_27fc06b"]',
    '[role="dialog"]',
    '[aria-modal="true"]',
    "aside",
    '[aria-hidden="false"]',
  ],
  previewCloseButton: [
    '[aria-label*="close" i]',
    '[aria-label*="关闭"]',
    '[title*="关闭"]',
    '[title*="close" i]',
    'button[class*="close"], [role="button"][class*="close"]',
    '[class*="_5d271a3"]',
    '[class*="close"]',
  ],
  previewImages: ["img[src]", "img[data-src]", '[style*="background-image"]'],
  previewCanvas: ["canvas"],
  previewTextContainers: [
    '[class*="content"]',
    '[class*="text"]',
    '[class*="preview"]',
    '[class*="viewer"]',
    '[class*="markdown"]',
    '[class*="code-block"]',
    "article",
    ".prose",
    "table",
    "pre",
    '[class*="abbe3c45"]',
  ],
  pdfPageIndicatorHints: ["span._608a995", '[class*="page"]'],

  // ----- 图片排除（头像/站标等页面装饰，不是对话内容）-----
  imageUrlExcludePatterns: [
    "avatar",
    "user-avatar",
    "site-icon",
    "site_logo",
    "favicon",
    "logo",
    "cdn.deepseek.com/site-icons",
  ],
};

/** "3 / 12" 形式的页码文本 */
export const pageCountTextPattern = /^\s*\d+\s*\/\s*\d+\s*$/;
/** 从 "3 / 12" 之类文本中取出总页数 */
export const pageCountInlinePattern = /\/\s*(\d+)/;
/** 文件文本串的廉价预筛（如 "xxx.pdfPDF 1.36MB"），真正解析仍在 fileDetector.js。
 *  标记与大小之间允许没有空白——新版文件卡片里类型和大小是分开的元素靠 CSS 间距显示，
 *  拼接后形如 "xxx.pdfPDF540.35KB" */
export const fileTextPattern = /\.[a-z0-9]{1,4}\s*[A-Z]{1,5}\s*[\d.]+[KMGT]?B/i;

/** 面板中可能出现的原始文件直链特征（从 fileExportUI 迁移） */
export const fileUrlPatterns = [
  /https?:\/\/[^\s"'<>]+deepseek[^\s"'<>]+/gi,
  /https?:\/\/[^\s"'<>]+\.pdf[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]+obs\.cn-[^\s"'<>]+/gi,
  /https?:\/\/[^\s"'<>]+myhuaweicloud\.com[^\s"'<>]*/gi,
];

// ---------------- 通用查询工具 ----------------

/** 元素是否属于插件自身 UI */
export function isOwnUI(el) {
  return !!(el && el.closest && el.closest(OWN_UI_SELECTOR));
}

/** 元素是否有可见尺寸 */
export function isVisible(el) {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  return window.getComputedStyle(el).visibility !== "hidden";
}

// 主候选的命中只打印一次（高频调用不刷屏）；回退命中每次都打印（稀有且需要关注）
const loggedPrimaryLabels = new Set();

function logHit(label, index, selector) {
  if (!label) return;
  if (index > 0) {
    console.debug(`[DSX][selector] ${label} → fallback #${index}: ${selector}`);
    return;
  }
  if (!loggedPrimaryLabels.has(label)) {
    loggedPrimaryLabels.add(label);
    console.debug(`[DSX][selector] ${label} → primary: ${selector}`);
  }
}

/** 按候选链顺序找第一个匹配元素；跳过插件自身 UI。label 为空时不输出日志 */
export function findFirst(candidates, root = document, label = "") {
  for (let i = 0; i < candidates.length; i++) {
    let el = null;
    try {
      el = root.querySelector(candidates[i]);
    } catch (e) {
      continue;
    }
    if (el && !isOwnUI(el)) {
      logHit(label, i, candidates[i]);
      return el;
    }
  }
  return null;
}

/** 找到第一个能匹配到节点的候选，返回它的全部匹配；不跨候选合并 */
export function findAllFirstMatch(candidates, root = document, label = "") {
  for (let i = 0; i < candidates.length; i++) {
    let nodes = [];
    try {
      nodes = Array.from(root.querySelectorAll(candidates[i])).filter(
        (n) => !isOwnUI(n),
      );
    } catch (e) {
      continue;
    }
    if (nodes.length > 0) {
      logHit(label, i, candidates[i]);
      return nodes;
    }
  }
  return [];
}

/** 多候选取并集（仅用于面板发现），按文档顺序排序 */
export function queryAllUnion(candidates, root = document) {
  const seen = new Set();
  for (const sel of candidates) {
    try {
      root.querySelectorAll(sel).forEach((n) => {
        if (!isOwnUI(n)) seen.add(n);
      });
    } catch (e) {
      continue;
    }
  }
  const arr = Array.from(seen);
  arr.sort((a, b) => {
    if (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
      return -1;
    if (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING)
      return 1;
    return 0;
  });
  return arr;
}

/** 文本是否命中任一正则/子串模式（注意重置 /g 正则的 lastIndex） */
export function matchesAny(patterns, text) {
  if (!text) return false;
  return patterns.some((p) => {
    if (p instanceof RegExp) {
      p.lastIndex = 0;
      return p.test(text);
    }
    return String(text).includes(p);
  });
}

/** PDF 优先尝试原始直链下载；置为 false 则始终用画布重组 */
export const PREFER_DIRECT_URL_FOR_PDF = true;

/**
 * 直链是否确实指向目标文件（保守匹配：文件名或 Content-Disposition 里的文件名一致才接受）
 * 用于避免把面板里的缩略图/无关资源当成文件直链下载
 */
export function urlMatchesFile(url, filename) {
  if (!url || !filename) return false;
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch (e) {
    // URL 编码异常时按原样匹配
  }
  const urlLower = decoded.toLowerCase();
  const nameLower = filename.toLowerCase();

  if (urlLower.includes(nameLower)) return true;

  const base = nameLower.replace(/\.[^.]+$/, "");
  if (base.length > 3 && urlLower.includes(base)) return true;

  const disp = decoded.match(/filename\*?=([^&]+)/i);
  if (disp) {
    let dispName = disp[1].replace(/^utf-8''/i, "");
    try {
      dispName = decodeURIComponent(dispName);
    } catch (e) {
      // 保持原样
    }
    if (dispName.toLowerCase().includes(nameLower)) return true;
  }

  return false;
}

// ---------------- 结构解析器 ----------------

/**
 * Locate free space using visible controls, not their flex/grid wrappers.
 * The toolbar lives outside the composer so it cannot change native layout.
 */
export function resolveComposerAnchor(toolbarWidth = 164, toolbarHeight = 36) {
  const ta = pickComposerTextarea();
  const composer = ta && climbToComposerRoot(ta);
  if (!composer) return null;
  const box = composer.getBoundingClientRect();
  const controls = [
    ...composer.querySelectorAll(
      'button, [role="button"], [tabindex], [class*="ds-icon-button"], .ds-button',
    ),
  ].filter((el) => isVisible(el) && !isOwnUI(el));
  const rects = controls
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.top >= box.top && r.bottom <= box.bottom + 1);
  // Lowest native row: ignore the scroll-to-bottom button above the composer.
  const last = rects.sort(
    (a, b) => b.bottom - a.bottom || b.right - a.right,
  )[0];
  if (last) {
    const y = (last.top + last.bottom - toolbarHeight) / 2;
    const text = ta.getBoundingClientRect();
    // Never place over the text input, including contenteditable variants.
    const obstacles = [...rects, text]
      .filter((r) => r.top < y + toolbarHeight && r.bottom > y)
      .sort((a, b) => a.left - b.left);
    let left = Math.max(8, box.left + 12);
    const right = Math.min(innerWidth - 8, box.right - 12);
    const gaps = [];
    for (const r of obstacles) {
      const end = Math.min(right, r.left - 8);
      if (end > left) gaps.push([left, end]);
      left = Math.max(left, r.right + 8);
    }
    if (left < right) gaps.push([left, right]);
    const center = (box.left + box.right) / 2;
    const positions = gaps
      .filter(([a, b]) => b - a >= toolbarWidth)
      .map(([a, b]) =>
        Math.max(a, Math.min(center - toolbarWidth / 2, b - toolbarWidth)),
      )
      .sort(
        (a, b) =>
          Math.abs(a + toolbarWidth / 2 - center) -
          Math.abs(b + toolbarWidth / 2 - center),
      );
    if (positions.length && y >= 0 && y + toolbarHeight <= innerHeight)
      return { composer, mode: "row", x: positions[0], y };
  }
  // A small vertical pair fits the outer gutter without stealing composer space.
  const sideWidth = 24,
    sideHeight = 68;
  const y = Math.max(
    8,
    Math.min(
      (box.top + box.bottom - sideHeight) / 2,
      innerHeight - sideHeight - 8,
    ),
  );
  if (innerWidth - box.right >= sideWidth)
    return {
      composer,
      mode: "side",
      x: Math.min(box.right + 8, innerWidth - sideWidth),
      y,
    };
  if (box.left >= sideWidth)
    return {
      composer,
      mode: "side",
      x: Math.max(0, box.left - sideWidth - 8),
      y,
    };
  // Edge-to-edge composers have no safe gutter. Keep the input untouched.
  return { composer, mode: "dock" };
}

function pickComposerTextarea() {
  let best = null;
  let bestArea = 0;
  const nodes = document.querySelectorAll('textarea, [contenteditable="true"]');
  for (const el of nodes) {
    if (isOwnUI(el) || el.closest(NATIVE_DIALOG_SELECTOR) || !isVisible(el))
      continue;
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > bestArea) {
      bestArea = area;
      best = el;
    }
  }
  return best;
}

function climbToComposerRoot(ta) {
  let el = ta.parentElement;
  for (let i = 0; el && i < 8; i++, el = el.parentElement) {
    if (el === document.body || el === document.documentElement) break;
    const r = el.getBoundingClientRect();
    const hasButton = el.querySelector(
      'button, [role="button"], [class*="ds-icon-button"]',
    );
    if (
      hasButton &&
      !el.querySelector(".ds-message") &&
      r.width > 180 &&
      r.bottom > window.innerHeight * 0.5
    )
      return el;
  }
  return null;
}

/**
 * 在一条消息内找文件信息区
 * 策略1：实测有效的哈希选择器；策略2：结构扫描（文本符合文件格式串的最深节点）
 * @returns {Element[]}
 */
export function resolveFileAreas(msgEl) {
  if (!msgEl) return [];

  const hashed = findAllFirstMatch(ds.fileArea, msgEl, "fileArea");
  if (hashed.length > 0) return hashed;

  // 消息要么含可点击的文件条目，要么文本里有文件样内容，否则直接跳过。
  // 注意不能只靠"可点击"判断：docx 等不能被预览的卡片没有 tabindex/role，
  // 但同样是文件卡片（实测 docx 卡片因此被整条消息跳过）。
  let hasChip = false;
  try {
    hasChip =
      !!msgEl.querySelector('[tabindex], [role="button"], button') ||
      fileTextPattern.test(msgEl.textContent || "");
  } catch (e) {
    hasChip = false;
  }
  if (!hasChip) return [];

  const areas = [];
  scanForFileText(msgEl, 0, areas);
  if (areas.length > 0) {
    console.debug(
      `[DSX][selector] fileArea → 结构扫描命中 ${areas.length} 个区域`,
    );
  }
  return areas;
}

function scanForFileText(el, depth, out) {
  if (depth > 5) return;
  for (const child of el.children) {
    if (isOwnUI(child)) continue;
    const text = (child.textContent || "").trim();
    if (text && fileTextPattern.test(text)) {
      out.push(child);
      continue; // 命中即停，不再下钻
    }
    scanForFileText(child, depth + 1, out);
  }
}

/**
 * 在文件区内按文件名文本定位某个文件对应的可点击条目
 * 只做可靠的文本匹配；无法确定时返回 chip: null，由调用方决定是否按位置兜底
 * @returns {{chip: Element|null, count: number, matchedBy: 'text'|'none'}}
 */
export function resolveFileChip(area, fileInfo) {
  const chips = findAllFirstMatch(ds.fileItem, area, "fileItem");
  if (chips.length === 0) return { chip: null, count: 0, matchedBy: "none" };

  const base = ((fileInfo && fileInfo.filename) || "").replace(/\.[^.]+$/, "");
  if (base) {
    const matches = chips.filter((c) => (c.textContent || "").includes(base));
    if (matches.length > 0) {
      const smallest = matches.reduce((a, b) =>
        (a.textContent || "").length <= (b.textContent || "").length ? a : b,
      );
      return { chip: smallest, count: chips.length, matchedBy: "text" };
    }
  }

  return { chip: null, count: chips.length, matchedBy: "none" };
}

/**
 * 判定一个元素是否是"文件预览面板"
 * 复合守卫：排除自身 UI/页面根/含消息列表的包装器，要求可见且有可提取内容
 */
export function isPreviewPanel(el) {
  if (!el || !el.isConnected) return false;
  if (el === document.body || el === document.documentElement) return false;
  if (isOwnUI(el)) return false;
  if (!isVisible(el)) return false;
  if (el.querySelector(".ds-message")) return false;

  const r = el.getBoundingClientRect();
  if (r.width <= 120) return false;

  return !!el.querySelector(
    'canvas, img[src^="http"], img[src^="blob:"], img[src^="data:"], pre, code, [class*="markdown"]',
  );
}

/** 当前页面上所有可见的预览面板（文档顺序） */
export function findVisiblePreviewPanels() {
  return queryAllUnion(ds.previewPanel, document).filter(isPreviewPanel);
}

/**
 * 读取 PDF 预览器的总页数
 * @returns {{totalPages: number|null, indicatorFound: boolean}} 找不到时 totalPages 为 null
 */
export function readPdfPageCount(panel) {
  if (!panel) return { totalPages: null, indicatorFound: false };

  for (const hint of ds.pdfPageIndicatorHints) {
    let el = null;
    try {
      el = panel.querySelector(hint);
    } catch (e) {
      continue;
    }
    if (el) {
      const m = (el.textContent || "").match(pageCountInlinePattern);
      if (m) return { totalPages: parseInt(m[1], 10), indicatorFound: true };
    }
  }

  // 结构扫描：查找文本形如 "3 / 12" 的叶子节点
  for (const el of panel.querySelectorAll("*")) {
    if (el.children.length > 1) continue;
    const t = (el.textContent || "").trim();
    if (pageCountTextPattern.test(t)) {
      const m = t.match(pageCountInlinePattern);
      if (m) return { totalPages: parseInt(m[1], 10), indicatorFound: true };
    }
  }

  return { totalPages: null, indicatorFound: false };
}
