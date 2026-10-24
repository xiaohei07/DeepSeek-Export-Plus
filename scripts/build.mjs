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
  entryPoints: [resolve(root, "public/export/binary.js")],
  outfile: resolve(dist, "export/binary.js"),
  format: "esm",
  plugins: [
    {
      name: "embedded-math-fonts",
      setup(builder) {
        builder.onResolve({ filter: /^dsx:math-css$/ }, () => ({
          path: "math-css",
          namespace: "math",
        }));
        builder.onLoad({ filter: /.*/, namespace: "math" }, async () => {
          let css = (
            await readFile(
              resolve(root, "node_modules/katex/dist/katex.min.css"),
              "utf8",
            )
          ).replace(
            /,url\([^)]*\.(?:woff|ttf)\) format\("(?:woff|truetype)"\)/g,
            "",
          );
          for (const [, file] of [
            ...css.matchAll(/url\((fonts\/[^)]+\.woff2)\)/g),
          ]) {
            const bytes = await readFile(
              resolve(root, "node_modules/katex/dist", file),
            );
            css = css.replaceAll(
              `url(${file})`,
              `url(data:font/woff2;base64,${bytes.toString("base64")})`,
            );
          }
          return {
            contents: `export default ${JSON.stringify(css)}`,
            loader: "js",
          };
        });
      },
    },
  ],
});
await build({
  ...common,
  entryPoints: [resolve(root, "public/privacy/index.js")],
  outdir: resolve(dist, "privacy"),
  format: "esm",
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
for (const name of [
  "manifest.json",
  "content/style.css",
  "print/index.html",
  "privacy/index.html",
])
  await copyFile(resolve(root, "public", name), resolve(dist, name));
await cp(resolve(root, "public/icons"), resolve(dist, "icons"), {
  recursive: true,
});
await copyFile(resolve(root, "LICENSE"), resolve(dist, "LICENSE"));
await mkdir(resolve(dist, "licenses"), { recursive: true });
await copyFile(
  resolve(root, "docs/THIRD_PARTY_NOTICES.md"),
  resolve(dist, "licenses/THIRD_PARTY_NOTICES.md"),
);
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
