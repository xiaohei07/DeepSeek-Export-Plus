# DeepSeek Export Plus 2.1.1

适用于Chrome、Edge等Chromium桌面浏览器的DeepSeek网页对话导出插件，支持chat和share。基于[sati0121/DeepSeek-Exporter](https://github.com/sati0121/DeepSeek-Exporter)独立维护，保留原作者署名及MIT许可。

- 修复导出工具栏挤动发送按钮、挡住网页下降按钮的问题。宽窗口放在上传按钮左侧，窄窗口放在输入框内的独立一行，缩放后重新定位；没有输入区时使用对话顶部工具栏。
- share正文统一使用“DeepSeek 对话记录”，文件名前缀可单独修改。chat保留可编辑标题。
- 对话MD、ZIP、PDF建议保存名及附件ZIP加入本地导出时间，精确到秒，方便区分重复导出。
- 附件窗口选1个直接下载，选多个打包为一个ZIP；单文件失败直接提示原因，不生成空壳压缩包。
- 修复过长附件名丢失扩展名、合法空文件被拒绝的问题。思考仍默认关闭，图片仍明确标记为网页预览版。

本地安装可解压`DeepSeek-Export-Plus-2.1.1.zip`，在Chrome或Edge扩展管理页加载直接含有`manifest.json`的目录；也可执行`npm ci`、`npm run build`后加载`dist`。更新时先重新加载扩展，再刷新DeepSeek页面。要求Chromium120及以上。

验证覆盖39项单元测试、32组布局组合、实际扩展浏览器集成，以及6轮真实分享捕获与7附件回放。单个附件及ZIP的内容均逐字节一致，PDF正文标题、图片和文本边界通过检查。当前登录chat账号未直接实测，网页未返回的工具内容仍无法恢复。详细范围见[验证记录](https://github.com/xiaohei07/DeepSeek-Export-Plus/blob/main/docs/VALIDATION.md)。
