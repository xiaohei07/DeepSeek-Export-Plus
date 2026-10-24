# 商店介绍（简体中文）

本文件对应2.2.0。发布者07xiaohei，支持邮箱lazy07xiaohei@gmail.com。复制时只取字段正文；商店提交状态见[上架清单](OWNER-CHECKLIST.md)。

## 名称

DeepSeek Export Plus · 网页对话导出

## 简短说明

按轮次保存DeepSeek chat/share对话，支持Markdown、HTML、TXT、JSON及多格式ZIP，可选思考、工具记录、图片与附件。

## 详细说明

想把DeepSeek对话放进笔记、留一份离线网页，或者交给脚本继续整理，可以用DeepSeek Export Plus在浏览器里完成。它支持DeepSeek桌面网页版的普通对话与分享页，可以保存整段，也可以只选需要的几轮。

支持四种文件格式：Markdown便于编辑笔记；HTML可直接用浏览器阅读；TXT适合保留纯文本；JSON按轮次组织数据，方便后续处理。勾选多种格式后，插件只读取一次对话，将结果合为一个ZIP。同一份附件不会为了不同格式重复下载。

导出会保留用户与DeepSeek身份、原始轮号、代码块、表格及可取得的来源链接。思考过程默认关闭，勾选后将思考与搜索、打开网页等工具记录按可恢复的顺序一起保存。HTML中的思考使用引用区分，公式使用浏览器原生MathML显示。

需要图片和文档附件时，可以随对话打包，也可以从“附件”窗口单独选择。一个附件直接下载，多个附件生成一个ZIP。DeepSeek上传图片使用网页提供的预览版，不保证与原始上传文件一致；读取失败的文件会在清单中说明。

所有文档转换和ZIP打包在浏览器本地完成，没有导出次数收费、广告或遥测。扩展会读取当前会话内容、网址和所选附件；为补全历史消息，页面载入时会在本机内存暂存网页自然收到的当前会话历史响应，这可能早于打开导出窗口。维护者不接收这些对话。分享内容和文件仍需从DeepSeek服务读取，正文远程图片可能需要向原图片地址请求。扩展只持久保存文件格式偏好，不长期保存对话。原有PDF打印预览继续保留；不提供直接PDF、PNG长图或Word生成。

适用于Chrome、Edge等Chromium桌面浏览器，要求内核120及以上。DeepSeek网页改版、账号灰度界面或失效的附件链接可能影响提取结果；网页没有提供的记录无法恢复。JSON为本插件的存档格式，不能直接导回DeepSeek。

本项目基于sati0121/DeepSeek-Exporter独立维护，遵循MIT许可并保留原作者署名。它是社区项目，并非DeepSeek官方插件。源码、安装说明与问题反馈见项目主页。

## 单一用途

将用户当前打开的DeepSeek网页对话及其所选附件导出为本地文件，方便离线阅读、笔记编辑与个人存档。

## 链接与分类

- 项目主页：https://github.com/xiaohei07/DeepSeek-Export-Plus
- 支持页面：https://github.com/xiaohei07/DeepSeek-Export-Plus/issues
- 分类：选择开发者后台实际提供的“生产力”或“工具”中最贴切的一项。
- 搜索词：DeepSeek、对话导出、Markdown、HTML、JSON、离线存档。
- 隐私说明：https://github.com/xiaohei07/DeepSeek-Export-Plus/blob/main/docs/PRIVACY.md
- 支持邮箱：lazy07xiaohei@gmail.com
- 界面语言：简体中文。英文文案只表示商店介绍提供英文，不代表插件界面已完成英文适配。
