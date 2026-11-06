# Loon 插件仓库

这个仓库用于保存个人维护的 Loon 插件和相关脚本。

## 插件列表

| 图标 | 插件 | 原始链接 | 一键导入 |
| --- | --- | --- | --- |
| <img src="https://raw.githubusercontent.com/zwjtano/icons/main/icons/bilibili.png" width="42" height="42" /> | 哔哩哔哩自定义插件 | [原始文件](https://raw.githubusercontent.com/zwjtano/loon-/master/Plugins/bilibili.lpx) | [导入 Loon](https://zwjtano.github.io/loon-/import/bilibili.html) |
| <img src="https://raw.githubusercontent.com/zwjtano/icons/main/icons/bilibili.png" width="42" height="42" /> | 哔哩哔哩 + Global（整合测试版） | [原始文件](https://raw.githubusercontent.com/zwjtano/loon-/master/Plugins/bilibili-global.lpx) | 在 Loon 中添加左侧原始链接 |

## 插件功能

### 哔哩哔哩自定义插件

基于上游哔哩哔哩 Loon 插件进行个人化整理，保留常用净化能力，并增加了搜索页和首页的自定义开关。

上游作者：[RuCu6](https://github.com/RuCu6)、[kokoryh](https://github.com/kokoryh)、[可莉](https://gitlab.com/lodepuly/vpn_tool)。上游地址：[https://rucu6.pages.dev/Plugins/bilibili.lpx](https://rucu6.pages.dev/Plugins/bilibili.lpx)。

- 过滤热搜、热门话题和搜索建议
- 热门页广告和上游识别的 UP 推荐卡始终过滤，不再随热搜开关一起关闭（按上游删除对应卡片，并非只隐藏关注按钮）
- 屏蔽默认搜索框关键词
- 支持自定义首页顶部频道标签
- 支持隐藏首页游戏中心、底部发布、会员购等入口
- 支持精简动态页、观影页、我的页面和首页推荐流
- 独立开关「过滤直播推荐」，默认开启，仅移除首页推荐流里的直播卡片，不影响关注页和进入直播间；核心版与 Global 整合版均支持
- 上游更新时会自动重新套用本地自定义开关和脚本规则

## 使用提示

### Global 整合测试版

整合 [Biliverse Global](https://github.com/Biliverse/Global) 的地区识别、地区线路、全区搜索、CDN 类型和 BoxJS 设置。核心净化版 `Plugins/bilibili.lpx` 保持不变。整合前备份标签为 `backup-before-global-integration-2026-11-06`，提交为 `c14a201`。

1. 停用原来的净化插件和独立 Global 插件，只启用 `bilibili-global.lpx`，避免同一响应被多份配置竞争。
2. 在整合版设置中填写实际存在的大陆、香港、澳门、台湾节点或策略组名称；默认地区为 `CHN,HKG,TWN`。
3. 默认使用插件参数；如需沿用已有 BoxJS 配置，选择 Global 配置来源 `PersistentStore`。设置优先级继续遵守 Global 上游实现。
4. 整合版的 Global 开关可以独立关闭，关闭后仍保留去广告。配置不是自动从另一个插件迁移的，需检查各净化开关。

视频详情响应在一个脚本中依次完成 Global 处理和上游去广告。Global 请求阶段直接返回的响应也先净化再返回。番剧季信息的付款字段清理在 Global 之后执行，避免 Rewrite 抢先禁用响应脚本。整合版允许 Global 上游支持的备用 API 域名，未沿用核心版对这四个备用域名的拒绝规则。

Global 使用官方最新 Release 构建，下载资源经 GitHub 提供的 SHA256 摘要校验；确切版本和来源见 `Scripts/bilibili/global-integration.sources.json`。仅将 Global 的参数访问隔离至各处理阶段，未重写其地区识别和线路选择算法。许可证及修改说明见 `third_party/biliverse-global/`。

本地测试覆盖地区选择、跨区搜索、配置复用、压缩数据、广告清理及私有抓包回放，但没有代替手机实测，也未实际验证地区代理的连通性或受限番剧播放。地区策略组不存在或不可用时，Global 功能不会凭空生效。

### 核心净化版

- 点击表格里的“导入 Loon”可以跳转到 Loon 导入插件
- 如果跳转页不可用，可以打开“原始文件”复制链接，再在 Loon 里手动添加
- 需要 Rewrite 生效的功能，请在 Loon 中配置并信任 MitM 证书
- 同时使用 BiliBili.Global 等插件时，同一接口只能执行第一条命中的响应脚本。若视频详情请求仅执行 `BiliBili.Global.viewunite.v1.View.grpc`，本插件的去广告脚本就不会执行。可临时停用 Global 的该条响应脚本（不是同名请求脚本），验证冲突；这会停用 Global 对该接口的响应增强。本插件无法替你改变手机上其他插件的优先级。

## 维护说明

哔哩哔哩插件已配置 GitHub Actions 自动更新，每 30 分钟检查一次上游（计划在每小时第 7、37 分钟运行，GitHub 调度可能延迟）。有变化时自动提交，没有变化时不提交。同步后会重新套用本地自定义开关和脚本规则，并通过配置回归测试后再发布；检查失败时保留仓库原版本。

插件的 `#!date` 使用本仓库实际准备发布时的北京时间，不再沿用上游日期。插件配置或相关脚本有变化时刷新日期，无变化的定时检查保留原日期；仅 Global 内置脚本变化时不刷新核心版日期。手动生成插件后、通过 API 发布前，运行 `node tools/prepare-bilibili-release.cjs`；仅修正发布日期可添加 `--force`。

同一次自动同步也会生成独立 Global 整合测试版，更新 Global 官方 Release 和上游净化脚本，并运行整合回归测试。核心版和整合版共享的自定义脚本仍会保留。可手动生成整合版：

```powershell
pwsh -NoProfile -File tools/update-bilibili-global.ps1
node --test tests/bilibili-global.test.cjs
```

仓库自动同步不等于手机已更新，Loon 仍需更新插件和远程脚本。热门页使用自动生成的 `popular.js`：保留上游过滤，只将 `topicList` 的移除交给热搜开关；上游结构变化时停止发布，等待重新适配。播放器与弹幕沿用上游脚本，不包含此前已回退的本地兼容实验。如果需要手动更新，可以运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\update-bilibili.ps1
```

上游地址：`https://rucu6.pages.dev/Plugins/bilibili.lpx`
