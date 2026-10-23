import { build } from "esbuild";
import { readFile, readdir, mkdir, copyFile, cp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const dist = resolve(root, "dist");
if (dist !== resolve(root) + "/dist" && dist !== resolve(root) + "\\dist")
  throw new Error("Invalid build output");
await rm(dist, { recursive: true, force: true });
const common = {
  bundle: true,
  minify: true,
  target: "chrome120",
  legalComments: "eof",
  logLevel: "info",
};
await build({
  ...common,
  entryPoints: [resolve(root, "public/content/index.js")],
  outfile: resolve(dist, "content/index.js"),
  format: "iife",
  loader: { ".css": "text" },
});
await build({
  ...common,
  entryPoints: [resolve(root, "public/content/historyBridge.js")],
  outfile: resolve(dist, "content/historyBridge.js"),
  format: "iife",
});
await build({
  ...common,
  entryPoints: [resolve(root, "public/background/index.js")],
  outfile: resolve(dist, "background/index.js"),
  format: "iife",
});
await build({
  ...common,
  entryPoints: [resolve(root, "public/print/index.js")],
  outdir: resolve(dist, "print"),
  format: "esm",
  loader: { ".woff2": "file" },
  assetNames: "fonts/[name]-[hash]",
  plugins: [
    {
      name: "modern-fonts",
      setup(build) {
        build.onLoad({ filter: /katex\.min\.css$/ }, async (args) => ({
          contents: (await readFile(args.path, "utf8")).replace(
            /,url\([^)]*\.(?:woff|ttf)\) format\("(?:woff|truetype)"\)/g,
            "",
          ),
          loader: "css",
          resolveDir: resolve(root, "node_modules/katex/dist"),
        }));
      },
    },
  ],
});
for (const name of ["manifest.json", "content/style.css", "print/index.html"])
  await copyFile(resolve(root, "public", name), resolve(dist, name));
await cp(resolve(root, "public/icons"), resolve(dist, "icons"), {
  recursive: true,
});
for (const name of ["LICENSE", "THIRD_PARTY_NOTICES.md"])
  await copyFile(resolve(root, name), resolve(dist, name));
const lock = JSON.parse(
  await readFile(resolve(root, "package-lock.json"), "utf8"),
);
for (const [path, meta] of Object.entries(lock.packages)) {
  if (!path || meta.dev) continue;
  const files = (await readdir(resolve(root, path))).filter((f) =>
    /^(licen[cs]e|copying|notice)(\.|$)/i.test(f),
  );
  if (!files.length) continue;
  const target = resolve(
    dist,
    "licenses",
    path.replace(/^node_modules\//, "").replaceAll("/", "__"),
  );
  await mkdir(target, { recursive: true });
  for (const file of files)
    await copyFile(resolve(root, path, file), resolve(target, file));
}
