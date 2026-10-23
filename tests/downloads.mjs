import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";

// Observe only this isolated browser's downloads, without extension permissions.
export async function watchDownloads(context, page, directory) {
  await mkdir(directory, { recursive: true });
  const session = await context.newCDPSession(page),
    items = [];
  session.on("Browser.downloadWillBegin", (event) =>
    items.push({ ...event, state: "inProgress" }),
  );
  session.on("Browser.downloadProgress", (event) =>
    Object.assign(items.find((i) => i.guid === event.guid) || {}, event),
  );
  await session.send("Browser.setDownloadBehavior", {
    behavior: "allowAndName",
    downloadPath: resolve(directory),
    eventsEnabled: true,
  });
  let cursor = 0;
  return {
    get count() {
      return items.length;
    },
    async next(target) {
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        const item = items[cursor];
        if (item?.state === "canceled")
          throw new Error("Browser canceled download");
        if (item?.state === "completed") {
          cursor++;
          await copyFile(resolve(directory, item.guid), target);
          return item;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error("Download did not complete");
    },
  };
}
