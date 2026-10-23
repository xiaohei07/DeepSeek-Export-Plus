# Chrome与Edge上架材料

这些材料对应2.2.0正式版本。**GitHub发行版与浏览器商店分别发布，Chrome、Edge商店尚未提交审核。**账号验证、开发者协议和商店正式提交仍需单独处理。

## 已准备的内容

| 文件 | 作用 |
| --- | --- |
| [中文介绍](LISTING.zh-CN.md)、[英文介绍](LISTING.en.md) | 名称、短描述、完整介绍、单一用途与支持链接 |
| [隐私说明源文件](../PRIVACY.md)、[隐私网页](privacy.html) | 说明读取范围、请求对象、保存期限及用户选择；网页由源文件生成 |
| `images/icon-128.png`、`images/icon-256.png` | 现有小肥鱼图标的商店副本，未改变插件内图像 |
| `images/formats-light.png`、`formats-dark.png` | 浅色、深色导出窗口，显示格式选择与默认关闭思考 |
| `images/html-export.png`、`html-content.png` | 真正导出的HTML，展示图片、思考引用、代码、表格和公式 |
| `images/attachments.png` | 单独选择附件的实际界面 |
| 本文件后续章节 | 权限用途、审核步骤、提交顺序与仍需补齐的信息 |

五张功能截图均为1280×800，来自实际加载扩展的独立Chromium测试环境，使用缩减的演示内容，没有用户账号、原始私人附件或临时签名地址。截图中的`format-demo`是本地模拟页面地址，不是线上示例链接；不要将它提供为审核用网址。英文介绍明确界面目前为简体中文。

Chrome要求128×128图标及至少一张功能截图，支持1280×800或640×400截图；本项目使用1280×800。Edge接受1280×800截图，图标最低128×128。440×280、1400×560宣传图属于可选项，本轮未制作。尺寸与数量以提交时后台要求为准。[Chrome图像要求](https://developer.chrome.com/docs/webstore/images)、[Edge上架说明](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)。

## 权限用途（可填入两家后台）

| 权限 | 中文说明 | English justification |
| --- | --- | --- |
| `scripting` | 在用户打开的DeepSeek页面读取当前消息附近的必要字段，补充折叠思考、工具与附件；所有执行代码都随扩展打包 | Executes packaged code on the current DeepSeek page to read scoped message fields needed for collapsed thinking, tool records and attachments. No remote code is executed. |
| `https://chat.deepseek.com/*` | 在DeepSeek页面提供导出入口，读取当前会话；分享页请求公开分享接口；chat观察网页自然收到的历史响应 | Adds export controls on DeepSeek pages, reads the active conversation, fetches public share data and observes relevant history responses naturally received by the page. |
| `https://files.deepseeksvc.com/*` | 用户选择保存附件时，从DeepSeek文件服务下载原文档或图片预览；实际请求限制到`/api/file` | Downloads selected document files and image previews from the DeepSeek file service. The implementation restricts requests to its `/api/file` endpoint. |
| `clipboardWrite` | 仅点击“复制Markdown”后将结果写入剪贴板 | Writes the exported Markdown to the clipboard only after the user clicks Copy Markdown. |
| `storage` | 本机保存格式偏好，并在会话存储中暂存PDF预览；不长期保存对话 | Stores format preferences locally and temporarily holds PDF preview content in session storage. Conversation content is not kept in persistent storage. |

单一用途：导出当前DeepSeek网页对话及用户所选附件，供本地阅读、笔记编辑和个人存档。Remote code字段应选择“不使用”：库、执行脚本和打印字体均包含在安装包内；分享响应、附件字节和图片是数据，文档中的HTML不会作为扩展代码执行。

数据声明需与[隐私说明](../PRIVACY.md)一致：扩展会读取当前网站内容、会话网址与可能包含个人信息的对话，在本机处理；页面历史观察早于用户点击导出。维护者不接收、出售这些数据，不用于广告、信用判断或其他无关用途。不能简单因为“没有后端”就把读取行为描述为“完全不访问用户数据”。正式填写后台分类时，按当时的数据定义确认涉及的网站内容、通信内容和当前网址；不要扩大成访问整个浏览历史，也不要填写未来尚未实现的行为。[Chrome隐私字段](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)、[Edge隐私填写步骤](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension#step-6-enter-privacy-information)。

## 审核测试步骤

以下内容可作为2.2.0的审核备注。提交其他版本时，需核对步骤与实际功能一致。

1. 打开`https://chat.deepseek.com`，使用审核人员自己的账号建立两轮普通对话，等回复完成。扩展不提供或要求额外账号、API密钥、付费订阅。
2. 点击输入区附近的小肥鱼“导出”。页面没有输入区时，入口位于对话顶部。选择一轮，保持思考关闭，取消附件选项，依次单选Markdown、HTML、TXT和JSON。每次应只保存一个对应格式的文件，轮号沿用原对话。
3. 同时选择两种以上格式。应产生一次ZIP下载，里面有对应的`对话.*`文档。选择格式会记住，关闭再打开窗口后思考选项仍应关闭。
4. 若会话包含思考或搜索，勾选思考并导出，再取消勾选导出。只有勾选后的文件应包含可取得的思考与工具记录。JSON在未勾选时省略`reasoning`字段。
5. 上传一张测试图片或小文档，再让DeepSeek回复。选择附带附件并导出HTML与JSON，解压后打开`对话.html`，应能读取保存在`assets`里的图片；JSON记录相对路径，清单记录保存结果。网页只提供图片预览时会标记预览版。
6. 点击“附件”。选一个文件应直接下载，选多个应只有一个ZIP；失效链接会报告失败，不伪装成成功。
7. 为这段测试对话创建分享链接，再在share页面重复单格式和ZIP检查。share正文标题固定，下载名称带秒级时间；原始chat标题仍可编辑。
8. 可选检查原有“PDF”入口：它只打开本地打印预览，最终由浏览器打印窗口保存PDF，不会生成直接下载的PDF附件。

English reviewer note: The UI is in Simplified Chinese. “导出” opens export, “选择对话轮次” selects rounds, “导出格式” selects formats, “包含思考过程与工具记录” includes thinking/tool records, and “附带图片与附件” saves assets. “附件” opens the attachment list. Use your own DeepSeek account and a completed conversation, then its share page. Single-format exports download one document; multiple formats produce one ZIP. Extract the ZIP before opening its HTML so sibling assets can load. Thinking is off by default and is not remembered. The existing PDF button opens a print preview. The extension has no separate login or paid feature gate.

公开分享页可用于无登录测试，但DeepSeek可能改变访问要求；正式提交时应验证准备给审核人员的公开链接仍可访问，并确认内容适合公开。不要提供自己的登录凭据。

## 正式提交前的顺序

1. 2.2.0已完成本地验证与使用者确认，提交时选用正式安装包`DeepSeek-Export-Plus-2.2.0.zip`。若修改代码，需重新构建和验证；商店材料ZIP不能当扩展包上传。
2. 确认开发者账号和对外联系信息。Chrome需要开发者注册及一次性注册费，金额以后台为准；Edge的扩展开发者注册文档说明目前不收注册费。[Chrome注册](https://developer.chrome.com/docs/webstore/register/)、[Edge注册](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)。本轮没有登录后台核验账号状态、付费或接受协议。
3. 核对隐私说明的公开链接，可使用[仓库隐私说明](https://github.com/xiaohei07/DeepSeek-Export-Plus/blob/main/docs/PRIVACY.md)。另有`docs/store/privacy.html`可部署到GitHub Pages或自己的静态网站；目前未部署独立隐私站点，不能填写一个尚不可访问的地址。
4. 核对图标使用依据，保留[图像来源说明](../ASSETS.md)和上游MIT许可。项目图标由用户提供的角色参考生成，现有材料记录了使用过程，未独立核验参考角色的完整权属；若商店要求证明，需补充相应材料或换用权属明确的原创形象。名称和描述不使用“官方”或暗示DeepSeek授权。
5. Chrome Developer Dashboard新建条目并上传正式ZIP，填写介绍、图片、单一用途、权限、隐私与分发范围。Edge Partner Center使用相同功能包和相应材料填写，分别检查后台警告和审核备注。
6. 先保存草稿，核对版本、截图、公开链接与数据声明，再提交审核。实际商店通过后才在README增加商店安装链接，不写“已上架”占位链接。

## 生成材料包

在项目根目录执行：

```bash
npm run prepare:store
```

脚本由`docs/PRIVACY.md`生成静态隐私网页，复制图标，并把现有商店材料打包到`output/DeepSeek-Export-Plus-版本号-store-materials.zip`。要更新截图，先构建并执行`npm run test:formats`。脚本不会联网发布、登录商店或修改GitHub。
