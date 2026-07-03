# Loon 插件仓库

这个仓库用于保存个人维护的 Loon 插件和相关脚本。

> GitHub README 会过滤 `loon://` 自定义协议，所以表格里的“一键导入”指向 `zwjtano.github.io` 跳转页；跳转页内部使用 Kelee Hub 同款格式：`loon://import?plugin=插件地址`。

## 插件列表

| 图标 | 插件 | 原始链接 | 一键导入 |
| --- | --- | --- | --- |
| <img src="https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/00/a2/9a/00a29a65-e92e-52da-15d5-c13b1c83fe2e/AppIcon-0-1x_U007epad-0-11-0-85-220-0.png/100x100bb.jpg" width="42" height="42" /> | FotMob 去广告 | [原始文件](https://raw.githubusercontent.com/zwjtano/loon-/master/Plugins/FotMob_remove_ads.lpx) | [导入 Loon](https://zwjtano.github.io/loon-/import/fotmob.html) |
| <img src="https://rucu6.pages.dev/Icons/app/bilibili.png" width="42" height="42" /> | 哔哩哔哩自定义插件 | [原始文件](https://raw.githubusercontent.com/zwjtano/loon-/master/Plugins/bilibili.lpx) | [导入 Loon](https://zwjtano.github.io/loon-/import/bilibili.html) |

## 原生导入链接

如果跳转页不可用，可以复制下面的 Kelee Hub 同款原生链接到 Safari 打开。

### FotMob 去广告

```text
loon://import?plugin=https://raw.githubusercontent.com/zwjtano/loon-/master/Plugins/FotMob_remove_ads.lpx
```

### 哔哩哔哩自定义插件

```text
loon://import?plugin=https://raw.githubusercontent.com/zwjtano/loon-/master/Plugins/bilibili.lpx
```

## 更新上游哔哩哔哩插件

仓库已配置 GitHub Actions 自动更新：每天北京时间 10:30 从上游同步一次 `bilibili.lpx`，然后重新应用本地自定义开关；如果上游没有变化，任务不会提交空更新。

也可以在 GitHub Actions 页面手动运行 `Update Bilibili Plugin`，或者在仓库根目录本地运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\update-bilibili.ps1
```

上游地址：

```text
https://rucu6.pages.dev/Plugins/bilibili.lpx
```

同步后会重新应用这些本地开关：

- 热搜 / 热门话题过滤
- 搜索建议过滤
- 默认搜索框关键词过滤
