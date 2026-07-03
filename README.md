# Loon 插件仓库

这个仓库用于保存个人维护的 Loon 插件和相关脚本。

## 插件列表

### FotMob 去广告

[![一键添加到 Loon](https://img.shields.io/badge/Loon-%E4%B8%80%E9%94%AE%E6%B7%BB%E5%8A%A0-5B8DEF?style=for-the-badge)](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fzwjtano%2Floon-%2Fmaster%2FPlugins%2FFotMob_remove_ads.lpx)

```text
https://raw.githubusercontent.com/zwjtano/loon-/master/Plugins/FotMob_remove_ads.lpx
```

基于 Loon HAR 抓包整理，用于清空 FotMob 自家 house ads，并拦截抓包识别到的广告 SDK、广告图片与广告竞价接口。

### MyBlockAds - 保留哔哩哔哩热搜和搜索发现

[![一键添加到 Loon](https://img.shields.io/badge/Loon-%E4%B8%80%E9%94%AE%E6%B7%BB%E5%8A%A0-5B8DEF?style=for-the-badge)](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fzwjtano%2Floon-%2Fmaster%2FPlugins%2Fmyblockads-bilibili-search-preserved.lpx)

```text
https://raw.githubusercontent.com/zwjtano/loon-/master/Plugins/myblockads-bilibili-search-preserved.lpx
```

从 RuCu6 的 MyBlockAds 插件自动同步，并在上游出现相关规则时保留哔哩哔哩热搜、搜索发现和默认搜索词。

### 哔哩哔哩自定义插件

[![一键添加到 Loon](https://img.shields.io/badge/Loon-%E4%B8%80%E9%94%AE%E6%B7%BB%E5%8A%A0-5B8DEF?style=for-the-badge)](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fzwjtano%2Floon-%2Fmaster%2FPlugins%2Fbilibili.lpx)

```text
https://raw.githubusercontent.com/zwjtano/loon-/master/Plugins/bilibili.lpx
```

## 更新上游哔哩哔哩插件

在仓库根目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\update-bilibili.ps1
```

脚本会从下面地址下载最新的上游 `bilibili.lpx`：

```text
https://rucu6.pages.dev/Plugins/bilibili.lpx
```

然后重新应用本地开关：

- 热搜 / 热门话题过滤
- 搜索建议过滤
- 默认搜索框关键词过滤
