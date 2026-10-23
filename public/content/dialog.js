import styles from "./dialog.css";
import { extractConversationData } from "./extractor.js";
import { prepareExport, prepareAttachmentArchive } from "./exportBundle.js";
import {
  conversationRounds,
  selectRounds,
  safeFilename,
} from "./conversation.js";

export function pageTheme() {
  const candidates = [
    document.querySelector(".ds-message"),
    document.querySelector("main"),
    document.body,
    document.documentElement,
  ];
  for (let element of candidates)
    for (; element; element = element.parentElement) {
      const style = getComputedStyle(element),
        rgb = style.backgroundColor.match(/[\d.]+/g)?.map(Number);
      if (rgb?.length >= 3 && (rgb.length < 4 || rgb[3] > 0.95)) {
        const dark = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 < 128;
        return {
          bg: style.backgroundColor,
          fg: dark ? "#f0f2f5" : "#202124",
          soft: dark ? "#30343b" : "#f1f4f9",
          line: dark ? "#515760" : "#d5dbe5",
          accent: dark ? "#92b5ff" : "#3566ce",
          dark,
        };
      }
    }
  return {
    bg: "#fff",
    fg: "#202124",
    soft: "#f1f4f9",
    line: "#d5dbe5",
    accent: "#3566ce",
    dark: false,
  };
}
export function syncTheme(host) {
  const theme = pageTheme();
  for (const name of ["bg", "fg", "soft", "line", "accent"])
    host.style.setProperty("--" + name, theme[name]);
  host.style.colorScheme = theme.dark ? "dark" : "light";
}
export function saveDownload(content, title, extension, mime) {
  const blob = new Blob([content], {
    type:
      mime ||
      (extension === "zip" ? "application/zip" : "text/markdown;charset=utf-8"),
  });
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = safeFilename(title) + "." + extension;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function printPreview(markdown, title) {
  const response = await chrome.runtime.sendMessage({
    type: "OPEN_PRINT_PREVIEW",
    markdown,
    title,
  });
  if (!response?.success) throw new Error(response?.error || "无法打开PDF预览");
}
const previewNote =
  "图片使用DeepSeek网页提供的预览版，并非原始上传文件；像素尺寸相同也不代表原文件相同。文档附件按原文件下载。";
function displaySize(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return (
    " · " +
    (n < 1024
      ? n + "B"
      : n < 1048576
        ? (n / 1024).toFixed(1) + "KB"
        : (n / 1048576).toFixed(1) + "MB")
  );
}

export async function openExportDialog(mode = "conversation") {
  if (document.getElementById("dsx-dialog-host")) return;
  const trigger = document.activeElement,
    host = document.createElement("div");
  host.id = "dsx-dialog-host";
  const root = host.attachShadow({ mode: "open" });
  const controller = new AbortController();
  root.innerHTML = `<style>${styles}</style><dialog aria-labelledby="dialog-title"><div class="shell">
    <header><img class="mascot" src="${chrome.runtime.getURL("icons/fish-128.png")}" alt="小肥鱼"><div class="intro"><h2 id="dialog-title">${mode === "files" ? "带走对话里的文件" : "导出这段对话"}</h2><p id="speech">我来整理，你来决定带走哪些内容。</p></div><button class="close" aria-label="关闭">×</button></header>
    <div class="body"><div class="loading"><div class="loading-line"></div><p>正在读取对话。长对话需要滚动加载，请稍等片刻。</p></div><div id="settings" hidden></div></div>
    <div class="status" role="status" aria-live="polite">准备读取…</div><footer hidden></footer></div></dialog>`;
  document.body.append(host);
  syncTheme(host);
  const observer = new MutationObserver(() => syncTheme(host));
  for (const el of [document.documentElement, document.body])
    observer.observe(el, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
  const dialog = root.querySelector("dialog"),
    status = root.querySelector(".status"),
    settings = root.querySelector("#settings"),
    footer = root.querySelector("footer");
  const close = () => {
    controller.abort();
    observer.disconnect();
    dialog.close();
    host.remove();
    if (trigger?.isConnected) trigger.focus();
  };
  root.querySelector(".close").onclick = close;
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        close();
    }
  });
  dialog.showModal();
  const progress = (text) => {
    if (host.isConnected) status.textContent = text;
  };
  const fail = (error) => {
    if (!controller.signal.aborted) {
      status.textContent =
        "没有完成：" + error.message + "。可重试，或刷新页面后再导出。";
      status.classList.add("error");
    }
  };
  let data,
    thinkingLoaded = false;
  try {
    data = await extractConversationData(false, {
      onProgress: progress,
      signal: controller.signal,
    });
  } catch (error) {
    fail(error);
    root.querySelector(".loading").hidden = true;
    if (host.isConnected) {
      const retry = document.createElement("button");
      retry.textContent = "重新读取";
      retry.onclick = () => {
        close();
        openExportDialog(mode);
      };
      settings.append(retry);
      settings.hidden = false;
    }
    return;
  }
  if (controller.signal.aborted) return;
  const sourceURL = location.href;
  const rounds = conversationRounds(data.messages),
    selected = new Set(rounds.map((r) => r.number));
  const files = [
    ...new Map(
      data.messages
        .flatMap((m) => m.attachments || [])
        .map((f) => [f.id || f.url || f.filename, f]),
    ).values(),
  ];
  root.querySelector(".loading").hidden = true;
  settings.hidden = false;
  footer.hidden = false;
  root.querySelector("#speech").textContent =
    mode === "files"
      ? "文件整理好了，勾选后就可以带走。"
      : "整理好了。整段保存，或者只选你需要的几轮。";
  settings.innerHTML = `<div class="notice">${previewNote}</div>${
    mode === "conversation"
      ? `<label class="title-label">文档标题<input type="text" id="title" maxlength="150"></label>
    <div class="row between"><h3>选择对话轮次</h3><button id="select-all">取消全选</button></div>
    <div class="row range"><span>范围</span><input id="from" type="number" min="1" max="${rounds.length}" value="1" aria-label="起始轮次"><span>至</span><input id="to" type="number" min="1" max="${rounds.length}" value="${rounds.length}" aria-label="结束轮次"><button id="apply-range">选中范围</button></div>
    <div class="round-list"></div><div class="options"><label class="option"><input id="thinking" type="checkbox">包含思考过程与工具记录</label><label class="option"><input id="offline" type="checkbox" checked>Markdown附带图片与附件（ZIP）</label></div>`
      : `<div class="row between"><h3>对话附件</h3><button id="select-all">取消全选</button></div><div class="file-list"></div>`
  }`;
  const title = root.querySelector("#title");
  if (title) title.value = data.title;
  const count = document.createElement("span");
  count.className = "count";
  footer.append(count);
  const checks = [];
  const list = root.querySelector(
    mode === "files" ? ".file-list" : ".round-list",
  );
  const items = mode === "files" ? files : rounds;
  items.forEach((item, index) => {
    const label = document.createElement("label");
    label.className = "item";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = true;
    check.dataset.index = index;
    checks.push(check);
    const text = document.createElement("span"),
      heading = document.createElement("strong"),
      preview = document.createElement("span");
    preview.className = "preview";
    heading.textContent =
      mode === "files" ? item.filename : "第 " + item.number + " 轮";
    preview.textContent =
      mode === "files"
        ? item.isImage
          ? "图片 · 网页预览版" +
            (displaySize(item.size)
              ? "；原上传大小" + displaySize(item.size).slice(3)
              : "")
          : "文档 · 原文件" + displaySize(item.size)
        : (
            item.messages.find((m) => m.role === "user")?.content ||
            item.messages[0]?.content ||
            "附件对话"
          )
            .replace(/\s+/g, " ")
            .slice(0, 120);
    text.append(heading, preview);
    label.append(check, text);
    list.append(label);
  });
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent =
      "这段对话中没有发现可下载的附件。正文图片可通过对话ZIP导出。";
    list.append(empty);
  }
  const actions = [];
  const update = () => {
    selected.clear();
    checks.forEach((c, i) => {
      if (c.checked) selected.add(mode === "files" ? i : rounds[i].number);
    });
    count.textContent = `已选${selected.size}/${items.length}${mode === "files" ? "个文件" : "轮"}`;
    root.querySelector("#select-all").textContent =
      selected.size === items.length ? "取消全选" : "全选";
    actions.forEach((button) => (button.disabled = !selected.size));
  };
  checks.forEach((check) => (check.onchange = update));
  root.querySelector("#select-all").onclick = () => {
    const all = selected.size !== items.length;
    checks.forEach((c) => (c.checked = all));
    update();
  };
  root.querySelector("#apply-range")?.addEventListener("click", () => {
    const from = Number(root.querySelector("#from").value),
      to = Number(root.querySelector("#to").value);
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 1 ||
      to > rounds.length ||
      from > to
    )
      return progress("请填写有效轮次范围，起始轮次不能大于结束轮次。");
    checks.forEach(
      (check, index) => (check.checked = index + 1 >= from && index + 1 <= to),
    );
    update();
  });
  const action = (label, handler, primary = false) => {
    const button = document.createElement("button");
    button.textContent = label;
    if (primary) button.className = "primary";
    footer.append(button);
    actions.push(button);
    button.onclick = async () => {
      actions.forEach((b) => (b.disabled = true));
      settings.inert = true;
      status.classList.remove("error");
      try {
        if (location.href !== sourceURL)
          throw new Error("页面已切换，请关闭窗口后重新读取");
        if (
          mode === "conversation" &&
          root.querySelector("#thinking").checked &&
          !thinkingLoaded
        ) {
          const expanded = await extractConversationData(true, {
            signal: controller.signal,
            onProgress: progress,
          });
          if (conversationRounds(expanded.messages).length !== rounds.length)
            throw new Error("对话轮次已变化，请重新打开导出窗口选择");
          data = expanded;
          thinkingLoaded = true;
        }
        await handler();
      } catch (error) {
        fail(error);
      } finally {
        settings.inert = false;
        update();
      }
    };
  };
  if (mode === "files") {
    action(
      "打包下载所选文件",
      async () => {
        const result = await prepareAttachmentArchive(
          [...selected].map((i) => files[i]),
          { signal: controller.signal, onProgress: progress },
        );
        controller.signal.throwIfAborted();
        if (!result.zip) throw new Error("没有选中可打包的附件");
        saveDownload(result.zip, data.title + "-附件", "zip");
        progress(
          `ZIP已生成：${result.saved}个文件${result.failed ? `，${result.failed}个失败（原因见压缩包内的附件清单）` : ""}。浏览器已收到一次下载请求。`,
        );
      },
      true,
    );
  } else {
    const exportData = () => ({
      ...selectRounds(data, selected),
      title: title.value.trim() || data.title,
    });
    const build = (forPrint) =>
      prepareExport(exportData(), {
        includeThinking: root.querySelector("#thinking").checked,
        offline: root.querySelector("#offline").checked,
        forPrint,
        signal: controller.signal,
        onProgress: progress,
      });
    action("复制Markdown", async () => {
      const result = await prepareExport(exportData(), {
        includeThinking: root.querySelector("#thinking").checked,
      });
      await navigator.clipboard.writeText(result.markdown);
      progress("已复制Markdown。附件链接可能过期，长期保存建议导出ZIP。");
    });
    action("PDF", async () => {
      const result = await build(true);
      controller.signal.throwIfAborted();
      await printPreview(result.markdown, exportData().title);
      progress(
        "PDF预览已打开。点击“打印 / 保存为PDF”，将目标打印机选择为“另存为PDF”。" +
          (result.warnings.length ? "请留意文档开头的导出提示。" : ""),
      );
    });
    action(
      "导出Markdown",
      async () => {
        const result = await build(false);
        controller.signal.throwIfAborted();
        saveDownload(
          result.zip || result.markdown,
          exportData().title,
          result.zip ? "zip" : "md",
        );
        progress(
          result.warnings.length
            ? `导出完成，有${result.warnings.length}条提示，请查看文档开头和附件清单。`
            : "已保存。小肥鱼把这段对话整理好了。",
        );
      },
      true,
    );
  }
  update();
  progress(
    `读取完成：${rounds.length}轮对话，${files.length}个附件。${data.warnings?.length ? "部分内容有导出提示，请留意文档开头。" : ""}`,
  );
}
