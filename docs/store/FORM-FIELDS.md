# 上架后台逐字段填写表

对应2.2.0，核对日期2026-10-24。以下建议根据当前manifest和数据处理实现整理，后台字段名可能调整。涉及身份和数据使用的声明需要维护者逐项核对后提交，不能整页盲选。

## 通用字段

| 字段 | 填写内容 |
| --- | --- |
| 发布者 / Publisher | `07xiaohei` |
| 支持邮箱 / Support email | `lazy07xiaohei@gmail.com` |
| 名称 | `DeepSeek Export Plus · 网页对话导出` |
| 版本 | `2.2.0`，由安装ZIP内的manifest读取；更换代码或内置图标后应递增版本 |
| 界面语言 | 简体中文；目前没有英文界面 |
| 分类 | 在后台现有选项中选择“生产力 / Productivity”或最接近的工具分类 |
| 收费 | 免费，无付费功能、广告或导出次数收费 |
| 项目主页 | `https://github.com/xiaohei07/DeepSeek-Export-Plus` |
| 支持页面 | `https://github.com/xiaohei07/DeepSeek-Export-Plus/issues` |
| 隐私政策URL | `https://github.com/xiaohei07/DeepSeek-Export-Plus/blob/main/docs/PRIVACY.md` |
| 详细介绍 | 复制[中文介绍](LISTING.zh-CN.md)的“详细说明”；可编辑的英文介绍用[英文文件](LISTING.en.md) |
| 单一用途 | 将用户当前打开的DeepSeek网页对话及其所选附件导出为本地文件，方便离线阅读、笔记编辑与个人存档。 |
| 使用远程代码 | **No / 不使用**。脚本、库和打印字体均随包提供；下载对话JSON、图片和附件是读取数据，不执行下载的代码 |

安装包使用GitHub发行页下载的`DeepSeek-Export-Plus-2.2.0.zip`，根目录直接包含`manifest.json`。**不要上传源码ZIP或store-materials.zip。**当前图标依据仍待处理，详见[维护者清单](OWNER-CHECKLIST.md)。

Chrome名称与短描述主要来自manifest；Edge也可能将这两个字段设为只读。因此英文介绍不等于可以在后台任意改包内名称，更不表示已支持英文界面。无需为首次上架改动已确认的中文产品名称。

## 权限用途：可直接复制英文

### scripting

Runs packaged functions in the current DeepSeek page to read scoped message fields needed for collapsed thinking, tool records and attachments. This supports the conversation export selected by the user. It does not inject downloaded scripts or run code on unrelated websites.

### storage

Stores export-format preferences in chrome.storage.local and temporary PDF preview data in chrome.storage.session. Conversation content is not stored in persistent extension storage. Preview data is removed when its tab closes, and older previews are cleaned on later preview creation or near the storage limit.

### clipboardWrite

Writes the generated Markdown to the clipboard only when the user clicks Copy Markdown. The extension does not read the clipboard.

### Host permissions

https://chat.deepseek.com/*: Adds export controls, reads the current conversation and observes relevant history responses naturally received by that page. Shared conversations are obtained from DeepSeek's share API. It does not read global browser history, cookies or authentication headers.

https://files.deepseeksvc.com/*: Retrieves document files and image previews selected for export. Requests are limited in code to the DeepSeek file API and omit authentication credentials.

### Remote code explanation（若后台要求说明）

No remote code is executed. All executable JavaScript, libraries and print fonts are included in the submitted package. Remote responses are treated as data for conversation export or attachment download. Exported HTML is sanitized and does not load external scripts or fonts.

## 数据使用怎么选

**本机读取、处理或暂存也要披露。**本项目没有维护者服务器，不代表没有处理用户数据。下面是根据2.2.0实现给出的分类建议，最终按两家后台当前定义核对。[Chrome数据字段](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)、[本地数据处理说明](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)

| 类型 | 当前功能及建议 |
| --- | --- |
| 网站内容 / Website content | **应披露**。读取对话文字、图片、代码、附件及来源链接，生成本地文件 |
| 个人通信 / Personal communications | **建议披露**。保存用户与DeepSeek的聊天内容，可能包含私人对话 |
| 浏览记录 / Web history | **建议披露当前页面与资源URL这一范围**。会取得会话网址和来源、附件地址；没有读取浏览器全局历史，也没有跨站行为追踪。不要因未申请history权限就忽略网址字段 |
| 身份、健康、财务或认证信息等 | 不单独读取账号资料、Cookie、密码库或支付接口，也不分析这些类别。但用户消息或附件可能本身含这些内容，导出会保留；如果后台定义将这种内容一并计入，需按实际情况补充，不能声明会自动过滤 |
| 位置 / Location | 不调用定位接口，不采集GPS位置；请求DeepSeek或图片站点时对方可收到连接所需IP，已在隐私说明披露 |
| 用户活动 / User activity | 不记录键盘、鼠标、浏览行为用于分析或广告；只响应导出交互并保存格式偏好 |

三个有限使用确认项，只有在阅读后确认与实际运营一致时勾选：不出售或作政策允许范围以外的转移；不用于与单一导出用途无关的目的；不用于信用或贷款判断。当前实现没有广告、遥测、模型训练或维护者接收对话的后端。不要填写“不处理任何用户数据”。

审核补充说明可用：

> Conversation content, the current conversation URL and selected attachments are processed locally for export. Relevant chat-history responses are temporarily retained in page memory from page load, before the export dialog may be opened. The maintainer does not receive conversation content. Downloads contact DeepSeek or the original image host. The extension does not read cookies, authentication headers or global browser history, and does not sell data or use it for advertising, credit decisions or model training.

## 图像与搜索词

| 上传项 | 文件及使用说明 |
| --- | --- |
| Chrome图标 | `images/icon-128.png`，128×128；当前图标来源尚需解决 |
| Edge图标 | `images/icon-256.png`，256×256，达到最低128×128要求；官方推荐300×300，可在最终图标确定后统一生成 |
| 截图顺序 | `formats-light.png` → `formats-dark.png` → `html-content.png` → `html-export.png` → `attachments.png`，均在images内，1280×800 |
| 宣传图 / 视频 | 可选，目前不提供；不要把截图当作440×280宣传图上传 |
| Edge搜索词 | `DeepSeek`、`对话导出`、`Markdown`、`HTML`、`JSON`、`离线存档`，分别填入，不作为重复关键词段落塞进介绍 |

截图来自真实扩展在隔离测试页运行，不是概念效果图；页面地址是模拟地址，审核人员不能通过它访问示例。截图内图标也需在替换角色图标时一并更新。尺寸依据：[Chrome图片要求](https://developer.chrome.com/docs/webstore/images)、[Edge上架字段](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)。

最后按[审核说明](REVIEWER-NOTES.md)填写测试入口。两家商店的公开/非公开、分发地区和发布时机由维护者在提交页确认，资料包不会自动修改这些选项。
