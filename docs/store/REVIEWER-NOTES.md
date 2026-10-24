# 审核入口与测试说明

本页对应正式版2.3.0，用于商店审核备注。完整测试可使用[14种后缀附件的逐轮提示词](TEST-CONVERSATION.md)；下面的短示例适合快速复查。

## 先准备一条可以公开的示例

建议维护者新建一段短对话，用于两家商店的审核。不要使用带私人附件、工作信息或临时下载地址的已有长对话。

1. 第一轮可输入：

   > 请用Python写一个合并重叠区间的简短函数，使用python代码块。再给出一个包含两行示例输入输出的Markdown表格。

2. 第二轮可输入：

   > 补充算法复杂度和一个LaTeX公式；如果当前模式支持搜索，给出Python官方排序文档的来源链接。

3. 可上传一张自己创作的简单测试图，以及只含`DeepSeek Export Plus demo`的test.txt，再让DeepSeek回复。开启思考或搜索时，实际可用能力取决于DeepSeek账号，不是插件提供的功能。
4. 创建分享链接，在未登录的独立窗口检查能否打开、是否包含两轮内容和附件。记录测试日期；如果DeepSeek要求登录，就在审核备注里明确说明，不承诺无需登录。

**需要维护者补充：这条不含私人信息的share网址。**当前已有截图中的`format-demo`只是测试地址，不可填为审核入口。也不需要把个人账号密码、验证码写进仓库。若审核方确实要求测试账号，仅在官方私密审核字段中提供专用测试账号，不使用个人主账号。

## 可粘贴的英文审核说明

复制以下正文，并在末尾补上已验证的示例网址及其登录要求。没有提供示例时，先完成上面的准备步骤。

```text
DeepSeek Export Plus exports conversations from chat.deepseek.com. It is an independent community extension, not a DeepSeek product. The interface is in Simplified Chinese. It has no separate login, subscription or API key requirement. Access to DeepSeek itself follows that site's account and regional requirements.

After installation, read the separate data disclosure page. Click 同意并启用导出 to enable processing or 暂不同意 to decline. No conversation is read or retained before consent. Then refresh a DeepSeek chat or share page. Click the small mascot's “导出” button near the conversation input, or at the top of the conversation when no input area is available. “附件” opens the attachment list. At narrow widths the controls may appear as icons beside the input.

1. Open a completed two-round conversation. Click “导出” and select one round. Leave thinking unchecked and uncheck attachments. Export Markdown, HTML, TXT, JSON, Word and PNG one at a time. Word text and tables are editable, while formulas are images with LaTeX alternative text. Long PNG output is split and zipped. Each selection should download one document; original round numbers are retained.
2. Select two or more formats. One ZIP should contain the selected documents. Format preferences are remembered, while thinking remains off when the dialog is reopened.
3. If the conversation contains thinking or search records, enable “包含思考过程与工具记录”. Available records should be included. Disable it and export again: thinking and tool records should be omitted, including the JSON reasoning field.
4. Enable “附带图片与附件” and export HTML plus JSON. Extract the ZIP before opening its HTML. Saved images are loaded from the sibling assets folder, and attachments are shared across formats. Uploaded images may be DeepSeek previews rather than originals.
5. Open “附件”. Selecting one file downloads it directly; selecting several creates one ZIP. Failed retrievals are reported rather than presented as successful files.
6. The “PDF” button at the bottom opens a local print preview. Use “打印 / 保存为PDF” to open the browser print dialog. PDF is not a direct export format and is not included in the multi-format ZIP.
7. Repeat on the conversation's share page. Share document headings are fixed; regular chat titles can be edited. Download names include a timestamp to the second.

8. Open 数据与隐私 from the dialog or the extension options. Click 撤回同意并清理缓存. The export dialog closes, temporary history is cleared, and open PDF previews are cleared. Downloaded files remain under the user's control. Grant consent again and refresh to resume.

Data handling: export conversion, DOCX/PNG rendering and ZIP creation are local. Only after consent, the extension temporarily retains relevant history responses naturally received by the current page from page load, potentially before the export dialog opens. It does not send conversation content to the maintainer. Share data and attachments are fetched from DeepSeek; saving remote images may contact their original hosts. All executable code and print fonts are packaged, with no remote executable code.

Known limits: the extension cannot recover data that DeepSeek does not provide. Website changes, account-specific layouts, expired file URLs and image CORS restrictions can affect results. JSON is not an importable DeepSeek backup. The UI has not been localized into English.

Source and implementation: https://github.com/xiaohei07/DeepSeek-Export-Plus
Privacy: https://github.com/xiaohei07/DeepSeek-Export-Plus/blob/main/docs/PRIVACY.md
Support: lazy07xiaohei@gmail.com
```

审核备注字段长度若有限制，可保留入口说明、第1、2、4、6项与数据处理段落，其余步骤通过源码仓库中的本文件提供。不要为了缩短说明删掉登录要求，或把原生PDF打印描述为直接生成PDF文件。
