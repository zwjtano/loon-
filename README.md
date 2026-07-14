# Loon 插件仓库

这个仓库用于保存个人维护的 Loon 插件和相关脚本。

## 插件列表

| 图标 | 插件 | 原始链接 | 一键导入 |
| --- | --- | --- | --- |
| <img src="https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/00/a2/9a/00a29a65-e92e-52da-15d5-c13b1c83fe2e/AppIcon-0-1x_U007epad-0-11-0-85-220-0.png/100x100bb.jpg" width="42" height="42" /> | FotMob 去广告 | [原始文件](https://raw.githubusercontent.com/zwjtano/loon-/master/Plugins/FotMob_remove_ads.lpx) | [导入 Loon](https://zwjtano.github.io/loon-/import/fotmob.html) |
| <img src="https://raw.githubusercontent.com/zwjtano/icons/main/icons/bilibili.png" width="42" height="42" /> | 哔哩哔哩自定义插件 | [原始文件](https://raw.githubusercontent.com/zwjtano/loon-/master/Plugins/bilibili.lpx) | [导入 Loon](https://zwjtano.github.io/loon-/import/bilibili.html) |
| 🍿️ | DualSubs Universal 大模型翻译版 | [原始文件](https://raw.githubusercontent.com/zwjtano/loon-/master/Plugins/DualSubs.Universal.LLM.plugin) | 在 Loon 中添加原始文件地址 |

## 插件功能

### FotMob 去广告

用于净化 FotMob 的信息流和比赛页广告，主要处理首页横幅、信息流大图广告、房子广告和常见广告 SDK 请求。

- 拦截 FotMob 自有广告图片与广告配置
- 拦截 Google Ads、Amazon Ads、Moloco、Vungle、Nimbus 等广告请求
- 通过 Rewrite 处理部分广告接口响应
- 保留比赛数据、球队 Logo、赛程等正常内容

### 哔哩哔哩自定义插件

基于上游哔哩哔哩 Loon 插件进行个人化整理，保留常用净化能力，并增加了搜索页和首页的自定义开关。

上游作者：[RuCu6](https://github.com/RuCu6)、[kokoryh](https://github.com/kokoryh)、[可莉](https://gitlab.com/lodepuly/vpn_tool)。上游地址：[https://rucu6.pages.dev/Plugins/bilibili.lpx](https://rucu6.pages.dev/Plugins/bilibili.lpx)。

- 过滤热搜、热门话题和搜索建议
- 可单独隐藏热门页 UP 推荐卡的关注按钮
- 屏蔽默认搜索框关键词
- 支持自定义首页顶部频道标签
- 支持隐藏首页游戏中心、底部发布、会员购等入口
- 支持精简动态页、观影页、我的页面和首页推荐流
- 上游更新时会自动重新套用本地自定义开关和脚本规则

### DualSubs Universal 大模型翻译版

基于 DualSubs Universal 1.7.5，将翻译字幕引擎扩展为 OpenAI 兼容的 Chat Completions API，同时保留 Google 和 Microsoft 翻译选项。

- 支持自定义 API 地址、模型名称、API Key、温度、超时和附加请求头
- 可用于 OpenAI、OpenRouter、硅基流动、Ollama，以及提供兼容接口的其他服务
- 按 40 条字幕分批，并用带编号的 JSON 输入输出校验防止漏行、乱序
- 支持原插件已有的 VTT、XML、JSON、YouTube/Spotify Protobuf 等字幕处理链路
- 调试日志会隐藏 API Key；请勿分享填写过密钥的插件配置导出文件

安装后在插件设置中选择 `LLM`，填写 `API 地址`、`模型名称` 和 `API Key`。API 地址可以是完整的 `/v1/chat/completions` 地址，也可以是以 `/v1` 结尾的基础地址。

上游升级后可重新生成适配文件：

```bash
node tools/build-dualsubs-llm.mjs
```

## 使用提示

- 点击表格里的“导入 Loon”可以跳转到 Loon 导入插件
- 如果跳转页不可用，可以打开“原始文件”复制链接，再在 Loon 里手动添加
- 需要 Rewrite 生效的功能，请在 Loon 中配置并信任 MitM 证书

## 维护说明

哔哩哔哩插件已配置 GitHub Actions 自动更新，每天北京时间 10:30 从上游同步一次，并会重新套用本地自定义开关和脚本规则。如果需要手动更新，可以运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\update-bilibili.ps1
```

上游地址：`https://rucu6.pages.dev/Plugins/bilibili.lpx`
