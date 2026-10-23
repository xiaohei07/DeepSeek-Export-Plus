import {
  ds,
  findFirst,
  findAllFirstMatch,
  queryAllUnion,
} from "../content/selectors.js";
import { waitUntilStable } from "./helpers.js";

export function findMainScrollContainer() {
  const message = findFirst(ds.messageContainer);
  // Choose the message scroll area instead of the sidebar.
  for (
    let el = message?.parentElement;
    el && el !== document.body;
    el = el.parentElement
  ) {
    if (
      el.scrollHeight > el.clientHeight + 2 &&
      el.clientHeight > 100 &&
      /auto|scroll/.test(getComputedStyle(el).overflowY)
    )
      return el;
  }
  return (
    queryAllUnion(ds.scrollArea).find(
      (el) =>
        el.querySelector(".ds-message, [data-message-id]") &&
        el.scrollHeight > el.clientHeight &&
        el.clientHeight > 100,
    ) || document.scrollingElement
  );
}
function mountedMessages() {
  const nodes = findAllFirstMatch(ds.messageContainer);
  return nodes.filter(
    (node) =>
      !nodes.some((other) => other !== node && other.contains(node)) &&
      !findFirst(ds.skeleton, node) &&
      ((node.textContent || "").trim() ||
        node.querySelector('img, canvas, [tabindex], [role="button"]')),
  );
}
function messageKey(node, fallbackIds) {
  const item = node.closest("[data-virtual-list-item-key]");
  if (item) {
    const siblings = Array.from(item.querySelectorAll(".ds-message"));
    return (
      "virtual:" +
      item.getAttribute("data-virtual-list-item-key") +
      ":" +
      Math.max(0, siblings.indexOf(node))
    );
  }
  if (node.hasAttribute("data-message-id"))
    return "message:" + node.getAttribute("data-message-id");
  if (!fallbackIds.has(node)) fallbackIds.set(node, "node:" + fallbackIds.size);
  return fallbackIds.get(node);
}

/** Visit while mounted; virtualized messages disappear after scrolling. */
export async function scrollToLoadAllMessages({
  visit,
  assertCurrent = () => {},
  onProgress = () => {},
  maxSteps = 1200,
} = {}) {
  const scroller = findMainScrollContainer();
  const original = scroller?.scrollTop || 0;
  const originalFromBottom = (scroller?.scrollHeight || 0) - original;
  const originalURL = document.defaultView?.location.href;
  const originalBehavior = scroller?.style.scrollBehavior;
  const nodes = new Map();
  const identities = new Map();
  const start = Date.now();
  const guard = () => {
    assertCurrent();
    if (Date.now() - start > 240000)
      throw new Error("对话加载超过 4 分钟，已停止；请分段分享后导出");
  };
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
    await waitUntilStable(
      () => {
        guard();
        if (findFirst(ds.skeleton)) return null;
        return (
          scroller?.scrollHeight +
          ":" +
          mountedMessages()
            .map((n) => messageKey(n, identities) + ":" + n.textContent.length)
            .join("|")
        );
      },
      { timeout: 12000, interval: 120, stableFor: 500, label: "等待消息加载" },
    );
    guard();
  };
  try {
    onProgress("正在加载对话顶部，检查历史消息…");
    if (scroller) {
      scroller.style.scrollBehavior = "auto";
      let previous = "";
      let stable = 0;
      for (let step = 0; stable < 2; step++) {
        if (step >= maxSteps) throw new Error("历史消息尚未全部加载，请重试");
        guard();
        scroller.scrollTop = 0;
        await settle();
        const snapshot =
          scroller.scrollHeight +
          ":" +
          mountedMessages()
            .map((n) => messageKey(n, identities))
            .join("|");
        stable =
          snapshot === previous && scroller.scrollTop <= 1 ? stable + 1 : 0;
        previous = snapshot;
      }
    }
    const captureMounted = async () => {
      for (const node of mountedMessages()) {
        if (!node.isConnected) continue;
        const key = messageKey(node, identities);
        if (nodes.has(key)) continue;
        if (visit) await visit(node, key, nodes.size);
        nodes.set(key, node);
      }
    };
    // A long message can span dozens of screens while every message is already
    // mounted. Probe the bottom once; only take the shortcut if the same nodes,
    // identities and text remain. Virtualized lists fall back to window traversal.
    if (scroller && scroller.scrollHeight > scroller.clientHeight + 1) {
      const before = mountedMessages().map((node) => ({
        node,
        key: messageKey(node, identities),
        text: node.textContent,
      }));
      onProgress("正在检查对话末尾，确认是否需要分段加载…");
      scroller.scrollTop = scroller.scrollHeight;
      await settle();
      const after = mountedMessages();
      if (
        before.length &&
        before.length === after.length &&
        before.every(
          (item, i) =>
            item.node === after[i] &&
            item.key === messageKey(after[i], identities) &&
            item.text === after[i].textContent,
        )
      ) {
        await captureMounted();
        return [...nodes.values()];
      }
      scroller.scrollTop = 0;
      await settle();
    }
    let bottomStable = 0;
    for (let step = 0; step < maxSteps; step++) {
      guard();
      await captureMounted();
      if (!scroller || scroller.scrollHeight <= scroller.clientHeight + 1)
        return [...nodes.values()];
      const bottom =
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
      if (bottom && ++bottomStable >= 2) return [...nodes.values()];
      if (!bottom) bottomStable = 0;
      onProgress(`正在检查下方历史消息，已读取${nodes.size}条消息…`);
      scroller.scrollTop = Math.min(
        scroller.scrollHeight,
        scroller.scrollTop + Math.max(200, scroller.clientHeight * 0.75),
      );
      await settle();
    }
    throw new Error("对话过长，尚未完成加载，请分段分享后导出");
  } finally {
    if (scroller) {
      if (document.defaultView?.location.href === originalURL)
        scroller.scrollTop = Math.max(
          0,
          scroller.scrollHeight - originalFromBottom,
        );
      scroller.style.scrollBehavior = originalBehavior;
    }
  }
}
