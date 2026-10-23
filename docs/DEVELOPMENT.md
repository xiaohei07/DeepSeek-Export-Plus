# 开发说明

## 从页面到文件

`content/index.js`维护页面入口，`dialog.js`负责一次读取后的轮次选择与导出。弹窗使用Shadow DOM隔离宿主样式，主题读取网页背景，避免操作系统深色偏好覆盖网页当前主题。

数据提取由`extractor.js`协调。share优先交给`share.js`读取公开分享数据；chat按页面当前显示的分支滚动，逐条读取消息。`pageMetadata.js`只遍历单条挂载消息附近的React字段，复制允许导出的内容，不序列化整个组件或状态存储。

`historyBridge.js`在页面启动时观察已有的历史请求响应。它只接受同源`/api/v0/chat/history_messages`，只保存当前URL会话的消息字段，不读取请求体、Cookie、令牌或认证头。缓存限制为500条消息、约8MB字符串；缺失时回退到挂载数据与DOM。发起新回复、重新生成等请求时清理旧缓存，避免将旧回答用于新导出。不会为了导出额外发送认证请求。

完整的消息快照保留`THINK`、`SEARCH`、`TOOL_SEARCH`、`TOOL_OPEN`等片段顺序；DOM回退只能保留可取得的内容，调用顺序可能不完整。`conversation.js`负责标题和原轮次，`markdown.js`负责层级、代码围栏及引用块。格式化层不猜测普通句子是不是代码，不调用外部模型改写原文。

`exportBundle.js`下载并缓存选中轮次的附件，把图片链接改为相对路径或PDF内嵌数据。相同URL复用一次读取结果，二进制文件避免重复压缩。失败文件进入清单和文档提示，不以空文件表示成功。`background/index.js`负责允许来源检查、跨域附件读取、下载终态和PDF临时存储。

`print/`是独立扩展页。Marked解析Markdown，DOMPurify清理HTML，KaTeX使用随包附带的字体，浏览器负责分页和保存PDF。打印代码和字体不进入聊天页的主脚本。

## 构建与测试

Node.js24下执行`npm ci`、`npm test`、`npm run build`。构建使用esbuild，分别打包内容脚本、历史观察脚本、后台和打印页；只复制需要的资源，避免把整个源码目录再次放入安装包。

`npm run test:browser`使用Playwright的独立临时配置加载真实扩展，测试页面和网络响应使用可复现数据。首次运行先执行`npx playwright install chromium`，或设置`DSX_TEST_BROWSER`。

开发时修改代码后重新构建，在浏览器扩展管理页点击重新加载，再刷新DeepSeek。内容脚本和后台版本不一致时，旧页面可能继续使用旧代码，因此不能只刷新扩展而不刷新页面。

有本地分享捕获和对应附件时，可选运行：

```bash
node tests/replay.mjs path/to/share.json path/to/attachments
```

这些输入不随仓库分发。不要把登录信息、完整私人对话、签名下载地址或原始附件提交到Git。建议把新增复现缩减成`tests/fixtures`里的匿名数据，并注明它验证的边界。

## 发布版本

更新`package.json`与锁文件中的版本号，并同步`CHANGELOG.md`、`docs/RELEASE-NOTES.md`。版本改动进入`main`后，Release工作流会运行单元测试、构建和浏览器测试，通过后创建对应的`v版本号`发行版，附上安装ZIP与SHA-256校验值。也支持推送同名版本标签触发；标签必须与包版本一致，已有发行版的附件不会被覆盖。

GitHub自动提供的Source code是源码压缩包，不能直接当扩展加载。用户安装应选`DeepSeek-Export-Plus-版本号.zip`，自行开发再选择源码。

## 网页改版时怎么排查

先判断缺失发生在哪一层：分享返回数据、当前消息快照、DOM提取，还是文件格式化。普通搜索的类型是`SEARCH`，不能只判断`TOOL_`前缀；折叠思考为空时，需要先确定网页是否返回过内容。只有页面确实提供数据，提取器才能补齐。

调整数据结构后，用最小样例验证原问题，再运行单元测试和浏览器测试。涉及长对话时检查虚拟列表、重复消息、滚动位置恢复及切换会话；涉及下载时检查实际字节和失败提示，不能只看“下载请求已发送”。
