import { zipSync } from "fflate";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
const files = {};
async function walk(path, prefix = "") {
  for (const item of await readdir(path, { withFileTypes: true })) {
    const key = prefix + item.name;
    if (item.isDirectory()) await walk(path + "/" + item.name, key + "/");
    else files[key] = new Uint8Array(await readFile(path + "/" + item.name));
  }
}
await walk("dist");
const pkg = JSON.parse(await readFile("package.json", "utf8"));
await mkdir("output", { recursive: true });
const name = `DeepSeek-Export-Plus-${pkg.version}.zip`,
  bytes = zipSync(files, { level: 6 });
await writeFile("output/" + name, bytes);
console.log(
  JSON.stringify(
    {
      file: "output/" + name,
      bytes: bytes.length,
      entries: Object.keys(files).length,
    },
    null,
    2,
  ),
);
