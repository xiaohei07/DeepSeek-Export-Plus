# 图像说明

小肥鱼图标用于插件图标、页面入口和导出窗口。用户提供了本地角色参考图，并授权直接使用或生成Q版形象。本项目选择用内置imagegen工具生成独立插画，再缩放为浏览器需要的16、32、48、128和256像素PNG。

参考图用于蓝发、头饰、侧鳍和服装等角色特征，没有把参考图上的文字或整张表情包放进发行包。生成图保存在`docs/images/mascot-source.png`，实际使用的尺寸位于`public/icons/`。它不是DeepSeek官方商标；代码的MIT授权不代表对既有角色形象另行主张排他权利。

生成提示词（内置imagegen，2026-10-23）：

> Create one polished chibi mascot icon for DeepSeek Export Plus, based on the supplied Xiao Fei Yu character reference. Reference role: visual character traits only, not an edit target. Square composition, transparent background. Head and upper torso, friendly smile, blue long hair with a single curved ahoge, little fin-like side ears, blue eyes, small white maid headband, navy and white outfit. She holds a small plain document with a subtle download arrow. Extremely clear readable silhouette at 48px, crisp dark blue outlines, restrained cel shading, generous transparent padding. No text, no lettering, no watermark, no hearts. Keep character charming and composed, not noisy. Use case: illustration-story / browser extension mascot.

README中的界面图片来自隔离浏览器实际加载插件后的截图，安装流程图为SVG操作示意，并非浏览器设置页面截图。
