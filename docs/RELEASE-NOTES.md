# DeepSeek Export Plus 2.0.0

DeepSeek网页对话导出浏览器插件，基于sati0121/DeepSeek-Exporter独立维护，保留原作者署名与MIT许可。

本版支持Markdown、附件ZIP和本地PDF预览；可以全选、逐轮勾选或指定轮次范围。思考与工具记录统一放在引用块中，不额外添加斜体；补充chat普通搜索及历史消息提取。文档标题与文件名一致，导出窗口跟随页面主题，并加入小肥鱼提示。

上传图片按DeepSeek网页预览版保存，导出前会说明；文档附件按原文件读取，失败时保留原因。

下载`DeepSeek-Export-Plus-2.0.0.zip`后解压，在Chrome或Edge扩展管理页开启开发者模式，加载直接含有`manifest.json`的目录，再刷新DeepSeek。要求Chromium120及以上。也可以从源码执行`npm ci`、`npm run build`后加载`dist`。

验证包含30项单元测试、隔离浏览器中的chat/share导出，以及6轮真实分享数据、7个附件的哈希比对。用户当前登录页面未在本轮直接操作验证，具体范围见README和验证记录。网页内部结构可能变化，欢迎提供最小复现。
