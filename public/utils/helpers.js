import { ds, findFirst } from "../content/selectors.js";

// 防抖函数，防止DOM频繁变动时重复执行
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 轮询等待谓词成立
 * - 立即求值一次；谓词可以是异步的；谓词抛错按 false 处理
 * - 成功时 resolve 谓词的返回值（可用于返回找到的元素）；超时 reject
 */
export function waitUntil(
  predicate,
  { timeout = 5000, interval = 120, label = "waitUntil" } = {},
) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = async () => {
      let value = null;
      try {
        value = await predicate();
      } catch (e) {
        console.debug(
          `[AI Exporter] waitUntil(${label}) 谓词异常:`,
          e && e.message,
        );
        value = null;
      }
      if (value) {
        resolve(value);
        return;
      }
      if (Date.now() - start >= timeout) {
        reject(new Error(`[waitUntil] ${label} 超时 (${timeout}ms)`));
        return;
      }
      setTimeout(tick, interval);
    };
    tick();
  });
}

/** 同 waitUntil，但超时返回 null 而不是抛错 */
export async function waitUntilOrNull(predicate, opts = {}) {
  try {
    return await waitUntil(predicate, opts);
  } catch (e) {
    return null;
  }
}

/** 等待谓词变为假（例如等待某个面板被关闭） */
export async function waitUntilGone(predicate, opts = {}) {
  return await waitUntilOrNull(async () => !(await predicate()), opts);
}

/**
 * 等待采样快照稳定（连续 stableFor 毫秒不变），用于等 DOM 渐进渲染完成
 * @param {Function} sample - 返回可序列化快照；为 null 表示"暂无内容"，继续等待
 */
export function waitUntilStable(
  sample,
  {
    timeout = 12000,
    interval = 300,
    stableFor = 600,
    label = "waitUntilStable",
  } = {},
) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let lastSnapshot = null;
    let lastChangeAt = Date.now();
    const tick = () => {
      let snapshot = null;
      try {
        snapshot = sample();
      } catch (e) {
        reject(e);
        return;
      }
      const now = Date.now();
      if (snapshot !== lastSnapshot) {
        lastSnapshot = snapshot;
        lastChangeAt = now;
      }
      if (lastSnapshot !== null && now - lastChangeAt >= stableFor) {
        resolve(lastSnapshot);
        return;
      }
      if (now - start >= timeout) {
        reject(new Error(`[waitUntilStable] ${label} 超时 (${timeout}ms)`));
        return;
      }
      setTimeout(tick, interval);
    };
    tick();
  });
}

// 检测当前平台
export function detectPlatform() {
  if (location.hostname.includes("deepseek")) return "deepseek";
  return null;
}

// 检查AI是否正在生成回复
export function isGeneratingResponse() {
  // DeepSeek：只检测明确的"停止生成"按钮
  // 这是唯一可靠的生成中指示器
  const stopButton = findFirst(ds.stopButton, document, "stopButton");
  if (stopButton) {
    console.log("[AI Exporter] 检测到 AI 正在生成回复");
    return true;
  }

  // 检查是否有正在流式输出的内容（消息末尾有光标动画）
  const streamingCursor = findFirst(
    ds.streamingCursor,
    document,
    "streamingCursor",
  );
  if (streamingCursor) {
    const style = window.getComputedStyle(streamingCursor);
    if (style.visibility !== "hidden" && style.display !== "none") {
      console.log("[AI Exporter] 检测到流式输出中");
      return true;
    }
  }
  return false;
}
