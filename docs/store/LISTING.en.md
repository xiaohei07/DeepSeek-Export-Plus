# Store listing (English)

Prepared for release 2.3.0. Publisher: 07xiaohei. Support: lazy07xiaohei@gmail.com. The interface is in Simplified Chinese. Copy field contents only; see the submission checklist for current readiness.

## Name

DeepSeek Export Plus · 网页对话导出

## Short description

Export DeepSeek chats to Markdown, HTML, TXT, JSON, Word or PNG. Select rounds, save attachments, or bundle formats in one ZIP.

## Description

DeepSeek Export Plus saves conversations from the DeepSeek desktop website for local reading, note editing and personal archiving. It works with regular chat pages and shared conversations. Export the entire conversation or choose individual rounds while retaining their original numbers.

Choose Markdown for editable notes, HTML for browser reading, TXT for plain text, JSON for structured processing, Word for editable text and tables, or PNG for a readable conversation image. Word formulas are images with LaTeX alternative text. Long PNG exports are split into numbered images. Select several formats to download one ZIP. The export shares a single set of attachments across formats instead of downloading each file repeatedly.

Code blocks, tables, user and DeepSeek labels, and available source links are preserved. Thinking and tool records are off by default. When enabled, available thinking, searches and opened-page records are included in their recoverable order. HTML uses blockquotes for thinking and native MathML for formulas, without loading external scripts or fonts.

Images and document attachments can be saved with the conversation or selected in the separate attachment window. One attachment downloads directly; multiple attachments are bundled into one ZIP. Uploaded images use the previews provided by DeepSeek, which are not guaranteed to be the original uploaded files. Failed downloads are recorded in the attachment manifest.

Document conversion and ZIP creation run locally in your browser. There are no export-count fees, ads or telemetry. The extension reads the current conversation, its URL and selected attachments. Only after explicit consent on a separate disclosure page, it temporarily holds relevant history responses naturally received by the page in local memory from page load, potentially before the export dialog opens. The maintainer does not receive these conversations. Shared content and files are requested from DeepSeek, and saving remote images may contact their original hosts. Only consent state and format preferences are stored persistently. Before consent, no conversation is read or retained. Revocation stops processing and clears cached history and temporary PDF previews. PDF keeps the local preview and browser print/save workflow and is not included in format bundles.

Requires a Chromium-based desktop browser, version 120 or later. The interface is currently in Simplified Chinese. Website changes, account-specific layouts and expired file links can affect results. The extension cannot recover data the website does not provide. JSON is an extension-specific archive format, not an importable DeepSeek backup.

This independent community project builds on sati0121/DeepSeek-Exporter under the MIT license, with upstream attribution retained. It is not affiliated with or endorsed by DeepSeek. Source code, installation instructions and support are available on the project website.

## Single purpose

Export the user's current DeepSeek web conversation and selected attachments to local files for reading, note editing and personal archiving.

## Links

- Website: https://github.com/xiaohei07/DeepSeek-Export-Plus
- Support: https://github.com/xiaohei07/DeepSeek-Export-Plus/issues
- Privacy policy: https://github.com/xiaohei07/DeepSeek-Export-Plus/blob/main/docs/PRIVACY.md
- Support email: lazy07xiaohei@gmail.com
- Publisher: 07xiaohei

The manifest contains a fixed Chinese name and short description. Edge may display these as read-only fields. Do not rename the published ZIP manually to claim English UI support; this English text can be used for editable listing fields and reviewer notes.

Attachment limits: some Excel files are downloadable in the original chat but unavailable from the share page (HTTP 404). Export those files from the original chat. Word attachment links point to the adjacent assets folder; extract the full ZIP before opening the document.
