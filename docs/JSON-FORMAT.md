# JSON导出格式

适用于2.2.0及后续兼容版本，当前`schemaVersion`为`1`。这是为了本地存档和后续处理提供的格式，不是DeepSeek官方备份，也不提供导入功能。正文继续使用Markdown，避免把代码和公式压成难以恢复的纯文本。

```json
{
  "schemaVersion": 1,
  "title": "DeepSeek 对话记录",
  "sourceUrl": "https://chat.deepseek.com/share/example",
  "exportedAt": "2026-10-23T12:30:05Z",
  "includesThinking": false,
  "warnings": [],
  "rounds": [
    {
      "number": 2,
      "messages": [
        {
          "role": "user",
          "name": "用户",
          "contentMarkdown": "请解释这个例子。",
          "attachments": []
        },
        {
          "role": "assistant",
          "name": "DeepSeek",
          "contentMarkdown": "这是回答正文。",
          "attachments": []
        }
      ]
    }
  ]
}
```

`number`是原对话中的轮号，局部导出不会重新编号。`exportedAt`使用UTC，精确到秒；下载文件名使用电脑本地时间。share正文标题固定为“DeepSeek 对话记录”，chat使用导出窗口里的标题。

勾选思考后，DeepSeek消息增加`reasoning`数组，按可恢复的原顺序记录两类片段：

- `kind: "thinking"`：`contentMarkdown`为思考文字。
- `kind: "tool"`：包含`type`、`label`、`status`、`queries`、`sources`及`content`。`sources`只记录`title`和`url`，未取得的值为空字符串或空数组。

没有勾选思考时，整个`reasoning`字段省略。不会导出页面的React对象、请求头、账号内部状态或未知字段；正文中本来就有的信息仍按原文保存。

附件包含`name`、`isImage`、`imagePreview`，有大小记录时包含`size`（网页记录的字节数，不保证等于预览图大小）。保存到ZIP后使用`path`，值为经过URL编码的相对路径，例如`assets/001-%E5%9B%BE%20%231.png`；脚本访问本地文件前用`decodeURIComponent`解码一次。未下载的附件使用`url`，地址可能带临时签名并可能过期。读取失败时增加`error`；实际保存字节数见ZIP里的`附件清单.json`。

顶层`warnings`记录导出时发现的缺失或失败。拿到JSON并不代表原网页的全部历史、工具或文件都已取到，需结合提示检查。
