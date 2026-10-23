# DeepSeek Export Plus 2.2.0 · 多格式导出

适用于Chrome、Edge等Chromium桌面浏览器的DeepSeek网页对话导出插件，支持chat与share。基于[sati0121/DeepSeek-Exporter](https://github.com/sati0121/DeepSeek-Exporter)独立维护，保留原作者署名和MIT许可。

- 新增HTML、TXT和JSON，与Markdown共用轮次选择、思考开关和附件处理。单选一种格式直接下载文档，多选生成一个ZIP，附件只保存一份。
- HTML可解压后直接用浏览器阅读，保留代码、表格、思考引用和MathML公式，不加载外部脚本或字体；补充常见标题锚点及重复标题处理。
- TXT保留代码原文、列表、表格内容与来源地址。JSON按明确的字段组织轮次、正文、附件和可选思考，不直接导出页面内部对象，也不能导回DeepSeek。
- 格式偏好会记住，思考仍每次默认关闭。先导出思考、再取消勾选时，各格式都会移除对应内容。
- 修复含空格、`#`或`%`的附件名在离线文档中的链接；调整窄窗口主按钮，并修复较高窗口下PDF等底部操作按钮被裁掉的问题。
- 原有PDF打印预览保留，不新增直接PDF、PNG长图或Word生成。单附件直接下载、多附件ZIP及网页预览图说明继续保留。
- 更新README、JSON字段说明、隐私说明及Chrome/Edge商店材料。商店尚未提交审核。

安装请选择`DeepSeek-Export-Plus-2.2.0.zip`，解压后在Chrome或Edge扩展管理页加载直接含有`manifest.json`的目录；也可执行`npm ci`、`npm run build`后加载`dist`。更新时先重新加载扩展，再刷新DeepSeek。要求Chromium120及以上。v2.1.2原标签和安装包继续保留，供需要时回退。

验证覆盖46项单元测试、chat/share实际扩展集成、四格式下载与离线HTML、96组输入区布局，以及9组弹窗高度和浏览器缩放检查。使用者已确认PDF入口及其他导出功能正常。自动化使用隔离页面，不能据此保证所有账号灰度界面、未来网页版本和工具类型都兼容；Edge正式版未单独人工验证。详情见[验证记录](https://github.com/xiaohei07/DeepSeek-Export-Plus/blob/main/docs/VALIDATION.md)。
