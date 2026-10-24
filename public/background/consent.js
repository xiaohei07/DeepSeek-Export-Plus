import { consentKey, consentVersion, hasConsent } from "../privacy/consent.js";

const scriptId = "dsx-consented-history";
export const pendingReads = new Set();
let generation = 0;
export const consentGeneration = () => generation;
export async function assertConsent(epoch = generation) {
  const value = (await chrome.storage.local.get(consentKey))[consentKey];
  if (!hasConsent(value) || epoch !== generation)
    throw new Error("尚未同意或已撤回数据处理，请在数据与隐私设置中确认");
}

export async function openPrivacy() {
  await chrome.runtime.openOptionsPage();
}

async function synchronize(granted) {
  const registered = await chrome.scripting.getRegisteredContentScripts({
    ids: [scriptId],
  });
  if (granted && !registered.length)
    await chrome.scripting.registerContentScripts([
      {
        id: scriptId,
        matches: ["https://chat.deepseek.com/*"],
        js: ["content/historyBridge.js"],
        runAt: "document_start",
        world: "MAIN",
        persistAcrossSessions: true,
      },
    ]);
  if (!granted && registered.length)
    await chrome.scripting.unregisterContentScripts({ ids: [scriptId] });
  const tabs = await chrome.tabs.query({ url: "https://chat.deepseek.com/*" });
  await Promise.allSettled(
    tabs.map((tab) =>
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        ...(granted
          ? { files: ["content/historyBridge.js"] }
          : {
              func: () =>
                globalThis[
                  Symbol.for("deepseek-export-plus.history")
                ]?.stop?.(),
            }),
      }),
    ),
  );
}

// Serialize choices and startup reconciliation; a delayed grant cannot undo a revoke.
let queue = Promise.resolve();
export function setConsent(granted) {
  const task = queue.then(async () => {
    generation++;
    await chrome.storage.local.set({
      [consentKey]: {
        version: consentVersion,
        granted,
        updatedAt: new Date().toISOString(),
      },
    });
    if (!granted) {
      for (const controller of pendingReads) controller.abort();
      pendingReads.clear();
      await chrome.storage.session.clear();
    }
    await synchronize(granted);
  });
  queue = task.catch(() => {});
  return task;
}

queue = (async () => {
  const value = (await chrome.storage.local.get(consentKey))[consentKey];
  await synchronize(hasConsent(value));
})().catch(console.error);

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install")
    chrome.tabs
      .create({ url: chrome.runtime.getURL("privacy/index.html") })
      .catch(console.error);
});
