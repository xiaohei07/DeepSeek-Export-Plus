# 来源与依赖

本项目基于 [sati0121/DeepSeek-Exporter](https://github.com/sati0121/DeepSeek-Exporter)，保留原有 MIT License 与 `Copyright (c) 2026 sati0121`。后续修改由07xiaohei维护，以DeepSeek Export Plus独立发布。

运行时使用以下开源库，完整许可证随构建复制到 `dist/licenses/`：

| 库 | 用途 | 许可证 |
| --- | --- | --- |
| Turndown | HTML 转 Markdown，保留空白、列表和行内格式 | MIT |
| turndown-plugin-gfm | 表格、任务列表、删除线 | MIT |
| Marked | Markdown 分块与 PDF 预览渲染 | MIT |
| DOMPurify | 清理打印内容中的不安全 HTML | Apache-2.0 OR MPL-2.0 |
| KaTeX | PDF 预览中的数学公式及本地字体 | MIT |
| fflate | 将对话、图片与附件打包为 ZIP | MIT |

调研了 [ShaoqiLiang/DeepSeek-Exporter](https://github.com/ShaoqiLiang/DeepSeek-Exporter) README 中的 React 数据提取、角色识别与长对话滚动方案。该项目为 AGPL-3.0；当前实现未复制其代码，继续使用原项目 MIT 许可。

分享接口与 DOM 选择器依据 DeepSeek 公开页面及其前端脚本（commit `ed5773f3`）观察所得，不是官方承诺的稳定接口。失效时应调整适配器，不能声称永久兼容任意未来页面版本。
