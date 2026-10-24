import {
  readFile,
  writeFile,
  readdir,
  mkdir,
  copyFile,
} from "node:fs/promises";
import { marked } from "marked";
import { zipSync, strToU8 } from "fflate";

await mkdir("docs/store/images", { recursive: true });
for (const size of [128, 256])
  await copyFile(
    `public/icons/fish-${size}.png`,
    `docs/store/images/icon-${size}.png`,
  );
const policy = await readFile("docs/PRIVACY.md", "utf8");
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer"><title>DeepSeek Export Plus隐私说明</title>
<style>body{max-width:860px;margin:40px auto;padding:0 24px;color:#242b36;background:#fff;font:16px/1.8 system-ui,sans-serif;overflow-wrap:anywhere}h1{font-size:28px}h2{font-size:21px;margin-top:32px}a{color:#2357ae}table{display:block;overflow:auto;border-collapse:collapse}th,td{padding:10px;border:1px solid #dce2ea;text-align:left}code{background:#f4f6fa;padding:2px 4px}</style></head>
<body><main>${marked.parse(policy)}</main></body></html>\n`;
await writeFile("docs/store/privacy.html", html);
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const files = {
  "README.md": strToU8(`# DeepSeek Export Plus商店资料包\n\n先读[维护者清单](store/OWNER-CHECKLIST.md)，填写时对照[后台字段表](store/FORM-FIELDS.md)和[审核说明](store/REVIEWER-NOTES.md)。\n\n这个ZIP是文案与图片资料，不能上传到商店的扩展功能包栏。功能包从[GitHub正式发行页](https://github.com/xiaohei07/DeepSeek-Export-Plus/releases/latest)另行下载，选择DeepSeek-Export-Plus-版本号.zip，不选择Source code。\n\n本套资料对应正式版${version}，含14个虚构审核附件，位于store/test-files。角色图标按维护者确认继续使用；详见[图像说明](ASSETS.md)。账号注册、身份验证、协议与最终提交由维护者在官方后台完成。\n`),
  "PRIVACY.md": strToU8(policy),
};
async function collect(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`,
      key = `${prefix}${entry.name}`;
    if (entry.isDirectory()) await collect(path, `${key}/`);
    else files[key] = new Uint8Array(await readFile(path));
  }
}
await collect("docs/store", "store/");
for (const name of [
  "ASSETS.md",
  "THIRD_PARTY_NOTICES.md",
  "JSON-FORMAT.md",
  "DEVELOPMENT.md",
  "VALIDATION.md",
])
  files[name] = new Uint8Array(await readFile(`docs/${name}`));

await mkdir("output", { recursive: true });
const path = `output/DeepSeek-Export-Plus-${version}-store-materials.zip`;
await writeFile(path, zipSync(files, { level: 6 }));
console.log(
  `Prepared ${path} (${Object.keys(files).length} files). No publishing performed.`,
);
