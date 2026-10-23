# DeepSeek Export Plus 2.1.0

适用于Chrome、Edge等Chromium桌面浏览器的DeepSeek网页对话导出插件，支持chat和share。基于[sati0121/DeepSeek-Exporter](https://github.com/sati0121/DeepSeek-Exporter)独立维护，保留原作者署名及MIT许可。

这一版主要处理chat工具缺失、工具顺序、长对话读取和附件下载：

- 思考默认关闭，勾选后才补读思考和工具；Markdown、复制和PDF使用同一个选项。
- 补充分散存储的搜索及打开网页分组，按可确认的位置插在思考之间；保留仅正文导出时可取得的来源。
- 已全部挂载的消息不再逐屏重复扫描，长对话进度显示当前阶段。
- 刷新或输入区稍后加载时重新定位按钮，没有输入区时优先与正文列对齐。
- 所选附件合为一个ZIP，只发起一次下载；失败项写入清单，成功项照常保存。移除废弃逐文件下载及下载记录权限。
- 修正历史替换响应残留旧消息的问题，整理说明文档、版本来源和界面截图。

下载`DeepSeek-Export-Plus-2.1.0.zip`并解压，在Chrome或Edge扩展管理页开启开发者模式，加载直接含有`manifest.json`的目录，再刷新DeepSeek。已安装用户先重新加载扩展，再刷新对话页。要求Chromium120及以上；本地编译执行`npm ci`、`npm run build`后加载`dist`。

35项单元测试、隔离浏览器集成、6轮真实分享数据及7个附件回放通过。仅正文与含思考PDF均检查了页面和图片。当前登录chat账号未直接实测，未返回的工具内容仍无法恢复，详见[验证记录](https://github.com/xiaohei07/DeepSeek-Export-Plus/blob/v2.1.0/docs/VALIDATION.md)。
