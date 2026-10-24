# 首次上架：需要维护者完成的事情

核对日期：2026-10-24。本页对应正式版2.3.0，使用者已确认导出与Word附件链接正常。文案、包结构和浏览器功能已检查，Chrome与Edge商店都还没有提交。

## 已确认和仍缺的资料

| 项目 | 当前资料或需要做的事 |
| --- | --- |
| 发布者名称 | **07xiaohei**；GitHub账号为xiaohei07，两个拼写用途不同 |
| 公开支持邮箱 | **lazy07xiaohei@gmail.com**；请确认能收信，并完成商店发送的验证邮件 |
| 发布身份 | **个人**；Edge注册选择Individual。Chrome的Trader声明与个人/公司不是同一道题 |
| 账号 | 由本人选择长期维护的Google账号及个人Microsoft账号；不要求与GitHub登录邮箱相同 |
| 国家/地区与联系资料 | 在两家后台按真实情况填写；真实姓名、电话、地址和可能要求的证件直接交给官方后台，不提交到仓库 |
| 图标依据 | 维护者已确认查询后可以使用，本版继续保留；确认范围见[图像说明](../ASSETS.md) |
| 审核示例 | 建议新建一段不含私人信息的短对话并生成分享链接。按[审核说明](REVIEWER-NOTES.md)提供的内容即可；在未登录窗口确认能否打开 |
| 展示与分发 | 首发建议简体中文、免费、公开可搜索；可编辑的英文介绍已备好，界面仍是中文。具体地区由维护者选择 |

**接下来使用2.3.0安装包建立商店条目，并准备可公开用于审核的分享链接。**14种后缀的本地附件与[逐轮提示词](TEST-CONVERSATION.md)已准备，可在一段对话中分两批上传。维护者已实测确认Word和PNG导出成功，两种格式均保留。

## Chrome：本人完成注册与账号设置

1. 使用准备长期维护的Google账号打开[Chrome开发者后台](https://chrome.google.com/webstore/devconsole)。注册时阅读并接受协议，完成一次性注册费支付；金额和可用支付方式以当前付款页为准。[注册说明](https://developer.chrome.com/docs/webstore/register)
2. 开启Google账号的**两步验证**，完成发布者名称和联系邮箱验证。登录邮箱与公开支持邮箱可以用途不同；不要把临时邮箱当长期维护账号。[两步验证要求](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification)、[账号设置](https://developer.chrome.com/docs/webstore/set-up-account)
3. 完成**Trader / Non-Trader声明**。这是依据发布活动是否属于职业或经营活动作出的声明，不能仅凭“个人、免费、开源”替你判定。若选Trader，需按后台核验姓名、地址和电话等资料，并留意其公开展示范围。[官方说明](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq)
4. 新建条目，上传安装ZIP；填写介绍、图片、隐私与分发字段，见[逐字段填写表](FORM-FIELDS.md)。首次先保存草稿，检查无缺项后再提交审核。若后台提供审核后手动发布，可按自己的发布时间选择。

无需为手动上架申请Chrome Web Store API、OAuth密钥或自动发布服务。首次上架可沿用已确认发布的2.x版本，不必改为1.0；本轮使用2.3.0；后续修改已上传的扩展包时，版本号需要递增。

## Edge：本人注册Microsoft Edge项目

1. 用个人Microsoft账号（MSA）打开[Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview)，注册**Microsoft Edge**项目，选择Individual。若只看到其他产品，进入账号设置的Programs查找Microsoft Edge。[注册说明](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)
2. 填写国家/地区、发布者名称和联系信息，接受开发者协议，完成邮件及后台要求的账号验证。地区和个人/公司类型注册后不能随意修改，提交前核对。工作或学校账号不能直接作为该项目的注册主账号。
3. **Edge扩展开发者注册不收注册费。**它与Microsoft Store的其他开发者项目不是同一个注册入口；若出现不相符的收费页，先核对所选项目。
4. 新建扩展，上传安装ZIP，依次填写可用地区、属性、隐私和商店介绍。粘贴审核说明后提交；商店通过后会按其发布流程上线。[官方发布流程](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)

## 提交前做一次自己的浏览器检查

- 在Chrome和Edge分别加载拟提交的安装包，打开一段自己的chat及其share。
- 逐一保存Markdown、HTML、TXT、JSON、Word、PNG，再多选格式保存ZIP；解压打开HTML，核对图片和公式。
- 保持思考关闭导出一次，再勾选导出一次，确认范围符合预期。
- 附件选1个直接下载、选多个ZIP；PDF按钮能打开预览并保存。
- 检查页面入口没有挡住上传、发送和下降按钮。

开发侧已通过56项单元测试、96组输入框布局、9组弹窗检查，并在Chromium156.0.8078.4与Microsoft Edge155.0.4283.62中验证同意控制、Word、PNG、六格式ZIP和PDF流程。另回放了使用者新建的6轮真实分享，修复公式图片解码和预览附件文件名问题；该分享的XLSX返回404，原chat可用，已记录边界。测试使用隔离配置，没有读取个人浏览器账号，不能替代更多灰度页面的检查。Word样例已用本机Microsoft Word渲染查看，详见[验证记录](../VALIDATION.md)。

## 数据处理与审核边界

2.3.0已加入独立同意页，批准前不读取或缓存，拒绝不影响DeepSeek，撤回后清理缓存和临时PDF。它补充了产品内的说明与选择，**不代表商店已经审核通过**。提交时要使用与这套声明一致、且经实测确认的安装包；不要用2.3.0的说明描述旧的2.2.0行为。[披露要求](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements)、[用户数据FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)

## 不需要额外准备的东西

当前可以使用GitHub作为项目主页、问题反馈与公开隐私说明地址，不要求为了这个插件另买域名或服务器。无需API密钥、DeepSeek付费订阅、支付给用户的结算账号或税务资料来启用插件功能。若官方账号验证要求其他材料，则按该账号的真实情况提供。宣传视频和大幅宣传图是可选材料，不影响先整理基本条目。

提交后保留两家商店分配的扩展ID、条目链接和审核通知。不要为重试同一扩展反复新建条目；后续更新原条目即可。只有确实上架后，才把商店安装链接加入README。登录、付款、验证与最终提交均由维护者在对应官方后台完成。
