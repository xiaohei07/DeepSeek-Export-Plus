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
 * 最后验证：2026-09-11
 */

/** 插件自身 UI 的根节点，所有查询都要排除它们 */
export const OWN_UI_SELECTOR =
  "#ai-exporter-buttons, #file-export-modal, .ai-exporter-toast";

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
 * 定位输入框区域（用于插入插件按钮）
 *
 * 策略（按顺序）：
 * 1. 字面候选链命中控制栏（.ec4f5d61 等，当前页面实测仍存在）→ 插到控制栏内
 *    .bf38813a（图标行包装层，含附件与发送键）之前
 * 2. 字面候选全部失效时，用结构定位兜底（最大 textarea 的祖先容器）
 *
 * 契约：返回的 before 一定是 root 的直接子节点（或 null）——
 * insertBefore 只接受直接子节点作参照，深层后代会导致 NotFoundError
 *
 * 注意：不要把锚点换成"附件按钮所在行"这类依赖其它图标已渲染的定位——
 * 页面刚加载时附件可能尚未挂载（竞态），会导致按钮落到错误的层级。
 * .bf38813a 只要发送键存在就一定存在，是当前唯一无竞态的锚点。
 *
 * @returns {{root: Element, before: Element|null}|null}
 */
export function resolveComposerAnchor() {
  // 1) 字面候选链：当前页面结构实测有效
  for (let i = 0; i < ds.composerAnchor.length; i++) {
    const bar = document.querySelector(ds.composerAnchor[i]);
    if (!bar || isOwnUI(bar)) continue;
    logHit("composerAnchor", i, ds.composerAnchor[i]);

    const sendArea = bar.querySelector(".bf38813a");
    if (sendArea && sendArea.parentElement) {
      return { root: sendArea.parentElement, before: sendArea };
    }
    return { root: bar, before: bar.lastElementChild };
  }

  // 2) 结构兜底：哈希类名随前端更新全部失效时
  const ta = pickComposerTextarea();
  if (ta) {
    const root = climbToComposerRoot(ta);
    if (
      root &&
      root.querySelector('textarea, [contenteditable="true"]') &&
      !root.querySelector(".ds-message")
    ) {
      const buttons = Array.from(
        root.querySelectorAll(
          'button, [role="button"], [class*="ds-icon-button"]',
        ),
      ).filter((b) => isVisible(b) && !isOwnUI(b) && !b.closest(".ds-message"));
      const last = buttons[buttons.length - 1] || null;
      if (last && last.parentElement) {
        console.debug(
          "[DSX][selector] composerAnchor → 结构定位（发送按钮所在层）",
        );
        return { root: last.parentElement, before: last };
      }
      console.debug("[DSX][selector] composerAnchor → 结构定位（容器末尾）");
      return { root, before: null };
    }
  }
  return null;
}

function pickComposerTextarea() {
  let best = null;
  let bestArea = 0;
  const nodes = document.querySelectorAll('textarea, [contenteditable="true"]');
  for (const el of nodes) {
    if (isOwnUI(el) || !isVisible(el)) continue;
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
    if (hasButton && r.width > 300 && r.bottom > window.innerHeight * 0.5)
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
