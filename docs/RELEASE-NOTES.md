# DeepSeek Export Plus 2.1.2 · 稳定版

适用于Chrome、Edge等Chromium桌面浏览器的DeepSeek网页对话导出插件，支持chat和share。基于[sati0121/DeepSeek-Exporter](https://github.com/sati0121/DeepSeek-Exporter)独立维护，保留原作者署名及MIT许可。

- 导出入口移到输入框底部控件行的中间，与原生按钮保持垂直居中，不再增加一行或撑高输入框。
- 按原生按钮的实际位置寻找空位，兼容Flex、Grid和占满剩余宽度的容器，避免依赖某种网页包装结构。
- 窄窗口使用输入框侧边的小肥鱼与附件图标；没有安全空位或没有输入区时回退到对话内容顶部。
- 输入框高度变化、滚动、窗口缩放、异步加载和刷新后同步定位；保留上传、发送及下降按钮的位置和点击功能。
- 更新安装截图与README，布局测试扩展为96组。思考默认关闭、秒级文件名、固定分享标题及单文件直下/多文件ZIP等功能继续保留。

本地安装可解压`DeepSeek-Export-Plus-2.1.2.zip`，在Chrome或Edge扩展管理页加载直接含有`manifest.json`的目录；也可执行`npm ci`、`npm run build`后加载`dist`。更新时先重新加载扩展，再刷新DeepSeek页面。要求Chromium120及以上。

本版验证覆盖39项单元测试、96组布局组合和实际扩展浏览器集成，另检查侧边入口、contenteditable输入框、高度变化及极窄窗口回退。使用者已确认实际页面的按钮位置正常。自动化运行于隔离页面，不能据此保证所有账号灰度布局和未来网页版本都兼容；网页未返回的工具内容仍无法恢复。详细范围见[验证记录](https://github.com/xiaohei07/DeepSeek-Export-Plus/blob/main/docs/VALIDATION.md)。
