# Chrome与Edge上架材料

对应2.2.0正式版本，2026-10-24按官方文档复核。GitHub版本已经发布，两家浏览器商店尚未提交。发布者为**07xiaohei**，公开支持邮箱为**lazy07xiaohei@gmail.com**，以个人身份发布。

**账号注册和条目草稿可以开始；正式提交前先处理现有图标的使用依据，并完成审核示例与数据披露检查。**具体事项集中在下面三份文件中，避免在不同说明里反复填同一套资料。

## 从这里开始

| 文件 | 用途 |
| --- | --- |
| [维护者上架清单](OWNER-CHECKLIST.md) | 已确认信息、还缺什么、两家账号注册及本人操作顺序 |
| [逐字段填写表](FORM-FIELDS.md) | 名称、链接、权限说明、数据类别、图片与搜索词 |
| [审核说明](REVIEWER-NOTES.md) | 创建安全示例的步骤，以及可粘贴的英文审核备注 |
| [中文介绍](LISTING.zh-CN.md)、[英文介绍](LISTING.en.md) | 商店详细介绍与单一用途；英文文案不表示英文界面已实现 |
| [隐私说明](../PRIVACY.md)、[隐私HTML](privacy.html) | 数据范围、网络请求、保存期限、有限使用及联系邮箱 |
| [图像来源](../ASSETS.md) | 现有角色来源与仍需解决的授权问题 |

公开隐私地址已经存在，可填写：

https://github.com/xiaohei07/DeepSeek-Export-Plus/blob/main/docs/PRIVACY.md

使用前在未登录窗口确认能访问。材料包里的privacy.html是静态备份，不是已部署的网站，也不能把电脑上的文件路径填入商店URL栏。当前不需要另买域名或服务器。

## 安装包与素材

上传扩展功能包时选GitHub发行页中的`DeepSeek-Export-Plus-2.2.0.zip`，其根目录直接包含manifest.json。源码ZIP和`store-materials.zip`用途不同，不要上传到扩展包栏。两家可使用同一个符合要求的功能包；若替换内部图标或修改行为，需重新构建并递增版本，不覆盖已有GitHub发行附件。

当前已有5张1280×800截图，以及128×128、256×256图标。截图来自真实扩展运行的缩减演示，不含私人账号与原始附件；模拟页面地址不能作为审核入口。按格式选择、HTML阅读、附件的顺序上传。角色图标更换时，截图也一起更新。

Chrome需要商店图标与至少一张截图；Edge图标最低128×128、推荐300×300。440×280及1400×560宣传图、视频均可后补，本次没有制作。[Chrome图片要求](https://developer.chrome.com/docs/webstore/images)、[Edge字段说明](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)

## 这次补齐的内容

- 加入已确认的发布者、公开邮箱与个人身份，给出逐字段填写内容。
- 明确本地处理也需披露，以及页面加载即缓存历史响应的行为；隐私说明补充有限使用声明。
- 提供审核用示例的准备方法和英文操作步骤，不使用带私人附件的旧对话。
- 记录角色二创来源不明这一实际缺口，避免把生成插画误写成授权已经齐全。
- 补充Microsoft Edge155.0.4283.62的隔离扩展集成：chat/share、MD/PDF、附件及四格式下载、ZIP和离线HTML均通过；没有操作个人登录浏览器。

## 生成资料包

在项目根目录运行：

```bash
npm run prepare:store
```

生成`output/DeepSeek-Export-Plus-2.2.0-store-materials.zip`，包含本目录文案与图片、隐私说明、图像来源及依赖说明。解压后先读根目录README.md。脚本不会上传或提交商店，也不会把开发者证件和账号凭据打包。

## 官方依据

- Chrome：[注册](https://developer.chrome.com/docs/webstore/register)、[账号设置](https://developer.chrome.com/docs/webstore/set-up-account)、[两步验证](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification)、[Trader声明](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq)、[发布](https://developer.chrome.com/docs/webstore/publish)、[隐私字段](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)。
- 数据处理：[本地处理也需披露](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)、[披露与同意](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements)、[有限使用](https://developer.chrome.com/docs/webstore/program-policies/limited-use)。
- Edge：[开发者注册](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)、[发布流程](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)。

账号后台未实际登录，具体付款金额、身份核验字段、市场列表与审核结果以账号当时显示为准。填写完成不等于已经通过商店审核。
