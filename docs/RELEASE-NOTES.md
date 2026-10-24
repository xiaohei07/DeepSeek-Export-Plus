# DeepSeek Export Plus 2.3.0 · Word、PNG与数据处理同意控制

本版新增Word和PNG，支持Markdown、HTML、TXT、JSON、DOCX、PNG六种格式及多格式ZIP。使用者已确认Word、PNG、Word附件链接和其他导出功能正常。2.2.1开发阶段的改动统一以2.3.0正式发行，旧版v2.1.2和v2.2.0保留。

## 新功能与修复

- **Word**：保存真正的DOCX，正文、标题、代码和表格可编辑；公式保存为图片，替代文本保留LaTeX。完整解压ZIP并保留同级assets目录后，可打开中文附件链接。
- **PNG**：保存重新排版的对话，短内容直接下载，长内容分图打包。六种格式共用所选轮次、思考开关及附件，不重复下载。
- **独立同意页**：首次同意前不读取或缓存对话；拒绝不影响DeepSeek，撤回后停止读取并清理历史缓存和PDF预览。转换和打包在浏览器本地完成。
- 修复公式文字空格导致图片解码失败、思考中的控制字符导致DOCX损坏、中文及特殊字符附件路径在Word中打不开的问题。TXT显示可读路径；JSON保留浏览器用的path并增加文件系统用的localPath。
- 扩展更新或重新加载后，旧页面提示刷新，停止旧任务；无输入框时入口固定在左侧，避开share页头，原生分享弹窗打开时暂时隐藏。
- 打印预览页按原文件名下载附件；PDF继续使用浏览器打印另存，不直接生成或放入多格式ZIP。
- 更新README、隐私说明、Chrome/Edge商店文案、权限与数据披露字段，并附14个虚构测试附件和审核提示词。

## 安装与上架资料

安装选择`DeepSeek-Export-Plus-2.3.0.zip`，解压后在Chrome或Edge扩展管理页面加载直接含有manifest.json的目录。更新时重新加载扩展，再刷新DeepSeek页面。也可下载源码，执行`npm ci`、`npm run build`后加载dist。要求Chromium120及以上。

`DeepSeek-Export-Plus-2.3.0-store-materials.zip`用于商店填写与审核准备，不能作为扩展功能包上传。商店尚未提交或上架；账号注册、身份验证、审核分享链接及最终提交由维护者在官方后台完成。

## 验证与边界

56项单元测试、十套浏览器回归覆盖导出、隐私控制、离线附件、布局和扩展重载；新增功能在Chromium与Edge中验证。含思考的真实DOCX已用Microsoft Word打开，中文附件链接也实际跟随成功。详细范围见仓库docs/VALIDATION.md。

部分XLSX在原chat可下载，分享页本身无法打开并返回404，应从原chat取得。图片可能是DeepSeek提供的预览版；Word公式不是可编辑的Office公式，GIF在Word/PNG中为静态图。已保存PDF里的在线附件链接仍可能下载为file，需要按链接文字改名。网页未返回的内容无法恢复，所有账号灰度和Word/WPS版本未逐一验证。

保留上游sati0121/DeepSeek-Exporter署名、MIT许可和GPT贡献说明。
